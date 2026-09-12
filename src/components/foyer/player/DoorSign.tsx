import type { Frame } from "@/lib/foyer/types";
import { MeetingBlock } from "./MeetingBlock";
import { StatusPill } from "./StatusPill";

export function DoorSign({ frame }: { frame: Frame }) {
  return (
    <div className="flex h-full flex-col justify-between gap-10">
      <div className="flex flex-col gap-4">
        {frame.look.slots.status ? <StatusPill status={frame.status} /> : null}
        <h1
          className="font-semibold text-balance"
          style={{ fontSize: "var(--sign-name)", lineHeight: 0.95, letterSpacing: "-0.04em" }}
        >
          {frame.identity.roomName}
        </h1>
        {frame.identity.floorLabel ? (
          <p className="font-medium" style={{ color: "var(--sign-muted)", fontSize: "var(--sign-meta)" }}>
            {frame.identity.floorLabel}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-7">
        {frame.look.slots.now ? (
          <MeetingBlock label="Now" meeting={frame.now} timezone={frame.clock.timezone} />
        ) : null}
        {frame.look.slots.next ? (
          <MeetingBlock label="Next" meeting={frame.next} timezone={frame.clock.timezone} size="next" />
        ) : null}
      </div>
    </div>
  );
}
