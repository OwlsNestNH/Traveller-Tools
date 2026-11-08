import { namedBenefitPlan, canonicalBenefitName, pensionEntitlement } from './benefits.mjs';
import { psionicPotential, talentAcquisition, psionicTalentOptions } from './psionics.mjs';
import { COMPANION_EDUCATION_IDS, companionEntryCheck, companionInitialAwards, companionEvent, companionGraduationCheck, companionTermOutcome, companionCareerBenefits, companionResolveSkillChoice } from './companion-education.mjs';
import { characterChanges } from './audit.mjs';
import { SPECIALITIES, PSIONIC_TALENTS, normalizeSkillName } from './skills.mjs';
import { EDUCATION_PACK, PRECAREER_EVENTS, educationEntryCheck, educationGraduationCheck, educationCareerBenefits } from './education-pack.mjs';
import { CORE_PACK } from './core-pack.mjs';
import { ageingOutcome, ageingCrisis, injuryOutcome, medicalBill, settleMedicalCosts, pensionForCareer } from './core-procedures.mjs';
import { EXPANSION_PACK, SPECIES_RULES, PRECAREER_RULES, BENEFIT_RULES, SOURCE_DISCREPANCIES, EXPANSION_TABLES } from './expansion-pack.mjs';
const RULE_PACK={...CORE_PACK,...EXPANSION_PACK};
import { API_VERSION, SOURCES, CAREERS, PRECAREERS, SPECIES, SKILLS, BACKGROUND_SKILLS, findCareer, findSpecies } from './catalog.mjs';
const LIMIT = 2000;
export const MAX_SAVE_BYTES = 2000000;
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
function setStat(state,key,value) { integer(value,0,40,'Characteristic'); state.character.stats[key]=value;if(state.character.species==='aezorgh'&&key==='SOC')state.character.stats.CHA=Math.floor(value/2); }
function gainSkill(state,name,level,mode='increase',allowTalentAcquisition=false) {
 need(typeof name==='string'&&name.length<=80,'Invalid skill.');
 const parsed=normalizeSkillName(name,{requireSpeciality:mode!=='set'||level>0});name=parsed.name;const base=parsed.base;need(SKILLS.includes(base),'Choose a supported skill or specialisation.');
 if(PSIONIC_TALENTS.includes(base)&&!Object.hasOwn(state.character.skills,name))need(allowTalentAcquisition&&(state.character.stats.PSI??0)>0,'Psionic talents require testing and explicit acquisition before improvement.');
 if(mode==='set'&&level===0&&SPECIALIZED.includes(base)&&base!=='Profession')name=base;
 const current=state.character.skills[name];
 const next=mode==='set'?Math.max(current??-1,integer(level,0,4,'Skill level')):Math.min(4,current===undefined?1:current+integer(level,1,4,'Skill gain'));
 const total=Object.values(state.character.skills).reduce((a,b)=>a+b,0)-(current??0)+Math.max(next,0);
 need(total<=3*((state.character.stats.INT??0)+(state.character.stats.EDU??0))||Math.max(next,0)<=Math.max(current??0,0),'Total skill limit exceeded.');
 state.character.skills[name]=Math.min(4,next);
}
function skillAwardExceedsLimit(state,name,level,mode='increase') {
 const parsed=normalizeSkillName(name,{requireSpeciality:mode!=='set'||level>0});
 const key=mode==='set'&&level===0&&parsed.base!=='Profession'&&Object.hasOwn(SPECIALITIES,parsed.base)?parsed.base:parsed.name;
 const current=state.character.skills[key],next=mode==='set'?Math.max(current??-1,level):Math.min(4,current===undefined?1:current+level);
 const increase=Math.max(next,0)-Math.max(current??0,0),total=Object.values(state.character.skills).reduce((sum,n)=>sum+n,0);
 return increase>0&&total+increase>3*((state.character.stats.INT??0)+(state.character.stats.EDU??0));
}
function sourceStep(state,kind,source,page,label,next) {
 state.pending={kind,source,page,label,next};state.stage='book-step';
 if(!state.coverage.includes(kind)) state.coverage.push(kind);
}
function checkAvailable(state,check,initialStats={}){return !check||check.stat.split('/').some(key=>Object.hasOwn(state.character.stats,key)||Object.hasOwn(initialStats,key));}
function missingCheck(state,check,label,command,source){
 const resumeStage=state.stage,career=state.active!==null?currentCareer(state).career:null;
 sourceStep(state,'missing-characteristic-check',source?.id??career?.source??'core',source?.page??source?.pages?.[0]??career?.page??17,'The '+check.stat+' characteristic required for '+label+' is absent. Resolve the cross-species check from the source; no score is invented.',resumeStage);
 Object.assign(state.pending,{resumeStage,check:copy(check),checkLabel:label,command:command?copy(command):null});
}
function rulesCheck(state,check,rolls,label,modifier=0) {
 if(state._sourceCheck){const manual=state._sourceCheck;need(manual.label===label,'The source check does not match the pending action.');delete state._sourceCheck;return {...manual,stat:check.stat,modifier,target:check.target,success:manual.total>=check.target,sourceAssisted:true};}
 const candidates=check.stat.split('/').filter(key=>Object.hasOwn(state.character.stats,key));need(candidates.length,'The required characteristic is absent.');
 const chosen=candidates.sort((a,b)=>characteristicDM(stat(state,b))-characteristicDM(stat(state,a)))[0];
 const dm=chosen==='RITE'?stat(state,'RITE'):characteristicDM(stat(state,chosen));
 const natural=dice(state,2,rolls,label);
 return {natural,stat:chosen,dm,modifier,total:natural+dm+modifier,target:check.target,success:natural+dm+modifier>=check.target};
}

function commissionAvailability(state){
 const unavailable=reason=>({available:false,reason,sourceRequired:false,automatic:false});
 if(state.stage!=='advancement'||state.active===null)return unavailable('Commission must be attempted during advancement.');
 const {record,career}=currentCareer(state);
 if(career.commission===undefined)return unavailable('This career does not offer commissions.');
 if(record.officer)return unavailable('This Traveller already holds a commission.');
 if(record.commissionTried)return unavailable('A commission has already been attempted this term.');
 if(record.commissionBlockedFirstTerm&&record.terms===0)return unavailable('Failed academy graduation prohibits a commission in this first term.');
 if(record.terms!==0&&(state.character.stats.SOC??0)<9)return unavailable('Later commission attempts require SOC 9 or greater.');
 if(career.group==='zhodani'&&((state.character.stats.SOC??0)<10||record.drafted&&record.terms===0))return unavailable('This Zhodani Traveller cannot receive a commission this term.');
 const automatic=!!record.automaticCommission||career.group==='zhodani';
 const sourceRequired=!automatic&&!checkAvailable(state,{stat:'SOC'})&&!state._sourceCheck;
 return {available:true,reason:sourceRequired?'The missing SOC check requires explicit source resolution.':'',sourceRequired,automatic};
}
function followingInteractionDM(value){
 if(value===undefined)return null;
 need(Number.isFinite(value)&&value>=0,'FOL must be a non-negative score.');
 return value>=13?4:value>=10?3:value>=7?2:value>=4?1:0;
}
function exitOptions(state){
 const none={canLeave:false,leaveReason:'Not at the end of a term.',canRetire:false,retireReason:'Not at the end of a term.',retirementRequired:false,canContinue:false,continueReason:'Not at the end of a term.'};
 if(state.stage!=='term-end'||state.active===null)return none;
 const {record,career}=currentCareer(state);
 const canContinue=!record.forcedExit,continueReason=canContinue?'':'This career must be left.';
 const blocked=record.forcedStay?'A natural 12 requires another term.':career.id==='core.prisoner'&&!record.released?'Prisoners must pass the parole threshold or escape before leaving.':null;
 if(blocked)return {...none,leaveReason:blocked,retireReason:blocked,canContinue,continueReason};
 const earlyAslan=career.group==='aslan'&&!['aslan.outcast','aslan.outlaw'].includes(career.id)&&!record.forcedExit&&record.terms<3;
 if(earlyAslan)return {canLeave:false,leaveReason:'This Aslan career requires three terms before transfer. Early retirement ends character creation.',canRetire:!state.forcedCareer,retireReason:state.forcedCareer?'Resolve the required next career before retiring.':'Early retirement ends creation after benefits; it does not permit a different career.',retirementRequired:true,canContinue,continueReason};
 return {canLeave:true,leaveReason:'',canRetire:false,retireReason:'Leave normally, then finish creation after resolving benefits.',retirementRequired:false,canContinue,continueReason};
}
const postBenefitsStage=state=>state.character.retirementFromCreation?'retirement':'career';

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
 c.assignments=c.assignments.map(a=>{const absent=[a.survival,a.advancement].filter(check=>check&&!checkAvailable(state,check,pre.initialStats)).map(check=>check.stat);return absent.length?{...a,disabled:true,reason:'Requires absent '+[...new Set(absent)].join('/')+' characteristic; use a source-approved cross-species route.'}:a;});
 if(c.assignments.every(a=>a.disabled))reason='Every assignment requires a characteristic absent for this species.';
 if(c.id==='aslan.wanderer'&&state.character.birthOrder!=='second-son')reason='Requires a second son under the source rules.';
 if(state.character.retirementFromCreation)reason='Early retirement ends character creation; a different career cannot be selected.';
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
 next.educationModifiers={commission:educational.commissionModifier,advancement:educational.advancementModifier};
 if(educational.entryRank!==null){next.rank=educational.entryRank;next.highestRank=next.rank;next.educationRankAward=true;}
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
   case 'skill':{const name=text(effect.name,80),newTalent=PSIONIC_TALENTS.includes(name)&&!Object.hasOwn(state.character.skills,name);gainSkill(state,name,integer(effect.value,0,4,'Skill value'),effect.mode==='set'?'set':'increase',true);if(newTalent)psionicHistory(state).historyKnown=false;break;}
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
  state.stage=record.benefitRolls?'benefits':postBenefitsStage(state);
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


const isCompanionEducation=id=>COMPANION_EDUCATION_IDS.includes(id);
const completedCareerTerms=state=>state.character.careers.reduce((sum,c)=>sum+c.terms,0);

function psionicHistory(state,known=false){
 if(!state.character.psionics)state.character.psionics={historyKnown:known,checksAttempted:0,firstTalentChosen:false,attempts:[],tests:[],training:[],rulings:[],importedAttempted:[]};
 return state.character.psionics;
}
const acquiredTalents=state=>PSIONIC_TALENTS.filter(name=>Object.hasOwn(state.character.skills,name));
function recordPsionicTest(state,context,natural,careerTerms=0){
 const wasUntested=!Object.hasOwn(state.character.stats,'PSI'),result=psionicPotential({roll:natural,careerTerms}),history=psionicHistory(state,true);
 if(wasUntested&&!acquiredTalents(state).length&&!history.attempts.length&&!state.character.psionicTraining)history.historyKnown=true;
 history.tests.push({...result,context});setStat(state,'PSI',result.psi);return result;
}
function psionicOptions(state){
 const active=state.psionicTraining;if(!active)return [];
 const history=psionicHistory(state);
 return psionicTalentOptions({species:state.character.species,acquired:acquiredTalents(state),attempted:[...history.importedAttempted,...history.attempts.map(a=>a.talent)],previousChecks:history.checksAttempted,firstTalentChosen:history.firstTalentChosen,talent:active.mode==='retry'?active.talent:null});
}
function psionicSource(state,kind,label){
 const active=state.psionicTraining;sourceStep(state,kind,active.source.id,active.source.page,label,'psionic-training');
 if(kind==='psionic-training-terms')Object.assign(state.pending,{testingNeeded:!Object.hasOwn(state.character.stats,'PSI'),minimumCost:Object.hasOwn(state.character.stats,'PSI')?100000:105000});
}
function returnFromPsionics(state,rolls,completed){
 const active=state.psionicTraining,history=psionicHistory(state);
 if(active.mode==='initial')history.training.push({context:active.context,source:copy(active.source),attemptStart:active.attemptStart??history.attempts.length,attemptEnd:history.attempts.length,completed});
 state.psionicTraining=null;state.pending=null;
 if(active.next==='companion-admission'&&completed){Object.assign(state.pendingEducation,{psionicTrainingComplete:true,acquiredTalents:acquiredTalents(state)});}
 if(active.next==='native-resume')drainEffects(state,rolls);else state.stage=active.next;
}
function activatePsionicTraining(state,rolls){
 const active=state.psionicTraining,history=psionicHistory(state);
 if(!history.historyKnown){psionicSource(state,'psionic-history','Prior psionic acquisition checks are unknown. Record their count and attempted talents before further rolls. Do not reset failed checks.');return;}
 if((state.character.stats.PSI??0)<=0){active.noPotential=true;returnFromPsionics(state,rolls,false);return;}
 if(active.context==='companion-community'&&history.training.some(t=>t.completed)){active.mode='reuse';returnFromPsionics(state,rolls,true);return;}
 active.attemptStart=history.attempts.length;state.pending=null;state.stage='psionic-training';
 if(active.mode==='retry'&&!psionicOptions(state).length){psionicSource(state,'psionic-retry','This talent cannot use the supported acquisition table. Resolve this source award explicitly.');return;}
}
function startPsionicTraining(state,config,rolls){
 need(!state.psionicTraining,'Another psionic training opportunity is active.');
 state.psionicTraining={mode:'initial',...copy(config)};
 if(config.context==='zhodani-elevation'&&state.character.psionics?.training.some(t=>t.completed)){psionicSource(state,'psionic-repeat-training','The Traveller has already completed initial psionic training. Resolve how this new societal training interacts with prior attempts; no free repeated checks are assumed.');return;}
 if(config.requiresTerms){psionicSource(state,'psionic-training-terms','Resolve access, testing/training charges and timing. Core testing takes two weeks and costs at least Cr5000; training takes four months and costs Cr100000. No free training, elapsed age or debt is assumed.');return;}
 if(config.test&&!Object.hasOwn(state.character.stats,'PSI')){if(!state.character.psionics)psionicHistory(state,true);recordPsionicTest(state,config.context,dice(state,2,rolls,'Psionic potential'),completedCareerTerms(state));}
 activatePsionicTraining(state,rolls);
}
function markPsionicOrigin(effects,origin){
 const result=copy(effects);function visit(value){if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;if(value.kind)value.psionicOrigin=copy(origin);for(const [key,item] of Object.entries(value))if(key!=='psionicOrigin')visit(item);}visit(result);return result;
}
function requestTalentAward(state,e,rolls){
 const career=state.active!==null?currentCareer(state).career:null,zhodani=state.character.species==='zhodani'&&(state.character.stats.SOC??0)>=10;
 if((zhodani||career?.id==='core.psion'&&e.psionicOrigin?.table==='service')&&(state.character.stats.PSI??0)>0){
  startPsionicTraining(state,{mode:'retry',context:zhodani?'zhodani-award':'core-psion-award',source:zhodani?{id:'aliens',page:256}:{id:'core',page:229},talent:e.name,origin:e.psionicOrigin??null,next:'native-resume',award:copy(e)},rolls);return;
 }
 nativeFallback(state,e,'Resolve the required psionic talent acquisition from the source before awarding this skill. No free training or talent is assumed.');
}
function rerollPsionicAward(state,active,rolls){
 const origin=active.origin,current=state.active!==null?currentCareer(state):null,record=current?.record,career=current?.career,pack=nativePack(state);
 if(!origin||!career||origin.careerId!==career.id||origin.assignment!==record.assignment){state.psionicTraining=active;psionicSource(state,'psionic-retry','The failed Zhodani acquisition requires another skill roll, but its originating table is unknown. Resolve that replacement explicitly.');return;}
 const rows=origin.table==='assignment'?pack.training.assignments[record.assignment]:pack.training[origin.table];
 need(rows?.length===6,'The original psionic skill table is unavailable.');
 const result=dice(state,1,rolls,'Psionic replacement: '+origin.table);
 state.effectsQueue.unshift(...markPsionicOrigin(rows[result-1],{...origin,result}));drainEffects(state,rolls);
}

