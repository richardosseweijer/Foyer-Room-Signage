import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ROOM_OCCUPANCIES } from "./types.ts";

export const unlockSite = createServerFn({ method: "POST" })
  .validator(z.object({ pin: z.string(), clientKey: z.string() }))
  .handler(async ({ data }) => {
    const { attemptUnlock } = await import("./pins.server.ts");
    const { ensureLoaded, memory } = await import("./store.server.ts");
    const { issueSession } = await import("./sessions.server.ts");
    await ensureLoaded();
    const result = attemptUnlock({
      gate: "site",
      pin: data.pin,
      secrets: memory().secrets,
      clientKey: data.clientKey,
    });
    if (!result.ok) return result;
    return { ok: true as const, session: issueSession("site"), mustChange: result.mustChange };
  });

export const getSetup = createServerFn({ method: "POST" })
  .validator(z.object({ session: z.string() }))
  .handler(async ({ data }) => {
    const { readSession } = await import("./sessions.server.ts");
    const { ensureLoaded, memory } = await import("./store.server.ts");
    const { listNics } = await import("./net.ts");
    const { listVideoOutputs } = await import("./video.ts");
    const { gitIdentity } = await import("./update.ts");
    const { icsHostHint } = await import("./calendar.ts");
    const { resolveAvLan, resolveOutbound } = await import("./net.ts");
    if (!readSession(data.session, "site")) return { ok: false as const, reason: "auth" as const };
    await ensureLoaded();
    const mem = memory();
    const git = gitIdentity();
    const shared = mem.site.sharedCalendarId ?? "shared";
    const room = mem.site.rooms[0];
    const cal = room ? mem.calendar.rooms[room.id] : undefined;
    const nic = resolveOutbound(mem.site);
    const av = resolveAvLan(mem.site);
    return {
      ok: true as const,
      site: mem.site,
      icsConfigured: Object.fromEntries(mem.site.calendars.map((feed) => [feed.id, Boolean(mem.secrets.icsUrls[feed.id])])),
      icsHost: icsHostHint(mem.secrets.icsUrls[shared]),
      hasRelaySecret: Boolean(mem.secrets.relaySecret),
      hasTechPin: Boolean(mem.secrets.techPinHash),
      mustChange: mem.secrets.sitePinMustChange,
      nics: listNics(),
      outputs: listVideoOutputs(),
      version: git.version,
      git,
      ingest: {
        atIso: mem.calendar.atIso,
        note: mem.ingestNote,
        nic: nic ? nic.label : "Any (not bound)",
        avLan: av ? av.label : "Not set (panel listens on all interfaces)",
        nowTitle: cal?.now?.title ?? "",
        nextTitle: cal?.next?.title ?? "",
      },
    };
  });

