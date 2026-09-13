import { STATUS_LABELS } from "@/lib/foyer/palettes";
import type { Frame, Meeting } from "@/lib/foyer/types";
import { formatWhen } from "./format";

function statusLine(status: Frame["status"]) {
  if (status === "closed") return "Closed";
  if (status === "available") return "Open";
  return STATUS_LABELS[status];
}

function QueueRow({ meeting, timezone }: { meeting: Meeting; timezone: string }) {
  return (
    <div className="door-queue-item">
      <p className="door-queue-time">{formatWhen(meeting.startIso, timezone)}</p>
      <div className="door-queue-body">
        <p className="door-queue-title">{meeting.title}</p>
        {meeting.description ? <p className="door-copy">{meeting.description}</p> : null}
      </div>
    </div>
  );
}

export function DoorSign({ frame }: { frame: Frame }) {
  const queueAll = frame.following ?? [];
  const current = frame.now ?? queueAll[0] ?? null;
  const queue = (frame.now ? queueAll : queueAll.slice(1)).slice(0, 3);
  const when = current ? formatWhen(current.startIso, frame.clock.timezone) : "";

  return (
    <div className="door-wall">
      <h1 className="door-name">{frame.identity.roomName}</h1>
      <div className="door-indent">
        <p className="door-status" data-status={frame.status}>
          {statusLine(frame.status)}
        </p>
        {current ? (
          <div className="door-now">
            <p className="door-now-title">{current.title}</p>
            {when ? <p className="door-now-when">{when}</p> : null}
            {current.description ? <p className="door-copy">{current.description}</p> : null}
          </div>
        ) : (
          <p className="door-empty">Nothing scheduled</p>
        )}
        {queue.length ? (
          <div className="door-queue">
            {queue.map((meeting) => (
              <QueueRow key={`${meeting.startIso}-${meeting.title}`} meeting={meeting} timezone={frame.clock.timezone} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
