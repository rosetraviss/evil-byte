-- Evil Byte telemetry: one row per distinct requestor (latest-seen upsert),
-- a single-row extraction cursor, and a reverse-DNS cache.
-- See /telemetry/README.md and the approved plan for the field-mapping
-- rationale — in particular why bot_score/waf_attack_score/ja4 etc. are
-- stored but are NOT Evil Rating formula inputs (they're kept purely to
-- correlate the computed rating against Cloudflare's own signals).

CREATE TABLE requestors (
  client_ip TEXT PRIMARY KEY,
  ip_version TEXT NOT NULL,

  -- the six formula inputs actually fed into evilRating(), plus its result
  f_as REAL NOT NULL,
  f_net REAL NOT NULL,
  f_tx REAL NOT NULL,
  f_content REAL NOT NULL,
  f_name REAL NOT NULL,
  f_time REAL NOT NULL,
  f_tamper REAL NOT NULL,
  arriving INTEGER NOT NULL DEFAULT 0,
  er INTEGER NOT NULL,
  band TEXT NOT NULL,

  -- informational only (NOT formula inputs) — for correlating ER against
  -- Cloudflare's own signals on the dashboard
  asn INTEGER,
  as_rating INTEGER,
  client_country TEXT,
  client_region_code TEXT,
  bot_score INTEGER,
  bot_score_src TEXT,
  ja4 TEXT,
  waf_attack_score INTEGER,
  zone_name TEXT,
  edge_colo_code TEXT,
  http_protocol TEXT,
  reverse_name TEXT,

  -- provenance: did this row get a real lookup this run, or a budget fallback?
  f_as_is_fallback INTEGER NOT NULL DEFAULT 0,
  f_name_is_fallback INTEGER NOT NULL DEFAULT 0,

  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_ray_id TEXT,
  times_seen INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_requestors_last_seen ON requestors(last_seen);
CREATE INDEX idx_requestors_band ON requestors(band);
CREATE INDEX idx_requestors_asn ON requestors(asn);
CREATE INDEX idx_requestors_zone ON requestors(zone_name);
CREATE INDEX idx_requestors_fallback ON requestors(f_as_is_fallback, f_name_is_fallback);

-- Single-row cursor. CHECK(id=1) makes a second row impossible.
CREATE TABLE extraction_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_cursor_timestamp TEXT NOT NULL,   -- ISO8601 EdgeStartTimestamp watermark
  last_run_at TEXT,
  last_run_rows_seen INTEGER,
  last_run_rows_capped INTEGER NOT NULL DEFAULT 0  -- 1 = hit ROW_LIMIT_PER_RUN, still behind
);

-- rDNS results, cached independently of requestors so a stale/no-PTR answer
-- doesn't have to be re-fetched every 5 minutes for the same quiet IP.
CREATE TABLE rdns_cache (
  client_ip TEXT PRIMARY KEY,
  reverse_name TEXT,                     -- NULL = confirmed no PTR (still a valid cached answer)
  resolved_at TEXT NOT NULL
);
