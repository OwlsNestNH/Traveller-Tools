import {SCC2023} from './catalogue-scc2023.mjs';
import {TNG2024} from './catalogue-tng2024.mjs';
import {ACS2023} from './catalogue-acs2023.mjs';
// Minimum setup facts verified from the user-supplied PDFs. Printed pages, not PDF offsets.
// No rule text, deck plans, weapon tables or costs are reproduced.
const rows=[
 {"id": "drinax-harrier-restored", "initialCondition":{"powerOutput":260}, "name": "Harrier Commerce Raider · designed/restored", "tons": 200, "thrust": 6, "hull": 88, "armour": 4, "source": {"book": "The Pirates of Drinax — Book 2: The Trojan Reach (Updated)", "page": 10, "endPage": 11}, "notes": "Designed/restored base. Book 2 p12 campaign start is damaged (Hull 72, plant output 195), not initialized here. Starting fuel and ammunition are unknown. No campaign quirk is simulated.", "record": {"className": "Harrier-class commerce raider", "tl": 15, "ratedPower": 260, "fuelCapacity": 42, "cargoCapacity": 29.7, "jump": 2, "sensors": "Advanced + military countermeasures", "computer": "Computer/20", "software": "Evade/1; Fire Control/2; Jump Control/2; Library; Manoeuvre/0", "reference": "Verified Book 2 (Updated), printed pp10–11. Missile storage: 12 missiles; rack load and missile type not specified. Requirements are mode-dependent, never automatically summed. Equipment: source-verified for this preset.", "requirements": [{"name": "Basic systems", "power": 40}, {"name": "Manoeuvre drive", "power": 120}, {"name": "Jump drive", "power": 40}, {"name": "Sensors", "power": 8}, {"name": "Missile turret", "power": 1}, {"name": "Particle barbette", "power": 15}, {"name": "Holographic hull", "power": 100}, {"name": "Low berths", "power": 1}], "weapons": [{"id": "particle-barbette", "name": "Particle barbette", "type": "Particle beam — Accurate, High Yield", "count": 1, "ammunition": null}, {"id": "missile-turret", "name": "Ventral single turret", "type": "Missile rack — type unverified; storage 12 separate from rack load", "count": 1, "ammunition": null}]}},
 {"id":"highguard-158","name":"Express Boat","tons":100,"thrust":0,"hull":40,"armour":null,"source":{"book":"High Guard Update 2022","page":158},"notes":"No manoeuvre drive is installed in this source design. Zero thrust permits coasting only; the jump drive is not a movement budget. Armour not listed."},
 {
  "id": "core-190",
  "name": "Scout/Courier",
  "tons": 100.0,
  "thrust": 2,
  "hull": 40,
  "armour": 4,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 190
  },
  "notes": ""
 },
 {
  "id": "core-192",
  "name": "Seeker Mining Ship",
  "tons": 100.0,
  "thrust": 2,
  "hull": 40,
  "armour": 4,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 192
  },
  "notes": ""
 },
 {
  "id": "core-194",
  "name": "Free Trader",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": 2,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 194
  },
  "notes": ""
 },
 {
  "id": "core-196",
  "name": "Far Trader",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": 2,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 196
  },
  "notes": ""
 },
 {
  "id": "core-198",
  "name": "Safari Ship",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 198
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-200",
  "name": "System Defence Boat",
  "tons": 200.0,
  "thrust": 9,
  "hull": 88,
  "armour": 13,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 200
  },
  "notes": ""
 },
 {
  "id": "core-202",
  "name": "Yacht",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 202
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-204",
  "name": "Gazelle Close Escort",
  "tons": 400.0,
  "thrust": 6,
  "hull": 176,
  "armour": 3,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 204
  },
  "notes": ""
 },
 {
  "id": "core-206",
  "name": "Laboratory Ship",
  "tons": 400.0,
  "thrust": 2,
  "hull": 160,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 206
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-208",
  "name": "Patrol Corvette",
  "tons": 400.0,
  "thrust": 4,
  "hull": 160,
  "armour": 4,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 208
  },
  "notes": ""
 },
 {
  "id": "core-210",
  "name": "Subsidised Merchant",
  "tons": 400.0,
  "thrust": 1,
  "hull": 160,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 210
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-212",
  "name": "Survey Scout",
  "tons": 400.0,
  "thrust": 2,
  "hull": 160,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 212
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-218",
  "name": "Light Fighter",
  "tons": 10.0,
  "thrust": 6,
  "hull": 4,
  "armour": 2,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 218
  },
  "notes": ""
 },
 {
  "id": "core-219",
  "name": "Gig",
  "tons": 20.0,
  "thrust": 7,
  "hull": 8,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 219
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-220",
  "name": "Launch",
  "tons": 20.0,
  "thrust": 1,
  "hull": 8,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 220
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-221",
  "name": "Ship’s Boat",
  "tons": 30.0,
  "thrust": 5,
  "hull": 12,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 221
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-222",
  "name": "Slow Boat",
  "tons": 30.0,
  "thrust": 3,
  "hull": 12,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 222
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-223",
  "name": "Pinnace",
  "tons": 40.0,
  "thrust": 5,
  "hull": 16,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 223
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-224",
  "name": "Slow Pinnace",
  "tons": 40.0,
  "thrust": 3,
  "hull": 16,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 224
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-225",
  "name": "Modular Cutter",
  "tons": 50.0,
  "thrust": 4,
  "hull": 20,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 225
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-226",
  "name": "Shuttle",
  "tons": 95.0,
  "thrust": 3,
  "hull": 38,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 226
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "core-227",
  "name": "Passenger Shuttle",
  "tons": 95.0,
  "thrust": 1,
  "hull": 38,
  "armour": null,
  "source": {
   "book": "Core Rulebook Update 2022",
   "page": 227
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-136",
  "name": "Ultralight Fighter",
  "tons": 6.0,
  "thrust": 6,
  "hull": 2,
  "armour": 3,
  "source": {
   "book": "High Guard Update 2022",
   "page": 136
  },
  "notes": ""
 },
 {
  "id": "highguard-137",
  "name": "Light Fighter",
  "tons": 10.0,
  "thrust": 6,
  "hull": 4,
  "armour": 2,
  "source": {
   "book": "High Guard Update 2022",
   "page": 137
  },
  "notes": ""
 },
 {
  "id": "highguard-138",
  "name": "Military Gig",
  "tons": 20.0,
  "thrust": 8,
  "hull": 8,
  "armour": 4,
  "source": {
   "book": "High Guard Update 2022",
   "page": 138
  },
  "notes": ""
 },
 {
  "id": "highguard-139",
  "name": "Launch",
  "tons": 20.0,
  "thrust": 1,
  "hull": 8,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 139
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-140",
  "name": "Ship’s Boat",
  "tons": 30.0,
  "thrust": 5,
  "hull": 12,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 140
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-141",
  "name": "Slow Boat",
  "tons": 30.0,
  "thrust": 3,
  "hull": 12,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 141
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-142",
  "name": "Pinnace",
  "tons": 40.0,
  "thrust": 5,
  "hull": 16,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 142
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-143",
  "name": "Slow Pinnace",
  "tons": 40.0,
  "thrust": 3,
  "hull": 16,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 143
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-144",
  "name": "Modular Cutter",
  "tons": 50.0,
  "thrust": 4,
  "hull": 20,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 144
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-148",
  "name": "Heavy Fighter",
  "tons": 50.0,
  "thrust": 9,
  "hull": 22,
  "armour": 15,
  "source": {
   "book": "High Guard Update 2022",
   "page": 148
  },
  "notes": ""
 },
 {
  "id": "highguard-150",
  "name": "Troop Transport",
  "tons": 50.0,
  "thrust": 9,
  "hull": 22,
  "armour": 5,
  "source": {
   "book": "High Guard Update 2022",
   "page": 150
  },
  "notes": ""
 },
 {
  "id": "highguard-152",
  "name": "Torpedo Boat",
  "tons": 70.0,
  "thrust": 6,
  "hull": 30,
  "armour": 12,
  "source": {
   "book": "High Guard Update 2022",
   "page": 152
  },
  "notes": ""
 },
 {
  "id": "highguard-154",
  "name": "Shuttle",
  "tons": 95.0,
  "thrust": 3,
  "hull": 38,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 154
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-156",
  "name": "Passenger Shuttle",
  "tons": 95.0,
  "thrust": 1,
  "hull": 38,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 156
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-160",
  "name": "Suleiman Scout Courier",
  "tons": 100.0,
  "thrust": 2,
  "hull": 40,
  "armour": 4,
  "source": {
   "book": "High Guard Update 2022",
   "page": 160
  },
  "notes": ""
 },
 {
  "id": "highguard-162",
  "name": "Seeker Mining Ship",
  "tons": 100.0,
  "thrust": 2,
  "hull": 40,
  "armour": 4,
  "source": {
   "book": "High Guard Update 2022",
   "page": 162
  },
  "notes": ""
 },
 {
  "id": "highguard-165",
  "name": "Serpent Scout",
  "tons": 100.0,
  "thrust": 2,
  "hull": 40,
  "armour": 4,
  "source": {
   "book": "High Guard Update 2022",
   "page": 165
  },
  "notes": ""
 },
 {
  "id": "highguard-167",
  "name": "Empress Marava Far Trader",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 167
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-169",
  "name": "Hero Far Trader",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": 2,
  "source": {
   "book": "High Guard Update 2022",
   "page": 169
  },
  "notes": ""
 },
 {
  "id": "highguard-171",
  "name": "Beowulf Free Trader",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": 2,
  "source": {
   "book": "High Guard Update 2022",
   "page": 171
  },
  "notes": ""
 },
 {
  "id": "highguard-173",
  "name": "Safari Ship",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 173
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-175",
  "name": "System Defence Boat",
  "tons": 200.0,
  "thrust": 9,
  "hull": 88,
  "armour": 13,
  "source": {
   "book": "High Guard Update 2022",
   "page": 175
  },
  "notes": ""
 },
 {
  "id": "highguard-177",
  "name": "Jump Shuttle",
  "tons": 200.0,
  "thrust": 3,
  "hull": 80,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 177
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-179",
  "name": "Yacht",
  "tons": 200.0,
  "thrust": 1,
  "hull": 80,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 179
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-181",
  "name": "Gazelle Close Escort",
  "tons": 400.0,
  "thrust": 5,
  "hull": 160,
  "armour": 3,
  "source": {
   "book": "High Guard Update 2022",
   "page": 181
  },
  "notes": "Internal tankage configuration: thrust 5. Attached drop tanks alter performance and are not modelled."
 },
 {
  "id": "highguard-183",
  "name": "Fleet Courier",
  "tons": 400.0,
  "thrust": 5,
  "hull": 160,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 183
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-185",
  "name": "Laboratory Ship",
  "tons": 360.0,
  "thrust": 2,
  "hull": 160,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 185
  },
  "notes": "Listed hull is 360 tons; source drives and hull points describe the 400-ton configuration with research pinnace. Kept as printed, not recalculated."
 },
 {
  "id": "highguard-187",
  "name": "Patrol Corvette",
  "tons": 400.0,
  "thrust": 4,
  "hull": 160,
  "armour": 4,
  "source": {
   "book": "High Guard Update 2022",
   "page": 187
  },
  "notes": ""
 },
 {
  "id": "highguard-189",
  "name": "Subsidised Merchant",
  "tons": 400.0,
  "thrust": 1,
  "hull": 160,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 189
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-191",
  "name": "Donosev Survey Scout",
  "tons": 400.0,
  "thrust": 3,
  "hull": 144,
  "armour": null,
  "source": {
   "book": "High Guard Update 2022",
   "page": 191
  },
  "notes": "Armour not listed in this source stat block."
 },
 {
  "id": "highguard-193",
  "name": "Dragon System Defence Boat",
  "tons": 400.0,
  "thrust": 7,
  "hull": 176,
  "armour": 13,
  "source": {
   "book": "High Guard Update 2022",
   "page": 193
  },
  "notes": ""
 },
 {
  "id": "highguard-196",
  "name": "Nishemani Corsair",
  "tons": 400.0,
  "thrust": 3,
  "hull": 160,
  "armour": 5,
  "source": {
   "book": "High Guard Update 2022",
   "page": 195,
   "endPage": 196
  },
  "notes": ""
 }
];
export const PRESETS=Object.freeze([...rows,...ACS2023,...TNG2024,...SCC2023].map(row=>Object.freeze({...row,source:Object.freeze(row.source)})));
export function preset(id){const p=PRESETS.find(p=>p.id===id);if(!p)throw Error("Choose an existing ship preset.");return structuredClone(p);}
