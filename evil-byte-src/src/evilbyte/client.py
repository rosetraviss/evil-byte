#!/usr/bin/env python3
"""Minimal HTTP client demonstrating Section 8 (Client Behaviour): discards,
unread, any response whose Evil Rating is at or above its threshold.

Interoperates with server.py and with the Go cmd/server: both read and
write the same Evil / Evil-Threshold headers.
"""
import argparse
import sys
import urllib.error
import urllib.request


def response_rating(headers, flag_day):
    """Reader half of Section 7.4, and the Section 3.3 Unrated rule."""
    raw = headers.get("Evil")
    if raw is None:
        return 255 if flag_day else 127
    try:
        n = int(raw)
    except ValueError:
        return 255
    return n if 0 <= n <= 255 else 255


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url", nargs="?", default="http://localhost:8080/")
    p.add_argument("--threshold", type=int, default=128, help="T_c (Section 8.1)")
    p.add_argument("--evil-rating", type=int, default=None,
                    help="Evil Rating to send on the outbound Evil header, simulating an "
                         "upstream MITM (Section 7.4); omit to send no header at all")
    p.add_argument("--flag-day", action="store_true",
                    help="treat an Unrated response as 255 instead of 127 (Section 3.3 / 10.1)")
    p.add_argument("--method", default="GET")
    args = p.parse_args()

    headers = {}
    if args.evil_rating is not None:
        # Section 5.3: a host MUST NOT set its own Evil Byte. This flag
        # simulates what an upstream MITM would have written, for testing.
        headers["Evil"] = str(args.evil_rating)

    req = urllib.request.Request(args.url, headers=headers, method=args.method)
    try:
        resp = urllib.request.urlopen(req)
        status, resp_headers, body_reader = resp.status, resp.headers, resp
    except urllib.error.HTTPError as e:
        status, resp_headers, body_reader = e.code, e.headers, e

    er = response_rating(resp_headers, args.flag_day)
    print(f"server responded {status}, Evil {er} (threshold {args.threshold})", file=sys.stderr)

    if er >= args.threshold:
        body_reader.close()  # discarded unread, in the manner of a letter
        print(f"server is Evil ({er} >= {args.threshold}) -- "  # from a former partner (Section 8.1)
              f"response discarded unread (Section 8.1)", file=sys.stderr)
        sys.exit(1)

    if status in (666, 418):
        print(f"rejected by server: status {status}, "
              f"Evil-Threshold {resp_headers.get('Evil-Threshold')} (Section 7.2)", file=sys.stderr)
        sys.exit(1)

    print(body_reader.read().decode(errors="replace"))


if __name__ == "__main__":
    main()
