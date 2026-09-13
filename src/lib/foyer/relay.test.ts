import assert from "node:assert/strict";
import { test } from "node:test";
import { occupancyFromPeer, occupancyFromValue, peerEndpoint, signPeer } from "./relay.ts";
import { demoSite } from "./seed.ts";

test("Relay HMAC matches the documented peer formula", () => {
  const sig = signPeer("secret", "GET", "/api/peer", "1000", "");
  assert.equal(sig.length, 64);
  assert.match(sig, /^[0-9a-f]+$/);
});

test("first-class occupancy binds by room.name", () => {
  const site = demoSite();
  const name = site.rooms[0]!.name;
  const id = site.rooms[0]!.id;
  const snap = occupancyFromPeer({
    site,
    payload: { occupancy: "closed", room: { id: "relay-1", name } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[id], "closed");
});

test("first-class do-not-disturb maps", () => {
  const site = demoSite();
  const name = site.rooms[0]!.name;
  const id = site.rooms[0]!.id;
  const snap = occupancyFromPeer({
    site,
    payload: { occupancy: "do-not-disturb", room: { name } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[id], "do-not-disturb");
  assert.equal(occupancyFromValue("dnd"), "do-not-disturb");
});

test("var label matching still works when occupancy is absent", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: {
      vars: { v1: { name: site.rooms[0]!.name, value: "busy" } },
    },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[site.rooms[0]!.id], "busy");
});

test("host.locked fills in-session only when occupancy is missing", () => {
  const site = demoSite();
  const name = site.rooms[0]!.name;
  const id = site.rooms[0]!.id;
  const locked = occupancyFromPeer({
    site,
    payload: { room: { name }, host: { locked: true } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(locked.rooms[id], "in-session");
  const preferred = occupancyFromPeer({
    site,
    payload: { occupancy: "available", room: { name }, host: { locked: true } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(preferred.rooms[id], "available");
});

test("room as a string does not bind first-class occupancy", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: { occupancy: "closed", room: site.rooms[0]!.name },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[site.rooms[0]!.id], undefined);
});

test("unknown occupancy string is ignored, then vars apply", () => {
  const site = demoSite();
  const name = site.rooms[0]!.name;
  const snap = occupancyFromPeer({
    site,
    payload: {
      occupancy: "maybe",
      room: { name },
      vars: { v1: { name, value: "occupied" } },
    },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[site.rooms[0]!.id], "in-session");
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
