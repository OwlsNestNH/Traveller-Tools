// Preserved full-engine development regression, including deferred Zhodani.

import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentApi as api,project,importSession,exportSession,RULES_REVISION} from '../engine/session.mjs';
import {buildAgentUndercoverFixture,buildGovernmentAdvisoryFixture,buildBenefitCreditFixture,buildAdvisoryCashSourceFixture,buildAdvisorySkillCapFixture,run,rejected,force} from './cross-career-fixtures.mjs';
import {rolledReeducation,chronology} from './zhodani-reeducation-fixtures.mjs';
import {settle} from './career-transfer-fixtures.mjs';
const agent=buildAgentUndercoverFixture(),government=buildGovernmentAdvisoryFixture();
const career=r=>r.state.character.careers[0];
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
function finishTerm(r){r=run(r,'advancement');if(r.log.at(-1).rolls.length)r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[4,5],reason:'Normal term completion fixture'});r=settle(r);if(r.state.stage==='training')r=settle(force(r,'training',{table:'personal'},[1]));return r;}
test('successful undercover keeps Agent identity and offers only Prole assignment labels',()=>{
 assert.equal(agent.state.stage,'cross-career-training');assert.equal(career(agent).id,'zhodani.agent');assert.equal(agent.state.character.careers.length,1);assert.equal(agent.state.character.terms,0);
 const p=agent.state.currentCrossCareerTraining;assert.equal(p.source.page,259);assert.equal(p.sourceCareerId,'zhodani.prole');assert.deepEqual(p.options.map(x=>x.id),['colonist','corporate','worker']);assert.ok(p.options.every(x=>Object.keys(x).sort().join(',')==='id,information,name'&&Object.keys(x.information).sort().join(',')==='characteristics,other,skills'&&Object.values(x.information).every(values=>Array.isArray(values)&&values.every(value=>typeof value==='string'))));roundtrip(agent);
});
test('one selected Prole assignment roll resumes Agent advancement, with retry/import safety',()=>{
 let r=run(agent,'gm-mode',{enabled:false}),before=structuredClone(r.state.character);
 r=run(r,'cross-career-training',{assignment:'colonist'},{id:'training-once'});r=settle(r);assert.equal(r.state.stage,'advancement');assert.equal(career(r).id,'zhodani.agent');
 assert.equal(r.state.character.crossCareerRoutes[0].status,'completed');assert.equal(r.state.character.terms,before.terms);assert.equal(r.state.character.age,before.age);assert.equal(career(r).rank,before.careers[0].rank);
 assert.deepEqual(run(r,'cross-career-training',{assignment:'colonist'},{id:'training-once'}).session,r.session);rejected(r,'cross-career-training',{assignment:'worker'});roundtrip(r);
});
test('invalid assignment, fabricated dice and pending-context edits are atomic',()=>{
 for(const payload of [{assignment:'informant'},{assignment:'colonist',die:6},{}])rejected(agent,'cross-career-training',payload);
 rejected(agent,'gm-override',{field:'cash',value:9,reason:'Cannot change pending context'});rejected(agent,'continue-career');
});
test('undercover assignment die can be replayed without adding another entitlement',()=>{
 let r=force(agent,'cross-career-training',{assignment:'colonist'},[3]);assert.equal(r.state.character.skills.Mechanic,1);assert.equal(r.state.character.crossCareerRoutes.length,1);assert.equal(r.state.character.crossCareerRoutes[0].training.die,3);roundtrip(r);
});
test('failed investigation rolls protected Prole mishap only, retains lost benefit and no borrowed training',()=>{
 let r=buildAgentUndercoverFixture({success:false});const route=r.state.character.crossCareerRoutes[0];assert.equal(route.check.success,false);assert.equal(route.training,null);assert.equal(route.tables.length,1);assert.equal(route.tables[0].table,'mishap');assert.equal(route.tables[0].careerId,'zhodani.prole');
 assert.equal(r.state.stage,'advancement');assert.equal(career(r).forcedExit,false);assert.equal(career(r).mishap,true);
 r=finishTerm(r);assert.equal(r.state.stage,'term-end');assert.equal(career(r).benefitRolls,0);assert.equal(career(r).terms,1);assert.equal(r.state.character.careers.length,1);roundtrip(r);
});
for(const mode of ['before-resume','after-current-term'])test('nested Prole Event2 relation loss, treatment and Agent training resume once: '+mode,()=>{
 let r=buildAgentUndercoverFixture({borrowedEvent:2,borrowedMishap:5}),route=r.state.character.crossCareerRoutes[0];assert.deepEqual(route.tables.map(x=>[x.careerId,x.table,x.row]),[['zhodani.prole','event',2],['zhodani.prole','mishap',5]]);assert.equal(r.state.pendingChoice.source.page,273);
 r=run(r,'resolve-relationship-loss',{absent:true,reason:'Referee confirmed no eligible recorded relationship.'});assert.equal(r.state.stage,'reeducation-roll');assert.equal(r.state.currentReeducation.origin.careerId,'zhodani.agent');assert.equal(r.state.currentReeducation.origin.tableCareerId,'zhodani.prole');assert.equal(r.state.currentReeducation.origin.source.page,273);
 r=rolledReeducation(r,2);r=run(r,'resolve-reeducation',{chronology:chronology(mode)});assert.equal(r.state.stage,'cross-career-training');assert.equal(career(r).terms,0);assert.equal(r.state.character.terms,0);assert.equal(career(r).forcedExit,false);roundtrip(r);
 r=force(r,'cross-career-training',{assignment:'colonist'},[3]);assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.crossCareerRoutes[0].training.die,3);r=finishTerm(r);
 assert.equal(career(r).terms,1);assert.equal(r.state.character.terms,1);assert.equal(r.state.character.age,26);assert.equal(r.state.character.nonCareerMonths,48);assert.equal(r.state.currentReeducation.status,'completed');assert.equal(r.state.character.crossCareerRoutes.length,1);roundtrip(r);
});
test('Agent Event4 bonus remains employer scoped rather than borrowed Prole scoped',()=>{
 const r=buildAgentUndercoverFixture({borrowedEvent:4});assert.equal(r.state.character.benefitCredits.at(-1).originCareerId,'zhodani.agent');assert.equal(r.state.character.benefitCredits.at(-1).scope,'career');
});
test('advisory choice lists other Zhodani careers, no raw tables, and keeps explicit rule interpretation',()=>{
 const p=government.state.currentAdvisory;assert.equal(government.state.stage,'advisory-career');assert.equal(p.options.length,8);assert.ok(p.options.every(x=>x.id.startsWith('zhodani.')&&x.id!=='zhodani.government'&&Object.keys(x).length===2));
 assert.deepEqual(p.ruling,{table:'service',timing:'immediate',countsTowardCashLimit:true});roundtrip(government);
 for(const careerId of ['zhodani.government','core.army','bad'])rejected(government,'advisory-career',{careerId});
 rejected(government,'advisory-career',{careerId:'zhodani.prole',assignment:'worker'});
});
test('advisory service then same-career immediate cash preserves Government rank, term and ordinary benefits',()=>{
 let r=force(government,'advisory-career',{careerId:'zhodani.prole'},[1]),before=structuredClone(r.state.character),count=r.state.cashRolls;
 assert.equal(r.state.stage,'advisory-cash');assert.equal(r.state.currentAdvisory.training.die,1);assert.equal(r.state.currentAdvisory.training.table,'service');
 r=force(r,'advisory-cash',{},[6]);assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.cash,before.cash+50000);assert.equal(r.state.cashRolls,count+1);assert.equal(r.state.character.stats.WLT,before.stats.WLT+1);
 assert.deepEqual(career(r),before.careers[0]);assert.equal(r.state.character.age,before.age);assert.equal(r.state.character.terms,before.terms);assert.equal(r.state.character.advisoryServices[0].status,'completed');
 const h=r.state.character.benefitRollHistory.at(-1);assert.equal(h.kind,'advisory-cash');assert.equal(h.careerId,'zhodani.prole');assert.equal(h.originCareerId,'zhodani.government');assert.equal(h.entitlementId,r.state.character.advisoryServices[0].id);roundtrip(r);
});
test('advisory cash and career selection retry are idempotent and unrelated context changes blocked',()=>{
 let r=run(government,'advisory-career',{careerId:'zhodani.prole'},{id:'service-once'});r=settle(r);assert.deepEqual(run(r,'advisory-career',{careerId:'zhodani.prole'},{id:'service-once'}).session,r.session);
 rejected(r,'advisory-career',{careerId:'zhodani.navy'});rejected(r,'gm-override',{field:'cash',value:100,reason:'Invalid pending funding edit'});
 r=run(r,'advisory-cash',{}, {id:'cash-once'});assert.deepEqual(run(r,'advisory-cash',{}, {id:'cash-once'}).session,r.session);rejected(r,'advisory-cash');roundtrip(r);
});
test('source-earned third cash roll counts normally; fourth remains unresolved with rolls intact',()=>{
 let r=buildGovernmentAdvisoryFixture({cashRolls:3});r=force(r,'advisory-career',{careerId:'zhodani.prole'},[1]);assert.equal(r.state.advisoryCashBlocked,true);assert.equal(r.state.cashRolls,3);const before=exportSession(r.session);
 rejected(r,'advisory-cash',{},/limit/);assert.equal(exportSession(r.session),before);roundtrip(r);
 r=run(r,'gm-mode',{enabled:false});for(const decision of ['forfeit','allow-extra'])rejected(r,'resolve-advisory-cash-limit',{decision,reason:'No GM authority'},/GM mode/);
});
test('explicit capped forfeiture is GM-gated, reasoned, rolls no dice and preserves cash/WLT',()=>{
 let r=force(buildGovernmentAdvisoryFixture({cashRolls:3}),'advisory-career',{careerId:'zhodani.prole'},[1]),before=structuredClone(r.state.character);
 rejected(r,'resolve-advisory-cash-limit',{decision:'forfeit',reason:''});
 r=run(r,'resolve-advisory-cash-limit',{decision:'forfeit',reason:'GM forfeits this capped award.'});assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.advisoryServices.at(-1).status,'forfeited');assert.equal(r.state.cashRolls,3);assert.equal(r.state.character.cash,before.cash);assert.equal(r.state.character.stats.WLT,before.stats.WLT);roundtrip(r);
});
test('explicit extra-roll exception remains separately audited and consumes a fourth lifetime cash roll only on rolling',()=>{
 let r=force(buildGovernmentAdvisoryFixture({cashRolls:3}),'advisory-career',{careerId:'zhodani.prole'},[1]);
 r=run(r,'resolve-advisory-cash-limit',{decision:'allow-extra',reason:'Explicit GM house-rule exception.'});assert.equal(r.state.cashRolls,3);assert.equal(r.state.advisoryCashBlocked,false);roundtrip(r);
 r=force(r,'advisory-cash',{},[1]);assert.equal(r.state.cashRolls,4);assert.equal(r.state.character.advisoryServices.at(-1).cash.capException,true);assert.equal(r.state.character.advisoryServices.at(-1).cashLimitDecision.decision,'allow-extra');roundtrip(r);
});
test('revision .6 rejects earlier .5 save unchanged before reconstruction',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.17');const old=structuredClone(government.session);old.rulesRevision='character-preview-2026-11-08.5';const bytes=JSON.stringify(old);assert.equal(api({operation:'project',session:old}).ok,false);assert.equal(JSON.stringify(old),bytes);
});

