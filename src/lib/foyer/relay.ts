import { createHmac } from "node:crypto";
import type { OccupancySnapshot, Site } from "./types.ts";
import { LIVE_OCCUPANCIES } from "./types.ts";

const TIMEOUT_MS = 4_000;

export function signPeer(key: string, method: string, path: string, ts: string, body: string) {
  return createHmac("sha256", key).update(`${ts}\n${method.toUpperCase()}\n${path}\n${body}`).digest("hex");
}

export function occupancyFromValue(value: unknown): OccupancySnapshot["rooms"][string] | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["do-not-disturb", "dnd", "do not disturb"].includes(raw)) return "do-not-disturb";
  if (raw === "busy") return "busy";
  if (["in-session", "insession", "occupied", "1", "true", "on"].includes(raw)) return "in-session";
  if (["closed", "off"].includes(raw)) return "closed";
  if (["available", "free", "idle", "0", "false"].includes(raw)) return "available";
  if ((LIVE_OCCUPANCIES as readonly string[]).includes(raw)) return raw as OccupancySnapshot["rooms"][string];
  return null;
}

function roomNameOf(room: unknown): string | undefined {
  if (!room || typeof room !== "object") return undefined;
  const name = (room as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

function foyerRoomId(site: Site, name: string | undefined): string | null {
  const needle = name?.trim().toLowerCase();
  if (!needle) return null;
  return site.rooms.find((row) => row.name.toLowerCase() === needle)?.id ?? null;
}

export function occupancyFromPeer(opts: {
  site: Site;
  payload: {
    occupancy?: unknown;
    room?: unknown;
    host?: { locked?: boolean };
    vars?: Record<string, { name: string; value: string | number }>;
  };
  now?: Date;
}): OccupancySnapshot {
  const rooms: OccupancySnapshot["rooms"] = {};
  const relayName = roomNameOf(opts.payload.room);
  const bound = foyerRoomId(opts.site, relayName);
  const first = occupancyFromValue(opts.payload.occupancy);
  if (first && bound) rooms[bound] = first;

  const vars = opts.payload.vars ?? {};
  for (const [id, item] of Object.entries(vars)) {
    const mapped = opts.site.relayRoomMap[id] || opts.site.relayRoomMap[item.name] || null;
    const room =
      mapped ||
      opts.site.rooms.find((row) => row.name.toLowerCase() === item.name.toLowerCase())?.id ||
      null;
    const status = occupancyFromValue(item.value);
    if (room && status && !rooms[room]) rooms[room] = status;
  }

  if (relayName && opts.payload.host?.locked) {
    const room = foyerRoomId(opts.site, relayName);
    if (room && !rooms[room]) rooms[room] = "in-session";
  }
  return { atIso: (opts.now ?? new Date()).toISOString(), rooms };
}

export function peerEndpoint(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  try {
    return new URL("/api/peer", withSlash);
  } catch {
    try {
      return new URL("/api/peer", `http://${withSlash.replace(/^\/+/, "")}`);
    } catch {
      return null;
    }
  }
}

export async function fetchRelayOccupancy(opts: {
  site: Site;
  secret: string;
  lastGood?: OccupancySnapshot | null;
}): Promise<OccupancySnapshot | null> {
  const url = opts.site.relayUrl?.trim();
  const key = opts.secret.trim();
  if (!opts.site.relayEnabled || !url || !key) return opts.lastGood ?? null;
  const endpoint = peerEndpoint(url);
  if (!endpoint) return opts.lastGood ?? null;
  const ts = String(Date.now());
  const sig = signPeer(key, "GET", "/api/peer", ts, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      headers: { "x-relay-auth": sig, "x-relay-ts": ts },
    });
    if (!res.ok) return opts.lastGood ?? null;
    const payload = (await res.json()) as {
      ok?: boolean;
      occupancy?: unknown;
      room?: unknown;
      host?: { locked?: boolean };
      vars?: Record<string, { name: string; value: string | number }>;
    };
    if (!payload?.ok) return opts.lastGood ?? null;
    return occupancyFromPeer({ site: opts.site, payload });
  } catch {
    return opts.lastGood ?? null;
  } finally {
    clearTimeout(timer);
  }
}
