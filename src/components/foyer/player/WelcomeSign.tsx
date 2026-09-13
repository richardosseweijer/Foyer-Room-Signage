import { STATUS_LABELS } from "@/lib/foyer/palettes";
import type { Frame } from "@/lib/foyer/types";
import { welcomeStartLine } from "./format";

function quietStatus(status: Frame["status"]) {
  if (status === "closed") return "Closed";
  if (status === "available") return "Open";
  return STATUS_LABELS[status];
}

export function WelcomeSign({ frame }: { frame: Frame }) {
  const slots = frame.look.slots;
  const headline = slots.now ? (frame.now ?? frame.next) : null;
  const nextUp =
    slots.next && frame.next && (!headline || headline.startIso !== frame.next.startIso) ? frame.next : null;
  const cue =
    slots.countdown && headline ? welcomeStartLine(headline.startIso, frame.clock.iso, frame.clock.timezone) : "";
  const description = slots.message ? (headline?.description ?? "").trim() : "";
  const room = frame.identity.roomName || frame.identity.siteName;

  return (
    <div className="welcome-wall">
      <div className="welcome-hero">
        <p className="welcome-kicker">{headline ? room : frame.identity.siteName || room}</p>
        <h1 className="welcome-title">{headline ? headline.title : room}</h1>
        {cue || description ? (
          <div className="welcome-rail">
            {cue ? <p className="welcome-cue">{cue}</p> : null}
            {description ? <p className="welcome-copy">{description}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="welcome-foot">
        {nextUp ? (
          <div className="welcome-next">
            <p className="welcome-next-label">Next up</p>
            <p className="welcome-next-title">{nextUp.title}</p>
          </div>
        ) : (
          <span />
        )}
        {slots.status ? <p className="welcome-status">{quietStatus(frame.status)}</p> : null}
      </div>
    </div>
  );
}
