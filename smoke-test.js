const fs = require("fs");
const os = require("os");
const path = require("path");
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quala-cli-"));
const emptyProjectPath = path.join(tmpDir, "empty.json");
const textPath = path.join(tmpDir, "datapoint.txt");
const projectPath = path.join(tmpDir, "project.json");

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

console.log("startup ok");
