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
 ['suppressor','Suppressor',8,250,null,'suppressor','suppressor','131,177']
];
export const CSC_WEAPON_ACCESSORIES=rows.map(([id,label,tl,cost,massKg,family,kind,pages])=>({
 id:'csc-'+id,label:label+' (CSC 2023)',tl,cost,massKg,family,kind,sourceFamily:'csc-2023',source:csc(pages),
 ...(kind==='intelligent'?{computerRating:Number(id.at(-1))}:{}),
 ...(kind==='holographic-sight'?{interpretation:'The p175 prose includes targets at 50 metres; the table says beyond 50m. This profile follows the explicit prose threshold.'}:{})
}));

// Both the UI catalogue and imported records use source categories, never mount size.
export function cscAccessoryEligibility(weapon,accessory){
 const failure=(code,message,pages)=>({available:false,code,reason:message,source:csc(pages)});
 if(weapon.sourceFamily!=='csc-2023'||weapon.compatibility?.accessoryRules!=='csc-2023'||accessory.sourceFamily!=='csc-2023')return failure('ACCESSORY_SOURCE','This accessory requires a supported CSC weapon profile.','174-177');
 if(accessory.kind==='gyrostabiliser'&&weapon.conditionalEffects?.includedEquipment?.gyroscopicStabilisation)return failure('CSC_INCLUDED_STABILISATION','This weapon already includes stabilisation while retaining its printed Bulky trait; additional stabilisation effects are not defined.','146,175');
 if(accessory.kind==='gyrostabiliser'&&(!weapon.traits.some(t=>t==='Bulky'||t==='Very Bulky')||weapon.damage?.includes('DD')||weapon.traits.includes('Destructive')))return failure('GYROSTABILISER_WEAPON','CSC gyrostabilisers require Bulky or Very Bulky and cannot be fitted to Destructive weapons.','175');
 if(accessory.kind==='smart-tracker'&&weapon.weaponFamily==='archaic')return failure('CSC_TRACKER_FIREARM','The CSC smart tracker describes firearm use; it does not establish compatibility with archaic weapons.','177');
 if(accessory.kind==='scope'&&!['rifle','heavy-portable','heavy-vehicle'].includes(weapon.weaponFamily))return failure('SCOPE_WEAPON','Scopes require a source-defined rifle or heavy weapon.','176');
 if(accessory.kind==='suppressor'&&(weapon.speciality!=='slug'&&weapon.slugThrower!==true||weapon.traits.some(t=>/^Auto(?: |$)/.test(t))))return failure('SUPPRESSOR_WEAPON','Suppressors require a non-automatic slug thrower.','177');
 if(accessory.family==='sight'&&weapon.traits.includes('Scope'))return failure('CSC_SIGHT_LIMIT','The weapon already has an integral scope; replacement or additional sights need a separate referee decision.','174');
 return {available:true,reason:null};
}

export function evaluateCscAccessories(weapon,record,techLevel){
 const accessories=(record.accessories??[]).map(id=>CSC_WEAPON_ACCESSORIES.find(a=>a.id===id)),diagnostics=[],families=new Set();
 const add=(code,message,source)=>diagnostics.push({code,message,source});
 for(const a of accessories){
  if(!a){add('CSC_ACCESSORIES_UNSUPPORTED','Only explicitly supported CSC accessory IDs may be used with this source profile.',csc('174-177'));continue;}
  const eligibility=cscAccessoryEligibility(weapon,a);
  if(!eligibility.available)add(eligibility.code,eligibility.reason,eligibility.source);
  if(a.tl>techLevel)add('ACCESSORY_TL',a.label+' exceeds design technology.',a.source);
  if(families.has(a.family))add(a.family==='sight'?'CSC_SIGHT_LIMIT':'ACCESSORY_FAMILY',a.family==='sight'?'Choose only one sight or scope.':'Choose only one accessory of each family.',a.family==='sight'?csc('174'):a.source);
  families.add(a.family);
 }
 if(families.has('smart-tracker')&&!families.has('intelligent'))add('CSC_TRACKER_COMPUTER','A smart tracker requires an Intelligent Weapon computer on this same weapon.',csc('175,177'));
 // Invalid drafts retain selections but receive no accessory prices or benefits.
 if(diagnostics.length)return clone({cost:null,effects:[],details:[],traits:weapon.traits,diagnostics});
 let cost=0,traits=[...weapon.traits];const effects=[],details=[];
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
  if(a.kind==='smart-tracker')effects.push({...effect,modifier:2,programBandwidth:0,computerAccessory:accessories.find(a=>a.kind==='intelligent').id,requiresSuccessfulHit:true,tagAction:'Minor',tagActions:1,tagInHitRound:true,bonusRound:'following round',requiresSameWeapon:true,requiresSameTarget:true,retagEachRound:true,condition:'Following-round attack on a target hit and tagged by this weapon in the previous round'});
  if(a.kind==='suppressor'){
   if(!traits.includes('Silent'))traits.push('Silent');
   effects.push({...effect,trait:'Silent',soundSourceDetectionDM:-6,condition:'Detecting the source of this weapon sound',context:'Does not grant general stealth or stack Silent detection modifiers.'});
  }
 }
 return clone({cost,effects,details,traits,diagnostics});
}
