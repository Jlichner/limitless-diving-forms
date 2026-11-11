/* Limitless Diving — public class calendar. Reads the classes the instructor app's "Publish calendar"
   puts online (Supabase), or classes.json. Shows a month calendar and a card for each upcoming class. */
(function () {
  "use strict";

  const G = window.LDCalGrid, esc = G.esc;
  const main = document.getElementById("pub");
  let data = null, ym = G.ym(G.today());

  function money(n) { return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function safeEmail(e) { return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e || "") ? e : ""; }
  function telHref(p) { const d = String(p || "").replace(/[^\d+]/g, ""); return d.length >= 7 ? "tel:" + d : ""; }
  function color(k) { return /^k[0-5]$/.test(k.color || "") ? k.color : "k0"; }

  function seatsHtml(k) {
    if (k.seatsLeft == null) return "";
    if (k.seatsLeft <= 0) return `<span class="seats full">Class full · waitlist</span>`;
    return `<span class="seats${k.seatsLeft <= 2 ? " low" : ""}">${k.seatsLeft} seat${k.seatsLeft === 1 ? "" : "s"} open</span>`;
  }

  function card(k) {
    const c = data.contact || {}, email = safeEmail(c.email);
    const subject = "Class: " + k.title + (k.dates.length ? " (" + G.range(k.dates) + ")" : "");
    const ask = email ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : telHref(c.phone);
    return `<article class="pub-card ${color(k)}" id="class-${esc(k.id)}">
      <span class="eyebrow">${esc(k.courseName)}</span>
      <h3>${esc(k.title)}</h3>
      <span class="when">${esc(G.range(k.dates) || "Dates to be announced")}</span>
      ${seatsHtml(k)}
      <dl>${k.time ? `<dt>Time</dt><dd>${esc(k.time)}</dd>` : ""}${k.location ? `<dt>Where</dt><dd>${esc(k.location)}</dd>` : ""}
        ${k.price != null ? `<dt>Price</dt><dd class="money">${money(k.price)}</dd>` : ""}
        ${k.dates.length > 1 ? `<dt>Days</dt><dd>${k.dates.map(d => esc(G.fmt(d, { weekday: "short", year: undefined }))).join(", ")}</dd>` : ""}</dl>
      ${k.notes ? `<p>${esc(k.notes)}</p>` : ""}
      ${ask ? `<a class="btn primary" href="${esc(ask)}">${k.seatsLeft === 0 ? "Join the waitlist" : "Ask about this class"}</a>` : ""}
    </article>`;
  }

  function render() {
    const list = data.classes || [];
    const events = [];
    list.forEach(k => k.dates.forEach((d, i) => events.push({
      date: d,
      html: `<a class="cal-ev ${color(k)}" href="#class-${esc(k.id)}" title="${esc(k.title)}">${esc(k.title)}${k.dates.length > 1 ? ` <small>${i + 1}/${k.dates.length}</small>` : ""}</a>`
    })));
    const c = data.contact || {}, email = safeEmail(c.email), tel = telHref(c.phone);
    const contact = [c.instructor ? esc(c.instructor) : "", email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "", tel ? `<a href="${esc(tel)}">${esc(c.phone)}</a>` : ""].filter(Boolean).join(" · ");
    const updated = data.updated ? new Date(data.updated) : null;
    main.innerHTML = `<section class="pub-hero"><h1>${esc(data.heading || "Upcoming training classes")}</h1>${data.intro ? `<p>${esc(data.intro)}</p>` : ""}</section>
      <section aria-label="Calendar"><div class="pub-month"><h2>${esc(G.monthName(ym))}</h2>
        <div class="cal-nav"><button class="btn" data-m="-1" aria-label="Previous month">‹</button><button class="btn" data-m="0">Today</button><button class="btn" data-m="1" aria-label="Next month">›</button></div></div>
        ${G.month(ym, events)}</section>
      <section aria-label="Classes">${list.length ? `<div class="pub-list">${list.map(card).join("")}</div>`
        : `<div class="msg">No classes are scheduled right now.${contact ? " Get in touch to plan your training." : ""}</div>`}</section>
      <footer class="pub-foot">${contact ? "Questions? " + contact + "." : ""}${updated && !isNaN(updated) ? ` <span>Updated ${esc(updated.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}.</span>` : ""}</footer>`;
  }

  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    const n = Number(b.dataset.m); ym = n ? G.addMonths(ym, n) : G.ym(G.today()); render();
  });

  // Classes come from the online database when student accounts are set up (supabase-config.js) and the
  // instructor has published there; otherwise from classes.json.
  async function fromSupabase() {
    const cfg = window.LD_SUPABASE || {}, url = String(cfg.url || "").trim().replace(/\/+$/, ""), key = String(cfg.key || "").trim();
    if (!/^https:\/\/[^\s/]+$/.test(url) || key.length < 20) return null;
    const get = (path) => fetch(url + "/rest/v1/" + path, { headers: { apikey: key }, cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const [settings, rows] = await Promise.all([get("calendar_settings?id=eq.1&select=*"), get("classes?select=*")]);
    const s = settings && settings[0];
    if (!s) return null;  // never published online: use classes.json
    return {
      updated: s.updated_at, heading: s.heading, intro: s.intro,
      contact: { instructor: s.instructor, phone: s.phone, email: s.email },
      classes: (rows || []).map(k => ({
        id: k.id, course: k.course, courseName: k.course_name, title: k.title, color: k.color, dates: k.dates,
        time: k.time, location: k.location, price: k.price == null ? null : Number(k.price),
        seats: k.seats, seatsLeft: k.seats_left, notes: k.notes
      }))
    };
  }
  function fromFile() {
    return fetch("classes.json", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  const acct = document.getElementById("pubnav");  // shown once student accounts are set up
  if (acct && window.LD_SUPABASE && String(window.LD_SUPABASE.url || "").trim()) acct.hidden = false;

  fromSupabase().catch(() => null).then(d => d || fromFile())
    .then(d => {
      const t = G.today();
      data = d && typeof d === "object" ? d : {};
      // Hide classes that have ended since the file was published.
      data.classes = (Array.isArray(data.classes) ? data.classes : [])
        .map(k => Object.assign({}, k, { dates: (Array.isArray(k.dates) ? k.dates : []).filter(x => G.parse(x)).sort() }))
        .filter(k => !k.dates.length || G.lastDate(k.dates) >= t)
        .sort((a, b) => (G.firstDate(a.dates) || "9999").localeCompare(G.firstDate(b.dates) || "9999"));
      // Open on the month of the next class.
      const first = data.classes.map(k => G.firstDate(k.dates)).filter(Boolean).sort()[0];
      if (first && first > t) ym = G.ym(first);
      render();
    })
    .catch(() => { main.innerHTML = `<div class="msg">The class calendar couldn't be loaded. Please try again later.</div>`; });
})();
