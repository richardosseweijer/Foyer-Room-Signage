import { createServer, request as proxyRequest } from "node:http";
import { PANEL_PORT, panelDecision, panelUpstreamHeaders } from "../src/lib/foyer/listen.ts";
import { panelListenHost } from "../src/lib/foyer/net.ts";
import { defaultDataPaths, loadPair } from "../src/lib/foyer/persist.ts";

const TARGET_PORT = 8080;
const TARGET_HOST = "127.0.0.1";

function bindHost() {
  try {
    const paths = defaultDataPaths();
    const loaded = loadPair(paths.secretPath, paths.sitePath);
    return panelListenHost(loaded.site);
  } catch {
    return "0.0.0.0";
  }
}

const server = createServer((req, res) => {
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
});

server.on("upgrade", (req, socket, head) => {
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
});

const host = bindHost();
server.listen(PANEL_PORT, host, () => {
  console.info(`[foyer] room panel on ${host}:${PANEL_PORT}`);
});
