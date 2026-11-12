/* Limitless Diving — "Diving Physics – Made Simple" (diving-physics.html), for logged-in members.
   A plain-language lesson: pressure, air spaces (Boyle), buoyancy, the air we breathe (Dalton and Henry),
   light, sound and heat. Each part has a quick question with feedback, and the pressure part has a
   depth slider that shows the pressure and how much a balloon of air shrinks. Seawater: 33 ft (10 m) per
   atmosphere. No dependencies. */
(function () {
  "use strict";

  const main = document.getElementById("physics");
  const v = { units: "ft", depth: 33 };
  try { const u = localStorage.getItem("ld-physics-units"); if (u === "m" || u === "ft") v.units = u; } catch (e) { /* fine */ }

  // Each section: id, title, plain-language explanation, "why it matters to a diver", and a quick question.
  const PARTS = [
    {
      id: "pressure", icon: "⬇", title: "Water is heavy: pressure",
      body: `<p>Air has weight, and it presses on us all the time. At the beach that's <b>1 atmosphere</b> of pressure, and we don't even notice it.</p>
        <p>Water is about 800 times heavier than air. Every <b>33 feet of seawater (10 m)</b> adds another whole atmosphere. So at 33 ft you feel 2 atmospheres: 1 from the air above and 1 from the water.</p>
        <p class="pm-rule"><b>Rule of thumb:</b> pressure = depth ÷ 33 + 1 (in feet of seawater). In fresh water it's 34 ft per atmosphere.</p>`,
      why: "Your ears, mask and lungs all feel this squeeze, and it changes fastest near the surface.",
      slider: true,
      q: { text: "At 66 feet in the ocean, how many atmospheres are pressing on you?", options: ["1", "2", "3", "66"], answer: 2,
        hint: ["That's only the air at the surface. The water adds more.", "That's the pressure at 33 ft. Go twice as deep.", "", "Feet aren't atmospheres. Every 33 ft adds one."] }
    },
    {
      id: "boyle", icon: "◯", title: "Air gets squeezed: Boyle's law",
      body: `<p>Take a balloon underwater and the water squeezes it smaller. Bring it back up and it grows again. That's <b>Boyle's law</b>: when pressure goes up, the space air takes up goes down, by the same amount.</p>
        <p>Twice the pressure makes the air half the size. Three times the pressure makes it a third. The biggest change happens in the first 33 feet.</p>`,
      why: "Equalize your ears and mask early and often on the way down. On the way up, breathe normally and never hold your breath: the air in your lungs grows as you rise.",
      q: { text: "A balloon is the size of a basketball at the surface. You take it to 33 ft. About how big is it now?", options: ["Twice as big", "The same size", "Half the size", "A quarter of the size"], answer: 2,
        hint: ["Going down squeezes air smaller, not bigger.", "Water pressure squeezes air spaces. Try again.", "", "That would be at 99 ft (4 atmospheres)."] }
    },
    {
      id: "buoyancy", icon: "⇅", title: "Float, sink or hover: buoyancy",
      body: `<p>Water pushes up on anything in it. That push equals the weight of the water the object moves out of the way (<b>Archimedes' principle</b>).</p>
        <ul><li><b>Positive buoyancy:</b> the push up wins, so you float.</li>
          <li><b>Negative buoyancy:</b> your weight wins, so you sink.</li>
          <li><b>Neutral buoyancy:</b> they're equal, so you hover like an astronaut.</li></ul>
        <p>Salt water is heavier than fresh water, so it pushes up harder. You float more easily in the ocean than in a lake.</p>`,
      why: "Your BCD adds or lets out air to change your buoyancy. As you go deeper, the air in your BCD and wetsuit squeezes smaller (Boyle again), so you add a little air to stay neutral.",
      q: { text: "You switch from diving in a lake to diving in the ocean with the same gear. What happens?", options: ["You float more and may need a little more weight", "You sink more and need less weight", "Nothing changes"], answer: 0,
        hint: ["", "Salt water pushes up harder, not less.", "Salt water is heavier, so it pushes up more."] }
    },
    {
      id: "air", icon: "◍", title: "What's in the air we breathe",
      body: `<p>Air is about <b>21% oxygen</b> and <b>79% nitrogen</b>. Each gas does its share of the pushing; that share is its <b>partial pressure</b> (<b>Dalton's law</b>).</p>
        <p>The deeper you go, the higher every partial pressure gets. Too much oxygen pressure can be dangerous, and more nitrogen pressure can make you feel "narced," a little foggy, like being tipsy.</p>
        <p>Nitrox is air with extra oxygen and less nitrogen. That's why it has a depth limit: its oxygen pressure reaches the safe limit sooner.</p>`,
      why: "This is the math behind maximum operating depth. Try it step by step in the Nitrox calculator's Learning view.",
      link: { href: "nitrox.html#learn", text: "Open the Nitrox Learning view" },
      q: { text: "At 33 ft (2 atmospheres) on air, the oxygen partial pressure is about…", options: ["0.21", "0.42", "2.0", "21"], answer: 1,
        hint: ["That's the oxygen at the surface. Pressure has doubled.", "", "That's the total pressure. Oxygen is only 21% of it.", "21 is the percentage, not the pressure."] }
    },
    {
      id: "henry", icon: "⚬", title: "Bubbles in the soda: Henry's law",
      body: `<p>A sealed soda bottle has gas dissolved in it that you can't see. Open it, the pressure drops, and bubbles appear. That's <b>Henry's law</b>: the more pressure, the more gas dissolves into a liquid.</p>
        <p>Your body works the same way. Underwater you soak up extra nitrogen. Come up slowly and it leaves gently through your lungs. Shoot up fast and it can form bubbles, like shaking the soda first. That's decompression sickness, "the bends."</p>`,
      why: "Ascend slowly (no faster than 30 ft or 9 m a minute), make a safety stop at 15 ft (5 m) for 3 minutes, and stay within your computer's or table's limits.",
      q: { text: "Why do we come up slowly and make a safety stop?", options: ["To save air", "So dissolved nitrogen can leave the body gently", "To look at fish", "Because the water is colder"], answer: 1,
        hint: ["Slow ascents don't save much air. Think about the soda bottle.", "", "Fish are nice, but there's a safety reason.", "Temperature isn't the reason. Think about the soda bottle."] }
    },
    {
      id: "light", icon: "◐", title: "Light: colors disappear and things look bigger",
      body: `<p>Water soaks up light, and it takes the colors one at a time. <b>Red goes first</b>, within the first 15 to 20 feet, then orange and yellow. Deep down, everything looks blue-green. A dive light brings the colors back.</p>
        <p>Light also bends when it goes from water into the air in your mask. Things look about <b>25% closer</b> and <b>a third bigger</b> than they really are.</p>`,
      why: "That fish isn't really as big as it looks. And when you reach for something, it's a bit farther away than you think.",
      q: { text: "Which color fades out first as you go deeper?", options: ["Blue", "Red", "Green", "They all fade at once"], answer: 1,
        hint: ["Blue lasts the longest. That's why deep water looks blue.", "", "Green lasts quite deep.", "Water takes the colors one at a time."] }
    },
    {
      id: "sound", icon: ")))", title: "Sound travels fast underwater",
      body: `<p>Sound moves about <b>4 times faster</b> in water than in air. It reaches both your ears at almost the same moment, so your brain can't tell which way it came from.</p>`,
      why: "You'll hear a boat engine, but you can't tell where it is. Look up and around before you surface, and hold a hand above your head as you come up.",
      q: { text: "You hear a boat while you're underwater. What should you do?", options: ["Swim toward the sound", "Look up and all around before surfacing slowly", "Surface fast to see it"], answer: 1,
        hint: ["You can't tell where sound comes from underwater.", "", "Never surface fast, and a boat could be right above you."] }
    },
    {
      id: "heat", icon: "≈", title: "Water steals your heat",
      body: `<p>Water pulls heat away from your body about <b>20 to 25 times faster</b> than air at the same temperature. 80°F (27°C) feels warm in the air but can chill you on a long dive.</p>`,
      why: "Wear the right exposure suit for the water, and end the dive if you start shivering.",
      q: { text: "Why do divers wear wetsuits even in fairly warm water?", options: ["To look cool", "Water takes heat away much faster than air", "To float better"], answer: 1,
        hint: ["They do look cool, but there's a better reason.", "", "Wetsuits do float, but that's not the main reason."] }
    }
  ];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function per() { return v.units === "ft" ? 33 : 10; }
  function sliderMax() { return v.units === "ft" ? 132 : 40; }

  function sliderHtml() {
    const u = v.units;
    return `<div class="pm-sim" aria-label="Pressure and air-space explorer">
      <div class="pm-sim-ctl"><label for="pm-depth">Depth: <b id="pm-depth-out"></b></label>
        <input id="pm-depth" type="range" min="0" max="${sliderMax()}" step="${u === "ft" ? 1 : 0.5}" value="${v.depth}">
        <div class="pm-units"><button type="button" data-u="ft" aria-pressed="${u === "ft"}"${u === "ft" ? ' class="on"' : ""}>Feet</button><button type="button" data-u="m" aria-pressed="${u === "m"}"${u === "m" ? ' class="on"' : ""}>Metres</button></div></div>
      <div class="pm-sim-view">
        <svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="70" class="pm-ghost"></circle><circle id="pm-ball" cx="80" cy="80" r="70" class="pm-ball"></circle></svg>
        <dl><dt>Pressure</dt><dd id="pm-ata"></dd><dt>Air space size</dt><dd id="pm-vol"></dd></dl>
      </div>
      <p class="hint" id="pm-say" aria-live="polite"></p></div>`;
  }
  function updateSlider() {
    const d = Number(v.depth) || 0, ata = d / per() + 1, vol = 1 / ata;
    const o = document.getElementById("pm-depth-out"); if (!o) return;
    o.textContent = (v.units === "ft" ? Math.round(d) : d) + " " + v.units;
    document.getElementById("pm-ata").textContent = ata.toFixed(1) + " atmospheres";
    document.getElementById("pm-vol").textContent = vol >= 0.995 ? "Full size" : Math.round(vol * 100) + "% of surface size";
    // Area shows the volume change: radius scales with the square root so the circle doesn't overstate it.
    document.getElementById("pm-ball").setAttribute("r", (70 * Math.sqrt(vol)).toFixed(1));
    document.getElementById("pm-say").textContent = d === 0 ? "At the surface: 1 atmosphere, from the air alone."
      : `The water adds ${(d / per()).toFixed(1)} atmosphere${d === per() ? "" : "s"} to the 1 from the air. Air spaces are squeezed to ${Math.round(vol * 100)}% of their size.`;
  }

  function quiz(p) {
    return `<div class="pm-quiz" data-q="${p.id}"><p class="pm-q"><b>Quick check:</b> ${esc(p.q.text)}</p>
      <div class="pm-opts" role="group" aria-label="Answers">${p.q.options.map((o, i) => `<button type="button" class="btn" data-a="${i}">${esc(o)}</button>`).join("")}</div>
      <p class="pm-fb" aria-live="polite"></p></div>`;
  }

  function render() {
    main.innerHTML = `<section class="pub-hero"><h1>Diving Physics – Made Simple</h1>
        <p>The science that keeps divers safe, in plain words. Read each part, then try the quick check. Great for new divers and young divers alike.</p></section>
      <nav class="panel pm-toc" aria-label="In this lesson"><b>In this lesson</b><ol>${PARTS.map(p => `<li><a href="#pm-${p.id}">${esc(p.title)}</a></li>`).join("")}</ol>
        <span class="pm-score" id="pm-score" aria-live="polite"></span></nav>
      ${PARTS.map((p, i) => `<section class="panel pm-part" id="pm-${p.id}" aria-labelledby="pm-h-${p.id}">
        <div class="pm-head"><span class="pm-num" aria-hidden="true">${i + 1}</span><h2 id="pm-h-${p.id}">${esc(p.title)}</h2></div>
        ${p.body}
        ${p.slider ? sliderHtml() : ""}
        <p class="pm-why"><b>Why it matters to a diver:</b> ${esc(p.why)}${p.link ? ` <a href="${p.link.href}">${esc(p.link.text)} →</a>` : ""}</p>
        ${quiz(p)}</section>`).join("")}
      <p class="nx-note"><b>For learning only.</b> Always dive within your training and certification, and follow your instructor, dive computer or tables.</p>`;
    updateSlider(); score();
  }

  const done = {};
  function score() {
    const el = document.getElementById("pm-score"); if (!el) return;
    const n = Object.keys(done).length, right = Object.values(done).filter(Boolean).length;
    el.textContent = n ? `Quick checks: ${n} of ${PARTS.length} tried, ${right} right on the first try${n === PARTS.length && right === PARTS.length ? ". Perfect!" : ""}` : "";
  }

  main.addEventListener("input", (e) => {
    if (e.target.id === "pm-depth") { v.depth = Number(e.target.value); updateSlider(); }
  });
  main.addEventListener("click", (e) => {
    const u = e.target.closest("[data-u]");
    if (u) {
      if (u.dataset.u === v.units) return;
      v.depth = Math.round(u.dataset.u === "m" ? v.depth * 0.3048 * 2 : v.depth / 0.3048) / (u.dataset.u === "m" ? 2 : 1);
      v.units = u.dataset.u;
      try { localStorage.setItem("ld-physics-units", v.units); } catch (err) { /* fine */ }
      const box = main.querySelector(".pm-sim"); box.outerHTML = sliderHtml(); updateSlider();
      const b = main.querySelector(`[data-u="${v.units}"]`); if (b) b.focus();
      return;
    }
    const a = e.target.closest(".pm-opts [data-a]"); if (!a) return;
    const box = a.closest(".pm-quiz"), p = PARTS.find(x => x.id === box.dataset.q), i = Number(a.dataset.a), fb = box.querySelector(".pm-fb");
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
