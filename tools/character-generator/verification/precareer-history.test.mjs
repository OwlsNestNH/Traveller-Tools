import test from 'node:test';
import assert from 'node:assert/strict';
import {execute,exportSession} from '../engine/session.mjs';
import {previousStepRecord} from '../gui/precareer-popup.mjs';
import {assignmentSetup} from './assignment-fixtures.mjs';
import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';

function synthetic(actions){
 const session={events:actions.map(({type,payload={}})=>({command:{type,payload}}))};
 const projection={log:actions.map(({type,summary=type,rolls=[]},index)=>({number:index+1,type,summary,rolls}))};
 return {projection,session};
}
const previous=fixture=>previousStepRecord(fixture.projection??fixture,fixture.session);
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('replayed native Aslan Rite remains the previous completed step, not background skills',()=>{
 const r=buildAslanOriginFixture({stage:'precareer'}),saved=exportSession(r.session),record=previous(r);
 assert.equal(r.state.stage,'precareer');
 assert.equal(r.log.at(-1).type,'acknowledge-aslan-rite');
 assert.equal(record.event.number,r.revision-1);
 assert.equal(record.event.type,'gm-replay');
 assert.equal(record.command.type,'roll-aslan-rite');
 assert.match(record.event.summary,/Rite of Passage:.*5.*RITE 6/);
 assert.equal(r.state.character.stats.RITE,6);
 assert.equal(exportSession(r.session),saved);
});

test('opening and cancelling each Companion admission keeps background as the previous step',()=>{
 const base=assignmentSetup('precareer-history-companion-cancel');
 for(const suffix of ['colonial','psionic','merchant','hard-knocks','spacer']){
  let r=execute(base.session,{type:'precareer',payload:{id:'companion.'+suffix}});
  assert.equal(r.state.stage,'companion-admission');
  assert.equal(previous(r).command.type,'background','Opening admission is navigation, not a completed generation step');
  r=execute(r.session,{type:'cancel-education',payload:{}});
  const record=previous(r);
  assert.equal(r.state.stage,'precareer');
  assert.equal(record.event.number,base.revision);
  assert.deepEqual(record.command,base.session.events.at(-1).command);
  assert.deepEqual(r.state.educationAttemptTerms,base.state.educationAttemptTerms);
  assert.equal(r.state.character.terms,base.state.character.terms);
 }
});

test('bookkeeping after background does not replace the previous generation step',()=>{
 const r=synthetic([
  {type:'background',payload:{skills:['Admin','Medic']}},
  ...['notes','connection','configure','open-precareer','skip-precareer','cancel-education','cancel-career-transfer','gm-mode','gm-override','gm-physical-dice'].map(type=>({type}))
 ]);
 const record=previous(r);
 assert.equal(record.event.number,1);
 assert.deepEqual(record.command,{type:'background',payload:{skills:['Admin','Medic']}});
});

test('nested dice replacements resolve the underlying step while retaining the latest recorded result',()=>{
 const r=synthetic([
  {type:'background',payload:{skills:['Admin']}},
  {type:'roll-aslan-rite',summary:'Original Rite result'},
  {type:'gm-replay',payload:{revision:2},summary:'First replacement'},
  {type:'notes'},
  {type:'gm-replay',payload:{revision:3},summary:'Latest replacement',rolls:[{label:'Rite',values:[2,3],total:5}]},
  {type:'connection'}
 ]);
 const record=previous(r);
 assert.equal(record.command.type,'roll-aslan-rite');
 assert.equal(record.event.number,5);
 assert.equal(record.event.summary,'Latest replacement');
 assert.deepEqual(record.event.rolls,[{label:'Rite',values:[2,3],total:5}]);
});

test('restored branches exclude discarded steps and a restore can restore an earlier restore',()=>{
 const actions=[
  {type:'background',payload:{skills:['Admin']},summary:'Original background'},
  {type:'notes'},
  {type:'roll-aslan-rite',summary:'Discarded Rite'},
  {type:'restore',payload:{revision:1}},
  {type:'gm-override'},
  {type:'background',payload:{skills:['Medic']},summary:'Alternate background'},
  {type:'restore',payload:{revision:4}},
  {type:'restore',payload:{revision:6}}
 ];
 assert.equal(previous(synthetic(actions.slice(0,4))).event.number,1);
 assert.equal(previous(synthetic(actions.slice(0,6))).event.number,6);
 assert.equal(previous(synthetic(actions.slice(0,7))).event.number,1);
 assert.equal(previous(synthetic(actions)).event.number,6);
 assert.deepEqual(previous(synthetic(actions)).command.payload.skills,['Medic']);
});

test('Core education entry and completed Companion admission are not discarded as menu navigation',()=>{
 for(const action of [{type:'precareer',payload:{id:'core.university'}},{type:'companion-entry',payload:{size:0}}]){
  const r=synthetic([{type:'background',payload:{skills:['Admin']}},action,{type:'open-precareer'}]);
  assert.equal(previous(r).event.number,2);
  assert.deepEqual(previous(r).command,action);
 }
});

test('empty, bookkeeping-only and zero-revision-restored histories have no previous step',()=>{
 assert.equal(previous(synthetic([])),null);
 assert.equal(previous(synthetic([{type:'notes'},{type:'configure'},{type:'gm-mode'}])),null);
 assert.equal(previous(synthetic([{type:'background',payload:{skills:['Admin']}},{type:'restore',payload:{revision:0}}])),null);
});

test('previous-step review does not mutate frozen commands, log order, dice or branch evidence',()=>{
 const r=freeze(synthetic([
  {type:'background',payload:{skills:['Admin']}},
  {type:'roll-aslan-rite',rolls:[{label:'Rite',values:[1,2],total:3}]},
  {type:'gm-replay',payload:{revision:2},rolls:[{label:'Rite',values:[2,3],total:5}]},
  {type:'notes'}
 ])),before=JSON.stringify(r);
 for(let i=0;i<3;i++){
  const record=previous(r);
  assert.equal(record.event,r.projection.log[2]);
  assert.equal(record.command,r.session.events[1].command);
 }
 assert.equal(JSON.stringify(r),before);
});

 test('Rite acknowledgement keeps the actual credit or referee consequence as previous result',()=>{
 for(const type of ['record-aslan-rite-equipment','record-aslan-event-outcome']){
 const r=synthetic([{type:'roll-aslan-rite'},{type},{type:'acknowledge-aslan-rite'}]);
 assert.equal(previous(r).command.type,type);
 assert.equal(previous(r).event.number,2);
 }
 });
