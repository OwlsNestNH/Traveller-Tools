// Original rules implementation: numeric mechanics and short game labels only.
// References use printed page numbers. No source-book files or private locations.
// Publication remains subject to the repository's publisher-compliance review.
const SOURCES = {
  "companion": {
    "id": "companion",
    "title": "Traveller Companion Update 2024"
  },
  "aliens": {
    "id": "aliens",
    "title": "Aliens of Charted Space Volume 1 Update 2026"
  },
  "jtas11": {
    "id": "jtas11",
    "title": "Journal of the Travellers’ Aid Society Volume 11"
  }
};
const citation = (id, ...pages) => ({ ...SOURCES[id], pages });
const skill = (name, value = 1, mode = 'increase') => ({ kind: 'skill', name, mode, value });
const stat = (name, value, extra = {}) => ({ kind: 'stat', name, value, ...extra });
const choice = options => ({ kind: 'choice', options: options.map(([label, effects]) => ({ label, effects })) });
const benefit = (name, value = 1) => ({ kind: 'benefit', name, value });
const relationship = (type, count = 1, dice) => ({ kind: 'relationship', type, count, ...(dice ? {dice} : {}) });
const sourceRequired = (id, page, reason) => ({ kind: 'source-required', source: citation(id, page), reason });

// Compact authoring notation is local to this module; exports use the shared effect DSL.
function cell(token) {
 if (token === '-') return [];
 if (token.includes(' & ')) return token.split(' & ').flatMap(cell);
 if (token.startsWith('male:')) {
  const [yes, no] = token.slice(5).split(';');
  return [{ kind: 'conditional', condition: { gender: 'male' }, then: cell(yes), otherwise: cell(no) }];
 }
 if (token.includes(' / ')) return [choice(token.split(' / ').map(t => [t.replace(/^[#@]/, ''), cell(t)]))];
 if (token.startsWith('$talent')) return [{ kind: 'skill-choice', scope: 'psionic-talents', mode: token.endsWith('=1') ? 'set' : 'increase', value: 1, exclude: [] }];
 if (token === '$assignment-ship') return [{
  kind: 'assignment-effect', assignments: { corsair: [benefit('Corsair')], explorer: [benefit('Scout')], navy: [benefit("Ship's Boat")] }
 }];
 if (token === '$nenj-or-shares') return [{
  kind: 'conditional', condition: { stat: 'SOC', min: 10 }, then: [benefit('Nenj')], otherwise: [benefit('Ship Share', 5)]
 }];
 if (token.startsWith('#')) {
  const [name, quantity] = token.slice(1).split(':');
  return [benefit(name, quantity ? Number(quantity) : 1)];
 }
 if (token.startsWith('@')) return [relationship(token.slice(1))];
 const characteristic = token.match(/^([A-Z]{3})([+-]\d+)(?:@(\d+))?$/);
 if (characteristic) return [stat(characteristic[1], Number(characteristic[2]), characteristic[3] ? { maximum: Number(characteristic[3]) } : {})];
 const [name, level] = token.split('=');
 if (name === 'Independence') return [{
  kind: 'independence', name, mode: level ? 'set' : 'increase', value: level ? Number(level) : 1,
  gender: 'male', check: { dice: '2D', comparison: '>', stat: 'SOC' }, source: citation('aliens', 20)
 }];
 if (token.startsWith('$')) throw new Error('Unknown expansion token: ' + token);
 return [skill(name, level ? Number(level) : 1, level ? 'set' : 'increase')];
}
const table = text => text.split('|').map(cell);
const rankTrack = ({cells, titles = ''}) => {
 const labels = titles.split('|');
 return cells.split('|').map((token, rank) => ({ rank, title: labels[rank] || '', effects: cell(token) }));
};

const CAREER_DATA = [
 {
  "id": "companion.truther",
  "page": 36,
  "personal": "INT+1|EDU+1|FOL+1|Admin|Carouse|Persuade",
  "service": "Investigate|Art (writing)|Language|Electronics (computers)|Diplomat|Persuade",
  "advanced": null,
  "assignments": {
   "truther": "Profession|Science / Medic|Science|Investigate|Science|Science"
  },
  "cash": [
   1000,
   2000,
   5000,
   10000,
   25000,
   50000,
   100000
  ],
  "material": "INT+1|#Minor Following|#Patronage|SOC+1|#Major Following|#TAS Membership|#Ship Share:3",
  "noRank": true
 },
 {
  "id": "companion.believer",
  "page": 38,
  "personal": "INT+1|EDU+1|SOC+1|Science (belief)|Profession (religion)|Persuade",
  "service": "Profession (religion)|Science (belief)|Admin|Electronics (computers)|Diplomat|Persuade",
  "advanced": "Profession (religion)|Science|Medic|Investigate|Electronics (computers)|Advocate",
  "assignments": {
   "mainstream": "Profession|Profession (religion)|Science (belief)|Drive|Persuade|Admin",
   "missionary": "Jack-of-all-Trades|Medic|Persuade|Diplomat|Carouse|Leadership",
   "warrior": "Gun Combat|Melee|Explosives|Heavy Weapons|Tactics (military)|Athletics"
  },
  "cash": [
   0,
   1000,
   2500,
   5000,
   10000,
   25000,
   50000
  ],
  "material": "#Spiritual assurance|#Spiritual reward|INT+1|SOC+1|#Statue & SOC+1|#Ship Share:3|#Sainthood candidacy",
  "basic": "assignment"
 },
 {
  "id": "aslan.envoy",
  "page": 24,
  "personal": "DEX+1|END+1|male:Independence;EDU+1|INT+1|Melee (natural)|STR+1",
  "service": "Admin|Carouse|Drive|Electronics|Melee (natural)|Survival",
  "advanced": "Broker|Diplomat|Flyer|Leadership|Medic|Tolerance",
  "assignments": {
   "duellist": "Art|Athletics|Leadership|Melee|Melee (natural)|Tactics (military)",
   "negotiator": "Advocate|Art|Deception|Diplomat|Language|Persuade",
   "spy": "Deception|Investigate|Persuade|Recon|Stealth|Streetwise"
  },
  "cash": [
   0,
   0,
   0,
   5000,
   5000,
   10000,
   20000
  ],
  "material": "@Contact|@Contact / #Clan Share|INT+1|EDU+2|Independence / #Clan Share:2|#Weapon|#Clan Share:3"
 },
 {
  "id": "aslan.guardian",
  "page": 26,
  "personal": "Athletics|DEX+1|DEX+1|male:Independence;EDU+1|INT+1|SOC+1",
  "service": "Carouse|Diplomat|Drive|Electronics|Melee (natural)|Survival",
  "advanced": "Admin|Advocate|Art|Language|Science|Tolerance",
  "assignments": {
   "agent": "Deception|Gun Combat|Investigate|Melee|Stealth|Streetwise",
   "poet": "Art|Art|Carouse|Deception|Leadership|Persuade",
   "priest": "Admin|Advocate|Diplomat|Persuade|Persuade|Tolerance"
  },
  "cash": [
   0,
   0,
   0,
   5000,
   5000,
   10000,
   20000
  ],
  "material": "#Clan Share|@Contact / #Clan Share|#Ceremonial Kinship|EDU+1|SOC+1|#Land Parcel:2 / #Clan Share:4|SOC+2 / #Clan Share:4"
 },
 {
  "id": "aslan.manager",
  "page": 28,
  "personal": "DEX+1|END+1|INT+1|Melee (natural)|STR+1|Tolerance",
  "service": "Admin|Broker|Drive|Electronics|Profession|Streetwise",
  "advanced": "Art|Animals|Medic|Language|Science|Survival",
  "assignments": {
   "aide": "Admin|Advocate|Deception|Persuade|Steward|Tolerance",
   "corporate": "Admin|Advocate|Broker|Diplomat|Electronics|Profession",
   "governess": "Art|Diplomat|Gun Combat|Melee|Persuade|Steward"
  },
  "cash": [
   5000,
   5000,
   10000,
   20000,
   20000,
   40000,
   100000
  ],
  "material": "#Ship Share:2 / #Clan Share|INT+1|EDU+2|#Ship Share:4 / #Clan Share:2|#Gun|#Land Parcel:2 / #Clan Share:4|#Ship Share:10 / #Clan Share:5"
 },
 {
  "id": "aslan.military",
  "page": 30,
  "personal": "DEX+1|END+1|Gun Combat|Independence / Electronics|Melee (natural)|STR+1",
  "service": "Athletics|Carouse|Gun Combat|Melee|Navigation|Survival",
  "advanced": "Art|Diplomat|Electronics|Medic|Leadership / Heavy Weapons|Vacc Suit",
  "assignments": {
   "cavalry": "Tactics (military)|Heavy Weapons (vehicle)|Drive|Gun Combat|Drive / Flyer|Recon|Electronics|Mechanic|Heavy Weapons (artillery)",
   "flyer": "Tactics (military)|Gunner (turret)|Heavy Weapons (vehicle)|Vacc Suit|Electronics (sensors)|Flyer|Mechanic|Electronics|Engineer (power)",
   "support": "Flyer / Pilot (small craft)|Drive|Medic|Gun Combat|Mechanic|Navigation|Admin|Electronics|Flyer / Pilot (small craft)",
   "warrior": "Tactics (military)|Heavy Weapons (portable)|Gun Combat|Recon|Melee|Vacc Suit|Explosives|Medic|Heavy Weapons (artillery)"
  },
  "cash": [
   500,
   500,
   1000,
   1000,
   5000,
   5000,
   10000,
   10000
  ],
  "material": "#Clan Share|END+1|EDU+1|#Weapon|#Secret School|#Clan Share:2|SOC+1|#Clan Share:3"
 },
 {
  "id": "aslan.military-officer",
  "page": 32,
  "personal": "Athletics|DEX+1|END+1|male:Independence;Admin|INT+1|STR+1",
  "service": "Athletics|Carouse|Drive / Flyer|Gun Combat|Melee (natural)|Vacc Suit",
  "advanced": "Advocate|Animals|Art|Diplomat|Explosives|Tolerance",
  "assignments": {
   "assassin": "Deception|Investigate|Melee|Recon|Stealth|Streetwise",
   "executive": "Admin|Advocate|Diplomat|Electronics|Medic|Navigation",
   "leader": "Art|Gun Combat|Leadership|Melee (natural)|Recon|Tactics (military)"
  },
  "cash": [
   1000,
   5000,
   5000,
   10000,
   20000,
   50000,
   50000,
   50000
  ],
  "material": "#Clan Share:2|INT+1|EDU+2|#Secret School|#Clan Share:3 / #Secret School|#Armour|SOC+2|#Clan Share:5"
 },
 {
  "id": "aslan.scientist",
  "page": 34,
  "personal": "EDU+1|male:Independence;Tolerance|INT+1|Melee (natural)|SOC+1|Jack-of-all-Trades",
  "service": "Admin|Carouse|Drive|Electronics|Investigate|Science",
  "advanced": "Advocate|Art|Diplomat|Engineer|Language|Mechanic",
  "assignments": {
   "explorer": "Drive / Flyer|Navigation|Recon|Science|Survival|Vacc Suit",
   "healer": "Electronics|Investigate|Medic|Medic|Persuade|Science",
   "researcher": "Admin|Electronics|Engineer|Investigate|Science|Science"
  },
  "cash": [
   1000,
   5000,
   5000,
   10000,
   20000,
   40000,
   70000,
   100000
  ],
  "material": "#Scientific Equipment|EDU+1|INT+1|#Weapon / #Clan Share|#Scientific Kinship|SOC+1 & #Clan Share|#Scientific Equipment & #Clan Share:2|#Clan Share:3"
 },
 {
  "id": "aslan.spacer",
  "page": 36,
  "personal": "DEX+1|END+1|male:Independence;Broker|INT+1|Tolerance|Vacc Suit",
  "service": "Admin|Athletics|Electronics|Flyer|Gunner|Mechanic",
  "advanced": "Astrogation|Broker|Electronics|Leadership|Medic|Tactics (naval)",
  "assignments": {
   "crew": "Athletics|Electronics|Gun Combat|Mechanic|Melee|Vacc Suit",
   "engineer": "Electronics|Engineer|Engineer|Flyer|Mechanic|Vacc Suit",
   "gunner": "Athletics|Electronics|Gunner|Gunner|Tactics (naval)|Vacc Suit",
   "pilot": "Athletics|Gunner|Pilot|Pilot|Tactics (naval)|Vacc Suit"
  },
  "cash": [
   500,
   1000,
   1000,
   5000,
   5000,
   10000,
   20000,
   30000
  ],
  "material": "#Clan Share|INT+1|EDU+1|#Weapon|#Clan Share:2|#Brotherhood of Stars|SOC+1|#Clan Share:3"
 },
 {
  "id": "aslan.space-officer",
  "page": 38,
  "personal": "Diplomat|END+1|INT+1|Melee|SOC+1|Tolerance",
  "service": "Admin|Art|Electronics|Gunner|Flyer|Vacc Suit",
  "advanced": "Advocate|Electronics|Engineer|Leadership|Medic|Science",
  "assignments": {
   "commander": "Art|Diplomat|Gunner|Leadership|Pilot|Tactics (naval)",
   "navigator": "Astrogation|Astrogation|Engineer|Engineer (j-drive)|Electronics|Pilot",
   "shipmaster": "Admin|Broker|Diplomat|Electronics|Engineer|Tolerance"
  },
  "cash": [
   1000,
   5000,
   5000,
   10000,
   20000,
   50000,
   50000,
   50000
  ],
  "material": "#Clan Share:2|INT+1|EDU+2|male:Independence;Tolerance|#Clan Share:2|#Brotherhood of Stars|SOC+2|#Clan Share:5"
 },
 {
  "id": "aslan.outcast",
  "page": 40,
  "personal": "END+1|Gambler|male:Independence;Melee|Jack-of-all-Trades|Language|STR+1",
  "service": "Deception|Melee|Profession|Streetwise|Survival|Tolerance",
  "advanced": null,
  "assignments": {
   "labourer": "Animals|Athletics|Drive|Profession|Profession|Survival",
   "scavenger": "Drive / Flyer|Engineer|Gun Combat|male:Independence;Electronics|Mechanic|Vacc Suit",
   "trader": "Admin|Advocate|Broker|Deception|Electronics|Persuade"
  },
  "cash": [
   0,
   500,
   500,
   1000,
   1000,
   5000,
   10000
  ],
  "material": "INT+1|EDU+1|#Weapon|Independence / Streetwise|@Contact|END+1|END+1 & EDU+1"
 },
 {
  "id": "aslan.outlaw",
  "page": 42,
  "personal": "DEX+1|END+1|INT+1|Gambler|Jack-of-all-Trades|STR+1",
  "service": "Carouse|Gun Combat|Melee|Recon|Streetwise|Tolerance",
  "advanced": null,
  "assignments": {
   "pirate": "Athletics|Gunner|Mechanic|Melee|Pilot|Vacc Suit",
   "raider": "Drive / Flyer|Gun Combat|Heavy Weapons|Melee|Recon|Stealth",
   "thief": "Broker|Deception|Electronics|Mechanic|Persuade|Stealth"
  },
  "cash": [
   5000,
   10000,
   20000,
   25000,
   50000,
   100000,
   0
  ],
  "material": "@Contact|INT+1|male:Independence;Streetwise|#Weapon|INT+1 & male:Independence;Streetwise|EDU+1 & male:Independence;Streetwise|#Ship Share:5"
 },
 {
  "id": "aslan.wanderer",
  "page": 44,
  "personal": "DEX+1|END+1|INT+1|Gambler|Jack-of-all-Trades|STR+1",
  "service": "Carouse|Gun Combat|Melee|Recon|Streetwise|Tolerance",
  "advanced": null,
  "assignments": {
   "belter": "Athletics|Gunner|Mechanic|Melee|Pilot|Vacc Suit",
   "nomad": "Drive / Flyer|Gun Combat|Heavy Weapons|Melee|Recon|Stealth",
   "scout": "Broker|Deception|Electronics|Mechanic|Persuade|Stealth"
  },
  "cash": [
   0,
   0,
   0,
   2000,
   5000,
   10000,
   20000
  ],
  "material": "#Clan Share|INT+1|EDU+2|Independence|Tolerance|#Scout Ship|#Clan Share:2 & SOC+1"
 },
 {
  "id": "vargr.agent",
  "page": 188,
  "personal": "Athletics|DEX+1|END+1|Gun Combat|INT+1|Melee",
  "service": "Drive|Flyer|Gun Combat|Investigate|Recon|Streetwise",
  "advanced": "Advocate|Electronics|Explosives|Language|Medic|Vacc Suit",
  "assignments": {
   "enforcer": "Athletics|Gun Combat|Melee|Persuade|STR+1|Streetwise",
   "investigator": "Deception|Electronics|Investigate|Persuade|Recon|Stealth",
   "spy": "Carouse|Deception|Investigate|Persuade|Recon|Stealth"
  },
  "cash": [
   1000,
   2000,
   5000,
   7500,
   10000,
   25000,
   50000
  ],
  "material": "@Contact|INT+1|#Blade|#Weapon|#Armour|CHA+1|@Ally"
 },
 {
  "id": "vargr.citizen",
  "page": 190,
  "personal": "Drive|EDU+1|Electronics|Gambler|INT+1|Melee",
  "service": "Admin|Drive|Flyer|Profession|Steward|Streetwise",
  "advanced": "Advocate|Art|Diplomat|Electronics|Language|Science",
  "assignments": {
   "corporate": "Admin|Advocate|Broker|Diplomat|Electronics|Leadership",
   "settler": "Animals|Athletics|Drive / Flyer|Jack-of-all-Trades|Recon|Survival",
   "worker": "Drive|Electronics|Engineer|Mechanic|Profession|Science"
  },
  "cash": [
   1000,
   5000,
   10000,
   10000,
   25000,
   50000,
   75000
  ],
  "material": "@Contact|#Ship Share|INT+1|EDU+1|@Ally|CHA+1|#Ship Share:2"
 },
 {
  "id": "vargr.intermediary",
  "page": 192,
  "personal": "Carouse|CHA+1|CHA+1|EDU+1|INT+1|Melee",
  "service": "Admin|Carouse|Deception|Electronics|Gambler|Streetwise",
  "advanced": "Advocate|Art|Language|Leadership|Medic|Science",
  "assignments": {
   "arbitrator": "Admin|Advocate|Broker|Deception|Investigate|Persuade",
   "diplomat": "Carouse|Diplomat|Diplomat|Language|Persuade|Steward",
   "emissary": "Carouse|Deception|Diplomat|Investigate|Melee|Persuade"
  },
  "cash": [
   5000,
   5000,
   10000,
   10000,
   25000,
   25000,
   50000
  ],
  "material": "INT+1|EDU+1|#Ship Share|@Contact|CHA+1|#Courier|#Courier"
 },
 {
  "id": "vargr.loner",
  "page": 194,
  "personal": "DEX+1|END+1|INT+1|Jack-of-all-Trades|Melee|Vacc Suit",
  "service": "Athletics|Carouse|Drive|Gun Combat|Melee|Streetwise",
  "advanced": null,
  "assignments": {
   "prospector": "Astrogation|Electronics|Engineer|Pilot|Profession (belter)|Vacc Suit",
   "scrounger": "Admin|Broker|Deception|Mechanic|Persuade|Survival",
   "wanderer": "Deception|Drive / Flyer|Melee|Navigation|Persuade|Survival"
  },
  "cash": [
   1000,
   2000,
   5000,
   7500,
   10000,
   20000,
   30000
  ],
  "material": "#Weapon|END+1|INT+1|#Ship Share|#Weapon|CHA+1|#Ship Share:2"
 },
 {
  "id": "vargr.merchant",
  "page": 196,
  "personal": "CHA+1|EDU+1|Gambler|INT+1|Melee|Streetwise",
  "service": "Admin|Carouse|Deception|Electronics|Persuade|Vacc Suit",
  "advanced": "Advocate|Astrogation|Diplomat|Engineer|Language|Medic",
  "assignments": {
   "free": "Broker|Electronics|Gunner|Persuade|Pilot|Vacc Suit",
   "long": "Gunner|Electronics|Engineer|Mechanic|Pilot|Steward",
   "salvager": "Broker|Deception|Electronics|Investigate|Mechanic|Recon"
  },
  "cash": [
   1000,
   2000,
   5000,
   10000,
   20000,
   30000,
   50000
  ],
  "material": "#Ship Share|@Contact|INT+1|EDU+1|CHA+1|#Trader|#Trader"
 },
 {
  "id": "vargr.military",
  "page": 198,
  "personal": "DEX+1|END+1|Gambler|Gun Combat|Melee|STR+1",
  "service": "Athletics|Drive|Gun Combat|Melee|Recon|Survival",
  "advanced": "Leadership|Mechanic|Medic|Navigation|Seafarer|Vacc Suit",
  "assignments": {
   "army": "Gun Combat|Heavy Weapons|Melee|Recon|Stealth|Tactics (military)",
   "militia": "Athletics|Gun Combat|Mechanic|Melee|Stealth|Survival",
   "raider": "Explosives|Gun Combat|Melee|Recon|Tactics (military)|Vacc Suit"
  },
  "cash": [
   1000,
   2000,
   5000,
   10000,
   15000,
   20000,
   25000
  ],
  "material": "STR+1|DEX+1|#Combat Implant / END+1|#Armour|#Weapon|CHA+1|@Ally"
 },
 {
  "id": "vargr.psion",
  "page": 200,
  "personal": "CHA+1|DEX+1|END+1|Melee|PSI+1|STR+1",
  "service": "$talent|Carouse|Drive / Flyer|Electronics|Melee|Profession",
  "advanced": "Animals|Art|Gambler|Language|Medic|Science",
  "assignments": {
   "institute": "Admin|$talent|$talent|$talent|Electronics|Science (psionicology)",
   "mentored": "$talent|$talent|Athletics|Recon|Science (psionicology)|Survival",
   "wild": "$talent|Deception|Jack-of-all-Trades|Profession|Streetwise|Survival"
  },
  "cash": [
   1000,
   2000,
   5000,
   5000,
   10000,
   10000,
   15000
  ],
  "material": "#Weapon|@Contact|END+1|INT+1|@Ally|CHA+1|PSI+1"
 },
 {
  "id": "vargr.scientist",
  "page": 202,
  "personal": "CHA+1|DEX+1|EDU+1|END+1|INT+1|Language",
  "service": "Admin|Drive|Electronics|Flyer|Profession|Science",
  "advanced": "Advocate|Animals|Art|Astrogation|Engineer|Diplomat",
  "assignments": {
   "physician": "Electronics|Investigate|Medic|Medic|Persuade|Science",
   "researcher": "Admin|Electronics|Investigate|Investigate|Science|Science",
   "technician": "Electronics|Electronics|Engineer|Investigate|Mechanic|Profession"
  },
  "cash": [
   5000,
   10000,
   20000,
   30000,
   50000,
   75000,
   100000
  ],
  "material": "#Scientific Equipment|@Contact|INT+1|EDU+1|CHA+1|#Lab Ship|#Lab Ship"
 },
 {
  "id": "vargr.spacer",
  "page": 204,
  "personal": "CHA+1|Carouse|DEX+1|Gambler|INT+1|Melee",
  "service": "Athletics|Electronics|Gunner|Mechanic|Melee|Vacc Suit",
  "advanced": "Astrogation|Broker|Engineer|Language|Medic|Pilot",
  "assignments": {
   "corsair": "Explosives|Gun Combat|Gunner|Leadership|Tactics|Vacc Suit",
   "explorer": "Engineer|Flyer|Navigation|Pilot|Recon|Survival",
   "navy": "Admin|Electronics|Gun Combat|Gunner|Pilot|Tactics (naval)"
  },
  "cash": [
   1000,
   2000,
   5000,
   7500,
   10000,
   25000,
   50000
  ],
  "material": "#Blade|#Armour|#Weapon|@Ally|CHA+1|$assignment-ship|$assignment-ship"
 },
 {
  "id": "zhodani.agent",
  "page": 258,
  "personal": "Athletics|DEX+1|END+1|Gun Combat|INT+1|Melee",
  "service": "Admin|Drive|Electronics|Gun Combat|Investigate|Recon",
  "advanced": "Advocate|Art|Diplomat|Electronics|Medic|Science",
  "assignments": {
   "informant": "Admin|Athletics|Carouse|Investigate|Persuade|Streetwise",
   "tavrchedl": "Advocate|Investigate|Melee|Persuade|Recon|Stealth",
   "tozjabr": "Electronics|Deception|Language|Persuade|Recon|Streetwise"
  },
  "cash": [
   1000,
   2000,
   5000,
   7500,
   10000,
   25000,
   50000
  ],
  "material": "#Weapon|#Armour|#Ship Share|EDU+1|INT+1|$nenj-or-shares|SOC+1",
  "advancedMin": 10,
  "psionic": "Clairvoyance|Persuade|PSI+1|Science (psionicology) / Science (psychology)|$talent|Telepathy"
 },
 {
  "id": "zhodani.army",
  "page": 260,
  "personal": "Athletics|Carouse|DEX+1|END+1|STR+1|Melee",
  "service": "Electronics|Gun Combat|Heavy Weapons|Medic|Melee|Vacc Suit",
  "advanced": "Electronics|Engineer|Explosives|Flyer|Navigation|Survival",
  "assignments": {
   "cavalry": "Drive|Electronics|Flyer|Gunner|Mechanic|Recon",
   "infantry": "Athletics|Gun Combat|Heavy Weapons|Melee|Recon|Stealth",
   "support": "Drive|Electronics|Explosives|Flyer|Mechanic|Medic"
  },
  "cash": [
   2000,
   5000,
   10000,
   10000,
   10000,
   20000,
   30000
  ],
  "material": "#Weapon|#Armour|EDU+1|END+1|INT+1|#Nenj|SOC+1",
  "officer": "Admin|Advocate|Diplomat|Leadership|Electronics|Tactics (military)",
  "psionic": "Awareness|Persuade|PSI+1|Science (psionicology) / Science (psychology)|$talent|Telekinesis"
 },
 {
  "id": "zhodani.entertainer",
  "page": 262,
  "personal": "DEX+1|EDU+1|END+1|INT+1|Jack-of-all-Trades|SOC+1",
  "service": "Art|Carouse|Diplomat|Drive|Persuade|Profession",
  "advanced": "Advocate|Electronics|Flyer|Language|Science|Steward",
  "assignments": {
   "artist": "Art (holography) / Art (sculpting)|Art (holography) / Art (sculpting)|Carouse|Electronics|Persuade|Profession",
   "author": "Admin|Art (writing)|Art (writing)|Electronics|Language|Science",
   "performer": "Art (acting) / Art (dance) / Art (instrument)|Art (acting) / Art (dance) / Art (instrument)|Athletics|Athletics|Carouse|Leadership"
  },
  "cash": [
   2000,
   5000,
   10000,
   10000,
   40000,
   40000,
   80000
  ],
  "material": "@Contact|#Ship Share:2|@Ally|INT+1|EDU+1|#Nenj|SOC+1",
  "psionic": "Clairvoyance|Persuade|PSI+1|Science (psionicology) / Science (psychology)|$talent|Telepathy"
 },
 {
  "id": "zhodani.government",
  "page": 264,
  "personal": "Athletics|Carouse|DEX+1|EDU+1|INT+1|SOC+1",
  "service": "Admin|Drive|Electronics|Investigate|Persuade|Steward",
  "advanced": "Art|Language|Leadership|Melee|Recon|Science",
  "assignments": {
   "administration": "Admin|Advocate|Broker|Diplomat|Electronics|Profession",
   "diplomat": "Advocate|Broker|Carouse|Diplomat|Language|Persuade"
  },
  "cash": [
   10000,
   10000,
   50000,
   50000,
   100000,
   100000,
   200000
  ],
  "material": "#Weapon|#Ship Share|#Ship Share:2|SOC+1|#Nenj|#Courier|SOC+1 & #Courier",
  "advancedMin": 10,
  "psionic": "Clairvoyance|Persuade|PSI+1|Science (psionicology) / Science (psychology)|$talent|$talent"
 },
 {
  "id": "zhodani.guard",
  "page": 266,
  "personal": "Athletics|Carouse|DEX+1|END+1|Melee|STR+1",
  "service": "Athletics|Gun Combat|Melee|Recon|Stealth|Survival",
  "advanced": "Advocate|Art|Electronics|Leadership|Medic|Tactics (military)",
  "assignments": {
   "commando": "Explosives|Gun Combat|Melee|Navigation|$talent|Vacc Suit",
   "ground": "Explosives|Flyer|Gun Combat|Gunner|Heavy Weapons|Vacc Suit",
   "support": "Electronics|Engineer (power)|Flyer|Gun Combat|Mechanic|Medic"
  },
  "cash": [
   2000,
   5000,
   5000,
   10000,
   20000,
   30000,
   40000
  ],
  "material": "#Weapon|#Armour|EDU+1|END+1|INT+1|#Nenj|SOC+1",
  "advancedMin": 10,
  "psionic": "PSI+1|Awareness|Science (psionicology) / Science (psychology)|$talent|$talent|Teleportation"
 },
 {
  "id": "zhodani.merchant",
  "page": 268,
  "personal": "Athletics|Carouse|END+1|INT+1|Melee|STR+1",
  "service": "Admin|Electronics|Drive / Flyer|Persuade|Steward|Vacc Suit",
  "advanced": "Advocate|Astrogation|Broker|Engineer|Language|Medic",
  "assignments": {
   "broker": "Admin|Advocate|Broker|Diplomat|Investigate|Persuade",
   "corporate": "Engineer|Language|Mechanic|Medic|Profession|Steward",
   "free": "Electronics|Engineer|Gunner|Mechanic|Pilot|Vacc Suit"
  },
  "cash": [
   1000,
   5000,
   10000,
   20000,
   20000,
   40000,
   40000
  ],
  "material": "#Weapon|#Ship Share|#Ship Share:2|EDU+1|INT+1|#Trader|SOC+1 / #Trader",
  "psionic": "Clairvoyance|Persuade|PSI+1|Science (psionicology) / Science (psychology)|$talent|Telepathy"
 },
 {
  "id": "zhodani.navy",
  "page": 270,
  "personal": "Athletics|Carouse|DEX+1|END+1|INT+1|STR+1",
  "service": "Admin|Athletics|Electronics|Gun Combat|Gunner|Vacc Suit",
  "advanced": "Advocate|Astrogation|Engineer|Medic|Pilot|Science",
  "assignments": {
   "crew": "Admin|Electronics|Mechanic|Melee|Steward|Vacc Suit",
   "flight": "Astrogation|Flyer|Gunner|Pilot|Recon|Vacc Suit",
   "technical": "Electronics|Engineer|Investigate|Mechanic|Medic|Profession"
  },
  "cash": [
   1000,
   5000,
   5000,
   10000,
   20000,
   50000,
   50000
  ],
  "material": "#Weapon|#Ship Share|#Ship Share:2|EDU+1|INT+1|#Nenj|SOC+1",
  "officer": "Art|Diplomat|Leadership|Melee (blade)|Tactics (naval)|$talent",
  "psionic": "Awareness|Persuade|PSI+1|Science (psionicology) / Science (psychology)|$talent|Telepathy"
 },
 {
  "id": "zhodani.prole",
  "page": 272,
  "personal": "Carouse|EDU+1|INT+1|Jack-of-all-Trades|Persuade|STR+1",
  "service": "Admin|Drive|Electronics|Flyer|Profession|Profession",
  "advanced": "Art|Broker|Diplomat|Engineer|Gun Combat / Melee|Medic",
  "assignments": {
   "colonist": "Animals|Gun Combat|Mechanic|Navigation|Recon|Survival",
   "corporate": "Admin|Admin|Advocate|Electronics|Profession|Steward",
   "worker": "Admin|Athletics|Drive / Flyer|Electronics|Mechanic|Profession"
  },
  "cash": [
   1000,
   5000,
   10000,
   20000,
   30000,
   50000,
   100000
  ],
  "material": "#Weapon|#Ship Share|#Ship Share:2|EDU+1|INT+1|#Nenj|SOC+1@9",
  "basic": "assignment",
  "advancedMin": 6
 },
 {
  "id": "zhodani.scholar",
  "page": 274,
  "personal": "Carouse|DEX+1|EDU+1|END+1|INT+1|SOC+1",
  "service": "Admin|Diplomat|Drive / Flyer|Electronics|Investigate|Science",
  "advanced": "Advocate|Art|Engineer|Language|Medic|Science",
  "assignments": {
   "field": "Athletics|Electronics|Navigation|Recon|Science (psionicology) / Science (psychology)|Survival",
   "lab": "Admin|Electronics|Engineer|Investigate|Science|Science",
   "physician": "Electronics|Investigate|Medic|Medic|Persuade|Science (psionicology) / Science (psychology)"
  },
  "cash": [
   5000,
   10000,
   20000,
   30000,
   40000,
   60000,
   100000
  ],
  "material": "#Scientific Equipment|#Ship Share:2|EDU+1|INT+1|#Nenj|#Scout|SOC+1 & #Scout",
  "advancedMin": 10,
  "psionic": "PSI+1|Awareness|Clairvoyance|$talent|Telekinesis|Telepathy"
 }
];
const RANK_DATA = {
 "companion.believer": {
  "mainstream": {
   "cells": "-|Science (belief)|Persuade|-|SOC+1|-|SOC+1",
   "titles": "Lay person|Initiate|Lay preacher|Priest|Senior priest|Bishop|Archbishop"
  },
  "missionary": {
   "cells": "-|Jack-of-all-Trades|Leadership|-|Admin|-|SOC+1",
   "titles": "Junior project worker|Project worker|Team leader|Project leader|Project coordinator|Department director|Director"
  },
  "warrior": {
   "cells": "-|Gun Combat|Leadership|-|Tactics (military)|-|-",
   "titles": "Hopeful|Fighter|Combat leader|Force commander|Area commander|Movement sub-leader|Movement leader"
  }
 },
 "aslan.envoy": {
  "default": {
   "cells": "-|Tolerance=1|-|Diplomat=1|-|Carouse=1|SOC+1",
   "titles": "|Junior Envoy|Envoy|Senior Envoy|Respected Envoy|Honoured Envoy|Voice of the Clan"
  }
 },
 "aslan.guardian": {
  "agent": {
   "cells": "-|Investigate=1|-|-|Streetwise=1|-|Admin=1",
   "titles": "Probationary Agent|Agent|||Field Agent||Master Agent"
  },
  "poet": {
   "cells": "-|-|SOC+1|-|SOC+1|-|EDU+1",
   "titles": "Supplicant|Acolyte|Initiate|Sojourner|Practitioner|Master|Grand Master"
  },
  "priest": {
   "cells": "-|-|SOC+1|-|SOC+1|-|EDU+1",
   "titles": "Supplicant|Acolyte|Initiate|Sojourner|Practitioner|Master|Grand Master"
  }
 },
 "aslan.manager": {
  "default": {
   "cells": "-|Admin=1|-|Tolerance=1|-|-|SOC+1",
   "titles": ""
  }
 },
 "aslan.military": {
  "warrior": {
   "cells": "-|Gun Combat=1|-|END+1|-|-|#Clan Share:3",
   "titles": "Recruit|Soldier|Veteran Soldier|Warrior|Veteran Warrior|Leader of Warriors|Honoured Warrior Leader"
  },
  "flyer": {
   "cells": "-|Gun Combat=1|-|END+1|-|-|#Clan Share:3",
   "titles": "Recruit|Soldier|Veteran Soldier|Warrior|Veteran Warrior|Leader of Warriors|Honoured Warrior Leader"
  },
  "cavalry": {
   "cells": "-|Gun Combat=1|-|END+1|-|-|#Clan Share:3",
   "titles": "Recruit|Soldier|Veteran Soldier|Warrior|Veteran Warrior|Leader of Warriors|Honoured Warrior Leader"
  },
  "support": {
   "cells": "-|Mechanic=1|-|EDU+1|-|-|#Clan Share:2",
   "titles": "Recruit-Technician|Soldier-Technician|Blooded Soldier-Technician|Warsister|Veteran Warsister|Master Technician|Honoured Master Technician"
  }
 },
 "aslan.military-officer": {
  "assassin": {
   "cells": "-|Stealth=1|-|Melee (natural)=1|-|-|#Clan Share:2",
   "titles": "|Hunter|||Veteran Hunter||Claw of the Clan"
  },
  "executive": {
   "cells": "-|Electronics=1|-|Admin=1|-|-|#Clan Share:2",
   "titles": "Probationary Lieutenant|Junior Lieutenant|Lieutenant|Captain|Executive|Division Chief of Staff|Chief of Staff"
  },
  "leader": {
   "cells": "-|Vacc Suit=1|-|Leadership=1|-|-|SOC+2",
   "titles": "Probationary Lieutenant|Junior Lieutenant|Lieutenant|Captain|Commandant|Division General|General"
  }
 },
 "aslan.scientist": {
  "default": {
   "cells": "-|Electronics (computers)=1|-|Admin=1|-|-|SOC+1",
   "titles": "|Scholar||Respected Scholar|||Revered Scholar"
  }
 },
 "aslan.spacer": {
  "pilot": {
   "cells": "-|Vacc Suit=1|-|EDU+1|-|-|#Clan Share:3",
   "titles": "Raw Recruit|Recruit|Spacehand|Veteran Spacehand|Honoured Spacehand|Petty Officer|Veteran Petty Officer"
  },
  "gunner": {
   "cells": "-|Vacc Suit=1|-|EDU+1|-|-|#Clan Share:3",
   "titles": "Raw Recruit|Recruit|Spacehand|Veteran Spacehand|Honoured Spacehand|Petty Officer|Veteran Petty Officer"
  },
  "engineer": {
   "cells": "-|Mechanic=1|-|EDU+1|-|-|#Clan Share:2",
   "titles": "Raw Recruit|Recruit|Spacehand|Veteran Spacehand|Honoured Spacehand|Petty Officer|Veteran Petty Officer"
  },
  "crew": {
   "cells": "-|Mechanic=1|-|EDU+1|-|-|#Clan Share:2",
   "titles": "Raw Recruit|Recruit|Spacehand|Veteran Spacehand|Honoured Spacehand|Petty Officer|Veteran Petty Officer"
  }
 },
 "aslan.space-officer": {
  "commander": {
   "cells": "-|Leadership=1|-|-|Tactics (naval)=1|-|SOC+2",
   "titles": "Probationary Intendant|Intendant|Lieutenant|Senior Lieutenant|Commandant|Captain|Admiral"
  }
 },
 "aslan.outcast": {
  "default": {
   "cells": "-|male:Independence=1;Tolerance=1|-|Streetwise=1|-|-|-",
   "titles": "Outcast|||Survivor|||"
  }
 },
 "aslan.outlaw": {
  "default": {
   "cells": "-|Melee (natural)=1|-|male:Independence=1;Streetwise=1|-|-|Leadership=1",
   "titles": "Outlaw|||Feared Outlaw|||Outlaw Chief"
  }
 },
 "aslan.wanderer": {
  "default": {
   "cells": "-|Mechanic|-|Engineer|-|-|@Contact",
   "titles": ""
  }
 },
 "vargr.agent": {
  "enforcer": {
   "cells": "-|Melee=1|Gun Combat=1|-|Streetwise=1|-|-",
   "titles": ""
  },
  "investigator": {
   "cells": "-|Investigate=1|-|Streetwise=1|-|Stealth=1|-",
   "titles": ""
  },
  "spy": {
   "cells": "-|Recon=1|-|Stealth=1|-|Melee=1|-",
   "titles": ""
  }
 },
 "vargr.citizen": {
  "corporate": {
   "cells": "-|-|Admin=1|-|Advocate=1|-|CHA+1",
   "titles": ""
  },
  "settler": {
   "cells": "-|Gun Combat=1|-|Survival=1|-|Animals=1|-",
   "titles": ""
  },
  "worker": {
   "cells": "Profession=1|-|-|Engineer=1 / Mechanic=1|-|Science=1|-",
   "titles": ""
  }
 },
 "vargr.intermediary": {
  "arbitrator": {
   "cells": "-|Advocate=1|-|Broker=1|-|-|CHA+1",
   "titles": ""
  },
  "diplomat": {
   "cells": "-|Language=1|-|Diplomat=1|-|-|CHA+1",
   "titles": ""
  },
  "emissary": {
   "cells": "-|Carouse=1|-|Persuade=1|-|-|CHA+1",
   "titles": ""
  }
 },
 "vargr.loner": {
  "prospector": {
   "cells": "-|Vacc Suit=1|-|-|-|-|-",
   "titles": ""
  },
  "scrounger": {
   "cells": "-|Broker=1|-|-|-|-|-",
   "titles": ""
  },
  "wanderer": {
   "cells": "-|Persuade=1|-|-|-|-|-",
   "titles": ""
  }
 },
 "vargr.merchant": {
  "free": {
   "cells": "-|-|Persuade=1|-|Jack-of-all-Trades=1|-|-",
   "titles": ""
  },
  "long": {
   "cells": "-|-|Electronics=1|-|CHA+1|-|-",
   "titles": ""
  },
  "salvager": {
   "cells": "-|-|Mechanic=1|-|Broker=1|-|-",
   "titles": ""
  }
 },
 "vargr.military": {
  "army": {
   "cells": "-|Gun Combat=1|Tactics (military)=1|-|-|Leadership=1|-",
   "titles": ""
  },
  "militia": {
   "cells": "-|Gun Combat=1|Survival=1|-|-|Leadership=1|-",
   "titles": ""
  },
  "raider": {
   "cells": "-|Gun Combat=1|Vacc Suit=1|-|-|Leadership=1|-",
   "titles": ""
  }
 },
 "vargr.psion": {
  "institute": {
   "cells": "-|Science (psionicology)=1|-|$talent=1|-|-|$talent=1",
   "titles": ""
  },
  "mentored": {
   "cells": "-|$talent=1|-|$talent=1|-|-|$talent",
   "titles": ""
  },
  "wild": {
   "cells": "-|Survival=1|Deception=1|-|Streetwise=1|-|-",
   "titles": ""
  }
 },
 "vargr.scientist": {
  "physician": {
   "cells": "-|Medic=1|-|Science=1|-|Electronics=1|-",
   "titles": ""
  },
  "researcher": {
   "cells": "-|Investigate=1|-|Science=1|-|Electronics=1|-",
   "titles": ""
  },
  "technician": {
   "cells": "-|Electronics=1|-|Engineer=1|-|Science=1|-",
   "titles": ""
  }
 },
 "vargr.spacer": {
  "corsair": {
   "cells": "-|Vacc Suit=1|-|-|Gunner=1|-|Leadership=1",
   "titles": ""
  },
  "explorer": {
   "cells": "-|Vacc Suit=1|-|Survival=1|Jack-of-all-Trades=1|-|Astrogation=1",
   "titles": ""
  },
  "navy": {
   "cells": "-|Vacc Suit=1|-|Engineer=1 / Pilot=1|-|-|Leadership=1",
   "titles": ""
  }
 },
 "zhodani.agent": {
  "informant": {
   "cells": "-|Persuade=1|-|Investigate=1|-|Streetwise=1|-",
   "titles": "Observer|Servant of 20|Servant of 50|Servant of 100|Servant of 500|Servant of 1,000|Servant of 5,000"
  },
  "tavrchedl": {
   "cells": "-|Persuade=1|-|-|Investigate=1|Admin=1|SOC+1",
   "titles": "Observer|Guardian of 20|Guardian of 50|Guardian of 100|Guardian of 500|Guardian of 1,000|Guardian of 5,000"
  },
  "tozjabr": {
   "cells": "-|Persuade=1|Investigate=1|-|Gun Combat=1|-|-",
   "titles": "Analyst|Defender of 20|Defender of 50|Defender of 100|Defender of 500|Defender of 1,000|Defender of 5,000"
  }
 },
 "zhodani.army": {
  "enlisted": {
   "cells": "Gun Combat=1|Recon=1|-|Tactics (military)=1|-|-|-",
   "titles": "Trooper|Follower|Leader of 10|Leader of 20|Leader of 50|Leader of 100|Leader of 1,000"
  },
  "officer": {
   "cells": "Gun Combat=1|Leadership=1|-|Tactics (military)=1|-|-|SOC+1",
   "titles": "Waiting Officer|Officer of 20|Officer of 50|Officer of 100|Officer of 500|Officer of 1,000|Officer of 5,000"
  }
 },
 "zhodani.entertainer": {
  "default": {
   "cells": "-|Art=1|-|Investigate=1|-|SOC+1|-",
   "titles": "|Well-known||Renowned||Famous|"
  }
 },
 "zhodani.government": {
  "administration": {
   "cells": "-|Admin=1|-|Advocate=1|-|Leadership=1|SOC+1",
   "titles": "Assistant|Second Secretary|First Secretary|Executive|Consul|World Consul|High Consul"
  },
  "diplomat": {
   "cells": "-|Admin=1|-|Advocate=1|-|Diplomat=1|SOC+1",
   "titles": "Assistant|Second Secretary|First Secretary|Counsellor|Consul|Ambassador|High Consul"
  }
 },
 "zhodani.guard": {
  "default": {
   "cells": "Vacc Suit=1|Leadership=1|-|Tactics (military)=1|-|-|SOC+1",
   "titles": "Subaltern|Specialist/Officer of 20|Specialist/Officer of 50|Specialist/Officer of 100|Specialist/Officer of 500|Officer of 1,000|Officer of 5,000"
  }
 },
 "zhodani.merchant": {
  "broker": {
   "cells": "-|Broker=1|-|Investigate=1|-|Admin=1|-",
   "titles": "Assistant|Broker||Experienced Broker||Senior Broker|"
  },
  "corporate": {
   "cells": "-|Mechanic=1|-|Engineer=1|Pilot=1|-|-",
   "titles": "Deck Hand|Senior Deckhand|Fourth Officer|Third Officer|Second Officer|First Officer|Captain"
  },
  "free": {
   "cells": "-|Mechanic=1|-|Engineer=1|Pilot=1|-|-",
   "titles": "Deck Hand|Senior Deckhand|Fourth Officer|Third Officer|Second Officer|First Officer|Captain"
  }
 },
 "zhodani.navy": {
  "enlisted": {
   "cells": "-|Mechanic=1|Vacc Suit=1|-|END+1|-|-",
   "titles": "Recruit|Trainee|Spacer|Section Leader|Compartment Leader|Deck Leader|Crew Leader"
  },
  "officer": {
   "cells": "-|Melee (blade)=1|Leadership=1|-|Tactics (naval)=1|SOC+1|SOC+1",
   "titles": "Waiting Officer|Watch Officer|Deck Officer|Destroyer Officer|Cruiser Officer|Battleship Officer|Fleet Officer"
  }
 },
 "zhodani.prole": {
  "colonist": {
   "cells": "-|Survival=1|-|Navigation=1|-|-|Leadership=1",
   "titles": "Worker|Assistant Supervisor|Supervisor|Manager|Executive|Senior Executive|Director"
  },
  "corporate": {
   "cells": "-|Admin=1|-|Advocate=1|-|-|SOC+1@9",
   "titles": "Worker|Assistant Supervisor|Supervisor|Manager|Executive|Senior Executive|Director"
  },
  "worker": {
   "cells": "-|Profession=1|-|Mechanic=1|-|-|Jack-of-all-Trades=1",
   "titles": "Worker|Assistant Supervisor|Supervisor|Manager|Executive|Senior Executive|Director"
  }
 },
 "zhodani.scholar": {
  "default": {
   "cells": "-|Science=1|-|Investigate=1|-|Electronics=1|-",
   "titles": ""
  }
 }
};
const PREREQUISITE_DATA = {
 "companion.truther": {
  "qualification": null,
  "noRank": true,
  "initialStats": {
   "FOL": 0
  },
  "benefitModifiers": [
   {
    "condition": {
     "stat": "FOL",
     "min": 10
    },
    "dm": 1
   }
  ]
 },
 "companion.believer": {
  "qualification": null
 },
 "aslan.envoy": {
  "qualification": {
   "stat": "RITE",
   "target": 10
  },
  "qualificationModifiers": [
   {
    "condition": {
     "stat": "EDU",
     "min": 9
    },
    "dm": 2
   }
  ],
  "assignments": {
   "negotiator": {
    "gender": "male"
   }
  }
 },
 "aslan.guardian": {
  "qualification": {
   "stat": "RITE",
   "target": 10
  },
  "qualificationModifiers": [
   {
    "condition": {
     "stat": "EDU",
     "min": 9
    },
    "dm": 2
   }
  ],
  "benefitModifiers": [
   {
    "condition": {
     "stat": "SOC",
     "min": 9
    },
    "dm": 1
   }
  ],
  "assignments": {
   "poet": {
    "gender": "male"
   }
  }
 },
 "aslan.manager": {
  "qualification": {
   "stat": "RITE",
   "target": 8
  },
  "gender": "female",
  "benefitModifiers": [
   {
    "condition": {
     "stat": "SOC",
     "min": 9
    },
    "dm": 1
   }
  ]
 },
 "aslan.military": {
  "qualification": {
   "stat": "RITE",
   "target": 7
  },
  "assignments": {
   "support": {
    "anyOf": [
     {
      "gender": "female"
     },
     {
      "gender": "male",
      "stat": "SOC",
      "max": 8
     }
    ]
   }
  },
  "assignmentTableModifiers": [
   {
    "condition": {
     "gender": "female"
    },
    "dm": 3
   },
   {
    "condition": {
     "gender": "male",
     "stat": "SOC",
     "max": 5
    },
    "dm": 1
   }
  ]
 },
 "aslan.military-officer": {
  "qualification": {
   "stat": "RITE",
   "target": 10
  },
  "benefitModifiers": [
   {
    "condition": {
     "stat": "SOC",
     "min": 9
    },
    "dm": 1
   },
   {
    "condition": {
     "gender": "male"
    },
    "dm": 1
   }
  ],
  "assignments": {
   "assassin": {
    "gender": "male"
   },
   "executive": {
    "gender": "female"
   },
   "leader": {
    "gender": "male"
   }
  }
 },
 "aslan.scientist": {
  "qualification": {
   "stat": "INT",
   "target": 7
  },
  "qualificationByGender": {
   "male": {
    "stat": "INT",
    "target": 10
   },
   "female": {
    "stat": "INT",
    "target": 7
   }
  },
  "benefitModifiers": [
   {
    "condition": {
     "stat": "SOC",
     "min": 9
    },
    "dm": 1
   },
   {
    "condition": {
     "gender": "male"
    },
    "dm": 1,
    "table": "material"
   }
  ],
  "assignments": {
   "explorer": {
    "gender": "female"
   },
   "researcher": {
    "gender": "female"
   }
  },
  "checkOverrides": {
   "healer": {
    "survival": {
     "stat": "END",
     "target": 5
    }
   },
   "researcher": {
    "survival": {
     "stat": "END",
     "target": 6
    }
   }
  }
 },
 "aslan.spacer": {
  "qualification": {
   "stat": "RITE",
   "target": 8
  },
  "benefitModifiers": [
   {
    "condition": {
     "stat": "SOC",
     "min": 9
    },
    "dm": 1
   },
   {
    "condition": {
     "gender": "male"
    },
    "dm": 1
   }
  ],
  "assignments": {
   "engineer": {
    "gender": "female"
   },
   "gunner": {
    "gender": "male"
   },
   "pilot": {
    "gender": "male"
   }
  }
 },
 "aslan.space-officer": {
  "qualification": {
   "stat": "RITE",
   "target": 10
  },
  "benefitModifiers": [
   {
    "condition": {
     "stat": "SOC",
     "min": 9
    },
    "dm": 1
   },
   {
    "condition": {
     "gender": "male"
    },
    "dm": 1
   }
  ],
  "assignments": {
   "commander": {
    "gender": "male"
   },
   "navigator": {
    "gender": "female"
   },
   "shipmaster": {
    "gender": "female"
   }
  }
 },
 "aslan.outcast": {
  "qualification": null
 },
 "aslan.outlaw": {
  "qualification": {
   "stat": "STR",
   "target": 6
  }
 },
 "aslan.wanderer": {
  "qualification": {
   "stat": "RITE",
   "target": 8
  },
  "gender": "male",
  "birthOrder": "second-or-later-son",
  "benefitModifiers": [
   {
    "condition": {
     "stat": "SOC",
     "min": 9
    },
    "dm": 1
   }
  ]
 },
 "vargr.agent": {
  "qualification": {
   "stat": "INT",
   "target": 6
  }
 },
 "vargr.citizen": {
  "qualification": {
   "stat": "EDU",
   "target": 5
  },
  "checkOverrides": {
   "worker": {
    "advancement": {
     "stat": "CHA",
     "target": 6
    }
   }
  }
 },
 "vargr.intermediary": {
  "qualification": {
   "stat": "CHA",
   "target": 10
  }
 },
 "vargr.loner": {
  "qualification": null,
  "maxTerms": 1
 },
 "vargr.merchant": {
  "qualification": {
   "stat": "CHA",
   "target": 6
  }
 },
 "vargr.military": {
  "qualification": {
   "stat": "END",
   "target": 5
  }
 },
 "vargr.psion": {
  "qualification": {
   "stat": "PSI",
   "target": 6
  },
  "requiresPsionicTesting": true
 },
 "vargr.scientist": {
  "qualification": {
   "stat": "INT",
   "target": 8
  }
 },
 "vargr.spacer": {
  "qualification": {
   "stat": "DEX/INT",
   "target": 7
  }
 },
 "zhodani.agent": {
  "qualification": {
   "stat": "INT",
   "target": 6
  },
  "assignments": {
   "informant": {
    "stat": "SOC",
    "max": 9
   },
   "tavrchedl": {
    "allOf": [
     {
      "stat": "SOC",
      "min": 10
     },
     {
      "stat": "PSI",
      "min": 9
     }
    ]
   },
   "tozjabr": {
    "stat": "SOC",
    "min": 10
   }
  }
 },
 "zhodani.army": {
  "qualification": {
   "stat": "END",
   "target": 5
  },
  "qualificationModifiers": [
   {
    "condition": {
     "ageMin": 30
    },
    "dm": -2
   }
  ],
  "commission": {
   "automaticSOCMin": 10,
   "nonDraftedTerm": 1,
   "draftedTerm": 2
  }
 },
 "zhodani.entertainer": {
  "qualification": {
   "stat": "INT",
   "target": 5
  }
 },
 "zhodani.government": {
  "qualification": {
   "stat": "INT",
   "target": 8
  },
  "rankCap": {
   "condition": {
    "stat": "SOC",
    "max": 10
   },
   "maximum": 3
  }
 },
 "zhodani.guard": {
  "qualification": {
   "stat": "END",
   "target": 6
  },
  "allOf": [
   {
    "stat": "SOC",
    "min": 10
   }
  ],
  "assignments": {
   "commando": {
    "stat": "PSI",
    "min": 9
   }
  },
  "qualificationModifiers": [
   {
    "condition": {
     "ageMin": 30
    },
    "dm": -2
   }
  ]
 },
 "zhodani.merchant": {
  "qualification": {
   "stat": "INT",
   "target": 4
  }
 },
 "zhodani.navy": {
  "qualification": {
   "stat": "INT",
   "target": 6
  },
  "qualificationModifiers": [
   {
    "condition": {
     "ageMin": 34
    },
    "dm": -2
   }
  ],
  "commission": {
   "automaticSOCMin": 10,
   "nonDraftedTerm": 1,
   "draftedTerm": 2
  }
 },
 "zhodani.prole": {
  "qualification": {
   "stat": "INT",
   "target": 4
  },
  "allOf": [
   {
    "stat": "SOC",
    "max": 9
   }
  ]
 },
 "zhodani.scholar": {
  "qualification": {
   "stat": "INT",
   "target": 6
  }
 }
};
const CHECK_DATA = {
 "companion.truther": "truther|FOL4|-",
 "companion.believer": "mainstream|SOC3|SOC8;missionary|INT6|SOC7;warrior|INT8|INT5",
 "aslan.envoy": "duellist|END7|DEX5;negotiator|SOC6|INT6;spy|SOC7|INT5",
 "aslan.guardian": "agent|END7|INT5;poet|EDU6|INT6;priest|SOC5|EDU7",
 "aslan.manager": "aide|EDU7|SOC5;corporate|INT6|INT6;governess|SOC5|EDU7",
 "aslan.military": "cavalry|DEX6|DEX6;flyer|DEX7|INT5;support|END5|SOC7;warrior|END7|STR5",
 "aslan.military-officer": "assassin|END7|DEX5;executive|END5|EDU7;leader|END6|INT6",
 "aslan.scientist": "explorer|END7|INT5;healer|END5|SOC7;researcher|END6|INT6",
 "aslan.spacer": "crew|EDU5|INT7;engineer|END6|INT6;gunner|END6|INT6;pilot|DEX7|INT5",
 "aslan.space-officer": "commander|SOC7|INT5;navigator|INT5|SOC7;shipmaster|EDU6|SOC6",
 "aslan.outcast": "labourer|STR7|STR7;trader|END7|INT7;scavenger|END7|EDU7",
 "aslan.outlaw": "pirate|END6|INT6;raider|END7|STR5;thief|DEX6|INT6",
 "aslan.wanderer": "belter|DEX7|INT7;nomad|END8|INT6;scout|END6|INT8",
 "vargr.agent": "enforcer|END6|STR6;investigator|INT6|CHA6;spy|INT7|CHA6",
 "vargr.citizen": "corporate|EDU6|CHA5;settler|INT7|END6;worker|END4|CHA6",
 "vargr.intermediary": "arbitrator|EDU6|CHA8;diplomat|EDU7|CHA5;emissary|INT7|CHA5",
 "vargr.loner": "prospector|DEX7|END7;scrounger|DEX6|INT7;wanderer|CHA6|CHA7",
 "vargr.merchant": "free|DEX6|CHA5;long|EDU5|CHA7;salvager|EDU5|CHA6",
 "vargr.military": "army|STR6|CHA5;militia|END5|CHA7;raider|END6|CHA5",
 "vargr.psion": "institute|EDU6|CHA8;mentored|INT6|PSI6;wild|END6|INT8",
 "vargr.scientist": "physician|EDU4|INT8;researcher|EDU6|END6;technician|EDU5|INT7",
 "vargr.spacer": "corsair|DEX6|CHA7;explorer|END6|CHA6;navy|INT6|CHA7",
 "zhodani.agent": "informant|EDU5|INT6;tavrchedl|END6|INT6;tozjabr|INT7|INT5",
 "zhodani.army": "cavalry|DEX7|INT5;infantry|STR6|EDU6;support|END5|EDU7",
 "zhodani.entertainer": "artist|SOC6|INT6;author|EDU7|INT5;performer|INT5|DEX7",
 "zhodani.government": "administration|INT7|EDU8;diplomat|END6|EDU6",
 "zhodani.guard": "commando|END7|EDU5;ground|END6|EDU6;support|END5|EDU7",
 "zhodani.merchant": "broker|EDU5|INT7;corporate|EDU5|INT7;free|DEX6|INT6",
 "zhodani.navy": "crew|INT5|EDU7;flight|DEX7|EDU5;technical|INT6|EDU6",
 "zhodani.prole": "colonist|INT7|END5;corporate|SOC6|INT6;worker|END4|EDU8",
 "zhodani.scholar": "field|END6|INT6;lab|EDU4|INT6;physician|EDU4|INT8"
};

export const SPECIES_RULES = {
 aslan: {
  source: citation('aliens',15,16,17,20,21,22,47,48,49),
  dice: {STR:[2,1],DEX:[2,-1],END:[2,1],INT:[2,0],EDU:[2,0],SOC:[2,0]}, startAge:14,
  background: {count:{statDM:'EDU',add:3}, byGender:{
   male:['Animals','Art','Athletics','Carouse','Drive','Flyer','Language','Melee','Seafarer','Survival','Tolerance','Vacc Suit'],
   female:['Admin','Animals','Art','Athletics','Electronics','Language','Mechanic','Medic','Melee','Profession','Science','Streetwise','Tolerance','Vacc Suit']
  }},
  randomGender:{dice:'2D',male:{max:5},female:{min:6}},
  birthOrder:{dice:'2D',firstSonMin:11,otherwise:'second-or-later-son'},
  rite:{dice:'2D',compare:'strictly-less-than-each-characteristic',stats:['STR','DEX','END','INT','EDU','SOC'],modifierPerSuccess:1,doublesHaveEvents:true},
  qualificationFailure:{SOC:2,outcast:true}, minimumTermsBeforeCareerOrAssignmentChange:3,
  excludedFromMinimumTerms:['aslan.outcast','aslan.outlaw'],
  cash:{female:{maximumRolls:null,multiplier:1},male:{maximumRollsSkill:'Independence',multiplier:0.5}},
  pension:false, ageing:{startAge:42,termDMMultiplier:-2},
  independence:{gender:'male',acquisitionCheck:{dice:'2D',greaterThanStat:'SOC'}},
  traits:[
   {name:'Alien Morphology',otherSpeciesToolsDM:-1},
   {name:'Dewclaw',skill:'Melee (natural)',damage:'1D+2'},
   {name:'Heightened Senses',checks:['Recon','Survival','Initiative'],dm:1},
   {name:'Sprint',check:{stat:'DEX',target:6},metres:30,addEffect:true,requiresOnlySprinting:true}
  ],
  unsupported:['Family/clan narrative selections','Outcast restoration and corporate-career permissions','Land and corporate asset administration']
 },
 vargr: {
  source:citation('aliens',186,206,207), dice:{STR:[2,-1],DEX:[2,1],END:[2,-1],INT:[2,0],EDU:[2,0],CHA:[2,0]},
  variants:{urzaeng:{STR:[2,1],INT:[2,-1]},kokasha:{STR:[2,-2],INT:[2,1]}},
  imperial:{CHA:[1,2],SOC:[2,0],careerGroups:['core']},startAge:18,termYears:4,
  additionalBackground:[skill('Melee',0,'set')],priorCareerQualificationPenalty:0,
  failedQualificationOptions:['core.drifter','vargr.loner','draft'],
  draft:{dice:'1D',rows:['Agent','Army','Army','Army','Marine','Navy'],mappingRequiresSource:true},
  traits:[{name:'Bite',skill:'Melee (natural)',damage:'1D+1'},{name:'Heightened Senses',checks:['Recon','Survival','opposed Deception'],dm:1,darkVisionDM:-1}],
  unsupported:['Draft names Army/Marine/Navy require explicit mapping to Core or Vargr careers']
 },
 zhodani: {
  source:citation('aliens',254,255,256,276),startAge:18,termYears:4,psiDice:2,
  initialAdjustments:[{when:{stat:'PSI',min:9},raiseSOCTo:10},{capEDUAtSOC:true},{when:{stat:'SOC',min:10},raiseEDUTo:8}],
  optionalPsi:{gmPermission:true,dice:'1D',results:[9,9,10,10,11,12],rollSOCAfterwards:true,minimumSOC:10,nobleSOCMin:11},
  class:{prole:{SOCMax:9},intendant:{SOC:10},noble:{SOCMin:11}},
  background:{SOCMax:9,otherwise:'psionic-training'},
  psionicTraining:{skillLevel:0,check:'PSI',cumulativeAttemptDM:-1,learningDM:{Awareness:1,Clairvoyance:3,Telekinesis:2,Telepathy:4,Teleportation:0,Technopathy:0},trackAllAttempts:true},
  promotionToIntendant:{whenPSIMin:9,SOC:10,immediatePsionicTraining:true},
  priorCareerQualificationPenalty:0,failedQualificationOptions:['draft'],
  draft:{dice:'1D',careers:['zhodani.army','zhodani.army','zhodani.army','zhodani.merchant','zhodani.merchant','zhodani.navy'],merchantAssignment:'corporate'},
  automaticAdvancementOrCommission:{SOCMin:10,nonDraftedTerm:1,draftedTerm:2},
  nobleAdvancementDM:{SOCMin:11,dm:1},governmentRankCap:{SOCMax:10,maximum:3},
  psionicSkillTable:{SOCMin:10,unknownTalent:'repeat-learning-check-with-all-prior-attempt-penalties',failedLearning:'reroll-skill',talentChoice:'existing-talents'},
  unsupported:['Psionic learning order and failed-talent retry history require tracked checks','Re-education and career transfer exceptions']
 },
 aezorgh:{
  source:citation('jtas11',67),dice:{STR:[1,0],DEX:[2,3],END:[1,1],INT:[2,2],EDU:[1,0],SOC:[1,0]},
  maxima:{DEX:18,INT:16},startAge:18,
  background:{fixed:['Athletics','Mechanic','Recon','Stealth'],choiceCount:1,level:0,replaceStandard:true},
  careerGroups:['core','vargr'],vargrCharisma:{derive:'SOC',divisor:2,round:'floor'},
  precareer:{qualificationDM:-2,graduationDM:-2},
  ageing:{inheritCoreSchedule:true,dm:4,untilAgeExclusive:82},
  traits:[{name:'Gecko Travel',wallSpeedMultiplier:1,ceilingSpeedMultiplier:0.5,maximumGravity:1.5},{name:'Heightened Senses',checks:['Recon','Survival'],dm:1,heatSourceNegatesDarkness:true},{name:'Multi-limbed',nonMovementActionSets:2,otherSpeciesToolsDM:0}]
 }
};
export const EXPANDED_CHARACTERISTIC_DM = {
 source:citation('companion',4),optional:true,bands:[[0,0,-3],[1,2,-2],[3,5,-1],[6,8,0],[9,11,1],[12,14,2],[15,17,3],[18,20,4],[21,23,5]],thereafter:{per:3,dm:1}
};
export const PRECAREER_RULES = {
 'companion.colonial': {
  source:citation('companion',32),entry:{automaticWhen:{homeworldTLMax:8}},graduation:{stat:'INT',target:8,modifiers:[{condition:{stat:'END',min:8},dm:1}],honours:12},
  admissionEffects:table('Animals=0|Athletics=0|Drive=0|Gun Combat=0|Mechanic=0|Medic=0|Navigation=0|Recon=0|Profession=0|Seafarer=0|Survival=1').flat(),
  graduationEffects:[{kind:'skill-choice',scope:'precareer-level-zero',mode:'set',value:1,count:1},{kind:'choice',options:[
   {label:'Two other pre-career skills at level 1',effects:[{kind:'skill-choice',scope:'precareer-other',mode:'set',value:1,count:2}]},
   {label:'Increase an existing skill',effects:[{kind:'skill-choice',scope:'existing',mode:'increase',value:1,count:1}]}
  ]},skill('Jack-of-all-Trades',1,'set'),stat('END',1),{kind:'stat',name:'EDU',dice:'D3',multiplier:-1}],
  honoursEffects:[skill('Leadership',1,'set'),{kind:'skill-choice',scope:'precareer-level-zero',mode:'set',value:1,count:1}],
  firstCareerAge:{base:22,dice:'2D3'},careerQualificationDM:{'core.rogue':1,'core.scout':1,otherwise:-2},commissionDM:-1,advancementDM:-1,
  unsupported:['Entry outside homeworld TL8-or-lower is not supplied']
 },
 'companion.psionic': {
  source:citation('companion',33),entry:{stat:'PSI',target:8,modifiers:[{condition:{stat:'INT',min:8},dm:1}]},
  admissionEffects:table('Profession=0|Science=0|Streetwise=0').flat(),requiresTestingAndTraining:true,initialTalentLevel:0,
  graduation:{stat:'PSI',target:6,modifiers:[{condition:{stat:'INT',min:8},dm:1}],honours:12},
  graduationEffects:[stat('PSI',1),{kind:'skill-choice',scope:'psionic-talents',mode:'set',value:1,count:1},skill('Science (psionicology)',1,'set'),relationship('Rival')],
  honoursEffects:[{kind:'all-talents',mode:'set',value:1},{kind:'skill-choice',scope:'psionic-talents',mode:'set',value:2,count:1}],
  honoursRelationshipReplacesGraduation:{type:'Enemy',count:1},automaticCareerQualification:{career:'core.psion',expires:false},
  unsupported:['Testing and talent acquisition must be resolved before entry','Psion-career equivalence for other species needs an explicit campaign decision']
 },
 'companion.merchant': {
  source:citation('companion',33),entry:{stat:'INT',target:9,modifiers:[{condition:{stat:'SOC',min:8},dm:1}]},
  curricula:{business:{career:'core.merchant',assignment:'broker'},shipboard:{career:'core.merchant',assignment:'marine'}},
  admission:{assignmentSkillsAtLevel:0,randomServiceRolls:1,randomServiceLevel:1},
  graduation:{stat:'INT',target:7,modifiers:[{condition:{stat:'EDU',min:8},dm:1},{condition:{stat:'SOC',min:8},dm:1}],honours:11},
  graduationEffects:[{kind:'skill-choice',scope:'curriculum-assignment',mode:'set',value:1,count:1},stat('EDU',1)],
  careerEntry:{careers:['core.merchant','core.citizen'],firstCareerAfterAcademyOnly:true,appropriateBranchRequired:true,rank:1,honoursRank:2,applyHonoursRankBonus:true},
  advancementDM:{careers:['core.merchant','core.citizen'],graduate:1,honours:2},
  unsupported:['Citizen branch mapping is not specified by the source; require referee resolution rather than inventing it']
 },
 'companion.hard-knocks': {
  source:citation('companion',34),entry:{automaticWhen:{stat:'SOC',max:6}},
  admissionEffects:[skill('Streetwise',1,'set')],admissionChoice:{count:2,level:0,skills:['Athletics','Deception','Drive','Gambler','Melee','Persuade','Stealth']},
  graduation:{stat:'INT',target:7,modifiers:[{condition:{stat:'END',min:9},dm:1}],honours:11},
  graduationEffects:[{kind:'skill-choice',scope:'precareer-other',mode:'set',value:0,count:3},skill('Gun Combat',0,'set'),stat('SOC',-1)],
  honoursEffects:[skill('Carouse',1,'set'),{kind:'skill-choice',scope:'precareer-level-zero',mode:'set',value:1,count:1}],
  firstCareer:{advancementDM:-2,commissionDM:-2},laterCareer:{penaltyEndsOnlyAfterVoluntaryExit:true},
  unsupported:['Entry above SOC6 is not supplied','Penalty after involuntary first-career departure needs explicit tracking']
 },
 'companion.spacer': {
  source:citation('companion',34),entry:{automaticWhen:{homeworldSize:0},otherwise:{stat:'INT',target:4,modifiers:[{condition:{stat:'DEX',min:8},dm:1}]}},
  admissionEffects:[skill('Vacc Suit',1,'set')],admissionChoice:{count:2,level:0,skills:['Astrogation','Electronics','Engineer','Profession']},
  graduation:{stat:'INT',target:8,modifiers:[{condition:{stat:'DEX',min:6},dm:1}],honours:12},
  graduationEffects:[{kind:'skill-choice',scope:'precareer-other',mode:'set',value:0,count:2},{kind:'skill-choice',scope:'precareer',mode:'set',value:1,count:1},skill('Pilot',0,'set'),stat('DEX',1),stat('SOC',-2)],
  honoursEffects:[skill('Jack-of-all-Trades',1,'set')],
  careerModifiers:{career:'core.merchant',assignment:'free',qualificationDM:1,commissionDM:1,advancementDM:1}
 }
};
export const BENEFIT_RULES = {
 'Minor Following':{source:citation('companion',36),effects:[relationship('Contact'),{kind:'stat',name:'FOL',dice:'D3',multiplier:1}]},
 'Major Following':{source:citation('companion',36),effects:[relationship('Ally'),{kind:'stat',name:'FOL',dice:'1D',add:1,multiplier:1}]},
 Patronage:{source:citation('companion',36),annualCredits:10000},
 'Sainthood candidacy':{source:citation('companion',35),interactionDM:2,check:{skill:'Science (belief)',target:14,dmPerCandidacy:1},success:{benefit:'Living saint',interactionDM:4}},
 'Ceremonial Kinship':{source:citation('aliens',47),effects:[relationship('Ally',1,'D3')]},
 'Brotherhood of Stars':{source:citation('aliens',47),lowPassagesPerMonth:1,middlePassagesPerYear:2},
 'Scientific Kinship':{source:citation('aliens',47),annualCheck:{stat:'SOC',target:10},labShipUseMonths:6},
 'Clan Share':{source:citation('aliens',47,48),cashOrArtValue:10000,shipShareExchange:1,corporationEquityPerShare:500000,corporationGender:'female'},
 'Secret School':{source:citation('aliens',47),chooseOne:true,attackDM:1,options:[
  {skill:'Melee (natural)',condition:'duel'},{skill:'Gun Combat (energy)',minimumAimRounds:2},{skill:'Gun Combat (slug)',minimumAimRounds:2},{skill:'Heavy Weapons',minimumAimRounds:2},{skill:'Gunner',range:'Adjacent'}
 ]},
 Nenj:{source:citation('aliens',276),discountPercent:10,discountUsuallyBelowCredits:1000000,transferable:false},
 zhodaniShip:{source:citation('aliens',276,277),mortgagePaidPercentPerAward:25,outdatedRollCount:'1D',types:{Courier:'Yetsasl',Scout:'Ninz',Trader:'Zdebr'}}
};
export const SOURCE_DISCREPANCIES = [
 {id:'aslan.guardian.qualification-modifier',source:citation('aliens',23,26),summary:{stat:'SOC',min:9,dm:1},detail:{stat:'EDU',min:9,dm:2},resolution:'detail'},
 {id:'aslan.scientist.survival',source:citation('aliens',23,34),summary:{healer:'EDU5',researcher:'EDU6'},detail:{healer:'END5',researcher:'END6'},resolution:'detail'},
 {id:'aslan.scientist.healer-gender',source:citation('aliens',21,23,34),summary:'either',detailSymbol:'male',detailProse:'either',resolution:'either; prose and summary agree'},
 {id:'aslan.space-officer.rank-labels',source:citation('aliens',38,39),labels:['Pilot/Gunner','Engineer/Crew'],expected:['Shipmaster','Navigator'],resolution:'source-required; no guessed assignment mapping'},
 {id:'vargr.citizen.worker-advancement',source:citation('aliens',187,190),summary:{stat:'CHA',target:4},detail:{stat:'CHA',target:6},resolution:'detail'},
 {id:'vargr.merchant.qualification',source:citation('aliens',187,196),summary:{stat:'INT',target:5},detail:{stat:'CHA',target:6},resolution:'detail'},
 {id:'vargr.scientist.qualification',source:citation('aliens',187,202),summary:{stat:'EDU',target:8},detail:{stat:'INT',target:8},resolution:'detail'},
 {id:'zhodani.informant.streetwise',source:citation('aliens',256,258,259),generalRule:'Tozjabr-only',detail:'Informant table and rank award Streetwise',resolution:'specific career table'},
 {id:'skill-name-normalisation',source:citation('companion',38),printed:'Diplomacy',normalised:'Diplomat'},
 {id:'skill-name-normalisation-aliens',source:citation('aliens',24,190,266),printed:['Tactic','Driver','Mechanics','Teleport'],normalised:['Tactics','Drive','Mechanic','Teleportation']}
];


const check = token => token === '-' ? null : ({stat:token.slice(0,-1),target:Number(token.at(-1))});
const builds = {};
for (const r of CAREER_DATA) {
 const sourceId = r.id.startsWith('companion.') ? 'companion' : 'aliens';
 const training = { personal:table(r.personal),service:table(r.service),assignments:Object.fromEntries(Object.entries(r.assignments).map(([id,t])=>[id,table(t)])) };
 if(r.advanced) training.advanced=table(r.advanced);
 if(r.officer) training.officer=table(r.officer);
 if(r.psionic) training.psionic=table(r.psionic);
 const prerequisites = {...PREREQUISITE_DATA[r.id]};
 if(r.advanced)prerequisites.advanced={stat:'EDU',min:r.advancedMin??8};
 if(r.officer)prerequisites.officer={commissioned:true};
 if(r.psionic)prerequisites.psionic={stat:'SOC',min:10};
 const ranks={};
 for(const [id,track] of Object.entries(RANK_DATA[r.id]??{})){
  if(['default','enlisted','officer'].includes(id))ranks[id]=rankTrack(track);
  else (ranks.assignments??={})[id]=rankTrack(track);
 }
 const eventPage=r.id==='companion.believer'?40:r.page+1;
 const sourceFallback=kind=>[sourceRequired(sourceId,kind==='event'?eventPage:r.page+1,'Resolve '+kind+' using the cited source; no default outcome is applied.')];
 builds[r.id]={
  source:citation(sourceId,r.page,r.page+1,...(r.id==='companion.believer'?[40]:[])),
  basicTraining:{table:r.basic??'service',firstCareer:'all-at-level-0',laterCareer:'choose-one-at-level-0'},
  training,prerequisites,ranks,
  checks:Object.fromEntries(CHECK_DATA[r.id].split(';').map(row=>{const [id,s,a]=row.split('|');return [id,{survival:check(s),advancement:check(a)}];})),
  benefits:{cash:r.cash,material:table(r.material)},
  events:Object.fromEntries(Array.from({length:11},(_,i)=>[i+2,sourceFallback('event')])),
  mishaps:Object.fromEntries(Array.from({length:6},(_,i)=>[i+1,sourceFallback('mishap')])),
  unsupported:['Career event and mishap branches require cited-source resolution']
 };
}
builds['aslan.space-officer'].ranks.assignments.navigator=Array.from({length:7},(_,rank)=>({rank,title:'',effects:[sourceRequired('aliens',39,'Rank-table headings do not identify this assignment unambiguously.')]}));
builds['aslan.space-officer'].ranks.assignments.shipmaster=structuredClone(builds['aslan.space-officer'].ranks.assignments.navigator);
builds['aslan.space-officer'].unsupported.push('Non-commander rank-track mapping is inconsistent in print');
builds['companion.truther'].following={initial:0,bands:[{min:0,max:3,interactionDM:0},{min:4,max:6,interactionDM:1},{min:7,max:9,interactionDM:2},{min:10,max:12,interactionDM:3},{min:13,interactionDM:4}],sameBeliefSign:1,officialsSign:-1};
export const EXPANSION_PACK = builds;


const C=cell;
const Q=options=>choice(options);
const K=(name,target,success=[],failure=[],extra={})=>({kind:'check',...(/^[A-Z]{3}$/.test(name)?{stat:name}:{skills:name.split('|')}),target,success,failure,...extra});
const M=(target,value,scope='next',career='current')=>({kind:'modifier',target,value,scope,career});
const A=value=>M('advancement',value);
const B=(value=1,scope='one')=>M('benefit',value,scope);
const R=value=>({kind:'benefit-rolls',value});
const BR=mode=>({kind:'benefit-rolls',mode});
const ST=(action,career,extra={})=>({kind:'career-status',action,...(career?{career}:{}),...extra});
const I=(rolls=1,take)=>({kind:'injury',table:'core.injury',rolls,...(take?{take}:{})});
const T=(table,extra={})=>({kind:'table-roll',table,...extra});
const P=(mode='automatic')=>({kind:'promotion',mode});
const ANY=(scope='any',extra={})=>({kind:'skill-choice',scope,mode:'increase',value:1,...extra});
const OPT=(label,effects)=>Q([[label,effects],['Decline',[]]]);
const RAND=(dice,outcomes)=>({kind:'random',dice,outcomes:outcomes.map(([min,max,effects])=>({min,max,effects}))});
const DSTAT=(name,dice,multiplier=1)=>({kind:'stat',name,dice,multiplier});
const U=(id,page,reason)=>sourceRequired(id.startsWith('companion')?'companion':'aliens',page,reason);
const contactsCHA=()=>({kind:'relationship',type:'Contact',countFrom:{statDM:'CHA',minimum:1}});
const lifeOf=id=>T(id+'.life-events',{dice:'2D',sourcePage:['aslan','core'].includes(id)?46:id==='vargr'?206:277});
const stay=()=>ST('stay');
const noTerm=()=>BR('lose-term');
const outcast=()=>({kind:'aslan-outcast',SOC:2,forfeitClanShares:true,nextCareers:['aslan.outcast','aslan.outlaw']});
function outcomes(id,events,mishaps){
 Object.assign(builds[id].events,events);Object.assign(builds[id].mishaps,mishaps);
}
for(const [id,c] of Object.entries(builds)){
 if(id.startsWith('companion'))continue;
 const group=id.split('.')[0];
 c.events[2]=[T('mishap',{dice:'1D',keepCareer:!['aslan.outcast','aslan.outlaw','vargr.loner'].includes(id)})];
 c.events[7]=[lifeOf(id==='aslan.outcast'?'core':group)];
}
outcomes('companion.truther',{
 2:[T('mishap',{dice:'1D',keepCareer:true})],
 3:[OPT('Accept',[R(1),ANY('science-specialties'),relationship('Enemy',1,'D3')])],
 4:[relationship('Contact'),B()],
 5:[ANY('untrained-electronics-or-science')],
 6:C('Survival / Recon'),
 7:[T('core.life-events',{dice:'2D',sourcePage:46})],
 8:[...C('Carouse / Persuade'),stat('FOL',1)],
 9:[Q([['Take opportunity',[Q([['Following',[DSTAT('FOL','D3')]],['Status',C('SOC+1')],['Skill',[ANY('science-medic-electronics',{value:2})]]]),relationship('Enemy',1,'D3')]],['Decline',[relationship('Ally')]]])],
 10:[...C('Streetwise / Recon / Carouse'),relationship('Contact',1,'D3')],
 11:[stat('SOC',1),relationship('Rival')],
 12:[DSTAT('FOL','D3')]
},{
 1:[I(),ST('exit')],2:[relationship('Enemy')],
 3:[stat('SOC',-2),DSTAT('FOL','D3',-1),stay()],
 4:[{kind:'skill-reduction-choice',scope:'science-specialties',value:1},stay()],
 5:[BR('lose-all'),stay()],6:[relationship('Rival',1,'D3')]
});
outcomes('companion.believer',{
 2:[T('mishap',{dice:'1D',keepCareer:true})],
 3:[stat('SOC',1),relationship('Ally')],4:[relationship('Contact')],
 5:C('Streetwise / Persuade'),
 6:[DSTAT('SOC','D3',-1),{kind:'benefit-rolls',dice:'D3',value:1},B(1,'all')],
 7:[T('core.life-events',{dice:'2D',sourcePage:46})],8:C('Carouse / Persuade'),
 9:[Q([['Accept payment',[U('companion.believer',40,'Leave career; forfeit all benefits and receive 2D × Cr10000 for each forfeited benefit roll.')]],['Refuse',[relationship('Enemy',1,'1D')]]])],
 10:[OPT('Perform rites',[relationship('Ally'),relationship('Rival')])],
 11:[M('advancement',-2,'all')],12:[P(),M('advancement',1,'all')]
},{
 1:[I(),ST('exit')],2:[relationship('Enemy')],
 3:[{kind:'rank',value:-1},R(-1),stay()],
 4:[{kind:'skill-reduction-choice',names:['Profession (religion)','Science (belief)'],value:1},stay()],
 5:[BR('lose-all'),stay()],6:[relationship('Rival',1,'D3')]
});
outcomes('vargr.agent',{
 3:[K('Investigate|Streetwise',8,C('CHA+1 / Deception / Stealth / Streetwise / Tactics (military)'),[T('mishap',{dice:'1D'})])],
 4:[contactsCHA()],5:[B()],6:[K('EDU',8,[ANY('eligible-career')])],
 8:[OPT('Profit from goods',[K('Deception',8,[R(1)],[stat('CHA',-1),M('survival',-4)])])],
 9:[U('vargr.agent',189,'Choose a cover career; Deception 8+. Failure rolls its mishap. Success rolls its specialist training and gives next advancement DM+2.')],
 10:[relationship('Ally')],11:[A(4)],12:[P('next-check'),stat('CHA',1)]
},{
 1:[I(2,'lower')],
 2:[Q([['Accept',[ST('exit'),stat('CHA',-1)]],['Refuse',[I(),relationship('Enemy'),stay()]]])],
 3:[K('Advocate',8,[BR('retain-term')],[stat('CHA',-1)])],
 4:[K('CHA',8,[stay()],[ST('next','vargr.loner')])],5:[relationship('Enemy')],6:[I()]
});
outcomes('vargr.citizen',{
 3:[K('CHA',8,[A(2)],[M('survival',-2)])],
 4:[T('training.advanced',{dice:'1D',ignorePrerequisite:true})],5:[B()],6:[K('EDU',8,[ANY('existing')])],
 8:[OPT('Exploit secret',[A(2),B(),stat('CHA',-1),...C('Streetwise=1 / Deception=1 / @Contact')])],
 9:[A(2)],10:[K('CHA',10,[P('next-check')])],11:[relationship('Ally'),A(4)],12:[Q([['Charisma',C('CHA+1')],['Advancement',[P('next-check')]]])]
},{
 1:[I()],2:[stat('CHA',-1)],3:[ST('exit')],
 4:[Q([['Cooperate',[M('qualification',2,'next','next')]],['Refuse',[relationship('Ally')]]])],
 5:[K('CHA',7,[],[ST('next','vargr.loner')])],6:[stat('CHA',-1),relationship('Rival')]
});
outcomes('vargr.intermediary',{
 3:[Q([['Withdraw',C('CHA-1')],['Continue',[K('Broker|Diplomat|Persuade',10,[stat('CHA',1),A(2)],[stat('CHA',-1),R(-1),A(-2)])]]])],
 4:[B()],5:[K('CHA',8,[relationship('Ally')],[relationship('Contact')])],6:[K('EDU',8,[ANY('eligible-career')])],
 8:C('Advocate=1 / Broker=1 / Diplomat=1'),
 9:[Q([['Accept',[R(1),skill('Deception',1,'set'),relationship('Rival')]],['Refuse',[relationship('Ally'),M('survival',2)]]])],
 10:[K('CHA',10,[P('next-check')])],11:[Q([['Benefit',[R(1)]],['Advancement',[A(4)]]])],12:[P('next-check'),stat('CHA',1)]
},{
 1:[I()],2:[stat('CHA',-1)],3:[relationship('Rival'),K('CHA',6,[],C('CHA-1'))],4:[K('CHA',8,[],[M('survival',-2)])],
 5:[U('vargr.intermediary',193,'Choose END or Melee check at 8+. Success permits staying; failure causes an injury roll.')],
 6:[K('Broker|Diplomat|Persuade',10,[stay(),relationship('Enemy')],[ST('exit'),relationship('Rival')])]
});
outcomes('vargr.loner',{
 3:[OPT('Take job',[M('qualification',4,'next','next'),relationship('Contact')])],
 4:[K('EDU',6,[ANY('assignment')])],5:C('Jack-of-all-Trades'),
 6:[K('CHA',6,[Q([['Accept',[ST('auto-qualify','vargr.spacer',{assignment:'corsair'})]],['Refuse',[I()]]])],[I()])],
 8:[R(1)],9:[B()],10:[K('Survival',8,C('STR+1 / DEX+1 / END+1'),[I()])],11:[A(2)],12:[P('next-check'),stat('CHA',1)]
},{
 1:[I()],2:[stat('CHA',-1)],3:[relationship('Enemy')],4:C('Animals=1 / Recon=1 / Survival=1'),5:[K('END',6,[],[I()])],6:[{kind:'note',text:'Unexplained memory gap.'}]
});
outcomes('vargr.merchant',{
 3:[Q([['Accept',[K('Deception',8,[R(1),B()],[stat('CHA',-1),ST('next','core.prisoner')])]],['Refuse',[relationship('Enemy')]]])],
 4:[B()],5:[K('EDU',8,[ANY('eligible-career')])],6:C('Advocate / Admin / Diplomat / Investigate / Persuade'),
 8:[R(1)],9:[relationship('Ally')],10:[contactsCHA()],11:[stat('CHA',1),A(2)],12:[P(),stat('CHA',1)]
},{
 1:[I()],2:[stat('CHA',-1)],3:[K('CHA',8,[],[ST('next','core.prisoner')])],4:[relationship('Rival')],
 5:[K('CHA',8,[stay(),relationship('Enemy')],[relationship('Rival')])],6:[{kind:'benefit-rolls',dice:'D3',value:-1}]
});
outcomes('vargr.military',{
 3:C('Engineer=1 / Survival=1 / Vacc Suit=1'),4:C('Persuade=1 / Stealth=1 / Streetwise=1 / Recon=1'),
 5:[Q([['Benefit',[B()]],['Charisma',C('CHA+1')]])],
 6:[K('END',8,[...C('Leadership / Tactics (military)'),K('CHA',8,[P('next-check')])],[I()])],
 8:[K('EDU',8,[ANY('existing')])],9:[Q([['Advancement',[A(1)]],['Charisma',C('CHA+1')]])],
 10:C('Admin=1 / Carouse=1 / Investigate=1 / CHA+1'),11:[relationship('Ally'),A(2)],12:[stat('CHA',1),P('next-check')]
},{
 1:[I(2,'lower')],2:[stat('CHA',-1),relationship('Enemy')],3:[I(),...C('Recon / Survival')],
 4:[Q([['Join',[relationship('Ally'),stat('CHA',-1)]],['Testify',[stat('CHA',1),relationship('Enemy')]]])],
 5:[stat('CHA',-1)],6:[I()]
});
outcomes('vargr.psion',{
 3:[OPT('Help',[K('Deception',8,[relationship('Ally')],[stat('CHA',-1)])])],
 4:[RAND('1D',[[1,2,[I()]],[3,4,[ANY('psionic-talents')]],[5,6,[stat('PSI',1)]]])],
 5:[B()],6:[K('EDU',8,[ANY('non-psionic')])],
 8:[K('PSI',10,[ANY('new-psionic-talent')],C('Science (psionicology)'))],
 9:[relationship('Ally'),skill('Persuade')],10:[stat('PSI',1)],11:[relationship('Contact'),A(4)],12:[P('next-check')]
},{
 1:[I()],2:[RAND('1D',[[1,4,[{kind:'note',text:'Missing for the rolled number of days.'}]],[5,6,[stat('PSI',-1),{kind:'note',text:'Missing for the rolled number of days.'}]]])],
 3:[stat('CHA',-1),R(-1)],4:[ST('next','core.prisoner')],5:[relationship('Rival')],
 6:[RAND('1D',[[1,2,[I()]],[3,4,[stat('PSI',-1)]],[5,6,[stat('PSI',1),ST('exit')]]])]
});
outcomes('vargr.scientist',{
 3:[relationship('Contact'),...C('Engineer / Gun Combat / Heavy Weapons / Science')],
 4:C('Deception=1'),5:C('Athletics (dexterity) / Vacc Suit'),6:[K('EDU',8,[ANY('eligible-career')])],
 8:[contactsCHA()],9:[relationship('Ally'),skill('Science')],10:[stat('CHA',1),B()],11:[B(),A(4)],12:[P(),stat('CHA',1)]
},{
 1:[I()],2:[stat('END',-1)],3:[stat('CHA',-1)],4:[skill('Survival',1,'set'),K('END',8,[],[I()])],
 5:[Q([['Remain',[stay(),noTerm()]],['Find new pack',[K('CHA',8,[stay(),relationship('Enemy')],[ST('exit')])]]])],
 6:[relationship('Rival'),stat('CHA',-1),M('survival',-2)]
});
outcomes('vargr.spacer',{
 3:[B()],4:[relationship('Ally')],5:C('Vacc Suit / Athletics (dexterity)'),6:[K('EDU',8,[ANY('eligible-career')])],
 8:C('Astrogation / Electronics / Pilot'),9:C('Jack-of-all-Trades=1'),10:[K('CHA',8,[A(2)])],11:[A(4)],12:[P(),stat('CHA',1)]
},{
 1:[I(2,'lower')],2:[relationship('Rival')],3:[stat('CHA',-1),relationship('Enemy')],4:[stat('CHA',-1)],5:[K('CHA',8,[],[stat('CHA',-1)])],6:[I()]
});



const RE=()=>T('zhodani.re-education',{dice:'1D',sourcePage:276});
const SOC=(min,yes,no=[])=>({kind:'conditional',condition:{stat:'SOC',min},then:yes,otherwise:no});
outcomes('zhodani.agent',{
 2:[T('mishap',{dice:'1D',keepCareer:true,keepCareerThroughReeducation:true})],
 3:C('Drive / Flyer / Pilot / Seafarer'),
 4:[RAND('1D',[[1,1,[I()]],[2,6,C('Survival / Medic')]])],
 5:[B()],6:[relationship('Contact',1,'D3')],8:[K('EDU',8,[ANY('existing')])],
 9:[K('Investigate',8,[T('events',{career:'zhodani.prole',dice:'2D'}),T('training',{career:'zhodani.prole',tableChoice:'assignment',dice:'1D'})],[T('mishap',{career:'zhodani.prole',dice:'1D',keepCareer:true})])],
 10:C('Admin / Electronics (computers)'),11:[relationship('Ally'),A(2)],12:[P('next-check')]
},{
 1:[I(2,'lower')],2:[K('Advocate',8,[BR('retain-term')],[RE()])],
 3:[Q([['Accept responsibility',[ST('exit'),R(1)]],['Contest',[K('Admin|Advocate',8,[stay()],[RE()])]]])],
 4:[ST('exit'),RE()],5:[I(),relationship('Contact')],6:[I()]
});
outcomes('zhodani.army',{
 2:[T('mishap',{dice:'1D',keepCareer:true,keepCareerThroughReeducation:true})],
 3:C('Stealth / Persuade / Recon'),4:C('Animals (riding) / Animals (training) / Engineer / Recon / Vacc Suit'),
 5:[...C('Vacc Suit / Heavy Weapons / Athletics'),SOC(10,[OPT('Transfer to Guard',[ST('exit'),ST('auto-qualify','zhodani.guard',{retainRank:true})])])],
 6:[K('Gun Combat|Stealth',8,C('Gun Combat / Leadership / Tactics (military)'),[I()])],
 8:[K('EDU',8,[ANY('existing')])],9:[A(2)],10:C('Admin / Investigate / Recon'),11:[relationship('Ally'),A(2)],12:[P('next-check')]
},{
 1:[I(2,'lower')],2:[relationship('Contact',1,'D3'),RE()],
 3:[...C('Recon / Survival'),SOC(10,[relationship('Enemy')],[RE()])],
 4:[Q([['Join',[relationship('Ally'),RE()]],['Cooperate',[BR('retain-term')]]])],
 5:[SOC(10,[relationship('Rival')],[RE()])],6:[I()]
});
outcomes('zhodani.entertainer',{
 2:[T('mishap',{dice:'1D',keepCareer:true,keepCareerThroughReeducation:true})],
 3:[OPT('Participate',[K('Art|Persuade',8,[R(1)],[T('mishap',{dice:'1D'})])])],
 4:C('Carouse / Persuade / Steward'),5:[R(1)],6:[A(2),relationship('Ally')],8:[K('EDU',8,[ANY('existing')])],
 9:[relationship('Contact',1,'D3')],10:[K('Art|Persuade',8,[A(2)],[A(-2)])],
 11:[Q([['Support leader',[A(2)]],['Criticise',[relationship('Enemy'),K('Art|Persuade',8,[P('next-check')],[ANY('existing'),T('mishap',{dice:'1D'})])]]])],
 12:[P('next-check')]
},{
 1:[I()],2:[...C('Carouse / Diplomat / Persuade'),SOC(10,[RE(),stay(),{kind:'note',text:'Relocate to another world.'}])],
 3:[K('Persuade',8,[BR('retain-term')],[RE()])],
 4:[{kind:'relationship-change',from:['Contact','Ally'],to:['Rival','Enemy'],fallback:true}],
 5:[relationship('Contact',1,'D3')],6:[SOC(10,[relationship('Rival')],[RE()])]
});
outcomes('zhodani.government',{
 3:C('Animals (riding) / Art / Carouse'),
 4:[U('zhodani.government',265,'Select another Zhodani career, roll its service/assignment training as directed, and gain one cash benefit roll from that career.')],
 5:[B()],6:[...C('Admin / Advocate / Diplomat / Persuade'),relationship('Rival')],
 8:[K('EDU',8,[ANY('existing')])],
 9:[Q([['Refuse',[relationship('Enemy'),T('mishap',{dice:'1D'})]],['Accept',[K('Diplomat|Persuade',8,C('Carouse / Persuade / Tactics'))]]])],
 10:C('Advocate / Diplomat / Leadership'),11:[relationship('Ally'),Q([['Leadership',C('Leadership')],['Advancement',[A(2)]]])],12:[P('next-check')]
},{
 1:[{kind:'benefit-rolls',mode:'retain-one'},ST('exit')],2:[{kind:'advancement-block',terms:1},stay()],
 3:[relationship('Rival')],
 4:[U('zhodani.government',265,'Choose PSI, Melee or Recon check at 8+. Success permits staying; failure causes injury.')],
 5:[K('Diplomat',8,[stay(),R(1)],[RE(),ST('exit')])],6:[I()]
});
outcomes('zhodani.guard',{
 3:C('Vacc Suit / Athletics (dexterity)'),4:C('Electronics / Gun Combat / Leadership / Recon'),
 5:[...C('Advocate / Investigate / Persuade'),OPT('Transfer to Tavrchedl',[ST('exit'),ST('auto-qualify','zhodani.agent',{assignment:'tavrchedl',retainRank:true})])],
 6:[K('Melee|Gun Combat',8,C('Tactics (military) / Leadership'),[I()])],8:[K('EDU',8,[ANY('existing')])],
 9:[OPT('Volunteer',[K('Survival',8,[A(2),R(1)],[I()])])],
 10:[Q([['Report',[A(2)]],['Protect commander',[relationship('Ally')]]])],
 11:[Q([['Leadership',C('Leadership')],['Tactics',C('Tactics (military)')],['Advancement',[A(2)]]])],12:[P('next-check')]
},{
 1:[I(2,'lower')],2:[A(-2),relationship('Enemy')],3:[...C('Recon / Survival / Vacc Suit'),relationship('Enemy')],
 4:[Q([['Accept',[stay(),relationship('Enemy')]],['Refuse',[RE()]]])],
 5:[relationship('Enemy'),stat('STR',-1),stat('DEX',-1),BR('retain-term')],6:[I()]
});
outcomes('zhodani.merchant',{
 2:[T('mishap',{dice:'1D',keepCareer:true,keepCareerThroughReeducation:true})],
 3:[ST('exit'),ST('auto-qualify','zhodani.navy',{retainRank:true})],
 4:C('Animals / Engineer / Pilot / Profession / Science'),5:C('Admin / Broker / Electronics (computers)'),
 6:C('Broker / Diplomat / Profession / @Contact'),8:[K('EDU',8,[ANY('existing')])],9:[B()],10:[R(1)],11:[relationship('Ally'),A(2)],12:[P('next-check')]
},{
 1:[I(2,'lower')],2:[BR('retain-term')],
 3:[U('zhodani.merchant',269,'Roll fine 1D × Cr1000. Pay immediately to stay; otherwise leave and SOC9-or-lower also rolls re-education.')],
 4:[Q([['Continue',[stay(),{kind:'benefit-block',terms:2}]],['Leave',[]]])],
 5:[{kind:'cash',dice:'1D',multiplier:1000}],6:[I()]
});
outcomes('zhodani.navy',{
 2:[T('mishap',{dice:'1D',keepCareer:true,keepCareerThroughReeducation:true})],
 3:C('@Contact / Diplomat / Recon / Steward'),
 4:C('Electronics (sensors) / Engineer / Gunner / Pilot'),5:[K('EDU',8,[ANY('existing')])],
 6:C('Engineer / Mechanic / Science'),8:[K('SOC',8,C('@Contact / Animals / Recon / Survival'))],
 9:C('Athletics (dexterity) / Electronics (sensors) / Vacc Suit'),
 10:[K('Mechanic|Engineer',8,[A(2)],[I()])],11:[relationship('Ally'),A(2)],12:[P('next-check')]
},{
 1:[I(2,'lower')],2:[I(),K('SOC',8,[stay()])],3:[SOC(10,[relationship('Rival')],[RE()])],
 4:[I(2,'lower'),R(1)],5:[SOC(10,[A(-2),relationship('Enemy')],[RE()])],6:[I()]
});
outcomes('zhodani.prole',{
 3:[B()],4:[B()],5:[relationship('Contact',1,'D3')],6:[K('EDU',8,[ANY('existing')])],
 8:[Q([['Report',[A(2)]],['Keep secret',[relationship('Ally')]]])],9:[A(2)],10:C('Drive=1 / Flyer=1 / Pilot=1'),
 11:[Q([['Contact',[relationship('Contact')]],['Skill',[ANY('existing')]]])],12:[P()]
},{
 1:[I(2,'lower')],2:[relationship('Enemy'),RE()],3:[noTerm()],4:[RE()],
 5:[{kind:'relationship-remove',types:['Ally','Contact'],count:1},RE()],6:[I()]
});
outcomes('zhodani.scholar',{
 2:[T('mishap',{dice:'1D',keepCareer:true,keepCareerThroughReeducation:true})],
 3:[Q([['Accept',[R(1),ANY('science-specialties',{count:2,distinctSpecialties:true}),relationship('Enemy',1,'D3')]],['Refuse',[relationship('Ally')]]])],
 4:C('Electronics / Engineer / Investigate / Medic / Science'),5:[B()],
 6:[K('Survival|Pilot',8,[relationship('Contact'),ANY()],[T('mishap',{dice:'1D'})])],
 8:[K('EDU',8,[ANY('existing')])],9:[A(2)],10:C('Admin / Advocate / Diplomat / Persuade'),
 11:[relationship('Ally'),ANY('science-specialties'),A(2)],12:[P('next-check')]
},{
 1:[I(2,'lower')],2:[I(2,'higher'),RE()],
 3:[Q([['Open research',[ANY('science-specialties')]],['Secret research',[ANY('science-specialties',{count:2,distinctSpecialties:true}),noTerm(),SOC(10,[],[RE()])]]])],
 4:C('Survival / Athletics'),5:[Q([['Salvage',[BR('retain-term'),ST('exit')]],['Restart',[stay(),noTerm()]]])],
 6:[skill('Survival'),K('END',8,[],[I()])]
});


const genderAward=(gender,effects)=>({kind:'conditional',condition:{gender},then:effects,otherwise:[sourceRequired('aliens',20,'This award is restricted by gender. Choose another permitted award.')]});
const officerOpportunity=career=>({kind:'officer-qualification-opportunity',career,term:'next',dmFrom:'current-career-terms',ignoreMinimumThreeTerms:true});
outcomes('aslan.envoy',{
 3:[Q([['Withdraw',C('SOC-1')],['Continue',[K('Diplomat|Investigate|Stealth',8,[A(2)],[stat('SOC',-1),A(-2)])]]])],
 4:C('Animals=1 / Athletics=1 / Stealth=1 / Survival=1'),5:[relationship('Contact')],6:[K('EDU',8,[ANY()])],
 8:[K('Carouse|Persuade',8,[relationship('Ally')],[relationship('Rival')])],
 9:[Q([['Refuse',C('SOC-2')],['Duel',[K('Melee (natural)',9,[stat('SOC',1),A(2)],[stat('SOC',-1),A(-1)])]]])],
 10:[Q([['Refuse',[relationship('Enemy')]],['Accept',[K('Deception|Persuade',8,C('Deception / Persuade / SOC+1'),[T('mishap',{dice:'1D'})])]]])],
 11:[A(4)],12:[P()]
},{
 1:[I()],2:[outcast()],3:[relationship('Rival')],
 4:[K('Melee (natural)|Recon',8,[stay()],[I()])],
 5:C('Carouse=1 / Independence=1 / Pilot=1 / Survival=1'),
 6:[K('Tolerance',8,[stay()],[K('Melee',8,[relationship('Enemy')],[relationship('Rival'),stat('SOC',-1)])])]
});
outcomes('aslan.guardian',{
 3:[Q([['Trade secret',[{kind:'benefit',name:'Clan Share',value:1,dice:'1D'}]],['Retain secret',[{kind:'deferred-benefit',name:'Clan Share',dice:'1D'}]]]),{kind:'conditional-future',trigger:'expose-secret',effects:[relationship('Enemy')]}],
 4:C('Athletics=1 / Carouse=1 / Medic=1 / Melee (natural)=1'),
 5:[K('Art|Investigate|Persuade',8,[A(2)],[A(-2)])],6:[K('EDU',8,[ANY()])],
 8:C('Admin=1 / Carouse=1 / Independence=1 / Survival=1'),9:[stat('SOC',1),ANY()],
 10:[Q([['Conceal',[relationship('Ally')]],['Expose',[K('Melee',8,[relationship('Enemy'),stat('SOC',1),A(1)],[relationship('Rival'),stat('SOC',-2)])]]])],
 11:[A(4)],12:[P()]
},{
 1:[I()],2:[outcast()],3:C('Survival=1 / Pilot=1 / Independence=1 / Streetwise=1'),
 4:[K('Melee',8,[stat('SOC',1)]),{kind:'note',text:'Duel wound; source gives no characteristic loss.'}],
 5:[K('Advocate',8,[stay()])],6:[relationship('Rival')]
});
outcomes('aslan.manager',{
 3:[K('Melee (natural)|Stealth|Gun Combat',8,[ANY()],[I()])],
 4:C('Drive=1 / Electronics=1 / Mechanic=1 / Pilot=1'),
 5:[U('aslan.manager',29,'Wager up to three benefit rolls. Broker 8+ gains the wager in extra rolls on success; failure loses the wager.')],
 6:[K('EDU',8,[ANY()])],8:C('Broker=1 / Profession=1 / Streetwise / @Contact'),
 9:[K('Diplomat|Admin',8,[relationship('Rival')],[A(-2)])],10:[A(2)],
 11:[Q([['Tolerance',C('Tolerance')],['Advancement',[A(4)]]])],12:[P()]
},{
 1:[I()],2:[Q([['Charge true',[R(3),outcast()]],['Charge false',[K('Advocate',8,[stay()],[ST('exit')])]]])],
 3:[relationship('Contact')],4:[OPT('Continue',[stay(),{kind:'benefit-block',terms:2}])],
 5:C('Flyer=1 / Navigation=1 / Profession=1 / Survival=1'),6:[relationship('Rival')]
});
outcomes('aslan.military',{
 3:[K('Recon|Gun Combat',8,[],[I()]),Q([['Heavy Weapons',[genderAward('male',C('Heavy Weapons=1'))]],['Leadership',[genderAward('male',C('Leadership=1'))]],['Medic',C('Medic=1')],['Stealth',C('Stealth=1')]])],
 4:[Q([['Contact',[relationship('Contact')]],['Communications',[genderAward('female',C('Electronics (comms)'))]],['Mechanic',[genderAward('female',C('Mechanic'))]],['Streetwise',C('Streetwise')]])],
 5:[U('aslan.military',31,'Gain Melee (natural), Gun Combat, Drive or Survival; check the selected skill at 8+ for next advancement DM+2.')],
 6:[K('EDU',8,[ANY()])],8:C('Gun Combat / Language / Melee / Recon / Survival'),
 9:[Q([['Duel',[K('Melee (natural)',8,C('SOC+1'),C('SOC-1'))]],['Prove courage',[RAND('1D',[[1,3,[I()]],[4,6,[relationship('Rival'),A(4),stat('SOC',1)]]])]]])],
 10:[officerOpportunity('aslan.military-officer')],
 11:[Q([['Tactics',[genderAward('male',C('Tactics (military)'))]],['Advancement',[M('advancement',4,'one')]]])],12:[P()]
},{
 1:[I(2,'lower')],2:[relationship('Rival')],3:C('Gun Combat / Stealth / Streetwise / Survival'),4:C('SOC-1'),
 5:[Q([['Fight',[K('Athletics|Gun Combat',8,[stay()],[I(),ST('exit')])]],['Retreat',[ST('exit')]]])],6:[I()]
});
outcomes('aslan.military-officer',{
 3:[Q([['Drive',C('Drive')],['Heavy Weapons',[genderAward('male',C('Heavy Weapons'))]],['Stealth',C('Stealth')],['Vacc Suit',C('Vacc Suit')]])],
 4:[K('Melee|Persuade',8,[relationship('Ally')],[stat('SOC',-1),relationship('Rival')])],
 5:C('Carouse / Streetwise / Independence / Survival'),6:[K('EDU',8,[ANY()])],8:[benefit('Clan Share',6)],
 9:[Q([['Ransom',[benefit('Clan Share',3)]],['Release',[relationship('Ally')]]])],
 10:[Q([['Refuse',[DSTAT('SOC','1D',-1)]],['Duel',[K('Melee',8,[A(2)],[noTerm()])]]])],
 11:[Q([['Tactics',C('Tactics (military)')],['Advancement',[A(4)]]])],12:[P()]
},{
 1:[I(2,'lower')],2:[outcast(),ST('next','aslan.outcast')],3:C('SOC-2'),4:[relationship('Rival')],5:[relationship('Contact')],6:[I()]
});
outcomes('aslan.scientist',{
 3:C('Carouse=1 / Streetwise=1 / Survival=1 / @Contact'),
 4:[Q([['Engineer',[genderAward('female',C('Engineer=1'))]],['Gun Combat',C('Gun Combat=1')],['Gunner',[genderAward('male',C('Gunner=1'))]],['Science',[genderAward('female',C('Science=1'))]]])],
 5:[skill('Tolerance',1,'set'),relationship('Contact')],6:[K('EDU',8,[ANY()])],
 8:[Q([['Admin',C('Admin=1')],['Art',C('Art=1')],['Science',[genderAward('female',C('Science=1'))]],['Contact',[relationship('Contact')]]])],
 9:[Q([['Research',[K('Science',10,[A(2),relationship('Rival')],[noTerm()])]],['Sabotage',[K('Stealth|Deception',8,[A(2),relationship('Enemy')],[stat('SOC',-2)])]],['Do nothing',[]]])],
 10:[K('Science',8,[A(2)],[A(-2)])],11:[Q([['Investigate',C('Investigate')],['Advancement',[A(4)]]])],12:[P()]
},{
 1:[I()],2:C('END-1'),3:[relationship('Rival'),OPT('Continue',[stay(),noTerm()])],
 4:[Q([['Astrogation',[genderAward('female',C('Astrogation=1'))]],['Mechanic',[genderAward('female',C('Mechanic=1'))]],['Science',[genderAward('female',C('Science=1'))]],['Survival',C('Survival=1')]])],
 5:[OPT('Challenge',[K('Melee (natural)',8,[stat('SOC',1),stay()],[stat('SOC',-2),ST('exit')])])],
 6:[OPT('Continue in human space',[ST('auto-qualify','core.scholar')])]
});
outcomes('aslan.spacer',{
 3:[K('Gunner|Mechanic|Pilot',8,[A(2)],[noTerm(),relationship('Enemy')])],
 4:[OPT('Smuggle',[K('Deception',8,[R(3)],[A(-6)])])],
 5:[officerOpportunity('aslan.space-officer')],
 6:[Q([['Science',[genderAward('female',C('Science'))]],['Streetwise',C('Streetwise')],['Survival',C('Survival')],['Tolerance',C('Tolerance')]])],
 8:[relationship('Contact')],
 9:[Q([['Heroism',[K('END',9,[],[I()]),A(2)]],['Prudence',[K('Stealth',8,[],C('SOC-1'))]]])],
 10:[officerOpportunity('aslan.space-officer')],
 11:[Q([['Steward',[genderAward('female',C('Steward'))]],['Advancement',[M('advancement',4,'one')]]])],12:[P()]
},{
 1:[I(2,'lower')],2:[relationship('Rival')],3:[K('END',8,[],C('END-1'))],4:C('SOC-2'),
 5:[K('Tolerance',8,[noTerm(),stay()],[ST('exit')])],6:[I()]
});
outcomes('aslan.space-officer',{
 3:[K('Tactics|Engineer',8,[A(2)],[noTerm(),relationship('Enemy')])],
 4:[OPT('Smuggle',[K('Deception',8,[R(6)],[ST('exit'),outcast()])])],
 5:[Q([['Diplomat',C('Diplomat')],['Language',C('Language')],['Science',[genderAward('female',C('Science'))]],['Tolerance',C('Tolerance')]])],
 6:[K('EDU',8,[ANY()])],8:[benefit('Clan Share',6)],
 9:[OPT('Use harsh tactics',[benefit('Clan Share',6),stat('SOC',-2)])],
 10:[Q([['Refuse',[DSTAT('SOC','1D',-1)]],['Duel',[K('Melee',8,[A(2)],[noTerm()])]]])],
 11:[Q([['Tactics',[genderAward('male',C('Tactics (naval)'))]],['Advancement',[M('advancement',4,'one')]]])],12:[P()]
},{
 1:[I(2,'lower')],2:[K('Advocate|Melee',8,[BR('retain-term')])],3:C('SOC-2'),4:[relationship('Rival')],5:[relationship('Contact')],6:[I()]
});
outcomes('aslan.outcast',{
 3:[M('qualification',4,'next','any'),{kind:'note',text:'Owe a patron a substantial favour.'}],
 4:C('Jack-of-all-Trades'),
 5:[Q([['Engineer',[genderAward('female',C('Engineer'))]],['Mechanic',[genderAward('female',C('Mechanic'))]],['Tolerance',C('Tolerance')],['Vacc Suit',C('Vacc Suit')]])],
 6:[relationship('Contact')],
 8:[Q([['Fight',[K('Melee',10,[R(1)],[noTerm()])]],['Escape',[K('Stealth',8,[],[noTerm()])]]])],
 9:[OPT('Join expedition',[relationship('Ally'),{kind:'career-status',action:'next',careerGroup:'core'}])],
 10:[{kind:'career-status',action:'auto-qualify',careerChoices:['aslan.outlaw','aslan.wanderer']}],
 11:[OPT('Accept redemption',[{kind:'aslan-restore-status',from:'initial-SOC'},{kind:'note',text:'Owe a clan elder a substantial favour.'}])],
 12:[P()]
},{
 1:[I(2,'lower')],2:[{kind:'relationship-remove',types:['Ally','Contact'],count:1,ifAbsent:[noTerm()]}],
 3:[I(),relationship('Enemy')],4:C('END-1'),5:[noTerm()],6:[I()]
});
outcomes('aslan.outlaw',{
 3:[stat('END',-1),ANY()],4:[R(1)],
 5:[Q([['Evade bounty',[relationship('Enemy'),...C('Gun Combat / Stealth / Streetwise / Survival')]],['Claim reward',[K('Deception',8,[R(3)],[stat('END',-2),ST('exit')])]]])],
 6:[relationship('Contact')],8:C('Electronics / Gun Combat / Independence / Stealth'),
 9:[K('Gun Combat|Pilot|Stealth',8,[Q([['Benefit',[R(1)]],['Status',C('SOC+1')]])],[I()])],
 10:[Q([['Accept mission',[K('Stealth',8,[R(1)])]],['Inform enemies',[R(1),relationship('Enemy')]]])],
 11:[U('aslan.outlaw',43,'Male: 3 Clan Shares, restore original SOC and leave. Unmarried female may marry, reroll SOC and leave.')],
 12:[P()]
},{
 1:[I(2,'lower')],2:[stat('END',-2),relationship('Enemy')],3:[I(),noTerm()],
 4:C('Deception=1 / Independence=1 / Pilot=1 / Streetwise=1'),
 5:[{kind:'relationship-change',from:['Ally','Contact'],to:['Rival'],fallback:true}],6:[I()]
});
outcomes('aslan.wanderer',{
 3:[K('Pilot|Gunner',8,[],[M('survival',-2)])],
 4:[skill('Tolerance'),Q([['Broker',[genderAward('female',C('Broker=1'))]],['Diplomat',C('Diplomat=1')],['Independence',C('Independence=1')],['Contact',[relationship('Contact')]]])],
 5:[K('Independence',8,[R(1)])],6:[relationship('Contact')],
 8:[Q([['Engineer',[genderAward('female',C('Engineer'))]],['Gunner',[genderAward('male',C('Gunner (turret)'))]],['Mechanic',[genderAward('female',C('Mechanic'))]],['Pilot',C('Pilot (spacecraft)')]])],
 9:[K('Carouse|Streetwise',8,[relationship('Ally')],[noTerm(),relationship('Enemy')])],
 10:[K('Survival|Pilot',8,[relationship('Contact'),ANY()],[T('mishap',{dice:'1D',keepCareer:true})])],
 11:[A(2)],12:[U('aslan.wanderer',45,'Raise SOC to at least9, then receive a landhold at the SOC-based parcel size.')]
},{
 1:[I(2,'lower')],
 2:[Q([['Animals',C('Animals=1')],['Mechanic',[genderAward('female',C('Mechanic=1'))]],['Survival',C('Survival=1')],['Recon',C('Recon=1')]])],
 3:C('END-1'),4:[K('Pilot',8,[],[I()])],5:[genderAward('female',C('Mechanic')),relationship('Rival')],6:[I()]
});



export const EXPANSION_TABLES = {
 'aslan.life-events':{source:citation('aliens',46),dice:'2D',results:{
  2:[I()],3:[{kind:'note',text:'A birth or death affects a close relationship.'}],
  4:[U('aslan',46,'Broker, Diplomat, Gun Combat or Melee (natural) check changes land by Effect increments, or SOC when landless; the source does not supply a target.')],
  5:[{kind:'note',text:'Marriage or household membership changes.'}],
  6:[T('aslan.clan-events',{dice:'1D'})],7:[relationship('Contact')],8:[T('aslan.clan-events',{dice:'1D'})],
  9:[M('qualification',2,'next','any')],
  10:[Q([['Refuse',C('SOC-1')],['Duel',[K('Melee (natural)',8,C('SOC+1'),C('SOC-2'))]]])],
  11:[U('aslan',46,'Defend using Advocate8 (+2 with a clan Contact/Ally) or Melee(natural)10. Failure sets SOC2 and Outcast status.')],
  12:[T('aslan.unusual-events',{dice:'1D'})]
 }},
 'aslan.clan-events':{source:citation('aliens',46),dice:'1D',results:{
  1:[Q([['Benefit',[R(1)]],['Advancement',[A(2)]]])],2:C('SOC+1'),3:[relationship('Ally')],4:[relationship('Enemy')],
  5:[{kind:'conditional',condition:{gender:'male'},then:[M('survival',-2)],otherwise:[R(-1)]}],6:[A(-4),noTerm()]
 }},
 'aslan.unusual-events':{source:citation('aliens',46),dice:'1D',results:{
  1:[{kind:'note',text:'Encounter a psionic phenomenon; source supplies no automatic testing award.'}],
  2:C('Tolerance'),3:[benefit('Alien artefact')],4:[{kind:'note',text:'Unexplained memory gap.'}],
  5:[{kind:'note',text:'Clan elders offer a mission or secret.'}],6:[benefit('Ancient technology')]
 }},
 'aslan.rite-doubles':{source:citation('aliens',21),dice:'2D',onlyDoubles:true,results:{
  2:[{kind:'benefit',name:'Clan Share',value:1,dice:'1D'}],
  4:[{kind:'conditional',condition:{gender:'female'},then:[{kind:'cash',value:5000}],otherwise:[{kind:'equipment-credit',credits:5000,categories:['Art','Armour','Weapon']}]}],
  6:[relationship('Contact')],8:[relationship('Rival')],10:[{kind:'note',text:'Distinctive rite scar.'}],12:C('END+1')
 }},
 'vargr.life-events':{source:citation('aliens',206),dice:'2D',results:{
  2:[I()],3:[{kind:'note',text:'A birth or death affects a close relationship.'}],
  4:[RAND('1D',[[1,2,[{kind:'note',text:'Partner dies.'}]],[3,4,[{kind:'note',text:'Partner ends the relationship.'}]],[5,6,[{kind:'note',text:'Traveller ends the relationship.'}]]])],
  5:[{kind:'note',text:'A new romantic relationship begins.'}],6:[T('vargr.pack-events',{dice:'1D'})],7:[relationship('Contact')],8:[T('vargr.pack-events',{dice:'1D'})],
  9:[M('qualification',2,'next','any')],10:[Q([['Benefit',[R(1)]],['Charisma',C('CHA+1')]])],11:C('CHA-1'),12:[T('vargr.unusual-events',{dice:'1D'})]
 }},
 'vargr.pack-events':{source:citation('aliens',206),dice:'1D',results:{
  1:C('CHA-1'),2:[K('CHA',6,[],[ST('exit')])],3:[{kind:'note',text:'Join a new pack.'}],
  4:[RAND('1D',[[1,3,[relationship('Rival')]],[4,6,[relationship('Ally')]]])],5:C('CHA+1'),
  6:[U('vargr',206,'Choose Leadership or CHA check at10. Success makes the Traveller pack leader; failure grants a Rival.')]
 }},
 'vargr.unusual-events':{source:citation('aliens',206),dice:'1D',results:{
  1:[{kind:'psionic-testing-opportunity',nextCareer:'vargr.psion',qualificationRequired:true}],
  2:[...C('Language=1 / Science=1'),relationship('Contact')],3:[benefit('Alien artefact')],
  4:[{kind:'note',text:'Unexplained memory gap.'}],5:C('CHA+1'),6:[benefit('Ancient technology')]
 }},
 'zhodani.life-events':{source:citation('aliens',277),dice:'2D',results:{
  2:[I()],3:[{kind:'note',text:'A birth or death affects a close relationship.'}],
  4:[RAND('1D',[[1,2,[{kind:'note',text:'Partner dies.'}]],[3,4,[{kind:'note',text:'Partner ends the relationship.'}]],[5,6,[{kind:'note',text:'Traveller ends the relationship.'}]]])],
  5:[{kind:'note',text:'A relationship deepens.'}],6:[{kind:'relationship-event',existingTypes:['Ally','Contact'],ifAbsent:[relationship('Ally')]}],
  7:[relationship('Contact')],8:[{kind:'relationship-change',from:['Contact','Ally'],to:['Rival','Enemy'],fallback:true}],
  9:[M('qualification',2,'next','any')],10:[R(1)],11:[K('SOC',8,[],[R(-1),RE()])],12:[T('zhodani.unusual-events',{dice:'1D'})]
 }},
 'zhodani.unusual-events':{source:citation('aliens',277),dice:'1D',results:{
  1:[stat('PSI',2),{kind:'zhodani-status-review',intendantPSIMin:9,SOC:10,trainPsionics:true}],
  2:[skill('Language'),relationship('Contact')],3:[benefit('Alien artefact')],4:[RE()],5:[R(1)],6:[benefit('Ancient technology')]
 }},
 'zhodani.re-education':{source:citation('aliens',276),dice:'1D',anagathicsDMPerTerm:-1,results:{
  1:[{kind:'age',years:4,careerTerm:false},ST('exit'),stat('END',-1),SOC(11,[stat('SOC',-1,{minimum:11})])],
  2:[{kind:'age',years:4,careerTerm:false},stay()],
  3:[ST('exit'),{kind:'duration',lessThanYears:1}],
  4:[{kind:'duration',lessThanYears:1}],
  5:[{kind:'cash',dice:'1D',multiplier:-1000}],
  6:[R(1)]
 }}
};
SPECIES_RULES.aslan.familySkills={
 source:citation('aliens',17),outcast:{SOC:2,rolls:table('Deception=0 / Melee=0|Jack-of-all-Trades=1|Survival=0|Independence=0|Language=0 / Tolerance=0|Deception=0 / Medic=0')},
 lower:{SOCMin:3,SOCMax:5,rolls:table('Animals=0 / Profession=0|-|Mechanic=0|-|Survival=0 / Vacc Suit=0|-')},
 middle:{SOCMin:6,SOCMax:8,rolls:table('-|-|Art=0|-|-|-')},higher:{SOCMin:9,rolls:table('-|-|-|-|-|-')}
};
SPECIES_RULES.aslan.land={source:citation('aliens',17),rows:Array.from({length:9},(_,i)=>({SOC:9+i,parcels:10**(i+1),increment:2*10**i}))};
SPECIES_RULES.aslan.medicalBills={source:citation('aliens',49),creditsPerPoint:5000,dice:'2D',addRank:true,thresholds:[4,8,12],
 reimbursementPercent:{military:[75,100,100],ceremonial:[50,75,100],management:[0,50,75]},
 excluded:['aslan.outcast','aslan.outlaw','aslan.wanderer']};
SPECIES_RULES.zhodani.source.pages.push(277);
SPECIES_RULES.zhodani.proleSOC={maximum:9,overflowBenefit:'Ship Share',exception:'elevation-through-PSI'};
SPECIES_RULES.zhodani.pension={onlyInConsulate:true,nobleMultiplier:2};
SPECIES_RULES.zhodani.psiAgeingZero={crisis:false,permanentlyLosePsionics:true,changeSOC:false};
SPECIES_RULES.zhodani.anagathics={creditsPerTerm:{dice:'2D',multiplier:200000},reeducationDMPerTerm:-1};
BENEFIT_RULES.vargrShip={source:citation('aliens',206,207),mortgagePaidPercentPerAward:25,outdatedRollCount:'1D',
 types:{Corsair:'Ueknou',Courier:'Avouz',Trader:'Rourrghksue Aeknaek'},
 scout:{model:'Aetin',ownership:'pack',repeat:'reroll',outdatedRollCount:'1D'},
 boat:{maximumCredits:10000000,maximumTL:12,repeat:[skill('Pilot (small craft)')]}
};
SOURCE_DISCREPANCIES.push({id:'aslan.wanderer.female-awards',source:citation('aliens',44,45),entry:'male-only',awards:'Some event/mishap options are marked female-only',resolution:'Do not ignore gender marks; unresolved forced award requires referee review'});
SOURCE_DISCREPANCIES.push({id:'zhodani.life-events.dice-label',source:citation('aliens',277),printed:'1D heading; outcomes 2-12',resolution:'2D from table range and Core life-event rule'});

function visit(value,fn){
 if(!value||typeof value!=='object')return;
 if(value.kind)fn(value);
 for(const child of Object.values(value))visit(child,fn);
}
const PSIONIC_TALENTS=['Awareness','Clairvoyance','Telekinesis','Telepathy','Teleportation','Technopathy'];
for(const c of Object.values(builds)){
 visit(c,e=>{if(e.kind==='skill'&&PSIONIC_TALENTS.includes(e.name))e.kind='psionic-talent';});
 const unresolved=[];
 visit(c,e=>{if(e.kind==='source-required')unresolved.push({reason:e.reason,source:e.source});});
 c.unsupported=unresolved;
 const coverage=x=>{let partial=false;visit(x,e=>{if(e.kind==='source-required')partial=true;});return partial?'partial':'encoded';};
 c.coverage={training:'complete',ranks:coverage(c.ranks),benefits:'table-results',events:coverage(c.events),mishaps:coverage(c.mishaps)};
}
export const EXPANSION_EFFECT_SCHEMA={
 ...Object.fromEntries(['skill','stat','choice','benefit','relationship','check','modifier','benefit-rolls','table-roll','career-status','promotion','injury','random','psionic-talent'].map(kind=>[kind,'Shared Core effect contract'])),
 conditional:'condition: {gender} or {stat,min}; then and otherwise effect arrays',
 independence:'male only; roll 2D strictly greater than SOC before granting skill',
 'assignment-effect':'select effects by current assignment',
 'source-required':'reason and printed-page citation; never auto-resolve',
 'stat-dice':'stat effects may include dice, multiplier and add; cap/floor rules still apply',
 'expanded-scopes':'Unknown skill-choice scopes, countFrom, linked awards, payment choices and career overrides require source-assisted resolution'
};
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}
[EXPANSION_PACK,PRECAREER_RULES,SPECIES_RULES,EXPANSION_TABLES,BENEFIT_RULES,SOURCE_DISCREPANCIES,EXPANDED_CHARACTERISTIC_DM,EXPANSION_EFFECT_SCHEMA].forEach(deepFreeze);
