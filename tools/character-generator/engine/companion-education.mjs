// Original procedural representation: Traveller Companion Update 2024, pp.32-34.
// Inherits Core Rulebook Update 2022, pp.16-17; no hidden dice or source prose.
// This next-phase module does not change session, UI, or existing rule packs.
import {PRECAREER_RULES,SPECIES_RULES} from './expansion-pack.mjs';
import {CORE_PACK} from './core-pack.mjs';
import {PRECAREER_EVENTS} from './education-pack.mjs';
import {normalizeSkillName,PSIONIC_TALENTS} from './skills.mjs';
import {SKILLS} from './catalog.mjs';

export const COMPANION_EDUCATION_VERSION=1;
export const COMPANION_EDUCATION_IDS=Object.freeze(Object.keys(PRECAREER_RULES));
const inheritedSource=Object.freeze({id:'core',title:'Core Rulebook Update 2022',pages:[11,16,17]});
export const COMPANION_TERM_RULES=Object.freeze({
 firstTerm:1,lastTerm:3,years:4,entryAttemptsPerTerm:1,eventCount:1,eventBeforeGraduation:true,
 failedEntryConsumesTerm:false,keepInitialAwardsOnFailedGraduation:true,musteringOut:false,
 colonialFirstCareerAge:{base:22,dice:'2D3'},source:inheritedSource
});
export const COMPANION_CHOICE_SCHEMA=Object.freeze({
 kind:'education-skill-choice',fields:['selectionId','count','options','mode','value'],
 constraints:['excludeSelections','optionsFromSelections','additionalOptions','requiredLevel','existingOnly'],
 resolution:'Use companionResolveSkillChoice; persist returned selection before later choices.'
});
const clone=value=>structuredClone(value);
const skill=(name,value,mode='set')=>({kind:'skill',name,mode,value});
const stat=(name,value)=>({kind:'stat',name,value});
const relation=type=>({kind:'relationship',type,count:1});
const base=name=>name.split(' (')[0];
function rule(id){if(!Object.hasOwn(PRECAREER_RULES,id))throw new Error('Unknown Companion pre-career.');return PRECAREER_RULES[id];}
function integer(value,min,max,name){if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(name+' must be an integer from '+min+' to '+max+'.');return value;}
function boolean(value,name){if(typeof value!=='boolean')throw new TypeError(name+' must be boolean.');return value;}
function missingNumber(value,name,min,max,missing){if(value===undefined){missing.push(name);return undefined;}return integer(value,min,max,name);}
function score(stats,name,missing){return missingNumber(stats?.[name],'stats.'+name,0,40,missing);}
function dm(n){return n===0?-3:n<3?-2:n<6?-1:n<9?0:n<12?1:n<15?2:3;}
function result(id,extra={}){
 return {id,source:clone(rule(id).source),effects:[],resolved:true,needsAdjudication:false,missingInputs:[],...extra};
}
function missingResult(id,missing,extra={}){return result(id,{...extra,effects:[],resolved:false,missingInputs:[...new Set(missing)]});}
function adjudicate(id,reason,extra={}){return result(id,{...extra,effects:[],resolved:false,needsAdjudication:true,reason});}
function speciesModifier(species,phase){
 if(!['human',...Object.keys(SPECIES_RULES)].includes(species))throw new Error('Unknown species.');
 return SPECIES_RULES[species]?.precareer?.[phase==='entry'?'qualificationDM':'graduationDM']??0;
}
function thresholds(rows,stats,missing){
 let total=0;
 for(const row of rows??[]){
  const value=score(stats,row.condition.stat,missing);
  if(value!==undefined&&value>=(row.condition.min??-Infinity)&&value<=(row.condition.max??Infinity))total+=row.dm;
 }
 return total;
}
function talentNames(value,missing){
 if(value===undefined){missing.push('acquiredTalents');return [];}
 if(!Array.isArray(value)||new Set(value).size!==value.length||!value.every(n=>PSIONIC_TALENTS.includes(n)))throw new TypeError('acquiredTalents must contain distinct supported talent names.');
 return value;
}
function curriculumRule(id,curriculum,missing){
 if(curriculum===undefined){missing.push('curriculum');return null;}
 const selected=rule(id).curricula?.[curriculum];
 if(!selected)throw new Error('Curriculum must be business or shipboard.');
 return selected;
}
function choice(selectionId,names,count,value,extra={}){
 return {kind:'education-skill-choice',selectionId,count,options:names.map(name=>({name})),mode:'set',value,...extra};
}
const colonialSkills=PRECAREER_RULES['companion.colonial'].admissionEffects.map(e=>e.name);
const colonialZeroSkills=PRECAREER_RULES['companion.colonial'].admissionEffects.filter(e=>e.value===0).map(e=>e.name);

