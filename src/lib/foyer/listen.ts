/** Panel HTTP front. Bind and allowlist only — no compose, calendar, or secrets. */

export const WELCOME_HOST = "0.0.0.0";
export const WELCOME_PORT = 8080;
export const PANEL_PORT = 8082;

export type PanelDecision = "allow" | "deny" | "door";

export function panelDecision(path: string): PanelDecision {
  const raw = path.split("?")[0] ?? "/";
  const clean = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  if (clean === "/") return "door";
  if (clean === "/config") return "deny";
  if (clean === "/play/welcome") return "deny";
  return "allow";
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
