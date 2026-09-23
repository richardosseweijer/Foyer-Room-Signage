import { resolveAvLan } from "./net.ts";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { OccupancySnapshot, Site } from "./types.ts";
import { LIVE_OCCUPANCIES } from "./types.ts";
import type { PeerSession } from "./calendar.ts";

const TIMEOUT_MS = 4_000;
const SKEW_MS = 90_000;
const used = new Map<string, number>();

export function signPeer(key: string, method: string, path: string, ts: string, body: string) {
  return createHmac("sha256", key).update(`${ts}\n${method.toUpperCase()}\n${path}\n${body}`).digest("hex");
}

export function hostnameOf(host: string) {
  const t = host.trim().toLowerCase();
  if (!t) return "";
  if (t.startsWith("[")) {
    const end = t.indexOf("]");
    return end > 0 ? t.slice(1, end) : t;
  }
  if (/^\d+\.\d+\.\d+\.\d+(?::\d+)?$/.test(t)) return t.split(":")[0];
  if (t.includes(":") && !t.startsWith("::") && t.split(":").length === 2) return t.split(":")[0];
  return t;
}

export function isLoopbackHostname(host: string) {
  const name = hostnameOf(host);
  return name === "127.0.0.1" || name === "localhost" || name === "::1";
}

export function isLoopbackUrl(raw: string) {
  try {
    return isLoopbackHostname(new URL(raw).hostname);
  } catch {
    return false;
  }
}

/** Default Foyer→Relay URL from live AV-LAN IPv4. Soft-fails when AV has no IPv4 (no loopback bait). */
export function defaultRelayBaseUrl(avIpv4: string | null | undefined, port = 8081):
  | { ok: true; url: string }
  | { ok: false; reason: string } {
  const ip = String(avIpv4 ?? "").trim();
  if (!ip) {
    return {
      ok: false,
      reason: "AV-LAN has no IPv4 — set AV-LAN before enabling Relay occupancy (lab: http://127.0.0.1:8081 with RELAY_LISTEN_HOST=127.0.0.1).",
    };
  }
  const p = Number(port);
  const portNum = Number.isFinite(p) && p > 0 ? Math.floor(p) : 8081;
  return { ok: true, url: `http://${ip}:${portNum}` };
}

/** Loopback or this PC's AV-LAN IPv4 (Relay listen host). Other hosts fail closed. */
export function isAllowedRelayUrl(raw: string, avIpv4?: string | null) {
  if (isLoopbackUrl(raw)) return true;
  try {
    const host = hostnameOf(new URL(raw).hostname);
    const av = String(avIpv4 ?? "").trim();
    return Boolean(av && host === av);
  } catch {
    return false;
  }
}

/** TCP peer only. Host / X-Forwarded-* are not loopback. */
export function isLoopbackIp(ip: string) {
  const a = ip.trim().toLowerCase();
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

type NodeReq = { socket?: { remoteAddress?: string }; connection?: { remoteAddress?: string } };

export function tcpPeerAddress(request: Request): string | null {
  const row = request as Request & {
    socket?: { remoteAddress?: string };
    runtime?: { node?: { req?: NodeReq } };
  };
  const raw =
    row.runtime?.node?.req?.socket?.remoteAddress
    || row.runtime?.node?.req?.connection?.remoteAddress
    || row.socket?.remoteAddress
    || "";
  const ip = String(raw).trim();
  return ip || null;
}

export function isTcpLoopback(request: Request) {
  const ip = tcpPeerAddress(request);
  if (!ip) return false;
  return isLoopbackIp(ip);
}

export function isLoopbackRequest(request: Request) {
  return isTcpLoopback(request);
}

export function verifyPeerRequest(opts: {
  key: string;
  method: string;
  path: string;
  ts: string;
  body: string;
  sig: string;
}) {
  if (!opts.key || !opts.sig || !opts.ts) return false;
  if (opts.sig !== opts.sig.trim().toLowerCase()) return false;
  const stamp = Number(opts.ts);
  if (!Number.isFinite(stamp) || Math.abs(Date.now() - stamp) > SKEW_MS) return false;
  const sig = opts.sig.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const expect = signPeer(opts.key, opts.method, opts.path, opts.ts, opts.body);
  const replay = `${expect}:${opts.ts}`;
  const now = Date.now();
  for (const [key, at] of used) {
    if (now - at > SKEW_MS) used.delete(key);
  }
  if (used.has(replay)) return false;
  try {
    const a = Buffer.from(expect, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    used.set(replay, now);
    return true;
  } catch {
    return false;
  }
}

/** Unsigned GET only if the TCP peer is loopback. HMAC, if sent, must match. Non-loopback is denied even with HMAC. */
export function authorizePeerGet(opts: { key: string; request: Request; path?: string }) {
  if (!isTcpLoopback(opts.request)) return false;
  const sig = opts.request.headers.get("x-relay-auth") || "";
  const ts = opts.request.headers.get("x-relay-ts") || "";
  if (!sig && !ts) return true;
  if (!opts.key) return false;
  return verifyPeerRequest({
    key: opts.key,
    method: "GET",
    path: opts.path ?? "/api/peer",
    ts,
    body: "",
    sig,
  });
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

export function buildFoyerPeerGet(opts: { session: PeerSession | null }) {
  return {
    ok: true as const,
    v: 1 as const,
    session: opts.session,
  };
}

export async function fetchRelayOccupancy(opts: {
  site: Site;
  secret: string;
  lastGood?: OccupancySnapshot | null;
}): Promise<OccupancySnapshot | null> {
  const url = opts.site.relayUrl?.trim();
  if (!opts.site.relayEnabled || !url) return opts.lastGood ?? null;
  const endpoint = peerEndpoint(url);
  if (!endpoint) return opts.lastGood ?? null;
  const avIpv4 = resolveAvLan(opts.site)?.ipv4 ?? null;
  if (!isAllowedRelayUrl(endpoint.toString(), avIpv4)) return opts.lastGood ?? null;
  // Loopback GET is unsigned so a pasted secret that does not match Relay cannot
  // 401 occupancy. HMAC still required for POST macros; verify if headers are sent.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
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
