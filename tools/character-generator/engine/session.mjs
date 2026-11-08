import { SPECIALITIES, PSIONIC_TALENTS, normalizeSkillName } from './skills.mjs';
import { EDUCATION_PACK, PRECAREER_EVENTS, educationEntryCheck, educationGraduationCheck, educationCareerBenefits } from './education-pack.mjs';
import { CORE_PACK } from './core-pack.mjs';
import { ageingOutcome, ageingCrisis, injuryOutcome, pensionForCareer } from './core-procedures.mjs';
import { EXPANSION_PACK, SPECIES_RULES, PRECAREER_RULES, BENEFIT_RULES, SOURCE_DISCREPANCIES, EXPANSION_TABLES } from './expansion-pack.mjs';
const RULE_PACK={...CORE_PACK,...EXPANSION_PACK};
import { API_VERSION, SOURCES, CAREERS, PRECAREERS, SPECIES, SKILLS, BACKGROUND_SKILLS, findCareer, findSpecies } from './catalog.mjs';
const LIMIT = 2000;
const MAX_SAVE_BYTES = 2000000;
const saveSize = value => new TextEncoder().encode(JSON.stringify(value,null,2)).byteLength;
const copy = value => structuredClone(value);
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
function need(value,message) { if (!value) throw new Error(message); }
function integer(value,min,max,name) { need(Number.isInteger(value)&&value>=min&&value<=max, name+' must be an integer from '+min+' to '+max+'.'); return value; }
function text(value,max=120) { need(typeof value==='string'&&value.length<=max,'Text exceeds its permitted length.'); return value.trim(); }
function hash(seed) { let n=2166136261; for(const c of seed) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0||1; }
export function characteristicDM(n) { need(Number.isFinite(n),'Invalid characteristic.'); return n<=0?-3:n<3?-2:n<6?-1:n<9?0:n<12?1:n<15?2:3; }
export const EXTRA_STATS = [
 {id:'PSI',name:'Psionic strength',kind:'published',source:'Core 2022 p. 228',dice:2,note:'Potential only. Training and talents are separate.'},
 {id:'LCK',name:'Luck',kind:'optional',source:'Companion 2024 p. 5',dice:2},
 {id:'MRL',name:'Morale',kind:'optional',source:'Companion 2024 p. 6',dice:2},
 {id:'STY',name:'Sanity',kind:'optional',source:'Companion 2024 p. 8',dice:2},
 {id:'WLT',name:'Wealth',kind:'optional',source:'Companion 2024 p. 4',derive:'SOC',note:'Starts at Social Standing; not a random roll.'},
 {id:'CHA',name:'Charisma',kind:'house',source:'House option outside the Vargr rules',dice:2}
];
function initial(seed) {
 return {version:API_VERSION,rng:hash(seed),stage:'identity',config:{boons:0,minimumReroll:true,allocation:true,extras:[],gm:false,zhodaniPsi:false},
 character:{name:'',species:'human',culture:'native',gender:'',homeworld:'',age:18,terms:0,stats:{},skills:{},traits:[],careers:[],relationships:[],benefits:[],cash:0,debt:0,notes:''},
 pool:[],rollTotal:null,backgroundRemaining:0,active:null,pending:null,failedQualification:false,draftUsed:false,cashRolls:0,connections:[],coverage:[],lastRoll:null};
}
function die(state) { let t=state.rng+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);state.rng>>>=0;return Math.floor(((t^t>>>14)>>>0)/4294967296*6)+1; }
function dice(state,n,rolls,label,boon=false) {
 const randomValues=Array.from({length:n+(boon?1:0)},()=>die(state));
 const forced=state._override?.index===rolls.length?state._override.values:null;
 if(forced)need(Array.isArray(forced)&&forced.length===randomValues.length&&forced.every(x=>Number.isInteger(x)&&x>=1&&x<=6),'Replacement dice must match the original dice count and each be 1-6.');
 const values=forced?[...forced]:randomValues;
 const kept=boon?[...values].sort((a,b)=>b-a).slice(0,n):values;
 const total=kept.reduce((a,b)=>a+b,0);
 const entry={label,values,kept,total};rolls.push(entry);state.lastRoll=entry;return total;
}
function stat(state,key) { need(Object.hasOwn(state.character.stats,key),'Characteristic '+key+' is not present.');return state.character.stats[key]; }
function maxStat(state,key) { return findSpecies(state.character.species).maxima?.[key]??15; }
function setStat(state,key,value) { integer(value,0,40,'Characteristic'); state.character.stats[key]=value; }
function gainSkill(state,name,level,mode='increase',allowTalentAcquisition=false) {
 need(typeof name==='string'&&name.length<=80,'Invalid skill.');
 const parsed=normalizeSkillName(name,{requireSpeciality:mode!=='set'||level>0});name=parsed.name;const base=parsed.base;need(SKILLS.includes(base),'Choose a supported skill or specialisation.');
 if(PSIONIC_TALENTS.includes(base)&&!Object.hasOwn(state.character.skills,name))need(allowTalentAcquisition&&(state.character.stats.PSI??0)>0,'Psionic talents require testing and explicit acquisition before improvement.');
 if(mode==='set'&&level===0&&SPECIALIZED.includes(base))name=base;
 const current=state.character.skills[name];
 const next=mode==='set'?Math.max(current??-1,integer(level,0,4,'Skill level')):Math.min(4,current===undefined?1:current+integer(level,1,4,'Skill gain'));
 const total=Object.values(state.character.skills).reduce((a,b)=>a+b,0)-(current??0)+Math.max(next,0);
 need(total<=3*((state.character.stats.INT??0)+(state.character.stats.EDU??0)),'Total skill limit exceeded.');
 state.character.skills[name]=Math.min(4,next);
}
function sourceStep(state,kind,source,page,label,next) {
 state.pending={kind,source,page,label,next};state.stage='book-step';
 if(!state.coverage.includes(kind)) state.coverage.push(kind);
}
function rulesCheck(state,check,rolls,label,modifier=0) {
 const candidates=check.stat.split('/');
 const chosen=candidates.sort((a,b)=>characteristicDM(stat(state,b))-characteristicDM(stat(state,a)))[0];
 const dm=chosen==='RITE'?stat(state,'RITE'):characteristicDM(stat(state,chosen));
 const natural=dice(state,2,rolls,label);
 return {natural,stat:chosen,dm,modifier,total:natural+dm+modifier,target:check.target,success:natural+dm+modifier>=check.target};
}
export function availableCareers(state) {
 const species=state.character.species,culture=state.character.culture;
 const groups=species==='aezorgh'?['core','vargr','companion']:species==='human'||culture==='imperial'?['core','companion']:[species,'companion'];
 return CAREERS.filter(c=>groups.includes(c.group)||c.id===state.forcedCareer).map(original=>{
 const pack=RULE_PACK[original.id],pre=pack?.prerequisites??{};
 const c={...original,qualification:pre.qualification===undefined?original.qualification:pre.qualification,assignments:original.assignments.map(a=>({...a,...pack?.checks?.[a.id]}))};
 let reason='';
 if(state.forcedCareer&&c.id!==state.forcedCareer)reason='An event requires a different next career.';
 if(state.character.qualificationBanned&&c.qualification)reason='An ageing crisis prevents future qualification checks.';
 if(!conditionMatches(state,pre))reason='The source prerequisites are not met.';
 if(c.specialEntry&&!state.character.sentenced)reason='Requires a sentencing event.';
 if(c.needsVerification)reason='Rule data awaiting verification.';
 if(c.id==='core.psion'&&!state.config.gm&&!state.character.psionEntryPermission)reason='Psion entry requires referee permission. Enable GM mode to grant it.';
 if(c.qualification?.stat==='PSI'&&!Object.hasOwn(state.character.stats,'PSI'))reason='Psionic strength must be tested first.';
 if(c.gender&&state.character.gender!==c.gender)reason='This career requires '+c.gender+' in the source rules.';
 if(c.minSOC&&(state.character.stats.SOC??0)<c.minSOC)reason='Requires SOC '+c.minSOC+' or greater.';
 if(c.maxSOC&&(state.character.stats.SOC??0)>c.maxSOC)reason='Requires SOC '+c.maxSOC+' or less.';
 if(species==='aslan'&&culture==='native'&&state.character.outcast&&!['aslan.outcast','aslan.outlaw'].includes(c.id))reason='Outcast restriction. Use the source rules to leave Hierate society.';
 if(c.id==='aslan.wanderer'&&state.character.birthOrder!=='second-son')reason='Requires a second son under the source rules.';
 return {...c,disabled:!!reason,reason};
 });
}
function enterCareer(state,career,assignment,rolls=[]) {
 const educational=educationRights(state,career.id,assignment,true);
 if(state.educationEntryRulings)delete state.educationEntryRulings[career.id];
 const previous=state.character.careers.at(-1);
 need(previous?.id!==career.id||career.id==='core.drifter'||state.pendingDraft,'Cannot immediately return to the career just left.');
 const next={id:career.id,assignment,drafted:!!state.pendingDraft,terms:0,rank:0,officer:false,benefitRolls:0,totalBenefits:0,successfulTerms:0};
 for(const m of state.modifiers??[])if(m.careerId==='next')m.careerId=career.id;
 state.character.careers.push(next);state.forcedCareer=null;state.forcedCareerDraft=false;next.educationCommission=educational.commission;next.commissionBlockedFirstTerm=educational.commissionBlocked;state.active=state.character.careers.length-1;state.failedQualification=false;state.pendingDraft=false;
 if(career.id==='companion.truther'&&!Object.hasOwn(state.character.stats,'FOL'))state.character.stats.FOL=0;
 const first=state.character.careers.length===1;
 const pack=RULE_PACK[career.id];
 if(pack){
  if(career.id==='core.prisoner')next.parole=mechanicalDice(state,'1D+2',rolls,'Parole threshold');
  const rows=pack.basicTraining.table==='assignment'?pack.training.assignments[assignment]:pack.training.service;
  const basic=first?rows.flatMap(asBasic):[{kind:'choice',options:rows.map((row,i)=>({label:'Basic-training option '+(i+1),effects:asBasic(row)}))}];
  next.entryEffects=[...basic,...educational.effects,...educational.unresolved];next.entryNext=first?'survival':'new-career-training';
  if(next.educationCommission)state.stage='preterm-commission';else finishCareerEntry(state,rolls);
 }else sourceStep(state,'basic-training',career.source,career.page,first?'Choose basic training from the source table.':'Choose one basic-training skill from the source table.','survival');
}
function currentCareer(state) { need(state.active!==null,'No active career.');const record=state.character.careers[state.active],career=findCareer(record.id),base=career.assignments.find(a=>a.id===record.assignment),override=RULE_PACK[record.id]?.checks?.[record.assignment];return {record,career,assignment:{...base,...override}}; }
function closeTerm(state) {
 const {record,career}=currentCareer(state);record.terms++;state.character.terms++;state.character.age+=4;
 if(!record.mishap){if(!(record.benefitBlock>0))record.benefitRolls++;record.successfulTerms++;}
 if(record.advancementBlock>0)record.advancementBlock--;if(record.benefitBlock>0)record.benefitBlock--;
 record.mishap=false;record.commissionTried=false;
 const species=findSpecies(state.character.species);const ageStart=species.agingStart??34;
 if(state.character.age>=ageStart)state.stage='ageing';
 else state.stage='term-end';
 if(career.maxTerms&&record.terms>=career.maxTerms){record.forcedExit=true;record.forcedStay=false;}
}
function applyEffects(state,effects) {
 need(Array.isArray(effects)&&effects.length<=30,'Too many effects.');
 for(const effect of effects) {
  need(plain(effect),'Invalid effect.');
  switch(effect.kind) {
   case 'skill':gainSkill(state,text(effect.name,80),integer(effect.value,0,4,'Skill value'),effect.mode==='set'?'set':'increase',true);break;
   case 'stat':{
    const key=text(effect.name,8);need(Object.hasOwn(state.character.stats,key),'Unknown characteristic.');
    const change=integer(effect.value,-12,12,'Characteristic change');
    if(state.character.species==='aezorgh'&&key==='CHA')throw new Error('Aezorgh CHA is derived from SOC. Resolve its cross-book change explicitly.');
    const value=stat(state,key)+change;need(value>=0,'Characteristic cannot be negative.');
    const ceiling=maxStat(state,key);
    if(key==='SOC'&&value>ceiling)state.character.benefits.push({name:'Ship share',quantity:value-ceiling});
    setStat(state,key,Math.min(ceiling,value));break;
   }
   case 'cash':state.character.cash+=integer(effect.value,-10000000,10000000,'Cash');break;
   case 'debt':state.character.debt+=integer(effect.value,0,10000000,'Debt');break;
   case 'relationship':need(['Contact','Ally','Rival','Enemy'].includes(effect.role),'Invalid relationship.');state.character.relationships.push({role:effect.role,name:text(effect.name,120)});break;
   case 'benefit':state.character.benefits.push({name:text(effect.name,120),quantity:integer(effect.value,1,100,'Quantity')});break;
   default:throw new Error('Unsupported effect.');
  }
 }
}
function advanceAfterBook(state,pending,payload,rolls) {
 if(pending.kind==='native-effect'){drainEffects(state,rolls);return;}
 if(pending.kind==='species-setup'){state.stage='background';return;}
 if(pending.kind==='precareer'){
  const years=integer(payload.years??4,0,16,'Years');state.character.age+=years;if(years)state.character.terms++;

  state.character.preCareer={id:pending.id,graduated:!!payload.graduated};state.stage='career';return;
 }
 if(pending.kind==='mishap'){
  const {record}=currentCareer(state);record.forcedExit=payload.leaveCareer!==false;
  if(payload.keepBenefit)record.mishap=false;
  closeTerm(state);return;
 }
 if(pending.kind==='career-event'){state.stage='advancement';return;}
 if(pending.kind==='advancement-training'){closeTerm(state);return;}
 if(pending.kind==='benefit'){
  const {record}=currentCareer(state);record.benefitRolls--;record.totalBenefits++;
  state.stage=record.benefitRolls?'benefits':'career';
  if(!record.benefitRolls)state.active=null;return;
 }
 state.stage=pending.next;
}


