/** Panel HTTP front. Bind and allowlist only — no compose, calendar, or secrets. */

export const WELCOME_PORT = 8080;
export const PANEL_PORT = 8082;

export type PanelDecision = "allow" | "deny" | "door";

function resolvePath(raw: string): string | null {
  const flat = raw.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  try {
    return new URL(flat.startsWith("/") ? flat : `/${flat}`, "http://panel.invalid").pathname;
  } catch {
    return null;
  }
}

/** Path as the upstream router could see it: dot segments resolved, %-decoded (to a fixed point), slashes collapsed, lower case. */
export function panelPath(path: string): string {
  let current = path.split("?")[0] || "/";
  for (let i = 0; i < 4; i += 1) {
    const resolved = resolvePath(current);
    if (resolved == null) return "/__invalid__";
    let decoded: string;
    try {
      decoded = decodeURIComponent(resolved);
    } catch {
      return "/__invalid__";
    }
    if (decoded === current) break;
    current = decoded;
  }
  const clean = current.replace(/\/{2,}/g, "/").toLowerCase();
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

/**
 * Door front: the room plate and what it needs (assets, server functions). Setup lives on the welcome
 * port (8080); the door tablet never proxies Setup or the loopback-only peer API.
 */
export function panelDecision(path: string): PanelDecision {
  const clean = panelPath(path);
  if (clean === "/__invalid__") return "deny";
  if (clean === "/") return "door";
  if (clean === "/play/door") return "allow";
  if (clean === "/config" || clean.startsWith("/config/")) return "deny";
  if (clean === "/api" || clean.startsWith("/api/")) return "deny";
  if (clean.startsWith("/play/")) return "deny";
  return "allow";
}

/** Setup link from a plate: on the door front (8082) it opens Setup on the welcome port of the same host. */
export function setupHref(location: { protocol: string; hostname: string; port: string }): string {
  if (location.port !== String(PANEL_PORT)) return "/config";
  const host = location.hostname.includes(":") ? `[${location.hostname}]` : location.hostname;
  return `${location.protocol}//${host}:${WELCOME_PORT}/config`;
}

/** Keep the tablet's Host. Rewriting to 127.0.0.1 breaks server functions (Origin ≠ Host). */
export function panelUpstreamHeaders(
  incoming: Record<string, string | string[] | undefined>,
  publicHost: string,
): Record<string, string | string[] | undefined> {
  const headers: Record<string, string | string[] | undefined> = { ...incoming };
  delete headers.connection;
  delete headers["keep-alive"];
  delete headers["transfer-encoding"];
  delete headers["proxy-connection"];
  headers.host = publicHost;
  headers["x-forwarded-host"] = publicHost;
  if (!headers["x-forwarded-proto"]) headers["x-forwarded-proto"] = "http";
  return headers;
}
