# statusline-forge

**Describe the Claude Code status line you want. Your agent designs it, previews it, installs it, and fixes it if it ever goes blank.**

```
◆ Opus 5.5 · effort high · ~/c/acme-api · main●↑1 · #1234 approved
━━━━────── 42% 84k/200k · cache warm 1h00m · $1.23 · 5h ━━──── 31% ↻ 2h14m · 7d ━───── 12% ↻ 6d0h
```

> "Two lines. Model, folder, branch and PR on top; context, cost and my 5-hour limit underneath. Muted colours, go red at 75%."

That's the whole setup. The skill turns it into a validated config, shows you the line across five realistic sessions (fresh, mid-session, near the limits, a worktree with a PR, API billing), and installs it once you approve.

## Why it's different

| | Hand-written script | Fixed-design status lines | **statusline-forge** |
|---|---|---|---|
| Configure by describing it | – | – | ✓ |
| Preview before installing | – | some | ✓ five sample sessions |
| Handles null/absent fields (fresh sessions, API billing, no PR) | usually not | varies | ✓ every segment, tested |
| Fits narrow terminals by priority | – | rare | ✓ |
| Safe install (backup, refuses broken JSON, restores your old line) | – | varies | ✓ |
| "Why is it blank?" diagnosis | – | – | ✓ `doctor` runs the exact installed command |
| Windows (Git Bash and PowerShell) | often breaks | varies | ✓ |
| Dependencies | jq, bash… | npm packages | **none**: just Node 18+ |

## What it can show

25 segments, each hiding itself cleanly when its data is absent:

- **Where you are**: `model`, `dir` (fish-style / full / basename / project-relative), `git` (branch, dirty, ahead/behind; cached and time-boxed), `worktree`, `pr` (coloured by review state, clickable), `project`
- **Pressure**: `context` (bar, %, tokens, 200k warning), `rate_5h`, `rate_7d` (with reset countdowns), `spend` (gateway limits), `cost` (with an optional budget), `cache` (prompt cache warm/cold and time to expiry)
- **Footprint**: `duration`, `lines` (+/−)
- **Mode**: `effort`, `thinking`, `fast`, `vim`, `agent`, `style`, `session`, `version`, `time`
- **Yours**: `text`, `command` (any shell command: k8s context, on-call, weather; cached and killed after a timeout)

Plus 7 themes (including `paper` for light terminals and `mono`), 3 icon sets (no Nerd Font required), 4 bar styles, 5 presets, custom thresholds, per-segment colours and priorities, and multi-line layouts. Colour depth is detected automatically (truecolor → 256 → 16), and `NO_COLOR` is honoured.

## Install

**Claude Code plugin** (from your private marketplace copy):

```
/plugin marketplace add <path-or-url-to-this-repo>
/plugin install statusline-forge@statusline-forge
```

**Any agent that supports skills**: unzip `statusline-forge-<version>.zip` into your skills folder, for example `~/.claude/skills/`.

Then just ask: *"make me a status line"*.

Requirements: Claude Code, Node.js 18+. Your status line is installed to `~/.claude/statusline-forge/` and runs independently of where the skill lives, so updating or moving the skill can't break it.

## Under the hood

The agent never writes rendering code. It writes a small JSON config that `forge.mjs validate` checks, and a tested, zero-dependency runtime renders it. You get the flexibility of plain language and the reliability of deterministic code.

```
node skills/statusline-forge/scripts/forge.mjs <command>
  presets | segments | themes | schema       explore
  validate | preview                         design
  install | uninstall | doctor | where       ship and support
```

## Uninstall

Ask the agent to remove it, or run `forge.mjs uninstall`. Your previous status line is restored; `--purge` also deletes your saved design.

## Licence

Commercial: see [LICENSE](LICENSE). The configs you design are yours to share.
