import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const run=(r,type,payload={},options)=>execute(r.session??r,{type,payload},options);
const terms={accessConfirmed:true,timingConfirmed:true,funding:'cash',cost:5000,providedConfirmed:false,reason:'Confirmed teacher access and two-week chronology'};
function start(option=true,extras=['PSI']){let r=run(createSession('psi-testing-24'),'configure',{extras,psiTestingWithoutEvent:option});r=run(r,'setup',{species:'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');return r;}
function boundary(option=true){let r=run(start(option),'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});return r;}
test('selected PSI stays untested with no RNG roll on Keep and can be enabled later',()=>{
 const rolled=start(),r=run(rolled,'accept-statistics');assert.equal(r.state.character.stats.PSI,undefined);assert.equal(r.state.rng,rolled.state.rng);assert.deepEqual(r.log.at(-1).rolls,[]);assert.equal(r.state.canStartPsionicTraining,false);
 let later=run(start(true,[]),'accept-statistics');later=run(later,'add-extra',{id:'PSI'});assert.equal(later.state.character.stats.PSI,undefined);assert.deepEqual(later.log.at(-1).rolls,[]);assert.throws(()=>run(later,'add-extra',{id:'PSI'}),/already enabled/);
});
test('GM-entered initial potential survives Keep without fabricating a test or talent',()=>{
 let r=start();r=run(r,'gm-override',{field:'stat.PSI',value:9,reason:'GM assigns initial potential'});r=run(r,'accept-statistics');assert.equal(r.state.character.stats.PSI,9);assert.equal(r.state.character.psionics.tests.length,0);assert.deepEqual(r.state.character.skills,{});assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('testing without event requires its explicit house option and a safe lifecycle checkpoint',()=>{
 const no=boundary(false);assert.equal(no.state.psionicTestingOptions.available,false);assert.throws(()=>run(no,'test-psionic-potential',terms),/event/);
 const raw=exportSession(no.session);assert.throws(()=>run(no,'gm-psi-testing',{enabled:1}),/true or false/);assert.equal(exportSession(no.session),raw);
 const enabled=run(no,'gm-psi-testing',{enabled:true});assert.equal(enabled.state.psionicTestingOptions.available,true);
 assert.throws(()=>run(start(),'test-psionic-potential',terms),/background|checkpoint/);
 assert.throws(()=>run(boundary(),'begin-psionic-training'),/Test psionic strength/);
});
test('test spends only testing charge, grants no training, and cannot repeat or double-charge',()=>{
 let r=run(boundary(),'gm-override',{field:'cash',value:120000,reason:'Synthetic test funding'});
 r=run(r,'gm-mode',{enabled:false});const skills=structuredClone(r.state.character.skills),before=r.state.character.cash;r=run(r,'test-psionic-potential',terms,{id:'test-once'});
 assert.equal(r.state.character.cash,before-5000);assert.equal(r.state.character.psionics.tests.length,1);assert.deepEqual(r.state.character.psionics.training,[]);assert.deepEqual(r.state.character.skills,skills);assert.equal(r.state.stage,'precareer');assert.equal(r.state.character.debt,0);
 const again=run(r,'test-psionic-potential',terms,{id:'test-once'});assert.deepEqual(again.session,r.session);assert.throws(()=>run(r,'test-psionic-potential',terms),/retained|reroll/);
 const tested=r;r=run(r,'begin-psionic-training');assert.equal(r.state.pending.minimumCost,100000);assert.equal(r.state.pending.testingNeeded,false);
 r=run(r,'resolve-book',{confirmed:true,psionicApproved:true,psionicCost:100000,psionicFunding:'cash',psionicTimingConfirmed:true,note:'Confirmed separate four-month course'});assert.equal(r.state.character.cash,15000);assert.equal(r.state.character.psionics.tests.length,1);assert.equal(r.state.character.stats.PSI,tested.state.character.stats.PSI);assert.deepEqual(r.log.at(-1).rolls,[]);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('missing access, timing, cost, cash or provider confirmation reject atomically',()=>{
 const r=boundary(),raw=exportSession(r.session);
 for(const payload of [{...terms,accessConfirmed:false},{...terms,timingConfirmed:false},{...terms,cost:4999},terms,{...terms,funding:'provided',cost:0},{...terms,funding:'provided',cost:0,providedConfirmed:true,reason:' '},{...terms,values:[6,6]}]){assert.throws(()=>run(r,'test-psionic-potential',payload));assert.equal(exportSession(r.session),raw);}
 const provided=run(r,'test-psionic-potential',{...terms,funding:'provided',cost:0,providedConfirmed:true});assert.equal(provided.state.character.cash,0);assert.equal(provided.state.character.psionics.rulings.at(-1).durationWeeks,2);
});

