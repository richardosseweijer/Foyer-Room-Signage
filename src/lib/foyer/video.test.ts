import assert from "node:assert/strict";
import { test } from "node:test";
import {
  envRelayUrl,
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

test("envRelayUrl keeps plain http Relay base URLs", () => {
  assert.equal(envRelayUrl("http://10.0.25.10:8081"), "http://10.0.25.10:8081/");
  assert.equal(envRelayUrl("http://127.0.0.1:8081/"), "http://127.0.0.1:8081/");
  assert.equal(envRelayUrl("https://10.0.25.10:8081"), "");
  assert.equal(envRelayUrl("http://evil.example/path"), "");
  assert.equal(envRelayUrl(null), "");
});

test("kiosk env names welcome and room panel connectors", () => {
  const outputs = listVideoOutputs();
  const body = kioskEnvBody({
    videoOutputName: outputs[0]?.name ?? null,
    videoOutputIndex: 0,
    roomPanelVideoOutputName: null,
    roomPanelVideoOutputIndex: null,
    relayUrl: null,
  });
  assert.match(body, /^FOYER_VIDEO_OUTPUT=/m);
  assert.match(body, /^FOYER_ROOM_PANEL_VIDEO_OUTPUT=$/m);
  assert.match(body, /^FOYER_ROOM_PANEL_URL=$/m);

  const dual = kioskEnvBody({
    videoOutputName: "DP-1",
    videoOutputIndex: 0,
    roomPanelVideoOutputName: "DP-2",
    roomPanelVideoOutputIndex: 1,
    relayUrl: "http://10.0.25.10:8081",
  });
  assert.match(dual, /^FOYER_VIDEO_OUTPUT=/m);
  assert.match(dual, /^FOYER_ROOM_PANEL_VIDEO_OUTPUT=/m);
  assert.match(dual, /^FOYER_ROOM_PANEL_URL=http:\/\/10\.0\.25\.10:8081\/$/m);
});

test("kiosk env writes room panel empty when unset", () => {
  const body = kioskEnvBody({
    videoOutputName: null,
    videoOutputIndex: null,
    roomPanelVideoOutputName: null,
    roomPanelVideoOutputIndex: null,
    relayUrl: null,
  });
  const lines = body.trim().split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /^FOYER_VIDEO_OUTPUT=/);
  assert.equal(lines[1], "FOYER_ROOM_PANEL_VIDEO_OUTPUT=");
  assert.equal(lines[2], "FOYER_ROOM_PANEL_URL=");
});

test("kiosk env room-panel-only leaves welcome empty", () => {
  const body = kioskEnvBody({
    videoOutputName: null,
    videoOutputIndex: null,
    roomPanelVideoOutputName: "DP-2",
    roomPanelVideoOutputIndex: 1,
    relayUrl: "http://10.0.25.10:8081",
  });
  // Live DRM may or may not include DP-2; welcome must stay empty when unset.
  assert.match(body, /^FOYER_VIDEO_OUTPUT=$/m);
  assert.match(body, /^FOYER_ROOM_PANEL_URL=http:\/\/10\.0\.25\.10:8081\/$/m);
});