function companionSource(state,phase,result,extra={}) {
 const id=state.education!==undefined&&state.education!==null?educationRecord(state).id:state.pendingEducation.id;
 sourceStep(state,'companion-'+phase,'companion',PRECAREER_RULES[id].source.pages[0],result.reason??('Resolve missing information: '+(result.missingInputs??[]).join(', ')),phase);
 Object.assign(state.pending,{educationId:id,...extra});
}
function startCompanionEducation(state,entry,rolls) {
 const config=state.pendingEducation,id=config.id;
 state.character.educations??=[];state.education=state.character.educations.length;
 state.character.educations.push({id,term:state.character.terms+1,ageBefore:state.character.age,careersBefore:state.character.careers.length,careerAttempts:0,selections:{},skillsBefore:copy(state.character.skills),graduationAllowed:true,entry:copy(entry),curriculum:config.curriculum,homeworld:copy(config.homeworld??{}),psionicTrainingComplete:!!config.psionicTrainingComplete,acquiredTalents:copy(config.acquiredTalents??[])});
 state.pendingEducation=null;
 const record=educationRecord(state),serviceRoll=id==='companion.merchant'?dice(state,1,rolls,'Merchant academy service skill'):undefined;
 const awards=companionInitialAwards({id,curriculum:record.curriculum,serviceRoll,acquiredTalents:record.acquiredTalents,psionicTrainingComplete:record.psionicTrainingComplete});
 if(!awards.resolved){companionSource(state,'initial-awards',awards);return;}
 record.initialAwards=copy(awards);queueEffects(state,sourcedEffects(awards.effects,awards.source),'education-event',rolls);
}
function completeEducationTerm(state,record,outcome) {
 record.termOutcome=copy(outcome);record.completed=true;
 state.character.age=outcome.ageAfter;state.character.terms+=outcome.termDelta;
 state.character.preCareer={id:record.id,graduated:record.graduation.graduated,honours:record.graduation.honours};
 if(record.id==='companion.psionic'&&record.graduation.graduated)state.character.psionEntryPermission=true;
 state.education=null;state.pendingChoice=null;
 const species=findSpecies(state.character.species);
 if(state.character.age>=(species.agingStart??34))sourceStep(state,'education-ageing','core',49,'Resolve the ageing checkpoint after this education term.','career');else state.stage='career';
}
function companionChoiceOptions(state,e) {
 const record=educationRecord(state);let names=(e.options??[]).map(o=>o.name);
 if(e.optionsFromSelections)names=[...e.optionsFromSelections.flatMap(id=>record.selections[id]??[]),...(e.additionalOptions??[])];
 if(e.existingOnly)names=Object.keys(state.character.skills).filter(n=>state.character.skills[n]>=0);
 const excluded=(e.excludeSelections??[]).flatMap(id=>record.selections[id]??[]).map(n=>n.split(' (')[0]);
 return [...new Set(names)].filter(n=>!excluded.includes(n.split(' (')[0])).map(name=>({name}));
}
function educationRecord(state) { need(state.education!==undefined&&state.education!==null,'No education term is active.');return state.character.educations[state.education]; }
function educationOptions(state,e) {
 if(state.education!==undefined&&state.education!==null&&isCompanionEducation(educationRecord(state).id)&&e.selectionId!=='hobby')return companionChoiceOptions(state,e);
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
 const record=educationRecord(state);
 if(isCompanionEducation(record.id)){
  record.graduation??=companionGraduationCheck({id:record.id,graduationAllowed:false});
  let outcome=companionTermOutcome({id:record.id,entered:true,age:record.ageBefore,term:record.term});
  if(outcome.missingInputs?.includes('colonialAgeDice')){
   mechanicalDice(state,'2D3',rolls,'Colonial first-career age');record.colonialAgeDice=copy(rolls.at(-1).kept);
   outcome=companionTermOutcome({id:record.id,entered:true,age:record.ageBefore,term:record.term,colonialAgeDice:record.colonialAgeDice});
  }
  if(!outcome.resolved){companionSource(state,'timing',outcome);return;}
  completeEducationTerm(state,record,outcome);return;
 }
 record.graduation??=educationGraduationCheck({id:record.id,graduationAllowed:false});
 completeEducationTerm(state,record,{ageAfter:state.character.age+4,termDelta:1});
}

