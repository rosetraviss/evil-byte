// Worker for telemetry.evilbyte.net.
//
// Every 5 minutes (Cron Trigger, see wrangler.jsonc), pulls new
// http_requests rows from Cloudflare's Log Explorer across the whole
// account, computes an Evil Rating for each distinct requestor using the
// real formula (site/public/evil-formula.mjs, imported — not
// reimplemented), and upserts one latest-seen row per client IP into D1.
// Serves a small dashboard over that data at /.
//
// This is the batch counterpart to site/src/index.js's live /api/rate: same
// formula, same ERA, same reverse-DNS approach, but reconstructed from
// historical log rows instead of a live request — see fieldmap.js and the
// approved plan's field-mapping table for exactly where the two
// necessarily diverge (F_time and, to a lesser extent, F_name).

import { fetchRequestLogs } from "./logs.js";
import { computeFactors, asnOf, isNonRoutableClient } from "./fieldmap.js";
import { queryEra } from "./era-client.js";
import { resolveReverseName } from "./rdns.js";
import { readCursor, writeCursorAndStats, upsertRequestors } from "./db.js";

// Upper bound on the per-zone limit (see logs.js), not on the run as a
// whole: with 35 zones a run can legitimately pull many times this.
const ROW_LIMIT_PER_RUN = 20000;
const ERA_LOOKUP_BUDGET = 400;
const RDNS_LOOKUP_BUDGET = 400;
const ENRICHMENT_CONCURRENCY = 25;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/stats" && request.method === "GET") {
      return handleStats(env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runExtraction(env));
  },
};

function makeBudget(limit) {
  let spent = 0;
  return { spend: () => (spent < limit ? (++spent, true) : false) };
}

// Bounded-concurrency fan-out: running enrichment lookups fully sequentially
// can exceed the Cron Trigger's 15-minute wall-clock cap on a busy account
// (hundreds of 800ms/1500ms-timeout fetches add up); running them all at
// once as a single Promise.all risks the same subrequest spike. A modest
// concurrency window keeps worst-case wall time to tens of seconds.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runExtraction(env) {
  const since = await readCursor(env.DB);

  let rows, nextCursor, capped;
  try {
    ({ rows, nextCursor, capped } = await fetchRequestLogs(env, { sinceIso: since, limit: ROW_LIMIT_PER_RUN }));
  } catch (err) {
    // Cursor stays put — the next tick just retries this same window.
    console.error("telemetry: Log Explorer fetch failed:", err);
    return;
  }

  if (rows.length === 0) {
    await writeCursorAndStats(env.DB, { cursorIso: since, rowsSeen: 0, rowsCapped: capped });
    return;
  }

  // Latest-seen dedup, end to end: fetchRequestLogs already returns rows
  // sorted ascending (merged across zones), so later rows for the same IP
  // overwrite earlier ones here, before anything touches D1 (the upsert
  // only needs to apply "latest wins" once more, against whatever was
  // already stored from a previous run).
  const byIp = new Map();
  let dropped = 0;
  for (const row of rows) {
    if (isNonRoutableClient(row.clientip)) {
      dropped++;
      continue;
    }
    byIp.set(row.clientip, row);
  }
  if (dropped > 0) {
    console.log(`telemetry: dropped ${dropped} row(s) with a non-routable client address`);
  }
  const distinctRows = [...byIp.values()];

  const eraCache = new Map();
  const eraBudget = makeBudget(ERA_LOOKUP_BUDGET);
  const rdnsBudget = makeBudget(RDNS_LOOKUP_BUDGET);

  const records = await mapWithConcurrency(distinctRows, ENRICHMENT_CONCURRENCY, async (row) => {
    const asn = asnOf(row);
    let eraResult = null;
    let asFallback = false;
    if (asn != null) {
      if (eraCache.has(asn) || eraBudget.spend()) {
        eraResult = await queryEra(asn, eraCache);
      } else {
        asFallback = true;
      }
    }

    const { reverseName, fallback: nameFallback } = await resolveReverseName(row.clientip, env.DB, rdnsBudget);

    return computeFactors(row, { eraResult, reverseName, asFallback, nameFallback });
  });

  await upsertRequestors(env.DB, records);

  await writeCursorAndStats(env.DB, { cursorIso: nextCursor, rowsSeen: rows.length, rowsCapped: capped });
}

async function handleStats(env) {
  const db = env.DB;
  const [bandCounts, signalCorrelation, topAsns, byZone, health, totals] = await Promise.all([
    db.prepare("SELECT band, COUNT(*) AS count FROM requestors GROUP BY band").all(),
    db
      .prepare(
        `SELECT band, AVG(bot_score) AS avg_bot_score, AVG(waf_attack_score) AS avg_waf_score, COUNT(*) AS count
         FROM requestors GROUP BY band`
      )
      .all(),
    db
      .prepare(
        `SELECT asn, COUNT(*) AS count, AVG(er) AS avg_er FROM requestors
         WHERE asn IS NOT NULL GROUP BY asn ORDER BY count DESC LIMIT 20`
      )
      .all(),
    db
      .prepare(
        `SELECT zone_hash, COUNT(*) AS count FROM requestors
         WHERE zone_hash IS NOT NULL GROUP BY zone_hash ORDER BY count DESC LIMIT 20`
      )
      .all(),
    db.prepare("SELECT * FROM extraction_state WHERE id = 1").first(),
    db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(f_as_is_fallback) AS as_fallback_count, SUM(f_name_is_fallback) AS name_fallback_count
         FROM requestors`
      )
      .first(),
  ]);

  return Response.json(
    {
      bandCounts: bandCounts.results,
      signalCorrelation: signalCorrelation.results,
      topAsns: topAsns.results,
      byZone: byZone.results,
      totals,
      health: health || null,
    },
    { headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } }
  );
}
