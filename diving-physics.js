/* Limitless Diving — "Diving Physics – Made Simple" (diving-physics.html), for logged-in members.
   Jamie's kids' lesson (written for about 12-year-olds): "Why bubbles get smaller, and why that matters
   underwater." Boyle's law (the 1, 2, 3 ATA bubble), then Dalton's law (what the bubble is made of), then
   Henry's law (what your body does with it), each colour-coded like the printed handout (blue, teal, amber),
   followed by how the three connect, a "Which law is it?" check and a few more diving-physics basics.
   Every part ends with a quick question with hints. Seawater: 33 ft (10 m) per ATA. No dependencies. */
(function () {
  "use strict";

  const main = document.getElementById("physics");
  const v = { units: "ft", depth: 33 };
  try { const u = localStorage.getItem("ld-physics-units"); if (u === "m" || u === "ft") v.units = u; } catch (e) { /* fine */ }

  /* ---------- Pictures ---------- */

  // Boyle: the same bubble at 1, 2 and 3 ATA. The circle's area shows the volume (full, 1/2, 1/3).
  function boyleSvg() {
    const cols = [
      { x: 110, ata: 1, depth: "Surface", size: "Full size" },
      { x: 300, ata: 2, depth: "33 ft (10 m)", size: "½ the size" },
      { x: 490, ata: 3, depth: "66 ft (20 m)", size: "⅓ the size" }];
    return `<figure class="pm-fig"><svg viewBox="0 0 600 280" role="img" aria-labelledby="pm-boyle-t">
      <title id="pm-boyle-t">The same bubble of air at the surface (1 ATA, full size), at 33 feet (2 ATA, half the size) and at 66 feet (3 ATA, one third the size)</title>
      <defs><linearGradient id="pm-water" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#9fdbe3"/><stop offset=".5" stop-color="#3f97ad"/><stop offset="1" stop-color="#0d4a63"/></linearGradient>
        <radialGradient id="pm-bub" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e3f6f9"/><stop offset="1" stop-color="#b9e4ea"/></radialGradient></defs>
      <rect x="0" y="0" width="600" height="190" rx="12" fill="url(#pm-water)"/>
      <path d="M0 8 C50 0 100 16 150 8 S250 0 300 8 S400 16 450 8 S550 0 600 8" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="2"/>
      ${cols.map(c => {
        const r = (70 / Math.sqrt(c.ata)).toFixed(1);
        return `<circle cx="${c.x}" cy="98" r="70" fill="none" stroke="#ffffff" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 6"/>
          <circle cx="${c.x}" cy="98" r="${r}" fill="url(#pm-bub)" stroke="#0b4a5a" stroke-width="2"/>
          <circle cx="${c.x - r * 0.35}" cy="${98 - r * 0.4}" r="${(r * 0.14).toFixed(1)}" fill="#ffffff"/>
          <text x="${c.x}" y="220" text-anchor="middle" class="pm-svg-big">${c.ata} ATA</text>
          <text x="${c.x}" y="245" text-anchor="middle" class="pm-svg-txt">${c.depth}</text>
          <text x="${c.x}" y="270" text-anchor="middle" class="pm-svg-txt pm-svg-b">${c.size}</text>`;
      }).join("")}
      <path d="M190 98 h28 m-8 -7 l8 7 l-8 7 M380 98 h28 m-8 -7 l8 7 l-8 7" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg><figcaption>Same bubble, same amount of air. Twice the pressure, half the size. Three times the pressure, a third the size. The dashed ring shows its size at the surface.</figcaption></figure>`;
  }

  // Dalton: one same-size breath at 1, 2 and 3 ATA holds 1x, 2x, 3x the molecules; about 1 in 5 is oxygen.
  function daltonSvg() {
    const cols = [{ x: 110, ata: 1 }, { x: 300, ata: 2 }, { x: 490, ata: 3 }], R = 70;
    function dots(cx, n) {
      let s = "";
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt((i + 0.5) / n) * R * 0.8, t = i * 2.39996;
        s += `<circle cx="${(cx + r * Math.cos(t)).toFixed(1)}" cy="${(90 + r * Math.sin(t)).toFixed(1)}" r="6.5" class="${i % 5 === 2 ? "pm-o2" : "pm-n2"}"/>`;
      }
      return s;
    }
    return `<figure class="pm-fig"><svg viewBox="0 0 600 236" role="img" aria-labelledby="pm-dalton-t">
      <title id="pm-dalton-t">One breath of the same size holds 5 molecules at 1 ATA, 10 at 2 ATA and 15 at 3 ATA. About 1 in every 5 is oxygen and the rest are nitrogen, at every depth.</title>
      ${cols.map(c => `<circle cx="${c.x}" cy="90" r="${R}" class="pm-breath"/>${dots(c.x, c.ata * 5)}
        <text x="${c.x}" y="190" text-anchor="middle" class="pm-svg-big">${c.ata} ATA</text>
        <text x="${c.x}" y="218" text-anchor="middle" class="pm-svg-txt">${c.ata === 1 ? "Normal breath" : c.ata + "× of each gas"}</text>`).join("")}
    </svg><figcaption><span class="pm-key pm-key-o2"></span> Oxygen (about 21%) <span class="pm-key pm-key-n2"></span> Nitrogen (about 78%). The same size breath packs in more of both as you go deeper, but the mix stays the same.</figcaption></figure>`;
  }

  // Henry: a sealed soda keeps its gas hidden; opened, the pressure drops and bubbles appear.
  function henrySvg() {
    function bottle(x, open) {
      let bubbles = "";
      const pts = open ? [[-14, 150], [8, 132], [-4, 112], [16, 95], [-16, 80], [4, 64], [-8, 46], [12, 30], [0, 12], [-12, 0]]
        : [[-14, 150], [10, 140], [-6, 124], [14, 110], [-12, 98], [2, 86]];
      pts.forEach(([dx, y], i) => {
        bubbles += open ? `<circle cx="${x + dx}" cy="${40 + y}" r="${3 + (i % 3)}" class="pm-fizz"/>` : `<circle cx="${x + dx}" cy="${40 + y}" r="1.6" class="pm-dissolved"/>`;
      });
      return `<path d="M${x - 14} 40 h28 v18 c0 10 20 16 20 34 v96 a10 10 0 0 1 -10 10 h-48 a10 10 0 0 1 -10 -10 v-96 c0 -18 20 -24 20 -34 z" class="pm-bottle"/>
        <path d="M${x - 33} 110 h66 v76 a8 8 0 0 1 -8 8 h-50 a8 8 0 0 1 -8 -8 z" class="pm-soda"/>
        ${open ? `<rect x="${x + 22}" y="12" width="32" height="12" rx="3" class="pm-cap" transform="rotate(25 ${x + 38} 18)"/>` : `<rect x="${x - 16}" y="30" width="32" height="12" rx="3" class="pm-cap"/>`}
        ${bubbles}`;
    }
    return `<figure class="pm-fig"><svg viewBox="0 0 600 266" role="img" aria-labelledby="pm-henry-t">
      <title id="pm-henry-t">A sealed soda bottle with the gas dissolved and hidden, and an opened bottle with bubbles fizzing out</title>
      ${bottle(170, false)}${bottle(430, true)}
      <path d="M260 120 h70 m-10 -8 l10 8 l-10 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="pm-arrow"/>
      <text x="295" y="105" text-anchor="middle" class="pm-svg-txt">open the cap</text>
      <text x="170" y="228" text-anchor="middle" class="pm-svg-big">Sealed</text><text x="170" y="254" text-anchor="middle" class="pm-svg-txt">Gas stays hidden</text>
      <text x="430" y="228" text-anchor="middle" class="pm-svg-big">Opened</text><text x="430" y="254" text-anchor="middle" class="pm-svg-txt">Bubbles appear</text>
    </svg><figcaption>Your blood and body are like the soda. Deep down the extra nitrogen dissolves in. Come up slowly, like opening the cap a little at a time, so it can leave gently.</figcaption></figure>`;
  }

  /* ---------- Lesson content ---------- */

  const LAWS = [
    {
      id: "boyle", law: "boyle", title: "Boyle's law: squishing the bubble",
      body: () => `<p><b>The setup:</b> at the surface you're under <b>1 ATA</b>. Think of an ATA as a unit for "how hard the air and water are pushing on you." Every <b>33 feet</b> you go down in the ocean adds another whole ATA, on top of the 1 ATA from the air above.</p>
        <ul class="pm-ata-list"><li><b>Surface</b> = 1 ATA</li><li><b>33 ft (10 m)</b> = 2 ATA</li><li><b>66 ft (20 m)</b> = 3 ATA</li></ul>
        ${boyleSvg()}
        <p class="pm-rule"><b>The rule:</b> when pressure doubles, the volume gets cut in half. When pressure triples, it shrinks to one third. Squeeze harder and the bubble gets smaller. It's the same amount of air, squished into less space.</p>
        <p><b>Try it yourself:</b> slide down and watch the bubble.</p>
        ${sliderHtml()}`,
      why: `This is why instructors drill <b>"never hold your breath"</b> into every new diver. Take a full breath at 66 ft (3 ATA) and rocket up to the surface (1 ATA) without breathing out, and the air in your lungs tries to grow back to three times its size. Your lungs can't stretch that much. That's a lung overexpansion injury. <b>On scuba, always keep breathing. Never hold your breath.</b>`,
      q: { text: "A balloon is full size at the surface. You take it down to 33 ft (2 ATA). How big is it now?", options: ["Twice as big", "The same size", "Half the size", "A third of the size"], answer: 2,
        hint: ["Going down squeezes air smaller, not bigger.", "The water is pushing harder now, so it squishes the balloon.", "", "That's at 66 ft, where the pressure is 3 ATA."] }
    },
    {
      id: "dalton", law: "dalton", title: "Dalton's law: air isn't just one thing",
      body: () => `<p>Now we know pressure squishes gas. The next question: what's actually <i>in</i> that squished bubble? Air isn't one ingredient. It's a mix, mostly:</p>
        <ul class="pm-ata-list"><li><b>About 21%</b> oxygen</li><li><b>About 78%</b> nitrogen</li><li>A tiny bit of other stuff</li></ul>
        ${daltonSvg()}
        <p class="pm-rule"><b>The rule:</b> when you squeeze a mix of gases, every ingredient gets squeezed too, by its share. At 2 ATA you're not just breathing "more air." Each breath has <b>double the oxygen</b> and <b>double the nitrogen</b>, even though the percentages (21% and 78%) never change.</p>`,
      why: `This is why depth limits and gas mixes matter. Go deep enough and all that extra-squeezed oxygen can become harmful (oxygen toxicity), which is part of why recreational divers have depth limits. And all that extra nitrogen has to go somewhere. It doesn't just disappear. That's the next law.`,
      link: { href: "nitrox.html#learn", text: "See the oxygen math in the Nitrox Learning view" },
      q: { text: "At 33 ft (2 ATA), what happens to the oxygen in each breath?", options: ["It stays exactly the same", "There's twice as much, but it's still about 21% of the air", "It turns into nitrogen", "It goes up to 42% of the air"], answer: 1,
        hint: ["The breath is squeezed, so more of everything fits in.", "", "Gases don't change into each other. They just get squeezed.", "The percentage never changes. The amount does."] }
    },
    {
      id: "henry", law: "henry", title: "Henry's law: where does the extra nitrogen go?",
      body: () => `<p class="pm-rule"><b>The rule:</b> the more pressure a gas is under, the more of it dissolves into a liquid next to it.</p>
        <p>Think of a sealed soda bottle. It's under pressure, so no fizz escapes and the gas stays hidden in the drink. Crack it open, the pressure drops, and bubbles appear everywhere, because the gas can't stay dissolved at the lower pressure.</p>
        ${henrySvg()}
        <p>Your blood and body are the "soda." While you're deep, under more pressure, the extra nitrogen from Dalton's law slowly dissolves into your body. Come up slowly and it has time to leave safely through your lungs, like opening a soda cap slowly so the gas escapes gently.</p>`,
      why: `Come up too fast and it fizzes inside you: real bubbles forming in your blood and joints. That's <b>decompression sickness, "the bends."</b> It's exactly why we teach slow ascents (no faster than 30 ft or 9 m a minute) and a <b>safety stop</b> at 15 ft (5 m) for 3 minutes.`,
      q: { text: "Why do divers come up slowly and make a safety stop?", options: ["To save air", "So the extra nitrogen can leave the body gently", "To look at fish", "Because the water is colder up there"], answer: 1,
        hint: ["Coming up slowly doesn't really save air. Think about the soda bottle.", "", "Fish are great, but there's a safety reason.", "Temperature isn't the reason. Think about the soda bottle."] }
    }
  ];

  const MORE = [
    {
      id: "buoyancy", title: "Float, sink or hover: buoyancy",
      body: () => `<p>Water pushes up on anything in it (<b>Archimedes' principle</b>). If the push up wins you float (<b>positive</b>), if your weight wins you sink (<b>negative</b>), and if they're equal you hover like an astronaut (<b>neutral</b>). Salt water pushes up harder than fresh water, so you float more easily in the ocean.</p>`,
      why: "Your BCD adds or lets out air to change your buoyancy. Going deeper squeezes the air in your BCD and wetsuit (Boyle again!), so you add a little air to stay neutral.",
      q: { text: "You go from diving in a lake to diving in the ocean with the same gear. What happens?", options: ["You float more and may need a little more weight", "You sink more and need less weight", "Nothing changes"], answer: 0,
        hint: ["", "Salt water pushes up harder, not less.", "Salt water is heavier, so it pushes up more."] }
    },
    {
      id: "light", title: "Light: colors fade and things look bigger",
      body: () => `<p>Water soaks up colors one at a time. <b>Red goes first</b>, within the first 15 to 20 feet, then orange and yellow, until everything looks blue-green. A dive light brings the colors back. Your mask also makes things look about <b>25% closer</b> and <b>a third bigger</b> than they really are.</p>`,
      why: "That fish isn't as big as it looks, and things are a little farther away than you think when you reach for them.",
      q: { text: "Which color fades out first as you go deeper?", options: ["Blue", "Red", "Green"], answer: 1,
        hint: ["Blue lasts the longest. That's why deep water looks blue.", "", "Green lasts quite deep."] }
    },
    {
      id: "sound", title: "Sound travels fast underwater",
      body: () => `<p>Sound moves about <b>4 times faster</b> in water than in air. It reaches both ears at almost the same moment, so you can't tell which way it came from.</p>`,
      why: "You can hear a boat but not tell where it is. Look up and around before you surface, and hold a hand above your head as you come up.",
      q: { text: "You hear a boat while you're underwater. What should you do?", options: ["Swim toward the sound", "Look up and all around, then surface slowly", "Surface fast to see it"], answer: 1,
        hint: ["You can't tell where sound comes from underwater.", "", "Never surface fast. The boat could be right above you."] }
    },
    {
      id: "heat", title: "Water steals your heat",
      body: () => `<p>Water pulls heat from your body about <b>20 to 25 times faster</b> than air at the same temperature. 80°F (27°C) feels warm in the air but can chill you on a long dive.</p>`,
      why: "Wear the right exposure suit for the water, and end the dive if you start shivering.",
      q: { text: "Why do divers wear wetsuits even in fairly warm water?", options: ["To look cool", "Water takes heat away much faster than air", "To float better"], answer: 1,
        hint: ["They do look cool, but there's a better reason.", "", "Wetsuits do float, but that's not the main reason."] }
    }
  ];

  const LAW_NAMES = ["Boyle's law", "Dalton's law", "Henry's law"];
  const WHICH = [
    { id: "w1", q: { text: "Your ears feel squeezed as you swim to the bottom of the deep end.", options: LAW_NAMES, answer: 0, hint: ["", "Dalton is about what's in the air. This is about air spaces getting squished.", "Henry is about gas dissolving. This is about air spaces getting squished."] } },
    { id: "w2", q: { text: "At 66 ft, each breath has three times as many oxygen molecules as at the surface.", options: LAW_NAMES, answer: 1, hint: ["Boyle is about the size of the bubble. This is about what the bubble is made of.", "", "Henry is about gas dissolving into your body. This is about the mix in each breath."] } },
    { id: "w3", q: { text: "You open a bottle of soda and it fizzes.", options: LAW_NAMES, answer: 2, hint: ["Boyle is about air spaces squishing. This is gas coming out of a liquid.", "Dalton is about the mix of gases. This is gas coming out of a liquid.", ""] } }
  ];
  const ALL = LAWS.concat(MORE, WHICH);

  /* ---------- Rendering ---------- */

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function per() { return v.units === "ft" ? 33 : 10; }

  function sliderHtml() {
    const u = v.units;
    return `<div class="pm-sim" aria-label="Bubble and pressure explorer">
      <div class="pm-sim-ctl"><label for="pm-depth">Depth: <b id="pm-depth-out"></b></label>
        <input id="pm-depth" type="range" min="0" max="${u === "ft" ? 132 : 40}" step="${u === "ft" ? 1 : 0.5}" value="${v.depth}">
        <div class="pm-units"><button type="button" data-u="ft" aria-pressed="${u === "ft"}"${u === "ft" ? ' class="on"' : ""}>Feet</button><button type="button" data-u="m" aria-pressed="${u === "m"}"${u === "m" ? ' class="on"' : ""}>Metres</button></div></div>
      <div class="pm-sim-view">
        <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="70" class="pm-ghost"></circle><circle id="pm-ball" cx="80" cy="80" r="70" class="pm-ball"></circle></svg>
        <dl><dt>Pressure</dt><dd id="pm-ata"></dd><dt>Bubble size</dt><dd id="pm-vol"></dd></dl>
      </div>
      <p class="hint" id="pm-say" aria-live="polite"></p></div>`;
  }
  function updateSlider() {
    const d = Number(v.depth) || 0, ata = d / per() + 1, vol = 1 / ata;
    const o = document.getElementById("pm-depth-out"); if (!o) return;
    o.textContent = (v.units === "ft" ? Math.round(d) : d) + " " + v.units;
    document.getElementById("pm-ata").textContent = ata.toFixed(1) + " ATA";
    document.getElementById("pm-vol").textContent = vol >= 0.995 ? "Full size" : Math.round(vol * 100) + "% of surface size";
    // The circle's area shows the volume, so the radius scales with the square root.
    document.getElementById("pm-ball").setAttribute("r", (70 * Math.sqrt(vol)).toFixed(1));
    document.getElementById("pm-say").textContent = d === 0 ? "At the surface: 1 ATA, from the air alone. The bubble is full size."
      : `The water adds ${(d / per()).toFixed(1)} ATA to the 1 ATA from the air. The same bubble is squished to ${Math.round(vol * 100)}% of its surface size.`;
  }

  function quiz(p, label) {
    return `<div class="pm-quiz" data-q="${p.id}"><p class="pm-q"><b>${label || "Quick check"}:</b> ${esc(p.q.text)}</p>
      <div class="pm-opts" role="group" aria-label="Answers">${p.q.options.map((o, i) => `<button type="button" class="btn" data-a="${i}">${esc(o)}</button>`).join("")}</div>
      <p class="pm-fb" aria-live="polite"></p></div>`;
  }
  function part(p, num, why) {
    return `<section class="panel pm-part${p.law ? " pm-law pm-" + p.law : ""}" id="pm-${p.id}" aria-labelledby="pm-h-${p.id}">
      <div class="pm-head"><span class="pm-num" aria-hidden="true">${num}</span><h2 id="pm-h-${p.id}">${esc(p.title)}</h2></div>
      ${p.body()}
      <p class="pm-why"><b>${why}:</b> ${p.why}${p.link ? ` <a href="${p.link.href}">${esc(p.link.text)} →</a>` : ""}</p>
      ${quiz(p)}</section>`;
  }

  function render() {
    main.innerHTML = `<section class="pub-hero"><h1>Diving Physics – Made Simple</h1>
        <p>Why bubbles get smaller, and why that matters underwater. Three laws, in order, because each one sets up the next.</p></section>
      <div class="panel pm-big"><span class="eyebrow">The big idea</span>
        <p>Water is heavy, and it pushes on everything underwater, including the air inside your body and your gear. Three laws explain three different things that happen because of that push.</p>
        <ol class="pm-toc-list">${LAWS.map(p => `<li class="pm-${p.law}"><a href="#pm-${p.id}">${esc(p.title)}</a></li>`).join("")}
          <li><a href="#pm-connect">How the three connect</a></li><li><a href="#pm-which">Which law is it?</a></li><li><a href="#pm-more">More diving physics</a></li></ol>
        <span class="pm-score" id="pm-score" aria-live="polite"></span></div>
      ${LAWS.map((p, i) => part(p, i + 1, "Why it matters")).join("")}
      <section class="panel pm-connect" id="pm-connect" aria-labelledby="pm-h-connect"><h2 id="pm-h-connect">How the three connect</h2>
        <ol><li class="pm-boyle"><b>Boyle:</b> going deeper squeezes gas into a smaller space, and going up un-squeezes it.</li>
          <li class="pm-dalton"><b>Dalton:</b> that squeezed gas is a mix, and every gas in it gets squeezed by its share.</li>
          <li class="pm-henry"><b>Henry:</b> squeezed gas dissolves into your body at depth, and has to come back out slowly on the way up, or it bubbles inside you.</li></ol>
        <blockquote class="pm-land">Boyle's law is what happens to the bubble.<br>Dalton's law is what the bubble is made of.<br>Henry's law is what your body does with it.</blockquote></section>
      <section class="panel pm-which" id="pm-which" aria-labelledby="pm-h-which"><h2 id="pm-h-which">Which law is it?</h2>
        <p>Read each one and pick the law that explains it.</p>
        ${WHICH.map((p, i) => quiz(p, String(i + 1))).join("")}</section>
      <h2 class="pm-more-h" id="pm-more">More diving physics</h2>
      ${MORE.map((p, i) => part(p, LAWS.length + i + 1, "Why it matters to a diver")).join("")}
      <p class="nx-note"><b>For learning only.</b> Always dive within your training and certification, and follow your instructor, dive computer or tables.</p>`;
    updateSlider(); score();
  }

  const done = {};
  function score() {
    const el = document.getElementById("pm-score"); if (!el) return;
    const n = Object.keys(done).length, right = Object.values(done).filter(Boolean).length;
    el.textContent = n ? `Questions: ${n} of ${ALL.length} tried, ${right} right on the first try${n === ALL.length && right === ALL.length ? ". Perfect!" : ""}` : "";
  }

  main.addEventListener("input", (e) => {
    if (e.target.id === "pm-depth") { v.depth = Number(e.target.value); updateSlider(); }
  });
  main.addEventListener("click", (e) => {
    const u = e.target.closest("[data-u]");
    if (u) {
      if (u.dataset.u === v.units) return;
      v.depth = u.dataset.u === "m" ? Math.round(v.depth * 0.3048 * 2) / 2 : Math.round(v.depth / 0.3048);
      v.units = u.dataset.u;
      try { localStorage.setItem("ld-physics-units", v.units); } catch (err) { /* fine */ }
      main.querySelector(".pm-sim").outerHTML = sliderHtml(); updateSlider();
      const b = main.querySelector(`[data-u="${v.units}"]`); if (b) b.focus();
      return;
    }
    const a = e.target.closest(".pm-opts [data-a]"); if (!a) return;
    const box = a.closest(".pm-quiz"), p = ALL.find(x => x.id === box.dataset.q), i = Number(a.dataset.a), fb = box.querySelector(".pm-fb");
    const right = i === p.q.answer;
    if (!(p.id in done)) done[p.id] = right;
    box.querySelectorAll("[data-a]").forEach(b => b.classList.remove("pm-right", "pm-wrong"));
    a.classList.add(right ? "pm-right" : "pm-wrong");
    fb.className = "pm-fb " + (right ? "ok" : "bad");
    fb.textContent = right ? "✓ That's right!" : "Not quite. " + (p.q.hint[i] || "Try again.");
    score();
  });

  render();
})();
