import { arrowForTemplate, normalizeLook, youAreHereForTemplate } from "./look.ts";
import { sanitizeMeeting, sanitizeMessage, sanitizeTitle } from "./sanitize.ts";
import { displayBindings, getFloorLabel, getRoom, lookForDisplay, roomCatalog } from "./site.ts";
import type {
  CalendarSnapshot,
  Display,
  Frame,
  Hours,
  Look,
  Meeting,
  OccupancySnapshot,
  Pane,
  Room,
  Site,
  Status,
} from "./types.ts";

const STARTING_SOON_MS = 10 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ComposeInput = {
  site: Site;
  display: Display;
  look?: Look;
  calendar: CalendarSnapshot;
  occupancy?: OccupancySnapshot | null;
  now: Date;
  seq?: number;
  pairing: Frame["pairing"];
};

export function zonedParts(now: Date, timeZone: string) {
  const tz = timeZone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const grab = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const weekday = WEEKDAYS.indexOf(grab("weekday"));
    const hour = Number(grab("hour"));
    const minute = Number(grab("minute"));
    return {
      weekday: weekday >= 0 ? weekday : now.getUTCDay(),
      minutes: hour * 60 + minute,
      timeZone: tz,
    };
  } catch {
    return {
      weekday: now.getUTCDay(),
      minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
      timeZone: "UTC",
    };
  }
}

function parseHm(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function inHours(hours: Hours, now: Date, timeZone = "UTC") {
  const zoned = zonedParts(now, timeZone);
  if (!hours.days.length) return true;
  if (!hours.days.includes(zoned.weekday)) return false;
  const start = parseHm(hours.start);
  const end = parseHm(hours.end);
  if (start === null || end === null) return true;
  const cur = zoned.minutes;
  if (start === end) return true;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

function meetingSoon(meeting: Meeting | null, now: Date) {
  if (!meeting) return false;
  const start = Date.parse(meeting.startIso);
  if (!Number.isFinite(start)) return false;
  const delta = start - now.getTime();
  return delta > 0 && delta <= STARTING_SOON_MS;
}

function meetingCurrent(meeting: Meeting | null, now: Date) {
  if (!meeting) return false;
  const start = Date.parse(meeting.startIso);
  const end = Date.parse(meeting.endIso);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return false;
  const t = now.getTime();
  return t >= start && t < end;
}

function statusForRoom(
  room: Room | undefined,
  cal: CalendarSnapshot["rooms"][string] | undefined,
  now: Date,
  timeZone: string,
  relay?: OccupancySnapshot["rooms"][string],
): Status {
  if (!room) return "closed";
  if (room.occupancy === "closed") return "closed";
  if (room.occupancy === "in-session") return "in-session";
  if (room.occupancy === "available") return "available";
  if (relay === "closed") return "closed";
  if (relay === "in-session") return "in-session";
  if (relay === "busy") return "busy";
  if (!inHours(room.hours, now, timeZone)) return "closed";
  if (cal?.busy && meetingCurrent(cal.now, now)) return "busy";
  if (meetingCurrent(cal?.now ?? null, now)) return "in-session";
  if (meetingSoon(cal?.next ?? null, now) || meetingSoon(cal?.now ?? null, now)) return "starting-soon";
  return "available";
}

function cleanMeeting(meeting: Meeting | null, opts: { busy?: boolean; template: Display["template"] }) {
  const fallback = opts.template === "door" || opts.template === "split" ? "Meeting" : "";
  return sanitizeMeeting(meeting, { busy: opts.busy, emptyTitleFallback: fallback });
}

function paneFor(
  site: Site,
  calendar: CalendarSnapshot,
  occupancy: OccupancySnapshot | null | undefined,
  now: Date,
  template: Display["template"],
  roomId: string,
  slot: Pane["slot"],
): Pane | null {
  const room = getRoom(site, roomId);
  if (!room) return null;
  const cal = calendar.rooms[roomId];
  const status = statusForRoom(room, cal, now, site.timezone, occupancy?.rooms[roomId]);
  return {
    slot,
    roomId: room.id,
    roomName: room.name,
    status,
    now: cleanMeeting(cal?.now ?? null, { busy: false, template }),
    next: cleanMeeting(cal?.next ?? null, { busy: false, template }),
  };
}

export function composeFrame(input: ComposeInput): Frame {
  const { site, display, calendar, now } = input;
  const onlyRoom = site.rooms.length === 1 ? site.rooms[0] : null;
  const bindings = displayBindings(display).length
    ? displayBindings(display)
    : onlyRoom && (display.template === "welcome" || display.template === "door")
      ? [{ roomId: onlyRoom.id, slot: "single" as const, arrow: "off" as const }]
      : [];
  const rawLook = normalizeLook(input.look ?? lookForDisplay(site, display.id));
  const look: Look = {
    ...rawLook,
    arrow: arrowForTemplate(display.template, rawLook.arrow),
    youAreHereDeg: youAreHereForTemplate(display.template, rawLook.youAreHereDeg),
  };
  const panes = bindings
    .map((bind) => paneFor(site, calendar, input.occupancy, now, display.template, bind.roomId, bind.slot))
    .filter((item): item is Pane => Boolean(item));
  const primary = panes[0] ?? null;
  const room = getRoom(site, primary?.roomId ?? display.roomId);
  const unassigned = !room && (display.template === "door" || display.template === "welcome");
  const status = primary?.status ?? (room || display.template === "wayfinding" || unassigned ? "available" : "closed");
  const directory =
    display.template === "wayfinding"
      ? displayBindings(display).flatMap((bind) => {
          const item = getRoom(site, bind.roomId);
          if (!item) return [];
          const pane = paneFor(site, calendar, input.occupancy, now, "wayfinding", item.id, "single");
          const session = pane?.now ?? pane?.next ?? null;
          return [
            {
              roomId: item.id,
              name: item.name,
              status: pane?.status ?? "closed",
              nextLabel: session?.title ?? null,
              description: session?.description || null,
              arrow: bind.arrow ?? "off",
            },
          ];
        })
      : [];

  const roomNames = panes.map((pane) => pane.roomName);
  return {
    v: 1,
    seq: input.seq ?? 0,
    displayId: display.id,
    roomId: primary?.roomId ?? display.roomId,
    template: display.template,
    look,
    identity: {
      siteName: site.name,
      roomName: roomNames.length ? roomNames.join(" · ") : (room?.name ?? site.name),
      floorLabel: site.floors.length > 1 ? getFloorLabel(site, room?.floorId) : "",
      logoUrl: look.logoOn ? site.logoPath : null,
    },
    status,
    clock: { iso: now.toISOString(), timezone: site.timezone || "UTC" },
    now: primary?.now ?? null,
    next: primary?.next ?? null,
    following: (calendar.rooms[primary?.roomId ?? ""]?.later ?? [])
      .slice(0, 4)
      .map((item) => cleanMeeting(item, { busy: false, template: display.template }))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    panes,
    directory,
    catalog: roomCatalog(site),
    message:
      display.template === "message"
        ? { title: sanitizeTitle(site.name), body: sanitizeMessage("") }
        : null,
    pairing: input.pairing,
    openGlass: Boolean(site.openGlass),
  };
}
