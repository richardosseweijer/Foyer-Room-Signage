import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** Restart the room-plate listener after the AV-LAN bind changes. No compose or calendar. */

export const PANEL_UNIT = "foyer-panel.service";

function systemctlBin() {
  if (existsSync("/usr/bin/systemctl")) return "/usr/bin/systemctl";
  if (existsSync("/bin/systemctl")) return "/bin/systemctl";
  return "systemctl";
}

function sudoBin() {
  if (existsSync("/usr/bin/sudo")) return "/usr/bin/sudo";
  if (existsSync("/bin/sudo")) return "/bin/sudo";
  return "sudo";
}

export function panelRestartCommands() {
  const systemctl = systemctlBin();
  return [
    { bin: systemctl, args: ["try-restart", PANEL_UNIT] },
    { bin: sudoBin(), args: ["-n", systemctl, "try-restart", PANEL_UNIT] },
  ];
}

export function restartPanel() {
  const errors: string[] = [];
  for (const step of panelRestartCommands()) {
    const result = spawnSync(step.bin, step.args, { encoding: "utf8", timeout: 20_000 });
    if (result.status === 0) return { ok: true as const, via: step.bin };
    const err = (result.stderr || result.stdout || result.error?.message || "failed").trim();
    errors.push(err);
  }
  return { ok: false as const, reason: "panel-unit" as const, detail: errors.filter(Boolean)[0] ?? "panel unit not installed" };
}