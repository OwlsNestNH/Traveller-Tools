// Fictional Traveller storage estimates. These are CSC guidelines, not measured masses.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const slugIds=[
 'assault-pistol','cartridge-pistol','coach-pistol','flechette-pistol','heavy-revolver','magrail-pistol','shot-pistol','universal-auto-pistol','zip-gun',
 'accelerator-rifle-11','air-rifle-3','air-rifle-4','assault-shotgun','big-game-rifle','flechette-submachine-gun','gauss-assault-gun','gauss-rifle','gauss-sniper-rifle','gauss-submachinegun','magrail-rifle','sawn-off-shotgun','light-shotgun','sniper-rifle','snub-carbine','spear-gun',
 'heavy-advanced-combat-rifle',...[4,5,6,7,8].map(n=>'ducks-foot-pistol-'+n)
];
const heavyRoundIds=[
 'anti-materiel-rifle','arl-standard','arl-support','arl-pdw','early-machinegun','machinegun','rapid-fire-machinegun','heavy-machinegun','light-assault-gun','vrf-gauss-gun','vrf-machinegun',
 ...[6,7,8,9].map(tl=>'rocket-launcher-'+tl),'rocket-pod','tac-launcher-anti-aircraft','tac-launcher-anti-personnel','tac-launcher-armour-piercing'
];
const projectileIds=['compound-cam-bow','crossbow','long-bow','repeating-crossbow','short-bow'];
const cartridgeIds=['personal-defence-laser','cartridge-laser-carbine-10','cartridge-laser-carbine-12','cartridge-laser-rifle-10','cartridge-laser-rifle-12','cppg-11','cppg-12','cppg-13','light-gatling-laser'];
// Explicit source-qualified profiles only. Fuel/chemical sprays, unspecified pack
// locations, integral supplies without replacement prices and direct payloads do
// not gain a magazine estimate by sharing a weapon family or mount size.
const registry=new Map([
 ...slugIds.map(id=>['csc-'+id,{kind:'round-load',pages:'142-148'}]),
 ...projectileIds.map(id=>['csc-'+id,{kind:'projectile-load',pages:'154'}]),
 ...heavyRoundIds.map(id=>['csc-'+id,{kind:'round-load',pages:'160-173'}]),
 ...['grenade-launcher-standard','ram-grenade-launcher-standard'].map(id=>['csc-'+id,{kind:'round-load',pages:'160-163'}]),
 ...cartridgeIds.map(id=>['csc-'+id,{kind:'cartridge-magazine',pages:'149-153,160-163'}]),
 ['csc-gauntlet-laser',{kind:'external-power-pack',pages:'149'}],
 ['csc-laser-pistol-11',{kind:'external-power-pack',pages:'149'}],
 ['csc-heavy-laser-rifle',{kind:'internal-power-pack',pages:'151'}],
 ['csc-stun-carbine',{kind:'internal-power-pack',pages:'152'}]
]);
export const CSC_AMMUNITION_ESTIMATE_IDS=Object.freeze([...registry.keys()]);

export function estimateCscMagazineMass(weapon){
 const entry=registry.get(weapon?.id);
 if(!entry||weapon.sourceFamily!=='csc-2023'||weapon.ammunitionAccounting?.replacementPurchasesSupported===false||!Number.isSafeInteger(weapon.magazine)||weapon.magazine<=0||!Number.isFinite(weapon.magazineCost)||weapon.magazineCost<0)return null;
 // Only a source-transcribed dash (null), not missing model data, uses the fallback.
 const fallback=weapon.massKg===null,basisMassKg=fallback ? .2 : weapon.massKg;
 if(!Number.isFinite(basisMassKg)||basisMassKg<=0)return null;
 const factor=entry.kind==='external-power-pack' ? .6 : entry.kind==='internal-power-pack' ? .2 : .1*weapon.magazine/20;
 const unitMassKg=Math.round(basisMassKg*factor*1e9)/1e9;
 return {estimated:true,unitMassKg,basisWeaponMassKg:basisMassKg,unlistedWeaponMassFallback:fallback,kind:entry.kind,
  method:entry.kind.endsWith('power-pack')?'weapon-mass-percentage':'twenty-round-extrapolation',
  ...(entry.kind.endsWith('power-pack')?{weaponMassFraction:factor}:{referenceRounds:20,referenceWeaponMassFraction:.1,roundsPerLoad:weapon.magazine}),
  source:csc('142'),classificationSource:csc(entry.pages),scope:'CSC rule-of-thumb estimate; not an independently measured magazine mass.'};
}

// CSC p175 applies to magazines, including the explicitly described tubular
// CPPG magazines. A source-specific inventory avoids equating every finite
// load, cylinder, power pack or belt with a supported magazine conversion.
const highCapacityProfiles=new Map([
 ['assault-pistol','142-143'],['assault-shotgun','145-146'],
 ['arl-standard','160-161'],['arl-support','160-161'],['arl-pdw','160-161'],
 ['light-assault-gun','163'],['personal-defence-laser','150'],
 ['cartridge-laser-carbine-10','151,153'],['cartridge-laser-carbine-12','151,153'],
 ['cartridge-laser-rifle-10','151,153'],['cartridge-laser-rifle-12','151,153'],
 ['light-gatling-laser','163'],['cppg-11','160-161'],['cppg-12','160-161'],['cppg-13','160-161'],
 ['repeating-crossbow','154']
].map(([id,pages])=>['csc-'+id,pages]));
export const CSC_HIGH_CAPACITY_MAGAZINE_IDS=Object.freeze([...highCapacityProfiles.keys()]);
export function cscMagazineVariants(weapon){
 const pages=highCapacityProfiles.get(weapon?.id),standardEstimate=estimateCscMagazineMass(weapon);
 // All admitted profiles purchase the initial load separately. Included packs
 // never obtain an invented upgrade price or removal discount.
 if(!pages||!standardEstimate||weapon.initialIncluded!==false)return null;
 const qualification={refereeMayReject:true,shotgunReview:weapon.id==='csc-assault-shotgun',source:csc('175')};
 const standard={id:'standard',label:'Standard',capacity:weapon.magazine,unitCost:weapon.magazineCost,estimatedUnitMassKg:standardEstimate.unitMassKg,estimate:standardEstimate,source:{...weapon.source}};
 const highCapacity={id:'high-capacity',label:'High-capacity',tl:4,capacity:weapon.magazine*2,unitCost:weapon.magazineCost*3,estimatedUnitMassKg:Math.round(standardEstimate.unitMassKg*2*1e9)/1e9,source:csc('175'),classificationSource:csc(pages),qualification};
 highCapacity.estimate={...standardEstimate,unitMassKg:highCapacity.estimatedUnitMassKg,standardUnitMassKg:standardEstimate.unitMassKg,massMultiplier:2,roundsPerLoad:highCapacity.capacity,variantSource:csc('175')};
 return {standard,highCapacity};
}
