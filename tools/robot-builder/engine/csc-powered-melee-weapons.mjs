// Fictional Traveller game hardware. Source scans and private research stay outside the repository.
import {clone} from './schema.mjs';
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rh=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const ruling={title:'User/referee ruling'};
// Hand counts are qualified configurations supported by the illustrations, not
// explicit printed requirements, mass heuristics or exclusive possible grips.
const rows=[
 ['gravity-hammer','Gravity Hammer',13,'5D',5,10000,['AP 50','Bulky','Smasher'],'bludgeon',2,'132-133','133','133'],
 ['static-maul','Static Maul',11,'3D',3,650,['AP 4','Bulky','Smasher'],'bludgeon',2,'133-134','133','133'],
 ['stunstick','Stunstick',8,'2D',.5,300,['Stun'],'bludgeon',1,'133-134','133','133'],
 ['arc-field-weapon','Arc-Field Weapon',14,'5D+2',4,25000,['AP 30'],'blade',1,'134-135,137','135','137'],
 ['chaindrive-axe','Chaindrive Axe',10,'4D',6,600,['AP 4','Bulky'],'blade',2,'134-136','135','136'],
 ['chaindrive-sword','Chaindrive Sword',10,'4D',4,500,['AP 2'],'blade',1,'134-136','135','136'],
 ['static-axe-11','Static Axe (TL11)',11,'4D',5,750,['AP 6','Bulky','Smasher'],'blade',2,'135-137','135','136'],
 ['static-axe-12','Static Axe (TL12)',12,'4D+2',4,1000,['AP 8','Smasher'],'blade',2,'135-137','135','136'],
 ['static-blade-11','Static Blade (TL11)',11,'3D',3,700,['AP 5'],'blade',1,'135,137','135','137'],
 ['static-blade-12','Static Blade (TL12)',12,'3D+2',2,900,['AP 6'],'blade',1,'135,137','135','137'],
 ['shock-whip','Shock Whip',9,'2D',1,450,['Stun'],'whip',1,'141','141','141']
];
function operation(id,pages){
 const arc=id==='arc-field-weapon',chain=id.startsWith('chaindrive-'),staticBlade=id.startsWith('static-axe-')||id.startsWith('static-blade-'),printed=arc||chain||staticBlade;
 const source=csc(arc||chain?'134':staticBlade?'137':pages);
 return {
  endurance:printed?{basis:'printed-source',duration:arc?'2D hours':'30 minutes',hours:null,minutes:arc?null:30,condition:arc?'Powered use':chain?'Combat or intimidation use':'Combat or cutting use',perWeapon:true,pooledAcrossCopies:false,source}:
   {basis:'user-referee-ruling',duration:null,hours:null,reference:'robot-endurance',status:'Host endurance reference required',perWeapon:true,pooledAcrossCopies:false,source:ruling,printedEnduranceSpecified:false,printedSource:source},
  recharge:{duration:arc?'1D x 10 minutes':null,status:arc?'Printed recharge duration':'Recharge duration unstated',source},
  supply:{kind:arc?'self-contained-pack':id==='gravity-hammer'?'gravity-generator':'powered-hardware',replacementPrice:null,replacementPurchasesSupported:false,chargerProvisioningSpecified:false,initialCharge:null,source},
  directRobotPowerHardwarePurchased:false
 };
}
function effects(id,traits,hands,handPages){
 const result={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,defenceGranted:false,bodyMountedDefenceGranted:false,
  handling:{hands,requiresTwoHands:hands===2,explicitPrintedHandCount:false,basis:`Qualified ${hands===2?'two':'one'}-handed physical configuration; no explicit printed hand count.`,optionalSecondGrip:false,mountClassIndependentOfWeaponMass:true,exclusiveConfiguration:false,source:csc(handPages)}};
 if(traits.includes('Smasher'))result.smasher={targetMayParry:false,condition:'The target is attacked with this Smasher weapon',armourPenetrationGranted:false,source:csc('131')};
 if(id==='gravity-hammer')result.smallTarget={attackDM:-6,condition:'Target is smaller than a vehicle',automaticModifierApplied:false,vehicleClassGranted:false,source:csc('132')};
 if(id==='arc-field-weapon'){
  result.parryRestriction={lowerTechLevelWeaponMayParry:false,weaponTechLevel:14,condition:'Parrying weapon is lower TL than the Arc-Field Weapon',universalParryBan:false,resolved:false,source:csc('134')};
  result.legalClassification={weaponType:'energy',combatSkill:'Melee (blade)',gunCombatAccessoriesGranted:false,localLegalityResolved:false,source:csc('134')};
 }
 if(id==='shock-whip')result.questioning={modifier:1,skills:['Intimidate','Persuade'],condition:'Questioning with the Shock Whip',permanentSkillBonusGranted:false,generalSocialBonusGranted:false,automaticModifierApplied:false,source:csc('141')};
 return result;
}
export const CSC_POWERED_MELEE_WEAPONS=rows.map(([id,name,tl,damage,massKg,cost,traits,speciality,hands,pages,tablePage,handPages])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,damage,massKg,cost,traits,speciality,skill:'melee',range:'Melee',weaponFamily:'melee',sourceFamily:'csc-2023',mountClass:hands===2?'medium':'small',poweredMelee:true,implemented:true,
 magazine:null,magazineCost:null,initialIncluded:null,requiresTwoHands:hands===2,
 sourceMeasurements:{mass:{value:massKg,unit:'kg'},source:csc(tablePage)},
 handedness:{hands,explicitPrintedHandCount:false,basis:'qualified-physical-interpretation',alternateTwoHandedUse:false,exclusiveConfiguration:false,source:csc(handPages),mountSource:rh('61')},
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
 acquisition:{kind:'complete-weapon-hardware',chargeStatus:'Initial charge unspecified',includedReplaceablePack:null,source:csc(tablePage)},
 ammunitionAccounting:{initialMagazine:'not-defined',sourceInclusion:'not-stated',separatelyPricedAmmunition:false,replacementPurchasesSupported:false,autoloadSupported:false,source:csc(tablePage)},
 powerOperation:operation(id,pages),conditionalEffects:effects(id,traits,hands,handPages),source:csc(pages),
 interpretation:`${hands===2?'Two':'One'}-handed use is a qualified physical configuration, not an explicit printed hand count. Mount size follows handedness, not mass.`
}));
// The ruling fills absent endurance only. It neither purchases a power connection
// nor turns unknown host endurance into unlimited energy or recipient END hours.
export function resolvePoweredMeleeOperation(weapon,host={}){
 const result=clone(weapon.powerOperation);
 if(result.endurance.basis==='user-referee-ruling'){
  const hours=Number.isFinite(host.hours)?host.hours:null;
  Object.assign(result.endurance,{hours,reference:host.reference??'robot-endurance',status:hours===null?'Host endurance unresolved':'Uses host robot endurance',...(host.powerState?{hostPowerState:clone(host.powerState)}:{})});
 }
 return result;
}
