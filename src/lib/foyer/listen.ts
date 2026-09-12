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
