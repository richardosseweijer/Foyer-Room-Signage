import type { Arrow, Frame } from "@/lib/foyer/types";

function ArrowMark({ dir, size = "row" }: { dir: Arrow; size?: "row" | "hero" }) {
  if (dir === "off") return null;
  const rotate = { left: "-90deg", right: "90deg", up: "0deg", down: "180deg" }[dir];
  const box = size === "hero" ? "h-16 w-16 sm:h-20 sm:w-20" : "h-10 w-10 sm:h-12 sm:w-12";
  return (
    <svg viewBox="0 0 64 64" className={box} style={{ transform: `rotate(${rotate})` }} aria-hidden="true">
      <path
        d="M16 40 L32 16 L48 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WayfindingSign({ frame }: { frame: Frame }) {
  return (
    <div className="flex h-full flex-col gap-10 lg:flex-row lg:gap-16">
      <div className="flex shrink-0 flex-col gap-3 lg:w-[28%]">
        <p className="text-sm font-medium" style={{ color: "var(--sign-muted)" }}>
          You are here
        </p>
        <h1
          className="font-semibold"
          style={{ fontSize: "clamp(1.7rem, 3.6vw, 2.6rem)", lineHeight: 0.98, letterSpacing: "-0.035em" }}
        >
          {frame.identity.siteName}
        </h1>
      </div>
      {frame.look.slots.directory ? (
        <ul className="flex min-w-0 flex-1 flex-col gap-7">
          {frame.directory.map((row) => (
            <li key={row.roomId} className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <h2
                  className="font-semibold"
                  style={{ fontSize: "clamp(1.9rem, 4.4vw, 3.2rem)", lineHeight: 0.98, letterSpacing: "-0.04em" }}
                >
                  {row.name}
                </h2>
                {row.nextLabel || row.description ? (
                  <div className="flex flex-col gap-0.5 pl-0 sm:pl-1">
                    {row.nextLabel ? (
                      <p className="font-medium text-pretty" style={{ fontSize: "var(--sign-meta)" }}>
                        {row.nextLabel}
                      </p>
                    ) : null}
                    {row.description ? (
                      <p className="text-pretty" style={{ color: "var(--sign-muted)", fontSize: "var(--sign-meta)" }}>
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <ArrowMark dir={row.arrow} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