/** term is one-based. No University/Academy later-term DM is copied to these options. */
export function companionEntryCheck({id,term,stats,homeworld,roll,species='human',attemptedThisTerm=false}={}){
 const r=rule(id),missing=[];
 missingNumber(term,'term',1,100,missing);boolean(attemptedThisTerm,'attemptedThisTerm');
 const speciesDM=speciesModifier(species,'entry');
 if(missing.length)return missingResult(id,missing);
 if(term>3||attemptedThisTerm)return result(id,{term,eligible:false,success:false,consumesTerm:false,reason:term>3?'pre-career-term-limit':'entry-already-attempted-this-term'});
 const entry=r.entry;let automatic=false,check=entry;
 if(entry.automaticWhen){
  const condition=entry.automaticWhen;
  if(condition.homeworldTLMax!==undefined){
   const tl=missingNumber(homeworld?.techLevel,'homeworld.techLevel',0,40,missing);
   automatic=tl!==undefined&&tl<=condition.homeworldTLMax;
  }else if(condition.homeworldSize!==undefined){
   const size=missingNumber(homeworld?.size,'homeworld.size',0,40,missing);
   automatic=size===condition.homeworldSize;
  }else{
   const value=score(stats,condition.stat,missing);
   automatic=value!==undefined&&value<=(condition.max??Infinity)&&value>=(condition.min??-Infinity);
  }
  if(missing.length)return missingResult(id,missing);
  if(!automatic&&!entry.otherwise)return adjudicate(id,'The source supplies no admission rule outside this automatic-entry condition.',{term,eligible:null,success:null});
  check=entry.otherwise;
 }
 if(automatic)return result(id,{term,eligible:true,automatic:true,success:true,consumesTerm:true,roll:null,next:'initial-awards'});
 const value=score(stats,check.stat,missing),thresholdModifier=thresholds(check.modifiers,stats,missing);
 missingNumber(roll,'roll',2,12,missing);
 if(missing.length)return missingResult(id,missing);
 const characteristicDM=dm(value),total=roll+characteristicDM+thresholdModifier+speciesDM,success=total>=check.target;
 return result(id,{term,eligible:true,automatic:false,roll,stat:check.stat,characteristicDM,thresholdModifier,speciesModifier:speciesDM,total,target:check.target,success,consumesTerm:success,next:success?'initial-awards':'career-qualification'});
}

/** Resolve only after successful entry. Acquired talents require completed testing/training. */
export function companionInitialAwards({id,curriculum,serviceRoll,acquiredTalents,psionicTrainingComplete}={}){
 const r=rule(id),missing=[];let effects=clone(r.admissionEffects??[]);
 if(id==='companion.psionic'){
  const talents=talentNames(acquiredTalents,missing);
  if(psionicTrainingComplete===undefined)missing.push('psionicTrainingComplete');
  else boolean(psionicTrainingComplete,'psionicTrainingComplete');
  if(missing.length)return missingResult(id,missing);
  if(!psionicTrainingComplete)return adjudicate(id,'Complete potential testing, talent acquisition and initial training before granting talent levels.');
  effects.push(...talents.map(name=>({kind:'psionic-talent',name,mode:'set',value:0})));
 }
 if(id==='companion.merchant'){
  const curriculumData=curriculumRule(id,curriculum,missing);
  missingNumber(serviceRoll,'serviceRoll',1,6,missing);
  if(missing.length)return missingResult(id,missing);
  const core=CORE_PACK[curriculumData.career];
  effects=core.training.assignments[curriculumData.assignment].flat().map(e=>{
   if(e.kind!=='skill')throw new Error('Merchant curriculum contains an unsupported non-skill result.');
   return skill(base(e.name),0);
  });
  const service=core.training.service[serviceRoll-1];
  if(service.some(e=>e.kind!=='skill'))return adjudicate(id,'Merchant service result needs an explicit skill interpretation.');
  effects.push(...service.map(e=>skill(e.name,1)));
  return result(id,{effects,curriculum,assignment:curriculumData.assignment,serviceRoll,serviceSource:clone(core.source),next:'education-event'});
 }
 if(r.admissionChoice){
  effects.push(choice(id==='companion.spacer'?'spacer-initial':'hard-knocks-initial',r.admissionChoice.skills,r.admissionChoice.count,r.admissionChoice.level));
 }
 return result(id,{effects,next:'education-event'});
}

