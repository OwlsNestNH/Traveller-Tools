// Fictional Traveller game profiles; no real-world operation instructions.
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rh=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const compatibility=()=>({accessoryRules:null,associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false});
const initialConvention='The CSC launcher entries do not state whether an initial magazine is included. The builder separately prices one selected initial magazine as an accounting convention, not an explicit source exclusion.';

// The p161 standard profiles are NOT the p179 Fragmentation modification.
// No grenade flag: that flag selects Core hand-grenade ammunition.
export const CSC_STANDARD_LAUNCHERS=[
 ['grenade-launcher-standard','Grenade Launcher',7,100,2,400,180,['Blast 6'],'160-161'],
 ['ram-grenade-launcher-standard','RAM Grenade Launcher',8,250,6,800,240,['Auto 3','Blast 6','Bulky'],'161,163']
].map(([id,name,tl,range,massKg,cost,magazineCost,traits,pages])=>({
 id:'csc-'+id,label:name+' - standard ammunition (CSC 2023)',tl,range,damage:'5D',massKg,cost,magazine:6,magazineCost,traits,
 sourceFamily:'csc-2023',weaponFamily:'heavy-portable',mountClass:'heavy',skill:'heavy-weapons',speciality:'portable',initialIncluded:false,implemented:true,
 compatibility:{...compatibility(),accessoryRules:'csc-2023'},source:csc(pages),sourceMeasurements:{range:{value:range,unit:'m'},mass:{value:massKg,unit:'kg'},source:csc('161')},
 ammunitionAccounting:{initialMagazine:'separate-purchase',sourceInclusion:'not-stated',inclusionStatement:initialConvention,inclusionSource:csc(pages),magazinePriceSource:csc('161'),mountExcludesAmmunition:true,mountSource:rh('61')},
 conditionalEffects:{scope:'Operational game conditions only',resolvedAttack:false,resolvedDamage:false,skillGranted:false,
  standardAmmunition:{fixedProfile:true,handGrenadeInterchangeability:false,specialisedAmmunitionImplemented:false,source:csc('157,178-179')},
  ...(id==='grenade-launcher-standard'?{calibre:{millimetres:40,source:csc('160')}}:{burst:{maximumRoundsPerAttack:3,resolvedAttack:false,source:csc('163')}})},
 interpretation:initialConvention
}));

function payloadConditions(id){
 const e={scope:'Operational game conditions only',resolvedAttack:false,resolvedDamage:false,skillGranted:false,protectionGranted:false,
  delivery:{method:'thrown',skill:'athletics',speciality:'dexterity',rangeMetres:20,mountedDeliveryGranted:false,activationImplemented:false,source:csc('157')}};
 if(['chemical','neurotoxin','tranq-gas','thermal-smoke'].includes(id))e.cloud={duration:'1D x 3 rounds',weatherMayReduceDuration:true,weather:'Heavy winds or rain',source:csc(id==='chemical'?'157':'158')};
 if(['chemical','neurotoxin','tranq-gas'].includes(id))e.poison={
  condition:'Living target in the cloud without a respirator or sealed suit',requiresInhalation:id!=='chemical',
  check:{characteristic:'END',target:id==='tranq-gas'?10:12},damage:id==='tranq-gas'?'unconscious':id==='neurotoxin'?'1D INT':'1D',interval:'1 round',resolved:false,
  ...(id==='chemical'?{compositionDependent:true,nonLethalDamageType:'Stun',lethalDamageType:'Injury',lethalExposure:['lung contact','skin contact']}:{}),source:csc(id==='chemical'?'157':'158')};
 if(id==='neurotoxin')e.legality={bannedFromLawLevel:1,militaryUseOftenBanned:true,legalityResolved:false,source:csc('158')};
 if(id==='emp')e.electromagneticPulse={livingTissueHarmed:false,shutdown:{condition:'Unshielded electronics',duration:'1D minutes'},
  permanentDamage:{condition:'Unshielded electronics more than two TL below the grenade',relativeTechLevelMaximum:-2,maximumInclusive:false},
  immunity:{condition:'All electronics more than two TL above the grenade',relativeTechLevelMinimum:2,minimumInclusive:false},universalRobotShutdown:false,resolved:false,source:csc('157')};
 if(id==='thermal-smoke')e.vision={condition:'Attacks against targets within the cloud',attackDM:-2,normalVisionObscured:true,infraredVisionBlocked:true,infraredVisionBypasses:false,automaticModifierApplied:false,source:csc('158')};
 if(id==='incendiary'){
  e.ignition={condition:'Target struck by the grenade',onImpact:true,source:csc('158')};
  e.fire={condition:'Target set on fire by this weapon',damageEachSubsequentRound:true,maximumConcurrentSources:1,useHighestDamageSource:true,
   selfExtinguish:{dice:'2D',target:8,timing:'Start of each round',refereeMayContinueWithFlammableMaterial:true},
   extinguishAction:{action:'Significant',actions:1,characteristic:'DEX',target:8,firefightingEquipmentDM:2},resolvedDamage:false,source:csc('131')};
 }
 return e;
}

// Explicit per-item hand-grenade prices and masses only. Core duplicates remain
// in their own catalogue; no loose-round or launcher interchange is inferred.
export const CSC_DIRECT_PAYLOADS=[
 ['chemical','Chemical Grenade',5,null,50,['Blast 9'],'Special','157'],
 ['emp','Electromagnetic Pulse Grenade',9,null,100,['Blast 6'],'none','157'],
 ['incendiary','Incendiary Grenade',7,'2D',75,['Blast 3','Fire'],'2D','157-158,131'],
 ['neurotoxin','Neurotoxin Grenade',9,null,250,['Blast 9'],'Special','157-158'],
 ['plasma','Plasma Grenade',16,'8D',500,['Blast 6'],'8D','157-158'],
 ['thermal-smoke','Thermal Smoke Grenade',7,null,30,['Blast 9'],'none','157-158'],
 ['tranq-gas','Tranq Gas Grenade',8,null,75,['Blast 9'],'Special','157-158']
].map(([id,name,tl,damage,cost,traits,sourceDamage,pages])=>({
 id:'csc-direct-grenade-'+id,label:name+' - direct payload (CSC 2023)',tl,damage,sourceDamage,cost,traits,massKg:.5,mountClass:'small',range:null,thrownRange:20,
 directPayload:true,sourceFamily:'csc-2023',weaponFamily:'payload',skill:'athletics',speciality:'dexterity',magazine:null,magazineCost:0,initialIncluded:true,implemented:true,
 compatibility:compatibility(),conditionalEffects:payloadConditions(id),source:csc(pages),
 sourceMeasurements:{range:{value:20,unit:'m',condition:'Thrown use only'},mass:{value:.5,unit:'kg'},source:csc('157')},
 ammunitionAccounting:{initialMagazine:'not-applicable',sourceInclusion:'not-applicable',separatelyPricedAmmunition:false,autoloadSupported:false,priceBasis:'one payload',source:csc('157')},
 mountSource:rh('61')
}));
