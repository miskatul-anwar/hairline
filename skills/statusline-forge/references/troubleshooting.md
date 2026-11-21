# Troubleshooting

`forge.mjs doctor` covers the common causes. These are the cases it can only hint at.

| Symptom | Cause | Fix |
|---|---|---|
| Blank in one project only | Workspace trust not accepted, or that project's `.claude/settings.json` sets its own `statusLine` | Accept the trust dialog; doctor (run from that project) flags the override |
| Blank everywhere, doctor all ✓ | Managed settings with `allowManagedHooksOnly` or `disableAllHooks` | The user's admin controls this; a managed `statusLine` wins |
| Blank on Windows | A command with backslashes run under Git Bash | Re-run `install`: it writes forward slashes and a command valid in both Git Bash and PowerShell |
| `node` not found on Windows | Node lives under a path with spaces, 8.3 short names are disabled on that drive, and Node isn't on PATH | Add Node to PATH (or install it to a path without spaces), then re-run install. Normally install records the short form, e.g. `C:/PROGRA~1/nodejs/node.exe` |
| Garbage like `[38;2;…m` | Terminal without truecolor | Set `color: "256"` or `"16"`; the runtime also honours `NO_COLOR` |
| Boxes / `?` instead of icons | `icons: "nerd"` without a Nerd Font | Switch to `unicode` |
| PR number not clickable | Terminal without OSC 8 (macOS Terminal.app) or tmux/SSH stripping it | Use iTerm2/WezTerm/Kitty, or `FORCE_HYPERLINK=1 claude`; `hyperlinks: false` hides the escapes entirely |
| Countdowns frozen | The status line only re-renders on events | Re-install with `--refresh 5` |
| Line cut off | Narrow terminal plus notifications sharing the row | Lower priorities of nice-to-haves, raise `reserve`, or use two lines |
| Slow / lagging | A `command` segment doing network I/O | Raise its `ttlMs`; doctor warns when a render takes > 1s |

`claude --debug` logs the status line's exit code on the first run and its stderr on every run. The runtime writes its warnings to stderr prefixed `statusline-forge:` (bad config JSON, render failure).
