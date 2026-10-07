/**
 * Foyer's own listeners (welcome :8080, door front :8082): one on loopback for this PC (welcome Chromium,
 * Relay's loopback driver path) plus one on the AV-side address from Foyer's Setup AV-LAN pick. That address
 * follows Relay's br-av bridge, which also carries the Wi-Fi AP, so it covers wired AV-LAN and AP clients.
 * Never a wildcard bind: no AV address means loopback only.
 */
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { resolveAvLan } from "./net.ts";
import { defaultDataPaths } from "./persist.ts";
import { parseSiteJson } from "./site.ts";

export const LOOPBACK_HOST = "127.0.0.1";
export const AV_FOLLOW_MS = 5_000;

/** AV-side bind address, or null. Never a wildcard, never loopback. */
export function avBindHost(ipv4: string | null | undefined): string | null {
  const ip = String(ipv4 ?? "").trim();
  const parts = ip.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return null;
  if (ip === "0.0.0.0" || parts[0] === "127" || ip === "255.255.255.255") return null;
  return ip;
}

/** Read-only site read for the listener processes (no journal recovery or set-aside writes; the app owns those). */
export function readSiteNics(sitePath = defaultDataPaths().sitePath): { avLanNicName: string | null; avLanNicIndex: number | null } | null {
  for (const path of [sitePath, `${sitePath}.good`]) {
    try {
      const parsed = parseSiteJson(readFileSync(path, "utf8"));
      if (parsed.success) return { avLanNicName: parsed.data.avLanNicName, avLanNicIndex: parsed.data.avLanNicIndex };
    } catch {
      /* try the next copy */
    }
  }
  return null;
}

/** Current AV-side bind address from the saved AV-LAN pick (bridge-followed). */
export function currentAvBindHost(sitePath?: string): string | null {
  const site = readSiteNics(sitePath);
  return site ? avBindHost(resolveAvLan(site)?.ipv4 ?? null) : null;
}

export type ListenerSet = { hosts: () => string[]; refresh: () => void; stop: () => void };

/**
 * Loopback listener plus one AV-side listener that is re-checked every `intervalMs` and moved when the
 * AV address changes (Setup save, Relay apply moving the address onto br-av). A failed AV bind is retried.
 */
export function serveLoopbackAndAv(opts: {
  port: number;
  label: string;
  create: () => Server;
  /** Already-listening loopback server (welcome: Vite preview). Omit to create one. */
  loopback?: Server;
  avHost?: () => string | null;
  intervalMs?: number;
  log?: (line: string) => void;
}): ListenerSet {
  const log = opts.log ?? ((line: string) => console.info(line));
  const avHost = opts.avHost ?? (() => currentAvBindHost());
  let loopback = opts.loopback ?? null;
  if (!loopback) {
    loopback = opts.create();
    loopback.on("error", (err) => log(`[foyer] ${opts.label} ${LOOPBACK_HOST}:${opts.port} failed: ${(err as Error).message}`));
    loopback.listen(opts.port, LOOPBACK_HOST, () => log(`[foyer] ${opts.label} on ${LOOPBACK_HOST}:${opts.port}`));
  }
  let av: { host: string; server: Server; up: boolean } | null = null;

  const closeAv = () => {
    if (!av) return;
    const { server, host } = av;
    av = null;
    server.close();
    server.closeAllConnections?.();
    log(`[foyer] ${opts.label} closed ${host}:${opts.port}`);
  };

  const refresh = () => {
    let want: string | null = null;
    try {
      want = avHost();
    } catch {
      want = null;
    }
    if (av && av.host === want) return; // bound, or bind in flight
    closeAv();
    if (!want) return;
    const server = opts.create();
    const row = { host: want, server, up: false };
    av = row;
    server.once("error", (err) => {
      log(`[foyer] ${opts.label} ${want}:${opts.port} failed: ${(err as Error).message} (retrying)`);
      if (av === row) av = null;
      server.close();
    });
    server.listen(opts.port, want, () => {
      row.up = true;
      log(`[foyer] ${opts.label} on ${want}:${opts.port}`);
    });
  };

  refresh();
  const timer = setInterval(refresh, opts.intervalMs ?? AV_FOLLOW_MS);
  return {
    hosts: () => [LOOPBACK_HOST, ...(av?.up ? [av.host] : [])],
    refresh,
    stop: () => {
      clearInterval(timer);
      closeAv();
      if (!opts.loopback) loopback?.close();
    },
  };
}
