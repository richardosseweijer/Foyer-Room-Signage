import { randomBytes } from "node:crypto";
import type { PinGate } from "./pins.server.ts";

const sessions = new Map<string, { gate: PinGate; until: number }>();
const TTL = 12 * 60 * 60_000;

export function issueSession(gate: PinGate) {
  const token = randomBytes(18).toString("hex");
  sessions.set(token, { gate, until: Date.now() + TTL });
  return token;
}

export function readSession(token: string | undefined, gate: PinGate) {
  if (!token) return false;
  const row = sessions.get(token);
  if (!row) return false;
  if (row.until < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return row.gate === gate;
}
