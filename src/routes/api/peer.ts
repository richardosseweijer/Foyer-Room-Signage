import { createFileRoute } from "@tanstack/react-router";
import { sessionFromCalendar } from "@/lib/foyer/calendar.ts";
import { authorizePeerGet, buildFoyerPeerGet } from "@/lib/foyer/relay.ts";
import { ensureLoaded, memory } from "@/lib/foyer/store.server.ts";

export const Route = createFileRoute("/api/peer")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await ensureLoaded();
        const mem = memory();
        const key = mem.secrets.relaySecret?.trim() ?? "";
        if (!authorizePeerGet({ key, request })) {
          return Response.json({ ok: false, message: "Auth failed" }, { status: 401 });
        }
        const roomId = mem.site.rooms[0]?.id ?? null;
        const session = sessionFromCalendar({ snapshot: mem.calendar, roomId, now: new Date() });
        return Response.json(buildFoyerPeerGet({ session }));
      },
    },
  },
});
