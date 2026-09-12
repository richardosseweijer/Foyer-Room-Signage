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
| **net** | `src/lib/foyer/net.ts` | Indexed NICs, outbound bind | compose, PINs, calendar parse |
| **video** | `src/lib/foyer/video.ts` | Indexed local video outputs | compose, calendar, listen |
| **listen** | `src/lib/foyer/listen.ts` | Welcome port, panel port, path allowlist | compose, calendar, secrets |

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
- `look` (palette **name**, arrow, typeScale, logo flags, slots)
- `identity` (siteName, roomName, floorLabel, logoUrl or null)
- `status`, `clock`, `now`, `next`, `directory` (empty on this appliance), `message`
- `pairing` (bound, or unbound + code)

**Never on a frame:** `icsUrl`, `pin`, `sitePin`, `techPin`, display token, peer secret, NIC names, video output ids, attendee emails, raw HTML.

Extra keys fail parse (strict). Calendar titles are sanitized **before** compose writes `now` / `next`.

## 4. This PC

| Listener | Bind | Serves |
|---|---|---|
| Welcome kiosk | loopback `:8080` | `/` and `/play/welcome` — local video output |
| Room panel | `:8082` (AP address on Ubuntu) | `/play/door` only. `/config` and welcome are 404. `/` redirects to the door. |
| Outbound NIC | no Foyer socket | Calendar fetch source address, selected in Setup as an **indexed** dropdown |

Welcome is always bound. The room panel pairs. Setup is `/config` on the welcome listener.

## 5. Persistence

| File | Contents |
|---|---|
| `data/foyer-site.json` | Room profile, looks (palette **names**), hours, outbound NIC index/name, video output index/name. No PINs, no ICS URLs. |
| `data/foyer-secrets.json` | Site PIN hash, tech PIN hash, display tokens, ICS URLs. |

Write a `foyer-site.json.transaction` journal, then secrets, then site (temp + fsync + rename). Matching `.good` copies refresh after a successful pair. Boot recovers the journal if valid, else the last-good pair, else an empty site. A bad file is renamed `.bad`.

## 6. Defaults

- Timezone **Europe/Amsterdam**, editable in Setup.
- Building name and this room’s name are editable in Setup.
- First site PIN `1234`, then a stronger one is required. Tech PIN unset until Setup sets it (must differ).
- Palette **names** (`linen`, `orchard`, `ink`, `contrast`) are locked.
- One room on this PC. Untagged calendar events go to that room. `{RoomName}` still routes when present.
- Relay occupancy is ingest in `src/lib/foyer/relay.ts` (HMAC GET `/api/peer`), typically `127.0.0.1`.
- Wayfinding is **not** this app.

## 7. Surfaces

`/` welcome on the local video output. `/play/door` room panel. `/config` setup.
