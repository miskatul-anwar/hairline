---
description: Enable the hairline status line (pass "remove" to disable it)
argument-hint: "[remove]"
allowed-tools: Bash(node:*)
---

Set up the hairline status line by running its setup script with Node.js:

- If `$ARGUMENTS` is `remove`: `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --remove`
- Otherwise: `node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs"`

If `node` is not on PATH, find a Node.js 18+ binary (for example with `command -v nodejs`, or under `~/.nvm`, `~/.local`, `/usr/local/bin`) and run the script with it. The script records that binary's absolute path in the settings, so it keeps working even when Node isn't on PATH.

Report the script's output to the user in one or two lines. Do not edit settings.json by hand.
