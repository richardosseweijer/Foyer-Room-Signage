# Foyer

Room appliance beside Relay: local-video welcome, AV-LAN room plate. Own process. Wayfinding is a separate app.

Follow [`ARCHITECTURE.md`](ARCHITECTURE.md), [`SECURITY.md`](SECURITY.md), and [`FOYER-RELAY.md`](FOYER-RELAY.md). Do not add a `src/lib/foyer/index.ts` barrel. Do not put ICS URLs, PINs, tokens, or NIC names on a Frame. Compose stays free of `fs` / `fetch` / `WebSocket`.

Auth (Better Auth) stays off. PINs are scrypt hashes in `data/foyer-secrets.json`. No Postgres.

Default timezone `Europe/Amsterdam`. Building and room names are user-editable. Welcome is `/` on the local video output. Room panel listens on `:8082` bound to the Setup **AV-LAN** NIC. **LAN (internet)** is a second indexed dropdown; calendar fetch binds to that address. Foyer ↔ Relay occupancy is HTTP to this PC’s AV-LAN `:8081` (loopback lab escape) — [`FOYER-RELAY.md`](FOYER-RELAY.md). Foyer does not read Relay’s NIC picks. Occupancy stays Auto for Relay to set the plate.

Local displays: F1 uses **sway** with one Welcome DRM pick (other outputs off). Dual-role Room-panel second head is F2/F3 — do not ship dual Chromium / second-head pickers here; see INSTALL.md §7b / ARCHITECTURE.md §4a.
