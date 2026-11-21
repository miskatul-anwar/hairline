// Config validation and resolution. validate() reports every problem with a JSON path
// so an agent can fix them in one pass; resolve() never throws and always returns a
// renderable config (invalid parts fall back to defaults).

import { parseHex } from "./ansi.mjs";
import { BAR_STYLES, ICON_SETS } from "./icons.mjs";
import { PRESETS } from "./presets.mjs";
import { SEGMENTS } from "./segments.mjs";
import { ROLES, THEMES } from "./themes.mjs";

export const SCHEMA_VERSION = 1;
export const SEPARATORS = { dot: " · ", pipe: " │ ", slash: " / ", space: "  ", arrow: " › " };
const COLOR_MODES = ["auto", "truecolor", "256", "16", "none"];

export const DEFAULTS = {
  version: SCHEMA_VERSION,
  theme: "dusk",
  icons: "unicode",
  color: "auto",
  separator: "dot",
  hyperlinks: true,
  reserve: 2,
  thresholds: { warn: 60, hot: 80 },
  colors: {},
  cache: { gitTtlMs: 5000 },
  lines: PRESETS.balanced.config.lines,
};

const TOP_KEYS = new Set(["$schema", "version", "preset", "theme", "icons", "bar", "color", "separator", "hyperlinks", "reserve", "thresholds", "colors", "cache", "lines"]);
const ENTRY_KEYS = new Set(["id", "options", "color", "prefix", "suffix", "priority"]);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const list = (o) => Object.keys(o).join(", ");

