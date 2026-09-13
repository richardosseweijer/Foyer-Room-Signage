import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { defaultDataPaths, firstBootSecrets, loadPair, persistPair, secretsAfterLoad } from "./persist.ts";
import { buildCalendarSnapshot, emptyCalendarSnapshot } from "./calendar.ts";
import { normalizeLook } from "./look.ts";
import { resolveOutbound } from "./net.ts";
import { fetchRelayOccupancy } from "./relay.ts";
import { demoSite, migrateToRoomAppliance, needsRoomAppliance } from "./seed.ts";
import { emptySecrets } from "./secrets.ts";
import { bindDoorOrWelcome, bindWayfinding } from "./site.ts";
import { kioskEnvBody } from "./video.ts";
import type { Arrow, CalendarSnapshot, Look, OccupancySnapshot, Secrets, Site } from "./types.ts";

type Memory = {
  site: Site;
  secrets: Secrets;
  calendar: CalendarSnapshot;
  occupancy: OccupancySnapshot | null;
  ingestNote: string;
  seq: Record<string, number>;
  loaded: boolean;
};

const mem: Memory = {
  site: demoSite(),
  secrets: emptySecrets(),
  calendar: emptyCalendarSnapshot(),
  occupancy: null,
  ingestNote: "",
  seq: {},
  loaded: false,
};

let ingestTimer: ReturnType<typeof setInterval> | null = null;

export function memory() {
  return mem;
}

function migrateDemo(site: Site): Site {
  let next = site;
  if ((next.demoRev ?? 0) < 2) {
    next = {
      ...next,
      demoRev: 2,
      rooms: next.rooms.map((room) => ({
        ...room,
        hours: { start: "07:00", end: "23:00", days: [0, 1, 2, 3, 4, 5, 6] },
      })),
    };
  }
  if (needsRoomAppliance(next)) next = migrateToRoomAppliance(next);
  return next;
}

export async function ensureLoaded() {
  if (!mem.loaded) {
    const paths = defaultDataPaths();
    const loaded = loadPair(paths.secretPath, paths.sitePath);
    if (loaded.source === "empty") {
      mem.site = demoSite();
      mem.secrets = firstBootSecrets();
      persistPair(paths.secretPath, paths.sitePath, JSON.stringify(mem.secrets, null, 2), JSON.stringify(mem.site, null, 2));
    } else {
      mem.site = loaded.site;
      mem.secrets = secretsAfterLoad(loaded.secrets);
      if (mem.site.rooms.length === 0) mem.site = { ...demoSite(), name: mem.site.name, timezone: mem.site.timezone };
    }
    mem.loaded = true;
    mem.site = migrateDemo(mem.site);
    await persistNow();
    try {
      await refreshIngest();
    } catch {
      /* last calendar stays; plates still boot */
    }
    if (!ingestTimer) ingestTimer = setInterval(() => void refreshIngest().catch(() => undefined), 30_000);
    return mem;
  }
  const next = migrateDemo(mem.site);
  if (next !== mem.site) {
    mem.site = next;
    await persistNow();
    try {
      await refreshIngest();
    } catch {
      /* last calendar stays */
    }
  }
  return mem;
}

export async function persistNow() {
  const paths = defaultDataPaths();
  persistPair(paths.secretPath, paths.sitePath, JSON.stringify(mem.secrets, null, 2), JSON.stringify(mem.site, null, 2));
  try {
    writeFileSync(join(paths.dir, "foyer-kiosk.env"), kioskEnvBody(mem.site));
  } catch {
    /* kiosk env is best-effort */
  }
}

export async function refreshIngest() {
  const lastCal = mem.calendar;
  const lastOcc = mem.occupancy;
  const nic = resolveOutbound(mem.site);
  const wantBind = mem.site.outboundNicName != null || mem.site.outboundNicIndex != null;
  let localAddress = nic?.ipv4 ?? null;
  let note = "";
  if (wantBind && !localAddress) {
    note = "LAN (internet) NIC has no IPv4 — calendar not pulled.";
    mem.ingestNote = note;
    mem.occupancy = await fetchRelayOccupancy({
      site: mem.site,
      secret: mem.secrets.relaySecret,
      lastGood: lastOcc,
    });
    return;
  }
  mem.calendar = await buildCalendarSnapshot({
    site: mem.site,
    icsUrls: mem.secrets.icsUrls,
    lastGood: lastCal,
    localAddress,
    requireBind: wantBind && Boolean(localAddress),
  });
  mem.ingestNote = note;
  mem.occupancy = await fetchRelayOccupancy({
    site: mem.site,
    secret: mem.secrets.relaySecret,
    lastGood: lastOcc,
  });
}

export function bumpSeq(displayId: string) {
  const next = (mem.seq[displayId] ?? 0) + 1;
  mem.seq[displayId] = next;
  return next;
}

export function currentSeq(displayId: string) {
  return mem.seq[displayId] ?? 0;
}

export async function saveLook(displayId: string, patch: Partial<Look>) {
  await ensureLoaded();
  const previous = mem.site.looks[displayId];
  mem.site.looks[displayId] = normalizeLook(patch, previous);
  bumpSeq(displayId);
  await persistNow();
  return mem.site.looks[displayId];
}

export async function savePlate(opts: {
  displayId: string;
  look?: Partial<Look>;
  roomId?: string | null;
  directory?: { roomId: string; arrow: Arrow }[];
}) {
  await ensureLoaded();
  const display = mem.site.displays.find((item) => item.id === opts.displayId);
  if (!display) return { ok: false as const, reason: "missing" as const };
  const known = new Set(mem.site.rooms.map((room) => room.id));
  let next = display;
  if (display.template === "wayfinding" && opts.directory) {
    next = bindWayfinding(
      display,
      opts.directory.filter((row) => known.has(row.roomId)),
    );
  } else if ((display.template === "door" || display.template === "welcome") && opts.roomId !== undefined) {
    const roomId = opts.roomId && known.has(opts.roomId) ? opts.roomId : null;
    next = bindDoorOrWelcome(display, roomId);
  }
  const looks = { ...mem.site.looks };
  if (opts.look) looks[display.id] = normalizeLook(opts.look, looks[display.id]);
  mem.site = {
    ...mem.site,
    displays: mem.site.displays.map((item) => (item.id === display.id ? next : item)),
    looks,
  };
  bumpSeq(display.id);
  await persistNow();
  return { ok: true as const, look: looks[display.id], display: next };
}

export async function saveSite(next: Site, secretsPatch?: Partial<Secrets>) {
  await ensureLoaded();
  mem.site = next;
  if (secretsPatch) mem.secrets = { ...mem.secrets, ...secretsPatch };
  for (const display of mem.site.displays) bumpSeq(display.id);
  await persistNow();
  await refreshIngest();
}
