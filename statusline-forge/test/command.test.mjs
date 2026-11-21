import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCommand } from "../skills/statusline-forge/scripts/lib/command.mjs";

test("POSIX: single-quoted absolute paths", () => {
  assert.equal(
    buildCommand({ platform: "linux", execPath: "/usr/bin/node", scriptPath: "/home/u/.claude/statusline-forge/statusline.mjs" }),
    "'/usr/bin/node' '/home/u/.claude/statusline-forge/statusline.mjs'",
  );
});

test("POSIX: quotes inside paths are escaped", () => {
  assert.equal(buildCommand({ platform: "darwin", execPath: "/opt/it's/node", scriptPath: "/a b/s.mjs" }), "'/opt/it'\\''s/node' '/a b/s.mjs'");
});

test("Windows: forward slashes, unquoted node path (works in Git Bash and PowerShell)", () => {
  assert.equal(
    buildCommand({ platform: "win32", execPath: "C:\\nodejs\\node.exe", scriptPath: "C:\\Users\\dev\\.claude\\statusline-forge\\statusline.mjs" }),
    'C:/nodejs/node.exe "C:/Users/dev/.claude/statusline-forge/statusline.mjs"',
  );
});

test("Windows: a node path with spaces falls back to node on PATH", () => {
  assert.equal(
    buildCommand({ platform: "win32", execPath: "C:\\Program Files\\nodejs\\node.exe", scriptPath: "C:\\Users\\A B\\.claude\\statusline-forge\\statusline.mjs" }),
    'node "C:/Users/A B/.claude/statusline-forge/statusline.mjs"',
  );
});
