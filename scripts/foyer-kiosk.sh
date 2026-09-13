#!/bin/sh
# Cage client on tty1: pin HDMI, wait for welcome, then Chromium on Wayland.
set -eu
CHROME="$(command -v chromium || command -v chromium-browser || echo /usr/bin/chromium)"
URL="http://127.0.0.1:8080/"

apply_output() {
  command -v wlr-randr >/dev/null 2>&1 || return 0
  [ -n "${FOYER_VIDEO_OUTPUT:-}" ] || return 0
  i=0
  while [ "$i" -lt 15 ]; do
    if wlr-randr >/dev/null 2>&1; then
      break
    fi
    i=$((i + 1))
    sleep 0.4
  done
  wlr-randr --output "$FOYER_VIDEO_OUTPUT" --on >/dev/null 2>&1 || true
  wlr-randr 2>/dev/null | awk '
    /^[A-Za-z0-9._-]+/ { print $1 }
  ' | while read -r name; do
    [ -n "$name" ] || continue
    [ "$name" = "$FOYER_VIDEO_OUTPUT" ] && continue
    wlr-randr --output "$name" --off >/dev/null 2>&1 || true
  done
}

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

apply_output &
wait_welcome || true
exec "$CHROME" \
  --ozone-platform=wayland \
  --enable-features=UseOzonePlatform \
  --kiosk \
  --no-first-run \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --disable-dev-shm-usage \
  "$URL"
