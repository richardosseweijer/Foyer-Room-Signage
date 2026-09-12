import type { Frame, Pane } from "@/lib/foyer/types";
import { MeetingBlock } from "./MeetingBlock";
import { StatusPill } from "./StatusPill";

function Column({ pane, timezone, slots }: { pane: Pane; timezone: string; slots: Frame["look"]["slots"] }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col justify-between gap-8 px-2 sm:px-6">
      <div className="flex flex-col gap-3">
        {slots.status ? <StatusPill status={pane.status} /> : null}
        <h2
          className="font-semibold"
          style={{ fontSize: "clamp(1.8rem, 4.2vw, 3.2rem)", lineHeight: 0.98, letterSpacing: "-0.04em" }}
        >
          {pane.roomName}
        </h2>
      </div>
      <div className="flex flex-col gap-6">
        {slots.now ? <MeetingBlock label="Now" meeting={pane.now} timezone={timezone} /> : null}
        {slots.next ? <MeetingBlock label="Next" meeting={pane.next} timezone={timezone} size="next" /> : null}
      </div>
    </section>
  );
}

export function SplitSign({ frame }: { frame: Frame }) {
  const left = frame.panes.find((pane) => pane.slot === "left") ?? frame.panes[0];
  const right = frame.panes.find((pane) => pane.slot === "right") ?? frame.panes[1];
  return (
    <div className="flex h-full min-h-0 flex-col gap-8 md:flex-row md:items-stretch">
      {left ? <Column pane={left} timezone={frame.clock.timezone} slots={frame.look.slots} /> : null}
      <div className="hidden w-px md:block" style={{ background: "var(--sign-line)" }} />
      {right ? <Column pane={right} timezone={frame.clock.timezone} slots={frame.look.slots} /> : null}
    </div>
  );
}
