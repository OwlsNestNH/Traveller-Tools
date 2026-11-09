import {decorateLifeEventPresentation} from '../engine/life-event-projection.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,project,exportSession,importSession} from '../engine/session.mjs';
import {run} from './vargr-training-fixtures.mjs';
import {lifeEventIdentity,lifeEventRollLabels,lifeEventLogDetails} from '../gui/life-event-presentation.mjs';
import {lifeFixture} from './core-life-event-fixtures.mjs';
import {coreLifeEventView,coreLifeEventSheet} from '../gui/core-life-event-view.mjs';
export function goodFortuneFixture(){
 let r=api({operation:'create',seed:'fortune-64'});
 r=run(r,'setup',{species:'vargr'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');
 r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
 r=run(r,'skip-precareer');r=run(r,'career',{id:'vargr.loner',assignment:'prospector'});
 return run(r,'survival');
}
test('natural Vargr result identifies Good Fortune and both actual options without changing saves',()=>{
 const r=goodFortuneFixture();
 assert.deepEqual(r.state.lifeEventPresentation,{title:'Vargr Life Event 10: Good Fortune',description:'Choose 1 Benefit roll in your current career or CHA +1.',optionLabels:['Gain 1 Benefit roll in your current career','CHA +1']});
 assert.deepEqual(lifeEventRollLabels(r.log.at(-1).rolls),['Vargr Life Event 10: Good Fortune']);
 assert.deepEqual(lifeEventLogDetails(r.log.at(-1)),['Vargr Life Event 10: Good Fortune']);
 assert.equal(r.state.pendingChoice.options[0].label,'Benefit');
 const saved=exportSession(r.session);assert.doesNotMatch(saved,/lifeEventPresentation|Good Fortune/);
 assert.deepEqual(project(importSession(saved)).state,r.state);assert.equal(exportSession(r.session),saved);
});
test('both Good Fortune branches apply exactly once and name their effect in the log',()=>{
 for(const index of [0,1]){
  const before=goodFortuneFixture(),r=run(before,'choose-effect',{index});
  assert.equal(r.state.character.stats.CHA,before.state.character.stats.CHA+(index===1?1:0));
  assert.equal(r.state.character.careers[0].benefitRolls,before.state.character.careers[0].benefitRolls+(index===0?1:0));
  assert.match(lifeEventLogDetails(r.log.at(-1))[0],index===0?/Good Fortune.*Gained 1 Benefit roll/:/Good Fortune.*Charisma \(CHA\) \+1/);
  assert.equal(r.state.lifeEventPresentation,undefined);
  assert.equal(api({operation:'command',session:r.session,command:{type:'choose-effect',payload:{index}}}).ok,false);
  assert.deepEqual(project(importSession(exportSession(r.session))).log,r.log);
 }
});
test('identity survives harmless interruption and restore, but never leaks into another choice',()=>{
 let r=goodFortuneFixture();const revision=r.revision;
 r=run(r,'notes',{text:'Original notes'});assert.match(r.state.lifeEventPresentation.title,/Good Fortune/);
 r=run(r,'choose-effect',{index:1});r=run(r,'gm-mode',{enabled:true});r=run(r,'restore',{revision});
 assert.match(r.state.lifeEventPresentation.title,/Good Fortune/);
 r=run(r,'choose-effect',{index:0});assert.match(lifeEventLogDetails(r.log.at(-1))[0],/Gained 1 Benefit/);
 const state=structuredClone(goodFortuneFixture().state);state.pendingChoice.options[1].effects[0].name='STR';
 delete state.lifeEventPresentation;
 decorateLifeEventPresentation({state,log:[{rolls:[{label:'vargr.life-events (2D)',total:10}]}],snapshots:[{},state],events:[{command:{type:'survival'}}]});
 assert.equal(state.lifeEventPresentation,undefined);
});
test('replaying the actual life roll rebuilds identity and clears the obsolete choice',()=>{
 let r=goodFortuneFixture();const revision=r.revision;r=run(r,'gm-mode',{enabled:true});
 r=run(r,'gm-replay',{revision,rollIndex:2,values:[3,4],reason:'Check another life event'});
 assert.equal(r.state.lifeEventPresentation,undefined);
 assert.deepEqual(lifeEventRollLabels(r.log.at(-1).rolls),['Vargr Life Event 7']);
});
test('Core life decisions and sheet show source-verified names; unverified expansions keep number identity',()=>{
 const r=lifeFixture({row:11}),ui={esc:String,button:()=>'',sourceLabel:()=>'',careerName:x=>x};
 assert.match(coreLifeEventView(r.state,ui),/Core Life Event 11: Crime/);
 assert.match(coreLifeEventSheet(r.state,ui),/Core Life Event 11: Crime/);
 assert.equal(lifeEventIdentity('core.life-events',10).title,'Core Life Event 10: Good Fortune');
 assert.equal(lifeEventIdentity('core.unusual-events',5).title,'Core Unusual Event 5: Contact with Government');
 assert.equal(lifeEventIdentity('zhodani.life-events',10).title,'Zhodani Life Event 10');
 assert.equal(lifeEventIdentity('unknown.table',10),null);
});
