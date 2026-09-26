import { sanitizeMeeting, sanitizeTitle, sanitizeDescription } from "./sanitize.ts";
import { findRoomByName } from "./site.ts";
import type { CalendarSnapshot, Meeting, Room, Site } from "./types.ts";

const ICS_MAX_BYTES = 512_000;
const ICS_TIMEOUT_MS = 15_000;
const ICS_UA = "Foyer/0.1 (room signage; +https://github.com/richardosseweijer/Foyer-Room-Signage)";

export type ParsedEvent = {
  title: string;
  host: string;
  description: string;
  startIso: string;
  endIso: string;
  busy: boolean;
  tokens: string[];
};

export const FOLLOWING_MAX = 12;

export function emptyCalendarSnapshot(now = new Date()): CalendarSnapshot {
  return { atIso: now.toISOString(), rooms: {} };
}

export function icsHostHint(url: string | undefined | null) {
  const raw = url?.trim() ?? "";
  if (!raw) return "";
  try {
    return new URL(raw).hostname || "stored";
  } catch {
    return "stored";
  }
}

function unfoldIcs(raw: string) {
  return raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeIcs(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function icsDateToIso(value: string, tz?: string) {
  const compact = value.trim();
  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}T00:00:00Z`;
  }
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(compact);
  if (!match) return "";
  const stamp = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  if (match[7] === "Z" || !tz) return `${stamp}Z`;
  try {
    const asUtc = new Date(`${stamp}Z`);
    const shown = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(asUtc);
    const grab = (type: string) => Number(shown.find((part) => part.type === type)?.value);
    const fake = Date.UTC(grab("year"), grab("month") - 1, grab("day"), grab("hour"), grab("minute"), grab("second"));
    const offset = fake - asUtc.getTime();
    return new Date(asUtc.getTime() - offset).toISOString();
  } catch {
    return `${stamp}Z`;
  }
}

function extractTokens(text: string) {
  const tokens: string[] = [];
  const re = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const name = match[1].trim();
    if (name) tokens.push(name);
  }
  return tokens;
}

function stripTokens(text: string) {
  return text.replace(/\{[^}]+\}/g, " ").replace(/\s+/g, " ").trim();
}

export function parseIcsEvents(ics: string): ParsedEvent[] {
  const body = unfoldIcs(ics);
  const blocks = body.split(/BEGIN:VEVENT/i).slice(1);
  const events: ParsedEvent[] = [];
  for (const block of blocks) {
    const inner = block.split(/END:VEVENT/i)[0] ?? "";
    const fields: Record<string, string> = {};
    const params: Record<string, string> = {};
    for (const line of inner.split("\n")) {
      const cut = line.indexOf(":");
      if (cut < 1) continue;
      const left = line.slice(0, cut);
      const value = unescapeIcs(line.slice(cut + 1).trim());
      const name = left.split(";")[0].toUpperCase();
      fields[name] = value;
      const tzid = /TZID=([^;:]+)/i.exec(left);
      if (tzid) params[`${name}_TZ`] = tzid[1];
    }
    const startIso = icsDateToIso(fields.DTSTART ?? "", params.DTSTART_TZ);
    let endIso = icsDateToIso(fields.DTEND ?? "", params.DTEND_TZ);
    if (startIso && !endIso) {
      const start = Date.parse(startIso);
      endIso = Number.isFinite(start) ? new Date(start + 60 * 60 * 1000).toISOString() : startIso;
    }
    if (!startIso || !endIso) continue;
    const title = fields.SUMMARY ?? "";
    const description = fields.DESCRIPTION ?? "";
    const host = /CN=([^:;]+)/i.exec(fields.ORGANIZER ?? "")?.[1] ?? "";
    const klass = (fields.CLASS ?? "").toUpperCase();
    const busy = klass === "PRIVATE" || klass === "CONFIDENTIAL";
    const tokens = [...extractTokens(title), ...extractTokens(description)];
    events.push({ title, host, description, startIso, endIso, busy, tokens });
  }
  return events;
}

function toMeeting(event: ParsedEvent, busy: boolean): Meeting {
  const title = stripTokens(event.title);
  return {
    title: sanitizeTitle(title, { busy, fallback: "Meeting" }),
    host: event.host,
    description: sanitizeDescription(stripTokens(event.description), { busy }),
    startIso: event.startIso,
    endIso: event.endIso,
  };
}

function roomIdsForEvent(event: ParsedEvent, site: Site, feedId: string) {
  const ids = new Set<string>();
  for (const token of event.tokens) {
    const room = findRoomByName(site, token);
    if (room) ids.add(room.id);
  }
  if (ids.size) return ids;
  if (site.rooms.length === 1 && site.rooms[0]) {
    ids.add(site.rooms[0].id);
    return ids;
  }
  if (site.sharedCalendarId === feedId) return ids;
  for (const room of site.rooms) {
    if (room.calendarId === feedId) ids.add(room.id);
  }
  return ids;
}

export function snapshotFromEvents(opts: {
  site: Site;
  eventsByFeed: Record<string, ParsedEvent[]>;
  now: Date;
}): CalendarSnapshot {
  const buckets: Record<string, ParsedEvent[]> = {};
  for (const room of opts.site.rooms) buckets[room.id] = [];
  for (const [feedId, events] of Object.entries(opts.eventsByFeed)) {
    for (const event of events) {
      for (const roomId of roomIdsForEvent(event, opts.site, feedId)) {
        (buckets[roomId] ??= []).push(event);
      }
    }
  }
  const rooms: CalendarSnapshot["rooms"] = {};
  const nowMs = opts.now.getTime();
  for (const [roomId, events] of Object.entries(buckets)) {
    const sorted = events
      .slice()
      .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso));
    const covering = sorted.filter((event) => {
      const start = Date.parse(event.startIso);
      const end = Date.parse(event.endIso);
      return start <= nowMs && nowMs < end;
    });
    const current = covering[covering.length - 1];
    const upcoming = sorted.filter((event) => Date.parse(event.startIso) > nowMs);
    rooms[roomId] = {
      now: current ? toMeeting(current, current.busy) : null,
      next: upcoming[0] ? toMeeting(upcoming[0], upcoming[0].busy) : null,
      later: upcoming.slice(0, FOLLOWING_MAX).map((event) => toMeeting(event, event.busy)),
      busy: Boolean(current?.busy),
    };
  }
  return { atIso: opts.now.toISOString(), rooms };
}

export async function fetchIcs(url: string, localAddress?: string | null): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ICS_TIMEOUT_MS);
  try {
    const res = await boundFetch(url, controller.signal, localAddress);
    if (!res.ok) throw new Error(`ics ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > ICS_MAX_BYTES) throw new Error("ics too large");
    return new TextDecoder("utf8").decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

async function boundFetch(url: string, signal: AbortSignal, localAddress?: string | null) {
  const headers = { "user-agent": ICS_UA, accept: "text/calendar, text/plain, */*" };
  if (!localAddress) return fetch(url, { signal, redirect: "follow", headers });
  const { Agent, fetch: undiciFetch } = await import("undici");
  return undiciFetch(url, {
    signal,
    redirect: "follow",
    headers,
    dispatcher: new Agent({ connect: { localAddress } }),
  });
}

export async function buildCalendarSnapshot(opts: {
  site: Site;
  icsUrls: Record<string, string>;
  now?: Date;
  lastGood?: CalendarSnapshot | null;
  localAddress?: string | null;
  requireBind?: boolean;
}): Promise<CalendarSnapshot> {
  const now = opts.now ?? new Date();
  if (opts.requireBind && !opts.localAddress) {
    return opts.lastGood ?? emptyCalendarSnapshot(now);
  }
  const eventsByFeed: Record<string, ParsedEvent[]> = {};
  let failed = false;
  for (const feed of opts.site.calendars) {
    const url = opts.icsUrls[feed.id]?.trim();
    if (!url) continue;
    try {
      const ics = await fetchIcs(url, opts.localAddress);
      eventsByFeed[feed.id] = parseIcsEvents(ics);
    } catch {
      failed = true;
    }
  }
  // No ICS URL linked → empty rooms (never fabricate demo meetings).
  if (failed && opts.lastGood) {
    return opts.lastGood;
  } else if (failed && !Object.keys(eventsByFeed).length && opts.lastGood) {
    return opts.lastGood;
  }
  return snapshotFromEvents({ site: opts.site, eventsByFeed, now });
}

export type PeerSession = {
  kind: "now" | "next";
  title: string;
  startIso: string;
  endIso: string;
};

/** Current meeting if one is live; otherwise the next one. Null if the room is empty. */
export function sessionFromCalendar(opts: {
  snapshot: CalendarSnapshot;
  roomId?: string | null;
  now?: Date;
}): PeerSession | null {
  const rooms = opts.snapshot.rooms;
  const row = (opts.roomId && rooms[opts.roomId]) || Object.values(rooms)[0];
  if (!row) return null;
  const nowMs = (opts.now ?? new Date()).getTime();
  const live = row.now;
  if (live) {
    const start = Date.parse(live.startIso);
    const end = Date.parse(live.endIso);
    if (Number.isFinite(start) && Number.isFinite(end) && start <= nowMs && nowMs < end) {
      return { kind: "now", title: live.title, startIso: live.startIso, endIso: live.endIso };
    }
  }
  const upcoming = row.next;
  if (upcoming) {
    const start = Date.parse(upcoming.startIso);
    if (Number.isFinite(start) && start > nowMs) {
      return { kind: "next", title: upcoming.title, startIso: upcoming.startIso, endIso: upcoming.endIso };
    }
  }
  return null;
}

export function sanitizeSnapshot(snapshot: CalendarSnapshot): CalendarSnapshot {
  const rooms: CalendarSnapshot["rooms"] = {};
  for (const [id, row] of Object.entries(snapshot.rooms)) {
    const busy = Boolean(row.busy);
    rooms[id] = {
      now: sanitizeMeeting(row.now, { busy, emptyTitleFallback: "Meeting" }),
      next: sanitizeMeeting(row.next, { busy, emptyTitleFallback: "Meeting" }),
      later: (row.later ?? []).slice(0, FOLLOWING_MAX).map((item) => sanitizeMeeting(item, { busy: false, emptyTitleFallback: "Meeting" })).filter((item): item is Meeting => Boolean(item)),
      busy,
    };
  }
  return { atIso: snapshot.atIso, rooms };
}

export type { Room };
