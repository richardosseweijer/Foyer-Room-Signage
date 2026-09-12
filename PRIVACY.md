# Privacy

Foyer stores configuration on the host that runs it.

- Google Calendar is pulled **by this PC** using a secret iCal URL. Tablets never receive that URL.
- Event titles, hosts, and descriptions are sanitized before they reach a plate.
- PINs are stored as scrypt hashes. Display tokens are hashes plus a one-time pickup.
- No analytics, no cloud account, no Foyer-operated backend.
- Logs must not contain PINs, ICS URLs, or tokens (`SECURITY.md`).

The rack AP is not the public internet, but treat every tablet as untrusted.
