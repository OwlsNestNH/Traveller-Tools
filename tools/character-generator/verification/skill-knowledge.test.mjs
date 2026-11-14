import {educationResultView} from '../gui/education-result-view.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedSkillKnowledge,knownSkillOptions,skillKnowledgeLabel} from '../gui/skill-knowledge.mjs';
import {educationResultModel} from '../gui/education-result-model.mjs';
import {catalog} from '../engine/session.mjs';
test('zero is owned, higher levels are retained and untrained skills are not labeled known',()=>{
 assert.deepEqual(knownSkillOptions(['Athletics','Medic','Recon'],{Athletics:0,Medic:2,Recon:-1}),['Athletics 0','Medic 2']);assert.equal(skillKnowledgeLabel('Medic',{Medic:2}),'Medic — already known: Medic 2');
});
test('specialisations are reported by exact name without implying other specialisations share the level',()=>{
 const skills={'Gun Combat (slug)':1,'Gun Combat (energy)':0};assert.deepEqual(recordedSkillKnowledge('Gun Combat',skills),['Gun Combat (slug) 1','Gun Combat (energy) 0']);assert.deepEqual(recordedSkillKnowledge('Gun Combat (archaic)',skills),[]);assert.deepEqual(recordedSkillKnowledge('Gun Combat (energy)',skills),['Gun Combat (energy) 0']);assert.deepEqual(recordedSkillKnowledge('Gun',skills),[]);
});
test('historical academy status uses pre-admission evidence and never later gains',()=>{
 const p={educationResultView:{id:'core.academy-army',kind:'admission',outcome:'success'},state:{education:0,character:{skills:{Athletics:2,Medic:1},educations:[{id:'core.academy-army',skillsBefore:{Athletics:0}}]}}},before=JSON.stringify(p);
 assert.deepEqual(educationResultModel(p,catalog()).alreadyKnown,['Athletics 0']);assert.equal(JSON.stringify(p),before);assert.equal(educationResultModel({...p,educationResultView:{...p.educationResultView,kind:'graduation'}},catalog()).alreadyKnown,undefined);
});
test('informational options do not include skills outside the supplied eligible list',()=>{assert.deepEqual(knownSkillOptions(['Athletics'],{Athletics:0,Medic:3}),['Athletics 0']);});

test('all pre-owned curriculum remains visible when admission awards no new skills',()=>{
 const model={id:'core.academy-army',name:'Army academy',kind:'admission',outcome:'success',dice:[6,6],modifier:0,total:12,target:7,benefits:[],alreadyKnown:['Athletics 0','Vacc Suit 0']};
 const html=educationResultView(model,{esc:String,button:()=>'',sourceLabel:()=>''});assert.match(html,/Already known before admission/);assert.match(html,/Athletics 0/);assert.match(html,/Vacc Suit 0/);
});
