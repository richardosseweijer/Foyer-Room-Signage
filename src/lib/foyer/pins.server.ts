import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { FIRST_SITE_PIN, isHashedPin, isWeakPin } from "./pins.ts";
import type { Secrets } from "./types.ts";

const FAIL = new Map<string, { n: number; until: number }>();
const LOCK_AFTER = 5;
const LOCK_MS = 5 * 60_000;

export type PinGate = "site" | "tech";

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(pin), salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyStoredPin(pin: string, stored: string | null | undefined) {
  const value = String(stored ?? "");
  if (!value) return false;
  if (!isHashedPin(value)) return false;
  const parts = value.split("$");
  const salt = parts[1];
  const hash = parts[2];
  if (!salt || !hash || hash.length !== 64) return false;
  const next = scryptSync(String(pin), salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export function lockoutKey(kind: PinGate, _extra = "") {
  return kind;
}

export function checkLockout(key: string) {
  const row = FAIL.get(key);
  if (!row) return { blocked: false, left: 0 };
  if (row.until && Date.now() < row.until) return { blocked: true, left: row.until - Date.now() };
  return { blocked: false, left: 0 };
}

export function notePinFail(key: string) {
  const row = FAIL.get(key) ?? { n: 0, until: 0 };
  row.n += 1;
  if (row.n >= LOCK_AFTER) {
    row.until = Date.now() + LOCK_MS;
    row.n = 0;
  }
  FAIL.set(key, row);
  return checkLockout(key);
}

export function clearPinFail(key: string) {
  FAIL.delete(key);
}

/** Tests only — process memory lockout, same as Relay. */
export function resetPinLockouts() {
  FAIL.clear();
}

export function assertNewPin(pin: string, otherPin?: string) {
  if (isWeakPin(pin)) return { ok: false as const, reason: "weak" as const };
  if (otherPin !== undefined && pin === otherPin) {
    return { ok: false as const, reason: "same-as-other" as const };
  }
  return { ok: true as const };
}

export function attemptUnlock(opts: {
  gate: PinGate;
  pin: string;
  secrets: Secrets;
  clientKey: string;
}):
  | { ok: true; mustChange: boolean }
  | { ok: false; reason: "locked" | "wrong" } {
  const pin = String(opts.pin ?? "").trim();
  const key = lockoutKey(opts.gate, opts.clientKey);
  const lock = checkLockout(key);
  if (lock.blocked) return { ok: false, reason: "locked" };

  const stored = opts.gate === "site" ? opts.secrets.sitePinHash : opts.secrets.techPinHash;
  let match = verifyStoredPin(pin, stored);
  if (!match && opts.gate === "tech" && !opts.secrets.techPinHash) {
    match = verifyStoredPin(pin, opts.secrets.sitePinHash);
  }
  if (!match) {
    const after = notePinFail(key);
    if (after.blocked) return { ok: false, reason: "locked" };
    return { ok: false, reason: "wrong" };
  }

  clearPinFail(key);
  const mustChange = opts.gate === "site" && opts.secrets.sitePinMustChange && pin === FIRST_SITE_PIN;
  return { ok: true, mustChange };
}

export { isHashedPin, FIRST_SITE_PIN };
