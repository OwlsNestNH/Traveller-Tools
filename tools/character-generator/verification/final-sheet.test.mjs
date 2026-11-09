import test from 'node:test';
import assert from 'node:assert/strict';
import {currentActionNumbers,completedTermRows,completedTermsView,finalEventsView} from '../gui/final-sheet-history.mjs';
import {api,exportSession,project,importSession} from '../engine/session.mjs';
import {finalSheetFixture,run} from './final-sheet-fixtures.mjs';
const catalog=api({operation:'catalog'});
test('current action selection follows nested restore and replay branches without changing the save',()=>{
 const session={events:[
  {command:{type:'setup'}},{command:{type:'roll-statistics'}},{command:{type:'accept-statistics'}},
  {command:{type:'restore',payload:{revision:1}}},{command:{type:'roll-statistics'}},
  {command:{type:'restore',payload:{revision:3}}},{command:{type:'gm-replay',payload:{revision:2}}},
  {command:{type:'accept-statistics'}},{command:{type:'restore',payload:{revision:5}}}
 ]};
 const before=JSON.stringify(session);assert.deepEqual([...currentActionNumbers(session)],[1,5]);assert.equal(JSON.stringify(session),before);
 session.events.push({command:{type:'restore',payload:{revision:8}}});assert.deepEqual([...currentActionNumbers(session)],[1,7,8]);
});
test('final history preserves actual terms, injuries and source decisions through export and replay',()=>{
 const r=finalSheetFixture(),before=exportSession(r.session),rows=completedTermRows(r.state,catalog),html=finalEventsView(r,r.session);
 assert.equal(r.state.stage,'finish');assert.equal(rows.length,1);assert.equal(rows[0].number,1);assert.match(rows[0].label,/Intermediary.*Arbitrator/);
 assert.match(html,/Source-confirmed synthetic treatment note/);assert.match(html,/remaining medical debt Cr20000/);
 assert.equal(html.includes('not executable'),false,'Background notes are in the record, not duplicated as events');
 assert.ok(currentActionNumbers(r.session).has(r.revision));assert.equal(exportSession(r.session),before);
 const restored=project(importSession(before));assert.deepEqual(completedTermRows(restored.state,catalog),rows);assert.equal(finalEventsView(restored,r.session),html);
});
test('completed term view preserves historical assignments and distinguishes missing details',()=>{
 const state={character:{terms:4,careers:[{id:'core.army',termHistory:[{generationTerm:2,careerTerm:1,assignment:'support',rank:1,age:26},{generationTerm:3,careerTerm:2,assignment:'infantry',rank:2,age:30}]}],educations:[{id:'core.university',term:1,completed:true,graduation:{graduated:true,honours:true}}]}};
 const rows=completedTermRows(state,catalog);assert.deepEqual(rows.map(r=>r.number),[1,2,3]);assert.match(rows[0].detail,/honours/);assert.match(rows[1].label,/Support/);assert.match(rows[2].label,/Infantry/);assert.match(completedTermsView(state,catalog),/1 completed term has no separate term entry/);
});
test('final summaries escape free text and omit superseded decisions rather than repeating them as current',()=>{
 let r=finalSheetFixture({finish:false}),revision=r.revision;
 r=run(r,'gm-override',{field:'cash',value:11,reason:'Discarded synthetic decision'});r=run(r,'restore',{revision});r=run(r,'gm-override',{field:'cash',value:22,reason:'Current <img src=x onerror=alert(1)> decision'});r=run(r,'finish');
 const html=finalEventsView(r,r.session);assert.equal(html.includes('Discarded synthetic decision'),false);assert.match(html,/Current &lt;img src=x onerror=alert\(1\)&gt; decision/);assert.match(html,/superseded action/);
});
