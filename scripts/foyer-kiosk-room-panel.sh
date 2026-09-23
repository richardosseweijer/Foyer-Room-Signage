#!/bin/sh
# Room-panel Chromium under the Foyer compositor (sway) — F3.
# Loads Relay control UI from FOYER_ROOM_PANEL_URL (site relayUrl / AV-LAN).
# Separate profile so Welcome and Room panel never share Chromium state.
# --class=foyer-room-panel: sway matches both app_id (Wayland) and class (XWayland).
# Prefer apt chromium / chromium-browser over snap (INSTALL §7 / §7c).
# Optional FOYER_CHROMIUM_NO_SANDBOX=1 for snap namespace errors on this dedicated seat.
# Soft-fail (exit 0) when URL unset or unsafe — Room-panel-only skip must not crash sway.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
CHROME="$(command -v chromium || command -v chromium-browser || echo /usr/bin/chromium)"
URL="${FOYER_ROOM_PANEL_URL:-}"
USER_DATA="${ROOT}/data/chromium-room-panel"

if [ -z "$URL" ]; then
  printf '%s\n' "foyer-kiosk-room-panel: FOYER_ROOM_PANEL_URL unset — not launching" >&2
  exit 0
fi

# Only plain http://host[:port]/ from kioskEnvBody (no spaces / quotes / shell metachar).
case "$URL" in
  http://*[!A-Za-z0-9._~:/\[\]-]*)
    printf '%s\n' "foyer-kiosk-room-panel: refusing unsafe FOYER_ROOM_PANEL_URL" >&2
    exit 0
    ;;
  http://*)
    ;;
  *)
    printf '%s\n' "foyer-kiosk-room-panel: refusing non-http FOYER_ROOM_PANEL_URL" >&2
    exit 0
    ;;
esac

wait_relay() {
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
wait_relay || true

set -- \
  --ozone-platform=wayland \
  --enable-features=UseOzonePlatform \
  --class=foyer-room-panel \
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
