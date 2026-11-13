import test from 'node:test';
import assert from 'node:assert/strict';
import {educationEventModel,educationEventView,educationGraduationView} from '../gui/precareer-popup.mjs';
import {studyFixture,command} from './education-result-fixtures.mjs';
import {exportSession} from '../engine/session.mjs';
test('University event prompt is presentation only and retains the existing explicit command',()=>{
 const r=command(studyFixture(2),'education-skill',{name:'Medic'}),before=exportSession(r.session),state=structuredClone(r.state);
 assert.equal(r.state.stage,'education-event');assert.deepEqual(educationEventModel(r.state),{id:'core.university',name:'University',kind:'event'});
 const html=educationEventView();assert.match(html,/data-action="education-event"/);assert.equal((html.match(/data-action=/g)||[]).length,1);assert.match(html,/Nothing has been rolled yet/);assert.match(html,/initial study skills and EDU gain are recorded/);assert.doesNotMatch(html,/Target|Skip|= [0-9]/);
 assert.deepEqual(r.state,state);assert.equal(exportSession(r.session),before);
 for(const stage of ['education-graduation','book-step','effect-choice'])assert.equal(educationEventModel({...state,stage}),null);
 for(const id of ['core.academy-army','companion.merchant']){const altered=structuredClone(state);altered.character.educations[altered.education].id=id;assert.equal(educationEventModel(altered),null);}
});

test('graduation preview has only explicit roll and non-mutating information controls',()=>{
 const model={kind:'graduation',preview:{stat:'INT',score:8,modifier:0,target:6,honoursTarget:10}},before=structuredClone(model),html=educationGraduationView(model,{esc:String});
 assert.match(html,/Graduation 6\+ · Honours 10\+/);assert.match(html,/Roll 2D \+ 0/);assert.match(html,/INT 8 · Modifier \+0/);assert.equal((html.match(/data-action=/g)||[]).length,1);assert.match(html,/data-action="education-graduation"/);assert.match(html,/data-education-info="graduation"/);assert.match(html,/data-education-info="calculation"/);assert.match(html,/graduation-cap-art/);assert.equal((html.match(/aslan-family-mystery/g)||[]).length,2);assert.doesNotMatch(html,/graduation-dice-art/);assert.match(html,/graduation-title-group/);assert.doesNotMatch(html,/initial awards|Success adds|You graduated/);assert.deepEqual(model,before);
 const negative=educationGraduationView({preview:{...model.preview,score:2,modifier:-2}},{esc:String});assert.match(negative,/Roll 2D − 2/);
});
