/* Limitless Diving — log book pages as a PDF (logbook.html "Download PDF" and "Print pages").
   Lays the dives out like a printed scuba log book (our own design): a cover page with the diver's totals, then
   two dives per US Letter page. Each dive has its number, date, site, times, a depth profile, depth and time
   boxes with running total time, gas and gear, conditions tick boxes, type of dive, notes, and a verification
   strip for the buddy and the instructor (online sign-offs are printed in), with a stamp box.
   The PDF is made in the browser: each page is drawn with html2canvas and put into a jsPDF file. Both libraries
   load from cdnjs only when the button is pressed. If they can't load, the browser's print dialog opens instead
   (choose "Save as PDF" there).
   window.LDLogPDF = { download(dives, info, onProgress), print(dives, info) } */
(function () {
  "use strict";

  const LIBS = [
    ["jspdf", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"],
    ["html2canvas", "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"]
  ];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const U = { imperial: { depth: "ft", press: "psi", temp: "°F", vis: "ft", wt: "lb", stop: 15 }, metric: { depth: "m", press: "bar", temp: "°C", vis: "m", wt: "kg", stop: 5 } };
  const TAGS = [["training", "Training"], ["night", "Night"], ["deep", "Deep"], ["deco", "Deco"], ["wreck", "Wreck"], ["cave", "Cave"],
    ["overhead", "Overhead"], ["drift", "Drift"], ["sidemount", "Sidemount"], ["dpv", "DPV"], ["drysuit", "Drysuit"], ["ice", "Ice"]];
  const ROLE = { divemaster: "Dive Master", instructor: "Instructor", admin: "Instructor" };

  function fmtDate(d) { if (!d) return ""; const x = new Date(String(d).slice(0, 10) + "T12:00:00"); return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  function fmtTime(t) { if (!t) return ""; const [h, m] = t.split(":").map(Number); return ((h % 12) || 12) + ":" + String(m).padStart(2, "0") + (h < 12 ? " am" : " pm"); }
  function timeOut(d) {
    if (!d.time_in || !d.bottom_time) return "";
    const [h, m] = d.time_in.split(":").map(Number), t = h * 60 + m + Number(d.bottom_time);
    return fmtTime(String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"));
  }
  function hm(min) { min = Math.round(min || 0); return Math.floor(min / 60) + ":" + String(min % 60).padStart(2, "0"); }
  function nice(x) { return x == null || x === "" ? "" : String(Math.round(Number(x) * 10) / 10); }
  function gasText(d) {
    if (d.gas === "nitrox") return "EANx " + (d.o2_pct ? nice(d.o2_pct) : "");
    if (d.gas === "trimix") return "Tx " + (d.o2_pct ? nice(d.o2_pct) : "?") + "/" + (d.he_pct ? nice(d.he_pct) : "?");
    return ({ air: "Air", oxygen: "Oxygen", other: "Other" })[d.gas] || "Air";
  }
  const box = (on) => `<span class="lbp-box${on ? " on" : ""}">${on ? "✓" : ""}</span>`;

  // A simple square profile from max depth, average depth and bottom time, with a safety stop. Blank grid if no data.
  function profile(d) {
    const u = U[d.units] || U.imperial, W = 300, H = 104, L = 30, T = 10, R = 8, B = 20, w = W - L - R, h = H - T - B;
    const max = Number(d.max_depth) || 0, bt = Number(d.bottom_time) || 0;
    const scaleD = max ? Math.max(max * 1.15, u.stop * 2) : (u.depth === "ft" ? 100 : 30), scaleT = bt || 60;
    const x = (t) => L + (t / scaleT) * w, y = (dep) => T + (dep / scaleD) * h;
    let grid = "";
    for (let i = 0; i <= 4; i++) { const dep = scaleD * i / 4; grid += `<line x1="${L}" x2="${L + w}" y1="${y(dep)}" y2="${y(dep)}" stroke="#c9dce0" stroke-width="0.8"/><text x="${L - 4}" y="${y(dep) + 3}" text-anchor="end">${Math.round(dep)}</text>`; }
    for (let i = 0; i <= 4; i++) { const t = scaleT * i / 4; grid += `<line y1="${T}" y2="${T + h}" x1="${x(t)}" x2="${x(t)}" stroke="#e1ecee" stroke-width="0.8"/><text x="${x(t)}" y="${H - 6}" text-anchor="middle">${Math.round(t)}</text>`; }
    let path = "";
    if (max && bt) {
      const stop = max > u.stop * 1.6 ? u.stop : 0, stopT = stop ? Math.min(3, bt * 0.15) : 0;
      const desc = Math.max(1, Math.min(bt * 0.12, max / (u.depth === "ft" ? 60 : 18)));
      const asc = Math.max(1, Math.min(bt * 0.15, (max - stop) / (u.depth === "ft" ? 30 : 9)));
      const avg = Number(d.avg_depth) || 0;
      const bottomEnd = bt - asc - stopT - (stop ? 0.6 : 0);
      const mid = avg && avg < max ? Math.max(stop, Math.min(max, 2 * avg - max * 0.5)) : max * 0.85;
      const pts = [[0, 0], [desc, max], [desc + (bottomEnd - desc) * 0.45, max], [desc + (bottomEnd - desc) * 0.7, mid], [bottomEnd, mid]];
      if (stop) pts.push([bottomEnd + asc, stop], [bottomEnd + asc + stopT, stop]);
      pts.push([bt, 0]);
      path = `<polyline points="${pts.map(p => x(Math.max(0, p[0])).toFixed(1) + "," + y(p[1]).toFixed(1)).join(" ")}" fill="rgba(95,196,207,.25)" stroke="#0f7c8c" stroke-width="2" stroke-linejoin="round"/>
        <text x="${x(desc) + 4}" y="${y(max) + 12}" class="pk">${nice(max)} ${u.depth}</text>`;
    }
    return `<svg class="lbp-prof" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <rect x="${L}" y="${T}" width="${w}" height="${h}" fill="#f6fbfc"/>${grid}
      <line x1="${L}" x2="${L + w}" y1="${T}" y2="${T}" stroke="#0b2a3a" stroke-width="1.2"/>${path}
      <text x="${L - 22}" y="${T + h / 2}" transform="rotate(-90 ${L - 22} ${T + h / 2})" text-anchor="middle">${u.depth}</text>
      <text x="${L + w}" y="${H - 6}" text-anchor="end" dx="0" dy="0"> </text></svg>
      <div class="lbp-prof-cap">Depth profile (${esc(u.depth)} / minutes)${max && bt ? ", drawn from the log" : ""}</div>`;
  }

  function dive(d, cum) {
    const u = U[d.units] || U.imperial, tags = new Set(d.tags || []);
    const used = d.start_pressure != null && d.end_pressure != null ? d.start_pressure - d.end_pressure : null;
    const f = (label, val, cls) => `<div class="lbp-f${cls ? " " + cls : ""}"><span>${label}</span><b>${val === "" || val == null ? "&nbsp;" : esc(val)}</b></div>`;
    const signed = d.signed_at
      ? `<div class="lbp-signed"><b>✓ Verified online</b> by ${esc(d.signed_name || "")}${d.signed_role ? ", " + esc(ROLE[d.signed_role] || d.signed_role) : ""}<br>${esc(fmtDate(d.signed_at))}${d.sign_comment ? `<i>“${esc(d.sign_comment)}”</i>` : ""}</div>`
      : `<div class="lbp-line"></div><span class="lbp-sm">${tags.has("training") ? "Instructor signature & number" : "Instructor / Dive Master signature & number"}</span>`;
    return `<section class="lbp-dive">
      <div class="lbp-head">
        <div class="lbp-no"><small>Dive</small>${esc(d.dive_no)}</div>
        ${f("Date", fmtDate(d.dived_on))}${f("Dive site", d.site_name, "wide")}${f("Location", d.place, "wide")}${f("Time in", fmtTime(d.time_in))}${f("Time out", timeOut(d))}
      </div>
      <div class="lbp-mid">
        <div class="lbp-profwrap">${profile(d)}</div>
        <div class="lbp-nums">
          ${f("Max depth", d.max_depth != null ? nice(d.max_depth) + " " + u.depth : "")}${f("Avg depth", d.avg_depth != null ? nice(d.avg_depth) + " " + u.depth : "")}
          ${f("Bottom time", d.bottom_time ? d.bottom_time + " min" : "")}${f("Surface interval", d.surface_interval != null ? hm(d.surface_interval) : "")}
          ${f("Time this dive", d.bottom_time ? hm(d.bottom_time) : "")}${f("Total time to date", hm(cum))}
        </div>
      </div>
      <div class="lbp-row">
        ${f("Gas", gasText(d))}${f("Tank", d.tank)}${f("Start " + u.press, d.start_pressure)}${f("End " + u.press, d.end_pressure)}${f("Used", used != null ? used + " " + u.press : "")}${f("Weight", d.weight != null ? nice(d.weight) + " " + u.wt : "")}${f("Suit", d.suit, "wide")}
      </div>
      <div class="lbp-row lbp-ticks">
        <span>${box(d.water === "fresh")} Fresh</span><span>${box(d.water === "salt")} Salt</span><span>${box(d.entry === "shore")} Shore</span><span>${box(d.entry === "boat")} Boat</span>
        <span class="lbp-sep"></span><span>Current: ${["none", "light", "moderate", "strong"].map(c => `${box(d.current === c)} ${c[0].toUpperCase() + c.slice(1)}`).join(" ")}</span>
      </div>
      <div class="lbp-row">${f("Water temp", d.water_temp != null ? nice(d.water_temp) + " " + u.temp : "")}${f("Air temp", d.air_temp != null ? nice(d.air_temp) + " " + u.temp : "")}${f("Visibility", d.visibility != null ? nice(d.visibility) + " " + u.vis : "")}${f("Conditions", d.conditions, "wider")}</div>
      <div class="lbp-row lbp-ticks lbp-types">${TAGS.map(([t, n]) => `<span>${box(tags.has(t))} ${n}</span>`).join("")}</div>
      ${d.course || d.instructor ? `<div class="lbp-row">${f("Course", d.course, "wider")}${f("Instructor", d.instructor, "wide")}</div>` : ""}
      <div class="lbp-notes${(d.notes || "").length > 350 ? " long" : ""}"><span>Notes &amp; what I saw</span><p>${esc(d.notes || "")}</p></div>
      <div class="lbp-verify">
        <div class="lbp-v"><span class="lbp-sm">Buddy</span><b>${esc(d.buddy || "")}&nbsp;</b><div class="lbp-line"></div><span class="lbp-sm">Buddy signature</span></div>
        <div class="lbp-v">${signed}</div>
        <div class="lbp-stamp">Stamp</div>
      </div>
    </section>`;
  }

  function cover(dives, info) {
    const pref = (dives[dives.length - 1] && dives[dives.length - 1].units) || "imperial", u = U[pref];
    const toPref = (d) => d.max_depth == null ? null : d.units === pref ? Number(d.max_depth) : pref === "metric" ? d.max_depth / 3.28084 : d.max_depth * 3.28084;
    const total = dives.reduce((t, d) => t + (d.bottom_time || 0), 0);
    const deep = dives.reduce((m, d) => Math.max(m, toPref(d) || 0), 0);
    const nitrox = dives.filter(d => ["nitrox", "trimix", "oxygen"].includes(d.gas)).length;
    const count = (t) => dives.filter(d => (d.tags || []).includes(t)).length;
    const dates = dives.map(d => d.dived_on).filter(Boolean).sort();
    const certs = (info.certifications || []).map(c => [c.agency, c.level].filter(Boolean).join(" ") + (c.number ? " #" + c.number : "")).filter(Boolean);
    const stat = (k, v, sm) => `<div class="lbp-cs"><span>${k}</span><b${sm ? ' class="sm"' : ""}>${esc(v)}</b></div>`;
    const places = new Map();
    dives.forEach(d => { const k = d.site_name + (d.place ? ", " + d.place : ""); places.set(k, (places.get(k) || 0) + 1); });
    const placeList = Array.from(places.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return `<div class="lbp-page lbp-cover">
      <div class="lbp-cover-top">
        <img src="logo-badge.webp" alt="" class="lbp-logo" crossorigin="anonymous">
        <div><div class="lbp-eyebrow">Limitless Diving &amp; Technical Training</div><h1>Dive Log</h1>
          <div class="lbp-diver">${esc(info.name || "")}</div>${info.email ? `<div class="lbp-sm">${esc(info.email)}</div>` : ""}</div>
      </div>
      <div class="lbp-cstats">
        ${stat("Dives logged", dives.length)}${stat("Total bottom time", hm(total) + " h")}${stat("Deepest", deep ? nice(deep) + " " + u.depth : "–")}
        ${stat("Nitrox dives", nitrox)}${stat("Night dives", count("night"))}${stat("Deep dives", count("deep"))}
        ${stat("Deco dives", count("deco"))}${stat("Training dives signed", dives.filter(d => d.signed_at).length + " of " + count("training"))}${stat("Dates", dates.length ? fmtDate(dates[0]) + " – " + fmtDate(dates[dates.length - 1]) : "–", true)}
      </div>
      <h2>Certifications</h2>
      ${certs.length ? `<ul class="lbp-certs">${certs.map(c => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p class="lbp-sm">None listed in the Student portal.</p>`}
      <h2>Places dived</h2>
      <ul class="lbp-places">${placeList.slice(0, 30).map(([k, n]) => `<li>${esc(k)}<span>${n} dive${n === 1 ? "" : "s"}</span></li>`).join("")}</ul>
      ${placeList.length > 30 ? `<p class="lbp-sm">…and ${placeList.length - 30} more.</p>` : ""}
      <div class="lbp-cover-foot">Printed ${esc(fmtDate(new Date().toISOString()))} from limitless-diving.com. Training dives marked “Verified online” were signed off by an instructor in the Limitless Diving log book.</div>
      ${ROSE}
    </div>`;
  }
  const ROSE = `<svg class="lbp-rose" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" fill="none" stroke="#0f7c8c" stroke-width="3"/><circle cx="100" cy="100" r="76" fill="none" stroke="#0f7c8c" stroke-width="1.5" stroke-dasharray="2 9"/>
    ${[0, 90, 180, 270].map(a => `<polygon points="100,6 90,100 110,100" fill="#0f7c8c" transform="rotate(${a} 100 100)"/>`).join("")}${[45, 135, 225, 315].map(a => `<polygon points="100,38 94,100 106,100" fill="#5fc4cf" transform="rotate(${a} 100 100)"/>`).join("")}</svg>`;

  function pages(dives, info) {
    const ds = dives.slice().sort((a, b) => a.dive_no - b.dive_no || String(a.dived_on).localeCompare(String(b.dived_on)));
    let cum = 0;
    const blocks = ds.map(d => { cum += d.bottom_time || 0; return dive(d, cum); });
    const out = [cover(ds, info)];
    for (let i = 0; i < blocks.length; i += 2) {
      out.push(`<div class="lbp-page"><div class="lbp-strip"><span>Limitless Diving · Dive Log</span><span>${esc(info.name || "")}</span><span>Page ${i / 2 + 1}</span></div>
        ${blocks[i]}${blocks[i + 1] || `<section class="lbp-dive lbp-blank"></section>`}</div>`);
    }
    return out;
  }

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.crossOrigin = "anonymous"; s.onload = res; s.onerror = () => rej(new Error("Couldn't load " + src)); document.head.appendChild(s); });
  }
  async function libs() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript(LIBS[0][1]);
    if (!window.html2canvas) await loadScript(LIBS[1][1]);
    return { jsPDF: window.jspdf.jsPDF, h2c: window.html2canvas };
  }
  function stage(html) {
    const host = document.createElement("div");
    host.className = "lbp-stage"; host.setAttribute("aria-hidden", "true");
    host.innerHTML = html.join("");
    document.body.appendChild(host);
    return host;
  }
  async function imagesReady(host) {
    await Promise.all(Array.from(host.querySelectorAll("img")).map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; })));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  }

  async function download(dives, info, onProgress) {
    const { jsPDF, h2c } = await libs();
    const host = stage(pages(dives, info));
    try {
      await imagesReady(host);
      const els = Array.from(host.querySelectorAll(".lbp-page"));
      const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true });
      pdf.setProperties({ title: "Dive Log · " + (info.name || ""), author: info.name || "", creator: "Limitless Diving" });
      for (let i = 0; i < els.length; i++) {
        if (onProgress) onProgress(i + 1, els.length);
        const canvas = await h2c(els[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, width: 816, height: 1056, windowWidth: 816 });
        if (i) pdf.addPage("letter", "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 612, 792, undefined, "FAST");
      }
      const safe = String(info.name || "diver").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "diver";
      pdf.save(`Limitless-Diving-Dive-Log-${safe}.pdf`);
    } finally { host.remove(); }
  }

  function print(dives, info) {
    const host = stage(pages(dives, info));
    host.classList.add("lbp-printing");
    document.body.classList.add("lbp-print-mode");
    const done = () => { document.body.classList.remove("lbp-print-mode"); host.remove(); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    imagesReady(host).then(() => { window.print(); setTimeout(() => { if (document.body.classList.contains("lbp-print-mode")) done(); }, 60000); });
  }

  window.LDLogPDF = { download, print, pages };
})();
