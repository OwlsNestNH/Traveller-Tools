// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const mountSource=()=>({book:'Robot Handbook',edition:'Mongoose 2022',pages:'61'});

// Fixed-capacity, priced CSC energy profiles: new weapons and the materially
// different TL11 Laser Pistol. Matching Core rows keep their original identities.
// Gun Combat rifle categories remain medium mounts even at 12 kg; mass is not
// the miscellaneous-implant classification rule. The gauntlet is a pistol.
const rows=[
 ['gauntlet-laser','Gauntlet Laser',10,'pistol',20,'3D',2,2500,100,1100,['Zero-G'],'149',true,'external-laser-pack'],
 ['hand-flamer','Hand Flamer',10,'pistol',5,'3D',2,1500,5,25,['Blast 2','Fire'],'149',false,'source-priced-reload'],
 ['laser-pistol-11','Laser Pistol (TL11)',11,'pistol',30,'3D+3',1,3000,100,3000,['Zero-G'],'149',true,'external-laser-pack'],
 ['personal-defence-laser','Personal Defence Laser',13,'pistol',25,'3D+3',2,6000,25,100,['Auto 2','Zero-G'],'149-150',false,'chemical-cartridge-magazine'],
 ['cartridge-laser-carbine-10','Cartridge Laser Carbine (TL10)',10,'rifle',150,'4D',3,2500,15,70,['Zero-G'],'151,153',false,'chemical-cartridge-magazine'],
 ['cartridge-laser-carbine-12','Cartridge Laser Carbine (TL12)',12,'rifle',200,'4D+3',2.5,4000,20,70,['Zero-G'],'151,153',false,'chemical-cartridge-magazine'],
 ['cartridge-laser-rifle-10','Cartridge Laser Rifle (TL10)',10,'rifle',200,'5D',5,3500,20,150,['Auto 3','Zero-G'],'151,153',false,'chemical-cartridge-magazine'],
 ['cartridge-laser-rifle-12','Cartridge Laser Rifle (TL12)',12,'rifle',400,'5D+3',4,8000,25,150,['Auto 3','Zero-G'],'151,153',false,'chemical-cartridge-magazine'],
 ['cryo-rifle','Cryo Rifle',13,'rifle',10,'4D',9,6000,12,150,['Blast 3'],'151,153',false,'source-priced-reload'],
 ['flame-rifle','Flame Rifle',9,'rifle',10,'4D',8,2500,10,50,['Blast 3','Fire'],'151,153',false,'source-priced-reload'],
 ['heavy-laser-rifle','Heavy Laser Rifle',12,'rifle',1200,'6D',12,14000,12,500,['Scope','Zero-G'],'151,153',true,'integrated-laser-pack'],
 ['stagger-laser-rifle-12','Stagger Laser Rifle (TL12)',12,'rifle',300,'5D',4,10000,50,5000,['Auto 2','Zero-G'],'152-153',true,'laser-pack'],
 ['stagger-laser-rifle-14','Stagger Laser Rifle (TL14)',14,'rifle',350,'5D+3',3,15000,100,6000,['Auto 3','Zero-G'],'152-153',true,'laser-pack'],
 ['stun-blaster','Stun Blaster',13,'rifle',20,'4D',5,3000,200,500,['Stun','Zero-G'],'152-153',false,'power-pack'],
 ['stun-carbine','Stun Carbine',12,'rifle',20,'3D',4,2000,50,200,['Stun','Zero-G'],'152-153',false,'power-pack']
];

