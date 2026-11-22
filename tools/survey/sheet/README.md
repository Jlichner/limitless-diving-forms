# Site map survey data in a Google Sheet

The sheet is the main place to enter survey data. The website's map editor is for one or two quick fixes.
Each site map gets its own Google Sheet. The **Limitless Diving** menu in the sheet does three things:

- **Get from website** fills the Survey tab (columns A to J) and the Landmarks tab from the published map.
- **Check the rows** lists any problems and each line's length.
- **Publish to website** checks the rows, then publishes them as a new version of the map, with a note in the map's history.
  It warns you first if the map was changed on the website since this sheet last got it.
  Things the sheet doesn't hold stay as they are on the website: title, credits, GPS placement and lines set aside as not drawn.

The layout of the Survey tab is described at the top of `survey-sheet.js`, and in the sample sheet's "How to fill it in" tab.

## Setting up a sheet (once per sheet)

1. Run the "Google Sheet link" part of `supabase/schema.sql` in Supabase → SQL editor (once, for all sheets).
2. In the SQL editor, make a key: `select public.make_site_map_sheet_key('Survey sheet');`. Copy the answer (it starts with `ldsheet_`).
   Keep it private: anyone with it can publish site maps. To stop a key working:
   `delete from public.site_map_sheet_keys where label = 'Survey sheet';`
3. In the sheet: Extensions → Apps Script. Replace what's there with all of `LimitlessDiving.gs`, save, and reload the sheet.
4. Limitless Diving → Set up: type the map's short name (`bonnie-castle`, `middle-earth`...) and paste the key.
   Google asks once for permission for the script to reach the website.

## For developers

`LimitlessDiving.gs` is built from `survey-geometry.js` and `survey-sheet.js` (the same code the website uses) and `menu.gs`:
run `node tools/survey/sheet/build.js` after changing either. `node tools/survey/test-sheet.js` checks the converter.
