import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

/** Start/restart the HDMI kiosk. No compose, calendar, or secrets. */

export const KIOSK_UNIT = "foyer-kiosk.service";

export const KIOSK_UNIT_MISSING =
  "foyer-kiosk.service is not installed or could not be restarted. See INSTALL.md §7 (Welcome on the local video output).";

export const KIOSK_SUDOERS =
  "sudo systemctl was refused (missing sudoers, password required, or polkit interactive auth). Install deploy/sudoers.foyer-kiosk as /etc/sudoers.d/foyer-kiosk (replace USER; visudo -cf; root:root mode 0440) per INSTALL.md §7.";

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

/**
 * Detect missing sudoers / polkit interactive auth vs unit-not-installed.
 * Same classification style as Relay (kiosk restart after #138).
 */
export function classifyKioskRestartFailure(errors: string[]) {
  const text = (errors || []).filter(Boolean).join("\n").toLowerCase();
  if (!text.trim()) return { kind: "missing" as const, message: KIOSK_UNIT_MISSING };
  if (
    /a password is required|sudo: a password is required|not allowed to execute|no password was provided|sorry, user .+ is not allowed|interactive authentication|authentication is required|access denied|polkit|sudoers/i.test(
      text,
    )
  ) {
    return { kind: "sudo" as const, message: KIOSK_SUDOERS };
  }
  if (/not found|could not be found|unit .+ not loaded|failed to (find|get) unit/i.test(text)) {
    return { kind: "missing" as const, message: KIOSK_UNIT_MISSING };
  }
  const detail = String(errors.filter(Boolean)[0] || "")
    .trim()
    .slice(0, 280);
  return { kind: "restart" as const, message: detail || KIOSK_UNIT_MISSING };
}

type SpawnResult = {
  status: number | null;
  stderr?: string | null;
  stdout?: string | null;
  error?: Error;
};

type SpawnFn = (
  bin: string,
  args: readonly string[],
  opts: { encoding: "utf8"; timeout: number },
) => SpawnResult;

/** Try bare systemctl, then `sudo -n systemctl` (passwordless allowlist). */
export function enableLocalOutput(opts: { spawnSync?: SpawnFn } = {}) {
  const run = opts.spawnSync ?? (spawnSync as SpawnFn);
  const attempts = kioskRestartCommands();
  const errors: string[] = [];
  for (const step of attempts) {
    const result = run(step.bin, step.args, { encoding: "utf8", timeout: 20_000 });
    if (result.status === 0) return { ok: true as const, via: step.bin };
    const err = String(result.stderr || result.stdout || result.error?.message || "failed").trim();
    errors.push(err);
  }
  const classified = classifyKioskRestartFailure(errors);
  return {
    ok: false as const,
    reason: (classified.kind === "sudo" ? "sudoers" : "kiosk-unit") as "sudoers" | "kiosk-unit",
    detail: classified.message,
  };
}
