// Original pure mechanics: Aliens of Charted Space Volume 1 Update 2026, p.242.
// Ordinary checks: Core Rulebook Update 2022, pp.9,58-59,229. Term length: p.11.
// No session/UI changes, random generator, source prose, or private source locations.
import {PSIONIC_TALENTS} from './skills.mjs';
import {findCareer} from './catalog.mjs';

export const PSIONIC_GAMES_VERSION=1;
export const PSIONIC_GAMES_SOURCE=Object.freeze({
 id:'aliens',title:'Aliens of Charted Space Volume 1 Update 2026',pages:Object.freeze([242])
});
export const PSIONIC_GAMES_CHECK_SOURCE=Object.freeze({
 id:'core',title:'Core Rulebook Update 2022',pages:Object.freeze([9,58,59,229])
});
export const PSIONIC_GAMES_RULES=Object.freeze({
 lifetimeApplications:1,requiredSocialClass:'intendant',applicationTarget:10,
 preliminaryTarget:8,finalTarget:12,preliminarySuccessDM:1,preliminaryFailureDM:-1,
 preliminaryMajorityPSI:1,finalVictoryPSI:2,winnerSOCMinimum:11,
 newCareer:false,ordinarySurvival:false,ordinaryAdvancement:false,skillGains:false
});
const clone=value=>structuredClone(value);
const procedure=name=>'psionic-games.'+name;
function result(name,extra={}){
 return {procedure:procedure(name),version:PSIONIC_GAMES_VERSION,source:clone(PSIONIC_GAMES_SOURCE),
  resolved:true,needsAdjudication:false,missingInputs:[],unresolved:[],effects:[],audit:[],...extra};
}
function missing(name,fields,extra={}){
 return result(name,{...extra,resolved:false,missingInputs:[...new Set(fields)],effects:[]});
}
function integer(value,min,max,label){
 if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(label+' must be an integer from '+min+' to '+max+'.');
 return value;
}
function numberInput(value,label,min,max,fields){
 if(value===undefined){fields.push(label);return undefined;}
 return integer(value,min,max,label);
}
function coreDM(score){return score===0?-3:score<3?-2:score<6?-1:score<9?0:score<12?1:score<15?2:3;}
function diceInput(value,label,fields){
 if(value===undefined){fields.push(label);return null;}
 if(!Array.isArray(value)||value.length!==2)throw new TypeError(label+' requires exactly two D6 results.');
 return value.map(n=>integer(n,1,6,label));
}
function check({phase,dice,psi,target,talent,skill=0,competitionModifier=0}){
 const natural=dice[0]+dice[1],psiDM=coreDM(psi),modifier=psiDM+skill+competitionModifier,total=natural+modifier;
 return {sequence:1,phase,...(talent?{talent}:{}),dice:[...dice],natural,psi,psiDM,skill,
  competitionModifier,modifier,total,target,effect:total-target,success:total>=target,dmMode:'core-standard'};
}
function ordered(entries){return entries.map((entry,index)=>({...clone(entry),sequence:index+1}));}
function contextInput({socialClass,previousApplications,currentCareerId},fields){
 if(socialClass===undefined)fields.push('socialClass');
 else if(!['prole','intendant','noble'].includes(socialClass))throw new TypeError('socialClass must be prole, intendant, or noble.');
 numberInput(previousApplications,'previousApplications',0,1000,fields);
 if(currentCareerId===undefined)fields.push('currentCareerId');
 else if(currentCareerId!==null&&(typeof currentCareerId!=='string'||!findCareer(currentCareerId)))throw new TypeError('Unknown current career.');
 return {socialClass,previousApplications,currentCareerId};
}
function termFor(currentCareerId){
 return {currentCareerId,careerTerms:1,years:4,countsInExistingCareer:true,newCareer:false,
  ordinarySurvival:false,ordinaryAdvancement:false,ordinaryTraining:false,skillGains:false,
  ordinaryEvents:'requires-explicit-decision',source:clone(PSIONIC_GAMES_SOURCE),
  durationSource:{id:'core',title:'Core Rulebook Update 2022',pages:[11]}};
}

/** socialClass is an explicit Consular status, not a class inferred from a non-Zhodani SOC.
 * currentCareerId:null means no active career. Lifetime history must include failed applications.
 */