function conditionMatches(state,condition) {
 if(!condition)return true;
 if(condition.anyOf)return condition.anyOf.some(c=>conditionMatches(state,c));
 if(condition.allOf&&!condition.allOf.every(c=>conditionMatches(state,c)))return false;
 if(condition.gender&&state.character.gender!==condition.gender)return false;
 if(condition.stat){const value=state.character.stats[condition.stat]??-Infinity;if(value<(condition.min??-Infinity)||value>(condition.max??Infinity))return false;}
 if(condition.ageMin!==undefined&&state.character.age<condition.ageMin)return false;
 return true;
}
function backgroundOptions(state) {
 const species=SPECIES_RULES[state.character.species];
 return species?.background?.byGender?.[state.character.gender]??BACKGROUND_SKILLS;
}
function cashLimit(state) {
 if(state.character.species==='aslan'&&state.character.culture==='native')return state.character.gender==='female'?999:Math.max(0,skillLevel(state,'Independence'));
 return 3;
}


function educationRecord(state) { need(state.education!==undefined&&state.education!==null,'No education term is active.');return state.character.educations[state.education]; }
function educationOptions(state,e) {
 const definitions=e.options==='any'?SKILLS.filter(s=>!e.exclude?.includes(s)).map(name=>({name})):e.options;
 return definitions??[];
}
function educationSkillValid(state,name,e) {
 const base=name.split(' (')[0],definition=educationOptions(state,e).find(x=>x.name===base);
 if(!definition||!skillNameAllowed(state,name,{scope:'any',exclude:e.exclude}))return false;
 const specialty=name.match(/^.+ \(([^()]+)\)$/)?.[1];
 if(name!==base&&!specialty)return false;
 if(Array.isArray(definition.specialities)&&specialty&&!definition.specialities.includes(specialty))return false;
 return true;
}
function educationFinish(state,rolls) {
 const record=educationRecord(state);record.completed=true;
 record.graduation??=educationGraduationCheck({id:record.id,graduationAllowed:false});
 state.character.age+=4;state.character.terms++;
 state.character.preCareer={id:record.id,graduated:record.graduation.graduated,honours:record.graduation.honours};
 state.education=null;state.pendingChoice=null;
 const species=findSpecies(state.character.species);
 if(state.character.age>=(species.agingStart??34))sourceStep(state,'education-ageing','core',49,'Resolve the ageing checkpoint after this education term.','career');
 else state.stage='career';
}
function educationRights(state,careerId,assignment,entering=false) {
 const rights={qualificationModifier:0,automaticEntry:false,commission:null,commissionBlocked:false,effects:[],unresolved:[]};
 for(const [index,record] of (state.character.educations??[]).entries()) {
  if(!record.completed||!record.graduation)continue;
  const r=educationCareerBenefits({id:record.id,graduation:record.graduation,careerId,assignment,
   firstCareerAfterEducation:state.character.careers.length===record.careersBefore,
   firstCareerAttempt:(record.careerAttempts??0)===0,serviceAwardUsed:!!record.serviceAwardUsed,enteringCareer:entering,
   forcedNextCareer:state.forcedCareer});
  if(r.needsAdjudication){
   if(Object.hasOwn(state.educationEntryRulings??{},careerId)){if(state.educationEntryRulings[careerId]){rights.automaticEntry=true;rights.commissionBlocked=true;}}
   else rights.unresolved.push({kind:'unsupported',source:{id:'core',page:17},reason:r.reason});
   continue;
  }
  rights.qualificationModifier=Math.max(rights.qualificationModifier,r.qualificationModifier);
  rights.automaticEntry||=r.automaticEntry;
  if(r.commission?.allowed&&(!rights.commission||r.commission.automatic||r.commission.modifier>rights.commission.modifier))rights.commission=r.commission;
  if(r.commission?.allowed===false)rights.commissionBlocked=true;
  if(entering&&r.serviceAward){record.serviceAwardUsed=true;rights.effects.push(...r.effects.filter(e=>e.kind==='service-training').map(e=>({...e,educationIndex:index})));}
 }
 return rights;
}
function finishCareerEntry(state,rolls) {
 const {record}=currentCareer(state),effects=record.entryEffects??[],next=record.entryNext??'survival';
 delete record.entryEffects;delete record.entryNext;
 queueEffects(state,[...effects,...rankEffects(state)],next,rolls);
}
function learnedEducationSkills(state) {
 const before=educationRecord(state).skillsBefore;
 return Object.keys(state.character.skills).filter(name=>(state.character.skills[name]??-1)>(before[name]??-1));
}
function serviceSkills(careerId) {
 const rows=RULE_PACK[careerId]?.training.service;need(rows,'The service training table is unavailable.');
 const flatten=effects=>effects.flatMap(e=>e.kind==='choice'?e.options.flatMap(o=>flatten(o.effects)):e.kind==='skill'?[e.name.split(' (')[0]]:[]);
 return [...new Set(rows.flatMap(flatten))];
}

