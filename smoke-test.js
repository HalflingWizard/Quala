const fs = require("fs");
const vm = require("vm");

function makeClassList() {
  const classes = new Set();
  return {
    add: (...items) => items.forEach((item) => classes.add(item)),
    remove: (...items) => items.forEach((item) => classes.delete(item)),
    contains: (item) => classes.has(item)
  };
}

function makeElement(id = "") {
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    style: {},
    dataset: {},
    options: [],
    files: [],
    className: "",
    classList: makeClassList(),
    appendChild(child) {
      this.children = this.children || [];
      this.children.push(child);
      if (this.id === "modelSelect") this.options.push(child);
    },
    addEventListener() {},
    querySelectorAll() {
      return [];
    },
    closest() {
      return makeElement();
    },
    click() {}
  };
}

const html = fs.readFileSync("index.html", "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id)]));

const document = {
  getElementById(id) {
    return elements[id] || null;
  },
  createElement() {
    return makeElement();
  },
  querySelectorAll() {
    return [];
  }
};

const storedValues = {};
const localStorage = {
  getItem(key) {
    return storedValues[key] || null;
  },
  setItem(key, value) {
    storedValues[key] = value;
  }
};

const context = {
  document,
  localStorage,
  TextDecoder,
  AbortController,
  Blob: function Blob() {},
  URL: {
    createObjectURL() {
      return "";
    },
    revokeObjectURL() {}
  },
  navigator: {
    clipboard: {
      writeText() {}
    }
  },
  fetch() {},
  console
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("app.js", "utf8"), context);

if (!elements.modelSelect.options.length) {
  throw new Error("Preferences did not render model options.");
}

if (!html.includes('src="assets/quala-koala.png"') || html.includes("Quala 🐨")) {
  throw new Error("Header logo asset is not used.");
}

if (/Describe the qualitative study goal here|epilepsy|HCI/.test(elements.lens.value)) {
  throw new Error("Study lens default is not usable and generic.");
}

if (!elements.fileInput || !html.includes(".docx")) {
  throw new Error("DOCX file input is not available.");
}

if (!elements.newProjectBtn || !elements.loadProjectBtn || !elements.projectInput) {
  throw new Error("Project controls are not available.");
}

if (
  elements.saveBtn ||
  !elements.exportBtn ||
  !elements.autosaveStatus ||
  !elements.exportModal ||
  !elements.exportScope ||
  !elements.exportFormat ||
  !elements.confirmExportBtn
) {
  throw new Error("Auto-save status or export menu controls are missing.");
}

if (!elements.mergePrompt) {
  throw new Error("Merge reviewer prompt is not available.");
}

if (!elements.deleteCodeBtn) {
  throw new Error("Delete code button is not available.");
}

if (!elements.auditDocFilter || !elements.auditSortBtn) {
  throw new Error("Audit filter or sort controls are not available.");
}

if (!elements.howView || !html.includes("workflowGraph") || !html.includes('data-view="how"')) {
  throw new Error("How it works page or workflow graph is missing.");
}

if (!elements.processQueueBtn || html.includes("processCurrentBtn") || html.includes("processNextBtn")) {
  throw new Error("Workspace processing controls were not simplified.");
}

if (typeof context.readDocx !== "function") {
  throw new Error("DOCX reader did not load.");
}

const autosavePayload = JSON.parse(storedValues["quala-state-v1"]);
if (
  autosavePayload.tool !== "Quala" ||
  !autosavePayload.project ||
  !Array.isArray(autosavePayload.codebook) ||
  !Array.isArray(autosavePayload.data) ||
  !autosavePayload.exported_at
) {
  throw new Error("Browser auto-save is not using the full project JSON format.");
}
const reloadedAutosave = context.loadState();
if (!Array.isArray(reloadedAutosave.docs) || !Array.isArray(reloadedAutosave.codebook)) {
  throw new Error("Browser auto-save could not be loaded as a project.");
}

const zipName = Buffer.from("word/document.xml");
const zipContent = Buffer.from("<document>test</document>");
const localHeader = Buffer.alloc(30);
localHeader.writeUInt32LE(0x04034b50, 0);
localHeader.writeUInt16LE(zipName.length, 26);
const centralHeader = Buffer.alloc(46);
centralHeader.writeUInt32LE(0x02014b50, 0);
centralHeader.writeUInt32LE(zipContent.length, 20);
centralHeader.writeUInt32LE(zipContent.length, 24);
centralHeader.writeUInt16LE(zipName.length, 28);
const endHeader = Buffer.alloc(22);
endHeader.writeUInt32LE(0x06054b50, 0);
endHeader.writeUInt16LE(1, 8);
endHeader.writeUInt16LE(1, 10);
endHeader.writeUInt32LE(centralHeader.length + zipName.length, 12);
endHeader.writeUInt32LE(localHeader.length + zipName.length + zipContent.length, 16);
const zipBytes = new Uint8Array(
  Buffer.concat([localHeader, zipName, zipContent, centralHeader, zipName, endHeader])
);
const zipEntry = context.findZipEntry(zipBytes, "word/document.xml");
if (zipEntry.compression !== 0 || zipEntry.compressedSize !== zipContent.length) {
  throw new Error("DOCX ZIP entry could not be read.");
}

const gpt4o = context.modelCapabilities("gpt-4o");
if (!gpt4o.temperature || gpt4o.verbosity || gpt4o.reasoning) {
  throw new Error("GPT-4 style model capabilities are wrong.");
}

const gpt55 = context.modelCapabilities("gpt-5.5");
if (gpt55.temperature || !gpt55.verbosity || !gpt55.reasoning) {
  throw new Error("GPT-5 style model capabilities are wrong.");
}

const o3 = context.modelCapabilities("o3");
if (o3.temperature || o3.verbosity || !o3.reasoning) {
  throw new Error("o-series model capabilities are wrong.");
}

const verification = context.evidenceAuditor("alpha beta gamma", ["beta", "delta"]);
if (!verification.verified_quotes[0].verified || verification.verified_quotes[0].start_char !== 6) {
  throw new Error("Evidence auditor did not verify an exact quote.");
}
if (verification.failed_quotes[0].quote !== "delta") {
  throw new Error("Evidence auditor did not flag a failed quote.");
}

const scout = context.removeFailedScoutQuotes(
  {
    scout_codes: [
      {
        temporary_code_name: "Found idea",
        definition: "A test idea.",
        supporting_quotes: ["beta", "delta"],
        confidence: "high"
      }
    ]
  },
  verification
);
if (scout.scout_codes[0].supporting_quotes.length !== 1 || scout.scout_codes[0].supporting_quotes[0] !== "beta") {
  throw new Error("Failed scout quotes were not removed.");
}

const fallbackNovelty = context.removeFailedNoveltyQuotes(
  { doc_id: "D1", novelty_decisions: [] },
  verification,
  scout
);
if (
  fallbackNovelty.novelty_decisions.length !== 1 ||
  fallbackNovelty.novelty_decisions[0].evidence_quotes[0] !== "beta"
) {
  throw new Error("Verified scout finding did not become a fallback novelty item.");
}

const falseCoveredDecisions = Array.from({ length: 6 }, (_, index) => ({
  scout_code_name: `False covered idea ${index + 1}`,
  decision: "already_covered",
  matched_code_id: `False covered idea ${index + 1}`,
  suggested_code: {
    name: `False covered idea ${index + 1}`,
    definition: "A code that does not exist yet."
  },
  evidence_quotes: ["beta"],
  rationale: "The model incorrectly claimed this was already covered."
}));
const falseCoveredPacket = context.applyCodebookUpdates(
  { id: "D1" },
  {
    doc_id: "D1",
    novelty_decisions: falseCoveredDecisions
  },
  { merge_review: [] },
  verification
);
if (falseCoveredPacket.active_codes_added.length !== 6) {
  throw new Error("False already_covered decisions did not create six active codes.");
}
const existingCode = falseCoveredPacket.active_codes_added[0];
const coveredPacket = context.applyCodebookUpdates(
  { id: "D2" },
  {
    doc_id: "D2",
    novelty_decisions: [
      {
        ...falseCoveredDecisions[0],
        matched_code_id: existingCode.code_id
      }
    ]
  },
  { merge_review: [] },
  verification
);
if (coveredPacket.active_codes_added.length !== 0) {
  throw new Error("A valid already_covered decision created a duplicate code.");
}

const firstDoc = { id: "D1", source: "test.txt", text: "alpha beta gamma" };
const scoutPrompt = context.buildScoutPrompt(firstDoc);
const applierPrompt = context.buildApplierPrompt(firstDoc);
const firstDocApplierInput = JSON.parse(applierPrompt[1].content);
const quoteQualityText = `${scoutPrompt[0].content} ${applierPrompt[0].content} ${firstDocApplierInput.required_behavior.join(" ")}`;
if (
  !quoteQualityText.includes("interviewer question") ||
  !quoteQualityText.includes("rich") ||
  !quoteQualityText.includes("contiguous")
) {
  throw new Error("Agent prompts are missing the contextual quote quality rules.");
}
if (!firstDocApplierInput.codebook.some((code) => code.code_id === existingCode.code_id)) {
  throw new Error("A code created from the first document was missing from its applier prompt.");
}
const finalVerification = context.evidenceAuditor(firstDoc.text, ["beta", "not in document"]);
const verifiedFirstDocApplier = context.removeFailedApplierQuotes(
  {
    doc_id: firstDoc.id,
    applied_codes: [
      {
        code_id: existingCode.code_id,
        instances: [
          { quote: "beta", reason: "Exact evidence." },
          { quote: "not in document", reason: "Invalid evidence." }
        ]
      }
    ],
    codes_with_no_instance: []
  },
  finalVerification
);
context.applyAnnotationResult(firstDoc, verifiedFirstDocApplier);
const firstDocAnnotation = context.exportPayload().data.find((doc) => doc.id === firstDoc.id);
if (
  firstDocAnnotation?.quotes.length !== 1 ||
  firstDocAnnotation.quotes[0].quote !== "beta" ||
  !firstDocAnnotation.annotation.includes(existingCode.name) ||
  "polarity" in firstDocAnnotation.quotes[0]
) {
  throw new Error("The first document did not save its verified code annotation.");
}
const legacyAnnotation = context.normalizeAnnotationDoc({
  id: "legacy",
  quotes: [
    {
      quote: "beta",
      code_ids: [existingCode.code_id],
      annotations: [existingCode.name],
      certainty: 5,
      polarity: "mixed",
      rationale: "Legacy record."
    }
  ]
});
if ("polarity" in legacyAnnotation.quotes[0]) {
  throw new Error("Legacy polarity was not removed.");
}
context.renderAnnotations();
const renderedAnnotations = (elements.annotationList.children || []).map((item) => item.innerHTML).join("");
if (renderedAnnotations.includes("mixed") || !renderedAnnotations.includes('title="Code assigned to this exact quote."')) {
  throw new Error("Annotation tags still show polarity or lack hover explanations.");
}
if (
  !context.tagTooltip("code_status", "active").includes("available") ||
  !context.tagTooltip("coverage", "2/3").includes("2/3")
) {
  throw new Error("Tag tooltips are missing useful explanations.");
}

const processDocSource = context.processDoc.toString();
const workflowStages = [
  'event_type: "document_scout"',
  'event_type: "novelty_detector"',
  'event_type: "merge_reviewer"',
  'event_type: "codebook_update"',
  'event_type: "codebook_applier"',
  'event_type: "evidence_auditor"'
];
let previousStage = -1;
for (const stage of workflowStages) {
  const stageIndex = processDocSource.indexOf(stage);
  if (stageIndex <= previousStage) {
    throw new Error("Document workflow stages are in the wrong order.");
  }
  previousStage = stageIndex;
}

const exportPayload = context.exportPayload();
if (
  !Array.isArray(exportPayload.data) ||
  !Array.isArray(exportPayload.audit_log) ||
  !exportPayload.project ||
  !Array.isArray(exportPayload.project.docs)
) {
  throw new Error("Export payload is missing workflow arrays.");
}
const allJsonExport = context.exportData("all");
const codebookJsonExport = context.exportData("codebook");
const annotationsJsonExport = context.exportData("annotations");
const logsJsonExport = context.exportData("logs");
if (
  !allJsonExport.project ||
  codebookJsonExport.export_type !== "codebook" ||
  !Array.isArray(codebookJsonExport.codebook) ||
  annotationsJsonExport.export_type !== "annotations" ||
  !Array.isArray(annotationsJsonExport.data) ||
  logsJsonExport.export_type !== "audit_logs" ||
  !Array.isArray(logsJsonExport.audit_log)
) {
  throw new Error("JSON export scopes are wrong.");
}
const xmlText = context.xmlSpreadsheetExport("all");
if (!xmlText.includes("<Workbook") || !xmlText.includes('ss:Name="Codebook"') || !xmlText.includes('ss:Name="Annotations"')) {
  throw new Error("XML spreadsheet export is missing workbook sheets.");
}
const plainText = context.textExport("codebook");
if (!plainText.includes("# Codebook")) {
  throw new Error("TXT export is missing the codebook section.");
}
if (context.exportRows("annotations").some((sheet) => sheet.rows.some((row) => "polarity" in row))) {
  throw new Error("Polarity is still present in annotation exports.");
}
const logText = context.textExport("logs");
if (!logText.includes("# Audit log")) {
  throw new Error("TXT export is missing the audit log section.");
}
const logXml = context.xmlSpreadsheetExport("logs");
if (!logXml.includes('ss:Name="Audit log"')) {
  throw new Error("XML export is missing the audit log sheet.");
}
if (!context.exportExplanation("all", "json").includes("Load this JSON in Quala later")) {
  throw new Error("The reloadable all-data JSON explanation is missing.");
}
if (!context.exportExplanation("logs", "json").includes("prompts")) {
  throw new Error("The troubleshooting log export explanation is missing.");
}

const updatePacket = context.applyCodebookUpdates(
  { id: "D2" },
  fallbackNovelty,
  { merge_review: [] },
  verification
);
const candidatePayload = context.exportPayload();
const candidate = candidatePayload.codebook.find((code) => code.name === "Found idea");
if (!candidate || candidate.status !== "active") {
  throw new Error("New scout code was not added as an active codebook item.");
}
if (!updatePacket.active_codes_added.some((item) => item.code_id === candidate.code_id)) {
  throw new Error("Codebook update did not report the active code.");
}
const coverage = context.computeCoverage();
if (!coverage[candidate.code_id] || coverage[candidate.code_id] <= 0) {
  throw new Error("Coverage did not count verified codebook evidence.");
}

const coverageDetails = context.coverageForCode(
  {
    code_id: "C100",
    name: "Prevalent code",
    created_from_doc: "D1",
    example_quotes: [{ doc_id: "D1", quote: "short", verified: true }]
  },
  [{ id: "D1" }, { id: "D2" }, { id: "D3" }],
  [
    {
      id: "D2",
      quotes: [{ quote: "A richer quote from another datapoint.", code_ids: ["C100"], annotations: [] }]
    }
  ]
);
if (
  coverageDetails.count !== 2 ||
  coverageDetails.total !== 3 ||
  coverageDetails.percent !== 67 ||
  coverageDetails.docIds.join(",") !== "D1,D2"
) {
  throw new Error("Coverage details did not include the datapoint ratio.");
}
if (!context.tagTooltip("related_datapoints", coverageDetails.docIds).includes("D1, D2")) {
  throw new Error("The coverage ratio tooltip does not list related datapoints.");
}
const bestQuote = context.bestQuoteForCode(
  {
    code_id: "C100",
    name: "Prevalent code",
    created_from_doc: "D1",
    example_quotes: [{ doc_id: "D1", quote: "short", verified: true }]
  },
  [
    {
      id: "D2",
      quotes: [{ quote: "A richer quote from another datapoint.", code_ids: ["C100"], annotations: [] }]
    }
  ]
);
if (bestQuote.quote !== "A richer quote from another datapoint." || bestQuote.doc_id !== "D2") {
  throw new Error("The richest codebook quote or its datapoint ID was not selected.");
}
const sortedCodeRows = context.sortCodebookRows([
  { code: { name: "Low" }, coverage: { count: 1, percent: 33 } },
  { code: { name: "Zulu" }, coverage: { count: 2, percent: 67 } },
  { code: { name: "Alpha" }, coverage: { count: 2, percent: 67 } }
]);
if (sortedCodeRows.map((row) => row.code.name).join(",") !== "Alpha,Zulu,Low") {
  throw new Error("Codebook rows were not sorted by prevalence.");
}
const exportedCodeRows = context.codebookExportRows({
  project: { docs: [{ id: "D1" }, { id: "D2" }, { id: "D3" }] },
  codebook: [
    {
      code_id: "C100",
      name: "Prevalent code",
      definition: "Test",
      status: "active",
      created_from_doc: "D1",
      example_quotes: [{ doc_id: "D1", quote: "short", verified: true }]
    }
  ],
  data: [
    {
      id: "D2",
      quotes: [{ quote: "A richer quote.", code_ids: ["C100"], annotations: [] }]
    }
  ]
});
if (exportedCodeRows[0].related_datapoints !== "D1, D2" || exportedCodeRows[0].coverage_ratio !== "2/3") {
  throw new Error("Codebook export is missing related datapoints or coverage ratio.");
}
const fullExportCode = context.exportPayload().codebook.find((code) => code.code_id === existingCode.code_id);
if (!Array.isArray(fullExportCode.related_datapoints) || !fullExportCode.coverage_ratio) {
  throw new Error("Full project JSON is missing code coverage datapoints.");
}

context.addAuditLog({
  doc_id: "D1",
  event_type: "document_scout",
  title: "Document scout",
  summary: "One concept found.",
  stats: { concepts_found: 1 },
  input: { prompt: ["test prompt"] },
  output: { scout_codes: [] }
});
const auditPayload = context.exportPayload().audit_log.find((entry) => entry.title === "Document scout");
if (
  !auditPayload ||
  auditPayload.stats.concepts_found !== 1 ||
  !auditPayload.input ||
  !auditPayload.output ||
  auditPayload.actor?.label !== "Agent 1 Scout"
) {
  throw new Error("Structured audit event was not saved.");
}
const actorChecks = {
  document_scout: "Agent 1 Scout",
  codebook_applier: "Agent 2 Applier",
  novelty_detector: "Agent 3 Novelty",
  merge_reviewer: "Agent 4 Merge",
  evidence_auditor: "Exact-match Auditor",
  codebook_update: "Quala System",
  code_manual_edit: "Human"
};
for (const [event_type, label] of Object.entries(actorChecks)) {
  if (context.auditActor({ event_type }).label !== label) {
    throw new Error(`Audit actor mapping is wrong for ${event_type}.`);
  }
}
if (!html.includes("auditActor")) {
  throw new Error("Audit actor badge styling is missing.");
}
context.renderAudit();
const scoutAuditCard = (elements.auditList.children || []).find((card) => card.innerHTML.includes("Agent 1 Scout"));
if (!scoutAuditCard || !scoutAuditCard.innerHTML.includes("auditActor agent")) {
  throw new Error("The audit log did not render the agent badge.");
}

const loadedProject = context.projectStateFromPayload({
  project: {
    docs: [{ id: "D1", source: "test.txt", text: "Example text.", status: "queued" }],
    selectedDocId: "D1",
    preferences: { model: "gpt-test", apiKey: "should-not-load" }
  },
  codebook: [{ code_id: "C001", name: "Test code", definition: "A test code.", status: "active" }],
  data: [
    {
      id: "D1",
      source: "test.txt",
      text: "Example text.",
      annotation: ["Test code"],
      quotes: [{ quote: "Example text.", annotations: ["Test code"], code_ids: ["C001"] }]
    }
  ],
  audit_log: []
});
if (loadedProject.docs.length !== 1 || loadedProject.codebook[0].name !== "Test code") {
  throw new Error("Project payload did not load.");
}
if (loadedProject.preferences.apiKey === "should-not-load") {
  throw new Error("Project load should not import API keys.");
}

if (!elements.stopProcessBtn || !html.includes('id="stopProcessBtn" class="danger" disabled')) {
  throw new Error("Stop processing button is missing or enabled while idle.");
}

console.log("startup ok");
