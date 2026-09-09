// The Evil Rating Authority (Section 6) — era.evilbyte.net.
//
// Publishes the multiplier for every Autonomous System, seeded per
// Section 4.2's exact exceptions plus the pattern rules described in
// ../scripts/build-asn-db.mjs. This is the ERA the main site's /api/rate
// consults for F_AS (Section 4.2: "F_AS is the multiplier published by
// the ERA"). There is no live Elo history behind these numbers — nobody
// is running ESRP (Section 6.4) against real traffic — so what's served
// here is each AS's *initial* rating (Section 6.1), not a continuously
// re-estimated one. The formula in Section 4.1 doesn't know the
// difference.

let dbPromise = null;
function loadDB(env, origin) {
  if (!dbPromise) {
    dbPromise = env.ASSETS.fetch(new URL("/data/asn.json", origin))
      .then((r) => r.json());
  }
  return dbPromise;
}

// Section 6.1: F_AS = clamp(2^((R-1500)/400), 0.25, 4.0)
function asMultiplier(rating) {
  const f = Math.pow(2, (rating - 1500) / 400);
  return Math.max(0.25, Math.min(4.0, f));
}

const DEFAULT_REASON = "no exceptions matched — Section 4.2 default (F_AS = 1.0)";

function entryFor(db, asn) {
  const row = db[String(asn)];
  if (!row) return null;
  const [name, country, rating, reasons] = row;
  return {
    asn,
    name,
    country,
    rating,
    multiplier: Number(asMultiplier(rating).toFixed(3)),
    reasons: reasons.length ? reasons : [DEFAULT_REASON],
  };
}

function json(body, status = 200, extra = {}) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "public, max-age=3600", ...extra },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 32934.as.evil.arpa (Section 6.5's naming, minus the .arpa delegation
    // nobody actually has). Also accepts a bare /as/32934.
    let m = /^\/(\d+)\.as\.evil\.arpa\/?$/.exec(path) || /^\/as\/(\d+)\/?$/.exec(path) || /^\/asn\/(\d+)\/?$/.exec(path);
    if (m) {
      const asn = Number(m[1]);
      const db = await loadDB(env, url.origin);
      const entry = entryFor(db, asn);
      if (!entry) {
        return json({ error: "unrated", asn, note: "no ERA record; Section 4.2 default applies (F_AS = 1.0)" }, 404);
      }
      return json(entry);
    }

    // The literal Section 6.5 wire format, as a TXT-record-shaped string.
    m = /^\/(\d+)\.as\.evil\.arpa\.txt\/?$/.exec(path);
    if (m) {
      const asn = Number(m[1]);
      const db = await loadDB(env, url.origin);
      const entry = entryFor(db, asn);
      const rating = entry ? entry.rating : 1500;
      const mult = entry ? entry.multiplier : 1.0;
      const t = Math.floor(Date.now() / 1000);
      const line = `${asn}.as.evil.arpa.  3600  IN  TXT  "v=evil1; r=${rating}; m=${mult}; n=0; t=${t}"`;
      return new Response(line + "\n", {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
      });
    }

    if (path === "/stats") {
      const db = await loadDB(env, url.origin);
      return json(computeStats(db));
    }

    if (path === "/axfr") {
      // "The whole table MAY be obtained by zone transfer, which the
      // Working Group believes to be the last remaining legitimate use
      // of AXFR" (Section 6.5). ~10MB; fine as an occasional bulk export.
      const db = await loadDB(env, url.origin);
      return json(db, 200, { "content-disposition": "inline; filename=evil.arpa-zone.json" });
    }

    if (path === "/" || path === "/index.html") {
      return env.ASSETS.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

function computeStats(db) {
  let n = 0, sum = 0, min = null, max = null;
  for (const [asnStr, row] of Object.entries(db)) {
    const [name, country, rating] = row;
    n++;
    sum += rating;
    if (!min || rating < min.rating) min = { asn: Number(asnStr), name, country, rating };
    if (!max || rating > max.rating) max = { asn: Number(asnStr), name, country, rating };
  }
  return {
    asns_rated: n,
    mean_rating: Math.round((sum / n) * 100) / 100,
    most_good: min,
    most_evil: max,
    generated_from: "https://ftp.ripe.net/ripe/asnames/asn.txt",
  };
}
