# Contributing

The draft is version -00 and has not been submitted to the IETF. It
needs readers before it needs a sponsor — see [the roadmap](https://evilbyte.net/rfc-process.html).
Reading it and filing an issue for whatever's wrong is the single most
useful contribution available.

## The formula is load-bearing, four times over

Section 4's Evil Rating formula exists in four places that must agree on
every input:

1. The prose (`draft-traviss-evil-byte-00.md`, Section 4 and Appendix A)
2. Python (`evil-byte-src/src/evilbyte/__init__.py`)
3. Go (`evil-byte-go/evilrating/`)
4. JavaScript (`site/public/evil-formula.mjs`)

All four are checked against the same source: Appendix C's test vectors.
If you change a weight, a table value, or the rounding rule, change it in
all four, then run:

```bash
cd evil-byte-src && pytest -v          # 20 cases
cd evil-byte-go && go test -v ./...    # 19 cases + Elo
```

The JS side doesn't have its own test runner; the calculator page
(`site/public/calculator.html`) exercises it live, and its default state
reproduces Appendix C.1 (ER = 55) — if that number changes unexpectedly
after a formula edit, something drifted.

## Working on each part

```bash
# site (evilbyte.net) — static pages + a Worker with one dynamic route
cd site && npm install && npm run build:draft && npm run dev

# era (era.evilbyte.net) — the Evil Rating Authority
cd era && npm install && npm run build:db && npm run dev

# Python (pip install evilbyte)
cd evil-byte-src && pip install -e ".[dev]" && pytest

# Go
cd evil-byte-go && go build ./... && go test ./...

# the RFCXML, regenerated from the Markdown
npm install && npm run build:rfcxml
xml2rfc draft-traviss-evil-byte-00.xml --text   # requires `pip install xml2rfc`
```

CI runs all of the above on every push; see `.github/workflows/`.

## Voice

If you're adding prose to the draft itself, match the existing register:
dry, bureaucratic, treats absurd conclusions with complete institutional
seriousness, and attributes every questionable decision to "the Working
Group" (which does not exist, and settled most of its decisions without
discussion). If you're adding code comments, don't — see the style
already in place, which mostly just cites the section it implements.

## Pull requests

- Keep the formula's four implementations in sync (above) — CI will
  catch drift, but catching it yourself is faster.
- If you're touching `evil-byte-go/cmd/mitm` or `evil-byte-src/src/evilbyte/mitm.py`,
  note in the PR whether you tested it against real NFQUEUE traffic or
  only read the code very carefully. Both are fine; only one is Verified
  Good.
- Small, focused PRs over large ones. This document already contains one
  monolithic central authority (Section 6); the codebase doesn't need
  another.

## Reporting a security issue

Not here — see [SECURITY.md](SECURITY.md).
