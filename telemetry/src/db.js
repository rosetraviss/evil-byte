// D1 persistence: the extraction cursor (self-healing against Cron Trigger
// jitter/skipped invocations — see the approved plan's "Extraction logic"
// section) and the chunked upsert of computed rows into `requestors`.

const CHUNK_SIZE = 500; // keep each D1 batch() call well under any per-call statement ceiling

export async function readCursor(db, fallbackMinutesAgo = 15) {
  const row = await db.prepare("SELECT last_cursor_timestamp FROM extraction_state WHERE id = 1").first();
  if (row) return row.last_cursor_timestamp;

  // First run ever: seed to "now - 15 minutes" rather than a historical
  // backfill — Log Explorer retention can span up to 2 years for contract
  // customers, and querying "everything" on the first invocation would blow
  // every budget in this pipeline (rows, ERA lookups, rDNS lookups) at once.
  return new Date(Date.now() - fallbackMinutesAgo * 60 * 1000).toISOString();
}

export async function writeCursorAndStats(db, { cursorIso, rowsSeen, rowsCapped }) {
  await db
    .prepare(
      `INSERT INTO extraction_state (id, last_cursor_timestamp, last_run_at, last_run_rows_seen, last_run_rows_capped)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         last_cursor_timestamp = excluded.last_cursor_timestamp,
         last_run_at = excluded.last_run_at,
         last_run_rows_seen = excluded.last_run_rows_seen,
         last_run_rows_capped = excluded.last_run_rows_capped`
    )
    .bind(cursorIso, new Date().toISOString(), rowsSeen, rowsCapped ? 1 : 0)
    .run();
}

const UPSERT_SQL = `
INSERT INTO requestors (
  client_ip, ip_version, f_as, f_net, f_tx, f_content, f_name, f_time, f_tamper,
  arriving, er, band, asn, as_rating, client_country, client_region_code,
  bot_score, bot_score_src, ja4, waf_attack_score, zone_hash, edge_colo_code,
  http_protocol, reverse_name, f_as_is_fallback, f_name_is_fallback,
  first_seen, last_seen, last_ray_id, times_seen
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
ON CONFLICT(client_ip) DO UPDATE SET
  ip_version = excluded.ip_version,
  f_as = excluded.f_as, f_net = excluded.f_net, f_tx = excluded.f_tx,
  f_content = excluded.f_content, f_name = excluded.f_name, f_time = excluded.f_time,
  f_tamper = excluded.f_tamper, arriving = excluded.arriving,
  er = excluded.er, band = excluded.band,
  asn = excluded.asn, as_rating = excluded.as_rating,
  client_country = excluded.client_country, client_region_code = excluded.client_region_code,
  bot_score = excluded.bot_score, bot_score_src = excluded.bot_score_src, ja4 = excluded.ja4,
  waf_attack_score = excluded.waf_attack_score, zone_hash = excluded.zone_hash,
  edge_colo_code = excluded.edge_colo_code, http_protocol = excluded.http_protocol,
  reverse_name = excluded.reverse_name,
  f_as_is_fallback = excluded.f_as_is_fallback, f_name_is_fallback = excluded.f_name_is_fallback,
  last_seen = excluded.last_seen, last_ray_id = excluded.last_ray_id,
  times_seen = requestors.times_seen + 1
`;
// first_seen is deliberately absent from the UPDATE SET clause above: it's
// written once on INSERT and never touched again. Per the "latest-seen
// upsert" semantics this pipeline was built for, the rating/factors refresh
// on every sighting; the first-seen timestamp doesn't.

function bindingsFor(rec, nowIso) {
  return [
    rec.client_ip, rec.ip_version, rec.f_as, rec.f_net, rec.f_tx, rec.f_content,
    rec.f_name, rec.f_time, rec.f_tamper, rec.arriving, rec.er, rec.band,
    rec.asn, rec.as_rating, rec.client_country, rec.client_region_code,
    rec.bot_score, rec.bot_score_src, rec.ja4, rec.waf_attack_score,
    rec.zone_hash, rec.edge_colo_code, rec.http_protocol, rec.reverse_name,
    rec.f_as_is_fallback, rec.f_name_is_fallback,
    nowIso, nowIso, rec.last_ray_id,
  ];
}

export async function upsertRequestors(db, records) {
  const nowIso = new Date().toISOString();
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const statements = chunk.map((rec) => db.prepare(UPSERT_SQL).bind(...bindingsFor(rec, nowIso)));
    await db.batch(statements);
  }
}
