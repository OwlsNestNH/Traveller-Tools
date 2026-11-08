// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rows=[
 ['pepper-spray','Pepper Spray',5,'pistol',3,'Special',null,5,5,5,['Stun'],'149-150'],
 ['ion-rifle-14','Ion Rifle (TL14)',14,'rifle',600,'Special',6,16000,100,5000,['Zero-G'],'151,153'],
 ['ion-rifle-15','Ion Rifle (TL15)',15,'rifle',800,'Special',5,24000,100,8000,['Zero-G'],'151,153'],
 ['maser-pistol','Maser Pistol',17,'pistol',20,'3D+3',2,25000,12,null,['AP 10','Zero-G'],'149'],
 ['maser-rifle','Maser Rifle',16,'rifle',300,'5D+3',8,30000,20,null,['AP 10','Zero-G'],'152-153'],
 ['solar-beam-rifle','Solar Beam Rifle',17,'rifle',500,'1DD',4,200000,20,null,['AP 20','Zero-G'],'152-153'],
 ['matter-disintegrator-19','Matter Disintegrator (TL19)',19,'pistol',10,'2DD',1,4000000,null,null,['Zero-G'],'149-150']
];

function conditions(id,pages){
 const effects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,recipientVisionGranted:false,autoloadResolvesConditions:false};
 const unlimited=id==='matter-disintegrator-19',maser=id.startsWith('maser-'),solar=id==='solar-beam-rifle';
 const supply={kind:unlimited?'integral-unlimited-source':maser?'self-recharging-cell':solar?'solar-storage':'source-priced-reload',robotPowerConnectionSupported:false,unlimitedFire:unlimited,explicitUnlimited:unlimited,source:csc(pages)};
 if(unlimited){supply.location='weapon-internal';supply.effectivelyUnlimited=true;supply.source=csc('150');}
 else if(maser){
  supply.finiteBurstCapacity=true;
  supply.chargeRetention={indefinite:true,requiresUndamagedCell:true};
  supply.recharge={hours:1,automatic:true,requiresNoFiring:true,requiresUndamagedCell:true,source:csc(id==='maser-pistol'?'149':'152')};
 }else if(solar){
  supply.location='weapon-internal';supply.finiteBurstCapacity=true;
  supply.recharge={hours:2,automatic:true,requiresDirectSunlight:true,source:csc('152')};
 }else{
  supply.recharge={hours:null,cost:null,status:'not-specified-for-this-profile'};
  supply.reload={action:null,actions:null,status:'not-specified-for-this-profile'};
 }
 effects.powerSupply=supply;
 if(id==='pepper-spray'){
  supply.kind='chemical-irritant-canister';supply.recharge={hours:null,cost:null,status:'not-applicable'};
  effects.irritant={requiresSuccessfulHit:true,livingTargetOnly:true,requiresExposedFace:true,excludedProtection:['helmet','mask','respirator','sealed-suit'],check:{characteristic:'END',target:12},damage:'1D',traits:['Stun'],intervalRounds:1,stopsOnSuccessfulCheck:true,maximumDuration:'1D rounds',resolvedDamage:false,source:csc('150')};
  effects.alternativeAttack={optional:true,requiresNoGunCombatSkill:true,check:{characteristic:'DEX',target:8},automaticHit:false,source:csc('150')};
 }
 if(id.startsWith('ion-rifle-')){
  const advanced=id==='ion-rifle-15';
  effects.disruption={requiresSuccessfulHit:true,targets:['robots','powered-armour','vehicle-electronic-equipment'],resolvedEffect:false,source:csc('151'),
   personalOrRobotArmour:advanced?{anyProtection:true,duration:null,durationStatus:'TL15 duration not separately stated; TL14 1D-round duration is not assumed'}:{immuneAtProtection:20,duration:'1D rounds'},
   vehicles:advanced?{maximumAffectedArmour:8,duration:'momentary',durationRounds:null}:{immuneAtArmour:4,duration:'1D rounds'}};
 }
 return effects;
}

// Category, not mass, determines the mount. Printed dashes remain null. The
// TL18 disintegrator is excluded: its dash does not establish a shot capacity.
export const CSC_SPECIAL_ENERGY_WEAPONS=rows.map(([id,name,tl,weaponFamily,range,damage,massKg,cost,magazine,magazineCost,traits,pages])=>{
 const initialIncluded=magazineCost===null,unlimited=id==='matter-disintegrator-19';
 return {id:'csc-'+id,label:name+' (CSC 2023)',tl,weaponFamily,sourceFamily:'csc-2023',mountClass:weaponFamily==='pistol'?'small':'medium',
  range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded,skill:'gun-combat',speciality:'energy',implemented:true,
  compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
  conditionalEffects:conditions(id,pages),
  ammunitionAccounting:{initialMagazine:initialIncluded?'included-power-source':'separate-purchase',sourceInclusion:initialIncluded?'complete-weapon-cell':'not-stated',replacementPurchasesSupported:!initialIncluded,reloadKind:initialIncluded?'integral-source':'source-priced-reload',
   inclusionStatement:initialIncluded?'Complete weapon includes its described cell or integral supply; no replacement purchase is specified.':'Initial reload inclusion is not stated; selected initial ammunition is purchased separately.',inclusionSource:csc(pages),magazinePriceSource:csc(weaponFamily==='pistol'?'149':'153'),mountExcludesAmmunition:true,mountSource:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'61'},explicitUnlimited:unlimited},
  source:csc(pages),...(!initialIncluded?{interpretation:'Initial ammunition is purchased separately because this profile does not state it is included. No recharge or reload timing is inferred.'}:{})};
});
