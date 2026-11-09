import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,skillChoiceSuggestions} from '../engine/session.mjs';
import {trainingFixture,run} from './training-information-fixtures.mjs';
function pending(table='advanced'){return run(trainingFixture({species:'vargr',career:'vargr.citizen',assignment:'corporate'}),'training',{table});}
test('Electronics award offers only canonical Electronics specialities; unrelated skills reject atomically',()=>{
 const r=pending(),raw=exportSession(r.session);assert.deepEqual(r.state.pendingChoice.allowed,['Electronics']);
 assert.deepEqual(r.state.skillChoiceSuggestions,['Electronics (comms)','Electronics (computers)','Electronics (remote ops)','Electronics (sensors)']);
 for(const name of ['Admin','Engineer (power)','Electronics (invalid)','Electronics']){
  const rejected=api({operation:'command',session:r.session,command:{type:'choose-skill',payload:{name}}});assert.equal(rejected.ok,false,name);assert.equal(exportSession(r.session),raw);
 }
 const accepted=run(r,'choose-skill',{name:'Electronics (computers)'});assert.equal(accepted.state.character.skills['Electronics (computers)'],1);assert.deepEqual(accepted.state.skillChoiceSuggestions,[]);
 assert.equal(api({operation:'import',raw}).ok,true);assert.equal(exportSession(r.session),raw);
});
test('open-ended profession choices retain typed specialities without unrelated suggestions',()=>{
 const r=pending('service');assert.deepEqual(r.state.pendingChoice.allowed,['Profession']);assert.ok(r.state.skillChoiceSuggestions.every(name=>name.startsWith('Profession (')));
 const accepted=run(r,'choose-skill',{name:'Profession (construction)'});assert.equal(accepted.state.character.skills['Profession (construction)'],1);
});

test('distinct and reduction suggestions follow the same additional acceptance constraints',()=>{
 const state={stage:'skill-choice',character:{skills:{'Science (physics)':1,'Science (biology)':2,'Profession (religion)':1,Admin:0}},pendingChoice:{kind:'skill-choice',allowed:['Science'],distinctSpecialties:true,selected:['Science (PHYSICS)']}};
 assert.deepEqual(skillChoiceSuggestions(state),['Science (biology)']);
 state.pendingChoice={kind:'skill-reduction-choice',scope:'science-specialties',value:1};assert.deepEqual(skillChoiceSuggestions(state),['Science (biology)','Science (physics)']);
 state.pendingChoice={kind:'skill-reduction-choice',names:['Profession (religion)','Science (belief)'],value:1};assert.deepEqual(skillChoiceSuggestions(state),['Profession (religion)']);
});
