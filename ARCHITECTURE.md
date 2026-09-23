# Foyer architecture

Foyer is a **room appliance** on the Ubuntu Relay PC: the welcome wall on a local video output, and a room plate on the rack AP. It is a **separate process** from Relay. Relay owns devices. Foyer owns pictures. Wayfinding is a different app.

This file is the contract. If a change needs calendar **and** a NIC **and** a PIN, it is in the wrong module.

## 1. Law (anti-god)

A module may do **one** of: persist, ingest, compose a frame, render, authorize, or listen. Never two.

**Frame** is the only payload a plate may hold. The composer is the only writer of frames. The player only renders. The tech sheet only patches **Look** (and this room’s binding). Welcome does not pair.

## 2. Object map

| Object | Module path | Allowed to know | Forbidden |
|---|---|---|---|
| **types** | `src/lib/foyer/types.ts` | Frame, Site, Look, Display, Secrets, CalendarSnapshot shapes | fs, fetch, routes |
| **secrets** | `src/lib/foyer/secrets.ts` | PIN hashes, ICS URLs, display tokens | compose, play, calendar |
| **pins** | `src/lib/foyer/pins.ts` | Weak-PIN list, hash-format detect | hashing, lockout, disk |
| **pins.server** | `src/lib/foyer/pins.server.ts` | scrypt hash/verify, lockout map | compose, play, calendar |
| **site** | `src/lib/foyer/site.ts` | This room, hours, display↔room, logo path | theme, Google bytes, PINs, NICs |
| **look** | `src/lib/foyer/look.ts` | Per-display palette **name**, slots, type scale | calendar, secrets, net |
| **calendar** | `src/lib/foyer/calendar.ts` | ICS URL (from secrets), optional source IP, events, current-or-next session | UI, WebSocket, occupancy override |
| **sanitize** | `src/lib/foyer/sanitize.ts` | Title/host/message cleaning | everything else |
| **compose** | `src/lib/foyer/compose.ts` | Site + look + calendar snapshot + clock → Frame | fs, fetch, ws, secrets, react, net |
| **transport** | `src/lib/foyer/transport.ts` | Pairing codes, display tokens, snapshot/patch seq | layout, palette, event parsing |
| **relay** | `src/lib/foyer/relay.ts` | Relay URL (from site), peer HMAC, occupancy snapshot, Foyer `GET /api/peer` session body | UI, compose internals, ICS |
| **persist** | `src/lib/foyer/persist.ts` | Paired write of site + secrets, journal, last-good | play, compose |
| **net** | `src/lib/foyer/net.ts` | Indexed NICs, AV-LAN bind, LAN (internet) calendar bind | compose, PINs, calendar parse |
| **video** | `src/lib/foyer/video.ts` | Indexed local video outputs (DRM scan `/sys/class/drm`; today: one Welcome pick) | compose, calendar, listen |
| **listen** | `src/lib/foyer/listen.ts` | Welcome host/port, panel port, path allowlist | compose, calendar, secrets |
| **panel** | `src/lib/foyer/panel.ts` | Restart `foyer-panel.service` after AV-LAN bind changes | compose, calendar, secrets |
| **update** | `src/lib/foyer/update.ts` | Git identity, spawn updater | compose, calendar, secrets, PINs |
| **kiosk** | `src/lib/foyer/kiosk.ts` | Restart `foyer-kiosk.service` | compose, calendar, secrets |

UI:

| Surface | Path | May import | Must not import |
|---|---|---|---|
| Player | `src/components/foyer/player/` | types, Frame, palettes labels, glass fns | calendar, secrets, persist, relay, net |
| Tech sheet | `src/components/foyer/tech/` | look fields, glass fns | site, calendar, secrets |
| Site config | `src/components/foyer/config/` | site, setup fns | look (read-only preview ok) |

There is **no** `src/lib/foyer/index.ts` barrel. Import the module you mean.

## 3. Frame (wire contract)

A plate may hold only:

- `v`, `seq`, `displayId`, `roomId`, `template`
- `look` (palette **name**, arrow, typeScale, logo flags, slots including countdown and clock)
- `identity` (siteName, roomName, floorLabel, logoUrl or null, footer — welcome one-liner, empty hides it)
- `status`, `clock`, `now`, `next`, `following` (bounded upcoming list; the door plate clips to the screen)
- `panes`, `directory` (empty on this appliance), `catalog` (id+name for the tech sheet), `message`
- `pairing` (bound, or unbound + code), `openGlass`

**Never on a frame:** `icsUrl`, `pin`, `sitePin`, `techPin`, display token, peer secret, NIC names, video output ids, attendee emails, raw HTML.

Extra keys fail parse (strict). Calendar titles are sanitized **before** compose writes `now` / `next`.

## 4. This PC

