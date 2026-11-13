import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {failedQualificationModel,qualificationFallbackInformation,fallbackView} from '../gui/qualification-fallback.mjs';
import {qualificationFixture,run} from './qualification-fallback-fixtures.mjs';
const catalog=api({operation:'catalog'}),context={esc:String,button:(text,action,cls='',attrs='')=>'<button data-action="'+action+'" '+attrs+'>'+text+'</button>'};
test('ordinary draft remains available after first- and later-term failures across careers',()=>{
 for(const id of ['core.army','core.navy','core.agent','core.scholar'])for(const later of [false,true]){
  // The later fixture leaves Army, so use another career for its new application.
  if(later&&id==='core.army')continue;
  const r=qualificationFixture(id,{later}),before=exportSession(r.session),model=failedQualificationModel(r.state,catalog);
  assert.equal(model.fallback,true);assert.equal(model.career.id,id);assert.equal(r.state.fallbackOptions.draft.available,true);
  assert.match(fallbackView(r.state,context),/Roll the Core draft/);assert.equal(exportSession(r.session),before);
  const second=api({operation:'command',session:r.session,command:{type:'career',payload:{id:'core.navy',assignment:'line'}}});assert.equal(second.ok,false);assert.equal(exportSession(r.session),before);
  const draft=run(r,'fallback',{draft:true},{id:'one-draft'});assert.equal(draft.state.draftUsed,true);assert.equal(draft.state.character.careers.at(-1).drafted,true);assert.equal(draft.log.at(-1).rolls.filter(d=>d.label==='Draft').length,1);
  const repeat=api({operation:'command',session:draft.session,command:{type:'fallback',payload:{draft:true}},id:'one-draft'});assert.equal(repeat.ok,true);assert.equal(repeat.revision,draft.revision);assert.equal(exportSession(repeat.session),exportSession(draft.session));
  const loaded=api({operation:'import',raw:exportSession(draft.session)});assert.equal(loaded.ok,true);assert.deepEqual(loaded.state.character,draft.state.character);
 }
});
test('used draft remains unavailable and Drifter stays a valid alternative',()=>{
 const r=qualificationFixture('core.navy',{used:true}),before=exportSession(r.session);assert.equal(r.state.fallbackOptions.draft.available,false);
 const rejected=api({operation:'command',session:r.session,command:{type:'fallback',payload:{draft:true}}});assert.equal(rejected.ok,false);assert.equal(exportSession(r.session),before);
 assert.match(fallbackView(r.state,context),/already been used/);assert.match(fallbackView(r.state,context),/data-action="draft" disabled/);
 const alternative=run(r,'fallback',{draft:false});assert.equal(alternative.state.character.careers.at(-1).id,'core.drifter');assert.equal(alternative.log.at(-1).rolls.some(d=>d.label==='Draft'),false);
});
test('unavailable careers are not failed qualifications and forced drafts keep their existing route',()=>{
 const r=qualificationFixture();assert.equal(failedQualificationModel({...r.state,stage:'career'},catalog),null);
 const forced={...r.state,fallbackOptions:{forced:true,normal:{name:'Ordinary career choice',available:false,reason:'Required event'},draft:{name:'Roll the required Core draft',available:true,reason:''}}};assert.equal(failedQualificationModel(forced,catalog),null);assert.match(fallbackView(forced,context),/Drifter event requires/);assert.match(fallbackView(forced,context),/data-action="draft" >Roll the required/);
 const native={...r.state,fallbackOptions:{normal:{name:'Enter Outcast',available:true,reason:''},draft:{name:'Apply to the Core draft',available:false,reason:'This source fallback does not authorize a new Core draft.'}}};assert.match(fallbackView(native,context),/Enter Outcast/);assert.match(fallbackView(native,context),/data-action="draft" disabled/);
});
test('notes and reload retain the failed context, original audit and projected choices',()=>{
 const r=qualificationFixture(),noted=run(r,'notes',{text:'Synthetic notes after failed qualification'}),raw=exportSession(noted.session),loaded=api({operation:'import',raw});
 assert.equal(loaded.ok,true);assert.equal(exportSession(loaded.session),raw);assert.deepEqual(loaded.state.failedQualificationContext,r.state.failedQualificationContext);assert.deepEqual(loaded.state.fallbackOptions,r.state.fallbackOptions);assert.equal(loaded.state.stage,'failed-entry');assert.equal(failedQualificationModel(loaded.state,catalog).fallback,true);assert.deepEqual(loaded.log.slice(0,r.log.length),r.log);
 assert.equal(qualificationFallbackInformation(r.state).page,'18–20');assert.match(qualificationFallbackInformation(r.state).summary,/not limited to the first term/);
});

test('failed retained assignment changes keep the assignment and never open the draft screen',async()=>{
 const {buildAssignmentFixture,force,run}=await import('./assignment-fixtures.mjs');
 for(const careerId of ['core.army','core.marine','core.navy','core.noble','core.rogue','core.scholar','core.scout']){
  let r=buildAssignmentFixture({careerId});if(careerId==='core.noble')r=run(r,'gm-override',{field:'stat.SOC',value:9,reason:'Synthetic non-automatic Noble reassignment qualification'});
  const previous=structuredClone(r.state.character.careers.at(-1)),assignment=r.state.assignmentChangeOptions.find(o=>o.available).id;
  r=force(r,'change-assignment',{assignment},[1,1]);assert.equal(r.state.stage,'training');assert.equal(r.state.character.careers.at(-1).assignment,previous.assignment);assert.equal(r.state.character.careers.at(-1).rank,previous.rank);assert.equal(r.state.failedQualification,false);assert.equal(failedQualificationModel(r.state,catalog),null);assert.equal(r.state.fallbackOptions.draft.available,false);
 }
});
test('failed fresh-career assignment changes preserve the RAW draft/Drifter alternatives',async()=>{
 const {buildAssignmentFixture,force,run,settleAssignment}=await import('./assignment-fixtures.mjs');
 for(const careerId of ['core.agent','core.citizen','core.entertainer','core.merchant']){
  let r=buildAssignmentFixture({careerId}),assignment=r.state.assignmentChangeOptions.find(o=>o.available).id;r=run(r,'change-assignment',{assignment});
  while(r.state.stage==='benefits')r=settleAssignment(force(r,'benefit',{cash:false},[2]));assert.equal(r.state.stage,'assignment-entry');
  r=force(r,'qualify-assignment',{},[1,1]);assert.equal(r.state.stage,'failed-entry');assert.equal(r.state.fallbackOptions.draft.available,true);assert.equal(failedQualificationModel(r.state,catalog).fallback,true);assert.match(fallbackView(r.state,context),/Roll the Core draft/);
 }
});
