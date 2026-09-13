import { useLayoutEffect, useRef } from "react";
import { STATUS_LABELS } from "@/lib/foyer/palettes";
import type { Frame, Meeting } from "@/lib/foyer/types";
import { formatClock, formatSpan } from "./format";

function statusLine(status: Frame["status"]) {
  if (status === "closed") return "Closed";
  if (status === "available") return "Open";
  return STATUS_LABELS[status];
}

function QueueRow({ meeting, timezone }: { meeting: Meeting; timezone: string }) {
  return (
    <div className="door-queue-item" data-queue-item="">
      <p className="door-queue-time">{formatSpan(meeting.startIso, meeting.endIso, timezone)}</p>
      <div className="door-queue-body">
        <p className="door-queue-title">{meeting.title}</p>
        {meeting.description ? <p className="door-copy">{meeting.description}</p> : null}
      </div>
    </div>
  );
}

function FitQueue({ meetings, timezone }: { meetings: Meeting[]; timezone: string }) {
  const box = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const items = [...el.querySelectorAll<HTMLElement>("[data-queue-item]")];
      for (const node of items) node.hidden = false;
      const limit = el.getBoundingClientRect().bottom;
      let hide = false;
      for (const node of items) {
        if (hide || node.getBoundingClientRect().bottom > limit + 1) {
          node.hidden = true;
          hide = true;
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [meetings]);

  if (!meetings.length) return null;
  return (
    <div ref={box} className="door-queue">
      {meetings.map((meeting) => (
        <QueueRow key={`${meeting.startIso}-${meeting.title}`} meeting={meeting} timezone={timezone} />
      ))}
    </div>
  );
}

export function DoorSign({ frame }: { frame: Frame }) {
  const queueAll = frame.following ?? [];
  const current = frame.now ?? queueAll[0] ?? null;
  const queue = frame.now ? queueAll : queueAll.slice(1);
  const when = current ? formatSpan(current.startIso, current.endIso, frame.clock.timezone) : "";

  return (
    <div className={`door-wall${frame.look.slots.status !== false ? " has-corner" : ""}`}>
      {frame.look.slots.clock ? (
        <p className="door-clock">{formatClock(frame.clock.iso, frame.clock.timezone)}</p>
      ) : null}
      <h1 className="door-name">{frame.identity.roomName}</h1>
      <div className="door-indent">
        {current ? (
          <div className="door-now">
            <p className="door-now-title">{current.title}</p>
            {when ? <p className="door-now-when">{when}</p> : null}
            {current.description ? <p className="door-copy">{current.description}</p> : null}
          </div>
        ) : (
          <p className="door-empty">Nothing scheduled</p>
        )}
        <FitQueue meetings={queue} timezone={frame.clock.timezone} />
      </div>
      {frame.look.slots.status !== false ? (
        <p className="door-corner" data-status={frame.status}>
          {statusLine(frame.status)}
        </p>
      ) : null}
    </div>
  );
}
