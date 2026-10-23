// Presentation metadata only: symbols do not imply facing, allegiance rules or scale.
export const SIDES=Object.freeze({A:{label:'Side A',color:'#75e0d4'},B:{label:'Side B',color:'#ffad86'}});
export const ICONS=Object.freeze({
 auto:{label:'Automatic from design'},
 "close-escort":{label:"Gazelle Close Escort family token \u2014 illustrated attachments do not specify current configuration",file:"close_escort.webp"},
 "far-trader":{label:"Type A2 / Hero Far Trader family token",file:"far_trader.webp"},
 "gig":{label:"Gig token",file:"gig.webp"},
 "launch":{label:"Launch token",file:"launch.webp"},
 "military-gig":{label:"Military Gig token",file:"military_gig.webp"},
 "modular-cutter":{label:"Modular Cutter token",file:"modular_cutter.webp"},
 "passenger-shuttle":{label:"Passenger Shuttle token",file:"passenger_shuttle.webp"},
 "pinnace":{label:"Pinnace token",file:"pinnace.webp"},
 "safari":{label:"Safari Ship token",file:"safari_ship.webp"},
 "seeker":{label:"Seeker Mining Ship token",file:"seeker.webp"},
 "shuttle":{label:"Shuttle token",file:"shuttle.webp"},
 "slow-boat":{label:"Slow Boat token",file:"slow_boat.webp"},
 "slow-pinnace":{label:"Slow Pinnace token",file:"slow_pinnace.webp"},
 "subsidised-merchant":{label:"Subsidised Merchant token",file:"subsidised_merchant.webp"},
 "survey-scout":{label:"Donosev Survey Scout family token",file:"survey_scout.webp"},
 "yacht":{label:"Type Y Yacht token",file:"yacht.webp"},
 marava:{label:'Empress Marava token',file:'empress_marava.webp'},
 trader:{label:'Trader — Free Trader token (representative)',file:'free_trader.webp'},
 scout:{label:'Scout — Scout token (representative)',file:'scout.webp'},
 fighter:{label:'Fighter — Light Fighter token (representative)',file:'light_fighter.webp'},
 'small-craft':{label:'Small craft — Ship’s Boat token (representative)',file:'ships_boat.webp'},
 sdb:{label:'SDB — System Defence Boat token (representative)',file:'system_defence_boat.webp'},
 corvette:{label:'Corvette / escort — Patrol Corvette token (representative)',file:'patrol_corvette.webp'},
 research:{label:'Research ship — custom toroid symbol, not a canonical hull'},
 corsair:{label:'Corsair — custom fallback symbol, not a canonical hull'},
 other:{label:'Other — custom generic symbol, not a canonical hull'}
});
export function normalizeAppearance(value={}){
 const side=value.side??'A',icon=value.icon??'auto';
 if(!Object.hasOwn(SIDES,side)||!Object.hasOwn(ICONS,icon))throw Error('Choose Side A or B and an available map symbol.');
 return {side,icon};
}
// Explicit source identity avoids guessing hulls from broad class names or tonnage.
// All 55 presets are covered; missing variants stay custom instead of borrowing a different ship.
export const PRESET_ICONS=Object.freeze({
 "Core Rulebook Update 2022/190": "scout",
 "Core Rulebook Update 2022/192": "seeker",
 "Core Rulebook Update 2022/194": "trader",
 "Core Rulebook Update 2022/196": "far-trader",
 "Core Rulebook Update 2022/198": "safari",
 "Core Rulebook Update 2022/200": "sdb",
 "Core Rulebook Update 2022/202": "yacht",
 "Core Rulebook Update 2022/204": "close-escort",
 "Core Rulebook Update 2022/206": "research",
 "Core Rulebook Update 2022/208": "corvette",
 "Core Rulebook Update 2022/210": "subsidised-merchant",
 "Core Rulebook Update 2022/212": "survey-scout",
 "Core Rulebook Update 2022/218": "fighter",
 "Core Rulebook Update 2022/219": "gig",
 "Core Rulebook Update 2022/220": "launch",
 "Core Rulebook Update 2022/221": "small-craft",
 "Core Rulebook Update 2022/222": "slow-boat",
 "Core Rulebook Update 2022/223": "pinnace",
 "Core Rulebook Update 2022/224": "slow-pinnace",
 "Core Rulebook Update 2022/225": "modular-cutter",
 "Core Rulebook Update 2022/226": "shuttle",
 "Core Rulebook Update 2022/227": "passenger-shuttle",
 "High Guard Update 2022/158": "other",
 "High Guard Update 2022/136": "other",
 "High Guard Update 2022/137": "fighter",
 "High Guard Update 2022/138": "military-gig",
 "High Guard Update 2022/139": "launch",
 "High Guard Update 2022/140": "small-craft",
 "High Guard Update 2022/141": "slow-boat",
 "High Guard Update 2022/142": "pinnace",
 "High Guard Update 2022/143": "slow-pinnace",
 "High Guard Update 2022/144": "modular-cutter",
 "High Guard Update 2022/148": "other",
 "High Guard Update 2022/150": "other",
 "High Guard Update 2022/152": "other",
 "High Guard Update 2022/154": "shuttle",
 "High Guard Update 2022/156": "passenger-shuttle",
 "High Guard Update 2022/160": "scout",
 "High Guard Update 2022/162": "seeker",
 "High Guard Update 2022/165": "other",
 "High Guard Update 2022/167": "marava",
 "High Guard Update 2022/169": "far-trader",
 "High Guard Update 2022/171": "trader",
 "High Guard Update 2022/173": "safari",
 "High Guard Update 2022/175": "sdb",
 "High Guard Update 2022/177": "other",
 "High Guard Update 2022/179": "yacht",
 "High Guard Update 2022/181": "close-escort",
 "High Guard Update 2022/183": "other",
 "High Guard Update 2022/185": "research",
 "High Guard Update 2022/187": "corvette",
 "High Guard Update 2022/189": "subsidised-merchant",
 "High Guard Update 2022/191": "survey-scout",
 "High Guard Update 2022/193": "other",
 "High Guard Update 2022/195": "corsair"
});
export function iconFor(ship){
 const {icon}=normalizeAppearance(ship.appearance);if(icon!=='auto')return icon;
 const source=ship.template?.source;
 return source?PRESET_ICONS[source.book+'/'+source.page]??'other':'other';
}
// Original code-native fallback glyphs, deliberately not copied ship artwork.
export function fallbackGlyph(icon,color){
 if(icon==='research')return `<g fill="${color}"><path fill-rule="evenodd" d="M 0 -19 A 19 19 0 1 1 0 19 A 19 19 0 1 1 0 -19 M 0 -12 A 12 12 0 1 0 0 12 A 12 12 0 1 0 0 -12"/><circle r="4"/><path d="M -2 -14 H 2 V 0 H -2 Z M -1 0 L -12 8 L -10 11 L 1 2 Z M 1 0 L 12 8 L 10 11 L -1 2 Z"/></g>`;
 if(icon==='corsair')return `<path fill="${color}" d="M 0 -21 L 8 -7 L 20 -13 L 15 8 L 7 12 L 4 20 H -4 L -7 12 L -15 8 L -20 -13 L -8 -7 Z"/>`;
 return `<path fill="${color}" d="M 0 -20 L 15 -8 L 15 9 L 6 19 H -6 L -15 9 L -15 -8 Z"/>`;
}
