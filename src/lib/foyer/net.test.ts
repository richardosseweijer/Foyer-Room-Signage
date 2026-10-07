import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { followBridge, listNics, nicMaster, panelListenHost, resolveAvLan, resolveOutbound } from "./net.ts";

/** Fake /sys/class/net: enp9s9 and wlx9 are ports of br-test; enp8s8 is a plain NIC. */
function fakeSys() {
  const root = mkdtempSync(join(tmpdir(), "foyer-sysnet-"));
  for (const name of ["br-test", "enp8s8", "enp9s9", "wlx9"]) mkdirSync(join(root, name));
  symlinkSync("../br-test", join(root, "enp9s9", "master"));
  symlinkSync("../br-test", join(root, "wlx9", "master"));
  return root;
}

test("nics are indexed from zero and skip loopback", () => {
  const nics = listNics();
  for (const row of nics) {
    assert.equal(row.label.startsWith(`${row.index} — `), true);
    assert.notEqual(row.name, "lo");
  }
  if (nics.length) {
    assert.equal(nics[0]?.index, 0);
    assert.equal(nics[nics.length - 1]?.index, nics.length - 1);
  }
});

test("outbound resolves by name first, then index", () => {
  const nics = listNics();
  if (!nics.length) {
    assert.equal(resolveOutbound({ outboundNicName: "nope", outboundNicIndex: 0 }), null);
    return;
  }
  const first = nics[0]!;
  const byName = resolveOutbound({ outboundNicName: first.name, outboundNicIndex: 99 });
  assert.equal(byName?.name, first.name);
  const byIndex = resolveOutbound({ outboundNicName: "missing-nic", outboundNicIndex: first.index });
  assert.equal(byIndex?.name, first.name);
});

test("AV-LAN resolve is independent of the LAN picker", () => {
  const nics = listNics();
  assert.equal(resolveAvLan({ avLanNicName: "nope", avLanNicIndex: null }), null);
  if (!nics.length) return;
  const first = nics[0]!;
  const av = resolveAvLan({ avLanNicName: first.name, avLanNicIndex: 99 });
  assert.equal(av?.name, first.name);
  const lan = resolveOutbound({ outboundNicName: "missing-nic", outboundNicIndex: first.index });
  assert.equal(lan?.name, first.name);
});

test("panel bind is all interfaces until AV-LAN is set", () => {
  assert.equal(panelListenHost({ avLanNicName: null, avLanNicIndex: null }), "0.0.0.0");
  const nics = listNics();
  if (!nics.length) {
    assert.equal(panelListenHost({ avLanNicName: "ghost", avLanNicIndex: 0 }), "0.0.0.0");
    return;
  }
  const first = nics[0]!;
  const host = panelListenHost({ avLanNicName: first.name, avLanNicIndex: first.index });
  if (first.ipv4) assert.equal(host, first.ipv4);
  else assert.equal(host, "127.0.0.1");
});

test("bridge ports are found from sysfs", () => {
  const root = fakeSys();
  assert.equal(nicMaster("enp9s9", root), "br-test");
  assert.equal(nicMaster("wlx9", root), "br-test");
  assert.equal(nicMaster("enp8s8", root), null);
  assert.equal(nicMaster("../etc", root), null);
});

test("follow the bridge: a port with no IPv4 uses the bridge address", () => {
  const own = followBridge({ index: 1, name: "enp1s0", ipv4: "10.0.10.10" }, null, null);
  assert.deepEqual([own.ipv4, own.via], ["10.0.10.10", null]);
  const port = followBridge({ index: 1, name: "enp1s0", ipv4: null }, "br-av", "10.0.10.10");
  assert.deepEqual([port.ipv4, port.via], ["10.0.10.10", "br-av"]);
  assert.match(port.label, /enp1s0 via br-av \(10\.0\.10\.10\)/);
  const bare = followBridge({ index: 1, name: "enp1s0", ipv4: null }, "br-av", null);
  assert.deepEqual([bare.ipv4, bare.via], [null, "br-av"]);
});

test("bridge ports stay in the picker and a picked port is not swapped for the index", () => {
  const root = fakeSys();
  const names = listNics(root).map((row) => row.name);
  assert.equal(names.includes("enp9s9"), true);
  assert.equal(names.includes("wlx9"), true);
  assert.equal(names.includes("enp8s8"), false);
  const av = resolveAvLan({ avLanNicName: "enp9s9", avLanNicIndex: 0 }, root);
  assert.equal(av?.name, "enp9s9");
  assert.equal(av?.via, "br-test");
  assert.equal(av?.ipv4, null);
});
