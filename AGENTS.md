# AGENTS.md

## Repo Goal

Quala is a CLI-first Node tool for human in the loop qualitative coding with a small React 18 web GUI built with Vite.

Keep the tool simple. The CLI should run with `node cli.js` and read and write local project JSON files. The web GUI should run with `npm start`.

Keep shared application logic in `app.js`. The CLI requires this file directly. The React GUI imports it so browser code can use `window.QualaBackend`.

Keep command line behavior in `cli.js`. Keep React GUI behavior in `src/`. Keep Vite startup behavior in `vite.config.js` and `index.html`.

Current repo files:

- `app.js` has the shared backend, OpenAI request helpers, DOCX reader, exact quote verifier, export logic, and legacy browser helpers.
- `cli.js` has the command line interface.
- `src/App.jsx`, `src/main.jsx`, and `src/styles.css` have the React GUI.
- `index.html` is the Vite entry page.
- `vite.config.js` loads `.env` values for the local GUI.
- `smoke-test.js` checks CLI paths, shared backend behavior, quote verification, model capability handling, and React/Vite wiring.

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
- Keep the React app dependency-light. Current frontend dependencies are React, React DOM, and Vite.
- Keep `OPENAI_API_KEY` and `VITE_OPENAI_API_KEY` local. Do not store API keys in exported project JSON.

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
