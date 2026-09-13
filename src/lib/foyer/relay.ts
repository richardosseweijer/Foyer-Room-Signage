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
  const first = occupancyFromValue(opts.payload.occupancy);
  const locked = Boolean(opts.payload.host?.locked);
  for (const room of opts.site.rooms) {
    if (first) rooms[room.id] = first;
    else if (locked) rooms[room.id] = "in-session";
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
