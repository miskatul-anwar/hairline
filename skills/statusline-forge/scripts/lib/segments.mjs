// Segment registry. Each segment reads the stdin payload (`ctx.d`) and returns a painted
// string, or null to hide itself. Segments never throw on missing data: they hide.
//
// ctx helpers:
//   ctx.base(text)        paint in the segment's base role (user-overridable via `color`)
//   ctx.c(role, text)     paint in a theme role
//   ctx.level(pct)        "ok" | "warn" | "hot" by the configured thresholds
//   ctx.bar(pct, width)   painted progress bar
//   ctx.ic(name)          icon + space, or "" when the icon set has none
//   ctx.link(url, text)   OSC 8 link when hyperlinks are enabled

import { clampPct, fmtDuration, fmtTokens, fmtUsd, isNum, shortPath, timeUntil } from "./format.mjs";

const opt = (type, def, summary, extra = {}) => ({ type, default: def, summary, ...extra });

function pctSegment(ctx, win, label) {
  if (!isNum(win?.used_percentage)) return null;
  const { o } = ctx;
  const pct = Math.round(win.used_percentage);
  const lv = ctx.level(pct);
  const parts = [];
  if (o.label) parts.push(ctx.c("muted", o.label));
  if (o.bar) parts.push(ctx.bar(pct, o.width));
  parts.push(ctx.c(lv, `${pct}%`));
  let s = ctx.ic(label) + parts.join(" ");
  if (o.reset) {
    const left = timeUntil(win.resets_at, ctx.now);
    if (left) s += ctx.c("muted", ` ${ctx.icons.reset}${ctx.icons.reset ? " " : "reset "}${left}`);
  }
  return s;
}

const rateOptions = (label, width) => ({
  label: opt("string", label, "Text label before the bar (empty to hide)"),
  bar: opt("boolean", true, "Show a progress bar"),
  width: opt("integer", width, "Bar width in cells", { min: 2, max: 40 }),
  reset: opt("boolean", true, "Show time until the window resets"),
});

