
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {api,project,importSession,exportSession,RULES_REVISION} from '../engine/session.mjs';
import {CORE_ASSIGNMENT_MODES} from '../engine/assignment-changes.mjs';
import {buildAssignmentFixture,buildRestartAssignmentFixture,buildNobleEntryFixture,assignmentSetup,run,force,rejected,settleAssignment as settle} from './assignment-fixtures.mjs';
const record=r=>r.state.character.careers.at(-1),roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const url=new URL('../engine/session.mjs',import.meta.url);let source=await readFile(url,'utf8');source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));source+='\nexport const assignmentAudit={apply,assignmentOptions,assignmentRollModifier,educationRights,availableCareers};';const {assignmentAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function benefits(r){while(r.state.stage==='benefits')r=settle(force(r,'benefit',{cash:false},[2]));return r;}
function closeNext(r,event=5,ageRoll=[6,6]){if(r.state.stage==='training')r=settle(force(r,'training',{table:'service'},[1]));for(let n=0;n<40;n++){const before=r.revision,x=run(r,'survival');if(x.log.at(-1).rolls[1]?.label==='Event table'){r=run(x,'gm-replay',{revision:x.revision,rollIndex:1,values:[Math.max(1,event-6),Math.min(6,event-1)],reason:'Assignment term history fixture'});break;}r=run(x,'restore',{revision:before});}
 r=settle(r);r=settle(force(r,'advancement',{},[4,5]));if(r.state.stage==='training')r=settle(force(r,'training',{table:'service'},[1]));if(r.state.stage==='ageing')r=force(r,'ageing',{},ageRoll);return r;}
for(const [careerId,mode] of Object.entries(CORE_ASSIGNMENT_MODES))test(careerId+' exposes the correct source route without a full table',()=>{
 const r=buildAssignmentFixture({careerId});assert.equal(r.state.assignmentChangeOptions.length,2);assert.ok(r.state.assignmentChangeOptions.every(x=>x.available&&x.mode===mode&&x.source.page===20&&!x.training));assert.equal(record(r).termHistory[0].assignment,record(r).assignment);
});
test('retained success changes assignment only and starts one next term without entry awards',()=>{
 let r=buildAssignmentFixture(),before=structuredClone(r.state.character),old=structuredClone(record(r));
 r=force(r,'change-assignment',{assignment:'infantry'},[6,6]);assert.equal(r.state.stage,'training');assert.equal(record(r).assignment,'infantry');
 for(const k of ['rank','officer','highestRank','benefitRolls','terms','successfulTerms'])assert.equal(record(r)[k],old[k]);
 assert.deepEqual(r.state.character.skills,before.skills);assert.equal(r.state.character.age,before.age);assert.equal(r.state.character.careers.length,1);assert.equal(r.state.character.careerTransitions.length,1);
 assert.equal(r.state.character.assignmentChanges[0].check.modifier,0);assert.deepEqual(record(r).termHistory,old.termHistory);
 rejected(r,'change-assignment',{assignment:'cavalry'});roundtrip(r);
 r=closeNext(r);assert.equal(record(r).terms,2);assert.deepEqual(record(r).termHistory.map(t=>t.assignment),['support','infantry']);roundtrip(r);
});
test('retained failure keeps assignment and rank, without draft or repeat-roll opportunity',()=>{
 let r=buildAssignmentFixture(),old=structuredClone(record(r));r=force(r,'change-assignment',{assignment:'infantry'},[1,1]);assert.equal(r.state.stage,'training');assert.equal(record(r).assignment,old.assignment);assert.equal(record(r).rank,old.rank);assert.equal(r.state.character.assignmentChanges[0].status,'failed');assert.equal(r.state.failedQualification,false);rejected(r,'fallback',{draft:false});rejected(r,'change-assignment',{assignment:'cavalry'});roundtrip(r);
});
test('retained officer rank and commission history survive without target rank bonus',()=>{
 let r=buildAssignmentFixture({officer:true}),before=structuredClone(record(r)),skills=structuredClone(r.state.character.skills);assert.equal(before.officer,true);
 r=force(r,'change-assignment',{assignment:'cavalry'},[6,6]);assert.equal(record(r).officer,true);assert.equal(record(r).rank,before.rank);assert.equal(record(r).commissionTried,before.commissionTried);assert.deepEqual(r.state.character.skills,skills);
});
test('forced stay allows retained assignment but not a fresh career stint; forced exit blocks both',()=>{
 let r=buildAssignmentFixture({forcedStay:true});assert.equal(record(r).forcedStay,true);r=force(r,'change-assignment',{assignment:'infantry'},[6,6]);assert.equal(r.state.stage,'training');assert.equal(record(r).forcedStay,false);
 for(const options of [{careerId:'core.agent',forcedStay:true},{careerId:'core.agent',forcedExit:true},{careerId:'core.army',forcedExit:true}]){const x=buildAssignmentFixture(options);assert.ok(x.state.assignmentChangeOptions.every(o=>!o.available));rejected(x,'change-assignment',{assignment:x.state.assignmentChangeOptions[0].id});}
});
test('Noble ordinary entry and retained change are automatic at SOC10 without dice',()=>{
 let r=buildNobleEntryFixture(),rng=r.state.rng;r=run(r,'career',{id:'core.noble',assignment:'administrator'});assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.rng,rng);assert.equal(r.state.character.careerTransitions[0].automaticReason,'noble-social-standing');
 r=buildAssignmentFixture({careerId:'core.noble'});const skills=structuredClone(r.state.character.skills);r=run(r,'change-assignment',{assignment:'diplomat'});assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.assignmentChanges[0].automaticReason,'noble-social-standing');assert.deepEqual(r.state.character.skills,skills);
 const low=force(buildNobleEntryFixture({soc:9}),'career',{id:'core.noble',assignment:'administrator'},[1,1]);assert.equal(low.state.stage,'failed-entry');
});
test('retained university qualification is persistent without repeating first-entry rights',()=>{
 let r=buildAssignmentFixture({careerId:'core.navy',university:true}),before=structuredClone(r.state.character);r=force(r,'change-assignment',{assignment:'technical'},[6,6]);
 assert.equal(r.state.character.assignmentChanges[0].check.modifier,2);assert.equal(r.state.character.educations[0].careerAttempts,before.educations[0].careerAttempts);assert.equal(r.state.character.educations[0].serviceAwardUsed,before.educations[0].serviceAwardUsed);assert.deepEqual(r.state.character.skills,before.skills);
});
test('fresh route musters old career benefits then deliberately starts a fresh rank0 record',()=>{
 let r=buildAssignmentFixture({careerId:'core.agent'}),old=structuredClone(record(r));r=run(r,'change-assignment',{assignment:'intelligence'});assert.equal(r.state.stage,'benefits');assert.equal(r.state.currentAssignmentChange.status,'mustering-out');assert.equal(record(r).exit,'voluntary');assert.equal(record(r).exitGenerationTerms,1);assert.equal(record(r).exitAssignment,'law');rejected(r,'qualify-assignment');
 r=benefits(r);assert.equal(r.state.stage,'assignment-entry');assert.equal(r.state.currentAssignmentChange.status,'ready');const cashRolls=r.state.cashRolls;rejected(r,'career',{id:'core.army',assignment:'support'});rejected(r,'gm-override',{field:'cash',value:100,reason:'No mutation underneath qualification'});
 r=force(r,'qualify-assignment',{},[6,6]);assert.equal(r.state.character.careers.length,2);assert.equal(record(r).rank,0);assert.equal(record(r).terms,0);assert.equal(record(r).assignment,'intelligence');assert.equal(r.state.currentAssignmentChange.status,'completed');assert.equal(r.state.currentAssignmentChange.check.modifier,-1);assert.equal(r.state.cashRolls,cashRolls);
 assert.equal(r.state.character.careers[0].rank,old.rank);assert.equal(r.state.character.careers[0].assignment,'law');assert.equal(r.state.character.careerTransitions.at(-1).procedureSource.page,20);assert.equal(r.state.character.careerTransitions.at(-1).source.page,22);rejected(r,'qualify-assignment');roundtrip(r);
});
test('fresh failure records the failed qualification once and keeps ordinary fallback',()=>{
 let r=buildRestartAssignmentFixture({ready:true});r=force(r,'qualify-assignment',{},[1,1]);assert.equal(r.state.stage,'failed-entry');assert.equal(r.state.currentAssignmentChange.status,'failed');assert.equal(r.state.character.careers.length,1);rejected(r,'qualify-assignment');r=run(r,'fallback',{draft:false});assert.equal(record(r).id,'core.drifter');assert.equal(r.state.character.careerTransitions.at(-1).automaticReason,'fallback');roundtrip(r);
});
test('fresh plan abandonment keeps consumed benefits and has not used an entry attempt',()=>{
 let r=buildRestartAssignmentFixture({careerId:'core.merchant',ready:true}),before=structuredClone(r.state.character),cashRolls=r.state.cashRolls;r=run(r,'abandon-assignment-change');
 assert.equal(r.state.stage,'career');assert.equal(r.state.currentAssignmentChange.status,'abandoned');assert.deepEqual(r.state.character.benefits,before.benefits);assert.equal(r.state.character.cash,before.cash);assert.equal(r.state.cashRolls,cashRolls);assert.equal(r.state.character.careerTransitions.length,before.careerTransitions.length);
 rejected(r,'career',{id:'core.merchant',assignment:'marine'});r=force(r,'career',{id:'core.agent',assignment:'law'},[6,6]);assert.equal(record(r).id,'core.agent');roundtrip(r);
});
test('invalid same assignment preflights before dice, modifiers or education attempts',()=>{
 let r=buildAssignmentFixture({careerId:'core.agent',university:true});r=benefits(run(r,'leave-career'));const before=exportSession(r.session);rejected(r,'career',{id:'core.agent',assignment:'law'},/immediately/);assert.equal(exportSession(r.session),before);
 const retained=buildAssignmentFixture();rejected(retained,'change-assignment',{assignment:'support'});rejected(retained,'change-assignment',{assignment:'infantry',roll:12});
});
test('an intervening education term permits historical same-assignment return',()=>{
 let r=benefits(run(buildAssignmentFixture({careerId:'core.agent'}),'leave-career'));rejected(r,'career',{id:'core.agent',assignment:'law'},/immediately/);
 r=run(r,'open-precareer');r=force(r,'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});r=force(r,'education-event',{},[1,4]);r=force(r,'education-graduation',{},[6,6]);assert.equal(r.state.character.terms,2);
 r=force(r,'career',{id:'core.agent',assignment:'law'},[6,6]);assert.equal(r.state.character.careers.length,2);assert.equal(r.state.character.careerTransitions.at(-1).mode,'return');roundtrip(r);
});
test('retained replay, duplicate command IDs and restore preserve the exact boundary',()=>{
 const base=buildAssignmentFixture();let r=run(base,'change-assignment',{assignment:'infantry'},{id:'assignment-once'});assert.deepEqual(run(r,'change-assignment',{assignment:'infantry'},{id:'assignment-once'}).session,r.session);
 r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[1,1],reason:'Assignment result review'});assert.equal(r.state.character.assignmentChanges.length,1);assert.equal(r.state.character.assignmentChanges[0].status,'failed');assert.equal(record(r).assignment,'support');roundtrip(r);
 r=run(r,'restore',{revision:base.revision});assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.assignmentChanges,undefined);roundtrip(r);
});
test('qualification modifier audit excludes the current stint and next-career-only credits',()=>{
 const s=structuredClone(buildAssignmentFixture().state);s.modifiers=[{target:'qualification',careerId:'any',scope:'one',value:2},{target:'qualification',careerId:'core.army',scope:'all',value:1},{target:'qualification',careerId:'next',scope:'one',value:4}];
 assert.equal(a.assignmentRollModifier(s,{id:'core.army'},'infantry',true),3);assert.deepEqual(s.modifiers.map(x=>x.careerId),['core.army','next']);
 s.character.careers.unshift({id:'core.merchant'});assert.equal(a.assignmentRollModifier(s,{id:'core.army'},'infantry',false),0);
});
test('Companion entry-only qualification bonuses do not leak into retained checks',()=>{
 const s=structuredClone(buildAssignmentFixture().state);s.character.educations=[{id:'companion.colonial',completed:true,graduation:{attempted:true,graduated:true,honours:false},careersBefore:0},{id:'companion.spacer',completed:true,graduation:{attempted:true,graduated:true,honours:false},careersBefore:0}];
 assert.equal(a.assignmentRollModifier(s,{id:'core.army'},'infantry',false),0);
});
test('Noble no-roll rule survives a prior ageing crisis; required rolls remain blocked',()=>{
 const s=structuredClone(buildNobleEntryFixture().state);s.character.qualificationBanned=true;s.modifiers=[{target:'qualification',careerId:'any',scope:'one',value:2}];
 const options=a.availableCareers(s);assert.equal(options.find(x=>x.id==='core.noble').disabled,false);assert.equal(options.find(x=>x.id==='core.army').disabled,true);
 const rolls=[];a.apply(s,{type:'career',payload:{id:'core.noble',assignment:'administrator'}},rolls);assert.equal(rolls.length,0);assert.equal(s.modifiers.length,1);
});
test('missing characteristic continuation does not spend a retained attempt before source resolution',()=>{
 const s=structuredClone(buildAssignmentFixture().state);delete s.character.stats.END;const rolls=[];a.apply(s,{type:'change-assignment',payload:{assignment:'infantry'}},rolls);
 assert.equal(s.pending.kind,'missing-characteristic-check');assert.equal(s.character.assignmentChanges,undefined);assert.equal(rolls.length,0);a.apply(s,{type:'resolve-book',payload:{confirmed:true,note:'Source-defined substitute qualification',checkNatural:8,checkTotal:8}},rolls);assert.equal(s.stage,'training');assert.equal(s.character.assignmentChanges.length,1);
});
test('new rules revision rejects all prior mechanical revisions without modifying history',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.29');for(const n of [2,3,4,5,6,7,8]){const old=structuredClone(buildAssignmentFixture().session);old.rulesRevision='character-preview-2026-11-08.'+n;const bytes=JSON.stringify(old);const r=api({operation:'project',session:old});assert.equal(r.ok,false);assert.match(r.error.message,/Legacy or different rules revision/);assert.equal(JSON.stringify(old),bytes);}
});

