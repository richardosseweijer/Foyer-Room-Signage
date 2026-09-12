import assert from "node:assert/strict";
import { test } from "node:test";
import { listNics, resolveOutbound } from "./net.ts";

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
