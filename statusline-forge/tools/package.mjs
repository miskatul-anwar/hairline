#!/usr/bin/env node
// Build dist/statusline-forge-<version>.zip: the portable skill folder buyers install.
// Excludes evals (seller-side) and anything git ignores.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const out = join(root, "dist", `statusline-forge-${version}.zip`);
mkdirSync(join(root, "dist"), { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-qr", out, "statusline-forge", "-x", "statusline-forge/evals/*", "*.tmp", "*/.DS_Store"], { cwd: join(root, "skills"), stdio: "inherit" });
console.log(`built ${out}`);
