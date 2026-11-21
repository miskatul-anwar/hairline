// Tiny file cache shared across status line invocations (each run is a fresh process).
// Failures are silent: a cache miss just means recomputing.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

function cacheDir() {
  let user = "user";
  try { user = userInfo().username; } catch {}
  return join(tmpdir(), `statusline-forge-${user.replace(/[^\w.-]/g, "_")}`);
}

export function cached(key, ttlMs, compute, now = Date.now()) {
  if (!(ttlMs > 0)) return compute();
  const dir = cacheDir();
  const file = join(dir, createHash("sha1").update(key).digest("hex") + ".json");
  try {
    const hit = JSON.parse(readFileSync(file, "utf8"));
    if (now - hit.at < ttlMs) return hit.value;
  } catch {}
  const value = compute();
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ at: now, value }), { mode: 0o600 });
    renameSync(tmp, file);
  } catch {}
  return value;
}
