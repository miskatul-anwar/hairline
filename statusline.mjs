#!/usr/bin/env node
// Minimal Claude Code status line.
// Reads the status JSON on stdin, prints one line:
//   ◆ Opus 5.5 · ~/c/project  main● · ━━━━────── 42% 84k/200k · $1.23 · session ━━──── 31% ↻ 2h14m

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const NO_COLOR = "NO_COLOR" in process.env;

// Muted palette (truecolor). Tweak here.
const C = {
  accent: [180, 167, 255], // model
  text: [205, 210, 225], // directory
  branch: [125, 200, 190], // git branch
  dirty: [235, 190, 120], // uncommitted changes
  dim: [95, 100, 120], // separators, secondary info
  ok: [130, 200, 150],
  warn: [235, 190, 120],
  hot: [240, 120, 130],
};

const paint = (rgb, s) =>
  NO_COLOR ? s : `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${s}\x1b[0m`;

const SEP = paint(C.dim, " · ");

const levelColor = (pct) => (pct >= 80 ? C.hot : pct >= 60 ? C.warn : C.ok);

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function shortPath(dir) {
  if (!dir) return "";
  const home = homedir();
  let p = dir === home ? "~" : dir.startsWith(home + "/") ? "~" + dir.slice(home.length) : dir;
  const parts = p.split("/");
  // fish-style: abbreviate every segment except the last
  return parts
    .map((seg, i) => (i === parts.length - 1 || seg === "~" || seg === "" ? seg : seg[0] === "." ? seg.slice(0, 2) : seg[0]))
    .join("/");
}

function git(cwd) {
  const run = (...args) =>
    execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 500,
    }).trim();
  try {
    const branch = run("symbolic-ref", "--short", "-q", "HEAD") || run("rev-parse", "--short", "HEAD");
    const dirty = run("status", "--porcelain", "--untracked-files=no").length > 0;
    return { branch, dirty };
  } catch {
    return null;
  }
}

function bar(pct, width = 10) {
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * width);
  return paint(levelColor(pct), "━".repeat(filled)) + paint(C.dim, "─".repeat(width - filled));
}

// Tokens currently in context: prefer the exact usage, else derive from the percentage.
function contextTokens(cw) {
  const u = cw.current_usage;
  if (u) {
    const n = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    if (n > 0) return n;
  }
  if (cw.context_window_size) return Math.round((cw.used_percentage / 100) * cw.context_window_size);
  return 0;
}

const fmtTokens = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`);

// resets_at may be epoch seconds, epoch ms, or an ISO string.
function timeLeft(resetsAt) {
  if (resetsAt == null) return "";
  const t = typeof resetsAt === "number" ? (resetsAt < 1e12 ? resetsAt * 1000 : resetsAt) : Date.parse(resetsAt);
  const mins = Math.round((t - Date.now()) / 60000);
  if (!Number.isFinite(mins) || mins <= 0) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
}

function main() {
  const d = readStdin();
  const out = [];

  const model = d.model?.display_name;
  if (model) out.push(paint(C.accent, "◆ " + model));

  const cwd = d.workspace?.current_dir || d.cwd;
  if (cwd) {
    let seg = paint(C.text, shortPath(cwd));
    const g = git(cwd);
    if (g?.branch) seg += "  " + paint(C.branch, g.branch) + (g.dirty ? paint(C.dirty, "●") : "");
    out.push(seg);
  }

  const cw = d.context_window ?? {};
  if (typeof cw.used_percentage === "number") {
    const pct = Math.round(cw.used_percentage);
    let seg = bar(pct) + " " + paint(levelColor(pct), `${pct}%`);
    const tokens = contextTokens(cw);
    if (tokens) seg += paint(C.dim, ` ${fmtTokens(tokens)}` + (cw.context_window_size ? `/${fmtTokens(cw.context_window_size)}` : ""));
    out.push(seg);
  }

  const cost = d.cost?.total_cost_usd;
  if (typeof cost === "number" && cost > 0) out.push(paint(C.dim, `$${cost.toFixed(2)}`));

  const session = d.rate_limits?.five_hour;
  if (typeof session?.used_percentage === "number") {
    const pct = Math.round(session.used_percentage);
    let seg = paint(C.dim, "session ") + bar(pct, 6) + " " + paint(levelColor(pct), `${pct}%`);
    const left = timeLeft(session.resets_at);
    if (left) seg += paint(C.dim, ` ↻ ${left}`);
    out.push(seg);
  }

  process.stdout.write(out.join(SEP));
}

main();
