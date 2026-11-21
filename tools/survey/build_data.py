"""Build survey-data.js for the web map from the exported runs (export_data.py) plus the draw order
from the_survey.py and readable names for runs and landmarks.

Usage: python3 build_data.py survey-raw.json bonnie-castle-data.js
"""
import json
import re
import sys

# The order the_survey.py draws in. A run can only start from a landmark that's already on the map.
PLAN = [
    ('draw', 'BAR', 'BarToPlatform'),
    ('loop', 'SKELETON', 'SkeletonToMooringBlock2ViaPokerRun', 'SkeletonToMooringBlock2ViaMooringBlocks'),
    ('draw', 'ANCHOR', 'AnchorToSailboat'),
    ('draw', 'MOORING_BLOCK_2', 'MooringBlock2ToMooringBlock1'),
    ('loop', 'MOORING_BLOCK_1', 'MooringBlock1ToMooringBlock5ViaPokerRun', 'MooringBlock1ToMooringBlock5ViaMooringBlocks'),
    ('draw', 'UMBRELLA', 'UmbrellaToOxygenTanks'),
    ('fit', 'SAILBOAT', 'SailboatToUmbrella', 'SAILBOATTOUMBRELLASTAKE'),
    ('fit', 'SAILBOAT', 'SailboatToBasketballHoop', 'UMBRELLA'),
    ('fit', 'CONROY', 'ConroyToOxygenTanks', 'OXYGEN_TANKS'),
    ('draw', 'CAR', 'CarToLisasGift'),
    ('draw', 'UMBRELLA', 'UmbrellaToRockIsland'),
    ('draw', 'ROCK_ISLAND_BOTTLE', 'RockIslandBottleCounterClockwise'),
    ('draw', 'ROCK_ISLAND_BOTTLE', 'RockIslandBottleClockwise'),
    ('draw', 'ROCK_ISLAND_T2', 'RockIslandT2ToCatherine'),
    ('draw', 'CATHERINE_COOKIE', 'CatherineCookieToUnknown'),
    ('draw', 'ANGLE_IRON', 'AngleIronToMary'),
    ('draw', 'MARY', 'MaryToFourWay'),
    ('draw', 'FOUR_WAY', 'FourWayToNatesTieoff'),
    ('loop', 'FOUR_WAY', 'FourWayToBypassEndSixtyFoot', 'JJJ'),
    ('draw', 'BYPASS_END_JJJ', 'BypassEndToBobsArrow'),
    ('draw', 'BOBS_ARROW', 'BobsArrowToIslanderPlatform'),
    ('draw', 'BOBS_ARROW', 'BobsArrowToEmmaMunsen'),
    ('draw', 'CAFE', 'CafeToSpookyTreeToIslander'),
    ('fit', 'NATES_TIEOFF', 'NatesTieoffToRockIsland', 'ROCK_ISLAND_T'),
    ('draw', 'ROCK_ISLAND_T', 'RockIslandTClockwise'),
    ('draw', 'LISAS_GIFT', 'LisasGiftToKibbetts'),
    ('draw', 'LISAS_GIFT', 'LisasGiftToBensT'),
    ('draw', 'BENS_T', 'BensTToJoshsWreck'),
    ('draw', 'BENS_T', 'BensTNorthwest'),
    ('fit', 'KIBBETTS', 'KibbettsToWreck2', 'WRECK_2'),
]

