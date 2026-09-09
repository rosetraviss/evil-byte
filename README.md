# The Evil Byte

`draft-traviss-evil-byte-00` — *The Evil Byte: A Security Octet for the IPv4
and IPv6 Headers*. Obsoletes [RFC 3514](https://www.rfc-editor.org/rfc/rfc3514)
(the "evil bit"), if approved. Not yet submitted to the IETF.

Written entirely straight-faced, in the tradition of April 1 RFCs. The
engineering behind it is not a joke — everything below actually runs.

**[Read the draft](https://evilbyte.net/draft.html)** · **[Try the formula](https://evilbyte.net/calculator.html)** · **[The Evil Rating Authority](https://era.evilbyte.net/)** · **[How this becomes an RFC](https://evilbyte.net/rfc-process.html)**

## What's here

This is one repository because the draft, the site, and both reference
implementations need to stay in lockstep — if you change a weight in
Section 4, four other things need to agree with it by dinner.

| Path | What it is |
|---|---|
| [`draft-traviss-evil-byte-00.md`](draft-traviss-evil-byte-00.md) | The Internet-Draft, source of truth |
| [`draft-traviss-evil-byte-00.xml`](draft-traviss-evil-byte-00.xml) | The same, as submission-ready RFCXML v3 |
| [`draft-traviss-evil-byte-00.pdf`](draft-traviss-evil-byte-00.pdf) | The same again, as `xml2rfc --pdf` renders it |
| [`site/`](site) | evilbyte.net — a Cloudflare Worker: the rendered draft, a live rating gadget, the formula calculator |
| [`era/`](era) | era.evilbyte.net — the Evil Rating Authority (Section 6): an initial rating for every allocated ASN |
| [`telemetry/`](telemetry) | telemetry.evilbyte.net — pulls real Cloudflare traffic from Log Explorer every 15 minutes and rates it with the same formula, for validating the formula against reality |
| [`evil-byte-src/`](evil-byte-src) | Python reference implementation (`pip install evilbyte`), MITM, demo server/client |
| [`evil-byte-go/`](evil-byte-go) | The same, in Go — interoperates with the Python side over the wire, not just on paper |
| [`deploy/`](deploy) | A runbook and scripts for running the MITM across two real VPS, to see whether the octet survives the real Internet (Section 10.3) |
| [`scripts/`](scripts) | Builds the site's rendered draft page and the RFCXML from the Markdown source, and checks the PDF against it |

## Status

Version -00. Read [the roadmap](https://evilbyte.net/rfc-process.html) for
what actually has to happen before this is a real RFC — it needs readers
before it needs a sponsor.

## Quick start

```bash
# the site
cd site && npm install && npm run dev

# the ERA
cd era && npm install && npm run build:db && npm run dev

# Python
cd evil-byte-src && pip install -e ".[dev]" && pytest

# Go
cd evil-byte-go && go test ./...

# the RFCXML, and the PDF from it
npm install && npm run build:rfcxml
npm run build:pdf          # needs `pip install "xml2rfc[pdf]"`; see CONTRIBUTING.md
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: the formula in
Section 4 is load-bearing across four implementations (Python, Go,
JavaScript, and the prose itself) — if you touch a weight or a table,
touch all four, and `pytest` / `go test` will tell you if you missed one.

## Security

See [SECURITY.md](SECURITY.md), or just `curl https://evilbyte.net/security.txt`.

## License

[BSD-3-Clause](LICENSE), per the Revised BSD License required for Code
Components by the IETF Trust's Legal Provisions. The draft's text is
separately subject to BCP 78 and BCP 79, as all Internet-Drafts are.

## Acknowledgements

Steven Bellovin, for the original bit. The many policymakers whose
proposals made this document's central joke look reasonable by
comparison. See the draft's own [Acknowledgements](https://evilbyte.net/draft.html#acknowledgements)
for the rest.
