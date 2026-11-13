import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
import {educationReady,educationSetup,forceEducation,command} from './education-result-fixtures.mjs';
const event=row=>forceEducation(educationReady(),'education-event',{},[Math.max(1,row-6),Math.min(6,row-1)]);
const ack=r=>command(r,'acknowledge-education-event',{pendingId:r.state.educationEventResult.id});
test('pre-change .29/.30 education states and logs remain exact for every row',()=>{
 for(const fixture of JSON.parse(readFileSync(new URL('./fixtures/education-checkpoint-legacy.json',import.meta.url)))){
  const p=project(fixture.session);assert.equal(createHash('sha256').update(JSON.stringify({state:p.state,log:p.log})).digest('hex'),fixture.hash,fixture.session.rulesRevision+' row '+fixture.row);
  assert.equal(p.state.educationEventCheckpoints,undefined);assert.equal(p.educationEventView,undefined);
 }
});
test('covered deterministic results pause after awards; acknowledgement never rolls or awards',()=>{
 for(const row of [5,12]){const r=event(row);assert.equal(r.state.stage,'education-event-result');assert.equal(r.educationEventView.status,'resolved');assert.equal(r.educationEventView.row,row);
  const raw=exportSession(r.session);assert.equal(exportSession(importSession(raw)),raw);assert.deepEqual(project(r.session).educationEventView,r.educationEventView);
  assert.throws(()=>execute(r.session,{type:'acknowledge-education-event',payload:{pendingId:'stale'}}));assert.throws(()=>execute(r.session,{type:'acknowledge-education-event',payload:{pendingId:r.state.educationEventResult.id,roll:12}}));
  const after=ack(r);assert.equal(after.state.stage,'education-graduation');assert.equal(after.state.rng,r.state.rng);assert.deepEqual(after.state.character,r.state.character);assert.equal(after.educationEventView,undefined);assert.throws(()=>execute(after.session,{type:'acknowledge-education-event',payload:{pendingId:r.state.educationEventResult.id}}));
 }
});
test('existing PSI and learned-skill choices remain explicit, then pause on their resolved result',()=>{
 for(const index of [0,1]){const r=event(2);assert.equal(r.state.stage,'effect-choice');assert.equal(r.educationEventView.status,'pending');const after=command(r,'choose-effect',{index});assert.equal(after.state.stage,'education-event-result');assert.equal(after.educationEventView.childRolls.length,index===0?1:0);assert.equal(ack(after).state.rng,after.state.rng);}
 const r=event(10);assert.equal(r.state.stage,'education-check');const after=command(r,'education-check',{name:r.state.educationCheckSkills[0]});assert.equal(after.state.stage,'education-event-result');assert.equal(after.educationEventView.childRolls.length,1);assert.equal(after.educationEventView.childRolls[0].check.target,9);assert.equal(after.educationEventView.childRolls[0].check.skill,r.state.educationCheckSkills[0]);assert.equal(ack(after).state.rng,after.state.rng);
});
test('departure and hobby expose covered context while reserved revisions remain rejected',()=>{
 for(const row of [3,9])assert.equal(event(row).educationEventView.row,row);
 for(const suffix of ['26','28'])assert.throws(()=>project({...createSession('reserved'),rulesRevision:'character-preview-2026-11-09.'+suffix}));
});
test('direct University rolls stop at their own strict one-roll checkpoint',()=>{
 for(const row of [4,6,8,11])for(const values of row===6?[[1],[6]]:[[1,1],[4,4],[6,6]]){
  let r=event(row);assert.equal(r.state.stage,'education-event-roll');assert.equal(r.educationEventView.status,'pending');assert.equal(r.educationEventView.roll.row,row);const id=r.state.pendingEducationEventRoll.id;
  assert.throws(()=>execute(r.session,{type:'roll-education-event-step',payload:{pendingId:id,values}}));assert.throws(()=>execute(r.session,{type:'roll-education-event-step',payload:{pendingId:'old'}}));
  r=forceEducation(r,'roll-education-event-step',{pendingId:id},values);
  if(r.state.stage==='effect-choice'){
   r=command(r,'choose-effect',{index:1});assert.equal(r.state.stage,'education-event-roll');const draftId=r.state.pendingEducationEventRoll.id;assert.notEqual(draftId,id);
   r=forceEducation(r,'roll-education-event-step',{pendingId:draftId},[4]);assert.equal(r.state.forcedCareer.id??r.state.forcedCareer,'core.marine');
  }
  assert.equal(r.state.stage,'education-event-result');assert.ok(r.educationEventView.childRolls.length>=1);const next=ack(r);assert.equal(next.state.rng,r.state.rng);assert.deepEqual(next.state.character,r.state.character);assert.equal(next.state.stage,r.state.educationEventResult.nextStage);
 }
});
test('event-forced departure retains pending ageing source step under result acknowledgement',()=>{
 let r=educationReady();r=command(r,'gm-override',{field:'age',value:34,reason:'Synthetic ageing boundary'});r=forceEducation(r,'education-event',{},[2,2]);r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[1,1]);
 assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.pending.kind,'education-ageing');assert.equal(r.state.character.educations[0].graduation.attempted,false);const next=ack(r);assert.equal(next.state.stage,'book-step');assert.deepEqual(next.state.pending,r.state.pending);assert.equal(next.state.rng,r.state.rng);
});
test('split dice preserve legacy final character and RNG for natural direct event branches',()=>{
 const seen=new Set();
 for(let i=0;i<80;i++){
  let ready=forceEducation(educationSetup('parity-'+i),'precareer',{id:'core.university'},[6,6]);ready=command(ready,'education-skill',{name:'Admin'});ready=command(ready,'education-skill',{name:'Medic'});const modernSession=ready.session,legacySession={...structuredClone(modernSession),rulesRevision:'character-preview-2026-11-09.30'};
  let legacy=command({session:legacySession},'education-event'),modern=command({session:modernSession},'education-event');const row=modern.state.character.educations[0].event;if(![4,6,8,11].includes(row))continue;seen.add(row);
  while(modern.state.stage==='education-event-roll'||modern.state.stage==='effect-choice'){
   if(modern.state.stage==='education-event-roll')modern=command(modern,'roll-education-event-step',{pendingId:modern.state.pendingEducationEventRoll.id});
   else {legacy=command(legacy,'choose-effect',{index:1});modern=command(modern,'choose-effect',{index:1});}
  }
  modern=ack(modern);assert.deepEqual(modern.state.character,legacy.state.character,'row '+row);assert.equal(modern.state.rng,legacy.state.rng);assert.deepEqual(modern.state.forcedCareer,legacy.state.forcedCareer);assert.equal(modern.state.stage,legacy.state.stage);
 }
 assert.deepEqual([...seen].sort((a,b)=>a-b),[4,6,8,11]);
});
test('projection uses exact recorded dice and per-action applied changes, never GM edits',()=>{
 let r=event(2);assert.deepEqual(r.educationEventView.eventDice,[1,1]);assert.equal(r.educationEventView.eventTotal,2);assert.deepEqual(r.educationEventView.appliedChanges,[]);assert.ok(r.educationEventView.pendingChoice);
 r=command(r,'gm-override',{field:'stat.EDU',value:12,reason:'Synthetic independent GM change'});r=command(r,'choose-effect',{index:0});assert.equal(r.educationEventView.childRolls.length,1);assert.equal(r.educationEventView.childRolls[0].kept.length,2);assert.equal(r.educationEventView.appliedChanges.some(a=>a.changes.some(c=>c.path==='stats.EDU')),false);assert.equal(r.educationEventView.pendingChoice,null);
 const before=exportSession(r.session);project(r.session);assert.equal(exportSession(r.session),before);
});
test('restore returns exact pending identity without rerolling or replaying awards',()=>{
 let r=event(6);const revision=r.revision,pending=structuredClone(r.state.pendingEducationEventRoll);r=command(r,'roll-education-event-step',{pendingId:pending.id});const rng=r.state.rng;r=command(r,'restore',{revision});assert.equal(r.state.stage,'education-event-roll');assert.deepEqual(r.state.pendingEducationEventRoll,pending);assert.equal(r.state.rng,rng);assert.deepEqual(r.educationEventView.eventDice,[1,5]);assert.equal(r.educationEventView.childRolls.length,0);
});
test('recorded PSI zero and positive are reused without a potential roll',()=>{
 for(const psi of [0,8]){let r=event(2);r=command(r,'gm-override',{field:'stat.PSI',value:psi,reason:'Synthetic recorded potential'});const rng=r.state.rng;r=command(r,'choose-effect',{index:0});assert.equal(r.state.character.stats.PSI,psi);assert.equal(r.state.character.psionEntryPermission,true);assert.equal(r.state.rng,rng);assert.deepEqual(r.educationEventView.childRolls,[]);assert.equal(Object.hasOwn(r.educationEventView,'rolls'),false);}
});
test('row4 special consequence uses modified total2, not natural snake eyes',()=>{
 let r=educationReady();r=command(r,'gm-override',{field:'stat.SOC',value:0,reason:'Synthetic modified total boundary'});r=forceEducation(r,'education-event',{},[2,2]);assert.equal(r.educationEventView.roll.modifier,-3);r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[2,3]);assert.equal(r.state.forcedCareer,'core.prisoner');assert.equal(r.state.character.educations[0].graduation.attempted,false);assert.equal(r.state.educationEventResult.nextStage,'career');
});
test('row8 success grants both Ally and Enemy while failure grants neither',()=>{
 for(const values of [[4,4],[1,1]]){let r=event(8);const before=r.state.character.relationships.length;r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},values);assert.deepEqual(r.state.character.relationships.slice(before).map(x=>x.role),values[0]===4?['Ally','Enemy']:[]);}
});
test('row11 Flee chooses Drifter without any additional dice',()=>{
 let r=event(11);r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[1,1]);assert.equal(r.state.stage,'effect-choice');const rng=r.state.rng;r=command(r,'choose-effect',{index:0});assert.equal(r.state.rng,rng);assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.forcedCareer,'core.drifter');assert.equal(r.state.stage,'education-event-result');assert.equal(r.educationEventView.childRolls.length,1);
});
test('capped Carouse remains source-pending and resolves once before acknowledgement',()=>{
 let r=educationReady();for(const stat of ['INT','EDU'])r=command(r,'gm-override',{field:'stat.'+stat,value:0,reason:'Synthetic cap boundary'});r=forceEducation(r,'education-event',{},[2,3]);assert.equal(r.state.stage,'book-step');assert.equal(r.state.character.skills.Carouse,undefined);assert.equal(r.educationEventView.status,'pending');const rng=r.state.rng;
 r=command(r,'resolve-book',{confirmed:true,awardReviewConfirmed:true,note:'Synthetic referee resolution without exceeding the skill cap',effects:[]});assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.character.skills.Carouse,undefined);assert.equal(r.state.rng,rng);const next=ack(r);assert.equal(next.state.stage,'education-graduation');assert.equal(next.state.rng,rng);assert.deepEqual(next.state.character,r.state.character);
});
