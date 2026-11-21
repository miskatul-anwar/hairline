import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../skills/statusline-forge/scripts/lib/render.mjs";
import { detectColorDepth } from "../skills/statusline-forge/scripts/lib/ansi.mjs";
import { env, fixture } from "./helpers.mjs";

const ctx = (config, over) => render(fixture("hot"), { lines: [["context"]], ...config }, env({ colorDepth: "truecolor", ...over }));

test("hot context percentage uses the theme's hot colour in truecolor", () => {
  assert.match(ctx({}), /\x1b\[38;2;240;120;130m91%/);
});

test("custom thresholds change the level colour", () => {
  const out = render(fixture("mid"), { lines: [["context"]], thresholds: { warn: 30, hot: 40 } }, env({ colorDepth: "truecolor" }));
  assert.match(out, /\x1b\[38;2;240;120;130m42%/);
});

test("256 and 16 colour terminals get downgraded codes", () => {
  const c256 = ctx({}, { colorDepth: "256" });
  assert.match(c256, /\x1b\[38;5;\d+m/);
  assert.doesNotMatch(c256, /38;2;/);
  const c16 = ctx({}, { colorDepth: "16" });
  assert.match(c16, /\x1b\[(3[0-7]|9[0-7])m/);
  assert.doesNotMatch(c16, /38;[25];/);
});

test("NO_COLOR (depth none) wins over a forced colour mode", () => {
  const out = ctx({ color: "truecolor" }, { colorDepth: "none" });
  assert.doesNotMatch(out, /\x1b/);
});

test("forced colour mode overrides the detected depth", () => {
  assert.match(ctx({ color: "256" }), /38;5;/);
});

test("mono theme uses attributes only", () => {
  const out = ctx({ theme: "mono" });
  assert.doesNotMatch(out, /38;[25];/);
  assert.match(out, /\x1b\[1m91%/);
});

test("per-segment hex colour and role overrides", () => {
  const out = render(fixture("mid"), { lines: [[{ id: "model", color: "#ff0000" }, { id: "cost", color: "hot" }]] }, env({ colorDepth: "truecolor" }));
  assert.match(out, /\x1b\[38;2;255;0;0m◆ Opus 5\.5/);
  assert.match(out, /\x1b\[38;2;240;120;130m\$1\.23/);
});

test("theme role colours can be overridden globally", () => {
  const out = render(fixture("mid"), { lines: [["model"]], colors: { accent: "#010203" } }, env({ colorDepth: "truecolor" }));
  assert.match(out, /\x1b\[38;2;1;2;3m◆/);
});

test("PR is an OSC 8 link unless hyperlinks are disabled", () => {
  const url = "https://github.com/acme/acme-api/pull/1234";
  const on = render(fixture("worktree-pr"), { lines: [["pr"]] }, env({ colorDepth: "truecolor" }));
  assert.ok(on.includes(`\x1b]8;;${url}\x07`));
  const off = render(fixture("worktree-pr"), { lines: [["pr"]], hyperlinks: false }, env({ colorDepth: "truecolor" }));
  assert.ok(!off.includes("\x1b]8"));
});

test("colour depth detection from the environment", () => {
  assert.equal(detectColorDepth({ NO_COLOR: "", COLORTERM: "truecolor" }), "none");
  assert.equal(detectColorDepth({ COLORTERM: "truecolor" }), "truecolor");
  assert.equal(detectColorDepth({ TERM: "xterm-256color" }), "256");
  assert.equal(detectColorDepth({ TERM: "xterm" }), "16");
  assert.equal(detectColorDepth({ TERM: "dumb" }), "none");
  assert.equal(detectColorDepth({ WT_SESSION: "1", TERM: "xterm" }), "truecolor");
});
