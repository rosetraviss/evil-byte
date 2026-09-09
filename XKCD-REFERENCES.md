# xkcd References

A research catalogue of real [xkcd](https://xkcd.com) comics (Randall Munroe)
that are thematically relevant to `draft-traviss-evil-byte-00` and the wider
evil-byte repo. This is reference material for future integration — dropping
links into the README, the site, or repo meta files — not integration itself.
Nothing here has been wired into any other file yet.

## Methodology

Every entry below was checked directly against a primary source (xkcd.com
itself, cross-referenced with explainxkcd.com where useful) for its number,
title, and alt-text. None are reported from memory alone. Research was done
in three parallel passes — networking/protocols, security/surveillance, and
bureaucracy/rating-systems — each independently verified, followed by a
spot-check of 12 entries across all three passes against xkcd.com directly.
Comics that looked plausible but didn't hold up on verification were dropped;
see [Themes searched but not included](#themes-searched-but-not-included).

xkcd is still publishing (~3 new comics/week), so there may be more relevant
comics after this research was done (2026-09-09) than are listed here.
Numbers and URLs are permanent once a comic is published, so nothing below
will go stale — but a future pass could well find more.

## Quick picks

The 14 entries with the most specific, surgical fit to a particular
mechanism in the draft — start here if you just want a few good links.

| # | Title | URL | Pairs with | Why |
|---|---|---|---|---|
| 538 | Security | https://xkcd.com/538/ | §4.5.3, Voluntary Decryption Assistance | The "$5 wrench" is the honest version of what the draft calls "voluntary" key disclosure. |
| 927 | Standards | https://xkcd.com/927/ | Whole-document premise | "Obsoletes" one bad standard by bolting on a much bigger one — the draft does this on purpose. |
| 221 | Random Number | https://xkcd.com/221/ | §9, Avian Carriers | Alt-text invents a fake sub-RFC of RFC 1149 in exactly the deadpan register the draft uses for the real thing. |
| 949 | File Transfer | https://xkcd.com/949/ | §9, Avian Carriers | Physical transport beating the network stack — the joke the draft turns into a whole section. |
| 1425 | Tasks | https://xkcd.com/1425/ | §4.5.1, Analysis | The draft lists "machine learning" and "reading the payload aloud to a colleague" as interchangeable — this is the comic about why that's funny. |
| 1755 | Old Days | https://xkcd.com/1755/ | §5.3 / §11 | Title text is Ken Thompson's Trusting Trust — the exact hole in "self-assessment prohibited." |
| 1820 | Security Advice | https://xkcd.com/1820/ | §4.6, Nomenclature Factor | A meaningless badge of trustworthiness taken as authoritative — precisely what "doth protest too much" is about. |
| 2329 | Universal Rating Scale | https://xkcd.com/2329/ | §3.3, Value Semantics | Collapsing every incompatible notion of quality onto one axis is the Evil Rating's whole premise. |
| 2347 | Dependency | https://xkcd.com/2347/ | §6.7, Centralisation | The canonical "one person's unpaid labor holds up the internet" comic, here made into a formal single point of failure. |
| 2899 | Goodhart's Law | https://xkcd.com/2899/ | §6.3.4, The Evil Spiral | A metric that stops meaning anything the moment it has real teeth — the Evil Spiral's civilian cousin. |
| 3254 | Detector | https://xkcd.com/3254/ | §4.5.2, Presumption of Evil | A detector defined so broadly it can never register a negative — "the absence of analysis is not the absence of Evil," illustrated. |
| 1269 | Privacy Opinions | https://xkcd.com/1269/ | §1.3, Relationship to Other Work | The post-Snowden discourse the draft is needling when it cites CSAR and the Online Safety Act by name. |
| 1361 | Google Announcement | https://xkcd.com/1361/ | §6.5, Distribution and Caching of Multipliers | Google's real `dns.google` TXT record points at this comic — genuine precedent for stashing a joke payload in a production DNS TXT record, which is exactly what `<asn>.as.evil.arpa` does. |
| 343 | 1337: Part 3 | https://xkcd.com/343/ | §11, Security Considerations | Title text: trusting an NSA employee's denial because he denied lying about it. Circular, self-attested trust — the draft's own admitted gap. |

## Full catalogue, by theme

Grouped roughly in the order the draft raises each idea.

### 1. IPv4/IPv6 and the incentive to move on (§4.3, Network Protocol Factor)

The draft gives IPv6 a rate discount (F_net = 0.75) as "the Working Group's
only carrot," and needles IPv4 for having "run out in 2011 and remains in
universal use."

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 195 | Map of the Internet | https://xkcd.com/195/ | A 2006 fractal map of the whole IPv4 space; alt-text: "For the IPv6 map just imagine the XP default desktop picture." |
| 742 | Campfire | https://xkcd.com/742/ | A ghost story where the horror, a century on, is that the killer "is still on IPv4." |
| 865 | Nanobots | https://xkcd.com/865/ | A nanobot apocalypse stalls at 40% of Earth because the nanobots exhaust their IPv6 block. |

### 2. Obsoleting a standard by adding a bigger one (§1, whole-document premise)

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 927 | Standards | https://xkcd.com/927/ | 14 competing standards → "let's make one universal standard" → 15 competing standards. |
| 1254 | Preferred Chat System | https://xkcd.com/1254/ | Chat-platform fragmentation (GChat, IRC, Skype, email) resolved only when an owl delivers a handwritten note. |

### 3. Avian carriers and physical transport beating the network (§9, Avian Carriers)

The draft's Section 9 gives RFC 1149/6214 a full treatment: a falconer as
MITM, a paper scroll, duct tape, and a measured 55% packet loss rate.

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 221 | Random Number | https://xkcd.com/221/ | "RFC 1149.5 specifies 4 as the standard IEEE-vetted random number" — a fake sub-RFC of the real avian-carrier RFC. |
| 949 | File Transfer | https://xkcd.com/949/ | Someone proposes FTP or Dropbox for a 25MB file; the recipient just drives over with a USB stick. |

(1254, above, doubles as an avian-carrier joke — a literal owl outperforms the entire chat stack.)

### 4. DPI, encryption, and "Voluntary" Decryption Assistance (§4.5, Appendix D)

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 538 | Security | https://xkcd.com/538/ | Crypto nerd imagines a brute-force cluster; reality is a $5 wrench. |
| 1998 | GDPR | https://xkcd.com/1998/ | A fake consent notice binds you "by clicking anywhere, scrolling, or closing this notification" — compliance theater that isn't real consent. |
| 2691 | Encryption | https://xkcd.com/2691/ | A "secure" app just bans anyone actually named Eve from installing it. |
| 936 | Password Strength | https://xkcd.com/936/ | What looks rigorous (complexity rules) isn't what actually resists attack. |

### 5. Content analysis: ML, vibes, and "analysis is OPTIONAL" (§4.5.1)

The draft allows "signature matching, heuristics, statistical classification,
machine learning, or reading the payload aloud to a colleague and watching
their face" as equally valid methods.

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 1425 | Tasks | https://xkcd.com/1425/ | Checking if a photo is from a national park: a quick lookup. Checking if it's a photo of a bird: "a research team and five years." |
| 1838 | Machine Learning | https://xkcd.com/1838/ | "You pour the data into this big pile of linear algebra… stir the pile until they start looking right." |
| 2173 | Trained a Neural Net | https://xkcd.com/2173/ | "I trained a neural net" applies equally well to onboarding two new coworkers to answer support tickets. |
| 3254 | Detector | https://xkcd.com/3254/ | A detector sensitive to gas, dust, light, fields, "or states" has been stuck on "Detected" since power-on. |

### 6. The real-world legislation this is needling (§1.3, Relationship to Other Work)

The draft cites the EU's CSAR proposal ("chat control") and the UK Online
Safety Act 2023 by name, and says it differs from them "chiefly in candour."

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 1269 | Privacy Opinions | https://xkcd.com/1269/ | Six caricatured reactions to mass-surveillance revelations, none of them a reasonable middle ground. |

### 7. Self-assessment, trust chains, and an unverifiable middleman (§5.3, §11)

The draft prohibits a host from rating its own traffic ("if it could, RFC
3514 would have worked") — but never says how anyone verifies the MITM
itself.

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 327 | Exploits of a Mom | https://xkcd.com/327/ | A student named `Robert'); DROP TABLE Students;--` wipes a database that trusted unsanitized input. |
| 341 | 1337: Part 1 | https://xkcd.com/341/ | An open-WiFi admin intercepts and edits a stranger's traffic live, while baking cookies. |
| 343 | 1337: Part 3 | https://xkcd.com/343/ | Title text: "I know I can trust him, because I asked if he was lying to me and he said no." |
| 364 | Responsible Behavior | https://xkcd.com/364/ | A key-signing party attendee signs a stranger's PGP key without verifying identity, breaking the web of trust. |
| 978 | Citogenesis | https://xkcd.com/978/ | A fabricated claim gets cited back to itself in a closed loop, manufacturing "verified" fact from nothing. |
| 1755 | Old Days | https://xkcd.com/1755/ | Title text invokes Ken Thompson's Trusting Trust — an undetectable, self-propagating compiler backdoor. |

### 8. Nomenclature: names that protest too much (§4.6, Nomenclature Factor)

The draft rates any name containing "secure," "trust," "safe," or "legit"
at 1.5× or worse, "on the principle that it doth protest too much."

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 1820 | Security Advice | https://xkcd.com/1820/ | "Never give your password to anyone who doesn't have a blue check mark next to their name." |
| 2634 | Red Line Through HTTPS | https://xkcd.com/2634/ | A broken-certificate warning gets rationalized as a vote of confidence rather than a red flag. |

### 9. The Evil Rating Authority: Elo, centralization, and conservation (§6)

The ERA is a single global authority running literal chess Elo per
Autonomous System, with a self-declared "Conservation of Evil" and a
runaway positive-feedback "Evil Spiral."

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 1224 | Council of 300 | https://xkcd.com/1224/ | A secret, unaccountable council votes behind closed doors on what "goes viral." |
| 1361 | Google Announcement | https://xkcd.com/1361/ | Google "shuts down" everything to focus on 8.8.8.8 — and `dns.google`'s real TXT record links to this comic. |
| 1392 | Dominant Players | https://xkcd.com/1392/ | Charts chess Elo (the literal system the ERA reuses) across a closed, historically contingent player pool. |
| 2329 | Universal Rating Scale | https://xkcd.com/2329/ | Grades, star ratings, hurricane categories, and credit scores mashed onto one 45-step axis. |
| 2347 | Dependency | https://xkcd.com/2347/ | All modern digital infrastructure balanced on one thanklessly-maintained project. |
| 2899 | Goodhart's Law | https://xkcd.com/2899/ | A metric for catching bad metrics immediately becomes a target, and breaks the same way. |
| 3110 | Global Ranking | https://xkcd.com/3110/ | Ranked 7,145,000th at chess — "worse than anyone was at anything," because no historical pool was ever that large. |
| 1098 | Star Ratings | https://xkcd.com/1098/ | In practice 5 stars means "one review" and anything under 4 reads as "crap" — the number doesn't mean what it claims. |

### 10. General absurdist over-engineering (repo-wide spirit)

The draft is a fully-specified, dual-implemented, Elo-rated protocol
extension built to formalize a 2003 joke — this is the closest xkcd gets to
that specific energy.

| # | Title | URL | Alt-text / gist |
|---|---|---|---|
| 908 | The Cloud | https://xkcd.com/908/ | "The cloud" turns out to be one guy's server tower on a cable modem. |
| 1205 | Is It Worth the Time? | https://xkcd.com/1205/ | A chart for how many hours you may spend optimizing a task before the optimization costs more than it saves. |
| 1319 | Automation | https://xkcd.com/1319/ | Automating a routine task in theory: five minutes. In reality: endless ongoing development. |
| 2259 | Networking Problems | https://xkcd.com/2259/ | Bizarre, unfixable latency that alternates by packet parity — networking as barely-understood magic. |

## Themes searched but not included

Recorded so a future pass doesn't repeat the same dead ends. Each of these
was searched from multiple angles across the three research passes without
turning up a comic that verified as a solid, specific match (as opposed to
a stretch):

- **HTTP status codes as jokes** (relevant to the draft's new 666 status and
  its 418 teapot fallback) — no comic built around a status-code punchline
  held up under verification.
- **BGP / Autonomous System / routing-table absurdity specifically.**
- **QUIC specifically** (covered instead, at one remove, by 927 "Standards").
- **Encryption-backdoor mandates specifically** (as opposed to the adjacent
  coercion angle covered by 538, and the trust-chain angle covered by 1755).
- **Permanent blacklisting by an opaque automated system with no appeal**
  (the closest are 1098 and 2329, on ratings meaning less than they claim).
- **Runaway feedback loops as a dedicated standalone topic** (2899 Goodhart's
  Law is the closest cousin, on the mechanism rather than the runaway effect
  itself).
- **Conservation-law jokes applied to a social/abstract quantity** (nothing
  verified; the Elo entries in §9 above are adjacent, since Elo is genuinely
  zero-sum).

## Suggested integration points

This file doesn't change anything elsewhere in the repo — that's a separate
step. Some notes for whoever does that step:

**Keep the draft itself xkcd-free.** `draft-traviss-evil-byte-00.md` works
because it's "written entirely straight-faced, in the tradition of April 1
RFCs" (README.md) and cites only real RFCs and real legislation — even its
one aside in the Acknowledgements ("No pigeons were harmed... One was
rated.") stays inside RFC-register prose. A webcomic citation in the body
or the References section would break that illusion for no real gain. If
anything ever goes in the draft itself, the Acknowledgements section is the
only place with any precedent for a wink, and even there, restraint serves
the joke better than a citation would.

The site and repo-meta files already have a lower, more winking register,
and are a better fit:

- **`site/public/rfc-process.html`**, "Further reading" — already links to
  the real RFC 3514 and the Wikipedia article on April Fools' RFCs; 927 or
  1755 would sit naturally alongside them.
- **`site/public/humans.txt`** — the `/* THANKS */` block already credits
  Bellovin and Claude by name; a one-line xkcd credit (927, on standards
  proliferation, is the most on-the-nose) would fit the existing tone.
- **A new `site/public/xkcd.txt`** in the same spirit as the existing
  `humans.txt` / `ai.txt` / `clankers.txt` easter eggs, if a dedicated list
  is wanted rather than a single line somewhere else.
- **`README.md`**, Acknowledgements — short and dry, matching the existing
  "the many policymakers whose proposals made this document's central joke
  look reasonable by comparison" line.
- **`CONTRIBUTING.md`**, the "Voice" section — not as a link so much as a
  calibration reference: 927 and 2347 are close to the tonal target it
  already describes ("dry, bureaucratic, treats absurd conclusions with
  complete institutional seriousness").

Whichever of these get used, pick a handful rather than all 36 — the Quick
picks table above is meant to make that easy.
