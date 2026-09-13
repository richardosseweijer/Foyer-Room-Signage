import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PALETTE_LABELS, SCALE_LABELS } from "@/lib/foyer/palettes";
import {
  PALETTES,
  TYPE_SCALES,
  type Frame,
  type PaletteName,
  type TypeScale,
} from "@/lib/foyer/types";
import { saveGlassLook, unlockTech } from "@/lib/foyer/glass";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "h-11 rounded-lg border border-border bg-surface px-3 text-fg outline-none focus:ring-2 focus:ring-accent/40";

const PLATE_LABEL: Record<Frame["template"], string> = {
  welcome: "Welcome",
  door: "Room plate",
  wayfinding: "Wayfinding",
  split: "Split",
  message: "Message",
};

export function TechSheet({
  frame,
  onClose,
  onSaved,
}: {
  frame: Frame;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pin, setPin] = useState("");
  const [session, setSession] = useState("");
  const [unlocked, setUnlocked] = useState(frame.openGlass);
  const [error, setError] = useState("");
  const [palette, setPalette] = useState<PaletteName>(frame.look.palette);
  const [scale, setScale] = useState<TypeScale>(frame.look.typeScale);
  const [logoOn, setLogoOn] = useState(frame.look.logoOn);
  const [logoBand, setLogoBand] = useState(frame.look.logoBand);
  const [roomId, setRoomId] = useState(frame.roomId ?? "");
  const [showNow, setShowNow] = useState(frame.look.slots.now);
  const [countdown, setCountdown] = useState(frame.look.slots.countdown !== false);
  const [showNext, setShowNext] = useState(frame.look.slots.next);
  const [showDescription, setShowDescription] = useState(frame.look.slots.message);
  const [showStatus, setShowStatus] = useState(frame.look.slots.status);
  const [showClock, setShowClock] = useState(frame.look.slots.clock);

  async function unlock() {
    setError("");
    try {
      const result = await unlockTech({ data: { pin: pin.trim(), clientKey: "tech-sheet" } });
      if (!result.ok) {
        setError(result.reason === "locked" ? "Too many tries. Wait a few minutes." : "Wrong technician PIN.");
        return;
      }
      setSession(result.session);
      setUnlocked(true);
    } catch {
      setError("Could not reach Foyer.");
    }
  }

  async function save() {
    setError("");
    try {
      const result = await saveGlassLook({
        data: {
          displayId: frame.displayId,
          session: session || undefined,
          look: {
            palette,
            typeScale: scale,
            logoOn,
            logoBand,
            slots: {
              ...frame.look.slots,
              clock: showClock,
              now: showNow,
              countdown,
              next: showNext,
              message: showDescription,
              status: showStatus,
            },
          },
          roomId: frame.template === "wayfinding" ? undefined : roomId || null,
        },
      });
      if (!result.ok) {
        setError("Unlock with the technician PIN, or turn on skip-pairing in Setup.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Could not reach Foyer.");
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        className="flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-auto rounded-2xl bg-bg p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (!unlocked) void unlock();
          else void save();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">Technician · {PLATE_LABEL[frame.template]}</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {frame.template === "wayfinding" ? frame.identity.siteName : frame.identity.roomName}
            </h2>
          </div>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <Link
          to="/config"
          className="flex h-11 items-center justify-center rounded-lg border border-border text-sm font-medium"
        >
          Open Setup
        </Link>
        <p className="text-sm text-muted">Building, calendar, NICs, and Relay. Site PIN.</p>
        {!unlocked ? (
          <Field label="Technician PIN" hint="Set in Setup. Not the site PIN.">
            <input
              className={inputClass}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </Field>
        ) : (
          <>
            {frame.template !== "wayfinding" ? (
              <Field label="Room" hint="Which room this plate shows.">
                <select className={inputClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {frame.catalog.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Palette" hint="Plate colors. Same four names on every Foyer.">
              <select className={inputClass} value={palette} onChange={(e) => setPalette(e.target.value as PaletteName)}>
                {PALETTES.map((id) => (
                  <option key={id} value={id}>
                    {PALETTE_LABELS[id]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type size">
              <select className={inputClass} value={scale} onChange={(e) => setScale(e.target.value as TypeScale)}>
                {TYPE_SCALES.map((id) => (
                  <option key={id} value={id}>
                    {SCALE_LABELS[id]}
                  </option>
                ))}
              </select>
            </Field>
            {frame.template === "welcome" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-muted">Show on welcome</p>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={showNow} onChange={(e) => setShowNow(e.target.checked)} />
                  Session name
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={countdown} onChange={(e) => setCountdown(e.target.checked)} />
                  Countdown
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={showNext} onChange={(e) => setShowNext(e.target.checked)} />
                  Next up
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={showDescription}
                    onChange={(e) => setShowDescription(e.target.checked)}
                  />
                  Description
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={showStatus} onChange={(e) => setShowStatus(e.target.checked)} />
                  Open / closed
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={showClock} onChange={(e) => setShowClock(e.target.checked)} />
                  Clock
                </label>
              </div>
            ) : null}
            {frame.template === "door" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-muted">Show on room plate</p>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={showStatus} onChange={(e) => setShowStatus(e.target.checked)} />
                  Room status (lower right)
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={showClock} onChange={(e) => setShowClock(e.target.checked)} />
                  Clock (lower left)
                </label>
              </div>
            ) : null}
            {frame.template !== "welcome" && frame.template !== "door" ? (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={showClock} onChange={(e) => setShowClock(e.target.checked)} />
                Clock
              </label>
            ) : null}
            {frame.template !== "door" ? (
              <>
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={logoOn} onChange={(e) => setLogoOn(e.target.checked)} />
                  Logo strip
                </label>
                {logoOn ? (
                  <Field label="Logo height" hint="Percent of the plate, 8–20.">
                    <input
                      className={inputClass}
                      type="number"
                      min={8}
                      max={20}
                      value={logoBand}
                      onChange={(e) => setLogoBand(Number(e.target.value))}
                    />
                  </Field>
                ) : null}
              </>
            ) : null}
          </>
        )}
        {error ? <p className="text-sm text-muted">{error}</p> : null}
        <button type="submit" className="h-11 rounded-lg bg-fg font-medium text-bg">
          {unlocked ? "Save plate" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
