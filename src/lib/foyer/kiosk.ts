import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** Start/restart the HDMI kiosk. No compose, calendar, or secrets. */

export const KIOSK_UNIT = "foyer-kiosk.service";

export function systemctlBin() {
  if (existsSync("/usr/bin/systemctl")) return "/usr/bin/systemctl";
  if (existsSync("/bin/systemctl")) return "/bin/systemctl";
  return "systemctl";
}

export function sudoBin() {
  if (existsSync("/usr/bin/sudo")) return "/usr/bin/sudo";
  if (existsSync("/bin/sudo")) return "/bin/sudo";
  return "sudo";
}

/** Fixed argv only — never interpolates Setup fields. */
export function kioskRestartCommands() {
  const systemctl = systemctlBin();
  return [
    { bin: systemctl, args: ["restart", KIOSK_UNIT] },
    { bin: sudoBin(), args: ["-n", systemctl, "restart", KIOSK_UNIT] },
  ];
}

export function enableLocalOutput() {
  const attempts = kioskRestartCommands();
  const errors: string[] = [];
  for (const step of attempts) {
    const result = spawnSync(step.bin, step.args, { encoding: "utf8", timeout: 20_000 });
    if (result.status === 0) return { ok: true as const, via: step.bin };
    const err = (result.stderr || result.stdout || result.error?.message || "failed").trim();
    errors.push(err);
  }
  return { ok: false as const, reason: "kiosk-unit" as const, detail: errors.filter(Boolean)[0] ?? "kiosk unit not installed" };
}
