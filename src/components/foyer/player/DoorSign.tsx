import { STATUS_LABELS } from "@/lib/foyer/palettes";
import type { Frame, Meeting } from "@/lib/foyer/types";
import { formatWhen } from "./format";

function statusLine(status: Frame["status"]) {
  if (status === "closed") return "Closed";
  if (status === "available") return "Open";
  return STATUS_LABELS[status];
}

function SessionRow({
  meeting,
  timezone,
  size,
}: {
  meeting: Meeting;
  timezone: string;
  size: "now" | "queue";
}) {
  const when = formatWhen(meeting.startIso, timezone);
  if (size === "now") {
    return (
      <div className="door-now">
        <p className="door-now-title">{meeting.title}</p>
        {when ? <p className="door-now-when">{when}</p> : null}
        {meeting.description ? <p className="door-copy">{meeting.description}</p> : null}
      </div>
    );
  }
  return (
    <div className="door-queue-item">
      <p className="door-label">{when}</p>
      <p className="door-queue-title">{meeting.title}</p>
      {meeting.description ? <p className="door-copy">{meeting.description}</p> : null}
    </div>
  );
}

export function DoorSign({ frame }: { frame: Frame }) {
  const queueAll = frame.following ?? [];
  const current = frame.now ?? queueAll[0] ?? null;
  const queue = (frame.now ? queueAll : queueAll.slice(1)).slice(0, 3);
  return (
    <div className="door-wall">
      <div className="door-ident">
        <h1 className="door-name">{frame.identity.roomName}</h1>
        <p className="door-status" data-status={frame.status}>
          {statusLine(frame.status)}
        </p>
      </div>
      {current ? <SessionRow meeting={current} timezone={frame.clock.timezone} size="now" /> : null}
      {queue.length ? (
        <div className="door-queue">
          {queue.map((meeting) => (
            <SessionRow key={`${meeting.startIso}-${meeting.title}`} meeting={meeting} timezone={frame.clock.timezone} size="queue" />
          ))}
        </div>
      ) : !current ? (
        <p className="door-empty">Nothing scheduled</p>
      ) : null}
    </div>
  );
}
