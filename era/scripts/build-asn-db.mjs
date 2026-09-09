// Builds era/public/data/asn.json — an initial Evil rating for every
// allocated Autonomous System, per Section 4.2 and Section 6.1.
//
// Section 4.2 seeds a handful of ASNs by hand ("the Working Group settled
// without discussion"). This does the same thing at the scale of the
// actual Internet: RIPE NCC publishes a name for every ASN globally (not
// just its own region) at the URL below, refreshed daily. Everything not
// covered by Section 4.2's exact exceptions gets the 1500 default, then
// the same kind of pattern-based adjustment Section 4.6 already applies
// to hostnames ("a name containing 'secure'... doth protest too much"),
// applied here to the organisation name instead.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const SRC_URL = "https://ftp.ripe.net/ripe/asnames/asn.txt";
const OUT = join(import.meta.dirname, "..", "public", "data", "asn.json");

// Section 4.2's own exceptions, carried forward exactly as the draft
// states them — not pattern rules, and not something this script invents.
const EXACT = {
  32934: { rating: 1900, reasons: ["AS32934 (Meta Platforms) — rated by acclamation, Section 4.2"] },
  721: { rating: 2300, reasons: ["AS721 (DoD Network Information Center) — this is not a value judgement; it is a byte"] },
  0: { rating: 2300, reasons: ["AS0 — an AS that does not exist and appears in routing tables is definitionally suspicious"] },
  23456: { rating: 1734, reasons: ["AS23456 (AS_TRANS) — neither one thing nor the other"] },
};

// AS64496-AS64511: reserved for documentation use (Section 4.2, RFC 5398),
// so they will never appear in RIPE's live registry either -- seeded here
// for the same reason AS0 and AS23456 are, below.
for (let asn = 64496; asn <= 64511; asn++) {
  EXACT[asn] = {
    rating: 1500,
    reasons: ["AS64496–AS64511 (documentation, RFC 5398) — fictional, and therefore incapable of Evil, which is more than can be said for the rest of this table."],
  };
}

const EU_MEMBER_STATES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
]);

const CHARITY_PATTERNS = [
  /\bFOUNDATION\b/i, /\bCHARIT/i, /\bNON.?PROFIT\b/i, /\bNGO\b/i,
  /RED\s?CROSS/i, /\bUNICEF\b/i, /\bUNHCR\b/i, /WIKIMEDIA/i,
  /\bHUMANITARIAN\b/i, /\bRELIEF\b/i, /\bFOOD\s?BANK\b/i, /\bFOR\s?GOOD\b/i,
];
const PROTEST_PATTERNS = [/\bSECURE\b/i, /\bTRUST(ED|WORTHY)?\b/i, /\bSAFE\b/i, /\bLEGIT/i];

function scoreEntry(asn, name, country) {
  if (EXACT[asn]) return EXACT[asn];

  if (country === "EU" || EU_MEMBER_STATES.has(country)) {
    return {
      rating: 1100,
      reasons: [`EU-registered (${country}) — the Union has advised the Working Group that it is Good`],
    };
  }

  let rating = 1500;
  const reasons = [];

  if (country === "BT") {
    rating -= 300;
    reasons.push("registered in Bhutan (−300) — Gross National Happiness outranks Gross National Product");
  }
  if (CHARITY_PATTERNS.some((re) => re.test(name))) {
    rating -= 250;
    reasons.push("charitable or nonprofit signal in the name (−250)");
  }
  if (/\bLLC\b/i.test(name)) {
    rating += 200;
    reasons.push("contains LLC (+200) — due to capitalism");
  }
  if (/\bAI\b/i.test(name)) {
    rating += 250;
    reasons.push('contains "AI" (+250) — see Section 4.6 on the .ai TLD');
  }
  if (PROTEST_PATTERNS.some((re) => re.test(name))) {
    rating += 150;
    reasons.push("doth protest too much (+150) — Section 4.6");
  }

  rating = Math.max(100, Math.min(3000, rating));
  return { rating, reasons };
}

console.log(`Fetching ${SRC_URL} ...`);
const raw = await (await fetch(SRC_URL)).text();
const lines = raw.split("\n").filter(Boolean);
console.log(`${lines.length} lines`);

const db = {};
let matched = 0;
for (const line of lines) {
  const m = /^(\d+)\s+(.+),\s*([A-Z]{2,3})$/.exec(line.trim());
  if (!m) continue;
  matched++;
  const asn = Number(m[1]);
  const name = m[2].trim();
  const country = m[3];
  const { rating, reasons } = scoreEntry(asn, name, country);
  // Compact array form: [name, country, rating, reasons]. Empty reasons
  // means "Section 4.2 default" -- the Worker fills in that text itself
  // rather than repeating one static string 100,000+ times on disk.
  db[asn] = [name, country, rating, reasons];
}
console.log(`Parsed ${matched} / ${lines.length}`);

// AS0 and AS23456 (AS_TRANS) are reserved, not allocated to an organisation,
// so RIPE's list has no entry for them -- but Section 4.2 rates them
// specifically, so the ERA should answer for them regardless.
const PLACEHOLDER_NAMES = {
  0: "RESERVED-AS0 - does not exist and is definitionally suspicious",
  23456: "AS_TRANS - RFC 6793 transitional AS",
};
for (let asn = 64496; asn <= 64511; asn++) {
  PLACEHOLDER_NAMES[asn] = `AS${asn} - reserved for documentation (RFC 5398)`;
}
for (const asnStr of Object.keys(EXACT)) {
  const asn = Number(asnStr);
  if (!(asn in db)) {
    const { rating, reasons } = EXACT[asn];
    db[asn] = [PLACEHOLDER_NAMES[asn] ?? `AS${asn}`, "ZZ", rating, reasons];
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(db));
console.log(`Wrote ${OUT}`);
