import type { Frame } from "@/lib/foyer/types";
import { welcomeStartLine } from "./format";
import { StatusPill } from "./StatusPill";

const sessionPad = "clamp(1.15rem, 3.4vw, 2.6rem)";
const cuePad = "clamp(2.3rem, 6.8vw, 5.2rem)";

export function WelcomeSign({ frame }: { frame: Frame }) {
  const slots = frame.look.slots;
  const headline = slots.now ? (frame.now ?? frame.next) : null;
  const nextUp =
    slots.next && frame.next && (!headline || headline.startIso !== frame.next.startIso) ? frame.next : null;
  const cue =
    slots.countdown && headline ? welcomeStartLine(headline.startIso, frame.clock.iso, frame.clock.timezone) : "";
  const description = slots.message ? (headline?.description ?? "").trim() : "";

  return (
    <div className="flex h-full w-full flex-col justify-center text-left">
      {slots.status ? (
        <div className="mb-4">
          <StatusPill status={frame.status} size="sm" openClosed />
        </div>
      ) : null}
      <h1
        className="font-semibold"
        style={{ fontSize: "clamp(2rem, 5.6vw, 3.6rem)", lineHeight: 0.95, letterSpacing: "-0.045em" }}
      >
        {frame.identity.roomName || frame.identity.siteName}
      </h1>
      {headline || nextUp ? (
        <div className="mt-4 flex w-full flex-col gap-2">
          {headline ? (
            <p
              className="font-semibold text-pretty"
              style={{
                width: "65%",
                paddingInlineStart: sessionPad,
                fontSize: "clamp(2.2rem, 6.4vw, 4.6rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.035em",
              }}
            >
              {headline.title}
            </p>
          ) : null}
          {cue ? (
            <p
              className="font-medium"
              style={{
                width: "65%",
                color: "var(--sign-muted)",
                fontSize: "clamp(1rem, 2vw, 1.35rem)",
                paddingInlineStart: cuePad,
              }}
            >
              {cue}
            </p>
          ) : null}
          {description ? (
            <p
              className="text-pretty font-medium"
              style={{
                width: "65%",
                color: "var(--sign-muted)",
                fontSize: "clamp(0.95rem, 1.7vw, 1.2rem)",
                paddingInlineStart: cuePad,
                lineHeight: 1.35,
              }}
            >
              {description}
            </p>
          ) : null}
          {nextUp ? (
            <div className="mt-3 flex w-[65%] flex-col gap-1" style={{ paddingInlineStart: cuePad }}>
              <p
                className="font-medium uppercase tracking-[0.14em]"
                style={{ color: "var(--sign-muted)", fontSize: "0.72rem" }}
              >
                Next up
              </p>
              <p
                className="font-semibold text-pretty"
                style={{ fontSize: "clamp(1.1rem, 2.4vw, 1.55rem)", letterSpacing: "-0.03em", lineHeight: 1.15 }}
              >
                {nextUp.title}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
