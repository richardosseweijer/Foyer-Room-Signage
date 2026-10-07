import { createServer, request as proxyRequest } from "node:http";
import { PANEL_PORT, WELCOME_PORT, panelDecision, panelUpstreamHeaders } from "../src/lib/foyer/listen.ts";
import { LOOPBACK_HOST, serveLoopbackAndAv } from "../src/lib/foyer/listeners.ts";

/** Door front (:8082): proxies the room plate to the welcome app on loopback. Bound on loopback + the AV-side address. */
const TARGET_PORT = WELCOME_PORT;
const TARGET_HOST = LOOPBACK_HOST;

function handle(req, res) {
  const pathOnly = (req.url ?? "/").split("?")[0] ?? "/";
  const decision = panelDecision(pathOnly);
  if (decision === "deny") {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Room panel only.");
    return;
  }
  if (decision === "door") {
    res.statusCode = 302;
    res.setHeader("location", "/play/door");
    res.end();
    return;
  }
  const publicHost = String(req.headers.host ?? `127.0.0.1:${PANEL_PORT}`);
  const headers = panelUpstreamHeaders(req.headers, publicHost);
  const up = proxyRequest(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (incoming) => {
      const headers = { ...incoming.headers };
      const type = String(headers["content-type"] ?? headers["Content-Type"] ?? "");
      if (type.includes("text/html")) headers["cache-control"] = "no-store";
      res.writeHead(incoming.statusCode ?? 502, headers);
      incoming.pipe(res);
    },
  );
  up.on("error", () => {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Welcome listener is down.");
    } else {
      res.end();
    }
  });
  req.pipe(up);
}

function upgrade(req, socket, head) {
  const publicHost = String(req.headers.host ?? `127.0.0.1:${PANEL_PORT}`);
  const up = proxyRequest({
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: "GET",
    headers: panelUpstreamHeaders(req.headers, publicHost),
  });
  up.on("upgrade", (upRes, upSocket, upHead) => {
    socket.write("HTTP/1.1 101 Switching Protocols\r\n");
    for (const [key, value] of Object.entries(upRes.headers)) {
      if (value === undefined) continue;
      socket.write(`${key}: ${Array.isArray(value) ? value.join(", ") : value}\r\n`);
    }
    socket.write("\r\n");
    if (upHead.length) socket.write(upHead);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  up.on("error", () => socket.destroy());
  up.end();
}

serveLoopbackAndAv({
  port: PANEL_PORT,
  label: "room panel",
  create: () => {
    const server = createServer(handle);
    server.on("upgrade", upgrade);
    return server;
  },
});
