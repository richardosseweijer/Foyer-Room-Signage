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
| **calendar** | `src/lib/foyer/calendar.ts` | ICS URL (from secrets), optional source IP, events | UI, WebSocket, occupancy override |
| **sanitize** | `src/lib/foyer/sanitize.ts` | Title/host/message cleaning | everything else |
| **compose** | `src/lib/foyer/compose.ts` | Site + look + calendar snapshot + clock → Frame | fs, fetch, ws, secrets, react, net |
| **transport** | `src/lib/foyer/transport.ts` | Pairing codes, display tokens, snapshot/patch seq | layout, palette, event parsing |
| **relay** | `src/lib/foyer/relay.ts` | Relay URL (from site), peer HMAC, occupancy snapshot | UI, compose internals, ICS |
| **persist** | `src/lib/foyer/persist.ts` | Paired write of site + secrets, journal, last-good | play, compose |
| **net** | `src/lib/foyer/net.ts` | Indexed NICs, AV-LAN bind, LAN (internet) calendar bind | compose, PINs, calendar parse |
| **video** | `src/lib/foyer/video.ts` | Indexed local video outputs | compose, calendar, listen |
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
- `identity` (siteName, roomName, floorLabel, logoUrl or null)
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
| Foyer ↔ Relay | `127.0.0.1` | Occupancy HMAC. Not either NIC. |

Welcome is always bound on loopback for the HDMI kiosk. Setup is `/config` on the welcome listener. AV-LAN and LAN are **indexed Setup dropdowns**; Foyer does not read Relay’s NIC picks.

Setup **Update from GitHub** fetches `origin/main`, builds in a detached worktree, then switches the live checkout. `data/` is never copied. Log: `data/foyer-update.log`. A zip-only copy cannot use the button.

## 5. Persistence

| File | Contents |
|---|---|
| `data/foyer-site.json` | Room profile, looks (palette **names**), hours, AV-LAN NIC index/name, LAN (internet) NIC index/name, video output index/name. No PINs, no ICS URLs. |
| `data/foyer-secrets.json` | Site PIN hash, tech PIN hash, display tokens, ICS URLs. |

Write a `foyer-site.json.transaction` journal, then secrets, then site (temp + fsync + rename). Matching `.good` copies refresh after a successful pair. Boot recovers the journal if valid, else the last-good pair, else an empty site. A bad file is renamed `.bad`.

## 6. Defaults

- Timezone **Europe/Amsterdam**, editable in Setup.
- Building name and this room’s name are editable in Setup.
- First site PIN `1234`, then a stronger one is required. Tech PIN unset until Setup sets it (must differ).
- Palette **names** (`linen`, `orchard`, `ink`, `contrast`) are locked.
- One room on this PC. Untagged calendar events go to that room. `{RoomName}` still routes when present.
- Relay occupancy is ingest in `src/lib/foyer/relay.ts` (HMAC GET `/api/peer`), **loopback** (`127.0.0.1:8081`). Not AV-LAN, not guest wifi.

Accepted `GET /api/peer` body (Relay `buildPeerGet`):

```json
{
  "ok": true,
  "v": 1,
  "room": { "id": "relay-room", "name": "Cedar" },
  "host": { "dim": false, "locked": false, "pageId": null },
  "occupancy": "available",
  "vars": { "v1": { "name": "occupancy", "value": "available" } },
  "macros": {}
}
```

`occupancy` is `available | in-session | busy | do-not-disturb | closed`. One Relay and one Foyer share this PC / this room. Foyer applies that field to its room — **names do not have to match**. `room` / `vars` are ignored for occupancy. `host.locked` is in-session only when occupancy is missing. When Setup occupancy is Auto and Relay occupancy is present, that value is the plate status (calendar still lists sessions). Setup occupancy other than Auto is local and is not written back.
- Room occupancy in Setup: Auto, Available, In session, Do not disturb, Closed. Manual values beat calendar and Relay. Sessions stay on the plate.
- Wayfinding is **not** this app.

## 7. Surfaces

`/` welcome on the local video output. `/play/door` room panel. `/config` setup.
