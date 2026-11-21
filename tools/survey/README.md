# Survey map tools

Scripts that bring a survey from the underwatersurvey project (Python + matplotlib) to the Site maps pages.

| Script | What it does |
|---|---|
| `export_data.py data.py raw.json` | Reads `data.py` as text (never runs it) and writes every run of line as JSON, keeping each entry's end-of-line comment as a note. |
| `build_data.py raw.json local/bonnie-castle-data.js` | Adds the draw order from `the_survey.py` (`PLAN`), readable names for runs and landmarks, and the credits, and writes the full survey data file. It goes in `tools/survey/local/` (ignored by git), never in the website: see *Keeping the survey private* below. |
| `build_icons.py <icons dir> <tabler outline dir> survey-icons.js` | Puts the project's hand-made icons in as PNG data, and swaps the paid Glyphicons Pro icons for free Tabler icons (`npm i @tabler/icons`). |
| `python_reference.py out.json` | Run inside the underwatersurvey folder: runs `the_survey.py` and records every line, marker and landmark it draws. |
| `compare.js local/bonnie-castle-data.js survey-geometry.js out.json` | Checks the web map's geometry against that recording. |

When this was set up (November 2026) the web map matched the original program exactly: 298 lines, 225 stakes, tie-offs and arrows, and 47 landmark positions.

## Adding a site that hasn't been surveyed yet

Copy `lake-hydra-data.js` and `lake-hydra-map.html`, change the id, title and data file, and load the new data file in `site-maps.html`. The data's `origin` names the starting point every line is measured from (drawn at 0, 0); divers then add lines from it in the map's editor, and an Admin publishes them.

## Layers, ratings, photos and GPS (survey-layers.js, survey-ratings.js)

- `test-ratings.js`: tests for rating lines (green circle stays on the main survey; blue, black and double black each move to a restricted layer). Run `node tools/survey/test-ratings.js`.
- A map is placed on the earth by `data.georef` (see `SurveyGeometry.georef`): one landmark's latitude/longitude plus the magnetic declination, or two landmarks. It is published like any other change, so it's in the map's history.
- Blue, black and double black lines live only in `site_map_layers`, readable by members whose Site maps access level is that rating or higher.

## Keeping the survey private

Site maps are for logged-in members with a **Site maps access level**, which an Admin sets in Records → Student accounts:
green circle (open water), blue square (advanced), black diamond (tech), double black diamond (tech on scooters),
survey team (can suggest changes; an admin approves them) and Dive site admin. The database enforces it (`site_map_rank()`
in `supabase/schema.sql`).

So the survey data is not in the website's files: `bonnie-castle-data.js` has only the title and credits. The full survey goes
into the database once, from the private seed file `site-maps-seed-bonnie-castle.sql` (kept in the project files, run in the
Supabase SQL editor after `schema.sql`). The tests (`test-edits.js`, `test-ratings.js`) read the full data from
`tools/survey/local/bonnie-castle-data.js`; copy it there from the project files or make it with `build_data.py`.
