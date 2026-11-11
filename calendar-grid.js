/* Limitless Diving — month calendar grid and date helpers, shared by the instructor app (calendar.js)
   and the public class calendar (classes.html). No dependencies. */
(function () {
  "use strict";

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function pad(n) { return String(n).padStart(2, "0"); }
  // Local dates as "YYYY-MM-DD" (no time zones involved).
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function parse(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function ym(s) { return (s || today()).slice(0, 7); }
  function addMonths(ymStr, n) { const [y, m] = ymStr.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function monthName(ymStr) { const [y, m] = ymStr.split("-").map(Number); return MONTHS[m - 1] + " " + y; }

  function fmt(s, opts) {
    const d = parse(s); if (!d) return s || "";
    return d.toLocaleDateString("en-US", Object.assign({ month: "short", day: "numeric", year: "numeric" }, opts || {}));
  }
  // "Dec 5 – 7, 2026", "Dec 30, 2026 – Jan 2, 2027", or one date. Dates in between need not be consecutive.
  function range(dates) {
    const ds = (dates || []).filter(Boolean).slice().sort();
    if (!ds.length) return "";
    const a = parse(ds[0]), b = parse(ds[ds.length - 1]);
    if (!a || !b) return ds.join(", ");
    if (ds.length === 1 || ds[0] === ds[ds.length - 1]) return fmt(ds[0], { weekday: "short" });
    if (a.getFullYear() !== b.getFullYear()) return fmt(ds[0]) + " – " + fmt(ds[ds.length - 1]);
    if (a.getMonth() === b.getMonth()) return fmt(ds[0], { year: undefined }) + " – " + b.getDate() + ", " + b.getFullYear();
    return fmt(ds[0], { year: undefined }) + " – " + fmt(ds[ds.length - 1]);
  }
  function lastDate(dates) { const ds = (dates || []).filter(Boolean).sort(); return ds[ds.length - 1] || ""; }
  function firstDate(dates) { const ds = (dates || []).filter(Boolean).sort(); return ds[0] || ""; }

  // One month as a 7-column grid. events: [{ date, html }]. opts.dayAct: attribute string builder for a day cell (makes it clickable).
  function month(ymStr, events, opts) {
    opts = opts || {};
    const [y, m] = ymStr.split("-").map(Number);
    const first = new Date(y, m - 1, 1), start = new Date(y, m - 1, 1 - first.getDay());
    const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
    const byDate = {};
    (events || []).forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e.html); });
    const t = today();
    let cells = "";
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), key = ymd(d);
      const out = d.getMonth() !== m - 1, evs = byDate[key] || [];
      const cls = ["cal-day", out ? "out" : "", key === t ? "today" : "", key < t ? "past" : "", evs.length ? "has" : ""].filter(Boolean).join(" ");
      const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      cells += `<div class="${cls}" ${opts.dayAct && !out ? opts.dayAct(key) : ""}>
        <span class="cal-num"${key === t ? ' aria-current="date"' : ""} aria-label="${esc(label)}">${d.getDate()}</span>${evs.join("")}</div>`;
    }
    return `<div class="cal" aria-label="${esc(monthName(ymStr))}">
      <div class="cal-dow" aria-hidden="true">${DOW.map(x => `<span>${x}</span>`).join("")}</div>
      <div class="cal-grid">${cells}</div></div>`;
  }

  window.LDCalGrid = { esc, ymd, today, parse, ym, addMonths, monthName, fmt, range, firstDate, lastDate, month };
})();
