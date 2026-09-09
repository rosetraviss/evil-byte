// Worker for evilbyte — draft-traviss-evil-byte-00.
//
// Serves the static site and, at /api/rate, actually plays the part of a
// Morality-Inspecting Trusted Middleman (Section 5): it computes a live
// Evil Rating for the visitor from real edge signals Cloudflare already
// has on hand (request.cf), one honest live reverse-DNS lookup, and a
// real query to the Evil Rating Authority at era.evilbyte.net (Section
// 6) for the visitor's Autonomous System. No payload is read. See
// Section 4.5.2: the absence of analysis is not the absence of Evil,
// and this MITM does not pretend otherwise.

import {
  evilRating,
  band,
  nameFactorFromName,
  NO_NAME,
  timeFactorForParts,
} from "../public/evil-formula.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/rate" && request.method === "GET") {
      return handleRate(request);
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleRate(request) {
  const cf = request.cf || {};
  const ip = request.headers.get("cf-connecting-ip") || "";
  const isV6 = ip.includes(":");

  // --- F_net (Section 4.3): real, from the connecting IP.
  let netKey = isV6 ? "ipv6" : "ipv4";
  if (!isV6 && isCgnat(ip)) netKey = "ipv4-cgnat";
  if (isV6 && isTransitionV6(ip)) netKey = "ipv6-transition";
  const NET_VALUES = { ipv4: 1.5, "ipv4-cgnat": 1.75, ipv6: 0.75, "ipv6-transition": 1.25 };
  const f_net = NET_VALUES[netKey];

  // --- F_tx (Section 4.4): HTTP/3 travels over QUIC; everything else here is TCP.
  const f_tx = cf.httpProtocol === "HTTP/3" ? 1.25 : 1.0;

  // --- F_content (Section 4.5): this MITM performs no analysis. Honestly.
  const f_content = 2.0; // "unanalysed" — the Presumption of Evil, Section 4.5.2.

  // --- F_name (Section 4.6) and F_AS (Section 4.2): one reverse-DNS lookup
  // and one query to the ERA (Section 6), run concurrently.
  let nameNote = "No PTR record, or the lookup did not return in time.";
  if (isV6) nameNote = "IPv6 reverse lookups are left as future work (in the tradition of Section 8.2).";

  const [reverseName, eraResult] = await Promise.all([
    isV6 ? Promise.resolve(null) : reverseDnsV4(ip).catch(() => null),
    queryEra(cf.asn).catch(() => null),
  ]);
  if (reverseName) nameNote = "Reverse DNS (PTR) on the connecting address.";
  const f_name = reverseName ? nameFactorFromName(reverseName) : NO_NAME;

  const f_as = eraResult ? eraResult.multiplier : 1.0;

  // --- F_time (Section 4.7): local time at the source, estimated from cf.timezone.
  const tz = cf.timezone || "UTC";
  const { hour, isFriday, isAprilFirst, localLabel } = localTimeParts(tz);
  const f_time = timeFactorForParts(hour, isFriday, isAprilFirst, false);

  const arriving = 0; // fresh request; nothing upstream of us has written an Evil Byte we can see.
  const { er, f_tamper } = evilRating({ f_as, f_net, f_tx, f_content, f_name, f_time, arriving });

  const body = {
    er,
    band: band(er),
    factors: {
      f_as, f_net, f_tx, f_content, f_name, f_time, f_tamper,
      weights: { as: 1.0, net: 0.5, tx: 0.25, content: 1.5, name: 0.75, time: 0.25 },
      base: 16,
    },
    evidence: {
      ipVersion: isV6 ? "IPv6" : "IPv4",
      netKey,
      asn: cf.asn ?? null,
      asOrganization: cf.asOrganization ?? null,
      asRating: eraResult ? eraResult.rating : null,
      asNote: eraResult
        ? eraResult.reasons[0]
        : "The ERA had no opinion in time; F_AS = 1.0 (Section 4.2) — see era.evilbyte.net",
      country: cf.country ?? null,
      colo: cf.colo ?? null,
      tlsVersion: cf.tlsVersion ?? null,
      httpProtocol: cf.httpProtocol ?? null,
      reverseDns: reverseName,
      nameNote,
      timezone: tz,
      localTime: localLabel,
      isAprilFirst,
    },
  };

  return Response.json(body, {
    headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" },
  });
}

// Section 4.2: "F_AS is the multiplier published by the ERA... An AS for
// which the ERA publishes no multiplier has F_AS = 1.0." This is that
// query, for real, against era.evilbyte.net (Section 6).
async function queryEra(asn) {
  if (asn == null) return null;
  const resp = await fetch(`https://era.evilbyte.net/asn/${asn}`, {
    signal: AbortSignal.timeout(800),
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!resp.ok) return null;
  return resp.json();
}

async function reverseDnsV4(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  const reversed = ip.split(".").reverse().join(".");
  const dohUrl = `https://cloudflare-dns.com/dns-query?name=${reversed}.in-addr.arpa&type=PTR`;
  const resp = await fetch(dohUrl, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(1500),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const answer = (data.Answer || []).find((a) => a.type === 12);
  return answer ? answer.data.replace(/\.$/, "") : null;
}

function isCgnat(ipv4) {
  const m = ipv4.match(/^(\d{1,3})\.(\d{1,3})\./);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 100 && b >= 64 && b <= 127;
}

function isTransitionV6(ipv6) {
  const lower = ipv6.toLowerCase();
  return lower.startsWith("2002:") || lower.startsWith("2001:0:") || lower.startsWith("2001::");
}

function localTimeParts(tz) {
  const now = new Date();
  let parts;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
    });
    parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  } catch {
    parts = { hour: "00", minute: "00", weekday: "Thu", month: "01", day: "01" };
  }
  const hour = Number(parts.hour) % 24;
  const isFriday = parts.weekday === "Fri";
  const isAprilFirst = parts.month === "04" && parts.day === "01";
  const localLabel = `${parts.weekday} ${parts.hour}:${parts.minute}`;
  return { hour, isFriday, isAprilFirst, localLabel };
}
