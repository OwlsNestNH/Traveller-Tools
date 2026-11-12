import {acknowledgeEducationEvent} from './education-event-scenario.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSession,execute,project,importSession,exportSession} from '../engine/session.mjs';
const sourceURL=new URL('../engine/session.mjs',import.meta.url);
let source=await readFile(sourceURL,'utf8');
source=source.replace(/from\s+'(\.\/[^']+)'/g,(_,path)=>'from '+JSON.stringify(new URL(path,sourceURL).href));
source+='\nexport const educationAudit={queueEffects,apply};\n';
const {educationAudit:a}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function acknowledgeEducation(r,nextStage='career'){
 assert.equal(r.state.stage,'education-result');assert.equal(r.state.educationResult.nextStage,nextStage);
 const character=structuredClone(r.state.character),rng=r.state.rng;
 r=run(r,'acknowledge-education-result');assert.equal(r.state.stage,nextStage);
 assert.deepEqual(r.state.character,character);assert.equal(r.state.rng,rng);assert.deepEqual(r.log.at(-1).rolls,[]);return r;
}
function setup(seed='education'){
 let r=run(createSession(seed),'setup',{name:'Education fixture',species:'human',gender:'female'});
 r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});
 for(const stat of ['STR','DEX','END','INT','EDU','SOC'])r=run(r,'gm-override',{field:'stat.'+stat,value:7,reason:'Source regression fixture'});
 r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
 return r;
}
function force(r,type,payload,values,index=0) {
 const rolled=run(r,type,payload),revision=rolled.revision;
 return run(rolled,'gm-replay',{revision,rollIndex:index,values,reason:'Deterministic education source test'});
}
function studies(r,a='Admin',b='Medic'){
 r=run(r,'education-skill',{name:a});return run(r,'education-skill',{name:b});
}
function university(seed='university',event=[2,3],graduation=[5,5]){
 let r=force(setup(seed),'precareer',{id:'core.university'},[3,3]);
 r=studies(r);r=force(r,'education-event',{},event);r=acknowledgeEducationEvent(r);
 if(r.state.stage==='education-graduation')r=acknowledgeEducation(force(r,'education-graduation',{},graduation));
 return r;
}

function academy(enabled=false, id='core.academy-army', graduate=true){
 let r=setup('academy-gm');
 if(enabled)r=run(r,'gm-academy-training',{enabled:true});
 r=force(r,'precareer',{id},[5,5]);
 while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
 r=acknowledgeEducation(r,'education-event');r=force(r,'education-event',{},[2,3]);r=acknowledgeEducationEvent(r);r=acknowledgeEducation(force(r,'education-graduation',{},graduate?[5,6]:[1,2]));
 return r;
}
function enter(r,id='core.army',assignment='support',basicIndex=0){
 r=run(r,'career',{id,assignment});
 if(r.state.stage==='preterm-commission')r=run(r,'preterm-commission',{attempt:false});
 while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:basicIndex});
 for(const name of ['Recon','Athletics','Gun Combat']){
  if(r.state.stage==='education-service')r=run(r,'education-service',{name});
  while(r.state.stage==='skill-choice')r=run(r,'choose-skill',{name:r.state.skillChoiceSuggestions[0]});
 }
 return r;
}
test('Academy GM option defaults off and adds exactly one service-only roll when enabled',()=>{
 const off=enter(academy());assert.equal(off.state.stage,'survival');assert.equal(off.state.config.academyServiceSkill,undefined);
 let on=enter(academy(true));assert.equal(on.state.stage,'training');assert.deepEqual(on.state.trainingOptions.map(t=>t.id),['service']);
 assert.throws(()=>run(on,'training',{table:'personal'}),/not available/);
 assert.throws(()=>run(on,'gm-academy-training',{enabled:false}),/before entering/);
 on=force(on,'training',{table:'service'},[1]);
 assert.equal(on.state.stage,'effect-choice');assert.deepEqual(on.state.pendingChoice.options.map(o=>o.label),['Drive','Vacc Suit']);
 on=run(on,'choose-effect',{index:1});assert.equal(on.state.stage,'survival');
 assert.equal(on.state.character.skills['Vacc Suit'],1);
 assert.equal(on.state.character.careers[0].academyServiceTraining,'completed');
 assert.throws(()=>run(on,'training',{table:'service'}),/No training/);
 assert.deepEqual(project(importSession(exportSession(on.session))).state,on.state);
});
test('GM option requires GM mode, a boolean, and preserves restore history',()=>{
 let r=run(createSession('toggle'),'setup',{species:'human'});
 assert.throws(()=>run(r,'gm-academy-training',{enabled:true}),/Enable GM/);
 r=run(r,'gm-mode',{enabled:true});assert.throws(()=>run(r,'gm-academy-training',{enabled:'yes'}),/true or false/);
 const before=r.revision;r=run(r,'gm-academy-training',{enabled:true});assert.equal(r.state.config.academyServiceSkill,true);
 r=run(r,'restore',{revision:before});assert.equal(r.state.config.academyServiceSkill,undefined);
});
test('failed academy completion qualifies but university does not',()=>{
 assert.equal(enter(academy(true,'core.academy-navy',false),'core.navy','crew').state.stage,'training');
 let u=university();u=run(u,'gm-academy-training',{enabled:true});assert.equal(enter(u).state.stage,'survival');
});
test('old sessions without the new command project identically and keep RAW off',()=>{
 const old=academy();const saved=exportSession(old.session);assert.deepEqual(project(importSession(saved)).state,old.state);
 const entered=enter(old);assert.equal(entered.state.stage,'survival');assert.equal(entered.state.character.careers[0].academyServiceTraining,undefined);
});

