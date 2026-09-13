import { STATUS_LABELS } from "@/lib/foyer/palettes";
import type { Frame } from "@/lib/foyer/types";
import { formatWhen } from "./format";

function statusLine(status: Frame["status"]) {
  if (status === "closed") return "Closed";
  if (status === "available") return "Open";
  return STATUS_LABELS[status];
}

export function DoorSign({ frame }: { frame: Frame }) {
  const now = frame.now;
  const next = frame.next && frame.next.startIso !== now?.startIso ? frame.next : null;
  return (
    <div className="door-wall">
      <div className="door-ident">
        <p className="door-status">{statusLine(frame.status)}</p>
        <h1 className="door-name">{frame.identity.roomName}</h1>
        {frame.identity.floorLabel ? <p className="door-floor">{frame.identity.floorLabel}</p> : null}
      </div>
      <div className="door-sessions">
        {now ? (
          <div className="door-session">
            <p className="door-label">Now · {formatWhen(now.startIso, frame.clock.timezone)}</p>
            <p className="door-session-title">{now.title}</p>
            {now.description ? <p className="door-copy">{now.description}</p> : null}
          </div>
        ) : (
          <p className="door-empty">Nothing scheduled</p>
        )}
        {next ? (
          <div className="door-session is-next">
            <p className="door-label">Next · {formatWhen(next.startIso, frame.clock.timezone)}</p>
            <p className="door-next-title">{next.title}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
