// Telemetry dashboard: fetches /api/stats and renders the rating
// distribution, the ER-vs-Cloudflare-signals comparison, top ASNs, and
// requests by zone. No chart library — small hand-rolled bar rows, same
// zero-dependency approach as the rest of evilbyte.net (see gadget.js).
//
// Every bar is direct-labeled with its band name and value rather than
// relying on color alone: two of the project's four band colors (Evil,
// Saturated Evil) sit close enough in hue that color alone doesn't reliably
// distinguish them even for full-color vision, so the text label carries
// identity here, not the swatch.
(function () {
  const BAND_ORDER = ["Unrated", "Verified Good", "Good", "Evil", "Saturated Evil"];

  function colorFor(band) {
    if (band === "Unrated") return "var(--unrated)";
    if (band === "Saturated Evil") return "var(--saturated)";
    if (band === "Evil") return "var(--evil)";
    return "var(--good)"; // Good / Verified Good
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function fmtNum(n, digits = 0) {
    if (n == null || !isFinite(n)) return "—";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  function barRow({ label, value, display, max, color, title }) {
    const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
    return `
      <div class="bar-row" title="${esc(title)}">
        <span class="label">${esc(label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${color}"></span></span>
        <span class="value">${esc(display)}</span>
      </div>`;
  }

  function renderBandHistogram(el, bandCounts) {
    const byBand = Object.fromEntries((bandCounts || []).map((r) => [r.band, r.count]));
    const total = Object.values(byBand).reduce((a, b) => a + b, 0);
    if (total === 0) {
      el.innerHTML = `<p class="empty-note">No requestors on file yet — the extraction pipeline may not have run yet. Check the stats above.</p>`;
      return;
    }
    const max = Math.max(1, ...BAND_ORDER.map((b) => byBand[b] || 0));
    el.innerHTML = BAND_ORDER.map((b) => {
      const count = byBand[b] || 0;
      const pct = ((count / total) * 100).toFixed(1);
      return barRow({
        label: b, value: count, display: `${fmtNum(count)} (${pct}%)`, max, color: colorFor(b),
        title: `${b}: ${fmtNum(count)} requestors, ${pct}% of all distinct requestors on file`,
      });
    }).join("");
  }

  function renderSignalChart(el, rows, field, fieldLabel) {
    const byBand = Object.fromEntries((rows || []).map((r) => [r.band, r]));
    const present = BAND_ORDER.filter((b) => byBand[b] && byBand[b][field] != null);
    if (present.length === 0) {
      el.innerHTML = `<p class="empty-note">No data yet.</p>`;
      return;
    }
    const max = Math.max(1, ...present.map((b) => byBand[b][field]));
    el.innerHTML = present.map((b) => {
      const val = byBand[b][field];
      return barRow({
        label: b, value: val, display: fmtNum(val, 1), max, color: colorFor(b),
        title: `${b}: average ${fieldLabel} ${fmtNum(val, 1)} across ${fmtNum(byBand[b].count)} requestors`,
      });
    }).join("");
  }

  function renderAsnTable(el, rows) {
    if (!rows || rows.length === 0) {
      el.innerHTML = `<tbody><tr><td class="empty-note">No data yet.</td></tr></tbody>`;
      return;
    }
    el.innerHTML = `
      <thead><tr><th>AS</th><th class="num">Requestors</th><th class="num">Avg ER</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `
        <tr>
          <td><a href="https://era.evilbyte.net/asn/${esc(r.asn)}" target="_blank" rel="noopener">AS${esc(r.asn)}</a></td>
          <td class="num">${fmtNum(r.count)}</td>
          <td class="num">${fmtNum(r.avg_er, 1)}</td>
        </tr>`
        )
        .join("")}</tbody>`;
  }

  function renderZoneTable(el, rows) {
    if (!rows || rows.length === 0) {
      el.innerHTML = `<tbody><tr><td class="empty-note">No per-zone data yet — see "Methodology &amp; known gaps" below.</td></tr></tbody>`;
      return;
    }
    el.innerHTML = `
      <thead><tr><th>Source (anonymized)</th><th class="num">Requestors</th></tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr><td><code title="One-way hash of the zone's Cloudflare-internal id — not the domain name.">${esc(r.zone_hash)}</code></td><td class="num">${fmtNum(r.count)}</td></tr>`
        )
        .join("")}</tbody>`;
  }

  function tile(label, value) {
    return `<div class="card"><p class="tile-label">${esc(label)}</p><p class="tile-value">${value}</p></div>`;
  }

  function renderStatTiles(el, data) {
    const totals = data.totals || {};
    const health = data.health || {};
    const total = totals.total || 0;
    const asFallbackPct = total > 0 ? (((totals.as_fallback_count || 0) / total) * 100).toFixed(1) : "0.0";
    const nameFallbackPct = total > 0 ? (((totals.name_fallback_count || 0) / total) * 100).toFixed(1) : "0.0";
    const lastRun = health.last_run_at ? new Date(health.last_run_at).toLocaleString() : "never";
    const capped = Boolean(health.last_run_rows_capped);

    let html =
      tile("distinct requestors on file", fmtNum(total)) +
      tile("last extraction run", esc(lastRun)) +
      tile("rows in last run", fmtNum(health.last_run_rows_seen)) +
      tile("F_AS on budget fallback", `${asFallbackPct}%`) +
      tile("F_name on budget fallback", `${nameFallbackPct}%`);

    if (capped) {
      html += `<div class="card" style="border-color:var(--unrated)">
        <p class="tile-label" style="color:var(--unrated)">pipeline status</p>
        <p style="font-size:0.95rem;color:var(--unrated);margin:0">Behind — the last run hit its row cap and is still catching up.</p>
      </div>`;
    }
    el.innerHTML = html;
  }

  async function load() {
    const els = {
      tiles: document.getElementById("stat-tiles"),
      histogram: document.getElementById("band-histogram"),
      bot: document.getElementById("bot-score-chart"),
      waf: document.getElementById("waf-score-chart"),
      asn: document.getElementById("asn-table"),
      zone: document.getElementById("zone-table"),
    };
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("stats endpoint returned " + res.status);
      const data = await res.json();

      renderStatTiles(els.tiles, data);
      renderBandHistogram(els.histogram, data.bandCounts);
      renderSignalChart(els.bot, data.signalCorrelation, "avg_bot_score", "Bot Management score");
      renderSignalChart(els.waf, data.signalCorrelation, "avg_waf_score", "WAF attack score");
      renderAsnTable(els.asn, data.topAsns);
      renderZoneTable(els.zone, data.byZone);
    } catch (err) {
      els.tiles.innerHTML = `<div class="card"><p class="empty-note">Couldn't load telemetry data: ${esc(err.message)}</p></div>`;
    }
  }

  load();
})();
