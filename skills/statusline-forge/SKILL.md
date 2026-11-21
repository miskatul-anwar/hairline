---
name: statusline-forge
description: Status line designer for Claude Code. Use when the user wants to create, customise, restyle, preview, install, fix or remove their Claude Code status line (statusLine / statusline / status bar at the bottom of Claude Code), or asks to show model, context usage, cost, rate limits, git, PR, cache or similar info there, or says their status line is blank or broken.
---

# statusline-forge

You design a Claude Code status line *with* the user, then install it. You never write rendering code: you write a small JSON **config**; the bundled, tested runtime renders it. `forge.mjs` is the single source of truth for what exists: segments, options, themes, presets, and config errors. Ask it; don't recall it.

**Tool:** `node <skill-dir>/scripts/forge.mjs <command>`, where `<skill-dir>` is the folder holding this file. If `node` is not on PATH, find a Node.js 18+ binary (`command -v nodejs`, `~/.nvm`, `~/.local`, `/usr/local/bin`, `C:/Program Files/nodejs`) and use its absolute path. The installer records that binary, so the status line keeps working without PATH.

Pick the **branch** from what the user said:

| User wants | Branch |
|---|---|
| a new status line, or "make me one like …" | **Design** (steps 1–6) |
| to change the installed one ("add cost", "make it red at 70%") | **Tweak**: steps 2–6, starting from `forge.mjs where`'s config file |
| "it's blank / broken / not showing" | **Diagnose** |
| to remove it | `forge.mjs uninstall` (restores their previous status line; `--purge` deletes the design too) |

## Design

### 1. Survey

Run `forge.mjs where` and `forge.mjs doctor`. Note any existing status line: install will replace it (it's saved and `uninstall` restores it), so tell the user before step 5.

**Done when:** you know whether forge is already installed and what statusLine exists today.

### 2. Interview

Settle these four **design questions** in one message, each with your recommended default, so a user who just says "yes" gets a great result:

1. **Signals**: what they glance at. Map words to segments with `forge.mjs segments`. Billing decides the money segments: Pro/Max/Ultra → `rate_5h`, `rate_7d`; API key → `cost` (offer a `budget`); gateway with a spend limit → `spend`.
2. **Shape**: one line (`balanced`/`minimal`/`full`) or two (`dashboard`); `forge.mjs presets` lists them.
3. **Look**: dark or light terminal (`paper` for light), and the mood (`forge.mjs themes`). Nerd Font installed → `icons: "nerd"`, otherwise `unicode`; `ascii` for minimal terminals.
4. **Alerts**: when it turns amber/red (`thresholds`, default warn 60 / hot 80).

Anything they already said is settled; ask only the open questions. See [references/design-guide.md](references/design-guide.md) for taste: what belongs on line one, priorities, and colour discipline.

**Done when:** all four design questions have an answer or an accepted default.

### 3. Draft

Write the config to a scratch file (format: [references/config.md](references/config.md)). Start from the closest preset and override; every option you set must come from `forge.mjs segments`. Run `forge.mjs validate --config <file>` and fix every error it lists (each names its JSON path and often the fix).

A `command` segment runs a shell command on every refresh. Add one only when the user asked for that information, show them the exact command, and keep `timeoutMs` ≤ 1000.

**Done when:** `validate` prints `config is valid.`

### 4. Preview

Run `forge.mjs preview --config <file> --plain` and show the output in a code block. It renders five sample sessions: `fresh`, `mid`, `hot` (near limits), `worktree-pr`, `api-billing`. Point out what changes when the session gets hot. If they care about narrow terminals, add `--columns 80` to show which segments drop first. The user sees real colours after installing (or by running preview without `--plain` in their terminal).

Iterate (edit → validate → preview) until the user approves.

**Done when:** the user explicitly approves the preview.

### 5. Install

Run `forge.mjs install --config <file>`. Add `--refresh 5` only if they show the clock, a `command` segment, or countdowns they watch while idle. Relay the output in one or two lines, including the backup path.

**Done when:** install prints `installed into …` or `already up to date`.

### 6. Verify

Run `forge.mjs doctor`. Every check must be ✓ (an `i` line is just information). It renders a sample through the exact installed command. Tell the user the status line appears on the next refresh (their next message), and that saying "change my status line" brings them back here.

**Done when:** doctor exits 0.

## Diagnose

Run `forge.mjs doctor` and act on every ✗ and ! line: each prints its `fix:`. Apply the fix, re-run doctor, and repeat until no ✗ remains. When doctor is all ✓ and the line is still blank, it's outside the script: workspace trust not accepted, or a notification taking the row. Ask the user to run `claude --debug` and look for `Status line command skipped`. [references/troubleshooting.md](references/troubleshooting.md) covers the rest (Windows shells, tmux/SSH stripping links, managed settings).

**Done when:** doctor exits 0 and the user confirms the line is visible.
