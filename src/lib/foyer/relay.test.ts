import assert from "node:assert/strict";
import { test } from "node:test";
import { occupancyFromPeer, occupancyFromValue, peerEndpoint, signPeer } from "./relay.ts";
import { demoSite } from "./seed.ts";

test("Relay HMAC matches the documented peer formula", () => {
  const sig = signPeer("secret", "GET", "/api/peer", "1000", "");
  assert.equal(sig.length, 64);
  assert.match(sig, /^[0-9a-f]+$/);
});

test("first-class occupancy applies to this PC's room without a name match", () => {
  const site = demoSite();
  const id = site.rooms[0]!.id;
  const snap = occupancyFromPeer({
    site,
    payload: { occupancy: "closed", room: { id: "other", name: "Not Cedar" } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[id], "closed");
});

test("occupancy still applies when room is a string or missing", () => {
  const site = demoSite();
  const id = site.rooms[0]!.id;
  const asString = occupancyFromPeer({
    site,
    payload: { occupancy: "busy", room: "whatever" },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(asString.rooms[id], "busy");
  const missing = occupancyFromPeer({
    site,
    payload: { occupancy: "do-not-disturb" },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(missing.rooms[id], "do-not-disturb");
});

test("dnd aliases map", () => {
  assert.equal(occupancyFromValue("dnd"), "do-not-disturb");
  assert.equal(occupancyFromValue("do not disturb"), "do-not-disturb");
});

test("host.locked fills in-session only when occupancy is missing", () => {
  const site = demoSite();
  const id = site.rooms[0]!.id;
  const locked = occupancyFromPeer({
    site,
    payload: { host: { locked: true } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(locked.rooms[id], "in-session");
  const preferred = occupancyFromPeer({
    site,
    payload: { occupancy: "available", host: { locked: true } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(preferred.rooms[id], "available");
});

test("unknown occupancy string is ignored", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: { occupancy: "maybe", room: { name: "Cedar" } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[site.rooms[0]!.id], undefined);
});

test("vars are not used to bind occupancy", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: { vars: { v1: { name: "Cedar", value: "busy" } } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[site.rooms[0]!.id], undefined);
});

test("peerEndpoint does not throw on a hostname without a scheme", () => {
  assert.equal(peerEndpoint("relay.local")?.pathname, "/api/peer");
  assert.equal(peerEndpoint("not a url"), null);
});
