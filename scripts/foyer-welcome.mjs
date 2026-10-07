/**
 * Welcome listener (:8080). Vite preview on loopback (welcome Chromium, Relay's loopback Foyer driver)
 * plus the same app on the AV-side address from Setup's AV-LAN pick (Setup and plates for AV-LAN and
 * AP clients). Never a wildcard bind. Each listener keeps the real TCP peer, so loopback-only routes
 * (/api/peer*) still refuse AV clients.
 */
import { createServer } from "node:http";
import { preview } from "vite";
import { LOOPBACK_HOST, serveLoopbackAndAv } from "../src/lib/foyer/listeners.ts";
import { WELCOME_PORT } from "../src/lib/foyer/listen.ts";

const server = await preview({ preview: { host: LOOPBACK_HOST, port: WELCOME_PORT, strictPort: true } });
console.info(`[foyer] welcome on ${LOOPBACK_HOST}:${WELCOME_PORT}`);

serveLoopbackAndAv({
  port: WELCOME_PORT,
  label: "welcome",
  loopback: server.httpServer,
  create: () => {
    const av = createServer(server.middlewares);
    av.on("upgrade", (req, socket, head) => server.httpServer.emit("upgrade", req, socket, head));
    return av;
  },
});
