# telemetry.evilbyte.net

Every 15 minutes, pulls new HTTP request logs from Cloudflare Log Explorer
across the whole Cloudflare account, computes an Evil Rating for each
distinct requestor using the real formula
([`site/public/evil-formula.mjs`](../site/public/evil-formula.mjs), imported
— not reimplemented), and keeps one latest-seen row per client IP in D1. A
small dashboard at `/` shows the resulting rating distribution and compares
it against Cloudflare's own Bot Management / WAF scores, for validating the
formula (draft §4) against real traffic instead of synthetic test vectors.

This is the batch counterpart to `site/`'s live `/api/rate` — see
`src/fieldmap.js` and the table below for exactly where the two necessarily
diverge, since a historical log row doesn't carry every signal a live
request does.

## Architecture

```
src/
  index.js         scheduled() extraction run; fetch() -> /api/stats + dashboard assets
  logs.js          Log Explorer SQL API client
  fieldmap.js      the six factors, from a log row -> evilRating()
  era-client.js    F_AS lookup (era.evilbyte.net), per-run cache
  rdns.js          F_name lookup (DoH PTR), D1-cached 7 days
  timezone-approx.js  F_time's country/region -> IANA timezone approximation
  db.js            extraction cursor + chunked D1 upsert
public/            the dashboard (plain HTML/CSS/JS, no chart library)
migrations/        D1 schema
```

Extraction uses a persisted cursor (`extraction_state.last_cursor_timestamp`),
not a fixed 15-minute lookback, so a delayed or skipped Cron Trigger tick
doesn't lose data — the next run just has a bigger window and catches up.

## Field-mapping deviations from the live worker

| Factor | Live (`site/src/index.js`) | Here | Deviation |
|---|---|---|---|
| F_AS | `cf.asn` → ERA | `ClientASN` → same ERA endpoint | none |
| F_net | `cf-connecting-ip` + IP-class helpers | `ClientIP` + same helpers (ported) | none |
| F_tx | `cf.httpProtocol` | `ClientRequestProtocol` | field name only |
| F_content | hardcoded 2.0 | hardcoded 2.0 | none |
| F_name | live DoH PTR lookup | same lookup, D1-cached up to 7 days | can be stale |
| F_time | `cf.timezone` (Cloudflare's geolocation) | country/region → static tz table | **largest gap** — see `timezone-approx.js` |

## Manual setup

This can't be done from a coding session without your Cloudflare account
access — these are one-time prerequisites, not something the code itself is
missing:

1. **Create a Logs-scoped API token** (read-only Logs / Log Explorer
   permission — check the dashboard's "Create Custom Token" UI for the
   exact permission group name) and add it as the GitHub secret
   `CLOUDFLARE_LOGS_API_TOKEN`. Kept separate from the existing
   `CLOUDFLARE_API_TOKEN` deliberately: that one can edit/delete the Worker
   and its D1 data, so a leaked Logs-read token should only ever be able to
   read historical HTTP logs.
2. **Confirm `http_requests` is queryable at the account level** (not just
   per-zone) via Manage Datasets in the Cloudflare dashboard. This is the
   single biggest unverified assumption in this pipeline — check it with
   the smoke test below before relying on the scheduled extraction. If it
   turns out to be zone-only, `src/logs.js` needs to loop over
   `GET /accounts/{id}/zones` instead of issuing one account-level query —
   a contained change to that file alone.
3. **Confirm Workers Paid is active.** The Free plan's Cron Trigger CPU
   budget (10ms) can't run this pipeline at all.
4. **Create the D1 database once**: `wrangler d1 create evil-byte-telemetry`,
   then paste the returned `database_id` into `wrangler.jsonc` (it ships
   with a placeholder).
5. **Point the subdomain**: `wrangler.jsonc` requests
   `telemetry.evilbyte.net` as a custom domain, consistent with
   `era.evilbyte.net`'s naming — change it there if you'd rather use
   something else.
6. **Decide on dashboard access control.** Recommended: put a Cloudflare
   Access policy in front of `telemetry.evilbyte.net` (Zero Trust dashboard,
   no code involved). This dashboard shows real visitor IPs and ASNs,
   spans every zone on the account, and — per the "latest-seen upsert"
   design — retains those IPs indefinitely, unlike `/api/rate`'s
   transient, visitor-sees-only-their-own-data behavior.

## Local dev

```bash
cd telemetry
npm install
cp .dev.vars.example .dev.vars   # fill in LOGS_API_TOKEN, CF_ACCOUNT_ID
npm run migrate:local
npm run dev
```

## Verification

Roughly in this order, each one settling something the next depends on:

1. **Smoke-test the real API first**, before trusting `src/logs.js`:
   ```bash
   curl "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/logs/explorer/query/sql" \
     --header "Authorization: Bearer $LOGS_API_TOKEN" \
     --get --data-urlencode "query=SELECT * FROM http_requests LIMIT 1"
   ```
   Confirms account-level querying works at all, and the exact field casing
   Cloudflare actually returns.
2. **D1 locally**: `wrangler d1 execute evil-byte-telemetry --local --file=migrations/0001_init.sql`,
   then hand-run an upsert twice via `wrangler d1 execute --local --command "..."`
   to confirm `times_seen` increments and `first_seen` survives while
   `last_seen` updates.
3. **Full local dry run**: `wrangler dev --test-scheduled`, then trigger the
   scheduled handler (press `s` in the interactive terminal, or use
   whichever local route the terminal output prints — this varies by
   wrangler version).
4. **After first deploy**, use the dashboard's Cron Trigger manual-run
   control (Workers & Pages → the Worker → Triggers) rather than waiting up
   to 15 minutes for a natural tick.
5. **Regression check that the formula itself wasn't touched**:
   `cd ../evil-byte-src && pytest -v` and `cd ../evil-byte-go && go test -v ./...`
   should both still pass, since this pipeline only ever imports
   `evil-formula.mjs`, never edits it.
6. **Cross-check a live row**: once some data has landed,
   `wrangler d1 execute evil-byte-telemetry --remote --command "SELECT * FROM requestors ORDER BY last_seen DESC LIMIT 5"`
   and compare against what `https://evilbyte.net/api/rate` computes live
   for the same IP right now — expect the same general band, with minor
   drift from the F_time/F_name approximations above.
