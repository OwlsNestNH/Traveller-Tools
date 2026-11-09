import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {EXPANSION_PACK,EXPANSION_TABLES} from '../engine/expansion-pack.mjs';
import {military,pack} from './alien-source-fixtures.mjs';
import {run,rejected} from './core-life-event-fixtures.mjs';
import {aslanEndTerm,aslanEvent,force,settle} from './aslan-officer-fixtures.mjs';
import {createServer} from '../server.mjs';
const replay=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
test('Aslan skirmish awards selected skill then rolls its check without source fallback',()=>{
 const names=['Melee (natural)','Gun Combat','Drive','Survival'];assert.deepEqual(EXPANSION_PACK['aslan.military'].events[5][0].options.map(x=>x.label),names);
 for(let index=0;index<4;index++)for(const success of [false,true]){
  let r=military();assert.equal(r.state.stage,'effect-choice');const before=structuredClone(r.state.character.skills);rejected(r,'choose-effect',{index:4});r=run(r,'choose-effect',{index});
  const name=names[index]==='Gun Combat'?'Gun Combat (slug)':names[index]==='Drive'?'Drive (wheel)':names[index];
  if(r.state.stage==='skill-choice')r=run(r,'choose-skill',{name});
  r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:success?[6,6]:[1,1],reason:'Source skirmish outcome'});
  assert.equal(r.state.character.skills[name],before[name]===undefined?1:Math.min(4,before[name]+1));assert.equal(r.state.stage,'advancement');assert.equal(r.state.modifiers.some(m=>m.target==='advancement'&&m.value===2),success);replay(r);
 }
});
test('Vargr pack leadership explicitly selects CHA or Leadership and records outcome without invented stat awards',()=>{
 assert.deepEqual(EXPANSION_TABLES['vargr.pack-events'].results[6][0].options.map(x=>x.label),['Leadership','CHA']);
 for(let index=0;index<2;index++){
  const initial=pack();assert.equal(initial.state.stage,'effect-choice');replay(initial);rejected(initial,'choose-effect',{index:2});rejected(initial,'resolve-book',{confirmed:true,note:'Skip challenge',effects:[]});
  for(const values of [[1,1],[6,6]]){
   let r=run(initial,'choose-effect',{index});r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values,reason:'Leadership source challenge dice'});
   const check=EXPANSION_TABLES['vargr.pack-events'].results[6][0].options[index].effects[0],natural=values.reduce((a,b)=>a+b,0);assert.equal(r.log.at(-1).rolls[0].total,natural);assert.equal(check.target,10);
   assert.deepEqual(r.state.character.stats,initial.state.character.stats);assert.equal(r.state.stage,'advancement');
   const won=r.state.character.historyNotes?.some(n=>n.includes('Became pack leader'))??false;assert.equal(r.state.character.relationships.length-initial.state.character.relationships.length,won?0:1);if(!won)assert.equal(r.state.character.relationships.at(-1).role,'Rival');
   if(values[0]===1)assert.equal(won,false);if(index===1&&values[0]===6)assert.equal(won,true);replay(r);
  }
 }
});

