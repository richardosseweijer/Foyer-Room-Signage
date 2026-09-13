# Changelog

## Unreleased

- [`FOYER-RELAY.md`](FOYER-RELAY.md) — communication contract with Relay 0.9.4 (same file in both repos).
- Setup **AV-LAN** and **LAN (internet)** indexed NIC pickers (Foyer does not read Relay’s)
- Door plate `:8082` binds the AV-LAN IPv4; LAN NIC has no IPv4 → calendar is not pulled
- Relay occupancy is 1:1 on this PC (no room-name match). Setup override stays local
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
