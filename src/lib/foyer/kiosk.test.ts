import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { KIOSK_UNIT, kioskRestartCommands } from "./kiosk.ts";

test("kiosk restart argv is a fixed unit name", () => {
  const steps = kioskRestartCommands();
  assert.ok(steps.length >= 1);
  for (const step of steps) {
    assert.ok(step.args.includes("restart"));
    assert.ok(step.args.includes(KIOSK_UNIT));
    assert.equal(step.args.some((arg) => arg.includes(" ") || arg.includes(";") || arg.includes("|")), false);
  }
});

test("kiosk unit takes tty1 from the Ubuntu console", () => {
  const unit = readFileSync(new URL("../../../deploy/foyer-kiosk.service", import.meta.url), "utf8");
  assert.match(unit, /Conflicts=getty@tty1\.service/);
  assert.match(unit, /TTYPath=\/dev\/tty1/);
  assert.match(unit, /ExecStartPre=\+\/bin\/chvt 1/);
  assert.match(unit, /cage -d --/);
  assert.equal(unit.includes("cage -s"), false);
});
