#!/usr/bin/env bash
# First-boot / appliance host installer for Foyer (systemd units + sudoers).
#
# Idempotent wrapper around:
#   scripts/install-host-units.sh   (foyer + foyer-panel + foyer-kiosk; kiosk ON by default)
#   scripts/install-host-sudoers.sh (foyer-kiosk drop-in)
#
# Usage:
#   sudo bash scripts/install-host.sh
#   sudo FOYER_USER=ubuntu bash scripts/install-host.sh
#   sudo bash scripts/install-host.sh --skip-kiosk-enable   # units+sudoers; leave kiosk enable alone
#   sudo bash scripts/install-host.sh --skip-preflight      # unusual layouts only (INSTALL.md §6a)
#
# Requires root. Update / pull / reboot do NOT run this.
# Forwards flags to install-host-units.sh (preflight + units + sudoers).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "install-host: must run as root (try: sudo bash scripts/install-host.sh)" >&2
  exit 1
fi

# Forward only known flags; units script validates.
exec bash "${SCRIPT_DIR}/install-host-units.sh" --with-sudoers "$@"
