import test from 'node:test';
import assert from 'node:assert/strict';
import {advancementResult} from '../gui/advancement-result.mjs';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const change=(path,before,after)=>({path,before,after});
const event=(check,rank=0,changes=[])=>({type:'advancement',summary:'Advancement: '+JSON.stringify(check)+'. Rank '+rank+'.',changes});
const success={natural:8,total:9,target:7,success:true};
test('successful advancement shows check and only observed promotion and awards',()=>{
 const text=advancementResult(event(success,1,[change('careers.0.rank',0,1),change('skills.Leadership',undefined,1)])).text;
 assert.match(text,/Advancement succeeded/);assert.match(text,/total 9 against target 7\+/);assert.match(text,/Promoted: rank 0 → 1/);assert.match(text,/Leadership: untrained → 1/);assert.match(text,/additional training/);
});
test('failure remains an outcome even with no character changes',()=>{
 const failed=advancementResult(event({natural:6,total:6,target:7,success:false},2));
 assert.equal(failed.status,'failure');assert.match(failed.text,/Advancement failed.*Rank remains 2/);assert.doesNotMatch(failed.text,/Promoted|training|leave/);
});
test('forced exit, natural twelve forced stay and prisoner release use actual audit flags',()=>{
 assert.match(advancementResult(event({natural:2,total:2,target:7,success:false},0,[change('careers.0.forcedExit',false,true)])).text,/Must leave/);
 assert.match(advancementResult(event({...success,natural:12,total:13},2,[change('careers.0.forcedStay',false,true)])).text,/Must remain/);
 const prisoner=advancementResult(event(success,1,[change('careers.0.released',false,true)]));assert.match(prisoner.text,/Released from prison/);assert.doesNotMatch(prisoner.text,/Must leave|Promoted/);
 assert.doesNotMatch(advancementResult(event({...success,natural:12})).text,/Must remain/);
});
test('automatic promotion hides engine sentinel and success at maximum rank does not promise promotion',()=>{
 const auto=advancementResult(event({...success,natural:0,total:99,automatic:true},6));assert.match(auto.text,/succeeded automatically/);assert.match(auto.text,/Rank remains 6/);assert.doesNotMatch(auto.text,/99|total|Promoted/);
});
test('source-required and no-rank careers do not claim outcomes',()=>{
 assert.equal(advancementResult({summary:'Advancement check requires source resolution for the absent characteristic.'}).status,'pending');
 assert.doesNotMatch(advancementResult({summary:'This career has no conventional advancement roll.'}).text,/succeeded|failed|Promoted/);
});
test('commission and education commission expose verified results without inventing rank changes',()=>{
 const commission=check=>({summary:'Commission: '+JSON.stringify(check)+(check.success?'. Became rank 1 officer; no advancement roll this term.':'. Advancement remains available.')});
 assert.match(advancementResult(commission(success)).text,/Commission succeeded.*No advancement roll/);
 assert.match(advancementResult(commission({...success,success:false})).text,/Commission failed.*Advancement remains available/);
 assert.doesNotMatch(advancementResult(commission({automatic:true,success:true,total:99})).text,/99/);
 assert.match(advancementResult({summary:'Pre-term education commission: {"automatic":true,"success":true}.'}).text,/Education commission succeeded automatically/);
});
test('malformed or unrelated summaries do not leak raw JSON or guess',()=>{
 for(const summary of ['Advancement: {broken}. Rank 1.','Advancement: {"success":true}. Rank 1.','Advancement: {"success":"yes","total":9,"target":7}. Rank 1.','Unrelated {"success":true}','Advancement: {"total":9,"target":7,"success":true}.'])assert.equal(advancementResult({summary}),null);
});
test('formatting is pure and does not rewrite saved summaries or audit',()=>{
 const e=event(success,1,[change('careers.0.rank',0,1)]),before=structuredClone(e);advancementResult(e);assert.deepEqual(e,before);
 let session=createSession('advancement-presentation');session=execute(session,{type:'setup',payload:{name:'Test',species:'human'}}).session;
 const raw=exportSession(session),view=project(session);for(const item of view.log)advancementResult(item);
 assert.equal(exportSession(session),raw);assert.deepEqual(project(importSession(raw)),view);
});

import {advancementFixture} from './advancement-result-fixtures.mjs';
test('real Vargr success and failure report outcomes and preserve byte-identical saves',()=>{
 for(const success of [false,true]){
  const {after}=advancementFixture(success),raw=exportSession(after.session),formatted=advancementResult(after.log.at(-1));
  assert.equal(formatted.status,success?'success':'failure');assert.match(formatted.text,/Check total .* target/);
  assert.equal(exportSession(importSession(raw)),raw);assert.equal(exportSession(after.session),raw);
  if(success)assert.match(formatted.text,/Promoted: rank 0 → 1/);else assert.match(formatted.text,/Rank remains 0/);
 }
});