test('explicit one-roll credits defer by default and reject duplicate, unknown and ineligible identifiers',()=>{
 let r=buildBenefitCreditFixture(),id=r.state.benefitCreditOptions[0].id;
 rejected(r,'benefit',{cash:true,creditIds:[id,id]});rejected(r,'benefit',{cash:true,creditIds:['invented']});
 r=force(r,'benefit',{cash:true},[1]);assert.equal(r.state.character.benefitCredits[0].status,'available');assert.equal(r.state.character.benefitRollHistory.at(-1).modifier,0);
 r=force(r,'benefit',{cash:true,creditIds:[id]},[1]);assert.equal(r.state.character.benefitCredits[0].status,'consumed');assert.equal(r.state.character.benefitRollHistory.at(-1).modifier,1);assert.deepEqual(r.state.character.benefitRollHistory.at(-1).creditIds,[id]);roundtrip(r);
});
test('current-career credit belongs to actual Agent and expires at exit while global credits persist across careers',()=>{
 let r=buildAgentUndercoverFixture({borrowedEvent:4});assert.equal(r.state.character.benefitCredits[0].scope,'career');assert.equal(r.state.character.benefitCredits[0].originCareerId,'zhodani.agent');
 r=buildBenefitCreditFixture({careerScoped:true,advisory:true});assert.equal(r.state.character.benefitCredits[0].status,'expired');assert.deepEqual(r.state.benefitCreditOptions,[]);
 rejected(r,'advisory-cash',{creditIds:[r.state.character.benefitCredits[0].id]});
 const any=buildBenefitCreditFixture({advisory:true});assert.equal(any.state.benefitCreditOptions.length,1);assert.equal(any.state.character.benefitCredits[0].status,'available');roundtrip(any);
});
test('advisory uses only explicitly selected global credit and records original credit and employer independently',()=>{
 let r=buildBenefitCreditFixture({advisory:true}),id=r.state.benefitCreditOptions[0].id;r=force(r,'advisory-cash',{creditIds:[id]},[1]);
 const a=r.state.character.advisoryServices.at(-1),c=r.state.character.benefitCredits[0];assert.equal(a.cash.modifier,1);assert.equal(a.cash.amount,5000);assert.equal(c.originCareerId,'zhodani.prole');assert.equal(c.consumption.kind,'advisory');assert.equal(c.consumption.careerId,'zhodani.prole');assert.equal(c.consumption.careerIndex,1);assert.equal(c.consumption.advisoryId,a.id);roundtrip(r);
});
test('out-of-range advisory cash retains dice, consumes count/credits once and awaits GM amount without adding cash',()=>{
 let r=buildAdvisoryCashSourceFixture(),a=r.state.currentAdvisory,cash=r.state.character.cash,count=r.state.cashRolls,wealth=r.state.character.stats.WLT;
 assert.equal(r.state.stage,'advisory-cash-source');assert.equal(a.cash.result,8);assert.equal(a.cash.amount,null);assert.equal(a.cash.needsAdjudication,true);assert.equal(count,1);assert.ok(r.state.character.benefitCredits.every(c=>c.status==='consumed'));roundtrip(r);
 rejected(r,'advisory-cash',{});r=run(r,'gm-mode',{enabled:false});rejected(r,'resolve-advisory-cash-result',{amount:12345,reason:'No GM'},/GM mode/);r=run(r,'gm-mode',{enabled:true});
 for(const payload of [{amount:12345,reason:''},{amount:-1,reason:'Invalid'},{amount:100,reason:'Extra',die:1}])rejected(r,'resolve-advisory-cash-result',payload);
 r=run(r,'resolve-advisory-cash-result',{amount:12345,reason:'GM resolves the off-table result.'},{id:'cash-source-once'});assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.cash,cash+12345);assert.equal(r.state.cashRolls,count);assert.equal(r.state.character.stats.WLT,wealth);assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.benefitRollHistory.at(-1).result,8);
 assert.deepEqual(run(r,'resolve-advisory-cash-result',{amount:12345,reason:'GM resolves the off-table result.'},{id:'cash-source-once'}).session,r.session);rejected(r,'resolve-advisory-cash-result',{amount:12345,reason:'Duplicate'});roundtrip(r);
});
test('ordinary out-of-range credit roll consumes exactly one benefit only after source resolution and retains its audit',()=>{
 let r=buildBenefitCreditFixture({credits:2}),before=career(r).benefitRolls,ids=r.state.benefitCreditOptions.map(c=>c.id),cash=r.state.character.cash;
 r=force(r,'benefit',{cash:true,creditIds:ids},[6]);assert.equal(r.state.stage,'book-step');assert.equal(r.state.pending.kind,'benefit');assert.equal(r.state.pending.rollContext.result,8);assert.deepEqual(r.state.pending.rollContext.creditIds,ids);assert.equal(r.state.cashRolls,1);assert.equal(career(r).benefitRolls,before);roundtrip(r);
 r=run(r,'resolve-book',{confirmed:true,note:'Referee resolves the cash table result.',effects:[{kind:'cash',value:12345}]},{id:'ordinary-source-once'});assert.equal(career(r).benefitRolls,before-1);assert.equal(r.state.cashRolls,1);assert.equal(r.state.character.cash,cash+12345);assert.equal(r.state.character.benefitRollHistory.at(-1).completed,true);assert.equal(r.state.character.benefitRollHistory.at(-1).sourceAssisted,true);assert.deepEqual(r.state.character.benefitRollHistory.at(-1).creditIds,ids);
 assert.deepEqual(run(r,'resolve-book',{confirmed:true,note:'Referee resolves the cash table result.',effects:[{kind:'cash',value:12345}]},{id:'ordinary-source-once'}).session,r.session);roundtrip(r);
});
test('specialty source pause and over-cap retry keep borrowed source page and original training die',()=>{
 let r=buildAdvisorySkillCapFixture(),training=structuredClone(r.state.currentAdvisory.training);assert.equal(r.state.pendingChoice.source.page,272);
 r=run(r,'skill-award-source');assert.equal(r.state.pending.page,272);r=run(r,'retry-skill-choice');assert.equal(r.state.pendingChoice.source.page,272);
 r=run(r,'choose-skill',{name:'Drive (wheel)'});assert.equal(r.state.stage,'book-step');assert.equal(r.state.pending.page,272);roundtrip(r);
 r=run(r,'retry-skill-choice');r=run(r,'skill-award-source');r=run(r,'resolve-book',{confirmed:true,note:'Referee discards the over-cap skill award.',effects:[]});assert.equal(r.state.stage,'advisory-cash');assert.deepEqual(r.state.currentAdvisory.training,training);assert.equal(r.state.cashRolls,0);
 r=run(r,'advisory-cash');assert.equal(r.state.stage,'advancement');roundtrip(r);
});
test('Agent assignment specialization retains Prole source through source-assisted interruption',()=>{
 let r=force(agent,'cross-career-training',{assignment:'colonist'},[1]);assert.equal(r.state.stage,'skill-choice');assert.equal(r.state.pendingChoice.source.page,272);
 r=run(r,'skill-award-source');assert.equal(r.state.pending.page,272);r=run(r,'retry-skill-choice');r=run(r,'choose-skill',{name:'Animals (handling)'});assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.crossCareerRoutes[0].training.die,1);roundtrip(r);
});
test('death during borrowed treatment terminates its route without queued assignment training or career credit',()=>{
 let r=buildAgentUndercoverFixture({borrowedEvent:2,borrowedMishap:4,end:1});assert.equal(r.state.stage,'reeducation-roll');r=rolledReeducation(r,1);
 r=run(r,'resolve-reeducation',{chronology:chronology('before-resume'),endZero:{mode:'death',reason:'Referee confirms fatal END zero.'}});assert.equal(r.state.stage,'deceased');assert.equal(r.state.character.crossCareerRoutes[0].status,'deceased');assert.equal(r.state.character.crossCareerRoutes[0].completion.cause,'death-before-route-completion');assert.equal(r.state.character.crossCareerRoutes[0].training,null);assert.equal(r.state.currentCrossCareerTraining,null);assert.equal(career(r).terms,0);assert.equal(r.state.character.terms,0);roundtrip(r);
});
test('borrowed Prole Event12 promotion applies to Agent and adds no separate career or advancement roll',()=>{
 let r=buildAgentUndercoverFixture({borrowedEvent:12});r=force(r,'cross-career-training',{assignment:'colonist'},[3]);r=run(r,'advancement');assert.equal(r.log.at(-1).rolls.length,0);assert.equal(career(r).rank,1);assert.equal(r.state.character.careers.length,1);
});

