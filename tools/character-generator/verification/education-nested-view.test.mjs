import test from 'node:test';
import assert from 'node:assert/strict';
import {educationNestedChoiceModel,educationNestedChoiceView} from '../gui/precareer-popup.mjs';
import {educationReady,forceEducation,command} from './education-result-fixtures.mjs';
import {exportSession,project} from '../engine/session.mjs';
const fixture=event=>forceEducation(educationReady(),'education-event',{},event===9?[4,5]:[5,5]);
test('verified nested decisions are pure views of their original pending commands',()=>{
 for(const event of [9,10]){const r=fixture(event),raw=exportSession(r.session),state=structuredClone(r.state),model=educationNestedChoiceModel(state),html=educationNestedChoiceView(model,state,{esc:String});assert.equal(model.event,event);assert.match(html,/<option value="">Choose a skill/);assert.match(html,/disabled/);assert.equal((html.match(/data-action=/g)||[]).length,1);assert.match(html,new RegExp('data-action="'+(event===9?'education-skill':'education-check')+'"'));assert.deepEqual(state,r.state);assert.equal(exportSession(r.session),raw);}
});
test('hobby stays a base-level award with no roll and never reduces existing levels',()=>{
 for(const legacy of [false,true])for(const name of ['Science','Medic']){let ready=educationReady();if(legacy){const session=structuredClone(ready.session);session.rulesRevision='character-preview-2026-11-09.30';ready={session,...project(session)};}const r=forceEducation(ready,'education-event',{},[4,5]),after=command(r,'education-skill',{name});assert.equal(after.state.stage,legacy?'education-graduation':'education-event-result');assert.equal(after.state.rng,r.state.rng);assert.equal(after.state.character.skills[name],name==='Medic'?1:0);if(!legacy){const continued=command(after,'acknowledge-education-event',{pendingId:after.state.educationEventResult.id});assert.equal(continued.state.stage,'education-graduation');assert.equal(continued.state.rng,after.state.rng);assert.deepEqual(continued.state.character,after.state.character);}else assert.equal(after.educationEventView,undefined);}
});
test('study challenge retains its exact9+ skill roll and success/failure effects',()=>{
 for(const values of [[1,1],[6,6]]){const r=fixture(10),after=forceEducation(r,'education-check',{name:'Medic'},values);assert.equal(after.state.stage,'education-event-result');const continued=command(after,'acknowledge-education-event',{pendingId:after.state.educationEventResult.id});assert.equal(continued.state.stage,'education-graduation');assert.equal(continued.state.rng,after.state.rng);assert.deepEqual(continued.state.character,after.state.character);assert.equal(after.state.character.skills.Medic,values[0]===6?2:1);assert.equal(after.log.at(-1).rolls.length,1);}
});
test('unrelated choices, species hobby acquisition and altered consequences fall back',()=>{
 for(const event of [9,10])for(const mutate of [s=>s.character.educations[0].id='companion.merchant',s=>s.character.educations[0].event=7,s=>s.pendingChoice.source.page=46,s=>s.effectNext='career',s=>s.effectsQueue.push({kind:'cash',value:1}),s=>s.pending={kind:'source'},s=>s.pendingChoice.value=2]){const state=structuredClone(fixture(event).state);mutate(state);assert.equal(educationNestedChoiceModel(state),null);}
 const state=fixture(9).state;state.character.species='aezorgh';assert.equal(educationNestedChoiceModel(state),null);
});
