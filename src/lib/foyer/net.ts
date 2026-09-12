import { networkInterfaces } from "node:os";

export type NicRow = {
  index: number;
  name: string;
  ipv4: string | null;
  label: string;
};

function isIpv4(addr: { family: string | number; internal: boolean }) {
  return (addr.family === "IPv4" || addr.family === 4) && !addr.internal;
}

/** Indexed NICs for Setup. Loopback is omitted. */
export function listNics(): NicRow[] {
  const rows: NicRow[] = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (!addrs?.length) continue;
    if (addrs.every((addr) => addr.internal)) continue;
    const v4 = addrs.find(isIpv4);
    const index = rows.length;
    rows.push({
      index,
      name,
      ipv4: v4?.address ?? null,
      label: v4 ? `${index} — ${name} (${v4.address})` : `${index} — ${name}`,
    });
  }
  return rows;
}

export function resolveOutbound(site: { outboundNicName: string | null; outboundNicIndex: number | null }): NicRow | null {
  const nics = listNics();
  if (site.outboundNicName) {
    const byName = nics.find((row) => row.name === site.outboundNicName);
    if (byName) return byName;
  }
  if (site.outboundNicIndex !== null && site.outboundNicIndex !== undefined) {
    const byIndex = nics.find((row) => row.index === site.outboundNicIndex);
    if (byIndex) return byIndex;
  }
  return null;
}
