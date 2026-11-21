# statusline-forge — Spec

## Problem Statement

Claude Code users want a status line that shows what *they* care about (context pressure, spend, rate limits, git, PR state, prompt-cache warmth), but building one means learning a ~40-field stdin JSON contract, handling null/absent fields, ANSI colour depth, terminal width, Windows shell quirks, and safely editing `settings.json`. Hand-written scripts break silently (a blank line is the only symptom). Existing free tools are either fixed designs or TUI configurators the user must drive themselves.

## Solution

A flagship agent skill: the user describes the status line they want in plain language ("cost and context, red when I'm close to limits, two lines, no Nerd Font"), and the agent designs it, previews it against realistic sample sessions, installs it, and diagnoses it if it ever goes blank. Under the hood the agent never writes rendering code: it writes a small, validated JSON config consumed by a bundled, zero-dependency, tested Node.js runtime. The LLM handles intent; deterministic code handles correctness.

## User Stories

1. As a Claude Code user, I want to describe my ideal status line in plain words, so that I don't have to learn the stdin schema.
2. As a user, I want to start from a preset (minimal, balanced, full, dashboard, budget), so that I get something good in one step.
3. As a user, I want to see a rendered preview before anything is installed, so that I can iterate on the design safely.
4. As a user, I want previews across several realistic session states (fresh session, mid-session, near limits, worktree + PR), so that I see how it behaves when things get hot.
5. As a user, I want install to back up my `settings.json`, so that I can always roll back.
6. As a user, I want install to refuse to touch an invalid `settings.json`, so that my config is never corrupted.
7. As a user, I want install to be idempotent, so that running it twice changes nothing.
8. As a user, I want uninstall to restore my previous status line, so that trying the product is risk-free.
9. As a user with an existing custom status line, I want to be told it will be replaced and have it preserved, so that I don't lose work.
10. As a user, I want a `doctor` command that explains why my status line is blank, so that I can fix it without guesswork.
11. As a user, I want the status line to never crash or print a stack trace, so that a bad state degrades to fewer segments, not a blank line.
12. As a user, I want segments whose data is absent (no rate limits on API billing, no PR, no vim) to disappear cleanly, so that there are no dangling separators or "undefined".
13. As a user, I want colour thresholds (warn/hot) I can tune, so that "red" means what I want.
14. As a user on a light terminal, I want a light-friendly theme, so that text stays readable.
15. As a user, I want `NO_COLOR` honoured and a monochrome theme, so that it works in any terminal or log.
16. As a user on a 256-colour or 16-colour terminal, I want colours downgraded automatically, so that I don't see garbage escapes.
17. As a user without a Nerd Font, I want unicode or ASCII icons, so that I don't see tofu boxes.
18. As a user with a Nerd Font, I want richer icons, so that it looks polished.
19. As a user on a narrow terminal, I want low-priority segments dropped first, so that the important ones stay visible.
20. As a user, I want multi-line layouts, so that I can separate "where am I" from "how much have I spent".
21. As a user, I want git branch, dirty state, and ahead/behind counts, so that I know repo state at a glance.
22. As a user, I want git calls cached and time-boxed, so that the status line never lags in huge repos.
23. As a user, I want the PR number and review state as a clickable link, so that I can jump to it.
24. As a user, I want context usage as a bar + percent + tokens, with a warning past 200k tokens, so that I compact before quality drops.
25. As a Pro/Max user, I want 5-hour and 7-day usage with reset countdowns, so that I pace my work.
26. As a gateway user, I want spend-limit usage in dollars, so that I stay within budget.
27. As a user, I want session cost, duration, and lines added/removed, so that I see the session's footprint.
28. As a user, I want prompt-cache warmth and time-to-expiry, so that I know whether a pause will cost me a re-cache.
29. As a user, I want model, effort level, thinking, and fast-mode indicators, so that I know how the agent is configured.
30. As a user, I want vim mode, agent name, output style, session name, and worktree segments, so that the line reflects my workflow.
31. As a power user, I want a custom `command` segment (cached, time-boxed), so that I can show k8s context, weather, or anything else.
32. As a power user, I want a static `text` segment, so that I can add labels or emoji.
33. As a power user, I want per-segment colour, prefix, and option overrides, so that I can fine-tune without forking.
34. As a Windows user, I want the installed command to work under both Git Bash and PowerShell, so that it isn't blank on my machine.
35. As a user whose Node.js isn't on PATH for the shell Claude Code uses, I want the absolute Node path recorded, so that it keeps working.
36. As a user, I want the runtime installed to a stable location independent of where the skill lives, so that updating or moving the skill can't break my status line.
37. As a user, I want config validation with precise, human-readable errors, so that the agent (or I) can fix mistakes quickly.
38. As a user, I want to list all segments with their options, so that I can discover capabilities.
39. As a buyer on any agent platform, I want the skill to be a standard SKILL.md folder, so that it installs anywhere skills are supported.
40. As the seller, I want evals that measure triggering and output quality, so that the listing can quote evidence.

