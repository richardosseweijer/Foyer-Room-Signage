import { createFileRoute } from "@tanstack/react-router";
import { sessionFromCalendar } from "@/lib/foyer/calendar.ts";
import { authorizePeer, buildFoyerPeerGet } from "@/lib/foyer/relay.ts";
import { ensureLoaded, memory } from "@/lib/foyer/store.server.ts";

export const Route = createFileRoute("/api/peer")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await ensureLoaded();
        const mem = memory();
        const url = new URL(request.url);
        const auth = authorizePeer({ key: mem.secrets.relaySecret ?? "", request, path: `${url.pathname}${url.search}` });
        if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
        const roomId = mem.site.rooms[0]?.id ?? null;
        const session = sessionFromCalendar({ snapshot: mem.calendar, roomId, now: new Date() });
        return Response.json(buildFoyerPeerGet({ session }));
      },
    },
  },
});
