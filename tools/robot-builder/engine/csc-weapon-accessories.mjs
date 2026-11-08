// Fictional Traveller accessories; source-defined construction values, not operating instructions.
import {clone} from './schema.mjs';
const csc=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const rows=[
 ['gyrostabiliser','Gyrostabiliser',9,500,1,'gyrostabiliser','gyrostabiliser','175'],
 ['holographic-sight','Holographic sights',10,2000,.5,'sight','holographic-sight','175'],
 ['intelligent-0','Intelligent weapon Computer/0',11,1000,null,'intelligent','intelligent','175'],
 ['intelligent-1','Intelligent weapon Computer/1',12,1000,null,'intelligent','intelligent','175'],
 ['intelligent-2','Intelligent weapon Computer/2',13,1200,null,'intelligent','intelligent','175'],
 ['intelligent-3','Intelligent weapon Computer/3',15,2000,null,'intelligent','intelligent','175'],
 ['laser-sight-8','Laser sight (red dot)',8,200,null,'sight','laser-sight','176'],
 ['laser-sight-10','Laser sight (UV dot)',10,200,null,'sight','laser-sight','176'],
 ['scope-5','Telescopic scope',5,50,null,'sight','scope','176'],
 ['scope-7','Electronic scope',7,50,null,'sight','scope','176'],
 ['smart-tracker','Smart tracker',11,500,null,'smart-tracker','smart-tracker','175,177'],
 ['suppressor','Suppressor',8,250,null,'suppressor','suppressor','131,177'],
 ['bipod','Bipod',4,50,1,'bipod','bipod','174'],
 ['fof-safety','FOF Safety',9,250,null,'fof-safety','fof-safety','175'],
 ['scan-jammer','Scan Jammer',8,2500,null,'scan-jammer','scan-jammer','176'],
 ['secure','Secure Weapon',10,250,null,'secure','secure','177'],
 ['shoulder-stock','Shoulder Stock',4,75,1,'shoulder-stock','shoulder-stock','177'],
 ['telescoping-stock','Shoulder Stock (telescoping)',9,500,.5,'shoulder-stock','shoulder-stock','177'],
 ['xray-1','X-Ray Outlining Aid (1m)',9,300,null,'xray','xray','177'],
 ['xray-3','X-Ray Outlining Aid (3m)',11,500,null,'xray','xray','177']
];
export const CSC_WEAPON_ACCESSORIES=rows.map(([id,label,tl,cost,massKg,family,kind,pages])=>({
 id:'csc-'+id,label:label+' (CSC 2023)',tl,cost,massKg,family,kind,sourceFamily:'csc-2023',source:csc(pages),
 ...(kind==='intelligent'?{computerRating:Number(id.at(-1))}:{}),
 ...(kind==='fof-safety'?{includedTagsPerCopy:2}:{}),
 ...(kind==='xray'?{maximumBarrierMetres:Number(id.at(-1))}:{}),
 ...(kind==='holographic-sight'?{interpretation:'The p175 prose includes targets at 50 metres; the table says beyond 50m. This profile follows the explicit prose threshold.'}:{})
}));
// Additional tags are counted once for the installation set, not once per linked gun.
export const CSC_FOF_TAG={id:'csc-fof-tag',label:'Extra FOF transmitter tag (CSC 2023)',tl:9,cost:25,massKg:null,source:csc('175')};
const actualIntegralScopes={'csc-gauss-sniper-rifle':'146','csc-sniper-rifle':'148','csc-anti-materiel-rifle':'160'};
// These source profiles explicitly describe pneumatic/chemical/archaic mechanisms.
// Their acquisition is not banned, but firearm-specific effects and trigger fit are
// not inferred from Gun Combat skill, the profile name, or its mounting category.
const nonFirearmMechanisms=new Set(['csc-air-rifle-3','csc-air-rifle-4','csc-spear-gun','csc-pepper-spray','csc-hand-flamer','csc-flame-rifle','csc-cryo-rifle','csc-cryojet','csc-flamethrower-4','csc-flamethrower-6','csc-flamethrower-8']);
function firingApplicability(weapon){
 if(weapon.weaponFamily==='melee')return 'ordinary-melee-not-firing';
 if(weapon.weaponFamily==='archaic'||nonFirearmMechanisms.has(weapon.id))return 'requires-referee-confirmation';
 return 'conditional-firing-use';
}

