// Tests for survey-merge.js (Survey book: publishing only your changes). Run: node tools/survey/test-merge.js
const assert = require("assert");
const SS = require("../../survey-sheet.js"), SM = require("../../survey-merge.js");
const data = require("./local-data.js")("bonnie-castle");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const book = () => { const o = SS.fromSurvey(data); return { rows: o.rows.map(r => r.slice(0, 11).map(v => v == null ? "" : v)), lm: o.landmarkRows }; };
const copy = x => JSON.parse(JSON.stringify(x));
const lines = b => SM.split(b.rows).lines;
const named = (b, i) => lines(b)[i];
const rowOf = (b, line) => b.rows.indexOf(line.rows[0]);
const survey = b => SS.toSurvey(b.rows.slice(1), b.lm, { id: "bonnie-castle" });

t("nothing changed: same book back", () => {
  const b = book(), r = SM.merge(b, copy(b), copy(b));
  assert.strictEqual(SM.sig(r.rows), SM.sig(b.rows));
  assert.deepStrictEqual(r.changed, []);
});

t("both added lines: both kept, everything else theirs", () => {
  const base = book(), mine = copy(base), theirs = copy(base);
  const add = (b, name, from) => b.rows.push(["", "", "", "", "", "", "", "", "", "", ""], [name, "", "", "", "", "", "", "", "", "", ""], [from, "Stake", "", "", "45", "20", "", "Surveyed", "", "", ""]);
  add(mine, "Mine new", "Bar"); add(theirs, "Theirs new", "Bar");
  const r = SM.merge(base, mine, theirs);
  const names = lines(r).map(l => l.name);
  assert.ok(names.includes("Mine new") && names.includes("Theirs new"));
  assert.deepStrictEqual(r.changed, ["Mine new"]); assert.deepStrictEqual(r.conflicts, []);
  assert.deepStrictEqual(survey(r).errors, []);
  assert.strictEqual(lines(r).length, lines(base).length + 2);
});

t("I edit one line, they edit another: both edits kept", () => {
  const base = book(), mine = copy(base), theirs = copy(base);
  const a = named(mine, 3), b2 = named(theirs, 5);
  a.rows[1][8] = "my note"; b2.rows[1][8] = "their note";
  const r = SM.merge(base, mine, theirs), L = lines(r);
  assert.strictEqual(L[3].rows[1][8], "my note"); assert.strictEqual(L[5].rows[1][8], "their note");
  assert.deepStrictEqual(r.conflicts, []);
});

t("I delete a line they didn't touch: it goes; their new line stays", () => {
  const base = book(), mine = copy(base), theirs = copy(base);
  const last = lines(mine).length - 1, gone = named(mine, last);
  mine.rows.splice(rowOf(mine, gone) - 1, gone.rows.length + 1);
  theirs.rows.push(["", "", "", "", "", "", "", "", "", "", ""], ["Their spur", "", "", "", "", "", "", "", "", "", ""], ["Bar", "Stake", "", "", "10", "5", "", "Surveyed", "", "", ""]);
  const r = SM.merge(base, mine, theirs), names = lines(r).map(l => l.name);
  assert.ok(!names.includes(gone.name)); assert.ok(names.includes("Their spur"));
});

t("both changed the same line differently: mine kept and listed", () => {
  const base = book(), mine = copy(base), theirs = copy(base);
  named(mine, 2).rows[1][8] = "mine"; named(theirs, 2).rows[1][8] = "theirs";
  const r = SM.merge(base, mine, theirs);
  assert.strictEqual(lines(r)[2].rows[1][8], "mine");
  assert.deepStrictEqual(r.conflicts, [named(base, 2).name]);
});

t("the same line typed differently isn't a change", () => {
  const base = book(), mine = copy(base);
  const row = named(mine, 1).rows.find(x => String(x[5]) !== "" && Number(x[5]) === Math.round(Number(x[5])));
  if (row) { row[5] = Number(row[5]).toFixed(1); }
  named(mine, 1).rows.forEach(x => { if (String(x[7]).toLowerCase() === "surveyed") x[7] = ""; });
  const r = SM.merge(base, mine, copy(base));
  assert.deepStrictEqual(r.changed, []);
});

console.log(`${n} tests passed`);
