# Config format

A config is one JSON object. Every key is optional; omitted keys take defaults. `forge.mjs schema` prints the full JSON Schema; `forge.mjs validate` is the authority.

```json
{
  "version": 1,
  "preset": "dashboard",
  "theme": "glacier",
  "icons": "unicode",
  "bar": "line",
  "separator": "dot",
  "thresholds": { "warn": 60, "hot": 80 },
  "colors": { "accent": "#c3a6ff" },
  "hyperlinks": true,
  "reserve": 2,
  "lines": [
    ["model", "dir", "git", "pr"],
    ["context", { "id": "cost", "options": { "budget": 10 } }, "rate_5h"]
  ]
}
```

| Key | Meaning |
|---|---|
| `preset` | Starting point (`forge.mjs presets`). Any key you also set overrides it; `lines` replaces the preset's lines entirely. |
| `theme` | Palette (`forge.mjs themes`). |
| `icons` | `unicode` (default, any font) · `nerd` (Nerd Font) · `ascii`. |
| `bar` | `line` · `block` · `dots` · `ascii`. Defaults to `ascii` with ascii icons, else `line`. |
| `separator` | `dot` · `pipe` · `slash` · `space` · `arrow`, or any literal string such as `" ⋮ "`. |
| `color` | `auto` (detect; `NO_COLOR` always wins) · `truecolor` · `256` · `16` · `none`. |
| `thresholds` | Percent at which bars and percentages turn `warn` then `hot`. `warn` ≤ `hot`. |
| `colors` | Override theme roles with `#rrggbb`. Roles: accent, text, muted, ok, warn, hot, info, branch, dirty. |
| `hyperlinks` | OSC 8 links on `pr` and `project`. |
| `reserve` | Columns kept free on the right when fitting to the terminal width. |
| `cache.gitTtlMs` | How long git state is cached (default 5000). |
| `lines` | Array of lines; each line is an array of segment entries. |

## Segment entries

A string (`"cost"`) or an object:

| Field | Meaning |
|---|---|
| `id` | Segment id (`forge.mjs segments`). |
| `options` | Segment-specific options; `forge.mjs segments` lists each one's type and default. |
| `color` | Theme role or `#rrggbb` for the segment's main text. |
| `prefix` / `suffix` | Literal text around the segment, e.g. `"["` and `"]"`. |
| `priority` | 0–100. When the line is too wide, the lowest priority is dropped first (rightmost on ties). |

Segments hide themselves when their data is absent: no rate limits on API billing, no PR, vim mode off. Hiding never leaves a dangling separator, so include anything the user might want.