/** One shared Core event, before graduation. Nested rolls/checks remain caller-resolved effects. */
export function companionEvent({id,entered,roll}={}){
 rule(id);
 if(entered===undefined)return missingResult(id,['entered']);
 boolean(entered,'entered');
 if(!entered)return result(id,{eventRequired:false,next:'career-qualification'});
 const missing=[];missingNumber(roll,'roll',2,12,missing);
 if(missing.length)return missingResult(id,missing);
 return result(id,{effects:clone(PRECAREER_EVENTS[roll]),eventRequired:true,roll,eventSource:clone(inheritedSource),route:{table:'core.pre-career-events',dice:'2D',result:roll},next:'graduation'});
}

/** Awards use floor-setting levels. Colonial eduLoss is the supplied D3 result, not a D6. */
export function companionGraduationCheck({id,stats,roll,species='human',graduationAllowed=true,curriculum,acquiredTalents,eduLoss}={}){
 const r=rule(id),g=r.graduation,missing=[];boolean(graduationAllowed,'graduationAllowed');
 if(!graduationAllowed)return result(id,{attempted:false,graduated:false,honours:false,total:null,target:g.target,reason:'education-event',next:'education-finish'});
 const value=score(stats,g.stat,missing),thresholdModifier=thresholds(g.modifiers,stats,missing);
 missingNumber(roll,'roll',2,12,missing);
 const speciesDM=speciesModifier(species,'graduation');
 if(missing.length)return missingResult(id,missing);
 const characteristicDM=dm(value),total=roll+characteristicDM+thresholdModifier+speciesDM,graduated=total>=g.target,honours=total>=g.honours;
 const meta={attempted:true,roll,stat:g.stat,characteristicDM,thresholdModifier,speciesModifier:speciesDM,total,target:g.target,honoursTarget:g.honours,graduated,honours,next:'education-finish'};
 if(!graduated)return result(id,meta);
 let effects=[];
 if(id==='companion.colonial'){
  missingNumber(eduLoss,'eduLoss',1,3,missing);
  if(missing.length)return missingResult(id,missing,meta);
  effects=[
   choice('colonial-primary',colonialZeroSkills,1,1,{requiredLevel:0}),
   {kind:'choice',options:[
    {label:'Two other listed skills',effects:[choice('colonial-other',colonialSkills,2,1,{excludeSelections:['colonial-primary']})]},
    {label:'Increase an existing skill',effects:[choice('colonial-existing',[],1,1,{existingOnly:true,mode:'increase'})]}
   ]},
   skill('Jack-of-all-Trades',1),stat('END',1),stat('EDU',-eduLoss)
  ];
  if(honours)effects.push(skill('Leadership',1),choice('colonial-honours',colonialZeroSkills,1,1,{requiredLevel:0,excludeSelections:['colonial-primary']}));
 }
 if(id==='companion.psionic'){
  const talents=talentNames(acquiredTalents,missing);
  if(missing.length)return missingResult(id,missing,meta);
  if(!talents.length)return adjudicate(id,'Graduation awards require a possessed talent, but none were acquired.',meta);
  effects=[stat('PSI',1),choice('psionic-primary',talents,1,1),skill('Science (psionicology)',1)];
  if(honours)effects.push(...talents.map(name=>({kind:'psionic-talent',name,mode:'set',value:1})),choice('psionic-honours',talents,1,2));
  effects.push(relation(honours?'Enemy':'Rival'));
 }
 if(id==='companion.merchant'){
  const cr=curriculumRule(id,curriculum,missing);
  if(missing.length)return missingResult(id,missing,meta);
  const names=CORE_PACK[cr.career].training.assignments[cr.assignment].flat().map(e=>base(e.name));
  effects=[choice('merchant-graduation',names,1,1),stat('EDU',1)];
 }
 if(id==='companion.hard-knocks'){
  effects=[choice('hard-knocks-other',r.admissionChoice.skills,3,0,{excludeSelections:['hard-knocks-initial']}),skill('Gun Combat',0),stat('SOC',-1)];
  if(honours)effects.push(skill('Carouse',1),choice('hard-knocks-honours',[],1,1,{optionsFromSelections:['hard-knocks-initial','hard-knocks-other'],additionalOptions:['Gun Combat'],requiredLevel:0}));
 }
 if(id==='companion.spacer'){
  effects=[choice('spacer-other',r.admissionChoice.skills,2,0,{excludeSelections:['spacer-initial']}),choice('spacer-graduation',['Vacc Suit',...r.admissionChoice.skills],1,1),skill('Pilot',0),stat('DEX',1),stat('SOC',-2)];
  if(honours)effects.push(skill('Jack-of-all-Trades',1));
 }
 return result(id,{...meta,effects});
}

