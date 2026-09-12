import type { Meeting } from "@/lib/foyer/types";
import { formatWhen } from "./format";

export function MeetingBlock({
  label,
  meeting,
  timezone,
  size = "now",
}: {
  label: string;
  meeting: Meeting | null;
  timezone: string;
  size?: "now" | "next";
}) {
  if (!meeting) return null;
  const large = size === "now";
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium" style={{ color: "var(--sign-muted)" }}>
        {label}
        {meeting.startIso ? ` · ${formatWhen(meeting.startIso, timezone)}` : ""}
      </p>
      <p
        className="font-semibold text-balance"
        style={{
          fontSize: large ? "clamp(1.35rem, 3.2vw, 2.2rem)" : "var(--sign-meta)",
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
        }}
      >
        {meeting.title}
      </p>
      {meeting.description ? (
        <p className="max-w-prose text-pretty" style={{ color: "var(--sign-muted)", fontSize: "var(--sign-meta)" }}>
          {meeting.description}
        </p>
      ) : null}
    </div>
  );
}
