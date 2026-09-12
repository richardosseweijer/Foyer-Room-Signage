import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type VideoRow = {
  index: number;
  name: string;
  connected: boolean;
  label: string;
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

export function resolveVideoOutput(site: {
  videoOutputName: string | null;
  videoOutputIndex: number | null;
}): VideoRow | null {
  const outputs = listVideoOutputs();
  if (site.videoOutputName) {
    const byName = outputs.find((row) => row.name === site.videoOutputName);
    if (byName) return byName;
  }
  if (site.videoOutputIndex !== null && site.videoOutputIndex !== undefined) {
    const byIndex = outputs.find((row) => row.index === site.videoOutputIndex);
    if (byIndex) return byIndex;
  }
  return outputs.find((row) => row.connected) ?? outputs[0] ?? null;
}

export function kioskEnvBody(site: { videoOutputName: string | null; videoOutputIndex: number | null }) {
  const row = resolveVideoOutput(site);
  const name = row && row.name !== "local" ? row.name : "";
  return `FOYER_VIDEO_OUTPUT=${name}\n`;
}
