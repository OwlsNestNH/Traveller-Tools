import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {createServer} from '../server.mjs';
import {sourceTrainingFixture,run} from './source-training-fixtures.mjs';
import {rejected} from './core-life-event-fixtures.mjs';
const replay=r=>assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));
function finish(r){while(r.state.stage==='skill-choice'){const base=r.state.pendingChoice.allowed[0];r=run(r,'choose-skill',{name:({Language:'Language (Vilani)',Electronics:'Electronics (sensors)',Gunner:'Gunner (turret)',Pilot:'Pilot (spacecraft)',Engineer:'Engineer (power)',Science:'Science (physics)','Gun Combat':'Gun Combat (slug)',Flyer:'Flyer (grav)',Melee:'Melee (blade)',Athletics:'Athletics (dexterity)'})[base]??base});}return r;}
test('Navy responsible branch offers qualified tables, rolls exactly once and retains ejection',()=>{
 for(const advanced of [false,true]){
  let r=sourceTrainingFixture({advanced});r=run(r,'choose-effect',{index:0});replay(r);
  const labels=r.state.pendingChoice.options.map(o=>o.label);assert.equal(labels.includes('Advanced education'),advanced);assert.equal(labels.includes('Officer skills'),false);
  rejected(r,'choose-effect',{index:labels.length});rejected(r,'training',{table:'officer'});
  r=run(r,'choose-effect',{index:0});assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.state.character.sourceTraining.length,1);assert.ok(r.log.at(-1).changes.some(c=>c.path==='sourceTraining.0.table'));assert.equal(r.state.character.sourceTraining[0].status,'completed');assert.equal(r.state.character.careers[0].forcedExit,true);assert.equal(r.state.stage,'term-end');replay(r);rejected(r,'choose-effect',{index:0});
 }
});
test('Navy assignment roll uses the actual assignment and preserves speciality choices',()=>{
 for(const assignment of ['crew','technical','flight']){
  let r=sourceTrainingFixture({assignment});r=run(r,'choose-effect',{index:0});r=run(r,'choose-effect',{index:2});replay(r);const award=r.state.character.sourceTraining[0];assert.equal(award.assignment,assignment);assert.equal(award.table,'assignment');assert.equal(award.source.page,37);r=finish(r);assert.equal(r.state.stage,'term-end');assert.equal(r.state.character.sourceTraining[0].status,'completed');replay(r);
 }
});
test('Navy not responsible branch keeps benefit and never grants training',()=>{let r=sourceTrainingFixture();r=run(r,'choose-effect',{index:1});assert.equal(r.state.character.sourceTraining,undefined);assert.equal(r.state.character.careers[0].mishap,false);assert.equal(r.state.character.careers[0].forcedExit,true);assert.equal(r.state.character.relationships.at(-1).role,'Enemy');replay(r);});
test('Citizen Event 4 ignores EDU only for its single roll, resumes advancement and replays pending choices',()=>{
 let r=sourceTrainingFixture({navy:false});assert.equal(r.state.character.stats.EDU,7);assert.equal(r.state.character.sourceTraining[0].table,'advanced');assert.equal(r.state.character.sourceTraining[0].source.page,191);assert.equal(r.log.at(-1).rolls.length,3);replay(r);rejected(r,'training',{table:'advanced'});r=finish(r);assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.sourceTraining[0].status,'completed');replay(r);
 r=run(r,'advancement');assert.equal(r.state.stage,'training');assert.equal(r.state.trainingOptions.some(t=>t.id==='advanced'),false);rejected(r,'training',{table:'advanced'});assert.equal(r.state.character.stats.EDU,7);
});
test('HTTP route preserves atomic rejection and sourced one-roll continuation',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{
 const r=run(sourceTrainingFixture(),'choose-effect',{index:0}),original=exportSession(r.session);const send=async index=>(await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'command',session:r.session,command:{type:'choose-effect',payload:{index}}})})).json();assert.equal((await send(3)).ok,false);assert.equal(exportSession(r.session),original);const good=await send(0);assert.equal(good.ok,true);assert.equal(good.state.character.sourceTraining[0].status,'completed');replay(good);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Navy event-generated mishap retains its protected career continuation',()=>{
 let r=sourceTrainingFixture({advanced:true,nestedMishap:true});r=run(r,'choose-effect',{index:0});replay(r);r=run(r,'choose-effect',{index:0});assert.equal(r.state.character.careers[0].forcedExit,false);assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.sourceTraining.length,1);replay(r);
});
