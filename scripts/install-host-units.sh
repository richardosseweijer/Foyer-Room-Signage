#!/usr/bin/env bash
# Install Foyer systemd units from deploy/ templates.
#
# Idempotent: re-running overwrites /etc/systemd/system/foyer.service,
# foyer-panel.service, and foyer-kiosk.service with freshly substituted
# templates, then daemon-reload. Packaged/custom local unit edits under those
# paths are replaced — re-apply local customizations afterward if you had any.
#
# Default (normal Foyer appliance / dual-head): enable --now foyer.service,
# foyer-panel.service, and foyer-kiosk.service. Unlike Relay, kiosk ON is
# correct here — Foyer owns the displays (INSTALL.md §6 / §7a; FOYER-RELAY
# day-one). Pass --skip-kiosk-enable to install foyer-kiosk.service but leave
# enablement alone (e.g. packages not ready yet).
#
# Usage (from repo root or any cwd):
#   sudo bash scripts/install-host-units.sh
#   sudo FOYER_USER=ubuntu bash scripts/install-host-units.sh
#   sudo bash scripts/install-host-units.sh --skip-kiosk-enable
#   sudo bash scripts/install-host-units.sh --with-sudoers
#   sudo bash scripts/install-host-units.sh --skip-preflight   # unusual layouts only
#   sudo bash scripts/install-host.sh          # thin wrapper: units + sudoers
#
# Preflight (before any write): Node/npm on unit PATH (/usr/bin:/usr/local/bin,
# same as deploy/foyer.service + foyer-panel.service) major >= 22, and
# .vercel/output/nitro.json from `npm run build`. See INSTALL.md §6a.
#
# Username (service account = systemd User=):
#   1. FOYER_USER or UNIT_USER if set
#   2. else SUDO_USER when invoked via sudo (the invoking human account)
#   3. else current login name (id -un)
#
# WorkingDirectory / kiosk paths use this checkout (script location), not a
# hardcoded ~/Foyer-Room-Signage assumption when the tree lives elsewhere.
#
# Update / pull / reboot do NOT install these units. Run once on the appliance;
# re-run if User= or checkout path changes.
#
# Requires root.

set -euo pipefail

die() {
  echo "install-host-units: $*" >&2
  exit 1
}

ENABLE_KIOSK=1
WITH_SUDOERS=0
SKIP_PREFLIGHT=0
for arg in "$@"; do
  case "${arg}" in
    --skip-kiosk-enable) ENABLE_KIOSK=0 ;;
    --with-sudoers) WITH_SUDOERS=1 ;;
    --skip-preflight) SKIP_PREFLIGHT=1 ;;
    -h|--help)
      sed -n '2,45p' "$0"
      exit 0
      ;;
    *)
      die "unknown argument: ${arg} (supported: --skip-kiosk-enable, --with-sudoers, --skip-preflight)"
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_DIR="${REPO_ROOT}/deploy"
SYSTEMD_DIR="/etc/systemd/system"

TEMPLATE_FOYER="${DEPLOY_DIR}/foyer.service"
TEMPLATE_PANEL="${DEPLOY_DIR}/foyer-panel.service"
TEMPLATE_KIOSK="${DEPLOY_DIR}/foyer-kiosk.service"

# Preflight before root check / any write so a failure leaves the host untouched.
# shellcheck source=scripts/install-host-preflight.sh
source "${SCRIPT_DIR}/install-host-preflight.sh"
if [ "${SKIP_PREFLIGHT}" -eq 1 ]; then
  echo "install-host-units: --skip-preflight set (skipping Node/build checks)"
else
  foyer_preflight_all "${REPO_ROOT}" || exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  die "must run as root (try: sudo bash scripts/install-host-units.sh)"
fi

