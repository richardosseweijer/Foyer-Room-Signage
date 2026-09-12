# Known issues

Beta. Not audited.

- Welcome kiosk (cage + Chromium) is host-dependent. A missing GPU driver or the wrong HDMI leaves a black seat; Foyer itself can still be healthy on loopback.
- `npm start` uses Vite preview. Relay **dev** (`8080`) cannot run at the same time as Foyer welcome.
- Calendar source-bind uses the IPv4 of the NIC picked in Setup. If that NIC has no address, ingest keeps last-good and does not silently use another interface.
- Room panel `:8082` is a reverse proxy to welcome. If welcome is down, the plate returns 502.
- Pairing pickup tokens live in process memory. A Foyer restart before the tablet polls means the code must be shown again.
- Sessions (Setup / tech unlock) are in memory. A restart logs you out.
- Wayfinding is not in this app. Leftover `wayfinding` / `split` templates in old JSON are migrated away on load.
- Ubuntu Server has no graphical target until you install cage (INSTALL.md §7).
