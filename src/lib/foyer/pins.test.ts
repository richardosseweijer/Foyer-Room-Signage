import assert from "node:assert/strict";
import { test } from "node:test";
import { FIRST_SITE_PIN, isWeakPin } from "./pins.ts";
import {
  assertNewPin,
  attemptUnlock,
  hashPin,
  resetPinLockouts,
  verifyStoredPin,
} from "./pins.server.ts";
import { emptySecrets } from "./secrets.ts";

test("weak pins include 1234, repeats, year", () => {
  assert.equal(isWeakPin("1234"), true);
  assert.equal(isWeakPin("0000"), true);
  assert.equal(isWeakPin("2580"), true);
  assert.equal(isWeakPin("12"), true);
  assert.equal(isWeakPin(String(new Date().getFullYear())), true);
  assert.equal(isWeakPin("4826"), false);
});

test("hash and verify round-trip; plaintext never stored", () => {
  const hash = hashPin("4826");
  assert.equal(hash.startsWith("scrypt$"), true);
  assert.equal(verifyStoredPin("4826", hash), true);
  assert.equal(verifyStoredPin("1234", hash), false);
  assert.equal(verifyStoredPin("4826", "4826"), false);
});

test("site pin is rejected on the tech gate and vice versa", () => {
  resetPinLockouts();
  const secrets = emptySecrets();
  secrets.sitePinHash = hashPin("4826");
  secrets.techPinHash = hashPin("7391");
  secrets.sitePinMustChange = false;
  assert.equal(attemptUnlock({ gate: "tech", pin: "4826", secrets, clientKey: "t" }).ok, false);
  assert.equal(attemptUnlock({ gate: "site", pin: "7391", secrets, clientKey: "s" }).ok, false);
  assert.equal(attemptUnlock({ gate: "site", pin: "4826", secrets, clientKey: "s2" }).ok, true);
  assert.equal(attemptUnlock({ gate: "tech", pin: "7391", secrets, clientKey: "t2" }).ok, true);
});

test("1234 after a real change is rejected", () => {
  resetPinLockouts();
  const secrets = emptySecrets();
  secrets.sitePinHash = hashPin("4826");
  secrets.sitePinMustChange = false;
  const result = attemptUnlock({ gate: "site", pin: FIRST_SITE_PIN, secrets, clientKey: "after" });
  assert.equal(result.ok, false);
  assert.equal(assertNewPin("1234").ok, false);
});

test("first-boot 1234 succeeds with mustChange", () => {
  resetPinLockouts();
  const secrets = emptySecrets();
  secrets.sitePinHash = hashPin(FIRST_SITE_PIN);
  secrets.sitePinMustChange = true;
  const result = attemptUnlock({ gate: "site", pin: FIRST_SITE_PIN, secrets, clientKey: "first" });
  assert.deepEqual(result, { ok: true, mustChange: true });
});

test("PIN input is trimmed", () => {
  resetPinLockouts();
  const secrets = emptySecrets();
  secrets.sitePinHash = hashPin("4826");
  secrets.sitePinMustChange = false;
  const result = attemptUnlock({ gate: "site", pin: " 4826 ", secrets, clientKey: "trim" });
  assert.equal(result.ok, true);
});

test("unset technician PIN falls back to the site PIN", () => {
  resetPinLockouts();
  const secrets = emptySecrets();
  secrets.sitePinHash = hashPin("4826");
  secrets.techPinHash = "";
  secrets.sitePinMustChange = false;
  assert.equal(attemptUnlock({ gate: "tech", pin: "4826", secrets, clientKey: "tech-fallback" }).ok, true);
  assert.equal(attemptUnlock({ gate: "tech", pin: "0000", secrets, clientKey: "tech-fallback-bad" }).ok, false);
});

test("sixth failure locks the gate with no hint", () => {
  resetPinLockouts();
  const secrets = emptySecrets();
  secrets.sitePinHash = hashPin("4826");
  const key = "brute";
  const reasons: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const result = attemptUnlock({ gate: "site", pin: "0000", secrets, clientKey: key });
    assert.equal(result.ok, false);
    if (!result.ok) reasons.push(result.reason);
  }
  assert.ok(reasons.slice(0, 4).every((item) => item === "wrong"));
  assert.equal(reasons[4], "locked");
  assert.equal(reasons[5], "locked");
  const still = attemptUnlock({ gate: "site", pin: "4826", secrets, clientKey: key });
  assert.equal(still.ok, false);
  if (!still.ok) assert.equal(still.reason, "locked");
});

test("rotating clientKey does not bypass the lockout", () => {
  resetPinLockouts();
  const secrets = emptySecrets();
  secrets.sitePinHash = hashPin("4826");
  for (let i = 0; i < 5; i += 1) {
    const result = attemptUnlock({ gate: "site", pin: "0000", secrets, clientKey: `k${i}` });
    assert.equal(result.ok, false);
  }
  const locked = attemptUnlock({ gate: "site", pin: "4826", secrets, clientKey: "fresh" });
  assert.equal(locked.ok, false);
  if (!locked.ok) assert.equal(locked.reason, "locked");
});

