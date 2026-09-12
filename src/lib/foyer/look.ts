import {
  ARROWS,
  PALETTES,
  TYPE_SCALES,
  YOU_ARE_HERE,
  type Arrow,
  type Look,
  type PaletteName,
  type Template,
  type TypeScale,
  type YouAreHereDeg,
} from "./types.ts";

export const LOGO_BAND_MIN = 8;
export const LOGO_BAND_MAX = 20;
export const DEFAULT_PALETTE: PaletteName = "linen";

export function defaultLook(): Look {
  return {
    palette: DEFAULT_PALETTE,
    arrow: "off",
    typeScale: "comfort",
    logoOn: true,
    logoBand: 14,
    slots: {
      clock: true,
      now: true,
      next: true,
      status: true,
      message: true,
      directory: true,
      countdown: true,
    },
    youAreHereDeg: 0,
  };
}

export function clampLogoBand(value: number) {
  if (!Number.isFinite(value)) return 14;
  return Math.min(LOGO_BAND_MAX, Math.max(LOGO_BAND_MIN, Math.round(value)));
}

export function parsePalette(value: unknown, previous?: PaletteName): PaletteName {
  if (typeof value === "string" && (PALETTES as readonly string[]).includes(value)) {
    return value as PaletteName;
  }
  return previous ?? DEFAULT_PALETTE;
}

export function parseArrow(value: unknown): Arrow {
  if (typeof value === "string" && (ARROWS as readonly string[]).includes(value)) {
    return value as Arrow;
  }
  return "off";
}

export function parseTypeScale(value: unknown): TypeScale {
  if (typeof value === "string" && (TYPE_SCALES as readonly string[]).includes(value)) {
    return value as TypeScale;
  }
  return "comfort";
}

export function parseYouAreHere(value: unknown): YouAreHereDeg {
  if (typeof value === "number" && (YOU_ARE_HERE as readonly number[]).includes(value)) {
    return value as YouAreHereDeg;
  }
  return 0;
}

/** Door / welcome / message have no arrow slot. Stored look may keep a value; frames force off. */
export function arrowForTemplate(template: Template, arrow: Arrow): Arrow {
  if (template !== "wayfinding") return "off";
  return arrow;
}

export function youAreHereForTemplate(template: Template, deg: YouAreHereDeg): YouAreHereDeg {
  if (template !== "wayfinding") return 0;
  return deg;
}

export function normalizeLook(input: Partial<Look> | null | undefined, previous?: Look): Look {
  const base = previous ?? defaultLook();
  const next = input ?? {};
  return {
    palette: parsePalette(next.palette, base.palette),
    arrow: parseArrow(next.arrow ?? base.arrow),
    typeScale: parseTypeScale(next.typeScale ?? base.typeScale),
    logoOn: typeof next.logoOn === "boolean" ? next.logoOn : base.logoOn,
    logoBand: clampLogoBand(next.logoBand ?? base.logoBand),
    slots: {
      clock: next.slots?.clock ?? base.slots.clock,
      now: next.slots?.now ?? base.slots.now,
      next: next.slots?.next ?? base.slots.next,
      status: next.slots?.status ?? base.slots.status,
      message: next.slots?.message ?? base.slots.message,
      directory: next.slots?.directory ?? base.slots.directory,
      countdown: next.slots?.countdown ?? base.slots.countdown,
    },
    youAreHereDeg: parseYouAreHere(next.youAreHereDeg ?? base.youAreHereDeg),
  };
}
