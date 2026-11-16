import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,importSession,exportSession} from '../engine/session.mjs';
import {qualificationFixture,run} from './qualification-fallback-fixtures.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
import {canChooseDrifterFallback} from '../gui/drifter-fallback-choice.mjs';
test('each explicit Drifter specialty gets its assignment basic training without another qualification roll',()=>{
 const skills={barbarian:['Animals','Carouse','Melee','Stealth','Seafarer','Survival'],wanderer:['Drive','Deception','Recon','Stealth','Streetwise','Survival'],scavenger:['Pilot','Mechanic','Astrogation','Vacc Suit','Profession','Gun Combat']};
 for(const [assignment,expected] of Object.entries(skills)){
  const before=qualificationFixture(),entered=run(before,'fallback',{assignment});assert.equal(entered.state.character.careers.at(-1).assignment,assignment);assert.deepEqual(entered.log.at(-1).rolls,[]);assert.equal(entered.state.draftUsed,before.state.draftUsed);assert.equal(entered.state.rng,before.state.rng);
  const trained=settleAssignment(entered);for(const skill of expected)assert.equal(trained.state.character.skills[skill],0,assignment+' '+skill);
  assert.deepEqual(project(importSession(exportSession(trained.session))).state,trained.state);
 }
});
test('later-career explicit assignment offers only its basic-training choices',()=>{
 const before=qualificationFixture('core.navy',{later:true}),r=run(before,'fallback',{assignment:'scavenger'});assert.equal(r.state.character.careers.at(-1).assignment,'scavenger');assert.equal(r.state.character.terms,1);assert.deepEqual(r.log.at(-1).rolls,[]);assert.equal(r.state.stage,'effect-choice');
 assert.deepEqual(r.state.pendingChoice.options.map(o=>o.effects[0].name),['Pilot','Mechanic','Astrogation','Vacc Suit','Profession','Gun Combat']);
});
test('invalid specialty or attaching one to a draft rejects without changing history or RNG',()=>{
 const r=qualificationFixture(),raw=exportSession(r.session);
 for(const payload of [{assignment:'invalid'},{assignment:''},{draft:true,assignment:'wanderer'}]){const result=api({operation:'command',session:r.session,command:{type:'fallback',payload}});assert.equal(result.ok,false);assert.equal(exportSession(r.session),raw);}
});
test('old unqualified fallback payload retains exact Barbarian behavior for replay',()=>{
 const r=run(qualificationFixture(),'fallback');assert.equal(r.state.character.careers.at(-1).assignment,'barbarian');const raw=exportSession(r.session);assert.equal(exportSession(importSession(raw)),raw);assert.deepEqual(project(importSession(raw)).state,r.state);
});
test('specialty picker is scoped to an available ordinary Core Drifter fallback',()=>{
 const s=qualificationFixture().state;assert.equal(canChooseDrifterFallback(s),true);
 for(const state of [{...s,stage:'career'},{...s,fallbackOptions:{...s.fallbackOptions,forced:true}},{...s,fallbackOptions:{normal:{careerId:'aslan.outcast',available:true}}},{...s,fallbackOptions:{normal:{careerId:'vargr.loner',available:true}}}])assert.equal(canChooseDrifterFallback(state),false);
});

