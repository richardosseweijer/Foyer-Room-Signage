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
  assert.match(unit, /foyer-kiosk-sway\.sh/);
  assert.match(unit, /sway/);
  assert.equal(unit.includes("cage"), false);
});

test("sway launcher enables chosen output and execs welcome chromium", () => {
  const launch = readFileSync(new URL("../../../scripts/foyer-kiosk-sway.sh", import.meta.url), "utf8");
  assert.match(launch, /output \* disable/);
  assert.match(launch, /FOYER_VIDEO_OUTPUT/);
  assert.match(launch, /\/usr\/bin\/sway -c/);
  assert.match(launch, /foyer-kiosk\.sh/);
  assert.equal(launch.includes("cage"), false);
});

test("welcome chromium uses an isolated profile dir for F3 dual profiles", () => {
  const kiosk = readFileSync(new URL("../../../scripts/foyer-kiosk.sh", import.meta.url), "utf8");
  assert.match(kiosk, /--user-data-dir=/);
  assert.match(kiosk, /data\/chromium-welcome/);
  assert.match(kiosk, /127\.0\.0\.1:8080/);
  assert.match(kiosk, /--ozone-platform=wayland/);
});
