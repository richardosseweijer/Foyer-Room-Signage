import { z } from "zod";

/** Bounded-context modules. Architecture and the health page must name every id. */
export const FOYER_MODULES = [
  { id: "types", path: "src/lib/foyer/types.ts" },
  { id: "secrets", path: "src/lib/foyer/secrets.ts" },
  { id: "pins", path: "src/lib/foyer/pins.ts" },
  { id: "pins.server", path: "src/lib/foyer/pins.server.ts" },
  { id: "site", path: "src/lib/foyer/site.ts" },
  { id: "look", path: "src/lib/foyer/look.ts" },
  { id: "calendar", path: "src/lib/foyer/calendar.ts" },
  { id: "sanitize", path: "src/lib/foyer/sanitize.ts" },
  { id: "compose", path: "src/lib/foyer/compose.ts" },
  { id: "transport", path: "src/lib/foyer/transport.ts" },
  { id: "persist", path: "src/lib/foyer/persist.ts" },
  { id: "relay", path: "src/lib/foyer/relay.ts" },
  { id: "net", path: "src/lib/foyer/net.ts" },
  { id: "video", path: "src/lib/foyer/video.ts" },
  { id: "listen", path: "src/lib/foyer/listen.ts" },
] as const;

export const TEMPLATES = ["door", "welcome", "wayfinding", "split", "message"] as const;
export const BOARD_TEMPLATES = ["welcome", "door"] as const;
export const ARROWS = ["off", "left", "right", "up", "down"] as const;
export const TYPE_SCALES = ["comfort", "large"] as const;
export const PALETTES = ["linen", "orchard", "ink", "contrast"] as const;
export const STATUSES = ["available", "in-session", "starting-soon", "closed", "busy"] as const;
export const YOU_ARE_HERE = [0, 90, 180, 270] as const;
export const BINDING_SLOTS = ["single", "left", "right"] as const;

export type Template = (typeof TEMPLATES)[number];
export type Arrow = (typeof ARROWS)[number];
export type TypeScale = (typeof TYPE_SCALES)[number];
export type PaletteName = (typeof PALETTES)[number];
export type Status = (typeof STATUSES)[number];
export type YouAreHereDeg = (typeof YOU_ARE_HERE)[number];
export type BindingSlot = (typeof BINDING_SLOTS)[number];

export const MeetingSchema = z.strictObject({
  title: z.string(),
  host: z.string(),
  description: z.string().default(""),
  startIso: z.string(),
  endIso: z.string(),
});
export type Meeting = z.infer<typeof MeetingSchema>;

export const LookSlotsSchema = z.strictObject({
  clock: z.boolean(),
  now: z.boolean(),
  next: z.boolean(),
  status: z.boolean(),
  message: z.boolean(),
  directory: z.boolean(),
  countdown: z.boolean().default(true),
});

export const LookSchema = z.strictObject({
  palette: z.enum(PALETTES),
  arrow: z.enum(ARROWS).default("off"),
  typeScale: z.enum(TYPE_SCALES),
  logoOn: z.boolean(),
  logoBand: z.number(),
  slots: LookSlotsSchema,
  youAreHereDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
});
export type Look = z.infer<typeof LookSchema>;

export const HoursSchema = z.strictObject({
  start: z.string(),
  end: z.string(),
  days: z.array(z.number().int().min(0).max(6)),
});
export type Hours = z.infer<typeof HoursSchema>;

export const RoomSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  floorId: z.string(),
  hours: HoursSchema,
  occupancy: z.enum(["auto", "available", "in-session", "closed"]),
  calendarId: z.string().nullable(),
});
export type Room = z.infer<typeof RoomSchema>;

export const RoomBindingSchema = z.strictObject({
  roomId: z.string(),
  slot: z.enum(BINDING_SLOTS).default("single"),
  arrow: z.enum(ARROWS).default("off"),
});
export type RoomBinding = z.infer<typeof RoomBindingSchema>;

export const DisplaySchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  roomId: z.string().nullable(),
  bindings: z.array(RoomBindingSchema).default([]),
  zoneId: z.string().nullable(),
  template: z.enum(TEMPLATES),
});
export type Display = z.infer<typeof DisplaySchema>;

export const FloorSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
});

export const CalendarFeedSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
});

