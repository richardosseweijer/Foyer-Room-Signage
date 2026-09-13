import assert from "node:assert/strict";
import { test } from "node:test";
import { listNics, panelListenHost, resolveAvLan, resolveOutbound } from "./net.ts";

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
