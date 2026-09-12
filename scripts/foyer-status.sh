#!/bin/sh
set -eu
echo "== systemd =="
systemctl is-active foyer 2>/dev/null || echo "foyer: not installed"
systemctl is-active foyer-panel 2>/dev/null || echo "foyer-panel: not installed"
systemctl is-active foyer-kiosk 2>/dev/null || echo "foyer-kiosk: not installed"
echo "== http =="
printf "welcome  /            %s\n" "$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8080/ || echo down)"
printf "setup    /config      %s\n" "$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8080/config || echo down)"
printf "panel    /            %s\n" "$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8082/ || echo down)"
printf "panel    /play/door   %s\n" "$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8082/play/door || echo down)"
printf "panel    /config      %s\n" "$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:8082/config || echo down)"
echo "expect: 200, 200, 302, 200, 404"