// Build the competing specialty through public, replayable career commands.
function competingSpecialty(index,name){
 let r=military();
 for(let term=0;term<2;term++){
  r=run(r,'choose-effect',{index});r=force(r,'choose-skill',{name},[1,1]);
  r=aslanEndTerm(r);r=run(r,'continue-career');r=settle(force(r,'training',{table:'personal'},[1]));r=aslanEvent(r,5);
 }
 assert.equal(r.state.character.skills[name],2);return r;
}
test('Aslan border skirmish checks the awarded specialty, not a stronger competing specialty',()=>{
 for(const [index,strong,selected] of [[2,'Drive (track)','Drive (wheel)'],[1,'Gun Combat (energy)','Gun Combat (archaic)']]){
  const base=run(competingSpecialty(index,strong),'choose-effect',{index});replay(base);
  for(const [values,success] of [[[3,3],false],[[3,4],true]]){
   let r=force(base,'choose-skill',{name:selected},values);
   assert.equal(r.state.character.skills[selected],1);assert.equal(r.state.stage,'advancement');
   assert.equal(r.state.modifiers.some(m=>m.target==='advancement'&&m.value===2),success);
   assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.log.at(-1).rolls[0].label,'Skill check');replay(r);
  }
 }
});
test('paused, skipped and over-cap awards preserve an explicit required check boundary',()=>{
 for(const overCap of [false,true]){
  let r=run(military(),'choose-effect',{index:2});
  if(overCap){
   for(const stat of ['INT','EDU'])r=run(r,'gm-override',{field:'stat.'+stat,value:0,reason:'Exercise the mandatory award cap boundary'});
   r=run(r,'choose-skill',{name:'Drive (wheel)'});
  }else r=run(r,'skill-award-source');
  assert.equal(r.state.pending.effect.kind,'skill-choice');assert.equal(r.state.effectsQueue[0].skillScope,'preceding-award');replay(r);
  if(!overCap){const retry=run(r,'retry-skill-choice'),completed=force(retry,'choose-skill',{name:'Drive (wheel)'},[3,3]);assert.equal(completed.state.stage,'advancement');replay(completed);}
  r=run(r,'resolve-book',{confirmed:true,note:'Award explicitly disposed of under the source rule.',effects:[]});
  assert.equal(r.state.stage,'book-step');assert.equal(r.state.pending.effect.kind,'check');
  assert.equal(r.state.pending.effect.awardedSkill,undefined);assert.match(r.state.pending.reason??r.state.pending.label??JSON.stringify(r.state.pending),/required skill check/);
  assert.equal(r.state.modifiers.some(m=>m.target==='advancement'&&m.value===2),false);assert.equal(r.log.at(-1).rolls.length,0);replay(r);
  r=run(r,'resolve-book',{confirmed:true,note:'Referee resolves the required check as a failure; no advancement modifier.',effects:[]});
  assert.equal(r.state.stage,'advancement');replay(r);
 }
});
test('selected-specialty checks and unresolved source boundaries match HTTP and direct replay',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const ready=run(competingSpecialty(2,'Drive (track)'),'choose-effect',{index:2});
  const paused=run(ready,'skill-award-source');
  for(const [r,type,payload] of [[ready,'choose-skill',{name:'Drive (wheel)'}],[paused,'resolve-book',{confirmed:true,note:'Referee disposes of award; check remains required.',effects:[]}]]){
   const request={operation:'command',session:r.session,command:{type,payload}};
   const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',body:JSON.stringify(request)});
   assert.equal(response.status,200);const actual=await response.json();assert.deepEqual(actual,api(request));replay(actual);
  }
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('manual concrete awards and capped fixed-name awards never infer or discard the required check',()=>{
 let manual=run(run(military(),'choose-effect',{index:2}),'skill-award-source');
 manual=run(manual,'resolve-book',{confirmed:true,note:'Referee applies the wheel award manually.',effects:[{kind:'skill',name:'Drive (wheel)',value:1}]});
 assert.equal(manual.state.character.skills['Drive (wheel)'],1);assert.equal(manual.state.pending.effect.kind,'check');replay(manual);
 let capped=military();for(const stat of ['INT','EDU'])capped=run(capped,'gm-override',{field:'stat.'+stat,value:0,reason:'Exercise fixed-name award cap'});
 capped=run(capped,'choose-effect',{index:3});assert.equal(capped.state.pending.effect.kind,'skill');
 capped=run(capped,'resolve-book',{confirmed:true,note:'No skill gain permitted at cap.',effects:[]});
 assert.equal(capped.state.pending.effect.kind,'check');assert.deepEqual(capped.state.pending.effect.source,{id:'aliens',page:31});
 assert.equal(capped.log.at(-1).rolls.length,0);replay(capped);
});
