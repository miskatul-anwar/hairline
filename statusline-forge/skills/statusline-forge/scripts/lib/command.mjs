// Build the statusLine command string Claude Code will run through a shell.
//
// POSIX shells: single-quote both paths (safe for spaces, $, backticks).
// Windows: Claude Code runs the command through Git Bash when installed, else PowerShell.
// A bare first token followed by a double-quoted, forward-slash path is valid in both;
// a quoted first token is not (PowerShell would need the `&` call operator, which bash
// rejects). So the Node path must contain no spaces: we use its 8.3 short form
// (C:\PROGRA~1\nodejs\node.exe) when available, and only fall back to `node` on PATH.

import { execFileSync } from "node:child_process";

const sq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const fwd = (p) => p.replace(/\\/g, "/");
const hasSpace = (p) => /\s/.test(p);

export const RUNTIME_MARKER = "statusline-forge/statusline.mjs";

export function buildCommand({ platform = process.platform, execPath = process.execPath, shortExecPath, scriptPath }) {
  if (platform === "win32") {
    const candidate = [execPath, shortExecPath].find((p) => p && !hasSpace(p));
    return `${candidate ? fwd(candidate) : "node"} "${fwd(scriptPath)}"`;
  }
  return `${sq(execPath)} ${sq(scriptPath)}`;
}

// Windows 8.3 short path of a file, or undefined when unavailable (8.3 names disabled).
export function windowsShortPath(path) {
  if (process.platform !== "win32" || !hasSpace(path)) return undefined;
  try {
    const out = execFileSync("cmd.exe", ["/d", "/c", `for %I in ("${path}") do @echo %~sI`], { encoding: "utf8", windowsHide: true, timeout: 3000 }).trim();
    return out && !hasSpace(out) ? out : undefined;
  } catch {
    return undefined;
  }
}

// Ours only if it runs our installed runtime, not merely because a path mentions the name.
export const isForgeCommand = (sl) => typeof sl?.command === "string" && fwd(sl.command).includes(RUNTIME_MARKER);
