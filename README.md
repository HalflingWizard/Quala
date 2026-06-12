# Qualia

Qualia is a browser based qualitative analysis tool for interviews, social media posts, field notes, and other text data.

It helps a researcher build a codebook, refine it over a queue of datapoints, annotate exact quotes, and keep a history of every step.

## What It Does

- Add datapoints by pasting text or opening local text and JSON files.
- Store an OpenAI API key in the browser and load available models.
- Edit the study lens, codebook prompt, refinement prompt, and annotation prompt.
- Generate an initial codebook from the first datapoint with a codebook agent.
- Refine the codebook as later datapoints are processed with the same codebook agent.
- Run one annotation agent pass per code over the full datapoint.
- Ask GPT to remove weak codes, merge similar codes, and keep rare but important codes.
- Annotate exact verbatim quotes with codes and certainty from 1 to 5.
- Save snapshots before and after processing so a researcher can undo mistakes.
- Export JSON with a top level `data` array and an `annotation` field for compatibility with `arazilab/analysis_tools`.

## Run

Open `index.html` in a browser.

No build step is needed.

The app logic is in `app.js`.

## Workflow

1. Open `index.html`.
2. Go to Preferences.
3. Add an OpenAI API key.
4. Load models or use the default model value.
5. Edit the study lens and prompts if needed.
6. Go to Workspace.
7. Add or open datapoints.
8. Process the selected datapoint.
9. Review the codebook and annotations.
10. Edit or restore from History when needed.
11. Export JSON.

## Export Shape

The exported file is designed to work with tools that expect datapoints with an `annotation` field.

```json
{
  "tool": "Qualia",
  "exported_at": "2026-06-12T00:00:00.000Z",
  "codebook": [
    {
      "code": "Trust Boundaries",
      "definition": "A clear definition of when a participant would or would not trust a tool.",
      "example": "Exact quote from the input.",
      "decision": "add",
      "decision_note": "Why the code was kept or changed."
    }
  ],
  "data": [
    {
      "id": "D1",
      "source": "interview.txt",
      "text": "Full datapoint text.",
      "annotation": ["Trust Boundaries"],
      "quotes": [
        {
          "quote": "Exact verbatim quote from the input.",
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

The OpenAI API integration uses the Responses API with structured JSON output. The Preferences page exposes verbosity and reasoning effort, based on current OpenAI text generation parameters.
