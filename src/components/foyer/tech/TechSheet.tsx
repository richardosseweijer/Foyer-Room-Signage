import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ARROW_LABELS, PALETTE_LABELS } from "@/lib/foyer/palettes";
import { PANEL_PORT } from "@/lib/foyer/listen";
import {
  ARROWS,
  PALETTES,
  TYPE_SCALES,
  type Arrow,
  type Frame,
  type PaletteName,
  type TypeScale,
} from "@/lib/foyer/types";
import { saveGlassLook, unlockTech } from "@/lib/foyer/glass";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-muted">{label}</span>
      {children}
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

type RoomPick = { on: boolean; arrow: Arrow };

function initialPicks(frame: Frame): Record<string, RoomPick> {
  const selected = new Map(frame.directory.map((row) => [row.roomId, row.arrow]));
  const picks: Record<string, RoomPick> = {};
  for (const room of frame.catalog) {
    const arrow = selected.get(room.id);
    picks[room.id] = { on: arrow !== undefined, arrow: arrow ?? "off" };
  }
  return picks;
}

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
  const [picks, setPicks] = useState<Record<string, RoomPick>>(() => initialPicks(frame));
  const [showNow, setShowNow] = useState(frame.look.slots.now);
  const [countdown, setCountdown] = useState(frame.look.slots.countdown !== false);
  const [showNext, setShowNext] = useState(frame.look.slots.next);
  const [showDescription, setShowDescription] = useState(frame.look.slots.message);
  const [showStatus, setShowStatus] = useState(frame.look.slots.status);

  async function unlock() {
    setError("");
    try {
      const result = await unlockTech({ data: { pin: pin.trim(), clientKey: "tech-sheet" } });
      if (!result.ok) {
        setError(result.reason === "locked" ? "Try again in a few minutes." : "That PIN is not the technician PIN.");
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
      const directory = frame.catalog
        .filter((room) => picks[room.id]?.on)
        .map((room) => ({ roomId: room.id, arrow: picks[room.id]?.arrow ?? "off" }));
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
              now: showNow,
              countdown,
              next: showNext,
              message: showDescription,
              status: showStatus,
            },
          },
          roomId: frame.template === "wayfinding" ? undefined : roomId || null,
          directory: frame.template === "wayfinding" ? directory : undefined,
        },
      });
      if (!result.ok) {
        setError("Unlock with the technician PIN, or turn on open glass in Setup.");
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
        {typeof window !== "undefined" && window.location.port === String(PANEL_PORT) ? (
          <p className="text-sm text-muted">Setup is on this PC, not this plate.</p>
        ) : (
          <Link
            to="/config"
            className="flex h-11 items-center justify-center rounded-lg border border-border text-sm font-medium"
          >
            Open Setup
          </Link>
        )}
        {!unlocked ? (
          <Field label="Technician PIN">
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
            {frame.template === "wayfinding" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-muted">Rooms on this plate</p>
                {frame.catalog.length === 0 ? (
                  <p className="text-sm text-muted">Add rooms in Setup first.</p>
                ) : (
                  frame.catalog.map((room) => {
                    const pick = picks[room.id] ?? { on: false, arrow: "off" as Arrow };
                    return (
                      <div key={room.id} className="flex items-center gap-3">
                        <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={pick.on}
                            onChange={(event) =>
                              setPicks((prev) => ({
                                ...prev,
                                [room.id]: { ...pick, on: event.target.checked },
                              }))
                            }
                          />
                          <span className="truncate font-medium">{room.name}</span>
                        </label>
                        <select
                          className={`${inputClass} w-28 shrink-0`}
                          value={pick.arrow}
                          disabled={!pick.on}
                          onChange={(event) =>
                            setPicks((prev) => ({
                              ...prev,
                              [room.id]: { ...pick, arrow: event.target.value as Arrow },
                            }))
                          }
                        >
                          {ARROWS.map((id) => (
                            <option key={id} value={id}>
                              {ARROW_LABELS[id]}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <Field label="Room">
                <select className={inputClass} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {frame.catalog.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Palette">
              <select className={inputClass} value={palette} onChange={(e) => setPalette(e.target.value as PaletteName)}>
                {PALETTES.map((id) => (
                  <option key={id} value={id}>
                    {PALETTE_LABELS[id]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputClass} value={scale} onChange={(e) => setScale(e.target.value as TypeScale)}>
                {TYPE_SCALES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </Field>
            {frame.template === "welcome" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-muted">Welcome pane</p>
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
              </div>
            ) : null}
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={logoOn} onChange={(e) => setLogoOn(e.target.checked)} />
              Logo band
            </label>
            <Field label="Band size">
              <input
                className={inputClass}
                type="number"
                min={8}
                max={20}
                value={logoBand}
                onChange={(e) => setLogoBand(Number(e.target.value))}
              />
            </Field>
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
