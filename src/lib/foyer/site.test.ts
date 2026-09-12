import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TIMEZONE, TIMEZONES, timezoneOptions } from "./site.ts";

test("timezone dropdown includes Amsterdam default and Chicago", () => {
  assert.equal(DEFAULT_TIMEZONE, "Europe/Amsterdam");
  assert.ok(TIMEZONES.includes("Europe/Amsterdam"));
  assert.ok(TIMEZONES.includes("America/Chicago"));
  assert.ok(TIMEZONES.includes("UTC"));
});

test("unknown current timezone stays on the dropdown", () => {
  const rows = timezoneOptions("Pacific/Honolulu");
  assert.equal(rows[0], "Pacific/Honolulu");
  assert.ok(rows.includes("Europe/Amsterdam"));
});
