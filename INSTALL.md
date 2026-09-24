# Foyer — Ubuntu Server from a blank install

Install **`main`** from GitHub. This is the supported tree. 64-bit **Ubuntu Server 24.04** on the same PC as [Relay](https://github.com/richardosseweijer/Relay-AV-Room-Control-).

Foyer is a **room appliance**:

| Piece | What it does |
| --- | --- |
| Welcome | Chromium kiosk on a local video output under **sway**. Loopback only. Optional second head (Room panel → Relay) is F3 — see §7b. |
| Room plate | Tablet on **AV-LAN**. Foyer binds **8082** to the AV-LAN IPv4 you pick in Setup. |
| Calendar | Pulls Google ICS **only** through the **LAN (internet)** NIC you pick in Setup. |
| Relay | Occupancy from Relay on this PC via **AV-LAN HTTP** (`http://<av-lan-ipv4>:8081`). Not loopback; not the internet NIC. |

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
| `seatd` `sway` `wlr-randr` | Multi-output compositor + DRM picks; Welcome and/or Room-panel Chromium (F3) |
| `chromium` or `chromium-browser` | Welcome kiosk |
| `fonts-liberation` `fonts-noto-core` | Type if Google Fonts is unreachable |
| `mesa-vulkan-drivers` `libgl1-mesa-dri` | GPU for sway |

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

**Do not `rm -rf` an existing checkout.** That deletes `data/` (site config + secrets). If `~/Foyer-Room-Signage` already exists — especially if `data/` is present — stop and use **Update from GitHub** / §10 instead of recloning.

```bash
cd ~
if [ -d ~/Foyer-Room-Signage ]; then
  echo "Checkout already exists at ~/Foyer-Room-Signage."
  echo "If this room is live (see data/), use Update (§10) — do not delete the tree."
  echo "Fresh reinstall only after backup, e.g.:"
  echo "  tar -C ~ -czf foyer-data-backup.tgz Foyer-Room-Signage/data"
  echo "Then remove the tree deliberately and re-run this section."
  exit 1
fi
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
| Panel `/config` | `200` (Setup PIN gate; allowed on the plate) |

On this PC, Setup listens on **all interfaces**. From the config laptop open `http://FOYER-IP:8080/config` — PIN `1234`. (`ip -br addr` for the address on the outbound NIC.)

If that NIC is firewalled, SSH still works:

```bash
ssh -L 18080:127.0.0.1:8080 USER@FOYER-PC
```

Then [http://127.0.0.1:18080/config](http://127.0.0.1:18080/config).

In **This PC**:

1. **Welcome HDMI** — pick the HDMI/DP that faces the room (`0 — …`, `1 — …`). Optional **Room panel HDMI** for Relay control UI on another head (must differ; one display = one role).
2. **Outbound NIC** — pick the interface that can reach Google, not the AV LAN and not the rack AP.
3. **Timezone** — dropdown (e.g. America/Chicago).

Then **Update from GitHub** is on this same page after Save. Change the site PIN. Save. Stop both test processes with Ctrl+C in each terminal.

If a page never loads, check binds:

```bash
ss -lptn | grep -E '8080|8081|8082'
```

**First-run bind (dual-NIC):** until Setup picks **AV-LAN**, Welcome/Setup (`:8080`) and the room plate (`:8082`) listen on **`0.0.0.0`** (all interfaces). Do **§5 Firewall** before you leave the rack so the internet NIC is not exposing those ports. After you save the AV-LAN pick (§8), confirm the plate rebinds:

```bash
ss -lptn | grep -E '8080|8082'
# Expect :8082 on the AV-LAN IPv4 (not *:8082) once AV-LAN is set and the panel unit has restarted.
```

---

## 5. Firewall

Welcome/Setup is on **8080** (`0.0.0.0`, kiosk uses loopback). The room plate is **8082** on **AV-LAN** only once that NIC is picked — until then it also binds `0.0.0.0` (see §4 first-run callout). Do not open either port on the internet NIC. Finish this section before leaving a dual-NIC PC on the venue network.

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

Do **not** `ufw allow 8080/tcp` from anywhere. Do **not** port-forward 8080, 8081, or 8082. Foyer occupancy pulls Relay on this PC’s **AV-LAN `:8081`** ([`FOYER-RELAY.md`](FOYER-RELAY.md)); calendar session stays loopback to Foyer `:8080`. HMAC on Relay `:8081` from other AV-LAN peers stays required because the tablet is on the same LAN as the DSP.

A copy-paste sketch lives in `deploy/ufw.example.sh`.

---

## 6. Start on boot (systemd)

Linux starts background programs from **unit files**. Prefer the host installer (substitutes `User=` + checkout path from `deploy/`, `daemon-reload`, enables **foyer** + **foyer-panel**, and installs **foyer-kiosk**). Unlike Relay, the installer **defaults to enabling the kiosk** (Foyer owns the displays on a dual-head appliance — [`FOYER-RELAY.md`](FOYER-RELAY.md) day-one). **First boot following this guide:** use `--skip-kiosk-enable` here, finish §7 packages / groups / linger, then enable the kiosk (§7a). Day-one dual-head (packages already installed) may run `install-host.sh` without the skip.

Stop the test servers from §4 first (Ctrl+C) so ports 8080 and 8082 are free. Finish `npm ci` + `npm run build` (§4) before enabling units.

### 6a. Prefer the host installer (idempotent)

**One-time host step** — `git pull`, in-app **Update from GitHub**, and reboot do **not** install or refresh these units (or the sudoers drop-in). Re-run if `User=` or the checkout path changes. Re-running **replaces** `/etc/systemd/system/foyer.service`, `foyer-panel.service`, and `foyer-kiosk.service` from `deploy/` (re-apply any local unit customizations afterward).

```bash
# From the repo checkout — User= from FOYER_USER / SUDO_USER / invoking account.
# WorkingDirectory = this checkout (not a hardcoded ~/… assumption).
# Golden first-boot (this guide): install units+sudoers, leave foyer-kiosk disabled
# until §7 packages / seat / groups / linger are done — then enable in §7a.
sudo bash scripts/install-host.sh --skip-kiosk-enable
# Units only (same skip):  sudo bash scripts/install-host-units.sh --skip-kiosk-enable
# Or: sudo FOYER_USER=ubuntu bash scripts/install-host.sh --skip-kiosk-enable
#
# Day-one when §7 packages are already installed (FOYER-RELAY checklist order):
#   sudo bash scripts/install-host.sh          # enables foyer + foyer-panel + foyer-kiosk
```

Templates: [`deploy/foyer.service`](deploy/foyer.service), [`deploy/foyer-panel.service`](deploy/foyer-panel.service), [`deploy/foyer-kiosk.service`](deploy/foyer-kiosk.service). `install-host.sh` also runs [`scripts/install-host-sudoers.sh`](scripts/install-host-sudoers.sh) (§7). The installer still **defaults** to enabling the kiosk when you omit `--skip-kiosk-enable` — that is intentional for appliances that already have §7 ready; this guide’s first-boot path keeps the skip until then.

Check:

```bash
systemctl status foyer --no-pager
systemctl status foyer-panel --no-pager
systemctl status foyer-kiosk --no-pager   # installed; left disabled until §7a if you used --skip-kiosk-enable
cat /etc/systemd/system/foyer.service
# User= must be your login; WorkingDirectory= this checkout.
cd ~/Foyer-Room-Signage
bash scripts/foyer-status.sh
```

You want `Active: active (running)` on foyer and foyer-panel. With `--skip-kiosk-enable`, `foyer-kiosk` stays disabled until §7a — that is expected.

If foyer/panel failed:

```bash
sudo journalctl -u foyer -e --no-pager
sudo journalctl -u foyer-panel -e --no-pager
```

Typical causes: the test server from §4 is still running, `WorkingDirectory` is wrong, or Relay `npm run dev` still owns 8080.

Later:

```bash
sudo systemctl restart foyer foyer-panel foyer-kiosk
sudo systemctl stop foyer-kiosk foyer-panel foyer
# Prefer re-running the installer over hand-editing; or:
sudo nano /etc/systemd/system/foyer.service
sudo systemctl daemon-reload
sudo systemctl restart foyer
```

### 6b. Manual fallback (tee / editor)

Only if you cannot run the installer. Confirm account and home:

```bash
whoami
echo $HOME
```

#### Foyer (welcome)

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

#### Room panel

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

`User=` and `WorkingDirectory=` must match §3. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now foyer foyer-panel
sudo systemctl status foyer --no-pager
sudo systemctl status foyer-panel --no-pager
```

Install the kiosk unit with §7a (or prefer re-running `sudo bash scripts/install-host-units.sh` after packages).

---

## 7. Welcome on the local video output (kiosk)

Skip this until §4 and §6 answer `200` on welcome. Ubuntu Server has no desktop until you add a seat.

`seatd`, `sway`, and `wlr-randr` are in Ubuntu **universe** (noble). On a minimal Server image, if `apt-cache policy sway` shows no candidate, enable universe then update:

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y universe
sudo apt-get update
```

```bash
sudo apt-get install -y seatd sway wlr-randr fonts-liberation fonts-noto-core mesa-vulkan-drivers libgl1-mesa-dri
# Ubuntu 24.04 (noble): apt chromium / chromium-browser installs the Chromium *snap*
# (transitional package). Under sway on a dedicated room PC, expect sandbox/namespace
# errors — set FOYER_CHROMIUM_NO_SANDBOX=1 in data/foyer-kiosk.env (appliance only).
# Other distros (e.g. Debian) may ship a real Chromium .deb; use that when
# `which chromium` is a non-snap binary. Do not enable NO_SANDBOX on shared desktops.
sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
sudo systemctl enable --now seatd
sudo usermod -aG video,render,input,tty "$USER"
sudo loginctl enable-linger "$USER"
```

Log out and back in (or reboot) so the `video` / `render` groups apply. `echo $XDG_RUNTIME_DIR` should print `/run/user/$(id -u)`.

**Ubuntu 24.04 Chromium = snap.** After install, `which chromium` / `chromium-browser` usually resolves into `/snap/bin/…`. On this appliance set `FOYER_CHROMIUM_NO_SANDBOX=1` in `data/foyer-kiosk.env` when `journalctl -u foyer-kiosk` shows namespace / sandbox errors (typical under sway). Leave it unset until then. Optional non-Ubuntu path: a distro `.deb` Chromium when available — not the noble default.

`unclutter` is X11 and does nothing under Wayland. Skip it.

`cage` is **not** required for new installs (legacy single-app compositor). **sway** owns both Welcome and Room-panel heads under one DRM master (F3).

Disable blanking and sleep:

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

### 7a. Kiosk unit (sway — current)

Sway needs a real HDMI/DP connected **before** start. This unit **takes tty1** from the Ubuntu login prompt so Chromium covers that console. SSH is unchanged.

At start, `scripts/foyer-kiosk-sway.sh` writes a minimal sway config from `data/foyer-kiosk.env`: disable every output, enable Welcome and/or Room panel connectors, assign workspaces, then `exec` the matching Chromium script(s).

**Enable the kiosk after packages / groups / linger above.** §6a’s golden path left `foyer-kiosk` installed but disabled (`--skip-kiosk-enable`). The unit template is [`deploy/foyer-kiosk.service`](deploy/foyer-kiosk.service) (User= + checkout path already substituted when you ran the installer).

```bash
# Preferred after §7 packages — enable the unit §6a already installed:
sudo systemctl enable --now foyer-kiosk
# Or re-run the installer *without* --skip-kiosk-enable (enables foyer + foyer-panel + foyer-kiosk):
#   sudo bash scripts/install-host-units.sh
#   sudo bash scripts/install-host.sh
sudo systemctl status foyer-kiosk --no-pager
```

Manual fallback (same template — only if you cannot run the installer):

```bash
USER_NAME="$(whoami)"
HOME_DIR="$HOME"
chmod +x "${HOME_DIR}/Foyer-Room-Signage/scripts/foyer-kiosk.sh"
chmod +x "${HOME_DIR}/Foyer-Room-Signage/scripts/foyer-kiosk-room-panel.sh"
chmod +x "${HOME_DIR}/Foyer-Room-Signage/scripts/foyer-kiosk-sway.sh"
sudo tee /etc/systemd/system/foyer-kiosk.service >/dev/null <<EOF
[Unit]
Description=Foyer local-video kiosk (sway dual Chromium)
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
ExecStart=${HOME_DIR}/Foyer-Room-Signage/scripts/foyer-kiosk-sway.sh
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

Picking or clearing **Welcome HDMI** or **Room panel HDMI** in Setup saves it and restarts this unit so Chromium covers that DRM connector (same-output reject does not restart). Unpicked heads stay **off**.

Setup → **Enable local output** is a retry of that restart. The Foyer user needs passwordless `systemctl` for **foyer**, **foyer-panel**, and **foyer-kiosk** only.

**Required once on the appliance** (host `/etc`, not the git tree): Setup can save `data/foyer-kiosk.env` while **restart** still fails with polkit “interactive authentication” / Access denied if `/etc/sudoers.d/foyer-kiosk` is missing. `git pull`, in-app **Update from GitHub**, and reboot refresh code — they do **not** create or refresh this drop-in. Install once below; re-run if `User=` on `foyer.service` / `foyer-panel.service` / `foyer-kiosk.service` changes.

Prefer the host installer (§6a) which chains sudoers, or the sudoers script alone (substitutes `USER` in [`deploy/sudoers.foyer-kiosk`](deploy/sudoers.foyer-kiosk), mode 0440, `visudo -cf` pre/post):

```bash
# From the repo checkout — full units + sudoers (preferred first-boot):
sudo bash scripts/install-host.sh
# Sudoers only (if units already installed):
sudo bash scripts/install-host-sudoers.sh
# Or: sudo FOYER_USER=ubuntu bash scripts/install-host-sudoers.sh
# Smoke-check (must NOT ask for a password):
sudo -u "$(whoami)" sudo -n /usr/bin/systemctl is-active foyer-kiosk.service || true
```

Manual fallback (same template — do **not** paste a divergent inline allowlist):

```bash
USER_NAME="$(whoami)"   # must match systemd User=
sudo cp deploy/sudoers.foyer-kiosk /etc/sudoers.d/foyer-kiosk
sudo sed -i "s/^USER /${USER_NAME} /" /etc/sudoers.d/foyer-kiosk
sudo chown root:root /etc/sudoers.d/foyer-kiosk
sudo chmod 0440 /etc/sudoers.d/foyer-kiosk
sudo visudo -cf /etc/sudoers.d/foyer-kiosk
```

Single source of truth: [`deploy/sudoers.foyer-kiosk`](deploy/sudoers.foyer-kiosk). Setup → **Enable local output** classifies polkit / missing-sudoers failures and points here (same idea as Relay LINUX.md §7 / `scripts/install-host-sudoers.sh`).

The unit runs **sway** (wlroots multi-output), not cage. The generated config has no Mod-key exit binds (unlike a desktop sway session).

If the kiosk stays on the Ubuntu login TTY: the unit is the old one (no `Conflicts=getty@tty1`, or still `ExecStart=…cage…`). Re-run this section, then `sudo systemctl daemon-reload && sudo systemctl restart foyer-kiosk`. `sudo journalctl -u foyer-kiosk -e` is the next step. Confirm welcome from the config laptop at `http://FOYER-IP:8080/`.


### 7b. Dual-role local displays (F2 pickers + F3 dual Chromium)

**Current (§7 / §7a + F2 + F3):** one `foyer-kiosk.service` under **sway** on tty1. Setup has **two** independent **scan-based** DRM pickers — **Welcome HDMI** and **Room panel HDMI** — listing live connectors from `/sys/class/drm` (1–4 connected heads as they appear; not hard-coded HDMI-1/2). Saving writes `data/foyer-kiosk.env`:

- `FOYER_VIDEO_OUTPUT=…` — Welcome (empty when unset; F1 fallback to first connected only if Room panel is also unset)
- `FOYER_ROOM_PANEL_VIDEO_OUTPUT=…` — Room panel pick (empty when unset)
- `FOYER_ROOM_PANEL_URL=…` — site Relay URL as `http://<host>[:port]/` (empty when unset)

Same connector for both roles is **rejected** (Setup error; no save). One display: Welcome **or** Room panel, not both. Either role may stay **Not set**.

| Role | Chromium profile | URL |
| --- | --- | --- |
| **Welcome** | `data/chromium-welcome` | Foyer `http://127.0.0.1:8080/` |
| **Room panel** | `data/chromium-room-panel` | Relay control UI from `FOYER_ROOM_PANEL_URL` |

Modes:

1. **Welcome-only** — enable Welcome head; one Chromium (F1 behavior).
2. **Room-panel-only** — enable Room panel head; one Chromium loading Relay (single-head panel).
3. **Both** — enable both heads; two Chromiums under the same sway seat (separate `--class` / workspace assign).

Foyer does **not** start Relay’s **relay-kiosk**. Relay still owns devices and `:8081` ([`FOYER-RELAY.md`](FOYER-RELAY.md)). The door plate tablet on AV-LAN (`:8082`) is unchanged.

Typical hardware: **Dell Wyse 5070 / Ubuntu Server**, often one Intel GPU with two DisplayPort outputs. Concrete lab bring-up: **§7c**.

Rules:

1. Pickers stay **scan-based** — options bind to what is plugged in (`/sys/class/drm`).
2. **One display:** Welcome **or** Room panel for that single head.
3. **Multi-display:** roles on **different** scanned outputs. Same output for both → **reject**.
4. When Foyer drives the Room panel head on this host, Relay’s own **relay-kiosk** is **optional / off**.

### 7c. Ubuntu Server lab checklist (Wyse 5070 dual DP)

**Start here for same-host dual-head:** the ordered day-one checklist lives in [`FOYER-RELAY.md`](FOYER-RELAY.md) → **Day-one dual-head (same host)** (identical copy in the Relay repo). Use that first; this section keeps the lab detail.

Software-side bring-up for **Dell Wyse 5070 + Ubuntu Server** (typically one Intel GPU / one DRM card, two DisplayPorts). No physical smoke required for F4 review — run these checks when hardware is attached.

#### Packages

`seatd`, `sway`, and `wlr-randr` are in Ubuntu **universe** (noble). On a minimal Server image, if `apt-cache policy sway` shows no candidate:

```bash
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y universe
sudo apt-get update
```

```bash
sudo apt-get install -y seatd sway wlr-randr curl \
  mesa-vulkan-drivers libgl1-mesa-dri \
  fonts-liberation fonts-noto-core
# Ubuntu 24.04 (noble): apt chromium / chromium-browser installs the Chromium *snap*
# (transitional package). Under sway on this dedicated PC, expect sandbox/namespace
# errors — set FOYER_CHROMIUM_NO_SANDBOX=1 in data/foyer-kiosk.env (appliance only).
# Other distros may ship a real Chromium .deb when `which chromium` is non-snap.
sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser
which chromium chromium-browser
# Noble default is snap under /snap/bin/…. If journalctl -u foyer-kiosk shows
# namespace/sandbox errors, set FOYER_CHROMIUM_NO_SANDBOX=1 in data/foyer-kiosk.env
# (dedicated kiosk user only; see KNOWN_ISSUES).
```

Intel DRM should show card connectors under `/sys/class/drm` (e.g. `card0-DP-1`, `card0-DP-2`).

#### Seat / tty1 / linger / kiosk user

1. `sudo systemctl enable --now seatd`
2. `sudo usermod -aG video,render,input,tty "$USER"` then re-login
3. `sudo loginctl enable-linger "$USER"` so `/run/user/$(id -u)` exists without a GUI login
4. Confirm `echo $XDG_RUNTIME_DIR` → `/run/user/$(id -u)`
5. Install `foyer-kiosk.service` as the **same dedicated user** (§7a); unit uses `PAMName=login`, takes **tty1** (`Conflicts=getty@tty1`), `EnvironmentFile=…/data/foyer-kiosk.env`

#### DRM scan + Setup picks

```bash
ls /sys/class/drm/*/status 2>/dev/null | while read f; do
  echo "$(basename "$(dirname "$f")") $(cat "$f")"
done
```

In Setup → **This PC**:

- **Welcome HDMI** and **Room panel HDMI** must be **different** connectors (same-output → rejected, no kiosk restart).
- Changing **or clearing** either picker rewrites `data/foyer-kiosk.env` and restarts `foyer-kiosk` when the save succeeds.

#### Relay URL (Room panel)

- Site **Relay URL** must be an AV-LAN HTTP base (`http://host[:port]/`). Persist writes it as `FOYER_ROOM_PANEL_URL`.
- Room-panel Chromium soft-fails (exit 0) if the URL is empty or unsafe — sway stays up; that head stays blank until URL + restart.
- Confirm reachability: `curl -sf -o /dev/null -w "%{http_code}\n" "$FOYER_ROOM_PANEL_URL"` (or the Setup value).

#### When Foyer paints Room panel

Leave Relay’s own **`relay-kiosk` disabled/off** on this host (Foyer owns the head). **R1 is shipped** — see Relay [`LINUX.md`](https://github.com/richardosseweijer/Relay-AV-Room-Control-/blob/main/LINUX.md) §7a (`sudo systemctl disable --now relay-kiosk`). Foyer still must not start `relay-kiosk`.

#### Verify modes

| Mode | Setup | Expect |
| --- | --- | --- |
| Welcome-only | Welcome set, Room panel Not set | One head: Foyer `http://127.0.0.1:8080/` |
| Room-panel-only | Welcome Not set, Room panel set + Relay URL | One head: Relay control UI |
| Both | Different connectors + Relay URL | Two Chromiums under one sway seat |
| Same output | Both pickers same connector | Save rejected; kiosk not restarted |

#### Logs / generated config

```bash
sudo journalctl -u foyer-kiosk -e --no-pager
# Generated sway conf (unit sets XDG_RUNTIME_DIR=/run/user/%U):
ls -l "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/foyer-sway.conf"
cat "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/foyer-sway.conf"
# Env written by Setup persist:
cat ~/Foyer-Room-Signage/data/foyer-kiosk.env
```

Confirm sway config keeps **both** `app_id=` and `class=` assign/fullscreen rules for `foyer-welcome` / `foyer-room-panel` (Chromium `--class` maps to Wayland `app_id` or XWayland `class` depending on packaging).

#### Common failures

| Symptom | Likely cause |
| --- | --- |
| Setup error, no restart | Both roles same output (reject UX) |
| Room panel head blank | Empty / unsafe `FOYER_ROOM_PANEL_URL`; check env + `curl` |
| Both Chromiums on one head / wrong head | `--class` not applied or sway matchers missing `app_id`/`class` |
| Second DP stays blank | Role unset, connector unsafe, or cable/DRM `disconnected` |
| Chromium crash / namespace | Snap Chromium sandbox (noble default) — set `FOYER_CHROMIUM_NO_SANDBOX=1` in `data/foyer-kiosk.env` |
| Black seat, Foyer healthy on loopback | GPU/mesa, wrong tty, or outputs disabled in generated conf |
| Cleared Welcome but old wall still paints | Fixed in F4: clear/change Welcome also restarts the unit |

---

---

## 8. Door tablet (AV-LAN)

The plate shares the **AV-LAN** with Relay-controlled devices. It is not on guest wifi.

1. Give this PC a static IPv4 on AV-LAN.
2. In Setup pick that NIC under **AV-LAN** (indexed dropdown). Save. The panel unit rebinds `:8082` to that address.
3. Tablet opens `http://AV-LAN-IP:8082/play/door`.
4. Pick **LAN (internet)** for calendar. Relay occupancy URL is AV-LAN HTTP (`http://<av-lan-ipv4>:8081`), not `127.0.0.1:8081`.

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
| AV-LAN / loopback | Foyer ↔ Relay ([`FOYER-RELAY.md`](FOYER-RELAY.md)): occupancy on AV `:8081`, session on loopback `:8080` | — | **8081** / **8080** |

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

The updater then copies `dist/` from the staged build and `try-restart`s **foyer**, **foyer-panel** (room plate), and **foyer-kiosk**. That needs the units + `/etc/sudoers.d/foyer-kiosk` from §6a / §7 (`scripts/install-host.sh` / `scripts/install-host-sudoers.sh`). Update / pull / reboot do **not** install those host files.

---

## 11. Data

| File | Contents | In git? |
| --- | --- | --- |
| `data/foyer-site.json` | Room name, looks, NIC index, video output | no |
| `data/foyer-secrets.json` | PIN hashes, ICS URLs, display tokens | **never** |

Copy both off the disk before a re-image. A failed write keeps last-good (`.good` files).

---

## 12. Uninstall / teardown (host units + sudoers)

The installers are **safe to re-run** (they overwrite units/sudoers from `deploy/`). To remove the host pieces only:

```bash
sudo systemctl disable --now foyer-kiosk.service foyer-panel.service foyer.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/foyer.service \
  /etc/systemd/system/foyer-panel.service \
  /etc/systemd/system/foyer-kiosk.service
sudo systemctl daemon-reload
sudo rm -f /etc/sudoers.d/foyer-kiosk
```

`data/` in the checkout holds site config + secrets (`foyer-site.json`, `foyer-secrets.json`, kiosk env, Chromium profiles). **Back it up before deleting the checkout.** Removing units does not delete `data/`. To wipe site state as well (optional, operator choice):

```bash
# Destructive — only if you intend to erase this room's config:
# rm -rf ~/Foyer-Room-Signage/data
```

Update stays **§10**. This section is teardown only.

---

## Checks before you leave the room

1. Welcome and/or Room panel show on the local outputs you chose (§7 / §7b / §7c).
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
- Local-video kiosk is **sway** (§7a) with F2 dual Setup pickers and **F3** dual Chromium (§7b).
- Relay production occupancy is **AV-LAN HTTP** `http://<av-lan-ipv4>:8081` (not the internet NIC). Loopback `http://127.0.0.1:8081` is a **lab escape** only when Relay is forced to listen there. Foyer welcome/Setup is **8080** (`0.0.0.0`); calendar session pull stays loopback to Foyer `:8080`. Room plate is **8082** on AV-LAN. Wire: [`FOYER-RELAY.md`](FOYER-RELAY.md).
- Setup occupancy: Auto, Available, In session, Do not disturb, Closed. Manual values beat calendar and Relay.
- Supported run: `npm start` + `npm run start:panel` after `npm run build`.
- Tests: `npm test` (Foyer cases live under `src/lib/foyer/*.test.ts`).
- Setup: `http://AV-LAN-IP:8080/config` from the config laptop. Firewall 8080/8082 on AV-LAN only.
