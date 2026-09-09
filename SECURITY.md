# Security Policy

This repository contains a satirical Internet-Draft and a fully working
implementation of it: two live Cloudflare Workers, a Python package, and
a Go module that opens raw sockets on purpose. The draft is a joke. The
attack surface is not.

## Supported versions

| Component | Supported |
|---|---|
| `evilbyte.net` (site) | Whatever's deployed from `main` |
| `era.evilbyte.net` | Whatever's deployed from `main` |
| `evilbyte` (PyPI) | Latest `py-v*` release |
| `evil-byte-go` | Latest `evil-byte-go/v*` tag |
| The draft itself | Version -00. There is no -01 yet, so there is nothing to patch it to. |

There is no LTS branch. This is a two-Worker satire project, not a bank.

## Reporting a vulnerability

**Please don't set your own Evil Rating.** Section 5.3 is explicit that a
host MUST NOT self-assess, and the same principle applies to bug bounty
etiquette: report it and let someone else make the call.

Use **[GitHub's private vulnerability reporting](https://github.com/rosetraviss/evil-byte/security/advisories/new)**
for this repository, or see [`/security.txt`](https://evilbyte.net/security.txt)
(RFC 9116) for the same contact in machine-readable form. Please don't
open a public issue for anything that shouldn't be public first.

### In scope

- The Worker code in `site/` and `era/` (request handling, the reverse-DNS
  and ERA-fetch logic, anything that touches untrusted input)
- The Python and Go reference implementations, particularly `mitm.py` /
  `cmd/mitm` (raw packet handling, running as root)
- The RFCXML/Markdown build scripts, if you can make them do something
  other than build RFCXML

### Out of scope

- The formula in Section 4 rating your organisation more harshly than
  you'd like. That's Section 4, not a vulnerability. Take it up with the
  Working Group (there is no Working Group).
- `era.evilbyte.net`'s opinion of your ASN. See above.
- Anything requiring physical access to a MITM's falconer (Section 9).

## What happens next

Real reports get triaged and fixed like any other software bug. This
document is deadpan about the content; it is not deadpan about actually
fixing things.
