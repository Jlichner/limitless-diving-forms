/* Limitless Diving — Bonnie Castle Scuba Park survey data, for the Site maps pages.
   Exported from data.py and the_survey.py in the underwatersurvey project by tools/survey/build_data.py.
   plan is the draw order; runs not in the plan (unusedRuns) are kept for the record but not drawn. */
(function (root) {
  const data = {
 "id": "bonnie-castle",
 "title": "Bonnie Castle Scuba Park",
 "place": "Alexandria Bay, New York (St. Lawrence River)",
 "subtitle": "A project of Bonnie Castle Resort, All About Scuba, Blue Foot Diving, and Northeast Underwater Explorers",
 "credit": "\u00a9 2021 Northeast Underwater Explorers",
 "version": "v1.1 September 2021",
 "surveyors": [
  "Ben Rother",
  "Brian Chu",
  "Christian Lundkvist",
  "Doug Dwyer",
  "Jamie Lichner",
  "JP Vanier",
  "Lisa Goodlin",
  "Mike Burr",
  "Scott Fuller",
  "Stephanie Yang"
 ],
 "landmarks": {
  "BAR": "Bar",
  "CAR": "Car",
  "CONROY": "Conroy",
  "FOUR_WAY": "Four-way",
  "ISLANDER_T": "Islander T",
  "KIBBETTS": "Kibbett's",
  "LISAS_GIFT": "Lisa's Gift",
  "MOORING_BLOCK_20FT": "Mooring block (20')",
  "MY_BOAT": "My boat (example)",
  "OXYGEN_TANKS": "Oxygen bottles",
  "ROCK_ISLAND_T": "Rock Island T",
  "ROWBOAT": "Rowboat",
  "SKELETON": "Skeleton",
  "UMBRELLA": "Umbrella",
  "WAGON_WHEELS": "Wagon wheels",
  "NATES_TIEOFF": "Nate's fugly tieoff",
  "BYPASS_END_SIXTY_FOOT": "Bypass end (60')",
  "BYPASS_END_JJJ": "Bypass end (JJJ)",
  "ROCK_ISLAND_BOTTLE": "Rock Island bottle",
  "BOBS_ARROW": "Bob's arrow",
  "EMMA_MUNSEN": "Emma Munsen tugboat",
  "ANCHOR": "Anchor",
  "MOORING_BLOCK_1": "Mooring block 1",
  "MOORING_BLOCK_2": "Mooring block 2",
  "MOORING_BLOCK_3": "Mooring block 3",
  "MOORING_BLOCK_4": "Mooring block 4",
  "MOORING_BLOCK_5": "Mooring block 5",
  "ANGLE_IRON": "Angle iron",
  "WRECK_1": "Wreck 1",
  "STEAM_ENGINE": "Steam engine",
  "BOAT_RAMP_1": "Boat ramp (north end)",
  "BOAT_RAMP_2": "Boat ramp (south end)",
  "WRECK_2": "Wreck 2",
  "WRECK_3": "Wreck 3",
  "TRACTOR_TIRE": "Big tire",
  "MARY": "Mary",
  "CRIBBING": "Cribbing",
  "CAFE": "Underwater Cafe",
  "ISLANDER_PLATFORM": "Islander platform",
  "SPOOKY_TREE": "Spooky tree",
  "JUG": "Jug",
  "ISLANDER": "Islander",
  "HOOP": "Hoop",
  "BENS_T": "Ben's T",
  "JOSHS_WRECK": "Josh's wreck",
  "TAHITI_TIGER": "Tahiti Tiger",
  "SAILBOAT": "Sailboat",
  "ROCK_ISLAND_T2": "Rock Island T2",
  "CATHERINE_COOKIE": "Catherine cookie",
  "CATHERINE": "Catherine",
  "SAILBOATTOUMBRELLASTAKE": "Sailboat-to-Umbrella stake",
  "BASKETBALL_HOOP": "Basketball hoop"
 },
 "aliases": {},
 "runNames": {
  "BarToPlatform": "Bar to Platform",
  "SkeletonToMooringBlock2ViaPokerRun": "Skeleton to Mooring Block 2 via Poker Run",
  "SkeletonToMooringBlock2ViaMooringBlocks": "Skeleton to Mooring Block 2 via Mooring Blocks",
  "MooringBlock2ToMooringBlock1": "Mooring Block 2 to Mooring Block 1",
  "MooringBlock1ToMooringBlock5ViaPokerRun": "Mooring Block 1 to Mooring Block 5 via Poker Run",
  "MooringBlock1ToMooringBlock5ViaMooringBlocks": "Mooring Block 1 to Mooring Block 5 via Mooring Blocks",
  "AnchorToSailboat": "Anchor to Sailboat",
  "AnchorToSailboatTruncated": "Anchor to Sailboat Truncated",
  "SailboatToUmbrella": "Sailboat to Umbrella",
  "SailboatToBasketballHoop": "Sailboat to Basketball Hoop",
  "ConroyToOxygenTanks": "Conroy to Oxygen Tanks",
  "ConroyToOxygenTanksTruncated": "Conroy to Oxygen Tanks Truncated",
  "CarToLisasGift": "Car to Lisa's Gift",
  "CarToLisasGiftTruncated": "Car to Lisa's Gift Truncated",
  "LisasGiftToKibbetts": "Lisa's Gift to Kibbetts",
  "KibbettsToWreck2": "Kibbetts to Wreck 2",
  "LisasGiftToBensT": "Lisa's Gift to Ben's T",
  "BensTNorthwest": "Ben's T Northwest",
  "BensTToJoshsWreck": "Ben's T to Josh's Wreck",
  "UmbrellaToRockIsland": "Umbrella to Rock Island",
  "UmbrellaToOxygenTanks": "Umbrella to Oxygen Tanks",
  "UmbrellaToOxygenTanksTruncated": "Umbrella to Oxygen Tanks Truncated",
  "RockIslandBottleClockwise": "Rock Island Bottle Clockwise",
  "RockIslandTClockwise": "Rock Island T Clockwise",
  "RockIslandBottleCounterClockwise": "Rock Island Bottle Counter Clockwise",
  "RockIslandT2ToCatherine": "Rock Island T 2 to Catherine",
  "CatherineCookieToUnknown": "Catherine Cookie to Unknown",
  "AngleIronToMary": "Angle Iron to Mary",
  "AngleIronToMaryTruncated": "Angle Iron to Mary Truncated",
  "MaryToFourWay": "Mary to Four Way",
  "JJJ": "JJJ",
  "FourWayToNatesTieoff": "Four Way to Nate's Tieoff",
  "NatesTieoffToRockIsland": "Nate's Tieoff to Rock Island",
  "FourWayToBypassEndSixtyFoot": "Four Way to Bypass End Sixty Foot",
  "BypassEndToBobsArrow": "Bypass End to Bob's Arrow",
  "BobsArrowToEmmaMunsen": "Bob's Arrow to Emma Munsen",
  "BobsArrowToIslanderPlatform": "Bob's Arrow to Islander Platform",
  "CafeToSpookyTreeToIslander": "Cafe to Spooky Tree to Islander",
  "ExampleData": "Example Data"
 },
 "plan": [
  {
   "mode": "draw",
   "start": "BAR",
   "run": "BarToPlatform"
  },
  {
   "mode": "loop",
   "start": "SKELETON",
   "run": "SkeletonToMooringBlock2ViaPokerRun",
   "run2": "SkeletonToMooringBlock2ViaMooringBlocks"
  },
  {
   "mode": "draw",
   "start": "ANCHOR",
   "run": "AnchorToSailboat"
  },
  {
   "mode": "draw",
   "start": "MOORING_BLOCK_2",
   "run": "MooringBlock2ToMooringBlock1"
  },
  {
   "mode": "loop",
   "start": "MOORING_BLOCK_1",
   "run": "MooringBlock1ToMooringBlock5ViaPokerRun",
   "run2": "MooringBlock1ToMooringBlock5ViaMooringBlocks"
  },
  {
   "mode": "draw",
   "start": "UMBRELLA",
   "run": "UmbrellaToOxygenTanks"
  },
  {
   "mode": "fit",
   "start": "SAILBOAT",
   "run": "SailboatToUmbrella",
   "end": "SAILBOATTOUMBRELLASTAKE"
  },
  {
   "mode": "fit",
   "start": "SAILBOAT",
   "run": "SailboatToBasketballHoop",
   "end": "UMBRELLA"
  },
  {
   "mode": "fit",
   "start": "CONROY",
   "run": "ConroyToOxygenTanks",
   "end": "OXYGEN_TANKS"
  },
  {
   "mode": "draw",
   "start": "CAR",
   "run": "CarToLisasGift"
  },
  {
   "mode": "draw",
   "start": "UMBRELLA",
   "run": "UmbrellaToRockIsland"
  },
  {
   "mode": "draw",
   "start": "ROCK_ISLAND_BOTTLE",
   "run": "RockIslandBottleCounterClockwise"
  },
  {
   "mode": "draw",
   "start": "ROCK_ISLAND_BOTTLE",
   "run": "RockIslandBottleClockwise"
  },
  {
   "mode": "draw",
   "start": "ROCK_ISLAND_T2",
   "run": "RockIslandT2ToCatherine"
  },
  {
   "mode": "draw",
   "start": "CATHERINE_COOKIE",
   "run": "CatherineCookieToUnknown"
  },
  {
   "mode": "draw",
   "start": "ANGLE_IRON",
   "run": "AngleIronToMary"
  },
  {
   "mode": "draw",
   "start": "MARY",
   "run": "MaryToFourWay"
  },
  {
   "mode": "draw",
   "start": "FOUR_WAY",
   "run": "FourWayToNatesTieoff"
  },
  {
   "mode": "loop",
   "start": "FOUR_WAY",
   "run": "FourWayToBypassEndSixtyFoot",
   "run2": "JJJ"
  },
  {
   "mode": "draw",
   "start": "BYPASS_END_JJJ",
   "run": "BypassEndToBobsArrow"
  },
  {
   "mode": "draw",
   "start": "BOBS_ARROW",
   "run": "BobsArrowToIslanderPlatform"
  },
  {
   "mode": "draw",
   "start": "BOBS_ARROW",
   "run": "BobsArrowToEmmaMunsen"
  },
  {
   "mode": "draw",
   "start": "CAFE",
   "run": "CafeToSpookyTreeToIslander"
  },
  {
   "mode": "fit",
   "start": "NATES_TIEOFF",
   "run": "NatesTieoffToRockIsland",
   "end": "ROCK_ISLAND_T"
  },
  {
   "mode": "draw",
   "start": "ROCK_ISLAND_T",
   "run": "RockIslandTClockwise"
  },
  {
   "mode": "draw",
   "start": "LISAS_GIFT",
   "run": "LisasGiftToKibbetts"
  },
  {
   "mode": "draw",
   "start": "LISAS_GIFT",
   "run": "LisasGiftToBensT"
  },
  {
   "mode": "draw",
   "start": "BENS_T",
   "run": "BensTToJoshsWreck"
  },
  {
   "mode": "draw",
   "start": "BENS_T",
   "run": "BensTNorthwest"
  },
  {
   "mode": "fit",
   "start": "KIBBETTS",
   "run": "KibbettsToWreck2",
   "end": "WRECK_2"
  }
 ],
 "runs": {
  "BarToPlatform": [
   {
    "type": "TieOff",
    "force_draw": true
   },
   {
    "type": "SurveyedLine",
    "length_ft": 23,
    "angle": 330
   },
   {
    "type": "SurveyedLine",
    "length_ft": 36,
    "length_in": 8,
    "angle": 330
   },
   {
    "type": "Arrow",
    "distance": 8,
    "angle": 150
   },
   {
    "type": "SurveyedLine",
    "length_in": 9,
    "angle": 325
   },
   {
    "type": "SaveLandmark",
    "landmark": "MOORING_BLOCK_20FT",
    "depth_angle": 210,
    "depth": 20,
    "depth_distance_zoom": 0.8,
    "icon_path": "icons/mooringblock.png",
    "transparent_icon": true
   },
   {
    "type": "SurveyedLine",
    "length_ft": 44,
    "length_in": 8,
    "angle": 310
   },
   {
    "type": "SaveLandmark",
    "landmark": "SKELETON",
    "icon_path": "icons/mooringblock.png",
    "transparent_icon": true
   }
  ],
  "SkeletonToMooringBlock2ViaPokerRun": [
   {
    "type": "SurveyedLine",
    "length_ft": 47,
    "length_in": 9,
    "angle": 60
   },
   {
    "type": "SurveyedLine",
    "length_ft": 40,
    "angle": 55
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 72,
    "angle": 50
   },
   {
    "type": "TieOff",
    "force_draw": true
   },
   {
    "type": "SaveLandmark",
    "landmark": "BOAT_RAMP_1"
   },
   {
    "type": "MarinaLine",
    "length_ft": 35,
    "length_in": 10,
    "angle": 60
   },
   {
    "type": "SaveLandmark",
    "landmark": "BOAT_RAMP_2"
   },
   {
    "type": "TieOff",
    "force_draw": true
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "length_in": 8,
    "angle": 50
   },
   {
    "type": "Jump",
    "length_ft": 8,
    "angle": 315
   },
   {
    "type": "SaveLandmark",
    "landmark": "CAR",
    "depth_angle": 10,
    "depth": 62,
    "depth_distance_zoom": 0.8,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-6-car@3x.png"
   },
   {
    "type": "Jump",
    "length_ft": 8,
    "angle": 315
   },
   {
    "type": "SurveyedLine",
    "length_ft": 19,
    "length_in": 7,
    "angle": 300
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 54,
    "length_in": 6,
    "angle": 300
   },
   {
    "type": "SaveLandmark",
    "landmark": "UMBRELLA",
    "depth": 65,
    "depth_angle": 60,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-14-beach-umbrella@3x.png"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 4,
    "length_in": 8,
    "angle": 240
   },
   {
    "type": "SurveyedLine",
    "length_ft": 51,
    "length_in": 10,
    "angle": 240
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 235
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 43,
    "length_in": 11,
    "angle": 240
   },
   {
    "type": "SaveLandmark",
    "landmark": "ANCHOR",
    "depth_angle": 300,
    "depth": 70,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-258-anchor@3x.png"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 47,
    "length_in": 10,
    "angle": 175
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "length_in": 2,
    "angle": 175
   },
   {
    "type": "SaveLandmark",
    "landmark": "MOORING_BLOCK_2",
    "icon_path": "icons/mooringblock.png",
    "transparent_icon": true
   }
  ],
  "SkeletonToMooringBlock2ViaMooringBlocks": [
   {
    "type": "Jump",
    "length_ft": 22,
    "length_in": 1,
    "angle": 335
   },
   {
    "type": "SaveLandmark",
    "landmark": "MOORING_BLOCK_4",
    "icon_path": "icons/mooringblock.png",
    "transparent_icon": true
   },
   {
    "type": "SurveyedLine",
    "length_ft": 100,
    "angle": 55,
    "alt_text": "100' navigation line",
    "flip_text_side": true
   },
   {
    "type": "TieOff",
    "force_draw": true
   },
   {
    "type": "Jump",
    "length_ft": 100,
    "angle": 235
   },
   {
    "type": "Jump",
    "length_ft": 21,
    "length_in": 7,
    "angle": 325
   }
  ],
  "MooringBlock2ToMooringBlock1": [
   {
    "type": "Jump",
    "length_ft": 25,
    "length_in": 9,
    "angle": 230
   },
   {
    "type": "SaveLandmark",
    "landmark": "MOORING_BLOCK_1",
    "icon_path": "icons/mooringblock.png",
    "transparent_icon": true
   }
  ],
  "MooringBlock1ToMooringBlock5ViaPokerRun": [
   {
    "type": "SurveyedLine",
    "length_ft": 64,
    "length_in": 9,
    "angle": 280
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 14,
    "length_in": 11,
    "angle": 222
   },
   {
    "type": "Jump",
    "length_ft": 6,
    "length_in": 4,
    "angle": 200
   },
   {
    "type": "SaveLandmark",
    "landmark": "CONROY",
    "depth_angle": 270,
    "depth": 72,
    "icon_path": "icons/conroy.png"
   },
   {
    "type": "Jump",
    "length_ft": 6,
    "length_in": 4,
    "angle": 200
   },
   {
    "type": "SurveyedLine",
    "length_ft": 49,
    "length_in": 2,
    "angle": 160
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SaveLandmark",
    "landmark": "ANGLE_IRON"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 65,
    "length_in": 10,
    "angle": 75
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 12,
    "length_in": 1,
    "angle": 75
   },
   {
    "type": "SurveyedLine",
    "length_ft": 6,
    "length_in": 6,
    "angle": 100
   },
   {
    "type": "SaveLandmark",
    "landmark": "MOORING_BLOCK_5",
    "icon_path": "icons/mooringblock.png",
    "transparent_icon": true
   }
  ],
  "MooringBlock1ToMooringBlock5ViaMooringBlocks": [
   {
    "type": "Jump",
    "length_ft": 21,
    "length_in": 2,
    "angle": 140
   },
   {
    "type": "SaveLandmark",
    "landmark": "MOORING_BLOCK_3",
    "icon_path": "icons/mooringblock.png",
    "transparent_icon": true
   },
   {
    "type": "Jump",
    "length_ft": 25,
    "length_in": 10,
    "angle": 145
   }
  ],
  "AnchorToSailboat": [
   {
    "type": "SurveyedLine",
    "length_ft": 72,
    "length_in": 11,
    "angle": 340
   },
   {
    "type": "Stake",
    "note": "Tahiti tiger, depth 69'"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 51,
    "length_in": 3,
    "angle": 330
   },
   {
    "type": "SaveLandmark",
    "landmark": "SAILBOAT",
    "depth": 66,
    "depth_angle": 270,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-408-sailboat@3x.png"
   }
  ],
  "AnchorToSailboatTruncated": [
   {
    "type": "UnsurveyedLine",
    "length_ft": 90,
    "angle": 340,
    "alt_text": "To Sailboat"
   }
  ],
  "SailboatToUmbrella": [
   {
    "type": "SurveyedLine",
    "length_ft": 42,
    "length_in": 9,
    "angle": 70
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 37,
    "length_in": 0,
    "angle": 75
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 44,
    "length_in": 9,
    "angle": 70
   },
   {
    "type": "Stake",
    "note": "UmbrellaStake"
   }
  ],
  "SailboatToBasketballHoop": [
   {
    "type": "Jump",
    "length_ft": 84,
    "angle": 111
   },
   {
    "type": "SaveLandmark",
    "landmark": "BASKETBALL_HOOP",
    "depth_angle": 270,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-384-basketball@3x.png"
   },
   {
    "type": "Jump",
    "length_ft": 88,
    "length_in": 6,
    "angle": 111
   }
  ],
  "ConroyToOxygenTanks": [
   {
    "type": "Jump",
    "length_ft": 6,
    "length_in": 4,
    "angle": 20
   },
   {
    "type": "Jump",
    "length_ft": 4,
    "length_in": 2,
    "angle": 305
   },
   {
    "type": "SurveyedLine",
    "length_ft": 26,
    "length_in": 6,
    "angle": 5
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 40,
    "length_in": 10,
    "angle": 340
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 54,
    "length_in": 11,
    "angle": 350
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 45,
    "length_in": 5,
    "angle": 320
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 39,
    "length_in": 6,
    "angle": 320
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 26,
    "length_in": 5,
    "angle": 0
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "length_in": 4,
    "angle": 28
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 19,
    "length_in": 10,
    "angle": 5
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 28,
    "length_in": 0,
    "angle": 10
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 19,
    "length_in": 8,
    "angle": 0
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 42,
    "length_in": 10,
    "angle": 10
   },
   {
    "type": "TieOff",
    "note": "Originally a stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 37,
    "length_in": 10,
    "angle": 0
   },
   {
    "type": "TieOff"
   },
   {
    "type": "Jump",
    "length_ft": 2,
    "length_in": 0,
    "angle": 298
   }
  ],
  "ConroyToOxygenTanksTruncated": [
   {
    "type": "Jump",
    "length_ft": 6,
    "length_in": 4,
    "angle": 20
   },
   {
    "type": "Jump",
    "length_ft": 4,
    "length_in": 2,
    "angle": 305
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 75,
    "angle": 5,
    "alt_text": "        To Oxygen Tanks"
   }
  ],
  "CarToLisasGift": [
   {
    "type": "SurveyedLine",
    "length_ft": 38,
    "length_in": 6,
    "angle": 56
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "angle": 56
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 34,
    "angle": 46
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 19,
    "length_in": 10,
    "angle": 46
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 13,
    "length_in": 2,
    "angle": 37
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 3,
    "angle": 58
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 10,
    "angle": 58
   },
   {
    "type": "Stake",
    "note": "loose"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 58
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "length_in": 7,
    "angle": 27
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 57,
    "length_in": 4,
    "angle": 48
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 50
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 52
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "angle": 332
   },
   {
    "type": "SaveLandmark",
    "landmark": "WAGON_WHEELS",
    "depth": 56,
    "depth_angle": 140,
    "depth_distance_zoom": 1.1,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-677-car-wheel@3x.png"
   },
   {
    "type": "Jump",
    "length_ft": 27,
    "angle": 152
   },
   {
    "type": "SurveyedLine",
    "length_ft": 28,
    "angle": 50
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "length_in": 4,
    "angle": 50
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 28,
    "angle": 50
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 42
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 28,
    "angle": 48
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 21,
    "length_in": 10,
    "angle": 54
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 28,
    "angle": 54
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 54
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 28,
    "length_in": 6,
    "angle": 54
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 21,
    "length_in": 6,
    "angle": 54
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 42,
    "angle": 54
   },
   {
    "type": "SaveLandmark",
    "landmark": "LISAS_GIFT",
    "depth": 56,
    "depth_angle": 120,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-70-gift@3x.png"
   }
  ],
  "CarToLisasGiftTruncated": [
   {
    "type": "UnsurveyedLine",
    "length_ft": 90,
    "angle": 56,
    "alt_text": "      To Lisa's Gift",
    "flip_text_side": true
   }
  ],
  "LisasGiftToKibbetts": [
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 322
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 43,
    "length_in": 7,
    "angle": 325
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 42,
    "length_in": 6,
    "angle": 330
   },
   {
    "type": "SaveLandmark",
    "landmark": "KIBBETTS",
    "depth": 58,
    "depth_angle": 270,
    "icon_path": "icons/shipwreck.png",
    "note": "21 feet long"
   }
  ],
  "KibbettsToWreck2": [
   {
    "type": "Jump",
    "length_ft": 14,
    "length_in": 10,
    "angle": 61
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 91,
    "angle": 61
   },
   {
    "type": "SurveyedLine",
    "length_ft": 97,
    "angle": 61
   },
   {
    "type": "SurveyedLine",
    "length_ft": 51,
    "length_in": 6,
    "angle": 61
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 82,
    "length_in": 6,
    "angle": 61
   }
  ],
  "LisasGiftToBensT": [
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "length_in": 5,
    "angle": 72
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "length_in": 4,
    "angle": 72
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 49,
    "length_in": 3,
    "angle": 70
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "length_in": 1,
    "angle": 71
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "length_in": 1,
    "angle": 66
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 34,
    "length_in": 6,
    "angle": 76
   },
   {
    "type": "Stake"
   },
   {
    "type": "Jump",
    "length_ft": 18,
    "length_in": 10,
    "angle": 68,
    "note": "gap"
   },
   {
    "type": "SaveLandmark",
    "landmark": "WRECK_1",
    "icon_path": "icons/shipwreck.png"
   },
   {
    "type": "Jump",
    "length_ft": 6,
    "length_in": 10,
    "angle": 68
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 60,
    "length_in": 2,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 50,
    "angle": 60
   },
   {
    "type": "Jump",
    "length_ft": 50,
    "angle": 240
   },
   {
    "type": "Arrow",
    "angle": 240
   },
   {
    "type": "SaveLandmark",
    "landmark": "BENS_T"
   }
  ],
  "BensTNorthwest": [
   {
    "type": "SurveyedLine",
    "length_ft": 80,
    "length_in": 6,
    "angle": 334
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "length_in": 3,
    "angle": 334
   },
   {
    "type": "SurveyedLine",
    "length_ft": 28,
    "angle": 314
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 54,
    "length_in": 8,
    "angle": 314
   },
   {
    "type": "Jump",
    "length_ft": 8,
    "angle": 350
   },
   {
    "type": "SaveLandmark",
    "landmark": "WRECK_2",
    "depth": 49,
    "icon_path": "icons/shipwreck.png"
   }
  ],
  "BensTToJoshsWreck": [
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 53,
    "length_in": 1,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 94,
    "length_in": 6,
    "angle": 60
   },
   {
    "type": "TieOff"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 150,
    "angle": 60
   },
   {
    "type": "Jump",
    "length_ft": 150,
    "angle": 240
   },
   {
    "type": "Jump",
    "length_ft": 3,
    "angle": 334,
    "note": "NOTE(stpyang): Tie-offs at opposite ends of log"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "length_in": 6,
    "angle": 92
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 37,
    "length_in": 3,
    "angle": 110
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 43,
    "angle": 124
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SaveLandmark",
    "landmark": "JOSHS_WRECK",
    "icon_path": "icons/shipwreck.png"
   }
  ],
  "UmbrellaToRockIsland": [
   {
    "type": "Jump",
    "length_ft": 18,
    "angle": 20
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 21,
    "angle": 10
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 52,
    "angle": 20
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 25,
    "angle": 20
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 87,
    "angle": 20
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 29,
    "angle": 10
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "angle": 20
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 38,
    "angle": 5
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 68,
    "angle": 10
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "angle": 0
   },
   {
    "type": "TieOff",
    "note": "ROCK"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 18,
    "angle": 40
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 39,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 35,
    "angle": 355
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 17,
    "angle": 10
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 17,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 23,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 25,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "angle": 10
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 17,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 13,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 23,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 33,
    "length_in": 6,
    "angle": 348
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 23,
    "angle": 350
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "angle": 345
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 310,
    "flip_text_side": true
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "angle": 40
   },
   {
    "type": "SaveLandmark",
    "landmark": "ROWBOAT",
    "icon_path": "icons/shipwreck.png"
   },
   {
    "type": "Jump",
    "length_ft": 15,
    "angle": 220
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "angle": 315,
    "flip_text_side": true
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 16,
    "angle": 320
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 24,
    "angle": 330
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 310
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 24,
    "angle": 325
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "angle": 325
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "angle": 325
   },
   {
    "type": "Stake"
   },
   {
    "type": "SaveLandmark",
    "landmark": "ROCK_ISLAND_BOTTLE"
   }
  ],
  "UmbrellaToOxygenTanks": [
   {
    "type": "SurveyedLine",
    "length_ft": 3,
    "angle": 335,
    "alt_text": ""
   },
   {
    "type": "SurveyedLine",
    "length_ft": 49,
    "length_in": 6,
    "angle": 335
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 49,
    "length_in": 4,
    "angle": 330
   },
   {
    "type": "SavedStake",
    "landmark": "SAILBOATTOUMBRELLASTAKE"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 49,
    "angle": 335
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 19,
    "length_in": 10,
    "angle": 320
   },
   {
    "type": "TieOff",
    "note": "BARREL"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 29,
    "angle": 310
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 42,
    "length_in": 1,
    "angle": 300
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 41,
    "angle": 290
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 32,
    "length_in": 1,
    "angle": 280
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 32,
    "length_in": 6,
    "angle": 280
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "angle": 280
   },
   {
    "type": "SaveLandmark",
    "landmark": "OXYGEN_TANKS",
    "depth": 66,
    "depth_angle": 270,
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-256-oxygen-bottles@3x.png"
   }
  ],
  "UmbrellaToOxygenTanksTruncated": [
   {
    "type": "UnsurveyedLine",
    "length_ft": 75,
    "angle": 335,
    "alt_text": "To Oxygen Tanks        "
   }
  ],
  "RockIslandBottleClockwise": [
   {
    "type": "SurveyedLine",
    "length_ft": 35,
    "angle": 225
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 54,
    "angle": 235
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 240
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 51,
    "angle": 240
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 53,
    "angle": 240
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 53,
    "angle": 220
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 52,
    "angle": 220
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 52,
    "angle": 235
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 48,
    "angle": 220
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 48,
    "angle": 250
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SaveLandmark",
    "landmark": "ROCK_ISLAND_T"
   }
  ],
  "RockIslandTClockwise": [
   {
    "type": "SurveyedLine",
    "length_ft": 72,
    "angle": 220
   },
   {
    "type": "TieOff"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 25,
    "angle": 240,
    "alt_text": ""
   }
  ],
  "RockIslandBottleCounterClockwise": [
   {
    "type": "SurveyedLine",
    "length_ft": 60,
    "length_in": 3,
    "angle": 40
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 59,
    "length_in": 5,
    "angle": 40
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 53,
    "length_in": 5,
    "angle": 40
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SaveLandmark",
    "landmark": "ROCK_ISLAND_T2"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 17,
    "angle": 60
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 33,
    "angle": 40
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "length_in": 7,
    "angle": 35
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 37,
    "angle": 40
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "length_in": 6,
    "angle": 40
   },
   {
    "type": "SurveyedLine",
    "length_ft": 30,
    "length_in": 4,
    "angle": 30
   },
   {
    "type": "SurveyedLine",
    "length_ft": 16,
    "length_in": 4,
    "angle": 20
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "length_in": 3,
    "angle": 10
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 3,
    "length_in": 4,
    "angle": 315
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 10,
    "length_in": 4,
    "angle": 358
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 6,
    "length_in": 1,
    "angle": 260
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 7,
    "length_in": 7,
    "angle": 305
   },
   {
    "type": "TieOff"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 100,
    "angle": 260
   }
  ],
  "RockIslandT2ToCatherine": [
   {
    "type": "SurveyedLine",
    "length_ft": 90,
    "angle": 55
   },
   {
    "type": "SurveyedLine",
    "length_ft": 40,
    "length_in": 8,
    "angle": 55
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 90,
    "angle": 20
   },
   {
    "type": "SurveyedLine",
    "length_ft": 36,
    "length_in": 10,
    "angle": 20
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 40,
    "length_in": 9,
    "angle": 20
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 20
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 89,
    "length_in": 1,
    "angle": 15
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 73,
    "length_in": 11,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 45,
    "length_in": 8,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 43,
    "length_in": 10,
    "angle": 45
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 68,
    "length_in": 8,
    "angle": 45
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 37,
    "length_in": 7,
    "angle": 45
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 29,
    "length_in": 8,
    "angle": 15
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 70,
    "length_in": 3,
    "angle": 55
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 35,
    "length_in": 3,
    "angle": 50
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "length_in": 11,
    "angle": 50
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 35,
    "length_in": 0,
    "angle": 60
   },
   {
    "type": "SurveyedLine",
    "length_ft": 3,
    "length_in": 0,
    "angle": 150
   },
   {
    "type": "SurveyedLine",
    "length_ft": 3,
    "length_in": 0,
    "angle": 120
   },
   {
    "type": "SurveyedLine",
    "length_ft": 6,
    "length_in": 10,
    "angle": 145
   },
   {
    "type": "SurveyedLine",
    "length_ft": 21,
    "length_in": 11,
    "angle": 145
   },
   {
    "type": "SaveLandmark",
    "landmark": "CATHERINE_COOKIE"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 24,
    "length_in": 5,
    "angle": 100
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "length_in": 7,
    "angle": 135
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "length_in": 0,
    "angle": 125
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 40,
    "length_in": 11,
    "angle": 130
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 27,
    "length_in": 0,
    "angle": 125
   },
   {
    "type": "SaveLandmark",
    "landmark": "CATHERINE",
    "icon_path": "icons/catherine.png"
   }
  ],
  "CatherineCookieToUnknown": [
   {
    "type": "SurveyedLine",
    "length_ft": 16,
    "length_in": 9,
    "angle": 190
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "length_in": 5,
    "angle": 185
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 85,
    "length_in": 0,
    "angle": 215
   },
   {
    "type": "SurveyedLine",
    "length_ft": 21,
    "length_in": 3,
    "angle": 215
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 50,
    "angle": 290,
    "note": "Rounds a corner"
   }
  ],
  "AngleIronToMary": [
   {
    "type": "SurveyedLine",
    "length_ft": 78,
    "angle": 222
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "angle": 260
   },
   {
    "type": "SurveyedLine",
    "length_ft": 57,
    "angle": 230
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 63,
    "angle": 250
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 10,
    "angle": 250,
    "alt_text": ""
   },
   {
    "type": "SurveyedLine",
    "length_ft": 73,
    "angle": 240
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 36,
    "angle": 222.5,
    "flip_text_side": true
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 69,
    "angle": 270
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 38,
    "angle": 245
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 9,
    "angle": 250,
    "alt_text": ""
   },
   {
    "type": "TieOff",
    "force_draw": true
   },
   {
    "type": "SaveLandmark",
    "landmark": "MARY",
    "icon_path": "icons/mary.png",
    "depth": 51,
    "depth_angle": 270
   }
  ],
  "AngleIronToMaryTruncated": [
   {
    "type": "UnsurveyedLine",
    "length_ft": 30,
    "angle": 222
   }
  ],
  "MaryToFourWay": [
   {
    "type": "SurveyedLine",
    "length_ft": 63,
    "angle": 315
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 42,
    "angle": 315,
    "flip_text_side": true
   },
   {
    "type": "SaveLandmark",
    "landmark": "FOUR_WAY"
   }
  ],
  "JJJ": [
   {
    "type": "SurveyedLine",
    "length_ft": 31,
    "angle": 260,
    "flip_text_side": true
   },
   {
    "type": "SurveyedLine",
    "length_ft": 25,
    "angle": 240
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 24,
    "angle": 210,
    "flip_text_side": true
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "angle": 280
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 58,
    "angle": 210
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 83,
    "angle": 250
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 20,
    "angle": 230
   },
   {
    "type": "Arrow",
    "angle": 50,
    "distance": 0,
    "color": "red"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 15,
    "length_in": 6,
    "angle": 210
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 35,
    "length_in": 6,
    "angle": 230
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 23,
    "angle": 230
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 24,
    "angle": 210
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 16,
    "angle": 215
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 36,
    "angle": 250
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 11,
    "angle": 235
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 53,
    "angle": 230
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SaveLandmark",
    "landmark": "BYPASS_END_JJJ"
   }
  ],
  "FourWayToNatesTieoff": [
   {
    "type": "Arrow",
    "angle": 135,
    "distance": 0
   },
   {
    "type": "SurveyedLine",
    "length_ft": 30,
    "angle": 330
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 29,
    "angle": 340
   },
   {
    "type": "Stake"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 150,
    "angle": 305,
    "alt_text": "Josh's deep line",
    "flip_text_side": true
   },
   {
    "type": "Jump",
    "length_ft": 150,
    "angle": 125
   },
   {
    "type": "SurveyedLine",
    "length_ft": 14,
    "angle": 325
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 13,
    "length_in": 6,
    "angle": 320
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 8,
    "angle": 330
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 19,
    "length_in": 6,
    "angle": 315
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 34,
    "angle": 330
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 59,
    "angle": 10
   },
   {
    "type": "SaveLandmark",
    "landmark": "NATES_TIEOFF",
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-233-lasso@3x.png"
   }
  ],
  "NatesTieoffToRockIsland": [
   {
    "type": "SurveyedLine",
    "length_ft": 109,
    "angle": 70
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 51,
    "angle": 55
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 24,
    "angle": 55
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 104,
    "angle": 0
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 115,
    "angle": 30
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 57,
    "angle": 25
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 33,
    "angle": 30
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 52,
    "angle": 30
   },
   {
    "type": "Stake"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 167,
    "angle": 40
   },
   {
    "type": "SurveyedLine",
    "length_ft": 10,
    "angle": 20
   },
   {
    "type": "SurveyedLine",
    "length_ft": 9,
    "angle": 0
   },
   {
    "type": "SurveyedLine",
    "length_ft": 9,
    "angle": 340
   }
  ],
  "FourWayToBypassEndSixtyFoot": [
   {
    "type": "SurveyedLine",
    "length_ft": 47,
    "angle": 305
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 52,
    "angle": 300
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 47,
    "angle": 265
   },
   {
    "type": "SurveyedLine",
    "length_ft": 12,
    "angle": 240
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 65,
    "angle": 235
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 19,
    "angle": 230
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 245
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 34,
    "angle": 255
   },
   {
    "type": "SurveyedLine",
    "length_ft": 33,
    "angle": 255
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 230
   },
   {
    "type": "SurveyedLine",
    "length_ft": 11,
    "angle": 220
   },
   {
    "type": "SurveyedLine",
    "length_ft": 3,
    "length_in": 6,
    "angle": 200
   },
   {
    "type": "SurveyedLine",
    "length_ft": 48,
    "angle": 160
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 45,
    "angle": 210
   },
   {
    "type": "SurveyedLine",
    "length_ft": 30,
    "angle": 160
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 26,
    "angle": 175
   },
   {
    "type": "SaveLandmark",
    "landmark": "BYPASS_END_SIXTY_FOOT"
   }
  ],
  "BypassEndToBobsArrow": [
   {
    "type": "SurveyedLine",
    "length_ft": 60,
    "angle": 250
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 94,
    "angle": 230
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 46,
    "angle": 220
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "angle": 220
   },
   {
    "type": "Arrow",
    "distance": 0,
    "angle": 40
   },
   {
    "type": "SaveLandmark",
    "landmark": "BOBS_ARROW"
   }
  ],
  "BobsArrowToEmmaMunsen": [
   {
    "type": "SurveyedLine",
    "length_ft": 9,
    "angle": 335
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 49,
    "angle": 355
   },
   {
    "type": "SurveyedLine",
    "length_ft": 22,
    "angle": 345
   },
   {
    "type": "Stake"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 70,
    "angle": 10
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 65,
    "angle": 5
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 50,
    "angle": 5
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 22,
    "angle": 355
   },
   {
    "type": "SaveLandmark",
    "landmark": "EMMA_MUNSEN",
    "icon_path": "icons/tugboat.png"
   }
  ],
  "BobsArrowToIslanderPlatform": [
   {
    "type": "SurveyedLine",
    "length_ft": 25,
    "angle": 220
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 104,
    "angle": 250
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 16,
    "length_in": 5,
    "angle": 270
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 23,
    "angle": 270
   },
   {
    "type": "SurveyedLine",
    "length_ft": 23,
    "angle": 250
   },
   {
    "type": "SurveyedLine",
    "length_ft": 35,
    "angle": 235
   },
   {
    "type": "SurveyedLine",
    "length_ft": 35,
    "angle": 225
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 14,
    "angle": 195
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 54,
    "angle": 210
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 60,
    "angle": 210
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 58,
    "angle": 200
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 54,
    "angle": 150
   },
   {
    "type": "SaveLandmark",
    "landmark": "TRACTOR_TIRE",
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-137-cogwheel@3x.png"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 48,
    "angle": 132
   },
   {
    "type": "SaveLandmark",
    "landmark": "CRIBBING",
    "icon_path": "icons/cribbing.png"
   },
   {
    "type": "Jump",
    "length_ft": 0,
    "angle": 0,
    "note": "TODO"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 37,
    "angle": 210
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 48,
    "angle": 176
   },
   {
    "type": "SurveyedLine",
    "length_ft": 66,
    "angle": 232
   },
   {
    "type": "SaveLandmark",
    "landmark": "CAFE",
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-273-coffee-mug@3x.png"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 85,
    "angle": 230
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 61,
    "angle": 220
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 62,
    "angle": 220
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 34,
    "angle": 230
   },
   {
    "type": "SaveLandmark",
    "landmark": "ISLANDER_PLATFORM"
   }
  ],
  "CafeToSpookyTreeToIslander": [
   {
    "type": "SurveyedLine",
    "length_ft": 91,
    "angle": 250
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 53,
    "angle": 335
   },
   {
    "type": "SaveLandmark",
    "landmark": "SPOOKY_TREE",
    "icon_path": "icons/spookytree.png"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 47,
    "angle": 205
   },
   {
    "type": "SurveyedLine",
    "length_ft": 51,
    "angle": 205
   },
   {
    "type": "SaveLandmark",
    "landmark": "JUG"
   },
   {
    "type": "TieOff",
    "note": "THIS IS THE JUG"
   },
   {
    "type": "Jump",
    "length_ft": 94,
    "angle": 240
   },
   {
    "type": "SaveLandmark",
    "landmark": "HOOP",
    "icon_path": "glyphicons-pro/glyphicons-basic-2-3/png/glyphicons-basic-154-square-empty@2x.png",
    "transparent_icon": true
   },
   {
    "type": "Jump",
    "length_ft": 87,
    "angle": 240
   },
   {
    "type": "Jump",
    "length_ft": 40,
    "angle": 240,
    "note": "THIS IS A FUDGE, ISLANDER IS 120 FEET LONG but we measured nearer to the stern"
   },
   {
    "type": "SaveLandmark",
    "landmark": "ISLANDER",
    "icon_path": "icons/islander.png",
    "transparent_icon": true
   }
  ],
  "ExampleData": [
   {
    "type": "SaveLandmark",
    "landmark": "MY_BOAT",
    "icon_path": "icons/shipwreck.png"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 100,
    "angle": 90
   },
   {
    "type": "Stake"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 100,
    "angle": 45,
    "alt_text": "(Unsurveyed line)"
   },
   {
    "type": "Jump",
    "length_ft": 100,
    "angle": 225
   },
   {
    "type": "SurveyedLine",
    "length_ft": 50,
    "length_in": 8,
    "angle": 135
   },
   {
    "type": "TieOff"
   },
   {
    "type": "SurveyedLine",
    "length_ft": 150,
    "angle": 100
   },
   {
    "type": "SurveyedLine",
    "length_ft": 75,
    "angle": 80
   },
   {
    "type": "Stake"
   },
   {
    "type": "UnsurveyedLine",
    "length_ft": 25,
    "angle": 120,
    "alt_text": ""
   }
  ]
 },
 "unusedRuns": [
  "AnchorToSailboatTruncated",
  "ConroyToOxygenTanksTruncated",
  "CarToLisasGiftTruncated",
  "UmbrellaToOxygenTanksTruncated",
  "AngleIronToMaryTruncated",
  "ExampleData"
 ]
};
  root.SITE_MAPS = root.SITE_MAPS || {};
  root.SITE_MAPS["bonnie-castle"] = data;
  if (typeof module === "object" && module.exports) module.exports = data;
})(typeof window !== "undefined" ? window : globalThis);
