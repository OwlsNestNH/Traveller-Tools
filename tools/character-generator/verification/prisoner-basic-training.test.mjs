import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {trainingContext} from '../gui/training-context.mjs';
import {prisonerBasicTrainingFixture,run} from './prisoner-basic-training-fixtures.mjs';

test('Rogue to Prisoner keeps the chosen basic skill without an ordinary entry-term roll',()=>{
 const {firstCareer,basic}=prisonerBasicTrainingFixture();
 assert.equal(firstCareer.state.stage,'survival');assert.equal(trainingContext(firstCareer.state),null);
 assert.equal(trainingContext(basic.state).title,'Choose a basic-training skill');
 assert.match(trainingContext(basic.state).description,/level 0.*survival/);
 const before=exportSession(basic.session),trained=run(basic,'choose-effect',{index:5});
 assert.equal(exportSession(basic.session),before);
 assert.equal(trained.state.character.skills.Persuade,0);
 assert.equal(trained.state.character.skills['Melee (unarmed)'],1);
 assert.equal(trained.state.character.age,22);assert.equal(trained.state.character.terms,1);
 assert.equal(trained.state.stage,'survival');assert.deepEqual(trained.log.at(-1).rolls,[]);
 assert.equal(trainingContext(trained.state),null);
 const restored=project(importSession(exportSession(trained.session)));assert.deepEqual(restored.state,trained.state);
 const trainedRaw=exportSession(trained.session),repeated=api({operation:'command',session:trained.session,command:{type:'training',payload:{table:'assignment'}}});assert.equal(repeated.ok,false);assert.match(repeated.error.message,/No training roll/);assert.equal(exportSession(trained.session),trainedRaw);
});

test('training context does not mislabel advancement rolls, later terms or ordinary choices',()=>{
 const {basic}=prisonerBasicTrainingFixture(),trained=run(basic,'choose-effect',{index:5});
 const state=structuredClone(trained.state),before=structuredClone(state);
 trainingContext(state);assert.deepEqual(state,before);
 state.stage='training';state.trainingNext='end-term';assert.equal(trainingContext(state).title,'Advancement training');
 state.trainingNext=null;state.character.careers[state.active].terms=1;assert.equal(trainingContext(state).title,'Regular term training');
 state.character.careers[state.active].terms=0;state.active=0;assert.equal(trainingContext(state).title,'Regular term training');
 const choice=structuredClone(basic.state);choice.pendingChoice.basicTraining=false;choice.pendingChoice.options[0].label='An unrelated choice';assert.equal(trainingContext(choice),null);
 choice.pendingChoice.options=[];assert.equal(trainingContext(choice),null);
 assert.equal(trainingContext({stage:'identity'}),null);
});
