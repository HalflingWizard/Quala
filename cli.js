#!/usr/bin/env node

const fs = require("fs");
const QualaBackend = require("./app.js");

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error("Usage: node cli.js input-project.json output-project.json");
    console.error("Set OPENAI_API_KEY in the environment, or include apiKey in the input JSON.");
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const result = await QualaBackend.run(payload);
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
