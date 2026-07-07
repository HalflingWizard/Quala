# AGENTS.md

## Repo Goal

Quala is a CLI-first tool for human in the loop qualitative coding with a React web GUI.

Keep the tool simple. The CLI should run with `node cli.js` and read and write local project JSON files. The web GUI should run with `npm start`.

Keep application logic in `app.js`. Keep command line behavior in `cli.js`. Keep React GUI behavior in `src/`.

## Maintenance Rules

- Keep changes surgical and easy to review.
- Do not add a build system unless the user asks for one.
- Keep state in local project files unless the user asks for a backend.
- For new user requested features, add or prove the behavior in the CLI first so the core logic can support it. Add another front end only if the user asks for one.
- Keep exports compatible with `arazilab/analysis_tools` by preserving a datapoint level `annotation` field.
- Preserve exact quote verification. The app must not save model quotes that are not found in the source datapoint.
- Keep codebook history and restore behavior working after changes.
- Use clear language that an international undergraduate can understand.
- Avoid em dashes and colons in user facing long text when practical.

## Code Style

- Prefer plain JavaScript.
- Keep the web GUI as a small React app. Do not add extra frontend dependencies without a clear need.
- Use small functions with direct names.
- Avoid broad rewrites.
- Do not introduce dependencies without a clear need.
- When the user says to fix an issue with a number, include that issue number in the commit message so GitHub links it.

## Manual Checks

Before committing CLI changes, check these paths.

1. Create a project with `node cli.js init`.
2. Add a datapoint with `node cli.js add-text --text`.
3. Add a datapoint with `node cli.js add-text --text-file` using TXT and DOCX files.
4. Add multiple datapoints with `node cli.js add-files` using TXT and DOCX files.
5. Run `node cli.js run` on a short project when an API key is available.
6. Confirm the output JSON preserves datapoint level `annotation`.
7. Confirm exact quote verification rejects quotes not found in the source datapoint.

Also run this startup check.

```bash
node smoke-test.js
```

Before committing web GUI changes, run `npm start` and check these paths.

1. Create a new project.
2. Add a datapoint by paste.
3. Add multiple datapoints from TXT or DOCX files.
4. Download JSON.

For API related changes, also test loading models and one short datapoint when an API key is available.
