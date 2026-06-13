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

if (!elements.fileInput || !html.includes(".docx")) {
  throw new Error("DOCX file input is not available.");
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

const exportPayload = context.exportPayload();
if (!Array.isArray(exportPayload.data) || !Array.isArray(exportPayload.audit_log) || !Array.isArray(exportPayload.review_items)) {
  throw new Error("Export payload is missing workflow arrays.");
}

console.log("startup ok");
