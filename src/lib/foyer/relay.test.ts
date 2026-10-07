import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorizePeer,
  buildFoyerPeerGet,
  isRelayDeviceId,
  isTcpLoopback,
  occupancyFromStatus,
  parsePeerStatus,
  relayBaseUrl,
  relayEndpoint,
  reportTarget,
  signPeer,
  tcpPeerAddress,
} from "./relay.ts";
import { demoSite } from "./seed.ts";

function peerRequest(opts: { path: string; method?: string; ip: string; key?: string; body?: string; headers?: Record<string, string> }) {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.key) {
    const ts = String(Date.now());
    headers["x-relay-ts"] = ts;
    headers["x-relay-auth"] = signPeer(opts.key, method, opts.path, ts, opts.body ?? "");
  }
  const request = new Request(`http://127.0.0.1:8080${opts.path}`, { method, headers, body: opts.body });
  Object.assign(request, { runtime: { node: { req: { socket: { remoteAddress: opts.ip } } } } });
  return request;
}

test("Relay HMAC matches the documented peer formula", () => {
  const sig = signPeer("secret", "GET", "/api/peer", "1000", "");
  assert.equal(sig.length, 64);
  assert.match(sig, /^[0-9a-f]+$/);
});

test("foyer peer GET body is session only", () => {
  const body = buildFoyerPeerGet({
    session: { kind: "next", title: "Board lunch", startIso: "2026-09-11T12:00:00Z", endIso: "2026-09-11T13:00:00Z" },
  });
  assert.equal(body.ok, true);
  assert.equal(body.v, 1);
  assert.equal(body.session?.kind, "next");
  assert.equal(body.session?.title, "Board lunch");
  assert.equal(buildFoyerPeerGet({ session: null }).session, null);
});


test("relayEndpoint does not throw on a hostname without a scheme", () => {
  assert.equal(relayEndpoint("relay.local", "/api/peer")?.pathname, "/api/peer");
  assert.equal(relayEndpoint("http://10.0.25.10:8081", "/api/device/foyer/in")?.toString(), "http://10.0.25.10:8081/api/device/foyer/in");
  assert.equal(relayEndpoint("not a url", "/api/peer"), null);
});

test("peer calls need loopback AND a valid HMAC; nothing unsigned", () => {
  assert.equal(authorizePeer({ key: "secret", request: peerRequest({ path: "/api/peer", ip: "127.0.0.1", key: "secret" }), path: "/api/peer" }).ok, true);
  const unsigned = authorizePeer({ key: "secret", request: peerRequest({ path: "/api/peer", ip: "127.0.0.1" }), path: "/api/peer" });
  assert.deepEqual(unsigned, { ok: false, status: 401, message: "Auth failed" });
  const noKey = authorizePeer({ key: "  ", request: peerRequest({ path: "/api/peer", ip: "127.0.0.1", key: "secret" }), path: "/api/peer" });
  assert.equal(noKey.ok, false);
  if (!noKey.ok) assert.equal(noKey.status, 401);
  const wrong = authorizePeer({ key: "secret", request: peerRequest({ path: "/api/peer", ip: "127.0.0.1", key: "other" }), path: "/api/peer" });
  assert.equal(wrong.ok, false);
  const lan = authorizePeer({ key: "secret", request: peerRequest({ path: "/api/peer", ip: "10.0.25.10", key: "secret" }), path: "/api/peer" });
  assert.equal(lan.ok, false);
  if (!lan.ok) assert.equal(lan.status, 403);
});

test("signed POST covers the body and the path", () => {
  const body = JSON.stringify({ status: "in-session" });
  const good = peerRequest({ path: "/api/peer/status", method: "POST", ip: "::1", key: "secret", body });
  assert.equal(authorizePeer({ key: "secret", request: good, path: "/api/peer/status", body }).ok, true);
  const tampered = peerRequest({ path: "/api/peer/status", method: "POST", ip: "127.0.0.1", key: "secret", body });
  assert.equal(authorizePeer({ key: "secret", request: tampered, path: "/api/peer/status", body: JSON.stringify({ status: "closed" }) }).ok, false);
  const otherPath = peerRequest({ path: "/api/peer", method: "POST", ip: "127.0.0.1", key: "secret", body });
  assert.equal(authorizePeer({ key: "secret", request: otherPath, path: "/api/peer/status", body }).ok, false);
});

test("Host/XFF and a missing TCP peer are not loopback", () => {
  const spoof = peerRequest({
    path: "/api/peer",
    ip: "10.0.25.10",
    key: "secret",
    headers: { host: "127.0.0.1:8080", "x-forwarded-for": "127.0.0.1", "x-forwarded-host": "localhost" },
  });
  assert.equal(tcpPeerAddress(spoof), "10.0.25.10");
  assert.equal(isTcpLoopback(spoof), false);
  assert.equal(authorizePeer({ key: "secret", request: spoof, path: "/api/peer" }).ok, false);
  const none = new Request("http://127.0.0.1:8080/api/peer");
  assert.equal(tcpPeerAddress(none), null);
  assert.equal(authorizePeer({ key: "secret", request: none, path: "/api/peer" }).ok, false);
});

test("pushed status is text from the fixed set; codes and aliases are refused", () => {
  for (const status of ["available", "in-session", "do-not-disturb", "closed"]) {
    assert.equal(parsePeerStatus(JSON.stringify({ status })), status);
  }
  for (const bad of ["1", "0", "busy", "dnd", "In-Session", ""]) assert.equal(parsePeerStatus(JSON.stringify({ status: bad })), null);
  assert.equal(parsePeerStatus(JSON.stringify({ status: 2 })), null);
  assert.equal(parsePeerStatus("not json"), null);
});

test("pushed status applies to this PC's room without a name match", () => {
  const site = demoSite();
  const snap = occupancyFromStatus(site, "do-not-disturb", new Date("2026-09-11T12:00:00Z"));
  assert.equal(snap.rooms[site.rooms[0]!.id], "do-not-disturb");
  assert.equal(snap.atIso, "2026-09-11T12:00:00.000Z");
});

test("Relay URL is derived from the AV-LAN IPv4", () => {
  assert.equal(relayBaseUrl("10.0.10.10"), "http://10.0.10.10:8081");
  assert.equal(relayBaseUrl(null), null);
  assert.equal(relayBaseUrl(""), null);
  assert.equal(relayBaseUrl("relay.local"), null);
});

test("report-back target needs device id, secret, and an AV-LAN IPv4", () => {
  const base = { deviceId: "foyer", key: "secret", avIpv4: "10.0.25.10" };
  const ok = reportTarget(base);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.target.url.toString(), "http://10.0.25.10:8081/api/device/foyer/in");
  assert.equal(reportTarget({ ...base, deviceId: "" }).ok, false);
  assert.equal(reportTarget({ ...base, deviceId: "../peer" }).ok, false);
  assert.equal(reportTarget({ ...base, key: "" }).ok, false);
  const noAv = reportTarget({ ...base, avIpv4: null });
  assert.equal(noAv.ok, false);
  if (!noAv.ok) assert.match(noAv.reason, /AV-LAN/);
  assert.equal(isRelayDeviceId("foyer-1_a"), true);
  assert.equal(isRelayDeviceId("a/b"), false);
});
