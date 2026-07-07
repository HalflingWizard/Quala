# Quala

Quala is a command line qualitative analysis tool for interviews, social media posts, field notes, and other text data.

It helps a researcher process a queue of datapoints, build a codebook, annotate exact quotes, and export a reloadable project JSON file.

## What It Does

- Create a full project JSON file from the CLI.
- Add datapoints from text files or inline text.
- Process all queued datapoints with the OpenAI API.
- Run a document scout that finds possible new concepts without seeing the codebook.
- Run a novelty detector and merge reviewer before any codebook change.
- Add verified new codes directly to the active codebook.
- Run a codebook applier after codebook updates so new codes can apply to the same document.
- Check every model quote with a non LLM verifier using exact substring matching before saving annotations.
- Mark codes as active, dormant, merged, or rejected.
- Keep full project JSON compatible with project loading and `arazilab/analysis_tools`.

## Run

Create a project file.

```bash
node cli.js init project.json
```

Add a datapoint from a TXT file.

```bash
node cli.js add-text project.json project.json --id D1 --source interview-1.txt --text-file interview-1.txt
```

Add a datapoint from inline text.

```bash
node cli.js add-text project.json project.json --id D2 --source pasted --text "Participant text goes here."
```

Process queued datapoints.

```bash
OPENAI_API_KEY=your-key node cli.js run project.json coded-project.json
```

The older batch form still works.

```bash
OPENAI_API_KEY=your-key node cli.js project.json coded-project.json
```

## Test

Run the startup smoke test.

```bash
node smoke-test.js
```

For API related changes, also test one short datapoint when an API key is available.

## Export Shape

The JSON output is the complete project backup. It can be loaded into Quala later and works with tools that expect datapoints with an `annotation` field.

```json
{
  "tool": "Quala",
  "exported_at": "2026-06-12T00:00:00.000Z",
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

The CLI reads and writes local JSON files.

OpenAI requests are sent from the local command line process to the OpenAI API. Do not process sensitive data unless the study protocol allows that use.

## Notes

The OpenAI API integration uses the Responses API with structured JSON output.

Quala builds model aware requests. It sends temperature to GPT-4 style models. It sends verbosity to GPT-5 style models. It sends reasoning effort to GPT-5 and o-series reasoning models. Unknown model families get only the required request fields.