[ -f "${TEMPLATE_FOYER}" ] || die "missing template: ${TEMPLATE_FOYER}"
[ -f "${TEMPLATE_PANEL}" ] || die "missing template: ${TEMPLATE_PANEL}"
[ -f "${TEMPLATE_KIOSK}" ] || die "missing template: ${TEMPLATE_KIOSK}"
command -v systemctl >/dev/null 2>&1 || die "systemctl not found"

# Resolve service username (same order as install-host-sudoers.sh)
if [ -n "${FOYER_USER:-}" ]; then
  FOYER_SVC_USER="${FOYER_USER}"
elif [ -n "${UNIT_USER:-}" ]; then
  FOYER_SVC_USER="${UNIT_USER}"
elif [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
  FOYER_SVC_USER="${SUDO_USER}"
else
  FOYER_SVC_USER="$(id -un)"
fi

case "${FOYER_SVC_USER}" in
  ''|[!A-Za-z_]*|*[!A-Za-z0-9_-]*)
    die "invalid service username: '${FOYER_SVC_USER}' (set FOYER_USER=…)"
    ;;
esac

if ! id -u "${FOYER_SVC_USER}" >/dev/null 2>&1; then
  die "user '${FOYER_SVC_USER}' does not exist on this host (set FOYER_USER=…)"
fi

# Home for documentation / linger notes (unit paths use REPO_ROOT)
FOYER_HOME="$(getent passwd "${FOYER_SVC_USER}" | cut -d: -f6)"
[ -n "${FOYER_HOME}" ] || die "could not resolve home for ${FOYER_SVC_USER}"

echo "install-host-units: service user = ${FOYER_SVC_USER}"
echo "install-host-units: repo root    = ${REPO_ROOT}"
echo "install-host-units: templates from ${DEPLOY_DIR}"
if [ "${ENABLE_KIOSK}" -eq 1 ]; then
  echo "install-host-units: will enable --now foyer + foyer-panel + foyer-kiosk (default appliance)"
else
  echo "install-host-units: --skip-kiosk-enable set (will enable foyer + foyer-panel only; kiosk installed)"
fi

# Escape sed replacement for paths that may contain & \ /
escape_sed_repl() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

REPO_ESC="$(escape_sed_repl "${REPO_ROOT}")"
USER_ESC="$(escape_sed_repl "${FOYER_SVC_USER}")"

