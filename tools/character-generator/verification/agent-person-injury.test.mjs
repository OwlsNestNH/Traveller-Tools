import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execute,project,exportSession,importSession} from '../engine/session.mjs';
import {injuryOutcome} from '../engine/core-procedures.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';

for(const role of ['Contact','Ally'])test('recorded '+role+' target binds by ID without changing the person or Traveller',()=>{
 const session=JSON.parse(readFileSync(new URL('./fixtures/agent-'+role.toLowerCase()+'-injury-pending.json',import.meta.url),'utf8')),before=project(session),targets=before.state.character.relationships.filter(p=>p.role===role),target=targets.at(-1);
 assert.ok(target);let r=execute(session,{type:'agent-person-injury-roll',payload:{targetId:target.id}});
 assert.equal(r.state.character.otherPersonInjuries.at(-1).targetId,target.id);
 if(r.state.character.otherPersonInjuries.at(-1).options.length)r=run(r,'agent-person-injury-loss',{index:0});
 r=run(r,'agent-person-injury-continue');
 for(const key of ['stats','injuries','cash','debt','medicalBills','relationships'])assert.deepEqual(r.state.character[key],before.state.character[key]);
 assert.deepEqual(r.session.events.slice(0,session.events.length),session.events);assert.deepEqual(project(r.session).state,r.state);
});

function pending(assignment,seed=''){
 let r=run(assignmentSetup('agent-person-'+assignment+seed),'skip-precareer');
 r=settleAssignment(force(r,'career',{id:'core.agent',assignment},[6,6]));
 r=force(r,'survival-check',{},[1,1]);
 r=force(r,'career-mishap',{},[5]);
 assert.equal(r.state.pending.effect.subject,'chosen-contact-ally-or-family');return r;
}
for(const assignment of ['corporate','law','intelligence'])test(assignment+' NPC injury preserves Traveller, prior history and replay',()=>{
 const original=pending(assignment),before=original.state.character;
 let r=run(original,'agent-person-injury-roll',{targetId:'family'});
 const injury=r.state.character.otherPersonInjuries.at(-1);
 assert.equal(injury.tableResult,Math.min(...injury.tableRolls));
 assert.deepEqual(injury.options,injuryOutcome({roll:injury.tableResult,severityDie:injury.severityDie}).effects[0]?.options??[]);
 assert.throws(()=>run(r,'agent-person-injury-roll',{targetId:'family'}));
 assert.throws(()=>run(r,'resolve-book',{confirmed:true}));
 if(injury.options.length){assert.throws(()=>run(r,'agent-person-injury-continue'));assert.throws(()=>run(r,'agent-person-injury-loss',{index:999}));r=run(r,'agent-person-injury-loss',{index:0});}
 r=execute(r.session,{type:'agent-person-injury-continue',payload:{}},{id:'complete-injury'});
 assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[r.state.active].forcedExit,true);
 for(const key of ['stats','injuries','cash','debt','medicalBills','relationships'])assert.deepEqual(r.state.character[key],before[key]);
 assert.deepEqual(r.session.events.slice(0,original.session.events.length),original.session.events);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 assert.deepEqual(execute(r.session,{type:'agent-person-injury-continue',payload:{}},{id:'complete-injury'}).session,r.session);
 assert.throws(()=>run(original,'agent-person-injury-roll',{targetId:'unknown'}));
 assert.throws(()=>run(original,'agent-person-injury-roll',{targetId:'family',person:'extra'}));
});
test('all six NPC injury outcomes use shared injury rules and explicit loss choices',()=>{
 const outcomes=new Map();
 for(let seed=0;seed<500&&outcomes.size<6;seed++){const candidate=run(pending('corporate',String(seed)),'agent-person-injury-roll',{targetId:'family'});outcomes.set(candidate.state.character.otherPersonInjuries.at(-1).tableResult,candidate);}
 assert.equal(outcomes.size,6,'Exercise all six naturally recorded table outcomes');
 for(let row=1;row<=6;row++){
  let r=outcomes.get(row);
  const record=r.state.character.otherPersonInjuries.at(-1);
  assert.equal(record.tableResult,row);assert.deepEqual(record.options,injuryOutcome({roll:row,severityDie:record.severityDie}).effects[0]?.options??[]);
  assert.equal(record.severityDie!==undefined,row<=2);
  if(record.options.length)r=run(r,'agent-person-injury-loss',{index:0});
  r=run(r,'agent-person-injury-continue');assert.equal(r.state.stage,'term-end');assert.deepEqual(project(r.session).state,r.state);
 }
});
