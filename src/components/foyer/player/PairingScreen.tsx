import type { Frame } from "@/lib/foyer/types";

export function PairingScreen({ frame }: { frame: Frame }) {
  const code = frame.pairing.bound ? "" : frame.pairing.code;
  return (
    <div
      className="sign-root flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center"
      data-palette={frame.look.palette}
    >
      <p className="text-sm font-medium" style={{ color: "var(--sign-muted)" }}>
        {frame.identity.siteName}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">This display is unpaired</h1>
      <p className="font-semibold tabular-nums" style={{ fontSize: "clamp(3rem, 10vw, 5.5rem)", letterSpacing: "0.12em" }}>
        {code}
      </p>
      <p className="max-w-sm" style={{ color: "var(--sign-muted)" }}>
        Enter this code in Setup to bind the tablet. Room names stay off the glass until then.
      </p>
    </div>
  );
}
