# Foyer ↔ Relay contract — pointer

The contract (**v2**) and the Foyer split plan live in **one master copy**: Relay [`FOYER-RELAY.md`](https://github.com/richardosseweijer/Relay-AV-Room-Control-/blob/main/FOYER-RELAY.md). Relay also owns the Foyer driver spec (`data/library/foyer.json`). Do not keep a second copy here; change the master in the Relay repo and edit this pointer only when Foyer’s obligations below change.

**Status:** Foyer speaks the **v2 wire** (F1): signed loopback `GET /api/peer` and `POST /api/peer/status`, signed report-back to Relay `POST /api/device/<deviceId>/in`; Foyer no longer polls Relay. F2: the Relay URL and kiosk env come from Foyer's own AV-LAN pick and follow Relay's `br-av` bridge (no stored URL). F3: `:8080` and `:8082` each bind `127.0.0.1` plus the AV-LAN address (bridge-followed; covers wired AV-LAN and the bridged AP), never `0.0.0.0`. The v1 day-one dual-head checklist and operator setup now live in the master’s **Appendix (A.1 / A.2)**.

## What v2 asks of Foyer (summary — master wins)

- **Foyer is a Relay device.** Relay talks to Foyer only through its Foyer driver, signed with one shared key (Setup → Relay secret = Relay → Devices → Foyer → Secret). No unsigned requests either way.
- **Serve** (welcome `:8080`, loopback peer only, signed): `GET /api/peer` (session, same body as v1) and `POST /api/peer/status` (`{"status":"available|in-session|do-not-disturb|closed"}` — text, never `0`–`3`). The door `:8082` refuses `/api/peer*`.
- **Report back** to Relay `POST /api/device/<deviceId>/in` (signed) when the session changes. Stop polling Relay for occupancy.
- **Own your WAN data** (calendar now; room booking for the door display and narrowcasting for the room display later). Fetch it yourself over the WAN NIC; Relay does not proxy it.
- **Own your NIC binding** with the Setup dual-NIC picker (AV-LAN → door listen, Relay URL, room-panel URL; WAN → fetches), including following the AV address onto Relay’s `br-av` bridge. Relay stops writing `data/foyer-site.json` / `data/foyer-kiosk.env` and stops restarting Foyer units.
- **Never touch the network or firewall** (`ufw`, `nmcli`, `ip`). Relay owns UFW: it keeps Foyer’s default ports (8080–8082 on the AV bridge) and guarantees Foyer’s surfaces are never reachable from WAN while Foyer’s outbound WAN stays allowed.
