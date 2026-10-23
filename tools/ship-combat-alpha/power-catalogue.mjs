const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
// Installed-only optional equipment. Quantities are explicit, never inferred from crew/fuel capacity.
const hg=page=>({book:'High Guard Update 2022',page});
export const EQUIPMENT=freeze([
 {id:'low-berths',name:'Low berths',unit:'berths',draw:n=>Math.ceil(n/10),source:{book:'Core Rulebook Update 2022',page:182}},
 {id:'emergency-berths',name:'Emergency low berths',unit:'units',draw:n=>n,source:hg(24)},
 {id:'holographic-hull',name:'Holographic hull',unit:'hull tons',draw:n=>n/2,source:hg(58)},
 {id:'fuel-processors',name:'Fuel processors',unit:'processor tons',draw:n=>n,source:hg(49)},
 {id:'medical-bay',name:'Medical bays',unit:'four-ton bays',draw:n=>n,source:hg(62)},
 {id:'countermeasures',name:'Countermeasures',unit:'units',draw:n=>n,source:hg(55)},
 {id:'military-countermeasures',name:'Military countermeasures',unit:'units',draw:n=>n*2,source:hg(55)},
 {id:'life-scanner',name:'Life scanners / analysis suites',unit:'units',draw:n=>n,source:hg(56)},
 {id:'grav-screen',name:'Grav screen',unit:'equipment tons',draw:n=>n*2,source:hg(61)},
 {id:'loading-belt',name:'Loading belts',unit:'units',draw:n=>n,source:hg(53)},
 {id:'biosphere',name:'Biospheres',unit:'units',draw:n=>n,source:hg(59)},
 {id:'turret-mount',name:'Turret mount only',unit:'units',draw:n=>n*1,source:hg(28)},
 {id:'turret-beam',name:'Turret beam laser',unit:'units',draw:n=>n*4,source:hg(28)},
 {id:'turret-pulse',name:'Turret pulse laser',unit:'units',draw:n=>n*4,source:hg(28)},
 {id:'turret-fusion',name:'Turret fusion gun',unit:'units',draw:n=>n*12,source:hg(28)},
 {id:'turret-missile',name:'Turret missile rack',unit:'units',draw:n=>n*0,source:hg(28)},
 {id:'turret-particle',name:'Turret particle beam',unit:'units',draw:n=>n*8,source:hg(28)},
 {id:'turret-plasma',name:'Turret plasma gun',unit:'units',draw:n=>n*6,source:hg(28)},
 {id:'turret-railgun',name:'Turret railgun',unit:'units',draw:n=>n*2,source:hg(28)},
 {id:'turret-sand',name:'Turret sandcaster',unit:'units',draw:n=>n*0,source:hg(28)},
 {id:'barbette-beam',name:'Beam laser barbette',unit:'units',draw:n=>n*12,source:hg(30)},
 {id:'barbette-fusion',name:'Fusion barbette',unit:'units',draw:n=>n*20,source:hg(30)},
 {id:'barbette-ion',name:'Ion barbette',unit:'units',draw:n=>n*10,source:hg(30)},
 {id:'barbette-missile',name:'Missile barbette',unit:'units',draw:n=>n*0,source:hg(30)},
 {id:'barbette-particle',name:'Particle barbette',unit:'units',draw:n=>n*15,source:hg(30)},
 {id:'barbette-plasma',name:'Plasma barbette',unit:'units',draw:n=>n*12,source:hg(30)},
 {id:'barbette-pulse',name:'Pulse laser barbette',unit:'units',draw:n=>n*12,source:hg(30)},
 {id:'barbette-railgun',name:'Railgun barbette',unit:'units',draw:n=>n*5,source:hg(30)},
 {id:'barbette-torpedo',name:'Torpedo barbette',unit:'units',draw:n=>n*2,source:hg(30)},
 {id:'meson-screen',name:'Meson screen',unit:'units',draw:n=>n*30,source:hg(41)},
 {id:'nuclear-damper',name:'Nuclear damper',unit:'units',draw:n=>n*20,source:hg(41)},
 {id:'environment',name:'Multi-environment support',unit:'environmental equipment tons',draw:n=>n,source:hg(51)}
]);
export function equipment(id){const e=EQUIPMENT.find(e=>e.id===id);if(!e)throw Error('Choose listed equipment.');return e;}