## Implementation Decisions

- **Config-driven engine, not code generation.** The agent writes `config.json` (schema version 1); a bundled runtime renders it. This makes outputs deterministic and testable.
- **Modules** (all zero-dependency ESM, Node ≥ 18):
  - *render*: the deep module. `render(input, config, env) → string`. `env` injects `columns`, `colorDepth`, `now`, `git`, `exec`, `cache`. Pure given env.
  - *segments*: registry of segment definitions; each declares `id`, `summary`, `options` (with defaults), `priority`, and `render(ctx) → string | null`. Returning null hides the segment.
  - *themes*: named palettes over semantic roles (`accent, text, muted, ok, warn, hot, info, branch, dirty`), plus colour-depth downgrade (truecolor → 256 → 16 → none).
  - *icons*: three icon sets (`unicode`, `nerd`, `ascii`) keyed by segment.
  - *config*: `validate(config) → { ok, errors[] }`, `resolve(config) → normalized config` (presets expanded, defaults applied).
  - *presets*: named starting configs.
  - *settings*: `install`, `uninstall` against a settings path; backup, refuse-invalid-JSON, idempotent, preserves the previous `statusLine` in a sidecar for restore.
  - *command*: `buildCommand({ platform, execPath, scriptPath })` → shell-safe command for POSIX shells, Git Bash, and PowerShell.
  - *doctor*: checks returning `{ id, ok, detail, fix }[]`.
- **Two entry points**: `statusline.mjs` (runtime: stdin → stdout, always exit 0, last-resort fallback output on internal error) and `forge.mjs` (CLI: `presets`, `segments`, `themes`, `init`, `validate`, `preview`, `install`, `uninstall`, `doctor`).
- **Stable install location**: `~/.claude/statusline-forge/` holds the copied runtime and `config.json`. `settings.json` points there; the skill folder can move or update freely.
- **Width fitting**: visible width computed ignoring ANSI/OSC8 escapes and counting East Asian wide chars as 2; when a line exceeds `COLUMNS`, segments are removed lowest-priority first.
- **Caching**: git and `command` segment results cached in the OS temp dir keyed by a hash of (kind, cwd/command), with configurable TTL (default 5s git, 30s command). Each subprocess has a hard timeout.
- **Hyperlinks**: OSC 8, opt-out via config `hyperlinks: false`.
- **Windows command**: first token unquoted (Node path with forward slashes if it has no spaces, else bare `node`), script path quoted with forward slashes — valid in bash, Git Bash and PowerShell.

## Testing Decisions

- Good tests assert observable output through public interfaces with independent, hand-written expected values; no mocking of our own modules. Boundaries (git, subprocess, clock, cache) are injected via `env`.
- **Seams** (agreed):
  1. `render()` — the primary seam: given a fixture JSON + config + env, the visible text (ANSI stripped) and selected colour codes.
  2. `statusline.mjs` as a subprocess — stdin/stdout contract: garbage in still exits 0 and prints something sane.
  3. `forge.mjs` as a subprocess against a temp HOME — install/uninstall/validate/doctor behaviour on real files.
  4. `validate()` — error messages for bad configs.
  5. `buildCommand()` — exact strings per platform.
- Fixtures: realistic stdin payloads (fresh, mid, hot, worktree-pr, api-billing, minimal-null) derived from the documented schema.
- Prior art: hairline's `node --test` suite.
- **Evals**: `evals/evals.json` (skill-creator format) for task quality and `evals/trigger-evals.json` for description triggering.

## Out of Scope

- A TUI configurator (the agent *is* the configurator).
- Status lines for agents other than Claude Code (the SKILL.md is portable, but the status-line feature is Claude Code's).
- Network-fetching segments built in (users may add them via `command`).
- Licence-key enforcement.

## Further Notes

- hairline remains the free MIT sibling and acts as the funnel.
- Distribution: Agensi (skill folder zip) and a private Claude Code plugin marketplace for direct buyers.
