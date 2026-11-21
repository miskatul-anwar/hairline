// Real-world providers for render(): git state and user commands. Both are time-boxed
// and cached so a slow repo or command can never stall the status line.

import { execFileSync, execSync } from "node:child_process";
import { cached } from "./cache.mjs";

export function parseGitStatus(out) {
  let oid = "", head = "", ahead = 0, behind = 0, dirty = false;
  for (const line of out.split("\n")) {
    if (line.startsWith("# branch.oid ")) oid = line.slice(13).trim();
    else if (line.startsWith("# branch.head ")) head = line.slice(14).trim();
    else if (line.startsWith("# branch.ab ")) {
      const m = /\+(\d+) -(\d+)/.exec(line);
      if (m) [ahead, behind] = [+m[1], +m[2]];
    } else if (line && !line.startsWith("#")) dirty = true;
  }
  const branch = head === "(detached)" ? (oid && oid !== "(initial)" ? oid.slice(0, 7) : "detached") : head;
  return branch ? { branch, dirty, ahead, behind } : null;
}

export function gitProvider({ ttlMs = 5000, timeoutMs = 800 } = {}) {
  return (cwd) =>
    cached(`git:${cwd}`, ttlMs, () => {
      try {
        const out = execFileSync("git", ["-C", cwd, "--no-optional-locks", "status", "--porcelain=v2", "--branch", "--untracked-files=no"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: timeoutMs,
          windowsHide: true,
        });
        return parseGitStatus(out);
      } catch {
        return null;
      }
    });
}

export function execProvider() {
  return (cmd, cwd, { ttlMs = 30000, timeoutMs = 1000 } = {}) =>
    cached(`cmd:${cwd}\0${cmd}`, ttlMs, () => {
      try {
        return execSync(cmd, {
          cwd: cwd || undefined,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: timeoutMs,
          killSignal: "SIGKILL",
          windowsHide: true,
          maxBuffer: 64 * 1024,
        });
      } catch {
        return null;
      }
    });
}
