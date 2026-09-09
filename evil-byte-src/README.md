# evilbyte

Reference implementation of [`draft-traviss-evil-byte-00`](https://evilbyte.net/draft.html),
*The Evil Byte: A Security Octet for the IPv4 and IPv6 Headers*, which obsoletes
[RFC 3514](https://www.rfc-editor.org/rfc/rfc3514) (the "evil bit").

Pure Python, no required dependencies.

```bash
pip install evilbyte
```

```python
>>> import evilbyte
>>> evilbyte.evil_rating(f_as=1.0, f_net=1.5, f_tx=1.0,
...                       f_content=evilbyte.content_factor("unanalysed"),
...                       f_name=evilbyte.name_factor("www.example.com"),
...                       f_time=1.0)
55
```

## What's here

- `evilbyte` — the Section 4 formula and Section 6 Elo update (Appendix A).
- `evilbyte.mitm` — a minimal NFQUEUE-based MITM for Linux (Appendix B.2). Needs
  the `mitm` extra: `pip install evilbyte[mitm]`. Run with `python -m evilbyte.mitm`.
- `evilbyte-server` / `evilbyte-client` — a demo HTTP server and client
  implementing Section 7 (Server Behaviour) and Section 8 (Client Behaviour),
  installed as console scripts. They interoperate with the equivalent tools
  in [`evil-byte-go`](../evil-byte-go) — either language can play either role.

## The rest of the project

- The draft itself, and the site: [evilbyte.net](https://evilbyte.net)
- A Go implementation of the same formula, MITM, and server/client:
  [`evil-byte-go`](../evil-byte-go)

Licensed under the Revised BSD License, per the Trust Legal Provisions this
document's Code Components are released under.
