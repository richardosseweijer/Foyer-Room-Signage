import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type VideoRow = {
  index: number;
  name: string;
  connected: boolean;
  label: string;
};

const DRM = "/sys/class/drm";

/** Indexed local video outputs (DRM connectors). Fallback is a single local output. */
export function listVideoOutputs(): VideoRow[] {
  const rows: VideoRow[] = [];
  if (existsSync(DRM)) {
    for (const entry of readdirSync(DRM).sort()) {
      const statusPath = join(DRM, entry, "status");
      if (!existsSync(statusPath)) continue;
      let status = "unknown";
      try {
        status = readFileSync(statusPath, "utf8").trim();
      } catch {
        /* keep unknown */
      }
      const index = rows.length;
      const name = entry.replace(/^card\d+-/, "");
      rows.push({
        index,
        name,
        connected: status === "connected",
        label: `${index} — ${name} (${status})`,
      });
    }
  }
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
  return outputs[0] ?? null;
}
