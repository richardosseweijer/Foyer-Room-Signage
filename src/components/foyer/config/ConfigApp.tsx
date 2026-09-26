import { useEffect, useState } from "react";
import { enableWelcomeOutput, claimDisplay, getSetup, saveSetup, unlockSite, updateFromGithub } from "@/lib/foyer/setup";
import { timezoneOptions } from "@/lib/foyer/site";
import type { Site } from "@/lib/foyer/types";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg outline-none focus:ring-2 focus:ring-accent/40";

type NicRow = { index: number; name: string; label: string };
type OutputRow = { index: number; name: string; label: string };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

export function ConfigApp() {
  const [pin, setPin] = useState("");
  const [session, setSession] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [error, setError] = useState("");
  const [site, setSite] = useState<Site | null>(null);
  const [icsUrl, setIcsUrl] = useState("");
  const [icsOn, setIcsOn] = useState(false);
  const [relaySecret, setRelaySecret] = useState("");
  const [hasRelaySecret, setHasRelaySecret] = useState(false);
  const [sitePin, setSitePin] = useState("");
  const [techPin, setTechPin] = useState("");
  const [saved, setSaved] = useState(false);
  const [nics, setNics] = useState<NicRow[]>([]);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);
  const [version, setVersion] = useState("");
  const [gitSha, setGitSha] = useState("");
  const [gitClone, setGitClone] = useState(false);
  const [gitDirty, setGitDirty] = useState(false);
  const [updateNote, setUpdateNote] = useState("");
  const [kioskNote, setKioskNote] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [pairNote, setPairNote] = useState("");
  const [icsHost, setIcsHost] = useState("");
  const [ingestNote, setIngestNote] = useState("");
  const [ingestNic, setIngestNic] = useState("");
  const [ingestNow, setIngestNow] = useState("");
  const [ingestNext, setIngestNext] = useState("");

  async function load(nextSession: string) {
    const result = await getSetup({ data: { session: nextSession } });
    if (!result.ok) {
      setError("Session expired.");
      setSession("");
      return;
    }
    setSite(result.site);
    setIcsOn(Boolean(result.icsConfigured[result.site.sharedCalendarId ?? "shared"]));
    setHasRelaySecret(result.hasRelaySecret);
    setMustChange(result.mustChange);
    setNics(result.nics);
    setOutputs(result.outputs);
    setVersion(result.version);
    setGitSha(result.git.sha);
    setGitClone(result.git.clone);
    setGitDirty(result.git.dirty);
    setIcsHost(result.icsHost ?? "");
    setIngestNote(result.ingest?.note ?? "");
    setIngestNic(result.ingest?.nic ?? "");
    setIngestNow(result.ingest?.nowTitle ?? "");
    setIngestNext(result.ingest?.nextTitle ?? "");
  }

  async function unlock() {
    setError("");
    try {
      const result = await unlockSite({ data: { pin: pin.trim(), clientKey: "setup" } });
      if (!result.ok) {
        setError(result.reason === "locked" ? "Too many tries. Wait five minutes." : "Wrong PIN.");
        return;
      }
      setSession(result.session);
      setMustChange(result.mustChange);
      await load(result.session);
    } catch {
      setError("Could not reach Foyer.");
    }
  }

  async function save(patch?: Partial<Site>, opts?: { startKiosk?: boolean }) {
    if (!site) return false;
    const current = { ...site, ...patch };
    if (patch) setSite(current);
    setError("");
    if (mustChange && !sitePin.trim()) {
      setError("Set a new site PIN. 1234 cannot stay.");
      return false;
    }
    try {
      const result = await saveSetup({
        data: {
          session,
          name: current.name,
          timezone: current.timezone,
          rooms: current.rooms.map((room) => ({ id: room.id, name: room.name, occupancy: room.occupancy })),
          icsUrl: icsUrl.trim() || undefined,
          relayUrl: current.relayUrl ?? "",
          relaySecret: relaySecret || undefined,
          relayEnabled: current.relayEnabled,
          openGlass: current.openGlass,
          sitePin: sitePin.trim() || undefined,
          techPin: techPin.trim() || undefined,
          outboundNicIndex: current.outboundNicIndex,
          avLanNicIndex: current.avLanNicIndex,
          videoOutputIndex: current.videoOutputIndex,
          roomPanelVideoOutputIndex: current.roomPanelVideoOutputIndex,
          welcomeFooter: current.welcomeFooter ?? "",
        },
      });
      if (!result.ok) {
        const reason = result.reason;
        setError(
          reason === "weak"
            ? "PIN is too common. Use 4+ digits, not a sequence."
            : reason === "must-change"
              ? "Set a new site PIN. 1234 cannot stay."
              : reason === "same-as-other"
                ? "Site PIN and technician PIN must differ."
                : reason === "same-output"
                  ? "Welcome and Room panel must use different video outputs."
                  : "Could not save.",
        );
        if (reason === "same-output") await load(session);
        return false;
      }
      setSaved(true);
      setSitePin("");
      setTechPin("");
      setRelaySecret("");
      setIcsUrl("");
      await load(session);
      if (opts?.startKiosk) {
        await runKiosk();
      }
      return true;
    } catch {
      setError("Could not reach Foyer.");
      return false;
    }
  }

  async function runUpdate() {
    setUpdateNote("");
    setError("");
    if (!window.confirm("Update Foyer from GitHub?\n\nSave first. Signs go dark for about a minute. Room data stays.")) {
      return;
    }
    try {
      const result = await updateFromGithub({ data: { session } });
      if (!result.ok) {
        setUpdateNote(
          result.reason === "not-git"
            ? "This copy is not a git clone. Install from GitHub."
            : "Could not start the updater.",
        );
        return;
      }
      setUpdateNote("Updating. This page will drop — wait, then unlock again.");
    } catch {
      setUpdateNote("Could not reach Foyer.");
    }
  }

  async function runKiosk() {
    setKioskNote("");
    setError("");
    try {
      const result = await enableWelcomeOutput({ data: { session } });
      if (!result.ok) {
        setKioskNote(
          result.reason === "auth"
            ? "Session expired. Unlock again."
            : "detail" in result && result.detail
              ? String(result.detail)
              : "HDMI kiosk did not start. Check foyer-kiosk.service (INSTALL.md).",
        );
        return;
      }
      setKioskNote("Welcome starting on the HDMI chosen below.");
    } catch {
      setKioskNote("Could not reach Foyer.");
    }
  }

  async function bindPlate() {
    setPairNote("");
    setError("");
    const code = pairCode.trim();
    if (!code) {
      setPairNote("Type the four-digit code from the door tablet.");
      return;
    }
    try {
      const result = await claimDisplay({ data: { session, code } });
      if (!result.ok) {
        setPairNote(
          result.reason === "expired"
            ? "Code expired. Refresh the tablet and try the new one."
            : result.reason === "auth"
              ? "Session expired. Unlock Setup again."
              : "That code is not showing on a tablet.",
        );
        return;
      }
      setPairCode("");
      setPairNote("Tablet bound. It should paint the room within a few seconds.");
    } catch {
      setPairNote("Could not reach Foyer.");
    }
  }

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(t);
  }, [saved]);

  if (!session || !site) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void unlock();
          }}
        >
          <p className="text-sm font-medium text-muted">Foyer</p>
          <h1 className="text-4xl font-semibold tracking-tight">Setup</h1>
          <p className="text-muted">Unlock this page. First start is 1234 — you must change it.</p>
          <Field label="Site PIN">
            <input
              className={inputClass}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </Field>
          {error ? <p className="text-sm">{error}</p> : null}
          <button type="submit" className="h-11 rounded-lg bg-fg font-medium text-bg">
            Unlock
          </button>
        </form>
      </main>
    );
  }

  const roomTag = `{${site.rooms[0]?.name || "Room name"}}`;
  const pullLine = [
    ingestNic ? `Last pull: ${ingestNic}.` : "Last pull: unbound (no LAN NIC).",
    ingestNow ? `Now: ${ingestNow}.` : "",
    ingestNext ? `Next: ${ingestNext}.` : !ingestNow ? "No current or next session." : "",
    ingestNote,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-12">
      <form
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted">Foyer</p>
            <h1 className="text-4xl font-semibold tracking-tight">Setup</h1>
            {mustChange ? <p>Replace the default site PIN before you leave.</p> : null}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-fg px-4 text-sm font-medium text-bg"
              onClick={() => void runKiosk()}
            >
              Start welcome on HDMI
            </button>
            {kioskNote ? <p className="max-w-xs text-right text-sm text-muted">{kioskNote}</p> : null}
          </div>
        </header>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">Building</h2>
          <Field label="Building name">
            <input className={inputClass} value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} />
          </Field>
          <Field label="Timezone" hint="Clocks and calendar times use this zone.">
            <select
              className={inputClass}
              value={site.timezone}
              onChange={(e) => setSite({ ...site, timezone: e.target.value })}
            >
              {timezoneOptions(site.timezone).map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">Door tablet</h2>
          <p className="text-sm text-muted">
            The plate shows a four-digit code until it is bound. Type that code here. The token goes to the tablet, not this browser.
          </p>
          <Field label="Pairing code">
            <input
              className={inputClass}
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
            />
          </Field>
          <button
            type="button"
            className="h-11 rounded-lg border border-border font-medium"
            onClick={() => void bindPlate()}
          >
            Bind tablet
          </button>
          {pairNote ? <p className="text-sm text-muted">{pairNote}</p> : null}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={site.openGlass}
              onChange={(e) => setSite({ ...site, openGlass: e.target.checked })}
            />
            <span>
              Skip pairing
              <span className="mt-1 block font-normal text-muted">Trusted AV-LAN only. Off in a paying venue.</span>
            </span>
          </label>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">This PC</h2>
          <p className="text-sm text-muted">
            Welcome and optional Room panel on local HDMI/DP. Door tablet on AV-LAN. Calendar out LAN. Set the same
            NICs in Relay — Foyer does not read them.
          </p>
          <Field
            label="Welcome HDMI"
            hint="Welcome wall. Changing or clearing this restarts the kiosk. One display: Welcome or Room panel, not both on the same head. Same-output picks are rejected without restart."
          >
            <select
              className={inputClass}
              value={site.videoOutputIndex ?? ""}
              onChange={(e) => {
                const videoOutputIndex = e.target.value === "" ? null : Number(e.target.value);
                void save({ videoOutputIndex }, { startKiosk: true });
              }}
            >
              <option value="">Not set</option>
              {outputs.map((row) => (
                <option key={`welcome-${row.name}`} value={row.index}>
                  {row.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Room panel HDMI"
            hint="Relay control UI on this local head (second Chromium under the same sway seat). Must differ from Welcome. Changing or clearing this restarts the kiosk."
          >
            <select
              className={inputClass}
              value={site.roomPanelVideoOutputIndex ?? ""}
              onChange={(e) => {
                const roomPanelVideoOutputIndex = e.target.value === "" ? null : Number(e.target.value);
                void save({ roomPanelVideoOutputIndex }, { startKiosk: true });
              }}
            >
              <option value="">Not set</option>
              {outputs.map((row) => (
                <option key={`room-${row.name}`} value={row.index}>
                  {row.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Welcome footer" hint="One line under the wall. Blank hides it.">
            <input
              className={inputClass}
              value={site.welcomeFooter ?? ""}
              onChange={(e) => setSite({ ...site, welcomeFooter: e.target.value })}
              maxLength={200}
            />
          </Field>
          <Field label="AV-LAN" hint="Door tablet listens on :8082 on this address. Save to apply.">
            <select
              className={inputClass}
              value={site.avLanNicIndex ?? ""}
              onChange={(e) =>
                setSite({
                  ...site,
                  avLanNicIndex: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Not set — tablet on every interface</option>
              {nics.map((row) => (
                <option key={`av-${row.name}`} value={row.index}>
                  {row.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="LAN (internet)" hint="Calendar and GitHub. No inbound Foyer ports on this NIC.">
            <select
              className={inputClass}
              value={site.outboundNicIndex ?? ""}
              onChange={(e) =>
                setSite({
                  ...site,
                  outboundNicIndex: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Not set — calendar not bound</option>
              {nics.map((row) => (
                <option key={`lan-${row.name}`} value={row.index}>
                  {row.label}
                </option>
              ))}
            </select>
          </Field>
          {site.avLanNicIndex !== null &&
          site.outboundNicIndex !== null &&
          site.avLanNicIndex === site.outboundNicIndex ? (
            <p className="text-sm text-muted">Both pickers use the same NIC. Fine for a test box; split them in the room.</p>
          ) : null}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">Room</h2>
          {site.rooms.map((room) => (
            <div key={room.id} className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <Field label="Room name">
                <input
                  className={inputClass}
                  value={room.name}
                  onChange={(e) =>
                    setSite({
                      ...site,
                      rooms: site.rooms.map((item) => (item.id === room.id ? { ...item, name: e.target.value } : item)),
                    })
                  }
                />
              </Field>
              <Field label="Occupancy">
                <select
                  className={inputClass}
                  value={room.occupancy}
                  onChange={(e) =>
                    setSite({
                      ...site,
                      rooms: site.rooms.map((item) =>
                        item.id === room.id ? { ...item, occupancy: e.target.value as typeof room.occupancy } : item,
                      ),
                    })
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="available">Available</option>
                  <option value="in-session">In session</option>
                  <option value="do-not-disturb">Do not disturb</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
            </div>
          ))}
          <p className="text-sm text-muted">
            Auto follows hours, calendar, and Relay occupancy. Leave Auto if Relay should set the plate status.
            Anything else stays until you change it. Tag shared-calendar events with{" "}
            <code className="text-fg">{roomTag}</code>. One room on this PC also takes untagged events.
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">Google Calendar</h2>
          <Field
            label="iCal URL"
            hint={
              icsOn || icsHost
                ? `Stored${icsHost ? ` (${icsHost})` : ""}. Paste a new secret iCal link to replace it. Tablets never see this.`
                : "Secret Google iCal link. Screens stay empty until you paste one. Tablets never see this."
            }
          >
            <input
              className={inputClass}
              value={icsUrl}
              onChange={(e) => setIcsUrl(e.target.value)}
              placeholder={icsHost ? `stored — ${icsHost}` : "https://calendar.google.com/calendar/ical/…"}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <p className="text-sm text-muted">{pullLine}</p>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">Relay</h2>
          <p className="text-sm text-muted">
            Occupancy from Relay over HTTP on this PC’s AV-LAN (:8081); calendar session back to Relay on
            loopback. This Foyer is this Relay’s room — names do not have to match. Device control stays in
            Relay. Relay reads the current (or next) session from{" "}
            <code className="text-fg">GET http://127.0.0.1:8080/api/peer</code>.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={site.relayEnabled}
              onChange={(e) => setSite({ ...site, relayEnabled: e.target.checked })}
            />
            Read occupancy from Relay on this PC
          </label>
          <Field label="Relay URL" hint="http://&lt;AV-IPv4&gt;:8081 on this PC (http only).">
            <input
              className={inputClass}
              value={site.relayUrl ?? ""}
              onChange={(e) => setSite({ ...site, relayUrl: e.target.value })}
              placeholder="http://<av-lan-ipv4>:8081"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field
            label="Peer secret"
            hint={hasRelaySecret ? "Stored. Not required for occupancy on this PC — leave blank. Paste a new value to replace it." : "Not required on this PC. Loopback occupancy GET is unsigned. Same string as Relay if you set one for macros."}
          >
            <input
              className={inputClass}
              value={relaySecret}
              onChange={(e) => setRelaySecret(e.target.value)}
              placeholder={hasRelaySecret ? "stored — paste to replace" : ""}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">PINs</h2>
          <Field label="Site PIN" hint="Unlocks this page. Leave blank to keep the current PIN.">
            <input
              className={inputClass}
              value={sitePin}
              onChange={(e) => setSitePin(e.target.value)}
              inputMode="numeric"
              autoComplete="new-password"
            />
          </Field>
          <Field label="Technician PIN" hint="Unlocks the plate sheet (long-press). Must differ from the site PIN. Blank keeps the current PIN.">
            <input
              className={inputClass}
              value={techPin}
              onChange={(e) => setTechPin(e.target.value)}
              inputMode="numeric"
              autoComplete="new-password"
            />
          </Field>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-xl font-semibold tracking-tight">Update</h2>
          <p className="font-mono text-sm">
            {version || "—"}
            {gitSha ? ` (${gitSha})` : ""}
          </p>
          <p className="text-sm text-muted">
            Pulls GitHub main, builds, then restarts. Room data in data/ stays.
            {!gitClone ? " This copy is not a git clone." : gitDirty ? " Source has uncommitted edits — they will be discarded on update." : ""}
          </p>
          <button
            type="button"
            className="h-11 rounded-lg border border-border font-medium"
            onClick={() => void runUpdate()}
          >
            Update from GitHub
          </button>
          {updateNote ? <p className="text-sm text-muted">{updateNote}</p> : null}
        </section>

        {error ? <p>{error}</p> : null}
        {saved ? <p>Saved.</p> : null}
        <button type="submit" className="h-12 rounded-lg bg-fg font-medium text-bg">
          Save
        </button>
      </form>
    </main>
  );
}
