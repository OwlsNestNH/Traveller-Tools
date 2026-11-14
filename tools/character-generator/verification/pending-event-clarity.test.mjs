import test from 'node:test';import assert from 'node:assert/strict';
import {api,exportSession,project} from '../engine/session.mjs';
import {careerTemplateModel} from '../gui/career-template.mjs';
import {conciseResult} from '../gui/concise-result.mjs';
import {imperialCareerGuidance} from '../gui/imperial-career-definitions.mjs';
import {aslanCareerGuidance} from '../gui/aslan-career-definitions.mjs';
import {vargrCareerGuidance} from '../gui/vargr-career-definitions.mjs';
import {pendingEventFixture,legacyAezorghMishapFixture} from './pending-event-clarity-fixtures.mjs';
const catalog=api({operation:'catalog'});
for(const assignment of ['missionary','warrior'])test('pending Believer SOC change remains pending with a factual narrative: '+assignment,()=>{
 const r=pendingEventFixture('companion.believer',assignment),raw=exportSession(r.session),event=r.log.at(-1),result=conciseResult(event,r.state,catalog);
 assert.equal(r.state.stage,'borrowed-event-roll');assert.equal(r.state.pendingBorrowedRoll.dice,'D3');assert.equal(event.rolls.length,1);
 assert.match(result.title,/spiritual insight/);assert.doesNotMatch(result.text,/undefined|\+1 Benefit rolls|Table outcome:|Source:/);
 assert.ok(result.information);assert.doesNotMatch(result.information.paragraphs.join(' '),/SOC undefined/);assert.ok(result.full.details.every(line=>result.information.paragraphs.includes(line)));
 assert.equal(exportSession(r.session),raw);assert.deepEqual(project(r.session).state,r.state);
});
for(const [career,assignment]of [['core.scholar','physician'],['core.scout','surveyor']])test('one-roll credit has concise actual award and full information: '+career,()=>{
 const r=pendingEventFixture(career,assignment,5),raw=exportSession(r.session),result=conciseResult(r.log.at(-1),r.state,catalog);
 assert.equal(result.title,'Benefit roll bonus saved.');assert.match(result.text,/\+1 to one future Benefit roll from any career/);assert.doesNotMatch(result.text,/Roll \[|Table outcome:|Source:|Select it under/);
 assert.ok(result.information);assert.match(result.information.paragraphs.join(' '),/neither money nor an extra roll/);assert.ok(result.full.details.every(line=>result.information.paragraphs.includes(line)));assert.equal(exportSession(r.session),raw);
});
test('ageing and term guidance do not advertise a forbidden stay or leave action',()=>{
 for(const guidance of [imperialCareerGuidance,aslanCareerGuidance,vargrCareerGuidance])for(const forcedStay of [false,true]){
  const state={stage:'ageing',character:{careers:[{forcedStay}]},active:0};const text=guidance({phase:5},state);assert.match(text,/^Roll ageing/);assert.doesNotMatch(text,/stay|leave|choos|decid/);
  state.stage='term-end';assert.doesNotMatch(guidance({phase:5},state),/stay or leave|staying or leaving/);
 }
});


test('mishap keeps its actual story, failure and recorded table roll separate from pending injury',()=>{
 const r=pendingEventFixture('core.army','support',6,true),raw=exportSession(r.session),event=r.log.at(-1),result=conciseResult(event,r.state,catalog);
 assert.equal(r.state.stage,'borrowed-event-roll');assert.equal(r.state.pendingBorrowedRoll.kind,'borrowed-injury-table');assert.equal(event.rolls.length,1);assert.equal(event.rolls[0].label,'Mishap table');
 assert.match(result.title,/injur/i);assert.equal(result.status,'failure');assert.equal(result.information.retainCrow,true);assert.equal(result.information.label,'About your career mishap');assert.doesNotMatch(result.text,/Table outcome:|Source:|Mishap result 6/);
 assert.ok(result.full.details.every(line=>result.information.paragraphs.includes(line)));assert.equal(exportSession(r.session),raw);assert.deepEqual(project(r.session).state,r.state);
});


test('legacy Aezorgh keeps its original recorded dice without a selected career culture',()=>{
 const r=legacyAezorghMishapFixture(),raw=exportSession(r.session),result=conciseResult(r.log.at(-1),r.state,catalog);
 assert.equal(r.state.character.species,'aezorgh');assert.equal(r.state.character.culture,'native');assert.equal(careerTemplateModel(r.state,catalog),null);assert.equal(result.compact,false);assert.equal(result.information,undefined);assert.match(result.details.join(' '),/Roll \[6\]/);
 assert.equal(exportSession(r.session),raw);assert.deepEqual(project(r.session).state,r.state);
});


test('pending Vargr decisions are not described as advancement',()=>{for(const stage of ['effect-choice','skill-choice','book-step']){const text=vargrCareerGuidance({phase:4},{stage});assert.doesNotMatch(text,/advancement/);assert.match(text,/choice|decision/);}});


test('completed-term counters stay in information while the actual mishap consequence remains clear',()=>{
 const r=pendingEventFixture('core.army','support',2,true),raw=exportSession(r.session),result=conciseResult(r.log.at(-1),r.state,catalog);
 assert.equal(r.state.stage,'term-end');assert.ok(r.log.at(-1).changes.some(c=>c.path==='terms'));assert.match(result.text,/Enemy|enemy/);assert.equal(result.title,'Army career has ended.');assert.equal(r.state.character.careers[r.state.active].forcedExit,true);assert.doesNotMatch(result.text,/Completed terms:|Career terms:/);
 assert.match(result.information.paragraphs.join(' '),/Completed terms:|Career terms:/);assert.equal(exportSession(r.session),raw);
});