render_unit() {
  local template="$1"
  local dest_name="$2"
  local tmp out
  tmp="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${tmp}'" RETURN

  # 1) Replace placeholder checkout paths (USER or legacy pi) with this REPO_ROOT
  # 2) Replace User=USER / User=pi with the resolved service account
  sed \
    -e "s|/home/USER/Foyer-Room-Signage|${REPO_ESC}|g" \
    -e "s|/home/pi/Foyer-Room-Signage|${REPO_ESC}|g" \
    -e "s|^User=USER$|User=${USER_ESC}|" \
    -e "s|^User=pi$|User=${USER_ESC}|" \
    "${template}" > "${tmp}"

  # Literal template token USER must not remain. `pi` is a valid appliance
  # account; User=pi after sub is success when FOYER_SVC_USER=pi (Relay #154 parity).
  if grep -qE '^User=USER$' "${tmp}"; then
    die "${dest_name}: User= placeholder not substituted"
  fi
  if [ "${FOYER_SVC_USER}" != "pi" ] && grep -qE '^User=pi$' "${tmp}"; then
    die "${dest_name}: User=pi placeholder not substituted"
  fi
  if ! grep -qE "^User=${FOYER_SVC_USER}$" "${tmp}"; then
    die "${dest_name}: rendered unit missing User=${FOYER_SVC_USER} (check template placeholders)"
  fi
  # Fail only on literal /home/USER/... template token.
  if grep -qE '/home/USER/Foyer-Room-Signage' "${tmp}"; then
    die "${dest_name}: path placeholder not substituted"
  fi
  # Legacy /home/pi/... is fine when REPO_ROOT is that tree.
  if grep -qE '/home/pi/Foyer-Room-Signage' "${tmp}"; then
    case "${REPO_ROOT}" in
      /home/pi/Foyer-Room-Signage|/home/pi/Foyer-Room-Signage/*) ;;
      *)
        die "${dest_name}: path placeholder not substituted"
        ;;
    esac
  fi

  out="${SYSTEMD_DIR}/${dest_name}"
  install -o root -g root -m 0644 "${tmp}" "${out}"
  echo "install-host-units: installed ${out}"
}

render_unit "${TEMPLATE_FOYER}" "foyer.service"
render_unit "${TEMPLATE_PANEL}" "foyer-panel.service"
render_unit "${TEMPLATE_KIOSK}" "foyer-kiosk.service"

# Kiosk launchers must be executable when the unit is enabled
for kiosk_script in foyer-kiosk.sh foyer-kiosk-room-panel.sh foyer-kiosk-sway.sh; do
  if [ -f "${REPO_ROOT}/scripts/${kiosk_script}" ]; then
    chmod +x "${REPO_ROOT}/scripts/${kiosk_script}"
  fi
done

echo "install-host-units: daemon-reload…"
systemctl daemon-reload

echo "install-host-units: enable --now foyer.service…"
systemctl enable --now foyer.service

echo "install-host-units: enable --now foyer-panel.service…"
systemctl enable --now foyer-panel.service

if [ "${ENABLE_KIOSK}" -eq 1 ]; then
  echo "install-host-units: enable --now foyer-kiosk.service…"
  systemctl enable --now foyer-kiosk.service
else
  if systemctl is-enabled foyer-kiosk.service >/dev/null 2>&1; then
    echo "install-host-units: note — foyer-kiosk is currently enabled (left as-is; --skip-kiosk-enable)."
  else
    echo "install-host-units: foyer-kiosk installed, left disabled (--skip-kiosk-enable)."
  fi
fi

if [ "${WITH_SUDOERS}" -eq 1 ]; then
  echo "install-host-units: chaining install-host-sudoers.sh…"
  FOYER_USER="${FOYER_SVC_USER}" bash "${SCRIPT_DIR}/install-host-sudoers.sh"
fi

echo
echo "OK — systemd units installed for ${FOYER_SVC_USER}."
echo "Update / pull / reboot do not install these; re-run if User= or checkout path changes."
echo "Re-running replaces ${SYSTEMD_DIR}/foyer.service, foyer-panel.service, and foyer-kiosk.service from deploy/."
echo
echo "Status:"
systemctl --no-pager --full status foyer.service || true
systemctl --no-pager --full status foyer-panel.service || true
if [ "${ENABLE_KIOSK}" -eq 1 ]; then
  systemctl --no-pager --full status foyer-kiosk.service || true
fi
echo
echo "Next steps:"
if [ "${WITH_SUDOERS}" -eq 0 ]; then
  echo "  # Host sudoers (kiosk systemctl) — once; not installed by pull/Update:"
  echo "  sudo FOYER_USER=${FOYER_SVC_USER} bash ${SCRIPT_DIR}/install-host-sudoers.sh"
  echo "  # Or re-run: sudo bash ${SCRIPT_DIR}/install-host-units.sh --with-sudoers"
  echo "  # Or:        sudo bash ${SCRIPT_DIR}/install-host.sh"
fi
echo "  # Dual-head packages / groups (INSTALL.md §7) before first kiosk paint:"
echo "  #   sudo apt-get install -y seatd sway wlr-randr … chromium"
echo "  sudo usermod -aG video,render,input,tty ${FOYER_SVC_USER}"
echo "  sudo loginctl enable-linger ${FOYER_SVC_USER}"
echo "  # then log out/in or reboot; re-run installer if kiosk was skipped:"
echo "  #   sudo bash ${SCRIPT_DIR}/install-host-units.sh"
echo "  # Relay dual-head: leave relay-kiosk disabled (FOYER-RELAY day-one)."
echo
echo "See INSTALL.md §6 (units) and §7 (local video / kiosk)."
