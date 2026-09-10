#!/usr/bin/env python3
"""Check that a checked-in PDF still says what the freshly rendered one says.

xml2rfc's PDF output is not byte-reproducible: its XMP metadata carries a
timestamp, and line breaking shifts with the xml2rfc version and with which
fonts happen to be installed.  The words do not.  So this compares
whitespace-normalised text and nothing else.

Usage: compare-pdf-text.py COMMITTED.pdf RENDERED.pdf
"""
import re
import sys

from pypdf import PdfReader


def text_of(path):
    pages = PdfReader(path).pages
    return re.sub(r"\s+", " ", "".join(p.extract_text() for p in pages)).strip()


def main(committed, rendered):
    a, b = text_of(committed), text_of(rendered)
    if a == b:
        print(f"{committed} is current ({len(a)} characters of text).")
        return 0

    i = next((i for i in range(min(len(a), len(b))) if a[i] != b[i]), min(len(a), len(b)))
    print(f"{committed} is stale: it does not match a fresh render of the XML.")
    print(f"  committed: {len(a)} characters, rendered: {len(b)}")
    print(f"  first difference at character {i}:")
    print(f"    committed: ...{a[max(0, i - 100):i + 100]}...")
    print(f"    rendered:  ...{b[max(0, i - 100):i + 100]}...")
    print("\nRegenerate it with `npm run build:pdf` (see CONTRIBUTING.md).")
    return 1


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2]))