export const SiteSchema = z.strictObject({
  v: z.literal(1),
  name: z.string(),
  timezone: z.string(),
  floors: z.array(FloorSchema),
  rooms: z.array(RoomSchema),
  displays: z.array(DisplaySchema),
  looks: z.record(z.string(), LookSchema),
  logoPath: z.string().nullable(),
  calendars: z.array(CalendarFeedSchema).default([]),
  sharedCalendarId: z.string().nullable().default(null),
  relayUrl: z.string().nullable().default(null),
  relayEnabled: z.boolean().default(false),
  relayRoomMap: z.record(z.string(), z.string()).default({}),
  openGlass: z.boolean().default(false),
  demoRev: z.number().int().default(0),
  outboundNicIndex: z.number().int().min(0).nullable().default(null),
  outboundNicName: z.string().nullable().default(null),
  videoOutputIndex: z.number().int().min(0).nullable().default(null),
  videoOutputName: z.string().nullable().default(null),
});
export type Site = z.infer<typeof SiteSchema>;

export const SecretsSchema = z.strictObject({
  v: z.literal(1),
  sitePinHash: z.string(),
  techPinHash: z.string(),
  sitePinMustChange: z.boolean(),
  displayTokens: z.record(z.string(), z.string()),
  icsUrls: z.record(z.string(), z.string()),
  relaySecret: z.string().default(""),
});
export type Secrets = z.infer<typeof SecretsSchema>;

export const CalendarRoomSchema = z.strictObject({
  now: MeetingSchema.nullable(),
  next: MeetingSchema.nullable(),
  busy: z.boolean().optional(),
});

export const CalendarSnapshotSchema = z.strictObject({
  atIso: z.string(),
  rooms: z.record(z.string(), CalendarRoomSchema),
});
export type CalendarSnapshot = z.infer<typeof CalendarSnapshotSchema>;

export const OccupancySnapshotSchema = z.strictObject({
  atIso: z.string(),
  rooms: z.record(z.string(), z.enum(["available", "in-session", "closed", "busy"])),
});
export type OccupancySnapshot = z.infer<typeof OccupancySnapshotSchema>;

export const DirectoryRowSchema = z.strictObject({
  roomId: z.string(),
  name: z.string(),
  status: z.enum(STATUSES),
  nextLabel: z.string().nullable(),
  description: z.string().nullable(),
  arrow: z.enum(ARROWS).default("off"),
});

export const PaneSchema = z.strictObject({
  slot: z.enum(BINDING_SLOTS),
  roomId: z.string(),
  roomName: z.string(),
  status: z.enum(STATUSES),
  now: MeetingSchema.nullable(),
  next: MeetingSchema.nullable(),
});

export const PairingBoundSchema = z.strictObject({ bound: z.literal(true) });
export const PairingCodeSchema = z.strictObject({
  bound: z.literal(false),
  code: z.string(),
});

export const FrameLookSchema = LookSchema;

export const FrameSchema = z.strictObject({
  v: z.literal(1),
  seq: z.number().int().nonnegative(),
  displayId: z.string(),
  roomId: z.string().nullable(),
  template: z.enum(TEMPLATES),
  look: FrameLookSchema,
  identity: z.strictObject({
    siteName: z.string(),
    roomName: z.string(),
    floorLabel: z.string(),
    logoUrl: z.string().nullable(),
  }),
  status: z.enum(STATUSES),
  clock: z.strictObject({
    iso: z.string(),
    timezone: z.string(),
  }),
  now: MeetingSchema.nullable(),
  next: MeetingSchema.nullable(),
  panes: z.array(PaneSchema).default([]),
  directory: z.array(DirectoryRowSchema),
  catalog: z.array(z.strictObject({ id: z.string(), name: z.string() })).default([]),
  message: z.strictObject({ title: z.string(), body: z.string() }).nullable(),
  pairing: z.union([PairingBoundSchema, PairingCodeSchema]),
  openGlass: z.boolean().default(false),
});
export type Frame = z.infer<typeof FrameSchema>;
export type Pane = z.infer<typeof PaneSchema>;

export function parseFrame(data: unknown) {
  return FrameSchema.safeParse(data);
}

export function parseSite(data: unknown) {
  return SiteSchema.safeParse(data);
}

export function parseSecrets(data: unknown) {
  return SecretsSchema.safeParse(data);
}
