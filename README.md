# hairline

A minimal, muted one-line status line for [Claude Code](https://claude.com/claude-code).
No background blocks, no Nerd Font, no dependencies. Just a thin line of what matters.

```
◆ Opus 5.5 · ~/c/project  main● · ━━━━────── 42% 84k/200k · $1.23 · session ━━──── 31% ↻ 2h14m
```

| Segment | Shows |
|---|---|
| `◆ Opus 5.5` | Current model |
| `~/c/project  main●` | Fish-style path, git branch, `●` when there are uncommitted changes |
| `━━━━──────  42% 84k/200k` | Context window used: bar, percentage, tokens / window size |
| `$1.23` | Session cost (hidden at $0) |
| `session ━━──── 31% ↻ 2h14m` | 5-hour usage limit and time until it resets (Pro/Max plans) |

Bars go green → amber (60%) → red (80%). Segments without data are hidden.

## Install

In Claude Code:

```
/plugin marketplace add miskatul-anwar/hairline
/plugin install hairline@hairline
/hairline:setup
```

`/hairline:setup` points `statusLine` in `~/.claude/settings.json` at the plugin (a backup is saved as
`settings.json.bak.hairline`). The command always runs the newest installed version, so plugin updates
apply without re-running setup.

To turn it off: `/hairline:setup remove`.

### Manual install

```bash
git clone https://github.com/miskatul-anwar/hairline ~/.hairline
```

```json
{
  "statusLine": { "type": "command", "command": "node ~/.hairline/statusline.mjs", "padding": 0 }
}
```

## Customize

Colors live in the `C` palette at the top of `statusline.mjs` (RGB triples); the separator is `SEP`.
Set `NO_COLOR=1` for plain text.

## Requirements

- Node.js 18+
- `git` (optional, for the branch segment)

## Development

```bash
npm test
```

## License

MIT

## statusline-forge

Want your own design instead? [`statusline-forge/`](statusline-forge/) is a separate plugin: a status line designer skill where you describe the line you want and the agent builds, previews, installs and debugs it. It is **not** covered by this repository's MIT licence; it has its own commercial licence in [`statusline-forge/LICENSE`](statusline-forge/LICENSE).
