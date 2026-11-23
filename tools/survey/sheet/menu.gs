/* Limitless Diving menu for a site map's Google Sheet: Get from website, Check the rows, Publish to website.
   The sheet is where big changes are made; the website's editor is for one or two quick fixes.
   How the rows are laid out: see survey-sheet.js (copied in above this part, with the website's survey-geometry.js,
   survey-edits.js and survey-ratings.js), or the sheet's "How to fill it in" tab.
   The website side is sheet_get_site_map / sheet_publish_site_map in supabase/schema.sql, opened with a private
   sheet key (Limitless Diving → Set up). */
const LD = {
  url: "https://tohabfygfsvcntarmfck.supabase.co",
  key: "sb_publishable_hLYAAHHOgtSbTIjOjr9GaQ_DxkefCDZ",   // the website's public key; the sheet key is the private one
  site: "https://limitless-diving.com/",
};
const SURVEY_TAB = "Survey", LANDMARKS_TAB = "Landmarks";

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Limitless Diving")
    .addItem("Get from website", "getFromWebsite")
    .addItem("Check the rows", "checkRows")
    .addItem("Publish to website", "publishToWebsite")
    .addSeparator()
    .addItem("Set up", "setUp")
    .addToUi();
}

function props_() { return PropertiesService.getDocumentProperties(); }
function settings_() {
  const p = props_(), site = p.getProperty("site"), key = p.getProperty("sheetKey");
  if (!site || !key) throw new Error("This sheet isn't linked to a site map yet. Use Limitless Diving → Set up first.");
  return { site, key };
}

function rpc_(name, args) {
  const res = UrlFetchApp.fetch(LD.url + "/rest/v1/rpc/" + name, {
    method: "post", contentType: "application/json", headers: { apikey: LD.key },
    payload: JSON.stringify(args), muteHttpExceptions: true,
  });
  const text = res.getContentText();
  let body; try { body = JSON.parse(text); } catch (e) { body = text; }
  if (res.getResponseCode() >= 300) throw new Error((body && body.message) || text || ("The website answered " + res.getResponseCode()));
  return body;
}

function setUp() {
  const ui = SpreadsheetApp.getUi(), p = props_();
  const a = ui.prompt("Link this sheet to a site map (1 of 2)",
    "Which site map? Type its short name, as in its web address: bonnie-castle for bonnie-castle-map.html, middle-earth, lake-hydra..." +
    (p.getProperty("site") ? "\n\nNow: " + p.getProperty("site") : ""), ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const site = a.getResponseText().trim().toLowerCase().replace(/-map\.html$/, "");
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(site)) { ui.alert("Use only small letters, numbers and dashes, like bonnie-castle."); return; }
  const b = ui.prompt("Link this sheet to a site map (2 of 2)",
    "Paste the sheet key (it starts with ldsheet_). Make one in Supabase → SQL editor with:\n\nselect public.make_site_map_sheet_key('Survey sheet');" +
    (p.getProperty("sheetKey") ? "\n\nLeave it empty to keep the key you set before." : ""), ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  const key = b.getResponseText().trim() || p.getProperty("sheetKey") || "";
  try {
    const cur = rpc_("sheet_get_site_map", { sheet_key: key, site });
    p.setProperties({ site, sheetKey: key });
    p.deleteProperty("version");
    ui.alert(cur.data
      ? `Linked to ${site} (version ${cur.version} on the website). Use Get from website to fill the Survey tab from the map.`
      : `Linked to ${site}. There's no map for it on the website yet: fill in the Survey tab and use Publish to website.`);
  } catch (e) { ui.alert("That didn't work: " + e.message); }
}

function surveyTab_(make) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SURVEY_TAB);
  if (!sh && make) sh = ss.insertSheet(SURVEY_TAB, 0);
  return sh;
}
function readRows_() {
  const sh = surveyTab_(false);
  if (!sh) throw new Error(`There's no "${SURVEY_TAB}" tab. Rename your survey tab to ${SURVEY_TAB}, or use Get from website.`);
  const n = sh.getLastRow();
  const rows = n ? sh.getRange(1, 1, n, 11).getValues() : [];
  const lm = SpreadsheetApp.getActive().getSheetByName(LANDMARKS_TAB);
  const lmRows = lm && lm.getLastRow() ? lm.getRange(1, 1, lm.getLastRow(), 2).getValues() : [];
  return { rows, lmRows };
}

