# Two-VPS interop test

A runbook for testing draft-traviss-evil-byte-00 across the real Internet:
does the Evil Byte survive the path between two arbitrary providers, or
does someone's middlebox bleach it (Section 10.3)?

## What you need

Two small Debian/Ubuntu VPS instances, **on different providers** (that's
the point — it's what makes this a real test of Section 10.3 rather than
a loopback demo). Nothing fancy; the cheapest tier of any provider is fine.
Root access to both.

## Setup

On **VPS A** (runs the MITM and the demo server):

```bash
curl -fsSL https://raw.githubusercontent.com/rosetraviss/evil-byte/main/deploy/setup.sh | sudo bash -s mitm-server
```

On **VPS B** (just makes requests):

```bash
curl -fsSL https://raw.githubusercontent.com/rosetraviss/evil-byte/main/deploy/setup.sh | sudo bash -s client
```

Each takes under a minute: installs Go if it's missing, builds the three
binaries from source, and (on VPS A) applies `evil-mitm.nft` and starts
`evilbyte-mitm` and `evilbyte-server` as systemd services.

## Running the test

On **VPS B**:

```bash
evilbyte-client -url http://<VPS-A-public-ip>:8080/
```

You should see `server responded 200, Evil 17 (threshold 128)` — VPS A's
MITM rated the response and wrote it into both the IPv4 TOS octet
(Section 5.2) and the `Evil` HTTP header (Section 7.4); the client here is
only reading the header, which is the point of the header's existing at
all (Section 7.4: "a convenience for application developers").

To see whether the **octet itself** survived the trip, not just the
header, capture on VPS B while requesting from VPS A:

```bash
sudo tcpdump -i any -v tcp and src <VPS-A-public-ip> and port 8080
```

Look at the `tos` field in the packet capture. It should read the same
value `evilbyte-mitm` logged when it rated the response
(`journalctl -u evilbyte-mitm -f` on VPS A shows this — the `Evil`
response header carries the same number, so the two are easy to compare).
If the `tos` byte on arrival doesn't match, something between the two
providers rewrote or reset the Differentiated Services field — exactly
the failure mode Section 10.3 describes, now witnessed rather than
speculated about. Note it: that's Section 10.4's "operational experience"
worth adding to a future revision of the draft.

## Variations worth trying

- Point `evilbyte-client` at a URL that makes the server's rating cross
  the 128 threshold (add a query path the server doesn't like, or just
  edit `evilbyte-server.service`'s `-self-rating` above 128 and restart
  it) and confirm the client actually discards the response unread
  (Section 8.1) rather than merely noticing.
- Run `evilbyte-mitm` / `evilbyte-server` from `evil-byte-src` (Python)
  on one box and the Go binaries on the other, to exercise the
  cross-language path for real rather than just on localhost.
- Add a third VPS in the middle as an actual routed hop, with its own
  `evilbyte-mitm` watching *forwarded* traffic (Section 5.4: Evil is
  monotonic — the rating should only go up as it crosses more MITMs).

## Cleanup

```bash
sudo systemctl disable --now evilbyte-mitm evilbyte-server   # VPS A
sudo nft delete table inet evil                              # VPS A
```

...or just destroy the VPS instances, which is probably faster.
