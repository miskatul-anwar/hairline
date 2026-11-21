// Tiny file cache shared across status line invocations (each run is a fresh process).
// Lives in the user's own Claude directory (mode 0700), never in a shared temp dir.
// Failures are silent: a cache miss just means recomputing.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const cacheDir = () =>
  join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "statusline-forge", "cache");

const fileFor = (key) => join(cacheDir(), createHash("sha1").update(key).digest("hex") + ".json");

export function cacheGet(key, ttlMs, now = Date.now()) {
  if (!(ttlMs > 0)) return undefined;
  try {
    const hit = JSON.parse(readFileSync(fileFor(key), "utf8"));
    if (now - hit.at < ttlMs) return hit.value;
  } catch {}
  return undefined;
}

export function cacheSet(key, ttlMs, value, now = Date.now()) {
  if (!(ttlMs > 0)) return;
  try {
    mkdirSync(cacheDir(), { recursive: true, mode: 0o700 });
    const file = fileFor(key);
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ at: now, value }), { mode: 0o600 });
    renameSync(tmp, file);
  } catch {}
}

export function cached(key, ttlMs, compute, now = Date.now()) {
  const hit = cacheGet(key, ttlMs, now);
  if (hit !== undefined) return hit;
  const value = compute();
  cacheSet(key, ttlMs, value, now);
  return value;
}
