#!/usr/bin/env node
// Render real forge.mjs output (with colours) into terminal-window HTML pages for listing
// screenshots: dist/screens/*.html. Paths are anonymised (home → ~, node → /usr/local/bin/node).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const FORGE = join(root, "skills/statusline-forge/scripts/forge.mjs");
const out = join(root, "dist/screens");
mkdirSync(out, { recursive: true });
const home = mkdtempSync(join(tmpdir(), "slf-shot-"));

function forge(...args) {
  let text;
  try {
    text = execFileSync(process.execPath, [FORGE, ...args], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: home, COLORTERM: "truecolor" },
    });
  } catch (err) {
    text = err.stdout;
  }
  return text.replaceAll(home, "~").replaceAll(process.execPath, "/usr/local/bin/node").replace(/\n$/, "");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// SGR subset used by the runtime: truecolor fg, bold, dim, reset. OSC 8 links are dropped.
function ansiToHtml(s) {
  s = s.replace(/\x1b\]8;;[^\x07]*\x07/g, "");
  let html = "", open = false;
  for (const part of s.split(/(\x1b\[[0-9;]*m)/)) {
    const m = /^\x1b\[([0-9;]*)m$/.exec(part);
    if (!m) { html += esc(part); continue; }
    if (open) { html += "</span>"; open = false; }
    const codes = m[1].split(";");
    if (codes[0] === "38" && codes[1] === "2") { html += `<span style="color:rgb(${codes[2]},${codes[3]},${codes[4]})">`; open = true; }
    else if (codes[0] === "1") { html += `<span style="font-weight:700">`; open = true; }
    else if (codes[0] === "2") { html += `<span style="opacity:.55">`; open = true; }
  }
  return html + (open ? "</span>" : "");
}

function page(name, title, blocks, { light = false } = {}) {
  const bg = light ? "#fbfaf7" : "#14151d";
  const fg = light ? "#2a2d3a" : "#cdd2e1";
  const body = blocks
    .map(([cmd, text]) => `<div class="cmd"><span class="ps">$</span> ${esc(cmd)}</div><pre>${ansiToHtml(text)}</pre>`)
    .join("");
  writeFileSync(
    join(out, `${name}.html`),
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{margin:0;padding:40px;background:linear-gradient(135deg,#2b2540,#1a2a33);font-family:"JetBrains Mono","DejaVu Sans Mono",Menlo,monospace}
.win{display:inline-block;min-width:900px;border-radius:12px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);background:${bg}}
.bar{height:38px;background:${light ? "#e9e6df" : "#1f2130"};display:flex;align-items:center;padding:0 16px;gap:8px;color:${light ? "#777" : "#8a8fa6"};font-size:13px}
.dot{width:12px;height:12px;border-radius:50%}.t{margin-left:12px}
.term{padding:22px 26px 26px;color:${fg};font-size:15px;line-height:1.6}
.cmd{color:${light ? "#555" : "#8a8fa6"};margin-top:6px}.ps{color:${light ? "#1e8246" : "#82c896"}}
pre{margin:4px 0 14px;font:inherit;white-space:pre}
</style></head><body><div class="win"><div class="bar"><span class="dot" style="background:#f07882"></span><span class="dot" style="background:#ebbe78"></span><span class="dot" style="background:#82c896"></span><span class="t">${esc(title)}</span></div><div class="term">${body}</div></div></body></html>`,
  );
}

page("1-preview-dashboard", "statusline-forge — preview", [["forge.mjs preview --preset dashboard", forge("preview", "--preset", "dashboard", "--color", "truecolor")]]);

page("2-narrow-terminal", "statusline-forge — narrow terminals", [
  ["forge.mjs preview --preset full --fixture hot", forge("preview", "--preset", "full", "--fixture", "hot", "--color", "truecolor")],
  ["forge.mjs preview --preset full --fixture hot --columns 80", forge("preview", "--preset", "full", "--fixture", "hot", "--columns", "80", "--color", "truecolor")],
]);

forge("install", "--preset", "balanced");
page("3-doctor", "statusline-forge — doctor", [["forge.mjs doctor", forge("doctor")]]);

const themes = ["dusk", "ember", "glacier", "vivid", "contrast", "mono"];
const cfg = join(home, "t.json");
const themed = (t) => {
  writeFileSync(cfg, JSON.stringify({ preset: "balanced", theme: t, thresholds: { warn: 30, hot: 40 } }));
  return forge("preview", "--config", cfg, "--fixture", "mid", "--color", "truecolor").replace(/^mid\s+/, `${t.padEnd(9)}`);
};
page("4-themes", "statusline-forge — themes", [["forge.mjs preview --fixture mid   # one row per theme", themes.map(themed).join("\n")]]);
page("5-theme-paper", "statusline-forge — paper theme (light terminals)", [["theme: paper", themed("paper")]], { light: true });

console.log(`wrote ${out}`);
