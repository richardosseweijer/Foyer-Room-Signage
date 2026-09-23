import { resolveAvLan } from "./net.ts";
import { defaultRelayBaseUrl, isAllowedRelayUrl, isLoopbackUrl } from "./relay.ts";
import { defaultLook } from "./look.ts";
import { DEFAULT_TIMEZONE, emptySite } from "./site.ts";
import type { Arrow, Display, Look, Room, Site } from "./types.ts";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const ROOM_APPLIANCE_REV = 5;
const LEGACY_DISPLAY_IDS = new Set([
  "cedar-door",
  "cedar-welcome",
  "maple-door",
  "lobby-split",
  "lobby-way",
  "wayfinding",
]);

function look(partial?: Partial<Look>): Look {
  return { ...defaultLook(), ...partial, slots: { ...defaultLook().slots, ...partial?.slots } };
}

function bind(roomId: string, arrow: Arrow = "off"): Display["bindings"][number] {
  return { roomId, slot: "single", arrow };
}

export function roomDisplays(rooms: Pick<Room, "id">[]): Display[] {
  const first = rooms[0]?.id ?? null;
  return [
    {
      id: "welcome",
      label: "Welcome",
      roomId: first,
      bindings: first ? [bind(first)] : [],
      zoneId: null,
      template: "welcome",
    },
    {
      id: "door",
      label: "Room plate",
      roomId: first,
      bindings: first ? [bind(first)] : [],
      zoneId: null,
      template: "door",
    },
  ];
}

export function boardDisplays(rooms: Pick<Room, "id">[]): Display[] {
  return roomDisplays(rooms);
}

export function needsRoomAppliance(site: Site) {
  if ((site.demoRev ?? 0) < ROOM_APPLIANCE_REV) return true;
  if (site.displays.some((item) => LEGACY_DISPLAY_IDS.has(item.id))) return true;
  if (site.displays.some((item) => item.template === "wayfinding" || item.template === "split")) return true;
  const templates = new Set(site.displays.map((item) => item.template));
  return !templates.has("welcome") || !templates.has("door");
}

export function needsBoardPlates(site: Site) {
  return needsRoomAppliance(site);
}


/** Empty or loopback → `http://<AV-IPv4>:8081` when AV is set. Non-loopback URLs stay. */
export function relayUrlDefaults(
  site: Pick<Site, "relayUrl" | "relayEnabled">,
  avIpv4: string | null | undefined,
) {
  const def = defaultRelayBaseUrl(avIpv4);
  const current = site.relayUrl?.trim() || "";
  let relayUrl: string | null = current || null;
  if (!relayUrl && def.ok) relayUrl = def.url;
  else if (relayUrl && isLoopbackUrl(relayUrl) && def.ok) relayUrl = def.url;
  const relayEnabled = Boolean(
    site.relayEnabled || (relayUrl ? isAllowedRelayUrl(relayUrl, avIpv4) : false),
  );
  return { relayUrl, relayEnabled };
}

/** Apply `relayUrlDefaults` using live AV-LAN. Same site reference when unchanged. */
export function applyRelayDefaults(site: Site): Site {
  const next = relayUrlDefaults(site, resolveAvLan(site)?.ipv4 ?? null);
  if (next.relayUrl === (site.relayUrl ?? null) && next.relayEnabled === Boolean(site.relayEnabled)) {
    return site;
  }
  return { ...site, ...next };
}

function relayDefaults(site: Site) {
  return relayUrlDefaults(site, resolveAvLan(site)?.ipv4 ?? null);
}

export function migrateToRoomAppliance(site: Site): Site {
  return {
    ...site,
    demoRev: ROOM_APPLIANCE_REV,
    displays: roomDisplays(site.rooms),
    looks: {
      welcome: site.looks.welcome ?? site.looks["cedar-welcome"] ?? look({
        palette: "linen",
        slots: {
          ...defaultLook().slots,
          next: false,
          status: false,
          message: false,
          countdown: true,
        },
      }),
      door: site.looks.door ?? site.looks["cedar-door"] ?? look({ palette: "linen" }),
    },
    outboundNicIndex: site.outboundNicIndex ?? null,
    outboundNicName: site.outboundNicName ?? null,
    avLanNicIndex: site.avLanNicIndex ?? null,
    avLanNicName: site.avLanNicName ?? null,
    videoOutputIndex: site.videoOutputIndex ?? null,
    videoOutputName: site.videoOutputName ?? null,
    ...relayDefaults(site),
  };
}

export function migrateToBoardPlates(site: Site): Site {
  return migrateToRoomAppliance(site);
}

/** First-boot demo. One room on this PC. Welcome is the local video output. */
export function demoSite(): Site {
  const site = emptySite();
  site.name = "Foyer House";
  site.timezone = DEFAULT_TIMEZONE;
  site.openGlass = false;
  site.demoRev = ROOM_APPLIANCE_REV;
  site.floors = [{ id: "f1", label: "Ground" }];
  site.calendars = [{ id: "shared", label: "Room calendar" }];
  site.sharedCalendarId = "shared";
  const seeded = relayDefaults(site);
  site.relayUrl = seeded.relayUrl;
  site.relayEnabled = seeded.relayEnabled || true;
  site.rooms = [
    {
      id: "cedar",
      name: "Cedar",
      floorId: "f1",
      hours: { start: "00:00", end: "00:00", days: WEEKDAYS },
      occupancy: "auto",
      calendarId: "shared",
    },
  ];
  site.displays = roomDisplays(site.rooms);
  site.looks = {
    welcome: look({ palette: "linen" }),
    door: look({ palette: "linen" }),
  };
  return site;
}
