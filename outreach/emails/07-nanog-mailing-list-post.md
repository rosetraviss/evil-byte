**List:** NANOG (nanog@nanog.org) — *check current posting norms before
sending; this reads as an operator-culture piece, not a commercial or
off-topic post, but the list is for operators talking shop, so use judgment*
**Subject:** [OT, mostly] An April Fools' RFC that needs your particular kind of criticism

Folks,

Slight change of pace: I've written an April 1-style Internet-Draft,
[draft-traviss-evil-byte-00](https://evilbyte.net/draft.html), obsoleting
RFC 3514 (the evil bit) with an 8-bit "Evil Rating" computed by a
Morality-Inspecting Trusted Middleman on the path, feeding a central
Elo-rated authority for every ASN. Full writeup, reference implementations
in Python and Go, an nftables-based MITM, test vectors — [repo
here](https://github.com/rosetraviss/evil-byte).

I'm posting here specifically because two parts of this only work if actual
operators tell me they're wrong:

- **Section 5.1** requires "at least one MITM... on every path between any
  two hosts on the Internet." I'd like to know exactly how unworkable that
  requirement is from people who'd have to be the MITM.
- **Section 10.1**, the Flag Day, where enforcement goes mandatory the day
  after IPv6 deployment "completes" and every Unrated packet gets treated as
  maximally Evil. I want the deployment-incentive joke (Section 1.2,
  "Incentive") to land the way an operator would actually experience the
  incentive, not the way I imagine you would.

It's unsubmitted, -00, not asking anyone to sponsor anything — just want the
technical/operational satire to survive contact with people who'd actually
have to run this. Issues/PRs welcome on the repo; happy to take criticism
here too.

Rose Traviss