test('Hard Knocks first-career penalties survive retained switches without first-entry awards',()=>{
 let r=assignmentSetup('assignment-hard-knocks',6);r=run(r,'precareer',{id:'companion.hard-knocks'});r=run(r,'companion-entry');
 r=run(r,'companion-skill',{selected:['Athletics','Deception']});r=force(r,'education-event',{},[1,4]);r=force(r,'education-graduation',{},[6,6]);r=run(r,'companion-skill',{selected:['Drive','Gambler','Melee']});r=run(r,'companion-skill',{selected:['Gun Combat (slug)']});
 r=settle(force(r,'career',{id:'core.army',assignment:'support'},[6,6]));r=closeNext(r,9);assert.deepEqual(record(r).educationModifiers,{commission:-2,advancement:-2});
 const before=structuredClone(r.state.character);r=force(r,'change-assignment',{assignment:'infantry'},[6,6]);assert.equal(r.state.character.assignmentChanges[0].check.modifier,0);assert.deepEqual(record(r).educationModifiers,{commission:-2,advancement:-2});assert.deepEqual(r.state.character.skills,before.skills);assert.equal(r.state.character.educations[0].careerAttempts,before.educations[0].careerAttempts);
 r=closeNext(r);assert.match(r.log.findLast(x=>x.type==='advancement').summary,/"modifier":-2/);roundtrip(r);
});

