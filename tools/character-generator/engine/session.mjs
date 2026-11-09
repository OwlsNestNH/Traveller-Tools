import {culturalSkillAward,culturalAwardLabel,ASLAN_CULTURAL_SKILL_SOURCE,aslanSkillLabel,ASLAN_SKILL_LEGEND} from './aslan-skill-culture.mjs';
import {believerBuyoutPlan,believerBuyoutChoice} from './believer-buyout.mjs';
import {prisonerEscapePending} from './prisoner-escape.mjs';
import {decorateLifeEventPresentation} from './life-event-projection.mjs';
import {trainingInformation} from './training-information.mjs';
import {BENEFIT_WAGERS,wagerLimit,wagerDelta} from './benefit-wagers.mjs';
import { vargrTrainingChoice, tableSkillAllowed } from './vargr-training.mjs';
import { CORE_LIFE_SOURCE, CORE_LIFE_TABLES, lifeNarrativeOptions, lifePsionAccess } from './core-life-events.mjs';
import { assertReleaseRequest, releaseResult } from './release-scope.mjs';
import { ASLAN_ACCESS_RULES, ASLAN_ACCESS_CONFLICT_CHOICES, aslanAccessInput, createAslanAccess, aslanAccessExpiry, aslanAccessConflictInput, aslanCashAccountPlan } from './aslan-access.mjs';
import { ASLAN_LAND_LIMITS, aslanLandRules, aslanLandPlan, aslanLandTiming, aslanLandResolution } from './aslan-land.mjs';
import { CLAN_SHARE_ASSET_RULES, clanShareAssets } from './clan-share-assets.mjs';
import { CLAN_SHARE_SOURCE, clanShareExchange, clanShareLotInvariant } from './clan-shares.mjs';
import { ASLAN_FAMILY_BANDS, aslanFamilyBand, aslanFamilyResult, aslanBirthOrder, aslanEstateOptions, aslanEstate, aslanOriginReason, aslanClanResult, aslanPrideResult } from './aslan-origin.mjs';
import { createAslanOutlawRestoration, aslanOutlawRestorationDecision, aslanOutlawRestorationOutcome } from './aslan-outlaw-restoration.mjs';
import { createAslanRestoration, aslanRestorationDecision, aslanRestorationAvailability, aslanRestorationExpiry } from './aslan-restoration.mjs';
import { createAslanOfficerOffer, aslanOfficerExpiry, aslanOfficerEligibility, ASLAN_OFFICER_RANK_OPTIONS, aslanOfficerRankEffects, aslanSpaceOfficerRankMapping, aslanClanShareTokens } from './aslan-officers.mjs';
import { ASSIGNMENT_SOURCE, CORE_ASSIGNMENT_MODES, nobleAutomaticQualification, careerReentryPlan, assignmentChangePlan } from './assignment-changes.mjs';
import { ADVISORY_SOURCE, advisoryCashPlan } from './cross-career-procedures.mjs';
import { relationshipLossOptions, relationshipLoss, distinctScienceSelection } from './zhodani-choices.mjs';
import { MERCHANT_FINE_SOURCE, merchantFineRoll, merchantFineOptions, merchantFineOutcome } from './merchant-fine.mjs';
import { ZHODANI_REEDUCATION_SOURCE,reeducationRoll,reeducationPlan,treatmentTimeline,zhodaniStatusPlan,REEDUCATION_EXPLICIT_DISCHARGE } from './zhodani-reeducation.mjs';
import { careerTransferRule, createCareerTransfer, careerTransferEntry, careerTransferExpiry } from './career-transfers.mjs';
import { PSIONIC_GAMES_SOURCE, psionicGamesEligibility, psionicGamesApplication, psionicGamesPreliminaries, psionicGamesFinal, psionicGamesCompetition } from './psionic-games.mjs';
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
export const RULES_REVISION='character-preview-2026-11-09.18';
// .18 corrects career events and defers unspecified awards; .16/.17 preserve historical mechanics.
export const COMPATIBLE_RULES_REVISIONS=Object.freeze([RULES_REVISION,'character-preview-2026-11-09.17','character-preview-2026-11-09.16']);
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
 return {version:API_VERSION,rng:hash(seed),stage:'identity',config:{boons:0,minimumReroll:true,allocation:true,extras:[],gm:false,zhodaniPsi:false,aezorghTwoDice:false},
 character:{name:'',species:'human',culture:'native',gender:'',homeworld:'',age:18,terms:0,stats:{},skills:{},traits:[],careers:[],relationships:[],benefits:[],cash:0,debt:0,notes:''},
 pool:[],rollTotal:null,backgroundRemaining:0,active:null,pending:null,failedQualification:false,draftUsed:false,cashRolls:0,connections:[],coverage:[],lastRoll:null};
}
function die(state) { let t=state.rng+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);state.rng>>>=0;return Math.floor(((t^t>>>14)>>>0)/4294967296*6)+1; }
function dice(state,n,rolls,label,boon=false) {
 const randomValues=Array.from({length:n+(boon?1:0)},()=>die(state));
 const replay=state._override,prefix=replay?.preserved?.[rolls.length],selected=replay?.index===rolls.length;
 if(prefix)need(prefix.label===label&&prefix.values.length===randomValues.length,'The preserved roll identity or dice count changed before the selected replay roll.');
 if(selected&&replay.target)need(replay.target.label===label&&replay.target.values.length===randomValues.length,'The selected replay roll identity or dice count changed.');
 const forced=selected?replay.values:prefix?.values;
 if(forced)need(Array.isArray(forced)&&forced.length===randomValues.length&&forced.every(x=>Number.isInteger(x)&&x>=1&&x<=6),'Replacement dice must match the original dice count and each be 1-6.');
 const values=forced?[...forced]:randomValues;
 const kept=boon?[...values].sort((a,b)=>b-a).slice(0,n):values;
 const total=kept.reduce((a,b)=>a+b,0);
 const entry={label,values,kept,total};rolls.push(entry);state.lastRoll=entry;return total;
}
function stat(state,key) { need(Object.hasOwn(state.character.stats,key),'Characteristic '+key+' is not present.');return state.character.stats[key]; }
// User-selected generation options, not additional published species rules.
function statisticsRerollThreshold(state) { return state.character.species==='aezorgh'&&!state.config.aezorghTwoDice?30:43; }
function statisticsCanReroll(state) { return state.stage==='statistics'&&state.pool.length===6&&!!(state.config.gm||state.config.minimumReroll&&state.rollTotal<statisticsRerollThreshold(state)); }
function refreshStatisticsPool(state) {
 for(const p of state.pool){p.divisor=state.character.species==='aezorgh'&&state.config.aezorghTwoDice&&p.formulaCount===1?2:1;p.derivedBase=Math.floor(p.base/p.divisor);p.value=Math.max(1,p.derivedBase+p.adjustment);}
 state.rollTotal=state.pool.reduce((sum,p)=>sum+p.base,0);
}
function statisticsDivisionSummary(state) {
 return state.character.species==='aezorgh'&&state.config.aezorghTwoDice?' Optional Aezorgh placement (round down before species bonuses): '+state.pool.map(p=>p.key+' raw '+p.base+'/'+p.divisor+' = '+p.derivedBase+', species '+(p.adjustment>=0?'+':'')+p.adjustment).join('; ')+'.':'';
}
function maxStat(state,key) { return findSpecies(state.character.species).maxima?.[key]??15; }
function setStat(state,key,value) { integer(value,0,40,'Characteristic'); state.character.stats[key]=value;if(state.character.species==='aezorgh'&&key==='SOC')state.character.stats.CHA=Math.floor(value/2); }
// Unspecified awards remain individually allocatable, preserving minimum-level awards.
function pendingSpecializations(state,base){return (state.character.deferredSkillAwards??[]).filter(a=>a.status==='pending'&&(!base||(Array.isArray(base)?base.includes(a.name):a.name===base)));}
function deferSkillAward(state,e){const awards=state.character.deferredSkillAwards??=[];const award={...copy(e),id:'specialization-'+(awards.length+1),name:e.name,count:1,value:e.value??1,mode:e.mode??'increase',status:'pending',age:state.character.age,term:state.character.terms};awards.push(award);return award;}
function deferrableChoice(state,e){return !!state.deferredSpecializations&&!e.allocationId&&e.kind!=='skill-reduction-choice'&&!e.distinctSpecialties&&!e.permittedNames&&['any','assignment','eligible-career',undefined].includes(e.scope);}
function allocationEffects(state,base){return pendingSpecializations(state,base).map(a=>({...copy(a),kind:'skill-choice',scope:'any',allowed:[a.name],allocationId:a.id,deferSpeciality:false,label:'Allocate '+a.name+' award: '+(a.mode==='set'?'gain at least level ':'increase by ')+a.value}));}
function requireAllocationsBefore(state,e,base){const effects=allocationEffects(state,base);if(!effects.length)return false;if(e.kind==='skill'&&e.name.includes(' ('))for(const effect of effects)effect.followingFixedAward=copy(e);state.effectsQueue.unshift(...effects,e);return true;}
function specializationOptions(state){return {available:!!state.deferredSpecializations&&pendingSpecializations(state).length>0&&!state.pendingChoice&&!state.pending&&!state.effectsQueue?.length&&['career','precareer','training','survival','advancement','term-end','benefits','retirement','finish'].includes(state.stage),count:pendingSpecializations(state).length};}
function normalizedSkill(state,name,options={}){return normalizeSkillName(name,{...options,canonicalOpen:!!state.deferredSpecializations});}
function allocationImproves(state,name,e){name=normalizedSkill(state,name).name;const old=state.character.skills[name]??0,next=e.mode==='set'?Math.max(old,e.value):Math.min(4,old+e.value),fixed=e.followingFixedAward;if(e.maximum&&next>e.maximum||e.followingConnection===name&&next>=3)return false;if(fixed?.name&&normalizedSkill(state,fixed.name).name===name){const after=n=>fixed.mode==='set'?Math.max(n,fixed.value):Math.min(4,n+fixed.value);return after(next)>after(old);}return next>old;}
function independenceAcquired(state,name,rolls){
 if(!state.deferredSpecializations||name!=='Independence')return true;
 need(state.character.species==='aslan'&&state.character.gender==='male','Independence is available only to male Aslan.');
 return dice(state,2,rolls,'Independence acquisition')>stat(state,'SOC');
}
function gainSkill(state,name,level,mode='increase',allowTalentAcquisition=false) {
 need(typeof name==='string'&&name.length<=80,'Invalid skill.');
 const parsed=normalizedSkill(state,name,{requireSpeciality:mode!=='set'||level>0});name=parsed.name;const base=parsed.base;need(SKILLS.includes(base),'Choose a supported skill or specialisation.');need(!PSIONIC_TALENTS.includes(base)||!state.character.psionicLoss,'Ageing permanently removed psionic ability; historical talents cannot be increased or reacquired.');
 if(PSIONIC_TALENTS.includes(base)&&!Object.hasOwn(state.character.skills,name))need(allowTalentAcquisition&&(state.character.stats.PSI??0)>0,'Psionic talents require testing and explicit acquisition before improvement.');
 if(mode==='set'&&level===0&&SPECIALIZED.includes(base)&&base!=='Profession')name=base;
 const current=state.character.skills[name];
 const next=mode==='set'?Math.max(current??-1,integer(level,0,4,'Skill level')):Math.min(4,current===undefined?1:current+integer(level,1,4,'Skill gain'));
 const total=Object.values(state.character.skills).reduce((a,b)=>a+b,0)-(current??0)+Math.max(next,0);
 need(total<=3*((state.character.stats.INT??0)+(state.character.stats.EDU??0))||Math.max(next,0)<=Math.max(current??0,0),'Total skill limit exceeded.');
 state.character.skills[name]=Math.min(4,next);
}
function skillAwardExceedsLimit(state,name,level,mode='increase') {
 const parsed=normalizedSkill(state,name,{requireSpeciality:mode!=='set'||level>0});
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
 const canContinue=!record.forcedExit&&!accessMandatory(state),continueReason=canContinue?'':accessMandatory(state)?'Resolve the accepted expedition for the following term.':'This career must be left.';
 const blocked=record.forcedStay?'A natural 12 requires another term.':career.id==='core.prisoner'&&!record.released?'Prisoners must pass the parole threshold or escape before leaving.':null;
 if(blocked)return {...none,leaveReason:blocked,retireReason:blocked,canContinue,continueReason};
 const earlyAslan=career.group==='aslan'&&!['aslan.outcast','aslan.outlaw'].includes(career.id)&&!record.forcedExit&&record.terms<3;
 if(earlyAslan&&!(state._aslanOfficerExit&&state._aslanOfficerExit===activeAslanOfficerOffer(state)?.id))return {canLeave:false,leaveReason:'This Aslan career requires three terms before transfer. Early retirement ends character creation.',canRetire:!state.forcedCareer,retireReason:state.forcedCareer?'Resolve the required next career before retiring.':'Early retirement ends creation after benefits; it does not permit a different career.',retirementRequired:true,canContinue,continueReason};
 return {canLeave:true,leaveReason:'',canRetire:false,retireReason:'Leave normally, then finish creation after resolving benefits.',retirementRequired:false,canContinue,continueReason};
}
const forcedDraftPending=state=>!!state.correctedCareerEvents&&state.forcedCareer==='draft'&&state.forcedDraft?.status==='pending';
const postBenefitsStage=state=>state.character.retirementFromCreation?'retirement':forcedDraftPending(state)?'failed-entry':'career';
const rankBenefitRolls=record=>{const highest=record.highestRank??record.rank;return highest>=5?3:highest>=3?2:highest>=1?1:0;};








function nativeAslan(state){return state.character.species==='aslan'&&state.character.culture==='native';}
function accessRights(state){return state.character.aslanCareerAccess??[];}
function accessMandatory(state){return accessRights(state).find(r=>r.mandatory&&['offered','activated'].includes(r.status));}
function accessContext(state){const c=state.character.aslanCareerContext;return nativeAslan(state)&&c&&['active','established'].includes(c.status)?c:null;}
function accessCoreAllowed(state,id){const c=accessContext(state);return c&&id.startsWith('core.')&&(!c.careerIds||c.careerIds.includes(id));}
function accessForAttempt(state,id){return accessRights(state).find(r=>r.status==='activated'&&r.availableAtCompletedTerms===state.character.terms&&(!r.careerIds||r.careerIds.includes(id))&&id.startsWith('core.'));}
function refreshAslanAccess(state){
 for(const r of accessRights(state)){
  if(r.boundaryAge===null&&state.character.terms===r.availableAtCompletedTerms)r.boundaryAge=state.character.age;
  const expiry=aslanAccessExpiry({right:r,completedTerms:state.character.terms,careerCount:state.character.careers.length,educationCount:state.character.educations?.length??0,age:state.character.age,deceased:state.character.deceased,retired:state.character.retirementFromCreation||state.stage==='finish'});
  if(expiry){r.status='expired';r.expiry=expiry;if(state.character.aslanCareerContext?.accessId===r.id&&state.character.aslanCareerContext.status==='active')state.character.aslanCareerContext.status='expired';}
 }
}
function aslanAccessOptions(state){
 if(!nativeAslan(state))return [];
 const mandatory=accessMandatory(state),blocked=state.active!==null?'Finish the original career, ageing and benefits first.':state.pending||state.effectsQueue?.length?'Finish the pending procedure first.':state.character.deceased||state.character.retirementFromCreation?'Creation has ended.':state.forcedCareer?'Resolve the specifically required next career.':!['career','failed-entry'].includes(state.stage)?'Choose an outward route only at a career boundary.':'';
 const options=accessRights(state).filter(r=>['offered','activated'].includes(r.status)).map(r=>({...copy(r),id:r.id,available:r.status==='offered'&&!blocked&&state.stage==='career'&&state.character.terms===r.availableAtCompletedTerms,reason:blocked||(r.status==='activated'?'This route is already activated.':state.character.terms!==r.availableAtCompletedTerms?'This route applies only in the following term.':''),requiresDestination:true}));
 if(!mandatory&&!accessContext(state)){
  const route=state.stage==='failed-entry'&&state.failedQualificationContext?.group==='aslan'?'outside-failed-entry':aslanOfficerHistory(state).length?'outside-history':state.character.outcast?'outside-outcast':null;
  if(route){const rule=ASLAN_ACCESS_RULES[route];options.push({id:route,route,...copy(rule),source:{id:'aliens',page:22},available:!blocked,reason:blocked,requiresDestination:true});}
 }
 return options;
}
function grantAslanAccess(state,e){const {record,career}=currentCareer(state);state.character.aslanCareerAccess??=[];state.character.aslanCareerAccess.push(createAslanAccess({id:'aslan-access-'+(state.character.aslanCareerAccess.length+1),route:e.route,careerIndex:state.active,careerId:career.id,assignment:record.assignment,completedTerms:state.character.terms,careerCount:state.character.careers.length,educationCount:state.character.educations?.length??0}));}
function outwardCoreCareer(state,career){return nativeAslan(state)&&career.group==='core'&&!!accessContext(state);}
function finishOptions(state){const reason=accessMandatory(state)?'Resolve the accepted expedition before finishing.':state.forcedCareer?'Resolve the required next career before finishing.':!['career','retirement'].includes(state.stage)||state.active!==null?'Finish between careers after resolving benefits.':'';return {available:!reason,reason};}
function fallbackOptions(state){
 if(forcedDraftPending(state)){const available=state.stage==='failed-entry'&&state.active===null;return {forced:true,normal:{name:'Ordinary career choice',available:false,reason:'The Drifter event requires the Core draft next term.'},draft:{name:'Roll the required Core draft',available,reason:available?'':'Finish this career and its benefits before the forced draft.'}};}
 const ready=state.stage==='failed-entry',native=state.character.culture==='native',species=state.character.species,coreFailure=nativeAslan(state)&&state.failedQualificationContext?.group==='core'&&!!accessContext(state),departure=nativeAslan(state)&&state.failedQualificationContext?.group==='aslan'&&accessForAttempt(state,'core.drifter')?.route==='outside-failed-entry';
 const careerId=coreFailure||departure?'core.drifter':native&&species==='aslan'?'aslan.outcast':native&&species==='vargr'?'vargr.loner':'core.drifter';
 const sourceDraft=species==='zhodani',draftAllowed=ready&&!state.draftUsed&&!sourceDraft&&(coreFailure&&!accessContext(state).careerIds||!['aslan','vargr'].includes(species)||!native);
 return {normal:{name:sourceDraft?'Resolve Consular draft':'Enter '+findCareer(careerId).name,available:ready,reason:ready?'':'No failed qualification is pending.',careerId:sourceDraft?null:careerId},draft:{name:'Apply to the Core draft',available:draftAllowed,reason:!ready?'No failed qualification is pending.':state.draftUsed?'The ordinary draft has already been used.':!draftAllowed?'This source fallback does not authorize a new Core draft.':''}};
}
function accessConflictProjection(state){const r=accessMandatory(state),record=r?state.character.careers[r.originCareerIndex]:null;return r&&state.stage==='term-end'&&state.active===r.originCareerIndex&&record?.forcedStay?{accessId:r.id,careerIndex:r.originCareerIndex,source:[{id:'aliens',page:41},{id:'core',page:19}],reason:'The accepted expedition requires a different next career, while natural 12 requires another term here.',requiresGM:true,reasonMaxLength:500,choices:copy(ASLAN_ACCESS_CONFLICT_CHOICES)}:null;}
function expireAslanAccessBoundary(state,reason){for(const r of accessRights(state))if(['offered','activated'].includes(r.status)&&r.availableAtCompletedTerms===state.character.terms){r.status='expired';r.expiry={reason,completedTerms:state.character.terms,age:state.character.age};if(state.character.aslanCareerContext?.accessId===r.id&&state.character.aslanCareerContext.status==='active')state.character.aslanCareerContext.status='expired';}}
function initializeAslanCashAccounts(state){if(state.character.cashRollAccounts)return;state.character.cashRollAccounts=aslanCashAccountPlan({total:state.cashRolls,history:state.character.benefitRollHistory??[]});}
function cashRollAccount(state){return state.character.cashRollAccounts?(state.active!==null&&currentCareer(state).career.group==='core'?'core':'aslan'):null;}
function cashRollsUsed(state){const account=cashRollAccount(state);return account?state.character.cashRollAccounts[account]:state.cashRolls;}


function activeAslanOfficerOffer(state){return state.aslanOfficerOffer==null?null:state.character.aslanOfficerOffers?.[state.aslanOfficerOffer];}
function aslanOfficerHistory(state){return state.character.careers.flatMap((r,i)=>['aslan.outcast','aslan.outlaw'].includes(r.id)?[i]:[]);}
function aslanOfficerOptions(state){
 return (state.character.aslanOfficerOffers??[]).filter(o=>o.status==='offered').map(o=>{
  const origin=state.character.careers[o.originCareerIndex],prior=aslanOfficerHistory(state),verified=o.statusVerification?.approved===true;
  const plan=aslanOfficerEligibility({offer:o,stage:state.stage,completedTerms:state.character.terms,activeCareerIndex:state.active,originCareer:origin,careerCount:state.character.careers.length,outcast:!!state.character.outcast&&!prior.length&&!verified,forcedCareer:state.forcedCareer,retired:!!state.character.retirementFromCreation,qualificationBanned:!!state.character.qualificationBanned});
  const career=findCareer(o.targetCareerId),pre=RULE_PACK[career.id].prerequisites;
  const assignments=career.assignments.map(a=>{const permitted=conditionMatches(state,pre.assignments?.[a.id])&&[a.survival,a.advancement].every(c=>checkAvailable(state,c));return {id:a.id,name:a.name,available:permitted,reason:permitted?'':'The target assignment prerequisites are not met.',sourceRequired:career.id==='aslan.space-officer'&&a.id!=='commander'&&!state.correctedCareerEvents};});
  return {id:o.id,targetCareerId:o.targetCareerId,targetName:career.name,source:copy(o.source),...plan,sourceRequired:prior.length>0&&!verified,assignments};
 });
}
function currentAslanOfficerProjection(state){
 const pending=state.pending?.kind==='aslan-officer-status'?state.character.aslanOfficerOffers?.find(o=>o.id===state.pending.offerId):null;
 const o=activeAslanOfficerOffer(state)??pending??state.character.aslanOfficerOffers?.at(-1);if(!o)return null;
 const cancelOptions=state.stage==='aslan-officer-entry'&&o.status==='ready'?[...(o.commitment?.mode==='ordinary-exit'?[{id:'career-choice',name:'Choose another career'}]:[]),...(!state.forcedCareer?[{id:'retire',name:'Finish creation after benefits'}]:[])]:[];
 return {...copy(o),targetName:findCareer(o.targetCareerId).name,cancelOptions,rankOptions:state.stage==='aslan-officer-rank'&&state.pendingAslanOfficerRank?.offerId===o.id?copy(ASLAN_OFFICER_RANK_OPTIONS):[]};
}
function refreshAslanOfficerOffers(state){
 const active=activeAslanOfficerOffer(state);
 if(active){
  if(state.character.deceased){active.status='deceased';state.aslanOfficerOffer=null;}
  else if(active.check&&!active.check.success){active.status='failed';state.aslanOfficerOffer=null;}
  else if(state.character.careers[active.originCareerIndex+1]?.aslanOfficerOfferId===active.id){active.status='entered';active.newCareerIndex=active.originCareerIndex+1;state.aslanOfficerOffer=null;}
  else if(state.stage==='career'&&state.active===null){active.status='ready';state.stage='aslan-officer-entry';}
 }
 for(const o of state.character.aslanOfficerOffers??[]){const expiry=aslanOfficerExpiry({offer:o,completedTerms:state.character.terms,careerCount:state.character.careers.length,deceased:!!state.character.deceased});if(expiry){o.status=expiry.status;o.expired=expiry;}}
}
function expireAslanOfficerBoundary(state,reason){
 for(const o of state.character.aslanOfficerOffers??[])if(o.status==='offered'&&state.character.terms===o.availableAtCompletedTerms){o.status='expired';o.expired={reason,completedTerms:state.character.terms};}
}
function grantAslanOfficerOffer(state,e){
 const {career,record}=currentCareer(state);need(state.character.species==='aslan'&&state.character.culture==='native','This offer requires native Aslan generation.');
 state.character.aslanOfficerOffers??=[];state.character.aslanOfficerOffers.push(createAslanOfficerOffer({id:'aslan-officer-'+(state.character.aslanOfficerOffers.length+1),originCareerId:career.id,originCareerIndex:state.active,originAssignment:record.assignment,eventResult:e.eventResult,targetCareerId:e.career,completedTerms:state.character.terms,originCareerTerms:record.terms}));
}
function addRelationship(state,role,name,extra={}){
 state.character.relationshipSequence=(state.character.relationshipSequence??0)+1;
 const relationship={id:'relationship-'+state.character.relationshipSequence,role,name,...copy(extra)};state.character.relationships.push(relationship);return relationship;
}
function originShareClan(state){
 const origin=state.character.aslanOrigin?.clan;if(!origin)return null;state.character.clanShareClans??=[];
 let clan=state.character.clanShareClans.find(c=>c.id==='origin-clan');if(!clan){clan={id:'origin-clan',name:origin.name||origin.type+' clan (origin)',provenance:'origin',source:{id:'aliens',page:18}};state.character.clanShareClans.push(clan);}return clan.id;
}
function syncClanShareTokens(state){
 state.character.benefits=state.character.benefits.filter(b=>!aslanClanShareTokens([b]).length);
 const quantity=(state.character.clanShareLots??[]).reduce((sum,l)=>sum+l.available,0);
 if(quantity)state.character.benefits.push({name:'Clan Share',quantity,definitionId:'aslan.clan-share',redemption:'recorded-lots'});
}
function addClanShareLot(state,quantity,award=null){
 integer(quantity,1,1000000,'Clan Shares');state.character.clanShareLots??=[];
 const originClan=originShareClan(state),careerId=award?.origin?.careerId,source=award?.origin?.source;
 const clanKnown=award&&originClan&&((careerId?.startsWith('aslan.')&&!['aslan.outcast','aslan.outlaw'].includes(careerId))||!careerId&&source?.id==='aliens'&&(source.page===21||source.pages?.includes(21)));
 const lot={id:'clan-lot-'+(state.character.clanShareLots.length+1),awardId:award?.id??null,awarded:quantity,available:quantity,spent:0,forfeited:0,source:copy(award?.source??{id:'aliens',page:47}),origin:copy(award?.origin??null),clanId:clanKnown?originClan:null,provenance:award?'source':'unverified',redemptionIds:[],forfeitureIds:[]};state.character.clanShareLots.push(lot);if(award)award.clanShareLotIds=[...(award.clanShareLotIds??[]),lot.id];syncClanShareTokens(state);
 if(state.character.species==='aslan'&&state.character.culture==='native'&&state.character.outcast)forfeitAslanClanShares(state,'native-clan-share-award',{id:'aliens',page:22});return lot;
}
function clanShareCheckpoint(state,{convertedClaim=false}={}){
 if(state.character.species!=='aslan'||state.character.culture!=='native')return 'This bounded exchange uses native Aslan rules.';
 if(state.character.deceased)return 'A deceased Traveller cannot redeem shares.';
 if(state.character.outcast&&!convertedClaim)return 'Current Outcast standing forfeits unconverted Clan Shares.';
 if(!['precareer','career','term-end','retirement','finish'].includes(state.stage))return 'Finish the current rule procedure before exchanging shares.';
 if(state.pending||state.pendingChoice||state.effectsQueue?.length||state.effectNext||state.character.aslanOrigin?.status==='pending'||activeAslanOfficerOffer(state)||gamesPending(state)||activeReeducation(state)||activeMerchantFine(state)||advisoryRecord(state)||state.psionicTraining||state.character.reeducations?.some(r=>r.status==='deferred'))return 'A reserved rule continuation must finish before exchanging shares.';
 return '';
}
function clanShareOptions(state){
 const reason=clanShareCheckpoint(state),clans=copy(state.character.clanShareClans??[]),clanName=id=>clans.find(c=>c.id===id)?.name??'Issuing clan unverified';
 const lots=(state.character.clanShareLots??[]).filter(l=>l.available>0).map(l=>{const sourceVerified=l.provenance!=='unverified'&&(!l.awardId||state.character.benefitAwards?.find(a=>a.id===l.awardId)?.status==='resolved'),clanVerified=!!l.clanId;return {...copy(l),label:'Clan Shares / '+l.id,clanName:clanName(l.clanId),sourceVerified,clanVerified,cashShipAvailable:!reason&&sourceVerified,favourAvailable:!reason&&sourceVerified&&clanVerified,availableForRedemption:sourceVerified,verificationRequired:!sourceVerified,needsClanVerification:!clanVerified,canVerify:!reason&&state.config.gm&&(!sourceVerified||!clanVerified),reason:!sourceVerified?'Verify that this is a genuine Clan Share award.':!clanVerified?'Clan identity is needed only for clan favours.':''};});
 const balance=lots.reduce((sum,l)=>sum+l.available,0),redeemableBalance=lots.filter(l=>l.sourceVerified).reduce((sum,l)=>sum+l.available,0),ids=lots.filter(l=>l.cashShipAvailable).map(l=>l.id),favourIds=lots.filter(l=>l.favourAvailable).map(l=>l.id);
 const contacts=state.character.relationships.filter(r=>r.role==='Contact').map(r=>{const verified=r.clanFavour?.upperEchelon===true;return {id:r.id,name:r.name,role:r.role,clanId:r.clanFavour?.clanId??null,clanName:clanName(r.clanFavour?.clanId),upperEchelon:verified,verificationRequired:!verified,canVerify:!reason&&state.config.gm&&!r.clanFavour,eligibleLotIds:verified?lots.filter(l=>l.favourAvailable&&l.clanId===r.clanFavour.clanId).map(l=>l.id):[]};});
 const allyIds=[...new Set(contacts.flatMap(c=>c.eligibleLotIds))],landRules=aslanLandRules(state.character.stats.SOC),landReason=reason||(!landRules.eligibleSOC?'Land requires current SOC 9 or higher.':redeemableBalance<3?'At least three genuine shares are required.':landRules.requiresParcelRuling&&!state.config.gm?'Enable GM mode for the unprinted-SOC parcel ruling.':'');
 return {available:!reason&&redeemableBalance>0,checkpointAvailable:!reason,checkpointReason:reason,reason:reason||(!balance?'No unspent Clan Shares.':!redeemableBalance?'Verify the source of an available lot.':''),balance,redeemableBalance,lots,clans,choices:[{id:'cash',name:'Cash',available:state.character.gender==='female'&&ids.length>0,reason:state.character.gender!=='female'?'Male redemption grants art or weapons, not cash.':reason||(!ids.length?'No verified shares.':''),lotIds:state.character.gender==='female'?ids:[]},{id:'ship-shares',name:'Ship Shares',available:ids.length>0,reason:reason||(!ids.length?'No verified shares.':''),lotIds:ids},{id:'contact',name:'Clan Contact',available:favourIds.length>0,reason:reason||(!favourIds.length?'Verify an issuing clan before spending its favour.':''),lotIds:favourIds},{id:'ally',name:'Upgrade clan Contact',available:allyIds.length>0,reason:reason||(!allyIds.length?'No verified Contact matches an available share clan.':''),lotIds:allyIds},...(state.character.gender==='male'?[{id:'art',name:'Art holding',available:ids.length>0,reason:reason||(!ids.length?'No verified shares.':''),lotIds:ids},{id:'weapons',name:'Weapons',available:ids.length>0&&state.config.gm,reason:reason||(!ids.length?'No verified shares.':!state.config.gm?'Enable GM mode for referee-confirmed weapon sources.':''),lotIds:ids},{id:'land',name:'Pending land claim',available:!landReason,reason:landReason,lotIds:ids,minimumShares:3}]:[])],contacts,assetRules:state.character.gender==='male'?copy(CLAN_SHARE_ASSET_RULES):null,landRules:state.character.gender==='male'?landRules:null};
}
function landClaimOptions(state){
 const checkpointReason=clanShareCheckpoint(state,{convertedClaim:true});
 const claims=(state.character.landClaims??[]).map(c=>{const mature=state.character.age>=c.eligibleAge,reason=checkpointReason||(c.status!=='pending'?'This claim is already resolved.':!mature?'The recorded delay has not elapsed.':!state.config.gm?'Enable GM mode to confirm an actually established claim.':''),independence=skillLevel(state,'Independence');return {...copy(c),mature,remainingYears:Math.max(0,c.eligibleAge-state.character.age),available:!reason,reason,modes:[{id:'personal-return',name:'Personal return',available:!reason,reason},{id:'relative-administration',name:'Relative administration',available:!reason&&independence>=3,reason:reason||(independence<3?'Independence 3 or higher is required.':'')}],currentOutcast:!!state.character.outcast};});
 return {checkpointAvailable:!checkpointReason,checkpointReason,rules:copy(ASLAN_LAND_LIMITS),claims};
}
function shareReason(value){const reason=text(value??'',500);need(reason,'Record the source verification reason.');return reason;}

function forfeitAslanClanShares(state,cause,source,setOutcast=false){
 const removed=aslanClanShareTokens(state.character.benefits),before=state.character.stats.SOC,outcastBefore=!!state.character.outcast;
 if(setOutcast){if(setOutcast===true)state.character.stats.SOC=2;state.character.outcast=true;}
 if(!removed.length&&(!setOutcast||setOutcast==='preserve-SOC'&&outcastBefore))return null;
 state.character.aslanStatusChanges??=[];const id='aslan-status-'+(state.character.aslanStatusChanges.length+1),awardIds=[];
 state.character.benefits=state.character.benefits.filter(b=>!removed.some(r=>JSON.stringify(r)===JSON.stringify(b)));
 const forfeitures=[];for(const lot of state.character.clanShareLots??[])if(lot.available>0){const quantity=lot.available;lot.available=0;lot.forfeited+=quantity;lot.forfeitureIds.push(id);clanShareLotInvariant(lot);forfeitures.push({lotId:lot.id,awardId:lot.awardId,quantity});if(lot.awardId){const a=benefitAward(state,lot.awardId);a.forfeitedQuantity=(a.forfeitedQuantity??0)+quantity;a.forfeited=a.forfeitedQuantity===a.quantity;if(a.forfeited)a.received=false;a.forfeitureIds=[...(a.forfeitureIds??[]),id];if(!awardIds.includes(a.id))awardIds.push(a.id);}}
 // Preserve explicit source-assisted tokens without inventing provenance for them.
 for(const a of state.character.benefitAwards??[])if(removed.length&&a.definitionId==='aslan.clan-share'&&!a.clanShareLotIds?.length&&!a.forfeited){a.forfeited=true;a.received=false;a.forfeitureIds=[...(a.forfeitureIds??[]),id];awardIds.push(a.id);}
 const change={id,cause,source:copy(source),careerIndex:state.active??activeAslanOfficerOffer(state)?.originCareerIndex??null,generationTerms:state.character.terms,age:state.character.age,socBefore:before,socAfter:state.character.stats.SOC,outcastBefore,outcastAfter:!!state.character.outcast,removed,awardIds,forfeitures};
 state.character.aslanStatusChanges.push(change);return change;
}

