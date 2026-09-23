import assert from "node:assert/strict";
import { test } from "node:test";
import {
  kioskEnvBody,
  listVideoOutputs,
  resolvePickedVideoOutput,
  resolveVideoOutput,
  sameVideoOutputConflict,
  type VideoRow,
} from "./video.ts";

const fakeOutputs: VideoRow[] = [
  { index: 0, name: "DP-1", connected: true, label: "0 — DP-1" },
  { index: 1, name: "DP-2", connected: true, label: "1 — DP-2" },
  { index: 2, name: "HDMI-A-1", connected: false, label: "2 — HDMI-A-1 (unplugged)" },
];

test("video outputs are indexed and never empty", () => {
  const outputs = listVideoOutputs();
  assert.ok(outputs.length >= 1);
  assert.equal(outputs[0]?.index, 0);
  assert.equal(outputs[0]?.label.startsWith("0 — "), true);
});

test("video output falls back to the first connector", () => {
  const outputs = listVideoOutputs();
  const row = resolveVideoOutput({ videoOutputName: null, videoOutputIndex: null });
  assert.equal(row?.name, outputs[0]?.name);
});

test("picked video output has no fallback when unset", () => {
  assert.equal(
    resolvePickedVideoOutput({ name: null, index: null }, fakeOutputs),
    null,
  );
  assert.equal(
    resolvePickedVideoOutput({ name: null, index: 1 }, fakeOutputs)?.name,
    "DP-2",
  );
});

test("same output conflict when both roles resolve to one connector", () => {
  assert.equal(
    sameVideoOutputConflict(
      { name: "DP-1", index: 0 },
      { name: "DP-1", index: 0 },
      fakeOutputs,
    ),
    true,
  );
  assert.equal(
    sameVideoOutputConflict(
      { name: null, index: 0 },
      { name: null, index: 0 },
      fakeOutputs,
    ),
    true,
  );
  assert.equal(
    sameVideoOutputConflict(
      { name: "DP-1", index: 0 },
      { name: "DP-2", index: 1 },
      fakeOutputs,
    ),
    false,
  );
  assert.equal(
    sameVideoOutputConflict(
      { name: "DP-1", index: 0 },
      { name: null, index: null },
      fakeOutputs,
    ),
    false,
  );
  assert.equal(
    sameVideoOutputConflict(
      { name: null, index: null },
      { name: null, index: null },
      fakeOutputs,
    ),
    false,
  );
});

test("kiosk env names welcome and room panel connectors", () => {
  const outputs = listVideoOutputs();
  const body = kioskEnvBody({
    videoOutputName: outputs[0]?.name ?? null,
    videoOutputIndex: 0,
    roomPanelVideoOutputName: null,
    roomPanelVideoOutputIndex: null,
  });
  assert.match(body, /^FOYER_VIDEO_OUTPUT=/m);
  assert.match(body, /^FOYER_ROOM_PANEL_VIDEO_OUTPUT=$/m);

  const dual = kioskEnvBody({
    videoOutputName: "DP-1",
    videoOutputIndex: 0,
    roomPanelVideoOutputName: "DP-2",
    roomPanelVideoOutputIndex: 1,
  });
  // Names only appear when they exist in the live scan (or stay empty for unknown).
  assert.match(dual, /^FOYER_VIDEO_OUTPUT=/m);
  assert.match(dual, /^FOYER_ROOM_PANEL_VIDEO_OUTPUT=/m);
});

test("kiosk env writes room panel empty when unset", () => {
  const body = kioskEnvBody({
    videoOutputName: null,
    videoOutputIndex: null,
    roomPanelVideoOutputName: null,
    roomPanelVideoOutputIndex: null,
  });
  const lines = body.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /^FOYER_VIDEO_OUTPUT=/);
  assert.equal(lines[1], "FOYER_ROOM_PANEL_VIDEO_OUTPUT=");
});
