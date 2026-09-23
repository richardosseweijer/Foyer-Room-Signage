#!/bin/sh
# Welcome Chromium client under the Foyer compositor (sway).
# Waits for local welcome, then kiosk-loads loopback :8080.
# Profile dir is isolated from Room-panel Chromium (F3).
# --class=foyer-welcome: sway matches both app_id (Wayland) and class (XWayland).
# Prefer apt chromium / chromium-browser over snap (INSTALL §7 / §7c).
# Optional FOYER_CHROMIUM_NO_SANDBOX=1 for snap namespace errors on this dedicated seat.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CHROME="$(command -v chromium || command -v chromium-browser || echo /usr/bin/chromium)"
URL="http://127.0.0.1:8080/"
USER_DATA="${ROOT}/data/chromium-welcome"

wait_welcome() {
  i=0
  while [ "$i" -lt 40 ]; do
    if command -v curl >/dev/null 2>&1 && curl -sf -o /dev/null --max-time 1 "$URL"; then
      return 0
    fi
    i=$((i + 1))
    sleep 0.5
  done
}

mkdir -p "$USER_DATA"
wait_welcome || true

set -- \
  --ozone-platform=wayland \
  --enable-features=UseOzonePlatform \
  --class=foyer-welcome \
  --user-data-dir="$USER_DATA" \
  --kiosk \
  --no-first-run \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --disable-dev-shm-usage
if [ "${FOYER_CHROMIUM_NO_SANDBOX:-}" = "1" ]; then
  set -- "$@" --no-sandbox
fi
exec "$CHROME" "$@" "$URL"
