# Docs assets

`images/` holds the screenshots used by the top-level [README](../README.md).

## Regenerating the screenshots

`screenshot-harness.html` renders the real modal — it imports
`web/js/ui/templates.js` and `web/js/civitaiDownloader.css` — and fills it with
placeholder data so the UI can be captured without a running ComfyUI, API keys or
downloaded models. Transitions are disabled so captures are deterministic.

Serve the repository root, then capture each view:

```bash
python -m http.server 8899
```

The view is chosen with hash parameters: `tab` (`download`, `browse`, `mymodels`,
`gallery`, `status`, `settings`, `directory`), `theme=light`, `collapsed=1`, and
`scroll=<px>` to offset the active panel.

```bash
chrome --headless=new --hide-scrollbars --window-size=1240,830 \
  --virtual-time-budget=8000 --screenshot=docs/images/browse.png \
  "http://localhost:8899/docs/screenshot-harness.html#tab=browse"
```

Keep the window size at 1240x830 so every image lines up in the README grid, and
keep the names in `docs/images/` unchanged — the README links to them directly.

The harness is a documentation tool only; nothing in the extension loads it.