export const saveSetup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      session: z.string(),
      name: z.string(),
      timezone: z.string(),
      rooms: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          occupancy: z.enum(ROOM_OCCUPANCIES),
        }),
      ),
      icsUrl: z.string().optional(),
      relayUrl: z.string().optional(),
      relaySecret: z.string().optional(),
      relayEnabled: z.boolean().optional(),
      openGlass: z.boolean().optional(),
      sitePin: z.string().optional(),
      techPin: z.string().optional(),
      outboundNicIndex: z.number().int().min(0).nullable().optional(),
      avLanNicIndex: z.number().int().min(0).nullable().optional(),
      videoOutputIndex: z.number().int().min(0).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { readSession } = await import("./sessions.server.ts");
    const { assertNewPin, hashPin } = await import("./pins.server.ts");
    const { ensureLoaded, memory, saveSite } = await import("./store.server.ts");
    const { listNics } = await import("./net.ts");
    const { listVideoOutputs } = await import("./video.ts");
    if (!readSession(data.session, "site")) return { ok: false as const, reason: "auth" as const };
    await ensureLoaded();
    const mem = memory();
    if (mem.secrets.sitePinMustChange && !data.sitePin) {
      return { ok: false as const, reason: "must-change" as const };
    }
    if (data.sitePin) {
      const check = assertNewPin(data.sitePin, data.techPin);
      if (!check.ok) return { ok: false as const, reason: check.reason };
    }
    if (data.techPin) {
      const check = assertNewPin(data.techPin, data.sitePin);
      if (!check.ok) return { ok: false as const, reason: check.reason };
    }
    const nics = listNics();
    const outputs = listVideoOutputs();
    const pickNic = (
      incoming: number | null | undefined,
      current: { index: number | null; name: string | null },
    ) => {
      if (incoming === undefined) return current;
      if (incoming === null) return { index: null, name: null };
      return { index: incoming, name: nics.find((row) => row.index === incoming)?.name ?? null };
    };
    const nic = pickNic(data.outboundNicIndex, { index: mem.site.outboundNicIndex, name: mem.site.outboundNicName });
    const av = pickNic(data.avLanNicIndex, { index: mem.site.avLanNicIndex, name: mem.site.avLanNicName });
    const output =
      data.videoOutputIndex === undefined
        ? { index: mem.site.videoOutputIndex, name: mem.site.videoOutputName }
        : data.videoOutputIndex === null
          ? { index: null, name: null }
          : {
              index: data.videoOutputIndex,
              name: outputs.find((row) => row.index === data.videoOutputIndex)?.name ?? null,
            };
    const avChanged = av.index !== mem.site.avLanNicIndex || av.name !== mem.site.avLanNicName;
    const site = {
      ...mem.site,
      name: data.name.trim() || mem.site.name,
      timezone: data.timezone.trim() || mem.site.timezone,
      relayUrl: data.relayUrl?.trim() || null,
      relayEnabled: Boolean(data.relayEnabled),
      openGlass: data.openGlass ?? mem.site.openGlass,
      outboundNicIndex: nic.index,
      outboundNicName: nic.name,
      avLanNicIndex: av.index,
      avLanNicName: av.name,
      videoOutputIndex: output.index,
      videoOutputName: output.name,
      rooms: mem.site.rooms.map((room) => {
        const patch = data.rooms.find((item) => item.id === room.id);
        return patch ? { ...room, name: patch.name.trim() || room.name, occupancy: patch.occupancy } : room;
      }),
    };
    const secretsPatch: Record<string, unknown> = {};
    if (data.sitePin) {
      secretsPatch.sitePinHash = hashPin(data.sitePin);
      secretsPatch.sitePinMustChange = false;
    }
    if (data.techPin) secretsPatch.techPinHash = hashPin(data.techPin);
    if (data.icsUrl !== undefined) {
      const urls = { ...mem.secrets.icsUrls };
      const shared = site.sharedCalendarId ?? "shared";
      const nextUrl = data.icsUrl.trim();
      if (nextUrl) urls[shared] = nextUrl;
      secretsPatch.icsUrls = urls;
    }
    if (data.relaySecret !== undefined) {
      secretsPatch.relaySecret = data.relaySecret;
    }
    await saveSite(site, secretsPatch);
    if (avChanged) {
      const { restartPanel } = await import("./panel.ts");
      restartPanel();
    }
    return { ok: true as const };
  });

export const claimDisplay = createServerFn({ method: "POST" })
  .validator(z.object({ session: z.string(), code: z.string() }))
  .handler(async ({ data }) => {
    const { readSession } = await import("./sessions.server.ts");
    const { claimPairingCode } = await import("./transport.ts");
    const { ensureLoaded, memory, persistNow } = await import("./store.server.ts");
    if (!readSession(data.session, "site")) return { ok: false as const, reason: "auth" as const };
    await ensureLoaded();
    const claimed = claimPairingCode(data.code.trim());
    if (!claimed.ok) return claimed;
    memory().secrets.displayTokens[claimed.displayId] = claimed.tokenHash;
    await persistNow();
    return { ok: true as const, displayId: claimed.displayId };
  });

export const updateFromGithub = createServerFn({ method: "POST" })
  .validator(z.object({ session: z.string() }))
  .handler(async ({ data }) => {
    const { readSession } = await import("./sessions.server.ts");
    if (!readSession(data.session, "site")) return { ok: false as const, reason: "auth" as const };
    const { startGithubUpdate } = await import("./update.ts");
    return startGithubUpdate();
  });

export const enableWelcomeOutput = createServerFn({ method: "POST" })
  .validator(z.object({ session: z.string() }))
  .handler(async ({ data }) => {
    const { readSession } = await import("./sessions.server.ts");
    if (!readSession(data.session, "site")) return { ok: false as const, reason: "auth" as const };
    const { persistNow } = await import("./store.server.ts");
    await persistNow();
    const { enableLocalOutput } = await import("./kiosk.ts");
    return enableLocalOutput();
  });
