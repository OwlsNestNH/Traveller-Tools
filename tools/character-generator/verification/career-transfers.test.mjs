import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {CAREER_TRANSFER_RULES,careerTransferRule,createCareerTransfer,careerTransferEligibility,careerTransferEntry,careerTransferExpiry} from '../engine/career-transfers.mjs';

import {run,rejected,force,settle,fixture} from './career-transfer-fixtures.mjs';
const army=fixture('zhodani.army-guard'),officer=fixture('zhodani.army-guard',{commission:true}),
 guard=fixture('zhodani.guard-agent'),merchant=fixture('zhodani.merchant-navy'),loner=fixture('vargr.loner-spacer');
const right=r=>r.state.character.careerTransfers[0];
const context=(r,overrides={})=>({right:r,completedTerms:r.availableAtCompletedTerms,careerCount:r.sourceCareerIndex+1,activeCareerIndex:null,careerId:r.targetCareerId,assignmentId:r.targetAssignmentId??'support',...overrides});
function pure(ruleId='zhodani.army-guard',extra={}){
 return createCareerTransfer({ruleId,id:'test-transfer',sourceCareerIndex:0,sourceAssignment:'support',sourceRank:3,sourceOfficer:false,completedTerms:2,soc:10,...extra});
}

test('four bounded rules match only exact source careers, targets and effect flags',()=>{
 assert.equal(CAREER_TRANSFER_RULES.length,4);
 for(const rule of CAREER_TRANSFER_RULES){
  const effect={kind:'career-status',action:'auto-qualify',career:rule.to,...(rule.assignment?{assignment:rule.assignment}:{}),...(rule.retainRank?{retainRank:true}:{})};
  assert.equal(careerTransferRule(rule.from,effect)?.id,rule.id);
  assert.equal(careerTransferRule('core.army',effect),null);
  assert.equal(careerTransferRule(rule.from,{...effect,action:'next'}),null);
  assert.equal(careerTransferRule(rule.from,{...effect,retainRank:!rule.retainRank}),null);
 }
});
test('source snapshots cover rank boundaries and preserve military track without mutating input',()=>{
 for(const rank of [0,1,6])for(const commissioned of [false,true]){
  const r=pure('zhodani.army-guard',{sourceRank:rank,sourceOfficer:commissioned}),before=structuredClone(r),entry=careerTransferEntry(context(r));
  assert.equal(entry.rank,rank);assert.equal(entry.officer,commissioned);assert.deepEqual(r,before);
  assert.deepEqual(entry.source.pages,[261]);
 }
 assert.throws(()=>pure('zhodani.army-guard',{soc:9}),/SOC 10/);
 assert.throws(()=>pure('zhodani.army-guard',{sourceRank:7}),/rank/);
 assert.throws(()=>pure('zhodani.army-guard',{sourceOfficer:undefined}),/officer/);
});
test('next-term timing and muster-out boundaries are explicit',()=>{
 const r=pure();assert.equal(careerTransferEligibility(context(r)).available,true);
 for(const changes of [{completedTerms:2},{completedTerms:4},{activeCareerIndex:0},{careerCount:0},{careerCount:2},{careerId:'zhodani.navy'}])assert.equal(careerTransferEligibility(context(r,changes)).available,false);
 assert.equal(careerTransferExpiry(context(r)),null);
 assert.equal(careerTransferExpiry(context(r,{completedTerms:4})).reason,'next-term-window-ended');
 assert.equal(careerTransferExpiry(context(r,{careerCount:2})).reason,'another-career-entered');
});
test('restricted assignments cannot borrow another transfer and no-rank offers start at ordinary rank',()=>{
 for(const ruleId of ['zhodani.guard-agent','vargr.loner-spacer']){
  const r=pure(ruleId);assert.equal(careerTransferEligibility(context(r,{assignmentId:'other'})).available,false);
 }
 const r=pure('vargr.loner-spacer');assert.equal(r.retainedRank,null);assert.equal(careerTransferEntry(context(r)).rank,null);
});
test('Merchant Navy rank track requires an explicit source decision, not an invented mapping',()=>{
 const r=pure('zhodani.merchant-navy'),p=careerTransferEntry(context(r));assert.equal(p.resolved,false);assert.equal(p.needsAdjudication,true);assert.deepEqual(p.requiredFields,['transferRankTrack']);
 for(const rankTrack of ['officer','enlisted']){
  const entry=careerTransferEntry(context(r,{rankTrackDecision:{rankTrack,reason:'Referee source ruling'}}));
  assert.equal(entry.rank,3);assert.equal(entry.officer,rankTrack==='officer');assert.deepEqual(entry.decision.source.pages,[269]);
 }
 for(const decision of [{rankTrack:'single',reason:'X'},{rankTrack:'officer',reason:''}])assert.throws(()=>careerTransferEntry(context(r,{rankTrackDecision:decision})));
 assert.throws(()=>careerTransferEntry(context(pure(),{rankTrackDecision:{rankTrack:'officer',reason:'Unrequested override'}})),/established/);
});
test('tampered target, rank, track and term provenance is rejected',()=>{
 const r=pure();
 for(const change of [{targetCareerId:'core.navy'},{retainedRank:6},{rankTrack:'officer'},{availableAtCompletedTerms:9},{sourceOfficer:null}])assert.throws(()=>careerTransferEntry(context({...r,...change})));
 for(const status of ['consumed','expired'])assert.equal(careerTransferEntry(context({...r,status})).automaticEntry,false);
});

