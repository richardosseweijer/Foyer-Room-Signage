# Foyer

Room appliance beside Relay: local-video welcome, AV-LAN room plate. Own process. Wayfinding is a separate app.

Follow [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`SECURITY.md`](SECURITY.md). Do not add a `src/lib/foyer/index.ts` barrel. Do not put ICS URLs, PINs, tokens, or NIC names on a Frame. Compose stays free of `fs` / `fetch` / `WebSocket`.

Auth (Better Auth) stays off. PINs are scrypt hashes in `data/foyer-secrets.json`. No Postgres.

Default timezone `Europe/Amsterdam`. Building and room names are user-editable. Welcome is `/` on the local video output. Room panel listens on `:8082` bound to the Setup **AV-LAN** NIC. **LAN (internet)** is a second indexed dropdown; calendar fetch binds to that address. Foyer ↔ Relay is loopback. Foyer does not read Relay’s NIC picks.
