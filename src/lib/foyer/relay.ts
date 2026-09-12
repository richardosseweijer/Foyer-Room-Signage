import { createHmac } from "node:crypto";
import type { OccupancySnapshot, Site } from "./types.ts";

const TIMEOUT_MS = 4_000;

export function signPeer(key: string, method: string, path: string, ts: string, body: string) {
  return createHmac("sha256", key).update(`${ts}\n${method.toUpperCase()}\n${path}\n${body}`).digest("hex");
}

function occupancyFromValue(value: unknown): OccupancySnapshot["rooms"][string] | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (["busy"].includes(raw)) return "busy";
  if (["in-session", "insession", "occupied", "1", "true", "on"].includes(raw)) return "in-session";
  if (["closed", "off"].includes(raw)) return "closed";
  if (["available", "free", "idle", "0", "false"].includes(raw)) return "available";
  return null;
}

export function occupancyFromPeer(opts: {
  site: Site;
  payload: {
    room?: { name?: string };
    host?: { locked?: boolean };
    vars?: Record<string, { name: string; value: string | number }>;
  };
  now?: Date;
}): OccupancySnapshot {
  const rooms: OccupancySnapshot["rooms"] = {};
  const vars = opts.payload.vars ?? {};
  for (const [id, item] of Object.entries(vars)) {
    const mapped = opts.site.relayRoomMap[id] || opts.site.relayRoomMap[item.name] || null;
    const room =
      mapped ||
      opts.site.rooms.find((row) => row.name.toLowerCase() === item.name.toLowerCase())?.id ||
      null;
    const status = occupancyFromValue(item.value);
    if (room && status) rooms[room] = status;
  }
  const relayName = opts.payload.room?.name?.trim();
  if (relayName && opts.payload.host?.locked) {
    const room = opts.site.rooms.find((row) => row.name.toLowerCase() === relayName.toLowerCase());
    if (room && !rooms[room.id]) rooms[room.id] = "in-session";
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
      room?: { name?: string };
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
