#!/usr/bin/env bash
# Install Foyer host sudoers drop-in from deploy/ template.
#
# Idempotent: re-running overwrites /etc/sudoers.d/foyer-kiosk with a freshly
# substituted template (visudo-checked).
#
# Usage (from repo root or any cwd):
#   sudo bash scripts/install-host-sudoers.sh
#   sudo FOYER_USER=ubuntu bash scripts/install-host-sudoers.sh
#
# Username (service account = systemd User= on foyer.service / foyer-panel /
# foyer-kiosk.service):
#   1. FOYER_USER or SUDOERS_USER if set
#   2. else SUDO_USER when invoked via sudo (the invoking human account)
#   3. else current login name (id -un) — only useful if already root as that user
#
# Update / pull / reboot do NOT install this drop-in. Run once on the appliance;
# re-run if User= changes.
#
# Requires root. Refuses to write without privileges.

set -euo pipefail

die() {
  echo "install-host-sudoers: $*" >&2
  exit 1
}

if [ "$(id -u)" -ne 0 ]; then
  die "must run as root (try: sudo bash scripts/install-host-sudoers.sh)"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_DIR="${REPO_ROOT}/deploy"

TEMPLATE_KIOSK="${DEPLOY_DIR}/sudoers.foyer-kiosk"

[ -f "${TEMPLATE_KIOSK}" ] || die "missing template: ${TEMPLATE_KIOSK}"
command -v visudo >/dev/null 2>&1 || die "visudo not found (install sudo package)"

# Resolve service username
if [ -n "${FOYER_USER:-}" ]; then
  FOYER_SVC_USER="${FOYER_USER}"
elif [ -n "${SUDOERS_USER:-}" ]; then
  FOYER_SVC_USER="${SUDOERS_USER}"
elif [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
  FOYER_SVC_USER="${SUDO_USER}"
else
  FOYER_SVC_USER="$(id -un)"
fi

# Linux-ish username: letters/digits/_/- starting with letter or _
case "${FOYER_SVC_USER}" in
  ''|[!A-Za-z_]*|*[!A-Za-z0-9_-]*)
    die "invalid service username: '${FOYER_SVC_USER}' (set FOYER_USER=…)"
    ;;
esac

if ! id -u "${FOYER_SVC_USER}" >/dev/null 2>&1; then
  die "user '${FOYER_SVC_USER}' does not exist on this host (set FOYER_USER=…)"
fi

echo "install-host-sudoers: service user = ${FOYER_SVC_USER}"
echo "install-host-sudoers: templates from ${DEPLOY_DIR}"

install_one() {
  local name="$1"
  local template="$2"
  local dest="/etc/sudoers.d/${name}"
  local tmp

  tmp="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${tmp}'" RETURN

  # Substitute leading "USER " placeholder only (matches deploy templates).
  sed "s/^USER /${FOYER_SVC_USER} /" "${template}" > "${tmp}"

  if ! grep -qE "^${FOYER_SVC_USER} " "${tmp}"; then
    die "${name}: template did not contain a leading USER placeholder to replace"
  fi

  echo "install-host-sudoers: validating ${name} (pre-install)…"
  visudo -cf "${tmp}" || die "${name}: visudo rejected rendered template (not installing)"

  install -o root -g root -m 0440 "${tmp}" "${dest}"

  echo "install-host-sudoers: validating ${dest} (post-install)…"
  visudo -cf "${dest}" || {
    rm -f "${dest}"
    die "${name}: visudo rejected installed file — removed ${dest}"
  }

  echo "install-host-sudoers: installed ${dest} (mode 0440)"
}

install_one "foyer-kiosk" "${TEMPLATE_KIOSK}"

echo
echo "OK — host sudoers drop-in installed for ${FOYER_SVC_USER}."
echo "Update / pull / reboot do not install this; re-run this script if User= changes."
echo
echo "Next — smoke checks (must NOT prompt for a password):"
echo "  sudo -u ${FOYER_SVC_USER} sudo -n /usr/bin/systemctl status foyer.service || true"
echo "  sudo -u ${FOYER_SVC_USER} sudo -n /usr/bin/systemctl status foyer-panel.service || true"
echo "  sudo -u ${FOYER_SVC_USER} sudo -n /usr/bin/systemctl status foyer-kiosk.service || true"
echo
echo "See INSTALL.md §7 (foyer-kiosk sudoers)."
