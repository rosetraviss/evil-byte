// Resolves a reverse-DNS (PTR) name for F_name — the same DoH lookup
// site/src/index.js's live /api/rate handler makes (reverseDnsV4), but
// D1-cached with a staleness TTL: PTR records rarely change, so re-running
// this lookup for the same quiet IP every 5 minutes would be wasted work
// and wasted per-run budget (see index.js's RDNS_LOOKUP_BUDGET). IPv6
// reverse lookups are out of scope here too, same as the live worker.

const RDNS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getCachedRdns(db, ip) {
  return db.prepare("SELECT reverse_name, resolved_at FROM rdns_cache WHERE client_ip = ?").bind(ip).first();
}

function isStale(resolvedAtIso) {
  return Date.now() - Date.parse(resolvedAtIso) > RDNS_TTL_MS;
}

async function putCachedRdns(db, ip, reverseName) {
  await db
    .prepare(
      `INSERT INTO rdns_cache (client_ip, reverse_name, resolved_at) VALUES (?, ?, ?)
       ON CONFLICT(client_ip) DO UPDATE SET reverse_name = excluded.reverse_name, resolved_at = excluded.resolved_at`
    )
    .bind(ip, reverseName, new Date().toISOString())
    .run();
}

async function reverseDnsV4(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  const reversed = ip.split(".").reverse().join(".");
  const dohUrl = `https://cloudflare-dns.com/dns-query?name=${reversed}.in-addr.arpa&type=PTR`;
  try {
    const resp = await fetch(dohUrl, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(1500),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const answer = (data.Answer || []).find((a) => a.type === 12);
    return answer ? answer.data.replace(/\.$/, "") : null;
  } catch {
    return null;
  }
}

/**
 * Resolves ip's PTR name, using the D1 cache when fresh.
 * @returns {Promise<{reverseName: string|null, fromCache: boolean, fallback: boolean}>}
 * `fallback` is true only when the budget was exhausted and a stale/absent
 * cache entry had to be used as-is instead of refreshing it.
 */
export async function resolveReverseName(ip, db, budget) {
  if (ip.includes(":")) return { reverseName: null, fromCache: false, fallback: false }; // IPv6, out of scope

  const cached = await getCachedRdns(db, ip);
  if (cached && !isStale(cached.resolved_at)) {
    return { reverseName: cached.reverse_name, fromCache: true, fallback: false };
  }

  if (!budget.spend()) {
    return { reverseName: cached ? cached.reverse_name : null, fromCache: Boolean(cached), fallback: true };
  }

  const reverseName = await reverseDnsV4(ip);
  await putCachedRdns(db, ip, reverseName);
  return { reverseName, fromCache: false, fallback: false };
}
