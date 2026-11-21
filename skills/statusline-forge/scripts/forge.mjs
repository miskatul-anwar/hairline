#!/usr/bin/env node
// statusline-forge CLI: design, preview, install and diagnose a Claude Code status line.
// Run with no arguments for usage.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectColorDepth } from "./lib/ansi.mjs";
import { COLOR_MODES, DEFAULTS, SEPARATORS, validate } from "./lib/config.mjs";
import { diagnose } from "./lib/doctor.mjs";
import { BAR_STYLES, ICON_SET_SUMMARIES, ICON_SETS } from "./lib/icons.mjs";
import { ForgeError, install, paths, SCRIPTS_DIR, uninstall } from "./lib/install.mjs";
import { PRESETS } from "./lib/presets.mjs";
import { prefetchCommands } from "./lib/providers.mjs";
import { render } from "./lib/render.mjs";
import { SEGMENTS } from "./lib/segments.mjs";
import { THEMES } from "./lib/themes.mjs";

const USAGE = `Usage: forge.mjs <command> [options]

Design
  presets                         List starting-point presets
  init     [--preset <name>] [--out <file>] [--force]
                                  Write a starter config to edit (default ./statusline-forge.json)
  segments [--json]               List every segment and its options
  themes                          List colour themes (plus icon sets, bars, separators)
  schema                          Print the JSON Schema for config files
  validate [--config <file>]      Check a config; exit 1 with every error listed
  preview  [--config <file> | --preset <name>] [--fixture <name>] [--columns <n>]
           [--color truecolor|256|16|none] [--plain]
                                  Render the design against sample sessions

Install
  install  [--config <file>] [--settings <file>] [--refresh <seconds>]
  uninstall [--settings <file>] [--purge]
  doctor   [--settings <file>] [--json]   Explain why the status line is blank or broken
  where                           Print install, config and settings paths

Fixtures: fresh, mid, hot, worktree-pr, api-billing, empty`;

const FIXTURES = ["fresh", "mid", "hot", "worktree-pr", "api-billing"];
const ALL_FIXTURES = [...FIXTURES, "empty"];
const FIXTURE_NOW = Date.UTC(2026, 0, 1); // fixtures' timestamps are relative to this instant

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith("--")) throw new ForgeError(`unexpected argument "${a}"`);
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else flags[key] = rest[++i];
  }
  return { cmd, flags };
}

