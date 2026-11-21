#!/usr/bin/env node
// Points Claude Code's statusLine at hairline (or removes it with --remove).
// Usage: node setup.mjs [--remove] [--settings <path>]

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const i = args.indexOf("--settings");
const settingsPath = i >= 0 && args[i + 1] ? args[i + 1] : join(homedir(), ".claude", "settings.json");

// Resolve the newest installed version at run time, so plugin updates apply automatically.
const CACHE = '"$HOME"/.claude/plugins/cache/hairline/hairline';
export const command =
  `"${process.execPath}" "$(ls -d ${CACHE}/*/ 2>/dev/null | sort -V | tail -1)statusline.mjs"`;

function load(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`hairline: ${path} is not valid JSON, refusing to touch it (${err.message})`);
    process.exit(1);
  }
}

const settings = load(settingsPath);
const isOurs = (sl) => typeof sl?.command === "string" && sl.command.includes("hairline");

if (remove) {
  if (!isOurs(settings.statusLine)) {
    console.log("hairline: statusLine is not set to hairline, nothing to remove.");
    process.exit(0);
  }
  delete settings.statusLine;
} else {
  if (settings.statusLine && !isOurs(settings.statusLine)) {
    console.log(`hairline: replacing previous statusLine: ${JSON.stringify(settings.statusLine)}`);
  }
  settings.statusLine = { type: "command", command, padding: 0 };
}

mkdirSync(dirname(settingsPath), { recursive: true });
if (existsSync(settingsPath)) copyFileSync(settingsPath, `${settingsPath}.bak.hairline`);
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

console.log(
  remove
    ? `hairline: removed from ${settingsPath} (backup: ${settingsPath}.bak.hairline)`
    : `hairline: installed into ${settingsPath} (backup: ${settingsPath}.bak.hairline). It appears on the next refresh.`,
);
