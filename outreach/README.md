# Feedback outreach — draft-traviss-evil-byte-00

Status per [the roadmap](https://evilbyte.net/rfc-process.html): version -00, not
yet submitted to the IETF. The current stage is "Public read-through" — the
site's own words are "a joke RFC that nobody has read is just a Markdown file
with delusions." Everything below is aimed at that stage: getting real readers
on the draft before it goes anywhere near the Datatracker.

## Who to reach out to, and why

Two kinds of feedback matter here, because the draft has to work on two axes
at once: it has to be *technically plausible* (headers, DSCP/ECN, TLS, HTTP
status codes, Elo math) and it has to be *funny* (voice, pacing, the "Working
Group" bit). A reviewer who's only good at one axis will miss half of what
can go wrong. The list below mixes both, plus a couple of public venues for
the "point people at it" advice the roadmap page itself gives.

| # | Recipient | Type | Why them | Focus sections | File |
|---|---|---|---|---|---|
| 1 | A networking-literate friend/colleague | Individual | Catches header/DSCP/ECN/nftables errors a non-networker won't see | §3, §4.3–4.4, Appendix B | [`01-network-protocol-friend.md`](emails/01-network-protocol-friend.md) |
| 2 | A security/DPI-adjacent colleague | Individual | The content-inspection satire (§4.5, VDA, Detection Orders) is the sharpest section and the easiest to get technically wrong | §4.5, §11, Appendix D | [`02-security-dpi-colleague.md`](emails/02-security-dpi-colleague.md) |
| 3 | An April Fools'-RFC / IETF-humor peer | Individual | Calibrates against the actual genre (RFC 1149, 2549, 2324, 3514) rather than humor in the abstract | Whole document, voice/pacing | [`03-april-fools-rfc-enthusiast.md`](emails/03-april-fools-rfc-enthusiast.md) |
| 4 | A sharp friend with no networking background | Individual | Tests whether the joke lands without the protocol knowledge needed to get the technical jokes | Abstract, §1, §9, worked examples | [`04-lay-reader-humor-check.md`](emails/04-lay-reader-humor-check.md) |
| 5 | A friend/colleague willing to run the reference implementation | Individual | §10.4 ("Operational Experience") currently has one data point — the author's own home network | Appendix A, Appendix B | [`05-implementation-tester.md`](emails/05-implementation-tester.md) |
| 6 | Steven Bellovin | Named individual, optional | Named in the Acknowledgements as the author of the bit this document obsoletes; a courtesy heads-up, not a request | Whole document (light touch) | [`06-steven-bellovin.md`](emails/06-steven-bellovin.md) |
| 7 | NANOG mailing list | Public list | Operators are best placed to enjoy — and roast — §5's "MITM on every path" requirement and §10's Flag Day | §5, §10 | [`07-nanog-mailing-list-post.md`](emails/07-nanog-mailing-list-post.md) |
| 8 | Hacker News (Show HN) | Public forum | Broad technical audience, low friction, matches the roadmap's own "point people at it" advice | Whole site | [`08-hacker-news-show-hn.md`](emails/08-hacker-news-show-hn.md) |

## Before you send anything

- Every `[bracketed]` placeholder needs filling in — names, your own contact
  details, and the couple of context lines that assume a relationship with
  the recipient.
- **#6 is the one to think about before sending.** It's addressed to a
  specific, identifiable real person who didn't ask to be written about. The
  tone is meant to be a low-key courtesy note, not a request for anything —
  but decide deliberately whether you want to send it, and find current
  contact info yourself rather than trusting anything guessed here (none is
  filled in).
- #7 and #8 are posts to public venues, not 1:1 email — check each
  community's current posting norms before posting (NANOG is operators
  talking shop; Hacker News has explicit [Show HN
  guidelines](https://news.ycombinator.com/showhn.html)).
- This has been pushed to the `claude/feedback-outreach-emails-paz96i` branch
  only. No pull request has been opened and nothing has touched `main` or the
  live site — it stays branch-only unless you ask for more. Note that the
  GitHub repo is public, so a pushed branch is technically browsable by
  anyone who goes looking, even without a PR.
