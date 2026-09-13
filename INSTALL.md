# Foyer — Ubuntu Server from a blank install

Install **`main`** from GitHub. This is the supported tree. 64-bit **Ubuntu Server 24.04** on the same PC as [Relay](https://github.com/richardosseweijer/Relay-AV-Room-Control-).

Foyer is a **room appliance**:

| Piece | What it does |
| --- | --- |
| Welcome | Chromium kiosk on **one local video output** (HDMI B). Loopback only. |
| Room plate | Tablet on **AV-LAN**. Foyer binds **8082** to the AV-LAN IPv4 you pick in Setup. |
| Calendar | Pulls Google ICS **only** through the **LAN (internet)** NIC you pick in Setup. |
| Relay | Occupancy from Relay on this PC (`127.0.0.1:8081`). Not either NIC. |

Wayfinding is **not** installed by this guide.

Default site PIN after first start: `1234`. Open Setup once and set a stronger PIN. Open glass starts **off**.

OS packages this guide installs (npm packages come from `npm ci --include=dev` in §3):

| Package | Why |
| --- | --- |
| `git` `ca-certificates` `curl` `gnupg` | Clone and Update from GitHub |
| `build-essential` | Native Node modules during `npm ci` |
| `nodejs` 22 | Runtime (`--experimental-strip-types` for the panel) |
| `iproute2` | `ip` / `ss` |
| `ufw` | Incoming deny; 8080/8082 on AV-LAN only |
| `seatd` `cage` `wlr-randr` | Welcome compositor + HDMI pick |
| `chromium` or `chromium-browser` | Welcome kiosk |
| `fonts-liberation` `fonts-noto-core` | Type if Google Fonts is unreachable |
| `mesa-vulkan-drivers` `libgl1-mesa-dri` | GPU for cage |

`undici` is an npm dependency (calendar fetch bound to the LAN NIC). Vite stays in **devDependencies**; that is why `--include=dev` is required even in production.

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
sudo apt-get install -y git build-essential iproute2
```

`build-essential` is needed if `npm ci` compiles a native module. `iproute2` gives `ip` and `ss`.

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
| Production | `npm run build` then `npm start` | welcome `0.0.0.0:8080` | 24/7 |
| Panel | `npm run start:panel` | AV-LAN `:8082` (all interfaces until picked) | Door tablet |

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

On this PC, Setup listens on **all interfaces**. From the config laptop open `http://FOYER-IP:8080/config` — PIN `1234`. (`ip -br addr` for the address on the outbound NIC.)

If that NIC is firewalled, SSH still works:

```bash
ssh -L 18080:127.0.0.1:8080 USER@FOYER-PC
```

Then [http://127.0.0.1:18080/config](http://127.0.0.1:18080/config).

In **This PC**:

1. **Welcome video output** — pick the HDMI that faces the room (`0 — …`, `1 — …`).
2. **Outbound NIC** — pick the interface that can reach Google, not the AV LAN and not the rack AP.
3. **Timezone** — dropdown (e.g. America/Chicago).

Then **Update from GitHub** is on this same page after Save. Change the site PIN. Save. Stop both test processes with Ctrl+C in each terminal.

If a page never loads, check binds:

```bash
ss -lptn | grep -E '8080|8081|8082'
```

---

## 5. Firewall

Welcome/Setup is on **8080** (`0.0.0.0`, kiosk uses loopback). The room plate is **8082** on **AV-LAN** only. Do not open either port on the internet NIC.

```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
# AV-LAN (config laptop + door tablet):
sudo ufw allow in on <AV-IFACE> to any port 8080 proto tcp
sudo ufw allow in on <AV-IFACE> to any port 8082 proto tcp
sudo ufw enable
sudo ufw status
```

Replace `<AV-IFACE>` (`ip -br addr`). Nothing inbound on the internet NIC.

Do **not** `ufw allow 8080/tcp` from anywhere. Do **not** port-forward 8080 or 8082. Foyer ↔ Relay stays on loopback; HMAC on Relay `:8081` stays required because the tablet is on the same AV-LAN as the DSP.

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
sudo apt-get install -y seatd cage wlr-randr fonts-liberation fonts-noto-core mesa-vulkan-drivers libgl1-mesa-dri
sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
sudo systemctl enable --now seatd
sudo usermod -aG video,render,input,tty "$USER"
sudo loginctl enable-linger "$USER"
```

Log out and back in (or reboot) so the `video` / `render` groups apply. `echo $XDG_RUNTIME_DIR` should print `/run/user/$(id -u)`.

If `chromium` is missing, try `chromium-browser`. `which chromium chromium-browser` — use that path in the unit below. Snap Chromium under cage often needs `--no-sandbox` on this dedicated PC; add it only if `journalctl -u foyer-kiosk` shows namespace errors.

`unclutter` is X11 and does nothing under cage. Skip it.

Disable blanking and sleep:

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

### 7a. Kiosk unit

Cage needs a real HDMI connected **before** start. This unit **takes tty1** from the Ubuntu login prompt so Chromium covers that console. SSH is unchanged.

```bash
USER_NAME="$(whoami)"
HOME_DIR="$HOME"
chmod +x "${HOME_DIR}/Foyer-Room-Signage/scripts/foyer-kiosk.sh"
sudo tee /etc/systemd/system/foyer-kiosk.service >/dev/null <<EOF
[Unit]
Description=Foyer welcome kiosk (local video)
After=foyer.service systemd-user-sessions.service plymouth-quit-wait.service
Requires=foyer.service
Conflicts=getty@tty1.service
StartLimitBurst=5
StartLimitIntervalSec=60

[Service]
Type=simple
User=${USER_NAME}
SupplementaryGroups=video render input tty
PAMName=login
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
StandardInput=tty
StandardOutput=journal
StandardError=journal
UtmpIdentifier=tty1
UnsetEnvironment=TERM
Environment=XDG_SESSION_TYPE=wayland
Environment=XDG_RUNTIME_DIR=/run/user/%U
Environment=WLR_LIBINPUT_NO_DEVICES=1
EnvironmentFile=-${HOME_DIR}/Foyer-Room-Signage/data/foyer-kiosk.env
ExecStartPre=+/bin/chvt 1
ExecStart=/usr/bin/cage -d -- ${HOME_DIR}/Foyer-Room-Signage/scripts/foyer-kiosk.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now foyer-kiosk
sudo systemctl status foyer-kiosk --no-pager
```

This unit **stops the tty1 login prompt** and paints Chromium over that console. SSH is unchanged.

Picking a **Welcome video output** in Setup saves it and restarts this unit so Chromium covers the HDMI.

Setup → **Enable local output** is a retry of that restart. The Foyer user needs passwordless systemctl:

```bash
USER_NAME="$(whoami)"
sudo tee /etc/sudoers.d/foyer-kiosk >/dev/null <<EOF
${USER_NAME} ALL=(root) NOPASSWD: /usr/bin/systemctl start foyer.service, /usr/bin/systemctl restart foyer.service, /usr/bin/systemctl try-restart foyer.service, /usr/bin/systemctl stop foyer.service, /usr/bin/systemctl start foyer-panel.service, /usr/bin/systemctl restart foyer-panel.service, /usr/bin/systemctl try-restart foyer-panel.service, /usr/bin/systemctl stop foyer-panel.service, /usr/bin/systemctl start foyer-kiosk.service, /usr/bin/systemctl restart foyer-kiosk.service, /usr/bin/systemctl try-restart foyer-kiosk.service, /usr/bin/systemctl stop foyer-kiosk.service
EOF
sudo chmod 440 /etc/sudoers.d/foyer-kiosk
sudo visudo -c
```

cage `-d` skips client decorations. It does **not** use `-s` (that flag allows switching back to the text console).

If the kiosk stays on the Ubuntu login TTY: the unit is the old one (no `Conflicts=getty@tty1`). Re-run this section, then `sudo systemctl daemon-reload && sudo systemctl restart foyer-kiosk`. `sudo journalctl -u foyer-kiosk -e` is the next step. Confirm welcome from the config laptop at `http://FOYER-IP:8080/`.

---

## 8. Door tablet (AV-LAN)

The plate shares the **AV-LAN** with Relay-controlled devices. It is not on guest wifi.

1. Give this PC a static IPv4 on AV-LAN.
2. In Setup pick that NIC under **AV-LAN** (indexed dropdown). Save. The panel unit rebinds `:8082` to that address.
3. Tablet opens `http://AV-LAN-IP:8082/play/door`.
4. Pick **LAN (internet)** for calendar. Relay occupancy URL stays `http://127.0.0.1:8081`.

Confirm from a laptop on AV-LAN:

```bash
curl -sI http://AV-LAN-IP:8082/config          # 200 (Setup, site PIN)
curl -sI http://AV-LAN-IP:8082/play/welcome    # 404
curl -sI http://AV-LAN-IP:8082/play/dc         # 404
curl -s  -o /dev/null -w "%{http_code}\n" http://AV-LAN-IP:8082/play/door
```

---

## 9. Two NICs (do this before a paying venue)

| Interface | Role | Default route? | Foyer socket |
| --- | --- | --- | --- |
| AV-LAN | DSP, door tablet, config laptop | no | **8082** (and Setup **8080** via firewall) |
| LAN (internet) | Calendar, apt, GitHub, Relay telemetry | yes | none inbound |
| loopback | Foyer ↔ Relay HMAC | — | **8081** / **8080** |

Setup → **LAN (internet)** must be the guest/WAN NIC. If that NIC is selected but has no IPv4, Foyer keeps the last calendar snapshot (fail closed). Setup → **AV-LAN** is the door bind. Foyer does not read Relay’s NIC picks — set the same interfaces in both apps.

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

The updater then copies `dist/` from the staged build and `try-restart`s **foyer**, **foyer-panel** (room plate), and **foyer-kiosk**. That needs the sudoers snippet in §7.

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
2. Room plate on AV-LAN shows the same room.
3. Unplug Relay: meetings still show.
4. Unplug LAN (internet) NIC: last calendar remains; welcome still paints.
5. Unplug AV-LAN: welcome still paints; the tablet goes dark.
6. Site PIN is no longer `1234`.
7. Open glass is **off** unless you trust every device on AV-LAN.

Outfit (the typeface) loads from Google Fonts over the outbound NIC. If that NIC is down, Liberation / Noto still paint.

---

## Notes

- Keep Foyer on this PC. Do not port-forward 8080 or 8082.
- Relay production is **8081** on loopback for Foyer. Foyer welcome/Setup is **8080** (`0.0.0.0`). Room plate is **8082** on AV-LAN.
- Setup occupancy: Auto, Available, In session, Do not disturb, Closed. Manual values beat calendar and Relay.
- Supported run: `npm start` + `npm run start:panel` after `npm run build`.
- Tests: `npm test` (Foyer cases live under `src/lib/foyer/*.test.ts`).
- Setup: `http://AV-LAN-IP:8080/config` from the config laptop. Firewall 8080/8082 on AV-LAN only.
