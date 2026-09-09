"""evilbyte: reference implementation of draft-traviss-evil-byte-00.

The Evil Rating formula (Section 4) and Elo update (Section 6), unchanged
from Appendix A. See https://evilbyte.net for the draft itself.
"""
from .evilbyte import (  # noqa: F401
    BASE_EVIL,
    COOPERATION_DISCOUNT,
    CONTENT,
    NAME,
    NET,
    NO_NAME,
    PROTEST,
    TX,
    W,
    as_multiplier,
    content_factor,
    elo_update,
    evil_rating,
    expected_score,
    k_factor,
    name_factor,
    time_factor,
)

try:
    from ._version import version as __version__
except ImportError:  # pragma: no cover - not installed / not built
    __version__ = "0+unknown"
