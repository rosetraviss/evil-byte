**To:** [Name]
**Subject:** Does the surveillance satire in this draft actually land?

Hi [Name],

I've been working on an April Fools'-style Internet-Draft,
[draft-traviss-evil-byte-00](https://evilbyte.net/draft.html) — it obsoletes
the old "evil bit" (RFC 3514) with an eight-bit rating computed by a trusted
middlebox from, among other things, packet content. You'll clock what that's
a satire of almost immediately.

**Section 4.5** is the section I most want your eyes on — the Content
Factor, the "Presumption of Evil" applied to anything the middlebox can't
read, and Voluntary Decryption Assistance (§4.5.3), which is exactly the
client-side-scanning/key-escrow argument from current CSAR/Online-Safety-Act-
style proposals, just made explicit and applied to every packet instead of
every message. I want it to read as recognizable to someone who deals with
real DPI, real "trusted" middleboxes, and real client-side-scanning debates
— not just as networking humor to people outside that world.

Also worth a look if you have time:
- **Section 11** (Security Considerations) — whether the "self-correcting in
  the limit, if the limit exists" hand-wave for dishonest MITMs is the right
  kind of absurd
- **Appendix D** — the `evil_key_share` TLS extension, sending session keys
  in cleartext "for efficiency"

It's unsubmitted and not going anywhere near IETF for a while yet — this is
purely "does the satire hit, and is it technically fair to the thing it's
satirizing." [Calculator here](https://evilbyte.net/calculator.html) if you
want to see the formula behave. Repo:
[github.com/rosetraviss/evil-byte](https://github.com/rosetraviss/evil-byte).

Thanks — I trust your read on this more than most.
Rose
