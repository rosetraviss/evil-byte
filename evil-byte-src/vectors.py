"""Appendix C test vectors, generated from the reference implementation."""
from datetime import datetime
import evilbyte as eb

noon = datetime(2027, 3, 31, 12, 0)        # a Wednesday
three_am = datetime(2027, 3, 31, 3, 0)
friday_5pm = datetime(2027, 3, 26, 17, 0)
april_1 = datetime(2027, 4, 1, 12, 0)

V = [
 ("C.1",  "Baseline: IPv4, TCP, .com, not analysed, Wednesday noon",
  1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"), eb.name_factor("www.example.com"), eb.time_factor(noon), 0),
 ("C.2",  "As C.1, but over TLS (Encrypted With Intent)",
  1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("encrypted"), eb.name_factor("www.example.com"), eb.time_factor(noon), 0),
 ("C.3",  "As C.2, but over IPv6",
  1.0, eb.NET["ipv6"], eb.TX["tcp"], eb.content_factor("encrypted"), eb.name_factor("www.example.com"), eb.time_factor(noon), 0),
 ("C.4",  "As C.2, with VDA; plaintext found Good",
  1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("good", vda=True), eb.name_factor("www.example.com"), eb.time_factor(noon), 0),
 ("C.5",  "As C.2, with VDA; plaintext found Evil",
  1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("evil", vda=True), eb.name_factor("www.example.com"), eb.time_factor(noon), 0),
 ("C.6",  "AS32934, QUIC over IPv4, encrypted, 03:00",
  2.0, eb.NET["ipv4"], eb.TX["quic"], eb.content_factor("encrypted"), eb.name_factor("edge.example.com"), eb.time_factor(three_am), 0),
 ("C.7",  "EU institution, IPv6, TCP, analysed Good, .eu",
  0.5, eb.NET["ipv6"], eb.TX["tcp"], eb.content_factor("good"), eb.name_factor("ec.example.eu"), eb.time_factor(noon), 0),
 ("C.8",  ".mil, IPv4, TCP, encrypted",
  4.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("encrypted"), eb.name_factor("mail.example.mil"), eb.time_factor(noon), 0),
 ("C.9",  "Avian carrier, IPv4, scroll not unrolled, .org",
  1.0, eb.NET["ipv4"], eb.TX["avian"], eb.content_factor("unanalysed"), eb.name_factor("loft.example.org"), eb.time_factor(noon), 0),
 ("C.10", "Printer: mDNS (UDP) over IPv4, analysed Good, .local",
  1.0, eb.NET["ipv4"], eb.TX["udp"], eb.content_factor("good"), eb.name_factor("printer.local"), eb.time_factor(noon), 0),
 ("C.11", "As C.1, arriving at a second MITM already rated 55",
  1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"), eb.name_factor("www.example.com"), eb.time_factor(noon), 55),
 ("C.12", "As C.1, no name, Friday 17:00",
  1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"), eb.name_factor(None), eb.time_factor(friday_5pm), 0),
 ("C.13", "As C.1, from a host called secure-gw.example.net",
  1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"), eb.name_factor("secure-gw.example.net"), eb.time_factor(noon), 0),
 ("C.14", "IPv6 with Hop-by-Hop Options, ICMPv6 echo, analysed Good",
  1.0, eb.NET["ipv6-hbh"], eb.TX["icmp-echo"], eb.content_factor("good"), eb.name_factor("host.example.net"), eb.time_factor(noon), 0),
 ("C.15", "As C.7, on 1 April",
  0.5, eb.NET["ipv6"], eb.TX["tcp"], eb.content_factor("good"), eb.name_factor("ec.example.eu"), eb.time_factor(april_1), 0),
]

def fmt(f):
    return "inf" if f == float("inf") else (f"{f:g}")

if __name__ == "__main__":
    import sys
    md = "--md" in sys.argv
    if md:
        print("| ID | Scenario | F_AS | F_net | F_tx | F_content | F_name | F_time | Arriving | ER |")
        print("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for vid, desc, *f in V:
        er = eb.evil_rating(*f)
        cells = [fmt(x) for x in f[:-1]] + [str(f[-1]), f"**{er}**" if md else str(er)]
        if md:
            print(f"| {vid} | {desc} | " + " | ".join(cells) + " |")
        else:
            print(vid, er, desc, cells)
