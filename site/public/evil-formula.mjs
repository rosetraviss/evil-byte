// Reference implementation of the Evil Rating formula, draft-traviss-evil-byte-00
// Section 4 (Computation of the Evil Rating) and Appendix A.
// Ported from the appendix's Python so this file agrees with it exactly.
// Shared between the Worker (src/index.js) and the browser (calculator page).

export const BASE_EVIL = 16.0;

export const WEIGHTS = { as: 1.0, net: 0.5, tx: 0.25, content: 1.5, name: 0.75, time: 0.25 };

// Section 4.2
export const AS_TABLE = [
  { key: "eu", label: "EU-registered AS (or EU institution)", value: 0.5, rating: 1100,
    note: "The Union has advised the Working Group that it is Good." },
  { key: "unrated", label: "Unrated by the ERA (default)", value: 1.0, rating: 1500,
    note: "No multiplier on file; F_AS = 1.0." },
  { key: "as_trans", label: "AS23456 (AS_TRANS)", value: 1.5, rating: 1734,
    note: "Neither one thing nor the other." },
  { key: "meta", label: "AS32934 (Meta Platforms)", value: 2.0, rating: 1900,
    note: "Rated by acclamation. There was no discussion." },
  { key: "mil", label: "AS721 / .mil-registered", value: 4.0, rating: 2300,
    note: "This is not a value judgement; it is a byte." },
  { key: "as0", label: "AS0", value: 4.0, rating: 2300,
    note: "An AS that does not exist and appears in routing tables is definitionally suspicious." },
];

// Section 4.3
export const NET_TABLE = [
  { key: "ipv6", label: "IPv6", value: 0.75, note: "The Working Group's only carrot." },
  { key: "ipv6-transition", label: "IPv6 via transition mechanism (6to4 / Teredo)", value: 1.25,
    note: "Neither one thing nor the other." },
  { key: "ipv6-hbh", label: "IPv6 with Hop-by-Hop Options", value: 2.0,
    note: "Routers have been dropping these for years." },
  { key: "ipv4", label: "IPv4", value: 1.5, note: "A monument to stubbornness." },
  { key: "ipv4-cgnat", label: "IPv4, shared address space (100.64.0.0/10)", value: 1.75,
    note: "Sharing one address with strangers is inherently suspicious." },
];

// Section 4.4
export const TX_TABLE = [
  { key: "avian", label: "Avian carrier (RFC 1149 / RFC 6214)", value: 0.25,
    note: "Difficult to be Evil at sixty kilometres per hour." },
  { key: "icmp-echo", label: "ICMP / ICMPv6 Echo (ping)", value: 0.5,
    note: "The network equivalent of asking how someone's day was." },
  { key: "sctp", label: "SCTP", value: 0.8, note: "No Evil actor has ever bothered." },
  { key: "tcp", label: "TCP", value: 1.0, note: "The baseline." },
  { key: "udp", label: "UDP", value: 1.1, note: "Stateless, as most Evil is." },
  { key: "quic", label: "QUIC", value: 1.25, note: "Encrypts its own headers." },
  { key: "tunnel", label: "Tunnel (GRE / IP-in-IP / ESP)", value: 1.5,
    note: "A packet inside a packet is a packet with something to hide." },
  { key: "other", label: "Any other protocol", value: 2.0, note: "The Working Group has heard of everything." },
  { key: "icmp-redirect", label: "ICMP Redirect", value: 4.0, note: "Nobody has ever trusted one." },
];

// Section 4.5
export const CONTENT_TABLE = [
  { key: "good", label: "Analysed: Good", value: 0.5 },
  { key: "unanalysed", label: "Not analysed (presumption of Evil, §4.5.2)", value: 2.0 },
  { key: "uncertain", label: "Analysed: Uncertain", value: 1.5 },
  { key: "evil", label: "Analysed: Evil", value: 4.0 },
  { key: "encrypted", label: "Encrypted With Intent (TLS, no VDA)", value: 4.0 },
];
export const COOPERATION_DISCOUNT = 0.9; // Section 4.5.3
// VDA only makes sense once a cleartext result is known, i.e. for good/uncertain/evil.
export const VDA_ELIGIBLE = new Set(["good", "uncertain", "evil"]);

// Section 4.6
export const NAME_TABLE = [
  { tld: "eu", value: 0.5 }, { tld: "local", value: 0.5 }, { tld: "int", value: 0.75 },
  { tld: "org", value: 0.8 }, { tld: "edu", value: 0.9 }, { tld: "com", value: 1.0 },
  { tld: "net", value: 1.0 }, { tld: "io", value: 1.25 }, { tld: "biz", value: 1.5 },
  { tld: "ai", value: 1.5 }, { tld: "gov", value: 2.0 }, { tld: "zip", value: 2.0 },
  { tld: "mil", value: 4.0 },
];
export const NO_NAME = 1.25;
export const PROTEST_WORDS = ["secure", "trust", "safe", "legit"];

export function nameFactorFromName(name) {
  if (!name) return NO_NAME;
  const lower = name.toLowerCase().replace(/\.$/, "");
  const labels = lower.split(".");
  let f;
  if (labels.slice(-2).join(".") === "home.arpa") {
    f = 0.5;
  } else {
    const tld = labels[labels.length - 1];
    const row = NAME_TABLE.find((r) => r.tld === tld);
    f = row ? row.value : 1.0; // ccTLDs and unlisted gTLDs: 1.0
  }
  if (PROTEST_WORDS.some((w) => lower.includes(w))) f = Math.max(f, 1.5);
  return f;
}

// Section 4.7
export function timeFactorForParts(hour, isFriday, isAprilFirst, dst = false) {
  if (isAprilFirst) return Infinity;
  let f = 1.0;
  if (hour >= 2 && hour < 5) f = 1.5;
  else if (isFriday && hour >= 16) f = 1.25;
  return f + (dst ? 0.1 : 0);
}

// Section 4.1 / Appendix A: ER = clamp(floor(B * F_tamper * PRODUCT(F_i ^ w_i) + 0.5), 1, 255)
export function evilRating({ f_as, f_net, f_tx, f_content, f_name, f_time, arriving = 0 }) {
  const f_tamper = arriving === 0 ? 1.0 : 1.5; // Section 4.8
  let x = BASE_EVIL * f_tamper;
  x *= Math.pow(f_as, WEIGHTS.as);
  x *= Math.pow(f_net, WEIGHTS.net);
  x *= Math.pow(f_tx, WEIGHTS.tx);
  x *= Math.pow(f_content, WEIGHTS.content);
  x *= Math.pow(f_name, WEIGHTS.name);
  x *= Math.pow(f_time, WEIGHTS.time);

  let er;
  if (!isFinite(x)) {
    er = 255; // 1 April
  } else {
    er = Math.floor(x + 0.5); // round half towards Evil
    er = Math.max(1, Math.min(255, er));
  }
  er = Math.max(er, arriving); // Section 5.4: Evil is monotonic
  return { er, f_tamper, raw: x };
}

// Section 3.3
export function band(er) {
  if (er <= 0) return "Unrated";
  if (er === 1) return "Verified Good";
  if (er <= 127) return "Good";
  if (er <= 254) return "Evil";
  return "Saturated Evil";
}
