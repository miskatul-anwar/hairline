// Real-world providers for render(): git state and user commands. Both are time-boxed
// and cached so a slow repo or command can never stall the status line.

import { execFileSync, spawn } from "node:child_process";
import { cacheGet, cacheSet, cached } from "./cache.mjs";
import { resolve } from "./config.mjs";

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

// Kill the whole process tree, so `a | b` or a backgrounded child can't hold stdout open.
function killTree(child) {
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else process.kill(-child.pid, "SIGKILL");
  } catch {}
}

const MAX_OUTPUT = 64 * 1024;

// Run one shell command; resolve its stdout, or null on failure/timeout. Never rejects.
export function runCommand(cmd, cwd, timeoutMs) {
  return new Promise((done) => {
    let out = "";
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done(v);
    };
    let child;
    try {
      child = spawn(cmd, { cwd: cwd || undefined, shell: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    } catch {
      return done(null);
    }
    const timer = setTimeout(() => {
      killTree(child);
      finish(null);
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
      if (out.length > MAX_OUTPUT) {
        killTree(child);
        finish(out.slice(0, MAX_OUTPUT));
      }
    });
    child.on("error", () => finish(null));
    child.on("close", (code) => finish(code === 0 ? out : null));
  });
}

const commandKey = (cmd, cwd) => `cmd:${cwd || ""}\0${cmd}`;

/**
 * Run every `command` segment in the config, in parallel, before rendering.
 * Returns a synchronous exec(cmd, cwd) for render() that reads the results.
 */
export async function prefetchCommands(config, cwd, now = Date.now()) {
  const results = new Map();
  const jobs = [];
  for (const line of resolve(config).lines)
    for (const e of line) {
      if (e.id !== "command" || !e.options.run) continue;
      const key = commandKey(e.options.run, cwd);
      if (results.has(key)) continue;
      const hit = cacheGet(key, e.options.ttlMs, now);
      if (hit !== undefined) {
        results.set(key, hit);
        continue;
      }
      results.set(key, null);
      jobs.push(
        runCommand(e.options.run, cwd, e.options.timeoutMs).then((out) => {
          results.set(key, out);
          cacheSet(key, e.options.ttlMs, out, now);
        }),
      );
    }
  await Promise.all(jobs);
  return (cmd, dir) => results.get(commandKey(cmd, dir)) ?? null;
}
