import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SCRIPTS = fileURLToPath(new URL("../skills/statusline-forge/scripts/", import.meta.url));
export const fixture = (name) => JSON.parse(readFileSync(`${SCRIPTS}fixtures/${name}.json`, "utf8"));

// Strip SGR colour codes and OSC 8 hyperlinks, leaving visible text.
export const plain = (s) => s.replace(/\x1b\]8;;[^\x07]*\x07/g, "").replace(/\x1b\[[0-9;]*m/g, "");

// Deterministic env: 2026-01-01T00:00:00Z, no colour, wide terminal, no git.
export const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
export const env = (over = {}) => ({
  columns: 200,
  colorDepth: "none",
  now: NOW,
  home: "/home/user",
  git: () => null,
  exec: () => null,
  ...over,
});
