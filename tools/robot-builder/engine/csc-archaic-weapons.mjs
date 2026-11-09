// Fictional Traveller game profiles. No source scans or real-world instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const core=pages=>({book:'Core Rulebook Update 2022',edition:'Mongoose 2022',pages});
const rh=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
// The printed values are capacity and whole-load cost, never reload duration.
const rows=[
 ['compound-cam-bow','Compound Cam Bow',5,100,'3D-3',1,250,1,5,['AP 2','Silent'],'arrow'],
 ['crossbow','Crossbow',1,100,'3D-3',3,200,1,1,['AP 2','Silent'],'bolt'],
 ['long-bow','Long Bow',1,100,'3D-3',1.5,150,1,1,['AP 2','Bulky','Silent'],'arrow'],
 ['repeating-crossbow','Repeating Crossbow',2,75,'2D',4,400,6,6,['Silent'],'bolt'],
 ['short-bow','Short Bow',0,75,'2D-3',1,50,1,1,['Silent'],'arrow']
];
function conditions(id,projectile){
 const effects={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,autoloadResolvesConditions:false,
  silent:{soundSourceDetectionDM:-6,generalStealthBonusGranted:false,condition:'Detecting the source of this weapon sound',source:csc('131')},
  reload:{action:'Minor',actions:id==='crossbow'?'2D3':1,skillCheckRequired:false,source:id==='crossbow'?csc('154'):core('75')},
  handling:{requiresTwoHands:true,explicitPrintedHandCount:false,basis:'Qualified physical interpretation of the full-size bows and stocked crossbows, supported by illustrations and draw/cocking descriptions.',mountClassIndependentOfHandedness:true,source:csc('154-155')}
 };
 if(projectile==='arrow')effects.arrowRecovery={projectile:'arrow',unrecoverableOn:'non-odd attack Effect',examples:[2,0,-2],appliesAtAnyTechLevel:true,oddEffectGuaranteesRecovery:false,resolved:false,source:csc('131')};
 if(id==='crossbow'||id==='repeating-crossbow')effects.cocking={method:id==='crossbow'?'stirrup-or-windlass':'lever',required:true,extraActionsSpecified:false,rateOfFireOverride:null,autoloadBypasses:false,source:csc('154')};
 if(id==='repeating-crossbow')effects.feed={projectile:'bolt',magazineCapacity:6,automaticFireGranted:false,source:csc('154')};
 if(id==='long-bow')effects.bulky={requiresTrait:'Bulky',minimumStrengthWithoutPenalty:9,belowMinimumAttackDM:'STR DM minus 1',automaticPenaltyApplied:false,additionalDrawThreshold:null,strengthDamageBonusGranted:false,source:core('79'),gyrostabiliserEligibility:{basis:'Printed Bulky, non-Destructive criterion; no archaic exclusion is stated.',source:csc('175')}};
 if(id==='short-bow')effects.tl0Breakage={maximumAttackEffect:-3,requiredManufacturingTechLevel:0,manufacturingTechLevel:null,inferFromRobotTechLevel:false,noDefectAtManufacturingTechLevelAtLeast:1,breaks:'bow-or-string',automaticBreakageApplied:false,condition:'Weapon crafted at TL0 and attack Effect is -3 or worse; manufacturing TL is not recorded by this construction.',source:csc('131')};
 return effects;
}
export const CSC_ARCHAIC_WEAPONS=rows.map(([id,name,tl,range,damage,massKg,cost,magazine,magazineCost,traits,projectile])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,range,damage,massKg,cost,magazine,magazineCost,traits,
 sourceFamily:'csc-2023',weaponFamily:'archaic',mountClass:'medium',skill:'gun-combat',speciality:'archaic',initialIncluded:false,implemented:true,requiresTwoHands:true,
 sourceMeasurements:{mass:{value:massKg,unit:'kg'},source:csc('154')},
 handedness:{hands:2,explicitPrintedHandCount:false,basis:'qualified-physical-interpretation',source:csc('154-155')},
 mountClassification:{basis:'Larger weapon usable with Gun Combat; not a rifle or slug classification.',source:rh('61')},
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,specialisedAmmunitionExclusion:{category:'Archaic Weapons',source:csc('178')}},
 ammunitionAccounting:{initialMagazine:'separate-purchase',sourceInitialInclusion:'unstated',inclusionStatement:'Initial-load inclusion is unstated; separately purchasing the selected initial load is a construction convention, not a source exclusion.',projectile,priceUnit:'whole load',roundsPerLoad:magazine,magazinePriceSource:csc('154'),magazineDefinitionSource:core('77'),mountExcludesAmmunition:true,mountSource:rh('61'),autoloadSupported:true,autoloadResolvesConditions:false},
 conditionalEffects:conditions(id,projectile),source:csc('154'),
 interpretation:'Two-handed handling is a qualified physical interpretation of the illustrated full-size bow or stocked crossbow and draw/cocking prose, not an explicit printed hand count. Medium mounting follows the Robot Handbook larger Gun Combat category independently. Initial-load inclusion is unstated; the selected initial load is purchased separately by convention. Autoloader accounting does not resolve drawing, cocking or reloading conditions.'
}));
