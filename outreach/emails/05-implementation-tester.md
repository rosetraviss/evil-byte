**To:** [Name]
**Subject:** Want to run a joke MITM on your actual network?

Hi [Name],

Following up on [the Evil Byte draft](https://evilbyte.net/draft.html) I
mentioned — I've got working Python and Go reference implementations
(interoperable with each other, [repo
here](https://github.com/rosetraviss/evil-byte)), and Appendix A/B walk
through running a real NFQUEUE-based MITM plus an nftables config to
actually mark traffic with an Evil Rating.

Right now Section 10.4, "Operational Experience," has exactly one data
point: my own home network, where "everything was Evil, nothing worked, and
the printer was the most trusted device." I'd like a second data point from
a different network before I trust that the reference implementation
generalizes at all.

Would you be up for running it against something real — a home lab, a test
VLAN, anything that isn't production? Rough ask:

```bash
cd evil-byte-src && pip install -e ".[dev]" && pytest   # confirm it passes here first
# then Appendix B's nftables + MITM against real traffic
```

or the Go side (`evil-byte-go/`) if that's more your thing — the two are
cross-checked against each other and against Appendix C's test vectors, so
either tells me something.

I mainly want to know: did it behave the way Section 4 says it should, did
anything about the formula produce a silly result on real traffic before a
reviewer found it first, and did anything just crash. Whatever you find —
even "nothing broke, that was boring" — is useful, and goes in Section 10.4
with credit if you're up for it.

No timeline pressure — it's -00 and unsubmitted.

Rose
