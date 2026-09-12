import { STATUS_LABELS } from "@/lib/foyer/palettes";
import type { Status } from "@/lib/foyer/types";

const TONE: Record<Status, string> = {
  available: "var(--sign-available)",
  "in-session": "var(--sign-session)",
  "starting-soon": "var(--sign-soon)",
  closed: "var(--sign-closed)",
  busy: "var(--sign-busy)",
};

function labelFor(status: Status, openClosed: boolean) {
  if (openClosed) {
    if (status === "closed") return "Closed";
    if (status === "available") return "Open";
  }
  return STATUS_LABELS[status];
}

export function StatusPill({
  status,
  size = "md",
  openClosed = false,
}: {
  status: Status;
  size?: "sm" | "md";
  openClosed?: boolean;
}) {
  const compact = size === "sm";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full font-semibold ${compact ? "px-2 py-0.5 text-[0.65rem] tracking-wide uppercase" : "px-3 py-1 text-xs"}`}
      style={{
        background: `color-mix(in oklab, ${TONE[status]} 16%, transparent)`,
        color: TONE[status],
      }}
    >
      {labelFor(status, openClosed)}
    </span>
  );
}
