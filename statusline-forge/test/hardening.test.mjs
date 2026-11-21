import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, lstatSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "../skills/statusline-forge/scripts/lib/render.mjs";
import { buildCommand } from "../skills/statusline-forge/scripts/lib/command.mjs";
import { detectColorDepth } from "../skills/statusline-forge/scripts/lib/ansi.mjs";
import { SCRIPTS, env, fixture, plain } from "./helpers.mjs";

const FORGE = join(SCRIPTS, "forge.mjs");
const RUNTIME = join(SCRIPTS, "statusline.mjs");
const forgeIn = (home, ...args) =>
  spawnSync(process.execPath, [FORGE, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: home, NO_COLOR: "1" } });
const home = () => mkdtempSync(join(tmpdir(), "slf-h-"));

test("the original settings.json backup survives repeated installs and uninstall", () => {
  const h = home();
  mkdirSync(join(h, ".claude"));
  const original = JSON.stringify({ theme: "dark", marker: "pristine" });
  writeFileSync(join(h, ".claude", "settings.json"), original);
  forgeIn(h, "install");
  forgeIn(h, "install", "--refresh", "5");
  forgeIn(h, "uninstall");
  assert.equal(readFileSync(join(h, ".claude", "settings.json.bak.statusline-forge"), "utf8"), original);
});

test("a symlinked settings.json stays a symlink and keeps its permissions", () => {
  const h = home();
  mkdirSync(join(h, ".claude"));
  const real = join(h, "dotfiles-settings.json");
  writeFileSync(real, JSON.stringify({ env: { TOKEN: "x" } }));
  chmodSync(real, 0o600);
  symlinkSync(real, join(h, ".claude", "settings.json"));
  assert.equal(forgeIn(h, "install").status, 0);
  assert.ok(lstatSync(join(h, ".claude", "settings.json")).isSymbolicLink());
  assert.equal(statSync(real).mode & 0o777, 0o600);
  assert.ok(JSON.parse(readFileSync(real, "utf8")).statusLine);
});

test("a user script whose path merely mentions statusline-forge is treated as foreign", () => {
  const h = home();
  mkdirSync(join(h, ".claude"));
  const mine = { type: "command", command: "~/my-statusline-forge-fork/run.sh" };
  writeFileSync(join(h, ".claude", "settings.json"), JSON.stringify({ statusLine: mine }));
  assert.match(forgeIn(h, "install").stdout, /replacing your previous status line/);
  forgeIn(h, "uninstall");
  assert.deepEqual(JSON.parse(readFileSync(join(h, ".claude", "settings.json"), "utf8")).statusLine, mine);
});

test("install removes runtime files that no longer exist in the skill", () => {
  const h = home();
  forgeIn(h, "install");
  const stale = join(h, ".claude", "statusline-forge", "lib", "old-module.mjs");
  writeFileSync(stale, "");
  forgeIn(h, "install");
  assert.ok(!existsSync(stale));
});

test("control characters in session data cannot inject terminal escapes", () => {
  const d = fixture("worktree-pr");
  d.model.display_name = "Opus\x1b]0;pwned\x07\x1b[2J";
  d.pr.url = "https://x.test/\x07\x1b]8;;evil";
  d.workspace.current_dir = "/tmp/a\x1bb";
  const out = render(d, { lines: [["model", "dir", "pr"]] }, env({ colorDepth: "none" }));
  assert.doesNotMatch(out, /[\x00-\x08\x0b-\x1f\x7f]/);
  assert.equal(out, "◆ Opus]0;pwned[2J · /t/ab · #1234 changes");
});

test("command and git output are sanitised too", () => {
  const out = render(fixture("mid"), { lines: [["git", { id: "command", options: { run: "x" } }]] }, env({
    git: () => ({ branch: "ma\x1b[31min", dirty: false, ahead: 0, behind: 0 }),
    exec: () => "ok\x1b[2Jdone",
  }));
  assert.equal(out, "ma[31min · ok[2Jdone");
});

