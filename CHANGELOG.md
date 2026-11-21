# Changelog

## 1.0.0 — 2026-11-21

- First release: 25 segments, 7 themes, 3 icon sets, 4 bar styles, 5 presets.
- `forge.mjs`: presets, segments, themes, schema, validate, preview, install, uninstall, doctor, where.
- Safe installer: refuses invalid settings.json, backs up, idempotent, restores your previous status line.
- Runtime: never blank on bad input, width-aware trimming by priority, cached and time-boxed git and command segments, colour-depth downgrade, NO_COLOR, OSC 8 links, Windows (Git Bash and PowerShell).
