// Computes the six Evil Rating factors for one Log Explorer http_requests
// row, reusing the real formula (site/public/evil-formula.mjs) rather than
// a reimplementation — see the approved plan's "Formula reuse" section for
// why this cross-directory import is safe (the module has no dependencies
// of its own, so this stays at four load-bearing implementations, not five).
//
// This module is deliberately pure/synchronous: it takes already-resolved
// enrichment results (an ERA lookup, a reverse-DNS name) as arguments
// instead of performing the I/O itself, so it can be hand-verified against
// the draft's Appendix C test vectors with no network access — see
// telemetry/scripts/verify-vectors.mjs.

import {
  evilRating,
  band,
  timeFactorForParts,
  nameFactorFromName,
  NO_NAME,
} from "../../site/public/evil-formula.mjs";
import { approximateTimezone, localTimePartsAt } from "./timezone-approx.js";

// --- Ported verbatim from site/src/index.js lines 36-40 and 131-142. ---
// These are private helpers there, not exported from evil-formula.mjs, so
// they're duplicated here rather than imported across Worker boundaries.
// This is glue code around the formula, not a second implementation of the
// formula itself — keep it in sync by hand if site/src/index.js's F_net
// logic ever changes.
const NET_VALUES = { ipv4: 1.5, "ipv4-cgnat": 1.75, ipv6: 0.75, "ipv6-transition": 1.25 };

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
// --- end ported block ---

export function netKeyForIp(ip, isV6) {
  let netKey = isV6 ? "ipv6" : "ipv4";
  if (!isV6 && isCgnat(ip)) netKey = "ipv4-cgnat";
  if (isV6 && isTransitionV6(ip)) netKey = "ipv6-transition";
  return netKey;
}

/**
 * @param {object} row - normalized (lowercase-keyed) Log Explorer row, see logs.js
 * @param {object} enrichment
 * @param {{multiplier:number, rating:number}|null} enrichment.eraResult
 * @param {string|null} enrichment.reverseName
 * @param {boolean} [enrichment.asFallback] - true if the ERA lookup was skipped for budget reasons
 * @param {boolean} [enrichment.nameFallback] - true if the rDNS lookup was skipped for budget reasons
 */
export function computeFactors(row, { eraResult, reverseName, asFallback = false, nameFallback = false }) {
  const ip = row.clientip;
  const isV6 = ip.includes(":");

  const netKey = netKeyForIp(ip, isV6);
  const f_net = NET_VALUES[netKey];

  const f_tx = row.clientrequestprotocol === "HTTP/3" ? 1.25 : 1.0;
  const f_content = 2.0; // "unanalysed" — Presumption of Evil, same as the live worker

  const f_as = eraResult ? eraResult.multiplier : 1.0;
  const f_name = reverseName ? nameFactorFromName(reverseName) : NO_NAME;

  const eventTime = new Date(row.edgestarttimestamp);
  const tz = approximateTimezone(row.clientcountry, row.clientregioncode);
  const { hour, isFriday, isAprilFirst } = localTimePartsAt(eventTime, tz);
  const f_time = timeFactorForParts(hour, isFriday, isAprilFirst, false); // dst=false, matches the live worker

  const arriving = 0; // logs carry no incoming Evil Byte to observe
  const { er, f_tamper } = evilRating({ f_as, f_net, f_tx, f_content, f_name, f_time, arriving });

  return {
    client_ip: ip,
    ip_version: isV6 ? "IPv6" : "IPv4",
    f_as, f_net, f_tx, f_content, f_name, f_time, f_tamper,
    arriving, er, band: band(er),
    asn: row.clientasn != null ? Number(row.clientasn) : null,
    as_rating: eraResult ? eraResult.rating : null,
    client_country: row.clientcountry ?? null,
    client_region_code: row.clientregioncode ?? null,
    bot_score: row.botscore != null ? Number(row.botscore) : null,
    bot_score_src: row.botscoresrc ?? null,
    ja4: row.ja4 ?? null,
    waf_attack_score: row.wafattackscore != null ? Number(row.wafattackscore) : null,
    zone_hash: row.zone_pseudonym ?? null, // pseudonymous — see logs.js's zonePseudonym()
    edge_colo_code: row.edgecolocode ?? null,
    http_protocol: row.clientrequestprotocol ?? null,
    reverse_name: reverseName ?? null,
    f_as_is_fallback: asFallback ? 1 : 0,
    f_name_is_fallback: nameFallback ? 1 : 0,
    last_ray_id: row.rayid ?? null,
  };
}
