import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { LOOPBACK_HOST, avBindHost, readSiteNics, serveLoopbackAndAv } from "./listeners.ts";
import { demoSite } from "./seed.ts";

test("AV bind host is a concrete IPv4: never a wildcard, loopback, or name", () => {
  assert.equal(avBindHost("10.0.10.10"), "10.0.10.10");
  assert.equal(avBindHost(" 172.30.0.2 "), "172.30.0.2");
  for (const bad of ["0.0.0.0", "127.0.0.1", "127.0.1.1", "255.255.255.255", "::", "::1", "", null, undefined, "br-av", "10.0.10", "10.0.10.256"]) {
    assert.equal(avBindHost(bad), null, String(bad));
  }
});

test("listener processes read the AV pick without writing (primary, then .good)", () => {
  const dir = mkdtempSync(join(tmpdir(), "foyer-listen-"));
  const sitePath = join(dir, "foyer-site.json");
  assert.equal(readSiteNics(sitePath), null);
  const site = { ...demoSite(), avLanNicName: "br-av", avLanNicIndex: 2 };
  writeFileSync(`${sitePath}.good`, JSON.stringify(site));
  writeFileSync(sitePath, "{ torn");
  assert.deepEqual(readSiteNics(sitePath), { avLanNicName: "br-av", avLanNicIndex: 2 });
  writeFileSync(sitePath, JSON.stringify({ ...site, avLanNicName: "enp1s0" }));
  assert.deepEqual(readSiteNics(sitePath), { avLanNicName: "enp1s0", avLanNicIndex: 2 });
});

async function freePort() {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, LOOPBACK_HOST, resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

function hit(host: string, port: number): Promise<string> {
  return new Promise((resolve) => {
    const req = get({ host, port, path: "/", timeout: 1000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    req.on("error", () => resolve("down"));
    req.on("timeout", () => {
      req.destroy();
      resolve("down");
    });
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("loopback listener plus an AV listener that follows the address, never a wildcard", async () => {
  const port = await freePort();
  let av: string | null = null;
  const lines: string[] = [];
  const set = serveLoopbackAndAv({
    port,
    label: "test",
    create: () => createServer((req, res) => res.end(`peer ${req.socket.remoteAddress}`)),
    avHost: () => av,
    intervalMs: 50,
    log: (line) => lines.push(line),
  });
  try {
    await wait(100);
    assert.deepEqual(set.hosts(), [LOOPBACK_HOST]);
    assert.equal(await hit(LOOPBACK_HOST, port), "peer 127.0.0.1");
    assert.equal(await hit("127.0.0.2", port), "down");

    av = "127.0.0.2"; // stands in for the AV address (whole 127/8 is local on Linux)
    await wait(200);
    assert.deepEqual(set.hosts(), [LOOPBACK_HOST, "127.0.0.2"]);
    assert.equal(await hit("127.0.0.2", port), "peer 127.0.0.1");

    av = "127.0.0.3"; // address moved (Setup save / Relay put the NIC into br-av)
    await wait(200);
    assert.deepEqual(set.hosts(), [LOOPBACK_HOST, "127.0.0.3"]);
    assert.equal(await hit("127.0.0.2", port), "down");
    assert.equal(await hit("127.0.0.3", port), "peer 127.0.0.1");

    av = null;
    await wait(200);
    assert.deepEqual(set.hosts(), [LOOPBACK_HOST]);
    assert.equal(await hit("127.0.0.3", port), "down");
    assert.equal(lines.some((line) => line.includes("0.0.0.0")), false);
  } finally {
    set.stop();
  }
});

test("a failed AV bind is logged and retried", async () => {
  const port = await freePort();
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(port, "127.0.0.4", resolve));
  const lines: string[] = [];
  const set = serveLoopbackAndAv({
    port,
    label: "test",
    create: () => createServer((_req, res) => res.end("ok")),
    avHost: () => "127.0.0.4",
    intervalMs: 50,
    log: (line) => lines.push(line),
  });
  try {
    await wait(150);
    assert.ok(lines.some((line) => /127\.0\.0\.4:\d+ failed/.test(line)));
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
    await wait(200);
    assert.deepEqual(set.hosts(), [LOOPBACK_HOST, "127.0.0.4"]);
    assert.equal(await hit("127.0.0.4", port), "ok");
  } finally {
    set.stop();
  }
});
