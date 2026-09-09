"""Reference implementation of draft-traviss-evil-byte-00.

Computes the Evil Rating (ER) carried in the Evil Byte (Section 4) and
the Elo update applied by the Evil Rating Authority (Section 6).
Pure Python 3, no dependencies.  This code is Good (self-assessed;
see Section 5.3).
"""
import math
from datetime import datetime

BASE_EVIL = 16.0            # B: no packet is entirely innocent (Section 4.1)

# Section 4.1, Table: weights
W = {"as": 1.0, "net": 0.5, "tx": 0.25, "content": 1.5,
     "name": 0.75, "time": 0.25}

# Section 4.3: network protocol factor
NET = {"ipv4": 1.5, "ipv4-cgnat": 1.75, "ipv6": 0.75,
       "ipv6-transition": 1.25, "ipv6-hbh": 2.0}

# Section 4.4: transport factor
TX = {"tcp": 1.0, "udp": 1.1, "quic": 1.25, "sctp": 0.8,
      "icmp-echo": 0.5, "icmp-redirect": 4.0, "tunnel": 1.5,
      "avian": 0.25, "other": 2.0}

# Section 4.5: content factor
CONTENT = {"good": 0.5, "uncertain": 1.5, "evil": 4.0,
           "unanalysed": 2.0, "encrypted": 4.0}
COOPERATION_DISCOUNT = 0.9  # Section 4.5.3

# Section 4.6: nomenclature factor, keyed by top-level label
NAME = {"mil": 4.0, "gov": 2.0, "zip": 2.0, "ai": 1.5, "biz": 1.5,
        "io": 1.25, "com": 1.0, "net": 1.0, "edu": 0.9, "org": 0.8,
        "int": 0.75, "eu": 0.5, "local": 0.5}
NO_NAME = 1.25
PROTEST = ("secure", "trust", "safe", "legit")   # doth protest too much


def name_factor(name):
    """Section 4.6.  `name` is the PTR name, Host, or SNI; None if absent."""
    if not name:
        return NO_NAME
    labels = name.lower().rstrip(".").split(".")
    if labels[-2:] == ["home", "arpa"]:
        f = NAME["local"]                  # it is your printer
    else:
        f = NAME.get(labels[-1], 1.0)      # ccTLDs and unlisted gTLDs: 1.0
    if any(word in name.lower() for word in PROTEST):
        f = max(f, 1.5)
    return f


def time_factor(when, dst=False):
    """Section 4.7.  `when` is a naive datetime in the source's local time."""
    if when.month == 4 and when.day == 1:
        return math.inf                          # all packets are Evil
    if 2 <= when.hour < 5:
        f = 1.5
    elif when.weekday() == 4 and when.hour >= 16:  # Friday afternoon
        f = 1.25
    else:
        f = 1.0
    return f + (0.1 if dst else 0.0)


def content_factor(result, vda=False):
    """Section 4.5.  `result` is a key of CONTENT.  With VDA, `result` is
    the cleartext result and the Cooperation Discount applies."""
    return CONTENT[result] * (COOPERATION_DISCOUNT if vda else 1.0)


def evil_rating(f_as, f_net, f_tx, f_content, f_name, f_time, arriving=0):
    """Section 4.1.  Returns the ER to write into the octet.
    `arriving` is the value found in the octet on arrival (Section 5.4)."""
    f_tamper = 1.0 if arriving == 0 else 1.5          # Section 4.8
    x = BASE_EVIL * f_tamper
    for key, f in (("as", f_as), ("net", f_net), ("tx", f_tx),
                   ("content", f_content), ("name", f_name),
                   ("time", f_time)):
        x *= f ** W[key]
    if math.isinf(x):
        er = 255                                     # 1 April
    else:
        er = int(math.floor(x + 0.5))                # round half towards Evil
        er = max(1, min(255, er))
    return max(er, arriving)                         # Evil is monotonic


# ---- Section 6: the Evil Rating Authority --------------------------------

def as_multiplier(rating):
    """Section 6.1: F_AS from an ERA rating."""
    return max(0.25, min(4.0, 2.0 ** ((rating - 1500.0) / 400.0)))


def k_factor(rating, exchanges):
    """Section 6.3.1."""
    if exchanges < 30:
        return 64          # provisional
    if rating >= 2400:
        return 16          # Grandmaster of Evil
    return 32


def expected_score(r_a, r_b):
    """Section 6.3."""
    return 1.0 / (1.0 + 10.0 ** ((r_b - r_a) / 400.0))


def elo_update(r_a, r_b, er_req, er_resp, n_a=30, n_b=30):
    """Sections 6.2 and 6.3.  a is the client's AS, b the server's.
    The more Evil party wins.  Returns the two new ratings."""
    s_a = 1.0 if er_req > er_resp else (0.5 if er_req == er_resp else 0.0)
    e_a = expected_score(r_a, r_b)
    k = min(k_factor(r_a, n_a), k_factor(r_b, n_b))   # Section 6.3.1
    return (r_a + k * (s_a - e_a),
            r_b + k * ((1.0 - s_a) - (1.0 - e_a)))
