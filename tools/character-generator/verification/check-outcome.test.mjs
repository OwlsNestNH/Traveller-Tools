import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkOutcome} from '../gui/check-outcome.mjs';
import {rollResult} from '../gui/roll-result-view.mjs';
import {qualificationOutcomeFixture} from './check-outcome-fixtures.mjs';
import {execute,exportSession,importSession} from '../engine/session.mjs';
const check=success=>({total:success?9:4,target:7,success});
const result=(type,summary,changes=[])=>rollResult({type,summary,changes}, {}, {});
test('advancement and survival use actual success flags, even with unresolved later effects',()=>{
 for(const type of ['advancement','survival'])for(const success of [false,true]){
  const label=type[0].toUpperCase()+type.slice(1),summary=label+': '+JSON.stringify(check(success))+'.'+(type==='advancement'?' Rank 0.':'');
  assert.equal(result(type,summary).status,success?'success':'failure');
  assert.equal(rollResult({type,summary},{stage:'book-step',pending:{label:'Resolve the event'}},{}).status,success?'success':'failure');
 }
});
test('qualification, assignment and education checks use recorded outcomes',()=>{
 for(const success of [false,true]){
  const expected=success?'success':'failure';
  assert.equal(result('career',(success?'Entered Navy / Crew':'Failed Navy qualification')+': '+JSON.stringify(check(success))+'.').status,expected);
  assert.equal(result('change-assignment','Assignment qualification: '+JSON.stringify(check(success))+'. Continuing Navy / crew with retained rank.').status,expected);
  assert.equal(result('education-check','Education Medic check '+(success?9:4)+' against 7.').status,expected);
  assert.equal(result('education-graduation','Graduation total '+(success?9:4)+' against 7: '+(success?'graduated':'did not graduate')+'.').status,expected);
  assert.equal(result('learn-talent','Psionic acquisition Telepathy: '+(success?9:4)+' against 8; 0 previous checks. '+(success?'Acquired at level 0':'Not acquired')+'. Source: core p. 196.').status,expected);
  assert.equal(result('resolve-book','Source ruling recorded.',[{path:'careerTransitions.0.check',before:null,after:check(success)}]).status,expected);
  assert.equal(result('benefit-wager','Wager resolved.',[{path:'benefitWagers.0.check',before:null,after:check(success)}]).status,expected);
 }
});
test('automatic verified checks succeed; unrelated tables, notes and absent evidence stay neutral',()=>{
 const automatic={automatic:true,success:true};
 assert.equal(result('change-assignment','Assignment qualification: '+JSON.stringify(automatic)+'. Continuing Noble / administrator with retained rank.').status,'success');
 for(const summary of ['Training service result 6.','Ageing result -6.','A successful business idea.','Failed Navy qualification: {"success":false}.','Survival: {broken}.'])assert.equal(result('training',summary).status,'info');
 assert.equal(result('resolve-book','Education Medic check 9 against 7.').status,'info');
 assert.equal(result('training','Training table requires source resolution.').status,'pending');
 assert.equal(checkOutcome({type:'training',summary:'Training service result 6.',rolls:[{total:12,label:'Qualification'}]}),null);
 assert.equal(checkOutcome({changes:[{path:'careerTransitions.0.check',before:check(true),after:check(true)}]}),null);
});
test('mixed recorded checks stay neutral and identify individual outcomes',()=>{
 const mixed=checkOutcome({changes:[{path:'careerTransitions.0.check',after:check(true)},{path:'benefitWagers.0.check',after:check(false)}]});
 assert.equal(mixed.status,'info');assert.equal(mixed.mixed,true);assert.match(mixed.details.join(' '),/succeeded.*failed/);
 const combined=result('survival','Survival: '+JSON.stringify(check(true))+'.',[{path:'benefitWagers.0.check',after:check(false)}]);
 assert.equal(combined.status,'info');assert.match(combined.text,/Survival succeeded.*Mixed check results.*failed/);
});
test('real qualification success and failure preserve detailed log and saved bytes',()=>{
 for(const success of [false,true]){
  const {after}=qualificationOutcomeFixture(success),raw=exportSession(after.session),view=structuredClone(after);
  assert.equal(rollResult(after.log.at(-1),after.state,{}).status,success?'success':'failure');
  assert.deepEqual(after,view);assert.equal(exportSession(importSession(raw)),raw);
 }
});
test('outcome panels and notifications use accessible colored bars with explicit status text',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8'),app=await readFile(new URL('../gui/concise-result.mjs',import.meta.url),'utf8');
 assert.match(app,/data-result-status=/);assert.match(app,/success:'Success',failure:'Failure',pending:'Pending resolution',info:'Information'/);
 const luminance=hex=>{const c=hex.match(/[\da-f]{2}/gi).map(x=>parseInt(x,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);};
 const borders=[];
 for(const status of ['success','failure','pending','info']){
  const style=css.match(new RegExp('\\.result-panel\\.result-'+status+'[^{}]*\\{([^}]+)\\}'))?.[1];assert.ok(style,status);
  const border=style.match(/border-color:(#[\da-f]{6})/)[1],background=style.match(/background:(#[\da-f]{6})/)[1],color=style.match(/(?:^|;)color:(#[\da-f]{6})/)[1];
  assert.ok(contrast(color,background)>=4.5,status+' text contrast');assert.ok(contrast(border,background)>=3,status+' bar contrast');borders.push(border);
 }
 assert.notEqual(borders[0],borders[1]);assert.notEqual(borders[0],borders[2]);assert.notEqual(borders[1],borders[2]);
});


test('restoring earlier and later qualification snapshots does not roll a fresh check',()=>{
 let p=qualificationOutcomeFixture(true).after;const target=p.revision;
 const run=(type,payload)=>p=execute(p.session,{type,payload});
 run('gm-mode',{enabled:true});run('restore',{revision:target-1});run('restore',{revision:target});
 const event=p.log.at(-1);assert.equal(event.type,'restore');assert.ok(event.changes.some(c=>c.path.endsWith('.check')&&c.after?.success));
 assert.equal(checkOutcome(event),null);assert.equal(rollResult(event,p.state,{}).status,'info');
 const replay={...event,type:'gm-replay',summary:'Replayed an earlier action.'};assert.equal(checkOutcome(replay),null);assert.equal(rollResult(replay,{},{}).status,'info');
 // Existing replay-specific helpers retain the result of the actual replaced roll.
 replay.summary='GM corrected an earlier roll. Survival: '+JSON.stringify(check(false))+'.';
 assert.equal(rollResult(replay,{},{}).status,'failure');
});

import {psionicGamesApplication,psionicGamesPreliminaries,psionicGamesFinal} from '../engine/psionic-games.mjs';
import {lawyerFixture,run as lawyerRun} from './prisoner-lawyer-fixtures.mjs';
test('Games application, preliminary and final use explicit verified check outcomes',()=>{
 for(const success of [false,true]){
  const dice=success?[6,6]:[1,1],application=psionicGamesApplication({socialClass:'intendant',previousApplications:0,currentCareerId:'zhodani.scholar',psi:9,dice});
  const preliminaries=psionicGamesPreliminaries({psi:9,skills:{Telepathy:0},rolls:[{talent:'Telepathy',dice}]});
  const final=psionicGamesFinal({preliminaries,dice});
  for(const [type,label,outcome,suffix] of [
   ['apply-psionic-games','application',application,'. Lifetime application used.'],
   ['psionic-games-preliminary','preliminary',preliminaries,'. No skill is gained.'],
   ['psionic-games-final','final',final,'. Checks retained; source decisions are required before awards and term completion.']
  ]){
   const event={type,summary:'Psionic Games '+label+': '+JSON.stringify(outcome.audit[0])+suffix};
   assert.equal(rollResult(event,{},{}).status,success?'success':'failure');assert.match(rollResult(event,{},{}).text,success?/succeeded/:/failed/);
  }
 }
});
test('lawyer appeals classify recorded decisions, not cash spending, declined offers or history',()=>{
 for(const success of [false,true]){
  const changes=[{path:'prisonerLawyers.0.decision',before:null,after:{outcome:'hire',check:check(success)}}];
  assert.equal(result('resolve-prisoner-lawyer','Lawyer hired.',changes).status,success?'success':'failure');
  assert.equal(result('restore','State restored.',changes).status,'info');
 }
 assert.equal(result('resolve-prisoner-lawyer','Lawyer opportunity declined.',[{path:'prisonerLawyers.0.decision',after:{outcome:'decline'}}]).status,'info');
 const before=lawyerFixture({cash:36000}),after=lawyerRun(before,'resolve-prisoner-lawyer',{outcome:'hire',level:6});
 assert.equal(rollResult(after.log.at(-1),after.state,{}).status,'success');assert.match(rollResult(after.log.at(-1),after.state,{}).text,/Lawyer appeal.*succeeded/);
});
