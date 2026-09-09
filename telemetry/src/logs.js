// Cloudflare Log Explorer SQL API client — the extraction source for this
// pipeline. Scope is ALL zones on the account, via the account-level
// endpoint rather than looping per zone.
//
// VERIFY THIS AGAINST THE REAL API BEFORE TRUSTING IT IN PRODUCTION (see
// the approved plan's Verification #1 and telemetry/README.md). Cloudflare's
// own documentation was inconsistent about exact field-name casing for
// http_requests (PascalCase in some examples, lowercase in others), and
// never confirmed that http_requests is enabled for ACCOUNT-level (as
// opposed to zone-only) querying. This client works around the casing
// question by normalizing every row to lowercase keys (normalizeRow) so the
// rest of the pipeline never has to care — but if account-level querying of
// http_requests turns out to be unavailable, this is where the fallback
// (looping over GET /accounts/{id}/zones, one zone-scoped query per zone)
// belongs.

const API_BASE = "https://api.cloudflare.com/client/v4";

// Explicit column list, not SELECT * — Cloudflare's own guidance is to
// select only needed columns and narrow the time window for query speed.
// ZoneName's availability on this dataset is unconfirmed; it's requested
// optimistically and simply comes back absent/null if the account doesn't
// have it (normalizeRow degrades missing fields to undefined, and
// fieldmap.js/db.js treat that as null, rather than throwing).
const COLUMNS = [
  "RayID", "EdgeStartTimestamp", "ClientIP", "ClientASN",
  "ClientCountry", "ClientRegionCode", "ClientRequestProtocol",
  "ClientRequestHost", "BotScore", "BotScoreSrc", "JA4",
  "WAFAttackScore", "EdgeColoCode", "ZoneName",
];

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function normalizeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

/**
 * Fetches http_requests rows with EdgeStartTimestamp >= sinceIso, oldest
 * first, capped at `limit` rows. Returns normalized (lowercase-keyed) rows.
 */
export async function fetchRequestLogs(env, { sinceIso, limit }) {
  // sinceIso comes from our own D1 cursor (extraction_state), never from an
  // external request — but it's about to be interpolated into a raw SQL
  // string sent to Cloudflare's API, so validate its shape defensively
  // rather than trusting a value that's only "supposed to" be well-formed.
  if (!ISO_TIMESTAMP_RE.test(sinceIso)) {
    throw new Error(`Refusing to build a Log Explorer query from a malformed cursor: ${sinceIso}`);
  }
  const rowLimit = Number(limit);
  if (!Number.isInteger(rowLimit) || rowLimit <= 0) {
    throw new Error(`Invalid row limit: ${limit}`);
  }

  const sinceDate = sinceIso.slice(0, 10); // YYYY-MM-DD — Date partition hint, narrows the scan
  const query =
    `SELECT ${COLUMNS.join(", ")} FROM http_requests ` +
    `WHERE Date >= '${sinceDate}' AND EdgeStartTimestamp >= '${sinceIso}' ` +
    `ORDER BY EdgeStartTimestamp ASC LIMIT ${rowLimit}`;

  const url = new URL(`${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/logs/explorer/query/sql`);
  url.searchParams.set("query", query);

  // Every documented example for this endpoint is a bare `curl URL
  // --url-query query="..."` with no -X/--data — which is a GET by
  // curl's own default. POST here got "expected 1 statement, but got 0"
  // (verified against production): the API was looking for the query in
  // a POST body that was never sent, not the URL param.
  const resp = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${env.LOGS_API_TOKEN}` },
  });

  const responseBody = await resp.json();
  if (!resp.ok || responseBody.success === false) {
    const detail = (responseBody.errors || []).map((e) => e.message).join("; ") || resp.statusText;
    throw new Error(`Log Explorer query failed (${resp.status}): ${detail}`);
  }

  return (responseBody.result || []).map(normalizeRow);
}