function beginAslanOrigin(state){
 const identityGender=state.character.gender;
 state.character.aslanOrigin={source:{id:'aliens',pages:[15,16,17,18,20,21]},status:'pending',initialStats:copy(state.character.stats),familySOC:stat(state,'SOC'),statPool:copy(state.pool),identityGender,gender:['male','female'].includes(identityGender)?{mode:'selected',value:identityGender}:null,family:null,birthOrder:null,estate:null,clan:null,pride:null,rite:null,background:null,decisions:[]};
 state.stage='aslan-family';
 if(identityGender&&!['male','female'].includes(identityGender))originSource(state,'gender','Choose the source mechanical gender branch without changing the recorded identity.',16);
}
function originSource(state,decision,label,page){sourceStep(state,'aslan-origin-source','aliens',page,label,'aslan-family');state.pending.decision=decision;}
function currentAslanOrigin(state){
 const o=state.character.aslanOrigin;if(!o)return null;const decision=state.pending?.kind==='aslan-origin-source'?state.pending.decision:null;
 const options=decision==='family-band'?copy(ASLAN_FAMILY_BANDS):decision==='female-independence'?[{id:'omit',name:'Omit this award by referee ruling'},{id:'grant-level-zero',name:'Grant level 0 by referee exception'}]:decision==='gender'?[{id:'male',name:'Male source rules'},{id:'female',name:'Female source rules'}]:[];
 return {...copy(o),estateOptions:aslanEstateOptions(o.familySOC),canRollGender:state.stage==='aslan-family'&&!o.identityGender&&!o.gender&&!o.family,sourceDecision:decision?{kind:decision,options}:null};
}
function finishAslanFamily(state){
 const o=state.character.aslanOrigin;o.family.status='completed';o.family.awardsAfter=copy(state.character.skills);
 if(state.character.gender==='male')state.stage='aslan-birth-order';else {o.birthOrder=aslanBirthOrder({gender:'female'});state.character.birthOrder=o.birthOrder.id;state.stage='aslan-estate';}
}

function currentAslanOutlawRestoration(state){const id=state.pending?.kind==='aslan-outlaw-restoration'?state.pending.restorationId:null;return (id?state.character.aslanOutlawRestorations?.find(r=>r.id===id):null)??state.character.aslanOutlawRestorations?.at(-1)??null;}
function beginAslanOutlawRestoration(state){
 const {record,career}=currentCareer(state);state.character.aslanOutlawRestorations??=[];
 const r=createAslanOutlawRestoration({id:'aslan-outlaw-restoration-'+(state.character.aslanOutlawRestorations.length+1),careerId:career.id,careerIndex:state.active,assignment:record.assignment,careerTerms:record.terms,completedTerms:state.character.terms,gender:state.character.gender,soc:state.character.stats.SOC,outcast:state.character.outcast,forcedExit:record.forcedExit,forcedStay:record.forcedStay});
 state.character.aslanOutlawRestorations.push(r);sourceStep(state,'aslan-outlaw-restoration','aliens',43,'Resolve the source-earned restoration using verified SOC or current marriage eligibility.','native-resume');state.pending.restorationId=r.id;
}
function refreshAslanOutlawRestorations(state){
 for(const r of state.character.aslanOutlawRestorations??[]){
  if(!['awaiting-departure','mustering-out'].includes(r.status))continue;
  if(state.character.deceased){r.status='deceased';r.departure={...r.departure,completed:false,endedBy:'death'};continue;}
  const c=state.character.careers[r.originCareerIndex];
  if(c?.exit){r.status=c.benefitRolls>0?'mustering-out':'completed';r.departure={...r.departure,exit:c.exit,generationTerms:c.exitGenerationTerms,age:c.exitAge,educationCount:(state.character.educations??[]).length,completed:c.benefitRolls===0};}
 }
}

function outlawEntryBoundary(state){
 const r=(state.character.aslanOutlawRestorations??[]).findLast(r=>r.status==='completed');
 if(!r)return {available:false,reason:'Complete the earned Outlaw restoration and departure first.'};
 const origin=state.character.careers[r.originCareerIndex];
 let reason='';
 if(state.character.deceased||state.character.retirementFromCreation)reason='Character creation has ended.';
 else if(state.failedQualification)reason='Resolve the failed qualification before another entry.';
 else if(state.character.outcast)reason='Current Outcast status has not been restored.';
 else if(state.character.careers.length!==r.originCareerIndex+1)reason='The restoration departure has already been followed by another career.';
 else if(state.character.terms!==r.departure.generationTerms||state.character.age!==r.departure.age)reason='The restoration departure boundary has elapsed.';
 else if((state.character.educations??[]).length!==(r.departure.educationCount??0))reason='Another education term has begun.';
 else if(state.forcedCareer||origin?.forcedStay)reason='Resolve the independent required career or continuation.';
 else if(state.stage!=='career'||state.active!==null)reason='Resolve the original departure and benefits before requesting entry.';
 return {available:!reason,reason,restoration:r};
}
function historicalEntryApproval(state,careerId,assignment){
 const boundary=outlawEntryBoundary(state);if(!boundary.available)return null;
 return (state.character.aslanHistoricalEntries??[]).find(r=>r.status==='approved'&&r.restorationId===boundary.restoration.id&&r.careerId===careerId&&(assignment===undefined||r.assignment===assignment))??null;
}
function historicalEntryOptions(state){
 const boundary=outlawEntryBoundary(state);if(!boundary.available)return [];
 const projected={...state,_aslanHistoricalProjection:true};
 return availableCareers(projected).filter(c=>c.group==='aslan'&&!['aslan.outcast','aslan.outlaw'].includes(c.id)).map(c=>{
  const assignments=c.assignments.map(a=>{
   const pre=RULE_PACK[c.id]?.prerequisites?.assignments?.[a.id],gender=c.eligibility?.[a.id];
   const sourceOK=conditionMatches(state,pre)&&(!gender||gender===state.character.gender)&&!(c.id==='aslan.military'&&a.id==='support'&&state.character.gender==='male'&&stat(state,'SOC')>8);
   return {id:a.id,name:a.name,available:!c.disabled&&!a.disabled&&sourceOK,reason:c.reason||a.reason||(sourceOK?'':'The assignment source prerequisites are not met.')};
  });
  const available=assignments.some(a=>a.available);return {careerId:c.id,name:c.name,assignments,available,reason:available?'':c.reason||'No eligible assignment.',restorationId:boundary.restoration.id};
 });
}
function currentHistoricalEntry(state){
 const id=state.pending?.kind==='aslan-historical-entry'?state.pending.entryId:null;
 const r=(id?state.character.aslanHistoricalEntries?.find(r=>r.id===id):null)??state.character.aslanHistoricalEntries?.at(-1);if(!r)return null;
 const career=findCareer(r.careerId);return {...copy(r),careerName:career.name,assignmentName:career.assignments.find(a=>a.id===r.assignment)?.name??r.assignment};
}
function refreshHistoricalEntries(state){
 for(const r of state.character.aslanHistoricalEntries??[]){
  if(!['requested','approved'].includes(r.status))continue;let reason='';
  if(state.character.deceased||state.character.retirementFromCreation)reason='character-ended';
  else if(state.character.careers.length!==r.originCareerIndex+1)reason='another-career-entered';
  else if(state.character.terms!==r.generationTerms||state.character.age!==r.age)reason='entry-boundary-elapsed';
  else if((state.character.educations??[]).length!==r.educationCount)reason='education-entered';
  if(reason){r.status='expired';r.expiry={reason,generationTerms:state.character.terms,age:state.character.age};}
 }
}

function currentAslanRestoration(state){const id=state.pending?.kind==='aslan-restoration'?state.pending.restorationId:null;return (id?state.character.aslanRestorations?.find(r=>r.id===id):null)??state.character.aslanRestorations?.at(-1)??null;}
function restorationAvailability(state,r){return aslanRestorationAvailability({restoration:r,stage:state.stage,activeCareerIndex:state.active,completedTerms:state.character.terms,careerCount:state.character.careers.length,originCareer:state.character.careers[r.originCareerIndex],retired:!!state.character.retirementFromCreation,deceased:!!state.character.deceased});}
function restorationForEntry(state,careerId){
 if(state.character.species!=='aslan'||state.character.culture!=='native'||findCareer(careerId)?.group!=='aslan'||careerId==='aslan.outcast')return null;
 return (state.character.aslanRestorations??[]).find(r=>restorationAvailability(state,r).available)??null;
}
function restorationNotice(state){const r=(state.character.aslanRestorations??[]).findLast(r=>r.status==='available');return r?{...copy(r),...restorationAvailability(state,r)}:null;}
function refreshAslanRestorations(state){for(const r of state.character.aslanRestorations??[]){const expiry=aslanRestorationExpiry({restoration:r,completedTerms:state.character.terms,careerCount:state.character.careers.length,deceased:!!state.character.deceased,retired:!!state.character.retirementFromCreation});if(expiry){r.status=expiry.status;r.expiry=expiry;}}}
function expireAslanRestorationBoundary(state,reason){for(const r of state.character.aslanRestorations??[])if(r.status==='available'&&r.availableAtCompletedTerms===state.character.terms){r.status='expired';r.expiry={reason,generationTerms:state.character.terms};}}
function beginAslanRestoration(state){
 const {record,career}=currentCareer(state);state.character.aslanRestorations??=[];
 const r=createAslanRestoration({id:'aslan-restoration-'+(state.character.aslanRestorations.length+1),careerId:career.id,careerIndex:state.active,assignment:record.assignment,completedTerms:state.character.terms,soc:state.character.stats.SOC,outcast:state.character.outcast});
 state.character.aslanRestorations.push(r);sourceStep(state,'aslan-restoration','aliens',41,'Choose whether to accept source-earned restoration. Original family SOC and the status timing require referee verification.','native-resume');state.pending.restorationId=r.id;
}

function reentryPlan(state,careerId,assignment,drafted=false){if(state.character.species==='aslan'&&state.character.culture==='native'&&careerId==='aslan.outcast'&&state.failedQualification)return {allowed:true,mode:'source-fallback',source:{id:'aliens',page:22},reason:''};return careerReentryPlan({careerId,assignment,previous:state.character.careers.at(-1),generationTerms:state.character.terms,drafted});}
function currentAssignmentChange(state){return state.assignmentChange===null||state.assignmentChange===undefined?null:state.character.assignmentChanges?.[state.assignmentChange];}
function assignmentOptions(state){
 if(state.stage!=='term-end'||state.active===null)return [];
 const {career,record}=currentCareer(state),mode=CORE_ASSIGNMENT_MODES[career.id];if(!mode)return [];const eligible=availableCareers(state).find(c=>c.id===career.id);
 return career.assignments.filter(a=>a.id!==record.assignment).map(a=>{
  const plan=assignmentChangePlan({careerId:career.id,fromAssignment:record.assignment,toAssignment:a.id,stage:state.stage,forcedExit:!!record.forcedExit,forcedStay:!!record.forcedStay,forcedCareer:state.forcedCareer,canLeave:exitOptions(state).canLeave});
  const target=eligible?.assignments.find(x=>x.id===a.id);if(plan.available&&(!eligible||eligible.disabled||target?.disabled||!conditionMatches(state,RULE_PACK[career.id]?.prerequisites.assignments?.[a.id])))Object.assign(plan,{available:false,reason:eligible?.reason||target?.reason||'The target assignment prerequisites are not met.'});
  if(plan.available&&state.character.qualificationBanned&&!nobleAutomaticQualification(career.id,state.character.stats))Object.assign(plan,{available:false,reason:'An ageing crisis prevents this required qualification roll.'});
  const sourceRequired=plan.available&&!nobleAutomaticQualification(career.id,state.character.stats)&&!checkAvailable(state,career.qualification);
  return {id:a.id,name:a.name,...plan,sourceRequired};
 });
}
function assignmentUniversityDM(state,careerId,assignment){
 let value=0;for(const record of state.character.educations??[])if(record.id==='core.university'&&record.completed&&record.graduation){
  const rights=educationCareerBenefits({resolvedEducationRulings:!!state.deferredSpecializations,id:record.id,graduation:record.graduation,careerId,assignment,firstCareerAfterEducation:false,firstCareerAttempt:false,serviceAwardUsed:true,enteringCareer:false});
  value=Math.max(value,rights.qualificationModifier??0);
 }return value;
}
function assignmentRollModifier(state,career,assignment,consume){
 const matches=(state.modifiers??[]).filter(m=>m.target==='qualification'&&(m.careerId==='any'||m.careerId===career.id));
 if(consume)state.modifiers=(state.modifiers??[]).filter(m=>!matches.includes(m)||m.scope==='all');
 return -(state.character.careers.length-1)+(career.agePenalty&&state.character.age>=career.agePenalty[0]?career.agePenalty[1]:0)+assignmentUniversityDM(state,career.id,assignment)+matches.reduce((sum,m)=>sum+m.value,0);
}
function refreshAssignmentChange(state){
 const change=currentAssignmentChange(state);if(!change)return;
 if(state.character.deceased){change.status='deceased';state.assignmentChange=null;return;}
 if(state.character.careers.length>change.careerIndex+1){change.status='completed';change.newCareerIndex=state.character.careers.length-1;state.assignmentChange=null;return;}
 if(state.stage==='failed-entry'){change.status='failed';state.assignmentChange=null;return;}
 if(state.stage==='career'&&state.active===null){change.status='ready';state.stage='assignment-entry';}
}
function recordCareerTransition(state,career,assignment,check,automaticReason,plan){
 state.character.careerTransitions??=[];const previous=state.character.careers.at(-1);
 const transition={id:'career-transition-'+(state.character.careerTransitions.length+1),source:{id:career.source,page:career.page},procedureSource:copy(plan.source??{id:'core',page:plan.mode==='assignment-restart'?20:18}),generationTerms:state.character.terms,age:state.character.age,
  fromCareerIndex:previous?state.character.careers.length-1:null,fromCareerId:previous?.id??null,fromAssignment:previous?.assignment??null,
  toCareerId:career.id,toAssignment:assignment,mode:plan.mode,check:copy(check),automaticReason:automaticReason??null,status:check&&!check.success?'failed':'entered',newCareerIndex:check&&!check.success?null:state.character.careers.length};
 state.character.careerTransitions.push(transition);const change=currentAssignmentChange(state);if(change){change.check=copy(check);change.automaticReason=automaticReason??null;change.transitionId=transition.id;}
 return transition;
}

function benefitCredits(state,kind='ordinary'){
 return (state.character.benefitCredits??[]).filter(c=>c.status==='available'&&(c.scope==='any'||kind==='ordinary'&&c.originCareerIndex===state.active&&c.originCareerId===currentCareer(state).career.id));
}
function selectedBenefitCredits(state,payload,kind='ordinary'){
 const ids=payload.creditIds??[];need(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.length<=100,'Choose distinct benefit-credit IDs.');
 const available=benefitCredits(state,kind);need(ids.every(id=>typeof id==='string'&&available.some(c=>c.id===id)),'A selected benefit credit is unavailable for this roll.');return ids.map(id=>available.find(c=>c.id===id));
}
function consumeBenefitCredits(credits,context){for(const c of credits){c.status='consumed';c.consumption=copy(context);}}
function expireBenefitCredits(state){for(const c of state.character.benefitCredits??[])if(c.status==='available'&&c.scope==='career'&&state.character.careers[c.originCareerIndex]?.exit&&state.active!==c.originCareerIndex)c.status='expired';}
function terminateBorrowedRoutes(state){
 if(!state.character.deceased)return;
 for(const route of state.character.crossCareerRoutes??[])if(!['completed','deceased'].includes(route.status)){route.status='deceased';route.completion={age:state.character.age,generationTerms:state.character.terms,cause:'death-before-route-completion'};}
 state.pendingCrossCareerTraining=null;
 const record=advisoryRecord(state);if(record){record.status='deceased';record.completion={age:state.character.age,generationTerms:state.character.terms};state.advisoryService=null;}
}
function advisoryCashHistory(state,record){
 const c=record.cash;state.character.benefitRollHistory??=[];state.character.benefitRollHistory.push({kind:'advisory-cash',entitlementId:record.id,careerId:record.careerId,originCareerId:record.originCareerId,originCareerIndex:record.originCareerIndex,table:'cash',natural:c.die,modifier:c.modifier,result:c.result,amount:c.amount,creditIds:copy(c.creditIds),sourceRuling:c.sourceRuling??null,rolls:[{natural:c.die,modifier:c.modifier,result:c.result}],completed:true});
}

function advisoryRecord(state){return state.advisoryService===undefined||state.advisoryService===null?null:state.character.advisoryServices?.[state.advisoryService];}
function assertAdvisoryContext(state,record){
 need(record&&state.active===record.originCareerIndex&&currentCareer(state).career.id===record.originCareerId&&currentCareer(state).record.terms===record.careerTerms,'The advisory service context changed. Restore/replay its original context.');
}
function advisoryOptions(){return CAREERS.filter(c=>c.group==='zhodani'&&c.id!=='zhodani.government'&&RULE_PACK[c.id]?.training.service&&RULE_PACK[c.id]?.benefits.cash).map(c=>({id:c.id,name:c.name}));}
function currentAdvisory(state){
 const record=advisoryRecord(state);if(!record)return null;
 return {...copy(record),options:record.status==='awaiting-career'?advisoryOptions():[]};
}
function beginAdvisory(state){
 const {career,record}=currentCareer(state);need(career.id==='zhodani.government'&&!advisoryRecord(state),'Advisory service requires the original Government career.');
 state.character.advisoryServices??=[];state.advisoryService=state.character.advisoryServices.length;
 state.character.advisoryServices.push({id:'advisory-'+(state.advisoryService+1),source:copy(ADVISORY_SOURCE),originCareerId:career.id,originCareerIndex:state.active,
  careerTerms:record.terms,generationTerms:state.character.terms,age:state.character.age,status:'awaiting-career',careerId:null,
  ruling:{table:'service',timing:'immediate',countsTowardCashLimit:true},training:null,cash:null,cashLimitDecision:null,completion:null});
 state.stage='advisory-career';
}
function finishAdvisory(state,record,rolls){
 record.status=record.cash?'completed':'forfeited';record.completion={age:state.character.age,generationTerms:state.character.terms};state.advisoryService=null;drainEffects(state,rolls);
}

function borrowedEffects(effects,context){
 const result=copy(effects);function mark(v){if(Array.isArray(v)){v.forEach(mark);return;}if(!v||typeof v!=='object')return;
  if(v.kind){v.tableCareerId=context.tableCareerId;v.crossCareerRouteId=context.crossCareerRouteId;}
  for(const [key,value] of Object.entries(v))if(!['reeducationOrigin','source'].includes(key))mark(value);
 }mark(result);return result;
}
function crossCareerRoute(state,id){const route=state.character.crossCareerRoutes?.find(r=>r.id===id);need(route,'The borrowed career route is missing.');return route;}
function assertCrossCareerContext(state,route){
 need(state.active===route.originCareerIndex&&currentCareer(state).career.id===route.originCareerId&&currentCareer(state).record.terms===route.careerTerms,'The borrowed career context changed. Restore/replay the original route.');
}
function crossCareerTraining(state){
 const id=state.pendingCrossCareerTraining;if(!id||state.stage!=='cross-career-training')return null;
 const route=crossCareerRoute(state,id),career=findCareer(route.coverCareerId??'zhodani.prole');
 return {id:route.id+'-training',routeId:route.id,originCareerId:route.originCareerId,originCareerIndex:route.originCareerIndex,
  sourceCareerId:career.id,source:copy(route.source),options:career.assignments.map(a=>({id:a.id,name:a.name}))};
}
// Cover identity borrows tables only: no entry check, rank, term or benefits career.
// Aliens 2026 pp. 186, 189: bounded native career set plus the expressly
// available Core Drifter. Cross-cultural and optional Companion covers need a ruling.
function coverCareerOptions(originCareerId){
 const ids=originCareerId==='core.agent'?['core.rogue','core.citizen']:
  CAREERS.filter(c=>c.group==='vargr'&&c.id!=='vargr.agent'||c.id==='core.drifter').map(c=>c.id);
 return ids.map(id=>findCareer(id)).filter(c=>RULE_PACK[c.id]?.training.assignments&&RULE_PACK[c.id]?.mishaps).map(c=>({id:c.id,name:c.name}));
}
function crossCareerCover(state){
 if(state.stage!=='cross-career-cover'||!state.pendingCrossCareerCover)return null;
 const route=crossCareerRoute(state,state.pendingCrossCareerCover);
 return {routeId:route.id,originCareerId:route.originCareerId,source:copy(route.source),options:coverCareerOptions(route.originCareerId)};
}
function beginCoverChoice(state,e){
 const {career,record}=currentCareer(state);
 need(['core.agent','vargr.agent'].includes(career.id)&&career.id===e.originCareerId,'Undercover service requires its original Agent career.');
 state.character.crossCareerRoutes??=[];
 const route={id:'cross-career-'+(state.character.crossCareerRoutes.length+1),kind:'cover-undercover',source:copy(e.source),
  originCareerId:career.id,originCareerIndex:state.active,careerTerms:record.terms,generationTerms:state.character.terms,age:state.character.age,
  status:'awaiting-cover',coverCareerId:null,check:null,tables:[],training:null,completion:null};
 state.character.crossCareerRoutes.push(route);state.pendingCrossCareerCover=route.id;state.stage='cross-career-cover';
}
function beginUndercover(state,rolls){
 const {career,record}=currentCareer(state);need(career.id==='zhodani.agent','Undercover service requires the original Agent career.');
 const natural=dice(state,2,rolls,'Undercover Investigate check'),modifier=skillCheckDM(state,'Investigate'),total=natural+modifier;
 state.character.crossCareerRoutes??=[];const route={id:'cross-career-'+(state.character.crossCareerRoutes.length+1),kind:'agent-undercover',source:{id:'aliens',page:259},
  originCareerId:career.id,originCareerIndex:state.active,careerTerms:record.terms,generationTerms:state.character.terms,age:state.character.age,
  status:'resolving-table',check:{natural,modifier,total,target:8,success:total>=8},tables:[],training:null,completion:null};
 state.character.crossCareerRoutes.push(route);
 const context={tableCareerId:'zhodani.prole',crossCareerRouteId:route.id},effects=route.check.success?
  [{kind:'table-roll',table:'events',career:'zhodani.prole',dice:'2D'},{kind:'cross-career-training',routeId:route.id}]:
  [{kind:'table-roll',table:'mishap',career:'zhodani.prole',dice:'1D',keepCareer:true}];
 state.effectsQueue.unshift(...borrowedEffects(effects,context),{kind:'cross-career-complete',routeId:route.id});
}

function activeMerchantFine(state){return state.merchantFine===null||state.merchantFine===undefined?null:state.character.merchantFines?.[state.merchantFine];}
function merchantFineContext(state){
 const {record,career}=currentCareer(state);return {careerIndex:state.active,careerId:career.id,careerTerms:record.terms,
  generationTerms:state.character.terms,age:state.character.age,cash:state.character.cash,socialStanding:state.character.stats.SOC,forcedExit:!!record.forcedExit};
}
function assertMerchantFineContext(state,fine){need(fine&&JSON.stringify(merchantFineContext(state))===JSON.stringify(fine.context),'The pending Merchant fine context changed. Restore/replay the original context.');}
function beginMerchantFine(state,e){
 if(state.active===null||currentCareer(state).career.id!=='zhodani.merchant'){nativeFallback(state,e,'The Merchant fine requires its original active Zhodani Merchant career.');return;}
 need(!activeMerchantFine(state),'Another Merchant fine is pending.');
 const origin=copy(e.reeducationOrigin??reeducationOrigin(state,'mishap',3)),context=merchantFineContext(state);
 state.character.merchantFines??=[];const fine={id:'merchant-fine-'+(state.character.merchantFines.length+1),source:copy(MERCHANT_FINE_SOURCE),
  status:'awaiting-roll',die:null,amount:null,origin,context,cashAvailable:context.cash,socialStanding:context.socialStanding,
  decision:null,payment:null,reeducationId:null,completion:null,
  continuation:{queue:copy(state.effectsQueue),next:state.effectNext,steps:state.effectSteps}};
 state.merchantFine=state.character.merchantFines.length;state.character.merchantFines.push(fine);
 state.effectsQueue=[];state.effectNext=null;state.pendingChoice=null;state.stage='merchant-fine-roll';
}

function activeReeducation(state){return state.reeducation===null||state.reeducation===undefined?null:state.character.reeducations?.[state.reeducation];}
function reeducationOrigin(state,table,row,parent={}){
 const {career,record}=currentCareer(state),tableCareer=parent.tableCareerId?findCareer(parent.tableCareerId):career;
 return {...copy(parent),careerId:career.id,careerIndex:state.active,table,row,source:{id:tableCareer.source,page:tableCareer.page+1},
  defaultMishapExit:table==='mishap',explicitDischarge:table==='mishap'&&(REEDUCATION_EXPLICIT_DISCHARGE[tableCareer.id]??[]).includes(row),
  exitAtTrigger:!!record.forcedExit};
}
function withReeducationOrigin(effects,origin){
 const result=copy(effects);function mark(value){if(Array.isArray(value)){value.forEach(mark);return;}if(!value||typeof value!=='object')return;
  if(value.kind)value.reeducationOrigin=copy(origin);for(const [k,v] of Object.entries(value))if(k!=='reeducationOrigin')mark(v);
 }mark(result);return result;
}
function beginReeducation(state,e){
 if(state.active===null||state.character.species!=='zhodani'){nativeFallback(state,e,'This re-education route requires an active native Zhodani career.');return;}
 need(!activeReeducation(state),'Another re-education episode is pending.');
 const {record,career}=currentCareer(state),origin={careerId:career.id,careerIndex:state.active,source:{id:'aliens',page:276},
  defaultMishapExit:!!record.mishap,explicitDischarge:false,protectedStay:false,...copy(e.reeducationOrigin??{}),exitAtStart:!!record.forcedExit};
 state.character.reeducations??=[];const episode={id:'reeducation-'+(state.character.reeducations.length+1),source:copy(ZHODANI_REEDUCATION_SOURCE),
  status:'awaiting-roll',origin,careerTermsAtTrigger:record.terms,generationTermsAtTrigger:state.character.terms,ageAtTrigger:state.character.age,
  statsAtTrigger:copy(state.character.stats),roll:null,fineDie:null,plan:null,decisions:{},decisionHistory:[],timeline:null,
  continuation:{queue:copy(state.effectsQueue),next:state.effectNext,steps:state.effectSteps},completion:null};
 state.reeducation=state.character.reeducations.length;state.character.reeducations.push(episode);
 state.effectsQueue=[];state.effectNext=null;state.pendingChoice=null;state.stage='reeducation-roll';
}
function refreshReeducationPlan(state,episode){
 episode.plan=reeducationPlan({roll:episode.roll,stats:state.character.stats,cash:state.character.cash,context:episode.origin,
  decisions:episode.decisions,...(episode.fineDie===null?{}:{fineDie:episode.fineDie})});
 return episode.plan;
}
function resumeReeducationQueue(state,episode,rolls){
 const continuation=episode.continuation;episode.continuation=null;state.reeducation=null;
 if(continuation){state.effectsQueue=copy(continuation.queue);state.effectNext=continuation.next;state.effectSteps=continuation.steps;drainEffects(state,rolls);}
 else{state.stage='term-end';startDeferredReeducation(state);}
}
function finishReeducation(state,episode,rolls=[]){
 episode.status='completed';episode.completion={age:state.character.age,generationTerms:state.character.terms,
  careerTerms:state.character.careers[episode.origin.careerIndex].terms,nonCareerMonths:state.character.nonCareerMonths??0};
 state.treatmentAgeing=null;resumeReeducationQueue(state,episode,rolls);
}
function startReeducationTreatment(state,episode,rolls=[]){
 state.reeducation=state.character.reeducations.indexOf(episode);episode.phase='treatment-start';
 const plan=refreshReeducationPlan(state,episode);
 if(!plan.resolved){episode.status='decisions';state.stage='reeducation-decisions';return;}
 episode.status='treatment';
 const before=copy(state.character.stats),timeline=treatmentTimeline({age:state.character.age,nonCareerMonths:state.character.nonCareerMonths??0,
  months:plan.durationMonths,careerTerms:state.character.terms});
 episode.timeline=timeline;state.character.age=timeline.ageAfter;state.character.nonCareerMonths=timeline.nonCareerMonthsAfter;
 state.character.treatmentAgeingTerms=timeline.ageingCreditAfter;
 if(plan.row===1){state.character.stats.END=plan.endAfter;state.character.stats.SOC=plan.socAfter;}
 episode.treatmentEffects={before,after:copy(state.character.stats)};
 if(plan.deceased){episode.status='deceased';state.character.deceased=true;state.stage='deceased';state.effectsQueue=[];state.effectNext=null;state.reeducation=null;return;}
 if(timeline.checkpoints.length){state.treatmentAgeing={episodeId:episode.id,index:0,checkpoints:copy(timeline.checkpoints)};state.stage='ageing';}
 else finishReeducation(state,episode,rolls);
}
function startDeferredReeducation(state){
 if(state.stage!=='term-end'||state.active===null)return;
 const episode=(state.character.reeducations??[]).find(e=>e.status==='deferred'&&e.origin.careerIndex===state.active&&currentCareer(state).record.terms>e.careerTermsAtTrigger);
 if(episode)startReeducationTreatment(state,episode);
}
function finishAgeing(state,rolls=[]){
 state.ageingCheck=null;state.pendingAgeingAnagathicTerms=null;
 if(state.treatmentAgeing){
  const context=state.treatmentAgeing;context.index++;
  if(context.index<context.checkpoints.length){state.stage='ageing';return;}
  const episode=activeReeducation(state);need(episode?.id===context.episodeId,'Treatment ageing lost its continuation.');
  finishReeducation(state,episode,rolls);return;
 }
 state.stage='term-end';startDeferredReeducation(state);
}
function commitReeducation(state,episode,rolls){
 const plan=refreshReeducationPlan(state,episode);need(plan.resolved,'Record all required re-education source decisions.');
 const record=state.character.careers[episode.origin.careerIndex];need(state.active===episode.origin.careerIndex,'The original re-education career changed.');
 if(!episode.dispositionApplied){
  if(plan.disposition==='leave')record.forcedExit=true;
  else if(plan.disposition==='stay')record.forcedExit=episode.origin.protectedStay?!!episode.origin.protectedExitBefore:false;
  episode.dispositionApplied={mode:plan.disposition,forcedExit:!!record.forcedExit,source:copy(episode.source),ruling:copy(plan.decisions.disposition??null)};
 }
 if(plan.durationMonths>0){
  if(plan.chronology==='after-current-term'&&episode.phase!=='treatment-start'){
   episode.status='deferred';resumeReeducationQueue(state,episode,rolls);return;
  }
  startReeducationTreatment(state,episode,rolls);return;
 }
 if(plan.row===5){if(plan.funding==='cash')state.character.cash-=plan.fine;else if(plan.funding==='debt')state.character.debt+=plan.fine;
  episode.finePayment={amount:plan.fine,funding:plan.funding};}
 if(plan.benefitRolls)record.benefitRolls+=plan.benefitRolls;
 finishReeducation(state,episode,rolls);
}
function reviewZhodaniStatus(state,cause,rolls,next){
 if(state.character.species!=='zhodani'||state.active===null||!Object.hasOwn(state.character.stats,'PSI'))return false;
 const plan=zhodaniStatusPlan({soc:state.character.stats.SOC,psi:state.character.stats.PSI,inCareer:true,permanentlyLost:!!state.character.psionicLoss});
 state.character.statusReviews??=[];state.character.statusReviews.push({cause,source:copy(plan.source),socBefore:state.character.stats.SOC,psi:state.character.stats.PSI,elevated:plan.elevate});
 if(!plan.elevate)return false;
 state.character.stats.SOC=plan.socAfter;
 startPsionicTraining(state,{context:'zhodani-elevation',source:copy(plan.source),next:next??'native-resume'},rolls);return true;
}
function zhodaniAgeingEffects(state,effects){
 const result=copy(effects);function visit(value){
  if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;
  if(value.kind==='stat')value.ageingOrigin=true;
  if(state.character.stats.PSI>0&&!state.character.psionicLoss&&value.kind==='choice'&&value.options?.length===3&&value.options.every(o=>o.effects?.length===1&&o.effects[0].kind==='stat'&&['INT','EDU','SOC'].includes(o.effects[0].name))){
   value.options.push({label:'PSI (referee ruling)',effects:[{kind:'zhodani-ageing-psi',source:{id:'aliens',page:277}}]});
  }
  for(const v of Object.values(value))if(v&&typeof v==='object')visit(v);
 }visit(result);return result;
}
function removeUnavailablePsionicAgeingChoice(state){
 if(state.stage==='effect-choice'&&Array.isArray(state.pendingChoice?.options)&&(!(state.character.stats.PSI>0)||state.character.psionicLoss))state.pendingChoice.options=state.pendingChoice.options.filter(o=>!o.effects?.some(e=>e.kind==='zhodani-ageing-psi'));
}
function markPermanentPsionicLoss(state){
 if(state.character.species!=='zhodani'||state.character.psionicLoss)return;
 state.character.psionicLoss={permanent:true,cause:'ageing',source:{id:'aliens',page:277},age:state.character.age,
  talents:copy(Object.fromEntries(Object.entries(state.character.skills).filter(([name])=>PSIONIC_TALENTS.includes(name)))),psi:0};
}

