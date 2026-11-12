import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,importSession,exportSession,RULES_REVISION} from '../engine/session.mjs';
import {buildAslanOutlawRestorationFixture,buildOutlawDepartureFixture,buildHistoricalEntryFixture,maleRestoration,femaleRestoration,aslanBenefits,run,force,settle,rejected} from './aslan-outlaw-fixtures.mjs';
import {aslanEvent,aslanEndTerm} from './aslan-officer-fixtures.mjs';
const last=r=>r.state.character.careers.at(-1),rest=r=>r.state.currentAslanOutlawRestoration,entry=r=>r.state.currentAslanHistoricalEntry;
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
test('male restores current standing before exactly three Clan Shares, then closes only the current term',()=>{
 let r=buildAslanOutlawRestorationFixture(),before=structuredClone(r.state.character),old=structuredClone(last(r));assert.equal(before.outcast,true);assert.equal(before.stats.SOC,2);assert.ok(before.benefitAwards[0].forfeited);
 r=run(r,'resolve-aslan-outlaw-restoration',maleRestoration);assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.stats.SOC,8);assert.equal(r.state.character.outcast,false);assert.equal(r.log.at(-1).rolls.length,0);assert.equal(last(r).forcedExit,true);assert.equal(last(r).rank,old.rank);assert.equal(last(r).terms,old.terms+1);assert.equal(r.state.character.terms,before.terms+1);assert.equal(r.state.character.age,before.age+4);assert.equal(last(r).benefitRolls,old.benefitRolls+1);
 const award=r.state.character.benefitAwards.find(a=>rest(r).shareAwardIds.includes(a.id));assert.equal(award.quantity,3);assert.equal(award.forfeited,undefined);assert.equal(r.state.character.benefits.find(b=>b.definitionId==='aslan.clan-share').quantity,3);assert.equal(r.state.character.cash,before.cash);assert.equal(r.state.character.debt,before.debt);assert.equal(r.state.character.aslanStatusChanges.length,before.aslanStatusChanges.length);
 assert.deepEqual(r.state.character.benefitAwards[0],before.benefitAwards[0]);rejected(r,'advancement');rejected(r,'continue-career');rejected(r,'resolve-aslan-outlaw-restoration',maleRestoration);roundtrip(r);
});
test('accepted departure resolves normal benefit accounting once and never grants automatic historical entry',()=>{
 let r=buildOutlawDepartureFixture(),age=r.state.character.age,terms=r.state.character.terms;r=run(r,'leave-career');assert.equal(rest(r).status,'mustering-out');const count=last(r).benefitRolls;
 r=aslanBenefits(r);assert.equal(rest(r).status,'completed');assert.equal(rest(r).departure.completed,true);assert.equal(last(r).totalBenefits,count);assert.equal(last(r).benefitRolls,0);assert.equal(r.state.character.age,age);assert.equal(r.state.character.terms,terms);assert.equal(r.state.careerChoices.find(c=>c.id==='aslan.military').disabled,true);
 rejected(r,'career',{id:'aslan.military',assignment:'warrior'});rejected(r,'leave-career');assert.ok(r.state.aslanHistoricalEntryOptions.some(c=>c.careerId==='aslan.military'));roundtrip(r);
});
for(const dice of [[1,1],[6,6]])test('female fresh2D SOC '+dice+' ignores all statistics boons and grants no male award',()=>{
 const base=buildAslanOutlawRestorationFixture({gender:'female',boons:6});let r=force(base,'resolve-aslan-outlaw-restoration',femaleRestoration,dice);
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.config.boons,6);assert.deepEqual(rest(r).socRoll,{dice,natural:dice[0]+dice[1],total:dice[0]+dice[1],modifier:0,boon:false});assert.equal(r.state.character.stats.SOC,dice[0]+dice[1]);assert.equal(r.state.character.outcast,false);assert.equal(rest(r).clanShares,0);assert.deepEqual(rest(r).shareAwardIds,[]);assert.equal(rest(r).married,true);assert.equal(r.state.character.benefitAwards.length,base.state.character.benefitAwards.length);assert.equal(last(r).forcedExit,true);roundtrip(r);
});
test('female player decline and GM verified ineligibility preserve status, term and advancement',()=>{
 for(const decision of [{decision:'decline'},{decision:'ineligible',unmarriedConfirmed:false,reason:'Referee verified this Traveller is already married.'}]){
  let r=buildAslanOutlawRestorationFixture({gender:'female'});if(decision.decision==='decline')r=run(r,'gm-mode',{enabled:false});const before=structuredClone(r.state.character),rng=r.state.rng;r=run(r,'resolve-aslan-outlaw-restoration',decision);
  assert.equal(r.state.stage,'advancement');assert.equal(!!last(r).forcedExit,false);assert.equal(r.state.character.age,before.age);assert.equal(r.state.character.terms,before.terms);assert.deepEqual(r.state.character.stats,before.stats);assert.equal(r.state.character.outcast,true);assert.equal(r.state.rng,rng);assert.equal(r.log.at(-1).rolls.length,0);assert.equal(rest(r).married,false);roundtrip(r);
 }
});
test('male and female invalid or unverified decisions are atomic before rolls or rewards',()=>{
 const male=buildAslanOutlawRestorationFixture();for(const patch of [{originalSOC:0},{originalSOC:41},{originalSOCConfirmed:false},{reason:''},{effects:[]}])rejected(male,'resolve-aslan-outlaw-restoration',{...maleRestoration,...patch});rejected(male,'resolve-aslan-outlaw-restoration',{decision:'decline'});rejected(run(male,'gm-mode',{enabled:false}),'resolve-aslan-outlaw-restoration',maleRestoration);
 const female=buildAslanOutlawRestorationFixture({gender:'female'});rejected(female,'resolve-aslan-outlaw-restoration',{...femaleRestoration,unmarriedConfirmed:false});rejected(female,'resolve-aslan-outlaw-restoration',{...femaleRestoration,originalSOC:10});rejected(run(female,'gm-mode',{enabled:false}),'resolve-aslan-outlaw-restoration',femaleRestoration);
 for(const r of [male,female]){rejected(r,'resolve-book',{confirmed:true,note:'No generic partial outcome',effects:[{kind:'stat',name:'SOC',value:6}]});rejected(r,'gm-override',{field:'cash',value:100,reason:'Do not mutate pending source context'});roundtrip(r);}
});
test('accepted restoration performs due ordinary ageing before departure and no extra career term',()=>{
 let r=buildAslanOutlawRestorationFixture({age:38}),before=structuredClone(r.state.character);r=run(r,'resolve-aslan-outlaw-restoration',maleRestoration);assert.equal(r.state.stage,'ageing');assert.equal(r.state.character.age,42);assert.equal(r.state.character.terms,before.terms+1);rejected(r,'leave-career');
 r=settle(force(r,'ageing',{},[6,6]));assert.equal(r.state.stage,'term-end');r=aslanBenefits(run(r,'leave-career'));assert.equal(r.state.character.age,42);assert.equal(last(r).terms,1);assert.equal(rest(r).status,'completed');roundtrip(r);
});
test('female replay/restore retains original dice and never duplicates marriage, shares or term credit',()=>{
 const base=buildAslanOutlawRestorationFixture({gender:'female'});let r=force(base,'resolve-aslan-outlaw-restoration',femaleRestoration,[1,1]);r=aslanBenefits(run(r,'leave-career'));
 r=run(r,'gm-replay',{revision:base.revision+1,rollIndex:0,values:[6,6],reason:'Review the recorded marriage SOC result'});assert.equal(r.state.character.stats.SOC,12);assert.equal(r.state.character.aslanOutlawRestorations.length,1);assert.equal(rest(r).status,'awaiting-departure');assert.equal(last(r).terms,1);assert.equal(r.state.character.careers.length,2);roundtrip(r);
 r=run(r,'restore',{revision:base.revision});assert.equal(rest(r).status,'pending');assert.equal(r.state.character.outcast,true);assert.equal(last(r).terms,0);roundtrip(r);
});
test('male restoration retry ID is idempotent and player cannot restore old actions',()=>{
 const base=buildAslanOutlawRestorationFixture();let r=run(base,'resolve-aslan-outlaw-restoration',maleRestoration,{id:'outlaw-restore-once'}),bytes=exportSession(r.session);r=run(r,'resolve-aslan-outlaw-restoration',maleRestoration,{id:'outlaw-restore-once'});assert.equal(exportSession(r.session),bytes);r=run(r,'gm-mode',{enabled:false});rejected(r,'restore',{revision:base.revision});roundtrip(r);
});
test('one requested historical entry requires explicit GM approval and no qualification is rolled yet',()=>{
 const base=buildOutlawDepartureFixture({ready:true});let r=run(base,'request-aslan-historical-entry',{careerId:'aslan.military',assignment:'warrior'});assert.equal(r.state.pending.kind,'aslan-historical-entry');assert.equal(entry(r).status,'requested');assert.equal(entry(r).careerName,'Military');assert.equal(entry(r).assignmentName,'Warrior');assert.deepEqual(entry(r).priorCareerIndices,[0,1]);assert.equal(r.log.at(-1).rolls.length,0);
 rejected(r,'resolve-aslan-historical-entry',{approved:true,reason:''});rejected(run(r,'gm-mode',{enabled:false}),'resolve-aslan-historical-entry',{approved:true,reason:'Source review'});rejected(r,'gm-override',{field:'age',value:40,reason:'Pending entry context'});rejected(r,'career',{id:'aslan.military',assignment:'warrior'});
 r=run(r,'resolve-aslan-historical-entry',{approved:true,reason:'Referee permits this one specific next entry.'});assert.equal(entry(r).status,'approved');assert.equal(r.state.stage,'career');assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.careerChoices.find(c=>c.id==='aslan.military').disabled,false);assert.equal(r.state.careerChoices.find(c=>c.id==='aslan.military').assignments.find(a=>a.id==='cavalry').disabled,true);roundtrip(r);
});
test('approved entry uses normal qualification and fresh rank without consuming additional benefits',()=>{
 let r=buildHistoricalEntryFixture({approved:true}),before=structuredClone(r.state.character),cashRolls=r.state.cashRolls;r=settle(force(r,'career',{id:'aslan.military',assignment:'warrior'},[6,6]));
 assert.equal(last(r).id,'aslan.military');assert.equal(last(r).rank,0);assert.equal(last(r).officer,false);assert.equal(last(r).terms,0);assert.equal(entry(r).status,'consumed');assert.equal(entry(r).attempt.check.natural,12);assert.equal(entry(r).attempt.automaticReason,null);assert.equal(r.state.character.age,before.age);assert.equal(r.state.character.terms,before.terms);assert.deepEqual(r.state.character.benefitRollHistory,before.benefitRollHistory);assert.equal(r.state.cashRolls,cashRolls);rejected(r,'career',{id:'aslan.military',assignment:'warrior'});roundtrip(r);
});
test('failed approved entry consumes only its ruling and forfeits restored shares by the normal rule',()=>{
 let r=buildHistoricalEntryFixture({approved:true,careerId:'aslan.military-officer',assignment:'leader'});const shares=r.state.character.benefits.find(b=>b.definitionId==='aslan.clan-share').quantity;r=force(r,'career',{id:'aslan.military-officer',assignment:'leader'},[1,1]);
 assert.equal(r.state.stage,'failed-entry');assert.equal(r.state.character.outcast,true);assert.equal(r.state.character.stats.SOC,2);assert.equal(entry(r).status,'consumed');assert.equal(entry(r).attempt.success,false);assert.ok(r.state.character.aslanStatusChanges.at(-1).removed.some(b=>b.quantity===shares));assert.equal(r.state.character.benefits.some(b=>b.definitionId==='aslan.clan-share'),false);rejected(r,'request-aslan-historical-entry',{careerId:'aslan.military',assignment:'warrior'});r=settle(run(r,'fallback',{draft:false}));assert.equal(last(r).id,'aslan.outcast');roundtrip(r);
});
test('requests cannot bypass gender or independent prerequisites or stockpile and silently retarget approval',()=>{
 let r=buildHistoricalEntryFixture({approved:true});rejected(r,'request-aslan-historical-entry',{careerId:'aslan.military',assignment:'warrior'});rejected(r,'career',{id:'aslan.military',assignment:'cavalry'});rejected(r,'request-aslan-historical-entry',{careerId:'aslan.manager',assignment:'corporate'});rejected(r,'request-aslan-historical-entry',{careerId:'core.army',assignment:'infantry'});
 r=run(r,'request-aslan-historical-entry',{careerId:'aslan.spacer',assignment:'gunner'});assert.equal(r.state.character.aslanHistoricalEntries[0].status,'superseded');assert.equal(r.state.character.aslanHistoricalEntries[0].supersededBy,entry(r).id);assert.equal(entry(r).status,'requested');
 r=run(r,'resolve-aslan-historical-entry',{approved:false,reason:'Referee does not approve this interpretation.'});assert.equal(entry(r).status,'declined');assert.equal(r.state.careerChoices.find(c=>c.id==='aslan.military').disabled,true);assert.equal(r.state.careerChoices.find(c=>c.id==='aslan.spacer').disabled,true);roundtrip(r);
});
test('approval revalidates assignment prerequisites before dice or consumption',()=>{
 let r=buildHistoricalEntryFixture({approved:true,assignment:'support'});r=run(r,'gm-override',{field:'stat.SOC',value:9,reason:'Current SOC now exceeds the male Support prerequisite'});rejected(r,'career',{id:'aslan.military',assignment:'support'});assert.equal(entry(r).status,'approved');roundtrip(r);
});
test('approval expires on another actual career or education and on an audited time change',()=>{
 let r=buildHistoricalEntryFixture({approved:true});r=settle(run(r,'career',{id:'aslan.outcast',assignment:'labourer'}));assert.equal(entry(r).status,'expired');assert.equal(entry(r).expiry.reason,'another-career-entered');roundtrip(r);
 r=buildHistoricalEntryFixture({approved:true});r=run(r,'gm-override',{field:'age',value:r.state.character.age+1,reason:'Audited time boundary change'});assert.equal(entry(r).status,'expired');assert.equal(r.state.aslanHistoricalEntryOptions.length,0);roundtrip(r);
 r=buildHistoricalEntryFixture({approved:true});r=run(r,'open-precareer');r=force(r,'precareer',{id:'core.university'},[6,6]);assert.equal(entry(r).status,'expired');assert.equal(entry(r).expiry.reason,'education-entered');roundtrip(r);
});
test('source ruling replay and restore do not resurrect a consumed approval or duplicate source rewards',()=>{
 const base=buildHistoricalEntryFixture({approved:true});let r=force(base,'career',{id:'aslan.military',assignment:'warrior'},[6,6]);r=run(r,'gm-replay',{revision:base.revision+1,rollIndex:0,values:[1,1],reason:'Review the normal entry qualification'});assert.equal(r.state.character.aslanHistoricalEntries.length,1);assert.equal(entry(r).status,'consumed');assert.equal(r.state.character.aslanOutlawRestorations.length,1);roundtrip(r);
 r=run(r,'restore',{revision:base.revision});assert.equal(entry(r).status,'approved');assert.equal(rest(r).clanShares,3);assert.equal(r.state.character.careers.length,2);roundtrip(r);
});
test('revision .10 rejects exact .9 saves before any reconstruction or mutation',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.30');const old=structuredClone(buildOutlawDepartureFixture().session);old.rulesRevision='character-preview-2026-11-08.9';const bytes=JSON.stringify(old),r=api({operation:'project',session:old});assert.equal(r.ok,false);assert.match(r.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),bytes);
});
