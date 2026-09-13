# Known issues

Beta. Not audited.

- Welcome kiosk replaces the tty1 login console (`Conflicts=getty@tty1`). SSH is unchanged. A missing GPU driver or the wrong HDMI leaves a black seat; Foyer itself can still be healthy on loopback.
- Snap Chromium under cage may need `--no-sandbox` on this dedicated PC.
- Outfit is loaded from Google Fonts. Offline kiosk falls back to system fonts (`fonts-liberation` / `fonts-noto-core`).
- Welcome/Setup bind `0.0.0.0:8080`. Firewall 8080 on **AV-LAN** only — never the internet NIC. The kiosk still loads `http://127.0.0.1:8080/`.
- Calendar source-bind uses the LAN (internet) NIC. If that NIC is picked but has no IPv4, ingest does **not** pull (last-good stays). No AV-LAN fallback.
- Recurring Google events (`RRULE`) are not expanded. Only the seed `DTSTART` is shown.
- Room panel `:8082` is a reverse proxy to welcome. If welcome is down, the plate returns 502. The proxy must keep the tablet `Host` header or `getGlassFrame` throws and the plate shows “Could not reach Foyer.”
- Pairing pickup tokens live in process memory. A Foyer restart before the tablet polls means the code must be shown again.
- Sessions (Setup / tech unlock) are in memory. A restart logs you out.
- Sites created before 0.2.0 may still have room hours `07:00–23:00` (status Closed overnight). New first-boot sites are all-day. Occupancy Closed is the only override that used to blank sessions; 0.2.0 never blanks them.
- Wayfinding is not in this app. Leftover `wayfinding` / `split` templates in old JSON are migrated away on load.
- Ubuntu Server has no compositor until you install cage + seatd (INSTALL.md §7).
- Update-from-GitHub before 0.2.0 did not copy `dist/`; run `npm run build` once after this upgrade.