function transferForEntry(state,careerId,assignmentId){
 for(const right of state.character.careerTransfers??[]){
  const plan=careerTransferEntry({right,completedTerms:state.character.terms,careerCount:state.character.careers.length,
   activeCareerIndex:state.active,careerId,assignmentId});
  if(plan.available)return {right,plan};
 }
 return null;
}
function expireCareerTransfers(state){
 for(const right of state.character.careerTransfers??[]){
  const expired=careerTransferExpiry({right,completedTerms:state.character.terms,careerCount:state.character.careers.length});
  if(expired){right.status='expired';right.expired=expired;}
 }
}
function transferOptions(state){
 return (state.character.careerTransfers??[]).map(right=>{
  const career=state.careerChoices.find(c=>c.id===right.targetCareerId),assignmentId=right.targetAssignmentId??career?.assignments[0]?.id;
  const plan=careerTransferEntry({right,completedTerms:state.character.terms,careerCount:state.character.careers.length,
   activeCareerIndex:state.active,careerId:right.targetCareerId,assignmentId});
  const assignment=right.targetAssignmentId?career?.assignments.find(a=>a.id===right.targetAssignmentId):null;
  return {id:right.id,careerId:right.targetCareerId,assignmentId:right.targetAssignmentId,rank:right.retainedRank,rankTrack:right.rankTrackDecision?.rankTrack??right.rankTrack,
   available:state.stage==='career'&&plan.available&&!career?.disabled&&!!career&&!assignment?.disabled&&!state.failedQualification&&conditionMatches(state,RULE_PACK[right.targetCareerId]?.prerequisites.assignments?.[assignmentId]),
   needsRankTrackDecision:!!plan.needsAdjudication,source:copy(right.source),status:right.status,
   availableAtCompletedTerms:right.availableAtCompletedTerms,reason:plan.reasons?.[0]??career?.reason??assignment?.reason??''};
 });
}
function grantCareerTransfer(state,effect){
 const {record,career}=currentCareer(state),rule=careerTransferRule(career.id,effect);if(!rule)return false;
 state.character.careerTransfers??=[];
 const right=createCareerTransfer({ruleId:rule.id,id:'transfer-'+(state.character.careerTransfers.length+1),sourceCareerIndex:state.active,
  sourceAssignment:record.assignment,sourceRank:record.rank,sourceOfficer:!!record.officer,completedTerms:state.character.terms,soc:state.character.stats.SOC});
 state.character.careerTransfers.push(right);if(['zhodani.army-guard','zhodani.guard-agent'].includes(rule.id))record.transferVoluntaryExit=right.id;return true;
}

export function availableCareers(state) {
 const species=state.character.species,culture=state.character.culture;
 const groups=accessContext(state)?['aslan','core','companion']:species==='aezorgh'?['core','vargr','companion']:species==='human'||culture==='imperial'?['core','companion']:[species,'companion'];
 return CAREERS.filter(c=>groups.includes(c.group)||c.id===state.forcedCareer).map(original=>{
 const pack=RULE_PACK[original.id],pre=pack?.prerequisites??{};
 const c={...original,qualification:pre.qualification===undefined?original.qualification:pre.qualification,assignments:original.assignments.map(a=>({...a,...pack?.checks?.[a.id]}))};
 let reason='';
 if(nativeAslan(state)&&c.group==='core'&&!accessCoreAllowed(state,c.id)&&state.forcedCareer!==c.id)reason='This Core career is outside the recorded outward route.';
 if(accessMandatory(state)&&c.group!=='core')reason='The accepted expedition requires a Core career attempt next term.';
 if(state.forcedCareer&&c.id!==state.forcedCareer)reason='An event requires a different next career.';
 const transferAvailable=c.assignments.some(a=>transferForEntry(state,c.id,a.id)),entryAccess=accessForAttempt(state,c.id),accessAutomatic=!!entryAccess?.automatic;if(entryAccess)c.aslanAccess={id:entryAccess.id,automatic:entryAccess.automatic,source:copy(entryAccess.source)};
 if(state.character.qualificationBanned&&c.qualification&&!transferAvailable&&!accessAutomatic&&!nobleAutomaticQualification(c.id,state.character.stats))reason='An ageing crisis prevents future qualification checks.';
 if(!conditionMatches(state,pre))reason='The source prerequisites are not met.';
 if(c.specialEntry&&!state.character.sentenced)reason='Requires a sentencing event.';
 if(c.needsVerification)reason='Rule data awaiting verification.';
 if(c.id==='core.psion'&&!state.config.gm&&!state.character.psionEntryPermission&&!lifePsionAccess(state))reason='Psion entry requires referee permission. Enable GM mode to grant it.';
 if(c.qualification?.stat==='PSI'&&!Object.hasOwn(state.character.stats,'PSI'))reason='Psionic strength must be tested first.';
 if(c.gender&&state.character.gender!==c.gender)reason='This career requires '+c.gender+' in the source rules.';
 if(c.minSOC&&(state.character.stats.SOC??0)<c.minSOC)reason='Requires SOC '+c.minSOC+' or greater.';
 if(c.maxSOC&&(state.character.stats.SOC??0)>c.maxSOC)reason='Requires SOC '+c.maxSOC+' or less.';
 const restoration=restorationForEntry(state,c.id),officerException=state._aslanOfficerQualification&&state._aslanOfficerQualification===activeAslanOfficerOffer(state)?.id&&activeAslanOfficerOffer(state)?.targetCareerId===c.id&&activeAslanOfficerOffer(state)?.statusVerification?.approved;
 const restoredHistory=aslanOfficerHistory(state).length>0;
 const historicalApproval=historicalEntryApproval(state,c.id);
 if(species==='aslan'&&culture==='native'&&c.group==='aslan'&&!['aslan.outcast','aslan.outlaw'].includes(c.id)&&!restoration&&!officerException&&!historicalApproval&&(state.character.outcast||restoredHistory&&!state._aslanHistoricalProjection))reason=restoredHistory?'Historical Outcast/Outlaw service requires a source-earned exception or outward route.':'Outcast restriction. Use the source rules to leave Hierate society.';
 if(restoredHistory&&!restoration&&!officerException&&!state._aslanHistoricalProjection&&historicalApproval)c.assignments=c.assignments.map(a=>a.id===historicalApproval.assignment?a:{...a,disabled:true,reason:'The historical-entry ruling approves a different assignment.'});
 // Mirror assignment entry guards in new-session choices; cultural skill labels do not relax career prerequisites.
 if(state.deferredSpecializations)c.assignments=c.assignments.map(a=>{if(a.disabled)return a;const gender=c.eligibility?.[a.id];const assignmentReason=!conditionMatches(state,pre.assignments?.[a.id])?'This assignment has additional source prerequisites.':gender&&state.character.gender!==gender?'This assignment has a gender restriction.':c.id==='aslan.military'&&a.id==='support'&&state.character.gender==='male'&&(state.character.stats.SOC??0)>8?'Male support assignment requires SOC 8 or less.':'';return assignmentReason?{...a,disabled:true,reason:assignmentReason}:a;});
 c.assignments=c.assignments.map(a=>{const absent=[a.survival,a.advancement].filter(check=>check&&!checkAvailable(state,check,pre.initialStats)).map(check=>check.stat);return absent.length?{...a,disabled:true,reason:'Requires absent '+[...new Set(absent)].join('/')+' characteristic; use a source-approved cross-species route.'}:a;});
 c.assignments=c.assignments.map(a=>{const transfer=transferForEntry(state,c.id,a.id);return {...a,...(transfer?{transferId:transfer.right.id}:{}),...(state.character.qualificationBanned&&c.qualification&&!transfer&&!accessAutomatic&&!nobleAutomaticQualification(c.id,state.character.stats)?{disabled:true,reason:'An ageing crisis prevents this qualification check.'}:{})};});
 if(state.stage==='career'&&state.active===null)c.assignments=c.assignments.map(a=>{const plan=reentryPlan(state,c.id,a.id,!!state.pendingDraft||state.forcedCareer===c.id&&state.forcedCareerDraft);return plan.allowed?a:{...a,disabled:true,reason:plan.reason};});
 if(transferAvailable)c.transferId=c.assignments.find(a=>a.transferId)?.transferId;
 if(c.assignments.every(a=>a.disabled))reason=c.assignments[0]?.reason??'Every assignment is unavailable.';
 if(c.id==='aslan.wanderer'&&state.character.birthOrder!=='second-son')reason='Requires a second son under the source rules.';
 if(accessMandatory(state)&&c.group!=='core')reason='The accepted expedition requires a Core career attempt next term.';
 if(state.character.retirementFromCreation)reason='Early retirement ends character creation; a different career cannot be selected.';
  return {...c,disabled:!!reason,reason};
 });
}
function enterCareer(state,career,assignment,rolls=[],transfer=null) {
 const educational=educationRights(state,career.id,assignment,true);
 if(state.educationEntryRulings)delete state.educationEntryRulings[career.id];
 const previous=state.character.careers.at(-1);
 const reentry=reentryPlan(state,career.id,assignment,!!state.pendingDraft);need(reentry.allowed,reentry.reason);
 const transition=state.character.careerTransitions?.at(-1);if(!transition||transition.status!=='entered'||transition.newCareerIndex!==state.character.careers.length||transition.toCareerId!==career.id||transition.toAssignment!==assignment)recordCareerTransition(state,career,assignment,null,state.pendingDraft?'draft':'fallback',reentry);
 const next={id:career.id,assignment,drafted:!!state.pendingDraft,terms:0,rank:0,officer:false,benefitRolls:0,totalBenefits:0,successfulTerms:0};
 const officerOffer=activeAslanOfficerOffer(state);if(officerOffer&&state._aslanOfficerQualification===officerOffer.id)next.aslanOfficerOfferId=officerOffer.id;
 if(transfer){
  const {right,plan}=transfer;need(right.status==='unconsumed'&&plan.resolved&&plan.automaticEntry,'The transfer right is unavailable or unresolved.');
  need(plan.rank===null||educational.entryRank===null||educational.entryRank===plan.rank,'Conflicting education and transfer ranks require source resolution.');
  if(plan.rank!==null){next.rank=plan.rank;next.highestRank=plan.rank;next.officer=plan.officer;}
  next.transferId=right.id;right.status='consumed';right.consumed={careerIndex:state.character.careers.length,careerId:career.id,assignmentId:assignment,completedTerms:state.character.terms,rank:next.rank,rankTrack:plan.rankTrack};
 }
 for(const m of state.modifiers??[])if(m.careerId==='next')m.careerId=career.id;
 state.character.careers.push(next);state.forcedCareer=null;state.forcedCareerDraft=false;next.educationCommission=educational.commission;next.commissionBlockedFirstTerm=educational.commissionBlocked;state.active=state.character.careers.length-1;if(outwardCoreCareer(state,career)){initializeAslanCashAccounts(state);next.aslanOutsideRules={accessId:accessContext(state).accessId,upbringing:'native',careerSystem:'core',benefitSystem:'core',cashRollAccount:'core',cashLimit:3,cashMultiplier:1,pensionSystem:'core',ageingSystem:'aslan',interpretation:'separate-native-and-Core-muster-outs'};}state.failedQualification=false;state.pendingDraft=false;
 next.educationModifiers={commission:educational.commissionModifier,advancement:educational.advancementModifier};
 if(educational.entryRank!==null){next.rank=educational.entryRank;next.highestRank=next.rank;next.educationRankAward=true;}
 if(career.id==='aslan.outcast'&&state.character.species==='aslan'&&state.character.culture==='native')forfeitAslanClanShares(state,'outcast-career-entry',{id:'aliens',page:22},'preserve-SOC');
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
 const {record,career}=currentCareer(state);record.termHistory??=[];record.termHistory.push({careerTerm:record.terms+1,generationTerm:state.character.terms+1,assignment:record.assignment,rank:record.rank,officer:!!record.officer,age:state.character.age+4});record.terms++;state.character.terms++;state.character.age+=4;
 // Core p.46 Crime changes the next term, not this term's advancement (p.18).
 if(record.lifeCrimeExitPending){record.forcedExit=true;record.forcedStay=false;delete record.lifeCrimeExitPending;}
 if(state.correctedCareerEvents&&record.eventExitAtTermEnd){record.forcedExit=true;record.forcedStay=false;}
 if(!record.mishap){if(!(record.benefitBlock>0)&&!record.believerBuyout?.forfeitedTerm)record.benefitRolls++;record.successfulTerms++;}
 if(record.advancementBlock>0)record.advancementBlock--;if(record.benefitBlock>0)record.benefitBlock--;
 record.mishap=false;record.commissionTried=false;
 const species=findSpecies(state.character.species);const ageStart=species.agingStart??34;
 if(state.character.age>=ageStart)state.stage='ageing';
 else state.stage='term-end';
 if(career.maxTerms&&record.terms>=career.maxTerms){record.forcedExit=true;record.forcedStay=false;}
 startDeferredReeducation(state);
}

// Games support starts at an existing career's term boundary; initial-career timing is not implemented.
// Benefit inheritance: Core 2022 p.46 + Aliens Volume 1 Update 2026 p.242.
// A completed Games term uses ordinary non-mishap term accounting, including existing benefit blocks.
const GAMES_COMMANDS=['psionic-games-preliminary','psionic-games-final','complete-psionic-games'];
function gamesHistory(state){return state.character.psionicGames??={version:1,applications:[]};}
function gamesPending(state){
 const index=state.psionicGamesPending;
 if(index===undefined||index===null)return null;
 const record=state.character.psionicGames?.applications[index];
 need(record?.status==='pending','The pending Games application is missing or already completed.');return record;
}
function gamesContext(state){
 const {record}=currentCareer(state);
 return {careerIndex:state.active,career:copy(record),species:state.character.species,culture:state.character.culture,
  age:state.character.age,terms:state.character.terms,stats:copy(state.character.stats),skills:copy(state.character.skills),
  forcedCareer:state.forcedCareer??null,retired:!!state.character.retirementFromCreation,deceased:!!state.character.deceased};
}
function assertGamesContext(state){
 const record=gamesPending(state);need(record,'No Psionic Games competition is pending.');
 need(state.active===record.context.careerIndex&&JSON.stringify(gamesContext(state))===JSON.stringify(record.context),
  'The reserved Games career or character context changed. Restore the pending context or explicitly replay the application.');return record;
}
function psionicGamesAvailability(state){
 const unavailable=reason=>({available:false,reason,timing:'next-term-boundary',source:copy(PSIONIC_GAMES_SOURCE)});
 if(gamesPending(state))return unavailable('Complete the reserved Psionic Games term first.');
 if(state.stage!=='term-end'||state.active===null)return unavailable('This option begins at a completed term boundary in an active career.');
 if(state.character.species!=='zhodani'||state.character.culture!=='native')return unavailable('This route requires a native Zhodani Intendant.');
 if(state.character.psionicLoss)return unavailable('Ageing permanently removed psionic ability.');
 if(state.character.retirementFromCreation||state.character.deceased)return unavailable('Retirement or death prevents another term.');
 if(state.forcedCareer)return unavailable('Resolve the required next career; the Games cannot bypass a career transfer.');
 const {record,career}=currentCareer(state),exit=exitOptions(state);
 if(!exit.canContinue)return unavailable(exit.continueReason);
 if(record.exit||record.retiredFromCreation||career.maxTerms&&record.terms>=career.maxTerms)return unavailable('This career cannot accept another term.');
 if(record.terms<1)return unavailable('Initial-career Games entry is not implemented; complete an ordinary term first.');
 if(state.pending||state.effectsQueue?.length||state.injury!==undefined&&state.injury!==null||state.psionicTraining)return unavailable('Resolve the current source, medical or training step first.');
 if(!Number.isInteger(state.character.stats.PSI)||state.character.stats.PSI<0||state.character.stats.PSI>40)return unavailable('An established PSI score is required.');
 const eligibility=psionicGamesEligibility({socialClass:state.character.stats.SOC===10?'intendant':state.character.stats.SOC>10?'noble':'prole',
  previousApplications:state.character.psionicGames?.applications.length??0,currentCareerId:career.id});
 if(!eligibility.eligible)return unavailable(eligibility.reasons.includes('lifetime-application-used')?'The once-per-lifetime application has already been used, including failures.':'Only Intendants can apply; Proles and Nobles cannot.');
 return {available:true,reason:'',timing:'next-term-boundary',source:copy(PSIONIC_GAMES_SOURCE),applicationTarget:10,
  careerId:career.id,forcedStay:!!record.forcedStay,benefitRolls:record.benefitBlock>0?0:1};
}
function gamesRemaining(record){
 const rolled=new Set(record.preliminaryRolls.map(row=>row.talent));
 return PSIONIC_TALENTS.filter(t=>Object.hasOwn(record.context.skills,t)&&record.context.skills[t]>=0&&!rolled.has(t))
  .map(talent=>({talent,level:record.context.skills[talent],target:8}));
}
function gamesAudit(record){
 return [ ...record.application.audit, ...record.preliminaryRolls.map(row=>row.check), ...(record.final?.audit??[]) ]
  .map((entry,index)=>({...copy(entry),sequence:index+1}));
}
function gamesCompetition(record,decisions={}){
 return psionicGamesCompetition({application:record.application,skills:record.context.skills,
  preliminaryRolls:record.preliminaryRolls.map(({talent,dice})=>({talent,dice})),finalDice:record.final?.dice,decisions});
}
function gamesDecisionInput(payload){
 need(Object.keys(payload).every(k=>['ordinaryEvents','awardStacking','ordinaryEventEffects'].includes(k)),'Use the typed Games decision fields, not arbitrary effects or term changes.');
 for(const key of ['ordinaryEvents','awardStacking'])if(payload[key]!==undefined){
  need(plain(payload[key])&&Object.keys(payload[key]).every(k=>['mode','reason'].includes(k)),'Invalid Games source-decision fields.');
 }
 return {ordinaryEvents:payload.ordinaryEvents,awardStacking:payload.awardStacking};
}


function gamesExternalEffects(state,payload){
 const effects=payload.ordinaryEventEffects;
 if(payload.ordinaryEvents.mode==='omit'){
  need(effects===undefined||Array.isArray(effects)&&effects.length===0,'Omitted events cannot also grant external event effects.');return [];
 }
 need(Array.isArray(effects)&&effects.length<=30,'Externally resolved events require an explicit ordinaryEventEffects array, including [] when there are none.');
 const result=copy(effects);
 for(const e of result){
  need(plain(e),'Invalid external event effect.');
  const fields=e.kind==='relationship'?['kind','role','name']:e.kind==='stat'?['kind','name','value']:['kind','value'];
  need(Object.keys(e).every(k=>fields.includes(k)),'Use only typed external event fields; no nested, random or career-changing effects.');
  if(e.kind==='stat'){
   need(typeof e.name==='string'&&Object.hasOwn(state.character.stats,e.name),'Choose an existing characteristic.');
   integer(e.value,-12,12,'External characteristic change');
  }else if(e.kind==='cash')integer(e.value,-10000000,10000000,'External cash change');
  else if(e.kind==='debt')integer(e.value,0,10000000,'External debt change');
  else if(e.kind==='relationship'){need(['Contact','Ally','Rival','Enemy'].includes(e.role),'Choose a supported relationship.');need(text(e.name,120),'Name or describe the event relationship.');}
  else throw new Error('This event consequence is not supported by the bounded Games route. Skills, rank, terms, arbitrary benefits and career transfers cannot be supplied.');
 }
 return result;
}
function finishPsionicGames(state){
 const record=gamesPending(state);need(record?.competition?.completed,'The Games completion decision is missing.');
 // External event effects are final adjudicated deltas after Games awards, never a second event/term.
 // Preflight on a copy so unsupported physical zero/medical outcomes remain blocked atomically.
 const preview=copy(state);applyEffects(preview,record.ordinaryEventEffects);
 need(['STR','DEX','END'].every(k=>preview.character.stats[k]>0),'A zero physical characteristic requires medical/injury resolution outside this bounded Games route.');
 need(preview.character.cash>=0,'Resolve external event funding without a negative cash balance.');
 applyEffects(state,record.ordinaryEventEffects);
 const {record:career}=currentCareer(state),before={age:state.character.age,terms:state.character.terms,careerTerms:career.terms,
  benefitRolls:career.benefitRolls,successfulTerms:career.successfulTerms,forcedStay:!!career.forcedStay,rank:career.rank};
 career.mishap=false;closeTerm(state);career.forcedStay=false;
 record.status='completed';record.benefitAccounting.actualDelta=career.benefitRolls-before.benefitRolls;
 record.completion={source:copy(PSIONIC_GAMES_SOURCE),durationSource:{id:'core',title:'Core Rulebook Update 2022',pages:[11]},
  termDelta:1,years:4,before,after:{age:state.character.age,terms:state.character.terms,careerTerms:career.terms,
   benefitRolls:career.benefitRolls,successfulTerms:career.successfulTerms,rank:career.rank},
  satisfiedForcedStay:before.forcedStay,ageingDue:state.stage==='ageing',externalEventEffectsTiming:'after-games-awards-before-term-close'};
 state.psionicGamesPending=null;
}

