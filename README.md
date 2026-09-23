# Foyer

Foyer **0.2.2** (beta). Room signage that lives **on the Relay PC**.

- **Welcome** — this PC’s local video output (HDMI/DP kiosk; **F1:** one head under sway)
- **Room plate** — tablet on **AV-LAN** (`:8082` bound to that NIC)
- **Planned** — dual-role Path B remainder (Welcome + optional local Room panel head under the same compositor); see [INSTALL.md §7b](INSTALL.md) and [ARCHITECTURE.md §4a](ARCHITECTURE.md) — **not shipped yet**
- **Not this app** — lobby wayfinding (separate product)

Relay owns devices. Foyer owns pictures. They are separate processes on the same Ubuntu box. Each has its own NIC pickers; they do not share config. How they talk: **[FOYER-RELAY.md](FOYER-RELAY.md)**.

Clone is unused until you start it. First boot writes `data/foyer-site.json` and `data/foyer-secrets.json` on the host. Those files are not in git.

```
git clone https://github.com/richardosseweijer/Foyer-Room-Signage.git
cd Foyer-Room-Signage
npm ci --include=dev
```

| Script | Command | Bind | Use |
| --- | --- | --- | --- |
| Dev / kiosk | `npm run dev` | welcome `0.0.0.0:8080` | Local edit |
| Room panel | `npm run start:panel` | AV-LAN `:8082` (all interfaces until picked) | Door tablet |
| Production | `npm run build` then `npm start` | welcome `0.0.0.0:8080` | 24/7 next to Relay (`:8081`) |

| Surface | Where |
| --- | --- |
| Welcome (HDMI) | `http://127.0.0.1:8080/` (kiosk) or `http://AV-LAN-IP:8080/` |
| Setup | `http://AV-LAN-IP:8080/config` |
| Room plate | `http://AV-LAN-IP:8082/play/door` |

Do not start with raw `npx vite`. Scripts run `scripts/with-app-env.mjs`.

First site PIN is `1234`. You must set a stronger one. Welcome on the local output does not pair. The room plate pairs with a code (or **Open glass** on a trusted rack AP). Calendar ICS URLs never leave the server. Setup occupancy can force **Do not disturb** (Relay var `dnd` does the same). Setup → **Update from GitHub** fetches `main`. See [Security](SECURITY.md).

Foolproof Ubuntu install: **[INSTALL.md](INSTALL.md)**

- [Foyer ↔ Relay contract](FOYER-RELAY.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Privacy](PRIVACY.md)
- [Known issues](KNOWN_ISSUES.md)
- [Changelog](CHANGELOG.md)
- [Legal notice](NOTICE)

Relay: [Relay-AV-Room-Control-](https://github.com/richardosseweijer/Relay-AV-Room-Control-)

## Disclaimer

This repository is **AI-generated software**. It has **not been audited, reviewed, or certified by a human**.

The software is provided **as is**, with **no warranties** of any kind, express or implied, including fitness for a particular purpose, reliability, or safety.

**You use it entirely at your own risk.** The author and contributors accept **no liability** for any loss, damage, injury, downtime, data loss, device damage, or other claim that arises from installing, configuring, or running this software.

See `LICENSE`.