// Suggest the closest known name for typos ("contxt" → "context").
function suggest(name, names) {
  const dist = (a, b) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  const best = names.map((n) => [n, dist(String(name), n)]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= 2 ? ` Did you mean "${best[0]}"?` : "";
}

function validColor(v) {
  return ROLES.includes(v) || parseHex(v) !== null;
}

function checkOption(path, spec, value, errors) {
  const t = spec.type;
  const bad = (msg) => errors.push(`${path}: ${msg}`);
  if (t === "boolean" && typeof value !== "boolean") return bad(`must be true or false`);
  if (t === "string" && typeof value !== "string") return bad(`must be a string`);
  if (t === "enum" && !spec.values.includes(value)) return bad(`must be one of ${spec.values.join(", ")}`);
  if (t === "integer" || t === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return bad(`must be a number`);
    if (t === "integer" && !Number.isInteger(value)) return bad(`must be a whole number`);
    if (spec.min !== undefined && value < spec.min) return bad(`must be ≥ ${spec.min}`);
    if (spec.max !== undefined && value > spec.max) return bad(`must be ≤ ${spec.max}`);
  }
}

function checkEntry(path, entry, errors) {
  if (typeof entry === "string") entry = { id: entry };
  if (!isObj(entry)) return errors.push(`${path}: must be a segment id string or an object with "id"`);
  for (const k of Object.keys(entry)) if (!ENTRY_KEYS.has(k)) errors.push(`${path}.${k}: unknown key (allowed: ${[...ENTRY_KEYS].join(", ")})`);
  const seg = SEGMENTS[entry.id];
  if (!seg) return errors.push(`${path}: unknown segment "${entry.id}".${suggest(entry.id, Object.keys(SEGMENTS))}`);
  if (entry.options !== undefined) {
    if (!isObj(entry.options)) errors.push(`${path}.options: must be an object`);
    else
      for (const [k, v] of Object.entries(entry.options)) {
        const spec = seg.options[k];
        if (!spec) errors.push(`${path}.options.${k}: unknown option for "${entry.id}" (allowed: ${list(seg.options) || "none"})`);
        else checkOption(`${path}.options.${k}`, spec, v, errors);
      }
  }
  for (const [k, spec] of Object.entries(seg.options))
    if (spec.required && !entry.options?.[k]) errors.push(`${path}.options.${k}: required for "${entry.id}"`);
  if (entry.color !== undefined && !validColor(entry.color)) errors.push(`${path}.color: must be a theme role (${ROLES.join(", ")}) or #rrggbb`);
  for (const k of ["prefix", "suffix"]) if (entry[k] !== undefined && typeof entry[k] !== "string") errors.push(`${path}.${k}: must be a string`);
  if (entry.priority !== undefined && (!Number.isInteger(entry.priority) || entry.priority < 0 || entry.priority > 100))
    errors.push(`${path}.priority: must be a whole number 0–100`);
}

export function validate(config) {
  const errors = [];
  if (!isObj(config)) return { ok: false, errors: ["config: must be a JSON object"] };
  for (const k of Object.keys(config)) if (!TOP_KEYS.has(k)) errors.push(`${k}: unknown key.${suggest(k, [...TOP_KEYS])}`);
  if (config.version !== undefined && config.version !== SCHEMA_VERSION) errors.push(`version: must be ${SCHEMA_VERSION}`);
  const named = [
    ["preset", PRESETS], ["theme", THEMES], ["icons", ICON_SETS], ["bar", BAR_STYLES],
  ];
  for (const [key, table] of named)
    if (config[key] !== undefined && !table[config[key]]) errors.push(`${key}: unknown ${key} "${config[key]}" (available: ${list(table)})`);
  if (config.color !== undefined && !COLOR_MODES.includes(config.color)) errors.push(`color: must be one of ${COLOR_MODES.join(", ")}`);
  if (config.separator !== undefined && typeof config.separator !== "string") errors.push(`separator: must be a string or one of ${list(SEPARATORS)}`);
  if (config.hyperlinks !== undefined && typeof config.hyperlinks !== "boolean") errors.push(`hyperlinks: must be true or false`);
  if (config.reserve !== undefined && !(Number.isInteger(config.reserve) && config.reserve >= 0 && config.reserve <= 40))
    errors.push(`reserve: must be a whole number 0–40`);
  if (config.thresholds !== undefined) {
    const t = config.thresholds;
    if (!isObj(t)) errors.push(`thresholds: must be an object like {"warn": 60, "hot": 80}`);
    else {
      for (const k of Object.keys(t)) if (!["warn", "hot"].includes(k)) errors.push(`thresholds.${k}: unknown key (allowed: warn, hot)`);
      for (const k of ["warn", "hot"])
        if (t[k] !== undefined && !(typeof t[k] === "number" && t[k] >= 0 && t[k] <= 100)) errors.push(`thresholds.${k}: must be a number 0–100`);
      const w = t.warn ?? DEFAULTS.thresholds.warn, h = t.hot ?? DEFAULTS.thresholds.hot;
      if (typeof w === "number" && typeof h === "number" && w > h) errors.push(`thresholds: warn (${w}) must not exceed hot (${h})`);
    }
  }
  if (config.colors !== undefined) {
    if (!isObj(config.colors)) errors.push(`colors: must be an object mapping roles to #rrggbb`);
    else
      for (const [k, v] of Object.entries(config.colors)) {
        if (!ROLES.includes(k)) errors.push(`colors.${k}: unknown role (allowed: ${ROLES.join(", ")})`);
        else if (!parseHex(v)) errors.push(`colors.${k}: must be #rrggbb`);
      }
  }
  if (config.cache !== undefined) {
    if (!isObj(config.cache)) errors.push(`cache: must be an object`);
    else
      for (const [k, v] of Object.entries(config.cache)) {
        if (k !== "gitTtlMs") errors.push(`cache.${k}: unknown key (allowed: gitTtlMs)`);
        else if (!(Number.isInteger(v) && v >= 0 && v <= 600000)) errors.push(`cache.gitTtlMs: must be a whole number 0–600000`);
      }
  }
  if (config.lines !== undefined) {
    if (!Array.isArray(config.lines) || config.lines.length === 0) errors.push(`lines: must be a non-empty array of lines`);
    else
      config.lines.forEach((line, i) => {
        if (!Array.isArray(line)) return errors.push(`lines[${i}]: must be an array of segments`);
        line.forEach((entry, j) => checkEntry(`lines[${i}][${j}]`, entry, errors));
      });
  }
  return { ok: errors.length === 0, errors };
}

// Normalise into the shape render() consumes. Unknown/invalid parts are dropped, not fatal.
export function resolve(config = {}) {
  const user = isObj(config) ? config : {};
  const preset = PRESETS[user.preset]?.config ?? {};
  const merged = { ...DEFAULTS, ...preset, ...user };
  merged.thresholds = { ...DEFAULTS.thresholds, ...(isObj(preset.thresholds) ? preset.thresholds : {}), ...(isObj(user.thresholds) ? user.thresholds : {}) };
  merged.cache = { ...DEFAULTS.cache, ...(isObj(user.cache) ? user.cache : {}) };

  const theme = { ...(THEMES[merged.theme] ?? THEMES[DEFAULTS.theme]) };
  if (isObj(merged.colors)) for (const [k, v] of Object.entries(merged.colors)) if (ROLES.includes(k) && parseHex(v)) theme[k] = parseHex(v);

  const lines = (Array.isArray(merged.lines) ? merged.lines : DEFAULTS.lines)
    .filter(Array.isArray)
    .map((line) =>
      line
        .map((e) => (typeof e === "string" ? { id: e } : e))
        .filter((e) => isObj(e) && SEGMENTS[e.id])
        .map((e) => {
          const seg = SEGMENTS[e.id];
          const options = {};
          for (const [k, spec] of Object.entries(seg.options)) {
            const v = isObj(e.options) ? e.options[k] : undefined;
            const errs = [];
            if (v !== undefined) checkOption(k, spec, v, errs);
            options[k] = v !== undefined && errs.length === 0 ? v : spec.default;
          }
          return {
            id: e.id,
            options,
            color: validColor(e.color) ? e.color : undefined,
            prefix: typeof e.prefix === "string" ? e.prefix : "",
            suffix: typeof e.suffix === "string" ? e.suffix : "",
            priority: Number.isInteger(e.priority) ? e.priority : seg.priority,
          };
        }),
    );

  return {
    theme,
    icons: ICON_SETS[merged.icons] ?? ICON_SETS.unicode,
    bar: BAR_STYLES[merged.bar] ?? (merged.icons === "ascii" ? BAR_STYLES.ascii : BAR_STYLES.line),
    color: COLOR_MODES.includes(merged.color) ? merged.color : "auto",
    separator: typeof merged.separator === "string" ? SEPARATORS[merged.separator] ?? merged.separator : SEPARATORS.dot,
    hyperlinks: merged.hyperlinks !== false,
    reserve: Number.isInteger(merged.reserve) ? merged.reserve : DEFAULTS.reserve,
    thresholds: merged.thresholds,
    cache: merged.cache,
    lines,
  };
}