/** Resolve one choice at its queue position, after preceding effects have been applied.
 * selections maps selectionId to the returned canonical-name array; do not discard it.
 * Skill-limit enforcement and species-specific skill permissions remain the caller's job.
 */
export function companionResolveSkillChoice({id,effect,selected,skills,selections={}}={}){
 rule(id);const missing=[];
 if(!effect||effect.kind!=='education-skill-choice')throw new TypeError('A Companion education skill choice is required.');
 if(selected===undefined)missing.push('selected');
 if(skills===undefined)missing.push('skills');
 const refs=[...(effect.excludeSelections??[]),...(effect.optionsFromSelections??[])];
 for(const ref of refs)if(!Array.isArray(selections[ref]))missing.push('selections.'+ref);
 if(missing.length)return missingResult(id,missing);
 if(!skills||typeof skills!=='object'||Array.isArray(skills))throw new TypeError('skills must be a skill-level map.');
 if(!Array.isArray(selected)||selected.length!==(effect.count??1))throw new TypeError('Choose exactly '+(effect.count??1)+' skills.');
 const names=selected.map(n=>{
  const parsed=normalizeSkillName(n,{requireSpeciality:effect.value>0});
  if(!SKILLS.includes(parsed.base))throw new Error('Choose a supported skill.');
  if(effect.value===0&&parsed.speciality)throw new Error('Level-zero awards use the base skill.');
  return parsed.name;
 });
 if(new Set(names.map(base)).size!==names.length)throw new Error('Choices must be distinct skills.');
 let allowed=(effect.options??[]).map(o=>o.name);
 if(effect.optionsFromSelections)allowed=[...effect.optionsFromSelections.flatMap(ref=>selections[ref]),...(effect.additionalOptions??[])];
 if(effect.existingOnly)allowed=Object.keys(skills).filter(n=>skills[n]>=0);
 const excluded=(effect.excludeSelections??[]).flatMap(ref=>selections[ref]).map(base);
 for(const name of names){
  if(!allowed.some(n=>base(n)===base(name))||excluded.includes(base(name)))throw new Error('Skill is outside this choice or was already selected.');
  const current=skills[name]??skills[base(name)]??-1;
  if(effect.existingOnly&&current<0)throw new Error('Choose an existing skill.');
  if(effect.requiredLevel!==undefined&&current!==effect.requiredLevel)throw new Error('Choose a skill currently at level '+effect.requiredLevel+'.');
  if(PSIONIC_TALENTS.includes(name)&&current<0)throw new Error('Talent must already be acquired.');
 }
 return result(id,{effects:names.map(name=>PSIONIC_TALENTS.includes(name)?{kind:'psionic-talent',name,mode:effect.mode,value:effect.value}:skill(name,effect.value,effect.mode)),selection:{id:effect.selectionId,names}});
}

/** Four-year term on entry, even on failed/blocked graduation. Colonial extra years are not extra terms. */
export function companionTermOutcome({id,entered,age,term,colonialAgeDice}={}){
 rule(id);const missing=[];
 if(entered===undefined)missing.push('entered');else boolean(entered,'entered');
 missingNumber(age,'age',0,1000,missing);missingNumber(term,'term',1,100,missing);
 if(missing.length)return missingResult(id,missing);
 if(!entered)return result(id,{ageBefore:age,ageAfter:age,years:0,termDelta:0,nextTerm:term,musteringOut:false});
 if(term>3)return adjudicate(id,'Education after term three is outside the inherited Core pre-career window.');
 let ageAfter=age+4,extraYears=0;
 if(id==='companion.colonial'){
  if(term!==1||age!==18)return adjudicate(id,'The absolute colonial first-career age is not defined for a later education term or nonstandard starting age.');
  if(colonialAgeDice===undefined)return missingResult(id,['colonialAgeDice']);
  if(!Array.isArray(colonialAgeDice)||colonialAgeDice.length!==2)throw new TypeError('Supply both D3 results for colonialAgeDice.');
  extraYears=colonialAgeDice.reduce((sum,n)=>sum+integer(n,1,3,'Colonial D3'),0);
  ageAfter=22+extraYears;
 }
 return result(id,{ageBefore:age,ageAfter,years:ageAfter-age,extraYears,termDelta:1,nextTerm:term+1,musteringOut:false,keepInitialAwards:true,speciesAgeingRulesRequired:true});
}

/** Persistent qualification/advancement rights are metadata, never applied as skill awards.
 * firstCareerAfterEducation means first ENTERED career, not first attempted qualification.
 * citizenBranchApproved records a referee decision; no Citizen assignment mapping is inferred.
 */