test("a per-segment colour applies to metric segments too", () => {
  const out = render(fixture("mid"), { lines: [[{ id: "context", color: "#ff0000" }]] }, env({ colorDepth: "truecolor" }));
  assert.match(out, /\x1b\[38;2;255;0;0m42%/);
});

test("a segment in the hot zone outranks calmer segments when trimming", () => {
  const out = plain(render(fixture("hot"), { lines: [["model", "dir", "rate_5h"]] }, env({ columns: 36 })));
  assert.equal(out, "◆ Sonnet 5.5 · 5h ━━━━━─ 88% ↻ 35m");
});

test("empty NO_COLOR is ignored, per no-color.org", () => {
  assert.equal(detectColorDepth({ NO_COLOR: "", COLORTERM: "truecolor" }), "truecolor");
  assert.equal(detectColorDepth({ NO_COLOR: "1", COLORTERM: "truecolor" }), "none");
});

test("Windows: a space-free short path keeps the absolute Node binary", () => {
  assert.equal(
    buildCommand({ platform: "win32", execPath: "C:\\Program Files\\nodejs\\node.exe", shortExecPath: "C:\\PROGRA~1\\nodejs\\node.exe", scriptPath: "C:\\Users\\d\\.claude\\statusline-forge\\statusline.mjs" }),
    'C:/PROGRA~1/nodejs/node.exe "C:/Users/d/.claude/statusline-forge/statusline.mjs"',
  );
});

test("a pipeline that outlives its timeout is killed and does not stall the line", () => {
  const h = home();
  const cfg = join(h, "c.json");
  writeFileSync(cfg, JSON.stringify({ lines: [["model", { id: "command", options: { run: "sleep 5 | cat", timeoutMs: 200, ttlMs: 0 } }]] }));
  const started = Date.now();
  const r = spawnSync(process.execPath, [RUNTIME], {
    input: JSON.stringify({ model: { display_name: "M" } }),
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: h, NO_COLOR: "1", STATUSLINE_FORGE_CONFIG: cfg },
  });
  assert.equal(r.stdout, "◆ M");
  assert.ok(Date.now() - started < 2000, `took ${Date.now() - started}ms`);
});

test("several command segments run in parallel", () => {
  const h = home();
  const cfg = join(h, "c.json");
  const seg = (n) => ({ id: "command", options: { run: `sleep 0.4; echo ${n}`, ttlMs: 0 } });
  writeFileSync(cfg, JSON.stringify({ lines: [[seg(1), seg(2), seg(3)]] }));
  const started = Date.now();
  const r = spawnSync(process.execPath, [RUNTIME], { input: "{}", encoding: "utf8", env: { PATH: process.env.PATH, HOME: h, NO_COLOR: "1", STATUSLINE_FORGE_CONFIG: cfg } });
  assert.equal(r.stdout, "1 · 2 · 3");
  assert.ok(Date.now() - started < 1100, `took ${Date.now() - started}ms`);
});

test("the cache lives in the user's own claude directory, not shared /tmp", () => {
  const h = home();
  const cfg = join(h, "c.json");
  writeFileSync(cfg, JSON.stringify({ lines: [[{ id: "command", options: { run: "echo hi", ttlMs: 60000 } }]] }));
  spawnSync(process.execPath, [RUNTIME], { input: "{}", encoding: "utf8", env: { PATH: process.env.PATH, HOME: h, STATUSLINE_FORGE_CONFIG: cfg } });
  const dir = join(h, ".claude", "statusline-forge", "cache");
  assert.ok(existsSync(dir));
  assert.equal(statSync(dir).mode & 0o777, 0o700);
});

test("init writes a starter config and refuses to overwrite without --force", () => {
  const h = home();
  const out = join(h, "draft.json");
  assert.equal(forgeIn(h, "init", "--preset", "dashboard", "--out", out).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")).lines, [
    ["model", "effort", "agent", "vim", "dir", "git", "worktree", "pr"],
    ["context", "cache", "cost", "duration", "lines", "rate_5h", "rate_7d", "spend"],
  ]);
  assert.equal(forgeIn(h, "init", "--out", out).status, 1);
  assert.equal(forgeIn(h, "init", "--out", out, "--force").status, 0);
});

test("doctor --json gives every check a stable id", () => {
  const checks = JSON.parse(forgeIn(home(), "doctor", "--json").stdout);
  assert.ok(checks.every((c) => typeof c.id === "string" && c.id));
  assert.ok(checks.some((c) => c.id === "statusline-configured"));
});

test("unexpected filesystem errors are reported without a stack trace", () => {
  const h = home();
  mkdirSync(join(h, ".claude"));
  writeFileSync(join(h, ".claude", "settings.json"), "{}");
  chmodSync(join(h, ".claude"), 0o500);
  const r = forgeIn(h, "install");
  chmodSync(join(h, ".claude"), 0o700);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^statusline-forge: .*(EACCES|permission)/im);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test("preview rejects fixture names that are not bundled samples", () => {
  const r = forgeIn(home(), "preview", "--fixture", "../../package");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown fixture/);
});