function conditions(id,kind,traits){
 const effects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,recipientVisionGranted:false,autoloadResolvesConditions:false};
 const supply={kind,source:csc(kind==='chemical-cartridge-magazine'?(id==='personal-defence-laser'?'150':'151'):id==='stun-carbine'?'152':'149,151-153'),robotPowerConnectionSupported:false,unlimitedFire:false};
 if(['external-laser-pack','integrated-laser-pack','laser-pack'].includes(kind)){
  supply.recharge={hours:8,requiresExternalPowerSource:true,source:csc('149')};
  // Connector timing does not certify backpack changes or replace pack handling.
  if(kind==='external-laser-pack'){
   supply.connectionRequired=true;
   supply.location=id==='gauntlet-laser'?'backpack':'belt-or-wrist';
   supply.connectorSwitch={action:'Minor',actions:1,source:csc('149')};
   supply.packHandling={duration:'1D rounds',condition:'Unstrapping and securing a backpack, when required',source:csc('149')};
  }else supply.location=kind==='integrated-laser-pack'?'integrated':'unspecified';
 }else if(kind==='chemical-cartridge-magazine'){
  supply.disposable=true;supply.rechargeable=false;supply.externalPowerPack=false;
  supply.location=id==='personal-defence-laser'?'handgrip':'magazine';
  if(id.startsWith('cartridge-laser-'))supply.reload={timing:'Same as a slug magazine',action:null,actions:null,source:csc('151')};
 }else{
  // The table's priced reload does not establish recharge time, refill price or
  // direct connection to a robot power plant. Unknowns are not free refills.
  supply.recharge={hours:null,cost:null,source:csc('149,151-153'),status:'not-specified-for-this-profile'};
  supply.reload={action:null,actions:null,status:'not-specified-for-this-profile'};
  supply.location=id==='stun-carbine'?'stock':'unspecified';
 }
 if(id==='stun-carbine'){supply.detachable=true;supply.incompatibleWith=['hand-stunner-power-packs'];}
 effects.powerSupply=supply;
 if(id==='gauntlet-laser')effects.handUse={openHandRetained:true,extraManipulatorGranted:false,source:csc('149')};
 if(traits.includes('Fire'))effects.fire={condition:'Target set on fire by this weapon',damageEachSubsequentRound:true,maximumConcurrentSources:1,useHighestDamageSource:true,selfExtinguish:{dice:'2D',target:8,timing:'Start of each round',refereeMayContinueWithFlammableMaterial:true},extinguishAction:{action:'Significant',actions:1,characteristic:'DEX',target:8,firefightingEquipmentDM:2},resolvedDamage:false,source:csc('131')};
 if(id==='cryo-rifle')effects.freeze={condition:'Hit a target wearing a sealed protective suit',check:{characteristic:'STR',target:8},onFailure:'Held in place',duration:'1D rounds',source:csc('151')};
 if(id==='stun-blaster')effects.alternativeDischarge={id:'blast',optional:true,damage:'3D',traits:['Blast 3','Stun','Zero-G'],chargesConsumed:2,source:csc('152-153')};
 return effects;
}

export const CSC_ENERGY_WEAPONS=rows.map(([id,name,tl,weaponFamily,range,damage,massKg,cost,magazine,magazineCost,traits,pages,initialIncluded,reloadKind])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,weaponFamily,sourceFamily:'csc-2023',mountClass:weaponFamily==='pistol'?'small':'medium',
 range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded,skill:'gun-combat',speciality:'energy',implemented:true,
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
 conditionalEffects:conditions(id,reloadKind,traits),
 ammunitionAccounting:{initialMagazine:initialIncluded?'included-power-pack':'separate-purchase',reloadKind,inclusionStatement:initialIncluded?'CSC p149 supplies laser weapons with power packs; p151 identifies the integrated heavy-rifle pack.':'No initial reload inclusion is stated for this cartridge or non-laser profile; one is purchased separately when selected.',inclusionSource:csc('149-153'),magazinePriceSource:csc(weaponFamily==='pistol'?'149':'153'),mountExcludesAmmunition:true,mountSource:mountSource()},
 source:csc(pages),
 ...(!initialIncluded?{interpretation:'Initial ammunition is purchased separately because this CSC cartridge or non-laser profile does not state it is included. The laser power-pack inclusion note is not extended to it.'}:{}),
 ...(id==='laser-pistol-11'?{interpretation:'The CSC table prices replacement power packs at Cr3000. The separate Core profile retains Cr1200; source profiles are not interchangeable.'}:{})
}));
