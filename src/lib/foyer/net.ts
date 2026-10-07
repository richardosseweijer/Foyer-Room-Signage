import { existsSync, readdirSync, readlinkSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { basename, join } from "node:path";

const SYS_NET = "/sys/class/net";

export type NicRow = {
  index: number;
  name: string;
  ipv4: string | null;
  label: string;
};

function isIpv4(addr: { family: string | number; internal: boolean }) {
  return (addr.family === "IPv4" || addr.family === 4) && !addr.internal;
}

function bridgePorts(sysRoot: string): string[] {
  try {
    return readdirSync(sysRoot).filter((name) => name !== "lo" && nicMaster(name, sysRoot) !== null);
  } catch {
    return [];
  }
}

/**
 * Indexed NICs for Setup. Loopback is omitted. Bridge ports (no address of their own once Relay
 * enslaves them into br-av) stay listed so a pick and the indexes survive a Relay network apply.
 */
export function listNics(sysRoot = SYS_NET): NicRow[] {
  const rows: NicRow[] = [];
  const live = networkInterfaces();
  const names = new Set(Object.keys(live).filter((name) => {
    const addrs = live[name];
    return Boolean(addrs?.length) && !addrs!.every((addr) => addr.internal);
  }));
  for (const name of bridgePorts(sysRoot)) names.add(name);
  for (const name of [...names].sort()) {
    const v4 = live[name]?.find(isIpv4);
    const index = rows.length;
    const master = v4 ? null : nicMaster(name, sysRoot);
    rows.push({
      index,
      name,
      ipv4: v4?.address ?? null,
      label: v4 ? `${index} — ${name} (${v4.address})` : master ? `${index} — ${name} (port of ${master})` : `${index} — ${name} (no IPv4)`,
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

/** Bridge (or bond) this NIC is enslaved to, from sysfs. Null when it is not a port. */
export function nicMaster(name: string, sysRoot = SYS_NET): string | null {
  if (!/^[A-Za-z0-9_.:@-]{1,32}$/.test(name)) return null;
  try {
    return basename(readlinkSync(join(sysRoot, name, "master")));
  } catch {
    return null;
  }
}

function ipv4Of(name: string): string | null {
  return networkInterfaces()[name]?.find(isIpv4)?.address ?? null;
}

export type AvLanRow = NicRow & {
  /** Bridge whose IPv4 this AV pick uses (Relay's br-av), or null when the NIC has its own. */
  via: string | null;
};

/**
 * Follow the bridge: an AV NIC with no IPv4 of its own that is a port of a bridge (Relay enslaves the
 * AV NIC and the Wi-Fi AP into br-av) uses the bridge's IPv4.
 */
export function followBridge(
  row: Pick<NicRow, "index" | "name" | "ipv4">,
  master: string | null,
  masterIpv4: string | null,
): AvLanRow {
  if (row.ipv4) return { ...row, via: null, label: `${row.index} — ${row.name} (${row.ipv4})` };
  if (master && masterIpv4) {
    return { ...row, ipv4: masterIpv4, via: master, label: `${row.index} — ${row.name} via ${master} (${masterIpv4})` };
  }
  return { ...row, ipv4: null, via: master, label: `${row.index} — ${row.name} (no IPv4)` };
}

/**
 * AV-LAN NIC — door plate, Relay URL, AV-side listeners. A picked name that is still present in
 * sysfs wins even when it has no address (bridge port); the index is only a fallback for a missing name.
 */
export function resolveAvLan(
  site: { avLanNicName: string | null; avLanNicIndex: number | null },
  sysRoot = SYS_NET,
): AvLanRow | null {
  let row: Pick<NicRow, "index" | "name" | "ipv4"> | null = null;
  const nics = listNics(sysRoot);
  const name = site.avLanNicName;
  if (name) {
    row = nics.find((item) => item.name === name) ?? null;
    if (!row && /^[A-Za-z0-9_.:@-]{1,32}$/.test(name) && existsSync(join(sysRoot, name))) row = { index: -1, name, ipv4: null };
  }
  if (!row) row = resolveNic({ nicName: null, nicIndex: site.avLanNicIndex });
  if (!row) return null;
  const master = row.ipv4 ? null : nicMaster(row.name, sysRoot);
  return followBridge(row, master, master ? ipv4Of(master) : null);
}
