import assert from "node:assert/strict";
import { test } from "node:test";
import { PANEL_PORT, WELCOME_HOST, WELCOME_PORT, panelDecision, panelUpstreamHeaders } from "./listen.ts";

test("welcome and panel ports are distinct", () => {
  assert.equal(WELCOME_PORT, 8080);
  assert.equal(PANEL_PORT, 8082);
  assert.equal(WELCOME_HOST, "0.0.0.0");
});

test("panel listener denies setup, welcome, and other plates", () => {
  assert.equal(panelDecision("/config"), "deny");
  assert.equal(panelDecision("/config/"), "deny");
  assert.equal(panelDecision("/play/welcome"), "deny");
  assert.equal(panelDecision("/play/dc"), "deny");
  assert.equal(panelDecision("/play/wayfinding"), "deny");
});

test("panel listener sends the root to the room plate", () => {
  assert.equal(panelDecision("/"), "door");
  assert.equal(panelDecision("/play/door"), "allow");
});

test("panel listener allows assets and server functions", () => {
  assert.equal(panelDecision("/src/components/foyer/player/Player.tsx"), "allow");
  assert.equal(panelDecision("/_serverFn/foo"), "allow");
});

test("panel proxy keeps the tablet Host, not loopback", () => {
  const headers = panelUpstreamHeaders(
    { host: "10.0.25.119:8082", connection: "keep-alive", "content-type": "application/json" },
    "10.0.25.119:8082",
  );
  assert.equal(headers.host, "10.0.25.119:8082");
  assert.equal(headers["x-forwarded-host"], "10.0.25.119:8082");
  assert.equal(headers.connection, undefined);
  assert.equal(headers["content-type"], "application/json");
});
