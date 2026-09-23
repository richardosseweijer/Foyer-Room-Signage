import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  KIOSK_UNIT,
  KIOSK_SUDOERS,
  KIOSK_UNIT_MISSING,
  classifyKioskRestartFailure,
  enableLocalOutput,
  kioskRestartCommands,
} from "./kiosk.ts";

test("kiosk restart argv is a fixed unit name", () => {
  const steps = kioskRestartCommands();
  assert.ok(steps.length >= 2);
  for (const step of steps) {
    assert.ok(step.args.includes("restart"));
    assert.ok(step.args.includes(KIOSK_UNIT));
    assert.equal(step.args.some((arg) => arg.includes(" ") || arg.includes(";") || arg.includes("|")), false);
  }
  assert.equal(steps[1].args[0], "-n");
});

test("enableLocalOutput: tries systemctl then sudo -n", () => {
  const calls: { bin: string; args: string[] }[] = [];
  const res = enableLocalOutput({
    spawnSync: (bin, args) => {
      calls.push({ bin, args: [...args] });
      if (calls.length === 1) return { status: 1, stderr: "Access denied", stdout: "" };
      return { status: 0, stderr: "", stdout: "" };
    },
  });
  assert.equal(res.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args, ["restart", KIOSK_UNIT]);
  assert.equal(calls[1].args[0], "-n");
  assert.ok(calls[1].args.includes("restart"));
  assert.ok(calls[1].args.includes(KIOSK_UNIT));
});

test("enableLocalOutput: polkit / missing sudoers → clear INSTALL.md hint", () => {
  const polkit =
    "Failed to restart foyer-kiosk.service: Access denied as the requested operation requires interactive authentication. However, interactive authentication has not been enabled by the calling program.";
  const sudoPw = "sudo: a password is required";
  const res = enableLocalOutput({
    spawnSync: (_bin, args) => {
      const viaSudo = args[0] === "-n";
      return { status: 1, stderr: viaSudo ? sudoPw : polkit, stdout: "" };
    },
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "sudoers");
  assert.equal(res.detail, KIOSK_SUDOERS);
  assert.match(res.detail, /INSTALL\.md/);
  assert.match(res.detail, /sudoers\.foyer-kiosk/);
  assert.match(res.detail, /\/etc\/sudoers\.d\/foyer-kiosk/);
});

test("classifyKioskRestartFailure: unit missing vs sudoers", () => {
  assert.equal(
    classifyKioskRestartFailure(["Unit foyer-kiosk.service could not be found."]).kind,
    "missing",
  );
  assert.equal(
    classifyKioskRestartFailure(["Unit foyer-kiosk.service could not be found."]).message,
    KIOSK_UNIT_MISSING,
  );
  assert.equal(
    classifyKioskRestartFailure([
      "Access denied as the requested operation requires interactive authentication",
      "sudo: a password is required",
    ]).kind,
    "sudo",
  );
});

test("Setup runKiosk surfaces classified detail (not only generic INSTALL blurb)", () => {
  const ui = readFileSync(
    new URL("../../../src/components/foyer/config/ConfigApp.tsx", import.meta.url),
    "utf8",
  );
  assert.match(ui, /"detail" in result && result\.detail/);
  assert.match(ui, /String\(result\.detail\)/);
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
