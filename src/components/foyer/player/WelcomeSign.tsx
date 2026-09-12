import type { Frame } from "@/lib/foyer/types";
import { welcomeStartLine } from "./format";
import { StatusPill } from "./StatusPill";

export function WelcomeSign({ frame }: { frame: Frame }) {
  const slots = frame.look.slots;
  const headline = slots.now ? (frame.now ?? frame.next) : null;
  const nextUp =
    slots.next && frame.next && (!headline || headline.startIso !== frame.next.startIso) ? frame.next : null;
  const cue =
    slots.countdown && headline ? welcomeStartLine(headline.startIso, frame.clock.iso, frame.clock.timezone) : "";
  const description = slots.message ? (headline?.description ?? "").trim() : "";

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center">
      {slots.status ? (
        <div className="mb-5">
          <StatusPill status={frame.status} size="sm" openClosed />
        </div>
      ) : null}
      <h1
        className="font-semibold"
        style={{ fontSize: "clamp(3.2rem, 11vw, 7.5rem)", lineHeight: 0.9, letterSpacing: "-0.055em" }}
      >
        Welcome
      </h1>
      {headline || nextUp ? (
        <div
          className="mt-5 flex flex-col gap-2"
          style={{ paddingInlineStart: "clamp(1.75rem, 5.5vw, 4.25rem)" }}
        >
          {headline ? (
            <p
              className="font-semibold text-balance"
              style={{ fontSize: "clamp(1.7rem, 4.4vw, 3.1rem)", lineHeight: 1.05, letterSpacing: "-0.035em" }}
            >
              {headline.title}
            </p>
          ) : null}
          {cue ? (
            <p
              className="font-medium"
              style={{
                color: "var(--sign-muted)",
                fontSize: "clamp(1.05rem, 2.2vw, 1.45rem)",
                paddingInlineStart: "clamp(0.9rem, 2.6vw, 1.85rem)",
              }}
            >
              {cue}
            </p>
          ) : null}
          {description ? (
            <p
              className="max-w-prose text-pretty font-medium"
              style={{
                color: "var(--sign-muted)",
                fontSize: "clamp(0.95rem, 1.8vw, 1.2rem)",
                paddingInlineStart: "clamp(0.9rem, 2.6vw, 1.85rem)",
                lineHeight: 1.35,
              }}
            >
              {description}
            </p>
          ) : null}
          {nextUp ? (
            <div
              className="mt-4 flex flex-col gap-1"
              style={{ paddingInlineStart: "clamp(0.9rem, 2.6vw, 1.85rem)" }}
            >
              <p
                className="font-medium uppercase tracking-[0.14em]"
                style={{ color: "var(--sign-muted)", fontSize: "0.72rem" }}
              >
                Next up
              </p>
              <p
                className="font-semibold text-balance"
                style={{ fontSize: "clamp(1.15rem, 2.6vw, 1.7rem)", letterSpacing: "-0.03em", lineHeight: 1.15 }}
              >
                {nextUp.title}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p
          className="mt-5 font-medium"
          style={{
            color: "var(--sign-muted)",
            fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
            paddingInlineStart: "clamp(1.75rem, 5.5vw, 4.25rem)",
          }}
        >
          {frame.identity.roomName}
        </p>
      )}
    </div>
  );
}
