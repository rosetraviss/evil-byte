"""Appendix C validation for the evilbyte package.

Every implementation of draft-traviss-evil-byte-00 -- this one, the Go
port in evil-byte-go/evilrating, and the JS port in
site/public/evil-formula.mjs -- must agree with this table exactly.
"""
import math
from datetime import datetime

import pytest

import evilbyte as eb

NOON = datetime(2027, 3, 31, 12, 0)  # a Wednesday
THREE_AM = datetime(2027, 3, 31, 3, 0)
FRIDAY_5PM = datetime(2027, 3, 26, 17, 0)
APRIL_1 = datetime(2027, 4, 1, 12, 0)

# id, f_as, f_net, f_tx, f_content, f_name, f_time, arriving, want_er
FORMULA_VECTORS = [
    ("C.1", 1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"),
     eb.name_factor("www.example.com"), eb.time_factor(NOON), 0, 55),
    ("C.2", 1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("encrypted"),
     eb.name_factor("www.example.com"), eb.time_factor(NOON), 0, 157),
    ("C.3", 1.0, eb.NET["ipv6"], eb.TX["tcp"], eb.content_factor("encrypted"),
     eb.name_factor("www.example.com"), eb.time_factor(NOON), 0, 111),
    ("C.4", 1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("good", vda=True),
     eb.name_factor("www.example.com"), eb.time_factor(NOON), 0, 6),
    ("C.5", 1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("evil", vda=True),
     eb.name_factor("www.example.com"), eb.time_factor(NOON), 0, 134),
    ("C.6", 2.0, eb.NET["ipv4"], eb.TX["quic"], eb.content_factor("encrypted"),
     eb.name_factor("edge.example.com"), eb.time_factor(THREE_AM), 0, 255),
    ("C.7", 0.5, eb.NET["ipv6"], eb.TX["tcp"], eb.content_factor("good"),
     eb.name_factor("ec.example.eu"), eb.time_factor(NOON), 0, 1),
    ("C.8", 4.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("encrypted"),
     eb.name_factor("mail.example.mil"), eb.time_factor(NOON), 0, 255),
    ("C.9", 1.0, eb.NET["ipv4"], eb.TX["avian"], eb.content_factor("unanalysed"),
     eb.name_factor("loft.example.org"), eb.time_factor(NOON), 0, 33),
    ("C.10", 1.0, eb.NET["ipv4"], eb.TX["udp"], eb.content_factor("good"),
     eb.name_factor("printer.local"), eb.time_factor(NOON), 0, 4),
    ("C.11", 1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"),
     eb.name_factor("www.example.com"), eb.time_factor(NOON), 55, 83),
    ("C.12", 1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"),
     eb.name_factor(None), eb.time_factor(FRIDAY_5PM), 0, 69),
    ("C.13", 1.0, eb.NET["ipv4"], eb.TX["tcp"], eb.content_factor("unanalysed"),
     eb.name_factor("secure-gw.example.net"), eb.time_factor(NOON), 0, 75),
    ("C.14", 1.0, eb.NET["ipv6-hbh"], eb.TX["icmp-echo"], eb.content_factor("good"),
     eb.name_factor("host.example.net"), eb.time_factor(NOON), 0, 7),
]


@pytest.mark.parametrize("vid,f_as,f_net,f_tx,f_content,f_name,f_time,arriving,want",
                          FORMULA_VECTORS, ids=[v[0] for v in FORMULA_VECTORS])
def test_appendix_c_formula(vid, f_as, f_net, f_tx, f_content, f_name, f_time, arriving, want):
    got = eb.evil_rating(f_as, f_net, f_tx, f_content, f_name, f_time, arriving)
    assert got == want, f"{vid}: ER = {got}, want {want}"


def test_appendix_c15_april_first():
    # As C.7, but on 1 April: F_time is +inf, so ER saturates to 255
    # regardless of every other factor.
    f_time = eb.time_factor(APRIL_1)
    assert math.isinf(f_time)
    got = eb.evil_rating(0.5, eb.NET["ipv6"], eb.TX["tcp"], eb.content_factor("good"),
                          eb.name_factor("ec.example.eu"), f_time, 0)
    assert got == 255


def test_band_semantics():
    # Section 3.3
    assert eb.evil_rating(0.25, 0.75, 0.25, 0.5, 0.5, 1.0) >= 1  # never 0: Unrated is reserved


ELO_VECTORS = [
    # id, r_a, r_b, er_req, er_resp, want_new_a, want_new_b
    ("C.16", 1500, 1500, 157, 17, 1516, 1484),
    ("C.17", 1900, 1100, 157, 17, 1900.32, 1099.68),
    ("C.18", 1900, 1100, 17, 157, 1868.32, 1131.68),
    ("C.19", 1500, 1500, 55, 55, 1500, 1500),
]


@pytest.mark.parametrize("vid,r_a,r_b,er_req,er_resp,want_a,want_b",
                          ELO_VECTORS, ids=[v[0] for v in ELO_VECTORS])
def test_appendix_c_elo(vid, r_a, r_b, er_req, er_resp, want_a, want_b):
    new_a, new_b = eb.elo_update(r_a, r_b, er_req, er_resp, n_a=30, n_b=30)
    assert new_a == pytest.approx(want_a, abs=0.01), vid
    assert new_b == pytest.approx(want_b, abs=0.01), vid
