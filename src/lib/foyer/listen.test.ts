import assert from "node:assert/strict";
import { test } from "node:test";
import { PANEL_PORT, WELCOME_HOST, WELCOME_PORT, panelDecision } from "./listen.ts";

test("welcome and panel ports are distinct", () => {
  assert.equal(WELCOME_PORT, 8080);
  assert.equal(PANEL_PORT, 8082);
  assert.equal(WELCOME_HOST, "0.0.0.0");
});

test("panel listener denies setup and the welcome kiosk", () => {
  assert.equal(panelDecision("/config"), "deny");
  assert.equal(panelDecision("/config/"), "deny");
  assert.equal(panelDecision("/play/welcome"), "deny");
});

test("panel listener sends the root to the room plate", () => {
  assert.equal(panelDecision("/"), "door");
  assert.equal(panelDecision("/play/door"), "allow");
});

test("panel listener allows assets and server functions", () => {
  assert.equal(panelDecision("/src/components/foyer/player/Player.tsx"), "allow");
  assert.equal(panelDecision("/_serverFn/foo"), "allow");
});
