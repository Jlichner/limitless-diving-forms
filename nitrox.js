/* Limitless Diving — Nitrox calculator (nitrox.html), open to everyone.
   Maximum operating depth, best mix, equivalent air depth, and oxygen exposure (PO2, CNS %) for
   enriched air nitrox. Depths are in feet of seawater (33 ft per atmosphere) or freshwater (34 ft),
   or metres (10 m seawater, 10.3 m freshwater). Results round the safe way: MOD and best mix round
   down, EAD and CNS round up. No dependencies.
   A toggle at the top switches to the Learning view (nitrox.html#learn): MOD and EAD worked one step at a
   time, where the student types each step's answer, gets it checked, and gets a hint for common mistakes. */
(function () {
  "use strict";

  const main = document.getElementById("nitrox");
  const v = { units: "ft", water: "salt", fo2: 32, po2: 1.4, depth: 100, bmPo2: 1.4, eadFo2: 32, eadDepth: 100, exFo2: 32, exDepth: 100, exTime: 40,
    mode: "calc", lModFo2: 32, lModPo2: 1.4, lEadFo2: 32, lEadDepth: 100 };
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

  function modeSwitch() {
    const b = (m, label) => `<button type="button" data-mode="${m}" aria-pressed="${v.mode === m}"${v.mode === m ? ' class="on"' : ""}>${label}</button>`;
    return `<div class="nx-mode" role="group" aria-label="Page view">${b("calc", "Calculator")}${b("learn", "Learning")}</div>`;
  }
  function settings() {
    return `<div class="panel nx-settings">
        <div class="field"><label for="nx-units">Units</label><select id="nx-units" data-k="units"><option value="ft"${v.units === "ft" ? " selected" : ""}>Feet</option><option value="m"${v.units === "m" ? " selected" : ""}>Metres</option></select></div>
        <div class="field"><label for="nx-water">Water</label><select id="nx-water" data-k="water"><option value="salt"${v.water === "salt" ? " selected" : ""}>Salt water</option><option value="fresh"${v.water === "fresh" ? " selected" : ""}>Fresh water</option></select></div>
      </div>`;
  }

  function render() {
    if (v.mode === "learn") return renderLearn();
    const u = unit();
    main.innerHTML = `${modeSwitch()}<section class="pub-hero"><h1>Nitrox calculator</h1>
        <p>Plan enriched air nitrox dives: how deep a mix can go, the best mix for a depth, the equivalent air depth, and your oxygen exposure.</p></section>
      ${settings()}
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
    if (v.mode === "learn") { save(); return; }
    [["mod", mod], ["best", bestMix], ["ead", ead], ["ex", exposure]].forEach(([id, fn]) => {
      const el = document.getElementById("nx-out-" + id); if (!el) return;
      const r = fn();
      el.className = "nx-result" + (r.bad ? " bad" : r.warn ? " warn" : "");
      el.innerHTML = r.bad ? `<span class="nx-sub">${r.bad}</span>` : `<b class="nx-main">${r.main}</b><span class="nx-sub">${r.sub}</span>`;
    });
    save();
  }
  function save() { try { localStorage.setItem("ld-nitrox", JSON.stringify(v)); } catch (e) { /* not saved: fine */ } }

  // ---------- Learning view: MOD and EAD, one step at a time ----------
  // Each step's expected answer is worked from the student's own earlier answers, so a slightly rounded
  // answer carries forward without being marked wrong later. "Show me" fills in the exact value.
  const progress = { mod: [], ead: [] };   // per step: { val, how: "ok" | "shown", tries }
  function fmt(x) { return String(Math.round(x * 1000) / 1000); }
  function near(x, y, abs, rel) { return Math.abs(x - y) <= Math.max(abs, (rel || 0) * Math.abs(y)); }
  function waterName() { return v.water === "salt" ? "seawater" : "fresh water"; }
  function depthTol() { return v.units === "ft" ? 0.6 : 0.2; }

  function lesson(id) {
    const A = atm(), u = unit(), dTol = depthTol();
    const other = [33, 34, 10, 10.3].filter(n => n !== A);
    if (id === "mod") {
      const pct = num(v.lModFo2), p = num(v.lModPo2);
      if (!(pct >= 21 && pct <= 100)) return { bad: "Enter an oxygen percentage from 21 to 100." };
      return {
        formula: `MOD = (PO2 ÷ FO2 − 1) × ${A}`,
        goal: `How deep can you take EAN${pct} before the oxygen partial pressure reaches ${p.toFixed(1)}?`,
        steps: [
          { title: "Turn the oxygen percentage into a fraction", why: "The formulas use fractions of 1, not percentages. EAN32 means 32% oxygen, which is 0.32.",
            sym: "O2 % ÷ 100", expr: () => `${pct} ÷ 100`, calc: () => pct / 100, abs: 0.001, name: "FO2",
            hints: [[x => near(x, pct, 0.01), "That's still the percentage. Divide by 100 to write it as a decimal."]],
            generic: "Move the decimal point two places to the left." },
          { title: "Find the deepest pressure this mix allows", why: "PO2 = FO2 × pressure. Turn that around and the most pressure you can take is PO2 ÷ FO2.",
            sym: "PO2 ÷ FO2", expr: a => `${p} ÷ ${fmt(a[0])}`, calc: a => p / a[0], abs: 0.02, rel: 0.005, unit: "ata",
            hints: [[(x, a) => near(x, a[0] / p, 0.02, 0.01), "You divided the other way round. Put the PO2 limit on top: PO2 ÷ FO2."],
                    [(x, a) => near(x, a[0] * p, 0.02, 0.01), "Multiplying gives you a PO2, not a pressure. Divide the PO2 limit by FO2."]],
            generic: "Divide the PO2 limit by the fraction from step 1. Keep at least two decimal places." },
          { title: "Take away the atmosphere of air above the water", why: "At the surface the air already presses with 1 atmosphere. Only the rest of the pressure comes from water.",
            sym: "pressure − 1", expr: a => `${fmt(a[1])} − 1`, calc: a => a[1] - 1, abs: 0.02, rel: 0.005, unit: "atm of water",
            hints: [[(x, a) => near(x, a[1], 0.005), "You still need to subtract the 1 atmosphere of air at the surface."],
                    [(x, a) => near(x, a[1] + 1, 0.02), "Subtract the 1, don't add it."]],
            generic: "Subtract 1 from the pressure in step 2." },
          { title: "Turn atmospheres of water into depth", why: `Every ${A} ${u} of ${waterName()} adds one more atmosphere of pressure.`,
            sym: `atm of water × ${A}`, expr: a => `${fmt(a[2])} × ${A}`, calc: a => a[2] * A, abs: dTol, rel: 0.005, unit: u,
            hints: [[(x, a) => other.some(n => near(x, a[2] * n, dTol, 0.003)), `Check the water and units. In ${waterName()}, use ${A} ${u} for each atmosphere.`],
                    [(x, a) => near(x, a[2] / A, 0.05, 0.01), `Multiply by ${A}, don't divide.`]],
            generic: `Multiply step 3 by ${A}.` },
          { title: "Round down for safety", why: "MOD is a depth limit you must stay shallower than, so always round down. Rounding up would put you past the PO2 limit.",
            sym: "round down", expr: a => `${fmt(a[3])} → round down`, calc: a => floorDepth(a[3]), abs: 0.001, unit: u, round: true,
            hints: [[(x, a) => near(x, ceilDepth(a[3]), 0.001), "That rounded up. MOD always rounds down, so you stay under the PO2 limit."]],
            generic: v.units === "ft" ? "Drop the decimals to get a whole number of feet." : "Round down to one decimal place." }
        ],
        done: a => `The MOD for EAN${pct} at PO2 ${p.toFixed(1)} is <b>${fmtDepth(a[4])}</b>. Never go deeper than that on this mix.`
      };
    }
    const pct = num(v.lEadFo2), d = num(v.lEadDepth);
    if (!(pct >= 21 && pct <= 100) || !(d >= 0)) return { bad: "Enter the mix (21 to 100% oxygen) and the depth." };
    const po2 = pct / 100 * ata(d);
    return {
      formula: `EAD = (FN2 ÷ 0.79) × (depth + ${A}) − ${A}`,
      goal: `On EAN${pct} at ${fmtDepth(d)}, what depth of air gives you the same amount of nitrogen?`,
      steps: [
        { title: "Find the nitrogen fraction in your mix", why: "Nitrox is oxygen plus nitrogen. Whatever isn't oxygen is nitrogen (FN2).",
          sym: "1 − FO2", expr: () => `1 − ${fmt(pct / 100)}`, calc: () => 1 - pct / 100, abs: 0.001, name: "FN2",
          hints: [[x => near(x, pct / 100, 0.001), "That's the oxygen. Nitrogen is the rest: 1 − FO2."],
                  [x => near(x, 100 - pct, 0.01), "Right idea, but write it as a decimal, like 0.68."]],
          generic: "Subtract the oxygen fraction from 1." },
        { title: "Compare it with the nitrogen in air", why: "Air is 79% nitrogen. This ratio says how much nitrogen your mix has compared with air.",
          sym: "FN2 ÷ 0.79", expr: a => `${fmt(a[0])} ÷ 0.79`, calc: a => a[0] / 0.79, abs: 0.005, rel: 0.005,
          hints: [[(x, a) => near(x, 0.79 / a[0], 0.005, 0.01), "You divided the other way round. Put your mix's nitrogen on top: FN2 ÷ 0.79."],
                  [(x, a) => near(x, a[0] * 0.79, 0.005, 0.01), "Divide by 0.79, don't multiply."]],
          generic: "Divide step 1 by 0.79. Keep at least two decimal places." },
        { title: "Add the surface atmosphere to the depth", why: `The formula works in absolute pressure, measured in ${u}. The air above the water counts as ${A} ${u} of ${waterName()}.`,
          sym: `depth + ${A}`, expr: () => `${fmt(d)} + ${A}`, calc: () => d + A, abs: 0.05, unit: u,
          hints: [[x => near(x, d, 0.05), `Don't forget to add the ${A} ${u} for the air above the water.`],
                  [x => other.some(n => near(x, d + n, 0.05)), `Check the water and units. In ${waterName()}, one atmosphere is ${A} ${u}.`]],
          generic: `Add ${A} to the depth.` },
        { title: "Multiply the two together", why: "This is the absolute depth on air that has the same nitrogen pressure as your mix.",
          sym: "step 2 × step 3", expr: a => `${fmt(a[1])} × ${fmt(a[2])}`, calc: a => a[1] * a[2], abs: dTol, rel: 0.005, unit: u,
          hints: [], generic: "Multiply your answer from step 2 by your answer from step 3." },
        { title: "Take the surface atmosphere back off", why: "We added it in step 3, so subtract it again to get back to a depth you'd read on a gauge.",
          sym: `step 4 − ${A}`, expr: a => `${fmt(a[3])} − ${A}`, calc: a => a[3] - A, abs: dTol, rel: 0.005, unit: u,
          hints: [[(x, a) => near(x, a[3], 0.05), `Subtract the ${A} ${u} you added in step 3.`]],
          generic: `Subtract ${A} from step 4.` },
        { title: "Round up for safety", why: "With tables, the conservative way is deeper, so EAD always rounds up.",
          sym: "round up", expr: a => `${fmt(a[4])} → round up`, calc: a => ceilDepth(Math.max(0, a[4])), abs: 0.001, unit: u, round: true,
          hints: [[(x, a) => near(x, floorDepth(a[4]), 0.001), "That rounded down. EAD always rounds up, the conservative way."]],
          generic: v.units === "ft" ? "Round up to the next whole foot." : "Round up to one decimal place." }
      ],
      done: a => `On EAN${pct} at ${fmtDepth(d)}, plan with air tables or an air computer as if you were at <b>${fmtDepth(a[5])}</b>.`,
      check: `<b>Safety check:</b> PO2 = FO2 × pressure = ${fmt(pct / 100)} × (${fmt(d)} ÷ ${A} + 1) = <b>${po2.toFixed(2)}</b>. ` +
        (po2 > 1.6 ? "That is above 1.6: never dive this mix this deep." : po2 > 1.4 ? "That is above the 1.4 working limit: this dive is too deep for this mix." : "That is within the 1.4 working limit."),
      checkWarn: po2 > 1.4
    };
  }

  function stepsHtml(id) {
    const L = lesson(id);
    if (L.bad) return `<p class="nx-result bad"><span class="nx-sub">${L.bad}</span></p>`;
    const prog = progress[id], vals = prog.map(s => s.val);
    const cur = prog.length;
    const items = L.steps.map((s, i) => {
      const state = i < cur ? "done" : i === cur ? "current" : "locked";
      const ans = prog[i];
      let math;
      if (state === "locked") math = `<span class="nl-sym">${s.sym}</span>`;
      else if (state === "done") math = `<code>${s.expr(vals)} = <b>${fmt(ans.val)}</b>${s.unit ? " " + s.unit : ""}</code>`;
      else math = `<code>${s.expr(vals)} =</code> <input class="nl-ans" id="nl-${id}-${i}" type="text" inputmode="decimal" autocomplete="off" aria-label="Step ${i + 1} answer"${s.unit ? ` aria-describedby="nl-${id}-u${i}"` : ""}>${s.unit ? ` <span class="nl-unit" id="nl-${id}-u${i}">${s.unit}</span>` : ""}
          <button type="button" class="btn primary small" data-act="check" data-l="${id}">Check</button>
          <button type="button" class="btn small" data-act="show" data-l="${id}">Show me</button>`;
      const fb = state === "done" ? (ans.how === "ok" ? `<p class="nl-fb ok">✓ Correct${ans.tries > 1 ? "" : " first try"}.</p>` : `<p class="nl-fb shown">Answer shown. Read through it, then keep going.</p>`)
        : state === "current" ? `<p class="nl-fb" id="nl-fb-${id}" aria-live="polite"></p>` : "";
      return `<li class="nl-step ${state}"><span class="nl-num" aria-hidden="true">${i + 1}</span><div class="nl-body">
          <h3>${s.title}${s.name ? ` <span class="nl-name">(${s.name})</span>` : ""}</h3>
          ${state === "locked" ? "" : `<p class="nl-why">${s.why}</p>`}
          <div class="nl-math">${math}</div>${fb}</div></li>`;
    }).join("");
    let end = "";
    if (cur >= L.steps.length) {
      const first = prog.filter(s => s.how === "ok" && s.tries === 1).length;
      end = `<div class="nx-result"><span class="nx-sub">${L.done(vals)}</span><span class="nx-sub">You got ${first} of ${L.steps.length} steps right on the first try.</span></div>`;
      if (L.check) end += `<p class="nx-result${L.checkWarn ? " warn" : ""}"><span class="nx-sub">${L.check}</span></p>`;
    }
    return `<p class="nl-goal">${L.goal}</p><p class="nl-formula"><code>${L.formula}</code></p><ol class="nl-steps">${items}</ol>${end}`;
  }

  function lessonCard(id, title, about, fields) {
    return `<section class="panel nx-card nl-card" aria-labelledby="nx-h-${id}"><h2 id="nx-h-${id}">${title}</h2><p class="hint">${about}</p>
      <div class="nx-fields">${fields}</div>
      <div class="nl-tools"><button type="button" class="btn small" data-act="new" data-l="${id}">New practice problem</button>
        <button type="button" class="btn small" data-act="all" data-l="${id}">Show all steps</button>
        <button type="button" class="btn small" data-act="reset" data-l="${id}">Start over</button></div>
      <div class="nl-work" id="nl-work-${id}">${stepsHtml(id)}</div></section>`;
  }

  function renderLearn() {
    const u = unit(), A = atm();
    main.innerHTML = `${modeSwitch()}<section class="pub-hero"><h1>Learn the nitrox math</h1>
        <p>Work out maximum operating depth and equivalent air depth one step at a time. Type your answer for each step and press Check. Stuck? Press Show me.</p></section>
      ${settings()}
      <div class="panel nl-key"><h2>Numbers to know</h2><ul>
        <li><b>1 atmosphere</b> = 33 ft of seawater, 34 ft of fresh water (10 m and 10.3 m). This page is using <b>${A} ${u}</b>.</li>
        <li><b>Air</b> is 21% oxygen and 79% nitrogen.</li>
        <li><b>PO2 limits</b> (NAUI): 1.4 working, 1.6 contingency.</li>
        <li><b>PO2 = FO2 × pressure</b> in atmospheres absolute (ata). Pressure at depth = depth ÷ ${A} + 1.</li></ul></div>
      <div class="nx-grid">
        ${lessonCard("mod", "Maximum operating depth", "The deepest you can take a mix before oxygen becomes dangerous.",
          input("lModFo2", "Oxygen %", 'min="21" max="100" step="1"') + po2Select("lModPo2", "Max PO2"))}
        ${lessonCard("ead", "Equivalent air depth", "The depth to use on air tables, for less nitrogen than air.",
          input("lEadFo2", "Oxygen %", 'min="21" max="100" step="1"') + input("lEadDepth", `Depth (${u})`, 'min="0" step="1"'))}
      </div>
      <p class="nx-note"><b>For training only.</b> Check your work with the Calculator view, and always plan within NAUI limits.</p>`;
    save();
  }

  function redrawLesson(id, focus) {
    const box = document.getElementById("nl-work-" + id); if (!box) return;
    box.innerHTML = stepsHtml(id);
    if (focus) { const el = box.querySelector(".nl-ans"); if (el) el.focus(); else { const r = box.querySelector(".nx-result"); if (r) { r.tabIndex = -1; r.focus(); } } }
  }

  function check(id) {
    const L = lesson(id); if (L.bad) return;
    const i = progress[id].length, s = L.steps[i]; if (!s) return;
    const input = document.getElementById(`nl-${id}-${i}`), fb = document.getElementById("nl-fb-" + id);
    const raw = (input.value || "").trim().replace(",", ".").replace(/[^\d.\-]/g, "");
    const x = Number(raw);
    if (raw === "" || !isFinite(x)) { fb.className = "nl-fb bad"; fb.textContent = "Type a number first."; return; }
    const vals = progress[id].map(p => p.val), want = s.calc(vals);
    const tries = (Number(input.dataset.tries) || 0) + 1; input.dataset.tries = tries;
    if (near(x, want, s.abs, s.rel)) {
      progress[id].push({ val: s.round ? want : x, how: "ok", tries });
      redrawLesson(id, true); return;
    }
    const h = s.hints.find(([test]) => test(x, vals));
    fb.className = "nl-fb bad";
    fb.textContent = "Not quite. " + (h ? h[1] : s.generic) + (tries >= 3 ? " You can press Show me to see the answer." : "");
    input.select();
  }

  function act(name, id) {
    const L = lesson(id);
    if (name === "check") return check(id);
    if (name === "reset") { progress[id] = []; return redrawLesson(id, true); }
    if (name === "show" || name === "all") {
      if (L.bad) return;
      do {
        const i = progress[id].length; if (i >= L.steps.length) break;
        const el = document.getElementById(`nl-${id}-${i}`);
        progress[id].push({ val: L.steps[i].calc(progress[id].map(p => p.val)), how: "shown", tries: Number(el && el.dataset.tries) || 0 });
      } while (name === "all");
      return redrawLesson(id, true);
    }
    if (name === "new") {
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const pct = pick([28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 40]);
      if (id === "mod") { v.lModFo2 = pct; v.lModPo2 = pick([1.4, 1.4, 1.4, 1.6, 1.3]); }
      else {
        // A depth this mix can reach at PO2 1.4, in round numbers.
        const maxD = (1.4 / (pct / 100) - 1) * atm(), stepD = v.units === "ft" ? 5 : 1, minD = v.units === "ft" ? 40 : 12;
        const top = Math.max(minD, Math.floor(maxD / stepD) * stepD);
        v.lEadFo2 = pct; v.lEadDepth = minD + stepD * Math.floor(Math.random() * ((top - minD) / stepD + 1));
      }
      progress[id] = [];
      renderLearn();
      const el = document.getElementById(`nl-${id}-0`); if (el) el.focus();
    }
  }

  main.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mode]");
    if (m) {
      if (v.mode === m.dataset.mode) return;
      v.mode = m.dataset.mode;
      try { history.replaceState(null, "", v.mode === "learn" ? "#learn" : location.pathname + location.search); } catch (err) { /* file:// */ }
      render(); const b = main.querySelector(`[data-mode="${v.mode}"]`); if (b) b.focus(); return;
    }
    const a = e.target.closest("[data-act]");
    if (a) act(a.dataset.act, a.dataset.l);
  });
  main.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList && e.target.classList.contains("nl-ans")) {
      e.preventDefault(); check(e.target.id.split("-")[1]);
    }
  });

  main.addEventListener("input", (e) => {
    const k = e.target.dataset && e.target.dataset.k; if (!k) return;
    v[k] = e.target.value;
    if (k === "lModFo2" || k === "lModPo2") { progress.mod = []; redrawLesson("mod"); save(); return; }
    if (k === "lEadFo2" || k === "lEadDepth") { progress.ead = []; redrawLesson("ead"); save(); return; }
    if (k === "units" || k === "water") {
      // Convert the depths so a switch of units keeps the same dive.
      if (k === "units") {
        // Switching back without changing anything restores the exact numbers you had (100 ft → 30 m → 100 ft).
        const keys = ["depth", "eadDepth", "exDepth", "lEadDepth"], to = e.target.value, f = to === "m" ? 0.3048 : 1 / 0.3048;
        const back = v.memo && v.memo.units === to && keys.every(x => String(v[x]) === String(v.memo.shown[x]));
        const before = {}; keys.forEach(x => { before[x] = v[x]; });
        if (back) keys.forEach(x => { v[x] = v.memo.values[x]; });
        else keys.forEach(x => { const n = Number(v[x]); if (isFinite(n)) v[x] = Math.round(n * f); });
        v.memo = { units: to === "m" ? "ft" : "m", values: before, shown: {} };
        keys.forEach(x => { v.memo.shown[x] = v[x]; });
      }
      progress.mod = []; progress.ead = [];
      render(); const el = document.getElementById("nx-" + k); if (el) el.focus(); return;
    }
    update();
  });

  if (location.hash === "#learn") v.mode = "learn";
  else if (location.hash === "#calc") v.mode = "calc";
  render();
})();