export const SEGMENTS = {
  model: {
    summary: "Model display name (e.g. ◆ Opus 5.5)",
    priority: 90,
    options: { id: opt("boolean", false, "Show the model id instead of the display name") },
    render(ctx) {
      const m = ctx.d.model;
      const name = ctx.o.id ? m?.id : m?.display_name || m?.id;
      return name ? ctx.base(ctx.ic("model") + name) : null;
    },
    role: "accent",
  },

  effort: {
    summary: "Reasoning effort level (low…max); hidden when the model has none",
    priority: 45,
    options: { label: opt("string", "effort", "Label before the level (empty to hide)") },
    render(ctx) {
      const lvl = ctx.d.effort?.level;
      if (!lvl) return null;
      const roleFor = { low: "muted", medium: "text", high: "info", xhigh: "warn", max: "hot" };
      const label = ctx.o.label ? ctx.c("muted", ctx.o.label + " ") : "";
      return ctx.ic("effort") + label + ctx.c(roleFor[lvl] ?? "text", lvl);
    },
    role: "info",
  },

  thinking: {
    summary: "Shows when extended thinking is on",
    priority: 20,
    options: { text: opt("string", "think", "Text to show when thinking is enabled") },
    render: (ctx) => (ctx.d.thinking?.enabled ? ctx.base(ctx.ic("thinking") + ctx.o.text) : null),
    role: "info",
  },

  fast: {
    summary: "Shows when fast mode is on",
    priority: 25,
    options: { text: opt("string", "fast", "Text to show when fast mode is enabled") },
    render: (ctx) => (ctx.d.fast_mode === true ? ctx.base(ctx.ic("fast") + ctx.o.text) : null),
    role: "warn",
  },

  dir: {
    summary: "Current directory",
    priority: 80,
    options: {
      style: opt("enum", "fish", "fish (~/c/project) | full | basename | project (relative to launch dir)", {
        values: ["fish", "full", "basename", "project"],
      }),
    },
    render(ctx) {
      const cwd = ctx.d.workspace?.current_dir || ctx.d.cwd;
      if (!cwd) return null;
      const p = shortPath(cwd, { home: ctx.home, style: ctx.o.style, projectDir: ctx.d.workspace?.project_dir });
      return ctx.base(ctx.ic("dir") + p);
    },
    role: "text",
  },

  project: {
    summary: "Repository owner/name from the origin remote, linked",
    priority: 30,
    options: { owner: opt("boolean", true, "Include the owner (acme/api vs api)") },
    render(ctx) {
      const r = ctx.d.workspace?.repo;
      if (!r?.name) return null;
      const text = ctx.o.owner && r.owner ? `${r.owner}/${r.name}` : r.name;
      const url = r.host && r.owner ? `https://${r.host}/${r.owner}/${r.name}` : null;
      const painted = ctx.base(ctx.ic("project") + text);
      return url ? ctx.link(url, painted) : painted;
    },
    role: "text",
  },

  git: {
    summary: "Branch, dirty marker and ahead/behind counts (cached, time-boxed)",
    priority: 75,
    options: {
      dirty: opt("boolean", true, "Show a marker when there are uncommitted changes"),
      aheadBehind: opt("boolean", true, "Show commits ahead/behind upstream"),
    },
    render(ctx) {
      const cwd = ctx.d.workspace?.current_dir || ctx.d.cwd;
      const g = cwd ? ctx.git(cwd) : null;
      if (!g?.branch) return null;
      let s = ctx.base(ctx.ic("git") + g.branch);
      if (ctx.o.dirty && g.dirty) s += ctx.c("dirty", ctx.icons.dirty);
      if (ctx.o.aheadBehind) {
        if (g.ahead > 0) s += ctx.c("muted", ctx.icons.ahead + g.ahead);
        if (g.behind > 0) s += ctx.c("muted", ctx.icons.behind + g.behind);
      }
      return s;
    },
    role: "branch",
  },

  worktree: {
    summary: "Worktree name when working in a git or Claude worktree",
    priority: 50,
    options: {},
    render(ctx) {
      const name = ctx.d.worktree?.name || ctx.d.workspace?.git_worktree;
      return name ? ctx.base(ctx.ic("worktree") + name) : null;
    },
    role: "info",
  },

  pr: {
    summary: "Open PR/MR number coloured by review state, linked",
    priority: 55,
    options: { state: opt("boolean", true, "Append the review state (approved, changes, …)") },
    render(ctx) {
      const pr = ctx.d.pr;
      if (!isNum(pr?.number)) return null;
      const states = {
        approved: ["ok", "approved"], pending: ["warn", "review"], changes_requested: ["hot", "changes"], draft: ["muted", "draft"],
      };
      const [role, word] = states[pr.review_state] ?? ["info", ""];
      const num = (pr.kind === "mr" ? "!" : "#") + pr.number;
      let s = ctx.ic("pr") + ctx.c(role, num);
      if (ctx.o.state && word) s += ctx.c("muted", " " + word);
      return pr.url ? ctx.link(pr.url, s) : s;
    },
    role: "info",
  },

  context: {
    summary: "Context window usage: bar, percent, tokens, and a warning past 200k",
    priority: 85,
    options: {
      bar: opt("boolean", true, "Show a progress bar"),
      width: opt("integer", 10, "Bar width in cells", { min: 2, max: 40 }),
      tokens: opt("boolean", true, "Show used/total tokens"),
      warn200k: opt("boolean", true, "Flag when the last response exceeded 200k tokens"),
      label: opt("string", "", "Text label before the bar"),
    },
    render(ctx) {
      const cw = ctx.d.context_window;
      if (!cw) return null;
      const u = cw.current_usage;
      const used = u ? (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) : 0;
      let pct = isNum(cw.used_percentage) ? cw.used_percentage : null;
      if (pct == null && used > 0 && isNum(cw.context_window_size) && cw.context_window_size > 0) {
        pct = (used / cw.context_window_size) * 100;
      }
      if (pct == null) return null;
      pct = Math.round(clampPct(pct));
      const { o } = ctx;
      const lv = ctx.level(pct);
      const parts = [];
      if (o.label) parts.push(ctx.c("muted", o.label));
      if (o.bar) parts.push(ctx.bar(pct, o.width));
      parts.push(ctx.c(lv, `${pct}%`));
      if (o.tokens) {
        const n = used || (isNum(cw.context_window_size) ? Math.round((pct / 100) * cw.context_window_size) : 0);
        if (n) parts.push(ctx.c("muted", fmtTokens(n) + (isNum(cw.context_window_size) ? `/${fmtTokens(cw.context_window_size)}` : "")));
      }
      if (o.warn200k && ctx.d.exceeds_200k_tokens === true) parts.push(ctx.c("hot", `${ctx.icons.exceeds}200k`));
      return ctx.ic("context") + parts.join(" ");
    },
    role: "text",
  },

  cost: {
    summary: "Session cost in USD; optional budget turns it amber/red",
    priority: 60,
    options: {
      decimals: opt("integer", 2, "Decimal places", { min: 0, max: 4 }),
      hideZero: opt("boolean", true, "Hide until something has been spent"),
      budget: opt("number", 0, "Per-session budget in USD (0 = no budget colouring)", { min: 0 }),
    },
    render(ctx) {
      const v = ctx.d.cost?.total_cost_usd;
      if (!isNum(v) || (ctx.o.hideZero && v <= 0)) return null;
      const text = ctx.ic("cost") + fmtUsd(v, ctx.o.decimals);
      if (ctx.o.budget > 0) {
        const pct = Math.round((v / ctx.o.budget) * 100);
        return ctx.c(ctx.level(pct), text) + ctx.c("muted", `/${fmtUsd(ctx.o.budget, 0)}`);
      }
      return ctx.base(text);
    },
    role: "muted",
  },

  duration: {
    summary: "Session wall-clock time (optionally API time)",
    priority: 30,
    options: { api: opt("boolean", false, "Append time spent waiting on the API") },
    render(ctx) {
      const c = ctx.d.cost;
      const t = fmtDuration(c?.total_duration_ms);
      if (!t || c.total_duration_ms < 1000) return null;
      let s = ctx.base(ctx.ic("duration") + t);
      if (ctx.o.api && isNum(c.total_api_duration_ms)) s += ctx.c("muted", ` (api ${fmtDuration(c.total_api_duration_ms)})`);
      return s;
    },
    role: "muted",
  },

  lines: {
    summary: "Lines added/removed this session",
    priority: 35,
    options: {},
    render(ctx) {
      const a = ctx.d.cost?.total_lines_added ?? 0, r = ctx.d.cost?.total_lines_removed ?? 0;
      if (!(a > 0 || r > 0)) return null;
      const parts = [a > 0 && ctx.c("ok", `+${a}`), r > 0 && ctx.c("hot", `-${r}`)].filter(Boolean);
      return ctx.ic("lines") + parts.join(" ");
    },
    role: "muted",
  },

  rate_5h: {
    summary: "5-hour usage window with reset countdown (Pro/Max/Ultra)",
    priority: 70,
    options: rateOptions("5h", 6),
    render: (ctx) => pctSegment(ctx, ctx.d.rate_limits?.five_hour, "rate_5h"),
    role: "muted",
  },

  rate_7d: {
    summary: "7-day usage window with reset countdown (Pro/Max/Ultra)",
    priority: 50,
    options: rateOptions("7d", 6),
    render: (ctx) => pctSegment(ctx, ctx.d.rate_limits?.seven_day, "rate_7d"),
    role: "muted",
  },

  spend: {
    summary: "Gateway spend limit: dollars used of the limit, or percent",
    priority: 65,
    options: { bar: opt("boolean", false, "Show a progress bar"), width: opt("integer", 6, "Bar width", { min: 2, max: 40 }) },
    render(ctx) {
      const s = ctx.d.rate_limits?.spend_limit;
      if (!isNum(s?.used_percentage)) return null;
      const pct = Math.round(s.used_percentage);
      const lv = ctx.level(pct);
      const parts = [];
      if (ctx.o.bar) parts.push(ctx.bar(pct, ctx.o.width));
      if (isNum(s.used_usd) && isNum(s.limit_usd)) {
        parts.push(ctx.c(lv, fmtUsd(s.used_usd, 0)) + ctx.c("muted", `/${fmtUsd(s.limit_usd, 0)}`));
      } else {
        parts.push(ctx.c(lv, `${pct}%`));
      }
      if (s.period) parts.push(ctx.c("muted", s.period));
      return ctx.ic("spend") + ctx.c("muted", "spend ") + parts.join(" ");
    },
    role: "muted",
  },

  cache: {
    summary: "Prompt cache: warm with time-to-expiry, or cold",
    priority: 40,
    options: { hitRatio: opt("boolean", false, "Show cache hit ratio") },
    render(ctx) {
      const pc = ctx.d.prompt_cache;
      if (!pc || pc.caching_observed === false) return null;
      const label = ctx.c("muted", ctx.icons.cache ? ctx.ic("cache") : "cache ");
      let s;
      if (pc.warm) {
        const left = timeUntil(pc.expires_at, ctx.now);
        s = label + ctx.c("ok", "warm") + (left ? ctx.c("muted", ` ${left}`) : "");
      } else {
        s = label + ctx.c("warn", "cold");
      }
      if (ctx.o.hitRatio && isNum(pc.hit_ratio)) s += ctx.c("muted", ` ${Math.round(pc.hit_ratio * 100)}% hit`);
      return s;
    },
    role: "muted",
  },

  vim: {
    summary: "Vim mode (NORMAL/INSERT/VISUAL) when vim mode is on",
    priority: 50,
    options: { short: opt("boolean", false, "Single letter: N / I / V") },
    render(ctx) {
      const m = ctx.d.vim?.mode;
      if (!m) return null;
      const role = m === "INSERT" ? "ok" : m.startsWith("VISUAL") ? "warn" : "accent";
      const text = ctx.o.short ? (m === "VISUAL LINE" ? "VL" : m[0]) : m;
      return ctx.ic("vim") + ctx.c(role, text);
    },
    role: "accent",
  },

  agent: {
    summary: "Active agent name (--agent)",
    priority: 45,
    options: {},
    render: (ctx) => (ctx.d.agent?.name ? ctx.base(ctx.ic("agent") + ctx.d.agent.name) : null),
    role: "info",
  },

  style: {
    summary: "Output style name, hidden when default",
    priority: 15,
    options: { showDefault: opt("boolean", false, "Show even when the style is 'default'") },
    render(ctx) {
      const n = ctx.d.output_style?.name;
      if (!n || (n === "default" && !ctx.o.showDefault)) return null;
      return ctx.base(ctx.ic("style") + n);
    },
    role: "muted",
  },

  session: {
    summary: "Session name (from --name, /rename, or the generated title)",
    priority: 25,
    options: { max: opt("integer", 24, "Truncate after this many characters", { min: 4, max: 200 }) },
    render(ctx) {
      const n = ctx.d.session_name;
      if (!n) return null;
      const chars = [...n];
      const t = chars.length > ctx.o.max ? chars.slice(0, ctx.o.max - 1).join("") + "…" : n;
      return ctx.base(ctx.ic("session") + t);
    },
    role: "muted",
  },

  version: {
    summary: "Claude Code version",
    priority: 10,
    options: {},
    render: (ctx) => (ctx.d.version ? ctx.base(ctx.ic("version") + "v" + ctx.d.version) : null),
    role: "muted",
  },

  time: {
    summary: "Wall clock",
    priority: 20,
    options: {
      hour12: opt("boolean", false, "12-hour clock"),
      utc: opt("boolean", false, "Show UTC instead of local time"),
    },
    render(ctx) {
      const dt = new Date(ctx.now);
      let h = ctx.o.utc ? dt.getUTCHours() : dt.getHours();
      const m = String(ctx.o.utc ? dt.getUTCMinutes() : dt.getMinutes()).padStart(2, "0");
      let suffix = "";
      if (ctx.o.hour12) {
        suffix = h >= 12 ? "pm" : "am";
        h = h % 12 || 12;
      }
      return ctx.base(ctx.ic("time") + `${ctx.o.hour12 ? h : String(h).padStart(2, "0")}:${m}${suffix}`);
    },
    role: "muted",
  },

  text: {
    summary: "Static text or emoji",
    priority: 50,
    options: { value: opt("string", "", "The text to show", { required: true }) },
    render: (ctx) => (ctx.o.value ? ctx.base(ctx.o.value) : null),
    role: "text",
  },

  command: {
    summary: "Output of your own shell command (first line; cached and time-boxed)",
    priority: 40,
    options: {
      run: opt("string", "", "Shell command to run in the current directory", { required: true }),
      ttlMs: opt("integer", 30000, "Cache the result for this long", { min: 0, max: 86400000 }),
      timeoutMs: opt("integer", 1000, "Kill the command after this long", { min: 50, max: 10000 }),
    },
    render(ctx) {
      if (!ctx.o.run) return null;
      const out = ctx.exec(ctx.o.run, ctx.d.workspace?.current_dir || ctx.d.cwd, ctx.o);
      const line = (out ?? "").split(/\r?\n/).find((l) => l.trim())?.trim();
      return line ? ctx.base(line) : null;
    },
    role: "text",
  },
};
