import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function render(input, env = {}) {
  const r = spawnSync(process.execPath, [join(root, "statusline.mjs")], {
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  assert.equal(r.status, 0, r.stderr);
  return strip(r.stdout);
}

const now = () => Math.floor(Date.now() / 1000);

test("renders every segment", () => {
  const out = render({
    model: { display_name: "Opus 5.5" },
    workspace: { current_dir: tmpdir() },
    context_window: { used_percentage: 42, context_window_size: 200000, current_usage: { input_tokens: 84000 } },
    cost: { total_cost_usd: 1.234 },
    rate_limits: { five_hour: { used_percentage: 31, resets_at: now() + 8040 } },
  });
  assert.match(out, /◆ Opus 5\.5/);
  assert.match(out, /━{4}─{6} 42% 84k\/200k/);
  assert.match(out, /\$1\.23/);
  assert.match(out, /session ━{2}─{4} 31% ↻ 2h1[34]m/);
});

test("derives tokens from percentage and formats millions", () => {
  assert.match(render({ context_window: { used_percentage: 85, context_window_size: 1_000_000 } }), /85% 850k\/1M/);
});

test("accepts ISO reset times and hides past ones", () => {
  const iso = new Date(Date.now() + 25 * 60_000).toISOString();
  assert.match(render({ rate_limits: { five_hour: { used_percentage: 88, resets_at: iso } } }), /88% ↻ 2[45]m/);
  assert.doesNotMatch(render({ rate_limits: { five_hour: { used_percentage: 5, resets_at: now() - 60 } } }), /↻/);
});

test("hides zero cost", () => {
  assert.doesNotMatch(render({ cost: { total_cost_usd: 0 } }), /\$/);
});

test("tolerates empty and invalid input", () => {
  assert.equal(render(""), "");
  assert.equal(render("not json"), "");
  assert.equal(render({}), "");
});

test("NO_COLOR disables escape codes", () => {
  const r = spawnSync(process.execPath, [join(root, "statusline.mjs")], {
    input: JSON.stringify({ model: { display_name: "X" } }),
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(r.stdout, "◆ X");
});

function setup(settingsPath, ...flags) {
  const r = spawnSync(process.execPath, [join(root, "scripts/setup.mjs"), "--settings", settingsPath, ...flags], {
    encoding: "utf8",
  });
  return r;
}

test("setup installs, preserves other keys, and removes", () => {
  const dir = mkdtempSync(join(tmpdir(), "hairline-"));
  const file = join(dir, "settings.json");
  writeFileSync(file, JSON.stringify({ theme: "auto", statusLine: { type: "command", command: "other" } }));

  assert.equal(setup(file).status, 0);
  let s = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(s.theme, "auto");
  assert.match(s.statusLine.command, /hairline\/hairline\/\*\/.*statusline\.mjs/);
  assert.ok(existsSync(file + ".bak.hairline"));

  assert.equal(setup(file, "--remove").status, 0);
  s = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(s.statusLine, undefined);
  assert.equal(s.theme, "auto");
});

test("setup refuses to overwrite invalid settings", () => {
  const dir = mkdtempSync(join(tmpdir(), "hairline-"));
  const file = join(dir, "settings.json");
  writeFileSync(file, "{ broken");
  assert.equal(setup(file).status, 1);
  assert.equal(readFileSync(file, "utf8"), "{ broken");
});

test("installed command resolves the newest cached version", () => {
  const home = mkdtempSync(join(tmpdir(), "hairline-home-"));
  const file = join(home, "settings.json");
  setup(file);
  const { command } = JSON.parse(readFileSync(file, "utf8")).statusLine;
  for (const v of ["0.1.0", "0.10.0", "0.9.0"]) {
    const d = join(home, ".claude/plugins/cache/hairline/hairline", v);
    spawnSync("mkdir", ["-p", d]);
    writeFileSync(join(d, "statusline.mjs"), `process.stdout.write("v${v}")`);
  }
  const r = spawnSync("sh", ["-c", command], { encoding: "utf8", env: { ...process.env, HOME: home } });
  assert.equal(r.stdout, "v0.10.0");
});