test('public ageing-crisis history still allows Noble automatic entry without another roll',()=>{
 let r=buildAssignmentFixture();for(const [field,value]of [['age',30],['stat.STR',1],['stat.SOC',10],['cash',100000]])r=run(r,'gm-override',{field,value,reason:'Ageing crisis and Noble boundary fixture'});
 r=run(r,'continue-career');r=closeNext(r,5,[1,1]);assert.equal(r.state.stage,'effect-choice');r=run(r,'choose-effect',{index:0});r=run(r,'choose-effect',{index:0});assert.equal(r.state.character.qualificationBanned,true);assert.equal(r.state.character.ageingCrises[0].careAccepted,true);
 r=benefits(run(r,'leave-career'));assert.equal(r.state.careerChoices.find(c=>c.id==='core.army').disabled,true);r=run(r,'career',{id:'core.noble',assignment:'administrator'});assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.careerTransitions.at(-1).automaticReason,'noble-social-standing');roundtrip(r);
});

test('three earned lifetime cash rolls remain spent across restart and later mustering-out',()=>{
 let r=buildAssignmentFixture({careerId:'core.agent'});r=run(r,'continue-career');r=closeNext(r);assert.equal(record(r).terms,2);assert.equal(record(r).rank,2);
 r=run(r,'change-assignment',{assignment:'intelligence'});assert.equal(record(r).benefitRolls,3);
 for(let i=0;i<3;i++){r=force(r,'benefit',{cash:true},[1]);assert.equal(r.state.cashRolls,i+1);}
 assert.equal(r.state.stage,'assignment-entry');const cash=r.state.character.cash;assert.ok(cash>0);assert.equal(r.state.character.benefitRollHistory.filter(h=>h.table==='cash').length,3);roundtrip(r);
 r=settle(force(r,'qualify-assignment',{},[6,6]));assert.equal(r.state.stage,'training');assert.equal(r.state.cashRolls,3);assert.equal(r.state.character.cash,cash);
 r=closeNext(r);r=run(r,'leave-career');assert.equal(r.state.stage,'benefits');const rolls=record(r).benefitRolls;rejected(r,'benefit',{cash:true},/limit/);assert.equal(record(r).benefitRolls,rolls);assert.equal(r.state.cashRolls,3);
 r=benefits(r);assert.equal(r.state.cashRolls,3);assert.equal(r.state.character.cash,cash);assert.equal(r.state.character.benefitRollHistory.filter(h=>h.table==='cash').length,3);roundtrip(r);
});
