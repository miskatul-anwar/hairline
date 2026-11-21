# Design guide

Taste for turning "what I want" into a status line people love glancing at.

## Hierarchy

- **Line one is orientation**: model, where am I (`dir`, `git`, `worktree`, `pr`). It answers "am I in the right place?"
- **Pressure comes next**: `context` first (it changes agent quality), then the money the user actually pays: `rate_5h` for subscriptions, `cost` for API, `spend` for gateways.
- **Footprint is opt-in**: `duration`, `lines`, `cache`, `version`, `style`, `session`. Offer them and add the ones the user picks.
- Five to seven segments per line is the sweet spot. Past that, move to `dashboard` (two lines) instead of cramming.

## Colour discipline

- Colour should mean something. Most text stays `text`/`muted`; `ok → warn → hot` is reserved for things that change state (bars, percentages, cost against a budget, PR review state).
- Pick thresholds from the user's pain. "I hit limits a lot" → `warn: 50, hot: 75`. "Only scream when it's urgent" → `warn: 75, hot: 90`.
- Light terminal → `paper`. Accessibility or projector → `contrast`. Logs, screen readers, or "no colours" → `mono` or `color: "none"`.
- A single brand accent goes in `colors.accent`, not a whole custom palette.

## Width

- Claude Code passes `COLUMNS`; the runtime drops the lowest-priority segments to fit, and a meter in its hot zone outranks every calm segment automatically. Raise `priority` on what must always survive (often `context` or `cost`) and leave nice-to-haves low.
- Show `forge.mjs preview --columns 80` to anyone working in split panes.
- Notifications can share the status row on narrow terminals; `reserve` keeps extra room.

## Icons

- Unknown font → `unicode`. Choose `nerd` once the user confirms a Nerd Font is installed; it's the only set that needs one.
- `ascii` for SSH sessions into minimal hosts and for Windows consoles with legacy fonts.

## Refresh

- The status line re-renders on events (new message, mode changes, limit resets). Countdowns and the clock only advance when it re-renders, so add `--refresh 5` at install for users who watch them while idle.

## Recipes

| Ask | Config sketch |
|---|---|
| "Just the essentials" | `preset: "minimal"` |
| "I'm on Max and keep hitting limits" | `balanced` + `rate_7d`, `thresholds: {warn: 50, hot: 75}`, `rate_5h` priority 95 |
| "API user, watch my spend" | `preset: "budget"`, set `cost.options.budget` to their number |
| "I live in worktrees and PRs" | line 1: `model, dir, git, worktree, pr`; line 2: `context, cost, rate_5h` |
| "Show my k8s context" | `{ "id": "command", "options": { "run": "kubectl config current-context", "ttlMs": 30000 } }` |
| "Vim user" | add `vim` early on line one with `options.short: true`; suggest `hideVimModeIndicator` in settings |
