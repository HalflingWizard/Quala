# AGENTS.md

## Repo Goal

Quala is a single page HTML tool for human in the loop qualitative coding.

Keep the tool simple. It should work by opening `index.html` in a browser.

Keep application logic in `app.js`.

## Maintenance Rules

- Keep changes surgical and easy to review.
- Do not add a build system unless the user asks for one.
- Keep state local to the browser unless the user asks for a backend.
- Keep exports compatible with `arazilab/analysis_tools` by preserving a datapoint level `annotation` field.
- Preserve exact quote verification. The app must not save model quotes that are not found in the source datapoint.
- Keep codebook history and restore behavior working after changes.
- Use clear language that an international undergraduate can understand.
- Avoid em dashes and colons in user facing long text when practical.

## Code Style

- Prefer plain JavaScript, HTML, and CSS.
- Use small functions with direct names.
- Avoid broad rewrites.
- Do not introduce dependencies without a clear need.
- Keep UI styling close to the existing `analysis_tools` family, light panels, blue accent, compact tables, and simple controls.

## Manual Checks

Before committing UI changes, open `index.html` and check these paths.

1. Add a datapoint by paste.
2. Edit and save Preferences.
3. Add a manual code.
4. Create and restore a History snapshot.
5. Export JSON.

For API related changes, also test loading models and one short datapoint when an API key is available.
