import assert from "node:assert/strict";
import { test } from "node:test";
import { kioskEnvBody, listVideoOutputs, resolveVideoOutput } from "./video.ts";

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

test("kiosk env names the resolved connector", () => {
  const outputs = listVideoOutputs();
  const body = kioskEnvBody({ videoOutputName: outputs[0]?.name ?? null, videoOutputIndex: 0 });
  assert.match(body, /^FOYER_VIDEO_OUTPUT=/);
});
