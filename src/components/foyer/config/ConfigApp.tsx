import { useEffect, useState } from "react";
import { enableWelcomeOutput, getSetup, saveSetup, unlockSite, updateFromGithub } from "@/lib/foyer/setup";
import { timezoneOptions } from "@/lib/foyer/site";
import type { Site } from "@/lib/foyer/types";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-fg outline-none focus:ring-2 focus:ring-accent/40";

type NicRow = { index: number; name: string; label: string };
type OutputRow = { index: number; name: string; label: string };

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
        setError(result.reason === "locked" ? "Locked for five minutes." : "PIN not accepted.");
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
      setError("Set a stronger site PIN before saving. 1234 cannot stay.");
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
        },
      });
      if (!result.ok) {
        const reason = result.reason;
        setError(
          reason === "weak"
            ? "That PIN is too common. Use 4+ digits that are not a pattern."
            : reason === "must-change"
              ? "Set a stronger site PIN before saving. 1234 cannot stay."
              : reason === "same-as-other"
                ? "Site and technician PINs must be different."
                : "Could not save.",
        );
        return false;
      }
      setSaved(true);
      setSitePin("");
      setTechPin("");
      setRelaySecret("");
      setIcsUrl("");
      await load(session);
      if (opts?.startKiosk && current.videoOutputIndex !== null && current.videoOutputIndex !== undefined) {
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
    if (!window.confirm("Update Foyer from GitHub?\n\nSave first. The room will go dark for about a minute. Site data stays on disk.")) {
      return;
    }
    try {
      const result = await updateFromGithub({ data: { session } });
      if (!result.ok) {
        setUpdateNote(
          result.reason === "not-git"
            ? "This copy is not a git clone. Install from GitHub."
            : result.reason === "dirty"
              ? "Uncommitted source edits. Commit or discard them first."
              : "Could not start the updater.",
        );
        return;
      }
      setUpdateNote("Updating from GitHub. The page will drop; wait, then unlock Setup again.");
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
            ? "Session expired."
            : "Could not start the HDMI kiosk. Install the foyer-kiosk unit and allow passwordless systemctl restart (INSTALL.md).",
        );
        return;
      }
      setKioskNote("Local output starting. The welcome wall should come up on the HDMI picked above.");
    } catch {
      setKioskNote("Could not reach Foyer.");
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
          <p className="text-muted">Site PIN. First boot is 1234, then you set a stronger one.</p>
          <input
            className={inputClass}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="PIN"
          />
          {error ? <p className="text-sm">{error}</p> : null}
          <button type="submit" className="h-11 rounded-lg bg-fg font-medium text-bg">
            Unlock
          </button>
        </form>
      </main>
    );
  }

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
          <h1 className="text-4xl font-semibold tracking-tight">This room</h1>
          {mustChange ? <p>Change the site PIN before you leave this page.</p> : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-fg px-4 text-sm font-medium text-bg"
            onClick={() => void runKiosk()}
          >
            Enable local output
          </button>
          {kioskNote ? <p className="max-w-xs text-right text-sm text-muted">{kioskNote}</p> : null}
        </div>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold tracking-tight">Building</h2>
        <label className="flex flex-col gap-2 text-sm">
          Name
          <input className={inputClass} value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Timezone
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
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={site.openGlass}
            onChange={(e) => setSite({ ...site, openGlass: e.target.checked })}
          />
          Open glass on the room panel (preview / rack AP)
        </label>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold tracking-tight">This PC</h2>
        <p className="text-sm text-muted">
          Two physical NICs on this PC. Foyer does not read Relay’s picks — set the same interfaces there yourself.
          Welcome uses a local HDMI. Calendar and GitHub go out LAN. The door plate binds AV-LAN.
        </p>
        <label className="flex flex-col gap-2 text-sm">
          Welcome video output
          <select
            className={inputClass}
            value={site.videoOutputIndex ?? ""}
            onChange={(e) => {
              const videoOutputIndex = e.target.value === "" ? null : Number(e.target.value);
              void save({ videoOutputIndex }, { startKiosk: videoOutputIndex !== null });
            }}
          >
            <option value="">Not set</option>
            {outputs.map((row) => (
              <option key={row.name} value={row.index}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          AV-LAN
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
            <option value="">Not set (door plate on all interfaces)</option>
            {nics.map((row) => (
              <option key={`av-${row.name}`} value={row.index}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          LAN (internet)
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
            <option value="">Not set (calendar not bound)</option>
            {nics.map((row) => (
              <option key={`lan-${row.name}`} value={row.index}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        {site.avLanNicIndex !== null &&
        site.outboundNicIndex !== null &&
        site.avLanNicIndex === site.outboundNicIndex ? (
          <p className="text-sm text-muted">AV-LAN and LAN are the same interface. Fine for a test box; split them in the room.</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold tracking-tight">Room</h2>
        {site.rooms.map((room) => (
          <div key={room.id} className="grid gap-3 sm:grid-cols-[1fr_10rem]">
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
          </div>
        ))}
        <p className="text-sm text-muted">
          Auto follows hours, calendar, and Relay. Do not disturb stays on until you switch back.
          A shared calendar can tag events with <code className="text-fg">{`{${site.rooms[0]?.name ?? "Cedar"}}`}</code>.
          With one room on this PC, untagged events land here too.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold tracking-tight">Google Calendar</h2>
        <p className="text-sm text-muted">
          Secret iCal URL. The room panel never sees it.
          {icsOn || icsHost
            ? ` Feed stored${icsHost ? ` (${icsHost})` : ""}. Paste a new URL to replace it.`
            : " Using the on-device demo meetings until you paste a URL."}
        </p>
        <input
          className={inputClass}
          value={icsUrl}
          onChange={(e) => setIcsUrl(e.target.value)}
          placeholder={icsHost ? `stored — ${icsHost}` : "https://calendar.google.com/calendar/ical/…"}
        />
        <p className="text-sm text-muted">
          Last pull via {ingestNic || "any NIC"}.
          {ingestNow ? ` Now: ${ingestNow}.` : ""}
          {ingestNext ? ` Next: ${ingestNext}.` : !ingestNow ? " No current or next session." : ""}
          {ingestNote ? ` ${ingestNote}` : ""}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold tracking-tight">Relay</h2>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={site.relayEnabled}
            onChange={(e) => setSite({ ...site, relayEnabled: e.target.checked })}
          />
          Pull occupancy from Relay on this PC (loopback, not either NIC)
        </label>
        <input
          className={inputClass}
          value={site.relayUrl ?? ""}
          onChange={(e) => setSite({ ...site, relayUrl: e.target.value })}
          placeholder="http://127.0.0.1:8081"
        />
        <input
          className={inputClass}
          value={relaySecret}
          onChange={(e) => setRelaySecret(e.target.value)}
          placeholder={hasRelaySecret ? "Peer secret stored — paste to replace" : "Relay peer secret"}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold tracking-tight">PINs</h2>
        <input className={inputClass} value={sitePin} onChange={(e) => setSitePin(e.target.value)} placeholder="New site PIN" />
        <input className={inputClass} value={techPin} onChange={(e) => setTechPin(e.target.value)} placeholder="Technician PIN" />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold tracking-tight">Update</h2>
        <p className="font-mono text-sm">
          {version || "—"}
          {gitSha ? ` (${gitSha})` : ""}
        </p>
        <p className="text-sm text-muted">
          Fetches <code className="text-fg">origin/main</code>, builds in a side tree, then switches.{" "}
          <code className="text-fg">data/</code> is left alone.
          {!gitClone ? " This copy is not a git clone." : gitDirty ? " Source has uncommitted edits." : ""}
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
