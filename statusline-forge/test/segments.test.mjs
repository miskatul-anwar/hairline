import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../skills/statusline-forge/scripts/lib/render.mjs";
import { env, fixture, plain } from "./helpers.mjs";

const repo = () => ({ branch: "main", dirty: true, ahead: 2, behind: 0 });
const show = (fx, config, over) => plain(render(fixture(fx), config, env(over)));

test("dashboard preset, mid-session: two lines with every populated segment", () => {
  assert.equal(
    show("mid", { preset: "dashboard" }, { git: repo }),
    "◆ Opus 5.5 · effort high · ~/c/acme-api · main●↑2\n" +
      "━━━━────── 42% 84k/200k · cache warm 1h00m · $1.23 · 45m · +156 -23 · 5h ━━──── 31% ↻ 2h14m · 7d ━───── 12% ↻ 6d0h",
  );
});

test("full preset, near limits: hot session with spend over the limit", () => {
  assert.equal(
    show("hot", { preset: "full" }),
    "◆ Sonnet 5.5 · effort max · fast · NORMAL · ~/c/a/s/auth · ━━━━━━━━━─ 91% 182k/200k · cache cold · $18.90 · " +
      "+2410 -1877 · 5h ━━━━━─ 88% ↻ 35m · 7d ━━━━── 66% ↻ 2d0h · spend $521/$500 monthly",
  );
});

test("worktree session shows worktree, PR state, 1M context and the 200k warning", () => {
  assert.equal(
    show("worktree-pr", { lines: [["worktree", "pr", "context"]] }),
    "⑂ oauth · #1234 changes · ━━──────── 23% 230k/1M ⚠200k",
  );
});

test("fresh session hides context until the first response and hides zero cost", () => {
  assert.equal(show("fresh", { lines: [["model", "context", "cost", "thinking"]] }), "◆ Opus 5.5 · think");
});

test("context falls back to current_usage when used_percentage is null", () => {
  const d = fixture("mid");
  d.context_window.used_percentage = null;
  assert.equal(plain(render(d, { lines: [["context"]] }, env())), "━━━━────── 42% 84k/200k");
});

test("Windows paths are shortened with backslashes", () => {
  assert.equal(show("api-billing", { lines: [["dir"]] }, { home: "C:\\Users\\dev" }), "~\\w\\shop");
  assert.equal(show("api-billing", { lines: [["dir"]] }, { home: "" }), "C:\\U\\d\\w\\shop");
});

test("dir styles: basename, full, project-relative", () => {
  assert.equal(show("hot", { lines: [[{ id: "dir", options: { style: "basename" } }]] }), "auth");
  assert.equal(show("hot", { lines: [[{ id: "dir", options: { style: "full" } }]] }), "~/code/acme-api/src/auth");
  assert.equal(show("hot", { lines: [[{ id: "dir", options: { style: "project" } }]] }), "acme-api/src/auth");
});

test("narrow terminals drop the lowest-priority segments first", () => {
  assert.equal(show("mid", { preset: "balanced" }, { git: repo, columns: 60 }), "◆ Opus 5.5 · ~/c/acme-api · ━━━━────── 42% 84k/200k");
});

test("a custom priority keeps a segment that would otherwise be dropped", () => {
  const lines = [["model", "dir", "git", "context", { id: "cost", priority: 99 }, "rate_5h"]];
  assert.equal(show("mid", { lines }, { git: repo, columns: 62 }), "◆ Opus 5.5 · ~/c/acme-api · ━━━━────── 42% 84k/200k · $1.23");
});

test("ascii icons switch bars and markers to ASCII", () => {
  assert.equal(show("mid", { icons: "ascii", lines: [["model", "git", "context"]] }, { git: repo }), "> Opus 5.5 · main*^2 · ####------ 42% 84k/200k");
});

test("separator presets and custom strings", () => {
  assert.equal(show("mid", { separator: "pipe", lines: [["model", "cost"]] }), "◆ Opus 5.5 │ $1.23");
  assert.equal(show("mid", { separator: " :: ", lines: [["model", "cost"]] }), "◆ Opus 5.5 :: $1.23");
});

test("prefix and suffix wrap a segment", () => {
  assert.equal(show("mid", { lines: [[{ id: "cost", prefix: "[", suffix: "]" }]] }), "[$1.23]");
});

test("cost against a budget shows the budget", () => {
  assert.equal(show("hot", { lines: [[{ id: "cost", options: { budget: 20 } }]] }), "$18.90/$20");
});

test("rate windows can drop the bar and the reset countdown", () => {
  assert.equal(show("mid", { lines: [[{ id: "rate_5h", options: { bar: false, reset: false } }]] }), "5h 31%");
});

test("time segment: 24h and 12h clocks", () => {
  assert.equal(show("mid", { lines: [[{ id: "time", options: { utc: true } }]] }), "00:00");
  assert.equal(show("mid", { lines: [[{ id: "time", options: { utc: true, hour12: true } }]] }), "12:00am");
});

test("command segment shows the first non-empty line and receives cwd and options", () => {
  let seen;
  const exec = (cmd, cwd, o) => ((seen = [cmd, cwd, o.timeoutMs]), "\nprod-cluster\nignored");
  assert.equal(show("mid", { lines: [[{ id: "command", options: { run: "kubectl config current-context" } }]] }, { exec }), "prod-cluster");
  assert.deepEqual(seen, ["kubectl config current-context", "/home/user/code/acme-api", 1000]);
});

test("a throwing provider hides only its own segment", () => {
  const boom = () => { throw new Error("boom"); };
  assert.equal(show("mid", { lines: [["model", "git", { id: "command", options: { run: "x" } }]] }, { git: boom, exec: boom }), "◆ Opus 5.5");
});

test("text, vim (short), agent, style, session, version, project segments", () => {
  const d = fixture("hot");
  d.session_name = "a very long session name that keeps going";
  d.workspace.repo = { host: "github.com", owner: "acme", name: "acme-api" };
  const out = plain(render(d, { lines: [[{ id: "text", options: { value: "λ" } }, { id: "vim", options: { short: true } }, "agent", "style", "session", "version", "project"]] }, env()));
  assert.equal(out, "λ · N · @ security-reviewer · Explanatory · a very long session nam… · v2.1.300 · acme/acme-api");
});

test("invalid config parts fall back to defaults instead of throwing", () => {
  assert.equal(show("mid", { theme: "nope", lines: "bad", thresholds: 5 }, { git: repo }), "◆ Opus 5.5 · ~/c/acme-api · main●↑2 · ━━━━────── 42% 84k/200k · $1.23 · 5h ━━──── 31% ↻ 2h14m");
});

test("lines segment omits a zero side", () => {
  assert.equal(show("api-billing", { lines: [["lines"]] }), "+3");
  const d = fixture("mid");
  d.cost.total_lines_added = 0;
  assert.equal(plain(render(d, { lines: [["lines"]] }, env())), "-23");
});