function checkRows() {
  const ui = SpreadsheetApp.getUi();
  try {
    const { rows, lmRows } = readRows_(), r = SurveySheet.toSurvey(rows, lmRows, {});
    const sp = r.errors.length ? { errors: [], warnings: [], src: null } : SurveySheet.splitLevels(r.data, r.levels, r.stated);
    r.errors = r.errors.concat(sp.errors); r.warnings = r.warnings.concat(sp.warnings);
    const levelOfRun = id => sp.src ? ["double-black", "black", "blue"].find(k => sp.src[k].runs[id]) : null;
    const lines = r.data.plan.flatMap(p => [p.run, p.run2]).filter(Boolean).map(id => {
      const ft = r.data.runs[id].reduce((t, e) => t + (e.type === "SurveyedLine" ? (Number(e.length_ft) || 0) + (Number(e.length_in) || 0) / 12 : 0), 0);
      const lv = levelOfRun(id);
      return `${r.data.runNames[id]}: ${Math.round(ft * 10) / 10} ft${lv ? " (" + SurveySheet.LEVEL_NAMES[lv].toLowerCase() + (sp.src.green.runs[id] ? " part way" : "") + ")" : ""}`;
    });
    ui.alert(r.errors.length ? "Fix these before publishing" : "The rows look right",
      list_(r.errors, "Problems") + list_(r.warnings, "Worth a look") + (lines.length ? "Surveyed line:\n" + lines.join("\n") : "No lines yet."), ui.ButtonSet.OK);
  } catch (e) { ui.alert(e.message); }
}
function list_(items, title) {
  if (!items.length) return "";
  return title + ":\n" + items.slice(0, 15).join("\n") + (items.length > 15 ? `\n...and ${items.length - 15} more` : "") + "\n\n";
}

