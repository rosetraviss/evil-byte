#!/usr/bin/env python3
"""Minimal HTTP server demonstrating Section 7 (Server Behaviour).

Does not read the Evil Byte off the wire itself -- per Appendix B.3, that
is the job of a host firewall or an upstream MITM, which is expected to
set the Evil request header (Section 7.4) before the request reaches the
application. Pair with mitm.py, or with the Go cmd/mitm, on the path.
Interoperates with client.py and with the Go cmd/client: both read and
write the same Evil / Evil-Threshold headers and /.well-known/evil
document.
"""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class EvilHandler(BaseHTTPRequestHandler):
    server_version = "evil-byte-server/0.1"

    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def handle_request(self):
        if self.path == "/.well-known/evil":
            return self.well_known()

        er = self.request_rating()
        threshold = self.server.threshold

        if er >= threshold:
            print(f"{self.command} {self.path}: Evil {er} >= threshold {threshold} "
                  f"-- refusing (Section 7.2)")
            if self.server.teapot:
                self.send_response(418)
                self.send_header("Accept-Additions", "")  # no milk (Section 7.2.2)
            else:
                self.send_response(666)  # Evil (Section 7.2.1)
            self.send_header("Evil-Threshold", str(threshold))
            self.send_header("Evil", str(self.server.self_rating))
            self.end_headers()  # body SHOULD explain nothing (Section 7.2.1)
            return

        print(f"{self.command} {self.path}: Evil {er} < threshold {threshold} -- accepted")
        body = b"Good enough.\n"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Evil-Threshold", str(threshold))
        self.send_header("Evil", str(self.server.self_rating))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def well_known(self):
        """Section 7.3: the well-known threshold document."""
        status = 418 if self.server.teapot else 666
        doc = {
            "v": 1,
            "threshold": self.server.threshold,
            "status": status,
            "self": self.server.self_rating,
            "era": self.server.era,
        }
        body = json.dumps(doc).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def request_rating(self):
        """Reader half of Section 7.4, and the Section 3.3 Unrated rule."""
        raw = self.headers.get("Evil")
        if raw is None:
            return 255 if self.server.flag_day else 127
        try:
            n = int(raw)
        except ValueError:
            return 255
        return n if 0 <= n <= 255 else 255

    def log_message(self, fmt, *args):
        pass  # the print() calls above are the log


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--addr", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8080)
    p.add_argument("--threshold", type=int, default=128, help="T_s (Section 7.1)")
    p.add_argument("--self-rating", type=int, default=17,
                    help="this server's own Evil Rating, on the Evil response header")
    p.add_argument("--teapot", action="store_true",
                    help="use 418 (Section 7.2.2) instead of the 666 status class (Section 7.2.1)")
    p.add_argument("--flag-day", action="store_true",
                    help="treat an Unrated request as 255 instead of 127 (Section 3.3 / 10.1)")
    p.add_argument("--era", default="evil.arpa", help="authority named in /.well-known/evil")
    args = p.parse_args()

    httpd = ThreadingHTTPServer((args.addr, args.port), EvilHandler)
    httpd.threshold = args.threshold
    httpd.self_rating = args.self_rating
    httpd.teapot = args.teapot
    httpd.flag_day = args.flag_day
    httpd.era = args.era

    print(f"evil-byte server: listening on {args.addr}:{args.port}, "
          f"threshold {args.threshold}, self-rating {args.self_rating}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