test('source-earned Gambler and Government scoped modifier remain separate on advisory cash',()=>{
 let r=buildGovernmentAdvisoryFixture({gambler:true,withBenefitModifier:true});assert.equal(r.state.character.skills.Gambler,1);const modifiers=structuredClone(r.state.modifiers),ordinary=structuredClone(career(r));
 r=settle(force(r,'advisory-career',{careerId:'zhodani.prole'},[1]));r=force(r,'advisory-cash',{},[6]);
 assert.equal(r.state.character.advisoryServices.at(-1).cash.modifier,1);assert.equal(r.state.character.advisoryServices.at(-1).cash.amount,100000);assert.deepEqual(r.state.modifiers,modifiers);assert.deepEqual(career(r),ordinary);roundtrip(r);
});
test('explicit ordinary credit selection survives GM replay and restore without a second consumption',()=>{
 const before=buildBenefitCreditFixture(),ids=before.state.benefitCreditOptions.map(c=>c.id);let r=run(before,'benefit',{cash:true,creditIds:ids});const revision=r.revision;
 r=run(r,'gm-replay',{revision,rollIndex:0,values:[2],reason:'Audit the same selected credit on a replacement die.'});assert.equal(r.state.character.benefitCredits[0].status,'consumed');assert.equal(r.state.character.benefitCredits[0].consumption.die,2);assert.equal(r.state.cashRolls,1);assert.equal(r.state.character.benefitRollHistory.length,1);
 r=run(r,'restore',{revision:before.revision});assert.equal(r.state.character.benefitCredits[0].status,'available');assert.equal(r.state.cashRolls,0);roundtrip(r);
});
test('advisory out-of-table source resolution can be restored while original die and credit consumption remain intact',()=>{
 const before=buildAdvisoryCashSourceFixture();let r=run(before,'resolve-advisory-cash-result',{amount:90000,reason:'GM cash outcome'});
 r=run(r,'restore',{revision:before.revision});assert.equal(r.state.stage,'advisory-cash-source');assert.equal(r.state.currentAdvisory.cash.result,8);assert.equal(r.state.currentAdvisory.cash.amount,null);assert.equal(r.state.cashRolls,1);assert.ok(r.state.character.benefitCredits.every(c=>c.status==='consumed'));roundtrip(r);
});

