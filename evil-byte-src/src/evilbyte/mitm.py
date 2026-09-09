#!/usr/bin/env python3
"""A minimal MITM (Section 5) for Linux.  Rates every packet that nftables
sends to NFQUEUE 666 (Appendix B.1) and writes the Evil Byte.

Requires the netfilterqueue and scapy packages, root, and a clear
conscience.  Illustrative, not normative: a production MITM would read
everything (Section 4.5.1); this one merely presumes.

Install with the `mitm` extra (`pip install evilbyte[mitm]`) and run with
`python -m evilbyte.mitm`. Interoperates with evil-byte-go/cmd/mitm: both
write the same octet, to the same nftables queue (see ../evil.nft).
"""
import socket
from datetime import datetime

import evilbyte as eb

QUEUE = 666
AS_MULTIPLIER = {}        # populated from <asn>.as.evil.arpa (Section 6.5)
DEFAULT_AS = 1.0          # ERA has no opinion of this AS (Section 4.2)
ENCRYPTED_PORTS = {443, 853, 993, 995, 8443}   # Encrypted With Intent


def name_of(addr):
    """PTR lookup (Section 4.6).  None if the source is nameless."""
    try:
        return socket.gethostbyaddr(addr)[0]
    except OSError:
        return None


def rate(raw):
    from scapy.all import IP, IPv6

    if raw[0] >> 4 == 4:
        pkt, arriving, f_net = IP(raw), IP(raw).tos, eb.NET["ipv4"]
        proto = pkt.proto
    else:
        pkt, arriving, f_net = IPv6(raw), IPv6(raw).tc, eb.NET["ipv6"]
        proto = pkt.nh
        if proto == 0:                                  # Hop-by-Hop Options
            f_net = eb.NET["ipv6-hbh"]
    f_tx = {6: eb.TX["tcp"], 17: eb.TX["udp"], 132: eb.TX["sctp"],
            1: eb.TX["icmp-echo"], 58: eb.TX["icmp-echo"],
            47: eb.TX["tunnel"], 4: eb.TX["tunnel"],
            41: eb.TX["tunnel"], 50: eb.TX["tunnel"]}.get(proto, eb.TX["other"])
    dport = getattr(pkt.payload, "dport", None)
    if proto == 17 and dport == 443:
        f_tx = eb.TX["quic"]
    f_content = eb.content_factor("encrypted" if dport in ENCRYPTED_PORTS
                                  else "unanalysed")   # analysis is OPTIONAL
    er = eb.evil_rating(AS_MULTIPLIER.get(pkt.src, DEFAULT_AS), f_net, f_tx,
                        f_content, eb.name_factor(name_of(pkt.src)),
                        eb.time_factor(datetime.now()), arriving)
    if isinstance(pkt, IP):
        pkt.tos = er
        del pkt.chksum                                  # recomputed on send
        pkt.flags = (int(pkt.flags) & 3) | (4 if er >= 128 else 0)   # RFC 3514
    else:
        pkt.tc = er
    return bytes(pkt)


def handle(packet):
    packet.set_payload(rate(packet.get_payload()))
    packet.accept()


def main():
    from netfilterqueue import NetfilterQueue

    nfq = NetfilterQueue()
    nfq.bind(QUEUE, handle)
    try:
        nfq.run()
    finally:
        nfq.unbind()


if __name__ == "__main__":
    main()
