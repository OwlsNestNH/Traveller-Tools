import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {sourceCheckFixture,run} from './source-check-fixtures.mjs';
import {rejected} from './core-life-event-fixtures.mjs';
const replay=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
const choose=(r,index,success)=>{r=run(r,'choose-effect',{index});return run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:success?[6,6]:[1,1],reason:'Exercise source check outcome'});};
test('Citizen Event3 awards and checks exactly the selected skill, with one next-check modifier',()=>{
 for(const [index,name] of ['Advocate','Persuade','Explosives','Streetwise'].entries())for(const success of [false,true]){
  const before=sourceCheckFixture();replay(before);const r=choose(before,index,success);
  assert.equal(r.state.character.skills[name],1);assert.equal(r.state.stage,'advancement');
  const m=r.state.modifiers.at(-1);assert.equal(m.target,success?'advancement':'survival');assert.equal(m.value,success?2:-2);assert.equal(m.scope,'next');assert.equal(m.careerId,'core.citizen');replay(r);
  if(success){const next=run(r,'advancement');assert.ok(!next.state.modifiers.some(x=>x.target==='advancement'));}
 }
});
test('Navy Mishap3 offers only its assignment checks, always exits, retains the failed-survival term only on success',()=>{
 const assignments={crew:['Electronics (sensors)','Gunner'],technical:['Mechanic','Vacc Suit'],flight:['Pilot (small craft)','Pilot (spacecraft)','Tactics (naval)']};
 for(const [assignment,names] of Object.entries(assignments))for(let index=0;index<names.length;index++)for(const success of [false,true]){
  const before=sourceCheckFixture({career:'core.navy',assignment});assert.deepEqual(before.state.pendingChoice.options.map(x=>x.label),names);replay(before);
  const r=choose(before,index,success),c=r.state.character.careers[0];assert.equal(c.forcedExit,true);assert.equal(c.successfulTerms,success?1:0);assert.equal(c.benefitRolls,success?1:0);assert.equal(c.terms,1);assert.equal(r.state.stage,'term-end');replay(r);
 }
});
test('Vargr Intermediary Mishap5 explicitly chooses END or Melee, success stays and failure resolves an injury',()=>{
 for(let index=0;index<2;index++)for(const success of [false,true]){
  const before=sourceCheckFixture({career:'vargr.intermediary',assignment:'arbitrator'});assert.deepEqual(before.state.pendingChoice.options.map(x=>x.label),['END','Melee']);replay(before);
  const r=choose(before,index,success);assert.equal(r.state.character.careers[0].forcedExit,!success);
  assert.equal(r.log.at(-1).rolls.some(x=>x.label==='Injury table'),!success);
  if(success){assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.careers[0].benefitRolls,0);}
  replay(r);
 }
});
test('invalid source choices are atomic and completed choices cannot be repeated',()=>{
 for(const args of [{},{career:'core.navy',assignment:'flight'},{career:'vargr.intermediary',assignment:'arbitrator'}]){
  const r=sourceCheckFixture(args);for(const index of [-1,99,0.5,'0'])rejected(r,'choose-effect',{index});rejected(r,'resolve-book',{confirmed:true,note:'Skip source check',effects:[]});
  const done=choose(r,0,true);rejected(done,'choose-effect',{index:0});replay(done);
 }
});
test('HTTP transports each pending source choice and enforces atomic invalid indices',async()=>{
 const {createServer}=await import('../server.mjs');const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{for(const args of [{},{career:'core.navy',assignment:'technical'},{career:'vargr.intermediary',assignment:'arbitrator'}]){
  const r=sourceCheckFixture(args),saved=exportSession(r.session),call=async index=>(await (await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',body:JSON.stringify({operation:'command',session:r.session,command:{type:'choose-effect',payload:{index}}})})).json());
  assert.equal((await call(99)).ok,false);assert.equal(exportSession(r.session),saved);const good=await call(0);assert.equal(good.ok,true);assert.deepEqual(good.state,run(r,'choose-effect',{index:0}).state);replay(good);
 }}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
