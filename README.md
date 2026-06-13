# Quala

Quala is a browser based qualitative analysis tool for interviews, social media posts, field notes, and other text data.

It helps a researcher build a codebook over a queue of datapoints, annotate exact quotes, review codebook changes, and keep a history of every step.

## What It Does

- Add datapoints by pasting text or opening local TXT and DOCX files.
- Store an OpenAI API key in the browser and load available models.
- Edit the study lens, scout prompt, novelty prompt, merge reviewer prompt, and applier prompt.
- Run a document scout that finds possible new concepts without seeing the codebook.
- Run a codebook applier that can only apply existing active codes.
- Process all queued datapoints with one queue run.
- Check every model quote with a non LLM verifier using exact substring matching.
- Run a novelty detector and merge reviewer before any codebook change.
- Add proposed codes to the codebook as needing human review, then send new codes and merge decisions to Human review before they become active.
- Mark codes as active, dormant, merged, rejected, candidate, or needing review. Codes are not deleted during the document loop.
- Calculate codebook coverage from verified codebook evidence and verified annotation links.
- Annotate exact verbatim quotes with code names while preserving stable code IDs.
- Save snapshots before and after processing so a researcher can undo mistakes.
- Save an audit log for each document, with filter, time sort, stage summaries, and expandable full prompts and outputs.
- Export JSON with a top level `data` array and an `annotation` field for compatibility with `arazilab/analysis_tools`.

## Run

Open `index.html` in a browser.

No build step is needed.

The app logic is in `app.js`.

## Test

Run the startup smoke test.

```bash
node smoke-test.js
```

## Workflow

1. Open `index.html`.
2. Go to Preferences.
3. Add an OpenAI API key.
4. Load models or use the default model value.
5. Edit the study lens, scout prompt, novelty prompt, merge reviewer prompt, and applier prompt if needed.
6. Go to Workspace.
7. Add datapoints by paste or open TXT and DOCX files.
8. Process the queue.
9. Open Human review and approve or reject suggested codebook changes. Proposed codes stay inactive until approval.
10. Review the codebook, annotations, and audit log. Filter the audit by document when you need one document's processing history.
11. Edit or restore from History when needed.
12. Export JSON.

## Export Shape

The exported file is designed to work with tools that expect datapoints with an `annotation` field.

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
          "reason": "Human approved a verified new code."
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
          "quote": "Exact verbatim quote from the input.",
          "code_ids": ["C001"],
          "annotations": ["Trust Boundaries"],
          "certainty": 5,
          "polarity": "negative",
          "rationale": "Short explanation of the assignment."
        }
      ]
    }
  ]
}
```

## Privacy

The tool runs in the browser and saves data in `localStorage`.

OpenAI requests are sent directly from the browser to the OpenAI API. Do not paste sensitive data unless the study protocol allows that use.

## Notes

The OpenAI API integration uses the Responses API with structured JSON output.

Quala builds model aware requests. It sends temperature to GPT-4 style models. It sends verbosity to GPT-5 style models. It sends reasoning effort to GPT-5 and o-series reasoning models. Unknown model families get only the required request fields.
