const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const QualaBackend = require("./app.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runCli(args) {
  execFileSync(process.execPath, ["cli.js", ...args], {
    cwd: __dirname,
    stdio: "pipe"
  });
}

function assertIncludes(text, needle, message) {
  if (!text.includes(needle)) throw new Error(message);
}

function makeDocxBuffer(text) {
  const xmlText = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .split("\n")
    .map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`)
    .join("");
  const zipName = Buffer.from("word/document.xml");
  const zipContent = Buffer.from(`<w:document xmlns:w="w"><w:body>${xmlText}</w:body></w:document>`);
  const compressed = zlib.deflateRawSync(zipContent);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(zipContent.length, 22);
  localHeader.writeUInt16LE(zipName.length, 26);
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(8, 10);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(zipContent.length, 24);
  centralHeader.writeUInt16LE(zipName.length, 28);
  const centralOffset = localHeader.length + zipName.length + compressed.length;
  const centralSize = centralHeader.length + zipName.length;
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(1, 8);
  endHeader.writeUInt16LE(1, 10);
  endHeader.writeUInt32LE(centralSize, 12);
  endHeader.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([localHeader, zipName, compressed, centralHeader, zipName, endHeader]);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quala-cli-"));
const emptyProjectPath = path.join(tmpDir, "empty.json");
const textPath = path.join(tmpDir, "datapoint.txt");
const docxPath = path.join(tmpDir, "datapoint.docx");
const projectPath = path.join(tmpDir, "project.json");
const docxProjectPath = path.join(tmpDir, "docx-project.json");
const multiProjectPath = path.join(tmpDir, "multi-project.json");

runCli(["init", emptyProjectPath]);
const emptyProject = readJson(emptyProjectPath);
if (
  emptyProject.tool !== "Quala" ||
  !emptyProject.project ||
  !Array.isArray(emptyProject.project.docs) ||
  !Array.isArray(emptyProject.codebook) ||
  !Array.isArray(emptyProject.audit_log) ||
  !Array.isArray(emptyProject.data)
) {
  throw new Error("CLI init did not create a full project JSON file.");
}

fs.writeFileSync(textPath, "alpha beta gamma\n");
runCli([
  "add-text",
  emptyProjectPath,
  projectPath,
  "--id",
  "D1",
  "--source",
  "datapoint.txt",
  "--text-file",
  textPath
]);
const project = readJson(projectPath);
if (
  project.project.docs.length !== 1 ||
  project.project.docs[0].id !== "D1" ||
  project.project.docs[0].status !== "queued" ||
  project.project.docs[0].text !== "alpha beta gamma\n"
) {
  throw new Error("CLI add-text did not add a queued datapoint.");
}

fs.writeFileSync(docxPath, makeDocxBuffer("first docx paragraph\nsecond docx paragraph"));
runCli([
  "add-text",
  projectPath,
  docxProjectPath,
  "--id",
  "D2",
  "--source",
  "datapoint.docx",
  "--text-file",
  docxPath
]);
const docxProject = readJson(docxProjectPath);
const docxDoc = docxProject.project.docs.find((doc) => doc.id === "D2");
if (!docxDoc || !docxDoc.text.includes("first docx paragraph") || !docxDoc.text.includes("second docx paragraph")) {
  throw new Error("CLI add-text did not read a DOCX datapoint.");
}

runCli(["add-files", emptyProjectPath, multiProjectPath, textPath, docxPath]);
const multiProject = readJson(multiProjectPath);
if (
  multiProject.project.docs.length !== 2 ||
  multiProject.project.docs[0].id !== "D1" ||
  multiProject.project.docs[1].id !== "D2" ||
  !multiProject.project.docs[1].text.includes("second docx paragraph")
) {
  throw new Error("CLI add-files did not queue multiple TXT and DOCX files.");
}

const loadedProject = QualaBackend.projectStateFromPayload({
  ...project,
  apiKey: "from-payload",
  project: {
    ...project.project,
    preferences: { model: "gpt-test", apiKey: "should-not-load" }
  },
  codebook: [{ code_id: "C001", name: "Test code", definition: "A test code.", status: "active" }],
  data: [
    {
      id: "D1",
      source: "datapoint.txt",
      text: "alpha beta gamma",
      annotation: ["Test code"],
      quotes: [{ quote: "beta", annotations: ["Test code"], code_ids: ["C001"] }]
    }
  ]
});
if (loadedProject.docs.length !== 1 || loadedProject.codebook[0].name !== "Test code") {
  throw new Error("Project payload did not load into backend state.");
}
if (loadedProject.preferences.apiKey === "should-not-load") {
  throw new Error("Project preferences should not import stored API keys.");
}

const verification = QualaBackend.evidenceAuditor("alpha beta gamma", ["beta", "delta"]);
if (!verification.verified_quotes[0].verified || verification.verified_quotes[0].start_char !== 6) {
  throw new Error("Evidence auditor did not verify an exact quote.");
}
if (verification.failed_quotes[0].quote !== "delta") {
  throw new Error("Evidence auditor did not reject a missing quote.");
}

const gpt4o = QualaBackend.modelCapabilities("gpt-4o");
if (!gpt4o.temperature || gpt4o.verbosity || gpt4o.reasoning) {
  throw new Error("GPT-4 style model capabilities are wrong.");
}

const gpt55 = QualaBackend.modelCapabilities("gpt-5.5");
if (gpt55.temperature || !gpt55.verbosity || !gpt55.reasoning) {
  throw new Error("GPT-5 style model capabilities are wrong.");
}

const o3 = QualaBackend.modelCapabilities("o3");
if (o3.temperature || o3.verbosity || !o3.reasoning) {
  throw new Error("o-series model capabilities are wrong.");
}

async function checkBackendRunWithoutSignal() {
  const progressEvents = [];
  const auditEvents = [];
  const payload = await QualaBackend.run(
    {
      apiKey: "test-key",
      project: {
        docs: [{ id: "D1", source: "stub", text: "alpha beta gamma", status: "queued" }]
      }
    },
    {
      onAudit(event) {
        auditEvents.push(event);
      },
      onProgress(event) {
        progressEvents.push(event);
      },
      api: {
        async createStructuredResponse({ schema }) {
          if (schema.name === "quala_document_scout") {
            return {
              doc_id: "D1",
              scout_codes: [
                {
                  temporary_code_name: "Beta mention",
                  definition: "A mention of beta.",
                  supporting_quotes: ["beta"],
                  confidence: "high"
                }
              ]
            };
          }
          if (schema.name === "quala_novelty_detector") {
            return {
              doc_id: "D1",
              novelty_decisions: [
                {
                  scout_code_name: "Beta mention",
                  decision: "new_code",
                  matched_code_id: "",
                  suggested_code: { name: "Beta mention", definition: "A mention of beta." },
                  evidence_quotes: ["beta"],
                  rationale: "Stub decision."
                }
              ]
            };
          }
          if (schema.name === "quala_merge_reviewer") return { merge_review: [] };
          if (schema.name === "quala_codebook_applier") {
            return {
              doc_id: "D1",
              applied_codes: [
                {
                  code_id: "C001",
                  instances: [{ quote: "beta", reason: "Stub exact quote." }]
                }
              ],
              codes_with_no_instance: []
            };
          }
          throw new Error(`Unexpected schema ${schema.name}`);
        }
      }
    }
  );
  if (!payload.data[0]?.annotation.includes("Beta mention")) {
    throw new Error("Backend run without an AbortSignal did not process the queue.");
  }
  if (
    progressEvents.length < 2 ||
    progressEvents[0].percent !== 0 ||
    progressEvents[progressEvents.length - 1].percent !== 100
  ) {
    throw new Error("Backend did not report queue progress.");
  }
  if (!auditEvents.some((event) => event.event_type === "document_scout" && event.output?.scout_codes?.length)) {
    throw new Error("Backend did not stream agent output events.");
  }
}

async function checkCodeRefinementWithoutNetwork() {
  const auditEvents = [];
  const result = await QualaBackend.refineCodes(
    {
      apiKey: "test-key",
      project: {
        docs: [{ id: "D1", source: "stub", text: "alpha beta gamma", status: "coded" }]
      },
      codebook: [
        { code_id: "C001", name: "Alpha code", definition: "Alpha.", status: "active" },
        { code_id: "C002", name: "Beta code", definition: "Beta.", status: "active" }
      ],
      data: [
        {
          id: "D1",
          source: "stub",
          text: "alpha beta gamma",
          annotation: ["Alpha code", "Beta code"],
          quotes: [
            { quote: "alpha", annotations: ["Alpha code"], code_ids: ["C001"] },
            { quote: "beta", annotations: ["Beta code"], code_ids: ["C002"] }
          ]
        }
      ]
    },
    { mode: "merge", code_ids: ["C001", "C002"], lens: "Greek letter mentions" },
    {
      onAudit(event) {
        auditEvents.push(event);
      },
      api: {
        async createStructuredResponse({ schema }) {
          if (schema.name !== "quala_code_refinement") throw new Error(`Unexpected schema ${schema.name}`);
          return {
            mode: "merge",
            summary: "Merged related Greek letter mentions.",
            replacement_codes: [
              {
                temporary_id: "R1",
                name: "Greek letter mentions",
                definition: "Mentions of Greek letter terms.",
                source_code_ids: ["C001", "C002"],
                assignments: [
                  { doc_id: "D1", quote: "alpha", reason: "Exact alpha quote." },
                  { doc_id: "D1", quote: "missing quote", reason: "This should be rejected." }
                ]
              }
            ]
          };
        }
      }
    }
  );
  const replacement = result.proposal.replacement_codes[0];
  if (!replacement || replacement.assignments.length !== 1 || replacement.assignments[0].quote !== "alpha") {
    throw new Error("Code refinement did not keep only exact quote assignments.");
  }
  if (!auditEvents.some((event) => event.event_type === "refinement_auditor")) {
    throw new Error("Code refinement did not stream auditor output.");
  }
}

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const webApp = fs.readFileSync(path.join(__dirname, "src", "App.jsx"), "utf8");
const main = fs.readFileSync(path.join(__dirname, "src", "main.jsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "src", "styles.css"), "utf8");
const cli = fs.readFileSync(path.join(__dirname, "cli.js"), "utf8");
const viteConfig = fs.readFileSync(path.join(__dirname, "vite.config.js"), "utf8");
const gitignore = fs.readFileSync(path.join(__dirname, ".gitignore"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
assertIncludes(cli, "loadEnvFile", "CLI does not load .env files.");
assertIncludes(viteConfig, "OPENAI_API_KEY", "Vite config does not expose the local .env API key.");
assertIncludes(webApp, "__QUALA_OPENAI_API_KEY__", "Web GUI does not read the Vite .env API key.");
assertIncludes(gitignore, ".env", ".env is not ignored by git.");
assertIncludes(html, "/src/main.jsx", "Vite React entry script is missing.");
assertIncludes(main, "createRoot", "React root setup is missing.");
assertIncludes(packageJson.scripts.start, "vite", "npm start does not run the React dev server.");
assertIncludes(webApp, "QualaBackend.run", "Web GUI does not call the backend run path.");
assertIncludes(webApp, "readDocxBytes", "Web GUI does not use the shared DOCX reader.");
assertIncludes(webApp, ".docx", "Web GUI file input does not accept DOCX files.");
assertIncludes(webApp, "multiple", "Web GUI file input does not accept multiple files.");
assertIncludes(webApp, "onDrop", "Web GUI does not support drag and drop file import.");
assertIncludes(webApp, "Drop TXT or DOCX files here", "Web GUI does not show a drag and drop target.");
assertIncludes(webApp, "Process Queue", "Web GUI does not show a process queue.");
assertIncludes(webApp, "role=\"progressbar\"", "Web GUI does not render a progress bar.");
assertIncludes(webApp, "Main navigation", "Web GUI does not include page navigation.");
assertIncludes(webApp, "activeView === \"settings\"", "Web GUI does not split settings into a separate page.");
assertIncludes(webApp, "Agent Outputs", "Web GUI does not expose agent outputs.");
assertIncludes(webApp, "agentOutputGrid", "Web GUI does not show agent input and output details.");
assertIncludes(webApp, "StageFindings", "Web GUI does not render readable agent findings.");
assertIncludes(webApp, "onAudit", "Web GUI does not receive live agent output events.");
assertIncludes(webApp, "relatedDatapointsForCode", "Codebook does not calculate related datapoints.");
assertIncludes(webApp, "<th>Datapoints</th>", "Codebook does not show a datapoints column.");
assertIncludes(webApp, "Code Refinement", "Web GUI does not expose a code refinement page.");
assertIncludes(webApp, "mergeCodes", "Web GUI cannot merge selected codes.");
assertIncludes(webApp, "runAgentRefinement", "Web GUI cannot run agent-guided code refinement.");
assertIncludes(webApp, "Agent-guided split", "Web GUI does not expose agent-guided split.");
assertIncludes(webApp, "EvidencePopup", "Code refinement does not show evidence datapoint popups.");
assertIncludes(webApp, "EvidenceQuoteList", "Code refinement does not render quote evidence buttons.");
assertIncludes(webApp, "manual_merge", "Code merger does not record a manual merge history event.");
assertIncludes(webApp, "manual_guided_split", "Code refinement does not record split history.");
assertIncludes(webApp, "manual_guided_merge", "Code refinement does not record guided merge history.");
assertIncludes(webApp, "refineCodes", "Web GUI does not call the code refinement backend.");
assertIncludes(fs.readFileSync(path.join(__dirname, "app.js"), "utf8"), "refineCodes: runCodeRefinement", "Backend does not expose code refinement.");
assertIncludes(webApp, "downloadJson", "Web GUI cannot download project JSON.");
assertIncludes(css, ".progressFill", "Web GUI progress bar styling is missing.");
assertIncludes(css, ".appNav", "Web GUI navigation styling is missing.");
assertIncludes(css, ".mergeCodeList", "Code merger list styling is missing.");
assertIncludes(css, ".proposalPanel", "Code refinement proposal styling is missing.");
assertIncludes(css, ".evidenceModal", "Code refinement evidence popup styling is missing.");
assertIncludes(css, ".actorBadge", "Agent output actor badge styling is missing.");
assertIncludes(css, ".findingCard", "Readable agent finding cards are missing styling.");
assertIncludes(css, ".dropZone", "Web GUI drag and drop styling is missing.");
assertIncludes(css, ".tagList", "Codebook datapoint tags are missing styling.");

checkBackendRunWithoutSignal()
  .then(checkCodeRefinementWithoutNetwork)
  .then(() => {
    console.log("startup ok");
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
