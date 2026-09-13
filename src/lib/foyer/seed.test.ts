import assert from "node:assert/strict";
import { test } from "node:test";
import { demoSite } from "./seed.ts";

test("first boot has open glass off and all-day hours", () => {
  const site = demoSite();
  assert.equal(site.openGlass, false);
  assert.equal(site.rooms[0]?.hours.start, "00:00");
  assert.equal(site.rooms[0]?.hours.end, "00:00");
  assert.equal(site.displays.some((row) => row.template === "wayfinding"), false);
});
