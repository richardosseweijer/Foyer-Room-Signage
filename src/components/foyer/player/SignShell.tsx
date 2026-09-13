import type { Frame } from "@/lib/foyer/types";
import { formatClock } from "./format";

export function SignShell({
  frame,
  children,
  onTechHold,
}: {
  frame: Frame;
  children: React.ReactNode;
  onTechHold: () => void;
}) {
  const band = `${Math.max(8, Math.min(20, frame.look.logoBand))}vh`;
  return (
    <div
      className={`sign-root relative flex h-dvh min-h-dvh flex-col${frame.template === "welcome" ? " overflow-hidden" : ""}`}
      data-palette={frame.look.palette}
      data-scale={frame.look.typeScale}
    >
      <button
        type="button"
        aria-label="Technician"
        className="absolute top-0 right-0 z-20 h-16 w-16 opacity-0"
        onPointerDown={(event) => {
          const handle = window.setTimeout(() => onTechHold(), 2000);
          const clear = () => window.clearTimeout(handle);
          event.currentTarget.addEventListener("pointerup", clear, { once: true });
          event.currentTarget.addEventListener("pointerleave", clear, { once: true });
        }}
      />
      {frame.look.logoOn || frame.look.slots.clock ? (
        <div
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 sm:px-10"
          style={{ minHeight: frame.look.logoOn ? (frame.template === "welcome" ? `min(${band}, 10vh)` : band) : "3.25rem" }}
        >
          {frame.look.slots.clock ? (
            <p
              className="justify-self-start font-medium tabular-nums"
              style={{ color: "var(--sign-muted)", fontSize: "var(--sign-meta)" }}
            >
              {formatClock(frame.clock.iso, frame.clock.timezone)}
            </p>
          ) : (
            <span />
          )}
          {frame.look.logoOn ? (
            frame.identity.logoUrl ? (
              <img src={frame.identity.logoUrl} alt="" className="max-h-14 max-w-[min(50vw,16rem)] object-contain" />
            ) : (
              <p className="text-center text-sm font-semibold sm:text-base" style={{ color: "var(--sign-muted)" }}>
                {frame.identity.siteName}
              </p>
            )
          ) : (
            <span />
          )}
          <span />
        </div>
      ) : null}
      <div
        className={
          frame.template === "welcome"
            ? "flex min-h-0 flex-1 flex-col px-[clamp(1.75rem,5.5vw,5.25rem)] pb-[clamp(1.35rem,3.8vh,2.8rem)]"
            : "flex min-h-0 flex-1 flex-col px-[clamp(1.25rem,5vw,2.5rem)] pb-[clamp(1.25rem,4vh,2.25rem)]"
        }
      >
        {children}
      </div>
    </div>
  );
}
