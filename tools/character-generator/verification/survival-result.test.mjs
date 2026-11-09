import test from 'node:test';
import assert from 'node:assert/strict';
import {project,exportSession,importSession} from '../engine/session.mjs';
import {survivalResult} from '../gui/survival-result.mjs';
import {laterTermVargrFixture,run} from './survival-result-fixtures.mjs';
test('Vargr career events still roll in terms three and four and remain readable',()=>{
 const results=laterTermVargrFixture();
 for(const [index,r] of results.entries()){
  const event=r.log.at(-1),saved=exportSession(r.session),log=structuredClone(r.log);
  assert.equal(r.state.character.terms,index);assert.equal(r.state.character.careers[0].terms,index);
  assert.equal(event.rolls.filter(roll=>roll.label==='Event table').length,1);
  assert.match(survivalResult(event,r.state).text,/Survival succeeded.*Career event rolled: (7|10|11)/);
  assert.deepEqual(r.log,log);assert.equal(exportSession(r.session),saved);
  assert.deepEqual(project(importSession(saved)).state,r.state);
 }
 assert.match(survivalResult(results[1].log.at(-1),results[1].state).text,/Career event rolled: 11.*Available advancement DM: \+4/);
 const romance=results[2];assert.equal(romance.log.at(-1).rolls.find(roll=>roll.label==='vargr.life-events (2D)').total,5);
 assert.match(survivalResult(romance.log.at(-1),romance.state).text,/A new romantic relationship begins/);
 assert.match(survivalResult(results[3].log.at(-1),results[3].state).text,/Career event rolled: 11.*Available advancement DM: \+4/);
});
test('successful advancement consumes the actual one-use event bonus',()=>{
 const r=laterTermVargrFixture()[1],next=run(r,'advancement');
 assert.match(next.log.at(-1).summary,/"modifier":4/);
 assert.equal(next.state.modifiers.filter(m=>m.target==='advancement'&&m.careerId==='vargr.agent').length,0);
});
test('failed survival identifies a mishap and does not claim a career event',()=>{
 const r=laterTermVargrFixture()[0],revision=r.session.events.findIndex(e=>e.command.type==='survival')+1;
 const failed=run(r,'gm-replay',{revision,rollIndex:0,values:[1,1],reason:'Failed survival regression'}),result=survivalResult(failed.log.at(-1),failed.state);
 assert.equal(result.status,'failure');assert.match(result.text,/Survival failed.*Mishap rolled: [1-6]/);assert.doesNotMatch(result.text,/Career event|advancement DM/);
});
test('missing or malformed checks do not invent an outcome; pending checks are explicit',()=>{
 for(const event of [null,{}, {summary:'Survival: {}.'},{summary:'Survival: {invalid}.'},{summary:'Other action'},{summary:'Survival: {"total":8,"target":6,"success":"true"}.'}])assert.equal(survivalResult(event),null);
 assert.equal(survivalResult({summary:'Survival check requires source resolution for the absent characteristic.'}).status,'pending');
});
