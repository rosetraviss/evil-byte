// Cloudflare Log Explorer SQL API client — the extraction source for this
// pipeline.
//
// http_requests is zone-scoped only: verified against production, the
// account-level endpoint (/accounts/{id}/logs/explorer/query/sql) returns
// "unsupported dataset http_requests". So this lists every zone on the
// account (GET /zones?account.id=...) and queries each zone's own
// /zones/{zone_id}/logs/explorer/query/sql endpoint separately, merging
// the results. Both this and the query method (GET, not POST — every
// documented example is a bare `curl URL --url-query`, which is a GET by
// curl's own default) were confirmed against the real API, not assumed.
//
// This account's zones are mostly unrelated to evilbyte.net — other real
// sites sharing the account. Per explicit instruction, every zone is
// queried (not just evilbyte.net's), but which real zone a row came from
// is never stored or logged: only a one-way pseudonym derived from the
// zone's Cloudflare-internal id, which isn't itself public information.
// See zonePseudonym() below and fieldmap.js's zone_hash field.

const API_BASE = "https://api.cloudflare.com/client/v4";

const COLUMNS = [
  "RayID", "EdgeStartTimestamp", "ClientIP", "ClientASN",
  "ClientCountry", "ClientRegionCode", "ClientRequestProtocol",
  "BotScore", "BotScoreSrc", "JA4", "WAFAttackScore", "EdgeColoCode",
];

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// Per-zone cap, independent of whatever the caller's overall `limit` is —
// with 35 zones on this account, a flat per-zone bound keeps one run's
// total work (and Cron Trigger wall time) predictable. Same self-healing
// property as before: a capped zone just picks up where it left off on
// the next tick, via that zone's contribution to the returned cursor
// (see fetchRequestLogs).
const PER_ZONE_ROW_LIMIT = 1000;

function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

async function cfGet(env, url) {
  const resp = await fetch(url, {
    headers: { authorization: `Bearer ${env.LOGS_API_TOKEN}` },
  });
  const body = await resp.json();
  if (!resp.ok || body.success === false) {
    // Cloudflare's newer error responses can include a documentation_url
    // pinpointing the exact missing permission — surface the full error
    // objects, not just .message, so that's visible if present.
    const detail = JSON.stringify(body.errors || body);
    const err = new Error(`${url.pathname} failed (${resp.status}): ${detail}`);
    err.status = resp.status;
    throw err;
  }
  return body;
}

// One-way, unsalted SHA-256 of the zone's Cloudflare-internal id (not its
// name) — the id isn't public/guessable the way a domain name is, so this
// is a real pseudonym, not just a hash of already-public information.
// Stable across runs (same zone -> same pseudonym) so the dashboard can
// still show per-source traffic *patterns* over time without ever
// resolving to which real site it is.
async function zonePseudonym(zoneId) {
  const bytes = new TextEncoder().encode(zoneId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return "z-" + hex.slice(0, 10);
}

/** Every zone on the account, paginated (List Zones is capped at 50/page). */
async function listZones(env) {
  const zones = [];
  for (let page = 1; ; page++) {
    const url = new URL(`${API_BASE}/zones`);
    url.searchParams.set("account.id", env.CF_ACCOUNT_ID);
    url.searchParams.set("per_page", "50");
    url.searchParams.set("page", String(page));

    const body = await cfGet(env, url);
    for (const z of body.result || []) zones.push({ id: z.id });

    const totalPages = body.result_info ? body.result_info.total_pages : 1;
    if (page >= totalPages || (body.result || []).length === 0) break;
  }
  return zones;
}

async function queryZoneHttpRequests(env, zone, sinceIso, limit) {
  const sinceDate = sinceIso.slice(0, 10); // Date partition hint, narrows the scan
  const query =
    `SELECT ${COLUMNS.join(", ")} FROM http_requests ` +
    `WHERE Date >= '${sinceDate}' AND EdgeStartTimestamp >= '${sinceIso}' ` +
    `ORDER BY EdgeStartTimestamp ASC LIMIT ${limit}`;

  const url = new URL(`${API_BASE}/zones/${zone.id}/logs/explorer/query/sql`);
  url.searchParams.set("query", query);

  const body = await cfGet(env, url);
  const rows = (body.result || []).map(normalizeRow);
  for (const row of rows) row.zone_pseudonym = zone.pseudonym;
  return rows;
}

/**
 * Fetches new http_requests rows across every zone on the account, oldest
 * first per zone, each zone capped at PER_ZONE_ROW_LIMIT.
 *
 * A zone this token can't query (e.g. a permissions gap for that specific
 * zone) is logged by pseudonym and skipped, not fatal to the run — with
 * 35 zones on one account, one being unreachable shouldn't block the
 * other 34. Only a failure to list zones at all is fatal (nothing to
 * iterate without it).
 *
 * Returns { rows, nextCursor, capped }. nextCursor is the safe watermark
 * to persist: the minimum, across zones that returned any rows this run,
 * of that zone's last row's timestamp. A zone that returned nothing this
 * run doesn't hold the watermark back (there was nothing pending for it);
 * a zone that hit its per-zone cap does (there's more we haven't fetched
 * yet) — same "never skip a row" guarantee the single-zone version had,
 * generalized across zones instead of assuming there was only one.
 */
export async function fetchRequestLogs(env, { sinceIso, limit }) {
  if (!ISO_TIMESTAMP_RE.test(sinceIso)) {
    throw new Error(`Refusing to build a Log Explorer query from a malformed cursor: ${sinceIso}`);
  }
  const rowLimit = Number(limit);
  if (!Number.isInteger(rowLimit) || rowLimit <= 0) {
    throw new Error(`Invalid row limit: ${limit}`);
  }
  const perZoneLimit = Math.min(rowLimit, PER_ZONE_ROW_LIMIT);

  const zones = await listZones(env);
  for (const zone of zones) zone.pseudonym = await zonePseudonym(zone.id);
  console.log(`telemetry: found ${zones.length} zone(s): ${zones.map((z) => z.pseudonym).join(", ")}`);
  if (zones.length === 0) {
    return { rows: [], nextCursor: sinceIso, capped: false };
  }

  const allRows = [];
  let minAdvance = null;
  let capped = false;
  let unreachable = 0;

  for (const zone of zones) {
    let rows;
    try {
      rows = await queryZoneHttpRequests(env, zone, sinceIso, perZoneLimit);
    } catch (err) {
      unreachable++;
      console.error(`telemetry: zone ${zone.pseudonym} query failed, skipping: ${err.message}`);
      continue;
    }
    console.log(`telemetry: zone ${zone.pseudonym}: ${rows.length} row(s)`);
    if (rows.length === perZoneLimit) capped = true;
    if (rows.length > 0) {
      allRows.push(...rows);
      const zoneLast = rows[rows.length - 1].edgestarttimestamp;
      if (minAdvance === null || zoneLast < minAdvance) minAdvance = zoneLast;
    }
  }
  if (unreachable > 0) {
    console.log(`telemetry: ${unreachable} of ${zones.length} zone(s) unreachable this run (permissions?)`);
  }

  allRows.sort((a, b) => (a.edgestarttimestamp < b.edgestarttimestamp ? -1 : 1));
  return { rows: allRows, nextCursor: minAdvance === null ? sinceIso : minAdvance, capped };
}
