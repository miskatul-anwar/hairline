// Small, pure formatters shared by segments.

export const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const clampPct = (p) => Math.min(Math.max(p, 0), 100);

export function fmtTokens(n) {
  if (n >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return `${n}`;
}

// 45s, 12m, 4h24m, 3d4h
export function fmtDuration(ms) {
  if (!isNum(ms) || ms < 0) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${String(m % 60).padStart(2, "0")}m`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24}h`;
}

// Epoch seconds, epoch ms, or ISO string → ms since epoch, or NaN.
export function toMs(t) {
  if (isNum(t)) return t < 1e12 ? t * 1000 : t;
  if (typeof t === "string") return Date.parse(t);
  return NaN;
}

export function timeUntil(t, now) {
  const ms = toMs(t) - now;
  return isNum(ms) && ms > 0 ? fmtDuration(ms) : "";
}

export function fmtUsd(v, decimals = 2) {
  if (!isNum(v)) return "";
  if (v > 0 && v < 10 ** -decimals) return `<$${(10 ** -decimals).toFixed(decimals)}`;
  return `$${v.toFixed(decimals)}`;
}

// Fish-style path shortening; understands both / and \ separators.
export function shortPath(dir, { home = "", style = "fish", projectDir = "" } = {}) {
  if (!dir) return "";
  const win = /\\/.test(dir) && !dir.includes("/");
  const sep = win ? "\\" : "/";
  const norm = (p) => (p || "").replace(/[\\/]+$/, "");
  const d = norm(dir);
  if (style === "basename") return d.split(/[\\/]/).pop() || d;
  if (style === "project" && projectDir) {
    const pd = norm(projectDir);
    if (d === pd) return pd.split(/[\\/]/).pop();
    if (d.startsWith(pd + sep)) return pd.split(/[\\/]/).pop() + sep + d.slice(pd.length + 1);
  }
  const h = norm(home);
  let p = d;
  if (h && (d === h || d.startsWith(h + sep))) p = "~" + d.slice(h.length);
  if (style === "full") return p;
  const parts = p.split(sep);
  return parts
    .map((seg, i) => {
      if (i === parts.length - 1 || seg === "~" || seg === "" || /^[A-Za-z]:$/.test(seg)) return seg;
      return seg[0] === "." ? seg.slice(0, 2) : [...seg][0];
    })
    .join(sep);
}
