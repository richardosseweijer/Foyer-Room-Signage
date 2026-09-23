# Foyer security

Room appliance on the Relay PC. Not audited. The rack AP is untrusted; the outbound NIC is outbound-only.

## Report

Contact the maintainer privately. Do not file a public issue with exploit details.

## Threats we treat as real

- Anyone at the door can hold the room panel.
- A stolen tablet still has a browser.
- A stolen disk has `data/`.
- Google event titles are untrusted input (XSS).
- The outbound NIC must not accept inbound Foyer.
- The door tablet sits on **AV-LAN** with the DSP. HMAC on Relay stays required for tablet/LAN peers. Foyer ↔ Relay occupancy uses **HTTP** to this PC’s **AV-LAN IPv4 `:8081`** (or loopback in lab); same-PC allowlist only.

## Baseline

| Control | Rule |
|---|---|
| Listen | Welcome on `0.0.0.0:8080` so the HDMI kiosk and Setup work (`src/lib/foyer/listen.ts`). Room panel (`src/lib/foyer/panel.ts`) binds the Setup-selected **AV-LAN** IPv4 on `:8082` (all interfaces until that NIC is picked). Firewall: 8080/8082 on AV-LAN only — never the internet NIC. |
| Calendar bind | ICS fetch uses the Setup-selected **LAN (internet)** NIC (`src/lib/foyer/net.ts`). If that NIC is picked but has no IPv4, calendar is **not** pulled (last-good stays). No fallback onto AV-LAN. |
| Two PINs | **Site** PIN unlocks `/config`. **Tech** PIN unlocks the endpoint sheet. Cross-gate: site PIN is rejected on tech, tech PIN is rejected on config. |
| First PIN | `1234` then force a stronger one. Weak list in `src/lib/foyer/pins.ts`. |
| Lockout | 5 fails / 5 min per gate. Process memory; a restart clears the counter. |
| Pairing | Welcome (local video) is always bound. Room panel: display token after claim. Unpaired glass shows a code, not room data. |
| Calendar | Server pulls Google ICS. Tablets never see the URL. Titles **and descriptions** sanitized. `{RoomName}` routes; one-room PC also accepts untagged events. Private → `Busy`. |
| Relay | Occupancy: Foyer GETs Relay on **`http://<AV-IPv4>:8081/api/peer`** (allowlist: loopback **or** this PC’s AV IPv4; **`http:` only**). Calendar session: Relay GETs Foyer on loopback `:8080/api/peer`. Unsigned GET only when the **TCP peer** is loopback (`127.0.0.1` / `::1`); `Host` / `X-Forwarded-*` are not loopback. HMAC if sent must match. Non-loopback Foyer peer GET denied even with HMAC. No occupancy POST. Door `:8082` denies `/api/peer`. Wire: [`FOYER-RELAY.md`](FOYER-RELAY.md). Secret, if pasted, stays in `foyer-secrets.json`. Occupancy snapshot only on the frame. |
| Secrets | `data/foyer-secrets.json`: hashed PINs, ICS URLs, tokens. Export strips them. Not in git. |
| Logos | jpeg/png/webp, size cap. No SVG. |
| Logs | No PIN, no ICS, no token in log lines. `data/foyer-update.log` is git SHAs and npm only. |
| Update | Setup session required. Dirty source refuses. `data/` is not in the worktree swap. |
| Kiosk | Setup session. Restarts a **fixed** unit name (`foyer-kiosk.service`) only. F1: one Welcome head under sway (DRM scan pick). Dual-role second head stays planned — Setup-gated fixed units only ([INSTALL.md §7b](INSTALL.md)). |
| Panel bind | Saving a new AV-LAN NIC restarts `foyer-panel.service` only (`src/lib/foyer/panel.ts`). |
| Defaults | Deny. Open glass is an explicit switch, off in production. |

## PINs

Stored as `scrypt$<salt>$<hash>`. `src/lib/foyer/pins.server.ts` hashes and verifies. `src/lib/foyer/pins.ts` is the weak list. Never put a PIN on a Frame.

Site PIN on the tech sheet → **reject**. Tech PIN on `/config` → **reject**. No hint which field was wrong.

## Calendar and XSS

Event titles, hosts, and messages pass `src/lib/foyer/sanitize.ts` before they enter compose. No HTML from Google on the glass. Compose must not skip sanitize.

ICS URLs live only in secrets (`icsUrls`). They are not a Site field and not a Frame field.

## Persist

A failed second write restores the previous secrets file so the pair stays last-good. A corrupt journal is set aside (`.transaction.bad`) and does not wipe a healthy pair. Secrets unreadable → boot with lockouts; no default PIN in the player payload.

## Modules that must stay closed

`compose` (`src/lib/foyer/compose.ts`) has no `fs`, `fetch`, or `WebSocket`. Player UI does not import `secrets`, `calendar`, `persist`, or `net`. A CI boundary test fails the build if those imports appear.
