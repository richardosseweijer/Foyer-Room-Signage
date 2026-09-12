import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { isWeakPin } from "./pins.ts";

export type PairingRecord = { displayId: string; code: string; expiresAt: number };

const CODES = new Map<string, PairingRecord>();
const PICKUP = new Map<string, { token: string; expiresAt: number }>();
const CODE_TTL_MS = 5 * 60_000;
const PICKUP_TTL_MS = 60_000;

function hashToken(token: string, salt: string) {
  return `scrypt$${salt}$${scryptSync(token, salt, 32).toString("hex")}`;
}

export function mintPairingCode(displayId: string, now = Date.now()): PairingRecord {
  let code = "";
  for (let i = 0; i < 20; i += 1) {
    code = String(randomInt(0, 10_000)).padStart(4, "0");
    if (!isWeakPin(code)) break;
  }
  const row = { displayId, code, expiresAt: now + CODE_TTL_MS };
  CODES.set(displayId, row);
  return row;
}

export function readPairingCode(displayId: string, now = Date.now()) {
  const row = CODES.get(displayId);
  if (!row) return null;
  if (row.expiresAt <= now) {
    CODES.delete(displayId);
    return null;
  }
  return row;
}

export function claimPairingCode(code: string, now = Date.now()) {
  const match = [...CODES.values()].find((row) => row.code === code);
  if (!match) return { ok: false as const, reason: "wrong" as const };
  if (match.expiresAt <= now) {
    CODES.delete(match.displayId);
    return { ok: false as const, reason: "expired" as const };
  }
  CODES.delete(match.displayId);
  const token = randomBytes(24).toString("hex");
  const salt = randomBytes(16).toString("hex");
  PICKUP.set(match.displayId, { token, expiresAt: now + PICKUP_TTL_MS });
  return { ok: true as const, displayId: match.displayId, tokenHash: hashToken(token, salt) };
}

/** One-time handoff to the tablet after Setup claims the code. Not for the Setup browser. */
export function takePickupToken(displayId: string, now = Date.now()) {
  const row = PICKUP.get(displayId);
  if (!row) return null;
  PICKUP.delete(displayId);
  if (row.expiresAt <= now) return null;
  return row.token;
}

export function verifyDisplayToken(token: string, storedHash: string | undefined) {
  if (!storedHash || !token) return false;
  const parts = storedHash.split("$");
  const salt = parts[1];
  const hash = parts[2];
  if (!salt || !hash || hash.length !== 64) return false;
  const next = scryptSync(token, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export function nextSeq(current: number) {
  return current + 1;
}

export function resetPairingCodes() {
  CODES.clear();
  PICKUP.clear();
}
