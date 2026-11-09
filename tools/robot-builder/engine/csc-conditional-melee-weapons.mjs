// Fictional Traveller game profiles; no scans or source prose are distributed.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rh=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
// These are hardware acquisitions. Operational attack modes stay unresolved.
// Illustrated grips are qualified configurations, never a mass-based mount rule.
const rows=[
 ['monofilament-axe','Monofilament Axe',12,'4D',4,3000,['AP 15','Bulky','Smasher'],2,'131,134-136'],
 ['spear','Spear',0,'2D',2,10,[],2,'131,134-137'],
 ['lance','Lance',1,null,4,250,[],1,'134-137'],
 ['piston-spear','Piston Spear',7,null,3,400,[],2,'134-137']
];
function profiles(id){
 if(!['lance','piston-spear'].includes(id))return null;
 const lance=id==='lance';
 return {
  kind:lance?'rider-condition':'reset-condition',currentMode:null,resolved:false,
  condition:lance?{
   kind:'riding-fast-moving-animal-or-vehicle',requiresRider:true,requiresFastMovingMount:true,
   allowedMountKinds:['animal','vehicle'],minimumSpeed:null,inferFromRobotMovement:false,inferFromWeaponMount:false,inferFromSpeedUpgrade:false,source:csc('134')
  }:{
   kind:'reset-after-every-attack',minorActions:1,afterEveryAttack:true,currentReadiness:null,automaticReset:false,
   mechanism:'pneumatic',reservoirAttackCount:null,refillPrice:null,replacementPurchasesSupported:false,robotPowerConnection:false,source:csc('135')
  },
  profiles:[
   {id:lance?'riding':'ready',label:lance?'Riding fast-moving animal/vehicle':'Ready / reset',damage:lance?'5D':'3D+2',traits:[lance?'AP 4':'AP 2'],source:csc(lance?'134-135':'135')},
   {id:'ordinary-spear',label:lance?'Otherwise: Spear':'Without reset: Spear',damage:'2D',traits:[],source:csc(lance?'134-135,137':'135,137')}
  ],
  hardwareIdentityPreserved:true,source:csc(lance?'134-135,137':'135,137')
 };
}
export const CSC_CONDITIONAL_MELEE_WEAPONS=rows.map(([id,name,tl,damage,massKg,cost,traits,hands,pages])=>{
 const attackProfiles=profiles(id);
 const conditionalEffects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,defenceGranted:false,bodyMountedDefenceGranted:false,
  handling:{hands,requiresTwoHands:hands===2,explicitPrintedHandCount:false,basis:`Qualified ${hands===2?'two':'one'}-handed physical configuration; no explicit printed hand count.`,optionalSecondGrip:false,exclusiveConfiguration:false,mountClassIndependentOfWeaponMass:true,source:csc('136')}};
 if(id==='monofilament-axe')conditionalEffects.smasher={targetMayParry:false,condition:'The target is attacked with this Smasher weapon',armourPenetrationGranted:false,source:csc('131')};
 if(id==='spear')conditionalEffects.tl0Breakage={maximumAttackEffect:-3,requiredManufacturingTechLevel:0,manufacturingTechLevel:null,inferFromRobotTechLevel:false,noDefectAtManufacturingTechLevelAtLeast:1,breaks:'weapon',automaticBreakageApplied:false,condition:'Weapon crafted at TL0 and attack Effect is -3 or worse; manufacturing TL is not recorded by this construction.',source:csc('131')};
 return {
  id:'csc-'+id,label:name+' (CSC 2023)',tl,damage,massKg,cost,traits,range:'Melee',skill:'melee',speciality:'blade',weaponFamily:'melee',sourceFamily:'csc-2023',implemented:true,
  mountClass:hands===2?'medium':'small',requiresTwoHands:hands===2,magazine:null,magazineCost:0,initialIncluded:true,
  sourceMeasurements:{mass:{value:massKg,unit:'kg'},source:csc('135')},
  handedness:{hands,explicitPrintedHandCount:false,basis:'qualified-physical-interpretation',alternateTwoHandedUse:false,exclusiveConfiguration:false,source:csc('136'),mountSource:rh('61')},
  compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
  ammunitionAccounting:{initialMagazine:'not-applicable',sourceInclusion:'not-applicable',separatelyPricedAmmunition:false,autoloadSupported:false,source:csc('135')},
  conditionalEffects,...(attackProfiles?{attackProfiles}:{}),source:csc(pages),
  interpretation:`${hands===2?'Two':'One'}-handed use is a qualified physical configuration, not an explicit printed hand count. Mount size follows handedness, not mass.`
 };
});
