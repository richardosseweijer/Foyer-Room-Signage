#!/bin/sh
# Example only. Set AP_IFACE to the NIC that faces the rack AP (`ip -br addr`).
# Set OUT_IFACE to the NIC the config laptop / calendar uses.
set -eu
AP_IFACE="${AP_IFACE:-}"
OUT_IFACE="${OUT_IFACE:-}"
if [ -z "$AP_IFACE" ] || [ -z "$OUT_IFACE" ]; then
  echo "Set AP_IFACE and OUT_IFACE, e.g. AP_IFACE=enp3s0 OUT_IFACE=enp1s0 $0" >&2
  exit 1
fi
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow in on "$AP_IFACE" to any port 8082 proto tcp
sudo ufw allow in on "$OUT_IFACE" to any port 8080 proto tcp
sudo ufw --force enable
sudo ufw status verbose
echo "8080 is for the config laptop on $OUT_IFACE. Do not open 8080 on $AP_IFACE."