function educationRights(state,careerId,assignment,entering=false) {
 const rights={qualificationModifier:0,commissionModifier:0,advancementModifier:0,entryRank:null,automaticEntry:false,commission:null,commissionBlocked:false,effects:[],unresolved:[]};
 for(const [index,record] of (state.character.educations??[]).entries()) {
  if(!record.completed||!record.graduation)continue;
  if(isCompanionEducation(record.id)){
   const key=careerId+'/'+assignment,ruling=record.rightsRulings?.[key];
   let r=ruling?.manual?ruling:companionCareerBenefits({id:record.id,graduation:record.graduation,careerId,assignment,curriculum:record.curriculum,firstCareerAfterEducation:state.character.careers.length===record.careersBefore,firstCareerExit:state.character.careers[record.careersBefore]?.exit,citizenBranchApproved:ruling?.citizenBranchApproved,enteringCareer:entering,forcedNextCareer:state.forcedCareer});
   if(!r.resolved){rights.unresolved.push({kind:'unsupported',source:r.source??PRECAREER_RULES[record.id].source,reason:r.reason??('Resolve '+r.missingInputs.join(', ')),educationIndex:index,careerId,assignment,citizenMapping:record.id==='companion.merchant'&&careerId==='core.citizen'&&state.character.careers.length===record.careersBefore});continue;}
   rights.qualificationModifier+=r.qualificationModifier??0;rights.commissionModifier+=r.commissionModifier??0;rights.advancementModifier+=r.advancementModifier??0;rights.automaticEntry||=r.automaticEntry;
   if(r.entryRank!==null&&r.entryRank!==undefined){rights.entryRank=Math.max(rights.entryRank??0,r.entryRank);if(entering)rights.effects.push(...(r.effects??[]));}
   continue;
  }
  const r=educationCareerBenefits({id:record.id,graduation:record.graduation,careerId,assignment,
   firstCareerAfterEducation:state.character.careers.length===record.careersBefore,
   firstCareerAttempt:(record.careerAttempts??0)===0,serviceAwardUsed:!!record.serviceAwardUsed,enteringCareer:entering,
   forcedNextCareer:state.forcedCareer});
  if(r.needsAdjudication){
   if(Object.hasOwn(state.educationEntryRulings??{},careerId)){if(state.educationEntryRulings[careerId]){rights.automaticEntry=true;rights.commissionBlocked=true;}}
   else rights.unresolved.push({kind:'unsupported',source:{id:'core',page:17},reason:r.reason});
   continue;
  }
  rights.coreQualificationModifier=Math.max(rights.coreQualificationModifier??0,r.qualificationModifier);
  rights.automaticEntry||=r.automaticEntry;
  if(r.commission?.allowed&&(!rights.commission||r.commission.automatic||r.commission.modifier>rights.commission.modifier))rights.commission=r.commission;
  if(r.commission?.allowed===false)rights.commissionBlocked=true;
  if(entering&&r.serviceAward){record.serviceAwardUsed=true;rights.effects.push(...r.effects.filter(e=>e.kind==='service-training').map(e=>({...e,educationIndex:index})));}
 }
 rights.qualificationModifier+=rights.coreQualificationModifier??0;return rights;
}
function finishCareerEntry(state,rolls) {
 const {record}=currentCareer(state),effects=record.entryEffects??[],next=record.entryNext??'survival';
 delete record.entryEffects;delete record.entryNext;
 queueEffects(state,[...effects,...(record.educationRankAward?[]:rankEffects(state))],next,rolls);
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

const INJURY_STATS=['STR','DEX','END'];
function injuryRecord(state){need(state.injury!==undefined&&state.injury!==null,'No injury is active.');return state.character.injuries[state.injury];}
function completeInjury(state,rolls){const record=injuryRecord(state);record.completed=true;state.injury=null;state.pending=null;return drainEffects(state,rolls);}
function injurySource(state,kind,label,extra={}){const record=injuryRecord(state);sourceStep(state,kind,'core',49,label,'injury-resume');Object.assign(state.pending,{injuryId:record.id,...extra});}
function beginInjury(state,e,rolls){
 if(e.table!=='core.injury'||e.subject&&e.subject!=='traveller'){nativeFallback(state,e,e.subject?'This injury concerns another person. Resolve that person and their injury from the source; do not apply it to the Traveller.':'Resolve the unsupported injury table from the source.');return;}
 if(INJURY_STATS.some(name=>!Object.hasOwn(state.character.stats,name))){nativeFallback(state,e,'A physical characteristic is absent. Resolve this injury using the species source.');return;}
 const tableRolls=[];let result;
 if(e.result!==undefined)result=integer(e.result,1,6,'Fixed injury result');
 else{const count=integer(e.rolls??1,1,2,'Injury table rolls');if(count===2&&!['lower','higher'].includes(e.take)){nativeFallback(state,e,'Choose the multiple-roll injury rule from the source.');return;}for(let i=0;i<count;i++)tableRolls.push(dice(state,1,rolls,'Injury table'+(count>1?' '+(i+1):'')));result=count===1?tableRolls[0]:e.take==='lower'?Math.min(...tableRolls):Math.max(...tableRolls);}
 const severityDie=result<=2?dice(state,1,rolls,'Injury severity'):undefined,outcome=injuryOutcome({roll:result,severityDie});
 const career=state.active===null?null:currentCareer(state);state.character.injuries??=[];state.injury=state.character.injuries.length;
 const record={id:'injury-'+(state.injury+1),source:copy(outcome.source),contextSource:copy(e.source??(career?{id:career.career.source,page:career.career.page}:outcome.source)),careerId:career?.record.id??null,careerIndex:state.active,rank:career?.record.rank??0,tableRolls,tableResult:result,...(severityDie!==undefined?{severityDie}:{}),take:e.take??null,fixed:e.result!==undefined,statsBefore:Object.fromEntries(INJURY_STATS.map(name=>[name,stat(state,name)])),options:copy(outcome.effects[0]?.options??[]),completed:false};
 state.character.injuries.push(record);
 if(!outcome.effects.length){record.losses={STR:0,DEX:0,END:0};record.statsAfterLoss=copy(record.statsBefore);record.restoration={STR:0,DEX:0,END:0};record.completed=true;state.injury=null;return;}
 need(outcome.effects.length===1&&outcome.effects[0].kind==='choice','Injury helper must provide one loss choice.');state.stage='injury-loss';
}
function commitInjuryLoss(state,after){
 const record=injuryRecord(state);record.statsAfterLoss=copy(after);record.losses={};
 for(const name of INJURY_STATS){record.losses[name]=record.statsBefore[name]-after[name];setStat(state,name,after[name]);}
 state.stage='injury-treatment';
}
function finishInjuryTreatment(state,bill,rolls){
 const record=injuryRecord(state);need(!record.medical,'This injury treatment was already recorded.');
 for(const name of INJURY_STATS){const restored=record.restoration[name]??0;need(stat(state,name)===record.statsAfterLoss[name],'Injury characteristics changed during treatment; source adjudication is required.');setStat(state,name,stat(state,name)+restored);}
 record.medical=copy(bill);record.statsAfterTreatment=Object.fromEntries(INJURY_STATS.map(name=>[name,stat(state,name)]));
 state.character.medicalBills??=[];
 state.character.medicalBills.push({id:'medical-'+(state.character.medicalBills.length+1),injuryId:record.id,source:{id:'core',page:49},careerId:record.careerId,rank:record.rank,inService:bill.inService,totalCost:bill.totalCost,coveredCost:bill.coveredCost,personalCost:bill.personalCost,coverageRoll:bill.roll??null,coveragePercent:bill.coveragePercent,settled:false,paid:0,debt:0});
 completeInjury(state,rolls);
}
function settleInjuryBills(state){
 const bills=(state.character.medicalBills??[]).filter(b=>!b.settled),cost=bills.reduce((sum,b)=>sum+b.personalCost,0);
 if(!bills.length)return null;
 if(state.character.cash<0){sourceStep(state,'medical-settlement','core',49,'Available cash is negative. Resolve that balance before settling the separate outstanding injury bills.','career');return false;}
 const settlement=settleMedicalCosts({cash:state.character.cash,cost});let cash=state.character.cash;
 for(const bill of bills){bill.paid=Math.min(cash,bill.personalCost);bill.debt=bill.personalCost-bill.paid;bill.settled=true;cash-=bill.paid;}
 state.character.cash=settlement.remainingCash;state.character.debt+=settlement.debt;
 state.character.medicalSettlements??=[];state.character.medicalSettlements.push({billIds:bills.map(b=>b.id),cost,paid:settlement.paid,debt:settlement.debt,remainingCash:settlement.remainingCash});return settlement;
}
function payAgeingCare(state,e,rolls){
 const crisis=state.character.ageingCrises?.[e.crisisIndex];need(crisis&&!crisis.resolved,'No unpaid ageing crisis is active.');
 if(state.character.cash<e.value){sourceStep(state,'ageing-financing','core',49,'Ageing-crisis care must be paid. Ordinary injury debt rules do not automatically finance this crisis. Resolve funding or refusal explicitly.','native-resume');Object.assign(state.pending,{cost:e.value,shortfall:e.value-state.character.cash,crisisIndex:e.crisisIndex});return false;}
 state.character.cash-=e.value;crisis.paid=e.value;crisis.resolved=true;crisis.careAccepted=true;return true;
}

function benefitOrigin(state,e){
 if(e.benefitOrigin)return copy(e.benefitOrigin);
 const career=state.active!==null?currentCareer(state).career:null;
 return {careerId:career?.id??null,careerIndex:state.active,source:copy(e.source??{id:career?.source??'core',page:career?.page??47}),tableContext:null};
}
function markBenefitOrigin(effects,origin){
 const result=copy(effects);function visit(value){if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;if(value.kind)value.benefitOrigin=copy(origin);for(const [key,item]of Object.entries(value))if(!['benefitOrigin','source'].includes(key))visit(item);}visit(result);return result;
}
function benefitAward(state,id){const award=state.character.benefitAwards?.find(a=>a.id===id);need(award,'The benefit award record is missing.');return award;}
function benefitSource(state,award,kind,label,fields={}){
 sourceStep(state,kind,award.source.id,award.source.page??award.source.pages?.[0]??47,label,'native-resume');Object.assign(state.pending,copy(fields),{kind,source:award.source.id,page:award.source.page??award.source.pages?.[0]??47,awardId:award.id,benefitName:award.name,definitionId:award.definitionId});
}
function benefitAsset(state,award,properties){
 state.character.assets??=[];const asset={id:'asset-'+(state.character.assets.length+1),definitionId:award.definitionId,source:copy(award.source),originCareerId:award.origin.careerId,awardIds:[award.id],active:true,...copy(properties)};state.character.assets.push(asset);award.assetIds.push(asset.id);
 state.character.benefits.push({name:asset.name,quantity:1,assetId:asset.id,definitionId:award.definitionId,ownership:asset.ownership,...(asset.mortgagePaidPercent!==undefined?{mortgagePaidPercent:asset.mortgagePaidPercent}:{})});return asset;
}
function recordBenefitToken(state,award,name,quantity=1,extra={}){
 const existing=state.character.benefits.find(b=>!b.assetId&&b.name===name&&b.definitionId===(extra.definitionId??award.definitionId));
 if(existing){if(!extra.nonnumeric)existing.quantity+=quantity;}
 else state.character.benefits.push({name,quantity,definitionId:extra.definitionId??award.definitionId,...copy(extra)});
}
function compileBenefitEffects(effects,awardId){
 const result=copy(effects);function visit(value){if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;if(value.kind){value.awardId=awardId;if(value.kind==='benefit')value.kind='benefit-record';}for(const child of Object.values(value))visit(child);}visit(result);return result;
}
function beginNamedBenefit(state,e,rolls){
 const origin=benefitOrigin(state,e),quantity=e.dice?mechanicalDice(state,e.dice,rolls,e.name+' quantity'):(e.value??1);
 const first=namedBenefitPlan({name:e.name,careerId:origin.careerId,source:origin.source,quantity});let previousCount=(state.character.benefitAwards??[]).filter(a=>a.definitionId===first.definitionId&&a.status==='resolved'&&a.received!==false).length;
 if(first.name==='TAS Membership'&&state.character.benefits.some(b=>canonicalBenefitName(b.name).toLowerCase()==='tas membership'))previousCount=Math.max(previousCount,1);
 const plan=namedBenefitPlan({name:e.name,careerId:origin.careerId,source:origin.source,quantity,previousCount});
 state.character.benefitAwards??=[];const award={id:'award-'+(state.character.benefitAwards.length+1),name:plan.name,definitionId:plan.definitionId,source:copy(plan.source),origin,quantity,previousCount,status:'pending',assetIds:[],decisions:[]};state.character.benefitAwards.push(award);
 state.effectsQueue.unshift({kind:'benefit-finalize',awardId:award.id});
 if(plan.needsAdjudication){benefitSource(state,award,'benefit-source',plan.reason);return false;}
 state.effectsQueue.unshift(...compileBenefitEffects(sourcedEffects(plan.effects,plan.source),award.id));return true;
}
const weaponSkills=['Gun Combat (archaic)','Gun Combat (energy)','Gun Combat (slug)','Melee (blade)','Melee (bludgeon)','Melee (natural)','Melee (unarmed)',...['Heavy Weapons','Gunner'].flatMap(base=>SPECIALITIES[base].map(s=>base+' ('+s+')')),'Athletics (dexterity)','Explosives'];
function openBenefitEquipment(state,e){
 const award=benefitAward(state,e.awardId),prior=(state.character.assets??[]).filter(a=>a.definitionId===award.definitionId&&a.active);
 const weaponSkillOptions=e.category==='blade'?['Melee (blade)']:e.category==='gun'?weaponSkills.filter(n=>n.startsWith('Gun Combat')):e.category==='weapon'?weaponSkills:[];
 benefitSource(state,award,'benefit-equipment','Choose the actual source-listed equipment and confirm its cost, TL and restrictions before receiving it.',{...e,weaponSkillRequired:weaponSkillOptions.length>0,weaponSkillOptions,replacementAssetIds:e.replaceOriginal?prior.map(a=>a.id):[]});
}
function openBenefitShip(state,e,rolls){
 const award=benefitAward(state,e.awardId),existing=(state.character.assets??[]).find(a=>a.definitionId===award.definitionId&&a.type==='ship'&&a.active);
 if(e.kind==='ship-mortgage'&&award.previousCount>0){
  if(!existing){benefitSource(state,award,'benefit-source','The previous ship award has no established asset. Resolve the same-vessel mortgage history before applying another award.');return false;}
  need(existing.mortgagePaidPercent+25===e.percentAfter,'Existing mortgage progress conflicts with the source award history.');
  existing.mortgagePaidPercent=e.percentAfter;existing.awardIds.push(award.id);award.assetIds.push(existing.id);const b=state.character.benefits.find(b=>b.assetId===existing.id);if(b)b.mortgagePaidPercent=e.percentAfter;return true;
 }
 const history=e.quirks??e.history;
 if(e.kind==='ship-use'&&!history){benefitAsset(state,award,{type:'ship',name:e.name,ownership:'use',owner:e.owner,recallable:!!e.recallable,mortgagePaidPercent:null});return true;}
 const historyRollCount=history?mechanicalDice(state,history.countDice,rolls,'Ship history roll count'):0;
 const variants=e.variants??[e.family??e.name];benefitSource(state,award,'benefit-ship','Resolve the indicated ship history table and model choice explicitly. Outdated Ships and Spacecraft Quirks are different tables; no age or discount interpretation is assumed.',{variants,model:variants[0],ownership:e.kind==='ship-use'?'use':'owned',owner:e.owner??'Traveller',recallable:!!e.recallable,mortgagePaidPercent:e.kind==='ship-mortgage'?e.percentAfter:null,historyTable:history?.table??null,historyTableLabel:history?.table==='core.outdated-ships'?'Outdated Ships (Core p. 188)':'Spacecraft Quirks (Core p. 188)',historyRollCount,existingAssetId:null});return false;
}
function rerollMaterialBenefit(state,e,rolls){
 const award=benefitAward(state,e.awardId),context=award.origin.tableContext,career=state.active!==null?currentCareer(state).career:null;
 if(!context||!career||context.careerId!==career.id||context.table!=='material'){benefitSource(state,award,'benefit-source','This repeated borrowed ship requires a material-table reroll, but its original table and modifiers were not recorded. Resolve the replacement explicitly.');return false;}
 const natural=dice(state,1,rolls,'Repeated ship: material benefit'),result=natural+context.modifier,entry={natural,modifier:context.modifier,result};state.benefitRollContext?.rolls.push(entry);award.reroll=entry;
 const rows=RULE_PACK[context.careerId]?.benefits.material;
 if(!rows?.[result-1]){benefitSource(state,award,'benefit-source','The replacement benefit result '+result+' is outside the printed table. Resolve it explicitly without consuming another benefit roll.');return false;}
 award.status='rerolled';state.effectsQueue.unshift(...markBenefitOrigin(rows[result-1],{...award.origin,tableContext:{...context,...entry}}));return true;
}
function finishCareerExit(state){const {record}=currentCareer(state);state.stage=record.benefitRolls?'benefits':postBenefitsStage(state);if(!record.benefitRolls)state.active=null;}

function nativePack(state) { return state.active===null?null:RULE_PACK[state.character.careers[state.active].id]??null; }
function rankEffects(state) {
 const {record}=currentCareer(state),pack=nativePack(state);if(!pack)return [];
 const rows=record.officer?(pack.ranks.officer??pack.ranks.default):pack.ranks.assignments?.[record.assignment]??pack.ranks.enlisted??pack.ranks.default;
 return copy(rows?.find(r=>r.rank===record.rank)?.effects??[]);
}
function asBasic(effects) {
 return effects.map(effect=>effect.kind==='choice'?{...effect,options:effect.options.map(o=>({...o,effects:asBasic(o.effects)}))}:effect.kind==='skill'?{...effect,name:effect.name.startsWith('Profession (')?effect.name:effect.name.split(' (')[0],mode:'set',value:0}:effect.kind==='skill-choice'?{...effect,mode:'set',value:0}:effect);
}
function sourcedEffects(effects,source){
 const result=copy(effects);
 function mark(value){
  if(Array.isArray(value)){value.forEach(mark);return;}
  if(!value||typeof value!=='object')return;
  if(value.kind&&!value.source)value.source=value.sourcePage!==undefined?{...copy(source),page:value.sourcePage}:copy(source);
  for(const [key,child] of Object.entries(value))if(key!=='source')mark(child);
 }
 mark(result);return result;
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
  const preliminary=ageingCrisis({stats:state.character.stats});if(preliminary.crisis){
   const costDie=dice(state,1,rolls,'Ageing crisis medical cost'),outcome=ageingCrisis({stats:state.character.stats,medicalDie:costDie});state.character.ageingCrises??=[];const index=state.character.ageingCrises.length;
   state.character.ageingCrises.push({source:copy(outcome.source),medicalDie:costDie,cost:outcome.cost,affected:copy(outcome.affected),statsBefore:copy(state.character.stats),resolved:false});
   const effects=copy(outcome.effects);for(const option of effects[0].options)for(const effect of option.effects){if(effect.kind==='medical-cost'){effect.context='ageing-crisis';effect.crisisIndex=index;}if(effect.kind==='death')effect.crisisIndex=index;}
   queueEffects(state,effects,'term-end',rolls);
  }else state.stage='term-end';return;
 }
 if(next==='new-career-training'){state.stage='training';return;}
 if(next==='after-event'){const {record}=currentCareer(state);if(record.forcedExit||record.advancementBlock>0)closeTerm(state);else state.stage='advancement';return;}
 if(next==='benefit-complete'){if(state.benefitRollContext){state.character.benefitRollHistory??=[];state.character.benefitRollHistory.push({...copy(state.benefitRollContext),completed:true});state.benefitRollContext=null;}const {record}=currentCareer(state);record.benefitRolls--;record.totalBenefits++;state.stage=record.benefitRolls?'benefits':postBenefitsStage(state);if(!record.benefitRolls)state.active=null;return;}
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
 const base=name.split(' (')[0],skills=state.character.skills;
 if(name.includes(' (')){
  if(Object.hasOwn(skills,name))return skills[name];
  if(base==='Profession')return -3;
  return Object.keys(skills).some(key=>key===base||key.startsWith(base+' ('))?0:-3;
 }
 const values=Object.entries(skills).filter(([key])=>key===base||key.startsWith(base+' (')).map(([,v])=>v);
 return values.length?Math.max(...values):-3;
}
function skillCheckDM(state,name) {
 const level=skillLevel(state,name),untrained=level<0?Math.min(3,Math.max(0,state.character.skills['Jack-of-all-Trades']??0)):0;
 const trait=state.character.species==='aezorgh'&&['Recon','Survival'].includes(name.split(' (')[0])?1:0;
 return level+untrained+trait;
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
 if(effect.permittedNames&&!effect.permittedNames.includes(name))return false;
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
   case 'education-skill-choice':state.pendingChoice=e;state.stage=isCompanionEducation(educationRecord(state).id)&&e.selectionId!=='hobby'?'companion-skill':'education-skill';return;
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
   case 'psionic-talent':{if(e.name&&PSIONIC_TALENTS.includes(e.name)&&skillLevel(state,e.name)>=0){if(skillAwardExceedsLimit(state,e.name,e.value??1,e.mode)){nativeFallback(state,e,'This mandatory talent award would exceed the total skill limit. Adjudicate the award from the source.');return;}gainSkill(state,e.name,e.value??1,e.mode);break;}requestTalentAward(state,e,rolls);return;}
   case 'checked-skill':{
    const name=educationRecord(state).checkedSkill;need(name,'The education check skill was not recorded.');
    state.effectsQueue.unshift({kind:'skill',name,mode:e.mode,value:e.value});break;
   }
   case 'psionic-test':{
    if(!Object.hasOwn(state.character.stats,'PSI'))recordPsionicTest(state,'source-event',dice(state,2,rolls,'Psionic potential'),completedCareerTerms(state));
    break;
   }
   case 'career-permission':if(e.career==='core.psion')state.character.psionEntryPermission=true;else {nativeFallback(state,e);return;}break;
   case 'choice':state.pendingChoice=e;state.stage='effect-choice';return;
   case 'skill-choice':
    if(e.scope==='psionic-talents'&&!acquiredTalents(state).length){nativeFallback(state,e,'This result improves an already acquired psionic talent, but none is possessed. Resolve the source award explicitly; it does not grant free acquisition.');return;}
    if(!['any','existing','science-specialties','psionic-talents'].includes(e.scope)||e.distinctSpecialties||e.untrained){nativeFallback(state,e,'Resolve the constrained skill choice from the source.');return;}
    state.pendingChoice=e;state.stage='skill-choice';return;
   case 'skill-reduction-choice':{const eligible=Object.keys(state.character.skills).filter(n=>state.character.skills[n]>0&&(!e.names||e.names.includes(n))&&skillNameAllowed(state,n,e));if(!eligible.length){nativeFallback(state,e,'No eligible trained skill can satisfy this reduction. Resolve the printed mishap explicitly before continuing.');return;}state.pendingChoice=e;state.stage='skill-choice';return;}
   case 'skill':{
    const base=e.name.split(' (')[0];
    if(PSIONIC_TALENTS.includes(base)&&skillLevel(state,e.name)<0){requestTalentAward(state,e,rolls);return;}
    if(e.value>0&&SPECIALIZED.includes(base)&&e.name===base){state.pendingChoice={kind:'skill-choice',scope:'any',allowed:[base],mode:e.mode,value:e.value,...(e.awardId?{awardId:e.awardId}:{}),label:'Choose a '+base+' specialisation'};state.stage='skill-choice';return;}

    if(skillAwardExceedsLimit(state,e.name,e.value??1,e.mode)){nativeFallback(state,e,'This mandatory skill award would exceed the total skill limit. Resolve its disposal from Core p. 18 without exceeding the cap.');return;}gainSkill(state,e.name,e.value??1,e.mode);break;
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
    if(state.character.species==='zhodani'&&state.active!==null&&e.name==='PSI'&&current<9&&state.character.stats.PSI>=9&&(state.character.stats.SOC??0)<10){state.character.stats.SOC=10;startPsionicTraining(state,{context:'zhodani-elevation',source:{id:'aliens',page:255},next:'native-resume'},rolls);return;}
    break;
   }
   case 'benefit-finalize':{const award=benefitAward(state,e.awardId);if(award.status==='pending')award.status='resolved';break;}
   case 'benefit-record':{const award=benefitAward(state,e.awardId);recordBenefitToken(state,award,e.name,e.value??1,{definitionId:'core.material.'+canonicalBenefitName(e.name),...(e.name==='Ship Share'?{redeemableForCash:false,valuePerShare:1000000}:{})});break;}
   case 'entitlement':{const award=benefitAward(state,e.awardId);recordBenefitToken(state,award,e.name,e.quantity??1,{...(e.redemption?{redemption:e.redemption}:{}),...(e.nonnumeric?{nonnumeric:true}:{})});break;}
   case 'equipment-choice':openBenefitEquipment(state,e);return;
   case 'equipment-upgrade':{benefitSource(state,benefitAward(state,e.awardId),'benefit-source','Select a previously received augmentation and resolve its one-level upgrade explicitly, ignoring its original purchase limits.');return;}
   case 'weapon-skill-choice':{
    const names=[...new Set((state.character.assets??[]).filter(a=>a.active&&a.weaponSkill&&e.allowedBases.includes(a.weaponSkill.split(' (')[0])).map(a=>a.weaponSkill))];
    if(!names.length){benefitSource(state,benefitAward(state,e.awardId),'benefit-source','No received weapon has a recorded matching skill. Establish the weapon and skill before resolving this improvement.');return;}
    state.pendingChoice={kind:'skill-choice',scope:'any',allowed:e.allowedBases,permittedNames:names,mode:e.mode,value:e.value,awardId:e.awardId,label:'Improve a skill matching a weapon already received: '+names.join(', ')};state.stage='skill-choice';return;
   }
   case 'ship-use':case 'ship-mortgage':if(!openBenefitShip(state,e,rolls))return;break;
   case 'reroll-benefit':if(!rerollMaterialBenefit(state,e,rolls))return;break;
   case 'annual-income':{
    const award=benefitAward(state,e.awardId);if(award.previousCount){benefitSource(state,award,'benefit-source','Resolve whether this repeated Patronage award supplies another stipend or changes an existing patron; no extra annual payment is assumed.');return;}
    state.character.annualIncome??=[];state.character.annualIncome.push({id:'income-'+(state.character.annualIncome.length+1),name:e.name,annualCredits:e.annualCredits,condition:e.condition,source:copy(award.source),awardId:award.id});
    recordBenefitToken(state,award,e.name,1,{annualCredits:e.annualCredits,condition:e.condition});break;
   }
   case 'sainthood':{
    const award=benefitAward(state,e.awardId);state.character.sainthood??={candidacies:0,interactionDM:0,checks:[]};const sainthood=state.character.sainthood;sainthood.candidacies=e.candidacy;sainthood.interactionDM=Math.max(sainthood.interactionDM,2);
    benefitSource(state,award,'benefit-source','Resolve the belief-specific Science check at 14 with the cumulative candidacy bonus. Confirm its success or failure; interaction modifiers remain fixed, not additive.',{sainthood:{candidacy:e.candidacy,checkBonus:e.candidacy,target:14,skill:'Science (belief)',interactionDM:sainthood.interactionDM}});return;
   }
   case 'benefit':if(!beginNamedBenefit(state,e,rolls))return;break;
   case 'cash':state.character.cash+=integer(e.dice?mechanicalDice(state,e.dice,rolls,'Cash result')*(e.multiplier??1):e.value,-100000000,100000000,'Cash award');break;
   case 'relationship':{
    const count=e.countFrom?Math.max(e.countFrom.minimum??0,characteristicDM(stat(state,e.countFrom.statDM))):e.dice?mechanicalDice(state,e.dice,rolls,e.type+' count'):(e.count??1);
    if(!e.onlyIfAbsent||!state.character.relationships.some(r=>r.role===e.type))for(let i=0;i<count;i++)state.character.relationships.push({role:e.type,name:'Unnamed '+e.type.toLowerCase()});
    break;
   }
   case 'check':{
    if(e.skillScope==='learned-this-term'){if(!learnedEducationSkills(state).length){nativeFallback(state,e,'No skill increased during this term; adjudicate the study challenge rather than assume a result.');return;}state.pendingChoice=e;state.stage='education-check';return;}
    let natural,total;
    if(e.stat){if(!checkAvailable(state,{stat:e.stat})&&!state._sourceCheck){state.effectsQueue.unshift(e);missingCheck(state,{stat:e.stat,target:e.target},e.stat+' check',null,e.source);return;}const r=rulesCheck(state,{stat:e.stat,target:e.target},rolls,e.stat+' check');natural=r.natural;total=r.total;}
    else {natural=dice(state,2,rolls,'Skill check');total=natural+Math.max(...e.skills.map(n=>skillCheckDM(state,n)));}
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
    else if(e.action==='exit'){record.forcedExit=true;if(record.id==='core.prisoner'){record.released=true;record.escaped=true;}}
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
    if(shared){const result=mechanicalDice(state,e.dice??shared.dice,rolls,e.table);const row=shared.results[result];if(!row){nativeFallback(state,e,'Shared table result needs source resolution.');return;}state.effectsQueue.unshift(...sourcedEffects(row,{id:shared.source.id,page:shared.source.page??shared.source.pages?.[0]}));break;}
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
   case 'injury':beginInjury(state,e,rolls);if(state.injury!==null&&state.injury!==undefined||state.pending&&state.stage==='book-step')return;break;
   case 'medical-cost':if(e.context==='ageing-crisis'){if(!payAgeingCare(state,e,rolls))return;}else{nativeFallback(state,e,'Resolve this medical cost and its financing explicitly; it is not automatically ordinary injury debt.');return;}break;
   case 'qualification-ban':state.character.qualificationBanned=true;break;
   case 'death':if(e.crisisIndex!==undefined){Object.assign(state.character.ageingCrises[e.crisisIndex],{resolved:true,careAccepted:false,paid:0});}state.character.deceased=true;state.stage='deceased';state.effectsQueue=[];state.effectNext='deceased';break;
   case 'rank':{const {record}=currentCareer(state);record.rank=Math.max(0,Math.min(6,record.rank+e.value));break;}
   case 'advancement-block':currentCareer(state).record.advancementBlock=e.terms;break;
   case 'benefit-block':currentCareer(state).record.benefitBlock=e.terms;break;
   case 'aslan-outcast':state.character.outcast=true;state.character.stats.SOC=e.SOC;if(e.forfeitClanShares)state.character.benefits=state.character.benefits.filter(b=>b.name!=='Clan Share');currentCareer(state).record.forcedExit=true;break;
   case 'conditional-future':state.character.futureConditions??=[];state.character.futureConditions.push(copy(e));break;
   case 'assignment-effect':{state.effectsQueue.unshift(...copy(e.assignments[currentCareer(state).record.assignment]??[]));break;}
   case 'independence':{if(state.character.gender!=='male'){nativeFallback(state,e,'Resolve the gender-specific Independence result.');return;}const result=dice(state,2,rolls,'Independence acquisition');if(result>stat(state,'SOC')){if(skillAwardExceedsLimit(state,'Independence',e.value??1,e.mode)){nativeFallback(state,e,'This mandatory Independence award would exceed the total skill limit. Resolve it explicitly without exceeding Core p. 18.');return;}gainSkill(state,'Independence',e.value??1,e.mode);}break;}
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
  need(!(species.id==='zhodani'&&payload.culture==='imperial'),'Zhodani rules assume Consulate childhood. Select Human for outside-Consulate upbringing.');
  if(payload.variant!==undefined)need(species.id==='vargr','Only Vargr have this strain option.');
  if(species.id==='vargr'){const variant=payload.variant??'standard';need(variant==='standard'||Object.hasOwn(SPECIES_RULES.vargr.variants,variant),'Choose a supported Vargr strain.');state.character.variant=variant;}
  state.character.name=text(payload.name??'',80);state.character.species=species.id;
  state.character.gender=text(payload.gender??'',20);state.character.culture=payload.culture==='imperial'?'imperial':'native';
  state.character.homeworld=text(payload.homeworld??'',160);state.character.age=species.startAge;state.character.traits=copy(SPECIES_RULES[species.id]?.traits??[]);
  state.stage='statistics';return 'Started '+(state.character.name||'an unnamed Traveller')+' ('+species.name+').'+(species.id==='vargr'?' Vargr strain: '+state.character.variant+'.':'');
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
  const formulas=species.id==='vargr'?{...species.dice,...(SPECIES_RULES.vargr.variants[state.character.variant]??{})}:species.dice;
  const basic=Object.entries(formulas).slice(0,6).map(([key,dice])=>species.id==='vargr'&&state.character.culture==='imperial'&&key==='CHA'?['SOC',[2,0]]:[key,dice]);
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
  need(species.id==='zhodani'||!state.config.extras.includes('PSI')||state.config.gm,'Optional PSI generation requires referee permission in GM mode.');
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
  if(Object.hasOwn(state.character.stats,'PSI')){const history=psionicHistory(state,true);history.tests.push({context:species.id==='zhodani'?'zhodani-childhood':'referee-potential',source:{id:species.id==='zhodani'?'aliens':'core',page:species.id==='zhodani'?254:228},psi:state.character.stats.PSI,careerTerms:0});}
   if(species.id==='zhodani'&&state.character.stats.SOC>=10)startPsionicTraining(state,{context:'zhodani-childhood',source:{id:'aliens',page:255},next:'precareer'},rolls);
   else if(species.setup&&species.id!=='zhodani')sourceStep(state,'species-setup',species.source,species.setupPage,species.setup,'background');
  return 'Accepted statistics and generated selected extra characteristics.';
 }
 case 'begin-psionic-training':{
   need(['career','precareer'].includes(state.stage)&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation,'Begin institute training only between careers, before retirement.');
   need(!Object.hasOwn(state.character.stats,'PSI')||state.character.stats.PSI>0,'PSI zero has no training potential.');
   need(!state.character.psionics?.training.some(t=>t.completed),'Initial training has already been completed; later retries require a source award.');
   startPsionicTraining(state,{context:'core-institute',source:{id:'core',page:228},next:state.stage,test:true,requiresTerms:true},rolls);return 'Institute access, costs and timing require an explicit source decision.';
  }
  case 'learn-talent':{
   need(state.stage==='psionic-training'&&state.psionicTraining,'No psionic acquisition opportunity is active.');
   const talent=text(payload.talent,40),option=psionicOptions(state).find(o=>o.talent===talent);need(option,'Choose an available, unacquired talent for this opportunity.');
   const history=psionicHistory(state),active=state.psionicTraining;
   const outcome=talentAcquisition({talent,psi:stat(state,'PSI'),previousChecks:history.checksAttempted,firstTalentChosen:history.firstTalentChosen,species:state.character.species,roll:option.automatic?undefined:dice(state,2,rolls,'Acquire '+talent)});
   history.attempts.push({...outcome,context:active.context,source:copy(active.source)});history.checksAttempted+=outcome.checksAdded;history.firstTalentChosen=true;
   if(outcome.success)gainSkill(state,talent,0,'set',true);
   if(active.mode==='retry'){
    state.psionicTraining=null;
    if(!outcome.success&&active.context==='zhodani-award')rerollPsionicAward(state,active,rolls);else drainEffects(state,rolls);
   }
   return 'Psionic acquisition '+talent+': '+(outcome.automatic?'automatic first talent (no check)':outcome.total+' against 8; '+outcome.previousChecks+' previous checks')+'. '+(outcome.success?'Acquired at level 0.':'Not acquired.')+' Source: '+active.source.id+' p. '+active.source.page+'.';
  }
  case 'finish-psionic-training':{
   need(state.stage==='psionic-training'&&state.psionicTraining?.mode==='initial','Only an initial training session can be finished.');returnFromPsionics(state,rolls,true);return 'Initial psionic training completed; all acquisition attempts and failures remain recorded.';
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
  need(state.stage==='career'&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation,'Education is only available before choosing a career, not after retirement.');
  need(state.character.terms<3&&!state.educationAttemptTerms?.includes(state.character.terms),'Education has already been attempted this term or its time limit has passed.');
  state.stage='precareer';return 'Reviewing pre-career education for term '+(state.character.terms+1)+'.';
 }
 case 'precareer': {
  need(state.stage==='precareer','Not choosing pre-career education.');
  const pre=PRECAREERS.find(p=>p.id===payload.id);need(pre,'Unknown pre-career.');
  need(state.character.terms<3&&(!pre.maxTerm||state.character.terms<pre.maxTerm),'This pre-career is no longer available.');
  if(isCompanionEducation(pre.id)){need(!state.educationAttemptTerms?.includes(state.character.terms),'Only one education entry attempt is allowed per term.');state.pendingEducation={id:pre.id};state.stage='companion-admission';return 'Reviewing '+pre.name+' admission requirements.';}
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
 case 'cancel-education':{
  need(state.stage==='companion-admission','No Companion admission choice is active.');state.pendingEducation=null;state.stage='precareer';return 'Returned to education options without making an entry attempt.';
 }
 case 'companion-entry':{
  need(state.stage==='companion-admission'&&state.pendingEducation,'No Companion admission choice is active.');
  const config=state.pendingEducation,id=config.id;
  if(id==='companion.colonial')config.homeworld={techLevel:integer(payload.techLevel,0,40,'Homeworld technology level')};
  if(id==='companion.spacer')config.homeworld={size:integer(payload.size,0,40,'Homeworld size')};
  if(id==='companion.merchant'){need(['business','shipboard'].includes(payload.curriculum),'Choose a Merchant academy curriculum.');config.curriculum=payload.curriculum;}
  if(id==='companion.psionic'&&Object.hasOwn(state.character.stats,'PSI'))need(state.character.stats.PSI>0,'PSI zero has no training potential. Choose another pre-career option.');
   if(id==='companion.psionic'&&!config.psionicTrainingComplete){
    const history=state.character.psionics;
    if(history?.historyKnown&&history.training.some(t=>t.completed)){Object.assign(config,{psionicTrainingComplete:true,acquiredTalents:acquiredTalents(state)});}
    else{const nativeChildhood=state.character.species==='human'&&state.character.terms===0&&state.character.age===18;
     startPsionicTraining(state,{context:'companion-community',source:{id:'companion',page:33},next:'companion-admission',test:true,requiresTerms:!nativeChildhood},rolls);return 'Psionic community testing and training must be completed before admission.';}
   }
  if(id==='companion.psionic')need((state.character.stats.PSI??0)>0,'Positive tested PSI is required for psionic training.');
  const input={id,term:state.character.terms+1,stats:state.character.stats,homeworld:config.homeworld,species:state.character.species,attemptedThisTerm:state.educationAttemptTerms?.includes(state.character.terms)??false};
  let outcome=companionEntryCheck(input);
  if(!outcome.resolved&&outcome.missingInputs?.length===1&&outcome.missingInputs[0]==='roll')outcome=companionEntryCheck({...input,roll:dice(state,2,rolls,'Companion education entry')});
  if(!outcome.resolved){companionSource(state,'entry',outcome);return 'Admission requires source resolution; no entry roll or term was assumed.';}
  need(outcome.eligible,outcome.reason??'Education entry is not available.');state.educationAttemptTerms??=[];state.educationAttemptTerms.push(state.character.terms);
  if(!outcome.success){state.pendingEducation=null;state.stage='career';return 'Companion education entry failed: total '+outcome.total+' against '+outcome.target+'. No term was consumed.';}
  startCompanionEducation(state,outcome,rolls);return 'Entered '+PRECAREERS.find(p=>p.id===id).name+(outcome.automatic?' automatically.':': total '+outcome.total+' against '+outcome.target+'.');
 }
 case 'companion-skill':{
  need(state.stage==='companion-skill'&&state.pendingChoice,'No Companion study choice is due.');
  const record=educationRecord(state),result=companionResolveSkillChoice({id:record.id,effect:state.pendingChoice,selected:payload.selected,skills:state.character.skills,selections:record.selections});
  need(result.resolved,result.reason??('Missing '+result.missingInputs.join(', ')));
  record.selections[result.selection.id]=copy(result.selection.names);state.pendingChoice=null;state.effectsQueue.unshift(...sourcedEffects(result.effects,result.source));drainEffects(state,rolls);
  return 'Companion study choices recorded: '+result.selection.id+' = '+result.selection.names.join(', ')+'.';
 }
 case 'companion-choice-source':{
  need(state.stage==='companion-skill'&&state.pendingChoice,'No Companion study choice is due.');companionSource(state,'skill-choice',{reason:'Adjudicate this constrained choice only if the printed award cannot be satisfied. Record the selected skills and all resulting effects.'},{choice:copy(state.pendingChoice)});state.pendingChoice=null;return 'Constrained Companion choice requires a recorded source decision.';
 }
 case 'education-event':{
  need(state.stage==='education-event','No education event is due.');
  const total=dice(state,2,rolls,'Pre-career event');educationRecord(state).event=total;
  const record=educationRecord(state),effects=isCompanionEducation(record.id)?companionEvent({id:record.id,entered:true,roll:total}).effects:PRECAREER_EVENTS[total];
  queueEffects(state,sourcedEffects(effects,{id:'core',page:17}),'education-graduation',rolls);return 'Pre-career event '+total+'.';
 }
 case 'education-graduation':{
  need(state.stage==='education-graduation','No graduation check is due.');
  const record=educationRecord(state),roll=dice(state,2,rolls,'Graduation');
  let outcome;
  if(isCompanionEducation(record.id)){
   const input={id:record.id,stats:state.character.stats,roll,species:state.character.species,graduationAllowed:record.graduationAllowed,curriculum:record.curriculum,acquiredTalents:record.acquiredTalents};
   outcome=companionGraduationCheck(input);
   if(!outcome.resolved&&outcome.missingInputs?.length===1&&outcome.missingInputs[0]==='eduLoss')outcome=companionGraduationCheck({...input,eduLoss:mechanicalDice(state,'D3',rolls,'Colonial education loss')});
   if(!outcome.resolved){record.graduationCheck=copy(outcome);companionSource(state,'graduation',outcome);return 'Graduation requires a source decision. No graduation awards have been granted.';}
  }else outcome=educationGraduationCheck({id:record.id,stats:state.character.stats,roll,graduationAllowed:record.graduationAllowed});
  record.graduation=outcome;queueEffects(state,sourcedEffects(outcome.effects,outcome.source??{id:'core',page:16}),'education-finish',rolls);
  return 'Graduation total '+outcome.total+' against '+outcome.target+': '+(outcome.honours?'honours':outcome.graduated?'graduated':'did not graduate')+'.';
 }
 case 'education-skill':{
  need(state.stage==='education-skill'&&state.pendingChoice,'No education skill choice is due.');
  const e=state.pendingChoice,name=text(payload.name,80),base=name.split(' (')[0];
  need(educationSkillValid(state,name,e),'Choose a listed education skill and an allowed specialisation.');
  if(SPECIALIZED.includes(base)&&e.selectionId!=='hobby')need(name.includes(' ('),'Choose the specialisation to retain for graduation.');
  const record=educationRecord(state);
  if(e.selectionId.startsWith('university-'))need(!Object.entries(record.selections).some(([id,n])=>id.startsWith('university-')&&n.split(' (')[0]===base),'Overlapping university choices require source adjudication. Choose different skill bases in the native flow.');
  record.selections[e.selectionId]=name;const awardName=e.value===0&&base!=='Profession'?base:name;if(skillAwardExceedsLimit(state,awardName,e.value,e.mode)){state.pendingChoice=null;nativeFallback(state,{kind:'skill',name:awardName,value:e.value,mode:e.mode,source:{id:'core',page:16}},'This education award would exceed the total skill limit. Resolve it explicitly from Core p. 18.');return 'Education skill choice recorded; its over-cap award requires source resolution.';}gainSkill(state,awardName,e.value,e.mode);
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
  const roll=dice(state,2,rolls,'Education skill check: '+name),total=roll+skillCheckDM(state,name);educationRecord(state).checkedSkill=name;
  state.pendingChoice=null;state.effectsQueue.unshift(...copy(total>=e.target?e.success:e.failure));drainEffects(state,rolls);
  return 'Education '+name+' check '+total+' against '+e.target+'.';
 }
 case 'preterm-commission':{
  need(state.stage==='preterm-commission','No education commission opportunity is pending.');
  const {record,career}=currentCareer(state),right=record.educationCommission;need(right?.allowed,'No education commission entitlement.');
  let check=null;
  if(payload.attempt===true){
   if(!right.automatic&&!checkAvailable(state,{stat:'SOC'})&&!state._sourceCheck){missingCheck(state,{stat:'SOC',target:career.commission},'Education commission',command);return 'Pre-term commission requires source resolution for the absent characteristic.';}
   check=right.automatic?{automatic:true,success:true}:rulesCheck(state,{stat:'SOC',target:career.commission},rolls,'Education commission',right.modifier+(record.educationModifiers?.commission??0));
   record.pretermCommission=check;if(check.success){record.rank=1;record.highestRank=1;record.officer=true;}
  }
  finishCareerEntry(state,rolls);return check?'Pre-term education commission: '+JSON.stringify(check)+'.':'Declined the pre-term education commission opportunity.';
 }
 case 'career': {
  need(state.stage==='career'&&!state.failedQualification,'Choose a career at the start of a term.');
  const career=availableCareers(state).find(c=>c.id===payload.id);need(career&&!career.disabled,career?.reason??'This career is not available.');
  const assignment=career.assignments.find(a=>a.id===payload.assignment);need(assignment,'Choose an assignment.');need(!assignment.disabled,assignment.reason??'This assignment is unavailable.');
  const prerequisites=RULE_PACK[career.id]?.prerequisites??{};need(conditionMatches(state,prerequisites.assignments?.[assignment.id]),'This assignment has additional source prerequisites.');
  if(career.eligibility?.[assignment.id])need(state.character.gender===career.eligibility[assignment.id],'This assignment has a gender restriction.');
  if(career.id==='aslan.military'&&assignment.id==='support'&&state.character.gender==='male')need(stat(state,'SOC')<=8,'Male support assignment requires SOC 8 or less.');
  if(career.id==='core.psion'&&!state.character.psionics?.training.some(t=>t.completed)){startPsionicTraining(state,{context:'core-institute',source:{id:'core',page:228},next:'career',test:true,requiresTerms:true},rolls);return 'Complete psionic training before attempting Psion career entry.';}
  if(career.id==='zhodani.guard'&&assignment.id==='commando')need((state.character.stats.PSI??0)>=9,'Commando assignment requires PSI 9 or greater.');
  const educational=educationRights(state,career.id,assignment.id);
  if(educational.unresolved.length){const unresolved=educational.unresolved[0];if(unresolved.educationIndex!==undefined){sourceStep(state,'companion-career-rights',unresolved.source.id,unresolved.source.pages?.[0]??unresolved.source.page,unresolved.reason,'career');Object.assign(state.pending,{educationIndex:unresolved.educationIndex,career:career.id,assignment:assignment.id,citizenMapping:unresolved.citizenMapping});}else{sourceStep(state,'education-entry-rights','core',17,unresolved.reason,'career');state.pending.career=career.id;}return 'Education entry rights require source adjudication before qualification.';}
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
 case 'injury-loss':{
  need(state.stage==='injury-loss','No injury loss choice is pending.');const record=injuryRecord(state),index=integer(payload.index,0,record.options.length-1,'Injury loss choice'),option=record.options[index];record.selectedLossIndex=index;
  const after=copy(record.statsBefore);for(const effect of option.effects){need(effect.kind==='stat'&&INJURY_STATS.includes(effect.name),'Unsupported injury loss.');after[effect.name]+=effect.value;}record.rawAfter=copy(after);
  if(Object.values(after).some(value=>value<=0)){injurySource(state,'injury-zero','An injury would leave a physical characteristic at zero or below. Resolve survival and final untreated scores explicitly; no ageing-crisis or clamping rule is assumed.',{statsBefore:copy(record.statsBefore),rawAfter:copy(after)});return 'Injury loss selected; zero or negative characteristics require source resolution.';}
  commitInjuryLoss(state,after);return 'Injury loss selected: '+option.label+'.';
 }
 case 'injury-treatment':{
  need(state.stage==='injury-treatment','No injury treatment choice is pending.');const record=injuryRecord(state);need(plain(payload.restore),'Specify restoration points for this injury.');need(typeof payload.inService==='boolean','Record whether this injury happened in an organisation service.');
  need(Object.keys(payload.restore).every(name=>INJURY_STATS.includes(name)),'Restore only injured physical characteristics.');const restoration=Object.fromEntries(INJURY_STATS.map(name=>[name,integer(payload.restore[name]??0,0,record.losses[name],name+' restoration')]));const restoredPoints=Object.values(restoration).reduce((sum,n)=>sum+n,0);
  record.restoration=restoration;record.inService=payload.inService;
  let bill=medicalBill({careerId:record.careerId??undefined,rank:record.rank,restoredPoints,inService:payload.inService});
  if(bill.requiredRoll){const roll=dice(state,2,rolls,'Organisation medical contribution');bill=medicalBill({careerId:record.careerId??undefined,rank:record.rank,restoredPoints,inService:payload.inService,roll});}
  if(bill.needsAdjudication){record.medicalQuote=copy(bill);injurySource(state,'injury-medical',bill.reason+' Record the covered cost for the actual organisation; do not substitute another career.',{totalCost:bill.totalCost,restoration:copy(restoration)});return 'Treatment selected; employer contribution requires source resolution.';}
  finishInjuryTreatment(state,bill,rolls);return 'Injury treatment: '+restoredPoints+' restored points; cost Cr'+bill.totalCost+', organisation Cr'+bill.coveredCost+', deferred personal bill Cr'+bill.personalCost+'.';
 }
 case 'choose-effect': {
  need(state.stage==='effect-choice'&&state.pendingChoice,'There is no effect choice.');
  const option=state.pendingChoice.options[integer(payload.index,0,state.pendingChoice.options.length-1,'Choice')];if(state.pendingChoice.awardId)benefitAward(state,state.pendingChoice.awardId).decisions.push({type:'choice',index:payload.index,label:option.label});state.pendingChoice=null;state.effectsQueue.unshift(...copy(option.effects));drainEffects(state,rolls);return 'Chose '+option.label+'.';
 }
 case 'skill-award-source':{
  need(state.stage==='skill-choice'&&state.pendingChoice,'No skill award is pending.');const effect=copy(state.pendingChoice);state.pendingChoice=null;nativeFallback(state,effect,'Resolve this constrained or over-cap skill award explicitly. Record the chosen outcome without exceeding the total skill limit.');return 'Skill award paused for explicit source resolution.';
 }
 case 'retry-skill-choice':{
  need(state.stage==='book-step'&&state.pending?.kind==='native-effect'&&['skill-choice','skill-reduction-choice'].includes(state.pending.effect?.kind),'No skill choice can be retried.');state.pendingChoice=copy(state.pending.effect);state.pending=null;state.stage='skill-choice';return 'Returned to the pending skill choice without applying an award.';
 }
 case 'choose-skill': {
  need(state.stage==='skill-choice'&&state.pendingChoice,'There is no skill choice.');const e=state.pendingChoice,name=normalizeSkillName(text(payload.name,80),{requireSpeciality:e.mode!=='set'||(e.value??1)>0}).name;need(skillNameAllowed(state,name,e),'Skill is not available for this award.');
  if((e.mode!=='set'||(e.value??1)>0)&&SPECIALIZED.includes(name.split(' (')[0]))need(name.includes(' ('),'Choose a specialisation, for example Science (physics).');
  if(e.kind!=='skill-reduction-choice'&&skillAwardExceedsLimit(state,name,e.value??1,e.mode)){state.pendingChoice=null;nativeFallback(state,e,'The selected award would exceed the total skill limit. Choose another valid skill or record a source decision under Core p. 18.');return 'Over-cap skill choice requires an alternate selection or source resolution.';}
  if(e.kind==='skill-reduction-choice'){need(Object.hasOwn(state.character.skills,name)&&state.character.skills[name]>0,'Choose a trained skill to reduce.');if(e.names)need(e.names.includes(name),'Choose one of the indicated skills.');state.character.skills[name]=Math.max(0,state.character.skills[name]-e.value);}else gainSkill(state,name,e.value??1,e.mode);if(e.awardId)benefitAward(state,e.awardId).decisions.push({type:'skill',name,mode:e.mode,value:e.value??1});state.pendingChoice=null;if((e.count??1)>1)state.effectsQueue.unshift({...e,count:e.count-1});drainEffects(state,rolls);return 'Selected '+name+' for a skill award.';
 }
 case 'training': {
  need(state.stage==='training','No training roll is pending.');need(trainingOptions(state).some(x=>x.id===payload.table),'Training table is not available.');const pack=nativePack(state),{record,career}=currentCareer(state);const rows=payload.table==='assignment'?pack.training.assignments[record.assignment]:pack.training[payload.table];
  const tableModifier=payload.table==='assignment'?(pack.prerequisites.assignmentTableModifiers??[]).filter(m=>conditionMatches(state,m.condition)).reduce((n,m)=>n+m.dm,0):0;
  if(rows.length!==6&&rows.length!==9){sourceStep(state,'term-training',career.source,career.page,'Resolve the special training table.','survival');return 'Training table requires source resolution.';}
  const result=dice(state,1,rolls,'Training: '+payload.table)+tableModifier;queueEffects(state,markPsionicOrigin(rows[result-1],{careerId:career.id,assignment:record.assignment,table:payload.table,result}),state.trainingNext??'survival',rolls);state.trainingNext=null;return 'Training '+payload.table+' result '+result+'.';
 }
 case 'survival': {
  need(state.stage==='survival','Not at the survival check.');
  const {record,career,assignment}=currentCareer(state);
  if(!checkAvailable(state,assignment.survival)&&!state._sourceCheck){missingCheck(state,assignment.survival,'Survival',command);return 'Survival check requires source resolution for the absent characteristic.';}
  const check=rulesCheck(state,assignment.survival,rolls,'Survival',modifierTotal(state,'survival'));check.success&&=check.natural!==2;
  const pack=nativePack(state);
  if(!check.success){record.mishap=true;record.forcedExit=career.id!=='core.prisoner';const result=dice(state,1,rolls,'Mishap table');if(pack?.mishaps[result])queueEffects(state,pack.mishaps[result],career.id==='core.prisoner'?'advancement':'end-term',rolls);else sourceStep(state,'mishap',career.source,career.page+1,'Resolve mishap result '+result+'.','term-end');}
  else {const result=dice(state,2,rolls,'Event table');if(pack?.events[result])queueEffects(state,pack.events[result],'after-event',rolls);else sourceStep(state,'career-event',career.source,career.page+1,'Resolve career event result '+result+'.','advancement');}
  return 'Survival: '+JSON.stringify(check)+'.';
 }
 case 'advancement': {
  need(state.stage==='advancement','Not at advancement.');
  const {record,career,assignment}=currentCareer(state);
  if(!assignment.advancement){closeTerm(state);return 'This career has no conventional advancement roll.';}
  if(!checkAvailable(state,assignment.advancement)&&!state._sourceCheck&&!record.automaticPromotion){missingCheck(state,assignment.advancement,'Advancement',command);return 'Advancement check requires source resolution for the absent characteristic.';}
  const zhodaniAuto=career.group==='zhodani'&&(state.character.stats.SOC??0)>=10&&record.terms+1===(record.drafted?2:1);
  const check=record.automaticPromotion||zhodaniAuto?{natural:0,total:99,target:assignment.advancement.target,success:true,automatic:true}:rulesCheck(state,assignment.advancement,rolls,'Advancement',modifierTotal(state,'advancement')+(record.educationModifiers?.advancement??0)+(career.group==='zhodani'&&(state.character.stats.SOC??0)>=11?1:0));record.automaticPromotion=false;
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
  const availability=commissionAvailability(state);need(availability.available,availability.reason);const {record,career}=currentCareer(state);
  if(availability.sourceRequired){missingCheck(state,{stat:'SOC',target:career.commission},'Commission',command);return 'Commission check requires source resolution for the absent characteristic.';}record.commissionTried=true;
  const bonus=modifierTotal(state,'advancement',false)-record.terms+(record.educationModifiers?.commission??0);
  const check=record.automaticCommission||career.group==='zhodani'?{automatic:true,success:true,total:99}:rulesCheck(state,{stat:'SOC',target:career.commission},rolls,'Commission',bonus);
  if(check.success){modifierTotal(state,'advancement');record.highestRank=Math.max(record.highestRank??record.rank,record.rank,1);record.rank=1;record.officer=true;record.automaticCommission=false;queueEffects(state,rankEffects(state),'end-term',rolls);}
  return 'Commission: '+JSON.stringify(check)+(check.success?'. Became rank 1 officer; no advancement roll this term.':'. Advancement remains available.');
 }
 case 'leave-career': {
  const options=exitOptions(state),retire=payload.retire===true;need(retire?options.canRetire:options.canLeave,retire?options.retireReason:options.leaveReason);
  const {record,career}=currentCareer(state);
  if(retire){state.character.retirementFromCreation=true;state.character.retirementDecision={careerId:career.id,careerIndex:state.active,terms:record.terms,source:{id:'aliens',page:22},purpose:'Finish creation after benefits, without a career transfer.'};record.retiredFromCreation=true;}
  record.exit=record.forcedExit?'involuntary':'voluntary';
  const highest=record.highestRank??record.rank;const bonus=highest>=5?3:highest>=3?2:highest>=1?1:0;
  record.benefitRolls+=bonus;
  record.benefitDM=highest>=5?1:0;
  const pension=pensionEntitlement({careerId:career.id,terms:record.terms,soc:state.character.stats.SOC});record.pensionEntitlement=copy(pension);
  if(pension.needsAdjudication){sourceStep(state,'pension',pension.source.id,pension.source.page,pension.reason,'leave-career');state.pending.careerIndex=state.active;return 'Pension entitlement requires an explicit source decision before mustering out.';}
  record.pension=pension.annualCredits;record.pensionCondition=pension.condition;finishCareerExit(state);
  return 'Left '+career.name+' with '+record.benefitRolls+' benefit rolls.'+(retire?' Early retirement ends creation after these benefits; no career transfer.':'');
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
  if(pack){const origin={careerId:career.id,careerIndex:state.active,source:{id:career.source,page:career.page},tableContext:{careerId:career.id,table:cash?'cash':'material',modifier,natural:result-modifier,result}};state.benefitRollContext={...origin.tableContext,careerIndex:state.active,rolls:[{natural:result-modifier,modifier,result}]};queueEffects(state,cash?[{kind:'cash',value:pack.benefits.cash[index]*(state.character.species==='aslan'&&state.character.culture==='native'&&state.character.gender==='male'?0.5:1)}]:markBenefitOrigin(pack.benefits.material[index],origin),'benefit-complete',rolls);}else sourceStep(state,'benefit',career.source,career.page,'Resolve '+(cash?'cash':'material')+' benefit result '+result+'.','benefits');
  return 'Rolled '+(cash?'cash':'material')+' benefit '+result+' (DM '+modifier+').';
 }
 case 'resolve-book': {
  need(state.stage==='book-step'&&state.pending,'No source step to resolve.');
  need(payload.confirmed===true,'Confirm you checked the indicated source.');
  const pending=copy(state.pending);
    if(pending.kind==='benefit-equipment'){
    const note=text(payload.note??'',500);need(note,'Record the equipment source and restriction checks.');need(!(payload.effects??[]).length,'Equipment uses its typed selection fields, not generic effects.');
    const award=benefitAward(state,pending.awardId),name=text(payload.benefitItemName??'',120);need(name,'Choose an actual source-listed item.');
    const cost=integer(payload.benefitItemCost,0,pending.maximumCost??1000000000,'Item cost'),techLevel=integer(payload.benefitItemTL,0,pending.maximumTL??40,'Item technology level');let weaponSkill=null;
    if(pending.weaponSkillRequired){weaponSkill=normalizeSkillName(text(payload.benefitWeaponSkill??'',80),{requireSpeciality:true}).name;need(pending.weaponSkillOptions.includes(weaponSkill),'Choose the appropriate canonical skill for the received weapon.');}
    let replaced=null;if(pending.replaceOriginal){need(pending.replacementAssetIds.includes(payload.benefitReplaceAssetId),'Choose the original active armour asset to trade in.');replaced=state.character.assets.find(a=>a.id===payload.benefitReplaceAssetId);need(replaced?.active,'The original asset is no longer active.');replaced.active=false;state.character.benefits=state.character.benefits.filter(b=>b.assetId!==replaced.id);}
    const asset=benefitAsset(state,award,{type:'equipment',name,category:pending.category,ownership:'owned',owner:'Traveller',cost,techLevel,...(weaponSkill?{weaponSkill}:{}),sourceDecision:note,...(replaced?{replacesAssetId:replaced.id}:{})});
    award.decisions.push({type:'equipment',assetId:asset.id,note});state.pending=null;drainEffects(state,rolls);return 'Received '+name+' from '+award.name+' after source confirmation. '+note;
   }
   if(pending.kind==='benefit-ship'){
    const note=text(payload.note??'',500);need(note,'Record the ship source decision.');need(!(payload.effects??[]).length,'Ship awards use typed fields, not generic effects.');
    const award=benefitAward(state,pending.awardId),variant=payload.benefitShipVariant??(pending.variants.length===1?pending.variants[0]:null);need(pending.variants.includes(variant),'Select one of the source ship variants.');
    const history=text(payload.benefitShipHistory??'',2000);need(!pending.historyRollCount||history,'Record every required ship-history result and any age/discount ruling.');
    const asset=benefitAsset(state,award,{type:'ship',name:variant,ownership:pending.ownership,owner:pending.owner,recallable:pending.recallable,mortgagePaidPercent:pending.mortgagePaidPercent,history:{table:pending.historyTable,count:pending.historyRollCount,source:{id:'core',page:188},resolution:history},sourceDecision:note});
    award.decisions.push({type:'ship',assetId:asset.id,note,history});state.pending=null;drainEffects(state,rolls);return 'Received '+variant+' with '+(pending.mortgagePaidPercent===null?'source-defined use rights':pending.mortgagePaidPercent+'% mortgage paid')+'. '+note;
   }
   if(pending.kind==='benefit-source'){
    const note=text(payload.note??'',500);need(note,'Record the exact source ruling for this benefit.');const award=benefitAward(state,pending.awardId);
    if(pending.sainthood){need(typeof payload.benefitSainthoodSuccess==='boolean','Record the belief-specific sainthood check success or failure.');need(!(payload.effects??[]).length,'Sainthood uses its explicit check ruling, not generic effects.');const status=state.character.sainthood;status.checks.push({...copy(pending.sainthood),success:payload.benefitSainthoodSuccess,sourceAssisted:true,note,awardId:award.id});if(payload.benefitSainthoodSuccess)status.interactionDM=4;recordBenefitToken(state,award,status.interactionDM===4?'Living saint':'Sainthood candidacy',1,{nonnumeric:true,interactionDM:status.interactionDM});award.decisions.push({type:'sainthood',success:payload.benefitSainthoodSuccess,note});}
    else{
     need(['record','effects','none'].includes(payload.benefitResolution),'Choose record, effects or no award for the source outcome.');
     if(payload.benefitResolution==='record'){need(!(payload.effects??[]).length,'Use effects resolution when applying mechanical effects.');const name=text(payload.benefitOutcomeName??'',120);need(name,'Describe the actual source-resolved entitlement.');recordBenefitToken(state,award,name,award.quantity,{sourceAssisted:true,resolution:note});}
     else if(payload.benefitResolution==='effects'){need((payload.effects??[]).length>0,'Record the mechanical effects of the source decision.');applyEffects(state,payload.effects);}
     else{need(!(payload.effects??[]).length,'No-award resolution cannot also apply effects.');award.received=false;}
     award.decisions.push({type:payload.benefitResolution,note,outcome:payload.benefitOutcomeName??null,effects:copy(payload.effects??[])});
    }
    state.pending=null;drainEffects(state,rolls);return 'Source-resolved '+award.name+': '+note;
   }
   if(pending.kind==='pension'){
    const note=text(payload.note??'',500),condition=text(payload.pensionCondition??'',500);need(note&&condition,'Record the pension ruling and its payment conditions.');need(!(payload.effects??[]).length,'Pension entitlement is not immediate cash.');
    const record=state.character.careers[pending.careerIndex];need(record&&state.active===pending.careerIndex,'The pension career changed.');const annualCredits=integer(payload.pensionAnnualCredits,0,1000000000,'Annual pension');
    record.pension=annualCredits;record.pensionCondition=condition;record.pensionEntitlement={...record.pensionEntitlement,needsAdjudication:false,sourceAssisted:true,annualCredits,condition,note};state.pending=null;finishCareerExit(state);return 'Pension source ruling: Cr'+annualCredits+' annually. '+condition;
   }
if(pending.kind==='psionic-training-terms'){
    const note=text(payload.note??'',500);need(note,'Record the source ruling on access, costs and timing.');need(typeof payload.psionicApproved==='boolean','Record whether training is approved.');need(!(payload.effects??[]).length,'Use the explicit psionic funding fields, not generic effects.');
    const active=state.psionicTraining;need(active,'No training request is pending.');
    if(!payload.psionicApproved){psionicHistory(state).rulings.push({kind:pending.kind,approved:false,note});returnFromPsionics(state,rolls,false);return 'Psionic training declined. '+note;}
    need(payload.psionicTimingConfirmed===true,'Confirm how the testing and training time fits the source chronology.');
    const cost=integer(payload.psionicCost,0,10000000,'Psionic testing and training cost');need(['cash','provided'].includes(payload.psionicFunding),'Choose cash payment or source-provided training.');
    if(payload.psionicFunding==='cash'){need(cost>=pending.minimumCost&&(pending.testingNeeded||cost===100000),'Cash cost must meet the published minimum of Cr'+pending.minimumCost+'; tested training costs exactly Cr100000.');need(state.character.cash>=cost,'Available cash does not cover the psionic charges; no automatic debt is allowed.');}
    else need(cost===0,'Provided testing/training has zero personal cost; document who provides it in the source ruling.');
    const ruling={kind:pending.kind,approved:true,note,quotedCost:cost,cost,funding:payload.psionicFunding,timingConfirmed:true};psionicHistory(state).rulings.push(ruling);
    if(!Object.hasOwn(state.character.stats,'PSI')){const history=psionicHistory(state);history.historyKnown=!acquiredTalents(state).length;recordPsionicTest(state,active.context,dice(state,2,rolls,'Psionic potential'),completedCareerTerms(state));}
    if(payload.psionicFunding==='cash'){ruling.cost=(state.character.stats.PSI??0)>0?cost:pending.testingNeeded?cost-100000:0;state.character.cash-=ruling.cost;}
    state.pending=null;activatePsionicTraining(state,rolls);return 'Psionic access and timing approved; personal cost Cr'+ruling.cost+' ('+payload.psionicFunding+'). '+note;
   }
   if(pending.kind==='psionic-history'){
    const note=text(payload.note??'',500);need(note,'Record the source of the prior psionic check history.');need(!(payload.effects??[]).length,'History confirmation cannot grant skills or change characteristics.');
    const count=integer(payload.psionicPreviousChecks,0,1000,'Previous acquisition checks'),first=payload.psionicFirstTalentChosen,names=payload.psionicAttemptedTalents;
    need(typeof first==='boolean','Record whether a first talent has already been chosen.');need(Array.isArray(names)&&new Set(names).size===names.length&&names.every(n=>PSIONIC_TALENTS.includes(n)),'Record distinct canonical attempted talents.');
    need(first||count===0&&names.length===0,'First-talent history contradicts previous checks.');need(!first||names.length>0,'Record the previously chosen talent.');need(count>=names.filter(n=>n!=='Telepathy').length,'Previous checks cannot be fewer than the non-automatic attempted talents.');
    need(acquiredTalents(state).every(n=>names.includes(n)),'Include every acquired talent in its acquisition history.');
    need(count!==0||!first||names.length===1&&names[0]==='Telepathy'&&acquiredTalents(state).includes('Telepathy'),'Zero previous checks with a chosen talent requires acquired automatic Telepathy.');
    const history=psionicHistory(state);need(count>=history.checksAttempted&&(!history.firstTalentChosen||first)&&history.attempts.every(a=>names.includes(a.talent))&&history.importedAttempted.every(name=>names.includes(name)),'Existing native or imported acquisition history cannot be erased or reduced.');
    Object.assign(history,{historyKnown:true,checksAttempted:count,firstTalentChosen:first,importedAttempted:copy(names)});history.rulings.push({kind:pending.kind,note,previousChecks:count,firstTalentChosen:first,attemptedTalents:copy(names)});state.pending=null;activatePsionicTraining(state,rolls);return 'Prior psionic history recorded: '+count+' checks. '+note;
   }
   if(pending.kind==='psionic-repeat-training'){const note=text(payload.note??'',500);need(note,'Record the repeated-training source ruling.');applyEffects(state,payload.effects??[]);psionicHistory(state).rulings.push({kind:pending.kind,note});state.pending=null;returnFromPsionics(state,rolls,true);return 'Repeated psionic training resolved from source. '+note;}
   if(pending.kind==='psionic-retry'){
    const note=text(payload.note??'',500);need(note,'Record the source replacement for the unresolved talent award.');applyEffects(state,payload.effects??[]);state.pending=null;state.psionicTraining=null;drainEffects(state,rolls);return 'Source-assisted psionic replacement: '+note;
   }
  if(pending.kind==='injury-zero'){
   const record=injuryRecord(state),note=text(payload.note??'',500);need(note,'Record the injury survival and zero-score ruling.');need(typeof payload.injurySurvives==='boolean','Record whether the Traveller survives this injury.');record.zeroRuling={survives:payload.injurySurvives,note};
   need((payload.effects??[]).every(e=>e.kind!=='stat'),'Use the explicit injury-score fields for characteristic changes.');applyEffects(state,payload.effects??[]);state.pending=null;
   if(!payload.injurySurvives){record.completed=true;record.deceased=true;state.injury=null;state.character.deceased=true;state.effectsQueue=[];state.effectNext='deceased';state.stage='deceased';}
   else{need(plain(payload.injuryStats),'Record final untreated injury characteristics.');const after=copy(record.statsBefore);for(const name of INJURY_STATS){if(record.rawAfter[name]!==record.statsBefore[name])after[name]=integer(payload.injuryStats[name],0,record.statsBefore[name],name+' after injury');}record.zeroRuling.stats=copy(after);commitInjuryLoss(state,after);}
   return 'Source-assisted injury zero-score ruling: '+note+'.';
  }
  if(pending.kind==='injury-medical'){
   const record=injuryRecord(state),note=text(payload.note??'',500);need(note,'Record the organisation medical-contribution ruling.');need(!(payload.effects??[]).length,'Use the covered-cost field; restoration and billing are applied once by the engine.');
   const coveredCost=integer(payload.medicalCoveredCost,0,pending.totalCost,'Organisation covered cost'),quote=record.medicalQuote,bill={...quote,needsAdjudication:false,sourceAssisted:true,note,coveredCost,coveragePercent:pending.totalCost?100*coveredCost/pending.totalCost:0,personalCost:pending.totalCost-coveredCost};state.pending=null;finishInjuryTreatment(state,bill,rolls);return 'Source-assisted injury care: cost Cr'+bill.totalCost+', covered Cr'+coveredCost+', personal bill Cr'+bill.personalCost+'. '+note;
  }
  if(pending.kind==='ageing-financing'){
   const note=text(payload.note??'',500);need(note,'Record the ageing-care financing decision.');need(typeof payload.ageingCareApproved==='boolean','Record whether ageing-crisis care is funded.');need((payload.effects??[]).every(e=>['cash','debt'].includes(e.kind)),'Ageing financing accepts only explicit cash or debt effects.');
   const crisis=state.character.ageingCrises[pending.crisisIndex];crisis.financingNote=note;state.pending=null;
   if(payload.ageingCareApproved){applyEffects(state,payload.effects??[]);need(state.character.cash>=pending.cost,'The approved financing must provide enough available cash to pay the crisis cost.');payAgeingCare(state,{value:pending.cost,crisisIndex:pending.crisisIndex},rolls);drainEffects(state,rolls);}
   else{need(!(payload.effects??[]).length,'Do not add financing effects when care is refused.');Object.assign(crisis,{resolved:true,careAccepted:false,paid:0});state.effectsQueue=[{kind:'death',cause:'ageing',crisisIndex:pending.crisisIndex}];drainEffects(state,rolls);}
   return 'Source-assisted ageing financing: '+(payload.ageingCareApproved?'care paid':'care refused')+'. '+note;
  }
  if(pending.kind==='medical-settlement'){applyEffects(state,payload.effects??[]);need(state.character.cash>=0,'Resolve the negative cash balance before settling injury bills.');need(text(payload.note??'',500),'Record the balance correction.');state.pending=null;state.stage=postBenefitsStage(state);return 'Medical settlement balance resolved; finish the character to settle the outstanding bills.';}
  if(pending.kind==='missing-characteristic-check'){
   const note=text(payload.note??'',500);need(note,'Record the source ruling used for the absent characteristic.');need(!(payload.effects??[]).length,'Record only the check here; its consequences are resolved afterwards.');
   const natural=integer(payload.checkNatural,2,12,'Unmodified check roll'),total=integer(payload.checkTotal,-100,100,'Modified check total');
   state.pending=null;state.stage=pending.resumeStage;state._sourceCheck={label:pending.checkLabel,natural,total};
   if(pending.command)apply(state,pending.command,rolls);else drainEffects(state,rolls);delete state._sourceCheck;
   return 'Source-assisted '+pending.checkLabel+': natural '+natural+', total '+total+'. '+note;
  }
  if(pending.kind.startsWith('companion-')){
   if(['companion-psionic-testing','companion-entry','companion-career-rights'].includes(pending.kind))need(!(payload.effects??[]).length,'Use the source-decision fields for this step; do not add unrelated effects.');
   const note=text(payload.note??'',500);need(note,'Record the source decision and its reason.');
   if(pending.kind==='companion-psionic-testing'){
    const potential=integer(payload.psionicPotential,0,40,'Tested PSI');need(Array.isArray(payload.acquiredTalents)&&payload.acquiredTalents.length<=PSIONIC_TALENTS.length&&new Set(payload.acquiredTalents).size===payload.acquiredTalents.length&&payload.acquiredTalents.every(n=>PSIONIC_TALENTS.includes(n)),'Select only distinct acquired psionic talents.');
    need(potential>0||payload.acquiredTalents.length===0,'PSI zero cannot acquire talents.');setStat(state,'PSI',potential);
    for(const name of payload.acquiredTalents)gainSkill(state,name,0,'set',true);
    Object.assign(state.pendingEducation,{psionicTrainingComplete:true,acquiredTalents:copy(payload.acquiredTalents),trainingNote:note});
    state.character.psionicTraining={completed:true,talents:copy(payload.acquiredTalents),note};state.pending=null;state.stage='companion-admission';
   }else if(pending.kind==='companion-entry'){
    need(typeof payload.educationEntrySuccess==='boolean','Record whether entry was permitted.');
    state.educationAttemptTerms??=[];state.educationAttemptTerms.push(state.character.terms);state.pending=null;
    if(payload.educationEntrySuccess)startCompanionEducation(state,{id:pending.educationId,success:true,resolved:true,manual:true,note},rolls);else{state.pendingEducation=null;state.stage='career';}
   }else if(pending.kind==='companion-career-rights'){
    const record=state.character.educations[pending.educationIndex];record.rightsRulings??={};let ruling;
    if(pending.citizenMapping){need(typeof payload.citizenBranchApproved==='boolean','Record the Citizen branch decision.');ruling={citizenBranchApproved:payload.citizenBranchApproved,note};}
    else{need(typeof payload.educationAutomaticEntry==='boolean','Record the automatic-entry decision.');ruling={resolved:true,manual:true,qualificationModifier:integer(payload.qualificationModifier,-12,12,'Qualification modifier'),commissionModifier:integer(payload.commissionModifier,-12,12,'Commission modifier'),advancementModifier:integer(payload.advancementModifier,-12,12,'Advancement modifier'),automaticEntry:payload.educationAutomaticEntry,entryRank:null,effects:[],note};}
    record.rightsRulings[pending.career+'/'+pending.assignment]=ruling;state.pending=null;state.stage='career';
   }else if(pending.kind==='companion-timing'){
    const ageAfter=integer(payload.educationAgeAfter,0,1000,'Age after education');need(ageAfter>=state.character.age,'Education cannot reduce age.');const record=educationRecord(state);
    applyEffects(state,payload.effects??[]);state.pending=null;completeEducationTerm(state,record,{ageAfter,termDelta:1,manual:true,note});
   }else if(pending.kind==='companion-graduation'){
    need(typeof payload.graduated==='boolean'&&typeof payload.honours==='boolean','Record graduation and honours decisions.');need(!payload.honours||payload.graduated,'Honours requires graduation.');
    const record=educationRecord(state);record.graduation={id:record.id,resolved:true,manual:true,attempted:true,graduated:payload.graduated,honours:payload.honours,note};applyEffects(state,payload.effects??[]);state.pending=null;educationFinish(state,rolls);
   }else if(pending.kind==='companion-skill-choice'){
    need(Array.isArray(payload.educationSelections)&&payload.educationSelections.length>0&&payload.educationSelections.length<=10,'Record the adjudicated selected skills.');
    const names=payload.educationSelections.map(n=>normalizeSkillName(text(n,80)).name);need(names.every(n=>SKILLS.includes(n.split(' (')[0])),'Choose supported skill names.');
    educationRecord(state).selections[pending.choice.selectionId]=names;applyEffects(state,payload.effects??[]);state.pending=null;drainEffects(state,rolls);
   }else if(pending.kind==='companion-initial-awards'){
    applyEffects(state,payload.effects??[]);state.pending=null;state.stage='education-event';
   }else throw new Error('Unsupported Companion source decision.');
   return 'Source-assisted '+pending.kind+' confirmed. '+note+' Decisions: '+JSON.stringify(payload)+'.';
  }
  applyEffects(state,payload.effects??[]);let riteEffects=null;
  if(pending.kind==='education-entry-rights'){need(typeof payload.educationAutomaticEntry==='boolean','Record the referee decision on automatic entry.');state.educationEntryRulings??={};state.educationEntryRulings[pending.career]=payload.educationAutomaticEntry;}
  if(state.education!==undefined&&state.education!==null&&pending.kind==='native-effect'){
   if(payload.educationNoGraduation===true)educationRecord(state).graduationAllowed=false;

   if(payload.educationNextCareer){need(CAREERS.some(c=>c.id===payload.educationNextCareer),'Unknown required career.');state.forcedCareer=payload.educationNextCareer;if(state.forcedCareer==='core.prisoner')state.character.sentenced=true;}
  }
  if(pending.kind==='species-setup'){
   if(state.character.species==='aslan'){
    const result=dice(state,2,rolls,'Rite of Passage');state.character.stats.RITE=['STR','DEX','END','INT','EDU','SOC'].filter(key=>stat(state,key)>result).length;
    const riteDice=rolls.at(-1).values;if(riteDice[0]===riteDice[1])riteEffects=sourcedEffects(EXPANSION_TABLES['aslan.rite-doubles'].results[result],{id:'aliens',page:21});
    state.character.birthOrder=text(payload.birthOrder??'',30);
   }
  }
  state.pending=null;if(riteEffects)queueEffects(state,riteEffects,'background',rolls);else advanceAfterBook(state,pending,payload,rolls);
  return 'Source-assisted '+pending.kind+' confirmed. '+text(payload.note??'',500)+' Effects: '+JSON.stringify(payload.effects??[])+'.';
 }
 case 'connection': {
  need(['career','term-end','retirement','finish'].includes(state.stage),'Add connections between terms or at completion.');
  need(state.connections.length<2,'At most two connections award skills.');
  const person=text(payload.person,80);need(person&&!state.connections.some(c=>c.person.toLowerCase()===person.toLowerCase()),'Use a different Traveller for each connection.');
  const skill=text(payload.skill,80);need(skill!=='Jack-of-all-Trades','Connections cannot award Jack-of-all-Trades.');
  need((state.character.skills[skill]??0)<3,'A connection cannot increase a skill above level 3.');
  gainSkill(state,skill,1);state.connections.push({person,skill,note:text(payload.note??'',300)});return 'Connection with '+person+': '+skill+' gained.';
 }
 case 'add-extra': {
  need(state.stage!=='identity'&&state.stage!=='statistics','Accept the six characteristics first.');
  const extra=EXTRA_STATS.find(e=>e.id===payload.id);need(extra,'Choose an available characteristic.');need(!Object.hasOwn(state.character.stats,extra.id),'This characteristic already exists.');
  if(extra.id==='PSI')need(state.config.gm,'Raw PSI generation requires referee permission in GM mode; institute testing uses the psionic-training source step.');
  const value=extra.derive?(state.character.stats[extra.derive]??0):dice(state,extra.dice,rolls,extra.id);
  state.character.stats[extra.id]=extra.id==='PSI'?Math.max(0,value-completedCareerTerms(state)):value;
   if(extra.id==='PSI')recordPsionicTest(state,'referee-potential',value,completedCareerTerms(state));
  state.config.extras.push(extra.id);return 'Added '+extra.name+' '+state.character.stats[extra.id]+'. '+extra.source+(extra.id==='PSI'?'; testing reduced by completed career terms. Potential does not grant training or talents.':'.');
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
  if(field.startsWith('stat.')){const key=field.slice(5);need(!(state.character.species==='aezorgh'&&key==='CHA'),'Aezorgh CHA is derived from SOC; change SOC instead.');need(/^[A-Z][A-Z0-9]{1,7}$/.test(key),'Invalid characteristic code.');old=state.character.stats[key];setStat(state,key,integer(payload.value,0,40,'Characteristic'));}
  else if(field==='age'){old=state.character.age;state.character.age=integer(payload.value,0,500,'Age');}
  else if(field==='cash'||field==='debt'){old=state.character[field];state.character[field]=integer(payload.value,0,100000000,'Amount');}
  else if(field==='pool'){
   need(state.stage==='statistics'&&state.pool.length===6,'Roll statistics first.');const index=integer(payload.index,0,5,'Pool index');old=state.pool[index].base;state.pool[index].base=integer(payload.value,1,18,'Base score');state.rollTotal=state.pool.reduce((n,p)=>n+p.base,0);
  }else throw new Error('That field cannot be overridden.');
  return 'GM override '+field+(field==='pool'?'['+payload.index+']':'')+': '+String(old??'absent')+' → '+payload.value+'. Reason: '+reason;
 }
 case 'finish':{need(!state.forcedCareer,'Resolve the required next career before finishing.');need(['career','retirement'].includes(state.stage)&&state.active===null,'Finish between careers after resolving benefits.');const settlement=settleInjuryBills(state);if(settlement===false)return 'Outstanding injury bills await source resolution of the cash balance.';state.stage='finish';return 'Finished source-assisted character. Unautomated stages remain listed in the record.'+(settlement?' Injury bills: paid Cr'+settlement.paid+', remaining medical debt Cr'+settlement.debt+'.':'');}
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
  log.push({number:i+1,id:event.id,type:event.command.type,summary,rolls,changes:characterChanges(snapshots[i].character,state.character)});snapshots.push(copy(state));
 }
 state.commissionAvailability=commissionAvailability(state);state.exitOptions=exitOptions(state);state.followingInteractionDM=followingInteractionDM(state.character.stats.FOL);
 state.currentBenefitAward=state.pending?.awardId?copy(benefitAward(state,state.pending.awardId)):null;
 state.currentInjury=state.injury!==undefined&&state.injury!==null?copy(injuryRecord(state)):null;
 state.injuryOptions=state.stage==='injury-loss'?copy(injuryRecord(state).options):[];
 state.injuryRestorable=state.stage==='injury-treatment'?copy(injuryRecord(state).losses):{};
 state.medicalOutstanding=(state.character.medicalBills??[]).filter(b=>!b.settled).reduce((sum,b)=>sum+b.personalCost,0);
 state.psionicOptions=state.stage==='psionic-training'?psionicOptions(state):[];
  state.psionicCanFinish=state.stage==='psionic-training'&&state.psionicTraining?.mode==='initial';
  state.canStartPsionicTraining=['career','precareer'].includes(state.stage)&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation&&(!Object.hasOwn(state.character.stats,'PSI')||state.character.stats.PSI>0)&&!state.character.psionics?.training.some(t=>t.completed);
  state.trainingOptions=state.stage==='training'?trainingOptions(state):[];
 state.educationOptions=['education-skill','companion-skill'].includes(state.stage)?educationOptions(state,state.pendingChoice):[];
 state.educationCheckSkills=state.stage==='education-check'?learnedEducationSkills(state):[];
 state.canChooseEducation=state.stage==='career'&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation&&state.character.terms<3&&!state.educationAttemptTerms?.includes(state.character.terms);
 if(state.character.species==='aezorgh'&&Object.hasOwn(state.character.stats,'SOC'))state.character.stats.CHA=Math.floor(state.character.stats.SOC/2);
 state.backgroundOptions=backgroundOptions(state);state.cashLimit=cashLimit(state);
 state.careerChoices=availableCareers(state);state.statDMs=Object.fromEntries(Object.entries(state.character.stats).map(([k,v])=>[k,k==='RITE'?v:characteristicDM(v)]));
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
export function catalog() {return {apiVersion:API_VERSION,sources:SOURCES,sourceDiscrepancies:SOURCE_DISCREPANCIES,species:SPECIES,careers:CAREERS,precareers:PRECAREERS,companionEducation:PRECAREER_RULES,extraStats:EXTRA_STATS,skills:SKILLS,skillSpecialities:SPECIALITIES,backgroundSkills:BACKGROUND_SKILLS};}
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
