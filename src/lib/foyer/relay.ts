import { createHmac, timingSafeEqual } from "node:crypto";
import type { OccupancySnapshot, Site } from "./types.ts";
import type { PeerSession } from "./calendar.ts";

const TIMEOUT_MS = 4_000;
const SKEW_MS = 90_000;
const used = new Map<string, number>();

export function signPeer(key: string, method: string, path: string, ts: string, body: string) {
  return createHmac("sha256", key).update(`${ts}\n${method.toUpperCase()}\n${path}\n${body}`).digest("hex");
}

/** Relay's HTTP port on this PC (Relay listens on the AV-LAN address). */
export const RELAY_PORT = 8081;

/** Foyer → Relay base URL, derived from this PC's live AV-LAN IPv4. Null when AV has no IPv4. */
export function relayBaseUrl(avIpv4: string | null | undefined): string | null {
  const ip = String(avIpv4 ?? "").trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  return `http://${ip}:${RELAY_PORT}`;
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

export type PeerAuthResult = { ok: true } | { ok: false; status: 401 | 403; message: string };

/** Relay → Foyer peer calls: loopback TCP peer AND a valid HMAC with the shared Relay secret. Nothing unsigned. */
export function authorizePeer(opts: { key: string; request: Request; path: string; body?: string }): PeerAuthResult {
  if (!isTcpLoopback(opts.request)) return { ok: false, status: 403, message: "Peer calls are loopback only" };
  const key = opts.key.trim();
  if (!key) return { ok: false, status: 401, message: "No Relay secret set in Foyer Setup" };
  const ok = verifyPeerRequest({
    key,
    method: opts.request.method,
    path: opts.path,
    ts: opts.request.headers.get("x-relay-ts") || "",
    body: opts.body ?? "",
    sig: opts.request.headers.get("x-relay-auth") || "",
  });
  return ok ? { ok: true } : { ok: false, status: 401, message: "Auth failed" };
}

/** Statuses Relay may push (text, never codes). */
export const PEER_STATUSES = ["available", "in-session", "do-not-disturb", "closed"] as const;
export type PeerStatus = (typeof PEER_STATUSES)[number];

export function parsePeerStatus(body: string): PeerStatus | null {
  try {
    const parsed = JSON.parse(body) as { status?: unknown };
    const status = typeof parsed?.status === "string" ? parsed.status : "";
    return (PEER_STATUSES as readonly string[]).includes(status) ? (status as PeerStatus) : null;
  } catch {
    return null;
  }
}

/** Relay's pushed status applies to this PC's room(s); no name match (one room per appliance). */
export function occupancyFromStatus(site: Site, status: PeerStatus, now = new Date()): OccupancySnapshot {
  const rooms: OccupancySnapshot["rooms"] = {};
  for (const room of site.rooms) rooms[room.id] = status;
  return { atIso: now.toISOString(), rooms };
}

export function relayEndpoint(base: string, path: string): URL | null {
  const trimmed = base.trim();
  if (!trimmed) return null;
  const withSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  try {
    return new URL(path, withSlash);
  } catch {
    try {
      return new URL(path, `http://${withSlash.replace(/^\/+/, "")}`);
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

/** Relay device ids are Relay's own ids (letters, digits, `-`, `_`). */
export function isRelayDeviceId(raw: string) {
  return /^[A-Za-z0-9_-]{1,64}$/.test(raw);
}

export type ReportTarget = { url: URL; key: string };

/** Where report-back goes, or why it is off. Always Relay on this PC's AV-LAN address. */
export function reportTarget(opts: {
  deviceId: string | null | undefined;
  key: string;
  avIpv4: string | null | undefined;
}): { ok: true; target: ReportTarget } | { ok: false; reason: string } {
  const key = opts.key.trim();
  const deviceId = String(opts.deviceId ?? "").trim();
  if (!deviceId) return { ok: false, reason: "No Relay device id set" };
  if (!isRelayDeviceId(deviceId)) return { ok: false, reason: "Relay device id is not valid" };
  if (!key) return { ok: false, reason: "No Relay secret set" };
  const base = relayBaseUrl(opts.avIpv4);
  if (!base) return { ok: false, reason: "AV-LAN has no IPv4 (pick the AV-LAN NIC in Setup)" };
  const url = relayEndpoint(base, `/api/device/${deviceId}/in`);
  if (!url) return { ok: false, reason: "Relay URL is not valid" };
  return { ok: true, target: { url, key } };
}

/** Signed report-back of the room's session to Relay's device inbound route. */
export async function postSession(target: ReportTarget, session: PeerSession | null): Promise<boolean> {
  const body = JSON.stringify({ event: "session", data: session });
  const ts = String(Date.now());
  const path = `${target.url.pathname}${target.url.search}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-relay-ts": ts,
        "x-relay-auth": signPeer(target.key, "POST", path, ts, body),
      },
      body,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