export function psionicGamesEligibility(input={}){
 const fields=[],context=contextInput(input,fields);
 if(fields.length)return missing('eligibility',fields,{eligible:null});
 const reasons=[];
 if(context.socialClass!=='intendant')reasons.push('intendant-status-required');
 if(context.previousApplications>=1)reasons.push('lifetime-application-used');
 if(context.currentCareerId===null)reasons.push('active-career-required');
 return result('eligibility',{...context,eligible:reasons.length===0,reasons,applicationsRemaining:context.previousApplications>=1?0:1});
}

/** Resolving an eligible application consumes the lifetime application even on failure.
 * No term is advanced here. A successful result reserves one replacement term for Competition.
 */
export function psionicGamesApplication(input={}){
 const eligibility=psionicGamesEligibility(input);
 if(!eligibility.resolved)return missing('application',eligibility.missingInputs,{attempted:false,success:null,termDelta:0});
 const context={socialClass:eligibility.socialClass,previousApplications:eligibility.previousApplications,currentCareerId:eligibility.currentCareerId};
 if(!eligibility.eligible)return result('application',{input:context,eligible:false,reasons:eligibility.reasons,
  attempted:false,success:false,applicationsAdded:0,applicationsAfter:eligibility.previousApplications,
  termDelta:0,competitionRequired:false,replacementTerm:null});
 const fields=[],psi=numberInput(input.psi,'psi',0,40,fields),dice=diceInput(input.dice,'dice',fields);
 if(fields.length)return missing('application',fields,{eligible:true,attempted:false,success:null,termDelta:0});
 const rolled=check({phase:'application',dice,psi,target:10});
 return result('application',{input:{...context,psi,dice:[...dice]},eligible:true,attempted:true,success:rolled.success,
  applicationsAdded:1,applicationsAfter:eligibility.previousApplications+1,termDelta:0,
  competitionRequired:rolled.success,replacementTerm:rolled.success?termFor(eligibility.currentCareerId):null,
  checkSource:clone(PSIONIC_GAMES_CHECK_SOURCE),audit:[rolled]});
}
function possessed(skills,fields){
 if(skills===undefined){fields.push('skills');return [];}
 if(!skills||typeof skills!=='object'||Array.isArray(skills))throw new TypeError('skills must be a skill-level map.');
 const talents=[];
 for(const name of PSIONIC_TALENTS){
  if(!Object.hasOwn(skills,name))continue;
  const level=integer(skills[name],-1,4,'Skill level for '+name);
  if(level>=0)talents.push({talent:name,level});
 }
 return talents;
}

/** Supply one ordered roll per possessed talent, including level zero. No untrained attempts.
 * Negative-one talent entries are explicitly untrained and are excluded. Other skills are ignored.
 */
export function psionicGamesPreliminaries({psi,skills,rolls}={}){
 const fields=[];numberInput(psi,'psi',0,40,fields);
 const talents=possessed(skills,fields);
 if(rolls===undefined)fields.push('rolls');
 else if(!Array.isArray(rolls))throw new TypeError('rolls must be an ordered array of {talent,dice}.');
 if(fields.length)return missing('preliminaries',fields);
 const seen=new Set(),inputs=[];
 for(const [index,row] of rolls.entries()){
  if(!row||typeof row!=='object'||!talents.some(t=>t.talent===row.talent))throw new TypeError('Preliminary rolls require an actually possessed talent.');
  if(seen.has(row.talent))throw new TypeError('Each possessed talent is checked exactly once.');
  seen.add(row.talent);
  const dice=diceInput(row.dice,'rolls['+index+'].dice',fields);
  if(dice)inputs.push({talent:row.talent,dice});
 }
 for(const {talent} of talents)if(!seen.has(talent))fields.push('rolls.'+talent);
 if(fields.length)return missing('preliminaries',fields,{possessedTalents:clone(talents)});
 const audit=ordered(inputs.map(row=>check({phase:'preliminary',talent:row.talent,dice:row.dice,psi,target:8,skill:talents.find(t=>t.talent===row.talent).level})));
 const successes=audit.filter(r=>r.success).length,failures=audit.length-successes;
 return result('preliminaries',{input:{psi,skills:Object.fromEntries(talents.map(t=>[t.talent,t.level])),rolls:clone(inputs)},
  psi,possessedTalents:clone(talents),successes,failures,competitionModifier:successes-failures,
  majoritySuccessful:successes>failures,checkSource:clone(PSIONIC_GAMES_CHECK_SOURCE),audit});
}
function requireResult(value,name){
 if(!value||value.procedure!==procedure(name)||value.version!==PSIONIC_GAMES_VERSION)throw new TypeError('Use the '+name+' helper result.');
}
function sameFields(actual,expected,keys,label){
 for(const key of keys)if(JSON.stringify(actual[key])!==JSON.stringify(expected[key]))throw new TypeError(label+' result contradicts its recorded inputs: '+key+'.');
}
function verifyPreliminaries(value){
 requireResult(value,'preliminaries');
 if(!value.resolved)throw new TypeError('Preliminary checks are incomplete.');
 const verified=psionicGamesPreliminaries(value.input);
 sameFields(value,verified,['resolved','psi','possessedTalents','successes','failures','competitionModifier','majoritySuccessful','audit'],'Preliminary');
 return verified;
}

