import assert from "node:assert/strict";
import { test } from "node:test";
import {
  occupancyFromPeer,
  occupancyFromValue,
  peerEndpoint,
  signPeer,
  isLoopbackHostname,
  isLoopbackRequest,
  isTcpLoopback,
  tcpPeerAddress,
  authorizePeerGet,
  buildFoyerPeerGet,
  isAllowedRelayUrl,
  defaultRelayBaseUrl,
} from "./relay.ts";
import { demoSite } from "./seed.ts";

test("Relay HMAC matches the documented peer formula", () => {
  const sig = signPeer("secret", "GET", "/api/peer", "1000", "");
  assert.equal(sig.length, 64);
  assert.match(sig, /^[0-9a-f]+$/);
});

test("first-class occupancy applies to this PC's room without a name match", () => {
  const site = demoSite();
  const id = site.rooms[0]!.id;
  const snap = occupancyFromPeer({
    site,
    payload: { occupancy: "closed", room: { id: "other", name: "Not Cedar" } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[id], "closed");
});

test("occupancy still applies when room is a string or missing", () => {
  const site = demoSite();
  const id = site.rooms[0]!.id;
  const asString = occupancyFromPeer({
    site,
    payload: { occupancy: "busy", room: "whatever" },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(asString.rooms[id], "busy");
  const missing = occupancyFromPeer({
    site,
    payload: { occupancy: "do-not-disturb" },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(missing.rooms[id], "do-not-disturb");
});

test("dnd aliases map", () => {
  assert.equal(occupancyFromValue("dnd"), "do-not-disturb");
  assert.equal(occupancyFromValue("do not disturb"), "do-not-disturb");
});

test("host.locked fills in-session only when occupancy is missing", () => {
  const site = demoSite();
  const id = site.rooms[0]!.id;
  const locked = occupancyFromPeer({
    site,
    payload: { host: { locked: true } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(locked.rooms[id], "in-session");
  const preferred = occupancyFromPeer({
    site,
    payload: { occupancy: "available", host: { locked: true } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(preferred.rooms[id], "available");
});

test("unknown occupancy string is ignored", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: { occupancy: "maybe", room: { name: "Cedar" } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[site.rooms[0]!.id], undefined);
});

test("vars are not used to bind occupancy", () => {
  const site = demoSite();
  const snap = occupancyFromPeer({
    site,
    payload: { vars: { v1: { name: "Cedar", value: "busy" } } },
    now: new Date("2026-09-11T12:00:00Z"),
  });
  assert.equal(snap.rooms[site.rooms[0]!.id], undefined);
});

test("peerEndpoint does not throw on a hostname without a scheme", () => {
  assert.equal(peerEndpoint("relay.local")?.pathname, "/api/peer");
  assert.equal(peerEndpoint("not a url"), null);
});

test("loopback hostnames are the only peer GET surface", () => {
  assert.equal(isLoopbackHostname("127.0.0.1"), true);
  assert.equal(isLoopbackHostname("127.0.0.1:8080"), true);
  assert.equal(isLoopbackHostname("localhost"), true);
  assert.equal(isLoopbackHostname("10.0.25.10"), false);
  assert.equal(isLoopbackHostname("10.0.25.10:8082"), false);
});

test("unsigned loopback GET is allowed; AV-LAN is not", () => {
  const loop = new Request("http://10.0.25.10:8080/api/peer", { method: "GET" });
  const lan = new Request("http://127.0.0.1:8082/api/peer", {
    method: "GET",
    headers: { host: "127.0.0.1:8080", "x-forwarded-for": "127.0.0.1" },
  });
  Object.assign(loop, { runtime: { node: { req: { socket: { remoteAddress: "127.0.0.1" } } } } });
  Object.assign(lan, { runtime: { node: { req: { socket: { remoteAddress: "10.0.25.10" } } } } });
  assert.equal(isLoopbackRequest(loop), true);
  assert.equal(isLoopbackRequest(lan), false);
  assert.equal(authorizePeerGet({ key: "", request: loop }), true);
  assert.equal(authorizePeerGet({ key: "secret", request: loop }), true);
  assert.equal(authorizePeerGet({ key: "secret", request: lan }), false);
  const bad = new Request("http://127.0.0.1:8080/api/peer", {
    method: "GET",
    headers: { "x-relay-auth": "ab", "x-relay-ts": String(Date.now()) },
  });
  Object.assign(bad, { runtime: { node: { req: { socket: { remoteAddress: "127.0.0.1" } } } } });
  assert.equal(authorizePeerGet({ key: "secret", request: bad }), false);
});

test("Host/XFF and a missing TCP peer are not loopback", () => {
  const spoof = new Request("http://127.0.0.1:8080/api/peer", {
    method: "GET",
    headers: { host: "127.0.0.1:8080", "x-forwarded-for": "127.0.0.1", "x-forwarded-host": "localhost" },
  });
  Object.assign(spoof, { runtime: { node: { req: { socket: { remoteAddress: "10.0.25.10" } } } } });
  assert.equal(tcpPeerAddress(spoof), "10.0.25.10");
  assert.equal(isTcpLoopback(spoof), false);
  assert.equal(authorizePeerGet({ key: "secret", request: spoof }), false);
  const none = new Request("http://127.0.0.1:8080/api/peer");
  assert.equal(tcpPeerAddress(none), null);
  assert.equal(isTcpLoopback(none), false);
  assert.equal(authorizePeerGet({ key: "secret", request: none }), false);
  const lanTs = String(Date.now());
  const lanHmac = new Request("http://10.0.25.10:8080/api/peer", {
    method: "GET",
    headers: { "x-relay-ts": lanTs, "x-relay-auth": signPeer("secret", "GET", "/api/peer", lanTs, "") },
  });
  Object.assign(lanHmac, { runtime: { node: { req: { socket: { remoteAddress: "10.0.25.10" } } } } });
  assert.equal(authorizePeerGet({ key: "secret", request: lanHmac }), false);
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


test("allowed Relay URL is http loopback or AV-LAN IPv4", () => {
  assert.equal(isAllowedRelayUrl("http://127.0.0.1:8081"), true);
  assert.equal(isAllowedRelayUrl("http://localhost:8081"), true);
  assert.equal(isAllowedRelayUrl("http://10.0.25.10:8081", "10.0.25.10"), true);
  assert.equal(isAllowedRelayUrl("http://10.0.25.10:8081", "10.0.25.11"), false);
  assert.equal(isAllowedRelayUrl("http://192.168.1.9:8081", "10.0.25.10"), false);
  assert.equal(isAllowedRelayUrl("https://127.0.0.1:8081"), false);
  assert.equal(isAllowedRelayUrl("https://10.0.25.10:8081", "10.0.25.10"), false);
  assert.equal(isAllowedRelayUrl("ftp://127.0.0.1:8081"), false);
  const def = defaultRelayBaseUrl("10.0.25.10");
  assert.equal(def.ok, true);
  if (def.ok) assert.equal(def.url, "http://10.0.25.10:8081");
  assert.equal(defaultRelayBaseUrl(null).ok, false);
});
