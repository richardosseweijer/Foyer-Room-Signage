import assert from "node:assert/strict";
import { test } from "node:test";
import { composeFrame } from "./compose.ts";
import { defaultLook } from "./look.ts";
import { emptyCalendarSnapshot } from "./calendar.ts";
import { emptySite } from "./site.ts";
import { parseFrame, parseSecrets, parseSite, type Display, type Site } from "./types.ts";

function sampleSite(): Site {
  const site = emptySite();
  site.name = "North";
  site.floors = [{ id: "f1", label: "1" }];
  site.rooms = [
    {
      id: "cedar",
      name: "Cedar",
      floorId: "f1",
      hours: { start: "00:00", end: "23:59", days: [0, 1, 2, 3, 4, 5, 6] },
      occupancy: "auto",
      calendarId: null,
    },
  ];
  site.displays = [
    { id: "d1", label: "Cedar door", roomId: "cedar", zoneId: null, template: "door", bindings: [{ roomId: "cedar", slot: "single", arrow: "off" }] },
  ];
  site.looks = { d1: defaultLook() };
  return site;
}

function frameOf(site = sampleSite(), display?: Display) {
  const item = display ?? site.displays[0]!;
  return composeFrame({
    site,
    display: item,
    calendar: emptyCalendarSnapshot(new Date("2026-09-12T12:00:00Z")),
    now: new Date("2026-09-12T12:00:00Z"),
    pairing: { bound: true },
  });
}

test("composer output parses as Frame", () => {
  const parsed = parseFrame(frameOf());
  assert.equal(parsed.success, true);
});

test("extra icsUrl on a frame fails parse", () => {
  const parsed = parseFrame({ ...frameOf(), icsUrl: "https://evil.example/cal.ics" });
  assert.equal(parsed.success, false);
});

test("extra pin on a frame fails parse", () => {
  const parsed = parseFrame({ ...frameOf(), pin: "1234" });
  assert.equal(parsed.success, false);
});

test("unknown template fails parse", () => {
  const parsed = parseFrame({ ...frameOf(), template: "kiosk" });
  assert.equal(parsed.success, false);
});

test("secrets schema is not a frame", () => {
  const secrets = {
    v: 1,
    sitePinHash: "scrypt$a$b",
    techPinHash: "",
    sitePinMustChange: true,
    displayTokens: {},
    icsUrls: { cedar: "https://calendar.google.com/secret" },
    relaySecret: "hidden",
  };
  assert.equal(parseSecrets(secrets).success, true);
  assert.equal(parseFrame(secrets).success, false);
});

test("looks without arrow still parse", () => {
  const site = sampleSite();
  const look = { ...site.looks.d1! };
  const raw = JSON.parse(JSON.stringify(site)) as Site;
  delete (raw.looks.d1 as { arrow?: string }).arrow;
  const parsed = parseSite(raw);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.looks.d1?.arrow, look.arrow);
});

test("site without nic or video fields still parses", () => {
  const raw = JSON.parse(JSON.stringify(sampleSite())) as Record<string, unknown>;
  delete raw.outboundNicIndex;
  delete raw.outboundNicName;
  delete raw.videoOutputIndex;
  delete raw.videoOutputName;
  const parsed = parseSite(raw);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.outboundNicIndex, null);
    assert.equal(parsed.data.videoOutputName, null);
  }
});

