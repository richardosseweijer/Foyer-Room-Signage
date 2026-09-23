# Changelog

## 0.2.2

- Tag `v0.2.2`.
- Peer GET: loopback is TCP `remoteAddress` (`127.0.0.1` / `::1` / `::ffff:127.0.0.1`), not `Host` / `X-Forwarded-*`. Missing peer is denied. HMAC on non-loopback GET still denied.
- [`FOYER-RELAY.md`](FOYER-RELAY.md) matches Relay 0.9.6.

## Unreleased
- Kiosk K3: restart classifies sudoers/polkit failures → clear hint to install `deploy/sudoers.foyer-kiosk` as `/etc/sudoers.d/foyer-kiosk` (INSTALL.md §7); Setup shows that detail instead of a generic unit blurb.
- Docs (K0): sync [`FOYER-RELAY.md`](FOYER-RELAY.md) with Relay dual-head narrative; occupancy is AV-LAN HTTP (not `127.0.0.1:8081`); INSTALL §7c points at Relay LINUX.md §7a (R1 shipped).
- Kiosk F4: Welcome clear/change also restarts `foyer-kiosk` (same-output reject still skips restart); Chromium `--class` + sway `app_id`/`class` dual matchers documented; optional `FOYER_CHROMIUM_NO_SANDBOX=1`; Ubuntu Server / Wyse 5070 lab checklist INSTALL §7c.
- Kiosk F3: sway enables Welcome and/or Room panel heads; second Chromium (`data/chromium-room-panel`) loads Relay control UI from `FOYER_ROOM_PANEL_URL` (site `relayUrl`). Welcome-only / Room-panel-only / both. Does not start Relay `relay-kiosk` (§7b).
- Kiosk F2: Setup dual scan-based video pickers (**Welcome HDMI** + **Room panel HDMI**); reject same connector; persist `roomPanelVideoOutputIndex` / `roomPanelVideoOutputName`; write `FOYER_ROOM_PANEL_VIDEO_OUTPUT` beside `FOYER_VIDEO_OUTPUT` in `data/foyer-kiosk.env`.
- Kiosk F1: replace **cage** with **sway** multi-output compositor foundation; still one Welcome Chromium on the Setup DRM pick (other outputs off). Config generated at unit start from `FOYER_VIDEO_OUTPUT`; Chromium profile `data/chromium-welcome` prepares dual profiles for F3.
- Docs (F0/F2): multi-display kiosk Path B — INSTALL §7b, ARCHITECTURE §4a, README, SECURITY, KNOWN_ISSUES (F2 pickers live; F3 Chromium planned).
- Relay URL: on every load, rewrite empty or loopback → `http://<AV-IPv4>:8081` when AV is set (not only on room-appliance migrate). Deliberate non-loopback URLs stay. `isAllowedRelayUrl` requires `http:` (reject `https://`).
- Docs: Foyer↔Relay occupancy is AV HTTP, not loopback-only; [`FOYER-RELAY.md`](FOYER-RELAY.md) pair table toward Relay 0.9.47+.
- Setup **AV-LAN** and **LAN (internet)** indexed NIC pickers (Foyer does not read Relay’s)
- Door plate `:8082` binds the AV-LAN IPv4; LAN NIC has no IPv4 → calendar is not pulled
- Optional welcome footer line from Setup (blank hides it)
- Type scales: Extra large and Giant
- Room tablet can open Setup (`/config` on `:8082`, site PIN)
- Door plate: session state in the lower-right corner (technician toggle)
- Update-from-GitHub script parses again (`restore()` was broken)
- Room occupancy **Do not disturb** (Setup override or Relay `dnd`)

## 0.2.1

- `GET /api/peer` on loopback (`:8080`) returns the current calendar session, or the next one if the room is free (`kind`, `title`, `startIso`, `endIso`). HMAC optional on loopback GET; AV-LAN is denied. Door plate `:8082` does not serve this route.
- Occupancy poll from Relay is 4 s (calendar stays 30 s). Loopback occupancy GET is unsigned so a mismatched peer secret cannot 401 the plate.
- First boot and loopback migrate turn **Read occupancy from Relay** on. Occupancy must stay **Auto** for Relay to set the plate.

## 0.2.0

Audit against the room-appliance contract, then small verified fixes.

**Fixed**

- Room panel `:8082` denies every `/play/*` except `/play/door` (welcome, typos, leftover templates)
- First boot: open glass **off**; room hours all-day (`00:00–00:00`)
- Dead wayfinding/split/meeting-block UI removed from the player
- Door plate never blanks the calendar; status carries occupancy
- Next session is promoted to the large block when the room is free
- Door layout: name at the top, indented rail, following three sessions
- Clock is a technician toggle on the door plate
- GitHub update copies `dist/` and restarts foyer, panel, and kiosk
- Panel HTML is `Cache-Control: no-store`
- Boundary tests cover player + tech sheet imports

**Docs**

- Frame may include `following`, `panes`, `catalog`, `openGlass`
- Calendar unbound fallback when the selected NIC has no IPv4
- Known issues: no `RRULE` expansion; pre-0.2 hours may still be 07:00–23:00

## 0.1.1

- Welcome hero is the room name
- Setup timezone is a dropdown
- Setup **Update from GitHub** (worktree build, `data/` left alone)
- Bind-panel field removed from Setup
- INSTALL.md: seatd, GPU, fonts, SSH tunnel for Setup, kiosk on `multi-user.target`
- `undici` declared (calendar source-bind)
- Welcome/Setup bind `0.0.0.0:8080` for the config laptop
- Room panel proxy keeps the tablet Host so glass RPCs work on LAN
- Update from GitHub finds the git checkout from cwd (not the bundled chunk path)
- Kiosk uses the named HDMI via `wlr-randr` (`data/foyer-kiosk.env`)
- Calendar fetch sends a User-Agent; Setup shows host + last pull
- Kiosk takes tty1 from getty so Chromium covers the Ubuntu Server console

## 0.1.0

First public tree: room appliance on the Relay PC.

- Welcome on the local video output (`/` on loopback `:8080`)
- Room plate on its own listener (`:8082`), Setup and welcome denied
- Indexed Setup dropdowns for outbound NIC and video output
- Calendar fetch binds to the selected NIC (fail closed)
- Wayfinding removed from the product (own app later)
- One room per PC; untagged ICS events land on that room
- Site PIN `1234` then force a stronger one
