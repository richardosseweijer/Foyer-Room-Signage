import { STATUS_LABELS } from "@/lib/foyer/palettes";
import type { Status } from "@/lib/foyer/types";

const TONE: Record<Status, string> = {
  available: "var(--sign-available)",
  "in-session": "var(--sign-session)",
  "starting-soon": "var(--sign-soon)",
  closed: "var(--sign-closed)",
  busy: "var(--sign-busy)",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: `color-mix(in oklab, ${TONE[status]} 16%, transparent)`,
        color: TONE[status],
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