export function companionCareerBenefits({id,graduation,careerId,assignment,curriculum,firstCareerAfterEducation,firstCareerExit,citizenBranchApproved,enteringCareer=false,forcedNextCareer=null}={}){
 const r=rule(id),missing=[];
 if(typeof careerId!=='string')throw new TypeError('careerId is required.');
 boolean(enteringCareer,'enteringCareer');
 if(!graduation||graduation.id!==id)return missingResult(id,['graduation']);
 boolean(graduation.attempted,'graduation.attempted');boolean(graduation.graduated,'graduation.graduated');boolean(graduation.honours,'graduation.honours');
 if(graduation.graduated&&!graduation.attempted)throw new TypeError('Graduation requires an attempted graduation check.');
 if(graduation.honours&&!graduation.graduated)throw new TypeError('Honours require graduation.');
 if(graduation.resolved===false)return missingResult(id,['resolved graduation'],{graduationUnresolved:true});
 const meta={careerId,assignment,qualificationModifier:0,commissionModifier:0,advancementModifier:0,automaticEntry:false,entryRank:null,rankEffects:[],effects:[]};
 if(forcedNextCareer&&forcedNextCareer!==careerId)return adjudicate(id,'A required next career takes precedence over education benefits.',meta);
 if(id==='companion.colonial'){
  meta.qualificationModifier=r.careerQualificationDM[careerId]??r.careerQualificationDM.otherwise;
  meta.commissionModifier=r.commissionDM;meta.advancementModifier=r.advancementDM;
  return result(id,{...meta,scope:'persistent-from-upbringing'});
 }
 if(!graduation.graduated)return result(id,meta);
 if(id==='companion.psionic'){
  if(careerId==='core.psion')meta.automaticEntry=true;
  else if(careerId.endsWith('.psion'))return adjudicate(id,'Equivalence to a non-Core Psion career requires a campaign decision.',meta);
 }
 if(id==='companion.merchant'&&r.careerEntry.careers.includes(careerId)){
  meta.advancementModifier=graduation.honours?r.advancementDM.honours:r.advancementDM.graduate;
  if(firstCareerAfterEducation===undefined)missing.push('firstCareerAfterEducation');else boolean(firstCareerAfterEducation,'firstCareerAfterEducation');
  const cr=curriculumRule(id,curriculum,missing);
  if(assignment===undefined)missing.push('assignment');
  if(missing.length)return missingResult(id,missing,meta);
  if(firstCareerAfterEducation){
   if(careerId==='core.citizen'){
    if(citizenBranchApproved===undefined)return adjudicate(id,'The source does not map Merchant curricula to Citizen assignments.',meta);
    boolean(citizenBranchApproved,'citizenBranchApproved');
   }
   const appropriate=careerId==='core.merchant'?assignment===cr.assignment:citizenBranchApproved;
   if(appropriate){
    const rows=CORE_PACK[careerId]?.ranks.assignments?.[assignment];
    if(!rows)throw new Error('Unknown career assignment.');
    meta.automaticEntry=true;meta.entryRank=graduation.honours?2:1;
    meta.rankEffects=clone(rows.find(row=>row.rank===meta.entryRank)?.effects??[]);
    if(enteringCareer)meta.effects=clone(meta.rankEffects);
   }
  }
 }
 if(id==='companion.hard-knocks'){
  if(firstCareerAfterEducation===undefined)return missingResult(id,['firstCareerAfterEducation'],meta);
  boolean(firstCareerAfterEducation,'firstCareerAfterEducation');
  if(firstCareerAfterEducation){meta.commissionModifier=-2;meta.advancementModifier=-2;}
  else{
   if(firstCareerExit===undefined)return missingResult(id,['firstCareerExit'],meta);
   if(!['voluntary','involuntary'].includes(firstCareerExit))throw new Error('firstCareerExit must be voluntary or involuntary.');
   if(firstCareerExit!=='voluntary')return adjudicate(id,'The source only removes the penalty after voluntary first-career departure; subsequent involuntary-exit handling is not specified.',meta);
  }
 }
 if(id==='companion.spacer'&&careerId===r.careerModifiers.career&&assignment===r.careerModifiers.assignment){
  meta.qualificationModifier=r.careerModifiers.qualificationDM;meta.commissionModifier=r.careerModifiers.commissionDM;meta.advancementModifier=r.careerModifiers.advancementDM;
 }
 return result(id,{...meta,scope:'persistent-unless-entry-rank-restriction'});
}
