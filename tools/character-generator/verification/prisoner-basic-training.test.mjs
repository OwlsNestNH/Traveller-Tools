import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {trainingContext} from '../gui/training-context.mjs';
import {prisonerBasicTrainingFixture,run} from './prisoner-basic-training-fixtures.mjs';

test('Rogue to Prisoner keeps the chosen basic skill and then the ordinary training roll',()=>{
 const {firstCareer,basic}=prisonerBasicTrainingFixture();
 assert.equal(firstCareer.state.stage,'survival');assert.equal(trainingContext(firstCareer.state),null);
 assert.equal(trainingContext(basic.state).title,'Choose a basic-training skill');
 assert.match(trainingContext(basic.state).description,/level 0.*regular training roll/);
 const before=exportSession(basic.session),trained=run(basic,'choose-effect',{index:5});
 assert.equal(exportSession(basic.session),before);
 assert.equal(trained.state.character.skills.Persuade,0);
 assert.equal(trained.state.character.skills['Melee (unarmed)'],1);
 assert.equal(trained.state.character.age,22);assert.equal(trained.state.character.terms,1);
 assert.equal(trained.state.stage,'training');assert.deepEqual(trained.log.at(-1).rolls,[]);
 assert.equal(trainingContext(trained.state).title,'Regular term training');
 assert.match(trainingContext(trained.state).description,/Basic training is complete.*later career.*p\. 18/);
 const restored=project(importSession(exportSession(trained.session)));
 assert.deepEqual(restored.state,trained.state);
 const after=run(trained,'training',{table:'assignment'});
 assert.equal(after.state.stage,'survival');assert.equal(trainingContext(after.state),null);
 assert.equal(after.log.at(-1).rolls.length,1);assert.equal(after.log.at(-1).rolls[0].label,'Training: assignment');
 assert.equal(after.state.character.skills.Persuade,0);
 assert.equal(after.state.character.age,22);assert.equal(after.state.character.terms,1);
 const repeated=api({operation:'command',session:after.session,command:{type:'training',payload:{table:'assignment'}}});
 assert.equal(repeated.ok,false);assert.match(repeated.error.message,/No training roll/);
 assert.deepEqual(project(importSession(exportSession(after.session))).state,after.state);
});

test('training context does not mislabel advancement rolls, later terms or ordinary choices',()=>{
 const {basic}=prisonerBasicTrainingFixture(),trained=run(basic,'choose-effect',{index:5});
 const state=structuredClone(trained.state),before=structuredClone(state);
 trainingContext(state);assert.deepEqual(state,before);
 state.trainingNext='end-term';assert.equal(trainingContext(state),null);
 state.trainingNext=null;state.character.careers[state.active].terms=1;assert.equal(trainingContext(state),null);
 state.character.careers[state.active].terms=0;state.active=0;assert.equal(trainingContext(state),null);
 const choice=structuredClone(basic.state);choice.pendingChoice.options[0].label='An unrelated choice';assert.equal(trainingContext(choice),null);
 choice.pendingChoice.options=[];assert.equal(trainingContext(choice),null);
 assert.equal(trainingContext({stage:'identity'}),null);
});
