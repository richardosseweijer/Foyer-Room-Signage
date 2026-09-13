import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { composeFrame, inHours } from "./compose.ts";
import { defaultLook } from "./look.ts";
import { emptyCalendarSnapshot } from "./calendar.ts";
import { emptySite } from "./site.ts";
import type { CalendarSnapshot, Display, Site } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));

function siteWith(roomOccupancy: Site["rooms"][0]["occupancy"] = "auto"): Site {
  const site = emptySite();
  site.timezone = "UTC";
  site.floors = [{ id: "f1", label: "1" }];
  site.rooms = [
    {
      id: "cedar",
      name: "Cedar",
      floorId: "f1",
      hours: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
      occupancy: roomOccupancy,
      calendarId: null,
    },
  ];
  site.displays = [
    { id: "door", label: "Door", roomId: "cedar", bindings: [], zoneId: null, template: "door" },
    {
      id: "way",
      label: "Lobby",
      roomId: null,
      bindings: [{ roomId: "cedar", slot: "single", arrow: "left" }],
      zoneId: "lobby",
      template: "wayfinding",
    },
  ];
  site.looks = {
    door: { ...defaultLook(), arrow: "right" },
    way: { ...defaultLook(), arrow: "left" },
  };
  return site;
}

function frame(opts: {
  site?: Site;
  display?: Display;
  calendar?: CalendarSnapshot;
  now?: Date;
}) {
  const site = opts.site ?? siteWith();
  const display = opts.display ?? site.displays[0]!;
  const now = opts.now ?? new Date("2026-09-11T12:00:00Z");
  return composeFrame({
    site,
    display,
    calendar: opts.calendar ?? emptyCalendarSnapshot(now),
    now,
    pairing: { bound: true },
  });
}

test("compose.ts does not import fs, fetch, websocket, or secrets", () => {
  const src = readFileSync(join(here, "compose.ts"), "utf8");
  assert.equal(/from ["']node:fs["']/.test(src), false);
  assert.equal(/from ["']fs["']/.test(src), false);
  assert.equal(/\bfetch\s*\(/.test(src), false);
  assert.equal(/WebSocket/.test(src), false);
  assert.equal(/from ["']\.\/secrets\.ts["']/.test(src), false);
  assert.equal(/from ["']\.\/persist\.ts["']/.test(src), false);
  assert.equal(/from ["']\.\/calendar\.ts["']/.test(src), false);
  assert.equal(/from ["']\.\/relay\.ts["']/.test(src), false);
  assert.equal(/from ["']react["']/.test(src), false);
});

test("closed override hides meetings", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: { title: "Budget", host: "Ada", description: "Agenda in the pack.", startIso: "2026-09-11T11:00:00Z", endIso: "2026-09-11T13:00:00Z" },
        next: null,
      },
    },
  };
  const out = frame({ site: siteWith("closed"), calendar, now });
  assert.equal(out.status, "closed");
  assert.equal(out.now, null);
  assert.equal(out.next, null);
});

test("manual available still shows the meeting on the door", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: {
          title: "Budget",
          host: "Ada",
          description: "",
          startIso: "2026-09-11T11:00:00Z",
          endIso: "2026-09-11T13:00:00Z",
        },
        next: null,
      },
    },
  };
  const out = frame({ site: siteWith("available"), calendar, now });
  assert.equal(out.status, "available");
  assert.equal(out.now?.title, "Budget");
});

test("starting-soon window is ten minutes", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: null,
        next: { title: "Standup", host: "", description: "", startIso: "2026-09-11T12:08:00Z", endIso: "2026-09-11T12:30:00Z" },
      },
    },
  };
  assert.equal(frame({ calendar, now }).status, "starting-soon");
});

test("after hours is closed when occupancy is auto", () => {
  const now = new Date("2026-09-11T20:00:00Z");
  assert.equal(frame({ now }).status, "closed");
});

test("after hours still keeps the next session on the door", () => {
  const now = new Date("2026-09-11T20:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: null,
        next: {
          title: "Late session",
          host: "",
          description: "",
          startIso: "2026-09-11T21:00:00Z",
          endIso: "2026-09-11T22:00:00Z",
        },
      },
    },
  };
  const out = frame({ calendar, now });
  assert.equal(out.status, "closed");
  assert.equal(out.next?.title, "Late session");
});

test("welcome still paints the session after hours", () => {
  const site = siteWith();
  site.displays.push({
    id: "welcome",
    label: "Welcome",
    roomId: "cedar",
    bindings: [{ roomId: "cedar", slot: "single", arrow: "off" }],
    zoneId: null,
    template: "welcome",
  });
  const now = new Date("2026-09-11T20:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: null,
        next: {
          title: "Late session",
          host: "",
          description: "On the wall",
          startIso: "2026-09-11T21:00:00Z",
          endIso: "2026-09-11T22:00:00Z",
        },
      },
    },
  };
  const out = frame({ site, display: site.displays[2], calendar, now });
  assert.equal(out.status, "closed");
  assert.equal(out.next?.title, "Late session");
});

