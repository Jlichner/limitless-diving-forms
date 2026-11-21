// Tests for reading latitudes and longitudes typed or pasted into Map setup. Run: node tools/survey/test-coords.js
const assert = require("assert");
const G = require("../../survey-geometry.js");
let n = 0;
const near = (a, b) => Math.abs(a - b) < 1e-5;
function t(name, fn) { fn(); n++; console.log("ok - " + name); }
t("decimal degrees", () => { assert.strictEqual(G.parseCoord("44.3421", "lat"), 44.3421); assert.strictEqual(G.parseCoord("-75.9165", "lon"), -75.9165); assert.strictEqual(G.parseCoord("−75.9165", "lon"), -75.9165); });
t("hemisphere letters", () => { assert.strictEqual(G.parseCoord("75.9165 W", "lon"), -75.9165); assert.strictEqual(G.parseCoord("W75.9165", "lon"), -75.9165); assert.strictEqual(G.parseCoord("44.3421n", "lat"), 44.3421); });
t("degrees and decimal minutes", () => { assert(near(G.parseCoord("44° 20.526' N", "lat"), 44 + 20.526 / 60)); assert(near(G.parseCoord("75 54.99 W", "lon"), -(75 + 54.99 / 60))); });
t("degrees, minutes and seconds", () => { assert(near(G.parseCoord(`44°20'31.6"N`, "lat"), 44 + 20 / 60 + 31.6 / 3600)); assert(near(G.parseCoord("75° 54′ 59.4″ W", "lon"), -(75 + 54 / 60 + 59.4 / 3600))); });
t("rejects nonsense", () => { for (const [x, a] of [["", "lat"], ["abc", "lat"], ["95", "lat"], ["44 75 W", "lat"], ["44 61 0 N", "lat"], ["75 W", "lat"], ["44.5 20 N", "lat"]]) assert(isNaN(G.parseCoord(x, a)), x); });
t("pairs pasted together", () => {
  assert.deepStrictEqual(G.parseLatLon("44.3421, -75.9165"), [44.3421, -75.9165]);
  assert.deepStrictEqual(G.parseLatLon("44.3421 -75.9165"), [44.3421, -75.9165]);
  const p = G.parseLatLon(`44°20'31.6"N 75°54'59.4"W`); assert(p && near(p[0], 44.342111) && near(p[1], -75.916500));
  const q = G.parseLatLon("44° 20.526' N, 75° 54.990' W"); assert(q && near(q[0], 44.3421) && near(q[1], -75.9165));
  assert.strictEqual(G.parseLatLon("44.3421"), null);
});
console.log(n + " tests passed");