function readJsonFile(file, what = "config") {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new ForgeError(`cannot read ${what} file ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new ForgeError(`${file} is not valid JSON (${err.message})`);
  }
}

function loadConfig(flags) {
  if (typeof flags.config === "string") return readJsonFile(flags.config);
  if (typeof flags.preset === "string") {
    if (!PRESETS[flags.preset]) throw new ForgeError(`unknown preset "${flags.preset}" (available: ${Object.keys(PRESETS).join(", ")})`);
    return { preset: flags.preset };
  }
  const installed = paths().config;
  return existsSync(installed) ? readJsonFile(installed) : { preset: "balanced" };
}

function requireValid(config) {
  const v = validate(config);
  if (!v.ok) throw new ForgeError(`config is invalid:\n  - ${v.errors.join("\n  - ")}`);
  return config;
}

const table = (rows) => {
  const w = Math.max(...rows.map((r) => r[0].length));
  return rows.map(([a, b]) => `  ${a.padEnd(w)}  ${b}`).join("\n");
};

function jsonSchema() {
  const segEntry = {
    oneOf: [
      { type: "string", enum: Object.keys(SEGMENTS) },
      ...Object.entries(SEGMENTS).map(([id, s]) => ({
        type: "object",
        required: ["id"],
        additionalProperties: false,
        properties: {
          id: { const: id, description: s.summary },
          options: {
            type: "object",
            additionalProperties: false,
            properties: Object.fromEntries(
              Object.entries(s.options).map(([k, o]) => [
                k,
                {
                  description: o.summary,
                  default: o.default,
                  ...(o.type === "enum" ? { enum: o.values } : { type: o.type }),
                  ...(o.min !== undefined ? { minimum: o.min } : {}),
                  ...(o.max !== undefined ? { maximum: o.max } : {}),
                },
              ]),
            ),
          },
          color: { type: "string", description: "Theme role or #rrggbb" },
          prefix: { type: "string" },
          suffix: { type: "string" },
          priority: { type: "integer", minimum: 0, maximum: 100, default: s.priority },
        },
      })),
    ],
  };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "statusline-forge config",
    type: "object",
    additionalProperties: false,
    properties: {
      $schema: { type: "string" },
      version: { const: 1 },
      preset: { enum: Object.keys(PRESETS) },
      theme: { enum: Object.keys(THEMES), default: DEFAULTS.theme },
      icons: { enum: Object.keys(ICON_SETS), default: DEFAULTS.icons },
      bar: { enum: Object.keys(BAR_STYLES) },
      color: { enum: COLOR_MODES, default: DEFAULTS.color },
      separator: { type: "string", description: `A literal string or one of: ${Object.keys(SEPARATORS).join(", ")}`, default: DEFAULTS.separator },
      hyperlinks: { type: "boolean", default: DEFAULTS.hyperlinks },
      reserve: { type: "integer", minimum: 0, maximum: 40, default: DEFAULTS.reserve },
      thresholds: {
        type: "object",
        additionalProperties: false,
        properties: {
          warn: { type: "number", minimum: 0, maximum: 100, default: DEFAULTS.thresholds.warn },
          hot: { type: "number", minimum: 0, maximum: 100, default: DEFAULTS.thresholds.hot },
        },
      },
      colors: { type: "object", additionalProperties: false, properties: Object.fromEntries(Object.keys(THEMES.dusk).filter((k) => k !== "summary").map((k) => [k, { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }])) },
      cache: { type: "object", additionalProperties: false, properties: { gitTtlMs: { type: "integer", minimum: 0, maximum: 600000, default: DEFAULTS.cache.gitTtlMs } } },
      lines: { type: "array", minItems: 1, items: { type: "array", items: segEntry } },
    },
  };
}

async function preview(flags) {
  const config = requireValid(loadConfig(flags));
  const names = typeof flags.fixture === "string" ? [flags.fixture] : FIXTURES;
  for (const n of names) if (!ALL_FIXTURES.includes(n)) throw new ForgeError(`unknown fixture "${n}" (available: ${ALL_FIXTURES.join(", ")})`);
  const depth = flags.plain ? "none" : typeof flags.color === "string" ? flags.color : detectColorDepth(process.env);
  const columns = flags.columns ? parseInt(flags.columns, 10) : undefined;
  const exec = await prefetchCommands(config, process.cwd());
  const pad = Math.max(...names.map((n) => n.length)) + 2;
  const out = [];
  for (const name of names) {
    const file = join(SCRIPTS_DIR, "fixtures", `${name}.json`);
    const text = render(readJsonFile(file, "fixture"), config, {
      columns,
      colorDepth: depth,
      now: FIXTURE_NOW,
      home: "/home/user",
      git: () => ({ branch: "main", dirty: true, ahead: 1, behind: 0 }),
      exec: (cmd) => exec(cmd, process.cwd()),
    });
    const rows = (text || "(empty)").split("\n");
    out.push(rows.map((r, i) => (i === 0 ? name.padEnd(pad) : " ".repeat(pad)) + r).join("\n"));
  }
  return out.join("\n");
}

function init(flags) {
  const preset = typeof flags.preset === "string" ? flags.preset : "balanced";
  if (!PRESETS[preset]) throw new ForgeError(`unknown preset "${preset}" (available: ${Object.keys(PRESETS).join(", ")})`);
  const out = typeof flags.out === "string" ? flags.out : "statusline-forge.json";
  if (existsSync(out) && !flags.force) throw new ForgeError(`${out} already exists; pass --force to overwrite it`);
  const { thresholds, ...rest } = PRESETS[preset].config;
  const config = { version: 1, theme: DEFAULTS.theme, icons: DEFAULTS.icons, thresholds: { ...DEFAULTS.thresholds, ...thresholds }, ...rest };
  writeFileSync(out, JSON.stringify(config, null, 2) + "\n");
  return `wrote ${out} (from preset "${preset}"). Edit it, then: validate --config ${out}`;
}

function main(argv) {
  const { cmd, flags } = parseArgs(argv);
  const settings = typeof flags.settings === "string" ? flags.settings : undefined;
  switch (cmd) {
    case "init":
      return init(flags);
    case "presets":
      return table(Object.entries(PRESETS).map(([k, p]) => [k, p.summary]));
    case "segments": {
      if (flags.json)
        return JSON.stringify(Object.fromEntries(Object.entries(SEGMENTS).map(([k, s]) => [k, { summary: s.summary, priority: s.priority, options: s.options }])), null, 2);
      return Object.entries(SEGMENTS)
        .map(([k, s]) => {
          const opts = Object.entries(s.options).map(([o, spec]) => `      ${o} (${spec.type === "enum" ? spec.values.join("|") : spec.type}, default ${JSON.stringify(spec.default)}): ${spec.summary}`);
          return [`  ${k.padEnd(9)}  ${s.summary}  [priority ${s.priority}]`, ...opts].join("\n");
        })
        .join("\n");
    }
    case "themes":
      return [
        "Themes:",
        table(Object.entries(THEMES).map(([k, t]) => [k, t.summary])),
        "Icon sets:",
        table(Object.entries(ICON_SET_SUMMARIES)),
        "Bars:",
        table(Object.entries(BAR_STYLES).map(([k, [a, b]]) => [k, a.repeat(4) + b.repeat(4)])),
        "Separators:",
        table(Object.entries(SEPARATORS).map(([k, v]) => [k, JSON.stringify(v)])),
      ].join("\n");
    case "schema":
      return JSON.stringify(jsonSchema(), null, 2);
    case "validate": {
      requireValid(loadConfig(flags));
      return "config is valid.";
    }
    case "preview":
      return preview(flags);
    case "install": {
      const config = typeof flags.config === "string" ? requireValid(readJsonFile(flags.config)) : typeof flags.preset === "string" ? requireValid(loadConfig(flags)) : undefined;
      const refresh = flags.refresh === undefined ? undefined : typeof flags.refresh === "string" ? Number(flags.refresh) : NaN;
      return install({ config, settings, refresh }).messages.join("\n");
    }
    case "uninstall":
      return uninstall({ settings, purge: !!flags.purge }).messages.join("\n");
    case "doctor": {
      const checks = diagnose({ settings });
      process.exitCode = checks.some((c) => c.level === "fail") ? 1 : 0;
      if (flags.json) return JSON.stringify(checks, null, 2);
      const mark = { ok: "✓", fail: "✗", warn: "!", info: "i" };
      return checks
        .map((c) => `${mark[c.level]} ${c.label}${c.detail ? ` — ${c.detail}` : ""}${c.fix && c.level !== "ok" ? `\n    fix: ${c.fix}` : ""}`)
        .join("\n");
    }
    case "where": {
      const p = paths({ settings });
      return table([["install dir", p.installDir], ["config", p.config], ["settings", p.settings]]);
    }
    default: {
      const e = new ForgeError(cmd ? `unknown command "${cmd}"\n\n${USAGE}` : USAGE);
      e.code = 2;
      throw e;
    }
  }
}

try {
  const out = await main(process.argv.slice(2));
  if (out) process.stdout.write(out + "\n");
} catch (err) {
  // Expected failures are ForgeErrors; anything else (EACCES, EPERM…) still gets a one-line
  // message. Set STATUSLINE_FORGE_DEBUG=1 for the stack.
  if (process.env.STATUSLINE_FORGE_DEBUG) console.error(err);
  process.stderr.write(`statusline-forge: ${err?.message ?? err}\n`);
  process.exitCode = err instanceof ForgeError ? err.code ?? 1 : 1;
}