test("welcome keeps the session when occupancy is forced available", () => {
  const site = siteWith("available");
  const welcome: Display = {
    id: "welcome",
    label: "Welcome",
    roomId: "cedar",
    bindings: [{ roomId: "cedar", slot: "single", arrow: "off" }],
    zoneId: null,
    template: "welcome",
  };
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: {
          title: "Budget",
          host: "Ada",
          description: "",
          startIso: "2026-09-11T11:00:00Z",
          endIso: "2026-09-11T13:00:00Z",
        },
        next: null,
      },
    },
  };
  const out = frame({ site, display: welcome, calendar, now });
  assert.equal(out.status, "available");
  assert.equal(out.now?.title, "Budget");
});

test("calendar throw path is the caller's job; empty snapshot stays identity + clock", () => {
  const out = frame({ calendar: emptyCalendarSnapshot() });
  assert.equal(out.identity.roomName, "Cedar");
  assert.equal(out.clock.timezone, "UTC");
  assert.ok(out.clock.iso);
});

test("door template forces arrow off even if look stored right", () => {
  assert.equal(frame({}).look.arrow, "off");
});

test("wayfinding keeps arrow", () => {
  const site = siteWith();
  const out = frame({ site, display: site.displays[1] });
  assert.equal(out.look.arrow, "left");
  assert.equal(out.directory.length, 1);
});

test("openGlass on the site is copied onto the frame", () => {
  const site = siteWith();
  site.openGlass = true;
  assert.equal(frame({ site }).openGlass, true);
  site.openGlass = false;
  assert.equal(frame({ site }).openGlass, false);
});

test("HTML in a meeting title is stripped before the frame", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: {
          title: "<script>alert(1)</script> Q3",
          host: "Ada",
          description: "Bring <b>slides</b>",
          startIso: "2026-09-11T11:00:00Z",
          endIso: "2026-09-11T13:00:00Z",
        },
        next: null,
      },
    },
  };
  const out = frame({ calendar, now });
  assert.equal(out.now?.title, "Q3");
  assert.equal(out.now?.description.includes("<"), false);
  assert.equal(JSON.stringify(out).includes("<script"), false);
});

test("inHours skips empty day lists as always-open (hours exist but days empty = open)", () => {
  assert.equal(inHours({ start: "09:00", end: "17:00", days: [] }, new Date("2026-09-11T20:00:00Z")), true);
});

test("split display paints two panes with description", () => {
  const site = siteWith();
  site.rooms.push({
    id: "maple",
    name: "Maple",
    floorId: "f1",
    hours: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
    occupancy: "auto",
    calendarId: null,
  });
  const display: Display = {
    id: "split",
    label: "Corridor",
    roomId: "cedar",
    bindings: [
      { roomId: "cedar", slot: "left", arrow: "off" },
      { roomId: "maple", slot: "right", arrow: "off" },
    ],
    zoneId: "lobby",
    template: "split",
  };
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: { title: "Budget", host: "Ada", description: "North wall.", startIso: "2026-09-11T11:00:00Z", endIso: "2026-09-11T13:00:00Z" },
        next: null,
      },
      maple: {
        now: null,
        next: { title: "Workshop", host: "", description: "Tea at the back.", startIso: "2026-09-11T12:08:00Z", endIso: "2026-09-11T13:00:00Z" },
      },
    },
  };
  const out = frame({ site, display, calendar, now });
  assert.equal(out.template, "split");
  assert.equal(out.panes.length, 2);
  assert.equal(out.panes[0]?.roomName, "Cedar");
  assert.equal(out.panes[0]?.now?.description, "North wall.");
  assert.equal(out.panes[1]?.roomName, "Maple");
  assert.equal(out.panes[1]?.status, "starting-soon");
  assert.equal(out.identity.roomName, "Cedar · Maple");
});