function nativePack(state) { return state.active===null?null:RULE_PACK[state.character.careers[state.active].id]??null; }
function rankEffects(state) {
 const {record}=currentCareer(state),pack=nativePack(state);if(!pack)return [];
 const rows=record.officer?(pack.ranks.officer??pack.ranks.default):pack.ranks.assignments?.[record.assignment]??pack.ranks.enlisted??pack.ranks.default;
 return copy(rows?.find(r=>r.rank===record.rank)?.effects??[]);
}
function asBasic(effects) {
 return effects.map(effect=>effect.kind==='choice'?{...effect,options:effect.options.map(o=>({...o,effects:asBasic(o.effects)}))}:effect.kind==='skill'?{...effect,name:effect.name.split(' (')[0],mode:'set',value:0}:effect.kind==='skill-choice'?{...effect,mode:'set',value:0}:effect);
}
function queueEffects(state,effects,next,rolls) {
 state.effectsQueue=copy(effects);state.effectNext=next;state.effectSteps=0;return drainEffects(state,rolls);
}
function completeEffects(state,rolls) {
 const next=state.effectNext;state.effectsQueue=[];state.effectNext=null;state.pendingChoice=null;
 if(next==='education-finish'){educationFinish(state,rolls);return;}
 if(next==='education-graduation'){if(!educationRecord(state).graduationAllowed)educationFinish(state,rolls);else state.stage=next;return;}
 if(next==='end-term'){closeTerm(state);return;}
 if(next==='ageing-crisis'){
  const preliminary=ageingCrisis({stats:state.character.stats});if(preliminary.crisis){const costDie=dice(state,1,rolls,'Ageing crisis medical cost');queueEffects(state,ageingCrisis({stats:state.character.stats,medicalDie:costDie}).effects,'term-end',rolls);}else state.stage='term-end';return;
 }
 if(next==='new-career-training'){state.stage='training';return;}
 if(next==='after-event'){const {record}=currentCareer(state);if(record.forcedExit||record.advancementBlock>0)closeTerm(state);else state.stage='advancement';return;}
 if(next==='benefit-complete'){const {record}=currentCareer(state);record.benefitRolls--;record.totalBenefits++;state.stage=record.benefitRolls?'benefits':'career';if(!record.benefitRolls)state.active=null;return;}
 state.stage=next;
}
function mechanicalDice(state,expression,rolls,label) {
 const spec=String(expression).match(/^(\d*)D([36]?)([+-]\d+)?$/);need(spec,'Unsupported dice expression: '+expression);
 const n=Number(spec[1]||1),faces=Number(spec[2]||6);need(n>=1&&n<=6,'Dice count exceeds limits.');
 dice(state,n,rolls,label+' ('+expression+')');const entry=rolls.at(-1);
 if(faces===3)entry.kept=entry.values.map(x=>Math.ceil(x/2));
 entry.modifier=Number(spec[3]||0);entry.total=entry.kept.reduce((a,b)=>a+b,0)+entry.modifier;
 return entry.total;
}
function skillLevel(state,name) {
 if(Object.hasOwn(state.character.skills,name))return state.character.skills[name];
 const base=name.split(' (')[0];if(name.includes(' ('))return state.character.skills[base]===0?0:-3;
 const values=Object.entries(state.character.skills).filter(([key])=>key===base||key.startsWith(base+' (')).map(([,v])=>v);
 return values.length?Math.max(...values):-3;
}
function skillNameAllowed(state,name,effect) {
 let parsed;try{parsed=normalizeSkillName(name);}catch{return false;}name=parsed.name;const base=parsed.base;
 if(PSIONIC_TALENTS.includes(base)&&skillLevel(state,name)<0)return false;
 if(!SKILLS.includes(base))return false;
 if(effect.exclude?.includes(base))return false;
 if(effect.scope==='existing'&&skillLevel(state,name)<0)return false;
 if(effect.scope==='science-specialties'&&base!=='Science')return false;
 if(effect.scope==='psionic-talents'&&(!['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy'].includes(base)||skillLevel(state,name)<0))return false;
 if(effect.allowed&&!effect.allowed.includes(base))return false;
 return true;
}
const SPECIALIZED = Object.keys(SPECIALITIES);
function nativeFallback(state,effect,reason) {
 const career=state.active!==null?currentCareer(state).career:state.education!==undefined&&state.education!==null?{source:'core',page:17}:{source:effect.source?.id??'core',page:effect.source?.page??16};
 sourceStep(state,'native-effect',effect.source?.id??career.source,effect.source?.page??effect.source?.pages?.[0]??effect.sourcePage??career.page,reason??effect.reason??('Resolve '+effect.kind+' from the source.'),'native-resume');
 state.pending.effect=copy(effect);
}
function drainEffects(state,rolls) {
 while(state.effectsQueue?.length) {
  state.effectSteps=(state.effectSteps??0)+1;need(state.effectSteps<200,'Rule-effect loop limit reached.');
  const e=state.effectsQueue.shift();need(e&&typeof e.kind==='string','Malformed source effect.');
  switch(e.kind) {
   case 'education-skill-choice':state.pendingChoice=e;state.stage='education-skill';return;
   case 'education-selected-skill':{
    const name=educationRecord(state).selections[e.selectionId];need(name,'The saved university skill selection is missing.');
    state.effectsQueue.unshift({kind:'skill',name,mode:e.mode,value:e.value});break;
   }
   case 'service-training':{
    const rows=RULE_PACK[e.career]?.training.service;
    if(!rows){nativeFallback(state,e,'Resolve the academy service training from its career table.');return;}
    if(e.selection==='all')state.effectsQueue.unshift(...rows.flatMap(asBasic));
    else {state.pendingChoice={...e,picked:e.picked??[],options:serviceSkills(e.career)};state.stage='education-service';return;}break;
   }
   case 'education-status':educationRecord(state).graduationAllowed=e.graduationAllowed;break;
   case 'checked-skill':{
    const name=educationRecord(state).checkedSkill;need(name,'The education check skill was not recorded.');
    state.effectsQueue.unshift({kind:'skill',name,mode:e.mode,value:e.value});break;
   }
   case 'psionic-test':{
    if(!Object.hasOwn(state.character.stats,'PSI'))state.character.stats.PSI=Math.max(0,dice(state,2,rolls,'Psionic potential')-state.character.careers.reduce((sum,c)=>sum+c.terms,0));
    break;
   }
   case 'career-permission':if(e.career==='core.psion')state.character.psionEntryPermission=true;else {nativeFallback(state,e);return;}break;
   case 'choice':state.pendingChoice=e;state.stage='effect-choice';return;
   case 'skill-choice':
    if(!['any','existing','science-specialties','psionic-talents'].includes(e.scope)||e.distinctSpecialties||e.untrained){nativeFallback(state,e,'Resolve the constrained skill choice from the source.');return;}
    state.pendingChoice=e;state.stage='skill-choice';return;
   case 'skill-reduction-choice':state.pendingChoice=e;state.stage='skill-choice';return;
   case 'skill':{
    const base=e.name.split(' (')[0];
    if(PSIONIC_TALENTS.includes(base)&&skillLevel(state,e.name)<0){nativeFallback(state,e,'Resolve the required psionic talent acquisition before awarding this skill.');return;}
    if(e.value>0&&SPECIALIZED.includes(base)&&e.name===base){state.pendingChoice={kind:'skill-choice',scope:'any',allowed:[base],mode:e.mode,value:e.value,label:'Choose a '+base+' specialisation'};state.stage='skill-choice';return;}

    gainSkill(state,e.name,e.value??1,e.mode);break;
   }
   case 'stat':{
    if(state.character.species==='aezorgh'&&e.name==='CHA'){nativeFallback(state,e,'Aezorgh CHA is derived from SOC. Resolve this cross-book effect explicitly.');return;}
    if(!Object.hasOwn(state.character.stats,e.name)){nativeFallback(state,e,'The '+e.name+' characteristic is absent for this species. Resolve the cross-species benefit from the source.');return;}
    const current=stat(state,e.name),ceiling=e.maximum??(e.name==='SOC'&&state.character.species==='zhodani'&&current<10?9:maxStat(state,e.name));
    if(e.dice)e.value=mechanicalDice(state,e.dice,rolls,e.name+' change')*(e.multiplier??1)+(e.add??0);
    let next=e.mode==='minimum'?Math.max(current,e.value):Math.max(e.minimum??0,current+e.value);
    if(e.name==='SOC'&&next>ceiling)state.character.benefits.push({name:'Ship Share',quantity:next-ceiling});
    setStat(state,e.name,Math.min(ceiling,Math.max(0,next)));
    if(state.character.species==='aezorgh'&&e.name==='SOC')state.character.stats.CHA=Math.floor(state.character.stats.SOC/2);
    if(state.character.species==='zhodani'&&e.name==='PSI'&&current<9&&state.character.stats.PSI>=9&&(state.character.stats.SOC??0)<10){state.character.stats.SOC=10;state.effectsQueue.unshift({kind:'unsupported',source:{id:'aliens',page:254},reason:'Resolve immediate Intendant status and psionic training after PSI reaches 9.'});}
    break;
   }
   case 'benefit':{
    const quantity=e.dice?mechanicalDice(state,e.dice,rolls,e.name+' quantity'):(e.value??1);
    if(e.name==='TAS Membership'&&state.character.benefits.some(x=>x.name===e.name))state.character.benefits.push({name:'Ship Share',quantity:2});
    else {state.character.benefits.push({name:e.name,quantity});if(BENEFIT_RULES[e.name]?.effects)state.effectsQueue.unshift(...copy(BENEFIT_RULES[e.name].effects));}break;
   }
   case 'cash':state.character.cash+=integer(e.dice?mechanicalDice(state,e.dice,rolls,'Cash result')*(e.multiplier??1):e.value,-100000000,100000000,'Cash award');break;
   case 'relationship':{
    const count=e.countFrom?Math.max(e.countFrom.minimum??0,characteristicDM(stat(state,e.countFrom.statDM))):e.dice?mechanicalDice(state,e.dice,rolls,e.type+' count'):(e.count??1);
    if(!e.onlyIfAbsent||!state.character.relationships.some(r=>r.role===e.type))for(let i=0;i<count;i++)state.character.relationships.push({role:e.type,name:'Unnamed '+e.type.toLowerCase()});
    break;
   }
   case 'check':{
    if(e.skillScope==='learned-this-term'){if(!learnedEducationSkills(state).length){nativeFallback(state,e,'No skill increased during this term; adjudicate the study challenge rather than assume a result.');return;}state.pendingChoice=e;state.stage='education-check';return;}
    let natural,total;
    if(e.stat){const r=rulesCheck(state,{stat:e.stat,target:e.target},rolls,e.stat+' check');natural=r.natural;total=r.total;}
    else {natural=dice(state,2,rolls,'Skill check');total=natural+Math.max(...e.skills.map(n=>skillLevel(state,n)));}
    const effects=copy(total>=e.target?e.success??[]:e.failure??[]);
    const naturalEffects=e.natural?.[natural]??e.onNatural?.[natural];
    state.effectsQueue.unshift(...copy(naturalEffects??effects),...copy(e.total?.[total]??[]));break;
   }
   case 'modifier':{
    const id=e.career==='any'||e.career==='next'?e.career:e.career?.includes('.')?e.career:state.active!==null?currentCareer(state).career.id:null;
    if(!id){nativeFallback(state,e,'Resolve the modifier target without an active career.');return;}
    state.modifiers??=[];state.modifiers.push({...e,careerId:id});break;
   }
   case 'benefit-rolls':{
    const {record}=currentCareer(state);
    if(e.mode==='retain-term')record.mishap=false;
    else if(e.mode==='lose-term')record.mishap=true;
    else if(e.mode==='retain-one')record.benefitRolls=Math.min(1,record.benefitRolls);
    else if(e.mode==='lose-all')record.benefitRolls=0;
    else record.benefitRolls=Math.max(0,record.benefitRolls+(e.dice?mechanicalDice(state,e.dice,rolls,'Benefit rolls')*(e.value??1):e.value??0));break;
   }
   case 'career-status':{
    if(state.active===null&&e.action==='next'){
     state.forcedCareer=e.career;state.forcedCareerDraft=!!e.viaDraft;
     if(e.viaDraft)state.draftUsed=true;
     if(e.career==='core.prisoner')state.character.sentenced=true;
     if(state.education!==undefined&&state.education!==null)educationRecord(state).graduationAllowed=false;
     break;
    }
    const {record}=currentCareer(state);
    if(e.assignment||e.retainRank||e.careerGroup||e.careerChoices){nativeFallback(state,e,'Resolve this specific career transfer from the source.');return;}
    if(e.action==='stay')record.forcedExit=false;
    else if(e.action==='exit')record.forcedExit=true;
    else if(e.action==='next'){record.forcedExit=true;state.forcedCareer=e.career;if(e.career==='core.prisoner')state.character.sentenced=true;}
    else if(e.action==='auto-qualify'){state.automaticCareers??=[];state.automaticCareers.push(e.career);}
    else {nativeFallback(state,e);return;}break;
   }
   case 'promotion':{const {record}=currentCareer(state);record.automaticPromotion=true;if(e.allowCommission)record.automaticCommission=true;break;}
   case 'table-roll':{
    if(state.active===null){
     const shared=EXPANSION_TABLES[e.table];
     if(shared){const result=mechanicalDice(state,e.dice??shared.dice,rolls,e.table);state.effectsQueue.unshift(...copy(shared.results[result]??[{kind:'unsupported',reason:'Shared table result not encoded.'}]));break;}
     nativeFallback(state,e,'Resolve '+e.table+' from the source, including any required career or education consequences.');return;
    }
    const {career,record}=currentCareer(state),pack=RULE_PACK[e.career??career.id];
    if(e.chooseAvailableTable||e.ignorePrerequisite||e.tableChoice||e.keepCareerThroughReeducation){nativeFallback(state,e,'Resolve this special table route from the source.');return;}
    const shared=EXPANSION_TABLES[e.table];
    if(shared){const result=mechanicalDice(state,e.dice??shared.dice,rolls,e.table);const row=shared.results[result];if(!row){nativeFallback(state,e,'Shared table result needs source resolution.');return;}state.effectsQueue.unshift(...copy(row));break;}
    const isMishap=['mishap','mishaps','core.mishap'].includes(e.table),isEvent=['event','events','core.events'].includes(e.table);
    if(pack&&(isMishap||isEvent)){
     if(isMishap&&!e.keepCareer&&career.id!=='core.prisoner')record.forcedExit=true;
     const result=mechanicalDice(state,e.dice??(isMishap?'1D':'2D'),rolls,e.table);
     state.effectsQueue.unshift(...copy((isMishap?pack.mishaps:pack.events)[result]??[{kind:'unsupported',reason:'Table result not encoded.'}]),...(e.keepCareer?[{kind:'keep-career',forcedExit:record.forcedExit??false}]:[]));
    }else{nativeFallback(state,e,'Resolve '+e.table+' from the source.');return;}break;
   }
   case 'random':{
    const total=mechanicalDice(state,e.dice,rolls,'Event random result');
    const outcome=e.outcomes.find(o=>total>=o.min&&total<=o.max);need(outcome,'No source outcome for the rolled result.');
    state.effectsQueue.unshift(...copy(outcome.effects));break;
   }
   case 'keep-career':currentCareer(state).record.forcedExit=e.forcedExit;break;
   case 'medical-cost':state.character.debt+=integer(e.value,0,10000000,'Medical cost');break;
   case 'qualification-ban':state.character.qualificationBanned=true;break;
   case 'death':state.character.deceased=true;state.stage='deceased';state.effectsQueue=[];state.effectNext='deceased';break;
   case 'rank':{const {record}=currentCareer(state);record.rank=Math.max(0,Math.min(6,record.rank+e.value));break;}
   case 'advancement-block':currentCareer(state).record.advancementBlock=e.terms;break;
   case 'benefit-block':currentCareer(state).record.benefitBlock=e.terms;break;
   case 'aslan-outcast':state.character.outcast=true;state.character.stats.SOC=e.SOC;if(e.forfeitClanShares)state.character.benefits=state.character.benefits.filter(b=>b.name!=='Clan Share');currentCareer(state).record.forcedExit=true;break;
   case 'conditional-future':state.character.futureConditions??=[];state.character.futureConditions.push(copy(e));break;
   case 'assignment-effect':{state.effectsQueue.unshift(...copy(e.assignments[currentCareer(state).record.assignment]??[]));break;}
   case 'independence':{if(state.character.gender!=='male'){nativeFallback(state,e,'Resolve the gender-specific Independence result.');return;}const result=dice(state,2,rolls,'Independence acquisition');if(result>stat(state,'SOC'))gainSkill(state,'Independence',e.value,e.mode);break;}
   case 'conditional':{
    const condition=e.condition;let passes=true;
    if(condition.gender)passes&&=state.character.gender===condition.gender;
    if(condition.stat)passes&&=(state.character.stats[condition.stat]??0)>=(condition.min??-Infinity)&&(state.character.stats[condition.stat]??0)<=(condition.max??Infinity);
    state.effectsQueue.unshift(...copy(passes?e.then??[]:e.otherwise??[]));break;
   }
   case 'parole':{
    const {record}=currentCareer(state);record.parole=e.mode==='reset'?mechanicalDice(state,e.dice??'1D+2',rolls,'Parole threshold'):Math.max(0,Math.min(12,(record.parole??0)+e.value));break;
   }
   case 'note':state.character.historyNotes??=[];state.character.historyNotes.push(e.text);break;
   default:nativeFallback(state,e);return;
  }
 }
 completeEffects(state,rolls);
}
function modifierTotal(state,target,consume=true,careerId) {
 const id=careerId??(state.active===null?null:currentCareer(state).career.id);
 const matches=(state.modifiers??[]).filter(m=>m.target===target&&(m.careerId==='any'||m.careerId===id||m.careerId==='next'&&target==='qualification'));
 if(consume)state.modifiers=(state.modifiers??[]).filter(m=>!matches.includes(m)||m.scope==='all');
 return matches.reduce((n,m)=>n+m.value,0);
}
function trainingOptions(state){
 const pack=nativePack(state);if(!pack)return [];
 const {record}=currentCareer(state);
 return ['personal','service','assignment','advanced','officer','psionic'].filter(key=>{
  const rows=key==='assignment'?pack.training.assignments[record.assignment]:pack.training[key];
  const req=pack.prerequisites?.[key];
  return rows&&(!req?.stat||stat(state,req.stat)>=req.min)&&(!req?.commissioned||record.officer);
 }).map(id=>({id,name:{personal:'Personal development',service:'Service skills',assignment:'Assignment skills',advanced:'Advanced education',officer:'Officer skills',psionic:'Psionic skills'}[id]}));
}

