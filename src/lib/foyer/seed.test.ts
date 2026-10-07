import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ROOM_APPLIANCE_REV,
  applyRelayDefaults,
  demoSite,
  migrateToRoomAppliance,
  needsRoomAppliance,
  relayUrlDefaults,
} from "./seed.ts";

test("first boot has open glass off and all-day hours", () => {
  const site = demoSite();
  assert.equal(site.openGlass, false);
  assert.equal(site.rooms[0]?.hours.start, "00:00");
  assert.equal(site.rooms[0]?.hours.end, "00:00");
  assert.equal(site.displays.some((row) => row.template === "wayfinding"), false);
  assert.equal(site.avLanNicIndex, null);
  assert.equal(site.outboundNicIndex, null);
  assert.equal(site.relayDeviceId, null);
  assert.ok(site.relayUrl == null || site.relayUrl.startsWith("http://"));
  assert.equal(site.rooms[0]?.occupancy, "auto");
});

test("loopback migrate keeps a lab Relay URL when AV is unset", () => {
  const site = demoSite();
  site.demoRev = 4;
  site.relayUrl = "http://127.0.0.1:8081";
  const next = migrateToRoomAppliance(site);
  assert.equal(next.relayUrl, "http://127.0.0.1:8081");
});

test("rewrite loopback → AV on load after demoRev already current", () => {
  const site = demoSite();
  site.demoRev = ROOM_APPLIANCE_REV;
  site.relayUrl = "http://127.0.0.1:8081";
  assert.equal(needsRoomAppliance(site), false);
  const next = relayUrlDefaults(site, "10.0.25.10");
  assert.equal(next.relayUrl, "http://10.0.25.10:8081");
  // applyRelayDefaults with no AV leaves sticky loopback (lab / unset AV).
  const sticky = applyRelayDefaults(site);
  assert.equal(sticky.relayUrl, "http://127.0.0.1:8081");
});

test("empty Relay URL fills from AV when set", () => {
  const site = demoSite();
  site.relayUrl = null;
  const next = relayUrlDefaults(site, "10.0.25.10");
  assert.equal(next.relayUrl, "http://10.0.25.10:8081");
});

test("non-loopback custom Relay URL is left alone", () => {
  const site = demoSite();
  site.demoRev = ROOM_APPLIANCE_REV;
  site.relayUrl = "http://10.0.25.99:8081";
  const next = relayUrlDefaults(site, "10.0.25.10");
  assert.equal(next.relayUrl, "http://10.0.25.99:8081");
  const sameAv = relayUrlDefaults(site, "10.0.25.99");
  assert.equal(sameAv.relayUrl, "http://10.0.25.99:8081");
});
