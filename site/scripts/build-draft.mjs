// Renders ../../draft-traviss-evil-byte-00.md into public/draft.html.
// Run via `npm run build:draft` whenever the source draft changes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";

const ROOT = join(import.meta.dirname, "..", "..");
const SITE = join(import.meta.dirname, "..");
const SRC_MD = join(ROOT, "draft-traviss-evil-byte-00.md");
const OUT_HTML = join(SITE, "public", "draft.html");

const raw = readFileSync(SRC_MD, "utf8");

// The document opens with one fenced block — the RFC boilerplate header
// (working group, author, dates). Pull it out to render as its own panel;
// everything else (including every *other* fenced block) goes to marked.
const firstFence = raw.indexOf("```");
const secondFence = raw.indexOf("```", firstFence + 3);
const docHeader = raw.slice(firstFence + 3, secondFence).replace(/^\n/, "").replace(/\n$/, "");
let body = raw.slice(secondFence + 3).replace(/^\n+/, "");

// Drop the document's own hand-written "## Table of Contents" section — the
// generated sidebar (below) replaces it, and two tables of contents is one too many.
{
  const tocStart = body.indexOf("## Table of Contents");
  if (tocStart !== -1) {
    const nextH2 = body.indexOf("\n## ", tocStart);
    if (nextH2 !== -1) body = body.slice(0, tocStart) + body.slice(nextH2 + 1);
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const seenSlugs = new Map();
function uniqueSlug(text) {
  const base = slugify(text);
  const n = seenSlugs.get(base) || 0;
  seenSlugs.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

const toc = []; // { depth, id, text }

const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = tokens.map((t) => ("text" in t ? t.text : "")).join("");
      const id = uniqueSlug(plain || text.replace(/<[^>]+>/g, ""));
      if (depth === 2 || depth === 3) toc.push({ depth, id, text: plain });
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  },
});

const contentHtml = marked.parse(body);

function renderToc(items) {
  let html = "";
  let open = 0;
  for (const item of items) {
    if (item.depth === 2) {
      if (open) {
        html += "</ul></li>";
        open = 0;
      }
      html += `<li><a href="#${item.id}">${escapeHtml(item.text)}</a>`;
    } else {
      if (!open) {
        html += "<ul>";
        open = 1;
      }
      html += `<li><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`;
    }
  }
  if (open) html += "</ul></li>";
  return html;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const page = `<meta charset="utf-8">
<title>The Draft — draft-traviss-evil-byte-00</title>
<meta name="description" content="The full text of draft-traviss-evil-byte-00, The Evil Byte: A Security Octet for the IPv4 and IPv6 Headers.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">

<nav class="site-nav" id="top">
  <div class="wrap">
    <a class="brand" href="/"><span class="byte">EE</span> evilbyte</a>
    <button class="nav-toggle" aria-expanded="false" aria-label="Toggle navigation">menu</button>
    <div class="nav-links">
      <a href="/draft.html" class="current">The Draft</a>
      <a href="/calculator.html">Formula</a>
      <a href="/rfc-process.html">Becoming an RFC</a>
    </div>
  </div>
</nav>

<div class="wrap wrap--wide draft-layout">
  <nav class="draft-toc" aria-label="Table of contents">
    <p class="toc-title">Contents</p>
    <ul>${renderToc(toc)}</ul>
  </nav>
  <article class="draft-content">
    <div class="doc-header">${escapeHtml(docHeader)}</div>
    <div style="height:28px"></div>
    ${contentHtml}
  </article>
</div>

<a class="back-to-top" href="#top">↑ top</a>

<footer class="site-footer">
  <div class="wrap">
    <div>draft-traviss-evil-byte-00 · Rose Traviss · Data Torturing Solutions Ltd · Bristol, UK · © <span data-year></span></div>
    <div class="foot-links">
      <a href="/">Home</a>
      <a href="/calculator.html">Formula</a>
      <a href="/rfc-process.html">Roadmap</a>
    </div>
  </div>
</footer>

<script type="module" src="/site.js"></script>
<script type="module" src="/draft.js"></script>
`;

writeFileSync(OUT_HTML, page);
console.log(`Wrote ${OUT_HTML} (${toc.length} TOC entries, ${(contentHtml.length / 1024).toFixed(0)} KB of content)`);
