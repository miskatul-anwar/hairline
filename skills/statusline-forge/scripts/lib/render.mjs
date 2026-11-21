// render(input, config, env) → the status line text (lines joined by "\n").
//
// env (all optional, injected so render stays pure and testable):
//   columns     terminal width; when set, lowest-priority segments are dropped to fit
//   colorDepth  "truecolor" | "256" | "16" | "none" (none always wins: NO_COLOR)
//   now         epoch ms for countdowns and the clock
//   home        home directory for path shortening
//   git(cwd)    → { branch, dirty, ahead, behind } | null
//   exec(cmd, cwd, { ttlMs, timeoutMs }) → stdout string | null

import { link, paint, parseHex } from "./ansi.mjs";
import { resolve } from "./config.mjs";
import { clampPct } from "./format.mjs";
import { SEGMENTS } from "./segments.mjs";
import { visibleWidth } from "./width.mjs";

function makeCtx(input, cfg, env, depth, entry) {
  const seg = SEGMENTS[entry.id];
  const style = (role) => cfg.theme[role] ?? null;
  const override = entry.color ? (parseHex(entry.color) ?? style(entry.color)) : null;
  const c = (role, text) => paint(typeof role === "string" ? style(role) : role, text, depth);
  const { warn, hot } = cfg.thresholds;
  return {
    d: input,
    o: entry.options,
    icons: cfg.icons,
    now: env.now ?? Date.now(),
    home: env.home ?? "",
    git: (cwd) => {
      try { return env.git?.(cwd) ?? null; } catch { return null; }
    },
    exec: (cmd, cwd, o) => {
      try { return env.exec?.(cmd, cwd, o) ?? null; } catch { return null; }
    },
    override,
    c,
    base: (text) => c(override ?? seg.role, text),
    level: (pct) => (pct >= hot ? "hot" : pct >= warn ? "warn" : "ok"),
    ic: (name) => (cfg.icons[name] ? cfg.icons[name] + " " : ""),
    bar(pct, width) {
      const p = clampPct(pct);
      const filled = Math.round((p / 100) * width);
      const lv = p >= hot ? "hot" : p >= warn ? "warn" : "ok";
      return c(lv, cfg.bar[0].repeat(filled)) + c("muted", cfg.bar[1].repeat(width - filled));
    },
    link: (url, text) => (cfg.hyperlinks && depth !== "none" && /^https?:\/\//.test(url) ? link(url, text) : text),
  };
}

function renderSegment(input, cfg, env, depth, entry) {
  try {
    const out = SEGMENTS[entry.id].render(makeCtx(input, cfg, env, depth, entry));
    if (!out) return null;
    return entry.prefix + out + entry.suffix;
  } catch {
    return null; // one broken segment must never blank the whole line
  }
}

// Drop the lowest-priority segment (rightmost on ties) until the line fits.
function fit(parts, sep, max) {
  const items = parts.map((p, i) => ({ ...p, i, w: visibleWidth(p.text) }));
  const sepW = visibleWidth(sep);
  const width = () => items.reduce((a, p) => a + p.w, 0) + sepW * Math.max(0, items.length - 1);
  while (items.length > 1 && width() > max) {
    let drop = 0;
    items.forEach((p, k) => {
      if (p.priority < items[drop].priority || (p.priority === items[drop].priority && p.i > items[drop].i)) drop = k;
    });
    items.splice(drop, 1);
  }
  return items;
}

export function render(input, config, env = {}) {
  const d = input && typeof input === "object" ? input : {};
  const cfg = resolve(config);
  const depth = env.colorDepth === "none" ? "none" : cfg.color === "auto" ? env.colorDepth ?? "truecolor" : cfg.color;
  const sep = paint(cfg.theme.muted, cfg.separator, depth);
  const max = Number.isInteger(env.columns) && env.columns > 0 ? env.columns - cfg.reserve : Infinity;

  return cfg.lines
    .map((line) => {
      const parts = line
        .map((entry) => ({ text: renderSegment(d, cfg, env, depth, entry), priority: entry.priority }))
        .filter((p) => p.text);
      return fit(parts, cfg.separator, max).map((p) => p.text).join(sep);
    })
    .filter(Boolean)
    .join("\n");
}