function applyEffects(state,effects) {
 need(Array.isArray(effects)&&effects.length<=30,'Too many effects.');
 for(const effect of effects) {
  need(plain(effect),'Invalid effect.');
  switch(effect.kind) {
   case 'skill':{const name=text(effect.name,80),newTalent=PSIONIC_TALENTS.includes(name)&&!Object.hasOwn(state.character.skills,name);gainSkill(state,name,integer(effect.value,0,4,'Skill value'),effect.mode==='set'?'set':'increase',true);if(newTalent)psionicHistory(state).historyKnown=false;break;}
   case 'stat':{
    const key=text(effect.name,8);need(Object.hasOwn(state.character.stats,key),'Unknown characteristic.');
    const change=integer(effect.value,-12,12,'Characteristic change');need(key!=='PSI'||!state.character.psionicLoss||change<=0,'Ageing permanently removed psionic ability; this source effect cannot restore it.');
    if(state.character.species==='aezorgh'&&key==='CHA')throw new Error('Aezorgh CHA is derived from SOC. Resolve its cross-book change explicitly.');
    const value=stat(state,key)+change;need(value>=0,'Characteristic cannot be negative.');
    const ceiling=maxStat(state,key);
    if(key==='SOC'&&value>ceiling)state.character.benefits.push({name:'Ship share',quantity:value-ceiling});
    setStat(state,key,Math.min(ceiling,value));break;
   }
   case 'cash':state.character.cash+=integer(effect.value,-10000000,10000000,'Cash');break;
   case 'debt':state.character.debt+=integer(effect.value,0,10000000,'Debt');break;
   case 'relationship':need(['Contact','Ally','Rival','Enemy'].includes(effect.role),'Invalid relationship.');addRelationship(state,effect.role,text(effect.name,120));break;
   case 'benefit':{const name=text(effect.name,120),quantity=integer(effect.value,1,100,'Quantity');if(/^clan shares?$/i.test(name))addClanShareLot(state,quantity);else state.character.benefits.push({name,quantity});break;}
   default:throw new Error('Unsupported effect.');
  }
 }
}
function advanceAfterBook(state,pending,payload,rolls) {
 if(pending.kind==='ageing'){if(state.character.species==='zhodani'&&state.ageingCheck?.statsBefore.PSI>0&&state.character.stats.PSI===0)markPermanentPsionicLoss(state);finishAgeing(state,rolls);return;}
 if(pending.kind==='native-effect'){if(pending.effect?.allocationId){const award=state.character.deferredSkillAwards?.find(a=>a.id===pending.effect.allocationId);need(award?.status==='pending','This award was already resolved.');award.status='source-resolved';award.resolution={note:payload.note??'',effects:copy(payload.effects??[])};}drainEffects(state,rolls);return;}
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
  if(state.benefitRollContext){state.character.benefitRollHistory??=[];state.character.benefitRollHistory.push({...copy(state.benefitRollContext),sourceAssisted:true,completed:true});state.benefitRollContext=null;}
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
 if(cashRollAccount(state)==='core')return 3;
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
 need(!state.character.psionicLoss,'Ageing permanently removed psionic potential; it cannot be retested.');
 const wasUntested=!Object.hasOwn(state.character.stats,'PSI'),result=psionicPotential({roll:natural,careerTerms}),history=psionicHistory(state,true);
 if(wasUntested&&!acquiredTalents(state).length&&!history.attempts.length&&!state.character.psionicTraining)history.historyKnown=true;
 history.tests.push({...result,context});setStat(state,'PSI',result.psi);return result;
}
function psionicOptions(state){
 const active=state.psionicTraining;if(!active||state.character.psionicLoss)return [];
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
 if(active.context==='companion-community'&&history.training.some(t=>t.completed)){active.mode='reuse';returnFromPsionics(state,rolls,true);return;}
 if(active.context==='companion-community'&&active.requiresTerms&&!active.termsResolved){psionicSource(state,'psionic-training-terms','Resolve access, testing/training charges and timing after confirming prior history. No completed course is charged again.');return;}
 if((state.character.stats.PSI??0)<=0){active.noPotential=true;returnFromPsionics(state,rolls,false);return;}
 active.attemptStart=history.attempts.length;state.pending=null;state.stage='psionic-training';
 if(active.mode==='retry'&&!psionicOptions(state).length){psionicSource(state,'psionic-retry','This talent cannot use the supported acquisition table. Resolve this source award explicitly.');return;}
}
function startPsionicTraining(state,config,rolls){
 need(!state.character.psionicLoss,'Ageing permanently removed psionic ability; training cannot restore it.');
 need(!state.psionicTraining,'Another psionic training opportunity is active.');
 state.psionicTraining={mode:'initial',...copy(config)};
 if(config.context==='companion-community'&&state.character.psionics&&(!state.character.psionics.historyKnown||state.character.psionics.training.some(t=>t.completed))){activatePsionicTraining(state,rolls);return;}
 if(config.context==='zhodani-elevation'&&state.character.psionics?.training.some(t=>t.completed)){psionicSource(state,'psionic-repeat-training','The Traveller has already completed initial psionic training. Resolve how this new societal training interacts with prior attempts; no free repeated checks are assumed.');return;}
 if(config.requiresTerms){psionicSource(state,'psionic-training-terms','Resolve access, testing/training charges and timing. Core testing takes two weeks and costs at least Cr5000; training takes four months and costs Cr100000. No free training, elapsed age or debt is assumed.');return;}
 if(config.test&&!Object.hasOwn(state.character.stats,'PSI')){if(!state.character.psionics)psionicHistory(state,true);recordPsionicTest(state,config.context,dice(state,2,rolls,'Psionic potential'),completedCareerTerms(state));}
 activatePsionicTraining(state,rolls);
}
function markPsionicOrigin(effects,origin){
 const result=copy(effects);function visit(value){if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;if(value.kind)value.psionicOrigin=copy(origin);for(const [key,item] of Object.entries(value))if(key!=='psionicOrigin')visit(item);}visit(result);return result;
}
function requestTalentAward(state,e,rolls){
 if(state.character.psionicLoss){nativeFallback(state,e,'Ageing permanently removed psionic ability. Resolve this mandatory talent result explicitly without restoring it.');return;}
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
 // Preserve legacy projected choices; new hobby lists mirror command eligibility.
 if(state.deferredSpecializations&&e.selectionId==='hobby')return (definitions??[]).filter(o=>skillNameAllowed(state,o.name,{scope:'any',exclude:e.exclude}));
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
   let r=ruling?.manual?ruling:companionCareerBenefits({resolvedEducationRulings:!!state.deferredSpecializations,id:record.id,graduation:record.graduation,careerId,assignment,curriculum:record.curriculum,firstCareerAfterEducation:state.character.careers.length===record.careersBefore,firstCareerExit:state.deferredSpecializations&&record.id==='companion.hard-knocks'?(state.character.careers.slice(record.careersBefore).some(c=>c.exit==='voluntary')?'voluntary':'involuntary'):state.character.careers[record.careersBefore]?.exit,citizenBranchApproved:ruling?.citizenBranchApproved,enteringCareer:entering,forcedNextCareer:state.forcedCareer});
   if(!r.resolved){rights.unresolved.push({kind:'unsupported',source:r.source??PRECAREER_RULES[record.id].source,reason:r.reason??('Resolve '+r.missingInputs.join(', ')),educationIndex:index,careerId,assignment,citizenMapping:record.id==='companion.merchant'&&careerId==='core.citizen'&&state.character.careers.length===record.careersBefore});continue;}
   rights.qualificationModifier+=r.qualificationModifier??0;rights.commissionModifier+=r.commissionModifier??0;rights.advancementModifier+=r.advancementModifier??0;rights.automaticEntry||=r.automaticEntry;
   if(r.entryRank!==null&&r.entryRank!==undefined){rights.entryRank=Math.max(rights.entryRank??0,r.entryRank);if(entering)rights.effects.push(...(r.effects??[]));}
   continue;
  }
  const r=educationCareerBenefits({resolvedEducationRulings:!!state.deferredSpecializations,id:record.id,graduation:record.graduation,careerId,assignment,
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
 if((extra.definitionId??award.definitionId)==='aslan.clan-share'){addClanShareLot(state,quantity,award);return;}
 const existing=state.character.benefits.find(b=>!b.assetId&&b.name===name&&b.definitionId===(extra.definitionId??award.definitionId));
 if(existing){if(!extra.nonnumeric)existing.quantity+=quantity;}
 else state.character.benefits.push({name,quantity,definitionId:extra.definitionId??award.definitionId,...copy(extra)});
 if(state.character.species==='aslan'&&state.character.culture==='native'&&state.character.outcast&&award.definitionId==='aslan.clan-share')forfeitAslanClanShares(state,'native-clan-share-award',{id:'aliens',page:22});
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
 if(state.correctedCareerEvents&&record.id==='aslan.space-officer'){const mapping=aslanSpaceOfficerRankMapping(record.assignment);if(mapping){record.aslanRankMapping=mapping;const offer=state.character.aslanOfficerOffers?.find(o=>o.id===record.aslanOfficerOfferId);if(offer)offer.rankMapping=copy(mapping);return aslanOfficerRankEffects(mapping.tableId,record.rank);}}
 if(record.id==='aslan.space-officer'&&record.assignment!=='commander'&&record.aslanOfficerOfferId){if(record.aslanRankMapping)return aslanOfficerRankEffects(record.aslanRankMapping.tableId,record.rank);return [{kind:'aslan-officer-rank-choice',source:{id:'aliens',page:39}}];}
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
function legacyCareerEffects(value){
 if(!value||typeof value!=='object')return value;
 if(value.kind==='career-status'&&value.timing==='term-end')delete value.timing;
 if(value.kind==='promotion'&&value.mode==='immediate')value.mode='automatic';
 if(value.kind==='believer-buyout')value.kind='source-required';
 delete value.believerBuyoutChoice;
 for(const child of Object.values(value))legacyCareerEffects(child);
 return value;
}
function queueEffects(state,effects,next,rolls) {
 state.effectsQueue=state.correctedCareerEvents?copy(effects):legacyCareerEffects(copy(effects));state.effectNext=next;state.effectSteps=0;return drainEffects(state,rolls);
}
function completeEffects(state,rolls) {
 const next=state.effectNext;state.effectsQueue=[];state.effectNext=null;state.pendingChoice=null;
 if(next==='specialization-command'){const saved=state.specializationContinuation;delete state.specializationContinuation;state.stage=saved.stage;if(saved.pendingChoice!==undefined)state.pendingChoice=saved.pendingChoice;if(saved.effectsQueue!==undefined)state.effectsQueue=saved.effectsQueue;if(saved.effectNext!==undefined)state.effectNext=saved.effectNext;apply(state,saved.command,rolls);return;}
 if(next==='aslan-origin-family'){finishAslanFamily(state);return;}
 if(next==='aslan-origin-complete'){state.character.aslanOrigin.status='completed';state.character.aslanOrigin.rite.effectsResolved=true;state.stage='precareer';return;}
 if(next==='education-finish'){educationFinish(state,rolls);return;}
 if(next==='education-graduation'){if(!educationRecord(state).graduationAllowed)educationFinish(state,rolls);else state.stage=next;return;}
 if(next==='end-term'){closeTerm(state);return;}
 if(next==='psionic-games-complete'){finishPsionicGames(state);return;}
 if(next==='ageing-finish'){finishAgeing(state,rolls);return;}
 if(next==='ageing-crisis'){
  const preliminary=ageingCrisis({stats:state.character.stats});if(preliminary.crisis){
   const costDie=dice(state,1,rolls,'Ageing crisis medical cost'),outcome=ageingCrisis({stats:state.character.stats,medicalDie:costDie});state.character.ageingCrises??=[];const index=state.character.ageingCrises.length;
   state.character.ageingCrises.push({source:copy(outcome.source),medicalDie:costDie,cost:outcome.cost,affected:copy(outcome.affected),statsBefore:copy(state.character.stats),resolved:false});
   const effects=copy(outcome.effects);for(const option of effects[0].options)for(const effect of option.effects){if(effect.kind==='medical-cost'){effect.context='ageing-crisis';effect.crisisIndex=index;}if(effect.kind==='death')effect.crisisIndex=index;}
   queueEffects(state,effects,'ageing-finish',rolls);
  }else finishAgeing(state,rolls);return;
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
 if(state.deferredSpecializations)name=normalizedSkill(state,name).name;
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

function coreTalentChoice(state,effect){
 return effect.scope==='psionic-talents'&&effect.untrained==='acquisition-check'&&state.active!==null&&currentCareer(state).career.id==='core.psion'&&effect.psionicOrigin?.table==='service';
}
function availableNewTalents(state){return PSIONIC_TALENTS.filter(name=>name!=='Technopathy'&&skillLevel(state,name)<0);}
function constrainedAward(state,name,e){
 // A two-level award starts an absent skill at 2, rather than the ordinary one-level default.
 return e.scope==='science-medic-electronics'&&!Object.hasOwn(state.character.skills,name)?{...e,mode:'set'}:e;
}
// Core 2022 p. 71 lists these non-psionic Science specialities. Open subjects
// are not presumed eligible for Aliens p. 201's non-psionic training award.
const NON_PSIONIC_SCIENCES=new Set(['archaeology','astronomy','biology','chemistry','cosmology','cybernetics','economics','genetics','history','linguistics','philosophy','physics','planetology','psychology','robotics','sophontology','xenology']);
function nonPsionicEligibility(name){
 const {base,speciality}=normalizeSkillName(name);
 if(PSIONIC_TALENTS.includes(base)||/psion|telepath|telekin|clairvoy|teleport|technopath|extrasensory|precogn|psychokin|mind[ -]*(read|control)|remote[ -]*view/i.test(speciality??''))return 'excluded';
 if(base==='Science'&&!NON_PSIONIC_SCIENCES.has(speciality?.toLowerCase()))return 'source-required';
 return 'eligible';
}
function skillNameAllowed(state,name,effect) {
 let parsed;try{parsed=normalizedSkill(state,name);}catch{return false;}name=parsed.name;const base=parsed.base;
 if(state.deferredSpecializations&&(['Independence','Tolerance'].includes(base)&&state.character.species!=='aslan'||base==='Independence'&&state.character.gender!=='male'))return false;
 if(PSIONIC_TALENTS.includes(base)&&(state.character.psionicLoss||skillLevel(state,name)<0&&!coreTalentChoice(state,effect)&&effect.scope!=='new-psionic-talent'))return false;
 if(coreTalentChoice(state,effect)&&base==='Technopathy')return false;
 if(effect.scope==='new-psionic-talent'&&(!availableNewTalents(state).includes(name)||(state.character.stats.PSI??0)<=0))return false;
 if(effect.scope==='non-psionic'&&nonPsionicEligibility(name)!=='eligible')return false;
 if(effect.scope==='untrained-electronics-or-science'&&(!['Electronics','Science'].includes(base)||Object.hasOwn(state.character.skills,name)))return false;
 if(effect.scope==='science-medic-electronics'&&!['Science','Medic','Electronics'].includes(base))return false;
 if(!SKILLS.includes(base))return false;
 if(effect.exclude?.includes(base))return false;
 if(effect.scope==='existing'&&skillLevel(state,name)<0)return false;
 if(effect.scope==='science-specialties'&&base!=='Science')return false;
 if(effect.scope==='psionic-talents'&&(!['Telepathy','Clairvoyance','Telekinesis','Awareness','Teleportation','Technopathy'].includes(base)||skillLevel(state,name)<0&&!coreTalentChoice(state,effect)))return false;
 if(effect.allowed&&!effect.allowed.includes(base))return false;
 if(effect.permittedNames&&!effect.permittedNames.includes(name))return false;
 if(effect.tableSkills&&!tableSkillAllowed(name,effect.tableSkills))return false;
 if(['assignment','eligible-career'].includes(effect.scope)&&!effect.tableSkills)return false;
 return true;
}
export function skillChoiceSuggestions(state){
 if(state.stage!=='skill-choice'||!state.pendingChoice)return [];
 const effect=state.pendingChoice,requireSpeciality=!effect.deferSpeciality&&(effect.mode!=='set'||(effect.value??1)>0);
 const entries=effect.kind==='skill-reduction-choice'?(effect.names??Object.keys(state.character.skills)):effect.permittedNames??effect.tableSkills??effect.allowed??SKILLS;
 const candidates=entries.flatMap(name=>Array.isArray(SPECIALITIES[name])?[...(!requireSpeciality?[name]:[]),...SPECIALITIES[name].map(speciality=>name+' ('+speciality+')')]:[name]);
 candidates.push(...Object.keys(state.character.skills));
 return [...new Set(candidates)].filter(name=>{try{normalizeSkillName(name,{requireSpeciality});if(effect.distinctSpecialties)distinctScienceSelection(name,effect.selected??[]);if(effect.kind==='skill-reduction-choice'&&(!(state.character.skills[name]>0)||effect.names&&!effect.names.includes(name)))return false;return skillNameAllowed(state,name,effect)&&(!effect.allocationId||allocationImproves(state,name,effect));}catch{return false;}}).sort((a,b)=>a.localeCompare(b,'en'));
}
function skillChoiceBases(state){
 const suggestions=skillChoiceSuggestions(state),bases=suggestions.map(n=>n.split(' (')[0]);
 if(state.stage==='skill-choice'&&state.pendingChoice)for(const base of ['Science','Language','Profession']){
  let subject=base==='Science'?'physics':base==='Language'?'galanglic':'construction';
  if(state.pendingChoice.scope==='untrained-electronics-or-science'){let i=1;while(Object.hasOwn(state.character.skills,base+' ('+subject+')'))subject='new subject '+i++;}
  if(skillNameAllowed(state,base+' ('+subject+')',state.pendingChoice))bases.push(base);
 }
 return [...new Set(bases)].sort();
}
const SPECIALIZED = Object.keys(SPECIALITIES);
function nativeFallback(state,effect,reason) {
 const career=state.active!==null?currentCareer(state).career:state.education!==undefined&&state.education!==null?{source:'core',page:17}:{source:effect.source?.id??'core',page:effect.source?.page??16};
 sourceStep(state,'native-effect',effect.source?.id??career.source,effect.source?.page??effect.source?.pages?.[0]??effect.sourcePage??career.page,reason??effect.reason??('Resolve '+effect.kind+' from the source.'),'native-resume');
 state.pending.effect=copy(effect);
}
// Bind only a completed award, never a generic skill's strongest other speciality.
// Keep the check queued independently so source-assisted disposal cannot erase it.
function bindAwardCheck(state,name) {
 const check=state.effectsQueue?.[0];
 if(check?.kind==='check'&&check.skillScope==='preceding-award')check.awardedSkill=name;
}
function drainEffects(state,rolls) {
 while(state.effectsQueue?.length) {
  state.effectSteps=(state.effectSteps??0)+1;need(state.effectSteps<200,'Rule-effect loop limit reached.');
  const e=state.effectsQueue.shift();need(e&&typeof e.kind==='string','Malformed source effect.');if(!state.correctedCareerEvents)legacyCareerEffects(e);
  if(state.deferredSpecializations){
   const dependent=(e.kind==='check'&&(!e.stat||e.skillScope))||e.kind==='skill-reduction-choice'||e.kind==='education-skill-choice'&&e.existingOnly||e.kind==='benefit-wager'||e.kind==='weapon-skill-choice'||e.kind==='sainthood'||e.kind==='skill-choice'&&!deferrableChoice(state,e)&&!e.allocationId;
   const dependencyNames=e.kind==='check'?e.skills:e.kind==='benefit-wager'?BENEFIT_WAGERS[e.route]?.skills:e.kind==='weapon-skill-choice'?e.allowedBases:e.kind==='sainthood'?['Science']:e.kind==='skill-reduction-choice'?e.names:e.kind==='skill-choice'?e.permittedNames??e.allowed:undefined;
   const dependencyBases=dependencyNames?.map(name=>name.split(' (')[0]);
   if(dependent&&requireAllocationsBefore(state,e,dependencyBases))continue;
   if(e.kind==='skill'&&e.name.includes(' (')&&requireAllocationsBefore(state,e,e.name.split(' (')[0]))continue;
  }
  switch(e.kind) {
   case 'core-life-complete':{const r=state.character.lifeEvents.find(r=>r.id===e.lifeEventId);r.status='completed';break;}
   case 'core-life-benefit-bonus':{state.character.lifeBenefitBonuses??=[];state.character.lifeBenefitBonuses.push({id:e.lifeEventId,source:copy(CORE_LIFE_SOURCE),value:2,status:'available'});break;}
   case 'prisoner-lawyer':{
    const {career,record}=currentCareer(state);need(career.id==='core.prisoner','The lawyer opportunity requires the Prisoner career.');
    state.character.prisonerLawyers??=[];const entry={id:'prisoner-lawyer-'+(state.character.prisonerLawyers.length+1),source:{id:'core',page:57},careerIndex:state.active,careerTerms:record.terms,status:'pending',paroleBefore:record.parole};state.character.prisonerLawyers.push(entry);
    sourceStep(state,'prisoner-lawyer','core',57,'Choose whether to hire a lawyer','native-resume');state.pending.lawyerId=entry.id;return;
   }
   case 'core-life-decision':sourceStep(state,'core-life-decision','core',46,e.label,'native-resume');Object.assign(state.pending,{decision:e.decision,lifeEventId:e.lifeEventId});return;
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
   case 'zhodani-status-review':if(reviewZhodaniStatus(state,'unusual-event',rolls,'native-resume'))return;break;
   case 'zhodani-ageing-psi':need(state.character.stats.PSI>0&&!state.character.psionicLoss,'Choose an available characteristic for mental ageing.');sourceStep(state,'zhodani-ageing-psi','aliens',277,'Confirm the referee choice of PSI for this mental ageing loss.','native-resume');return;
   case 'psionic-talent':{if(state.character.psionicLoss){nativeFallback(state,e,'Ageing permanently removed psionic ability. Resolve this mandatory talent result explicitly without restoring it.');return;}if(e.name&&PSIONIC_TALENTS.includes(e.name)&&skillLevel(state,e.name)>=0){if(skillAwardExceedsLimit(state,e.name,e.value??1,e.mode)){nativeFallback(state,e,'This mandatory talent award would exceed the total skill limit. Adjudicate the award from the source.');return;}gainSkill(state,e.name,e.value??1,e.mode);break;}requestTalentAward(state,e,rolls);return;}
   case 'checked-skill':{
    const name=educationRecord(state).checkedSkill;need(name,'The education check skill was not recorded.');
    state.effectsQueue.unshift({kind:'skill',name,mode:e.mode,value:e.value});break;
   }
   case 'psionic-test':{
    if(!Object.hasOwn(state.character.stats,'PSI'))recordPsionicTest(state,'source-event',dice(state,2,rolls,'Psionic potential'),completedCareerTerms(state));
    break;
   }
   case 'career-permission':if(e.career==='core.psion')state.character.psionEntryPermission=true;else {nativeFallback(state,e);return;}break;
   case 'choice':if(state.correctedCareerEvents&&e.believerBuyoutChoice){const plan=believerBuyoutPlan(currentCareer(state).record,state.character.lifeBenefitLosses,state.active);e.label=believerBuyoutChoice(plan);e.buyoutPlan=plan;e.options[0].label='Accept: roll 2D once x forfeited rolls';e.options[0].effects[0].calculation='once';e.options[1].label='Refuse payment and gain 1D Enemies';e.options.push({label:'Accept: separate 2D per forfeited roll',effects:[{...copy(e.options[0].effects[0]),calculation:'separate'}]});}state.pendingChoice=e.guard==='zhodani-government-defence'&&state.character.psionicLoss?.permanent?{...e,options:e.options.filter(o=>o.label!=='PSI'),unavailableOptions:[{label:'PSI',reason:'Permanent psionic loss prevents this defence option.'}]}:e;state.stage='effect-choice';return;
   case 'skill-choice':
    if(['assignment','eligible-career'].includes(e.scope)&&state.active!==null){
     const {career,record}=currentCareer(state),choice=vargrTrainingChoice({careerId:career.id,assignment:record.assignment,pack:nativePack(state),eligibleTables:trainingOptions(state).map(t=>t.id),effect:e});
     if(choice?.tableSkills.length){if(deferrableChoice(state,choice))choice.deferSpeciality=true;state.pendingChoice=choice;state.stage='skill-choice';return;}
    }
    if(state.character.psionicLoss&&(['psionic-talents','new-psionic-talent'].includes(e.scope)||e.allowed?.length&&e.allowed.every(n=>PSIONIC_TALENTS.includes(n)))){nativeFallback(state,e,'Ageing permanently removed psionic ability. Resolve this constrained award explicitly without restoring historical talents.');return;}
    if(e.scope==='new-psionic-talent'&&(!(state.character.stats.PSI>0)||!availableNewTalents(state).length)){nativeFallback(state,e,'No eligible new talent is available. Resolve the source award explicitly without restoring lost ability or inventing a replacement.');return;}
    if(e.scope==='psionic-talents'&&!coreTalentChoice(state,e)&&!acquiredTalents(state).length){nativeFallback(state,e,'This result improves an already acquired psionic talent, but none is possessed. Resolve the source award explicitly; it does not grant free acquisition.');return;}
    if(!['any','existing','science-specialties','psionic-talents','untrained-electronics-or-science','science-medic-electronics','non-psionic','new-psionic-talent'].includes(e.scope)||(e.distinctSpecialties&&e.scope!=='science-specialties')||e.untrained&&!coreTalentChoice(state,e)){nativeFallback(state,e,'Resolve the constrained skill choice from the source.');return;}
    if(deferrableChoice(state,e))e.deferSpeciality=true;
    state.pendingChoice=e.scope==='science-specialties'?{...e,selected:e.selected??[],source:copy(e.source??e.reeducationOrigin?.source??{id:currentCareer(state).career.source,page:currentCareer(state).career.page+1}),label:'Choose a Science specialisation'}:e;state.stage='skill-choice';return;
   case 'skill-reduction-choice':{const eligible=Object.keys(state.character.skills).filter(n=>state.character.skills[n]>0&&(!e.names||e.names.includes(n))&&skillNameAllowed(state,n,e));if(!eligible.length){nativeFallback(state,e,'No eligible trained skill can satisfy this reduction. Resolve the printed mishap explicitly before continuing.');return;}state.pendingChoice=e;state.stage='skill-choice';return;}
   case 'skill':{
    const base=e.name.split(' (')[0];
    if(state.deferredSpecializations&&base==='Independence'&&(e.value??1)>0){state.effectsQueue.unshift({...e,kind:'independence'});break;}
    if(state.character.psionicLoss&&PSIONIC_TALENTS.includes(base)){nativeFallback(state,e,'Ageing permanently removed psionic ability. Resolve this mandatory talent award explicitly without restoring it.');return;}
    if(PSIONIC_TALENTS.includes(base)&&skillLevel(state,e.name)<0){requestTalentAward(state,e,rolls);return;}
    if(state.deferredSpecializations&&(e.value??1)>0&&SPECIALIZED.includes(base)&&e.name===base&&!e.immediateSpeciality&&state.effectsQueue?.[0]?.skillScope!=='preceding-award'){deferSkillAward(state,e);break;}
    if(e.value>0&&SPECIALIZED.includes(base)&&e.name===base){state.pendingChoice={...copy(e),kind:'skill-choice',scope:'any',allowed:[base],mode:e.mode,value:e.value,...(e.awardId?{awardId:e.awardId}:{}),label:'Choose a '+base+' specialisation'};state.stage='skill-choice';return;}

    if(skillAwardExceedsLimit(state,e.name,e.value??1,e.mode)){nativeFallback(state,e,'This mandatory skill award would exceed the total skill limit. Resolve its disposal from Core p. 18 without exceeding the cap.');return;}gainSkill(state,e.name,e.value??1,e.mode);bindAwardCheck(state,e.name);break;
   }
   case 'stat':{
    if(state.character.species==='aezorgh'&&e.name==='CHA'){nativeFallback(state,e,'Aezorgh CHA is derived from SOC. Resolve this cross-book effect explicitly.');return;}
    if(!Object.hasOwn(state.character.stats,e.name)){nativeFallback(state,e,'The '+e.name+' characteristic is absent for this species. Resolve the cross-species benefit from the source.');return;}
    if(e.name==='PSI'&&state.character.psionicLoss&&(e.value>0||e.mode==='minimum')){nativeFallback(state,e,'Ageing permanently removed psionic ability. This gain cannot restore it.');return;}
    const current=stat(state,e.name),ceiling=e.maximum??(e.name==='SOC'&&state.character.species==='zhodani'&&current<10?9:maxStat(state,e.name));
    if(e.dice)e.value=mechanicalDice(state,e.dice,rolls,e.name+' change')*(e.multiplier??1)+(e.add??0);
    let next=e.mode==='minimum'?Math.max(current,e.value):Math.max(e.minimum??0,current+e.value);
    if(e.name==='SOC'&&next>ceiling)state.character.benefits.push({name:'Ship Share',quantity:next-ceiling});
    setStat(state,e.name,Math.min(ceiling,Math.max(0,next)));
    if(state.character.species==='aezorgh'&&e.name==='SOC')state.character.stats.CHA=Math.floor(state.character.stats.SOC/2);
    if(e.ageingOrigin&&e.name==='PSI'&&current>0&&state.character.stats.PSI===0)markPermanentPsionicLoss(state);
    if(state.character.species==='zhodani'&&state.active!==null&&e.name==='PSI'&&current<9&&state.character.stats.PSI>=9&&(state.character.stats.SOC??0)<10&&reviewZhodaniStatus(state,'career-psi-gain',rolls,'native-resume'))return;
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
   case 'relationship-change':case 'relationship-remove':{
    const career=currentCareer(state).career;
    if(!['core.drifter','core.entertainer','core.rogue','core.psion','aslan.outcast','aslan.outlaw'].includes(e.tableCareerId??career.id)){nativeFallback(state,e,'Resolve this relationship effect from its source.');return;}
    const eligible=state.character.relationships.filter(r=>(e.from??e.types).includes(r.role));
    if(!eligible.length&&e.kind==='relationship-change'&&!e.fallback){nativeFallback(state,{...e,source:e.source??{id:career.source,page:career.page+1}},'No eligible Contact or Ally exists. The source gives no replacement relationship; resolve this ambiguity explicitly.');return;}
    state.pendingChoice={...copy(e),source:copy(e.source??{id:career.source,page:career.page+1}),careerId:career.id,careerIndex:state.active,relationshipsBefore:copy(state.character.relationships)};
    state.stage='relationship-event';return;
   }
   case 'zhodani-relationship-loss':state.pendingChoice={...copy(e),source:copy(e.source??{id:'aliens',page:273}),label:'Choose an Ally or Contact to lose',relationshipsBefore:copy(state.character.relationships)};state.stage='relationship-loss';return;
   case 'relationship':{
    const count=e.countFrom?Math.max(e.countFrom.minimum??0,characteristicDM(stat(state,e.countFrom.statDM))):e.dice?mechanicalDice(state,e.dice,rolls,e.type+' count'):(e.count??1);
    if(!e.onlyIfAbsent||!state.character.relationships.some(r=>r.role===e.type))for(let i=0;i<count;i++)addRelationship(state,e.type,e.name??('Unnamed '+e.type.toLowerCase()));
    break;
   }
   case 'check':{
    if(e.skillScope==='preceding-award'){
     if(!e.awardedSkill){nativeFallback(state,e,'The preceding skill award was resolved manually or skipped. Resolve its required skill check and consequences explicitly from the source; no awarded speciality or automatic outcome is assumed.');return;}
     e.skills=[e.awardedSkill];
    }
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
    else if(e.mode==='lose-all'){record.benefitRolls=0;if(state.correctedCareerEvents)record.forfeitedRankBenefitRolls=rankBenefitRolls(record);}
    else record.benefitRolls=Math.max(0,record.benefitRolls+(e.dice?mechanicalDice(state,e.dice,rolls,'Benefit rolls')*(e.value??1):e.value??0));break;
   }
   case 'aslan-access-right':grantAslanAccess(state,e);break;
   case 'career-status':{
    if(state.active===null&&e.action==='next'){
     state.forcedCareer=e.career;state.forcedCareerDraft=!!e.viaDraft;
     if(e.viaDraft)state.draftUsed=true;
     if(e.career==='core.prisoner')state.character.sentenced=true;
     if(state.education!==undefined&&state.education!==null)educationRecord(state).graduationAllowed=false;
     break;
    }
    const {record}=currentCareer(state);
    if(grantCareerTransfer(state,e))break;
    if(e.assignment||e.retainRank||e.careerGroup||e.careerChoices){nativeFallback(state,e,'Resolve this specific career transfer from the source.');return;}
    if(e.action==='stay')record.forcedExit=false;
    else if(e.action==='exit'){if(state.correctedCareerEvents&&e.timing==='term-end'){record.eventExitAtTermEnd={source:copy(e.source??{id:'core',page:45}),reason:'Cannot re-enlist after this term.'};break;}record.forcedExit=true;if(record.id==='core.prisoner'){record.released=true;record.escaped=true;}}
    else if(e.action==='next'){if(state.correctedCareerEvents&&record.id==='core.drifter'&&e.career==='draft'){record.eventExitAtTermEnd={source:{id:'core',page:29},reason:'Forced draft next term.'};state.forcedCareer='draft';state.forcedDraft={status:'pending',originCareerIndex:state.active,source:{id:'core',page:29}};break;}record.forcedExit=true;state.forcedCareer=e.career;if(e.career==='core.prisoner')state.character.sentenced=true;}
    else if(e.action==='auto-qualify'){state.automaticCareers??=[];state.automaticCareers.push(e.career);}
    else {nativeFallback(state,e);return;}break;
   }
   case 'promotion':{const {record}=currentCareer(state);if(state.correctedCareerEvents&&e.mode==='immediate'&&record.id==='companion.believer'){const previous=record.rank;record.rank=Math.min(6,record.rank+1);record.highestRank=Math.max(record.highestRank??0,record.rank);if(record.rank>previous)state.effectsQueue.unshift(...rankEffects(state));break;}record.automaticPromotion=true;if(e.allowCommission)record.automaticCommission=true;break;}
   case 'benefit-credit':{const {career}=currentCareer(state);state.character.benefitCredits??=[];state.character.benefitCredits.push({id:'benefit-credit-'+(state.character.benefitCredits.length+1),source:copy(e.source),originCareerId:career.id,originCareerIndex:state.active,value:e.value,scope:e.scope,status:'available',consumption:null});break;}
   case 'zhodani-advisory':beginAdvisory(state);return;
   case 'advisory-ready':{const record=advisoryRecord(state);assertAdvisoryContext(state,record);need(record.id===e.id,'The advisory entitlement changed.');record.status='awaiting-cash';state.stage='advisory-cash';return;}
   case 'agent-cover':beginCoverChoice(state,e);return;
   case 'zhodani-undercover':beginUndercover(state,rolls);break;
   case 'cross-career-training':{const route=crossCareerRoute(state,e.routeId);assertCrossCareerContext(state,route);need(route.check.success&&!route.training,'The borrowed training is already resolved.');route.status='awaiting-training';state.pendingCrossCareerTraining=route.id;state.stage='cross-career-training';return;}
   case 'cross-career-complete':{const route=crossCareerRoute(state,e.routeId);assertCrossCareerContext(state,route);route.status='completed';route.completion={age:state.character.age,generationTerms:state.character.terms};break;}
   case 'benefit-wager':{
    const {career,record}=currentCareer(state),rule=BENEFIT_WAGERS[e.route];
    const borrowed=e.crossCareerRouteId?crossCareerRoute(state,e.crossCareerRouteId):null;
    if(borrowed)assertCrossCareerContext(state,borrowed);
    need(rule&&(rule.careerId===career.id||career.id==='core.agent'&&rule.careerId==='core.rogue'&&e.tableCareerId===rule.careerId&&borrowed?.kind==='cover-undercover'&&borrowed.coverCareerId===rule.careerId&&borrowed.check?.success),'The wager career does not match its source.');
    state.character.benefitWagers??=[];
    const wager={id:'benefit-wager-'+(state.character.benefitWagers.length+1),route:e.route,source:copy(rule.source),sourceCareerId:rule.careerId,crossCareerRouteId:borrowed?.id??null,careerId:career.id,careerIndex:state.active,assignment:record.assignment,available:record.benefitRolls,maximum:wagerLimit(e.route,record.benefitRolls),skills:copy(rule.skills),status:'pending',continuation:state.effectNext};
    state.character.benefitWagers.push(wager);state.pendingBenefitWager=wager.id;state.stage='benefit-wager';return;
   }
   case 'benefit-wager-complete':state.character.benefitWagers.find(w=>w.id===e.id).status='completed';break;
   case 'merchant-fine':beginMerchantFine(state,e);return;
   case 'source-training-roll':{
    const {career,record}=currentCareer(state),navy=e.trainingRoute==='navy-mishap-4',citizen=e.trainingRoute==='vargr-citizen-event-4';
    need((navy&&career.id==='core.navy'||citizen&&career.id==='vargr.citizen')&&state.active===e.careerIndex&&record.assignment===e.assignment,'The source training context changed.');
    need(navy?trainingOptions(state).some(t=>t.id===e.table):e.table==='advanced','This source does not permit that training table.');
    const pack=nativePack(state),rows=e.table==='assignment'?pack.training.assignments[record.assignment]:pack.training[e.table];
    need(rows?.length===6,'The source training table must have six rows.');
    const die=dice(state,1,rolls,'Source training: '+e.table+' ('+e.source.id+' p. '+e.source.page+')');
    state.character.sourceTraining??=[];
    const award={id:'source-training-'+(state.character.sourceTraining.length+1),route:e.trainingRoute,source:copy(e.source),careerId:career.id,careerIndex:state.active,assignment:record.assignment,table:e.table,die,status:'pending'};
    state.character.sourceTraining.push(award);
    state.effectsQueue.unshift(...sourcedEffects(rows[die-1],e.source),{kind:'source-training-complete',awardId:award.id});break;
   }
   case 'source-training-complete':state.character.sourceTraining.find(a=>a.id===e.awardId).status='completed';break;
   case 'table-roll':{
    if(CORE_LIFE_TABLES[e.table]){
     const table=CORE_LIFE_TABLES[e.table],row=mechanicalDice(state,table.dice,rolls,e.table);
     state.character.lifeEvents??=[];
     const record={id:'life-event-'+(state.character.lifeEvents.length+1),table:e.table,row,source:copy(CORE_LIFE_SOURCE),age:state.character.age,careerId:state.active===null?null:currentCareer(state).career.id,careerIndex:state.active,parentId:e.lifeEventId??null,status:'pending',decision:null};
     state.character.lifeEvents.push(record);
     state.effectsQueue.unshift(...sourcedEffects(table.results[row],CORE_LIFE_SOURCE).map(effect=>({...effect,lifeEventId:record.id})),{kind:'core-life-complete',lifeEventId:record.id});break;
    }
    if(e.table==='zhodani.re-education'){beginReeducation(state,e);return;}
    if(state.active===null){
     const shared=EXPANSION_TABLES[e.table];
     if(shared){const result=mechanicalDice(state,e.dice??shared.dice,rolls,e.table);state.effectsQueue.unshift(...copy(shared.results[result]??[{kind:'unsupported',reason:'Shared table result not encoded.'}]));break;}
     nativeFallback(state,e,'Resolve '+e.table+' from the source, including any required career or education consequences.');return;
    }
    const current=currentCareer(state);
    const navy=e.trainingRoute==='navy-mishap-4'&&current.career.id==='core.navy'&&e.table==='training'&&e.chooseAvailableTable&&e.source?.id==='core'&&e.source.page===37;
    const citizen=e.trainingRoute==='vargr-citizen-event-4'&&current.career.id==='vargr.citizen'&&e.table==='training.advanced'&&e.ignorePrerequisite&&e.source?.id==='aliens'&&e.source.page===191;
    if(navy||citizen){
     const effect=table=>({kind:'source-training-roll',trainingRoute:e.trainingRoute,table,source:copy(e.source),careerIndex:state.active,assignment:current.record.assignment});
     if(navy)state.effectsQueue.unshift({kind:'choice',source:copy(e.source),label:'Choose a qualifying Navy training table (Core p. 37)',options:trainingOptions(state).map(t=>({label:t.name,effects:[effect(t.id)]}))});
     else state.effectsQueue.unshift(effect('advanced'));
     break;
    }
    const {career,record}=current,tableCareerId=e.career??e.tableCareerId??career.id,tableCareer=findCareer(tableCareerId),pack=RULE_PACK[tableCareerId];
    if(e.chooseAvailableTable||e.ignorePrerequisite||e.tableChoice){nativeFallback(state,e,'Resolve this special table route from the source.');return;}
    const shared=EXPANSION_TABLES[e.table];
    if(shared){const result=mechanicalDice(state,e.dice??shared.dice,rolls,e.table);const row=shared.results[result];if(!row){nativeFallback(state,e,'Shared table result needs source resolution.');return;}const sharedSource={id:shared.source.id,page:shared.source.page??shared.source.pages?.[0]},origin=e.reeducationOrigin??reeducationOrigin(state,'shared',result);let effects=withReeducationOrigin(sourcedEffects(row,sharedSource),e.tableCareerId?{...copy(origin),table:e.table,row:result,source:sharedSource}:origin);if(e.tableCareerId){effects=borrowedEffects(effects,{tableCareerId:e.tableCareerId,crossCareerRouteId:e.crossCareerRouteId});if(e.crossCareerRouteId)crossCareerRoute(state,e.crossCareerRouteId).tables.push({careerId:e.tableCareerId,table:e.table,row:result,source:sharedSource});}state.effectsQueue.unshift(...effects);break;}
    const isMishap=['mishap','mishaps','core.mishap'].includes(e.table),isEvent=['event','events','core.events'].includes(e.table);
    if(pack&&(isMishap||isEvent)){
     if(isMishap&&!e.keepCareer&&career.id!=='core.prisoner')record.forcedExit=true;
     const result=mechanicalDice(state,e.dice??(isMishap?'1D':'2D'),rolls,e.table);
     const origin=reeducationOrigin(state,isMishap?'mishap':'event',result,{...copy(e.reeducationOrigin??{}),...(e.tableCareerId?{tableCareerId}:{} )});if(e.keepCareer){origin.protectedStay=true;origin.protectedExitBefore=!!record.forcedExit;}
     let effects=withReeducationOrigin((isMishap?pack.mishaps:pack.events)[result]??[{kind:'unsupported',reason:'Table result not encoded.'}],origin);
     if(e.tableCareerId){effects=borrowedEffects(sourcedEffects(effects,{id:tableCareer.source,page:tableCareer.page+1}),{tableCareerId,crossCareerRouteId:e.crossCareerRouteId});if(e.crossCareerRouteId)crossCareerRoute(state,e.crossCareerRouteId).tables.push({careerId:tableCareerId,table:isMishap?'mishap':'event',row:result,source:{id:tableCareer.source,page:tableCareer.page+1}});}
     state.effectsQueue.unshift(...effects,...(e.keepCareer?[{kind:'keep-career',forcedExit:record.forcedExit??false}]:[]));
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
   case 'death':{for(const event of state.character.lifeEvents??[])if(event.status==='pending')event.status='deceased';for(const route of state.character.crossCareerRoutes??[])if(route.status!=='completed'){route.status='deceased';route.completion={age:state.character.age,generationTerms:state.character.terms,cause:'death-before-route-completion'};}state.pendingCrossCareerTraining=null;const advisory=advisoryRecord(state);if(advisory){advisory.status='deceased';advisory.completion={age:state.character.age,generationTerms:state.character.terms};state.advisoryService=null;}for(const episode of state.character.reeducations??[])if(['treatment','deferred','decisions'].includes(episode.status)){const deferred=episode.status==='deferred';episode.status='deceased';episode.completion={cause:deferred?'death-before-treatment':e.cause??'death',age:state.character.age};}state.reeducation=null;state.treatmentAgeing=null;}if(e.crisisIndex!==undefined){Object.assign(state.character.ageingCrises[e.crisisIndex],{resolved:true,careAccepted:false,paid:0});}state.character.deceased=true;state.stage='deceased';state.effectsQueue=[];state.effectNext='deceased';break;
   case 'rank':{const {record}=currentCareer(state);record.rank=Math.max(0,Math.min(6,record.rank+e.value));break;}
   case 'advancement-block':currentCareer(state).record.advancementBlock=e.terms;break;
   case 'benefit-block':currentCareer(state).record.benefitBlock=e.terms;break;
   case 'aslan-restoration-opportunity':beginAslanRestoration(state);return;
   case 'aslan-outlaw-restoration':beginAslanOutlawRestoration(state);return;
   case 'aslan-outlaw-restoration-awarded':{const r=state.character.aslanOutlawRestorations.find(r=>r.id===e.restorationId);need(r,'The Outlaw restoration award record is missing.');r.shareAwardIds=(state.character.benefitAwards??[]).slice(e.awardStart).filter(a=>a.definitionId==='aslan.clan-share').map(a=>a.id);break;}
   case 'aslan-outcast':forfeitAslanClanShares(state,'source-outcast-effect',e.source??{id:'aliens',page:22},true);currentCareer(state).record.forcedExit=true;break;
   case 'officer-qualification-opportunity':grantAslanOfficerOffer(state,e);break;
   case 'aslan-officer-rank-choice':{const {record}=currentCareer(state);state.pendingAslanOfficerRank={careerIndex:state.active,offerId:record.aslanOfficerOfferId,source:{id:'aliens',page:39}};state.stage='aslan-officer-rank';return;}
   case 'conditional-future':state.character.futureConditions??=[];state.character.futureConditions.push(copy(e));break;
   case 'assignment-effect':{state.effectsQueue.unshift(...copy(e.assignments[currentCareer(state).record.assignment]??[]));break;}
   case 'independence':{if(state.character.gender!=='male'||state.deferredSpecializations&&state.character.species!=='aslan'){nativeFallback(state,e,'Resolve the gender-specific Independence result.');return;}const result=dice(state,2,rolls,'Independence acquisition');if(result>stat(state,'SOC')){if(skillAwardExceedsLimit(state,'Independence',e.value??1,e.mode)){nativeFallback(state,e,'This mandatory Independence award would exceed the total skill limit. Resolve it explicitly without exceeding Core p. 18.');return;}gainSkill(state,'Independence',e.value??1,e.mode);}break;}
   case 'conditional':{
    if(state.deferredSpecializations&&state.character.species==='aslan'&&culturalSkillAward(e)){state.character.historyNotes??=[];state.character.historyNotes.push(e.then.map(effect=>effect.name).join(', ')+' is culturally '+e.condition.gender+'-associated, but may be learned by other genders (Aliens 2026 p. 19).');state.effectsQueue.unshift(...copy(e.then).map(effect=>({...effect,culturalPreference:{gender:e.condition.gender,restricted:false,source:copy(ASLAN_CULTURAL_SKILL_SOURCE)}})));break;}
    const condition=e.condition;let passes=true;
    if(condition.gender)passes&&=state.character.gender===condition.gender;
    if(condition.stat)passes&&=(state.character.stats[condition.stat]??0)>=(condition.min??-Infinity)&&(state.character.stats[condition.stat]??0)<=(condition.max??Infinity);
    state.effectsQueue.unshift(...copy(passes?e.then??[]:e.otherwise??[]));break;
   }
   case 'parole':{
    const {record}=currentCareer(state);record.parole=e.mode==='reset'?mechanicalDice(state,e.dice??'1D+2',rolls,'Parole threshold'):Math.min(12,(record.parole??0)+e.value);break;
   }
   case 'believer-buyout':{
    const {record}=currentCareer(state);need(!record.believerBuyout?.accepted,'This buyout was already accepted.');
    const plan=believerBuyoutPlan(record,state.character.lifeBenefitLosses,state.active);
    need(['once','separate'].includes(e.calculation),'Choose how to calculate the buyout.');
    const results=Array.from({length:plan.total?(e.calculation==='once'?1:plan.total):0},(_,i)=>dice(state,2,rolls,'Believer buyout: '+(e.calculation==='once'?'one roll multiplied by '+plan.total:'Benefit roll '+(i+1)+' of '+plan.total)));
    const natural=results[0]??0,amount=results.reduce((sum,n)=>sum+n,0)*10000*(e.calculation==='once'?plan.total:1),formula=e.calculation==='once'?natural+' x Cr10,000 x '+plan.total:'('+results.join(' + ')+') x Cr10,000';
    state.character.historyNotes??=[];state.character.historyNotes.push('Believer buyout: '+formula+' = Cr'+amount.toLocaleString('en-US')+'. Forfeited '+plan.total+' Benefit rolls and left the career.');
    record.believerBuyout={accepted:true,source:{id:'companion',page:40},forfeited:plan,forfeitedTerm:true,calculation:e.calculation,results,formula,natural,amount,age:state.character.age,term:state.character.terms};
    for(const loss of state.character.lifeBenefitLosses??[])if(plan.lossIds.includes(loss.id)){loss.status='applied';loss.appliedCareerIndex=state.active;}
    record.benefitRolls=0;record.forfeitedRankBenefitRolls=plan.rankEntitlement;record.forcedExit=true;record.forcedStay=false;state.character.cash+=amount;break;
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
 if(state.correctedCareerEvents&&state.pendingChoice?.believerBuyoutChoice&&command.type==='gm-override')need(false,'Choose the buyout first, or use audited restore/replay to revise its benefit context.');
 if(state.pending?.kind==='prisoner-lawyer')need(['resolve-prisoner-lawyer','notes','gm-mode'].includes(command.type),'Resolve the pending lawyer choice before changing its context. Use restore or replay to revise it.');
 if(state.character.aslanOrigin?.status==='pending')need(['roll-aslan-gender','roll-aslan-family','roll-aslan-birth-order','resolve-aslan-estate','roll-aslan-clan','choose-aslan-clan','name-aslan-clan','roll-aslan-pride','roll-aslan-rite','resolve-aslan-origin-source','background','choose-effect','choose-skill','skill-award-source','retry-skill-choice','resolve-book','notes','gm-mode'].includes(command.type),'Finish the recorded Aslan origin before changing its context. Restore or replay explicitly to revise it.');
 if(state.pending?.kind==='aslan-origin-source')need(['resolve-aslan-origin-source','notes','gm-mode'].includes(command.type),'Resolve this origin question with its typed source fields.');
 if(gamesPending(state))need([...GAMES_COMMANDS,'notes','gm-mode'].includes(command.type),'Complete the reserved Games term before changing the character or career. Restore/replay explicitly to revise its context.');
 if(activeReeducation(state))need(['reeducation-roll','reeducation-fine','resolve-reeducation','ageing','choose-effect','choose-skill','resolve-book','notes','gm-mode'].includes(command.type),'Complete the pending re-education and ageing continuation before changing the character. Restore/replay explicitly to revise it.');
 if(activeMerchantFine(state))need(['merchant-fine-roll','resolve-merchant-fine','notes','gm-mode'].includes(command.type),'Complete the pending Merchant fine before changing the character. Restore/replay explicitly to revise its context.');
 if(state.stage==='benefit-wager')need(['resolve-benefit-wager','notes','gm-mode'].includes(command.type),'Resolve or decline the pending benefit wager before changing its context. Restore/replay explicitly to revise it.');
 if(state.stage==='relationship-event')need(['resolve-relationship-event','notes','gm-mode'].includes(command.type),'Resolve the pending relationship event before changing the character. Restore/replay explicitly to revise it.');
 if(state.stage==='relationship-loss')need(['resolve-relationship-loss','notes','gm-mode'].includes(command.type),'Resolve the pending relationship loss before changing the character. Restore/replay explicitly to revise it.');
 if(state.stage==='cross-career-cover')need(['cross-career-cover','notes','gm-mode'].includes(command.type),'Resolve the cover career before changing its context.');
 if(state.stage==='cross-career-training')need(['cross-career-training','notes','gm-mode'].includes(command.type),'Resolve the borrowed training before changing its career context. Restore/replay explicitly to revise it.');
 if(advisoryRecord(state))need(['advisory-career','advisory-cash','resolve-advisory-cash-limit','resolve-advisory-cash-result','choose-effect','choose-skill','skill-award-source','retry-skill-choice','resolve-book','notes','gm-mode'].includes(command.type),'Resolve the pending advisory service before changing the character. Restore/replay explicitly to revise it.');
 if(state.pending?.kind==='aslan-historical-entry')need(['resolve-aslan-historical-entry','notes','gm-mode'].includes(command.type),'Resolve the requested historical-entry ruling before changing its context.');
 if(state.pending?.kind==='aslan-restoration')need(['resolve-aslan-restoration','notes','gm-mode'].includes(command.type),'Resolve or decline the earned restoration with its typed fields before continuing.');
 if(state.pending?.kind==='aslan-outlaw-restoration')need(['resolve-aslan-outlaw-restoration','notes','gm-mode'].includes(command.type),'Resolve the earned Outlaw restoration with its typed fields before continuing.');
 if(state.stage==='assignment-entry')need(['qualify-assignment','abandon-assignment-change','notes','gm-mode'].includes(command.type),'Qualify for the pending assignment or abandon that plan before another career action.');
 if(accessMandatory(state)&&command.type==='gm-override')need(false,'Resolve the accepted expedition before changing its context. Use audited restore or replay to revise its source.');
 if(activeAslanOfficerOffer(state)){const allowed=['qualify-aslan-officer','cancel-aslan-officer','benefit','choose-effect','choose-skill','skill-award-source','retry-skill-choice','resolve-book','notes','gm-mode'];if(state._aslanOfficerExit)allowed.push('leave-career');if(state._aslanOfficerQualification)allowed.push('career');need(allowed.includes(command.type),'Resolve the reserved officer exit and qualification before changing its context. Restore/replay explicitly to revise it.');}
 if(state.stage==='aslan-officer-rank')need(['resolve-aslan-officer-rank','notes','gm-mode'].includes(command.type),'Resolve the printed officer rank-table mapping before continuing.');
 switch(command.type) {

 case 'activate-aslan-access':{
  const input=aslanAccessInput(payload),option=aslanAccessOptions(state).find(o=>o.id===input.routeId);need(option?.available,option?.reason??'This outward route is not available.');
  let right=accessRights(state).find(r=>r.id===option.id);if(!right){state.character.aslanCareerAccess??=[];right=createAslanAccess({id:'aslan-access-'+(state.character.aslanCareerAccess.length+1),route:option.route,completedTerms:state.character.terms,careerCount:state.character.careers.length,educationCount:state.character.educations?.length??0});right.boundaryAge=state.character.age;right.priorCareerIndices=aslanOfficerHistory(state);const origin=state.character.careers.at(-1);if(origin){right.originCareerIndex=state.character.careers.length-1;right.originCareerId=origin.id;right.originAssignment=origin.assignment;}right.qualificationFailureContext=copy(state.failedQualificationContext??null);state.character.aslanCareerAccess.push(right);}
  right.status='activated';right.activation={destination:input.destination,confirmed:true,travelSimulated:false,age:state.character.age,generationTerms:state.character.terms};state.character.aslanCareerContext={region:'outside-aslan-space',status:'active',accessId:right.id,destination:input.destination,careerIds:copy(right.careerIds),source:copy(right.source)};
  return 'Recorded outward career context: '+right.name+'. Upbringing, statistics and time remain unchanged.';
 }
 case 'resolve-aslan-access-conflict':{
  const projected=accessConflictProjection(state);need(projected,'No expedition/forced-stay conflict is pending.');const decision=aslanAccessConflictInput(payload,state.config.gm),right=accessRights(state).find(r=>r.id===projected.accessId),record=state.character.careers[projected.careerIndex];right.conflictDecision={...decision,age:state.character.age,generationTerms:state.character.terms};
  if(decision.decision==='honor-forced-stay'){right.status='expired';right.expiry={reason:'source-precedence-forced-stay',completedTerms:state.character.terms,age:state.character.age};}else record.forcedStay=false;
  return 'Recorded source precedence: '+decision.decision+'. '+decision.reason;
 }
 case 'verify-clan-share-lot':{
  need(!clanShareCheckpoint(state),clanShareCheckpoint(state));need(state.config.gm,'Enable GM mode to verify share provenance.');need(Object.keys(payload).every(k=>['lotId','clanId','newClanName','reason'].includes(k)),'Use only the lot, issuing clan and reason.');const hasClanId=Object.hasOwn(payload,'clanId'),hasNewClanName=Object.hasOwn(payload,'newClanName');need(!(hasClanId&&hasNewClanName),'Choose only one existing or newly identified clan.');for(const key of ['clanId','newClanName'])if(Object.hasOwn(payload,key))need(typeof payload[key]==='string'&&payload[key].trim().length>0,'Any supplied issuing-clan field must be a nonempty string.');
  const lot=state.character.clanShareLots?.find(l=>l.id===payload.lotId);need(lot?.available>0,'Select an existing unspent lot.');need(lot.provenance==='unverified'||!lot.clanId,'This lot already has verified provenance.');const reason=shareReason(payload.reason);let clan;
  if(hasClanId){clan=state.character.clanShareClans?.find(c=>c.id===payload.clanId);need(clan,'Choose a known clan ID.');}
  else if(hasNewClanName){const name=text(payload.newClanName,80);need(name,'Identify the issuing clan.');state.character.clanShareClans??=[];clan={id:'verified-clan-'+(state.character.clanShareClans.length+1),name,provenance:'referee',source:copy(CLAN_SHARE_SOURCE)};state.character.clanShareClans.push(clan);}
  need(clan||lot.provenance==='unverified','Identify the missing issuing clan or leave this known-source lot unchanged.');lot.clanId=clan?.id??lot.clanId;if(lot.provenance==='unverified')lot.provenance='referee';state.character.clanShareVerifications??=[];const decision={id:'clan-verification-'+(state.character.clanShareVerifications.length+1),kind:'lot',lotId:lot.id,clanId:lot.clanId,quantity:lot.awarded,reason,source:copy(CLAN_SHARE_SOURCE)};state.character.clanShareVerifications.push(decision);lot.verificationId=decision.id;return 'Verified existing Clan Share lot '+lot.id+(clan?' and issuing clan. ':'. Issuing clan remains unverified. ')+reason;
 }
 case 'verify-clan-contact':{
  need(!clanShareCheckpoint(state),clanShareCheckpoint(state));need(state.config.gm,'Enable GM mode to verify the existing Contact.');need(Object.keys(payload).every(k=>['relationshipId','clanId','reason'].includes(k)),'Use only the Contact ID, clan ID and source reason.');const relationship=state.character.relationships.find(r=>r.id===payload.relationshipId);need(relationship?.role==='Contact','Select an existing Contact.');const clan=state.character.clanShareClans?.find(c=>c.id===payload.clanId);need(clan,'Choose a recorded clan.');need(!relationship.clanFavour,'This Contact already has recorded clan provenance.');const reason=shareReason(payload.reason);state.character.clanShareVerifications??=[];const decision={id:'clan-verification-'+(state.character.clanShareVerifications.length+1),kind:'contact',relationshipId:relationship.id,clanId:clan.id,reason,source:copy(CLAN_SHARE_SOURCE)};state.character.clanShareVerifications.push(decision);relationship.clanFavour={clanId:clan.id,upperEchelon:true,verificationId:decision.id};return 'Verified Contact '+relationship.name+' in the clan upper echelons. '+reason;
 }
 case 'redeem-clan-shares':{
  need(!clanShareCheckpoint(state),clanShareCheckpoint(state));const allowed=['kind','inputs',...(payload.kind==='contact'||payload.kind==='art'?['name']:payload.kind==='ally'?['relationshipId']:payload.kind==='weapons'?['items','sourceConfirmed','sourceReason','lowerValueAcceptance']:payload.kind==='land'?['world','parcelRuling']:[])];need(Object.keys(payload).every(k=>allowed.includes(k)),'Use only fields belonging to the selected Clan Share exchange.');
  const lots=state.character.clanShareLots??[],relationship=payload.kind==='ally'?state.character.relationships.find(r=>r.id===payload.relationshipId):null,clanId=lots.find(l=>l.id===payload.inputs?.[0]?.lotId)?.clanId;
  const plan=clanShareExchange({lots,inputs:payload.inputs,kind:payload.kind,gender:state.character.gender,relationship,clanId});
  for(const input of plan.inputs){const lot=lots.find(l=>l.id===input.lotId);need(!lot.awardId||benefitAward(state,lot.awardId).status==='resolved','Finish receiving the source award before exchanging its shares.');}
  const name=payload.kind==='contact'?text(payload.name,120):null;if(payload.kind==='contact')need(name,'Name or describe the new clan Contact.');
  const assetPlan=['art','weapons'].includes(payload.kind)?clanShareAssets({kind:payload.kind,quantity:plan.quantity,payload,gm:state.config.gm}):null;
  const landPlan=payload.kind==='land'?aslanLandPlan({soc:state.character.stats.SOC,quantity:plan.quantity,world:payload.world,parcelRuling:payload.parcelRuling,gm:state.config.gm}):null;if(payload.kind==='land'&&Object.hasOwn(payload,'parcelRuling')&&!landPlan.parcelRuling)need(false,'Omit parcelRuling for a printed SOC.');
  let landTiming=null,landDelayRoll=null;if(landPlan){mechanicalDice(state,'1D+3',rolls,'Land claim delay');landDelayRoll=copy(rolls.at(-1));landTiming=aslanLandTiming({age:state.character.age,die:landDelayRoll.values[0]});}
  state.character.clanShareRedemptions??=[];const id='clan-redemption-'+(state.character.clanShareRedemptions.length+1),before={cash:state.character.cash,shareBalance:lots.reduce((n,l)=>n+l.available,0)},outputs={};
  for(const input of plan.inputs){const lot=lots.find(l=>l.id===input.lotId);lot.available-=input.quantity;lot.spent+=input.quantity;lot.redemptionIds.push(id);clanShareLotInvariant(lot);if(lot.awardId){const award=benefitAward(state,lot.awardId);award.redeemedQuantity=(award.redeemedQuantity??0)+input.quantity;award.redemptionIds=[...new Set([...(award.redemptionIds??[]),id])];}}
  syncClanShareTokens(state);
  if(plan.cash){state.character.cash+=plan.cash;outputs.cash=plan.cash;}
  if(plan.shipShares){state.character.benefitAwards??=[];const award={id:'award-'+(state.character.benefitAwards.length+1),name:'Ship Share',definitionId:'core.material.Ship Share',source:{id:'core',page:47},origin:{careerId:null,careerIndex:null,source:copy(CLAN_SHARE_SOURCE),redemptionId:id},quantity:plan.shipShares,previousCount:0,status:'resolved',assetIds:[],decisions:[{type:'clan-share-conversion',redemptionId:id}],received:true};state.character.benefitAwards.push(award);recordBenefitToken(state,award,'Ship Share',plan.shipShares,{redeemableForCash:false,valuePerShare:1000000});outputs.shipShares=plan.shipShares;outputs.awardId=award.id;}
  if(assetPlan){
   state.character.assets??=[];outputs.assetIds=[];Object.assign(outputs,{budget:assetPlan.budget,assessedValue:assetPlan.assessedValue,unusedValue:assetPlan.unusedValue,unusedValueDisposition:assetPlan.unusedValueDisposition,sourceVerification:copy(assetPlan.sourceVerification),lowerValueAcceptance:copy(assetPlan.lowerValueAcceptance)});
   for(const item of assetPlan.items){const asset={id:'asset-'+(state.character.assets.length+1),definitionId:'aslan.clan-share.'+item.category,source:copy(CLAN_SHARE_SOURCE),originCareerId:null,awardIds:[...new Set(plan.inputs.map(i=>i.awardId).filter(Boolean))],active:true,ownership:'personal',redemptionId:id,...copy(item),sourceVerification:copy(assetPlan.sourceVerification)};state.character.assets.push(asset);outputs.assetIds.push(asset.id);state.character.benefits.push({name:asset.name,quantity:asset.quantity,assetId:asset.id,definitionId:asset.definitionId,ownership:asset.ownership});}
  }
  if(landPlan){state.character.landClaims??=[];const claim={id:'land-claim-'+(state.character.landClaims.length+1),redemptionId:id,inputs:copy(plan.inputs),quantity:plan.quantity,...copy(landPlan),createdAge:state.character.age,createdGenerationTerms:state.character.terms,delayRoll:landDelayRoll,...landTiming,status:'pending',claimResolution:null,assetId:null};state.character.landClaims.push(claim);outputs.landClaimId=claim.id;outputs.parcels=claim.parcels;outputs.eligibleAge=claim.eligibleAge;}
  if(payload.kind==='contact'){const created=addRelationship(state,'Contact',name,{clanFavour:{clanId,upperEchelon:true,redemptionId:id}});outputs.relationshipId=created.id;outputs.relationshipAfter=copy(created);}
  if(payload.kind==='ally'){outputs.relationshipBefore=copy(relationship);relationship.role='Ally';relationship.clanFavour.upgradedBy=id;outputs.relationshipId=relationship.id;outputs.relationshipAfter=copy(relationship);}
  const after={cash:state.character.cash,shareBalance:lots.reduce((n,l)=>n+l.available,0)};state.character.clanShareRedemptions.push({id,kind:plan.kind,inputs:plan.inputs,quantity:plan.quantity,outputs,before,after,clanId:plan.clanId,source:copy(CLAN_SHARE_SOURCE),age:state.character.age,generationTerms:state.character.terms,stage:state.stage});return 'Exchanged '+plan.quantity+' Clan Share'+(plan.quantity===1?'':'s')+' for '+plan.kind+'. No career term or benefit roll consumed.';
 }

 case 'resolve-land-claim':{
  const checkpoint=clanShareCheckpoint(state,{convertedClaim:true});need(!checkpoint,checkpoint);const claim=state.character.landClaims?.find(c=>c.id===payload.claimId);
  const resolution=aslanLandResolution({claim,age:state.character.age,independence:skillLevel(state,'Independence'),gm:state.config.gm,payload});
  state.character.assets??=[];const asset={id:'asset-'+(state.character.assets.length+1),definitionId:'aslan.landholding',source:copy(claim.source),originCareerId:null,awardIds:[...new Set(claim.inputs.map(i=>i.awardId).filter(Boolean))],active:true,ownership:'personal',name:claim.world.name+' landhold',category:'land',quantity:1,landClaimId:claim.id,redemptionId:claim.redemptionId,world:copy(claim.world),parcels:claim.parcels,socAtRedemption:claim.socAtRedemption,administration:{mode:resolution.mode,relativeName:resolution.relativeName},sourceVerification:copy(resolution)};
  state.character.assets.push(asset);state.character.benefits.push({name:asset.name,quantity:1,assetId:asset.id,definitionId:asset.definitionId,ownership:'personal'});claim.status='claimed';claim.assetId=asset.id;claim.claimResolution={...resolution,generationTerms:state.character.terms,assetId:asset.id};
  return 'Recorded the already-established land claim on '+claim.world.name+'. No travel, ageing or career time simulated. '+resolution.reason;
 }

 case 'roll-aslan-gender':{
  const o=state.character.aslanOrigin;need(state.stage==='aslan-family'&&o&&!o.identityGender&&!o.gender&&!o.family,'Only an unspecified origin gender can be rolled.');need(Object.keys(payload).length===0,'The gender roll takes no inputs.');
  const total=dice(state,2,rolls,'Aslan gender');state.character.gender=total<=5?'male':'female';o.gender={mode:'rolled',value:state.character.gender,dice:copy(rolls.at(-1).values),total};return 'Aslan source gender: '+state.character.gender+'.';
 }
 case 'roll-aslan-family':{
  const o=state.character.aslanOrigin;need(state.stage==='aslan-family'&&o&&!o.family,'The family background has already been rolled or is not ready.');need(Object.keys(payload).length===0,'The family roll takes no inputs.');need(o.gender,'Choose or roll the source gender branch first.');
  const band=aslanFamilyBand(o.familySOC)??o.familyBandDecision?.band;
  if(!band){originSource(state,'family-band','The initial SOC has no printed family band. Record a referee band before rolling.',17);return 'Family background awaits an unprinted-SOC ruling; no die rolled.';}
  const die=dice(state,1,rolls,'Aslan family background'),result=aslanFamilyResult({soc:o.familySOC,die,gender:state.character.gender,band});
  o.family={source:result.source,die,band,label:result.label,status:'resolving-award',awardsBefore:copy(state.character.skills),awardsAfter:null};
  if(result.needsDecision){originSource(state,result.needsDecision,'Resolve the female family award against the male-only Independence rule.',20);return result.label+' awaits the typed Independence ruling.';}
  queueEffects(state,sourcedEffects(result.effects,{id:'aliens',page:17}),'aslan-origin-family',rolls);return 'Family background: '+result.label+'. Award supplements ordinary background skills.';
 }
 case 'resolve-aslan-origin-source':{
  need(state.stage==='book-step'&&state.pending?.kind==='aslan-origin-source','No Aslan origin source decision is pending.');need(state.config.gm,'Enable GM mode for an origin source decision.');const o=state.character.aslanOrigin,kind=state.pending.decision,reason=aslanOriginReason(payload.reason);
  if(kind==='gender'){
   need(Object.keys(payload).every(k=>['gender','reason'].includes(k))&&['male','female'].includes(payload.gender),'Choose one source gender branch and its reason.');
   state.character.identityGender=o.identityGender;state.character.gender=payload.gender;o.gender={mode:'referee',value:payload.gender,reason};o.decisions.push({kind,gender:payload.gender,reason});state.pending=null;state.stage='aslan-family';
  }else if(kind==='family-band'){
   need(Object.keys(payload).every(k=>['band','reason'].includes(k))&&ASLAN_FAMILY_BANDS.some(b=>b.id===payload.band),'Choose the adjudicated family band.');o.familyBandDecision={band:payload.band,reason};o.decisions.push({kind,...o.familyBandDecision});state.pending=null;state.stage='aslan-family';
  }else {
   need(kind==='female-independence'&&Object.keys(payload).every(k=>['decision','reason'].includes(k))&&['omit','grant-level-zero'].includes(payload.decision),'Choose omission or the explicit level-zero referee exception.');
   o.decisions.push({kind,decision:payload.decision,reason});state.pending=null;
   queueEffects(state,payload.decision==='grant-level-zero'?[{kind:'skill',name:'Independence',mode:'set',value:0,source:{id:'aliens',page:17}}]:[],'aslan-origin-family',rolls);
  }
  return 'Aslan origin source decision: '+kind+'. '+reason;
 }
 case 'roll-aslan-birth-order':{
  need(state.stage==='aslan-birth-order'&&state.character.aslanOrigin?.birthOrder===null,'Birth order is not awaiting a roll.');need(Object.keys(payload).length===0,'Birth order takes no inputs.');dice(state,2,rolls,'Aslan birth order');const result=aslanBirthOrder({gender:state.character.gender,dice:rolls.at(-1).values});state.character.aslanOrigin.birthOrder=result;state.character.birthOrder=result.id;state.stage='aslan-estate';return 'Birth order: '+result.id+'. Inheritance eligibility is not owned land.';
 }
 case 'resolve-aslan-estate':{
  need(state.stage==='aslan-estate','Family estate is not awaiting its baseline.');const o=state.character.aslanOrigin;o.estate=aslanEstate({soc:o.familySOC,birthOrder:o.birthOrder.id,payload,gm:state.config.gm});if(o.estate.decision){o.decisions.push({kind:'estate',...o.estate.decision});if(!state.coverage.includes('aslan-origin-estate'))state.coverage.push('aslan-origin-estate');}state.stage='aslan-clan';return 'Family estate baseline recorded; ownership remains unestablished. No land-size die or owned asset granted.';
 }
 case 'roll-aslan-clan':{
  need(state.stage==='aslan-clan','Clan is not awaiting its roll.');need(Object.keys(payload).length===0,'The clan roll takes no inputs.');const total=dice(state,2,rolls,'Aslan clan'),values=copy(rolls.at(-1).values);const scopeDie=[3,4,5,10,11].includes(total)?dice(state,1,rolls,'Aslan clan scope'):undefined;state.character.aslanOrigin.clan=aslanClanResult({dice:values,scopeDie});state.stage='aslan-pride';return 'Clan: '+state.character.aslanOrigin.clan.type+'.';
 }
 case 'choose-aslan-clan':{
  need(state.stage==='aslan-clan','Clan is not awaiting selection.');need(state.config.gm,'Enable GM mode for a referee-selected clan.');need(Object.keys(payload).every(k=>['name','scope','reason'].includes(k)),'Use the clan name, scope and reason only.');const name=text(payload.name,80),scope=text(payload.scope,160),reason=aslanOriginReason(payload.reason);need(name&&scope,'Name the clan and describe its scope.');state.character.aslanOrigin.clan={source:{id:'aliens',page:18},mode:'referee',type:'Referee-selected',name,scope:{description:scope},reason};state.stage='aslan-pride';return 'Referee-selected clan: '+name+'. '+reason;
 }
 case 'name-aslan-clan':{
  need(state.stage==='aslan-pride'&&state.character.aslanOrigin?.clan,'Name the generated clan before rolling pride.');need(Object.keys(payload).every(k=>k==='name'),'Only a descriptive clan name can be supplied.');const name=text(payload.name,80);need(name,'Enter a clan name.');state.character.aslanOrigin.clan.name=name;return 'Clan name: '+name+'.';
 }
 case 'roll-aslan-pride':{
  need(state.stage==='aslan-pride','Pride is not awaiting its roll.');need(Object.keys(payload).length===0,'The pride roll takes no inputs.');dice(state,2,rolls,'Aslan pride');state.character.aslanOrigin.pride=aslanPrideResult(rolls.at(-1).values);state.stage='background';return state.character.aslanOrigin.pride.name+'. Ordinary background skills remain separate from family awards.';
 }
 case 'roll-aslan-rite':{
  need(state.stage==='aslan-rite'&&state.character.aslanOrigin?.rite===null,'The rite follows completed ordinary background skills, once.');need(Object.keys(payload).length===0,'The rite takes no inputs.');const total=dice(state,2,rolls,'Rite of Passage'),values=copy(rolls.at(-1).values),statsBefore=copy(state.character.stats);state.character.stats.RITE=['STR','DEX','END','INT','EDU','SOC'].filter(k=>stat(state,k)>total).length;
  state.character.aslanOrigin.rite={source:{id:'aliens',page:21},dice:values,total,modifier:state.character.stats.RITE,statsBefore,effectsResolved:false};
  const effects=values[0]===values[1]?sourcedEffects(EXPANSION_TABLES['aslan.rite-doubles'].results[total],{id:'aliens',page:21}):[];queueEffects(state,effects,'aslan-origin-complete',rolls);return 'Rite of Passage: '+total+', RITE '+state.character.stats.RITE+'.';
 }

 case 'request-aslan-historical-entry':{
  need(Object.keys(payload).every(k=>['careerId','assignment'].includes(k)),'Choose only the requested career and assignment.');
  const boundary=outlawEntryBoundary(state);need(boundary.available,boundary.reason);
  const option=historicalEntryOptions(state).find(c=>c.careerId===payload.careerId),assignment=option?.assignments.find(a=>a.id===payload.assignment);need(option?.available&&assignment?.available,assignment?.reason||option?.reason||'Choose an eligible requested entry.');
  const prior=(state.character.aslanHistoricalEntries??[]).find(r=>['requested','approved'].includes(r.status));need(!prior||prior.careerId!==payload.careerId||prior.assignment!==payload.assignment,'That entry already has an outstanding ruling.');
  state.character.aslanHistoricalEntries??=[];const id='aslan-historical-entry-'+(state.character.aslanHistoricalEntries.length+1);
  if(prior){prior.status='superseded';prior.supersededBy=id;}
  const r={id,source:{id:'aliens',page:43},restorationId:boundary.restoration.id,originCareerIndex:boundary.restoration.originCareerIndex,generationTerms:state.character.terms,age:state.character.age,educationCount:(state.character.educations??[]).length,careerId:payload.careerId,assignment:payload.assignment,priorCareerIndices:aslanOfficerHistory(state),status:'requested',decision:null,attempt:null,expiry:null,supersededBy:null};
  state.character.aslanHistoricalEntries.push(r);sourceStep(state,'aslan-historical-entry','aliens',43,'Record the referee interpretation allowing or denying this one requested career entry after restored standing; qualification and other prerequisites still apply.','career');state.pending.entryId=id;
  return 'Requested a source ruling for '+option.name+' / '+assignment.name+'. No qualification was rolled.';
 }
 case 'resolve-aslan-historical-entry':{
  need(state.stage==='book-step'&&state.pending?.kind==='aslan-historical-entry','No historical-entry ruling is pending.');need(state.config.gm,'Enable GM mode to record the historical-entry source interpretation.');need(Object.keys(payload).every(k=>['approved','reason'].includes(k)),'Use only approval and its source reason.');need(typeof payload.approved==='boolean','Record approval or denial.');
  const reason=text(payload.reason??'',500);need(reason,'Record the source basis for this single-entry ruling.');
  const r=state.character.aslanHistoricalEntries.find(r=>r.id===state.pending.entryId);need(r?.status==='requested','The requested historical entry is no longer pending.');
  const projected={...state,stage:'career',pending:null},option=historicalEntryOptions(projected).find(c=>c.careerId===r.careerId)?.assignments.find(a=>a.id===r.assignment);
  need(option?.available,option?.reason??'The requested entry context is no longer eligible.');r.decision={approved:payload.approved,reason};r.status=payload.approved?'approved':'declined';state.pending=null;state.stage='career';
  return 'Referee '+(payload.approved?'approved':'declined')+' one '+findCareer(r.careerId).name+' / '+r.assignment+' entry attempt. '+reason;
 }

 case 'resolve-aslan-outlaw-restoration':{
  need(state.stage==='book-step'&&state.pending?.kind==='aslan-outlaw-restoration','No earned Outlaw restoration is pending.');
  const r=currentAslanOutlawRestoration(state),{record,career}=currentCareer(state);need(r?.status==='pending'&&r.originCareerIndex===state.active&&career.id===r.originCareerId&&record.assignment===r.originAssignment&&record.terms===r.originCareerTerms&&state.character.terms===r.grantedAtCompletedTerms&&state.character.gender===r.gender,'The Outlaw restoration context changed.');
  const decision=aslanOutlawRestorationDecision({gender:r.gender,payload,gm:state.config.gm});let socDice;
  if(decision.decision==='marry'){dice(state,2,rolls,'Outlaw marriage SOC');socDice=copy(rolls.at(-1).values);}
  const outcome=aslanOutlawRestorationOutcome({gender:r.gender,decision,socDice});r.decision=decision;
  if(socDice)r.socRoll={dice:socDice,natural:outcome.soc,total:outcome.soc,modifier:0,boon:false};
  state.pending=null;
  if(outcome.restored){
   setStat(state,'SOC',outcome.soc);state.character.outcast=false;r.clanShares=outcome.clanShares;r.married=outcome.married;r.status='awaiting-departure';
   r.departure={required:true,completed:false,source:copy(r.source)};record.aslanRestorationExit={restorationId:r.id,source:copy(r.source)};record.forcedExit=true;
   state.effectsQueue.unshift(...(outcome.clanShares?[{kind:'benefit',name:'Clan Share',value:outcome.clanShares,source:copy(r.source)}]:[]),{kind:'aslan-outlaw-restoration-awarded',restorationId:r.id,awardStart:(state.character.benefitAwards??[]).length});
  }else r.status=decision.decision==='decline'?'declined':'ineligible';
  r.socAfter=state.character.stats.SOC;r.outcastAfter=!!state.character.outcast;drainEffects(state,rolls);
  return outcome.restored?'Outlaw restoration resolved: SOC '+r.socAfter+', '+outcome.clanShares+' Clan Shares, required career departure. '+decision.reason:'Outlaw restoration: '+r.status+'. Current career continues without a restoration award.';
 }

 case 'resolve-aslan-restoration':{
  need(state.stage==='book-step'&&state.pending?.kind==='aslan-restoration','No earned Aslan restoration is pending.');
  const r=currentAslanRestoration(state),{record,career}=currentCareer(state);need(r?.status==='offered'&&r.originCareerIndex===state.active&&career.id===r.originCareerId&&record.assignment===r.originAssignment&&state.character.terms===r.grantedAtCompletedTerms,'The restoration source context changed.');
  const decision=aslanRestorationDecision(payload,state.config.gm);r.decision=decision;
  if(decision.accept){setStat(state,'SOC',decision.originalSOC);if(decision.statusTiming==='on-restoration')state.character.outcast=false;r.status='available';state.effectsQueue.unshift({kind:'note',text:'Owe a great debt to a clan elder after the restoration opportunity.'});}
  else r.status='declined';
  r.socAfter=state.character.stats.SOC;r.outcastAfter=!!state.character.outcast;state.pending=null;drainEffects(state,rolls);
  return decision.accept?'Source-earned restoration accepted: original SOC '+decision.originalSOC+', status timing '+decision.statusTiming+'. One qualification attempt next term. '+decision.reason:'Declined the source-earned restoration opportunity.';
 }

 case 'begin-aslan-officer':{
  need(Object.keys(payload).every(k=>['offerId','assignment'].includes(k)),'Choose only an offer and officer assignment.');
  const option=aslanOfficerOptions(state).find(o=>o.id===payload.offerId);need(option?.available,option?.reason??'This officer offer is unavailable.');
  const assignment=option.assignments.find(a=>a.id===payload.assignment);need(assignment?.available,assignment?.reason??'Choose an eligible officer assignment.');
  const offer=state.character.aslanOfficerOffers.find(o=>o.id===payload.offerId),origin=state.character.careers[offer.originCareerIndex];
  if(option.sourceRequired){const resumeStage=state.stage;sourceStep(state,'aslan-officer-status','aliens',22,'Verify a source-earned restoration or applicable exception for this officer offer only.',resumeStage);Object.assign(state.pending,{offerId:offer.id,assignment:payload.assignment,priorCareerIndices:aslanOfficerHistory(state)});return 'Officer offer awaits source-assisted verification of prior Outcast or Outlaw history.';}
  offer.selectedAssignment=payload.assignment;offer.qualificationDM=origin.terms;offer.commitment={mode:option.earlyExit?'waived-early-exit':'ordinary-exit',earlyExit:option.earlyExit,age:state.character.age,generationTerms:state.character.terms,careerTerms:origin.terms,originCareerIndex:offer.originCareerIndex};
  state.aslanOfficerOffer=state.character.aslanOfficerOffers.indexOf(offer);
  if(state.active===null){offer.status='ready';state.stage='aslan-officer-entry';return 'Reserved '+option.targetName+' / '+assignment.name+' qualification after completed benefits.';}
  offer.status='mustering-out';state._aslanOfficerExit=offer.id;const summary=apply(state,{type:'leave-career',payload:{}},rolls);delete state._aslanOfficerExit;
  return 'Reserved '+option.targetName+' / '+assignment.name+' qualification; originating-career DM +'+offer.qualificationDM+'. '+summary;
 }
 case 'qualify-aslan-officer':{
  const offer=activeAslanOfficerOffer(state);need(state.stage==='aslan-officer-entry'&&offer?.status==='ready','No officer qualification is ready.');need(!Object.keys(payload).length,'The officer target is already selected.');
  need(state.active===null&&state.character.terms===offer.availableAtCompletedTerms&&state.character.careers.length===offer.originCareerIndex+1,'The reserved officer boundary has changed.');
  const origin=state.character.careers[offer.originCareerIndex];need(origin.exit&&origin.terms===offer.qualificationDM&&!origin.forcedStay,'The originating career context has changed.');need(!state.forcedCareer&&!state.character.retirementFromCreation,'Resolve the required career or retirement restriction.');
  if(!checkAvailable(state,{stat:'RITE',target:10})&&!state._sourceCheck){missingCheck(state,{stat:'RITE',target:10},'Qualification',command,{id:'aliens',page:findCareer(offer.targetCareerId).page});return 'Officer qualification requires the missing Rite score to be resolved.';}
  offer.status='awaiting-source';state.stage='career';state._aslanOfficerQualification=offer.id;const summary=apply(state,{type:'career',payload:{id:offer.targetCareerId,assignment:offer.selectedAssignment}},rolls);delete state._aslanOfficerQualification;
  return 'Officer opportunity (originating-career DM +'+offer.qualificationDM+'): '+summary;
 }
 case 'cancel-aslan-officer':{
  const offer=activeAslanOfficerOffer(state);need(state.stage==='aslan-officer-entry'&&offer?.status==='ready','Only an unrolled officer plan can be cancelled.');need(Object.keys(payload).every(k=>k==='mode'),'Choose only a cancellation destination.');
  const option=currentAslanOfficerProjection(state).cancelOptions.find(o=>o.id===payload.mode);need(option,'That cancellation destination is unavailable for this exit.');
  offer.status='cancelled';offer.cancellation={mode:payload.mode,age:state.character.age,generationTerms:state.character.terms};state.aslanOfficerOffer=null;
  if(payload.mode==='retire'){state.character.retirementFromCreation=true;state.character.retirementDecision={careerId:offer.originCareerId,careerIndex:offer.originCareerIndex,terms:offer.commitment.careerTerms,source:{id:'aliens',page:22},purpose:'Ended creation after resolving the reserved exit benefits.'};state.character.careers[offer.originCareerIndex].retiredFromCreation=true;state.stage='retirement';}
  else state.stage='career';
  return 'Cancelled the unrolled officer attempt: '+option.name+'. Benefits remain resolved.';
 }
 case 'resolve-aslan-officer-rank':{
  need(state.stage==='aslan-officer-rank'&&state.pendingAslanOfficerRank,'No officer rank-table mapping is pending.');need(state.config.gm,'Enable GM mode before mapping conflicting rank-table headings.');need(Object.keys(payload).every(k=>['tableId','reason'].includes(k)),'Record only the printed table and referee reason.');
  const reason=text(payload.reason??'',500);need(reason,'Record the source basis for this rank-table mapping.');const {record}=currentCareer(state),pending=state.pendingAslanOfficerRank;need(state.active===pending.careerIndex&&record.aslanOfficerOfferId===pending.offerId,'The officer rank context changed.');
  const effects=aslanOfficerRankEffects(payload.tableId,record.rank);record.aslanRankMapping={tableId:payload.tableId,reason,source:{id:'aliens',page:39}};const offer=state.character.aslanOfficerOffers.find(o=>o.id===pending.offerId);offer.rankMapping=copy(record.aslanRankMapping);state.pendingAslanOfficerRank=null;
  if(!state.coverage.includes('aslan-officer-rank'))state.coverage.push('aslan-officer-rank');state.effectsQueue.unshift(...effects);drainEffects(state,rolls);return 'Referee mapped '+record.assignment+' to '+payload.tableId+'. '+reason;
 }

 case 'change-assignment':{
  need(Object.keys(payload).every(k=>k==='assignment'),'Choose only the target assignment.');const option=assignmentOptions(state).find(a=>a.id===payload.assignment);need(option?.available,option?.reason??'This assignment change is unavailable.');
  const {record,career}=currentCareer(state);if(option.mode==='retain'&&option.sourceRequired&&!state._sourceCheck){missingCheck(state,career.qualification,'Assignment qualification',command,{id:'core',page:20});return 'Assignment qualification requires source resolution for the missing characteristic.';}
  state.character.assignmentChanges??=[];const change={id:'assignment-change-'+(state.character.assignmentChanges.length+1),careerId:career.id,careerIndex:state.active,
   fromAssignment:record.assignment,toAssignment:payload.assignment,mode:option.mode,status:option.mode==='restart'?'mustering-out':'completed',source:copy(ASSIGNMENT_SOURCE),generationTerms:state.character.terms,age:state.character.age,rank:record.rank,officer:!!record.officer,check:null,newCareerIndex:null};
  state.character.assignmentChanges.push(change);
  if(option.mode==='restart'){state.assignmentChange=state.character.assignmentChanges.length-1;const summary=apply(state,{type:'leave-career',payload:{}},rolls);return 'Started a fresh assignment route to '+payload.assignment+'. '+summary;}
  const automatic=nobleAutomaticQualification(career.id,state.character.stats),modifier=automatic?0:assignmentRollModifier(state,career,payload.assignment,true);
  change.check=automatic?{automatic:true,success:true,source:{id:'core',page:38}}:rulesCheck(state,career.qualification,rolls,'Assignment qualification',modifier);
  change.automaticReason=automatic?'noble-social-standing':null;change.status=change.check.success?'completed':'failed';
  if(change.check.success)record.assignment=payload.assignment;record.forcedStay=false;state.stage='training';
  return 'Assignment qualification: '+JSON.stringify(change.check)+'. Continuing '+career.name+' / '+record.assignment+' with retained rank.';
 }
 case 'qualify-assignment':{
  const change=currentAssignmentChange(state);need(state.stage==='assignment-entry'&&change?.status==='ready','No fresh assignment qualification is ready.');need(!Object.keys(payload).length,'The pending assignment is already selected.');
  need(state.character.terms===change.generationTerms&&state.active===null,'The pending assignment boundary changed.');state.stage='career';change.status='awaiting-source';
  return apply(state,{type:'career',payload:{id:change.careerId,assignment:change.toAssignment}},rolls);
 }
 case 'abandon-assignment-change':{
  const change=currentAssignmentChange(state);need(state.stage==='assignment-entry'&&change?.status==='ready','No unrolled assignment plan can be abandoned.');need(!Object.keys(payload).length,'No extra fields are required.');
  change.status='abandoned';state.assignmentChange=null;state.stage='career';return 'Abandoned the unrolled assignment plan. Previous benefits remain resolved.';
 }

 case 'advisory-career':{
  const record=advisoryRecord(state);need(state.stage==='advisory-career'&&record?.status==='awaiting-career','No advisory career choice is pending.');assertAdvisoryContext(state,record);
  need(Object.keys(payload).every(k=>k==='careerId')&&advisoryOptions().some(c=>c.id===payload.careerId),'Choose another Zhodani service career.');
  const career=findCareer(payload.careerId);record.careerId=career.id;const die=dice(state,1,rolls,'Advisory Service Skills');record.training={die,source:{id:career.source,page:career.page},careerId:career.id,table:'service'};record.status='resolving-training';
  state.effectsQueue.unshift(...sourcedEffects(RULE_PACK[career.id].training.service[die-1],record.training.source),{kind:'advisory-ready',id:record.id});drainEffects(state,rolls);
  return 'Advisory '+career.name+' Service Skills: '+die+'.';
 }
 case 'advisory-cash':{
  const record=advisoryRecord(state);need(state.stage==='advisory-cash'&&record?.status==='awaiting-cash'&&!record.cash,'No advisory cash entitlement is ready.');assertAdvisoryContext(state,record);need(Object.keys(payload).every(k=>k==='creditIds'),'The advisory cash roll accepts only benefit-credit IDs.');const credits=selectedBenefitCredits(state,payload,'advisory'),creditIds=credits.map(c=>c.id),creditModifier=credits.reduce((n,c)=>n+c.value,0);
  const allowExtra=record.cashLimitDecision?.decision==='allow-extra';need(state.cashRolls<cashLimit(state)||allowExtra,'The lifetime cash-roll limit has been reached. Preserve this entitlement or record an explicit GM disposition.');
  const die=dice(state,1,rolls,'Advisory cash benefit'),cash=advisoryCashPlan({die,cashTable:RULE_PACK[record.careerId].benefits.cash,gambler:Object.hasOwn(state.character.skills,'Gambler'),cashRolls:state.cashRolls,limit:cashLimit(state),wealth:state.character.stats.WLT,allowExtra,creditModifier});
  record.cash={...cash,creditIds,careerId:record.careerId,source:{id:findCareer(record.careerId).source,page:findCareer(record.careerId).page},cashBefore:state.character.cash,cashAfter:cash.amount===null?null:state.character.cash+cash.amount};
  consumeBenefitCredits(credits,{kind:'advisory',careerId:record.careerId,careerIndex:record.originCareerIndex,advisoryId:record.id,cash:true,die,result:cash.result});
  if(cash.amount!==null)state.character.cash+=cash.amount;state.cashRolls=cash.cashRollsAfter;if(cash.wealthAfter!==null)state.character.stats.WLT=cash.wealthAfter;
  if(cash.needsAdjudication){record.status='awaiting-cash-source';state.stage='advisory-cash-source';return 'Advisory cash result '+cash.result+' is outside the printed table. Original dice, credits and cash-roll count retained for GM resolution.';}
  advisoryCashHistory(state,record);
  finishAdvisory(state,record,rolls);return 'Advisory cash benefit '+cash.result+' from '+record.careerId+': Cr'+cash.amount+'.';
 }
 case 'resolve-advisory-cash-result':{
  const record=advisoryRecord(state);need(state.stage==='advisory-cash-source'&&record?.status==='awaiting-cash-source'&&record.cash?.needsAdjudication&&record.cash.amount===null,'No advisory cash result requires source resolution.');assertAdvisoryContext(state,record);
  need(state.config.gm,'Enable GM mode before resolving an out-of-table cash result.');need(Object.keys(payload).every(k=>['amount','reason'].includes(k)),'Record only a cash amount and reason.');const amount=integer(payload.amount,0,10000000,'Resolved cash amount'),reason=text(payload.reason??'',500);need(reason,'Record the GM source ruling for this cash result.');
  record.cash.amount=amount;record.cash.cashAfter=state.character.cash+amount;record.cash.needsAdjudication=false;record.cash.sourceRuling={amount,reason};state.character.cash+=amount;if(!state.coverage.includes('advisory-cash-result'))state.coverage.push('advisory-cash-result');advisoryCashHistory(state,record);finishAdvisory(state,record,rolls);
  return 'GM advisory cash result resolved as Cr'+amount+'. '+reason;
 }
 case 'resolve-advisory-cash-limit':{
  const record=advisoryRecord(state);need(state.stage==='advisory-cash'&&record?.status==='awaiting-cash'&&state.cashRolls>=cashLimit(state)&&!record.cashLimitDecision,'No unresolved advisory cash-limit decision is pending.');assertAdvisoryContext(state,record);
  need(state.config.gm,'Enable GM mode before overriding or forfeiting the capped entitlement.');need(Object.keys(payload).every(k=>['decision','reason'].includes(k))&&['forfeit','allow-extra'].includes(payload.decision),'Choose an explicit cash-limit disposition.');
  const reason=text(payload.reason??'',500);need(reason,'Record the GM reason for this disposition.');record.cashLimitDecision={decision:payload.decision,reason,cashRolls:state.cashRolls,limit:cashLimit(state)};if(!state.coverage.includes('advisory-cash-limit'))state.coverage.push('advisory-cash-limit');
  if(payload.decision==='forfeit')finishAdvisory(state,record,rolls);
  return 'GM advisory cash-limit disposition: '+payload.decision+'. '+reason;
 }

 case 'cross-career-cover':{
  const pending=crossCareerCover(state);need(pending,'No cover career choice is pending.');
  need(Object.keys(payload).every(k=>k==='careerId')&&pending.options.some(c=>c.id===payload.careerId),'Choose a listed cover career.');
  const route=crossCareerRoute(state,pending.routeId);assertCrossCareerContext(state,route);
  const natural=dice(state,2,rolls,'Undercover Deception check'),modifier=skillCheckDM(state,'Deception'),total=natural+modifier;
  route.coverCareerId=payload.careerId;route.check={skill:'Deception',natural,modifier,total,target:8,success:total>=8};route.status='resolving-table';state.pendingCrossCareerCover=null;
  const context={tableCareerId:route.coverCareerId,crossCareerRouteId:route.id};
  const effects=route.check.success?
   [...(route.originCareerId==='core.agent'?[{kind:'table-roll',table:'events',career:route.coverCareerId,dice:'2D'}]:[]),
    {kind:'cross-career-training',routeId:route.id},
    ...(route.originCareerId==='vargr.agent'?[{kind:'modifier',target:'advancement',value:2,scope:'next',career:route.originCareerId,source:copy(route.source)}]:[])]:
   [{kind:'table-roll',table:'mishap',career:route.coverCareerId,dice:'1D'}];
  state.effectsQueue.unshift(...borrowedEffects(effects,context),{kind:'cross-career-complete',routeId:route.id});drainEffects(state,rolls);
  return 'Undercover cover: '+findCareer(route.coverCareerId).name+'. Deception '+total+' against 8.';
 }

 case 'cross-career-training':{
  const pending=crossCareerTraining(state);need(pending,'No borrowed training is pending.');need(Object.keys(payload).every(k=>k==='assignment'),'Borrowed training accepts only an assignment.');
  const route=crossCareerRoute(state,pending.routeId);assertCrossCareerContext(state,route);need(pending.options.some(a=>a.id===payload.assignment),'Choose a listed specialist assignment table.');
  const career=findCareer(pending.sourceCareerId),die=dice(state,1,rolls,route.originCareerId==='zhodani.agent'?'Prole assignment training':'Borrowed '+career.name+' assignment training');route.training={careerId:career.id,assignment:payload.assignment,die,source:{id:career.source,page:career.page}};route.status='resolving-training';
  state.pendingCrossCareerTraining=null;state.effectsQueue.unshift(...sourcedEffects(RULE_PACK[career.id].training.assignments[payload.assignment][die-1],route.training.source));drainEffects(state,rolls);
  return 'Borrowed '+career.name+' '+payload.assignment+' training: '+die+'.';
 }

 case 'resolve-relationship-event':{
  need(state.stage==='relationship-event'&&['relationship-change','relationship-remove'].includes(state.pendingChoice?.kind),'No relationship event is pending.');
  const e=state.pendingChoice;
  need(Object.keys(payload).every(k=>['relationshipId','role','name','confirmed'].includes(k)),'Use only the typed relationship event fields.');
  need(payload.confirmed===true,'Confirm the relationship event decision.');
  need(state.active===e.careerIndex&&currentCareer(state).career.id===e.careerId&&JSON.stringify(state.character.relationships)===JSON.stringify(e.relationshipsBefore),'Relationship context changed. Restore/replay the original context.');
  const eligible=state.character.relationships.filter(r=>(e.from??e.types).includes(r.role)),removing=e.kind==='relationship-remove';
  let before=null,after=null;
  if(removing)need(payload.role===undefined&&payload.name===undefined,'Removal cannot include a role or name.');
  else need(e.to.includes(payload.role),'Choose a listed relationship role.');
  if(eligible.length){
   const target=eligible.find(r=>r.id===payload.relationshipId);need(target,'Choose an existing eligible relationship by ID.');
   need(payload.name===undefined,'An existing relationship keeps its name.');before=copy(target);
   if(removing)state.character.relationships=state.character.relationships.filter(r=>r.id!==target.id);
   else{target.role=payload.role;after=copy(target);}
  }else{
   need(payload.relationshipId===undefined,'No eligible existing relationship can be selected.');
   if(removing){need(Array.isArray(e.ifAbsent),'No source absence fallback exists.');state.effectsQueue.unshift(...copy(e.ifAbsent));}
   else{need(e.fallback===true,'No source replacement relationship exists.');const name=text(payload.name??'',120)||'Unnamed '+payload.role.toLowerCase();after=copy(addRelationship(state,payload.role,name));}
  }
  state.character.relationshipEvents??=[];
  state.character.relationshipEvents.push({id:'relationship-event-'+(state.character.relationshipEvents.length+1),kind:e.kind,source:copy(e.source),careerId:e.careerId,careerIndex:e.careerIndex,age:state.character.age,generationTerms:state.character.terms,before,after,absent:!eligible.length});
  state.pendingChoice=null;drainEffects(state,rolls);return removing?(before?'Removed '+before.role+': '+before.name+'.':'No eligible relationship: applied the printed absence consequence.'):'Recorded '+after.role+': '+after.name+'.';
 }

 case 'resolve-relationship-loss':{
  need(state.stage==='relationship-loss'&&state.pendingChoice?.kind==='zhodani-relationship-loss','No relationship loss is pending.');
  const e=state.pendingChoice;need(JSON.stringify(state.character.relationships)===JSON.stringify(e.relationshipsBefore),'Relationship context changed. Restore/replay the original context.');
  const result=relationshipLoss(state.character.relationships,payload);
  state.character.relationships=result.remaining;state.character.relationshipLosses??=[];
  state.character.relationshipLosses.push({source:copy(e.source),careerId:state.active===null?null:currentCareer(state).career.id,careerIndex:state.active,
   age:state.character.age,generationTerms:state.character.terms,relationshipIndex:result.relationshipIndex,removed:copy(result.removed),absent:result.absent,reason:result.reason});
  if(result.absent&&!state.coverage.includes('zhodani-relationship-loss'))state.coverage.push('zhodani-relationship-loss');
  state.pendingChoice=null;drainEffects(state,rolls);
  return result.absent?'No eligible relationship to remove. Referee ruling: '+result.reason:'Removed '+result.removed.role+': '+result.removed.name+'.';
 }

 case 'merchant-fine-roll':{
  const fine=activeMerchantFine(state);need(state.stage==='merchant-fine-roll'&&fine?.status==='awaiting-roll','No Merchant fine roll is pending.');
  need(!Object.keys(payload).length,'The Merchant fine uses one engine-generated die.');assertMerchantFineContext(state,fine);
  const result=merchantFineRoll({die:dice(state,1,rolls,'Merchant mishap fine')});fine.die=result.die;fine.amount=result.amount;
  fine.status='decision';state.stage='merchant-fine-decision';return 'Merchant mishap fine Cr'+fine.amount+'.';
 }
 case 'resolve-merchant-fine':{
  const fine=activeMerchantFine(state);need(state.stage==='merchant-fine-decision'&&fine?.status==='decision','No Merchant fine decision is pending.');
  need(Object.keys(payload).length===1&&Object.hasOwn(payload,'decision'),'Use only the typed Merchant payment decision.');assertMerchantFineContext(state,fine);
  const result=merchantFineOutcome({die:fine.die,cash:state.character.cash,socialStanding:state.character.stats.SOC,decision:payload.decision,protectedStay:!!fine.origin.protectedStay});
  state.character.cash=result.cashAfter;const {record}=currentCareer(state);
  record.forcedExit=result.disposition==='leave'?true:fine.origin.protectedStay?!!fine.origin.protectedExitBefore:false;
  fine.decision=result.decision;fine.payment=copy(result.payment);fine.disposition={mode:result.disposition,forcedExit:!!record.forcedExit,nonpaymentDischarge:result.nonpaymentDischarge};
  fine.status='completed';fine.completion={age:state.character.age,generationTerms:state.character.terms,careerTerms:record.terms,cash:state.character.cash};
  const continuation=fine.continuation;fine.continuation=null;state.merchantFine=null;
  state.effectsQueue=copy(continuation.queue);state.effectNext=continuation.next;state.effectSteps=continuation.steps;
  if(result.reeducation){
   beginReeducation(state,{kind:'table-roll',table:'zhodani.re-education',source:{id:'aliens',page:276},
    reeducationOrigin:{...copy(fine.origin),merchantFineId:fine.id,nonpaymentDischarge:result.nonpaymentDischarge,explicitDischarge:result.nonpaymentDischarge}});
   fine.reeducationId=activeReeducation(state)?.id??null;
  }else drainEffects(state,rolls);
  return result.decision==='pay'?'Paid Merchant mishap fine Cr'+fine.amount+' from cash.':'Declined Merchant mishap fine Cr'+fine.amount+'. No debt added.'+(result.reeducation?' Separate re-education follows.':'');
 }

 case 'reeducation-roll':{
  const episode=activeReeducation(state);need(state.stage==='reeducation-roll'&&episode?.status==='awaiting-roll','No re-education roll is pending.');
  need(Object.keys(payload).every(k=>['anagathicTerms','anagathicsReason'].includes(k)),'Use only the typed anagathic history fields.');
  const terms=integer(payload.anagathicTerms,0,1000,'Anagathic terms'),reason=text(payload.anagathicsReason??'',500);
  need(terms===0||reason,'Nonzero anagathic history requires a source reason.');
  if(terms>0&&!state.coverage.includes('zhodani-reeducation'))state.coverage.push('zhodani-reeducation');
  episode.anagathicsReason=reason;episode.roll=reeducationRoll({die:dice(state,1,rolls,'Zhodani re-education'),anagathicTerms:terms});
  refreshReeducationPlan(state,episode);episode.status=episode.plan.requirements.some(r=>r.key==='fineDie')?'awaiting-fine':'decisions';
  state.stage=episode.status==='awaiting-fine'?'reeducation-fine':'reeducation-decisions';
  return 'Re-education: '+episode.roll.die+', modifier '+episode.roll.modifier+', result '+episode.roll.total+'.'+(reason?' Anagathic history: '+reason+'.':'');
 }
 case 'reeducation-fine':{
  const episode=activeReeducation(state);need(state.stage==='reeducation-fine'&&episode?.status==='awaiting-fine','No re-education fine roll is pending.');
  need(!Object.keys(payload).length,'The fine uses one engine-generated die.');episode.fineDie=dice(state,1,rolls,'Re-education fine');
  refreshReeducationPlan(state,episode);episode.status='decisions';state.stage='reeducation-decisions';return 'Re-education fine Cr'+episode.plan.fine+'.';
 }
 case 'resolve-reeducation':{
  const episode=activeReeducation(state);need(state.stage==='reeducation-decisions'&&episode?.status==='decisions','No re-education decisions are pending.');
  const requested=new Set(episode.plan.requirements.map(r=>r.key));need(Object.keys(payload).every(k=>requested.has(k)),'Submit only the requested typed re-education decisions.');
  const initialOverride=requested.has('rowOverride');episode.decisions={...episode.decisions,...copy(payload)};
  const plan=refreshReeducationPlan(state,episode);episode.decisionHistory.push({decisions:copy(payload),phase:episode.phase??'result'});
  if(initialOverride){need(payload.rowOverride,'Record the row ruling before continuing.');if(!state.coverage.includes('zhodani-reeducation'))state.coverage.push('zhodani-reeducation');episode.status=plan.requirements.some(r=>r.key==='fineDie')?'awaiting-fine':'decisions';state.stage=episode.status==='awaiting-fine'?'reeducation-fine':'reeducation-decisions';
   return 'Referee re-education row '+plan.row+'. Original modified result '+episode.roll.total+' retained. '+episode.decisions.rowOverride.reason;}
  need(plan.resolved,'Required re-education decisions remain: '+plan.requirements.map(r=>r.key).join(', ')+'.');
  if(Object.keys(payload).length&&!state.coverage.includes('zhodani-reeducation'))state.coverage.push('zhodani-reeducation');
  commitReeducation(state,episode,rolls);return 'Applied re-education result '+plan.row+'. Source decisions: '+JSON.stringify(episode.decisions)+'. Career time and treatment time are recorded separately.';
 }

 case 'setup': {
  need(state.stage==='identity','Identity has already been accepted.');
  const species=findSpecies(payload.species);need(species,'Unknown species.');
  need(!state.config.aezorghTwoDice||species.id==='aezorgh','The optional Aezorgh two-dice method applies only to Aezorgh. Disable it before selecting another species.');
  need(!(species.id==='zhodani'&&payload.culture==='imperial'),'Zhodani rules assume Consulate childhood. Select Human for outside-Consulate upbringing.');
  if(payload.variant!==undefined)need(species.id==='vargr','Only Vargr have this strain option.');
  if(species.id==='vargr'){const variant=payload.variant??'standard';need(variant==='standard'||Object.hasOwn(SPECIES_RULES.vargr.variants,variant),'Choose a supported Vargr strain.');state.character.variant=variant;}
  state.character.name=text(payload.name??'',80);state.character.species=species.id;
  state.character.gender=text(payload.gender??'',20);state.character.culture=payload.culture==='imperial'?'imperial':'native';
  state.character.homeworld=text(payload.homeworld??'',160);state.character.age=species.startAge;state.character.traits=copy(SPECIES_RULES[species.id]?.traits??[]);
  state.stage='statistics';return 'Started '+(state.character.name||'an unnamed Traveller')+' ('+species.name+').'+(species.id==='vargr'?' Vargr strain: '+state.character.variant+'.':'')+(species.id==='aezorgh'?(state.config.aezorghTwoDice?' Optional Aezorgh method: six raw 2D totals; reroll minimum 43 before placement and halving; free swaps; one-die destinations halve rounding down before species bonuses.':' Standard Aezorgh method: published 1D/2D formulas; raw reroll minimum 30; swaps within matching formula groups, with GM exceptions.'):'');
 }
 case 'configure': {
  need(state.stage==='identity'||state.stage==='statistics'&&!state.pool.length,'Options must be set before rolling.');
  if(payload.boons!==undefined)state.config.boons=integer(payload.boons,0,6,'Boon rolls');
  if(payload.minimumReroll!==undefined){need(typeof payload.minimumReroll==='boolean','Invalid reroll option.');state.config.minimumReroll=payload.minimumReroll;}
  if(payload.allocation!==undefined){need(typeof payload.allocation==='boolean','Invalid allocation option.');state.config.allocation=payload.allocation;}
  if(payload.extras!==undefined){need(Array.isArray(payload.extras)&&payload.extras.length<=6&&new Set(payload.extras).size===payload.extras.length,'Invalid extra characteristics.');need(payload.extras.every(x=>EXTRA_STATS.some(e=>e.id===x)),'Unsupported extra characteristic.');state.config.extras=[...payload.extras];}
  if(payload.aezorghTwoDice!==undefined){need(typeof payload.aezorghTwoDice==='boolean','The optional Aezorgh two-dice method must be true or false.');need(!payload.aezorghTwoDice||state.stage==='identity'||state.character.species==='aezorgh','The optional two-dice method applies only to Aezorgh.');state.config.aezorghTwoDice=payload.aezorghTwoDice;}
  if(payload.zhodaniPsi!==undefined){need(typeof payload.zhodaniPsi==='boolean','Invalid Zhodani PSI option.');state.config.zhodaniPsi=payload.zhodaniPsi;}
  const rerollSummary=state.stage==='identity'&&Object.hasOwn(payload,'aezorghTwoDice')?'minimum-total reroll '+(state.config.minimumReroll?'on':'off')+' (threshold confirmed at species setup)':'below-'+statisticsRerollThreshold(state)+' reroll '+(state.config.minimumReroll?'on':'off');
  return 'Generation options: '+state.config.boons+' boon rolls; player placement '+(state.config.allocation?'on':'off')+'; '+rerollSummary+'; extras '+(state.config.extras.join(', ')||'none')+'; Zhodani PSI option '+(state.config.zhodaniPsi?'on':'off')+'.'+(state.config.aezorghTwoDice?' Optional Aezorgh method: six raw 2D totals, free placement, then halve one-die destinations rounding down.':'');
 }
 case 'gm-mode': {
  need(typeof payload.enabled==='boolean','GM mode must be true or false.');
  const old=state.config.gm;state.config.gm=payload.enabled;return 'GM mode '+old+' → '+payload.enabled+'.';
 }
 case 'roll-statistics': {
  need(state.stage==='statistics','Statistics cannot be rolled at this stage.');

  const rerollThreshold=statisticsRerollThreshold(state);
  if(state.pool.length)need(statisticsCanReroll(state),'Reroll is available only below a six-score base total of '+rerollThreshold+', or in GM mode.');
  const species=findSpecies(state.character.species);
  if(state.config.zhodaniPsi){need(state.config.gm&&species.id==='zhodani','The Zhodani PSI option requires GM mode and a Zhodani Traveller.');state.optionalPsi=[9,9,10,10,11,12][dice(state,1,rolls,'Zhodani optional PSI')-1];}
  need(!state.config.aezorghTwoDice||species.id==='aezorgh','The optional two-dice method applies only to Aezorgh.');
  const formulas=species.id==='vargr'?{...species.dice,...(SPECIES_RULES.vargr.variants[state.character.variant]??{})}:species.dice;
  const basic=Object.entries(formulas).slice(0,6).map(([key,dice])=>species.id==='vargr'&&state.character.culture==='imperial'&&key==='CHA'?['SOC',[2,0]]:[key,dice]);
  const before=state.pool.length?state.pool.map(p=>p.base):null;
  state.pool=basic.map(([key,[formulaCount,adjustment]],i)=>{const count=state.config.aezorghTwoDice?2:formulaCount;return {key,count,formulaCount,adjustment,origin:key,base:dice(state,count,rolls,key,i<state.config.boons),boon:i<state.config.boons};});
  refreshStatisticsPool(state);
  return (before?'Rerolled statistics; previous '+before.join(', ')+'. ':'Rolled statistics. ')+'Base total '+state.rollTotal+'. Species modifiers excluded; extra characteristics excluded.'+statisticsDivisionSummary(state);
 }
 case 'swap-statistics': {
  need(state.stage==='statistics'&&state.pool.length===6,'Roll statistics first.');
  need(state.config.allocation||state.config.gm,'Player assignment is not enabled.');
  const a=integer(payload.a,0,5,'First score'),b=integer(payload.b,0,5,'Second score');need(a!==b,'Choose two different characteristics.');
  const mixedFormula=state.pool[a].formulaCount!==state.pool[b].formulaCount,freePlacement=state.character.species==='aezorgh'&&state.config.aezorghTwoDice;
  need(!mixedFormula||freePlacement||state.config.gm,'Published dice formulas differ. A GM override is required for this swap.');
  const old=[state.pool[a].base,state.pool[b].base];[state.pool[a].base,state.pool[b].base]=[state.pool[b].base,state.pool[a].base];
  [state.pool[a].boon,state.pool[b].boon]=[state.pool[b].boon,state.pool[a].boon];[state.pool[a].origin,state.pool[b].origin]=[state.pool[b].origin,state.pool[a].origin];[state.pool[a].count,state.pool[b].count]=[state.pool[b].count,state.pool[a].count];refreshStatisticsPool(state);
  return 'Swapped '+state.pool[a].key+' '+old[0]+' → '+old[1]+' and '+state.pool[b].key+' '+old[1]+' → '+old[0]+(mixedFormula&&!freePlacement?' (GM exception).':'.')+statisticsDivisionSummary(state);
 }
 case 'accept-statistics': {
  need(state.stage==='statistics'&&state.pool.length===6,'Roll statistics first.');
  const species=findSpecies(state.character.species);
  refreshStatisticsPool(state);
  for(const p of state.pool)state.character.stats[p.key]=p.value;
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
   else if(species.id==='aslan'&&state.character.culture==='native')beginAslanOrigin(state);
   else if(species.setup&&species.id!=='zhodani')sourceStep(state,'species-setup',species.source,species.setupPage,species.setup,'background');
  return 'Accepted statistics and generated selected extra characteristics.';
 }
 case 'begin-psionic-training':{
   need(!accessMandatory(state),'Resolve the accepted expedition before training.');need(['career','precareer'].includes(state.stage)&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation,'Begin institute training only between careers, before retirement.');
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
  if(state.character.aslanOrigin?.status==='pending'){state.character.aslanOrigin.background={source:{id:'aliens',page:20},skills:[...payload.skills],count:payload.skills.length,supplementsFamily:true};state.stage='aslan-rite';}
  return 'Background skills: '+payload.skills.join(', ')+'.';
 }
 case 'skip-precareer':need(state.stage==='precareer','Not choosing pre-career education.');state.stage='career';return 'Skipped pre-career education.';
 case 'open-precareer':{
  need(!accessMandatory(state),'Resolve the accepted expedition before education.');need(state.stage==='career'&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation,'Education is only available before choosing a career, not after retirement.');
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
  const input={resolvedEducationRulings:!!state.deferredSpecializations,id,term:state.character.terms+1,stats:state.character.stats,homeworld:config.homeworld,species:state.character.species,attemptedThisTerm:state.educationAttemptTerms?.includes(state.character.terms)??false};
  let outcome=companionEntryCheck(input);
  if(!outcome.resolved&&outcome.missingInputs?.length===1&&outcome.missingInputs[0]==='roll')outcome=companionEntryCheck({...input,roll:dice(state,2,rolls,'Companion education entry')});
  if(!outcome.resolved){companionSource(state,'entry',outcome);return 'Admission requires source resolution; no entry roll or term was assumed.';}
  need(outcome.eligible,outcome.reason??'Education entry is not available.');state.educationAttemptTerms??=[];state.educationAttemptTerms.push(state.character.terms);
  if(!outcome.success){state.pendingEducation=null;state.stage='career';return 'Companion education entry failed: total '+outcome.total+' against '+outcome.target+'. No term was consumed.';}
  startCompanionEducation(state,outcome,rolls);return 'Entered '+PRECAREERS.find(p=>p.id===id).name+(outcome.automatic?' automatically.':': total '+outcome.total+' against '+outcome.target+'.');
 }
 case 'companion-skill':{
  need(state.stage==='companion-skill'&&state.pendingChoice,'No Companion study choice is due.');
  const record=educationRecord(state),result=companionResolveSkillChoice({id:record.id,effect:state.pendingChoice,selected:state.deferredSpecializations&&Array.isArray(payload.selected)?payload.selected.map(n=>normalizedSkill(state,n).name):payload.selected,skills:state.character.skills,selections:record.selections});
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
  const e=state.pendingChoice,name=state.deferredSpecializations?normalizedSkill(state,text(payload.name,80)).name:text(payload.name,80),base=name.split(' (')[0];
  need(educationSkillValid(state,name,e),'Choose a listed education skill and an allowed specialisation.');
  if(SPECIALIZED.includes(base)&&e.selectionId!=='hobby')need(name.includes(' ('),'Choose the specialisation to retain for graduation.');
  const record=educationRecord(state);
  if(e.selectionId.startsWith('university-'))need(!Object.entries(record.selections).some(([id,n])=>id.startsWith('university-')&&n.split(' (')[0]===base),'Overlapping university choices require source adjudication. Choose different skill bases in the native flow.');
  record.selections[e.selectionId]=name;const awardName=e.value===0&&base!=='Profession'?base:name;if(skillAwardExceedsLimit(state,awardName,e.value,e.mode)){state.pendingChoice=null;nativeFallback(state,{kind:'skill',name:awardName,value:e.value,mode:e.mode,source:{id:'core',page:16}},'This education award would exceed the total skill limit. Resolve it explicitly from Core p. 18.');return 'Education skill choice recorded; its over-cap award requires source resolution.';}const acquired=independenceAcquired(state,awardName,rolls);if(acquired)gainSkill(state,awardName,e.value,e.mode);
  state.pendingChoice=null;drainEffects(state,rolls);return acquired?'Education skill '+name+' at level '+e.value+' recorded.':'Education skill '+name+' acquisition failed; the opportunity is recorded.';
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
  need(state.stage==='career'&&state.active===null&&!state.failedQualification,'Choose a career at the start of a term.');
  const entryPlan=reentryPlan(state,payload.id,payload.assignment,!!state.pendingDraft||state.forcedCareer===payload.id&&state.forcedCareerDraft);need(entryPlan.allowed,entryPlan.reason);
  const career=availableCareers(state).find(c=>c.id===payload.id);need(career&&!career.disabled,career?.reason??'This career is not available.');
  const assignment=career.assignments.find(a=>a.id===payload.assignment);need(assignment,'Choose an assignment.');need(!assignment.disabled,assignment.reason??'This assignment is unavailable.');
  const prerequisites=RULE_PACK[career.id]?.prerequisites??{};need(conditionMatches(state,prerequisites.assignments?.[assignment.id]),'This assignment has additional source prerequisites.');
  if(career.eligibility?.[assignment.id])need(state.character.gender===career.eligibility[assignment.id],'This assignment has a gender restriction.');
  if(career.id==='aslan.military'&&assignment.id==='support'&&state.character.gender==='male')need(stat(state,'SOC')<=8,'Male support assignment requires SOC 8 or less.');
  if(career.id==='core.psion'&&!state.character.psionics?.training.some(t=>t.completed)){startPsionicTraining(state,{context:'core-institute',source:{id:'core',page:228},next:'career',test:true,requiresTerms:true},rolls);return 'Complete psionic training before attempting Psion career entry.';}
  if(career.id==='zhodani.guard'&&assignment.id==='commando')need((state.character.stats.PSI??0)>=9,'Commando assignment requires PSI 9 or greater.');
  const educational=educationRights(state,career.id,assignment.id);
  if(educational.unresolved.length){const unresolved=educational.unresolved[0];if(unresolved.educationIndex!==undefined){sourceStep(state,'companion-career-rights',unresolved.source.id,unresolved.source.pages?.[0]??unresolved.source.page,unresolved.reason,'career');Object.assign(state.pending,{educationIndex:unresolved.educationIndex,career:career.id,assignment:assignment.id,citizenMapping:unresolved.citizenMapping});}else{sourceStep(state,'education-entry-rights','core',17,unresolved.reason,'career');state.pending.career=career.id;}return 'Education entry rights require source adjudication before qualification.';}
  const historicalApproval=historicalEntryApproval(state,career.id,assignment.id);
  const restoration=restorationForEntry(state,career.id);
  const transfer=transferForEntry(state,career.id,assignment.id);
  if(transfer&&!transfer.plan.resolved){sourceStep(state,'career-transfer',transfer.right.source.id,transfer.right.source.pages[0],'Transfer rank track','career');Object.assign(state.pending,{transferId:transfer.right.id,careerId:career.id,assignmentId:assignment.id,rank:transfer.right.retainedRank,rankTracks:copy(transfer.plan.rankTracks)});return 'Transfer rank-track source decision required.';}
  const qualification=prerequisites.qualificationByGender?.[state.character.gender]??career.qualification;
  const forced=state.forcedCareer===career.id;if(forced)state.pendingDraft=!!state.forcedCareerDraft;
  const officerOffer=state._aslanOfficerQualification?activeAslanOfficerOffer(state):null,access=accessForAttempt(state,career.id);
  const automaticReason=officerOffer?null:forced?'forced-career':transfer?'source-transfer':access?.automatic?'aslan-outward-source':nobleAutomaticQualification(career.id,state.character.stats)?'noble-social-standing':educational.automaticEntry?'education':state.automaticCareers?.includes(career.id)?'source-entry-right':!qualification?'no-check':null;
  if(!automaticReason&&!checkAvailable(state,qualification)&&!state._sourceCheck){missingCheck(state,qualification,'Qualification',command,{id:career.source,page:career.page});return 'Qualification requires source resolution for the missing characteristic.';}
  let modifier=(career.group==='core'?-state.character.careers.length:0)+educational.qualificationModifier+(automaticReason?0:modifierTotal(state,'qualification',true,career.id))+(officerOffer?.qualificationDM??0);

  if(career.agePenalty&&state.character.age>=career.agePenalty[0]&&!(prerequisites.qualificationModifiers??[]).some(m=>m.condition?.ageMin===career.agePenalty[0]&&m.dm===career.agePenalty[1]))modifier+=career.agePenalty[1];
  for(const m of prerequisites.qualificationModifiers??[])if(conditionMatches(state,m.condition))modifier+=m.dm;
  const check=automaticReason?null:rulesCheck(state,qualification,rolls,'Qualification',modifier);
  const transition=recordCareerTransition(state,career,assignment.id,check,automaticReason,entryPlan);
  if(access){access.status='consumed';access.attempt={careerId:career.id,assignment:assignment.id,generationTerms:state.character.terms,check:copy(check),automaticReason,success:!check||check.success};if(state.character.aslanCareerContext?.accessId===access.id)state.character.aslanCareerContext.status='established';}
  if(officerOffer){officerOffer.check=copy(check);officerOffer.transitionId=transition.id;}
  if(historicalApproval){historicalApproval.status='consumed';historicalApproval.attempt={careerId:career.id,assignment:assignment.id,careerIndex:check&&!check.success?null:state.character.careers.length,generationTerms:state.character.terms,check:copy(check),automaticReason,success:!check||check.success};}
  if(restoration){restoration.status='consumed';restoration.attempt={careerId:career.id,assignment:assignment.id,careerIndex:check&&!check.success?null:state.character.careers.length,generationTerms:state.character.terms,check:copy(check),automaticReason,success:!check||check.success};if((!check||check.success)&&restoration.decision.statusTiming==='on-successful-entry')state.character.outcast=false;}
  for(const r of state.character.educations??[])if(r.completed)r.careerAttempts=(r.careerAttempts??0)+1;
  if(check&&!check.success){
   state.failedQualification=true;state.failedQualificationContext={careerId:career.id,group:career.group,source:{id:career.source,page:career.page},generationTerms:state.character.terms};
   if(nativeAslan(state)&&career.group==='aslan')forfeitAslanClanShares(state,'qualification-failure:'+career.id,{id:'aliens',page:22},true);
   state.stage='failed-entry';return 'Failed '+career.name+' qualification: '+JSON.stringify(check)+'.';
  }
  enterCareer(state,career,assignment.id,rolls,transfer);return 'Entered '+career.name+' / '+assignment.name+(check?': '+JSON.stringify(check):' automatically')+'.';
 }
 case 'cancel-career-transfer':{
  need(state.stage==='book-step'&&state.pending?.kind==='career-transfer','No transfer rank-track decision is pending.');state.pending=null;state.stage='career';return 'Returned to career selection; transfer right remains unconsumed.';
 }
 case 'fallback': {
  need(state.stage==='failed-entry','No failed qualification to resolve.');
  if(forcedDraftPending(state)){
   need(state.active===null&&payload.draft===true,'Roll the required draft after collecting this career’s benefits.');
   const id=['core.navy','core.army','core.marine','core.merchant','core.scout','core.agent'][dice(state,1,rolls,'Forced Core draft')-1],career=findCareer(id),assignment=id==='core.merchant'?'marine':id==='core.agent'?'law':career.assignments[0].id;
   state.draftUsed=true;state.pendingDraft=true;state.forcedDraft.status='completed';state.forcedDraft.careerId=id;state.forcedDraft.assignment=assignment;
   enterCareer(state,career,assignment,rolls);return 'Forced draft entered '+career.name+'.';
  }
  const species=state.character.species;
  if(species==='zhodani'){sourceStep(state,'draft','aliens',255,'Resolve the Zhodani draft; select the resulting career with GM correction.','career');state.failedQualification=false;return 'Zhodani draft requires source resolution.';}
  const outwardFailure=nativeAslan(state)&&state.failedQualificationContext?.group==='core'&&!!accessContext(state),outwardDrifter=nativeAslan(state)&&state.failedQualificationContext?.group==='aslan'&&accessForAttempt(state,'core.drifter')?.route==='outside-failed-entry';
  let id=outwardFailure||outwardDrifter?'core.drifter':species==='aslan'&&state.character.culture==='native'?'aslan.outcast':species==='vargr'&&state.character.culture==='native'?'vargr.loner':'core.drifter';
  let assignment;
  if(payload.draft){
   need(!state.draftUsed,'The ordinary draft has already been used.');need(outwardFailure&&!accessContext(state).careerIds||!['aslan','vargr'].includes(species)||state.character.culture==='imperial','Use the culture-specific fallback; departure does not grant a second qualification or a new draft outside the recorded career scope.');
   id=['core.navy','core.army','core.marine','core.merchant','core.scout','core.agent'][dice(state,1,rolls,'Draft')-1];state.draftUsed=true;state.pendingDraft=true;
   assignment=id==='core.merchant'?'marine':id==='core.agent'?'law':findCareer(id).assignments[0].id;
  }
  const career=findCareer(id),access=accessForAttempt(state,id);if(access){access.status='consumed';access.attempt={careerId:id,assignment:assignment??career.assignments[0].id,generationTerms:state.character.terms,check:null,automaticReason:'fallback-no-check',success:true};state.character.aslanCareerContext.status='established';}enterCareer(state,career,assignment??career.assignments[0].id,rolls);return 'Fallback entered '+career.name+'.';
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
 case 'prisoner-escape': {
  need(prisonerEscapePending(state),'No Prisoner escape opportunity is pending.');
  need(Object.keys(payload).length===1&&['Stealth','Deception'].includes(payload.skill),'Choose Stealth or Deception for the escape check.');
  const effect=copy(state.pendingChoice.options[0].effects[0]),modifier=skillCheckDM(state,payload.skill);effect.skills=[payload.skill];
  state.pendingChoice=null;state.effectsQueue.unshift(effect);drainEffects(state,rolls);
  const total=rolls[0].total+modifier;return 'Prisoner escape using '+payload.skill+': '+total+' against 10+; '+(total>=10?'succeeded.':'failed. Parole Threshold +2 (maximum 12).');
 }
 case 'choose-effect': {
  need(state.stage==='effect-choice'&&state.pendingChoice,'There is no effect choice.');removeUnavailablePsionicAgeingChoice(state);
  const option=state.pendingChoice.options[integer(payload.index,0,state.pendingChoice.options.length-1,'Choice')];if(state.pendingChoice.awardId)benefitAward(state,state.pendingChoice.awardId).decisions.push({type:'choice',index:payload.index,label:option.label});state.pendingChoice=null;state.effectsQueue.unshift(...copy(option.effects));drainEffects(state,rolls);return 'Chose '+option.label+'.';
 }
 case 'skill-award-source':{
  need(state.stage==='skill-choice'&&state.pendingChoice,'No skill award is pending.');const effect=copy(state.pendingChoice);state.pendingChoice=null;nativeFallback(state,effect,'Resolve this constrained or over-cap skill award explicitly. Record the chosen outcome without exceeding the total skill limit.');return 'Skill award paused for explicit source resolution.';
 }
 case 'retry-skill-choice':{
  need(state.stage==='book-step'&&state.pending?.kind==='native-effect'&&['skill-choice','skill-reduction-choice'].includes(state.pending.effect?.kind),'No skill choice can be retried.');state.pendingChoice=copy(state.pending.effect);state.pending=null;state.stage='skill-choice';return 'Returned to the pending skill choice without applying an award.';
 }
 case 'choose-skill': {
  need(state.stage==='skill-choice'&&state.pendingChoice,'There is no skill choice.');const e=state.pendingChoice,name=normalizedSkill(state,text(payload.name,80),{requireSpeciality:!e.deferSpeciality&&(e.mode!=='set'||(e.value??1)>0)}).name;
  if(e.scope==='non-psionic'&&nonPsionicEligibility(name)==='source-required'){state.pendingChoice=null;nativeFallback(state,{...e,requestedName:name},'The selected Science subject is not classified for this non-psionic award. Confirm its non-psionic eligibility from the source before recording an award, or retry with a verified specialty.');return 'Unclassified Science specialty requires an explicit source eligibility decision; no skill awarded.';}
  need(skillNameAllowed(state,name,e),'Skill is not available for this award.');if(e.distinctSpecialties)distinctScienceSelection(name,e.selected??[]);
  if(coreTalentChoice(state,e)&&skillLevel(state,name)<0){state.pendingChoice=null;requestTalentAward(state,{...e,kind:'psionic-talent',name},rolls);return 'Selected '+name+' for a service-table acquisition attempt.';}
  if(e.scope==='new-psionic-talent'){gainSkill(state,name,0,'set',true);const history=psionicHistory(state);history.firstTalentChosen=true;history.rulings.push({context:'vargr-psion-event-8',source:{id:'aliens',page:201},talent:name,level:0,acquisitionCheck:false});state.pendingChoice=null;drainEffects(state,rolls);return 'Acquired '+name+' at level 0 after the event check. Aliens 2026 p. 201; no additional acquisition check.';}
  if(e.deferSpeciality&&SPECIALIZED.includes(name)&&(e.mode!=='set'||(e.value??1)>0)){deferSkillAward(state,{...e,name});state.pendingChoice=null;if((e.count??1)>1)state.effectsQueue.unshift({...e,count:e.count-1});drainEffects(state,rolls);return 'Recorded '+name+' award for specialization allocation.';}
  if((e.allocationId||e.deferSpeciality&&(e.mode!=='set'||(e.value??1)>0)&&SPECIALIZED.includes(name.split(' (')[0]))&&name.includes(' ('))need(allocationImproves(state,name,e),'This specialty would lose the award. Choose a different specialty.');
  const award=constrainedAward(state,name,e);
  if(state.deferredSpecializations&&!e.allocationId&&e.kind!=='skill-reduction-choice'&&name.includes(' (')){const allocations=allocationEffects(state,name.split(' (')[0]);if(allocations.length){for(const allocation of allocations)allocation.followingFixedAward={name,mode:award.mode,value:award.value??1};state.specializationContinuation={stage:state.stage,command:copy(command),pendingChoice:copy(state.pendingChoice),effectsQueue:copy(state.effectsQueue),effectNext:state.effectNext};queueEffects(state,allocations,'specialization-command',rolls);return 'Allocate earlier '+name.split(' (')[0]+' awards before this selected specialty.';}}
  if((e.mode!=='set'||(e.value??1)>0)&&SPECIALIZED.includes(name.split(' (')[0]))need(name.includes(' ('),'Choose a specialisation, for example Science (physics).');
  if(e.kind!=='skill-reduction-choice'&&skillAwardExceedsLimit(state,name,award.value??1,award.mode)){state.pendingChoice=null;nativeFallback(state,e,'The selected award would exceed the total skill limit. Choose another valid skill or record a source decision under Core p. 18.');return 'Over-cap skill choice requires an alternate selection or source resolution.';}
  if(e.kind==='skill-reduction-choice'){need(Object.hasOwn(state.character.skills,name)&&state.character.skills[name]>0,'Choose a trained skill to reduce.');if(e.names)need(e.names.includes(name),'Choose one of the indicated skills.');state.character.skills[name]=Math.max(0,state.character.skills[name]-e.value);}else {if(independenceAcquired(state,name,rolls))gainSkill(state,name,award.value??1,award.mode);bindAwardCheck(state,name);}if(e.allocationId){const saved=state.character.deferredSkillAwards.find(a=>a.id===e.allocationId);need(saved?.status==='pending','This award was already allocated.');saved.status='allocated';saved.speciality=name;}if(e.awardId)benefitAward(state,e.awardId).decisions.push({type:'skill',name,mode:e.mode,value:e.value??1});state.pendingChoice=null;if((e.count??1)>1)state.effectsQueue.unshift({...e,count:e.count-1,...(e.distinctSpecialties?{selected:[...(e.selected??[]),name]}:{})});drainEffects(state,rolls);return 'Selected '+name+' for a skill award.'+(e.trainingContext?' Aliens 2026 p. '+e.source.page+'; '+e.trainingContext.careerId+' / '+e.trainingContext.assignment+'; eligible tables: '+e.trainingContext.tables.join(', ')+'.':'');
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
  if(!check.success){record.mishap=true;record.forcedExit=career.id!=='core.prisoner';const result=dice(state,1,rolls,'Mishap table');if(pack?.mishaps[result])queueEffects(state,career.group==='zhodani'?withReeducationOrigin(pack.mishaps[result],reeducationOrigin(state,'mishap',result)):pack.mishaps[result],career.id==='core.prisoner'?'advancement':'end-term',rolls);else sourceStep(state,'mishap',career.source,career.page+1,'Resolve mishap result '+result+'.','term-end');}
  else {const result=dice(state,2,rolls,'Event table');if(pack?.events[result])queueEffects(state,career.group==='zhodani'?withReeducationOrigin(pack.events[result],reeducationOrigin(state,'event',result)):pack.events[result],'after-event',rolls);else sourceStep(state,'career-event',career.source,career.page+1,'Resolve career event result '+result+'.','advancement');}
  return 'Survival: '+JSON.stringify(check)+'.';
 }
 case 'advancement': {
  need(state.stage==='advancement','Not at advancement.');
  const {record,career,assignment}=currentCareer(state);
  if(!assignment.advancement){closeTerm(state);return 'This career has no conventional advancement roll.';}
  if(!checkAvailable(state,assignment.advancement)&&!state._sourceCheck&&!record.automaticPromotion){missingCheck(state,assignment.advancement,'Advancement',command);return 'Advancement check requires source resolution for the absent characteristic.';}
  const zhodaniAuto=career.group==='zhodani'&&(state.character.stats.SOC??0)>=10&&record.terms+1===(record.drafted?2:1);
  const check=record.automaticPromotion||zhodaniAuto?{natural:0,total:99,target:assignment.advancement.target,success:true,automatic:true}:rulesCheck(state,assignment.advancement,rolls,'Advancement',modifierTotal(state,'advancement')+(record.educationModifiers?.advancement??0)+(career.group==='zhodani'&&(state.character.stats.SOC??0)>=11?1:0));if(record.automaticPromotion)record.automaticCommission=false;record.automaticPromotion=false;
  if(career.id==='core.prisoner'){record.released=check.total>record.parole;record.forcedExit=record.released;}else if(check.total<=record.terms+1)record.forcedExit=true;
  if(check.natural===12&&career.id!=='core.prisoner'){record.forcedStay=true;record.forcedExit=false;}
  if(check.success){
   const previousRank=record.rank;const cap=career.id==='zhodani.government'&&stat(state,'SOC')<11?3:6;record.rank=Math.min(cap,record.rank+1);record.highestRank=Math.max(record.highestRank??0,record.rank);
   if(nativePack(state)){state.trainingNext='end-term';queueEffects(state,record.rank>previousRank?rankEffects(state):[],'training',rolls);}else sourceStep(state,'advancement-training',career.source,career.page,'Resolve rank bonuses and the additional training roll.','term-end');
  }else closeTerm(state);
  return 'Advancement: '+JSON.stringify(check)+'. Rank '+record.rank+'.';
 }

 case 'apply-psionic-games':{
  need(Object.keys(payload).length===0,'The Games application rolls its own dice and accepts no overrides.');
  const available=psionicGamesAvailability(state);need(available.available,available.reason);
  const history=gamesHistory(state),context=gamesContext(state);
  dice(state,2,rolls,'Psionic Games application');
  const application=psionicGamesApplication({socialClass:'intendant',previousApplications:history.applications.length,
   currentCareerId:context.career.id,psi:context.stats.PSI,dice:rolls.at(-1).values});
  const record={id:'games-'+(history.applications.length+1),source:copy(PSIONIC_GAMES_SOURCE),timing:'next-term-boundary',
   status:application.success?'pending':'failed',context,application,preliminaryRolls:[],preliminaries:null,final:null,
   competition:null,decisions:null,ordinaryEventEffects:[],audit:copy(application.audit),
   benefitAccounting:{mode:'ordinary-current-career-term',baseRolls:1,existingBlock:context.career.benefitBlock??0,
    expectedDelta:context.career.benefitBlock>0?0:1,source:[copy(PSIONIC_GAMES_SOURCE),{id:'core',title:'Core Rulebook Update 2022',pages:[46]}]}};
  history.applications.push(record);
  if(application.success){
   state.psionicGamesPending=history.applications.length-1;
   state.stage=gamesRemaining(record).length?'psionic-games-preliminaries':'psionic-games-final';
   if(state.stage==='psionic-games-final')record.preliminaries=psionicGamesPreliminaries({psi:context.stats.PSI,skills:context.skills,rolls:[]});
  }
  return 'Psionic Games application: '+JSON.stringify(application.audit[0])+'. Lifetime application used. '+(application.success?'Reserved the next term in '+context.career.id+'; no term or award is applied until all checks and source decisions are complete.':'Application failed; the ordinary next term remains available and no term was consumed.');
 }
 case 'psionic-games-preliminary':{
  need(state.stage==='psionic-games-preliminaries','Not at a Games preliminary check.');
  const record=assertGamesContext(state);
  need(Object.keys(payload).every(k=>k==='talent'),'Choose a possessed talent; dice and outcomes cannot be supplied.');
  const option=gamesRemaining(record).find(o=>o.talent===payload.talent);need(option,'Choose an unrolled talent actually possessed at application.');
  dice(state,2,rolls,'Psionic Games preliminary: '+option.talent);
  const values=copy(rolls.at(-1).values),one=psionicGamesPreliminaries({psi:record.context.stats.PSI,skills:{[option.talent]:option.level},rolls:[{talent:option.talent,dice:values}]});
  record.preliminaryRolls.push({talent:option.talent,dice:values,check:one.audit[0]});record.audit=gamesAudit(record);
  if(!gamesRemaining(record).length){record.preliminaries=psionicGamesPreliminaries({psi:record.context.stats.PSI,skills:record.context.skills,rolls:record.preliminaryRolls.map(({talent,dice})=>({talent,dice}))});state.stage='psionic-games-final';}
  return 'Psionic Games preliminary: '+JSON.stringify(record.audit.at(-1))+'. No skill is gained.';
 }
 case 'psionic-games-final':{
  need(state.stage==='psionic-games-final','Not at the Games final check.');
  need(Object.keys(payload).length===0,'The Games final rolls its own dice and accepts no overrides.');
  const record=assertGamesContext(state);need(record.preliminaries?.resolved&&!gamesRemaining(record).length,'Complete every possessed-talent preliminary first.');
  dice(state,2,rolls,'Psionic Games final');record.final=psionicGamesFinal({preliminaries:record.preliminaries,dice:rolls.at(-1).values});
  record.audit=gamesAudit(record);record.competition=gamesCompetition(record);state.stage='psionic-games-decisions';
  return 'Psionic Games final: '+JSON.stringify(record.audit.at(-1))+'. Checks retained; source decisions are required before awards and term completion.';
 }
 case 'complete-psionic-games':{
  need(state.stage==='psionic-games-decisions','Complete the Games checks before recording source decisions.');
  const record=assertGamesContext(state),decisions=gamesDecisionInput(payload),outcome=gamesCompetition(record,decisions);
  need(outcome.resolved&&outcome.completed,'Record every required Games source decision: '+outcome.unresolved.map(d=>d.key).join(', ')+'.');
  const external=gamesExternalEffects(state,payload);record.decisions=copy(outcome.decisions);record.ordinaryEventEffects=copy(external);
  if(!state.coverage.includes('psionic-games'))state.coverage.push('psionic-games');
  record.competition=copy(outcome);record.audit=copy(outcome.audit);
  // No new career, ordinary skill roll, survival check or advancement is inserted.
  queueEffects(state,sourcedEffects(outcome.effects,PSIONIC_GAMES_SOURCE),'psionic-games-complete',rolls);
  return 'Completed Psionic Games source decisions: '+JSON.stringify(record.decisions)+'. External event effects: '+JSON.stringify(external)+'. One four-year term in '+record.context.career.id+'; ordinary benefit accounting and due ageing follow.';
 }

 case 'continue-career': {
  need(state.stage==='term-end','Not at the end of a term.');
  const {record,career}=currentCareer(state);need(!record.forcedExit,'This career must be left.');need(!accessMandatory(state),'The accepted expedition requires a Core career attempt next term.');
  expireAslanAccessBoundary(state,'continued-originating-career');expireAslanRestorationBoundary(state,'continued-originating-career');expireAslanOfficerBoundary(state,'continued-originating-career');record.forcedStay=false;if(nativePack(state))state.stage='training';else sourceStep(state,'term-training',career.source,career.page,'Resolve this term training roll.','survival');return 'Continued '+career.name+'.';
 }
 case 'commission': {
  const availability=commissionAvailability(state);need(availability.available,availability.reason);const {record,career}=currentCareer(state);
  if(availability.sourceRequired){missingCheck(state,{stat:'SOC',target:career.commission},'Commission',command);return 'Commission check requires source resolution for the absent characteristic.';}record.commissionTried=true;
  const bonus=modifierTotal(state,'advancement',false)-record.terms+(record.educationModifiers?.commission??0);
  const check=record.automaticCommission||career.group==='zhodani'?{automatic:true,success:true,total:99}:rulesCheck(state,{stat:'SOC',target:career.commission},rolls,'Commission',bonus);
  if(check.success){modifierTotal(state,'advancement');record.highestRank=Math.max(record.highestRank??record.rank,record.rank,1);record.rank=1;record.officer=true;if(record.automaticCommission)record.automaticPromotion=false;record.automaticCommission=false;queueEffects(state,rankEffects(state),'end-term',rolls);}
  return 'Commission: '+JSON.stringify(check)+(check.success?'. Became rank 1 officer; no advancement roll this term.':'. Advancement remains available.');
 }
 case 'leave-career': {
  const options=exitOptions(state),retire=payload.retire===true;need(retire?options.canRetire:options.canLeave,retire?options.retireReason:options.leaveReason);
  const {record,career}=currentCareer(state);
  if(retire){state.character.retirementFromCreation=true;state.character.retirementDecision={careerId:career.id,careerIndex:state.active,terms:record.terms,source:{id:'aliens',page:22},purpose:'Finish creation after benefits, without a career transfer.'};record.retiredFromCreation=true;}
  record.exit=record.transferVoluntaryExit?'voluntary':record.forcedExit?'involuntary':'voluntary';record.exitGenerationTerms=state.character.terms;record.exitAge=state.character.age;record.exitAssignment=record.assignment;
  const highest=record.highestRank??record.rank;const bonus=Math.max(0,rankBenefitRolls(record)-(state.correctedCareerEvents?(record.forfeitedRankBenefitRolls??0):0));
  record.benefitRolls+=bonus;
  for(const loss of state.character.lifeBenefitLosses??[]){if(loss.status!=='owed'||loss.careerIndex!==null&&loss.careerIndex!==state.active)continue;if(record.benefitRolls>0){record.benefitRolls--;loss.status='applied';loss.appliedCareerIndex=state.active;}else if(loss.careerIndex!==null){loss.status='unavailable';}}

  record.benefitDM=highest>=5?1:0;
  const pension=pensionEntitlement({careerId:career.id,terms:record.terms,soc:state.character.stats.SOC});record.pensionEntitlement=copy(pension);
  if(career.group==='zhodani')record.pensionExitStatusBasis={soc:state.character.stats.SOC,socialClass:state.character.stats.SOC>=11?'noble':state.character.stats.SOC===10?'intendant':'prole',source:{id:'aliens',page:277}};
  if(pension.needsAdjudication){sourceStep(state,'pension',pension.source.id,pension.source.page,pension.reason,'leave-career');state.pending.careerIndex=state.active;return 'Pension entitlement requires an explicit source decision before mustering out.';}
  record.pension=pension.annualCredits;record.pensionCondition=pension.condition;finishCareerExit(state);
  return 'Left '+career.name+' with '+record.benefitRolls+' benefit rolls.'+(retire?' Early retirement ends creation after these benefits; no career transfer.':'');
 }
 case 'resolve-benefit-wager':{
  need(state.stage==='benefit-wager','No benefit wager is pending.');
  const wager=state.character.benefitWagers?.find(w=>w.id===state.pendingBenefitWager),{career,record}=currentCareer(state);
  if(wager?.crossCareerRouteId)assertCrossCareerContext(state,crossCareerRoute(state,wager.crossCareerRouteId));
  need(wager?.status==='pending'&&wager.careerId===career.id&&wager.careerIndex===state.active&&wager.assignment===record.assignment&&wager.available===record.benefitRolls&&wager.continuation===state.effectNext,'The pending wager context changed.');
  need(Object.keys(payload).every(k=>['stake','skill'].includes(k)),'Use only the wager stake and selected skill.');
  const stake=integer(payload.stake,0,wagerLimit(wager.route,record.benefitRolls),'Wager stake'),rule=BENEFIT_WAGERS[wager.route];
  need(stake===0?payload.skill===undefined:rule.skills.includes(payload.skill),'Choose an allowed skill, or decline without a skill.');
  wager.stake=stake;wager.before=record.benefitRolls;state.pendingBenefitWager=null;
  if(stake===0){wager.status='declined';wager.after=record.benefitRolls;drainEffects(state,rolls);return 'Declined the optional benefit wager. No roll or additional skill gain.';}
  wager.skill=payload.skill;const natural=dice(state,2,rolls,'Benefit wager: '+payload.skill),modifier=skillCheckDM(state,payload.skill),total=natural+modifier;
  wager.check={natural,modifier,total,target:8,success:total>=8};wager.delta=wagerDelta(wager.route,stake,wager.check.success);record.benefitRolls+=wager.delta;wager.after=record.benefitRolls;wager.status='resolving';
  state.effectsQueue.unshift(...(rule.train?[{kind:'skill',name:payload.skill,value:1,source:copy(rule.source)}]:[]),{kind:'benefit-wager-complete',id:wager.id});drainEffects(state,rolls);
  return 'Wagered '+stake+' accrued benefit rolls using '+payload.skill+': '+(wager.check.success?'success':'failure')+'; benefit roll change '+wager.delta+'.';
 }
 case 'benefit': {
  need(state.stage==='benefits','No benefits to roll.');
  const {record,career}=currentCareer(state);need(record.benefitRolls>0,'No benefit rolls remain.');
  const cash=payload.cash===true;need(!cash||cashRollsUsed(state)<cashLimit(state),'The species cash-roll limit has been reached.');
  const speciesModifiers=(nativePack(state)?.prerequisites.benefitModifiers??[]).filter(m=>conditionMatches(state,m.condition)&&(!m.table||m.table===(cash?'cash':'material'))).reduce((n,m)=>n+m.dm,0);
  const lifeBonusIds=payload.lifeBonusIds??[];need(Array.isArray(lifeBonusIds)&&new Set(lifeBonusIds).size===lifeBonusIds.length,'Select distinct life-event Benefit bonuses.');
  const lifeBonuses=lifeBonusIds.map(id=>{const b=state.character.lifeBenefitBonuses?.find(b=>b.id===id&&b.status==='available');need(b,'The life-event Benefit bonus is unavailable.');return b;});
  const lifeModifier=lifeBonuses.reduce((n,b)=>n+b.value,0);
  const credits=selectedBenefitCredits(state,payload),creditIds=credits.map(c=>c.id),creditModifier=credits.reduce((n,c)=>n+c.value,0);
  const modifier=(record.benefitDM??0)+(cash&&Object.hasOwn(state.character.skills,'Gambler')?1:0)+modifierTotal(state,'benefit')+speciesModifiers+creditModifier+lifeModifier;
  const result=dice(state,1,rolls,cash?'Cash benefit':'Material benefit')+modifier;
  for(const b of lifeBonuses){b.status='consumed';b.consumption={careerId:career.id,careerIndex:state.active,cash,die:result-modifier,result};}
  consumeBenefitCredits(credits,{kind:'ordinary',careerId:career.id,careerIndex:state.active,cash,die:result-modifier,result});
  state.benefitRollContext={careerId:career.id,careerIndex:state.active,table:cash?'cash':'material',modifier,natural:result-modifier,result,creditIds,lifeBonusIds,rolls:[{natural:result-modifier,modifier,result}]};
  if(cash){state.cashRolls++;const account=cashRollAccount(state);if(account)state.character.cashRollAccounts[account]++;if(Object.hasOwn(state.character.stats,'WLT'))state.character.stats.WLT=Math.min(15,state.character.stats.WLT+1);}
  const pack=nativePack(state),index=result-1;
  if(index>=7||index<0){sourceStep(state,'benefit',career.source,career.page,'Benefit result '+result+' is outside the printed table. Referee adjudication required.','benefits');state.pending.rollContext=copy(state.benefitRollContext);return 'Benefit roll exceeds printed table; no result was assumed.';}
  if(pack){const origin={careerId:career.id,careerIndex:state.active,source:{id:career.source,page:career.page},tableContext:{careerId:career.id,table:cash?'cash':'material',modifier,natural:result-modifier,result}};state.benefitRollContext={...origin.tableContext,careerIndex:state.active,creditIds,lifeBonusIds,rolls:[{natural:result-modifier,modifier,result}]};queueEffects(state,cash?[{kind:'cash',value:pack.benefits.cash[index]*(state.character.species==='aslan'&&state.character.culture==='native'&&state.character.gender==='male'&&cashRollAccount(state)!=='core'?0.5:1)}]:markBenefitOrigin(pack.benefits.material[index],origin),'benefit-complete',rolls);}else sourceStep(state,'benefit',career.source,career.page,'Resolve '+(cash?'cash':'material')+' benefit result '+result+'.','benefits');
  return 'Rolled '+(cash?'cash':'material')+' benefit '+result+' (DM '+modifier+').';
 }
 case 'resolve-prisoner-lawyer':{
  need(state.stage==='book-step'&&state.pending?.kind==='prisoner-lawyer','No lawyer opportunity is pending.');
  const entry=state.character.prisonerLawyers?.find(e=>e.id===state.pending.lawyerId),{career,record}=currentCareer(state);
  need(entry?.status==='pending'&&entry.careerIndex===state.active&&career.id==='core.prisoner','No pending Prisoner lawyer opportunity.');
  need(Object.keys(payload).every(k=>['outcome','level','zeroLevelConfirmed','reason'].includes(k)),'Use only typed lawyer decision fields.');
  need(['hire','decline'].includes(payload.outcome),'Choose hire or decline.');
  const decision={outcome:payload.outcome};
  if(payload.outcome==='hire'){
   need(typeof payload.level==='number'&&Number.isSafeInteger(payload.level)&&payload.level>=0,'Advocate level must be a nonnegative integer.');
   const level=payload.level,cost=1000*level*level;need(Number.isSafeInteger(cost),'Lawyer cost exceeds the supported exact credit range.');
   if(level===0){need(payload.zeroLevelConfirmed===true,'The referee must explicitly confirm a level-0 lawyer.');const reason=text(payload.reason??'',500);need(reason,'Record the source ruling for a level-0 lawyer.');Object.assign(decision,{zeroLevelConfirmed:true,reason});}
   else need(payload.zeroLevelConfirmed===undefined&&payload.reason===undefined,'A positive-level lawyer needs no level-0 ruling.');
   need(state.character.cash>=cost,'Insufficient cash to hire this lawyer. No debt or outside funding is assumed.');
   const cashBefore=state.character.cash;state.character.cash-=cost;
   const natural=dice(state,2,rolls,'Lawyer Advocate check'),total=natural+level,success=total>=8;
   const reduction=success?dice(state,1,rolls,'Lawyer parole reduction'):0;
   record.parole=Math.min(12,record.parole-reduction);
   Object.assign(decision,{level,cost,cashBefore,cashAfter:state.character.cash,check:{natural,total,target:8,success},reduction});
  }else need(payload.level===undefined&&payload.zeroLevelConfirmed===undefined&&payload.reason===undefined,'Declining cannot include hiring terms.');
  Object.assign(entry,{status:'completed',decision,paroleAfter:record.parole});state.pending=null;drainEffects(state,rolls);return payload.outcome==='hire'?'Hired Advocate '+decision.level+' lawyer for Cr'+decision.cost+'. Appeal '+decision.check.total+' vs 8; parole '+entry.paroleBefore+' → '+entry.paroleAfter+'.'+(decision.reason?' Ruling: '+decision.reason:''):'Lawyer opportunity declined.';
 }
 case 'resolve-life-event': {
  need(state.stage==='book-step'&&state.pending?.kind==='core-life-decision','No life event decision is pending.');
  const pending=state.pending,r=state.character.lifeEvents.find(r=>r.id===pending.lifeEventId);need(r?.status==='pending','The life event is already complete.');
  const fields={narrative:['outcome'],ending:['role','name'],betrayal:['role','name','relationshipId'],artefact:['name'],crime:['outcome'],psionics:['outcome','funding','cost','timingConfirmed']}[pending.decision];
  need(Object.keys(payload).every(k=>['confirmed','reason',...fields].includes(k)),'Use only the typed life event decision fields.');need(payload.confirmed===true,'Confirm the source decision.');const reason=text(payload.reason??'',500);need(reason,'Record the life event decision reason.');
  const decision={kind:pending.decision,reason};
  if(pending.decision==='narrative'){
   need(lifeNarrativeOptions(r).includes(payload.outcome),'Choose a source narrative outcome.');decision.outcome=payload.outcome;
  }else if(['ending','betrayal'].includes(pending.decision)){
   need(['Rival','Enemy'].includes(payload.role),'Choose Rival or Enemy.');const eligible=state.character.relationships.filter(x=>['Contact','Ally'].includes(x.role));
   if(pending.decision==='betrayal'&&eligible.length){const target=eligible.find(x=>x.id===payload.relationshipId);need(target,'Choose an existing Contact or Ally.');decision.relationshipId=target.id;decision.before=copy(target);target.role=payload.role;decision.after=copy(target);need(!payload.name,'A conversion preserves the existing relationship name.');}
   else{need(!payload.relationshipId,'No existing relationship can be converted.');const name=text(payload.name??'',120)||'Unnamed '+payload.role.toLowerCase();addRelationship(state,payload.role,name);decision.after=copy(state.character.relationships.at(-1));}
  }else if(pending.decision==='artefact'){
   const name=text(payload.name??'',120);need(name,'Record the agreed artefact name.');state.character.assets??=[];const asset={id:'life-asset-'+r.id,type:'equipment',category:r.row===3?'alien artefact':'ancient technology',name,active:true,ownership:'owned',owner:'Traveller',source:copy(CORE_LIFE_SOURCE),sourceDecision:reason,lifeEventId:r.id};state.character.assets.push(asset);decision.assetId=asset.id;
  }else if(pending.decision==='crime'){
   need(['lose-benefit','prisoner'].includes(payload.outcome),'Choose one Benefit roll loss or Prisoner.');decision.outcome=payload.outcome;
   if(payload.outcome==='prisoner'){state.forcedCareer='core.prisoner';state.character.sentenced=true;if(state.active!==null)currentCareer(state).record.lifeCrimeExitPending=true;}
   else{state.character.lifeBenefitLosses??=[];state.character.lifeBenefitLosses.push({id:r.id,source:copy(CORE_LIFE_SOURCE),careerIndex:state.active,status:'owed'});}
  }else if(pending.decision==='psionics'){
   need(['decline','test'].includes(payload.outcome),'Choose whether to test psionic strength.');decision.outcome=payload.outcome;
   if(payload.outcome==='test'){
    need(!state.character.psionicLoss,'Permanent psionic loss prevents testing.');need(payload.timingConfirmed===true,'Confirm testing timing with the referee.');
    const tested=Object.hasOwn(state.character.stats,'PSI');const cost=integer(payload.cost,0,1000000000,'Testing cost');need(['cash','provided'].includes(payload.funding),'Choose testing funding.');
    if(tested){need(cost===0,'Existing psionic strength is retained without another charge or roll.');}
    else if(payload.funding==='cash'){need(cost>=5000,'Psionic testing costs at least Cr5000.');need(state.character.cash>=cost,'Insufficient cash for testing.');state.character.cash-=cost;}
    else need(cost===0,'Provided testing has no personal charge; record its provider in the reason.');
    if(!tested)recordPsionicTest(state,'core-life-event',dice(state,2,rolls,'Psionic potential'),completedCareerTerms(state));
    Object.assign(decision,{testingSource:{id:'core',page:228},funding:payload.funding,cost,timingConfirmed:true,existingPotential:tested,psi:state.character.stats.PSI});
    if(state.character.stats.PSI>0)state.character.lifePsionAccess={source:copy(CORE_LIFE_SOURCE),lifeEventId:r.id,availableAtTerms:state.character.terms+1,careerCount:state.character.careers.length};
   }else need(payload.cost===undefined&&payload.funding===undefined&&payload.timingConfirmed===undefined,'Declining testing cannot include testing terms.');
  }
  r.decision=decision;state.pending=null;drainEffects(state,rolls);return 'Life event decision recorded. '+reason;
 }
 case 'resolve-book': {
  need(state.stage==='book-step'&&state.pending,'No source step to resolve.');
  need(payload.confirmed===true,'Confirm you checked the indicated source.');
  const pending=copy(state.pending);
   need(pending.kind!=='core-life-decision','Use the typed life event decision command.');
   if(pending.kind==='aslan-officer-status'){
    need(state.config.gm,'Enable GM mode to verify the historical restoration or exception.');need(!(payload.effects??[]).length,'History verification cannot change characteristics or grant benefits.');need(typeof payload.aslanOfficerStatusApproved==='boolean','Record approval or denial of this offer-specific exception.');const note=text(payload.note??'',500);need(note,'Identify the source restoration or applicable exception.');if(payload.aslanOfficerStatusApproved)need(payload.aslanOfficerStatusConfirmed===true,'Confirm a source-earned restoration or applicable exception.');
    const offer=state.character.aslanOfficerOffers.find(o=>o.id===pending.offerId);need(offer?.status==='offered','The reviewed officer offer is no longer available.');offer.statusVerification={approved:payload.aslanOfficerStatusApproved,reason:note,priorCareerIndices:copy(pending.priorCareerIndices),source:{id:'aliens',page:22}};if(!state.coverage.includes('aslan-officer-status'))state.coverage.push('aslan-officer-status');state.pending=null;state.stage=pending.next??pending.resumeStage;
    if(!payload.aslanOfficerStatusApproved){offer.status='declined';return 'Officer offer declined after historical status review. '+note;}
    return 'Officer history verified for this offer only. '+note+'. '+apply(state,{type:'begin-aslan-officer',payload:{offerId:offer.id,assignment:pending.assignment}},rolls);
   }

   if(pending.kind==='zhodani-ageing-psi'){
    need(payload.ageingPsiConfirmed===true,'Confirm the referee ruling that this ageing loss affects PSI.');const note=text(payload.note??'',500);need(note,'Record the PSI ageing source ruling.');need(!(payload.effects??[]).length,'The PSI ageing ruling uses its typed fields only.');
    need(state.character.stats.PSI>0&&!state.character.psionicLoss,'PSI is already unavailable.');
    state.character.psionicAgeingRulings??=[];state.character.psionicAgeingRulings.push({note,source:{id:'aliens',page:277},before:state.character.stats.PSI,after:state.character.stats.PSI-1});
    state.pending=null;state.effectsQueue.unshift({kind:'stat',name:'PSI',value:-1,ageingOrigin:true});drainEffects(state,rolls);return 'Referee PSI ageing ruling recorded. '+note;
   }
   if(pending.kind==='zhodani-anagathic-ageing'){
    const note=text(payload.note??'',500);need(note,'Record the anagathic ageing source ruling.');need(!(payload.effects??[]).length,'Use the typed ageing modifier only.');
    const terms=integer(payload.ageingAnagathicTerms,0,pending.ageingTerms,'Anagathic ageing credit');state.pendingAgeingAnagathicTerms=terms;
    state.character.anagathicAgeingRulings??=[];state.character.anagathicAgeingRulings.push({terms,note,age:state.character.age,source:{id:'core',page:49}});
    state.pending=null;state.stage='ageing';return 'Anagathic ageing credit '+terms+' recorded. '+note+'. Roll ageing to continue.';
   }

   if(pending.kind==='career-transfer'){
    const right=state.character.careerTransfers?.find(r=>r.id===pending.transferId);need(right?.status==='unconsumed','The transfer right is no longer available.');
    need(!(payload.effects??[]).length,'Transfer rank mapping uses typed fields, not generic effects.');const note=text(payload.note??'',500);need(note,'Record the source rank-track decision.');
    const decision={rankTrack:payload.transferRankTrack,reason:note};const plan=careerTransferEntry({right,completedTerms:state.character.terms,careerCount:state.character.careers.length,activeCareerIndex:state.active,careerId:pending.careerId,assignmentId:pending.assignmentId,rankTrackDecision:decision});
    need(plan.available&&plan.resolved,'The transfer context changed or its rank mapping is incomplete.');right.rankTrackDecision=copy(plan.decision);
    state.pending=null;state.stage='career';const result=apply(state,{type:'career',payload:{id:pending.careerId,assignment:pending.assignmentId}},rolls);
    return 'Transfer rank track '+decision.rankTrack+'. '+note+'. '+result;
   }
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
    const ruling={kind:pending.kind,approved:true,note,quotedCost:cost,cost,funding:payload.psionicFunding,timingConfirmed:true};psionicHistory(state).rulings.push(ruling);active.termsResolved=true;
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
    const names=payload.educationSelections.map(n=>normalizedSkill(state,text(n,80)).name);need(names.every(n=>SKILLS.includes(n.split(' (')[0])),'Choose supported skill names.');
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
    need(['first-son','second-son','daughter'].includes(payload.birthOrder),'Choose a canonical Aslan birth-order label.');state.character.birthOrder=payload.birthOrder;
   }
  }
  state.pending=null;if(riteEffects)queueEffects(state,riteEffects,'background',rolls);else advanceAfterBook(state,pending,payload,rolls);
  return 'Source-assisted '+pending.kind+' confirmed. '+text(payload.note??'',500)+' Effects: '+JSON.stringify(payload.effects??[])+'.';
 }
 case 'connection': {
  need(['career','term-end','retirement','finish'].includes(state.stage),'Add connections between terms or at completion.');
  need(state.connections.length<2,'At most two connections award skills.');
  const person=text(payload.person,80);need(person&&!state.connections.some(c=>c.person.toLowerCase()===person.toLowerCase()),'Use a different Traveller for each connection.');
  const skill=state.deferredSpecializations?normalizedSkill(state,text(payload.skill,80)).name:text(payload.skill,80);need(skill!=='Jack-of-all-Trades','Connections cannot award Jack-of-all-Trades.');
  if(state.deferredSpecializations)need(skillNameAllowed(state,skill,{scope:'any'}),'Skill is not available for this connection.');
  need((state.character.skills[skill]??0)<3,'A connection cannot increase a skill above level 3.');
  if(state.deferredSpecializations){const parsed=normalizedSkill(state,skill);need(SKILLS.includes(parsed.base),'Choose a supported skill.');if(SPECIALIZED.includes(skill)){deferSkillAward(state,{kind:'skill',name:skill,mode:'increase',value:1,maximum:3,connection:person});state.connections.push({person,skill,note:text(payload.note??'',300)});return 'Connection with '+person+': '+skill+' award saved for specialization allocation.';}const awards=allocationEffects(state,parsed.base);if(awards.length){for(const award of awards)award.followingConnection=skill;state.specializationContinuation={stage:state.stage,command:copy(command)};queueEffects(state,awards,'specialization-command',rolls);return 'Allocate earlier '+parsed.base+' awards before the connection skill.';}}
  const acquired=independenceAcquired(state,skill,rolls);if(acquired)gainSkill(state,skill,1);state.connections.push({person,skill,note:text(payload.note??'',300),...(state.deferredSpecializations&&!acquired?{acquired:false}:{})});return 'Connection with '+person+': '+skill+(acquired?' gained.':' acquisition failed; the opportunity is recorded.');
 }
 case 'add-extra': {
  need(state.pending?.kind!=='core-life-decision','Finish the pending life event decision before extra characteristics.');
  need(state.stage!=='identity'&&state.stage!=='statistics','Accept the six characteristics first.');
  const extra=EXTRA_STATS.find(e=>e.id===payload.id);need(extra,'Choose an available characteristic.');need(!Object.hasOwn(state.character.stats,extra.id),'This characteristic already exists.');
  const value=extra.derive?(state.character.stats[extra.derive]??0):dice(state,extra.dice,rolls,extra.id);
  state.character.stats[extra.id]=extra.id==='PSI'?Math.max(0,value-completedCareerTerms(state)):value;
   if(extra.id==='PSI')recordPsionicTest(state,'referee-potential',value,completedCareerTerms(state));
  state.config.extras.push(extra.id);return 'Added '+extra.name+' '+state.character.stats[extra.id]+'. '+extra.source+(extra.id==='PSI'?'; testing reduced by completed career terms. Potential does not grant training or talents.':'.');
 }
 case 'ageing':{
  need(state.stage==='ageing','No ageing roll is due.');const species=findSpecies(state.character.species);
  const checkpoint=state.treatmentAgeing?.checkpoints[state.treatmentAgeing.index],baseTerms=checkpoint?.terms??state.character.terms+(state.character.treatmentAgeingTerms??0);
  const termPenalty=baseTerms*(species.agingTermMultiplier??1),bonus=species.agingDMUntil&&state.character.age<species.agingDMUntil[0]?species.agingDMUntil[1]:0;
  const unconfirmedAnagathics=state.character.species==='zhodani'&&(state.character.reeducations??[]).some(e=>e.roll?.anagathicTerms>0)&&state.pendingAgeingAnagathicTerms==null;
  if(unconfirmedAnagathics){
   sourceStep(state,'zhodani-anagathic-ageing','core',49,'Record the applicable anagathic ageing credit for this check.','ageing');state.pending.ageingTerms=Math.max(0,termPenalty-bonus);return 'Anagathic ageing credit requires a source ruling before rolling.';
  }
  const roll=dice(state,2,rolls,'Ageing'),anagathicTerms=state.pendingAgeingAnagathicTerms??0;
  const result=ageingOutcome({roll,terms:Math.max(0,termPenalty-bonus),anagathicTerms});
  if(state.character.species==='zhodani')state.ageingCheck={roll,terms:termPenalty,anagathicTerms,checkpoint:checkpoint??null,statsBefore:copy(state.character.stats)};
  if(result.needsAdjudication)sourceStep(state,'ageing','core',49,result.reason+' Apply species modifiers from '+species.source+' p. '+species.page+'.','ageing-finish');
  else queueEffects(state,state.character.species==='zhodani'?zhodaniAgeingEffects(state,result.effects):result.effects,'ageing-crisis',rolls);
  return 'Ageing roll '+roll+', term DM -'+termPenalty+', species DM +'+bonus+'.'+(anagathicTerms?' Anagathic DM +'+anagathicTerms+'.':'');
 }
 case 'notes': {
  const old=state.character.notes;state.character.notes=text(payload.text,10000);return 'Background notes changed ('+old.length+' → '+state.character.notes.length+' characters).';
 }
 case 'gm-override':
  need(state.pending?.kind!=='core-life-decision','Finish the pending life event decision before corrections.'); {
  need(state.config.gm,'Enable GM mode before changing results.');const reason=text(payload.reason??'',300);need(reason,'A reason is required for an override.');
  const field=text(payload.field,40);let old;
  if(field.startsWith('stat.')){const key=field.slice(5);need(!(state.character.species==='aezorgh'&&key==='CHA'),'Aezorgh CHA is derived from SOC; change SOC instead.');need(/^[A-Z][A-Z0-9]{1,7}$/.test(key),'Invalid characteristic code.');old=state.character.stats[key];need(key!=='PSI'||!state.character.psionicLoss||payload.value===0,'Ageing permanently removed psionic ability. Use an audited restore/replay to correct its originating loss.');setStat(state,key,integer(payload.value,0,40,'Characteristic'));}
  else if(field==='age'){old=state.character.age;state.character.age=integer(payload.value,0,500,'Age');}
  else if(field==='cash'||field==='debt'){old=state.character[field];state.character[field]=integer(payload.value,0,100000000,'Amount');}
  else if(field==='pool'){
   need(state.stage==='statistics'&&state.pool.length===6,'Roll statistics first.');const index=integer(payload.index,0,5,'Pool index');old=state.pool[index].base;state.pool[index].base=integer(payload.value,1,18,'Base score');refreshStatisticsPool(state);
  }else throw new Error('That field cannot be overridden.');
  return 'GM override '+field+(field==='pool'?'['+payload.index+']':'')+': '+String(old??'absent')+' → '+payload.value+'. Reason: '+reason+(field==='pool'?statisticsDivisionSummary(state):'');
 }
 case 'allocate-specializations':{need(specializationOptions(state).available,'No specialization allocation is available at this checkpoint.');const next=state.stage;queueEffects(state,allocationEffects(state),next,rolls);return 'Choose specialties for your saved awards.';}
 case 'finish':{const option=finishOptions(state);need(option.available,option.reason);if(pendingSpecializations(state).length){queueEffects(state,allocationEffects(state),state.stage,rolls);return 'Allocate your remaining skill awards before finishing.';}const settlement=settleInjuryBills(state);if(settlement===false)return 'Outstanding injury bills await source resolution of the cash balance.';state.stage='finish';return 'Finished source-assisted character. Unautomated stages remain listed in the record.'+(settlement?' Injury bills: paid Cr'+settlement.paid+', remaining medical debt Cr'+settlement.debt+'.':'');}
 default:throw new Error('Unknown command: '+command.type);
 }
}
export function createSession(seed='traveller-'+Date.now()) {
 need(typeof seed==='string'&&seed.length>0&&seed.length<=120,'Invalid random seed.');
 return {format:'traveller-character-session',version:API_VERSION,rulesRevision:RULES_REVISION,seed,events:[]};
}
export function project(session) {
 need(plain(session)&&session.format==='traveller-character-session'&&session.version===API_VERSION,'Unsupported save format.');
 need(COMPATIBLE_RULES_REVISIONS.includes(session.rulesRevision),'Legacy or different rules revision. Preserve the original save and review its recorded history before continuing.');
 need(typeof session.seed==='string'&&session.seed.length>0&&session.seed.length<=120,'Invalid random seed.');
 need(Array.isArray(session.events)&&session.events.length<=LIMIT,'Save contains too many actions.');
 need(saveSize(session)<=MAX_SAVE_BYTES,'Save size limit reached. Export your current character before continuing.');
 let state=initial(session.seed);if(!['character-preview-2026-11-09.16','character-preview-2026-11-09.17'].includes(session.rulesRevision)){state.deferredSpecializations=true;state.correctedCareerEvents=true;}const snapshots=[copy(state)],log=[];
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
   const rng=state.rng,gm=state.config.gm;state=copy(snapshots[target-1]);state.rng=rng;state.config.gm=gm;state._override={index:rollIndex,values:payload.values,preserved:copy(log[target-1].rolls.slice(0,rollIndex)),target:copy(originalRoll)};
   const outcome=apply(state,original.command,rolls);need(rolls[rollIndex],'Original roll is not present in the replayed action.');delete state._override;
   summary='GM replaced action '+target+' roll '+(rollIndex+1)+' ['+originalRoll.values.join(', ')+'] → ['+payload.values.join(', ')+']. Reason: '+reason+'. Earlier rolls in this action were retained; later branch rolls were regenerated. Subsequent character changes were superseded; all actions remain in the log. '+outcome;
  }else if(event.command?.type==='restore'){
   need(state.config.gm,'Enable GM mode before restoring a previous character state.');
   const target=integer(event.command.payload?.revision,0,i-1,'Restore point');
   const rng=state.rng,gm=state.config.gm;state=copy(snapshots[target]);state.rng=rng;state.config.gm=gm;
   summary='Restored character state to action '+target+'. Prior rolls and actions remain in this log; randomness was not rewound.';
  }else summary=apply(state,event.command,rolls);
  const prior=event.command.type==='gm-replay'?snapshots[event.command.payload.revision-1]:snapshots[i];if(event.command.type!=='restore'&&!state.psionicTraining&&state.character.species==='zhodani'&&state.active!==null&&(state.character.stats.PSI??0)>(prior.character.stats.PSI??0)&&(state.character.stats.SOC??0)<10)reviewZhodaniStatus(state,'command:'+event.command.type,rolls,state.stage);
  refreshAslanAccess(state);refreshAssignmentChange(state);refreshAslanOfficerOffers(state);refreshAslanRestorations(state);refreshAslanOutlawRestorations(state);refreshHistoricalEntries(state);terminateBorrowedRoutes(state);expireBenefitCredits(state);
  removeUnavailablePsionicAgeingChoice(state);
  expireCareerTransfers(state);
  if(event.rolls!==undefined)need(JSON.stringify(event.rolls)===JSON.stringify(rolls),'Roll audit mismatch at action '+(i+1)+'.');
  if(event.summary!==undefined)need(event.summary===summary,'Action summary mismatch at action '+(i+1)+'.');
  log.push({number:i+1,id:event.id,type:event.command.type,summary,rolls,changes:characterChanges(snapshots[i].character,state.character)});snapshots.push(copy(state));
 }
 for(const career of state.character.careers)if(career.pensionExitStatusBasis){const socialClass=state.character.stats.SOC>=11?'noble':state.character.stats.SOC===10?'intendant':'prole';career.pensionStatusReviewRequired=socialClass!==career.pensionExitStatusBasis.socialClass;}
 state.statisticsRerollThreshold=statisticsRerollThreshold(state);
 state.statisticsCanReroll=statisticsCanReroll(state);
 state.psionicGamesAvailability=psionicGamesAvailability(state);
 state.currentPsionicGames=copy(state.character.psionicGames?.applications.at(-1)??null);
 state.psionicGamesOptions=gamesPending(state)?gamesRemaining(gamesPending(state)):[];
 state.psionicGamesNeedsStacking=!!gamesPending(state)?.competition?.unresolved.some(d=>d.key==='awardStacking');
 state.commissionAvailability=commissionAvailability(state);state.exitOptions=exitOptions(state);state.followingInteractionDM=followingInteractionDM(state.character.stats.FOL);
 const merchantFine=activeMerchantFine(state)??state.character.merchantFines?.at(-1)??null;state.currentMerchantFine=copy(merchantFine);state.merchantFineOptions=state.stage==='merchant-fine-decision'&&activeMerchantFine(state)?merchantFineOptions({die:merchantFine.die,cash:state.character.cash}):[];
 const reeducation=activeReeducation(state)??state.character.reeducations?.at(-1)??null;state.currentReeducation=copy(reeducation);state.reeducationRequirements=activeReeducation(state)?copy(reeducation.plan?.requirements??[{key:'anagathicTerms',minimum:0,maximum:1000}]):[];
 state.relationshipLossOptions=state.stage==='relationship-loss'?relationshipLossOptions(state.character.relationships):[];
 state.currentCrossCareerCover=crossCareerCover(state);
 state.currentCrossCareerTraining=crossCareerTraining(state);
 state.assignmentChangeOptions=assignmentOptions(state);state.currentAssignmentChange=copy(currentAssignmentChange(state)??state.character.assignmentChanges?.at(-1)??null);
 state.aslanHistoricalEntryOptions=historicalEntryOptions(state);state.currentAslanHistoricalEntry=currentHistoricalEntry(state);
 state.clanShareOptions=clanShareOptions(state);state.landClaimOptions=landClaimOptions(state);
 state.finishOptions=finishOptions(state);state.fallbackOptions=fallbackOptions(state);state.aslanAccessRules={destinationMaxLength:160,reasonMaxLength:500};state.aslanAccessOptions=aslanAccessOptions(state);state.currentAslanAccess=copy(accessRights(state).at(-1)??null);state.aslanAccessConflict=accessConflictProjection(state);
 state.currentAslanOrigin=currentAslanOrigin(state);
 state.currentAslanOutlawRestoration=copy(currentAslanOutlawRestoration(state));
 state.currentAslanRestoration=copy(currentAslanRestoration(state));state.aslanRestorationNotice=restorationNotice(state);
 state.aslanOfficerOptions=aslanOfficerOptions(state);state.currentAslanOfficerOffer=currentAslanOfficerProjection(state);
 state.benefitCreditOptions=['benefits','advisory-cash'].includes(state.stage)?benefitCredits(state,state.stage==='advisory-cash'?'advisory':'ordinary').map(c=>({id:c.id,label:(c.scope==='any'?'Any career benefit':'Current career benefit')+' +'+c.value,value:c.value,source:copy(c.source)})):[];
 state.currentAdvisory=currentAdvisory(state);state.advisoryCashBlocked=state.stage==='advisory-cash'&&state.cashRolls>=cashLimit(state)&&advisoryRecord(state)?.cashLimitDecision?.decision!=='allow-extra';
 state.currentBenefitAward=state.pending?.awardId?copy(benefitAward(state,state.pending.awardId)):null;
 state.currentInjury=state.injury!==undefined&&state.injury!==null?copy(injuryRecord(state)):null;
 state.injuryOptions=state.stage==='injury-loss'?copy(injuryRecord(state).options):[];
 state.injuryRestorable=state.stage==='injury-treatment'?copy(injuryRecord(state).losses):{};
 state.medicalOutstanding=(state.character.medicalBills??[]).filter(b=>!b.settled).reduce((sum,b)=>sum+b.personalCost,0);
 state.psionicOptions=state.stage==='psionic-training'?psionicOptions(state):[];
  state.psionicCanFinish=state.stage==='psionic-training'&&state.psionicTraining?.mode==='initial';
  state.canStartPsionicTraining=!accessMandatory(state)&&!state.character.psionicLoss&&['career','precareer'].includes(state.stage)&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation&&(!Object.hasOwn(state.character.stats,'PSI')||state.character.stats.PSI>0)&&!state.character.psionics?.training.some(t=>t.completed);
 if(state.deferredSpecializations&&state.character.species==='aslan'&&state.pendingChoice?.options)state.pendingChoice.options=state.pendingChoice.options.map(culturalAwardLabel);
 state.skillChoiceSuggestions=skillChoiceSuggestions(state);if(state.deferredSpecializations){state.specializationOptions=specializationOptions(state);state.skillChoiceBases=skillChoiceBases(state);}
 if(prisonerEscapePending(state))state.prisonerEscape={skills:['Stealth','Deception'].map(name=>({name,level:skillLevel(state,name),modifier:skillCheckDM(state,name)}))};
  state.trainingOptions=state.stage==='training'?trainingOptions(state):[];
 // Add labels only after replay. Presentation metadata cannot alter saved
 // effects, summaries, RNG state, eligibility or rules-revision compatibility.
 const tableInfo=(careerId,assignment,table,{ordinary=false}={})=>{const pack=RULE_PACK[careerId],training=pack?.training;let rows=table==='assignment'?training?.assignments?.[assignment]:training?.[table];if(ordinary&&table==='assignment'&&rows?.length===9){const modifier=(pack.prerequisites.assignmentTableModifiers??[]).filter(m=>conditionMatches(state,m.condition)).reduce((n,m)=>n+m.dm,0);rows=rows.slice(modifier,modifier+6);}return trainingInformation(rows,condition=>conditionMatches(state,condition),state.deferredSpecializations&&careerId.startsWith('aslan.')?{skillLabel:aslanSkillLabel,legend:ASLAN_SKILL_LEGEND}:{});};
 if(state.stage==='training'){const {career,record}=currentCareer(state);state.trainingOptions=state.trainingOptions.map(option=>({...option,information:tableInfo(career.id,record.assignment,option.id,{ordinary:true})}));}
 if(state.currentCrossCareerTraining){const training=state.currentCrossCareerTraining;training.options=training.options.map(option=>({...option,information:tableInfo(training.sourceCareerId,option.id,'assignment')}));}
 if(state.stage==='effect-choice')state.pendingChoice.options=state.pendingChoice.options.map(option=>{const effect=option.effects?.find(e=>e.kind==='source-training-roll');return effect?{...option,information:tableInfo(currentCareer(state).career.id,effect.assignment,effect.table)}:option;});

 state.educationOptions=['education-skill','companion-skill'].includes(state.stage)?educationOptions(state,state.pendingChoice):[];
 state.educationCheckSkills=state.stage==='education-check'?learnedEducationSkills(state):[];
 state.canChooseEducation=!accessMandatory(state)&&state.stage==='career'&&state.active===null&&!state.forcedCareer&&!state.character.retirementFromCreation&&state.character.terms<3&&!state.educationAttemptTerms?.includes(state.character.terms);
 if(state.character.species==='aezorgh'&&Object.hasOwn(state.character.stats,'SOC'))state.character.stats.CHA=Math.floor(state.character.stats.SOC/2);
 state.backgroundOptions=backgroundOptions(state);state.cashLimit=cashLimit(state);state.cashRollAccount=cashRollAccount(state);state.cashRollsUsed=cashRollsUsed(state);state.cashRollAccounting={id:cashRollAccount(state),name:cashRollAccount(state)==='core'?'Core lifetime cash rolls':cashRollAccount(state)==='aslan'?'Native Aslan cash rolls':'Cash benefit rolls',used:cashRollsUsed(state),limit:cashLimit(state),total:state.cashRolls,accounts:copy(state.character.cashRollAccounts??null)};if(state.character.aslanCareerContext)state.character.aslanCareerContext.scopeLabel=state.character.aslanCareerContext.careerIds?.map(id=>findCareer(id).name).join(' / ')??'Core careers';
 state.careerChoices=availableCareers(state);state.careerTransferOptions=transferOptions(state);state.statDMs=Object.fromEntries(Object.entries(state.character.stats).map(([k,v])=>[k,k==='RITE'?v:characteristicDM(v)]));
 for(let i=0;i<log.length;i++){const before=snapshots[i].modifiers??[],after=snapshots[i+1].modifiers??[];if(JSON.stringify(before)!==JSON.stringify(after))log[i].modifierChanges={before:copy(before),after:copy(after)};}
 const pendingEffects=snapshot=>({forcedCareer:snapshot.forcedCareer??null,automaticCareers:copy(snapshot.automaticCareers??[]),careers:snapshot.character.careers.map(c=>({id:c.id,automaticPromotion:!!c.automaticPromotion,automaticCommission:!!c.automaticCommission,commissionBlockedFirstTerm:!!c.commissionBlockedFirstTerm}))});
 for(let i=0;i<log.length;i++){const before=pendingEffects(snapshots[i]),after=pendingEffects(snapshots[i+1]);if(JSON.stringify(before)!==JSON.stringify(after))log[i].pendingEffectChanges={before,after};}
 decorateLifeEventPresentation({state,log,snapshots,events:session.events});
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
export function developmentApi(request) {
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

// Supported public entry point. Direct procedures above remain development APIs.
export function api(request) {
 try {
  assertReleaseRequest(request);
  return releaseResult(developmentApi(request));
 } catch(error) {
  return {ok:false,error:{code:'INVALID_REQUEST',message:error.message}};
 }
}
