import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCRIPTS, plain } from "./helpers.mjs";

const FORGE = join(SCRIPTS, "forge.mjs");

function sandbox() {
  const home = mkdtempSync(join(tmpdir(), "slf-home-"));
  const claude = join(home, ".claude");
  const forge = (...args) =>
    spawnSync(process.execPath, [FORGE, ...args], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home, TMPDIR: home, NO_COLOR: "1" },
    });
  const settings = () => JSON.parse(readFileSync(join(claude, "settings.json"), "utf8"));
  const write = (name, obj) => {
    mkdirSync(claude, { recursive: true });
    const p = join(home, name);
    writeFileSync(p, typeof obj === "string" ? obj : JSON.stringify(obj));
    return p;
  };
  return { home, claude, forge, settings, write };
}

// Run the exact command Claude Code would run, the way Claude Code runs it (through a shell).
function runInstalled(command, input, home) {
  return spawnSync(command, { shell: true, input, encoding: "utf8", env: { PATH: process.env.PATH, HOME: home, TMPDIR: home, NO_COLOR: "1" } });
}

test("install writes settings, copies the runtime, and the installed command renders", () => {
  const s = sandbox();
  const cfg = s.write("my.json", { lines: [["model", "cost"]] });
  const r = s.forge("install", "--config", cfg);
  assert.equal(r.status, 0, r.stderr);
  const sl = s.settings().statusLine;
  assert.equal(sl.type, "command");
  assert.equal(sl.padding, 0);
  assert.ok(existsSync(join(s.claude, "statusline-forge", "statusline.mjs")));
  assert.ok(existsSync(join(s.claude, "statusline-forge", "lib", "render.mjs")));
  const out = runInstalled(sl.command, JSON.stringify({ model: { display_name: "Opus 5.5" }, cost: { total_cost_usd: 1 } }), s.home);
  assert.equal(out.status, 0);
  assert.equal(out.stdout, "◆ Opus 5.5 · $1.00");
});

test("install preserves other settings and is idempotent", () => {
  const s = sandbox();
  mkdirSync(s.claude, { recursive: true });
  writeFileSync(join(s.claude, "settings.json"), JSON.stringify({ theme: "dark", permissions: { allow: ["Bash(ls)"] } }, null, 2));
  assert.equal(s.forge("install").status, 0);
  const first = readFileSync(join(s.claude, "settings.json"), "utf8");
  const mtime = statSync(join(s.claude, "settings.json")).mtimeMs;
  const again = s.forge("install");
  assert.equal(again.status, 0);
  assert.match(again.stdout, /already up to date/);
  assert.equal(readFileSync(join(s.claude, "settings.json"), "utf8"), first);
  assert.equal(statSync(join(s.claude, "settings.json")).mtimeMs, mtime);
  assert.deepEqual(s.settings().permissions, { allow: ["Bash(ls)"] });
  assert.equal(s.settings().theme, "dark");
});

test("a previous status line is backed up and restored on uninstall", () => {
  const s = sandbox();
  mkdirSync(s.claude, { recursive: true });
  const previous = { type: "command", command: "~/.claude/old.sh", padding: 2 };
  writeFileSync(join(s.claude, "settings.json"), JSON.stringify({ statusLine: previous }));
  const inst = s.forge("install");
  assert.match(inst.stdout, /replacing your previous status line/);
  assert.ok(existsSync(join(s.claude, "settings.json.bak.statusline-forge")));
  const un = s.forge("uninstall");
  assert.equal(un.status, 0);
  assert.deepEqual(s.settings().statusLine, previous);
});

test("uninstall without a previous status line removes the key", () => {
  const s = sandbox();
  s.forge("install");
  s.forge("uninstall");
  assert.equal(s.settings().statusLine, undefined);
});

test("uninstall leaves a foreign status line alone", () => {
  const s = sandbox();
  mkdirSync(s.claude, { recursive: true });
  writeFileSync(join(s.claude, "settings.json"), JSON.stringify({ statusLine: { type: "command", command: "other" } }));
  const r = s.forge("uninstall");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /not installed/);
  assert.equal(s.settings().statusLine.command, "other");
});

test("refuses to touch an invalid settings.json", () => {
  const s = sandbox();
  mkdirSync(s.claude, { recursive: true });
  writeFileSync(join(s.claude, "settings.json"), "{ broken");
  const r = s.forge("install");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not valid JSON/);
  assert.equal(readFileSync(join(s.claude, "settings.json"), "utf8"), "{ broken");
});

test("refuses to install an invalid config and lists the errors", () => {
  const s = sandbox();
  const cfg = s.write("bad.json", { lines: [["contxt"]] });
  const r = s.forge("install", "--config", cfg);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Did you mean "context"/);
  assert.ok(!existsSync(join(s.claude, "settings.json")));
});

test("install --refresh sets refreshInterval", () => {
  const s = sandbox();
  s.forge("install", "--refresh", "5");
  assert.equal(s.settings().statusLine.refreshInterval, 5);
});

test("validate reports ok, or errors with exit 1", () => {
  const s = sandbox();
  assert.equal(s.forge("validate", "--config", s.write("ok.json", { preset: "minimal" })).status, 0);
  const bad = s.forge("validate", "--config", s.write("bad.json", { theme: "neon" }));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown theme "neon"/);
});

test("preview renders every sample session with labels", () => {
  const s = sandbox();
  const r = s.forge("preview", "--config", s.write("p.json", { lines: [["model", "context"]] }), "--plain");
  assert.equal(r.status, 0, r.stderr);
  for (const label of ["fresh", "mid", "hot", "worktree-pr", "api-billing"]) assert.match(r.stdout, new RegExp(label));
  assert.match(r.stdout, /◆ Sonnet 5\.5 · ━━━━━━━━━─ 91% 182k\/200k/);
});

test("preview of a single fixture at a given width", () => {
  const s = sandbox();
  const r = s.forge("preview", "--preset", "balanced", "--fixture", "mid", "--columns", "40", "--plain");
  assert.equal(r.status, 0, r.stderr);
  assert.match(plain(r.stdout), /◆ Opus 5\.5 · ━━━━────── 42% 84k\/200k/);
});

test("doctor passes on a healthy install and fails with fixes when not installed", () => {
  const s = sandbox();
  const before = s.forge("doctor");
  assert.equal(before.status, 1);
  assert.match(before.stdout, /✗ .*statusLine/);
  assert.match(before.stdout, /fix: /);
  s.forge("install");
  const after = s.forge("doctor");
  assert.equal(after.status, 0, after.stdout);
  assert.match(after.stdout, /✓ .*renders/);
});

test("doctor flags disableAllHooks", () => {
  const s = sandbox();
  s.forge("install");
  const st = s.settings();
  st.disableAllHooks = true;
  writeFileSync(join(s.claude, "settings.json"), JSON.stringify(st));
  const r = s.forge("doctor");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /disableAllHooks/);
});

test("segments, themes and presets are listed; --json is machine-readable", () => {
  const s = sandbox();
  assert.match(s.forge("segments").stdout, /context\s+Context window usage/);
  assert.match(s.forge("themes").stdout, /paper\s+Dark ink for light terminal/);
  assert.match(s.forge("presets").stdout, /dashboard\s+Two lines/);
  const json = JSON.parse(s.forge("segments", "--json").stdout);
  assert.equal(json.context.options.width.default, 10);
});

test("unknown commands print usage and exit 2", () => {
  const r = sandbox().forge("frobnicate");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage/);
});
