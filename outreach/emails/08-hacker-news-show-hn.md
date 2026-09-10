**Where:** Hacker News — post as "Show HN" (submit at
news.ycombinator.com/submit; check the [Show HN
guidelines](https://news.ycombinator.com/showhn.html) before posting)
**Title:** Show HN: The Evil Byte – an 8-bit successor to RFC 3514's "evil bit"
**URL:** https://evilbyte.net/draft.html

**Text (optional, for the first comment):**

RFC 3514 (2003) added a 1-bit "evil bit" to the IP header, to be set
honestly by attackers. Nobody ever did. This is a straight-faced
Internet-Draft that obsoletes it: an 8-bit Evil Rating computed not by the
sender but by a middlebox on the path, from a weighted-product formula over
the sender's AS, protocol choices, content, hostname, and time of day —
feeding a central Elo-rated leaderboard of Autonomous Systems, an actual
HTTP 666 status code, and (per RFC 1149) carriage over avian carriers.

It's written entirely in the April 1 RFC tradition — dry, deadpan, "the
Working Group decided X" — but the formula, the reference implementations
(Python + Go, interoperable), and the nftables-based MITM are all real and
tested against the same vectors:
[github.com/rosetraviss/evil-byte](https://github.com/rosetraviss/evil-byte).
Interactive calculator for the formula:
[evilbyte.net/calculator.html](https://evilbyte.net/calculator.html).

It's version -00 and not yet submitted to the IETF — mainly looking for
people to poke holes in it (formula, IANA registrations, or just where it
stops being funny) before that happens.

*(Note before posting: HN is unpredictable about project-show posts with a
strong satire angle — some land very well, others get read too literally in
the comments. Worth deciding if that's a risk you want to take before
submitting; nothing about the repo/site requires it.)*
