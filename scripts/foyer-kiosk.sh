#!/bin/sh
# Cage client: pin Chromium to the HDMI named in FOYER_VIDEO_OUTPUT, then kiosk.
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

apply_output &
exec "$CHROME" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 "$URL"
