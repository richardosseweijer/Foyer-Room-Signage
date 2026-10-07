import assert from "node:assert/strict";
import { test } from "node:test";
import { ROOM_APPLIANCE_REV, demoSite, migrateToRoomAppliance, needsRoomAppliance } from "./seed.ts";

test("first boot has open glass off and all-day hours", () => {
  const site = demoSite();
  assert.equal(site.openGlass, false);
  assert.equal(site.rooms[0]?.hours.start, "00:00");
  assert.equal(site.rooms[0]?.hours.end, "00:00");
  assert.equal(site.displays.some((row) => row.template === "wayfinding"), false);
  assert.equal(site.avLanNicIndex, null);
  assert.equal(site.outboundNicIndex, null);
  assert.equal(site.relayDeviceId, null);
  assert.equal(site.rooms[0]?.occupancy, "auto");
});


test("an old board-plates site migrates to the room appliance with no Relay URL stored", () => {
  const site = demoSite();
  site.demoRev = 4;
  site.displays = site.displays.filter((row) => row.template !== "door");
  assert.equal(needsRoomAppliance(site), true);
  const next = migrateToRoomAppliance(site);
  assert.equal(next.demoRev, ROOM_APPLIANCE_REV);
  assert.equal("relayUrl" in next, false);
});
