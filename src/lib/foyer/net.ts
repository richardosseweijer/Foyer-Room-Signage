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
  const names = Object.keys(networkInterfaces()).sort();
  for (const name of names) {
    const addrs = networkInterfaces()[name];
    if (!addrs?.length) continue;
    if (addrs.every((addr) => addr.internal)) continue;
    const v4 = addrs.find(isIpv4);
    const index = rows.length;
    rows.push({
      index,
      name,
      ipv4: v4?.address ?? null,
      label: v4 ? `${index} — ${name} (${v4.address})` : `${index} — ${name} (no IPv4)`,
    });
  }
  return rows;
}

export function resolveNic(opts: { nicName: string | null; nicIndex: number | null }): NicRow | null {
  const nics = listNics();
  if (opts.nicName) {
    const byName = nics.find((row) => row.name === opts.nicName);
    if (byName) return byName;
  }
  if (opts.nicIndex !== null && opts.nicIndex !== undefined) {
    const byIndex = nics.find((row) => row.index === opts.nicIndex);
    if (byIndex) return byIndex;
  }
  return null;
}

/** LAN (internet) NIC — calendar and GitHub. */
export function resolveOutbound(site: { outboundNicName: string | null; outboundNicIndex: number | null }): NicRow | null {
  return resolveNic({ nicName: site.outboundNicName, nicIndex: site.outboundNicIndex });
}

/** AV-LAN NIC — door plate :8082. */
export function resolveAvLan(site: { avLanNicName: string | null; avLanNicIndex: number | null }): NicRow | null {
  return resolveNic({ nicName: site.avLanNicName, nicIndex: site.avLanNicIndex });
}

/** Door plate bind. Unset → all interfaces (first boot). Set with IPv4 → that address. Set without IPv4 → loopback so the plate does not leak onto the other NIC. */
export function panelListenHost(site: { avLanNicName: string | null; avLanNicIndex: number | null }): string {
  const nic = resolveAvLan(site);
  if (!nic) return "0.0.0.0";
  return nic.ipv4 ?? "127.0.0.1";
}