function getFromWebsite() {
  const ui = SpreadsheetApp.getUi();
  try {
    const s = settings_(), cur = rpc_("sheet_get_site_map", { sheet_key: s.key, site: s.site });
    if (!cur.data) { ui.alert(`There's no map for ${s.site} on the website yet. Fill in the Survey tab and use Publish to website.`); return; }
    const sh = surveyTab_(true);
    if (sh.getLastRow() > 1 && ui.alert("Get from website",
      `This replaces columns A to K of the ${SURVEY_TAB} tab with the website's map (version ${cur.version}${cur.updated_by ? ", published by " + cur.updated_by : ""}). ` +
      "Anything there you haven't published will be lost. Your columns from L on stay as they are. Go ahead?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const joined = SurveySheet.joinLevels(cur.data, cur.layers);
    const out = SurveySheet.fromSurvey(joined.data, joined.runLevel);
    const old = sh.getLastRow();
    if (old) sh.getRange(1, 1, old, 11).clearContent().setBackground(null).setFontWeight(null).setFontColor(null);
    sh.getRange(1, 1, out.rows.length, 11).setValues(out.rows);
    sh.getRange(1, 1, 1, 11).setBackground("#0B4F6C").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
    out.rows.forEach((r, i) => {
      if (i === 0) return;
      const title = r[0] && r.slice(2, 8).every(v => v === "") && (!r[1] || /^loop with /i.test(r[1]));
      if (title) sh.getRange(i + 1, 1, 1, 11).setBackground("#DCEEF5").setFontWeight("bold").setFontColor("#0B4F6C");
      else if (typeof r[5] === "number" && r[7] !== "Arrow") sh.getRange(i + 1, 7).setFormula(`=F${i + 1}*0.3048`).setNumberFormat("0.00");
    });
    sh.setFrozenRows(1);
    const kinds = SpreadsheetApp.newDataValidation().requireValueInList(["Surveyed", "Unsurveyed", "Jump"], true).setAllowInvalid(true).build();
    sh.getRange(2, 8, Math.max(out.rows.length + 500, 1000), 1).setDataValidation(kinds);
    const lvl = SpreadsheetApp.newDataValidation().requireValueInList(["Green circle", "Blue square", "Black diamond", "Double black diamond"], true).setAllowInvalid(true).build();
    sh.getRange(2, 11, Math.max(out.rows.length + 500, 1000), 1).setDataValidation(lvl);
    let lm = SpreadsheetApp.getActive().getSheetByName(LANDMARKS_TAB) || SpreadsheetApp.getActive().insertSheet(LANDMARKS_TAB);
    lm.getRange(1, 1, Math.max(lm.getLastRow(), 1), 2).clearContent();
    lm.getRange(1, 1, out.landmarkRows.length, 2).setValues(out.landmarkRows);
    lm.getRange(1, 1, 1, 2).setBackground("#0B4F6C").setFontColor("#FFFFFF").setFontWeight("bold");
    props_().setProperty("version", String(cur.version));
    ui.alert(`Got version ${cur.version} of ${s.site}: ${out.rows.length - 1} rows.`);
  } catch (e) { ui.alert(e.message); }
}

function publishToWebsite() {
  const ui = SpreadsheetApp.getUi();
  try {
    const s = settings_(), { rows, lmRows } = readRows_();
    const r = SurveySheet.toSurvey(rows, lmRows, { id: s.site });
    if (r.errors.length) { ui.alert("Not published: fix these first", list_(r.errors, "Problems"), ui.ButtonSet.OK); return; }
    if (r.warnings.length && ui.alert("Worth a look before publishing", list_(r.warnings, "Warnings") + "Publish anyway?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const cur = rpc_("sheet_get_site_map", { sheet_key: s.key, site: s.site });
    const mine = props_().getProperty("version");
    const before = SurveySheet.joinLevels(cur.data || {}, cur.layers).data;
    if (cur.version && String(cur.version) !== mine && ui.alert("The map changed on the website",
      `The website has version ${cur.version}${cur.updated_by ? " (published by " + cur.updated_by + ")" : ""}` +
      (mine ? `, and this sheet was last in step with version ${mine}.` : ", and this sheet hasn't got it yet.") +
      " Publishing replaces the website's lines with this sheet's, so changes made on the website since then would be lost." +
      " To keep them, choose No, make a copy of this tab, use Get from website, and copy your new rows in.\n\nPublish anyway?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const m = SurveySheet.mergeInto(cur.data, r.data);
    if (m.errors.length) { ui.alert("Not published", m.errors.join("\n"), ui.ButtonSet.OK); return; }
    const sp = SurveySheet.splitLevels(m.data, r.levels, r.stated);
    if (sp.errors.length) { ui.alert("Not published: fix these first", list_(sp.errors, "Levels"), ui.ButtonSet.OK); return; }
    if (sp.warnings.length && ui.alert("Levels", list_(sp.warnings, "Worth a look") + "Publish anyway?", ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    const said = ui.prompt("Publish to website", "What changed? (shown in the map's history)\n\n" + (m.notes.length ? m.notes.join("\n") + "\n\n" : ""), ui.ButtonSet.OK_CANCEL);
    if (said.getSelectedButton() !== ui.Button.OK) return;
    const summary = (said.getResponseText().trim() ? said.getResponseText().trim() + " — " : "") + "from the Google Sheet: " + SurveySheet.describeChange(before, m.data);
    const v = rpc_("sheet_publish_site_map", { sheet_key: s.key, site: s.site, new_data: sp.src.green, expected_version: cur.version || 0, summary,
      layers: { blue: sp.src.blue, black: sp.src.black, "double-black": sp.src["double-black"] } });
    props_().setProperty("version", String(v));
    ui.alert(`Published version ${v}. See it at ${LD.site}${s.site}-map.html`);
  } catch (e) { ui.alert("Not published: " + e.message); }
}
