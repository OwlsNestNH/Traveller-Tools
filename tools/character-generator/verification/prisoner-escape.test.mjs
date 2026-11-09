import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {api,project,exportSession,importSession,RULES_REVISION} from '../engine/session.mjs';
import {prisonerEscapePending} from '../engine/prisoner-escape.mjs';
import {prisonerEscapeView} from '../gui/prisoner-escape-view.mjs';
import {rollResult} from '../gui/roll-result-view.mjs';
import {createServer} from '../server.mjs';
import {run,rejected} from './core-life-event-fixtures.mjs';
const legacy=JSON.parse(readFileSync(new URL('./prisoner-escape-legacy.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function assertOriginal(result,expected){
 const state=structuredClone(result.state);delete state.prisonerEscape;
 // Preview labels are display metadata, not saved mechanics or RNG.
 for(const option of state.trainingOptions??[])delete option.information;
 assert.equal(hash(state),expected.state);assert.equal(hash(result.log),expected.log);
}
export function escapeFixture(){return {session:structuredClone(legacy.session),...project(legacy.session)};}

test('escape result colors use the verified selected-skill outcome, never notes or restored history',()=>{
 for(const skill of ['Stealth','Deception'])for(const success of [false,true]){
  const summary='Prisoner escape using '+skill+': '+(success?10:9)+' against 10+; '+(success?'succeeded.':'failed. Parole Threshold +2 (maximum 12).');
  assert.equal(rollResult({type:'prisoner-escape',summary},{},{}).status,success?'success':'failure');
  for(const type of ['notes','restore','gm-replay'])assert.equal(rollResult({type,summary},{},{}).status,'info');
  assert.equal(rollResult({type:'prisoner-escape',summary:summary.replace(success?'10 against':'9 against',success?'9 against':'10 against')},{},{}).status,'info');
 }
 const r=run(escapeFixture(),'prisoner-escape',{skill:'Stealth'}),raw=exportSession(r.session);
 assert.equal(rollResult(r.log.at(-1),r.state,{}).status,'failure');
 assert.equal(exportSession(r.session),raw);
});

test('unmodified .16 checkpoints and earlier escape results replay exactly without changing save bytes',()=>{
 assert.equal(RULES_REVISION,'character-preview-2026-11-09.17');
 for(const expected of legacy.checkpoints){
  const session={...legacy.session,events:legacy.session.events.slice(0,expected.count)},raw=JSON.stringify(session,null,2);
  const imported=importSession(raw);assert.equal(exportSession(imported),raw);assert.equal(imported.rulesRevision,'character-preview-2026-11-09.16');
  assertOriginal(project(imported),expected);
  const continued=run({session:imported},'notes',{text:'Continue this compatible character'});
  assert.deepEqual(continued.session.events.slice(0,session.events.length),session.events);assert.equal(continued.session.rulesRevision,session.rulesRevision);
  assert.equal(continued.state.character.notes,'Continue this compatible character');assert.deepEqual(project(importSession(exportSession(continued.session))).state,continued.state);
 }
 for(const branch of legacy.branches){
  const session={...legacy.session,events:[...legacy.session.events,...branch.events]},raw=exportSession(session);
  assertOriginal(project(importSession(raw)),branch);assert.equal(exportSession(importSession(raw)),raw);
 }
});

test('explicit escape uses only the chosen skill, including a lower skill than the automatic legacy check',()=>{
 for(const skill of ['Stealth','Deception']){
  const before=escapeFixture(),original=exportSession(before.session),parole=before.state.character.careers[1].parole;
  assert.equal(before.state.character.skills.Stealth,0);assert.equal(before.state.character.skills.Deception,1);
  let r=run(before,'prisoner-escape',{skill},{id:'escape-once'});
  const repeated=run(r,'prisoner-escape',{skill},{id:'escape-once'});assert.deepEqual(repeated.session,r.session);
  assert.equal(exportSession(before.session),original);assert.equal(r.log.at(-1).rolls.length,1);
  r=run(r,'gm-replay',{revision:r.revision,rollIndex:0,values:[4,5],reason:'Chosen escape skill boundary check'});
  assert.match(r.log.at(-1).summary,new RegExp('Prisoner escape using '+skill));
  assert.equal(r.state.prisonerEscape,undefined);assert.equal(r.state.character.careers[1].released===true,skill==='Deception');
  if(skill==='Stealth'){assert.equal(r.state.character.careers[1].parole,Math.min(12,parole+2));assert.equal(r.state.stage,'advancement');}
  else {assert.equal(r.state.character.careers[1].escaped,true);assert.equal(r.state.stage,'term-end');}
  assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
  rejected(r,'prisoner-escape',{skill},/No Prisoner escape/);
 }
});

test('each old pending checkpoint can finish its original actions without rewriting history',()=>{
 for(const expected of legacy.checkpoints){
  const original={...legacy.session,events:legacy.session.events.slice(0,expected.count)},raw=exportSession(original);
  let r={session:importSession(raw)};
  for(const event of legacy.session.events.slice(expected.count))r=run(r,event.command.type,event.command.payload,{id:event.id});
  assert.equal(exportSession(original),raw);
  assert.deepEqual(r.session,legacy.session);
  for(const branch of legacy.branches){
   let continued=r;
   for(const event of branch.events)continued=run(continued,event.command.type,event.command.payload,{id:event.id});
   assertOriginal(project(continued.session),branch);
   assert.deepEqual(continued.session.events.slice(0,expected.count),original.events);
   assert.equal(continued.session.rulesRevision,original.rulesRevision);
  }
 }
});

test('pending escape survives notes and restore, rejects invalid skills atomically, and offers a no-roll decline',()=>{
 let r=escapeFixture();assert.equal(prisonerEscapePending(r.state),true);
 for(const payload of [{},{skill:'Melee'},{skill:'Stealth',target:2},{skill:'Stealth',values:[6,6]}])rejected(r,'prisoner-escape',payload,/Choose Stealth or Deception/);
 r=run(r,'notes',{text:'Pause to decide'});assert.equal(prisonerEscapePending(r.state),true);
 const revision=r.revision,before=structuredClone(r.state.character.careers[1]);r=run(r,'choose-effect',{index:1});
 assert.deepEqual(r.log.at(-1).rolls,[]);assert.equal(r.state.stage,'advancement');assert.equal(r.state.character.careers[1].parole,before.parole);
 r=run(r,'restore',{revision});assert.equal(prisonerEscapePending(r.state),true);
 const other=structuredClone(r.state);other.pendingChoice.options[0].effects[0].target=8;assert.equal(prisonerEscapePending(other),false);
 other.pendingChoice=structuredClone(r.state.pendingChoice);other.character.careers[1].id='core.rogue';assert.equal(prisonerEscapePending(other),false);
 const view=prisonerEscapeView(r.state.prisonerEscape,{esc:String,button:(label,action,_cls,attributes)=>`<button data-action="${action}" ${attributes}>${label}</button>`});
 assert.match(view,/possible way out/);assert.match(view,/Success lets you leave prison/);assert.match(view,/failure/i);assert.match(view,/maximum 12/);
 assert.match(view,/Attempt escape using Stealth \(10\+\)/);assert.match(view,/Attempt escape using Deception \(10\+\)/);assert.match(view,/Stay in prison/);assert.match(view,/Check DM \+1/);
});

test('new sessions use .17 while .15 and older and deferred .16 saves retain their protection',()=>{
 assert.equal(api({operation:'create',seed:'new-escape'}).session.rulesRevision,RULES_REVISION);
 for(const revision of ['character-preview-2026-11-09.15','character-preview-2026-11-09.18',undefined]){
  const session={...legacy.session,rulesRevision:revision};assert.equal(api({operation:'project',session}).ok,false);
 }
 const damaged=structuredClone(legacy.session);damaged.events.find(event=>event.rolls?.length).rolls[0].values[0]=99;
 assert.equal(api({operation:'project',session:damaged}).ok,false);
 const deferred=structuredClone(legacy.session);deferred.events[1].command.payload.species='zhodani';assert.equal(api({operation:'project',session:deferred}).ok,false);
});

test('fresh .17 sessions reach the same opportunity without converting a legacy save',()=>{
 let r=api({operation:'create',seed:legacy.session.seed});
 for(const event of legacy.session.events)r=run(r,event.command.type,event.command.payload);
 assert.equal(r.session.rulesRevision,RULES_REVISION);assert.equal(prisonerEscapePending(r.state),true);
 const done=run(r,'prisoner-escape',{skill:'Stealth'});assert.equal(done.state.prisonerEscape,undefined);
 assert.deepEqual(project(importSession(exportSession(done.session))).state,done.state);
});

test('HTTP imports a pending .16 save and continues through the selected skill without history changes',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/v1',call=async request=>(await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)})).json();
  const raw=JSON.stringify(legacy.session,null,2),loaded=await call({operation:'import',raw});assert.equal(loaded.ok,true);assert.equal(exportSession(loaded.session),raw);
  const request={operation:'command',session:loaded.session,command:{type:'prisoner-escape',payload:{skill:'Stealth'}},id:'http-escape',expectedRevision:loaded.revision};
  const done=await call(request);assert.equal(done.ok,true,JSON.stringify(done.error));assert.equal(done.session.rulesRevision,legacy.session.rulesRevision);
  assert.deepEqual(done.session.events.slice(0,legacy.session.events.length),legacy.session.events);assert.deepEqual((await call({...request,session:done.session})).session,done.session);
  assert.deepEqual(project(importSession(exportSession(done.session))).state,done.state);
  assert.equal((await call({...request,command:{...request.command,payload:{skill:'Melee'}}})).ok,false);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