test("wayfinding directory uses the current session, not the next one", () => {
  const site = siteWith();
  site.rooms.push({
    id: "maple",
    name: "Maple",
    floorId: "f1",
    hours: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
    occupancy: "auto",
    calendarId: null,
  });
  site.displays[1] = {
    ...site.displays[1]!,
    bindings: [
      { roomId: "cedar", slot: "single", arrow: "left" },
      { roomId: "maple", slot: "single", arrow: "right" },
    ],
  };
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: {
          title: "Design review",
          host: "Ada",
          description: "North wall finishes.",
          startIso: "2026-09-11T11:00:00Z",
          endIso: "2026-09-11T13:00:00Z",
        },
        next: {
          title: "Board lunch",
          host: "",
          description: "Private dining.",
          startIso: "2026-09-11T14:00:00Z",
          endIso: "2026-09-11T15:00:00Z",
        },
      },
      maple: {
        now: null,
        next: {
          title: "Client workshop",
          host: "Jo",
          description: "Tea at the back.",
          startIso: "2026-09-11T12:08:00Z",
          endIso: "2026-09-11T13:15:00Z",
        },
      },
    },
  };
  const out = frame({ site, display: site.displays[1], calendar, now });
  assert.equal(out.directory.length, 2);
  assert.equal(out.directory[0]?.name, "Cedar");
  assert.equal(out.directory[0]?.nextLabel, "Design review");
  assert.equal(out.directory[0]?.description, "North wall finishes.");
  assert.equal(out.directory[1]?.name, "Maple");
  assert.equal(out.directory[1]?.nextLabel, "Client workshop");
  assert.equal(out.directory[1]?.description, "Tea at the back.");
  assert.equal(out.directory[0]?.arrow, "left");
  assert.equal(out.directory[1]?.arrow, "right");
});

test("unassigned door plate is not closed", () => {
  const site = siteWith();
  site.rooms.push({
    id: "maple",
    name: "Maple",
    floorId: "f1",
    hours: { start: "09:00", end: "17:00", days: [1, 2, 3, 4, 5] },
    occupancy: "auto",
    calendarId: null,
  });
  const display: Display = {
    id: "door",
    label: "Room plate",
    roomId: null,
    bindings: [],
    zoneId: null,
    template: "door",
  };
  const out = frame({ site, display });
  assert.equal(out.status, "available");
  assert.equal(out.now, null);
  assert.equal(out.message, null);
  assert.equal(out.identity.roomName, "Untitled site");
  assert.equal(out.catalog.length, 2);
});

test("one-room door plate uses that room when unbound", () => {
  const site = siteWith();
  const display: Display = {
    id: "door",
    label: "Room plate",
    roomId: null,
    bindings: [],
    zoneId: null,
    template: "door",
  };
  const now = new Date("2026-09-11T12:00:00Z");
  const calendar: CalendarSnapshot = {
    atIso: now.toISOString(),
    rooms: {
      cedar: {
        now: {
          title: "Budget",
          host: "",
          description: "",
          startIso: "2026-09-11T11:00:00Z",
          endIso: "2026-09-11T13:00:00Z",
        },
        next: null,
      },
    },
  };
  const out = frame({ site, display, calendar, now });
  assert.equal(out.identity.roomName, "Cedar");
  assert.equal(out.now?.title, "Budget");
});

test("wayfinding with no bindings shows an empty directory", () => {
  const site = siteWith();
  const display: Display = {
    id: "way",
    label: "Wayfinding",
    roomId: null,
    bindings: [],
    zoneId: null,
    template: "wayfinding",
  };
  const out = frame({ site, display });
  assert.equal(out.directory.length, 0);
  assert.equal(out.catalog.length, 1);
  assert.equal(out.status, "available");
});