function apply(state,command,rolls) {
 need(plain(command)&&typeof command.type==='string','A command type is required.');
 const payload=command.payload??{};need(plain(payload),'Invalid command payload.');
 switch(command.type) {
 case 'setup': {
  need(state.stage==='identity','Identity has already been accepted.');
  const species=findSpecies(payload.species);need(species,'Unknown species.');
  state.character.name=text(payload.name??'',80);state.character.species=species.id;
  state.character.gender=text(payload.gender??'',20);state.character.culture=payload.culture==='imperial'?'imperial':'native';
  state.character.homeworld=text(payload.homeworld??'',160);state.character.age=species.startAge;state.character.traits=copy(SPECIES_RULES[species.id]?.traits??[]);
  state.stage='statistics';return 'Started '+(state.character.name||'an unnamed Traveller')+' ('+species.name+').';
 }
 case 'configure': {
  need(state.stage==='identity'||state.stage==='statistics'&&!state.pool.length,'Options must be set before rolling.');
  if(payload.boons!==undefined)state.config.boons=integer(payload.boons,0,6,'Boon rolls');
  if(payload.minimumReroll!==undefined){need(typeof payload.minimumReroll==='boolean','Invalid reroll option.');state.config.minimumReroll=payload.minimumReroll;}
  if(payload.allocation!==undefined){need(typeof payload.allocation==='boolean','Invalid allocation option.');state.config.allocation=payload.allocation;}
  if(payload.extras!==undefined){need(Array.isArray(payload.extras)&&payload.extras.length<=6&&new Set(payload.extras).size===payload.extras.length,'Invalid extra characteristics.');need(payload.extras.every(x=>EXTRA_STATS.some(e=>e.id===x)),'Unsupported extra characteristic.');state.config.extras=[...payload.extras];}
  if(payload.zhodaniPsi!==undefined){need(typeof payload.zhodaniPsi==='boolean','Invalid Zhodani PSI option.');state.config.zhodaniPsi=payload.zhodaniPsi;}
  return 'Generation options: '+state.config.boons+' boon rolls; player placement '+(state.config.allocation?'on':'off')+'; below-43 reroll '+(state.config.minimumReroll?'on':'off')+'; extras '+(state.config.extras.join(', ')||'none')+'; Zhodani PSI option '+(state.config.zhodaniPsi?'on':'off')+'.';
 }
 case 'gm-mode': {
  need(typeof payload.enabled==='boolean','GM mode must be true or false.');
  const old=state.config.gm;state.config.gm=payload.enabled;return 'GM mode '+old+' → '+payload.enabled+'.';
 }
 case 'roll-statistics': {
  need(state.stage==='statistics','Statistics cannot be rolled at this stage.');

  if(state.pool.length)need(state.config.gm||(state.config.minimumReroll&&state.rollTotal<43),'Reroll is available only below a six-score base total of 43, or in GM mode.');
  const species=findSpecies(state.character.species);
  if(state.config.zhodaniPsi){need(state.config.gm&&species.id==='zhodani','The Zhodani PSI option requires GM mode and a Zhodani Traveller.');state.optionalPsi=[9,9,10,10,11,12][dice(state,1,rolls,'Zhodani optional PSI')-1];}
  const basic=Object.entries(species.dice).slice(0,6).map(([key,dice])=>species.id==='vargr'&&state.character.culture==='imperial'&&key==='CHA'?['SOC',[2,0]]:[key,dice]);
  const before=state.pool.length?state.pool.map(p=>p.base):null;
  state.pool=basic.map(([key,[count,adjustment]],i)=>({key,count,adjustment,origin:key,base:dice(state,count,rolls,key,i<state.config.boons),boon:i<state.config.boons}));
  state.rollTotal=state.pool.reduce((sum,p)=>sum+p.base,0);
  return (before?'Rerolled statistics; previous '+before.join(', ')+'. ':'Rolled statistics. ')+'Base total '+state.rollTotal+'. Species modifiers excluded; extra characteristics excluded.';
 }
 case 'swap-statistics': {
  need(state.stage==='statistics'&&state.pool.length===6,'Roll statistics first.');
  need(state.config.allocation||state.config.gm,'Player assignment is not enabled.');
  const a=integer(payload.a,0,5,'First score'),b=integer(payload.b,0,5,'Second score');need(a!==b,'Choose two different characteristics.');
  need(state.pool[a].count===state.pool[b].count||state.config.gm,'Published dice formulas differ. A GM override is required for this swap.');
  const old=[state.pool[a].base,state.pool[b].base];[state.pool[a].base,state.pool[b].base]=[state.pool[b].base,state.pool[a].base];
  [state.pool[a].boon,state.pool[b].boon]=[state.pool[b].boon,state.pool[a].boon];[state.pool[a].origin,state.pool[b].origin]=[state.pool[b].origin,state.pool[a].origin];
  return 'Swapped '+state.pool[a].key+' '+old[0]+' → '+old[1]+' and '+state.pool[b].key+' '+old[1]+' → '+old[0]+(state.pool[a].count!==state.pool[b].count?' (GM exception).':'.');
 }
 case 'accept-statistics': {
  need(state.stage==='statistics'&&state.pool.length===6,'Roll statistics first.');
  const species=findSpecies(state.character.species);
  for(const p of state.pool)state.character.stats[p.key]=Math.max(1,p.base+p.adjustment);
  for(const [key,[count,adjustment]] of Object.entries(species.dice).slice(6))state.character.stats[key]=key==='PSI'&&state.config.zhodaniPsi?state.optionalPsi:dice(state,count,rolls,key)+adjustment;
  for(const id of state.config.extras) {
   if(Object.hasOwn(state.character.stats,id))continue;
   const extra=EXTRA_STATS.find(e=>e.id===id);
   state.character.stats[id]=extra.derive?(state.character.stats[extra.derive]??0):dice(state,extra.dice,rolls,id);
  }
  if(species.id==='vargr'){
   if(state.character.culture==='imperial'){state.character.stats.CHA=dice(state,1,rolls,'Imperial Vargr CHA')+2;}
   gainSkill(state,'Melee',0,'set');
  }
  if(species.id==='aezorgh'){state.character.stats.CHA=Math.floor(state.character.stats.SOC/2);}
  if(species.id==='zhodani'){
   if((state.config.zhodaniPsi||state.character.stats.PSI>=9)&&state.character.stats.SOC<10)state.character.stats.SOC=10;
   state.character.stats.EDU=Math.min(state.character.stats.EDU,state.character.stats.SOC);
   if(state.character.stats.SOC>=10)state.character.stats.EDU=Math.max(8,state.character.stats.EDU);
  }
  for(const skill of species.background??[])gainSkill(state,skill,0,'set');
  state.backgroundRemaining=species.id==='zhodani'&&state.character.stats.SOC>=10?0:species.extraBackground??Math.max(0,3+characteristicDM(state.character.stats.EDU));
  if(state.config.extras.includes('WLT'))state.character.stats.WLT=state.character.stats.SOC??0;
  state.stage='background';
  if(species.setup)sourceStep(state,'species-setup',species.source,species.setupPage,species.setup,'background');
  return 'Accepted statistics and generated selected extra characteristics.';
 }
 case 'background': {
  need(state.stage==='background','Not choosing background skills.');
  need(Array.isArray(payload.skills)&&payload.skills.length===state.backgroundRemaining&&new Set(payload.skills).size===payload.skills.length,'Choose exactly '+state.backgroundRemaining+' distinct background skills.');
  need(payload.skills.every(s=>backgroundOptions(state).includes(s)&&!Object.hasOwn(state.character.skills,s)),'Choose new skills from the background list.');
  payload.skills.forEach(s=>gainSkill(state,s,0,'set'));state.backgroundRemaining=0;state.stage='precareer';
  return 'Background skills: '+payload.skills.join(', ')+'.';
 }
 case 'skip-precareer':need(state.stage==='precareer','Not choosing pre-career education.');state.stage='career';return 'Skipped pre-career education.';
 case 'open-precareer':{
  need(state.stage==='career'&&state.active===null&&!state.forcedCareer,'Education is only available before choosing a career.');
  need(state.character.terms<3&&!state.educationAttemptTerms?.includes(state.character.terms),'Education has already been attempted this term or its time limit has passed.');
  state.stage='precareer';return 'Reviewing pre-career education for term '+(state.character.terms+1)+'.';
 }
 case 'precareer': {
  need(state.stage==='precareer','Not choosing pre-career education.');
  const pre=PRECAREERS.find(p=>p.id===payload.id);need(pre,'Unknown pre-career.');
  need(!pre.maxTerm||state.character.terms<pre.maxTerm,'This pre-career is no longer available.');
  state.educationAttemptTerms??=[];need(!state.educationAttemptTerms.includes(state.character.terms),'Only one education entry attempt is allowed per term.');
  state.educationAttemptTerms.push(state.character.terms);
  if(!EDUCATION_PACK[pre.id]||findSpecies(state.character.species).precareerDM||!Object.hasOwn(state.character.stats,'SOC')){
   sourceStep(state,'precareer',pre.source,pre.page,pre.name+': resolve entry, education event, graduation and species-specific benefits.','career');
   state.pending.id=pre.id;return 'Selected '+pre.name+' for source-assisted resolution.';
  }
  const roll=dice(state,2,rolls,'Education entry');
  const outcome=educationEntryCheck({id:pre.id,term:state.character.terms+1,stats:state.character.stats,roll});
  if(!outcome.success){state.stage='career';return 'Education entry failed: '+JSON.stringify(outcome)+'. The current term remains available for a career.';}
  state.character.educations??=[];state.education=state.character.educations.length;
  state.character.educations.push({id:pre.id,term:state.character.terms+1,careersBefore:state.character.careers.length,careerAttempts:0,selections:{},skillsBefore:copy(state.character.skills),graduationAllowed:true,entry:outcome});
  queueEffects(state,outcome.effects,'education-event',rolls);return 'Entered '+pre.name+': roll '+roll+', modified total '+outcome.total+' against '+outcome.target+'.';
 }
 case 'education-event':{
  need(state.stage==='education-event','No education event is due.');
  const total=dice(state,2,rolls,'Pre-career event');educationRecord(state).event=total;
  queueEffects(state,PRECAREER_EVENTS[total],'education-graduation',rolls);return 'Pre-career event '+total+'.';
 }
 case 'education-graduation':{
  need(state.stage==='education-graduation','No graduation check is due.');
  const record=educationRecord(state),roll=dice(state,2,rolls,'Graduation');
  const outcome=educationGraduationCheck({id:record.id,stats:state.character.stats,roll,graduationAllowed:record.graduationAllowed});
  record.graduation=outcome;queueEffects(state,outcome.effects,'education-finish',rolls);
  return 'Graduation total '+outcome.total+' against '+outcome.target+': '+(outcome.honours?'honours':outcome.graduated?'graduated':'did not graduate')+'.';
 }
 case 'education-skill':{
  need(state.stage==='education-skill'&&state.pendingChoice,'No education skill choice is due.');
  const e=state.pendingChoice,name=text(payload.name,80),base=name.split(' (')[0];
  need(educationSkillValid(state,name,e),'Choose a listed education skill and an allowed specialisation.');
  if(SPECIALIZED.includes(base)&&e.selectionId!=='hobby')need(name.includes(' ('),'Choose the specialisation to retain for graduation.');
  const record=educationRecord(state);
  if(e.selectionId.startsWith('university-'))need(!Object.entries(record.selections).some(([id,n])=>id.startsWith('university-')&&n.split(' (')[0]===base),'Overlapping university choices require source adjudication. Choose different skill bases in the native flow.');
  record.selections[e.selectionId]=name;gainSkill(state,e.value===0?base:name,e.value,e.mode);
  state.pendingChoice=null;drainEffects(state,rolls);return 'Education skill '+name+' at level '+e.value+' recorded.';
 }
 case 'education-service':{
  need(state.stage==='education-service'&&state.pendingChoice,'No academy service award is due.');
  const e=state.pendingChoice,name=text(payload.name,80);need(e.options.includes(name)&&!e.picked.includes(name),'Choose a different service skill.');
  e.picked.push(name);state.pendingChoice=null;
  const rest=e.picked.length<e.count?[e]:[];state.effectsQueue.unshift({kind:'skill',name,mode:'set',value:1},...rest);
  drainEffects(state,rolls);return 'Academy service award selected: '+name+'.';
 }
 case 'education-check':{
  need(state.stage==='education-check'&&state.pendingChoice,'No education skill check is due.');
  const e=state.pendingChoice,name=text(payload.name,80);need(learnedEducationSkills(state).includes(name),'Choose a skill learned or improved during this education term.');
  const roll=dice(state,2,rolls,'Education skill check: '+name),total=roll+skillLevel(state,name);educationRecord(state).checkedSkill=name;
  state.pendingChoice=null;state.effectsQueue.unshift(...copy(total>=e.target?e.success:e.failure));drainEffects(state,rolls);
  return 'Education '+name+' check '+total+' against '+e.target+'.';
 }
 case 'preterm-commission':{
  need(state.stage==='preterm-commission','No education commission opportunity is pending.');
  const {record,career}=currentCareer(state),right=record.educationCommission;need(right?.allowed,'No education commission entitlement.');
  let check=null;
  if(payload.attempt===true){
   check=right.automatic?{automatic:true,success:true}:rulesCheck(state,{stat:'SOC',target:career.commission},rolls,'Education commission',right.modifier);
   record.pretermCommission=check;if(check.success){record.rank=1;record.highestRank=1;record.officer=true;}
  }
  finishCareerEntry(state,rolls);return check?'Pre-term education commission: '+JSON.stringify(check)+'.':'Declined the pre-term education commission opportunity.';
 }
 case 'career': {
  need(state.stage==='career'&&!state.failedQualification,'Choose a career at the start of a term.');
  const career=availableCareers(state).find(c=>c.id===payload.id);need(career&&!career.disabled,career?.reason??'This career is not available.');
  const assignment=career.assignments.find(a=>a.id===payload.assignment);need(assignment,'Choose an assignment.');
  const prerequisites=RULE_PACK[career.id]?.prerequisites??{};need(conditionMatches(state,prerequisites.assignments?.[assignment.id]),'This assignment has additional source prerequisites.');
  if(career.eligibility?.[assignment.id])need(state.character.gender===career.eligibility[assignment.id],'This assignment has a gender restriction.');
  if(career.id==='aslan.military'&&assignment.id==='support'&&state.character.gender==='male')need(stat(state,'SOC')<=8,'Male support assignment requires SOC 8 or less.');
  if(career.id==='zhodani.guard'&&assignment.id==='commando')need((state.character.stats.PSI??0)>=9,'Commando assignment requires PSI 9 or greater.');
  const educational=educationRights(state,career.id,assignment.id);
  if(educational.unresolved.length){sourceStep(state,'education-entry-rights','core',17,educational.unresolved[0].reason,'career');state.pending.career=career.id;return 'Education entry rights require source adjudication before qualification.';}
  let modifier=(career.group==='core'?-state.character.careers.length:0)+educational.qualificationModifier+modifierTotal(state,'qualification',true,career.id);

  if(career.agePenalty&&state.character.age>=career.agePenalty[0]&&!(prerequisites.qualificationModifiers??[]).some(m=>m.condition?.ageMin===career.agePenalty[0]&&m.dm===career.agePenalty[1]))modifier+=career.agePenalty[1];
  for(const m of prerequisites.qualificationModifiers??[])if(conditionMatches(state,m.condition))modifier+=m.dm;
  const qualification=prerequisites.qualificationByGender?.[state.character.gender]??career.qualification;
  const forced=state.forcedCareer===career.id;if(forced)state.pendingDraft=!!state.forcedCareerDraft;
  const check=qualification&&!forced&&!educational.automaticEntry&&!state.automaticCareers?.includes(career.id)?rulesCheck(state,qualification,rolls,'Qualification',modifier):null;
  for(const r of state.character.educations??[])if(r.completed)r.careerAttempts=(r.careerAttempts??0)+1;
  if(check&&!check.success){
   state.failedQualification=true;
   if(state.character.species==='aslan'&&state.character.culture==='native'){state.character.stats.SOC=2;state.character.outcast=true;}
   state.stage='failed-entry';return 'Failed '+career.name+' qualification: '+JSON.stringify(check)+'.';
  }
  enterCareer(state,career,assignment.id,rolls);return 'Entered '+career.name+' / '+assignment.name+(check?': '+JSON.stringify(check):' automatically')+'.';
 }
 case 'fallback': {
  need(state.stage==='failed-entry','No failed qualification to resolve.');
  const species=state.character.species;
  if(species==='zhodani'){sourceStep(state,'draft','aliens',255,'Resolve the Zhodani draft; select the resulting career with GM correction.','career');state.failedQualification=false;return 'Zhodani draft requires source resolution.';}
  let id=species==='aslan'&&state.character.culture==='native'?'aslan.outcast':species==='vargr'&&state.character.culture==='native'?'vargr.loner':'core.drifter';
  let assignment;
  if(payload.draft){
   need(!state.draftUsed,'The ordinary draft has already been used.');need(!['aslan','vargr'].includes(species)||state.character.culture==='imperial','Use the culture-specific fallback.');
   id=['core.navy','core.army','core.marine','core.merchant','core.scout','core.agent'][dice(state,1,rolls,'Draft')-1];state.draftUsed=true;state.pendingDraft=true;
   assignment=id==='core.merchant'?'marine':id==='core.agent'?'law':findCareer(id).assignments[0].id;
  }
  const career=findCareer(id);enterCareer(state,career,assignment??career.assignments[0].id,rolls);return 'Fallback entered '+career.name+'.';
 }
 case 'choose-effect': {
  need(state.stage==='effect-choice'&&state.pendingChoice,'There is no effect choice.');
  const option=state.pendingChoice.options[integer(payload.index,0,state.pendingChoice.options.length-1,'Choice')];state.pendingChoice=null;state.effectsQueue.unshift(...copy(option.effects));drainEffects(state,rolls);return 'Chose '+option.label+'.';
 }
 case 'choose-skill': {
  need(state.stage==='skill-choice'&&state.pendingChoice,'There is no skill choice.');const e=state.pendingChoice,name=normalizeSkillName(text(payload.name,80),{requireSpeciality:e.mode!=='set'||(e.value??1)>0}).name;need(skillNameAllowed(state,name,e),'Skill is not available for this award.');
  if((e.mode!=='set'||(e.value??1)>0)&&SPECIALIZED.includes(name.split(' (')[0]))need(name.includes(' ('),'Choose a specialisation, for example Science (physics).');
  if(e.kind==='skill-reduction-choice'){need(Object.hasOwn(state.character.skills,name)&&state.character.skills[name]>0,'Choose a trained skill to reduce.');if(e.names)need(e.names.includes(name),'Choose one of the indicated skills.');state.character.skills[name]=Math.max(0,state.character.skills[name]-e.value);}else gainSkill(state,name,e.value??1,e.mode);state.pendingChoice=null;if((e.count??1)>1)state.effectsQueue.unshift({...e,count:e.count-1});drainEffects(state,rolls);return 'Selected '+name+' for a skill award.';
 }
 case 'training': {
  need(state.stage==='training','No training roll is pending.');need(trainingOptions(state).some(x=>x.id===payload.table),'Training table is not available.');const pack=nativePack(state),{record,career}=currentCareer(state);const rows=payload.table==='assignment'?pack.training.assignments[record.assignment]:pack.training[payload.table];
  const tableModifier=payload.table==='assignment'?(pack.prerequisites.assignmentTableModifiers??[]).filter(m=>conditionMatches(state,m.condition)).reduce((n,m)=>n+m.dm,0):0;
  if(rows.length!==6&&rows.length!==9){sourceStep(state,'term-training',career.source,career.page,'Resolve the special training table.','survival');return 'Training table requires source resolution.';}
  const result=dice(state,1,rolls,'Training: '+payload.table)+tableModifier;queueEffects(state,rows[result-1],state.trainingNext??'survival',rolls);state.trainingNext=null;return 'Training '+payload.table+' result '+result+'.';
 }
 case 'survival': {
  need(state.stage==='survival','Not at the survival check.');
  const {record,career,assignment}=currentCareer(state);
  const check=rulesCheck(state,assignment.survival,rolls,'Survival',modifierTotal(state,'survival'));check.success&&=check.natural!==2;
  const pack=nativePack(state);
  if(!check.success){record.mishap=true;record.forcedExit=career.id!=='core.prisoner';const result=dice(state,1,rolls,'Mishap table');if(pack?.mishaps[result])queueEffects(state,pack.mishaps[result],'end-term',rolls);else sourceStep(state,'mishap',career.source,career.page+1,'Resolve mishap result '+result+'.','term-end');}
  else {const result=dice(state,2,rolls,'Event table');if(pack?.events[result])queueEffects(state,pack.events[result],'after-event',rolls);else sourceStep(state,'career-event',career.source,career.page+1,'Resolve career event result '+result+'.','advancement');}
  return 'Survival: '+JSON.stringify(check)+'.';
 }
 case 'advancement': {
  need(state.stage==='advancement','Not at advancement.');
  const {record,career,assignment}=currentCareer(state);
  if(!assignment.advancement){closeTerm(state);return 'This career has no conventional advancement roll.';}
  const zhodaniAuto=career.group==='zhodani'&&(state.character.stats.SOC??0)>=10&&record.terms+1===(record.drafted?2:1);
  const check=record.automaticPromotion||zhodaniAuto?{natural:0,total:99,target:assignment.advancement.target,success:true,automatic:true}:rulesCheck(state,assignment.advancement,rolls,'Advancement',modifierTotal(state,'advancement')+(career.group==='zhodani'&&(state.character.stats.SOC??0)>=11?1:0));record.automaticPromotion=false;
  if(career.id==='core.prisoner'){record.released=check.total>record.parole;record.forcedExit=record.released;}else if(check.total<=record.terms+1)record.forcedExit=true;
  if(check.natural===12&&career.id!=='core.prisoner'){record.forcedStay=true;record.forcedExit=false;}
  if(check.success){
   const previousRank=record.rank;const cap=career.id==='zhodani.government'&&stat(state,'SOC')<11?3:6;record.rank=Math.min(cap,record.rank+1);record.highestRank=Math.max(record.highestRank??0,record.rank);
   if(nativePack(state)){state.trainingNext='end-term';queueEffects(state,record.rank>previousRank?rankEffects(state):[],'training',rolls);}else sourceStep(state,'advancement-training',career.source,career.page,'Resolve rank bonuses and the additional training roll.','term-end');
  }else closeTerm(state);
  return 'Advancement: '+JSON.stringify(check)+'. Rank '+record.rank+'.';
 }
 case 'continue-career': {
  need(state.stage==='term-end','Not at the end of a term.');
  const {record,career}=currentCareer(state);need(!record.forcedExit,'This career must be left.');
  record.forcedStay=false;if(nativePack(state))state.stage='training';else sourceStep(state,'term-training',career.source,career.page,'Resolve this term training roll.','survival');return 'Continued '+career.name+'.';
 }
 case 'commission': {
  need(state.stage==='advancement','Commission must be attempted during advancement.');const {record,career}=currentCareer(state);
  need(career.commission!==undefined&&!record.officer&&!record.commissionTried,'Commission is not available.');
  need(!(record.commissionBlockedFirstTerm&&record.terms===0),'Failed academy graduation prohibits a commission in this first term.');
  need(record.terms===0||(state.character.stats.SOC??0)>=9,'Later commission attempts require SOC 9 or greater.');record.commissionTried=true;
  const bonus=modifierTotal(state,'advancement',false)-record.terms;
  if(career.group==='zhodani')need((state.character.stats.SOC??0)>=10&&!(record.drafted&&record.terms===0),'This Zhodani Traveller cannot receive a commission this term.');
  const check=record.automaticCommission||career.group==='zhodani'?{automatic:true,success:true,total:99}:rulesCheck(state,{stat:'SOC',target:career.commission},rolls,'Commission',bonus);
  if(check.success){modifierTotal(state,'advancement');record.highestRank=Math.max(record.highestRank??record.rank,record.rank,1);record.rank=1;record.officer=true;record.automaticCommission=false;queueEffects(state,rankEffects(state),'end-term',rolls);}
  return 'Commission: '+JSON.stringify(check)+(check.success?'. Became rank 1 officer; no advancement roll this term.':'. Advancement remains available.');
 }
 case 'leave-career': {
  need(state.stage==='term-end','Not at the end of a term.');
  const {record,career}=currentCareer(state);need(!record.forcedStay,'A natural 12 requires another term.');need(career.id!=='core.prisoner'||record.released,'Prisoners must pass the parole threshold or escape before leaving.');
  if(career.group==='aslan'&&!['aslan.outcast','aslan.outlaw'].includes(career.id)&&!record.forcedExit)need(record.terms>=3||payload.retire,'Aslan normally serve three terms before changing careers. You may retire.');
  const highest=record.highestRank??record.rank;const bonus=highest>=5?3:highest>=3?2:highest>=1?1:0;
  record.benefitRolls+=bonus;
  record.benefitDM=highest>=5?1:0;
  const pension=pensionForCareer({careerId:career.id,terms:record.terms});if(!pension.needsAdjudication)record.pension=pension.annualCredits;
  state.stage=record.benefitRolls?'benefits':'career';if(!record.benefitRolls)state.active=null;
  return 'Left '+career.name+' with '+record.benefitRolls+' benefit rolls.';
 }
 case 'benefit': {
  need(state.stage==='benefits','No benefits to roll.');
  const {record,career}=currentCareer(state);need(record.benefitRolls>0,'No benefit rolls remain.');
  const cash=payload.cash===true;need(!cash||state.cashRolls<cashLimit(state),'The species cash-roll limit has been reached.');
  const speciesModifiers=(nativePack(state)?.prerequisites.benefitModifiers??[]).filter(m=>conditionMatches(state,m.condition)&&(!m.table||m.table===(cash?'cash':'material'))).reduce((n,m)=>n+m.dm,0);
  const modifier=(record.benefitDM??0)+(cash&&Object.hasOwn(state.character.skills,'Gambler')?1:0)+modifierTotal(state,'benefit')+speciesModifiers;
  const result=dice(state,1,rolls,cash?'Cash benefit':'Material benefit')+modifier;
  if(cash){state.cashRolls++;if(Object.hasOwn(state.character.stats,'WLT'))state.character.stats.WLT=Math.min(15,state.character.stats.WLT+1);}
  const pack=nativePack(state),index=result-1;
  if(index>=7||index<0){sourceStep(state,'benefit',career.source,career.page,'Benefit result '+result+' is outside the printed table. Referee adjudication required.','benefits');return 'Benefit roll exceeds printed table; no result was assumed.';}
  if(pack){queueEffects(state,cash?[{kind:'cash',value:pack.benefits.cash[index]*(state.character.species==='aslan'&&state.character.culture==='native'&&state.character.gender==='male'?0.5:1)}]:pack.benefits.material[index],'benefit-complete',rolls);}else sourceStep(state,'benefit',career.source,career.page,'Resolve '+(cash?'cash':'material')+' benefit result '+result+'.','benefits');
  return 'Rolled '+(cash?'cash':'material')+' benefit '+result+' (DM '+modifier+').';
 }
 case 'resolve-book': {
  need(state.stage==='book-step'&&state.pending,'No source step to resolve.');
  need(payload.confirmed===true,'Confirm you checked the indicated source.');
  const pending=copy(state.pending);applyEffects(state,payload.effects??[]);
  if(pending.kind==='education-entry-rights'){need(typeof payload.educationAutomaticEntry==='boolean','Record the referee decision on automatic entry.');state.educationEntryRulings??={};state.educationEntryRulings[pending.career]=payload.educationAutomaticEntry;}
  if(state.education!==undefined&&state.education!==null&&pending.kind==='native-effect'){
   if(payload.educationNoGraduation===true)educationRecord(state).graduationAllowed=false;

   if(payload.educationNextCareer){need(CAREERS.some(c=>c.id===payload.educationNextCareer),'Unknown required career.');state.forcedCareer=payload.educationNextCareer;if(state.forcedCareer==='core.prisoner')state.character.sentenced=true;}
  }
  if(pending.kind==='species-setup'){
   if(state.character.species==='aslan'){
    const result=dice(state,2,rolls,'Rite of Passage');state.character.stats.RITE=Object.values(state.character.stats).slice(0,6).filter(n=>n>result).length;
    state.character.birthOrder=text(payload.birthOrder??'',30);
   }
  }
  state.pending=null;advanceAfterBook(state,pending,payload,rolls);
  return 'Source-assisted '+pending.kind+' confirmed. '+text(payload.note??'',500)+' Effects: '+JSON.stringify(payload.effects??[])+'.';
 }
 case 'connection': {
  need(['career','term-end','finish'].includes(state.stage),'Add connections between terms or at completion.');
  need(state.connections.length<2,'At most two connections award skills.');
  const person=text(payload.person,80);need(person&&!state.connections.some(c=>c.person.toLowerCase()===person.toLowerCase()),'Use a different Traveller for each connection.');
  const skill=text(payload.skill,80);need(skill!=='Jack-of-all-Trades','Connections cannot award Jack-of-all-Trades.');
  need((state.character.skills[skill]??0)<3,'A connection cannot increase a skill above level 3.');
  gainSkill(state,skill,1);state.connections.push({person,skill,note:text(payload.note??'',300)});return 'Connection with '+person+': '+skill+' gained.';
 }
 case 'add-extra': {
  need(state.stage!=='identity'&&state.stage!=='statistics','Accept the six characteristics first.');
  const extra=EXTRA_STATS.find(e=>e.id===payload.id);need(extra,'Choose an available characteristic.');need(!Object.hasOwn(state.character.stats,extra.id),'This characteristic already exists.');
  const value=extra.derive?(state.character.stats[extra.derive]??0):dice(state,extra.dice,rolls,extra.id);
  state.character.stats[extra.id]=extra.id==='PSI'?Math.max(0,value-state.character.terms):value;
  state.config.extras.push(extra.id);return 'Added '+extra.name+' '+state.character.stats[extra.id]+'. '+extra.source+(extra.id==='PSI'?'; testing reduced by completed terms. Potential does not grant training or talents.':'.');
 }
 case 'ageing':{
  need(state.stage==='ageing','No ageing roll is due.');const species=findSpecies(state.character.species),roll=dice(state,2,rolls,'Ageing');
  const termPenalty=state.character.terms*(species.agingTermMultiplier??1);const bonus=species.agingDMUntil&&state.character.age<species.agingDMUntil[0]?species.agingDMUntil[1]:0;
  const result=ageingOutcome({roll,terms:Math.max(0,termPenalty-bonus)});
  if(result.needsAdjudication)sourceStep(state,'ageing','core',49,result.reason+' Apply species modifiers from '+species.source+' p. '+species.page+'.','term-end');else queueEffects(state,result.effects,'ageing-crisis',rolls);
  return 'Ageing roll '+roll+', term DM -'+termPenalty+', species DM +'+bonus+'.';
 }
 case 'notes': {
  const old=state.character.notes;state.character.notes=text(payload.text,10000);return 'Background notes changed ('+old.length+' → '+state.character.notes.length+' characters).';
 }
 case 'gm-override': {
  need(state.config.gm,'Enable GM mode before changing results.');const reason=text(payload.reason??'',300);need(reason,'A reason is required for an override.');
  const field=text(payload.field,40);let old;
  if(field.startsWith('stat.')){const key=field.slice(5);need(/^[A-Z][A-Z0-9]{1,7}$/.test(key),'Invalid characteristic code.');old=state.character.stats[key];setStat(state,key,integer(payload.value,0,40,'Characteristic'));}
  else if(field==='age'){old=state.character.age;state.character.age=integer(payload.value,0,500,'Age');}
  else if(field==='cash'||field==='debt'){old=state.character[field];state.character[field]=integer(payload.value,0,100000000,'Amount');}
  else if(field==='pool'){
   need(state.stage==='statistics'&&state.pool.length===6,'Roll statistics first.');const index=integer(payload.index,0,5,'Pool index');old=state.pool[index].base;state.pool[index].base=integer(payload.value,1,18,'Base score');state.rollTotal=state.pool.reduce((n,p)=>n+p.base,0);
  }else throw new Error('That field cannot be overridden.');
  return 'GM override '+field+(field==='pool'?'['+payload.index+']':'')+': '+String(old??'absent')+' → '+payload.value+'. Reason: '+reason;
 }
 case 'finish':need(!state.forcedCareer,'Resolve the required next career before finishing.');need(state.stage==='career'&&state.active===null,'Finish between careers after resolving benefits.');state.stage='finish';return 'Finished source-assisted character. Unautomated stages remain listed in the record.';
 default:throw new Error('Unknown command: '+command.type);
 }
}
export function createSession(seed='traveller-'+Date.now()) {
 need(typeof seed==='string'&&seed.length>0&&seed.length<=120,'Invalid random seed.');
 return {format:'traveller-character-session',version:API_VERSION,seed,events:[]};
}
export function project(session) {
 need(plain(session)&&session.format==='traveller-character-session'&&session.version===API_VERSION,'Unsupported save format.');
 need(typeof session.seed==='string'&&session.seed.length>0&&session.seed.length<=120,'Invalid random seed.');
 need(Array.isArray(session.events)&&session.events.length<=LIMIT,'Save contains too many actions.');
 need(saveSize(session)<=MAX_SAVE_BYTES,'Save size limit reached. Export your current character before continuing.');
 let state=initial(session.seed);const snapshots=[copy(state)],log=[];
 for(let i=0;i<session.events.length;i++){
  const event=session.events[i];need(plain(event)&&typeof event.id==='string'&&event.id.length<=120,'Invalid action record.');
  need(!log.some(e=>e.id===event.id),'Duplicate action ID.');
  const rolls=[];let summary;
  if(event.command?.type==='gm-replay'){
   need(state.config.gm,'Enable GM mode before replacing a roll.');
   const payload=event.command.payload??{},target=integer(payload.revision,1,i,'Original action'),rollIndex=integer(payload.rollIndex,0,50,'Roll index');
   const original=session.events[target-1];need(!['gm-replay','restore'].includes(original.command.type),'Choose an original generation roll.');
   const originalRoll=log[target-1].rolls[rollIndex];need(originalRoll,'The selected action has no such roll.');
   const reason=text(payload.reason??'',300);need(reason,'A reason is required for replacing a roll.');
   const rng=state.rng,gm=state.config.gm;state=copy(snapshots[target-1]);state.rng=rng;state.config.gm=gm;state._override={index:rollIndex,values:payload.values};
   const outcome=apply(state,original.command,rolls);need(rolls[rollIndex],'Original roll is not present in the replayed action.');delete state._override;
   summary='GM replaced action '+target+' roll '+(rollIndex+1)+' ['+originalRoll.values.join(', ')+'] → ['+payload.values.join(', ')+']. Reason: '+reason+'. Subsequent character changes were superseded; all actions remain in the log. '+outcome;
  }else if(event.command?.type==='restore'){
   const target=integer(event.command.payload?.revision,0,i-1,'Restore point');
   const rng=state.rng,gm=state.config.gm;state=copy(snapshots[target]);state.rng=rng;state.config.gm=gm;
   summary='Restored character state to action '+target+'. Prior rolls and actions remain in this log; randomness was not rewound.';
  }else summary=apply(state,event.command,rolls);
  if(event.rolls!==undefined)need(JSON.stringify(event.rolls)===JSON.stringify(rolls),'Roll audit mismatch at action '+(i+1)+'.');
  if(event.summary!==undefined)need(event.summary===summary,'Action summary mismatch at action '+(i+1)+'.');
  log.push({number:i+1,id:event.id,type:event.command.type,summary,rolls});snapshots.push(copy(state));
 }
 state.trainingOptions=state.stage==='training'?trainingOptions(state):[];
 state.educationOptions=state.stage==='education-skill'?educationOptions(state,state.pendingChoice):[];
 state.educationCheckSkills=state.stage==='education-check'?learnedEducationSkills(state):[];
 state.canChooseEducation=state.stage==='career'&&state.active===null&&!state.forcedCareer&&state.character.terms<3&&!state.educationAttemptTerms?.includes(state.character.terms);
 if(state.character.species==='aezorgh'&&Object.hasOwn(state.character.stats,'SOC'))state.character.stats.CHA=Math.floor(state.character.stats.SOC/2);
 state.backgroundOptions=backgroundOptions(state);state.cashLimit=cashLimit(state);
 state.careerChoices=availableCareers(state);state.statDMs=Object.fromEntries(Object.entries(state.character.stats).map(([k,v])=>[k,characteristicDM(v)]));
 return {state,log,revision:session.events.length};
}
export function execute(session,command,{id,expectedRevision}={}) {
 const before=project(session);
 const actionId=id??'action-'+(before.revision+1);need(typeof actionId==='string'&&actionId.length<=120,'Invalid action ID.');
 const existing=session.events.find(e=>e.id===actionId);
 if(existing){need(JSON.stringify(existing.command)===JSON.stringify(command),'Action ID was already used for a different command.');return {session:copy(session),...before};}
 if(expectedRevision!==undefined)need(expectedRevision===before.revision,'This character changed. Reload before applying the command.');
 need(session.events.length<LIMIT,'Action-log limit reached. Export this character before continuing.');
 const next=copy(session);next.events.push({id:actionId,command:copy(command)});
 const result=project(next);const last=result.log.at(-1);next.events.at(-1).rolls=last.rolls;next.events.at(-1).summary=last.summary;
 need(saveSize(next)<=MAX_SAVE_BYTES,'Save size limit reached. The action was not accepted. Export your current character before continuing.');
 return {session:next,...result};
}
export function importSession(raw) {
 need(typeof raw==='string'&&new TextEncoder().encode(raw).byteLength<=MAX_SAVE_BYTES,'Save is too large.');const session=JSON.parse(raw);project(session);return session;
}
export function exportSession(session) {project(session);return JSON.stringify(session,null,2);}
export function catalog() {return {apiVersion:API_VERSION,sources:SOURCES,sourceDiscrepancies:SOURCE_DISCREPANCIES,species:SPECIES,careers:CAREERS,precareers:PRECAREERS,extraStats:EXTRA_STATS,skills:SKILLS,skillSpecialities:SPECIALITIES,backgroundSkills:BACKGROUND_SKILLS};}
export function api(request) {
 try {
 need(plain(request),'Invalid request.');
 if(request.operation==='catalog')return {ok:true,...catalog()};
 if(request.operation==='create'){const session=createSession(request.seed);return {ok:true,session,...project(session)};}
 if(request.operation==='project')return {ok:true,...project(request.session)};
 if(request.operation==='import'){const session=importSession(request.raw);return {ok:true,session,...project(session)};}
 if(request.operation==='command')return {ok:true,...execute(request.session,request.command,{id:request.id,expectedRevision:request.expectedRevision})};
 throw new Error('Unknown API operation.');
 }catch(error){return {ok:false,error:{code:'INVALID_REQUEST',message:error.message}};}
}
