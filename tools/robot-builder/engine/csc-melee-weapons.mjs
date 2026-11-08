// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rh=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
// Bounded unpowered profiles. Unprinted hand counts remain qualified physical
// interpretations. Staff is only the source-supported two-handed configuration.
// Mount sizes follow RH p61 handedness, never weapon mass.
const rows=[
 ['mace','Mace',1,'small','2D+2',3,20,'bludgeon',['Bulky','Smasher'],'132-133','133',false],
 ['staff','Staff (two-handed)',1,'medium','2D',2,5,'bludgeon',[],'133-134,140','133',true],
 ['battle-axe','Battle Axe',1,'small','3D',4,225,'blade',['AP 2','Bulky'],'134-135','135',false],
 ['broadsword','Broadsword',1,'medium','4D',3,500,'blade',['Bulky'],'134-135','135',true],
 ['great-axe','Great Axe',1,'medium','4D+2',8,750,'blade',['Smasher','Very Bulky'],'134-135','135',true],
 ['long-blade-1','Long Blade (TL1)',1,'small','3D',2,200,'blade',[],'134-135','135',false],
 ['long-blade-3','Long Blade (TL3)',3,'small','3D+2',2,300,'blade',[],'134-135','135',false],
 ['monoblade','Monoblade',12,'small','3D',1,2500,'blade',['AP 10'],'134-135','135',false],
 ['buckler','Buckler',1,'small','1D',1,10,'bludgeon',[],'140','140',false],
 ['blade','Blade',1,'small','2D',1,100,'blade',[],'134-136','135',false],
 ['cutlass','Cutlass',2,'small','3D',2,200,'blade',[],'134-136','135',false],
 ['dagger','Dagger',1,'small','1D+2',.5,10,'blade',[],'134-135,137','135',false],
 ['hatchet','Hatchet',1,'small','2D+2',2,50,'blade',[],'134-136','135',false],
 ['sap','Sap',1,'small','1D',1,30,'bludgeon',['Stun'],'132-133','133',false],
 ['sledgehammer','Sledgehammer',1,'medium','4D',8,30,'bludgeon',['Smasher','Very Bulky'],'132-133','133',true],
 ['rapier','Rapier',2,'small','2D',1,200,'blade',[],'135-137','135',false],
 ['stone-axe','Stone Axe',0,'small','2D+1',2,5,'blade',[],'131,135-137','135',false],
 ['stealth-dagger','Stealth Dagger',8,'small','1D+2',.5,175,'blade',[],'135,137','135',false],
 ['war-pick','War Pick',1,'small','2D+2',3,275,'blade',['AP 4'],'135-137','135',false]
];
const interpretedHandedness={blade:'134,136',cutlass:'134,136',dagger:'134,137',hatchet:'134,136',sap:'132-133',sledgehammer:'132-133',rapier:'136-137','stone-axe':'136-137','stealth-dagger':'137','war-pick':'136-137'};
function conditions(id,traits,requiresTwoHands){
 const effects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,defenceGranted:false,bodyMountedDefenceGranted:false};
 if(traits.includes('Smasher'))effects.smasher={targetMayParry:false,condition:'The target is attacked with this Smasher weapon',armourPenetrationGranted:false,source:csc('131')};
 if(id==='staff'||id==='buckler')effects.parry={effectiveMeleeBonus:1,requiresMeleeSkill:true,unskilledEffectiveMelee:null,requiresHeld:true,requiresTwoHands:id==='staff',automaticBonusApplied:false,resolved:false,attackBonus:0,protectionGranted:0,condition:id==='staff'?'Parrying with the staff held in two hands by a wielder with Melee skill':'Parrying with the buckler held in a hand by a wielder with Melee skill',source:csc(id==='staff'?'134,140':'140')};
 if(interpretedHandedness[id])effects.handling={hands:requiresTwoHands?2:1,requiresTwoHands,explicitPrintedHandCount:false,basis:requiresTwoHands?'Qualified two-handed physical configuration; no explicit printed hand count.':'Qualified one-handed physical configuration; no explicit printed hand count.',optionalSecondGrip:false,mountClassIndependentOfWeaponMass:true,source:csc(interpretedHandedness[id])};
 if(id==='sap')effects.stun={trait:'Stun',requiresTargetUnaware:true,removedWhenTargetAware:true,automaticTraitApplied:false,resolved:false,condition:'Target is unaware of the attacker',source:csc('132')};
 if(id==='rapier')effects.parry={modifier:1,requiresHeld:true,automaticBonusApplied:false,resolved:false,attackBonus:0,protectionGranted:0,permanentSkillBonusGranted:false,condition:'Parrying with the rapier',source:csc('137')};
 if(id==='stone-axe')effects.tl0Breakage={maximumAttackEffect:-3,requiredManufacturingTechLevel:0,manufacturingTechLevel:null,inferFromRobotTechLevel:false,noDefectAtManufacturingTechLevelAtLeast:1,breaks:'weapon',automaticBreakageApplied:false,condition:'Weapon crafted at TL0 and attack Effect is -3 or worse; manufacturing TL is not recorded by this construction.',source:csc('131')};
 if(id==='stealth-dagger'){
  effects.sensorDetection={skill:'electronics:sensors',modifier:-4,subjectToTechLevelDifferential:true,weaponTechLevel:8,generalStealthBonusGranted:false,automaticDetectionFailure:false,resolved:false,condition:'Electronics (sensors) checks to detect this weapon; TL differential applies',source:csc('137')};
  effects.acquisition={profileTechLevel:8,advancedVersionsUpToTechLevel:12,higherTechLevelPricesSpecified:false,higherTechLevelProfilesImplemented:false,source:csc('135,137')};
  effects.legality={normallyBannedAtLawLevelAtLeast:1,localLegalityResolved:false,source:csc('137')};
 }
 return effects;
}
export const CSC_MELEE_WEAPONS=rows.map(([id,name,tl,mountClass,damage,massKg,cost,speciality,traits,pages,tablePage,requiresTwoHands])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,weaponFamily:'melee',sourceFamily:'csc-2023',mountClass,
 range:'Melee',damage,massKg,cost,magazine:null,magazineCost:0,initialIncluded:true,skill:'melee',speciality,traits,implemented:true,requiresTwoHands,
 sourceMeasurements:{mass:{value:massKg,unit:'kg'},source:csc(tablePage)},
 handedness:{hands:requiresTwoHands?2:1,...(interpretedHandedness[id]?{explicitPrintedHandCount:false,basis:'qualified-physical-interpretation'}:{}),alternateTwoHandedUse:['battle-axe','long-blade-1','long-blade-3'].includes(id),source:csc(interpretedHandedness[id]??(id==='mace'?'132':id==='buckler'?'140':id.startsWith('long-blade')||id==='monoblade'?'135':'134')),mountSource:rh('61')},
 // Only source-supported melee accessory families are admitted by the shared rules.
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
 conditionalEffects:conditions(id,traits,requiresTwoHands),
 ammunitionAccounting:{initialMagazine:'not-applicable',sourceInclusion:'not-applicable',separatelyPricedAmmunition:false,autoloadSupported:false,source:csc(tablePage)},
 source:csc(pages),
 ...(interpretedHandedness[id]?{interpretation:requiresTwoHands?'Two-handed use is a qualified physical configuration, not an explicit printed hand count. Mount size follows handedness, not mass.':'One-handed use is a qualified physical configuration, not an explicit printed hand count. No optional second grip is established. Mount size follows handedness, not mass.'}:{}),
 ...(id==='staff'?{interpretation:'This profile represents two-handed staff use. Shield parrying remains conditional on held two-handed use and Melee skill; no mounted defence benefit is granted.'}:{}),
 ...(id==='broadsword'?{interpretation:'The CSC profile is TL1 and 3kg; the distinct Core profile retains its printed TL2 and other source values.'}:{})
}));
