// Install / uninstall against a Claude Code settings.json.
// Guarantees: never writes over invalid JSON; keeps a one-time backup of the original;
// idempotent; preserves (and restores) a previous non-forge statusLine; writes atomically
// through symlinks (dotfile managers) while keeping the file's permissions.

import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommand, isForgeCommand, windowsShortPath } from "./command.mjs";

export const SCRIPTS_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

export function paths({ settings } = {}) {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  const installDir = join(claudeDir, "statusline-forge");
  const settingsPath = settings || join(claudeDir, "settings.json");
  return {
    claudeDir,
    installDir,
    runtime: join(installDir, "statusline.mjs"),
    config: join(installDir, "config.json"),
    previous: join(installDir, "previous-statusline.json"),
    settings: settingsPath,
    backup: `${settingsPath}.bak.statusline-forge`,
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

// Write via temp file + rename into the symlink's real target, keeping its mode.
function atomicWrite(path, text) {
  const target = existsSync(path) ? realpathSync(path) : path;
  mkdirSync(dirname(target), { recursive: true });
  const mode = existsSync(target) ? statSync(target).mode & 0o777 : undefined;
  const tmp = `${target}.${process.pid}.tmp`;
  writeFileSync(tmp, text, mode !== undefined ? { mode } : undefined);
  if (mode !== undefined) chmodSync(tmp, mode); // umask may have narrowed it
  renameSync(tmp, target);
}

const json = (v) => JSON.stringify(v, null, 2) + "\n";
const same = (path, text) => existsSync(path) && readFileSync(path, "utf8") === text;

// The runtime: the entry point plus every lib module.
function runtimeFiles() {
  const lib = readdirSync(join(SCRIPTS_DIR, "lib")).filter((f) => f.endsWith(".mjs"));
  return ["statusline.mjs", ...lib.map((f) => join("lib", f))];
}

// Keep the user's pre-forge settings.json forever: only the first change makes a backup.
function backupOnce(p) {
  if (existsSync(p.settings) && !existsSync(p.backup)) copyFileSync(p.settings, p.backup);
}

function syncRuntime(installDir) {
  let changed = false;
  const files = runtimeFiles();
  for (const rel of files) {
    const text = readFileSync(join(SCRIPTS_DIR, rel), "utf8");
    const target = join(installDir, rel);
    if (!same(target, text)) {
      atomicWrite(target, text);
      changed = true;
    }
  }
  const libDir = join(installDir, "lib");
  for (const f of existsSync(libDir) ? readdirSync(libDir) : []) {
    if (!files.includes(join("lib", f))) {
      rmSync(join(libDir, f), { force: true });
      changed = true;
    }
  }
  return changed;
}

/**
 * @param {{ config?: object, settings?: string, refresh?: number }} opts
 *   config: validated config to write (omit to keep the installed one, or default to balanced)
 *   refresh: refreshInterval seconds (≥ 1); omit to keep the current one
 */
export function install({ config, settings: settingsPath, refresh } = {}) {
  if (refresh !== undefined && !(Number.isInteger(refresh) && refresh >= 1))
    throw new ForgeError("--refresh must be a whole number of seconds ≥ 1");
  const p = paths({ settings: settingsPath });
  const settings = readSettings(p.settings); // throws before anything is written
  const messages = [];
  let changed = syncRuntime(p.installDir);

  const cfgText = config ? json(config) : existsSync(p.config) ? null : json({ version: 1, preset: "balanced" });
  if (cfgText && !same(p.config, cfgText)) {
    atomicWrite(p.config, cfgText);
    changed = true;
  }

  const command = buildCommand({ scriptPath: p.runtime, shortExecPath: windowsShortPath(process.execPath) });
  const statusLine = { type: "command", command, padding: 0 };
  const current = settings.statusLine;
  if (refresh !== undefined) statusLine.refreshInterval = refresh;
  else if (isForgeCommand(current) && current.refreshInterval) statusLine.refreshInterval = current.refreshInterval;
  if (isForgeCommand(current) && current.hideVimModeIndicator !== undefined) statusLine.hideVimModeIndicator = current.hideVimModeIndicator;

  if (JSON.stringify(current) !== JSON.stringify(statusLine)) {
    if (current && !isForgeCommand(current)) {
      atomicWrite(p.previous, json(current));
      messages.push(`replacing your previous status line (saved; \`uninstall\` restores it): ${JSON.stringify(current)}`);
    }
    backupOnce(p);
    atomicWrite(p.settings, json({ ...settings, statusLine }));
    changed = true;
  }

  messages.push(
    changed
      ? `installed into ${p.settings}${existsSync(p.backup) ? ` (original backed up at ${p.backup})` : ""}. It appears on the next status line refresh.`
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
    backupOnce(p);
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
