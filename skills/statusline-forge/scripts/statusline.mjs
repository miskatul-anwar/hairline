#!/usr/bin/env node
// statusline-forge runtime. Claude Code pipes the session JSON on stdin; we print the line.
// Contract: always exit 0, never print a stack trace to stdout, degrade instead of failing.
// Config: $STATUSLINE_FORGE_CONFIG, else config.json next to this file.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const warn = (msg) => process.stderr.write(`statusline-forge: ${msg}\n`);

function readJson(text, what) {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    warn(`${what} is not valid JSON (${err.message})`);
    return null;
  }
}

function readStdin() {
  if (process.stdin.isTTY) return {};
  try {
    return readJson(readFileSync(0, "utf8"), "stdin") ?? {};
  } catch {
    return {};
  }
}

function readConfig() {
  const path = process.env.STATUSLINE_FORGE_CONFIG || join(here, "config.json");
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {}; // no config yet: defaults
  }
  return readJson(text, `config ${path}`) ?? {};
}

async function main() {
  const input = readStdin();
  let out = "";
  try {
    const [{ render }, { detectColorDepth }, { gitProvider, execProvider }, { resolve }] = await Promise.all([
      import("./lib/render.mjs"),
      import("./lib/ansi.mjs"),
      import("./lib/providers.mjs"),
      import("./lib/config.mjs"),
    ]);
    const config = readConfig();
    const cols = parseInt(process.env.COLUMNS ?? "", 10);
    out = render(input, config, {
      columns: Number.isInteger(cols) && cols > 0 ? cols : undefined,
      colorDepth: detectColorDepth(process.env),
      now: Date.now(),
      home: homedir(),
      git: gitProvider({ ttlMs: resolve(config).cache.gitTtlMs }),
      exec: execProvider(),
    });
  } catch (err) {
    warn(`render failed (${err?.message ?? err})`);
    out = input?.model?.display_name ?? "";
  }
  process.stdout.write(out);
}

main().catch(() => {}).finally(() => { process.exitCode = 0; });