/** This is a PSI-only final check; no talent level is added. */
export function psionicGamesFinal({preliminaries,dice}={}){
 if(preliminaries===undefined)return missing('final',['preliminaries']);
 requireResult(preliminaries,'preliminaries');
 if(!preliminaries.resolved)return missing('final',['resolved preliminaries']);
 const p=verifyPreliminaries(preliminaries),fields=[],values=diceInput(dice,'dice',fields);
 if(fields.length)return missing('final',fields);
 const rolled=check({phase:'final',dice:values,psi:p.psi,target:12,competitionModifier:p.competitionModifier});
 return result('final',{psi:p.psi,dice:[...values],preliminaryAudit:clone(p.audit),
  won:rolled.success,total:rolled.total,competitionModifier:p.competitionModifier,
  checkSource:clone(PSIONIC_GAMES_CHECK_SOURCE),audit:[rolled]});
}
function verifyFinal(value,preliminaries){
 requireResult(value,'final');
 if(!value.resolved)throw new TypeError('Final competition is incomplete.');
 const verified=psionicGamesFinal({preliminaries,dice:value.dice});
 sameFields(value,verified,['resolved','psi','preliminaryAudit','won','total','competitionModifier','audit'],'Final');
 return verified;
}
function decision(value,key,allowed){
 if(value===undefined)return null;
 if(!value||typeof value!=='object'||!allowed.includes(value.mode))throw new TypeError('Invalid '+key+' decision.');
 if(typeof value.reason!=='string'||!value.reason.trim()||value.reason.length>500)throw new TypeError(key+' requires a recorded reason.');
 return {key,mode:value.mode,reason:value.reason.trim()};
}

/** No implicit interpretation of simultaneous preliminary and winner PSI awards.
 * stacking.mode: additive OR winner-replaces-preliminary; a recorded reason is required.
 * Delta effects defer characteristic ceilings to the caller's normal species rules.
 */
export function psionicGamesAwards({preliminaries,final,stacking}={}){
 const fields=[];
 if(preliminaries===undefined)fields.push('preliminaries');
 if(final===undefined)fields.push('final');
 if(fields.length)return missing('awards',fields);
 requireResult(preliminaries,'preliminaries');requireResult(final,'final');
 if(!preliminaries.resolved)fields.push('resolved preliminaries');
 if(!final.resolved)fields.push('resolved final');
 if(fields.length)return missing('awards',fields);
 const p=verifyPreliminaries(preliminaries),f=verifyFinal(final,p);
 const preliminaryPSI=p.majoritySuccessful?1:0,victoryPSI=f.won?2:0;
 const knownAwards={preliminaryPSI,victoryPSI,becomesNoble:f.won,SOCMinimum:f.won?11:null};
 const ruling=decision(stacking,'awardStacking',['additive','winner-replaces-preliminary']);
 if(preliminaryPSI&&victoryPSI&&!ruling)return result('awards',{
  resolved:false,needsAdjudication:true,knownAwards,psiDelta:null,
  unresolved:[{key:'awardStacking',options:['additive','winner-replaces-preliminary'],candidates:{additive:3,'winner-replaces-preliminary':2},source:clone(PSIONIC_GAMES_SOURCE)}]
 });
 const psiDelta=preliminaryPSI&&victoryPSI&&ruling.mode==='winner-replaces-preliminary'?victoryPSI:preliminaryPSI+victoryPSI;
 const effects=[...(psiDelta?[{kind:'stat',name:'PSI',value:psiDelta}]:[]),
  ...(f.won?[{kind:'stat',name:'SOC',mode:'minimum',value:11}]:[])];
 return result('awards',{knownAwards,psiDelta,effects,decisions:ruling?[ruling]:[]});
}
function verifyApplication(application){
 requireResult(application,'application');
 if(!application.resolved)throw new TypeError('Application is unresolved.');
 const verified=psionicGamesApplication(application.input);
 sameFields(application,verified,['resolved','eligible','attempted','success','applicationsAdded','applicationsAfter','termDelta','competitionRequired','replacementTerm','audit'],'Application');
 return verified;
}

