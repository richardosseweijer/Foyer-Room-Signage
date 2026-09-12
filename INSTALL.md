# Foyer — Ubuntu Server from a blank install

Install **`main`** from GitHub. This is the supported tree. 64-bit **Ubuntu Server 24.04** on the same PC as [Relay](https://github.com/richardosseweijer/Relay-AV-Room-Control-).

Foyer is a **room appliance**:

| Piece | What it does |
| --- | --- |
| Welcome | Chromium kiosk on **one local video output** (HDMI B). Loopback only. |
| Room plate | Tablet on the **rack AP**. Foyer listens on port **8082**. No internet on that SSID. |
| Calendar | Pulls Google ICS **only** through the outbound NIC you pick in Setup. |
| Relay | Occupancy from Relay on this PC (`127.0.0.1`, Relay’s production port **8081**). |

Wayfinding is **not** installed by this guide.

Default site PIN after first start: `1234`. Open Setup once and set a stronger PIN.

Commands below are run in a terminal as a normal user that can use `sudo`.

---

## 0. Confirm the machine is online

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
ping -c 1 github.com
```

If `ping` fails, fix Ethernet on the **outbound** NIC before continuing.

Print interfaces (you will pick these again in Setup as **indexed** dropdowns):

```bash
ip -br addr
ls /sys/class/drm/*/status 2>/dev/null | while read f; do echo "$(basename "$(dirname "$f")") $(cat "$f")"; done
```

---

## 1. Base tools

```bash
sudo apt-get install -y git build-essential
```

`build-essential` is only needed if `npm install` compiles a native module. It is cheap to include.

---

## 2. Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

`node -v` must print `v22` or newer.

---

## 3. Clone Foyer (`main`)

Do **not** use a zip. systemd and this guide track **`origin/main`**.

```bash
cd ~
rm -rf ~/Foyer-Room-Signage
git clone --branch main --single-branch https://github.com/richardosseweijer/Foyer-Room-Signage.git
cd ~/Foyer-Room-Signage
git fetch origin
git checkout -B main origin/main
git log -1 --oneline
test -f src/lib/foyer/listen.ts && echo "tree: current" || echo "tree: TOO OLD — fetch failed"
npm ci --include=dev
```

`--include=dev` is required: systemd sets `NODE_ENV=production`, and Vite lives in devDependencies.

The clone has no site file and no secrets file. Those appear under `data/` after the first start. Do not copy `data/foyer-secrets.json` from another machine unless you intend to move that room.

---

## 4. Start once and confirm (no kiosk yet)

| Script | Command | Bind | Use |
| --- | --- | --- | --- |
| Dev | `npm run dev` | welcome `:8080` | First check |
| Production | `npm run build` then `npm start` | welcome `127.0.0.1:8080` | 24/7 |
| Panel | `npm run start:panel` | `0.0.0.0:8082` | Door tablet |

Relay (if installed) stays on **8081**. Do not run Relay `npm run dev` (8080) at the same time as Foyer.

```bash
cd ~/Foyer-Room-Signage
npm run build
npm start
```

Leave that terminal open. In a **second** terminal:

```bash
cd ~/Foyer-Room-Signage
npm run start:panel
```

Checks:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/config
curl -sI http://127.0.0.1:8082/ | head -5
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8082/play/door
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8082/config
```

You want:

| URL | Code |
| --- | --- |
| Welcome `/` | `200` |
| Setup `/config` | `200` |
| Panel `/` | `302` to `/play/door` |
| Panel `/play/door` | `200` |
| Panel `/config` | `404` (Setup is not on the room plate) |

On this PC, open Setup: [http://127.0.0.1:8080/config](http://127.0.0.1:8080/config) — PIN `1234`.

In **This PC**:

1. **Welcome video output** — pick the HDMI that faces the room (`0 — …`, `1 — …`).
2. **Outbound NIC** — pick the interface that can reach Google, not the AV LAN and not the rack AP.

Change the site PIN. Save. Stop both test processes with Ctrl+C in each terminal.

If a page never loads, check binds:

```bash
ss -lptn | grep -E '8080|8081|8082'
```

---

## 5. Firewall

Welcome must stay on **loopback**. The room plate is only for the rack AP subnet. Calendar is outbound.

```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
# Rack AP clients only (change to your AP subnet):
sudo ufw allow in on <AP-IFACE> to any port 8082 proto tcp
# Do not allow 8080 from any NIC. Welcome is 127.0.0.1.
sudo ufw enable
sudo ufw status
```

Replace `<AP-IFACE>` with the NIC or bridge that faces the rack AP (`ip -br addr`).

Do **not** `ufw allow 8080/tcp` from anywhere. Do **not** port-forward 8080 or 8082. Do **not** let AP clients reach Relay (`8081`) or the outbound NIC.

A copy-paste sketch lives in `deploy/ufw.example.sh`.

---

## 6. Start on boot (systemd)

Stop the test servers from §4 first (Ctrl+C) so ports 8080 and 8082 are free.

### 6a. Foyer (welcome)

```bash
USER_NAME="$(whoami)"
HOME_DIR="$HOME"
sudo tee /etc/systemd/system/foyer.service >/dev/null <<EOF
[Unit]
Description=Foyer welcome (local video)
After=network-online.target
Wants=network-online.target
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${HOME_DIR}/Foyer-Room-Signage
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF
```

### 6b. Room panel

```bash
sudo tee /etc/systemd/system/foyer-panel.service >/dev/null <<EOF
[Unit]
Description=Foyer room panel
After=foyer.service
Requires=foyer.service
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
User=${USER_NAME}
WorkingDirectory=${HOME_DIR}/Foyer-Room-Signage
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/npm run start:panel
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
```

`User=` and `WorkingDirectory=` must match §3.

### 6c. Enable

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now foyer foyer-panel
sudo systemctl status foyer --no-pager
sudo systemctl status foyer-panel --no-pager
```

You want `Active: active (running)` on both.

```bash
cd ~/Foyer-Room-Signage
bash scripts/foyer-status.sh
```

If it failed:

```bash
sudo journalctl -u foyer -e --no-pager
sudo journalctl -u foyer-panel -e --no-pager
```

Typical causes: the test server from §4 is still running, `WorkingDirectory` is wrong, or Relay `npm run dev` still owns 8080.

---

## 7. Welcome on the local video output (kiosk)

Skip this until §4 and §6 answer `200` on welcome. Ubuntu Server has no desktop until you add a seat.

```bash
sudo apt-get install -y cage chromium unclutter
```

If `chromium` is missing, try `chromium-browser`.

Disable blanking and sleep:

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

### 7a. Kiosk unit

Cage needs a real HDMI connected **before** start. Plug the welcome display into the connector you chose in Setup.

```bash
USER_NAME="$(whoami)"
HOME_DIR="$HOME"
sudo tee /etc/systemd/system/foyer-kiosk.service >/dev/null <<EOF
[Unit]
Description=Foyer welcome kiosk (local video)
After=foyer.service
Requires=foyer.service
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
User=${USER_NAME}
Environment=XDG_RUNTIME_DIR=/run/user/%U
Environment=WLR_LIBINPUT_NO_DEVICES=1
ExecStartPre=/bin/sleep 2
ExecStart=/usr/bin/cage -s -- /usr/bin/chromium --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 http://127.0.0.1:8080/
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now foyer-kiosk
sudo systemctl status foyer-kiosk --no-pager
```

If Chromium is `/usr/bin/chromium-browser`, change `ExecStart` to that path (`which chromium chromium-browser`).

If the kiosk stays black: the HDMI is on the other connector, GPU drivers are missing, or cage cannot open the seat. `sudo journalctl -u foyer-kiosk -e` is the next step. You can still confirm welcome in a browser at `http://127.0.0.1:8080/` over SSH port-forward as a last resort.

Cursor: cage `-s` is already “no server decorations”. Add `unclutter` only if a pointer still shows.

---

## 8. Rack AP (room plate)

Use a **dedicated AP in the driverack**, not guest Wi-Fi.

1. SSID e.g. `foyer-<room>`, WPA2, **no WAN / no internet**.
2. DHCP from the AP. Give this PC a static address on that subnet, e.g. `10.64.0.1`.
3. Tablet joins the SSID, opens `http://10.64.0.1:8082/play/door`.
4. If open glass is off, the plate shows a code. Enter it in Setup → Bind room panel.

The panel listener **404s** Setup and welcome. That is correct.

Confirm from a laptop on the AP:

```bash
curl -sI http://10.64.0.1:8082/config          # 404
curl -sI http://10.64.0.1:8082/play/welcome    # 404
curl -s  -o /dev/null -w "%{http_code}\n" http://10.64.0.1:8082/play/door
# Google from the tablet must fail. Relay :8081 from the tablet must fail.
```

---

## 9. Three networks (do this before a paying venue)

| Interface | Role | Default route? | Foyer socket |
| --- | --- | --- | --- |
| `av` | Relay / DSP | no | no |
| `out` | Calendar, apt, GitHub | yes | no |
| AP | Room plate | no | **8082 only** |

Setup → **Outbound NIC** must be `out`. If that NIC is selected but has no IPv4, Foyer keeps the last calendar snapshot (fail closed).

A netplan sketch is in `deploy/netplan.example.yaml`. Do not copy it blindly — names (`enp1s0`) differ per PC.

---

## 10. Update from GitHub

Setup → **Update from GitHub** (after Save). Same as Relay: fetch `origin/main`, build in a side tree, switch if the build works. Site files in `data/` stay. Log: `data/foyer-update.log`. A zip cannot use the button.

Manual equivalent if the button failed:

```bash
cd ~/Foyer-Room-Signage
sudo systemctl stop foyer-kiosk foyer-panel foyer
git fetch origin
git checkout -B main origin/main
git log -1 --oneline
npm ci --include=dev
npm run build
sudo systemctl start foyer foyer-panel foyer-kiosk
bash scripts/foyer-status.sh
```

Uncommitted source edits block the button. `data/foyer-*.json` is not in git and is left alone.

---

## 11. Data

| File | Contents | In git? |
| --- | --- | --- |
| `data/foyer-site.json` | Room name, looks, NIC index, video output | no |
| `data/foyer-secrets.json` | PIN hashes, ICS URLs, display tokens | **never** |

Copy both off the disk before a re-image. A failed write keeps last-good (`.good` files).

---

## Checks before you leave the room

1. Welcome shows the session on the HDMI you chose.
2. Room plate on the AP shows the same room; Setup is unreachable from the tablet.
3. Unplug Relay: meetings still show.
4. Unplug outbound NIC: last calendar remains; welcome still paints.
5. Unplug the AP: welcome still paints.
6. Site PIN is no longer `1234`.
7. Open glass is **off** on a real install.

---

## Notes

- Keep Foyer on this PC. Do not port-forward 8080 or 8082.
- Relay production is **8081**. Foyer welcome is **8080** loopback. Room plate is **8082**.
- Supported run: `npm start` + `npm run start:panel` after `npm run build`.
- Tests: `npm test` (Foyer cases live under `src/lib/foyer/*.test.ts`).
