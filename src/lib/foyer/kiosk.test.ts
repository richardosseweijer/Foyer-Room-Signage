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

test("sway launcher enables welcome and/or room panel outputs", () => {
  const launch = readFileSync(new URL("../../../scripts/foyer-kiosk-sway.sh", import.meta.url), "utf8");
  assert.match(launch, /output \* disable/);
  assert.match(launch, /FOYER_VIDEO_OUTPUT/);
  assert.match(launch, /FOYER_ROOM_PANEL_VIDEO_OUTPUT/);
  assert.match(launch, /\/usr\/bin\/sway -c/);
  assert.match(launch, /foyer-kiosk\.sh/);
  assert.match(launch, /foyer-kiosk-room-panel\.sh/);
  assert.match(launch, /workspace foyer-welcome/);
  assert.match(launch, /workspace foyer-room/);
  assert.match(launch, /foyer-welcome/);
  assert.match(launch, /foyer-room-panel/);
  assert.equal(launch.includes("cage"), false);
  assert.equal(launch.includes("relay-kiosk"), false);
});

test("sway keeps both app_id and class matchers for Chromium --class", () => {
  const launch = readFileSync(new URL("../../../scripts/foyer-kiosk-sway.sh", import.meta.url), "utf8");
  assert.match(launch, /assign \[app_id="foyer-welcome"\]/);
  assert.match(launch, /assign \[class="foyer-welcome"\]/);
  assert.match(launch, /assign \[app_id="foyer-room-panel"\]/);
  assert.match(launch, /assign \[class="foyer-room-panel"\]/);
  assert.match(launch, /for_window \[app_id="foyer-welcome"\]/);
  assert.match(launch, /for_window \[class="foyer-welcome"\]/);
  assert.match(launch, /for_window \[app_id="foyer-room-panel"\]/);
  assert.match(launch, /for_window \[class="foyer-room-panel"\]/);
});

test("welcome chromium uses an isolated profile dir", () => {
  const kiosk = readFileSync(new URL("../../../scripts/foyer-kiosk.sh", import.meta.url), "utf8");
  assert.match(kiosk, /--user-data-dir=/);
  assert.match(kiosk, /data\/chromium-welcome/);
  assert.match(kiosk, /127\.0\.0\.1:8080/);
  assert.match(kiosk, /--ozone-platform=wayland/);
  assert.match(kiosk, /--class=foyer-welcome/);
  assert.match(kiosk, /FOYER_CHROMIUM_NO_SANDBOX/);
});

test("room panel chromium uses Relay URL env and isolated profile", () => {
  const room = readFileSync(new URL("../../../scripts/foyer-kiosk-room-panel.sh", import.meta.url), "utf8");
  assert.match(room, /FOYER_ROOM_PANEL_URL/);
  assert.match(room, /data\/chromium-room-panel/);
  assert.match(room, /--class=foyer-room-panel/);
  assert.match(room, /--ozone-platform=wayland/);
  assert.match(room, /FOYER_CHROMIUM_NO_SANDBOX/);
  assert.equal(room.includes("127.0.0.1:8080"), false);
  assert.equal(room.includes("relay-kiosk"), false);
  // Soft-fail when URL unset (Room panel only) — must not take sway down.
  assert.match(room, /FOYER_ROOM_PANEL_URL unset/);
  assert.match(room, /exit 0/);
});

test("setup restarts kiosk on Welcome change or clear", () => {
  const ui = readFileSync(
    new URL("../../../src/components/foyer/config/ConfigApp.tsx", import.meta.url),
    "utf8",
  );
  // F4: clearing Welcome (null) must still pass startKiosk: true — not only when !== null.
  assert.match(ui, /save\(\{\s*videoOutputIndex\s*\},\s*\{\s*startKiosk:\s*true\s*\}\)/);
  assert.match(ui, /save\(\{\s*roomPanelVideoOutputIndex\s*\},\s*\{\s*startKiosk:\s*true\s*\}\)/);
  assert.equal(ui.includes("startKiosk: videoOutputIndex !== null"), false);
  // Same-output reject returns before runKiosk — startKiosk only after ok save.
  assert.match(ui, /reason === "same-output"/);
  assert.match(ui, /if \(opts\?\.startKiosk\)/);
});
