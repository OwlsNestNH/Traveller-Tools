import test from 'node:test';
import assert from 'node:assert/strict';
import {educationEventModel,educationEventView} from '../gui/precareer-popup.mjs';
import {studyFixture,command} from './education-result-fixtures.mjs';
import {exportSession} from '../engine/session.mjs';
test('University event prompt is presentation only and retains the existing explicit command',()=>{
 const r=command(studyFixture(2),'education-skill',{name:'Medic'}),before=exportSession(r.session),state=structuredClone(r.state);
 assert.equal(r.state.stage,'education-event');assert.deepEqual(educationEventModel(r.state),{name:'University'});
 const html=educationEventView();assert.match(html,/data-action="education-event"/);assert.equal((html.match(/data-action=/g)||[]).length,1);assert.match(html,/Nothing has been rolled yet/);assert.match(html,/initial study skills and EDU gain are recorded/);assert.doesNotMatch(html,/Target|Skip|= [0-9]/);
 assert.deepEqual(r.state,state);assert.equal(exportSession(r.session),before);
 for(const stage of ['education-graduation','book-step','effect-choice'])assert.equal(educationEventModel({...state,stage}),null);
 for(const id of ['core.academy-army','companion.merchant']){const altered=structuredClone(state);altered.character.educations[altered.education].id=id;assert.equal(educationEventModel(altered),null);}
});
