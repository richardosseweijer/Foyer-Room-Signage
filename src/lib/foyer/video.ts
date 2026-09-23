import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type VideoRow = {
  index: number;
  name: string;
  connected: boolean;
  label: string;
};

export type VideoPick = {
  name: string | null;
  index: number | null;
};

const DRM = "/sys/class/drm";

function isPhysicalConnector(entry: string) {
  return !/writeback|virtual|tv-/i.test(entry);
}

/** Indexed local video outputs (DRM connectors). Connected HDMI/DP first. Fallback is a single local output. */
export function listVideoOutputs(): VideoRow[] {
  const found: { name: string; connected: boolean }[] = [];
  if (existsSync(DRM)) {
    for (const entry of readdirSync(DRM)) {
      if (!isPhysicalConnector(entry)) continue;
      const statusPath = join(DRM, entry, "status");
      if (!existsSync(statusPath)) continue;
      let status = "unknown";
      try {
        status = readFileSync(statusPath, "utf8").trim();
      } catch {
        /* keep unknown */
      }
      found.push({
        name: entry.replace(/^card\d+-/, ""),
        connected: status === "connected",
      });
    }
  }
  found.sort((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name));
  const rows: VideoRow[] = found.map((row, index) => ({
    index,
    name: row.name,
    connected: row.connected,
    label: `${index} — ${row.name}${row.connected ? "" : " (unplugged)"}`,
  }));
  if (!rows.length) {
    rows.push({
      index: 0,
      name: "local",
      connected: true,
      label: "0 — Local video output",
    });
  }
  return rows;
}

/** Explicit Setup pick only — no fallback. Used for Room panel env and conflict checks. */
export function resolvePickedVideoOutput(
  pick: VideoPick,
  outputs: VideoRow[] = listVideoOutputs(),
): VideoRow | null {
  if (pick.name) {
    const byName = outputs.find((row) => row.name === pick.name);
    if (byName) return byName;
  }
  if (pick.index !== null && pick.index !== undefined) {
    const byIndex = outputs.find((row) => row.index === pick.index);
    if (byIndex) return byIndex;
  }
  return null;
}

export function resolveVideoOutput(site: {
  videoOutputName: string | null;
  videoOutputIndex: number | null;
}): VideoRow | null {
  const outputs = listVideoOutputs();
  const picked = resolvePickedVideoOutput(
    { name: site.videoOutputName, index: site.videoOutputIndex },
    outputs,
  );
  if (picked) return picked;
  return outputs.find((row) => row.connected) ?? outputs[0] ?? null;
}

/** True when both roles resolve to the same connector name (reject save). */
export function sameVideoOutputConflict(
  welcome: VideoPick,
  roomPanel: VideoPick,
  outputs: VideoRow[] = listVideoOutputs(),
): boolean {
  const a = resolvePickedVideoOutput(welcome, outputs);
  const b = resolvePickedVideoOutput(roomPanel, outputs);
  return Boolean(a && b && a.name === b.name);
}

function envConnectorName(row: VideoRow | null) {
  return row && row.name !== "local" ? row.name : "";
}

/** Plain http://host[:port]/ for systemd EnvironmentFile + Chromium. Empty when unset/unsafe. */
export function envRelayUrl(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "http:") return "";
    if (u.username || u.password) return "";
    if (u.search || u.hash) return "";
    if (u.pathname !== "/" && u.pathname !== "") return "";
    const host = u.host;
    if (!host || /[^A-Za-z0-9._~:\[\]-]/.test(host)) return "";
    return `http://${host}/`;
  } catch {
    return "";
  }
}

export function kioskEnvBody(site: {
  videoOutputName: string | null;
  videoOutputIndex: number | null;
  roomPanelVideoOutputName?: string | null;
  roomPanelVideoOutputIndex?: number | null;
  relayUrl?: string | null;
}) {
  const welcomePick = resolvePickedVideoOutput({
    name: site.videoOutputName,
    index: site.videoOutputIndex,
  });
  const roomRow = resolvePickedVideoOutput({
    name: site.roomPanelVideoOutputName ?? null,
    index: site.roomPanelVideoOutputIndex ?? null,
  });
  // F1 fallback: when neither role is explicitly picked, Welcome uses first connected.
  // Room-panel-only (Welcome unset, Room set) must leave FOYER_VIDEO_OUTPUT empty.
  const welcomeRow = welcomePick ?? (roomRow ? null : resolveVideoOutput(site));
  const welcomeName = envConnectorName(welcomeRow);
  const roomName = envConnectorName(roomRow);
  const roomUrl = envRelayUrl(site.relayUrl);
  return (
    `FOYER_VIDEO_OUTPUT=${welcomeName}\n` +
    `FOYER_ROOM_PANEL_VIDEO_OUTPUT=${roomName}\n` +
    `FOYER_ROOM_PANEL_URL=${roomUrl}\n`
  );
}
