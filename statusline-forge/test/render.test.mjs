import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../skills/statusline-forge/scripts/lib/render.mjs";
import { env, fixture, plain } from "./helpers.mjs";

test("renders a single segment", () => {
  const out = render(fixture("mid"), { lines: [["model"]] }, env());
  assert.equal(plain(out), "◆ Opus 5.5");
});

test("joins segments with the default separator", () => {
  const out = render(fixture("mid"), { lines: [["model", "cost"]] }, env());
  assert.equal(plain(out), "◆ Opus 5.5 · $1.23");
});

test("segments without data disappear without leaving separators", () => {
  const out = render(fixture("api-billing"), { lines: [["model", "rate_5h", "cost"]] }, env());
  assert.equal(plain(out), "◆ Haiku 5.5 · $0.04");
});

test("an empty payload renders an empty string, never throws", () => {
  assert.equal(render({}, { lines: [["model", "cost", "context", "git"]] }, env()), "");
});

test("multiple lines are joined with newlines and empty lines are dropped", () => {
  const out = render(fixture("api-billing"), { lines: [["model"], ["rate_5h"], ["cost"]] }, env());
  assert.equal(plain(out), "◆ Haiku 5.5\n$0.04");
});

test("colorDepth none emits no escape codes", () => {
  const out = render(fixture("hot"), { lines: [["model", "context", "cost"]] }, env());
  assert.equal(out, plain(out));
});
