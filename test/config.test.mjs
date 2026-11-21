import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "../skills/statusline-forge/scripts/lib/config.mjs";
import { PRESETS } from "../skills/statusline-forge/scripts/lib/presets.mjs";

test("every preset is valid", () => {
  for (const [name, p] of Object.entries(PRESETS)) assert.deepEqual(validate(p.config), { ok: true, errors: [] }, name);
});

test("a rich, correct config is valid", () => {
  const r = validate({
    version: 1, preset: "dashboard", theme: "glacier", icons: "nerd", bar: "block", color: "auto", separator: "pipe",
    hyperlinks: false, reserve: 4, thresholds: { warn: 50, hot: 75 }, colors: { accent: "#aabbcc" }, cache: { gitTtlMs: 2000 },
    lines: [["model", { id: "cost", options: { budget: 5 }, color: "warn", prefix: "[", suffix: "]", priority: 95 }]],
  });
  assert.deepEqual(r, { ok: true, errors: [] });
});

test("typos get a suggestion", () => {
  assert.deepEqual(validate({ lines: [["contxt"]] }).errors, ['lines[0][0]: unknown segment "contxt". Did you mean "context"?']);
  assert.deepEqual(validate({ thme: "dusk" }).errors, ['thme: unknown key. Did you mean "theme"?']);
});

test("every problem is reported with its path in one pass", () => {
  const { ok, errors } = validate({
    theme: "neon", icons: "emoji", color: "full", thresholds: { warn: 90, hot: 70 }, colors: { accent: "red", glow: "#ffffff" },
    lines: [[{ id: "context", options: { width: 100, colour: true } }, { id: "command" }, { id: "model", color: "pink" }]],
  });
  assert.equal(ok, false);
  assert.deepEqual(errors, [
    "theme: unknown theme \"neon\" (available: dusk, ember, glacier, vivid, paper, contrast, mono)",
    "icons: unknown icons \"emoji\" (available: unicode, nerd, ascii)",
    "color: must be one of auto, truecolor, 256, 16, none",
    "thresholds: warn (90) must not exceed hot (70)",
    "colors.accent: must be #rrggbb",
    "colors.glow: unknown role (allowed: accent, text, muted, ok, warn, hot, info, branch, dirty)",
    "lines[0][0].options.width: must be ≤ 40",
    "lines[0][0].options.colour: unknown option for \"context\" (allowed: bar, width, tokens, warn200k, label)",
    "lines[0][1].options.run: required for \"command\"",
    "lines[0][2].color: must be a theme role (accent, text, muted, ok, warn, hot, info, branch, dirty) or #rrggbb",
  ]);
});

test("structural errors", () => {
  assert.deepEqual(validate([]).errors, ["config: must be a JSON object"]);
  assert.deepEqual(validate({ lines: [] }).errors, ["lines: must be a non-empty array of lines"]);
  assert.deepEqual(validate({ lines: ["model"] }).errors, ["lines[0]: must be an array of segments"]);
  assert.deepEqual(validate({ version: 2 }).errors, ["version: must be 1"]);
  assert.deepEqual(validate({ lines: [[{ id: "model", priority: 101 }]] }).errors, ["lines[0][0].priority: must be a whole number 0–100"]);
  assert.deepEqual(validate({ lines: [[{ id: "model", options: { id: "yes" } }]] }).errors, ["lines[0][0].options.id: must be true or false"]);
});