// Both the UI catalogue and imported records use source categories, never mount size.
export function cscAccessoryEligibility(weapon,accessory){
 const failure=(code,message,pages)=>({available:false,code,reason:message,source:csc(pages)});
 if(weapon.sourceFamily!=='csc-2023'||weapon.compatibility?.accessoryRules!=='csc-2023'||accessory.sourceFamily!=='csc-2023')return failure('ACCESSORY_SOURCE','This accessory requires a supported CSC weapon profile.','174-177');
 if(weapon.weaponFamily==='melee'&&!['intelligent','scan-jammer','gyrostabiliser','smart-tracker'].includes(accessory.kind))return failure('CSC_MELEE_ACCESSORY_UNSUPPORTED','This accessory has no established ordinary melee application in the implemented source profile.','174-177');
 if(accessory.kind==='gyrostabiliser'&&weapon.conditionalEffects?.includedEquipment?.gyroscopicStabilisation)return failure('CSC_INCLUDED_STABILISATION','This weapon already includes stabilisation while retaining its printed Bulky trait; additional stabilisation effects are not defined.','146,175');
 if(accessory.kind==='gyrostabiliser'&&(!weapon.traits.some(t=>t==='Bulky'||t==='Very Bulky')||weapon.damage?.includes('DD')||weapon.traits.includes('Destructive')))return failure('GYROSTABILISER_WEAPON','CSC gyrostabilisers require Bulky or Very Bulky and cannot be fitted to Destructive weapons.','175');
 if(accessory.kind==='bipod'&&weapon.conditionalEffects?.bipod?.included)return failure('CSC_INCLUDED_BIPOD','This weapon already includes its bipod; another charge or benefit is not supported.','160,163,174');
 if(accessory.kind==='scope'&&!['rifle','heavy-portable','heavy-vehicle'].includes(weapon.weaponFamily))return failure('SCOPE_WEAPON','Scopes require a source-defined rifle or heavy weapon.','176');
 if(accessory.kind==='shoulder-stock'&&weapon.weaponFamily!=='pistol')return failure('CSC_STOCK_PISTOL','Shoulder stocks require a source-defined pistol.','177');
 if(accessory.kind==='shoulder-stock'&&['csc-gauntlet-laser','csc-pepper-spray'].includes(weapon.id))return failure('CSC_STOCK_FORM_UNVERIFIED','The source describes a worn gauntlet or chemical dispenser rather than a stock-compatible pistol form; stock fit is not certified.','149-150,177');
 if(accessory.kind==='xray'&&!actualIntegralScopes[weapon.id]&&(!['rifle','heavy-portable','heavy-vehicle'].includes(weapon.weaponFamily)||weapon.traits.includes('Scope')))return failure('CSC_XRAY_SCOPE','This profile has no source-confirmed actual scope or supported scope installation; a Scope trait alone is insufficient.','177');
 if(accessory.kind==='suppressor'&&(weapon.speciality!=='slug'&&weapon.slugThrower!==true||weapon.traits.some(t=>/^Auto(?: |$)/.test(t))))return failure('SUPPRESSOR_WEAPON','Suppressors require a non-automatic slug thrower.','177');
 if(accessory.family==='sight'&&weapon.traits.includes('Scope'))return failure('CSC_SIGHT_LIMIT','The weapon already has an integral scope or sight; replacement or additional sights need a separate referee decision.','174');
 // Actual-scope dependency is checked against the whole selection below. A Scope
 // trait alone (including fire control or holographic sights) is insufficient.
 return {available:true,reason:null};
}

