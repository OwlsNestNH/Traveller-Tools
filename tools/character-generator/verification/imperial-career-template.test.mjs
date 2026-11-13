import assert from 'node:assert/strict';
import test from 'node:test';
import {api} from '../engine/session.mjs';
import {CAREER_TEMPLATES,careerTemplateModel} from '../gui/career-template.mjs';
import {imperialRuleInformation,imperialCareerGuidance,presentationRank} from '../gui/imperial-career-definitions.mjs';
const catalog=api({operation:'catalog'});
test('every existing human Imperial career has source-backed specialty, rank and basic-training presentation',()=>{
 const careers=catalog.careers.filter(c=>['core','companion'].includes(c.group));
 assert.equal(careers.length,16);assert.deepEqual(new Set(Object.keys(CAREER_TEMPLATES)),new Set(careers.map(c=>c.id)));
 for(const career of careers){
  const state={stage:'training',active:0,character:{species:'human',careers:[{id:career.id,assignment:career.assignments[0].id,rank:0,officer:false}]}},before=JSON.stringify(state),model=careerTemplateModel(state,catalog);
  assert.equal(model.career.id,career.id);assert.equal(model.specialties.length,career.assignments.length);assert.equal(model.template.page,career.page);
  for(const specialty of model.specialties){assert.ok(specialty.description);assert.ok(specialty.skills.length>0);}
  const info=imperialRuleInformation(model);assert.ok(info.url.startsWith('https://www.mongoosepublishing.com/'));assert.ok(info.summary.includes('Basic-training reference:'));assert.ok(imperialCareerGuidance(model,state));assert.equal(JSON.stringify(state),before);
 }
});
test('basic training references preserve assignment and specialist exceptions',()=>{
 for(const [id,page] of [['core.citizen',18],['core.drifter',18],['core.psion',229],['companion.believer',38]]){
  const career=catalog.careers.find(c=>c.id===id),state={stage:'training',active:0,character:{species:'human',careers:[{id,assignment:career.assignments[0].id,rank:0}]}},model=careerTemplateModel(state,catalog);
  assert.equal(model.template.basicTraining.table,'assignment');assert.match(imperialRuleInformation(model).summary,/selected specialty/);assert.equal(model.template.basicTrainingPage,page);
 }
});
test('rank projection handles civilian assignment ranks and no conventional ladder without inventing rewards',()=>{
 assert.equal(presentationRank({ranks:{assignments:{worker:[{rank:2,title:'Foreman'}]}}},{assignment:'worker',rank:2}).title,'Foreman');
 assert.equal(presentationRank({ranks:{}},{rank:0}),null);
 assert.equal(presentationRank({ranks:{enlisted:[{rank:0,title:'Crewman'}],officer:[{rank:0,title:'Ensign'}]}},{rank:0,officer:true}).title,'Ensign');
});
test('exceptional careers show their actual source and qualification guidance',()=>{
 const believer=careerTemplateModel({stage:'career-mishap',active:0,character:{species:'human',careers:[{id:'companion.believer',assignment:'mainstream',rank:0}]}},catalog);assert.equal(imperialRuleInformation(believer).page,39);
 const psion=careerTemplateModel({stage:'career',character:{species:'human',careers:[]}},catalog,'core.psion');const info=imperialRuleInformation(psion);assert.match(info.summary,/referee permission/);assert.match(info.summary,/new career/);assert.match(info.summary,/acquisition roll/);assert.match(info.summary,/p\. 229/);
});

import {careerCrowType,careerResultCrowType} from '../gui/career-template.mjs';
test('Army and Marine use approved military Crow without changing other career roles',()=>{for(const id of ['core.army','core.marine'])for(const phase of [0,1,2,3,4,5,6])assert.equal(careerCrowType({career:{id},phase}),'military');for(const id of ['core.merchant','core.agent','aslan.military']){assert.equal(careerCrowType({career:{id},phase:0}),'generic');assert.equal(careerCrowType({career:{id},phase:1}),'skills');assert.equal(careerCrowType({career:{id},phase:4}),'referee');}assert.equal(careerCrowType({selection:true,phase:0}),'generic');});

test('final military benefits keep their recorded costume after the active career closes',()=>{for(const id of ['core.army','core.marine']){const state={active:null,character:{species:'human',careers:[{id}]}},event={type:'benefit',changes:[{path:'careers.0.benefitRolls',before:1,after:2}]};assert.equal(careerResultCrowType(event,{status:'success'},state),'military');assert.equal(careerResultCrowType(event,{status:'error'},state),'generic');assert.equal(careerResultCrowType({type:'choose-skill'},{},state),'generic');}assert.equal(careerResultCrowType({type:'benefit'},{},{active:null,character:{species:'human',careers:[{id:'core.citizen'}]}}),'generic');});

test('approved Navy and Rogue costumes cover guidance and recorded results, excluding errors',()=>{for(const [id,type] of [['core.navy','navy'],['core.rogue','rogue']]){for(const phase of [0,1,2,3,4,5,6])assert.equal(careerCrowType({career:{id},phase}),type);const state={active:null,character:{species:'human',careers:[{id}]}},event={type:'benefit',changes:[{path:'careers.0.benefitRolls',before:0,after:1}]};assert.equal(careerResultCrowType(event,{status:'success'},state),type);assert.equal(careerResultCrowType(event,{status:'error'},state),'generic');assert.equal(careerResultCrowType({type:'choose-skill'},{},state),'generic');}});
