import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSite, migrateToRoomAppliance } from "./seed.ts";

test("first boot has open glass off and all-day hours", () => {
  const site = demoSite();
  assert.equal(site.openGlass, false);
  assert.equal(site.rooms[0]?.hours.start, "00:00");
  assert.equal(site.rooms[0]?.hours.end, "00:00");
  assert.equal(site.displays.some((row) => row.template === "wayfinding"), false);
  assert.equal(site.avLanNicIndex, null);
  assert.equal(site.outboundNicIndex, null);
  assert.equal(site.relayEnabled, true);
  assert.equal(site.relayUrl, "http://127.0.0.1:8081");
  assert.equal(site.rooms[0]?.occupancy, "auto");
});

test("loopback migrate turns occupancy poll on", () => {
  const site = demoSite();
  site.demoRev = 4;
  site.relayEnabled = false;
  site.relayUrl = "http://127.0.0.1:8081";
  const next = migrateToRoomAppliance(site);
  assert.equal(next.relayEnabled, true);
  assert.equal(next.relayUrl, "http://127.0.0.1:8081");
});