test('borrowed shared life-event re-education keeps Prole table lineage and Agent employer',()=>{
 let r=buildAgentUndercoverFixture({borrowedEvent:7}),revision=r.log.findLast(x=>x.type==='survival').number;
 for(let attempt=0;attempt<200&&r.state.stage!=='reeducation-roll';attempt++)r=run(r,'gm-replay',{revision,rollIndex:3,values:[1,6],reason:'Borrowed life-event continuation fixture'});
 assert.equal(r.state.stage,'reeducation-roll');const route=r.state.character.crossCareerRoutes[0];assert.ok(route.tables.some(x=>x.table==='zhodani.life-events'&&x.source.page===277));assert.equal(r.state.currentReeducation.origin.careerId,'zhodani.agent');assert.equal(r.state.currentReeducation.origin.tableCareerId,'zhodani.prole');assert.equal(r.state.currentReeducation.origin.source.page,277);roundtrip(r);
});
test('direct fatal injury ruling terminates the borrowed route rather than leave a pending ledger',()=>{
 let r=buildAgentUndercoverFixture({success:false,borrowedMishap:6,end:1}),revision=r.log.findLast(x=>x.type==='survival').number;
 for(let attempt=0;attempt<40&&r.state.stage!=='injury-loss';attempt++)r=run(r,'gm-replay',{revision,rollIndex:3,values:[6],reason:'Borrowed injury-zero fixture'});
 assert.equal(r.state.stage,'injury-loss');r=run(r,'injury-loss',{index:2});assert.equal(r.state.pending.kind,'injury-zero');
 r=run(r,'resolve-book',{confirmed:true,note:'Referee confirms fatal injury.',injurySurvives:false});assert.equal(r.state.stage,'deceased');assert.equal(r.state.character.crossCareerRoutes[0].status,'deceased');assert.equal(r.state.character.crossCareerRoutes[0].training,null);assert.equal(career(r).terms,0);roundtrip(r);
});