| Listener | Bind | Serves |
|---|---|---|
| Welcome kiosk | `0.0.0.0:8080` | `/` and `/play/welcome` — local video; Setup from a config laptop on AV-LAN |
| Room panel | AV-LAN IPv4 `:8082` (all interfaces until that NIC is picked) | `/play/door` and `/config` (site PIN). Other `/play/*` ids are 404. `/` redirects to the door. |
| LAN (internet) NIC | no Foyer socket | Calendar fetch source address. GitHub update uses the default route on this NIC. |
| Foyer ↔ Relay | Occupancy: this PC’s **AV-LAN IPv4** (or loopback lab); session: `127.0.0.1` | Occupancy GET to Relay `http://<AV-IPv4>:8081/api/peer`. Calendar session GET on Foyer `:8080/api/peer` (loopback). Wire: [`FOYER-RELAY.md`](FOYER-RELAY.md). |

Welcome is always bound on loopback for the HDMI kiosk. Setup is `/config` on the welcome listener. AV-LAN and LAN are **indexed Setup dropdowns**; Foyer does not read Relay’s NIC picks.

Setup **Update from GitHub** fetches `origin/main`, builds in a detached worktree, then switches the live checkout. `data/` is never copied. Log: `data/foyer-update.log`. A zip-only copy cannot use the button.


## 4a. Local displays (F1 / F2 / F3)

**Current:** one **sway** seat on tty1 (wlroots multi-output; one DRM master). `src/lib/foyer/video.ts` lists physical DRM connectors under `/sys/class/drm` (scan-based; 1–4 connected heads). Setup stores **two** independent picks — Welcome (`videoOutputIndex` / `videoOutputName`) and Room panel (`roomPanelVideoOutputIndex` / `roomPanelVideoOutputName`). Same connector for both roles is rejected on save. `src/lib/foyer/kiosk.ts` restarts fixed unit `foyer-kiosk.service`. Persist writes `data/foyer-kiosk.env`:

- `FOYER_VIDEO_OUTPUT` — Welcome (explicit pick; F1 fallback to first connected only when Room panel is also unset)
- `FOYER_ROOM_PANEL_VIDEO_OUTPUT` — Room panel (explicit; empty when unset)
- `FOYER_ROOM_PANEL_URL` — site `relayUrl` as `http://host[:port]/` (Relay control UI; empty when unset)

At unit start `scripts/foyer-kiosk-sway.sh` enables the picked head(s), assigns workspaces per role, and execs:

| Role | Script | Profile | URL |
|---|---|---|---|
| Welcome | `scripts/foyer-kiosk.sh` | `data/chromium-welcome` | `http://127.0.0.1:8080/` |
| Room panel | `scripts/foyer-kiosk-room-panel.sh` | `data/chromium-room-panel` | `FOYER_ROOM_PANEL_URL` (Relay) |

Welcome-only / Room-panel-only / both. Foyer does **not** start Relay’s `relay-kiosk`. The AV-LAN door tablet on `:8082` is unchanged.

| Role | Surface | Status |
|---|---|---|
| Welcome | Foyer Welcome URL on the chosen local head | Live |
| Room panel | Relay control UI on a local head | Live (F3) |

One-display: Welcome **or** Room panel on that single head. Multi-display: different outputs per role; same output for both → reject (F2). When Foyer drives the Room panel head, Relay’s own relay-kiosk on this host is optional/off. Peer wire stays [`FOYER-RELAY.md`](FOYER-RELAY.md) (identical copy also in Relay).

## 5. Persistence

| File | Contents |
|---|---|
| `data/foyer-site.json` | Room profile, looks (palette **names**), hours, AV-LAN NIC index/name, LAN (internet) NIC index/name, Welcome + Room panel video output index/name. No PINs, no ICS URLs. |
| `data/foyer-secrets.json` | Site PIN hash, tech PIN hash, display tokens, ICS URLs. |

Write a `foyer-site.json.transaction` journal, then secrets, then site (temp + fsync + rename). Matching `.good` copies refresh after a successful pair. Boot recovers the journal if valid, else the last-good pair, else an empty site. A bad file is renamed `.bad`.

## 6. Defaults

- Timezone **Europe/Amsterdam**, editable in Setup.
- Building name and this room’s name are editable in Setup.
- First site PIN `1234`, then a stronger one is required. Tech PIN unset until Setup sets it (must differ).
- Palette **names** (`linen`, `orchard`, `ink`, `contrast`) are locked.
- One room on this PC. Untagged calendar events go to that room. `{RoomName}` still routes when present.
- Relay occupancy is ingest in `src/lib/foyer/relay.ts` (`GET /api/peer`), **loopback** (`127.0.0.1:8081`). Not AV-LAN, not guest wifi. Full request/response, occupancy enum, Auto vs override, and session body: [`FOYER-RELAY.md`](FOYER-RELAY.md).
- Room occupancy in Setup: Auto, Available, In session, Do not disturb, Closed. Manual values beat calendar and Relay. Sessions stay on the plate.
- Wayfinding is **not** this app.

## 7. Surfaces

`/` welcome on the local video output. `/play/door` room panel. `/config` setup.