export function evaluateCscAccessories(weapon,record,techLevel){
 const accessories=(record.accessories??[]).map(id=>CSC_WEAPON_ACCESSORIES.find(a=>a.id===id)),diagnostics=[],families=new Set();
 const add=(code,message,source,severity='error')=>diagnostics.push({code,message,source,severity});
 for(const a of accessories){
  if(!a){add('CSC_ACCESSORIES_UNSUPPORTED','Only explicitly supported CSC accessory IDs may be used with this source profile.',csc('174-177'));continue;}
  const eligibility=cscAccessoryEligibility(weapon,a);
  if(!eligibility.available)add(eligibility.code,eligibility.reason,eligibility.source);
  if(a.tl>techLevel)add('ACCESSORY_TL',a.label+' exceeds design technology.',a.source);
  if(families.has(a.family))add(a.family==='sight'?'CSC_SIGHT_LIMIT':'ACCESSORY_FAMILY',a.family==='sight'?'Choose only one sight or scope.':'Choose only one accessory of each family.',a.family==='sight'?csc('174'):a.source);
  families.add(a.family);
 }
 const selectedScope=accessories.find(a=>a?.kind==='scope'),integralScopePage=actualIntegralScopes[weapon.id],extraTags=record.extraFofTags??0;
 if(families.has('smart-tracker')&&!families.has('intelligent'))add('CSC_TRACKER_COMPUTER','A smart tracker requires an Intelligent Weapon computer on this same weapon.',csc('175,177'));
 if(families.has('xray')&&!selectedScope&&!integralScopePage)add('CSC_XRAY_SCOPE','An X-Ray outlining aid requires a selected CSC scope or a source-confirmed integral scope on this same weapon. A Scope trait alone is insufficient.',csc('177'));
 if(extraTags>0&&!families.has('fof-safety'))add('CSC_FOF_TAG_ASSOCIATION','Extra FOF tags require a FOF Safety on this installation; the stored quantity is retained until explicitly changed.',csc('175'));
 if(extraTags>0&&techLevel<CSC_FOF_TAG.tl)add('ACCESSORY_TL','Extra FOF tags require TL9.',csc('175'));
 // Invalid drafts retain selections but receive no accessory prices or benefits.
 if(diagnostics.some(d=>d.severity==='error'))return clone({cost:null,additionalCost:null,effects:[],details:[],traits:weapon.traits,diagnostics});
 let cost=0,traits=[...weapon.traits];const effects=[],details=[],applicability=firingApplicability(weapon);
 for(const a of accessories){
  cost+=a.cost;
  details.push({id:a.id,copies:record.linkedWeapons,unitCost:a.cost,cost:a.cost*record.linkedWeapons,massKgPerCopy:a.massKg,source:a.source});
  const effect={accessory:a.id,source:a.source,scope:'Selected weapon only',skillGranted:false,recipientVisionGranted:false,resolvedAttack:false};
  if(a.kind==='gyrostabiliser'){
   traits=traits.flatMap(t=>t==='Very Bulky'?['Bulky']:t==='Bulky'?[]:[t]);
   effects.push({...effect,removedTrait:weapon.traits.includes('Very Bulky')?'Very Bulky':'Bulky',replacementTrait:weapon.traits.includes('Very Bulky')?'Bulky':null});
  }
  if(a.kind==='scope'){
   if(record.placement==='held'&&!traits.includes('Scope'))traits.push('Scope');
   effects.push({...effect,trait:'Scope',active:record.placement==='held',condition:'Using the scope on a hand-held rifle or heavy weapon',...(a.tl===7?{lowLightPenaltyIgnored:true}:{}),context:'Mounting the hardware alone does not grant its hand-held Scope benefit or recipient sensors.'});
  }
  if(a.kind==='holographic-sight'){
   if(!traits.includes('Scope'))traits.push('Scope');
   effects.push({...effect,trait:'Scope',modifier:1,rangeMetres:{minimum:50,minimumInclusive:true},condition:'Target is at least 50 metres away',interpretation:a.interpretation});
  }
  if(a.kind==='laser-sight')effects.push({...effect,modifier:1,rangeMetres:{maximum:50,maximumInclusive:false},visibleDot:a.tl!==10,condition:'Target is less than 50 metres away'});
  if(a.kind==='intelligent')effects.push({...effect,computerRating:a.computerRating,robotBrainBandwidthGranted:0,programsGranted:[],context:'Weapon computer hardware only; no robot brain bandwidth, skills or general software is installed.'});
  if(a.kind==='smart-tracker'){
   effects.push({...effect,modifier:weapon.weaponFamily==='melee'?null:2,conditionalFiringModifier:2,programBandwidth:0,computerAccessory:accessories.find(a=>a.kind==='intelligent').id,requiresSuccessfulHit:true,tagAction:'Minor',tagActions:1,tagInHitRound:true,bonusRound:'following round',requiresSameWeapon:true,requiresSameTarget:true,retagEachRound:true,requiresFiringAttack:true,ordinaryMeleeBonusGranted:false,operationalApplicability:applicability,operationalBenefitCertified:applicability==='conditional-firing-use',condition:'Following-round firing attack on a target hit and tagged by this weapon in the previous round',...(applicability!=='conditional-firing-use'?{interpretation:'Hardware may be added to any Intelligent Weapon. The firearm/fired-upon operating language does not certify non-firearm benefits; ordinary melee attacks do not qualify.'}:{})});
   if(applicability==='requires-referee-confirmation')add('CSC_TRACKER_FIRING_UNVERIFIED','Tracker hardware is installed; firearm-specific operation on this source mechanism remains a referee interpretation.',csc('177'),'warning');
  }
  if(a.kind==='suppressor'){
   if(!traits.includes('Silent'))traits.push('Silent');
   effects.push({...effect,trait:'Silent',soundSourceDetectionDM:-6,condition:'Detecting the source of this weapon sound',context:'Does not grant general stealth or stack Silent detection modifiers.'});
  }
  if(a.kind==='bipod')effects.push({...effect,setup:{action:'Minor',actions:2},condition:'Firing from the deployed bipod',ignoredTraits:['Bulky','Very Bulky'],traitsPermanentlyRemoved:false,replacesRobotMount:false});
  if(a.kind==='fof-safety'){
   effects.push({...effect,includedTagsPerWeapon:2,includedTags:2*record.linkedWeapons,additionalTags:extraTags,totalTags:2*record.linkedWeapons+extraTags,requiresTriggerActivatedFiringMechanism:true,triggerCompatibility:applicability==='conditional-firing-use'?'firearm-mechanism-interpretation':'unverified-source-mechanism',signalRangeMetres:50,targetDistanceFromTagMetres:1,requiresTransmittingTag:true,requiresMatchingCode:true,preventsFiring:true,universalFriendlyFireImmunity:false,phudRequired:false,phudGranted:false,condition:'Compatible trigger-activated weapon targets an object within 1 metre of a correctly coded transmitting tag whose signal reaches the scanner within 50 metres',interpretation:'Fitting the safety assumes a compatible trigger mechanism. Gun Combat skill and hardware purchase do not establish that mechanism or certify operating conditions.'});
   if(applicability!=='conditional-firing-use')add('CSC_FOF_TRIGGER_UNVERIFIED','FOF Safety hardware is priced, but this source profile does not certify a compatible trigger-activated firing mechanism.',csc('175'),'warning');
  }
  if(a.kind==='scan-jammer')effects.push({...effect,check:'Electronics (sensors)',discoveryDM:-4,condition:'A sensor check made to discover this weapon',generalRobotStealthGranted:false,automaticConcealmentStacking:false,settingLaw:{highlyIllegalAboveLawLevel:0,constructionValidityDeterminesLegality:false}});
  if(a.kind==='secure')effects.push({...effect,authenticationRequiredBeforeFiring:true,authenticationMethodSelected:null,robotSensorPrerequisite:false,robotComputerPrerequisite:false,condition:'Authenticate before this weapon may be fired'});
  if(a.kind==='shoulder-stock')effects.push({...effect,condition:'Stock attached to this pistol',rangeMultipliers:{effective:1.25,long:1.25,extreme:1},baseRangeUnchanged:true,mountClassUnchanged:true,weaponFamilyUnchanged:true,holsterWhileAttached:false,attachDetach:a.tl===9?{action:'Significant',actions:1}:{duration:'1D rounds'}});
  if(a.kind==='xray')effects.push({...effect,scopeDependency:selectedScope?{accessory:selectedScope.id,source:selectedScope.source}:{integralWeapon:weapon.id,source:csc(integralScopePage)},requiresScopeUse:true,scopeUseCertified:false,handHeldScopeBenefitEligible:record.placement==='held',maximumBarrierMetres:a.maximumBarrierMetres,excludedBarrierMaterials:['metal'],requiresUnshieldedBarrier:true,coverDMIgnored:true,protectionRetained:true,generalXrayVisionGranted:false,condition:'Using the existing scope through an unshielded, non-metal barrier no thicker than the aid limit; target Protection remains'});
 }
 const additionalCost=extraTags*CSC_FOF_TAG.cost;
 if(extraTags)details.push({id:CSC_FOF_TAG.id,copies:extraTags,quantityScope:'installation-set',unitCost:CSC_FOF_TAG.cost,cost:additionalCost,massKgPerCopy:null,source:CSC_FOF_TAG.source});
 const mass={knownKgPerWeapon:accessories.reduce((sum,a)=>sum+(a.massKg??0),0),unresolvedAccessoryIds:accessories.filter(a=>a.massKg===null).map(a=>a.id),weaponMassUnchanged:true,vehicleMountAggregation:'not-specified-by-source',source:csc('174-177')};
 const tagInventory=families.has('fof-safety')?{included:2*record.linkedWeapons,additional:extraTags,total:2*record.linkedWeapons+extraTags,additionalCost,quantityScope:'installation-set',massKgPerTag:null,weaponMounted:false,location:'Worn by personnel',source:csc('175')}:null;
 return clone({cost,additionalCost,effects,details,traits,mass,tagInventory,diagnostics});
}
