import test from 'node:test';
import assert from 'node:assert/strict';
import {crowSpeakingPanel} from '../gui/crow-speaking-panel.mjs';
import {academyTrainingModel} from '../gui/academy-training-model.mjs';
import {educationSetup,forceEducation} from './education-result-fixtures.mjs';
test('Crow speaking panels retain explicit message, costume, semantic tone and escaped text',()=>{
 const html=crowSpeakingPanel({message:'Choose <skill>',aside:'Your excuses remain optional.',type:'skills',tone:'failure'});assert.match(html,/crow-professor\.png/);assert.match(html,/Crow says/);assert.match(html,/data-tone="failure"/);assert.match(html,/Choose &lt;skill&gt;/);assert.doesNotMatch(html,/<skill>/);assert.equal(html,crowSpeakingPanel({message:'Choose <skill>',aside:'Your excuses remain optional.',type:'skills',tone:'failure'}));
});
test('academy admission award is training rather than an event and detection never changes state',()=>{
 const r=forceEducation(educationSetup('academy-panel'),'precareer',{id:'core.academy-army'},[6,6]),before=JSON.stringify(r),model=academyTrainingModel(r.state);assert.equal(model.name,'Army academy');assert.match(model.instruction,/training skill at level 0/);assert.equal(JSON.stringify(r),before);
 assert.equal(academyTrainingModel({...r.state,effectNext:'after-event'}),null);assert.equal(academyTrainingModel({...r.state,character:{...r.state.character,educations:[{...r.state.character.educations[0],completed:true}]}}),null);
});
