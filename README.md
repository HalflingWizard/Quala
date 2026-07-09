# Quala

Quala is a qualitative analysis tool for interviews, social media posts, field notes, and other text data.

It is a local, CLI-first Node app with a small React 18 web GUI built with Vite. Both front ends use the shared logic in `app.js` and read and write the same reloadable project JSON file.

## Repo Shape

- `app.js` has the shared Quala backend, OpenAI request helpers, DOCX text reader, exact quote verifier, export logic, and legacy browser helpers.
- `cli.js` has the command line interface. It runs with `node cli.js`.
- `src/App.jsx`, `src/main.jsx`, and `src/styles.css` make the React web GUI.
- `index.html` is the Vite entry page.
- `vite.config.js` exposes `OPENAI_API_KEY` or `VITE_OPENAI_API_KEY` from `.env` to the local web GUI at startup.
- `smoke-test.js` checks the CLI, shared backend, quote verifier, model capability handling, and React/Vite wiring.
- `package.json` defines `npm start`, `npm run build`, `npm run preview`, and `npm run smoke`.

## What It Does

- Create a full project JSON file from the CLI.
- Add datapoints from TXT files, DOCX files, or inline text.
- Add multiple TXT and DOCX files to the process queue.
- Add datapoints, load projects, process the queue, view progress, and download JSON from the React web GUI.
- Process all queued datapoints with the OpenAI API.
- Run a document scout that finds possible new concepts without seeing the codebook.
- Run a novelty detector and merge reviewer before any codebook change.
- Add verified new codes directly to the active codebook.
- Run a codebook applier after codebook updates so new codes can apply to the same document.
- Check every model quote with a non LLM verifier using exact substring matching before saving annotations.
- Mark codes as active, dormant, merged, rejected, needs human review, or candidate.
- Keep full project JSON compatible with project loading and `arazilab/analysis_tools`.

## Run

### CLI

Create a project file.

```bash
node cli.js init project.json
```

Add a datapoint from a TXT or DOCX file.

```bash
node cli.js add-text project.json project.json --id D1 --source interview-1.docx --text-file interview-1.docx
```

Add several files to the queue.

```bash
node cli.js add-files project.json project.json interview-1.txt interview-2.docx
```

Add a datapoint from inline text.

```bash
node cli.js add-text project.json project.json --id D2 --source pasted --text "Participant text goes here."
```

Process queued datapoints.

```bash
OPENAI_API_KEY=your-key node cli.js run project.json coded-project.json
```

You can also put the key in `.env`.

```bash
OPENAI_API_KEY=your-key
```

Then run the CLI without adding the key to the command.

```bash
node cli.js run project.json coded-project.json
```

The older batch form still works.

```bash
OPENAI_API_KEY=your-key node cli.js project.json coded-project.json
```

### React Web GUI

Install dependencies once.

```bash
npm install
```

Start the React dev server.

```bash
npm start
```

The React dev server reads `OPENAI_API_KEY` from `.env` when it starts. Restart `npm start` after editing `.env`.

The GUI has separate pages for Project, Queue, Results, Audit, and Settings.

- Project loads, creates, and downloads project JSON files.
- Queue adds pasted text or multiple TXT and DOCX files, previews datapoints, and processes the queue.
- Results shows the codebook, related datapoints, and annotations.
- Audit shows processing logs.
- Settings stores API and model preferences for the session.

The React app imports `app.js` so browser code can call `window.QualaBackend.run` and `window.QualaBackend.readDocxBytes`. The CLI uses the same file with `require("./app.js")`.

## Test

Run the startup smoke test.

```bash
node smoke-test.js
```

The npm alias also works.

```bash
npm run smoke
```

For web GUI changes, also run `npm start` and check these paths.

1. Create a new project.
2. Add a datapoint by paste.
3. Add multiple datapoints from TXT or DOCX files.
4. Download JSON.

For API related changes, also test one short datapoint when an API key is available.

## Export Shape

The JSON output is the complete project backup. It can be loaded into Quala later and works with tools that expect datapoints with an `annotation` field.

```json
{
  "tool": "Quala",
  "exported_at": "2026-06-12T00:00:00.000Z",
  "project": {
    "docs": [
      {
        "id": "D1",
        "source": "interview.txt",
        "text": "Full datapoint text.",
        "status": "coded"
      }
    ],
    "selectedDocId": "D1",
    "history": [],
    "preferences": {},
    "autosavedAt": "2026-06-12T00:00:00.000Z"
  },
  "codebook": [
    {
      "code_id": "C001",
      "name": "Trust Boundaries",
      "definition": "A clear definition of when a participant would or would not trust a tool.",
      "status": "active",
      "created_from_doc": "D1",
      "example_quotes": [
        {
          "doc_id": "D1",
          "quote": "Exact quote from the input.",
          "verified": true
        }
      ],
      "history": [
        {
          "event": "created",
          "doc_id": "D1",
          "reason": "Created from verified scout evidence."
        }
      ]
    }
  ],
  "audit_log": [],
  "data": [
    {
      "id": "D1",
      "source": "interview.txt",
      "text": "Full datapoint text.",
      "annotation": ["Trust Boundaries"],
      "quotes": [
        {
          "quote": "Exact quote from the input.",
          "code_ids": ["C001"],
          "annotations": ["Trust Boundaries"],
          "certainty": 5,
          "rationale": "Short explanation of the assignment."
        }
      ]
    }
  ]
}
```

## Privacy

The CLI reads and writes local JSON files. The web GUI keeps the project in browser memory until you download it.

OpenAI requests are sent from the local command line process to the OpenAI API. Do not process sensitive data unless the study protocol allows that use.

## Notes

The OpenAI API integration uses the Responses API with structured JSON output.

Quala builds model aware requests. It sends temperature to GPT-4 style models. It sends verbosity to GPT-5 style models. It sends reasoning effort to GPT-5 and o-series reasoning models. Unknown model families get only the required request fields.
