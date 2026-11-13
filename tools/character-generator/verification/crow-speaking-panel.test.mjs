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
test('all three academy event prompts use the approved education popup without claiming University EDU awards',async()=>{
 const {educationEventModel,educationEventView}=await import('../gui/precareer-popup.mjs');
 for(const [id,name] of [['core.academy-army','Army academy'],['core.academy-marine','Marine academy'],['core.academy-navy','Navy academy']]){
  const state={stage:'education-event',education:0,character:{educations:[{id,entry:{id,success:true}}]}},before=JSON.stringify(state),model=educationEventModel(state,{});assert.equal(model.name,name);assert.match(educationEventView(model),/initial academy training awards/);assert.doesNotMatch(educationEventView(model),/EDU gain/);assert.equal(JSON.stringify(state),before);
 }
});
