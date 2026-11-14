import test from 'node:test';import assert from 'node:assert/strict';
import {api,exportSession,project} from '../engine/session.mjs';
import {forcedExitFixture} from './forced-exit-fixtures.mjs';import{rejected,run}from'./assignment-fixtures.mjs';
import{termExitView}from'../gui/term-exit-view.mjs';import{assignmentChangeView}from'../gui/assignment-view.mjs';import{conciseResult}from'../gui/concise-result.mjs';
const render={esc:String,button:(label,action,classes='',attrs='')=>'<button class="'+classes+'" data-action="'+action+'" '+attrs+'>'+label+'</button>',sourceLabel:String};
test('a genuine Army mishap 2 closes exactly one term and preserves its enemy and die',()=>{
 const r=forcedExitFixture(),raw=exportSession(r.session),record=r.state.character.careers[r.state.active];assert.equal(r.log.at(-1).type,'career-mishap');assert.equal(r.log.at(-1).rolls[0].total,2);assert.equal(r.state.character.age,22);assert.equal(r.state.character.terms,1);assert.equal(record.totalBenefits,0);assert.equal(record.forcedExit,true);assert.equal(r.state.character.relationships[0].role,'Enemy');
 const html=termExitView(r.state,render);assert.match(html,/career-exit-primary/);assert.doesNotMatch(html,/continue-career/);assert.equal(assignmentChangeView(r.state,render),'');
 const result=conciseResult(r.log.at(-1),r.state,api({operation:'catalog'}));assert.match(result.text,/Enemy gained/);assert.match(result.text,/Army career has ended/);assert.doesNotMatch(result.text,/Unnamed|Completed terms:|Career terms:|Must leave/);assert.match(result.information.paragraphs.join(' '),/Core Rulebook.*Age: 18 → 22/);
 rejected(r,'continue-career',{},/must be left/i);rejected(r,'change-assignment',{assignment:'support'},/leave|end|assignment/i);assert.equal(exportSession(r.session),raw);const left=run(r,'leave-career');assert.equal(left.state.stage,'career');assert.equal(left.state.character.age,22);assert.equal(left.state.character.terms,1);assert.deepEqual(project(r.session).state,r.state);
});
test('normal continuation, forced stay and native retirement options retain projected availability',()=>{
 const base=forcedExitFixture().state;for(const [options,record,expected]of[[{canContinue:true,canLeave:true},{forcedExit:false},/continue-career/],[{canContinue:true,canLeave:false,leaveReason:'Required another term.'},{forcedExit:false,forcedStay:true},/disabled/],[{canContinue:false,canLeave:false,canRetire:true,retirementRequired:true},{forcedExit:true},/retire-career/]]){const state=structuredClone(base);Object.assign(state.character.careers[state.active],record);state.exitOptions=options;assert.match(termExitView(state,render),expected);}
});
