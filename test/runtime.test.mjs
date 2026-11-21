import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCRIPTS, plain } from "./helpers.mjs";

const RUNTIME = join(SCRIPTS, "statusline.mjs");

function run(stdin, { config, env = {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "slf-rt-"));
  const cfgPath = join(dir, "config.json");
  if (config !== undefined) writeFileSync(cfgPath, typeof config === "string" ? config : JSON.stringify(config));
  const r = spawnSync(process.execPath, [RUNTIME], {
    input: stdin,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: dir, TMPDIR: dir, NO_COLOR: "1", STATUSLINE_FORGE_CONFIG: cfgPath, ...env },
  });
  return { ...r, dir };
}

const payload = (over = {}) => JSON.stringify({ model: { display_name: "Opus 5.5" }, cost: { total_cost_usd: 2.5 }, ...over });

test("renders the configured line from stdin", () => {
  const r = run(payload(), { config: { lines: [["model", "cost"]] } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "◆ Opus 5.5 · $2.50");
});

test("no config file falls back to the balanced preset", () => {
  const r = run(payload());
  assert.equal(r.stdout, "◆ Opus 5.5 · $2.50");
});

test("garbage stdin exits 0 without a stack trace", () => {
  const r = run("{not json", { config: { lines: [["model"]] } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.doesNotMatch(r.stderr, /at .*\.mjs:\d+/);
});

test("an invalid config file still renders (defaults) and explains on stderr", () => {
  const r = run(payload(), { config: "{ oops" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "◆ Opus 5.5 · $2.50");
  assert.match(r.stderr, /statusline-forge: config/);
});

test("COLUMNS from Claude Code trims the line", () => {
  const r = run(payload(), { config: { lines: [["model", "cost"]] }, env: { COLUMNS: "14" } });
  assert.equal(r.stdout, "◆ Opus 5.5");
});

test("colour is emitted when NO_COLOR is unset", () => {
  const r = run(payload(), { config: { lines: [["model"]] }, env: { NO_COLOR: undefined, COLORTERM: "truecolor" } });
  assert.match(r.stdout, /\x1b\[38;2;/);
});

test("git branch, dirty marker in a real repository", () => {
  const repo = mkdtempSync(join(tmpdir(), "slf-git-"));
  const git = (...a) => execFileSync("git", ["-C", repo, ...a], { stdio: "ignore" });
  git("init", "-q", "-b", "trunk");
  writeFileSync(join(repo, "a.txt"), "1");
  git("add", ".");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init");
  const clean = run(JSON.stringify({ workspace: { current_dir: repo } }), { config: { lines: [["git"]] } });
  assert.equal(clean.stdout, "trunk");
  writeFileSync(join(repo, "a.txt"), "2");
  const dirty = run(JSON.stringify({ workspace: { current_dir: repo } }), { config: { lines: [["git"]], cache: { gitTtlMs: 0 } } });
  assert.equal(dirty.stdout, "trunk●");
});

test("outside a repository the git segment hides", () => {
  const r = run(JSON.stringify({ model: { display_name: "M" }, workspace: { current_dir: tmpdir() } }), { config: { lines: [["model", "git"]] } });
  assert.equal(r.stdout, "◆ M");
});

test("command segment runs in the session directory and is cached", () => {
  const dir = mkdtempSync(join(tmpdir(), "slf-cmd-"));
  const counter = join(dir, "n");
  writeFileSync(counter, "");
  const cmd = `echo x >> "${counter}"; pwd`;
  const cfg = { lines: [[{ id: "command", options: { run: cmd, ttlMs: 60000 } }]] };
  const p = JSON.stringify({ workspace: { current_dir: dir } });
  const tmp = mkdtempSync(join(tmpdir(), "slf-cache-"));
  const a = run(p, { config: cfg, env: { TMPDIR: tmp } });
  const b = run(p, { config: cfg, env: { TMPDIR: tmp } });
  assert.equal(plain(a.stdout), dir);
  assert.equal(plain(b.stdout), dir);
  assert.equal(readFileSync(counter, "utf8").trim().split("\n").length, 1);
});

test("a hanging command is killed by its timeout and the segment hides", () => {
  const started = Date.now();
  const r = run(payload(), { config: { lines: [["model", { id: "command", options: { run: "sleep 5", timeoutMs: 200, ttlMs: 0 } }]] } });
  assert.equal(r.stdout, "◆ Opus 5.5");
  assert.ok(Date.now() - started < 3000);
});
