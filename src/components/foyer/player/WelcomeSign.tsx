import type { Frame } from "@/lib/foyer/types";
import { welcomeStartLine } from "./format";

export function WelcomeSign({ frame }: { frame: Frame }) {
  const closed = frame.status === "closed";
  const session = closed ? null : (frame.now ?? frame.next);
  const cue = session ? welcomeStartLine(session.startIso, frame.clock.iso, frame.clock.timezone) : "";

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center">
      <h1
        className="font-semibold"
        style={{ fontSize: "clamp(3.2rem, 11vw, 7.5rem)", lineHeight: 0.9, letterSpacing: "-0.055em" }}
      >
        {closed ? "Closed" : "Welcome"}
      </h1>
      {session ? (
        <div
          className="mt-5 flex flex-col gap-2"
          style={{ paddingInlineStart: "clamp(1.75rem, 5.5vw, 4.25rem)" }}
        >
          <p
            className="font-semibold text-balance"
            style={{ fontSize: "clamp(1.7rem, 4.4vw, 3.1rem)", lineHeight: 1.05, letterSpacing: "-0.035em" }}
          >
            {session.title}
          </p>
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
