import { defaultLook } from "./look.ts";
import { BOARD_TEMPLATES, parseSite, type Arrow, type Display, type Room, type RoomBinding, type Site } from "./types.ts";

export const DEFAULT_TIMEZONE = "Europe/Amsterdam";

/** Venue clocks. Dropdown in Setup — not a free-text IANA field. */
export const TIMEZONES = [
  "UTC",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Brussels",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Prague",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Africa/Johannesburg",
] as const;

export function timezoneOptions(current?: string | null) {
  const listed = new Set<string>(TIMEZONES);
  const extra = current?.trim() && !listed.has(current.trim()) ? [current.trim()] : [];
  return [...extra, ...TIMEZONES];
}

export const BOARD_LABELS: Record<(typeof BOARD_TEMPLATES)[number], string> = {
  welcome: "Welcome",
  door: "Room plate",
};

export function emptySite(): Site {
  return {
    v: 1,
    name: "Untitled site",
    timezone: DEFAULT_TIMEZONE,
    floors: [],
    rooms: [],
    displays: [],
    looks: {},
    logoPath: null,
    calendars: [],
    sharedCalendarId: null,
    relayUrl: null,
    relayEnabled: false,
    relayRoomMap: {},
    openGlass: false,
    demoRev: 0,
    outboundNicIndex: null,
    outboundNicName: null,
    avLanNicIndex: null,
    avLanNicName: null,
    videoOutputIndex: null,
    videoOutputName: null,
    roomPanelVideoOutputIndex: null,
    roomPanelVideoOutputName: null,
    welcomeFooter: "",
  };
}

export function getDisplay(site: Site, displayId: string): Display | undefined {
  return site.displays.find((item) => item.id === displayId);
}

export function getRoom(site: Site, roomId: string | null | undefined): Room | undefined {
  if (!roomId) return undefined;
  return site.rooms.find((item) => item.id === roomId);
}

export function getFloorLabel(site: Site, floorId: string | undefined) {
  if (!floorId) return "";
  return site.floors.find((item) => item.id === floorId)?.label ?? "";
}

export function lookForDisplay(site: Site, displayId: string) {
  return site.looks[displayId] ?? defaultLook();
}

export function displayBindings(display: Display): RoomBinding[] {
  const rows = display.bindings?.length
    ? display.bindings
    : display.roomId
      ? [{ roomId: display.roomId, slot: "single" as const, arrow: "off" as const }]
      : [];
  return rows.map((row) => ({
    roomId: row.roomId,
    slot: row.slot ?? "single",
    arrow: row.arrow ?? "off",
  }));
}

export function roomCatalog(site: Site) {
  return site.rooms.map((room) => ({ id: room.id, name: room.name }));
}

export function boardPlates(site: Site) {
  return BOARD_TEMPLATES.map((template) => {
    const item = site.displays.find((display) => display.template === template);
    if (!item) return null;
    return { id: item.id, template, label: BOARD_LABELS[template] };
  }).filter((item): item is { id: string; template: (typeof BOARD_TEMPLATES)[number]; label: string } => Boolean(item));
}

export function bindDoorOrWelcome(display: Display, roomId: string | null): Display {
  return {
    ...display,
    roomId,
    bindings: roomId ? [{ roomId, slot: "single", arrow: "off" }] : [],
  };
}

export function bindWayfinding(display: Display, rows: { roomId: string; arrow: Arrow }[]): Display {
  return {
    ...display,
    roomId: null,
    bindings: rows.map((row) => ({ roomId: row.roomId, slot: "single" as const, arrow: row.arrow })),
  };
}

export function displaysBoundToRoom(site: Site, roomId: string) {
  return site.displays.filter((item) => displayBindings(item).some((bind) => bind.roomId === roomId));
}

export function canDeleteRoom(site: Site, roomId: string) {
  return displaysBoundToRoom(site, roomId).length === 0;
}

export function findRoomByName(site: Site, name: string) {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return site.rooms.find((item) => item.name.trim().toLowerCase() === needle || item.id.toLowerCase() === needle);
}

export function parseSiteJson(raw: string): { success: true; data: Site } | { success: false } {
  try {
    const parsed = parseSite(JSON.parse(raw));
    if (parsed.success) return { success: true, data: parsed.data };
    return { success: false };
  } catch {
    return { success: false };
  }
}
