/* Limitless Diving — Elements of tech diving: the lesson text for each tab (tech-diving.html).
   Summarised in our own words from "The Essentials of Diving: Dress for Success" by Dan MacKay (2004),
   with notes where today's gear has moved on. Edit the words here; tech-diving.js draws the pages.
   Each page: id (used in the address, tech-diving.html#id), label (tab name), parent (for sub menus),
   title, lead, photo [file in photos/, alt text, focus], sections [[heading, html]], check [question, answer]. */
(function () {
  "use strict";

  const ul = (items) => `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`;
  const ol = (items) => `<ol>${items.map(i => `<li>${i}</li>`).join("")}</ol>`;
  const note = (t, title) => `<div class="td-note"><b>${title || "Instructor's note"}</b><p>${t}</p></div>`;
  const today = (t) => `<div class="td-note today"><b>Gear today</b><p>${t}</p></div>`;

  const PAGES = [
    { id: "home", label: "Home" },

    { id: "dir", label: "DIR", title: "Doing It Right",
      lead: "DIR isn't a brand or a shopping list. It's a way of thinking about the dive, the team and the gear, so that every piece of equipment earns its place.",
      photo: ["david-trim", "Diver in a drysuit and harness holding flat trim in open water", "50% 40%"],
      sections: [
        ["Where it came from", `<p>DIR grew out of the Florida cave diving community in the late 1980s and early 1990s. Pioneers such as Sheck Exley, Bill Main and Parker Turner studied why cave divers were getting hurt, and found that too much gear, set up a different way by every diver, was part of the problem. The stripped-down style they used came to be called <i>Hogarthian</i>, after Bill "Hogarth" Main.</p>
          <p>George Irvine and Jarrod Jablonski took that equipment idea further and turned it into a whole approach to diving. Irvine, running the Woodville Karst Plain Project (WKPP), named it <b>Doing It Right</b>. Jablonski went on to found Global Underwater Explorers (GUE), which built its training around it.</p>`],
        ["The big ideas", ul([
          "<b>Only what you need.</b> Nothing more, nothing less. Extra gear is often a patch for a missing skill.",
          "<b>Never substitute equipment for skill.</b> A diver with good buoyancy doesn't need a helmet in a cave. They need awareness.",
          "<b>Standard across the team.</b> Everyone is set up the same way, so anyone can find a teammate's gas, light or valve in the dark.",
          "<b>Start from the mission.</b> Ask what the dive needs, then build the gear around it (top down), instead of bolting more onto a rec rig (bottom up).",
          "<b>Learn it right the first time.</b> You remember best what you learn first. Start with the right habits and there's nothing to unlearn later."])],
        ["Why everything goes where it goes", `<p>Picture a team on a long, deep wreck in cold water with current. They need doubles, at least two deco gases, primary and backup lights, scooters, drysuits and argon. Now follow one choice through:</p>
          ${ol(["The scooter is driven with the <b>right</b> hand.", "So the primary light is held in the <b>left</b> hand.", "So the bottom timer or computer goes on the <b>right</b> wrist, where the light can shine on it while you drive."])}
          <p>Each placement makes sense once you see the whole system. Think of it like the spokes on a bicycle wheel: take one or two out and the wheel stops being true. Adding a long hose to an otherwise random rig doesn't make it DIR.</p>`],
        ["Not just for cave divers", `<p>You don't have to dive deep or ride a scooter to get something out of this. A clean, consistent rig is easier to dive, easier to fix and safer to share air from, whether you're on a reef or on a stage at 70 feet. When something looks odd, ask two questions: <b>why does this piece belong where it is?</b> and <b>am I using gear to cover for a skill?</b></p>`]],
      check: ["Why does the primary light go in the left hand?", "Because the scooter is driven with the right hand. That in turn puts the bottom timer or computer on the right wrist, where the light can reach it."] },

    { id: "exposure", label: "Exposure", title: "Exposure protection",
      lead: "Your suit has two jobs: keep you warm for the whole dive and let you stay balanced in the water. Cold divers breathe more, think slower and decompress worse.",
      photo: ["reel-drysuit", "Diver in a drysuit with dry gloves running a reel", "50% 35%"],
      sections: [
        ["Why cold matters", ul([
          "Your gas use goes up as you lose heat.",
          "Heart rate and blood pressure rise as your body fights to stay warm.",
          "In very cold water, judging time, concentrating and short-term memory all suffer.",
          "Divers are poor judges of how cold they really are. If you're shivering, you're already in trouble.",
          "Being chilled can also change how well you off-gas on a decompression dive."])],
        ["Drysuit or wetsuit?", `<p>Water pulls heat from your body many times faster than air, so a drysuit, which keeps a layer of gas around you, wins for cold water and long dives. A wetsuit traps a thin layer of water that your body warms up. That's fine in warm water (above about 70°F / 21°C) and it's cheap and easy to fit.</p>
          <p>The catch with neoprene is Boyle's law. The tiny gas bubbles in the foam shrink as you go down: half their size at 33 ft (2 ATA), a third at 66 ft (3 ATA). You lose warmth <i>and</i> buoyancy at depth, so a diver weighted right at the surface can be badly overweighted on the bottom. That's why heavy steel tanks don't belong with a wetsuit.</p>`],
        ["Undergarments", `<p>The undergarment is what actually keeps you warm in a drysuit. A good one is worth more than a fancy shell.</p>
          ${ul(["Wicking layer next to the skin. <b>No cotton.</b>", "An insulating layer that still works when wet, such as Thinsulate.", "A breathable outer shell that moves moisture out to the suit.", "Low loft and a snug cut. High-loft fill traps gas that shifts around and messes with your trim.", "Layer up for colder water: add a fleece base layer, then an insulated vest."])}
          <p><b>Fit check:</b> put it on, have your buddy hold it down at your waist, and reach back to touch the back of your neck. You should reach as far as you can without it.</p>`],
        ["Drysuit: what to look for", ul([
          "Shell material that doesn't change buoyancy with depth (trilaminate, not crushed or thick neoprene).",
          "Front entry zipper that clears your harness waist strap and shoulder straps.",
          "Dump valve that vents faster than the inflator fills, placed so your body position controls it.",
          "Pockets on the outside of both thighs, just above the knee.",
          "Boots you can walk your entry in, with room for your thermal socks."])],
        ["Drysuit fit test", `<p>Wear every layer you'll dive in when you try it on or get measured. Then go through these positions. You should be able to do all of them, with no tight spots and no big bags of extra material:</p>
          ${ol(["Squat down into a ball.", "Stand tall and reach for the sky.", "Cross your arms in front of your chest and stack your elbows.", "Bend at the waist and touch your toes.", "Reach over your head and down your back as far as you can.", "Reach back and touch both tank valves."])}
          ${note("Never dive a drysuit without training. A suit that's never been used properly is a buoyancy problem waiting to happen. We'll set it up with you on the first dive.")}`],
        ["Hoods, gloves and the pee valve", ul([
          "<b>Hood:</b> good quality neoprene, a thinner face seal, a vent for trapped air, and seams that run beside the chin, not under it. Trim the face and neck to fit.",
          "<b>Wet gloves:</b> fine above about 70°F. Short cuffs that tuck over the suit; skip the long Velcro cuffs.",
          "<b>Dry gloves:</b> on a ring system that keeps your inner wrist seals, so a torn glove doesn't flood the suit. A short piece of line under the seal lets gas move into the glove.",
          "<b>Overboard discharge (pee) valve:</b> a real comfort and safety item on long cold dives. Keep the cap closed whenever it isn't in use."])]],
      check: ["Your wetsuit has lost how much of its volume at 66 feet?", "About two thirds. At 3 ATA the bubbles are a third of their surface size, so you've lost warmth and lift."] },

    { id: "backplate", label: "Backplate", title: "Backplate and harness",
      lead: "The backplate is the foundation the whole rig is built on: a stable platform for the tanks, ballast spread across your back, and a harness with D-rings right where your hands expect them.",
      photo: ["trim-wetsuit", "Diver with a single tank on a backplate gliding over a lake bottom", "50% 45%"],
      sections: [
        ["What to look for", ul([
          "Aluminum (lighter, for warm water and travel) or stainless steel (more ballast).",
          "One continuous piece of webbing. <b>No quick releases.</b> Buckles fail, and they fail at the worst time.",
          "Stainless hardware in the right places.",
          "Chest D-rings bent slightly outward, so they're easy to clip to.",
          "A crotch strap with a rear D-ring."])],
        ["How to fit it", `${ol([
          "Wear the exposure suit you'll dive in, with all of its layers. Switching from wet to dry may mean refitting.",
          "Loosen everything, put the plate on and center it on your spine, with the top of the plate just below the big bump at the base of your neck.",
          "Snug the shoulder straps evenly. Bend over at the waist: you should be able to slide a flat hand under each strap.",
          "Set the chest D-rings in the small hollow below your collarbone. Check: close your eyes, hold your arm out level, and reach across. Your thumb should land on the D-ring.",
          "Waistband snug just below your navel, buckle to the right. Slide your knife sheath onto the left side of the waistband first.",
          "Run the crotch strap snug, but not tight. It holds the waistband down and centered.",
          "Set the rear D-ring on the crotch strap level with the bottom of your tanks.",
          "Don't trim any webbing until the fit is final."])}
          ${note("The most common mistake is making it too tight. Snug and stable, not a corset. Fitting is much easier with a buddy helping.")}`],
        ["Storage pack and the big SMB", `<p>A small pack on the bottom of the plate is a tidy place for your large SMB. On doubles, leave a bottom corner loose so you can reach the tank bolts. Two loops of bungee at the base of the plate work just as well. In a cave you don't need it, so take it off.</p>`]],
      check: ["Where should your thumb land when you reach across with your eyes closed?", "On the opposite chest D-ring. If you miss high or low, move the D-ring."] },

    { id: "wing", label: "Wing", title: "The wing",
      lead: "The wing gives you exactly the lift your tanks need, sitting behind you and out of the way so you can hold flat trim.",
      photo: ["trim-deck", "Diver in doubles holding flat trim over a sunken deck", "50% 50%"],
      sections: [
        ["What to look for", ul([
          "Low profile and sized to the tanks you use.",
          "A single bladder. Two bladders give you two things to manage and a way to fool yourself.",
          "Gas that can move freely in and out.",
          "A rear dump at the bottom left of the wing.",
          "<b>No pull dumps on the inflator hose.</b>",
          "A corrugated hose long enough to come over your left shoulder and put the inflator just below the left chest D-ring.",
          "Tough material and solid construction."])],
        ["One wing for singles and doubles?", `<p>Sadly, no. A single-tank wing is narrow, because a single tank is narrow. Put it on doubles and it can't inflate properly. A doubles wing on a single is too wide; it wraps around the tank, traps gas and makes your lift unpredictable. Buy the wing for the tanks you dive.</p>`],
        ["Setting it up", ul([
          "The wing is sandwiched between the backplate and the tank.",
          "<b>Single tank:</b> fit the single tank adapter, slide the wing over the bolts, then the plate. Lock washers and wing nuts, snugged down.",
          "<b>Doubles:</b> the wing goes straight onto the tank band bolts, with the plate on top.",
          "Hold the inflator under the left chest D-ring with a small loop of bungee, and keep the corrugated hose clipped close with retainers."])],
        ["Why the dump goes bottom left", `<p>With the dump low on the left, a rescuer holding a diver in trouble can vent their wing and control the ascent. Getting the plumbing in the same place on every diver is what makes team rescues work.</p>`]],
      check: ["Why skip pull-dumps on the inflator?", "They add a failure point and can vent gas when you don't want them to. The rear dump and the inflator's oral dump do the job."] },

    { id: "regulators", label: "Regulators", title: "Regulators and the long hose",
      lead: "Two good second stages, five hoses, and a routing you can deploy without thinking. This is the heart of the gas sharing system.",
      photo: ["regulator", "Close up of a regulator first stage", "50% 50%"],
      sections: [
        ["Picking regulators", `${ul([
          "Choose on performance and reliability. Today's good regulators are reliable enough that you don't need two different designs.",
          "<b>Balanced first stages.</b> An unbalanced one breathes harder as the tank empties.",
          "Second stages you can open without tools to clear debris.",
          "<b>DIN</b> everywhere: regulators and tank valves. The captured O-ring is more secure, lower profile and easier to configure. Mixing DIN and yoke on a team breaks the swap-anything rule."])}`],
        ["The five hoses", `<div class="td-table"><table>
          <thead><tr><th>Hose</th><th>Length</th><th>Job</th></tr></thead>
          <tbody>
          <tr><td>Primary (long hose)</td><td>7 ft (6 ft for shorter divers)</td><td>The regulator you breathe and donate</td></tr>
          <tr><td>Backup (necklace)</td><td>22 to 24 in</td><td>Sits under your chin on a bungee necklace</td></tr>
          <tr><td>Wing inflator</td><td>22 in</td><td>Low pressure, over the left shoulder</td></tr>
          <tr><td>SPG</td><td>24 in</td><td>High pressure, clipped to the left hip D-ring</td></tr>
          <tr><td>Drysuit inflator</td><td>to fit</td><td>Snug run to your suit valve</td></tr>
          </tbody></table></div>
          <p>These are starting points. Do a dry fit before buying. The necklace hose should let you turn your head fully to the left without pulling, but not be so long it covers the right chest D-ring.</p>`],
        ["Why you breathe the long hose", ul([
          "When someone is out of gas, you give them the regulator in your mouth. You <i>know</i> it's working and it's turned on.",
          "They get your best regulator, not a forgotten octopus full of sand.",
          "You breathe your necklace backup, which is right under your chin.",
          "Seven feet lets you swim one behind the other in tight spaces, and it's quick to stow again afterward."])],
        ["Routing the long hose", `${ol([
          "From the first stage, down the right side behind the wing (or alongside it).",
          "Under the light canister (or knife) on your right hip.",
          "Diagonally up across your chest from right to left.",
          "Behind your neck, from left to right, and into your mouth."])}
          <p>When you're breathing something else, such as a deco gas, clip the long hose's bolt snap to the right chest D-ring.</p>
          ${note("To donate, you just pass the regulator from your mouth and pop the necklace in. Practice it until it's boring.")}`],
        ["Which port gets what", `<p>Stand behind the tank with the regulator facing away from you, the way you'd wear it. On a single tank both second stages come off the <b>right</b> of the first stage; the SPG, wing inflator and drysuit hose come off the <b>left</b>. You need one high pressure port and four low pressure ports.</p>
          <p>On doubles, the long hose comes off the <b>right post</b>, and the necklace, SPG and wing inflator come off the <b>left post</b>.</p>`],
        ["The SPG", `<p>Your brain is your main gas management tool; the SPG confirms it. Pick something rugged, accurate and easy to read with a luminous face, take off the 36 in hose and the boot it came with, and put it on a 24 in hose. It clips to the left hip D-ring with a 3/4 in bolt snap. Small brass gauges are great for stage bottles.</p>`]],
      check: ["Out-of-gas diver in front of you. What do you hand them?", "The regulator in your mouth, on the long hose. Then you switch to your necklace backup."] },

    { id: "fins", label: "Fins", title: "Fins",
      lead: "The right fin lets you frog kick, back up and turn in place without stirring up the bottom. It's a trim tool as much as an engine.",
      photo: ["trim-wetsuit", "Diver gliding in trim, fins up in a frog kick position", "50% 50%"],
      sections: [
        ["What to look for", ul([
          "A short, broad, moderately stiff blade. The classic is the rubber jet-style fin.",
          "Simple strap attachment, ideally stainless spring straps.",
          "No plastic ratchet buckles. They snag line and break, usually right before the dive.",
          "Rubber fins are slightly negative, which helps your feet stay up in trim."])],
        ["Why not long or split fins?", `<p>Long thin blades and split fins are made for flutter kicking. They're hard or impossible to use for the frog kick, modified frog, helicopter turn and back kick you need in silty water, in wrecks and in caves.</p>`],
        ["How to fit them", ol([
          "Put on the drysuit or wetsuit boots you'll dive in.",
          "Your foot should slide in snugly, with little side-to-side play.",
          "Pull the strap up over the boot's fin retainer, if it has one.",
          "With rubber straps, tape the extra strap back on itself so there's nothing to catch line.",
          "Spring straps don't adjust, so buy the length that fits your boot."])],
        ["One pair for both suits?", `<p>Maybe not. Drysuit boots are much bigger than neoprene booties, so a fin pocket sized for your drysuit can be far too loose with a wetsuit. Many divers end up with two pairs.</p>`]],
      check: ["Name two kicks a split fin makes hard.", "Any two of: frog kick, modified frog kick, back kick, helicopter turn."] },

    { id: "tanks", label: "Tanks", title: "Tanks",
      lead: "Your tanks hold the gas, set a lot of your ballast and decide how you'll balance in the water. On a team, they also hold your buddy's emergency supply.",
      photo: ["wreck-truck", "Diver in doubles exploring a sunken truck", "60% 50%"],
      sections: [
        ["Choosing tanks", `<div class="td-table"><table>
          <thead><tr><th>Diving</th><th>A good starting point</th></tr></thead>
          <tbody>
          <tr><td>Single tank</td><td>Aluminum 80 (or a 12 L, 200 bar steel)</td></tr>
          <tr><td>Salt water in a wetsuit, or shallow cave</td><td>Twin aluminum 80s</td></tr>
          <tr><td>Drysuit and deeper technical dives</td><td>Twin steels, such as LP 104s or HP 100 to 130s</td></tr>
          </tbody></table></div>
          ${note("Your teammate is carrying your emergency gas, so everyone on a team should dive similar tanks. It makes gas planning and logistics simple.")}`],
        ["Rigging", ul([
          "Strip off extra stickers. Keep your name and the visual inspection (VIP) sticker.",
          "Singles get one DIN valve.",
          "Doubles: take off the tank boots, mark your name permanently, and put the VIP stickers low on the inside, where they're protected."])],
        ["In this section", `<p>Use the menu above for <a href="#manifolds">Manifolds</a>, <a href="#bands">Bands</a>, <a href="#weighting">Weighting</a> and step-by-step <a href="#assembly">Assembly</a> of a set of doubles.</p>`]],
      check: ["Why should everyone on the team dive similar tanks?", "Because your teammate's gas is your emergency supply. Matching tanks keeps gas planning simple and predictable."] },

    { id: "manifolds", label: "Manifolds", parent: "tanks", title: "Manifolds",
      lead: "The manifold joins two tanks and gives you two separate first stages. Set up right, it lets you save most of your gas when something leaks.",
      sections: [
        ["What to look for", ul([
          "A simple <b>isolator manifold</b>: two posts and a center isolator valve.",
          "DIN outlets rated to 300 bar.",
          "Burst disks rated correctly for your tanks.",
          "Dual (twin barrel) O-rings on the isolator, so it can move a little under pressure and still seal.",
          "Skip older friction-sealed metal bushing designs. They're fragile and fussy to set up."])],
        ["Why an isolator?", `<p>Some divers use two separate tanks, or a straight bar with no isolator. The diving community has settled on the isolated manifold. Yes, the isolator adds a few possible leak points, but being able to shut it and keep half your gas when a post or regulator fails is worth far more.</p>`],
        ["Know your valves", `<p>The safest manifold in the world doesn't help if you can't reach the valves or don't know what to do with them. Get proper training in the failures and the shutdown drill, make sure your suit and harness let you reach both posts, and practice regularly. Knowing you have the right valve setup without the skill to use it just breeds overconfidence.</p>
          ${note("We drill valve shutdowns on every tech class, starting on land. Expect to do them until you can do them without thinking, in the dark, in gloves.")}`]],
      check: ["Left post regulator is free flowing. What do you close first?", "Follow the drill you trained: in most cases close the left post to stop the loss, then confirm the right side is good. Practice the full shutdown with your instructor."] },

    { id: "bands", label: "Bands", parent: "tanks", title: "Tank bands",
      lead: "The bands, not the manifold, hold your doubles together. They also give the backplate its mounting bolts.",
      sections: [
        ["What they do", ul([
          "Hold the two tanks rigidly side by side.",
          "Take all the strain off the manifold. The manifold should carry no load at all.",
          "Carry the two bolts the backplate sits on."])],
        ["What to look for", ul([
          "3 inch wide stainless bands, sized to your tank diameter.",
          "Reinforced in the middle where the bolt pulls the band tight, so it won't bend when torqued.",
          "Stainless bolts and nylon locking nuts."])],
        ["Spacing", `<p>Standard backplates expect the two band bolts <b>11 inches apart</b>, center to center. The top band sits right at the shoulder (where the neck of the tank starts to curve). Use your backplate as a template to place the bottom band. See <a href="#assembly">Assembly</a> for the full steps.</p>`]],
      check: ["What holds a set of doubles together: the manifold or the bands?", "The bands. The manifold should carry no strain at all."] },

    { id: "weighting", label: "Weighting", parent: "tanks", title: "Weighting and trim",
      lead: "Weight just enough to hold your last stop with nearly empty tanks, and put it where it helps you stay flat. Where it goes matters as much as how much.",
      sections: [
        ["The four ways to add weight", ol([
          "<b>Simple weight belt.</b> Works, but it sits on your hips and ditching it takes two moves (waistband, then belt). Wear it over the crotch strap in back and under it in front.",
          "<b>Integrated weight belt.</b> Fine if the weight sits evenly at your waistband.",
          "<b>V-weight.</b> A long wedge of lead between the tanks or the tank and wing, held by the backplate bolts. Spreads weight along your body for much better trim.",
          "<b>Trim weights.</b> Small amounts under the plate or on a tank. Rarely needed if the rest of the rig is right."])],
        ["What usually works", ul([
          "<b>Steel doubles:</b> most fit divers need no extra weight at all.",
          "<b>Aluminum single or doubles:</b> usually need some, best as a V-weight.",
          "<b>Single AL80 in a 3 mm suit:</b> a weighted single tank adapter (about 8 to 10 lb) is often all you need.",
          "Use a steel backplate when you need more ballast, an aluminum one when you need less."])],
        ["Ankle weights?", `<p>If your feet keep floating up, it's usually gas trapped in boots or a suit that's too big in the legs. Ankle weights just cover that up. Fix the fit instead. It's a perfect example of using gear to patch a problem.</p>`],
        ["Check yourself", `<p>At the end of a dive, with your tanks near your reserve, empty your wing and hold a stop at 10 to 20 feet. If you can hover without kicking or sinking, you're weighted right.</p>`]],
      check: ["Steel doubles and a drysuit: do you usually need a weight belt?", "Usually not. Most fit divers need no extra weight with steel doubles. Prove it by holding your last stop with nearly empty tanks."] },

    { id: "assembly", label: "Assembly", parent: "tanks", title: "Assembling a set of doubles",
      lead: "Putting doubles together is a careful, step-by-step job. Take your time, keep the tanks parallel, and leak check before you dive.",
      sections: [
        ["You'll need", ul(["Two 1/2 in open or box end wrenches", "A 1/2 in deep socket and ratchet", "Oxygen-compatible lubricant", "A rubber mallet", "A pencil", "A small wooden block", "Your backplate (as a spacing guide)"])],
        ["Manifold and valves", ol([
          "Take the manifold apart: unscrew the left post, then the right, and lay them side by side.",
          "Lay the isolator between them <b>the same way round</b>. One side is reverse threaded; forcing it the wrong way ruins the threads.",
          "Lubricate each post's tank O-ring and lightly lubricate the valve threads.",
          "Lubricate the isolator's barrel O-rings.",
          "Thread each post into its tank by hand, then tap lightly with the rubber mallet to seat it.",
          "Kneel at the valve end and start the isolator into both posts. Back it off and retry until both sides catch evenly.",
          "Thread it in while gently squeezing the tanks together. Keep them parallel so the manifold doesn't bend.",
          "When it's fully in, back it off half a turn so the knob points straight back."])],
        ["Bands", ol([
          "Lubricate each band bolt so the nylon locking nut doesn't gall it, and start the nut finger tight.",
          "Put the wooden block under the tank bottoms and slide the first band up to the shoulder of the tanks.",
          "Hold the bolt head from under the manifold with a wrench and tighten the nut with the socket until the tanks don't shift.",
          "Start the second band from the bottom, loose enough to move.",
          "Slide it up until its bolt is 11 in from the top bolt, center to center. Set the backplate on and mark the position with a pencil.",
          "Tighten the bottom band to your marks, then test fit the backplate again.",
          "Final tighten: snug, then about one and a half to two more turns. The tanks swell when filled; overtightening can snap a bolt."])],
        ["Before you dive", ul([
          "Attach the VIP stickers.",
          "During the first fill, spray soapy water on the tank necks, valve knobs, burst disks and isolator joints. Bubbles mean take it apart and fix it.",
          "Don't lock the isolator nuts down tight. A little play lets it move if it gets knocked, instead of breaking."])],
        ["", note("If this is your first set, do it with us in the shop. It's a great skills night and you'll learn your manifold inside and out.")]],
      check: ["Why back the isolator off half a turn?", "So the knob points straight back and the isolator isn't jammed tight. A little play lets it move if it's bumped instead of cracking."] },

    { id: "gear", label: "Gear", title: "Gear and accessories",
      lead: "The small stuff: everything clipped to your harness or tucked in a pocket. Each item has a home, so you and your team can find it by feel.",
      photo: ["wreck-trolley", "Diver with a light exploring a sunken trolley", "50% 50%"],
      sections: [
        ["Where it all lives", `<div class="td-table"><table>
          <thead><tr><th>Spot</th><th>What goes there</th></tr></thead>
          <tbody>
          <tr><td>Right wrist</td><td><a href="#computers">Computer or bottom timer</a></td></tr>
          <tr><td>Left wrist</td><td><a href="#compass">Compass</a></td></tr>
          <tr><td>Chest D-rings</td><td>Two <a href="#lights">backup lights</a>; long hose clips right when stowed</td></tr>
          <tr><td>Left hip D-ring</td><td>SPG</td></tr>
          <tr><td>Right hip</td><td>Primary light canister</td></tr>
          <tr><td>Rear crotch strap D-ring</td><td><a href="#reels">Primary reel</a>, scooter</td></tr>
          <tr><td>Left pocket</td><td>75 ft <a href="#spools">safety spool</a>, backup mask, backup timer</td></tr>
          <tr><td>Right pocket</td><td>Small <a href="#smb">SMB</a> on its spool, <a href="#wetnotes">wet notes</a></td></tr>
          </tbody></table></div>`],
        ["Bolt snaps and double enders", `<p>Buy <b>all stainless steel</b>. Brass and nickel ones usually have a steel spring that rusts and jams, even in fresh water, and you'll often be working them by feel. Pick the right size for the job, not the biggest:</p>
          ${ul(["1/2 in: long hose and backup lights", "3/4 in: SPG", "3/4 in or 1 in: stage bottles", "Double enders: the do-anything clip, from pockets to reels"])}
          <p>Big clips feel easier at first. Small ones get easy once your hands learn them. Never substitute equipment for skill.</p>`],
        ["Tying on a bolt snap", `<p>Tie bolt snaps on with about a foot of cave line, not a metal ring: the line can be cut in an emergency. Wrap the line around the item (twice around a hose), through the bolt snap, snug it up, tie it off and melt the ends with a lighter so they don't fray.</p>`],
        ["Masks and snorkels", `<p>Low volume, one or two lenses, tempered glass, and a comfortable seal: hold it to your face without the strap and sniff gently; it should stay put. When you find one that fits, buy two and carry the backup in a pocket. Swap the rubber strap for a neoprene one, and treat both masks for fog, especially the backup. If you need a prescription, put it in both.</p>
          <p>You don't wear a snorkel on a tech rig. It gets in the way of the long hose and your drills. If a site requires one, carry a folding one in a pocket.</p>`]],
      check: ["Why tie bolt snaps on with line instead of a split ring?", "Line can be cut quickly with your knife or shears if the clip jams or snags. A metal ring can't."] },

    { id: "computers", label: "Computers", parent: "gear", title: "Computers and timing",
      lead: "You need depth and time you can trust, a plan in your head, and a backup if the main device dies.",
      photo: ["dpv-purple-light", "Diver on a scooter with gauges and a light", "50% 40%"],
      sections: [
        ["What your timing device must do", ul([
          "Show depth and run time clearly, so you can work out your average depth and your decompression.",
          "Have a big display that's easy to read in low light.",
          "Keep the screen simple. Only what you need.",
          "A stopwatch you can reset at each stop is handy."])],
        ["Where to wear it", `<p>On your <b>right</b> wrist, so your primary light (in your left hand) can shine on it while you drive a scooter with your right. Carry a backup: a second timer or computer on the left, or in your left pocket.</p>`],
        ["Don't let it think for you", `<p>The original DIR advice was a bottom timer or a computer set to gauge mode. The worry was real: many recreational computers lock you out if you break their rules on the way up, leaving you with no depth or time just when you need it. And a diver who only follows the screen slowly loses the ability to spot a wrong schedule.</p>
          ${today("Most tech divers now dive a trimix-capable computer, and that's fine. The rule still stands: plan the dive, carry the plan in your wet notes, know your stops before you get in, and carry a second device for depth and time. Agree as a team how you'll run deco.")}`],
        ["Backup watch", `<p>If you use a simple watch as a backup, don't press its buttons underwater; many are only water resistant while the buttons stay untouched. Remember a watch gives you time but not depth, so a second timer or computer is the better backup.</p>`]],
      check: ["Why does the computer go on the right wrist?", "So the primary light in your left hand can light it up while your right hand drives the scooter."] },

    { id: "compass", label: "Compass", parent: "gear", title: "Compass",
      lead: "The most ignored piece of gear on the rig. It's there for low visibility and blue water, and it only helps if you practice with it.",
      sections: [
        ["What to look for", ul([
          "Rugged and liquid filled.",
          "A luminous dial with big cardinal points.",
          "A clear lubber line.",
          "A side window, so you can read it while holding it level in front of you.",
          "A needle that doesn't stick when the compass is tilted a bit."])],
        ["Where to wear it", `<p>On your <b>left</b> wrist, with the side window facing you.</p>`],
        ["Use it", `<p>Most divers strap one on and never look at it. Build it into your normal dives: take a heading on descent, swim a reciprocal home, run a simple square. When the vis drops or there's nothing to look at in the blue, it's what gets your team back to the line.</p>
          ${today("Electronic compasses have come a long way, but a good analog compass still needs no batteries and reads in any light. Keep one on the rig even if your computer has a compass built in.")}`]],
      check: ["Your heading out was 70°. What's your heading home?", "250°. Add or subtract 180°."] },

    { id: "lights", label: "Lights", parent: "gear", title: "Lights",
      lead: "Your primary light lets you see and lets you talk: a light signal is how a tech team communicates. Your backups are what get you home if it fails.",
      photo: ["wreck-green", "Diver with a canister light on a wreck in green water", "50% 50%"],
      sections: [
        ["Primary light", `${ul([
          "A compact canister on your waistband, with a light head on a Goodman (hand-mount) handle.",
          "A cord long enough to reach from your right hip to your left hand, without a lot left over.",
          "Enough burn time for the whole dive. Rechargeable."])}
          <p><b>Fitting:</b> run the right side of the waistband through the canister's belt loop, slide the canister to 3 to 4 inches from the backplate and lock it with a second stainless belt buckle. The light head rides in your <b>left</b> hand; the cord passes under the long hose. When it's not in use, clip the head to the right chest D-ring and tuck the extra cord under the waistband.</p>`],
        ["Backup lights", `${ul(["Simple, rugged, no switches: twist to turn on.", "Bright enough to get you out on its own.", "Long enough burn time to finish the exit."])}
          <p>Carry <b>two</b>. Tie a 1/2 in bolt snap on each with cave line and clip one to each chest D-ring, with the body held flat against the harness strap by a rubber band. Never in a pocket or inside a BC. Check them before every dive and change the batteries every season even if you didn't use them.</p>`],
        ["Burn time rule", `<p>Never start a dive with less than <b>twice</b> the burn time you'll need. If you need light for an hour, carry two hours of burn time. That applies to your backups too. Don't trust the box: burn test your lights yourself a couple of times a season, because rechargeable batteries lose time as they age.</p>`],
        ["", today("The original material compares halogen and HID bulbs. Today almost every primary and backup is LED: brighter, longer burning, smaller, and more forgiving. The fit, placement and burn time rules haven't changed.")]],
      check: ["You plan a 50 minute dive. How much primary burn time do you need?", "At least 100 minutes, twice the planned time."] },

    { id: "smb", label: "SMB", parent: "gear", title: "Surface marker buoy (SMB)",
      lead: "An SMB tells the boat where you are and gives you a line to hang on during your stops.",
      photo: ["lift-bags", "Diver sending up two orange marker buoys", "50% 35%"],
      sections: [
        ["Why carry one", ul([
          "Shows surface support exactly where your team is.",
          "Gives you a visual reference to hold depth on deco stops.",
          "A must in busy boat traffic.",
          "Can float a used stage bottle up for recovery.",
          "Extra flotation at the surface in an emergency."])],
        ["What to look for", ul(["Packs small.", "A bright color you can see in your local water.", "An overpressure dump valve.", "An open bottom with a design that won't tip over and spill its gas at the surface, or an inflator valve that <b>doesn't lock</b> onto your hose."])],
        ["Carry two", `<p>Carry a <b>large</b> SMB in the backplate pack or under bungee at the base of the plate, and a <b>small</b> one (about 3 ft) with its spool already attached in your right pocket.</p>
          ${note("If an inflator hose locks onto the SMB and you can't get it off, it can drag you to the surface. Make sure yours can't lock, and practice deploying from your stop depth until it's smooth.")}`]],
      check: ["Where's your small SMB?", "Right thigh pocket, already clipped to its spool."] },

    { id: "wetnotes", label: "Wet Notes", parent: "gear", title: "Wet notes",
      lead: "When hand and light signals aren't enough, write it down. Wet notes also hold your plan and your deco schedule.",
      sections: [
        ["What they're for", ul(["Clear, unambiguous messages to your team.", "Your dive plan, gas plan and deco tables.", "Survey work and sketches, which slates just can't do as well."])],
        ["What to look for", ul(["Spiral-bound waterproof pages you can erase.", "A cover with a place for pencils (and a small survey compass).", "An elastic closure.", "A spot to tie on a bolt snap."])],
        ["Where to keep them", `<p>Clipped with a bolt snap inside your <b>right</b> thigh pocket.</p>
          ${note("Write your plan in before every dive: max depth, run time, turn pressure, gases and stops. If your computer dies, you're still running the dive.")}`]],
      check: ["Name three things to write in your wet notes before a deco dive.", "Any three of: max depth, run time, turn pressure, gases and switch depths, stops and times, bailout plan."] },

    { id: "reels", label: "Reels", parent: "gear", title: "Primary reel",
      lead: "A guideline back to open water when you go into a wreck, a cave or into really low visibility.",
      photo: ["reel-drysuit", "Diver laying line from a reel", "50% 40%"],
      sections: [
        ["What it's for", ul(["In a cave: running a line from open water to the permanent main line.", "In a wreck: laying line for penetration, usually under 400 feet."])],
        ["What to look for", ul(["A simple design that's easy to work with gloves.", "No gap between handle and spool where line can jam.", "An open spool, not hidden behind a cover.", "No spring tension or locking gadgets.", "At least 400 feet of line."])],
        ["Where it goes", `<p>On the rear D-ring of your crotch strap. When you clip the double-ender to the reel, snap it down through the top of the reel's attachment point so it can't unclip itself.</p>
          ${note("A badly designed reel will tangle at the worst moment, or let line pay out behind you without you knowing. Simple wins.")}`]],
      check: ["Your penetration will be about 600 feet. What do you do?", "Plan with your team and instructor: the primary reel is meant for up to about 400 feet. Longer runs need a different plan and training (more line, or a permanent line)."] },

    { id: "spools", label: "Spools", parent: "gear", title: "Spools",
      lead: "Small, simple and tangle free. Spools send up your SMB, mark short jumps and gaps, and get you out when a line is lost.",
      sections: [
        ["What to look for", ul(["A simple spool. No handles, locks or reel-style mechanisms.", "At least 75 feet of line.", "A center hole big enough to work with dry gloves on."])],
        ["Carry at least two", ul([
          "<b>Safety spool:</b> 75 feet, with a double-ender, in your <b>left</b> pocket. Emergency use only: a lost line or lost buddy. You need to know it's there and untangled.",
          "<b>SMB spool:</b> about 100 feet, already on your small SMB, in your <b>right</b> pocket.",
          "<b>A third spool</b> (100 feet) for the large SMB or general use, if the dive calls for it."])],
        ["When is a spool too big?", `<p>Past 100 feet, spools get bulky. If the job needs more line than that, carry a primary reel. Bigger spools (like 150 feet) are best kept for overhead environments.</p>
          ${note("The middle of a silt-out isn't the time to find out your safety spool is in the wrong pocket. Put it in the same place every single dive.")}`]],
      check: ["Which pocket holds your safety spool, and when do you use it?", "The left pocket. Only in an emergency, like a lost line or lost buddy search."] }
  ];

  window.LDTechContent = { PAGES };
})();
