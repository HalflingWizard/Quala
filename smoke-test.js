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

const localStorage = {
  getItem() {
    return null;
  },
  setItem() {}
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

if (!elements.mergePrompt) {
  throw new Error("Merge reviewer prompt is not available.");
}

if (!elements.processQueueBtn || html.includes("processCurrentBtn") || html.includes("processNextBtn")) {
  throw new Error("Workspace processing controls were not simplified.");
}

if (typeof context.readDocx !== "function") {
  throw new Error("DOCX reader did not load.");
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

const exportPayload = context.exportPayload();
if (
  !Array.isArray(exportPayload.data) ||
  !Array.isArray(exportPayload.audit_log) ||
  !Array.isArray(exportPayload.review_items) ||
  !exportPayload.project ||
  !Array.isArray(exportPayload.project.docs)
) {
  throw new Error("Export payload is missing workflow arrays.");
}

context.buildHumanReviewPacket(
  { id: "D2" },
  fallbackNovelty,
  { merge_review: [] },
  verification
);
const candidatePayload = context.exportPayload();
const candidate = candidatePayload.codebook.find((code) => code.name === "Found idea");
if (!candidate || candidate.status !== "needs_human_review") {
  throw new Error("New scout code was not added as a pending codebook item.");
}
if (!candidatePayload.review_items.some((item) => item.candidate_code_id === candidate.code_id)) {
  throw new Error("Review item was not linked to the pending code.");
}
const coverage = context.computeCoverage();
if (!coverage[candidate.code_id] || coverage[candidate.code_id] <= 0) {
  throw new Error("Coverage did not count verified codebook evidence.");
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
  review_items: [],
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
