import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claimPairingCode,
  mintPairingCode,
  readPairingCode,
  resetPairingCodes,
  takePickupToken,
  verifyDisplayToken,
} from "./transport.ts";

test("expired code cannot be claimed", () => {
  resetPairingCodes();
  const now = 1_000_000;
  const row = mintPairingCode("door-1", now);
  const result = claimPairingCode(row.code, now + 6 * 60_000);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "expired");
});

test("wrong code fails without listing displays", () => {
  resetPairingCodes();
  mintPairingCode("door-1");
  const result = claimPairingCode("0001");
  assert.deepEqual(result, { ok: false, reason: "wrong" });
});

test("claim mints a token; a second claim of the same code fails", () => {
  resetPairingCodes();
  const row = mintPairingCode("door-1");
  const first = claimPairingCode(row.code);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.displayId, "door-1");
  const pickup = takePickupToken("door-1");
  assert.equal(Boolean(pickup), true);
  assert.equal(verifyDisplayToken(pickup ?? "", first.tokenHash), true);
  assert.equal(verifyDisplayToken("nope", first.tokenHash), false);
  const second = claimPairingCode(row.code);
  assert.equal(second.ok, false);
});

test("forged token does not match stored hash", () => {
  resetPairingCodes();
  const row = mintPairingCode("door-1");
  const first = claimPairingCode(row.code);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  takePickupToken("door-1");
  assert.equal(verifyDisplayToken("forged", first.tokenHash), false);
});

test("readPairingCode drops expired rows", () => {
  resetPairingCodes();
  const now = 1_000;
  mintPairingCode("door-1", now);
  assert.equal(readPairingCode("door-1", now + 6 * 60_000), null);
  const live = mintPairingCode("door-1", now);
  assert.equal(readPairingCode("door-1", now)?.code, live.code);
});

test("tablet pickup receives the token; Setup does not get a second copy", () => {
  resetPairingCodes();
  const row = mintPairingCode("wayfinding");
  const claimed = claimPairingCode(row.code);
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;
  assert.equal("token" in claimed, false);
  const first = takePickupToken("wayfinding");
  const second = takePickupToken("wayfinding");
  assert.equal(Boolean(first), true);
  assert.equal(second, null);
  assert.equal(verifyDisplayToken(first ?? "", claimed.tokenHash), true);
});

