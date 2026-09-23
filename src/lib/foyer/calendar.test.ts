import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIcsEvents, snapshotFromEvents, buildCalendarSnapshot, emptyCalendarSnapshot, icsHostHint, sessionFromCalendar } from "./calendar.ts";
import { demoSite } from "./seed.ts";

const ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260911T100000Z
DTEND:20260911T110000Z
SUMMARY:{Cedar} Design review
DESCRIPTION:{Cedar} Walk the north wall.\\nBring samples.
END:VEVENT
BEGIN:VEVENT
DTSTART:20260911T120000Z
DTEND:20260911T130000Z
SUMMARY:{Maple} Workshop
DESCRIPTION:Whiteboard is live.
END:VEVENT
BEGIN:VEVENT
DTSTART:20260911T140000Z
DTEND:20260911T150000Z
SUMMARY:Unscoped event
DESCRIPTION:Should not land on a shared feed.
END:VEVENT
END:VCALENDAR`;

test("{roomname} tokens route events and are stripped from the title", () => {
  const events = parseIcsEvents(ICS);
  assert.equal(events.length, 3);
  assert.deepEqual(events[0]?.tokens, ["Cedar", "Cedar"]);
  const site = demoSite();
  const snap = snapshotFromEvents({
    site,
    eventsByFeed: { shared: events },
    now: new Date("2026-09-11T10:30:00Z"),
  });
  assert.equal(snap.rooms.cedar?.now?.title, "Design review");
  assert.equal(snap.rooms.cedar?.now?.description.includes("{"), false);
  assert.match(snap.rooms.cedar?.now?.description ?? "", /north wall/i);
  assert.equal(snap.rooms.maple, undefined);
});

test("untagged events land on the only room on this PC", () => {
  const events = parseIcsEvents(ICS);
  const site = demoSite();
  const snap = snapshotFromEvents({
    site,
    eventsByFeed: { shared: events },
    now: new Date("2026-09-11T14:10:00Z"),
  });
  assert.equal(snap.rooms.cedar?.now?.title, "Unscoped event");
});

test("ICS HTML is not kept", () => {
  const events = parseIcsEvents(`BEGIN:VEVENT
DTSTART:20260911T100000Z
DTEND:20260911T110000Z
SUMMARY:{Cedar} <script>x</script> Q3
DESCRIPTION:<b>bold</b>
END:VEVENT`);
  const site = demoSite();
  const snap = snapshotFromEvents({
    site,
    eventsByFeed: { shared: events },
    now: new Date("2026-09-11T10:30:00Z"),
  });
  assert.equal(snap.rooms.cedar?.now?.title, "Q3");
  assert.equal(snap.rooms.cedar?.now?.description.includes("<"), false);
});

test("overlapping meetings prefer the later start as now", () => {
  const site = demoSite();
  const snap = snapshotFromEvents({
    site,
    eventsByFeed: {
      shared: [
        {
          title: "{Cedar} Morning",
          host: "",
          description: "",
          startIso: "2026-09-11T10:00:00Z",
          endIso: "2026-09-11T12:00:00Z",
          busy: false,
          tokens: ["Cedar"],
        },
        {
          title: "{Cedar} Late start",
          host: "",
          description: "",
          startIso: "2026-09-11T11:00:00Z",
          endIso: "2026-09-11T13:00:00Z",
          busy: false,
          tokens: ["Cedar"],
        },
      ],
    },
    now: new Date("2026-09-11T11:30:00Z"),
  });
  assert.equal(snap.rooms.cedar?.now?.title, "Late start");
  assert.equal(snap.rooms.cedar?.next, null);
});

test("later holds up to four upcoming sessions", () => {
  const site = demoSite();
  const events = [1, 2, 3, 4].map((hour) => ({
    title: `{Cedar} Slot ${hour}`,
    host: "",
    description: "",
    startIso: `2026-09-11T${String(10 + hour).padStart(2, "0")}:00:00Z`,
    endIso: `2026-09-11T${String(10 + hour).padStart(2, "0")}:30:00Z`,
    busy: false,
    tokens: ["Cedar"],
  }));
  const snap = snapshotFromEvents({
    site,
    eventsByFeed: { shared: events },
    now: new Date("2026-09-11T10:00:00Z"),
  });
  assert.equal(snap.rooms.cedar?.now, null);
  assert.equal(snap.rooms.cedar?.next?.title, "Slot 1");
  assert.equal(snap.rooms.cedar?.later?.map((row) => row.title).join(","), "Slot 1,Slot 2,Slot 3,Slot 4");
});

test("calendar bind required without an address keeps last-good", async () => {
  const last = emptyCalendarSnapshot(new Date("2026-01-01T00:00:00Z"));
  last.rooms = {
    cedar: {
      now: { title: "Kept", host: "", description: "", startIso: "2026-01-01T00:00:00Z", endIso: "2026-01-01T01:00:00Z" },
      next: null,
      later: [],
    },
  };
  const snap = await buildCalendarSnapshot({
    site: demoSite(),
    icsUrls: { shared: "https://example.invalid/cal.ics" },
    lastGood: last,
    localAddress: null,
    requireBind: true,
  });
  assert.equal(snap.rooms.cedar?.now?.title, "Kept");
});

test("ics host hint never includes the path or query", () => {
  assert.equal(
    icsHostHint("https://calendar.google.com/calendar/ical/secret/private-xxx/basic.ics"),
    "calendar.google.com",
  );
  assert.equal(icsHostHint(""), "");
});

test("sessionFromCalendar prefers the live meeting, else the next one", () => {
  const site = demoSite();
  const now = new Date("2026-09-11T10:30:00Z");
  const snap = snapshotFromEvents({
    site,
    eventsByFeed: {
      shared: [
        {
          title: "{Cedar} Design review",
          host: "",
          description: "",
          startIso: "2026-09-11T10:00:00Z",
          endIso: "2026-09-11T11:00:00Z",
          busy: false,
          tokens: ["Cedar"],
        },
        {
          title: "{Cedar} Board lunch",
          host: "",
          description: "",
          startIso: "2026-09-11T12:00:00Z",
          endIso: "2026-09-11T13:00:00Z",
          busy: false,
          tokens: ["Cedar"],
        },
      ],
    },
    now,
  });
  const live = sessionFromCalendar({ snapshot: snap, roomId: "cedar", now });
  assert.equal(live?.kind, "now");
  assert.equal(live?.title, "Design review");
  assert.equal(live?.startIso, "2026-09-11T10:00:00Z");
  assert.equal(live?.endIso, "2026-09-11T11:00:00Z");
  const later = sessionFromCalendar({ snapshot: snap, roomId: "cedar", now: new Date("2026-09-11T11:10:00Z") });
  assert.equal(later?.kind, "next");
  assert.equal(later?.title, "Board lunch");
  const empty = sessionFromCalendar({ snapshot: snap, roomId: "cedar", now: new Date("2026-09-11T18:00:00Z") });
  assert.equal(empty, null);
});

