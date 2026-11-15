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

test('native early-retirement review explains its restriction once and names only available next steps',()=>{
 const state=structuredClone(forcedExitFixture().state);state.character.careers[state.active].forcedExit=false;
 state.exitOptions={canContinue:true,canLeave:false,canRetire:true,retirementRequired:true,leaveReason:'This Aslan career requires three terms before transfer. Early retirement ends character creation.'};
 const before=JSON.stringify(state),html=termExitView(state,render);
 assert.match(html,/Continue this career, or retire from character creation and take benefits/);assert.equal((html.match(/requires three terms/g)||[]).length,1);
 assert.match(html,/data-action="continue-career"/);assert.match(html,/data-action="retire-career"/);assert.match(html,/data-action="leave-career" disabled/);assert.equal(JSON.stringify(state),before);
});

test('required next-career restriction never offers a blocked retirement',()=>{
 const state=structuredClone(forcedExitFixture().state);state.character.careers[state.active].forcedExit=false;
 state.exitOptions={canContinue:true,canLeave:false,canRetire:false,retirementRequired:true,leaveReason:'This Aslan career requires three terms before transfer.',retireReason:'A required next career must be resolved first.'};
 const before=JSON.stringify(state),html=termExitView(state,render);
 assert.match(html,/<p>Continue this career\.<\/p>/);assert.match(html,/A required next career must be resolved first/);
 assert.doesNotMatch(html,/You may instead retire|or retire|data-action="retire-career"/);assert.equal((html.match(/requires three terms/g)||[]).length,1);assert.equal(JSON.stringify(state),before);
 state.exitOptions.canContinue=false;assert.match(termExitView(state,render),/Resolve the required next step below/);
});
