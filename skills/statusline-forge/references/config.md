# Config format

A config is one JSON object. Every key is optional; omitted keys take defaults. The allowed values for each key come from the tool: `forge.mjs schema` (full JSON Schema), `forge.mjs segments`, `forge.mjs themes`, `forge.mjs presets`. `forge.mjs validate` has the final say.

```json
{
  "version": 1,
  "preset": "dashboard",
  "theme": "glacier",
  "icons": "unicode",
  "thresholds": { "warn": 60, "hot": 80 },
  "colors": { "accent": "#c3a6ff" },
  "lines": [
    ["model", "dir", "git", "pr"],
    ["context", { "id": "cost", "options": { "budget": 10 }, "priority": 95 }, "rate_5h"]
  ]
}
```

## Behaviour the schema can't tell you

- **`preset` merges shallowly.** Any key you set overrides the preset's; `lines` replaces the preset's lines entirely.
- **`lines`** is an array of lines; each line is an array of entries. An entry is a segment id string, or an object with `id`, `options`, `color`, `prefix`, `suffix`, `priority`.
- **Absent data hides itself.** No rate limits on API billing, no PR, vim off: those segments vanish without leaving a stray separator. Including a segment "just in case" costs nothing.
- **Width.** When a line is wider than the terminal (minus `reserve`), the lowest `priority` goes first, rightmost on ties. A segment in its hot zone (≥ `thresholds.hot`) jumps ahead of every calm segment, so the most urgent signal survives longest.
- **`color` on an entry** repaints the whole segment in one colour, including its amber/red alert states. Use it for identity segments (model, text), not for meters.
- **`colors`** recolours a theme role everywhere: a cleaner way to add one brand colour.
- **`bar`** defaults to ASCII when `icons` is `ascii`.
- **Colour depth** is auto-detected; a non-empty `NO_COLOR` always wins. Hyperlinks (`pr`, `project`) are emitted only when colour is on and `hyperlinks` isn't `false`, so plain-text environments never see escape codes.
- **`command` segments** run in parallel before rendering, in the session's directory, cached for `ttlMs` and killed (with their whole process tree) after `timeoutMs`. Only the first non-empty output line is shown.
