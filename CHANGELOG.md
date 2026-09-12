# Changelog

## 0.1.1

- Welcome hero is the room name
- Setup timezone is a dropdown
- Setup **Update from GitHub** (worktree build, `data/` left alone)
- Bind-panel field removed from Setup
- INSTALL.md: seatd, GPU, fonts, SSH tunnel for Setup, kiosk on `multi-user.target`
- `undici` declared (calendar source-bind)

## 0.1.0

First public tree: room appliance on the Relay PC.

- Welcome on the local video output (`/` on loopback `:8080`)
- Room plate on its own listener (`:8082`), Setup and welcome denied
- Indexed Setup dropdowns for outbound NIC and video output
- Calendar fetch binds to the selected NIC (fail closed)
- Wayfinding removed from the product (own app later)
- One room per PC; untagged ICS events land on that room
- Site PIN `1234` then force a stronger one
