#!/usr/bin/env node

const fs = require("fs");
const QualaBackend = require("./app.js");

function usage() {
  return [
    "Usage:",
    "  node cli.js run input-project.json output-project.json",
    "  node cli.js init output-project.json",
    "  node cli.js add-text input-project.json output-project.json --id D1 --source notes.txt --text-file notes.txt",
    "  node cli.js add-text input-project.json output-project.json --id D1 --source pasted --text \"Datapoint text\"",
    "",
    "The old form still works:",
    "  node cli.js input-project.json output-project.json",
    "",
    "Set OPENAI_API_KEY in the environment, or include apiKey in the input JSON."
  ].join("\n");
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function writeJson(path, payload) {
  fs.writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
}

function blankProject(exportedAt = new Date().toISOString()) {
  return {
    tool: "Quala",
    exported_at: exportedAt,
    project: {
      docs: [],
      selectedDocId: null,
      history: [],
      preferences: {},
      autosavedAt: exportedAt
    },
    codebook: [],
    audit_log: [],
    data: []
  };
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return args[index + 1] || "";
}

function ensureProjectShape(payload) {
  const project = payload.project || {};
  return {
    ...blankProject(payload.exported_at || new Date().toISOString()),
    ...payload,
    project: {
      docs: project.docs || payload.docs || payload.data || [],
      selectedDocId: project.selectedDocId || payload.selectedDocId || null,
      history: project.history || payload.history || [],
      preferences: project.preferences || payload.preferences || {},
      autosavedAt: project.autosavedAt || payload.exported_at || new Date().toISOString()
    },
    codebook: payload.codebook || project.codebook || [],
    audit_log: payload.audit_log || project.auditLog || payload.auditLog || [],
    data: payload.data || project.annotations || payload.annotations || []
  };
}

function addTextCommand(args) {
  const [inputPath, outputPath] = args;
  const id = optionValue(args, "--id");
  const source = optionValue(args, "--source");
  const textFile = optionValue(args, "--text-file");
  const inlineText = optionValue(args, "--text");
  const text = textFile ? fs.readFileSync(textFile, "utf8") : inlineText;

  if (!inputPath || !outputPath || !id || !text) {
    throw new Error("add-text needs input, output, --id, and either --text-file or --text.");
  }

  const payload = ensureProjectShape(readJson(inputPath));
  const docs = payload.project.docs.filter((doc) => doc.id !== id);
  docs.push({
    id,
    source: source || textFile || "cli",
    text,
    status: "queued"
  });
  payload.project.docs = docs;
  if (!payload.project.selectedDocId) payload.project.selectedDocId = id;
  payload.exported_at = new Date().toISOString();
  payload.project.autosavedAt = payload.exported_at;
  writeJson(outputPath, payload);
}

async function main() {
  const [, , commandOrInput, ...args] = process.argv;
  if (!commandOrInput || commandOrInput === "--help" || commandOrInput === "-h") {
    console.error(usage());
    process.exit(commandOrInput ? 0 : 1);
  }

  if (commandOrInput === "init") {
    const [outputPath] = args;
    if (!outputPath) throw new Error("init needs an output project path.");
    writeJson(outputPath, blankProject());
    return;
  }

  if (commandOrInput === "add-text") {
    addTextCommand(args);
    return;
  }

  if (commandOrInput === "run") {
    const [inputPath, outputPath] = args;
    if (!inputPath || !outputPath) throw new Error("run needs input and output project paths.");
    const result = await QualaBackend.run(readJson(inputPath));
    writeJson(outputPath, result);
    return;
  }

  const [outputPath] = args;
  if (!outputPath) throw new Error("Missing output project path.\n\n" + usage());
  const result = await QualaBackend.run(readJson(commandOrInput));
  writeJson(outputPath, result);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
