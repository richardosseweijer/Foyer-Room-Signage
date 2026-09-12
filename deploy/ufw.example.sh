#!/bin/sh
# Example only. Set AP_IFACE to the NIC that faces the rack AP (`ip -br addr`).
set -eu
AP_IFACE="${AP_IFACE:-}"
if [ -z "$AP_IFACE" ]; then
  echo "Set AP_IFACE to the rack-AP interface, e.g. AP_IFACE=enp3s0 $0" >&2
  exit 1
fi
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow in on "$AP_IFACE" to any port 8082 proto tcp
sudo ufw --force enable
sudo ufw status verbose
echo "Welcome stays on 127.0.0.1:8080 — do not open 8080 on a NIC."
