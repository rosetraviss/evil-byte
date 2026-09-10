**To:** [Name]
**Subject:** A favor: sanity-check the header placement in a joke RFC

Hi [Name],

*(swap in whoever you'd actually ask — someone who won't blink at "DSCP" or "NFQUEUE")*

I've written an April Fools'-style Internet-Draft —
[draft-traviss-evil-byte-00](https://evilbyte.net/draft.html), obsoleting
[RFC 3514](https://www.rfc-editor.org/rfc/rfc3514) (the "evil bit") with a
full eight-bit Evil Rating computed by a MITM on the path. It's meant to
read completely straight-faced, in the RFC 1149 / 3514 tradition, but the
engineering underneath actually has to hold up — that's the part I can't
self-review reliably.

Would you give it a read with your networking hat on? Specifically:

- **Section 3** — reusing the old ToS/DSCP octet in IPv4 and bits 4–11 of
  IPv6's Traffic Class. Does the placement, and the "it's been redefined
  four times already so it's reserved by exhaustion" justification, actually
  track?
- **Sections 3.4 and 4.3–4.4** — the DSCP/ECN legacy-interpretation table
  and the network/transport factor tables. Anything glaringly wrong to
  someone who's actually debugged QoS or ECN in production?
- **Appendix B** — the nftables config and the NFQUEUE-based MITM. I'd
  rather hear "this wouldn't actually run" from you than from a reviewer
  later.

No rush — it's version -00 and not submitted anywhere yet. The [interactive
calculator](https://evilbyte.net/calculator.html) is the fastest way to poke
at the formula (Section 4) if you'd rather play than read. Repo's at
[github.com/rosetraviss/evil-byte](https://github.com/rosetraviss/evil-byte)
if you want to file issues directly.

Thanks for this — genuinely,
Rose
