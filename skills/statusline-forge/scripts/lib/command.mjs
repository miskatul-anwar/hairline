// Build the statusLine command string Claude Code will run through a shell.
//
// POSIX shells: single-quote both paths (safe for spaces, $, backticks).
// Windows: Claude Code runs the command through Git Bash when installed, else PowerShell.
// A bare first token followed by a double-quoted, forward-slash path is valid in both;
// a quoted first token is not (PowerShell would need the `&` call operator, which bash rejects).

const sq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const fwd = (p) => p.replace(/\\/g, "/");

export function buildCommand({ platform = process.platform, execPath = process.execPath, scriptPath }) {
  if (platform === "win32") {
    const node = /\s/.test(execPath) ? "node" : fwd(execPath);
    return `${node} "${fwd(scriptPath)}"`;
  }
  return `${sq(execPath)} ${sq(scriptPath)}`;
}

export const isForgeCommand = (sl) => typeof sl?.command === "string" && sl.command.includes("statusline-forge");
