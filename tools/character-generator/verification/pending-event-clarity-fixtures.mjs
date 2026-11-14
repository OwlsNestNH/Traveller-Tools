import assert from 'node:assert/strict';
import {createSession} from '../engine/session.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
const cache=new Map();
export function pendingEventFixture(career='companion.believer',assignment='missionary',row=6,mishap=false){
 const key=[career,assignment,row,mishap].join('|');if(cache.has(key))return structuredClone(cache.get(key));
 for(let seed=0;seed<80;seed++){
  let r=run(assignmentSetup('event-clarity-'+key+'-'+seed),'skip-precareer');
  r=run(r,'career',{id:career,assignment});if(r.log.at(-1).rolls.length)r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[6,6],reason:'Synthetic successful entry'});r=settleAssignment(r);
  assert.equal(r.state.stage,'survival');r=force(r,'survival-check',{},mishap?[1,1]:[6,6]);r=run(r,mishap?'career-mishap':'career-event');
  if(r.log.at(-1).rolls[0].total===row){cache.set(key,r);return structuredClone(r);}
 }
 throw Error('No bounded synthetic natural event fixture for '+key);
}

export function legacyAezorghMishapFixture(){
 const key='legacy-aezorgh';if(cache.has(key))return structuredClone(cache.get(key));
 for(let seed=0;seed<40;seed++){
  let r={session:{...createSession('legacy-aezorgh-mishap-'+seed),rulesRevision:'character-preview-2026-11-13.34'}};
  r=run(r,'setup',{species:'aezorgh'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
  for(let index=0;index<6;index++)r=run(r,'gm-override',{field:'pool',index,value:8,reason:'Synthetic legacy presentation fixture'});
  r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
  r=settleAssignment(force(r,'career',{id:'core.army',assignment:'support'},[6,6]));r=force(r,'survival-check',{},[1,1]);r=run(r,'career-mishap');
  if(r.log.at(-1).rolls[0].total===6){cache.set(key,r);return structuredClone(r);}
 }throw Error('No bounded synthetic legacy mishap');
}

export function fixedInjuryLossFixture(){let r=pendingEventFixture('core.army','support',6,true);r=force(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id},[4]);assert.equal(r.state.stage,'injury-loss');return r;}
