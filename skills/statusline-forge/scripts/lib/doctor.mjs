// Diagnose a blank or broken status line. Each check: { id, ok, level, label, detail, fix }.
// level "fail" makes doctor exit non-zero; "warn" is advisory; "info" is context.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isForgeCommand } from "./command.mjs";
import { validate } from "./config.mjs";
import { paths, readSettings, SCRIPTS_DIR } from "./install.mjs";

const check = (level) => (id, label, detail = "", fix) => ({ id, ok: level === "ok" || level === "info", level, label, detail, fix });
const pass = check("ok");
const fail = check("fail");
const warn = check("warn");
const info = check("info");

// Run the command the way Claude Code does: a POSIX shell, or on Windows Git Bash
// when installed, else PowerShell.
function runLikeClaude(command, input) {
  const opts = { input, encoding: "utf8", timeout: 5000, windowsHide: true, env: { ...process.env, COLUMNS: "200" } };
  if (process.platform !== "win32") return spawnSync("/bin/sh", ["-c", command], opts);
  const bash = spawnSync("bash", ["--version"], { windowsHide: true });
  if (!bash.error && bash.status === 0) return spawnSync("bash", ["-c", command], opts);
  return spawnSync("powershell.exe", ["-NoProfile", "-Command", command], opts);
}

export function diagnose({ settings: settingsPath, cwd = process.cwd() } = {}) {
  const p = paths({ settings: settingsPath });
  const checks = [];

  const major = +process.versions.node.split(".")[0];
  checks.push(
    major >= 18
      ? pass("node-version", "Node.js version", process.versions.node)
      : fail("node-version", "Node.js version", process.versions.node, "Install Node.js 18 or newer."),
  );

  let settings = null;
  try {
    settings = readSettings(p.settings);
    checks.push(pass("settings-valid", "settings.json is valid JSON", p.settings));
  } catch (err) {
    checks.push(fail("settings-valid", "settings.json is valid JSON", err.message, `Fix the JSON syntax in ${p.settings}.`));
  }

  const sl = settings?.statusLine;
  if (settings) {
    if (!sl) checks.push(fail("statusline-configured", "statusLine is configured", "no statusLine key", "Run: forge.mjs install"));
    else if (!isForgeCommand(sl))
      checks.push(fail("statusline-configured", "statusLine points at statusline-forge", `currently: ${JSON.stringify(sl)}`, "Run: forge.mjs install"));
    else checks.push(pass("statusline-configured", "statusLine points at statusline-forge", sl.command));
    if (settings.disableAllHooks === true)
      checks.push(fail("hooks-enabled", "disableAllHooks is off", "disableAllHooks: true also disables the status line", `Remove "disableAllHooks" from ${p.settings}.`));
    if (settings.allowManagedHooksOnly === true)
      checks.push(warn("managed-hooks", "managed-only hooks", "allowManagedHooksOnly: true hides user status lines", "Ask your administrator, or remove allowManagedHooksOnly."));
    if (process.platform === "win32" && sl?.command?.includes("\\"))
      checks.push(fail("forward-slashes", "command uses forward slashes", "backslashes are stripped by Git Bash", "Re-run: forge.mjs install"));
  }

  for (const name of ["settings.json", "settings.local.json"]) {
    const f = join(cwd, ".claude", name);
    if (f === p.settings || !existsSync(f)) continue;
    try {
      const proj = JSON.parse(readFileSync(f, "utf8"));
      if (proj.statusLine && !isForgeCommand(proj.statusLine))
        checks.push(warn("project-override", "no project-level override", `${f} sets its own statusLine, which wins in this project`, `Remove statusLine from ${f} to use your forge design here.`));
    } catch {}
  }

  if (existsSync(p.runtime)) checks.push(pass("runtime-installed", "runtime installed", p.runtime));
  else checks.push(fail("runtime-installed", "runtime installed", `${p.runtime} is missing`, "Run: forge.mjs install"));

  if (existsSync(p.config)) {
    let cfg;
    try {
      cfg = JSON.parse(readFileSync(p.config, "utf8"));
    } catch (err) {
      checks.push(fail("config-valid", "config is valid", `${p.config}: ${err.message}`, "Fix the JSON, or re-run install with a valid --config."));
    }
    if (cfg) {
      const v = validate(cfg);
      checks.push(v.ok ? pass("config-valid", "config is valid", p.config) : fail("config-valid", "config is valid", v.errors.join("; "), `Edit ${p.config}, then run: forge.mjs validate`));
    }
  }

  if (isForgeCommand(sl)) {
    const sample = readFileSync(join(SCRIPTS_DIR, "fixtures", "mid.json"), "utf8");
    const started = Date.now();
    const r = runLikeClaude(sl.command, sample);
    const ms = Date.now() - started;
    if (r.error || r.status !== 0) {
      const why = (r.stderr || "").trim().split("\n")[0] || r.error?.message || "no output";
      checks.push(fail("renders", "command renders", `exit ${r.status ?? r.error?.code}: ${why}`, "Check that the Node.js path in the command exists; re-run install."));
    } else if (!r.stdout.trim()) {
      checks.push(fail("renders", "command renders", "printed nothing for a sample session", "Run: forge.mjs preview, and check the config's lines."));
    } else {
      checks.push(pass("renders", "command renders", `${ms}ms`));
      if (ms > 1000) checks.push(warn("fast", "command is fast", `${ms}ms per refresh`, "Remove slow command segments or raise their ttlMs."));
    }
  }

  checks.push(
    info(
      "workspace-trust",
      "workspace trust",
      "the status line stays blank in folders whose trust dialog was not accepted",
      "Accept the trust prompt, or run `claude --debug` and look for \"Status line command skipped\".",
    ),
  );
  return checks;
}