test('public transfers persist source rank, officer status, event provenance and next-term availability',()=>{
 for(const r of [army,officer,guard,merchant,loner]){
  const t=right(r),c=r.state.character.careers[0];
  assert.equal(t.status,'unconsumed');assert.equal(t.availableAtCompletedTerms,r.state.character.terms);
  assert.equal(t.sourceRank,t.ruleId.startsWith('vargr')?0:1);assert.equal(t.sourceOfficer,r===officer);
  assert.equal(t.retainedRank,t.ruleId.startsWith('vargr')?null:1);
  assert.equal(r.state.careerTransferOptions[0].available,true);assert.equal(r.state.active,null);assert.equal(c.benefitRolls,0);
  assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
  assert.equal(r.state.automaticCareers?.includes(t.targetCareerId)??false,false);
 }
});
test('retained-rank exit skips advancement while accepted Loner offer does not retain its subsequent promotion',()=>{
 for(const r of [army,officer,guard,merchant]){
  const c=r.state.character.careers[0];assert.equal(c.rank,1);assert.equal(c.terms,2);
  assert.equal(c.exit,r===merchant?'involuntary':'voluntary');
  const eventIndex=r.log.findLastIndex(e=>e.type==='gm-replay'&&e.rolls[1]?.label==='Event table');
  assert.equal(r.log.slice(eventIndex+1).some(e=>e.type==='advancement'||e.type==='commission'),false);
 }
 assert.equal(loner.state.character.careers[0].rank,1);assert.equal(right(loner).sourceRank,0);assert.equal(right(loner).retainedRank,null);
});
test('source career and benefits must finish before any transfer is usable',()=>{
 const r=fixture('zhodani.merchant-navy',{beforeBenefits:true});
 assert.equal(r.state.careerTransferOptions[0].available,false);
 rejected(r,'career',{id:'zhodani.navy',assignment:'crew'},/start of a term/);
 const benefits=run(r,'leave-career');assert.equal(benefits.state.stage,'benefits');assert.equal(benefits.state.careerTransferOptions[0].available,false);
 rejected(benefits,'career',{id:'zhodani.navy',assignment:'crew'},/start of a term/);
});
test('Army Guard transfer consumes once, preserves rank and grants only normal target entry workflow',()=>{
 for(const r of [army,officer]){
  const entered=run(r,'career',{id:'zhodani.guard',assignment:'support'},{id:'consume-transfer',expectedRevision:r.revision});
  const c=entered.state.character.careers[1];assert.equal(c.rank,1);assert.equal(c.officer,r===officer);assert.equal(c.terms,0);assert.equal(c.benefitRolls,0);
  assert.equal(entered.log.at(-1).rolls.length,0);assert.equal(right(entered).status,'consumed');assert.equal(right(entered).consumed.rank,1);
  assert.equal(entered.state.character.age,r.state.character.age);assert.equal(entered.state.character.terms,r.state.character.terms);
  const trained=settle(entered);assert.equal(trained.state.stage,'training');
  const retry=run(entered,'career',{id:'zhodani.guard',assignment:'support'},{id:'consume-transfer'});
  assert.deepEqual(retry.session,entered.session);assert.deepEqual(retry.state,entered.state);
  rejected(entered,'career',{id:'zhodani.guard',assignment:'support'},/start of a term/);
 }
});
test('Guard Agent right is only available for Tavrchedl and preserves its single rank track',()=>{
 const c=guard.state.careerChoices.find(c=>c.id==='zhodani.agent');
 assert.equal(c.assignments.find(a=>a.id==='tavrchedl').transferId,right(guard).id);
 assert.equal(c.assignments.find(a=>a.id==='tozjabr').transferId,undefined);
 const entered=run(guard,'career',{id:'zhodani.agent',assignment:'tavrchedl'});
 assert.equal(entered.log.at(-1).rolls.length,0);assert.equal(entered.state.character.careers[1].rank,1);assert.equal(entered.state.character.careers[1].officer,false);
 assert.equal(right(entered).consumed.assignmentId,'tavrchedl');
});
test('Loner Spacer offer applies only to Corsair, without retaining Loner rank',()=>{
 const c=loner.state.careerChoices.find(c=>c.id==='vargr.spacer');
 assert.equal(c.assignments.find(a=>a.id==='corsair').transferId,right(loner).id);
 assert.equal(c.assignments.find(a=>a.id==='navy').transferId,undefined);
 const entered=run(loner,'career',{id:'vargr.spacer',assignment:'corsair'});
 assert.equal(entered.log.at(-1).rolls.length,0);assert.equal(entered.state.character.careers[1].rank,0);assert.equal(right(entered).status,'consumed');
 const other=force(loner,'career',{id:'vargr.spacer',assignment:'explorer'},[6,6]);
 assert.equal(other.log.at(-1).rolls[0].label,'Qualification');assert.equal(right(other).status,'expired');assert.equal(right(other).expired.reason,'another-career-entered');
});
test('Merchant Navy decision is persisted, cancellable and requires typed fields and a reason',()=>{
 const pending=run(merchant,'career',{id:'zhodani.navy',assignment:'crew'});
 assert.equal(pending.state.stage,'book-step');assert.equal(pending.state.pending.kind,'career-transfer');assert.equal(pending.state.pending.rank,1);
 assert.deepEqual(pending.state.pending.rankTracks,['enlisted','officer']);assert.equal(pending.state.character.careers.length,1);assert.equal(pending.log.at(-1).rolls.length,0);
 assert.deepEqual(project(importSession(exportSession(pending.session))).state,pending.state);
 rejected(pending,'resolve-book',{confirmed:true,transferRankTrack:'officer'},/source rank-track/);
 rejected(pending,'resolve-book',{confirmed:true,transferRankTrack:'single',note:'Mapped'},/enlisted or officer/);
 rejected(pending,'resolve-book',{confirmed:true,transferRankTrack:'officer',note:'Mapped',effects:[{kind:'stat',name:'SOC',value:1}]},/typed fields/);
 const cancelled=run(pending,'cancel-career-transfer');assert.equal(cancelled.state.stage,'career');assert.equal(right(cancelled).status,'unconsumed');
 for(const track of ['officer','enlisted']){
  const entered=run(pending,'resolve-book',{confirmed:true,transferRankTrack:track,note:'Referee resolved the unspecified Navy rank-track mapping.'});
  assert.equal(right(entered).status,'consumed');assert.equal(right(entered).rankTrackDecision.rankTrack,track);
  assert.equal(entered.state.character.careers[1].rank,1);assert.equal(entered.state.character.careers[1].officer,track==='officer');
  assert.equal(entered.state.character.careers[1].drafted,false);assert.equal(entered.log.at(-1).rolls.length,0);
 }
});
test('another entered career expires the unused next-term right instead of making it permanent',()=>{
 const r=force(merchant,'career',{id:'zhodani.scholar',assignment:'lab'},[6,6]);
 assert.equal(right(r).status,'expired');assert.equal(right(r).expired.reason,'another-career-entered');assert.equal(r.state.careerTransferOptions[0].available,false);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('age edits do not invent completed terms, while later education does expire the next-term right',()=>{
 const aged=run(merchant,'gm-override',{field:'age',value:40,reason:'Source age correction, no generation term completed'});
 assert.equal(right(aged).status,'unconsumed');assert.equal(aged.state.careerTransferOptions[0].available,true);
 let r=run(merchant,'open-precareer');r=force(r,'precareer',{id:'core.university'},[6,6]);
 r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});
 r=force(r,'education-event',{},[2,3]);r=force(r,'education-graduation',{},[6,6]);
 assert.equal(r.state.character.terms,merchant.state.character.terms+1);assert.equal(right(r).status,'expired');assert.equal(right(r).expired.reason,'next-term-window-ended');
});
test('source prerequisites remain enforced and source-rank decisions recheck pending context',()=>{
 const lower=run(guard,'gm-override',{field:'stat.PSI',value:8,reason:'Regression eligibility boundary'});
 rejected(lower,'career',{id:'zhodani.agent',assignment:'tavrchedl'},/prerequisites/);
 assert.equal(right(lower).status,'unconsumed');
 const pending=run(merchant,'career',{id:'zhodani.navy',assignment:'crew'});
 const changed=run(pending,'gm-override',{field:'stat.INT',value:0,reason:'Regression retains automatic qualification despite low characteristic'});
 const entered=run(changed,'resolve-book',{confirmed:true,transferRankTrack:'enlisted',note:'Source rank track confirmed after characteristic change.'});
 assert.equal(right(entered).status,'consumed');
});
test('GM restore explicitly reopens an unconsumed right and keeps the original consumption in audit',()=>{
 const entered=run(army,'career',{id:'zhodani.guard',assignment:'support'});
 const restored=run(entered,'restore',{revision:army.revision});
 assert.equal(right(restored).status,'unconsumed');assert.equal(restored.state.character.careers.length,1);
 assert.ok(restored.log.some(e=>e.summary.includes('Entered Guard')));assert.deepEqual(project(importSession(exportSession(restored.session))).state,restored.state);
 const player=run(entered,'gm-mode',{enabled:false});rejected(player,'restore',{revision:army.revision},/GM mode/);
});
test('canonical Aslan birth-order labels reject arbitrary API text without changing the pending rite',()=>{
 let r=api({operation:'create',seed:'aslan-birth-order'});r=run(r,'setup',{species:'aslan',gender:'male'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');
 assert.equal(r.state.pending.kind,'species-setup');
 for(const birthOrder of ['', 'arbitrary', 'First Son'])rejected(r,'resolve-book',{confirmed:true,effects:[],birthOrder},/birth-order/);
 for(const birthOrder of ['first-son','second-son','daughter']){
  const accepted=run(r,'resolve-book',{confirmed:true,effects:[],birthOrder});
  assert.equal(accepted.state.character.birthOrder,birthOrder);
 }
});
