import { composeFrame } from "./compose.ts";
import { lookForDisplay } from "./site.ts";
import { currentSeq, ensureLoaded, memory } from "./store.server.ts";
import { mintPairingCode, readPairingCode, takePickupToken, verifyDisplayToken } from "./transport.ts";
import type { Frame } from "./types.ts";

export type FrameAccess =
  | { ok: true; frame: Frame; pickupToken?: string }
  | { ok: false; status: 401 | 404; frame: Frame | null };

export async function frameForDisplay(opts: { displayId: string; token?: string }): Promise<FrameAccess> {
  const mem = await ensureLoaded();
  const display = mem.site.displays.find((item) => item.id === opts.displayId);
  if (!display) return { ok: false, status: 404, frame: null };

  const stored = mem.secrets.displayTokens[display.id];
  const bound = Boolean(opts.token && stored && verifyDisplayToken(opts.token, stored));
  const open = mem.site.openGlass;
  const localWelcome = display.template === "welcome";
  const pickup = !bound && !localWelcome ? takePickupToken(display.id) : null;
  const allowed = bound || open || localWelcome || Boolean(pickup);

  if (!allowed) {
    const code = readPairingCode(display.id) ?? mintPairingCode(display.id);
    const frame = composeFrame({
      site: mem.site,
      display,
      look: lookForDisplay(mem.site, display.id),
      calendar: { atIso: new Date().toISOString(), rooms: {} },
      occupancy: null,
      now: new Date(),
      seq: currentSeq(display.id),
      pairing: { bound: false, code: code.code },
    });
    frame.now = null;
    frame.next = null;
    frame.following = [];
    frame.panes = [];
    frame.directory = [];
    frame.catalog = [];
    frame.message = null;
    frame.roomId = null;
    frame.status = "available";
    frame.identity = { siteName: mem.site.name, roomName: mem.site.name, floorLabel: "", logoUrl: null, footer: "" };
    return { ok: false, status: 401, frame };
  }

  const frame = composeFrame({
    site: mem.site,
    display,
    look: lookForDisplay(mem.site, display.id),
    calendar: mem.calendar,
    occupancy: mem.occupancy,
    now: new Date(),
    seq: currentSeq(display.id),
    pairing: { bound: true },
  });
  if (localWelcome) frame.pairing = { bound: true };
  return pickup ? { ok: true, frame, pickupToken: pickup } : { ok: true, frame };
}
