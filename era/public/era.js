const input = document.getElementById("era-input");
const goBtn = document.getElementById("era-go");
const resultEl = document.getElementById("era-result");
const nameEl = document.getElementById("era-name");
const metaEl = document.getElementById("era-meta");
const reasonsEl = document.getElementById("era-reasons");
const errorEl = document.getElementById("era-error");

function bandFor(rating) {
  if (rating >= 2400) return "Grandmaster of Evil";
  if (rating >= 1900) return "Evil";
  if (rating >= 1500) return "Ordinary";
  if (rating >= 1100) return "Good";
  return "Verified Good";
}

async function lookup() {
  const raw = input.value.trim().toUpperCase().replace(/^AS/, "");
  const asn = Number(raw);
  errorEl.textContent = "";
  resultEl.classList.remove("visible");
  if (!raw || !Number.isInteger(asn) || asn < 0) {
    errorEl.textContent = "Enter an AS number.";
    return;
  }
  try {
    const res = await fetch(`/asn/${asn}`);
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = `AS${asn}: ${data.note || "unrated"} (F_AS = 1.0)`;
      return;
    }
    nameEl.textContent = `AS${data.asn} — ${data.name}`;
    metaEl.textContent = `${data.country} · rating ${data.rating} (${bandFor(data.rating)}) · F_AS ${data.multiplier.toFixed(3)}`;
    reasonsEl.innerHTML = data.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    resultEl.classList.add("visible");
  } catch {
    errorEl.textContent = "The ERA could not be reached. Fittingly, this is Evil too (Section 5.6).";
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

goBtn.addEventListener("click", lookup);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") lookup();
});

async function loadStats() {
  const el = document.getElementById("era-stats");
  try {
    const res = await fetch("/stats");
    const s = await res.json();
    el.innerHTML = `
      <div class="stat-row"><span>ASNs rated</span><span>${s.asns_rated.toLocaleString()}</span></div>
      <div class="stat-row"><span>Mean rating</span><span>${s.mean_rating}</span></div>
      <div class="stat-row"><span>Most Good</span><span>AS${s.most_good.asn} — ${escapeHtml(s.most_good.name)} (${s.most_good.rating})</span></div>
      <div class="stat-row"><span>Most Evil</span><span>AS${s.most_evil.asn} — ${escapeHtml(s.most_evil.name)} (${s.most_evil.rating})</span></div>
    `;
  } catch {
    el.innerHTML = '<p class="era-error">Stats unavailable.</p>';
  }
}

loadStats();

// Deep link from the main site's gadget: era.evilbyte.net/#AS32934
const hashMatch = /^#(?:AS)?(\d+)$/i.exec(location.hash);
if (hashMatch) {
  input.value = hashMatch[1];
  lookup();
}
