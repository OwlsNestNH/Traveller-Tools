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
const cartridgeIds=['personal-defence-laser','cartridge-laser-carbine-10','cartridge-laser-carbine-12','cartridge-laser-rifle-10','cartridge-laser-rifle-12','cppg-11','cppg-12','cppg-13','light-gatling-laser'];
// Explicit source-qualified profiles only. Fuel/chemical sprays, unspecified pack
// locations, integral supplies without replacement prices and direct payloads do
// not gain a magazine estimate by sharing a weapon family or mount size.
const registry=new Map([
 ...slugIds.map(id=>['csc-'+id,{kind:'round-load',pages:'142-148'}]),
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
