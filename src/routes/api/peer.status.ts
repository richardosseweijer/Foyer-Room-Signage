import { createFileRoute } from "@tanstack/react-router";
import { PEER_STATUSES, authorizePeer, isTcpLoopback, parsePeerStatus } from "@/lib/foyer/relay.ts";
import { ensureLoaded, memory, setRelayStatus } from "@/lib/foyer/store.server.ts";

const MAX_BYTES = 1024;

export const Route = createFileRoute("/api/peer/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isTcpLoopback(request)) return Response.json({ ok: false, message: "Peer calls are loopback only" }, { status: 403 });
        await ensureLoaded();
        const mem = memory();
        const url = new URL(request.url);
        const body = await request.text();
        if (body.length > MAX_BYTES) return Response.json({ ok: false, message: "Body too large" }, { status: 413 });
        const auth = authorizePeer({ key: mem.secrets.relaySecret ?? "", request, path: `${url.pathname}${url.search}`, body });
        if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
        const status = parsePeerStatus(body);
        if (!status) {
          return Response.json({ ok: false, message: `status must be one of ${PEER_STATUSES.join(", ")}` }, { status: 400 });
        }
        setRelayStatus(status);
        return Response.json({ ok: true, status });
      },
    },
  },
});
