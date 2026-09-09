// Hand-verifies src/fieldmap.js's row-to-factor mapping against the subset
// of the draft's Appendix C test vectors this batch pipeline can actually
// reach (it always runs with F_content = 2.0 "unanalysed" and arriving = 0,
// since Log Explorer rows carry neither a payload-inspection result nor an
// incoming Evil Byte — see fieldmap.js). This is not a replacement for
// pytest/go test, which check the formula itself; this checks that THIS
// module builds the right inputs for it. Run with: node scripts/verify-vectors.mjs

import { computeFactors, netKeyForIp } from "../src/fieldmap.js";

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${actual}, want ${expected})`);
  if (!ok) failures++;
}

// --- direct checks on the ported IP-classification helper ---
check('netKeyForIp("100.64.0.1") CGNAT lower bound', netKeyForIp("100.64.0.1", false), "ipv4-cgnat");
check('netKeyForIp("100.63.255.255") just below CGNAT', netKeyForIp("100.63.255.255", false), "ipv4");
check('netKeyForIp("100.128.0.1") just above CGNAT', netKeyForIp("100.128.0.1", false), "ipv4");
check('netKeyForIp("2002::1") 6to4 transition', netKeyForIp("2002::1", true), "ipv6-transition");
check('netKeyForIp("2606:4700::1") ordinary IPv6', netKeyForIp("2606:4700::1", true), "ipv6");

// --- Appendix C vectors reachable through computeFactors()'s fixed
// F_content=2/arriving=0 envelope ---

// C.1: baseline — IPv4, TCP, .com, not analysed, Wednesday noon, unrated AS -> ER 55
{
  const row = {
    clientip: "93.184.216.34", // non-CGNAT IPv4
    clientrequestprotocol: "HTTP/1.1",
    clientcountry: null, // -> approximateTimezone falls back to Etc/UTC
    clientregioncode: null,
    edgestarttimestamp: "2025-01-01T12:00:00Z", // Wednesday, noon UTC, not April 1
  };
  const rec = computeFactors(row, { eraResult: null, reverseName: "example.com" });
  check("C.1 baseline -> ER", rec.er, 55);
}

// C.12: as C.1, but no PTR name and Friday 17:00 local -> ER 69
{
  const row = {
    clientip: "93.184.216.34",
    clientrequestprotocol: "HTTP/1.1",
    clientcountry: null,
    clientregioncode: null,
    edgestarttimestamp: "2025-01-03T17:00:00Z", // Friday, 17:00 UTC
  };
  const rec = computeFactors(row, { eraResult: null, reverseName: null });
  check("C.12 no name, Friday 17:00 -> ER", rec.er, 69);
}

// C.13: as C.1, from a host with a protest word in its PTR name -> ER 75
{
  const row = {
    clientip: "93.184.216.34",
    clientrequestprotocol: "HTTP/1.1",
    clientcountry: null,
    clientregioncode: null,
    edgestarttimestamp: "2025-01-01T12:00:00Z",
  };
  const rec = computeFactors(row, { eraResult: null, reverseName: "secure-gw.example.net" });
  check("C.13 protest-word name -> ER", rec.er, 75);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
