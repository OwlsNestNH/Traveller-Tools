// Presentation metadata only: symbols do not imply facing, allegiance rules or scale.
export const SIDES=Object.freeze({A:{label:'Side A',color:'#75e0d4'},B:{label:'Side B',color:'#ffad86'}});
export const ICONS=Object.freeze({
 auto:{label:'Automatic from design'},
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
export function iconFor(ship){
 const {icon}=normalizeAppearance(ship.appearance);if(icon!=='auto')return icon;
 const t=ship.template,n=(t?.name??'').toLowerCase();
 if(n.includes('empress marava'))return 'marava';
 if(n.includes('laboratory')||n.includes('research'))return 'research';
 if(n.includes('corsair'))return 'corsair';
 if(n.includes('fighter'))return 'fighter';
 if(n.includes('system defence'))return 'sdb';
 if(n.includes('corvette')||n.includes('close escort'))return 'corvette';
 if(n.includes('scout')||n.includes('seeker'))return 'scout';
 if(t&&t.tons<100)return 'small-craft';
 if(n.includes('trader')||n.includes('merchant'))return 'trader';
 return 'other';
}
// Original code-native fallback glyphs, deliberately not copied ship artwork.
export function fallbackGlyph(icon,color){
 if(icon==='research')return `<g fill="${color}"><path fill-rule="evenodd" d="M 0 -19 A 19 19 0 1 1 0 19 A 19 19 0 1 1 0 -19 M 0 -12 A 12 12 0 1 0 0 12 A 12 12 0 1 0 0 -12"/><circle r="4"/><path d="M -2 -14 H 2 V 0 H -2 Z M -1 0 L -12 8 L -10 11 L 1 2 Z M 1 0 L 12 8 L 10 11 L -1 2 Z"/></g>`;
 if(icon==='corsair')return `<path fill="${color}" d="M 0 -21 L 8 -7 L 20 -13 L 15 8 L 7 12 L 4 20 H -4 L -7 12 L -15 8 L -20 -13 L -8 -7 Z"/>`;
 return `<path fill="${color}" d="M 0 -20 L 15 -8 L 15 9 L 6 19 H -6 L -15 9 L -15 -8 Z"/>`;
}