/** Compose a successful application's checks without creating a new career.
 * ordinaryEvents.mode must explicitly be omit or resolved-externally, with a reason.
 * resolved-externally records adjudication; this helper never rolls or executes an ordinary event.
 * Neither choice relaxes the source prohibition on skill gains, survival or advancement.
 * Apply effects and termDelta only when resolved:true AND entered:true; pending dice/rulings
 * must not erase the already recorded lifetime application.
 */
export function psionicGamesCompetition({application,skills,preliminaryRolls,finalDice,decisions={}}={}){
 if(application===undefined)return missing('competition',['application'],{entered:null,completed:false,termDelta:0});
 requireResult(application,'application');
 if(!application.resolved)return missing('competition',['resolved application'],{entered:null,completed:false,termDelta:0});
 const a=verifyApplication(application);
 if(!a.success)return result('competition',{entered:false,completed:false,termDelta:0,applicationsAfter:a.applicationsAfter,
  ordinaryCareerTermAvailable:true,audit:clone(a.audit),reason:a.attempted?'application-failed':'ineligible'});
 if(!decisions||typeof decisions!=='object'||Array.isArray(decisions))throw new TypeError('decisions must be an object.');
 const pending={entered:true,completed:false,termDelta:0,applicationsAfter:a.applicationsAfter,pendingReplacementTerm:clone(a.replacementTerm)};
 const p=psionicGamesPreliminaries({psi:a.input.psi,skills,rolls:preliminaryRolls});
 if(!p.resolved)return missing('competition',p.missingInputs.map(x=>x.replace(/^rolls/,'preliminaryRolls')),{...pending,audit:clone(a.audit),pendingStage:'preliminaries'});
 const f=psionicGamesFinal({preliminaries:p,dice:finalDice});
 if(!f.resolved)return missing('competition',f.missingInputs.map(x=>x==='dice'?'finalDice':x),{...pending,audit:ordered([...a.audit,...p.audit]),pendingStage:'final'});
 const awards=psionicGamesAwards({preliminaries:p,final:f,stacking:decisions.awardStacking});
 const eventDecision=decision(decisions.ordinaryEvents,'ordinaryEventHandling',['omit','resolved-externally']);
 const unresolved=[...awards.unresolved,...(!eventDecision?[{key:'ordinaryEventHandling',options:['omit','resolved-externally'],source:clone(PSIONIC_GAMES_SOURCE)}]:[])];
 const audit=ordered([...a.audit,...p.audit,...f.audit]);
 const decisionAudit=[...(eventDecision?[eventDecision]:[]),...(awards.decisions??[])];
 if(unresolved.length)return result('competition',{...pending,resolved:false,needsAdjudication:true,unresolved,
  preliminary:{successes:p.successes,failures:p.failures,competitionModifier:p.competitionModifier},
  finalWon:f.won,knownAwards:awards.knownAwards,psiDelta:awards.psiDelta,decisions:decisionAudit,audit});
 return result('competition',{entered:true,completed:true,applicationsAfter:a.applicationsAfter,termDelta:1,years:4,
  replacementTerm:{...clone(a.replacementTerm),ordinaryEvents:eventDecision.mode},
  preliminary:{successes:p.successes,failures:p.failures,competitionModifier:p.competitionModifier},
  finalWon:f.won,knownAwards:awards.knownAwards,psiDelta:awards.psiDelta,effects:clone(awards.effects),
  decisions:decisionAudit,audit});
}
