// Fictional Traveller game profiles; no source scans or source prose are distributed.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rh=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const rows=[
 ['shield','Shield',0,'1D',2,150,[],'bludgeon',1,'131,140-141','140','140-141'],
 ['riot-shield','Riot Shield',6,'1D',1.5,175,[],'bludgeon',1,'140-141','140','140-141'],
 ['boarding-shield','Boarding Shield',9,'1D',5,1500,['Bulky'],'bludgeon',1,'140','140','140'],
 ['anti-armour-flail','Anti-Armour Flail',8,'4D',3,250,['AP 5','One Use'],'bludgeon',1,'131-133','133','133'],
 ['garrotte','Garrotte',0,null,null,10,[],'unarmed',2,'131,138-139','139','138']
];
function effects(id,hands,handPages){
 const result={scope:'Operational game conditions only',resolvedAttack:false,skillGranted:false,defenceGranted:false,bodyMountedDefenceGranted:false,
  handling:{hands,requiresTwoHands:hands===2,explicitPrintedHandCount:false,basis:`Qualified ${hands===2?'two':'one'}-handed physical configuration; no explicit printed hand count.`,optionalSecondGrip:false,exclusiveConfiguration:false,mountClassIndependentOfWeaponMass:true,source:csc(handPages)}};
 if(['shield','riot-shield'].includes(id))result.parry={effectiveMeleeBonus:1,requiresMeleeSkill:false,unskilledEffectiveMelee:0,requiresHeld:true,requiresTwoHands:false,automaticBonusApplied:false,resolved:false,attackBonus:0,protectionGranted:0,permanentSkillBonusGranted:false,condition:'Standard shield parry only; unskilled effective Melee 0',source:csc('140')};
 if(id==='riot-shield'){
  result.rangedProtection={protection:1,attackType:'ranged',requiresShieldUse:true,automaticProtectionApplied:false,universalArmour:false,condition:'Ranged attacks only; shield use unresolved',source:csc('141')};
  result.fireTraitImmunity={trait:'Fire',attackDirection:'front',requiresWeaponAttack:true,environmentalImmunity:false,automaticImmunityApplied:false,condition:'Fire-trait weapon attacks from the front only',source:csc('141')};
 }
 if(id==='boarding-shield'){
  result.parry={permitted:false,effectiveMeleeBonus:0,unskilledEffectiveMelee:null,automaticBonusApplied:false,source:csc('140')};
  result.cover={protection:8,sourceSupportedPeople:2,movementWhileCoveredPermitted:true,requiresPositionBehindShield:true,geometryResolved:false,robotSizeFitResolved:false,universalArmour:false,automaticProtectionApplied:false,condition:'Cover behind shield; positioning and robot-size fit unresolved',source:csc('140')};
 }
 if(['shield','garrotte'].includes(id))result.tl0Breakage={maximumAttackEffect:-3,requiredManufacturingTechLevel:0,manufacturingTechLevel:null,inferFromRobotTechLevel:false,inferFromCatalogueTechLevel:false,noDefectAtManufacturingTechLevelAtLeast:1,breaks:'weapon',appliesTo:'source-attack-roll',appliesAutomaticallyToParry:false,automaticBreakageApplied:false,condition:'Weapon crafted at TL0 and attack Effect is -3 or worse; manufacturing TL is not recorded by this construction.',source:csc('131')};
 if(id==='anti-armour-flail')result.oneUse={weaponUselessAfterUse:true,reusableShaft:false,reloadSupported:false,restoredWeapon:false,resolved:false,presetDelay:{minimumRounds:1,maximumRounds:12,resolved:false,simulated:false,detonationResolved:false},condition:'Single use; preset delay 1-12 rounds unresolved',source:csc('131-132')};
 return result;
}
export const CSC_SHIELDS_EXPENDABLE_MELEE_WEAPONS=rows.map(([id,name,tl,damage,massKg,cost,traits,speciality,hands,pages,tablePage,handPages])=>({
 id:'csc-'+id,label:name+' (CSC 2023)',tl,damage,massKg,cost,traits,speciality,skill:'melee',range:'Melee',weaponFamily:'melee',sourceFamily:'csc-2023',implemented:true,mountClass:hands===2?'medium':'small',requiresTwoHands:hands===2,
 magazine:null,magazineCost:id==='anti-armour-flail'?null:0,initialIncluded:id==='anti-armour-flail'?null:true,
 sourceMeasurements:{mass:{value:massKg,unit:'kg',...(massKg===null?{status:'unspecified',printedValue:'dash'}:{})},source:csc(tablePage)},
 sourceBaseProfile:{damage:id==='garrotte'?'2D':damage,traits:[...traits],source:csc(tablePage)},
 handedness:{hands,explicitPrintedHandCount:false,basis:'qualified-physical-interpretation',alternateTwoHandedUse:false,exclusiveConfiguration:false,source:csc(handPages),mountSource:rh('61')},
 compatibility:{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false},
 ammunitionAccounting:{initialMagazine:'not-applicable',sourceInclusion:'not-applicable',separatelyPricedAmmunition:false,...(id==='anti-armour-flail'?{replacementPurchasesSupported:false}:{}),autoloadSupported:false,source:csc(tablePage)},
 conditionalEffects:effects(id,hands,handPages),
 ...(id==='anti-armour-flail'?{expendableMelee:true,acquisition:{kind:'complete-expendable-weapon',completeWeaponsPerPurchase:1,unitCost:cost,consumedByUse:true,separateWarheadPurchase:false,reusableHardware:false,source:csc('131-133')},linkedOperation:{resolved:false,damageBonus:null,combinedDetonation:null,completeWeaponsPurchasedIndependently:true,source:csc('131-133')}}:{}),
 ...(id==='garrotte'?{attackProfiles:{kind:'grapple-condition',currentMode:null,resolved:false,condition:{kind:'successful-damaging-grapple',requiresSuccessfulGrapple:true,requiresDamagingGrapple:true,grappleSuccess:null,opposedMeleeEffect:null,consecutiveSuccessfulRounds:null,automaticGrapple:false,source:csc('138')},profiles:[{id:'successful-damaging-grapple',label:'Successful damaging grapple',damage:null,formula:{baseDamage:'2D',addOpposedMeleeEffect:true,additionalDicePerConsecutiveSuccess:1,consecutiveSuccesses:null},traits:[],source:csc('138')}],hardwareIdentityPreserved:true,source:csc('138-139')}}:{}),
 source:csc(pages),interpretation:`${hands===2?'Two':'One'}-handed use is a qualified physical configuration, not an explicit printed hand count. Mount size follows handedness, not mass.`
}));
