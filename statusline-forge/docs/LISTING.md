# Agensi listing — statusline-forge

## Title
statusline-forge: describe your Claude Code status line, get it built

## Tagline (≤ 120 chars)
Say what you want at the bottom of Claude Code. Your agent designs, previews, installs and fixes it. Zero dependencies.

## Price
**$19 one-time** (launch: $14 for the first 30 days). Updates across 1.x included.
Rationale: most Agensi skills sit at $5–15. This one ships a tested runtime, an installer and a diagnostic tool, not just a prompt, so it belongs in the top band ($19–25). The launch discount is there to collect the first reviews.

## Category / tags
Developer tools · claude-code, statusline, productivity, context-window, rate-limits, cost-tracking, git

## Description

Claude Code's status line can show almost anything: context pressure, your 5-hour and weekly limits, spend, prompt-cache warmth, PR review state, worktrees. But building one means learning a 40-field JSON contract, handling the nulls of a fresh session, colour depth, terminal width, Windows shells, and editing `settings.json` without breaking it. When a hand-made script fails, the only symptom is a blank line.

**statusline-forge makes it a conversation.**

> "Two lines. Model, folder, branch and PR on top; context, cost and my 5-hour limit underneath. Muted colours, red at 75%."

Your agent turns that into a validated design, shows you the result across five realistic sessions (fresh, mid-session, near the limits, a worktree with a PR, API billing), and installs it when you say yes.

**What you get**
- 25 segments: model, effort, thinking, fast mode, directory, repo, git (branch, dirty, ahead/behind), worktree, PR (clickable, coloured by review state), context (bar, %, tokens, 200k warning), 5h / 7d limits with reset countdowns, gateway spend, session cost with a budget, prompt-cache warm/cold, duration, lines changed, vim mode, agent, output style, session name, version, clock, static text, and your own shell commands
- 7 themes (including a light-terminal theme and a monochrome one), 3 icon sets (no Nerd Font required), 4 bar styles, 5 presets, 1–N lines
- Fits narrow terminals by dropping the least important segments first, while urgent (red) meters stay longest
- Safe install: backs up settings.json, refuses to touch broken JSON, idempotent, and gives you your old status line back on uninstall
- `doctor`: explains why a status line is blank by running the exact installed command
- Windows-ready: works under both Git Bash and PowerShell
- Zero dependencies: only Node.js 18+. 87 automated tests.

**Works with:** Claude Code (the status line is a Claude Code feature). The skill is a standard SKILL.md folder.

## Security-scan notes (for reviewers)
- `scripts/forge.mjs install` writes `~/.claude/settings.json` (statusLine key only; backup first; atomic write) and copies the runtime to `~/.claude/statusline-forge/`.
- The `git` segment runs `git status` with an 800 ms timeout. The optional `command` segment runs a shell command that **the user** writes in their own config. The skill tells the agent to add one only on request and to show the user the exact command.
- No network access, no telemetry, no dependencies.

## Screenshots (docs/screenshots; regenerate with `node tools/screenshots.mjs`)
1. `1-preview-dashboard.png`: the two-line dashboard across five sample sessions
2. `2-narrow-terminal.png`: the same hot session at full width and at 80 columns; urgent meters survive
3. `3-doctor.png`: doctor on a healthy install
4. `4-themes.png`: one session in six dark themes
5. `5-theme-paper.png`: the light-terminal theme

Still to capture by hand: a real Claude Code chat ("make me a status line…" → preview → approved → live line). It has to be a genuine session.

## Funnel
hairline (free, MIT) README → "Want your own design? statusline-forge" → this listing (with your affiliate link).