test('nonmatching destination does not qualify; later careers retain a single ordinary roll',()=>{
 let r=academy(true);r=force(r,'career',{id:'core.merchant',assignment:'free'},[6,6]);
 assert.equal(r.state.stage,'survival');assert.equal(r.state.character.careers[0].academyServiceTraining,undefined);
 const state=structuredClone(academy(true).state);state.character.careers.push({id:'core.scout',assignment:'courier',terms:1,exit:'voluntary',rank:0});state._override={index:0,values:[6,6]};
 a.apply(state,{type:'career',payload:{id:'core.merchant',assignment:'free'}},[]);
 assert.equal(state.character.careers.at(-1).academyServiceTraining,undefined);
 while(state.stage==='effect-choice')a.apply(state,{type:'choose-effect',payload:{index:0}},[]);
 assert.equal(state.stage,'training');
 delete state._override;a.apply(state,{type:'training',payload:{table:'personal'}},[]);assert.equal(state.stage,'survival');
});
test('non-Academy and intervening education terms do not qualify',()=>{
 for(const modify of [s=>{s.character.educations=[]},s=>{s.character.terms++}]){
  const state=structuredClone(academy(true).state);modify(state);state._override={index:0,values:[6,6]};
  a.apply(state,{type:'career',payload:{id:'core.merchant',assignment:'free'}},[]);
  assert.equal(state.stage,'survival');assert.equal(state.character.careers[0].academyServiceTraining,undefined);
 }
});

test('Academy roll improves known skills normally and honors the level cap',()=>{
 for(const before of [0,3,4]){
  const state=structuredClone(enter(academy(true)).state);state.character.skills.Recon=before;state._override={index:0,values:[4]};
  a.apply(state,{type:'training',payload:{table:'service'}},[]);
  assert.equal(state.character.skills.Recon,Math.min(4,before+1));assert.equal(state.stage,'survival');
 }
});

test('option off retains the Army basic-training choice at level zero',()=>{
 const r=enter(academy(), 'core.army','support',1);
 assert.equal(r.state.character.skills['Vacc Suit'],0);assert.equal(r.state.character.skills.Drive,0);assert.equal(r.state.stage,'survival');
});

test('only matching Core military academies qualify',()=>{
 for(const [academyId,careerId,assignment] of [['core.academy-marine','core.marine','support'],['core.academy-navy','core.navy','crew']]){
  let r=academy(true,academyId,false);r=enter(r,careerId,assignment);
  assert.equal(r.state.stage,'training');assert.deepEqual(r.state.trainingOptions.map(t=>t.id),['service']);
 }
 const state=structuredClone(academy(true).state);state.character.educations[0].id='companion.merchant';delete state.character.educations[0].graduation;state.character.educations[0].curriculum='business';state._override={index:0,values:[6,6]};
 // Inspect the first-career gate without reinterpreting an unrelated academy's source effects.
 state.character.educations[0].completed=true;
 a.apply(state,{type:'career',payload:{id:'core.merchant',assignment:'free'}},[]);
 assert.equal(state.stage,'survival');assert.equal(state.character.careers[0].academyServiceTraining,undefined);
});

test('Army Academy does not grant the optional roll in Navy or Marines',()=>{
 for(const [id,assignment] of [['core.navy','crew'],['core.marine','support']]){
  let r=force(academy(true),'career',{id,assignment},[6,6]);
  if(r.state.stage==='preterm-commission')r=run(r,'preterm-commission',{attempt:false});
  while(['effect-choice','skill-choice'].includes(r.state.stage)){
   r=r.state.stage==='effect-choice'?run(r,'choose-effect',{index:0}):run(r,'choose-skill',{name:r.state.skillChoiceSuggestions[0]});
  }
  assert.equal(r.state.stage,'survival');assert.equal(r.state.character.careers[0].academyServiceTraining,undefined);
 }
});
