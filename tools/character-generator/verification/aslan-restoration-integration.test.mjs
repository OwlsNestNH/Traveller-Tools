import {buildFailedAslanRestorationEntryFixture} from './aslan-restoration-browser-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,importSession,exportSession} from '../engine/session.mjs';
import {buildAslanRestorationFixture,buildAslanOutlawRestorationFixture,buildAslanOfficerFixture,aslanSetup,aslanEndTerm,aslanBenefits,aslanEvent,run,force,rejected,settle} from './aslan-officer-fixtures.mjs';
const last=r=>r.state.character.careers.at(-1),restoration=r=>r.state.currentAslanRestoration;
const decision={accept:true,originalSOC:8,originalSOCConfirmed:true,statusTiming:'on-successful-entry',reason:'Verified original family SOC8 before the failed qualification; status clears on the successful next entry.'};
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
function ready(timing='on-successful-entry'){let r=run(buildAslanRestorationFixture(),'resolve-aslan-restoration',{...decision,statusTiming:timing});return aslanBenefits(run(aslanEndTerm(r),'leave-career'));}
test('earned restoration starts from real failed qualification and a fully recorded forfeiture',()=>{
 const r=buildAslanRestorationFixture();assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.stats.SOC,2);assert.equal(last(r).id,'aslan.outcast');assert.equal(r.state.character.aslanStatusChanges[0].cause,'qualification-failure:aslan.military-officer');assert.ok(r.state.character.benefitAwards[0].forfeited);
 assert.equal(r.state.pending.kind,'aslan-restoration');assert.equal(restoration(r).status,'offered');assert.equal(restoration(r).originCareerIndex,0);assert.equal(restoration(r).availableAtCompletedTerms,1);assert.equal(restoration(r).decision,null);roundtrip(r);
});
test('rejected decisions are atomic, do not roll dice and cannot use generic source effects',()=>{
 const r=buildAslanRestorationFixture(),before=exportSession(r.session);
 for(const patch of [{originalSOC:0},{originalSOC:41},{originalSOC:3.5},{originalSOCConfirmed:false},{statusTiming:''},{reason:''},{effects:[{kind:'stat',name:'SOC',value:6}]}])rejected(r,'resolve-aslan-restoration',{...decision,...patch});
 rejected(r,'resolve-book',{confirmed:true,note:'SOC only',effects:[{kind:'stat',name:'SOC',value:6}]});rejected(r,'gm-override',{field:'stat.SOC',value:8,reason:'No mutation under pending decision'});
 assert.equal(exportSession(r.session),before);const player=run(r,'gm-mode',{enabled:false});rejected(player,'resolve-aslan-restoration',decision);roundtrip(player);
});
test('player may explicitly decline without altering characteristics or awarding an entry right',()=>{
 let r=run(buildAslanRestorationFixture(),'gm-mode',{enabled:false}),before=structuredClone(r.state.character),rng=r.state.rng;
 r=run(r,'resolve-aslan-restoration',{accept:false});assert.equal(r.state.stage,'advancement');assert.equal(restoration(r).status,'declined');assert.deepEqual(r.state.character.stats,before.stats);assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.age,before.age);assert.equal(r.state.character.terms,before.terms);assert.equal(r.state.rng,rng);assert.equal(r.log.at(-1).rolls.length,0);rejected(r,'resolve-aslan-restoration',{accept:false});roundtrip(r);
});
for(const timing of ['on-restoration','on-successful-entry'])test('typed '+timing+' preserves the event tail and exactly one later qualification',()=>{
 let r=buildAslanRestorationFixture(),before=structuredClone(r.state.character),queue=structuredClone(r.state.effectsQueue);r=run(r,'resolve-aslan-restoration',{...decision,statusTiming:timing});
 assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.stats.SOC,8);assert.equal(r.state.character.outcast,timing==='on-successful-entry');assert.equal(restoration(r).status,'available');assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.age,before.age);assert.equal(r.state.character.terms,before.terms);assert.equal(last(r).terms,0);assert.equal(last(r).rank,before.careers[0].rank);assert.equal(r.state.character.cash,before.cash);assert.equal(r.state.character.debt,before.debt);assert.deepEqual(r.state.character.benefits,before.benefits);
 rejected(r,'career',{id:'aslan.military',assignment:'warrior'});r=aslanEndTerm(r);assert.equal(r.state.character.terms,1);assert.equal(r.state.aslanRestorationNotice.available,false);r=aslanBenefits(run(r,'leave-career'));assert.equal(r.state.aslanRestorationNotice.available,true);
 const oldBenefits=structuredClone(r.state.character.benefitRollHistory);r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));assert.equal(r.state.character.outcast,false);assert.equal(last(r).rank,0);assert.equal(last(r).terms,0);assert.equal(restoration(r).status,'consumed');assert.equal(restoration(r).attempt.careerId,'aslan.military');assert.equal(restoration(r).attempt.automaticReason,null);assert.equal(restoration(r).attempt.check.natural,12);assert.equal(restoration(r).attempt.success,true);assert.deepEqual(r.state.character.benefitRollHistory,oldBenefits);roundtrip(r);
});
test('failed restoration attempt uses normal SOC2/status/share forfeiture and consumes permission once',()=>{
 for(const timing of ['on-restoration','on-successful-entry']){
  let r=ready(timing),before=r.state.character.aslanStatusChanges.length;r=force(r,'career',{id:'aslan.military-officer',assignment:'leader'},[1,1]);assert.equal(r.state.stage,'failed-entry');assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.stats.SOC,2);assert.equal(restoration(r).status,'consumed');assert.equal(restoration(r).attempt.success,false);assert.equal(r.state.character.aslanStatusChanges.length,before+1);
  rejected(r,'career',{id:'aslan.military',assignment:'warrior'});r=settle(run(r,'fallback',{draft:false}));assert.equal(last(r).id,'aslan.outcast');assert.equal(restoration(r).status,'consumed');assert.equal(last(r).rank,0);assert.equal(last(r).terms,0);assert.equal(last(r).drafted,false);assert.equal(r.state.character.terms,1);assert.equal(r.state.character.careerTransitions.at(-1).mode,'source-fallback');assert.deepEqual(r.state.character.careerTransitions.at(-1).procedureSource,{id:'aliens',page:22});roundtrip(r);
 }
});
test('forced stay blocks departure and permission expires on the required continuation',()=>{
 let r=run(buildAslanRestorationFixture(),'resolve-aslan-restoration',decision);r=aslanEndTerm(r,[6,6]);assert.equal(last(r).forcedStay,true);assert.equal(r.state.aslanRestorationNotice.available,false);assert.match(r.state.aslanRestorationNotice.reason,/natural 12/);rejected(r,'leave-career');
 r=run(r,'continue-career');assert.equal(restoration(r).status,'expired');assert.equal(restoration(r).expiry.reason,'continued-originating-career');assert.equal(r.state.character.outcast,true);roundtrip(r);
});
test('on-restoration expiry preserves the ruling but does not leave permanent career access',()=>{
 let r=run(buildAslanRestorationFixture(),'resolve-aslan-restoration',{...decision,statusTiming:'on-restoration'});r=aslanEndTerm(r);r=run(r,'continue-career');assert.equal(restoration(r).status,'expired');assert.equal(r.state.character.outcast,false);
 r=settle(force(r,'training',{table:'personal'},[1]));r=aslanEndTerm(settle(aslanEvent(r,6)));r=aslanBenefits(run(r,'leave-career'));const target=r.state.careerChoices.find(c=>c.id==='aslan.military');assert.equal(target.disabled,true);assert.match(target.reason,/Historical Outcast\/Outlaw service requires a source-earned exception/);rejected(r,'career',{id:'aslan.military',assignment:'warrior'});roundtrip(r);
});
test('leaving the permitted new career does not recycle the consumed historical exception',()=>{
 let r=settle(force(ready(),'career',{id:'aslan.military',assignment:'warrior'},[6,6]));r=settle(force(r,'training',{table:'personal'},[1]));r=settle(aslanEvent(r,8));r=run(r,'gm-override',{field:'stat.STR',value:3,reason:'Source-earned low advancement discharge test'});r=aslanEndTerm(r,[1,1]);assert.equal(last(r).forcedExit,true);r=aslanBenefits(run(r,'leave-career'));assert.equal(r.state.careerChoices.find(c=>c.id==='aslan.spacer').disabled,true);assert.equal(restoration(r).status,'consumed');roundtrip(r);
});
test('replay and restore preserve original qualification attempts without duplicate restoration or forfeiture',()=>{
 const base=ready();let r=force(base,'career',{id:'aslan.military-officer',assignment:'leader'},[1,1]);r=run(r,'gm-replay',{revision:base.revision+1,rollIndex:0,values:[6,6],reason:'Review the source-permitted qualification'});assert.equal(restoration(r).attempt.success,true);assert.equal(r.state.character.outcast,false);assert.equal(r.state.character.aslanRestorations.length,1);assert.equal(r.state.character.aslanStatusChanges.length,1);roundtrip(r);
 r=run(r,'restore',{revision:base.revision});assert.equal(restoration(r).status,'available');assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.careers.length,1);roundtrip(r);
});
test('accepted decision command retries are idempotent and public history can reach an officer offer',()=>{
 const base=buildAslanRestorationFixture();let r=run(base,'resolve-aslan-restoration',decision,{id:'restoration-once'}),bytes=exportSession(r.session);r=run(r,'resolve-aslan-restoration',decision,{id:'restoration-once'});assert.equal(exportSession(r.session),bytes);
 r=buildAslanOfficerFixture({historical:true});assert.equal(r.state.character.outcast,false);assert.equal(restoration(r).status,'consumed');assert.equal(r.state.character.aslanStatusChanges[0].outcastAfter,true);assert.equal(r.state.aslanOfficerOptions[0].sourceRequired,true);r=run(r,'begin-aslan-officer',{offerId:r.state.aslanOfficerOptions[0].id,assignment:'leader'});assert.equal(r.state.pending.kind,'aslan-officer-status');roundtrip(r);
});
test('direct voluntary Outcast entry forfeits held shares without imposing SOC2',()=>{
 let r=aslanSetup('voluntary-outcast-shares','male',true),soc=r.state.character.stats.SOC,awards=structuredClone(r.state.character.benefitAwards);assert.ok(r.state.character.benefits.length);
 r=settle(run(r,'career',{id:'aslan.outcast',assignment:'labourer'}));assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.stats.SOC,soc);assert.equal(r.state.character.benefits.length,0);assert.equal(r.state.character.aslanStatusChanges[0].cause,'outcast-career-entry');assert.ok(r.state.character.benefitAwards.every((x,i)=>x.forfeited&&x.quantity===awards[i].quantity));roundtrip(r);
});
for(const gender of ['male','female'])test('p43 '+gender+' starts at a typed source stop without partial rewards',()=>{
 const r=buildAslanOutlawRestorationFixture({gender});assert.equal(r.state.pending.kind,'aslan-outlaw-restoration');assert.equal(r.state.currentAslanOutlawRestoration.status,'pending');const before=exportSession(r.session);
 rejected(r,'resolve-book',{confirmed:true,note:'Do not accept a SOC-only completion',effects:[{kind:'stat',name:'SOC',value:6}]});rejected(r,'resolve-aslan-restoration',decision);assert.equal(exportSession(r.session),before);roundtrip(r);
});
test('next-term education consumes the window rather than silently preserving it',()=>{
 let r=ready('on-restoration');r=run(r,'open-precareer');r=force(r,'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});r=force(r,'education-event',{},[1,4]);r=force(r,'education-graduation',{},[6,6]);assert.equal(r.state.character.terms,2);assert.equal(restoration(r).status,'expired');assert.equal(restoration(r).expiry.reason,'next-term-window-ended');roundtrip(r);
});


test('browser failed-entry fixture earns failure from public history without relying on old origin dice order',()=>{
 const base=buildFailedAslanRestorationEntryFixture(),saved=exportSession(base.session);
 const attempted=run(base,'career',{id:'aslan.military-officer',assignment:'leader'});
 assert.equal(exportSession(base.session),saved);assert.equal(base.state.stage,'career');
 assert.equal(attempted.state.stage,'failed-entry');assert.equal(attempted.state.character.aslanRestorations.at(-1).attempt.success,false);
 const fallback=settle(run(attempted,'fallback'));assert.equal(fallback.state.character.careers.at(-1).id,'aslan.outcast');
 assert.equal(fallback.state.character.terms,base.state.character.terms);assert.equal(fallback.state.character.age,base.state.character.age);
});
