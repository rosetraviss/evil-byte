// Queries the Evil Rating Authority for an AS multiplier — the same call
// site/src/index.js's live /api/rate handler makes (queryEra), reused here
// so F_AS means the same thing whether it was computed live or from a Log
// Explorer row. Same 800ms timeout as the live worker.

/**
 * `cache` is a plain Map the caller creates once per scheduled() invocation.
 * Many requestors in a batch typically share an ASN, so this avoids
 * re-fetching the same AS's rating dozens of times in one run. It is NOT
 * persisted to D1 — ERA's own data only changes on its daily rebuild
 * (.github/workflows/deploy-era.yml), so a fresh per-run cache is enough.
 */
export async function queryEra(asn, cache) {
  if (asn == null) return null;
  if (cache.has(asn)) return cache.get(asn);

  let result = null;
  try {
    const resp = await fetch(`https://era.evilbyte.net/asn/${asn}`, {
      signal: AbortSignal.timeout(800),
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (resp.ok) result = await resp.json();
  } catch {
    result = null;
  }
  cache.set(asn, result);
  return result;
}
