// Colour output with automatic depth downgrade: truecolor → 256 → 16 → none.
// A style is either an [r, g, b] triple, an attribute keyword ("dim", "bold"), or null.

const ATTRS = { bold: "1", dim: "2", italic: "3", underline: "4" };

export const RESET = "\x1b[0m";

// xterm 256-colour approximation: 6×6×6 cube or 24-step grey ramp, whichever is closer.
function to256([r, g, b]) {
  const cube = (v) => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.floor((v - 35) / 40)));
  const levels = [0, 95, 135, 175, 215, 255];
  const [cr, cg, cb] = [cube(r), cube(g), cube(b)];
  const cubeDist = (levels[cr] - r) ** 2 + (levels[cg] - g) ** 2 + (levels[cb] - b) ** 2;
  const avg = (r + g + b) / 3;
  const grey = avg > 238 ? 23 : Math.max(0, Math.round((avg - 8) / 10));
  const gv = 8 + grey * 10;
  const greyDist = (gv - r) ** 2 + (gv - g) ** 2 + (gv - b) ** 2;
  return greyDist < cubeDist ? 232 + grey : 16 + 36 * cr + 6 * cg + cb;
}

const BASIC16 = [
  [0, 0, 0], [205, 49, 49], [13, 188, 121], [229, 229, 16], [36, 114, 200], [188, 63, 188], [17, 168, 205], [229, 229, 229],
  [102, 102, 102], [241, 76, 76], [35, 209, 139], [245, 245, 67], [59, 142, 234], [214, 112, 214], [41, 184, 219], [255, 255, 255],
];

function to16(rgb) {
  let best = 0, bestDist = Infinity;
  BASIC16.forEach((c, i) => {
    const dist = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (dist < bestDist) [best, bestDist] = [i, dist];
  });
  return best < 8 ? 30 + best : 90 + best - 8;
}

export function sgr(style, depth) {
  if (depth === "none" || style == null) return "";
  if (typeof style === "string") return ATTRS[style] ? `\x1b[${ATTRS[style]}m` : "";
  if (depth === "256") return `\x1b[38;5;${to256(style)}m`;
  if (depth === "16") return `\x1b[${to16(style)}m`;
  return `\x1b[38;2;${style[0]};${style[1]};${style[2]}m`;
}

export function paint(style, text, depth) {
  if (!text) return "";
  const open = sgr(style, depth);
  return open ? open + text + RESET : text;
}

// OSC 8 hyperlink. Terminals without support show the text only.
export const link = (url, text) => `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;

// Remove every OSC (BEL- or ST-terminated) and CSI sequence, leaving visible text.
export const stripAnsi = (s) =>
  s.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");

// Drop C0/C1 control characters from untrusted text (session data, git, command output)
// so it can never smuggle escape sequences into the terminal.
export const clean = (s) => s.replace(/[\x00-\x1f\x7f-\x9f]/g, "");

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Pick a depth from the environment Claude Code gives the script.
export function detectColorDepth(e = process.env) {
  if (e.NO_COLOR) return "none"; // no-color.org: only a non-empty value counts
  if (e.FORCE_COLOR === "0") return "none";
  const ct = (e.COLORTERM ?? "").toLowerCase();
  if (ct === "truecolor" || ct === "24bit") return "truecolor";
  const term = (e.TERM ?? "").toLowerCase();
  if (term === "dumb") return "none";
  if (e.WT_SESSION || e.TERM_PROGRAM === "iTerm.app" || e.TERM_PROGRAM === "WezTerm" || e.TERM_PROGRAM === "vscode") return "truecolor";
  if (term.includes("256")) return "256";
  // Claude Code runs inside a modern terminal in practice; truecolor is the right default.
  return term ? "16" : "truecolor";
}
