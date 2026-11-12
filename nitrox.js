/* Limitless Diving — Nitrox calculator (nitrox.html), open to everyone.
   Maximum operating depth, best mix, equivalent air depth, and oxygen exposure (PO2, CNS %) for
   enriched air nitrox. Depths are in feet of seawater (33 ft per atmosphere) or freshwater (34 ft),
   or metres (10 m seawater, 10.3 m freshwater). Results round the safe way: MOD and best mix round
   down, EAD and CNS round up. No dependencies. */
(function () {
  "use strict";

  const main = document.getElementById("nitrox");
  const v = { units: "ft", water: "salt", fo2: 32, po2: 1.4, depth: 100, bmPo2: 1.4, eadFo2: 32, eadDepth: 100, exFo2: 32, exDepth: 100, exTime: 40 };
  try { const saved = JSON.parse(localStorage.getItem("ld-nitrox") || "null"); if (saved && typeof saved === "object") Object.assign(v, saved); } catch (e) { /* private window: use defaults */ }

  // NOAA single-dive oxygen exposure limits (minutes) by PO2 (ata).
  const NOAA = [[0.6, 720], [0.7, 570], [0.8, 450], [0.9, 360], [1.0, 300], [1.1, 240], [1.2, 210], [1.3, 180], [1.4, 150], [1.5, 120], [1.6, 45]];

  function atm() { return v.units === "ft" ? (v.water === "salt" ? 33 : 34) : (v.water === "salt" ? 10 : 10.3); }
  function ata(depth) { return depth / atm() + 1; }
  function unit() { return v.units === "ft" ? "ft" : "m"; }
  function fmtDepth(d) { return (v.units === "ft" ? Math.round(d) : Math.round(d * 10) / 10) + " " + unit(); }
  function floorDepth(d) { return v.units === "ft" ? Math.floor(d) : Math.floor(d * 10) / 10; }
  function ceilDepth(d) { return v.units === "ft" ? Math.ceil(d) : Math.ceil(d * 10) / 10; }
  function num(x) { const n = Number(x); return isFinite(n) ? n : NaN; }

  function noaaLimit(po2) {
    if (po2 <= 0.5) return Infinity;
    if (po2 > 1.6) return 0;
    if (po2 <= 0.6) return 720;
    for (let i = 1; i < NOAA.length; i++) {
      const [p1, t1] = NOAA[i - 1], [p2, t2] = NOAA[i];
      if (po2 <= p2) return t1 + (t2 - t1) * (po2 - p1) / (p2 - p1);
    }
    return 45;
  }

  // ---------- the four calculators ----------
  function mod() {
    const f = num(v.fo2) / 100, p = num(v.po2);
    if (!(f >= 0.21 && f <= 1) || !(p > 0)) return { bad: "Enter an oxygen percentage from 21 to 100." };
    const d = (p / f - 1) * atm();
    const c = (1.6 / f - 1) * atm();
    return { main: fmtDepth(floorDepth(d)), sub: `Contingency limit at PO2 1.6: ${fmtDepth(floorDepth(c))}` };
  }
  function bestMix() {
    const d = num(v.depth), p = num(v.bmPo2);
    if (!(d > 0)) return { bad: "Enter the planned maximum depth." };
    const f = Math.floor(p / ata(d) * 100);
    if (f < 21) return { bad: `Deeper than air allows at PO2 ${p}. Plan a shallower dive.`, warn: true };
    return { main: "EAN" + Math.min(f, 100), sub: f >= 40 ? "Above 40% oxygen needs technical training and oxygen-clean gear." : `${Math.min(f, 100)}% oxygen keeps PO2 at or below ${p} at ${fmtDepth(d)}.` };
  }
  function ead() {
    const f = num(v.eadFo2) / 100, d = num(v.eadDepth);
    if (!(f >= 0.21 && f <= 1) || !(d >= 0)) return { bad: "Enter the mix and depth." };
    const e = Math.max(0, (1 - f) / 0.79 * (d + atm()) - atm());
    const po2 = f * ata(d);
    return { main: fmtDepth(ceilDepth(e)), sub: `Use the air tables or computer at this depth.${po2 > 1.4 ? ` Warning: PO2 is ${po2.toFixed(2)} at ${fmtDepth(d)}, above 1.4.` : ""}`, warn: po2 > 1.4 };
  }
  function exposure() {
    const f = num(v.exFo2) / 100, d = num(v.exDepth), t = num(v.exTime);
    if (!(f >= 0.21 && f <= 1) || !(d >= 0) || !(t >= 0)) return { bad: "Enter the mix, depth and bottom time." };
    const po2 = f * ata(d), lim = noaaLimit(po2);
    if (po2 > 1.6) return { main: "PO2 " + po2.toFixed(2), sub: "Above 1.6: never dive this mix at this depth.", warn: true };
    const cns = lim === Infinity ? 0 : Math.ceil(t / lim * 100);
    return {
      main: "PO2 " + po2.toFixed(2),
      sub: lim === Infinity ? "Below 0.5: no oxygen exposure counted." : `CNS oxygen clock: ${cns}% for ${t} min (single-dive limit ${Math.floor(lim)} min).${cns >= 80 ? " Over 80%: plan a shorter dive." : ""}`,
      warn: po2 > 1.4 || cns >= 80
    };
  }

  // ---------- page ----------
  function input(key, label, attrs) {
    return `<div class="field"><label for="nx-${key}">${label}</label><input id="nx-${key}" data-k="${key}" type="number" inputmode="decimal" value="${v[key]}" ${attrs || ""}></div>`;
  }
  function po2Select(key, label) {
    return `<div class="field"><label for="nx-${key}">${label}</label><select id="nx-${key}" data-k="${key}">
      ${[1.2, 1.3, 1.4, 1.5, 1.6].map(p => `<option value="${p}"${Number(v[key]) === p ? " selected" : ""}>${p.toFixed(1)}${p === 1.4 ? " working" : p === 1.6 ? " contingency" : ""}</option>`).join("")}</select></div>`;
  }
  function result(id) { return `<output class="nx-result" id="nx-out-${id}" aria-live="polite"></output>`; }
  function card(id, title, about, fields) {
    return `<section class="panel nx-card" aria-labelledby="nx-h-${id}"><h2 id="nx-h-${id}">${title}</h2><p class="hint">${about}</p>
      <div class="nx-fields">${fields}</div>${result(id)}</section>`;
  }

  function render() {
    const u = unit();
    main.innerHTML = `<section class="pub-hero"><h1>Nitrox calculator</h1>
        <p>Plan enriched air nitrox dives: how deep a mix can go, the best mix for a depth, the equivalent air depth, and your oxygen exposure.</p></section>
      <div class="panel nx-settings">
        <div class="field"><label for="nx-units">Units</label><select id="nx-units" data-k="units"><option value="ft"${v.units === "ft" ? " selected" : ""}>Feet</option><option value="m"${v.units === "m" ? " selected" : ""}>Metres</option></select></div>
        <div class="field"><label for="nx-water">Water</label><select id="nx-water" data-k="water"><option value="salt"${v.water === "salt" ? " selected" : ""}>Salt water</option><option value="fresh"${v.water === "fresh" ? " selected" : ""}>Fresh water</option></select></div>
      </div>
      <div class="nx-grid">
        ${card("mod", "Maximum operating depth", "The deepest you can take a mix before oxygen becomes dangerous.",
          input("fo2", "Oxygen %", 'min="21" max="100" step="1"') + po2Select("po2", "Max PO2"))}
        ${card("best", "Best mix", "The richest mix that's safe for your planned maximum depth.",
          input("depth", `Max depth (${u})`, 'min="1" step="1"') + po2Select("bmPo2", "Max PO2"))}
        ${card("ead", "Equivalent air depth", "The depth to use on air tables, for less nitrogen than air.",
          input("eadFo2", "Oxygen %", 'min="21" max="100" step="1"') + input("eadDepth", `Depth (${u})`, 'min="0" step="1"'))}
        ${card("ex", "Oxygen exposure", "Oxygen partial pressure at depth, and how much of your daily oxygen limit (CNS clock) a dive uses.",
          input("exFo2", "Oxygen %", 'min="21" max="100" step="1"') + input("exDepth", `Depth (${u})`, 'min="0" step="1"') + input("exTime", "Bottom time (min)", 'min="0" step="1"'))}
      </div>
      <p class="nx-note"><b>For training and dive planning only.</b> Always analyze your own tank and label it. Plan within NAUI limits (PO2 1.4 working, 1.6 contingency) and follow your dive computer or tables. Nitrox use requires a nitrox certification.</p>`;
    update();
  }

  function update() {
    [["mod", mod], ["best", bestMix], ["ead", ead], ["ex", exposure]].forEach(([id, fn]) => {
      const el = document.getElementById("nx-out-" + id); if (!el) return;
      const r = fn();
      el.className = "nx-result" + (r.bad ? " bad" : r.warn ? " warn" : "");
      el.innerHTML = r.bad ? `<span class="nx-sub">${r.bad}</span>` : `<b class="nx-main">${r.main}</b><span class="nx-sub">${r.sub}</span>`;
    });
    try { localStorage.setItem("ld-nitrox", JSON.stringify(v)); } catch (e) { /* not saved: fine */ }
  }

  main.addEventListener("input", (e) => {
    const k = e.target.dataset && e.target.dataset.k; if (!k) return;
    v[k] = e.target.value;
    if (k === "units" || k === "water") {
      // Convert the depths so a switch of units keeps the same dive.
      if (k === "units") {
        // Switching back without changing anything restores the exact numbers you had (100 ft → 30 m → 100 ft).
        const keys = ["depth", "eadDepth", "exDepth"], to = e.target.value, f = to === "m" ? 0.3048 : 1 / 0.3048;
        const back = v.memo && v.memo.units === to && keys.every(x => String(v[x]) === String(v.memo.shown[x]));
        const before = {}; keys.forEach(x => { before[x] = v[x]; });
        if (back) keys.forEach(x => { v[x] = v.memo.values[x]; });
        else keys.forEach(x => { const n = Number(v[x]); if (isFinite(n)) v[x] = Math.round(n * f); });
        v.memo = { units: to === "m" ? "ft" : "m", values: before, shown: {} };
        keys.forEach(x => { v.memo.shown[x] = v[x]; });
      }
      render(); const el = document.getElementById("nx-" + k); if (el) el.focus(); return;
    }
    update();
  });

  render();
})();
