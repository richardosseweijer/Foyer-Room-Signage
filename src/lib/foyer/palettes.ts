import type { Arrow, PaletteName, Status, TypeScale } from "./types.ts";

export const PALETTE_LABELS: Record<PaletteName, string> = {
  linen: "Linen",
  orchard: "Orchard",
  ink: "Ink",
  contrast: "Contrast",
};

export const SCALE_LABELS: Record<TypeScale, string> = {
  comfort: "Comfort",
  large: "Large",
  "extra-large": "Extra large",
  giant: "Giant",
};

export const STATUS_LABELS: Record<Status, string> = {
  available: "Available",
  "in-session": "In session",
  "starting-soon": "Starting soon",
  closed: "Closed",
  busy: "Busy",
  "do-not-disturb": "Do not disturb",
};

export const ARROW_LABELS: Record<Arrow, string> = {
  off: "Off",
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
};
