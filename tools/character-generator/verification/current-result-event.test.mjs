import test from 'node:test';
import assert from 'node:assert/strict';
import {currentResultEvent} from '../gui/current-result-event.mjs';
import {armyEntryAward,run,force} from './rank-award-fixtures.mjs';
import {settleAssignment} from './assignment-fixtures.mjs';
import {exportSession,importSession,project} from '../engine/session.mjs';

test('notes retain the accepted result, individual dice and award provenance after replay',()=>{
 let r=force(settleAssignment(armyEntryAward()),'survival-check',{},[6,6]);
 const original=r.log.at(-1),rng=r.state.rng;
 for(const text of ['A synthetic note','A revised synthetic note','']){
  r=run(r,'notes',{text});const raw=exportSession(r.session),before=structuredClone(r);
  assert.equal(currentResultEvent(r,r.session),r.log.find(e=>e.id===original.id));
  assert.deepEqual(currentResultEvent(r,r.session).rolls,original.rolls);
  assert.equal(r.state.rng,rng);assert.deepEqual(r,before);
  const session=importSession(raw),replayed=project(session);
  assert.deepEqual(currentResultEvent(replayed,session),original);
  assert.equal(exportSession(session),raw);
 }
});
test('the next creation action replaces the retained result',()=>{
 let r=force(settleAssignment(armyEntryAward()),'survival-check',{},[6,6]);
 r=run(r,'notes',{text:'Synthetic note'});r=run(r,'career-event');
 assert.equal(currentResultEvent(r,r.session),r.log.at(-1));
});
test('notes following restore cannot recover a result from the discarded branch',()=>{
 const before=settleAssignment(armyEntryAward());let r=force(before,'survival-check',{},[6,6]);
 const discarded=r.log.at(-1).id;r=run(r,'restore',{revision:before.revision});
 r=run(r,'notes',{text:'Restored synthetic branch'});
 assert.notEqual(currentResultEvent(r,r.session)?.id,discarded);
 assert.equal(currentResultEvent(r,r.session)?.id,before.log.at(-1).id);
});
test('only notes are transparent; other commands retain their own result',()=>{
 let r=armyEntryAward();r=run(r,'gm-mode',{enabled:false});
 assert.equal(currentResultEvent(r,r.session),r.log.at(-1));
 assert.equal(currentResultEvent({log:[]},{events:[]}),undefined);
});
