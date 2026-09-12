# Known issues

Beta. Not audited.

- Welcome kiosk (cage + Chromium) is host-dependent. A missing GPU driver, seatd, or the wrong HDMI leaves a black seat; Foyer itself can still be healthy on loopback. Ubuntu Server default target is `multi-user`; the kiosk unit must be wanted by that, not only `graphical.target`.
- Snap Chromium under cage may need `--no-sandbox` on this dedicated PC.
- Outfit is loaded from Google Fonts. Offline kiosk falls back to system fonts (`fonts-liberation` / `fonts-noto-core`).
- Welcome/Setup bind `0.0.0.0:8080`. Firewall 8080 on the config LAN only — never the rack AP or WAN. The kiosk still loads `http://127.0.0.1:8080/`.
- Calendar source-bind uses the IPv4 of the NIC picked in Setup. If that NIC has no address, ingest keeps last-good and does not silently use another interface.
- Room panel `:8082` is a reverse proxy to welcome. If welcome is down, the plate returns 502.
- Pairing pickup tokens live in process memory. A Foyer restart before the tablet polls means the code must be shown again.
- Sessions (Setup / tech unlock) are in memory. A restart logs you out.
- Wayfinding is not in this app. Leftover `wayfinding` / `split` templates in old JSON are migrated away on load.
- Ubuntu Server has no compositor until you install cage + seatd (INSTALL.md §7).
