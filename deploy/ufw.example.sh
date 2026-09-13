#!/bin/sh
# Example only. AV_IFACE is the AV-LAN NIC (door tablet + config laptop).
# Internet NIC has no inbound Foyer ports.
set -eu
AV_IFACE="${AV_IFACE:-}"
if [ -z "$AV_IFACE" ]; then
  echo "Set AV_IFACE, e.g. AV_IFACE=enp1s0 $0" >&2
  exit 1
fi
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow in on "$AV_IFACE" to any port 8080 proto tcp
sudo ufw allow in on "$AV_IFACE" to any port 8082 proto tcp
sudo ufw --force enable
sudo ufw status verbose
echo "8080/8082 on $AV_IFACE only. Nothing inbound on the internet NIC."
