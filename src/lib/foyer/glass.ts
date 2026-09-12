import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getGlassFrame = createServerFn({ method: "POST" })
  .validator(z.object({ displayId: z.string(), token: z.string().optional() }))
  .handler(async ({ data }) => {
    const { frameForDisplay } = await import("./runtime.server.ts");
    return frameForDisplay({ displayId: data.displayId, token: data.token });
  });

export const saveGlassLook = createServerFn({ method: "POST" })
  .validator(
    z.object({
      displayId: z.string(),
      session: z.string().optional(),
      look: z.record(z.string(), z.unknown()),
      roomId: z.string().nullable().optional(),
      directory: z
        .array(
          z.object({
            roomId: z.string(),
            arrow: z.enum(["off", "left", "right", "up", "down"]),
          }),
        )
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { memory, ensureLoaded, savePlate } = await import("./store.server.ts");
    const { readSession } = await import("./sessions.server.ts");
    await ensureLoaded();
    const mem = memory();
    const techOk = readSession(data.session, "tech");
    if (!techOk && !mem.site.openGlass) return { ok: false as const, reason: "auth" as const };
    const saved = await savePlate({
      displayId: data.displayId,
      look: data.look as Partial<import("./types.ts").Look>,
      roomId: data.roomId,
      directory: data.directory,
    });
    if (!saved.ok) return { ok: false as const, reason: "missing" as const };
    return { ok: true as const, look: saved.look };
  });

export const unlockTech = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string(), clientKey: z.string() }))
  .handler(async ({ data }) => {
    const { attemptUnlock } = await import("./pins.server.ts");
    const { ensureLoaded, memory } = await import("./store.server.ts");
    const { issueSession } = await import("./sessions.server.ts");
    await ensureLoaded();
    const result = attemptUnlock({
      gate: "tech",
      pin: data.pin,
      secrets: memory().secrets,
      clientKey: data.clientKey,
    });
    if (!result.ok) return result;
    return { ok: true as const, session: issueSession("tech"), mustChange: result.mustChange };
  });

export const bindThisGlass = createServerFn({ method: "POST" })
  .validator(z.object({ displayId: z.string() }))
  .handler(async ({ data }) => {
    const { claimPairingCode, mintPairingCode } = await import("./transport.ts");
    const { ensureLoaded, memory, persistNow } = await import("./store.server.ts");
    await ensureLoaded();
    const mem = memory();
    if (!mem.site.openGlass) return { ok: false as const, reason: "closed" as const };
    const minted = mintPairingCode(data.displayId);
    const claimed = claimPairingCode(minted.code);
    if (!claimed.ok) return { ok: false as const, reason: "wrong" as const };
    mem.secrets.displayTokens[claimed.displayId] = claimed.tokenHash;
    await persistNow();
    const { takePickupToken } = await import("./transport.ts");
    const token = takePickupToken(claimed.displayId);
    if (!token) return { ok: false as const, reason: "wrong" as const };
    return { ok: true as const, token, displayId: claimed.displayId };
  });

export const listDisplays = createServerFn({ method: "POST" }).handler(async () => {
  const { ensureLoaded, memory } = await import("./store.server.ts");
  const { boardPlates } = await import("./site.ts");
  await ensureLoaded();
  const mem = memory();
  return {
    siteName: mem.site.name,
    timezone: mem.site.timezone,
    openGlass: mem.site.openGlass,
    displays: boardPlates(mem.site),
  };
});
