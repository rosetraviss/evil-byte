import {
  AS_TABLE,
  NET_TABLE,
  TX_TABLE,
  CONTENT_TABLE,
  COOPERATION_DISCOUNT,
  VDA_ELIGIBLE,
  timeFactorForParts,
  evilRating,
  band,
  WEIGHTS,
  BASE_EVIL,
} from "./evil-formula.mjs";

const NAME_OPTIONS = [
  { label: ".eu", value: 0.5 },
  { label: ".local / .home.arpa (it is your printer)", value: 0.5 },
  { label: ".int", value: 0.75 },
  { label: ".org", value: 0.8 },
  { label: ".edu", value: 0.9 },
  { label: ".com / .net (baseline)", value: 1.0 },
  { label: "ccTLD, or any other unlisted TLD", value: 1.0 },
  { label: "No name (no PTR, Host, or SNI)", value: 1.25 },
  { label: ".io", value: 1.25 },
  { label: ".ai", value: 1.5 },
  { label: ".biz", value: 1.5 },
  { label: ".gov", value: 2.0 },
  { label: ".zip", value: 2.0 },
  { label: ".mil", value: 4.0 },
];

const TIME_OPTIONS = [
  { label: "Otherwise", key: "normal" },
  { label: "02:00–04:59 at the source", key: "night" },
  { label: "Friday, from 16:00", key: "friday" },
  { label: "1 April", key: "april1" },
];

const $ = (id) => document.getElementById(id);

function fillSelect(select, options, labelKey = "label") {
  select.innerHTML = options
    .map((o, i) => `<option value="${i}">${o[labelKey]}</option>`)
    .join("");
}

function fmt(n, d = 3) {
  if (!isFinite(n)) return "∞";
  return Number(n.toFixed(d)).toString();
}

function colorFor(b) {
  if (b === "Unrated") return "var(--unrated)";
  if (b === "Saturated Evil") return "var(--saturated)";
  if (b === "Evil") return "var(--evil)";
  return "var(--good)";
}

function init() {
  const elAs = $("f-as"), elNet = $("f-net"), elTx = $("f-tx"), elContent = $("f-content");
  const elVda = $("f-vda"), elName = $("f-name"), elProtest = $("f-protest");
  const elTime = $("f-time"), elDst = $("f-dst"), elArriving = $("f-arriving");
  const noteAs = $("f-as-note"), noteNet = $("f-net-note"), noteTx = $("f-tx-note");

  fillSelect(elAs, AS_TABLE);
  fillSelect(elNet, NET_TABLE);
  fillSelect(elTx, TX_TABLE);
  fillSelect(elContent, CONTENT_TABLE);
  fillSelect(elName, NAME_OPTIONS);
  fillSelect(elTime, TIME_OPTIONS);

  elAs.value = AS_TABLE.findIndex((r) => r.key === "unrated");
  elTx.value = TX_TABLE.findIndex((r) => r.key === "tcp");
  elNet.value = NET_TABLE.findIndex((r) => r.key === "ipv4");
  elContent.value = CONTENT_TABLE.findIndex((r) => r.key === "unanalysed");
  elName.value = NAME_OPTIONS.findIndex((r) => r.label.startsWith(".com"));
  elTime.value = TIME_OPTIONS.findIndex((r) => r.key === "normal");

  function syncVda() {
    const row = CONTENT_TABLE[Number(elContent.value)];
    const eligible = VDA_ELIGIBLE.has(row.key);
    elVda.disabled = !eligible;
    elVda.closest("label").style.opacity = eligible ? "1" : "0.45";
    if (!eligible) elVda.checked = false;
  }

  function recompute() {
    const asRow = AS_TABLE[Number(elAs.value)];
    const netRow = NET_TABLE[Number(elNet.value)];
    const txRow = TX_TABLE[Number(elTx.value)];
    const contentRow = CONTENT_TABLE[Number(elContent.value)];
    const nameRow = NAME_OPTIONS[Number(elName.value)];
    const timeRow = TIME_OPTIONS[Number(elTime.value)];

    noteAs.textContent = asRow.note || "";
    noteNet.textContent = netRow.note || "";
    noteTx.textContent = txRow.note || "";

    let f_content = contentRow.value;
    if (elVda.checked && VDA_ELIGIBLE.has(contentRow.key)) f_content *= COOPERATION_DISCOUNT;

    let f_name = nameRow.value;
    if (elProtest.checked) f_name = Math.max(f_name, 1.5);

    let hour = 12, isFriday = false, isAprilFirst = false;
    if (timeRow.key === "night") hour = 3;
    else if (timeRow.key === "friday") { hour = 17; isFriday = true; }
    else if (timeRow.key === "april1") isAprilFirst = true;
    const f_time = timeFactorForParts(hour, isFriday, isAprilFirst, elDst.checked);

    const arriving = Math.max(0, Math.min(255, Number(elArriving.value) || 0));

    const f_as = asRow.value, f_net = netRow.value, f_tx = txRow.value;
    const { er, f_tamper, raw } = evilRating({ f_as, f_net, f_tx, f_content, f_name, f_time, arriving });
    const b = band(er);
    const c = colorFor(b);

    $("calc-dial").style.setProperty("--c", c);
    $("calc-er").textContent = String(er);
    const bandEl = $("calc-band");
    bandEl.textContent = b;
    bandEl.style.color = c;
    bandEl.style.borderColor = c;

    $("calc-math").textContent =
      `ER = clamp(floor(${BASE_EVIL} × ${fmt(f_tamper, 1)} × (` +
      `${fmt(f_as)}^${WEIGHTS.as} × ${fmt(f_net)}^${WEIGHTS.net} × ${fmt(f_tx)}^${WEIGHTS.tx} × ` +
      `${fmt(f_content)}^${WEIGHTS.content} × ${fmt(f_name)}^${WEIGHTS.name} × ${fmt(f_time)}^${WEIGHTS.time}` +
      `) + 0.5), 1, 255)\n= ${isFinite(raw) ? fmt(raw, 2) : "∞"} → max(·, arriving=${arriving}) → ER ${er}`;

    $("calc-breakdown").innerHTML = [
      ["F_AS", fmt(f_as)], ["F_net", fmt(f_net)], ["F_tx", fmt(f_tx)],
      ["F_content", fmt(f_content)], ["F_name", fmt(f_name)], ["F_time", fmt(f_time)],
      ["F_tamper", fmt(f_tamper, 1)],
    ].map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join("");
  }

  [elAs, elNet, elTx, elContent, elVda, elName, elProtest, elTime, elDst, elArriving].forEach((el) =>
    el.addEventListener("input", () => {
      syncVda();
      recompute();
    })
  );

  syncVda();
  recompute();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
