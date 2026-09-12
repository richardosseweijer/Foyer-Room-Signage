import assert from "node:assert/strict";
import { test } from "node:test";
import { occupancyFromPeer, peerEndpoint, signPeer } from "./relay.ts";
import { demoSite } from "./seed.ts";

test("Relay HMAC matches the documented peer formula", () => {
  const sig = signPeer("secret", "GET", "/api/peer", "1000", "");
  assert.equal(sig.length, 64);
  assert.match(sig, /^[0-9a-f]+$/);
});

test("Relay vars named like rooms become occupancy", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: {
      room: { name: "Cedar" },
      host: { locked: true },
      vars: {
        v1: { name: "Maple", value: "occupied" },
      },
    },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms.cedar, "in-session");
  assert.equal(snap.rooms.maple, undefined);
});

test("Relay 'busy' stays busy, not in-session", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: {
      vars: {
        v1: { name: "Cedar", value: "busy" },
      },
    },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms.cedar, "busy");
});

test("peerEndpoint does not throw on a hostname without a scheme", () => {
  assert.equal(peerEndpoint("relay.local")?.pathname, "/api/peer");
  assert.equal(peerEndpoint("not a url"), null);
});
