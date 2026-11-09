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
for(const [base,die,name] of [['Drive',1,'Drive (wheel)'],['Melee',6,'Melee (blade)']])test(base+' dropdown gives actual specialities accepted without source override',()=>{
 const start=trainingFixture({species:'vargr',career:'vargr.citizen',assignment:'corporate'}),trained=run(start,'training',{table:'personal'});
 const r=run(trained,'gm-replay',{revision:trained.revision,rollIndex:0,values:[die],reason:'Speciality option regression'});
 assert.deepEqual(r.state.pendingChoice.allowed,[base]);assert.ok(r.state.skillChoiceSuggestions.length>1);assert.ok(r.state.skillChoiceSuggestions.every(s=>s.startsWith(base+' (')));assert.ok(!r.state.skillChoiceSuggestions.includes(base));
 const accepted=run(r,'choose-skill',{name});assert.equal(accepted.session.events.at(-1).command.type,'choose-skill');assert.notEqual(accepted.state.stage,'book-step');assert.equal(accepted.state.character.skills[name],1);
});
test('generic level-zero and unrestricted awards preserve their valid base-skill choices',()=>{
 const state={stage:'skill-choice',character:{skills:{}},pendingChoice:{kind:'skill-choice',allowed:['Electronics'],mode:'set',value:0}};
 assert.ok(skillChoiceSuggestions(state).includes('Electronics'));
 state.pendingChoice={kind:'skill-choice',scope:'any',value:1};const suggestions=skillChoiceSuggestions(state);assert.ok(suggestions.includes('Admin'));assert.ok(suggestions.includes('Gun Combat (slug)'));assert.ok(!suggestions.includes('Gun Combat'));
});