# Names from the map's legend where it has one.
LANDMARK_NAMES = {
    'BAR': 'Bar', 'CAR': 'Car', 'CONROY': 'Conroy', 'FOUR_WAY': 'Four-way', 'KIBBETTS': "Kibbett's",
    'LISAS_GIFT': "Lisa's Gift", 'MOORING_BLOCK_20FT': "Mooring block (20')", 'OXYGEN_TANKS': 'Oxygen bottles',
    'ROCK_ISLAND_T': 'Rock Island T', 'ROCK_ISLAND_T2': 'Rock Island T2', 'ROCK_ISLAND_BOTTLE': 'Rock Island bottle',
    'NATES_TIEOFF': "Nate's fugly tieoff", 'BYPASS_END_SIXTY_FOOT': "Bypass end (60')", 'BYPASS_END_JJJ': 'Bypass end (JJJ)',
    'BOBS_ARROW': "Bob's arrow", 'EMMA_MUNSEN': 'Emma Munsen tugboat', 'TRACTOR_TIRE': 'Big tire', 'CAFE': 'Underwater Cafe',
    'ISLANDER_T': 'Islander T', 'ISLANDER_PLATFORM': 'Islander platform', 'SPOOKY_TREE': 'Spooky tree', 'BENS_T': "Ben's T",
    'JOSHS_WRECK': "Josh's wreck", 'TAHITI_TIGER': 'Tahiti Tiger', 'SAILBOATTOUMBRELLASTAKE': 'Sailboat-to-Umbrella stake',
    'BASKETBALL_HOOP': 'Basketball hoop', 'CATHERINE_COOKIE': 'Catherine cookie', 'WAGON_WHEELS': 'Wagon wheels',
    'WRECK_1': 'Wreck 1', 'WRECK_2': 'Wreck 2', 'WRECK_3': 'Wreck 3', 'BOAT_RAMP_1': 'Boat ramp (north end)',
    'BOAT_RAMP_2': 'Boat ramp (south end)', 'ANGLE_IRON': 'Angle iron', 'STEAM_ENGINE': 'Steam engine', 'JUG': 'Jug',
    'MY_BOAT': 'My boat (example)',
}


def landmark_name(key):
    if key in LANDMARK_NAMES:
        return LANDMARK_NAMES[key]
    m = re.match(r'MOORING_BLOCK_(\d)$', key)
    if m:
        return f'Mooring block {m.group(1)}'
    return key.replace('_', ' ').capitalize()


def run_name(camel):
    words = re.sub(r'(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[a-zA-Z])(?=\d)', ' ', camel).split()
    out = ' '.join(words).replace('Bens T', "Ben's T").replace('Lisas Gift', "Lisa's Gift").replace('Nates', "Nate's") \
        .replace('Joshs', "Josh's").replace('Bobs', "Bob's").replace('JJJ', 'JJJ')
    return out.replace(' To ', ' to ').replace(' Via ', ' via ')


def main(raw_path, out_path):
    raw = json.load(open(raw_path))
    runs = raw['runs']
    plan = []
    for step in PLAN:
        mode, start, run = step[:3]
        s = {'mode': mode, 'start': start, 'run': run}
        if mode == 'loop':
            s['run2'] = step[3]
        if mode == 'fit':
            s['end'] = step[3]
        plan.append(s)
    used = {s['run'] for s in plan} | {s['run2'] for s in plan if 'run2' in s}
    unused = [r for r in runs if r not in used]
    data = {
        'id': 'bonnie-castle',
        'title': 'Bonnie Castle Scuba Park',
        'place': 'Alexandria Bay, New York (St. Lawrence River)',
        'subtitle': 'A project of Bonnie Castle Resort, All About Scuba, Blue Foot Diving, and Northeast Underwater Explorers',
        'credit': '© 2021 Northeast Underwater Explorers',
        'version': 'v1.1 September 2021',
        'surveyors': ['Ben Rother', 'Brian Chu', 'Christian Lundkvist', 'Doug Dwyer', 'Jamie Lichner', 'JP Vanier',
                      'Lisa Goodlin', 'Mike Burr', 'Scott Fuller', 'Stephanie Yang'],
        'landmarks': {k: landmark_name(k) for k in raw['landmarks']},
        'aliases': raw['aliases'],
        'runNames': {r: run_name(r) for r in runs},
        'plan': plan,
        'runs': runs,
        'unusedRuns': unused,
    }
    with open(out_path, 'w') as f:
        f.write('/* Limitless Diving — Bonnie Castle Scuba Park survey data, for the Site maps pages.\n'
                '   Exported from data.py and the_survey.py in the underwatersurvey project by tools/survey/build_data.py.\n'
                '   plan is the draw order; runs not in the plan (unusedRuns) are kept for the record but not drawn. */\n')
        f.write('(function (root) {\n  const data = ')
        json.dump(data, f, indent=1)
        f.write(';\n  root.SITE_MAPS = root.SITE_MAPS || {};\n  root.SITE_MAPS["bonnie-castle"] = data;\n'
                '  if (typeof module === "object" && module.exports) module.exports = data;\n'
                '})(typeof window !== "undefined" ? window : globalThis);\n')
    print(f'plan: {len(plan)} steps; unused runs: {unused}')


if __name__ == '__main__':
    main(*sys.argv[1:])
