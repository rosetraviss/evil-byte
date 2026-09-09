// Homepage gadget: asks /api/rate — the Worker acting as MITM (Section 5) —
// to rate this very connection, then renders the result.
(function () {
  const dial = document.getElementById("gadget-dial");
  const erEl = document.getElementById("gadget-er");
  const bandEl = document.getElementById("gadget-band");
  const evidenceEl = document.getElementById("gadget-evidence");
  const refreshBtn = document.getElementById("gadget-refresh");
  if (!dial) return;

  function colorFor(band) {
    if (band === "Unrated") return "var(--unrated)";
    if (band === "Saturated Evil") return "var(--saturated)";
    if (band === "Evil") return "var(--evil)";
    return "var(--good)"; // Good / Verified Good
  }

  function row(k, v) {
    return `<div class="row"><span class="k">${k}</span><span>${v}</span></div>`;
  }

  async function assess() {
    dial.style.setProperty("--c", "var(--unrated)");
    erEl.textContent = "--";
    bandEl.textContent = "assessing…";
    bandEl.style.color = "var(--text-dim)";
    bandEl.style.borderColor = "var(--border)";
    evidenceEl.innerHTML = row("status", "querying the MITM…");
    if (refreshBtn) refreshBtn.disabled = true;

    try {
      const res = await fetch("/api/rate", { cache: "no-store" });
      if (!res.ok) throw new Error("rate endpoint returned " + res.status);
      const data = await res.json();
      const c = colorFor(data.band);

      dial.style.setProperty("--c", c);
      erEl.textContent = String(data.er);
      bandEl.textContent = data.band;
      bandEl.style.color = c;
      bandEl.style.borderColor = c;

      const ev = data.evidence || {};
      const f = data.factors || {};
      const parts = [
        row("network", `${ev.ipVersion ?? "?"} — F_net ${fmt(f.f_net)}`),
        row(
          "autonomous system",
          `${ev.asOrganization ? ev.asOrganization : "unrated"}${ev.asn != null ? ` (<a href="https://era.evilbyte.net/#AS${ev.asn}" target="_blank" rel="noopener">AS${ev.asn}</a>)` : ""} — F_AS ${fmt(f.f_as)}${ev.asRating != null ? `, ERA rating ${ev.asRating}` : ""}`
        ),
        row("edge / country", `${ev.colo ?? "?"} / ${ev.country ?? "?"}`),
        row("transport", `${ev.httpProtocol ?? "?"} — F_tx ${fmt(f.f_tx)}`),
        row("TLS", ev.tlsVersion ?? "none"),
        row("content", `not inspected — F_content ${fmt(f.f_content)} (§4.5.2)`),
        row("name (PTR)", `${ev.reverseDns ?? "nameless"} — F_name ${fmt(f.f_name)}`),
        row("local time", `${ev.localTime ?? "?"} (${ev.timezone ?? "?"}) — F_time ${fmt(f.f_time)}`),
      ];
      evidenceEl.innerHTML = parts.join("");
    } catch (err) {
      bandEl.textContent = "assessment failed";
      bandEl.style.color = "var(--text-faint)";
      evidenceEl.innerHTML = row("status", "the MITM could not be reached — fittingly, this is Evil too (§5.6)");
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  function fmt(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    return n.toFixed(2).replace(/\.00$/, ".00");
  }

  if (refreshBtn) refreshBtn.addEventListener("click", assess);
  assess();
})();
