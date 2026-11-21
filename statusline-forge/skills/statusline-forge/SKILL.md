---
name: statusline-forge
description: Claude Code status line designer. Use when the user wants a new status line (statusLine / status bar), wants to change what it shows or how it looks (model, context, cost, rate limits, git, PR, colours), reports it blank or broken, or wants it removed.
---

# statusline-forge

You design a Claude Code status line *with* the user, then install it. Your output is a small JSON **config**; the bundled, tested runtime renders it. `forge.mjs` is the source of truth for every segment, option, theme, preset and config error, so ask it each time.

**Tool:** `node <skill-dir>/scripts/forge.mjs <command>`, where `<skill-dir>` is the folder holding this file. If `node` is not on PATH, find a Node.js 18+ binary (`command -v nodejs`, `~/.nvm`, `~/.local`, `/usr/local/bin`, `C:/Program Files/nodejs`) and call it by absolute path. The installer records that binary in the status line command.

Pick the **branch** from the request:

| Request | Branch |
|---|---|
| new status line | **Design**: steps 1–6 |
| change the installed one | **Tweak**: copy the config path from `forge.mjs where`, then steps 3–6 on a copy of it |
| blank or broken | **Diagnose** |
| remove it | `forge.mjs uninstall`: restores their previous status line and keeps the design; add `--purge` only when they ask to delete the design |

## Design

### 1. Survey

Run `forge.mjs where` and `forge.mjs doctor`.

**Done when:** you can state (a) whether forge is installed, and (b) the current `statusLine` command, or that there is none. Anything existing gets replaced in step 5 and restored by `uninstall`; tell the user that before step 5.

### 2. Interview

Settle the four **design questions** in one message, each with your recommended default, so a user who replies "yes" gets a great line:

1. **Signals**: what they glance at. Map their words to ids from `forge.mjs segments`. Billing decides the money segments: Pro/Max/Ultra → `rate_5h`, `rate_7d`; API key → `cost`, with a `budget` offer; gateway with a spend limit → `spend`.
2. **Shape**: one line or two. `forge.mjs presets` lists the starting points.
3. **Look**: light or dark terminal, the mood (`forge.mjs themes`), and the icon set: `unicode` by default, `nerd` once they confirm a Nerd Font, `ascii` for minimal terminals.
4. **Alerts**: the percent at which things turn amber and red (`thresholds`).

Ask only what their request left open. Taste and recipes live in [references/design-guide.md](references/design-guide.md).

**Done when:** each design question has an answer or an accepted default.

### 3. Draft

Run `forge.mjs init --preset <closest> --out <scratch>/statusline.json`, then edit that file ([references/config.md](references/config.md) explains the format). Run `forge.mjs validate --config <file>` and fix every error it lists; each names its JSON path and usually the fix.

A `command` segment runs a shell command on every refresh. Add one only for information the user asked for, show them the exact command, and keep `timeoutMs` ≤ 1000.

**Done when:** `validate` prints `config is valid.`

### 4. Preview

Run `forge.mjs preview --config <file> --plain` and show the user its output verbatim. Each row is a labelled sample session, from a fresh start to near the limits. Point out what changes as the session heats up. For users in split panes, add `--columns 80` to show which segments drop first. Real colours appear after install, or when they run preview without `--plain` themselves.

Iterate (edit → validate → preview) until the user approves.

**Done when:** the user explicitly approves the preview.

### 5. Install

Run `forge.mjs install --config <file>`. Add `--refresh 5` when the design shows the clock, a `command` segment, or countdowns they watch while idle. Relay the output in one or two lines, including where the original settings were backed up.

**Done when:** install prints `installed into …` or `already up to date`.

### 6. Verify

Run `forge.mjs doctor`.

**Done when:** doctor exits 0 with no ✗ line. Relay any `!` line to the user with its fix. Then tell them the line appears with their next message, and that asking to change their status line brings them back here.

## Diagnose

Run `forge.mjs doctor`. For each ✗ and `!` line, apply its `fix:`, then re-run doctor. Keep going until no ✗ remains. If doctor is clean and the line is still blank, the cause is outside the script: an unaccepted workspace trust prompt, or a notification taking the row. Ask the user to run `claude --debug` and look for `Status line command skipped`. [references/troubleshooting.md](references/troubleshooting.md) covers Windows shells, tmux/SSH, and managed settings.

**Done when:** doctor exits 0 with no ✗ line and the user confirms the line is visible.
