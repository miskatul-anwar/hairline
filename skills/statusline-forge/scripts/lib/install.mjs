// Install / uninstall against a Claude Code settings.json.
// Guarantees: never writes over invalid JSON, backs up before every change, idempotent,
// preserves (and restores) a previous non-forge statusLine, writes atomically.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommand, isForgeCommand } from "./command.mjs";

export const SCRIPTS_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

export function paths({ settings } = {}) {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  const installDir = join(claudeDir, "statusline-forge");
  return {
    claudeDir,
    installDir,
    runtime: join(installDir, "statusline.mjs"),
    config: join(installDir, "config.json"),
    previous: join(installDir, "previous-statusline.json"),
    settings: settings || join(claudeDir, "settings.json"),
  };
}

export class ForgeError extends Error {}

export function readSettings(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return {};
  try {
    const v = JSON.parse(raw);
    if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error("top level is not an object");
    return v;
  } catch (err) {
    throw new ForgeError(`${path} is not valid JSON (${err.message}); refusing to modify it. Fix or remove it, then retry.`);
  }
}

function atomicWrite(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

const json = (v) => JSON.stringify(v, null, 2) + "\n";
const same = (path, text) => existsSync(path) && readFileSync(path, "utf8") === text;

// Files that make up the runtime: the entry point plus every lib module.
function runtimeFiles() {
  const lib = readdirSync(join(SCRIPTS_DIR, "lib")).filter((f) => f.endsWith(".mjs"));
  return [["statusline.mjs", "statusline.mjs"], ...lib.map((f) => [join("lib", f), join("lib", f)])];
}

/**
 * @param {{ config?: object, settings?: string, refresh?: number }} opts
 *   config: validated config to write (omit to keep the installed one, or default to balanced)
 * @returns {{ changed: boolean, messages: string[], paths: object }}
 */
export function install({ config, settings: settingsPath, refresh } = {}) {
  const p = paths({ settings: settingsPath });
  const settings = readSettings(p.settings); // throws before anything is written
  const messages = [];
  let changed = false;

  for (const [src, dst] of runtimeFiles()) {
    const text = readFileSync(join(SCRIPTS_DIR, src), "utf8");
    const target = join(p.installDir, dst);
    if (!same(target, text)) {
      atomicWrite(target, text);
      changed = true;
    }
  }

  const cfgText = config ? json(config) : existsSync(p.config) ? null : json({ version: 1, preset: "balanced" });
  if (cfgText && !same(p.config, cfgText)) {
    atomicWrite(p.config, cfgText);
    changed = true;
  }

  const statusLine = { type: "command", command: buildCommand({ scriptPath: p.runtime }), padding: 0 };
  if (Number.isInteger(refresh) && refresh >= 1) statusLine.refreshInterval = refresh;
  else if (refresh === undefined && isForgeCommand(settings.statusLine) && settings.statusLine.refreshInterval)
    statusLine.refreshInterval = settings.statusLine.refreshInterval;

  if (JSON.stringify(settings.statusLine) !== JSON.stringify(statusLine)) {
    if (settings.statusLine && !isForgeCommand(settings.statusLine)) {
      atomicWrite(p.previous, json(settings.statusLine));
      messages.push(`replacing your previous status line (saved; \`uninstall\` restores it): ${JSON.stringify(settings.statusLine)}`);
    }
    if (existsSync(p.settings)) copyFileSync(p.settings, `${p.settings}.bak.statusline-forge`);
    atomicWrite(p.settings, json({ ...settings, statusLine }));
    changed = true;
  }

  messages.push(
    changed
      ? `installed into ${p.settings} (backup: ${p.settings}.bak.statusline-forge). It appears on the next status line refresh.`
      : `already up to date (${p.settings}).`,
  );
  return { changed, messages, paths: p };
}

export function uninstall({ settings: settingsPath, purge = false } = {}) {
  const p = paths({ settings: settingsPath });
  const settings = readSettings(p.settings);
  const messages = [];
  if (!isForgeCommand(settings.statusLine)) {
    messages.push(`statusline-forge is not installed in ${p.settings}; nothing to remove.`);
  } else {
    let previous = null;
    try { previous = JSON.parse(readFileSync(p.previous, "utf8")); } catch {}
    const next = { ...settings };
    if (previous) next.statusLine = previous;
    else delete next.statusLine;
    copyFileSync(p.settings, `${p.settings}.bak.statusline-forge`);
    atomicWrite(p.settings, json(next));
    rmSync(p.previous, { force: true });
    messages.push(previous ? `restored your previous status line in ${p.settings}.` : `removed statusLine from ${p.settings}.`);
  }
  if (purge) {
    rmSync(p.installDir, { recursive: true, force: true });
    messages.push(`deleted ${p.installDir}.`);
  } else if (existsSync(p.config)) {
    messages.push(`kept your design at ${p.config} (reinstall to get it back, or pass --purge to delete).`);
  }
  return { messages, paths: p };
}
