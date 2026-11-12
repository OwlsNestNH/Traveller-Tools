import {acknowledgeEducationEvent} from './education-event-scenario.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {educationPotentialModel,educationPotentialView} from '../gui/precareer-popup.mjs';
import {educationReady,forceEducation,command} from './education-result-fixtures.mjs';
import {exportSession,project} from '../engine/session.mjs';
const fixture=()=>forceEducation(educationReady(),'education-event',{},[1,1]);
test('University potential choices preserve exact existing commands, both PSI variants and decline',()=>{
 for(const psi of [undefined,0,8])for(const index of [0,1]){
  const recorded=psi!==undefined;
  let r=fixture();if(recorded)r=command(r,'gm-override',{field:'stat.PSI',value:psi,reason:'Synthetic recorded PSI'});
  const raw=exportSession(r.session),before=structuredClone(r.state),model=educationPotentialModel(r.state),html=educationPotentialView(model);
  assert.equal(model.recorded,recorded);assert.match(html,recorded?/Use recorded PSI/:/Test potential · Roll 2D/);assert.equal((html.match(/data-action="choose-effect"/g)||[]).length,2);assert.match(html,/data-index="0"/);assert.match(html,/data-index="1"/);if(recorded)assert.doesNotMatch(html,/Roll 2D|admission-dice/);
  assert.equal(exportSession(r.session),raw);assert.deepEqual(r.state,before);assert.deepEqual(project(r.session).state,r.state);
  const resolved=command(r,'choose-effect',{index});assert.equal(resolved.state.stage,'education-event-result');const after=acknowledgeEducationEvent(resolved);assert.equal(after.state.stage,'education-graduation');assert.equal(educationPotentialModel(after.state),null);
  assert.equal(!!after.state.character.psionEntryPermission,index===0);if(recorded||index===1)assert.equal(after.state.rng,r.state.rng);else assert.notEqual(after.state.rng,r.state.rng);
  if(recorded)assert.equal(after.state.character.stats.PSI,psi);else assert.equal(Object.hasOwn(after.state.character.stats,'PSI'),index===0);
 }
});
test('potential presentation rejects unrelated, altered, Companion and source choices',()=>{
 const original=fixture().state;
 for(const mutate of [s=>s.stage='book-step',s=>s.character.educations[0].id='companion.merchant',s=>s.character.educations[0].event=12,s=>s.pendingChoice.source.page=46,s=>s.pendingChoice.options[0].effects.push({kind:'cash',value:100}),s=>s.pendingChoice.options.reverse(),s=>s.character.educations[0].entry.manual=true,s=>s.effectNext='career',s=>s.effectsQueue.push({kind:'cash',value:1}),s=>s.pending={kind:'source'},s=>s.character.psionicLoss={permanent:true},s=>s.character.educations[0].graduationAllowed=false,s=>s.pendingChoice.options[0].effects[0].source.page=18]){const s=structuredClone(original);mutate(s);assert.equal(educationPotentialModel(s),null);}
});

test('decline retains previously granted permission without changing PSI or RNG',()=>{
 let r=acknowledgeEducationEvent(command(fixture(),'choose-effect',{index:0}));r=forceEducation(r,'education-graduation',{},[4,4]);r=command(r,'acknowledge-education-result');r=command(r,'open-precareer');r=forceEducation(r,'precareer',{id:'core.university'},[6,6]);r=command(r,'education-skill',{name:'Admin'});r=command(r,'education-skill',{name:'Medic'});r=forceEducation(r,'education-event',{},[1,1]);
 assert.ok(educationPotentialModel(r.state));assert.equal(r.state.character.psionEntryPermission,true);const after=command(r,'choose-effect',{index:1});assert.equal(after.state.character.psionEntryPermission,true);assert.equal(after.state.rng,r.state.rng);assert.equal(after.state.character.stats.PSI,r.state.character.stats.PSI);
});
