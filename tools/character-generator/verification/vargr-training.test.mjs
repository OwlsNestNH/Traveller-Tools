import test from 'node:test';
import assert from 'node:assert/strict';
import {vargrTrainingChoice,tableSkillAllowed,VARGR_TRAINING_PAGES} from '../engine/vargr-training.mjs';
import {EXPANSION_PACK} from '../engine/expansion-pack.mjs';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {createServer} from '../server.mjs';
import {lonerTrainingFixture,merchantTrainingFixture,run} from './vargr-training-fixtures.mjs';
const choice=(careerId,assignment,scope,eligibleTables=['personal','service','assignment'])=>vargrTrainingChoice({careerId,assignment,scope,pack:EXPANSION_PACK[careerId],eligibleTables,effect:{kind:'skill-choice',scope}});
test('all verified Vargr eligible-career awards use only eligible tables and skills',()=>{
 for(const id of Object.keys(VARGR_TRAINING_PAGES).filter(id=>id!=='vargr.loner')){
  const pack=EXPANSION_PACK[id],assignment=Object.keys(pack.training.assignments)[0];
  const normal=choice(id,assignment,'eligible-career'),advanced=choice(id,assignment,'eligible-career',['personal','service','assignment','advanced']);
  assert.equal(normal.source.page,VARGR_TRAINING_PAGES[id]);assert.ok(normal.tableSkills.length);assert.ok(advanced.tableSkills.length>=normal.tableSkills.length);assert.ok(!normal.tableSkills.some(n=>['STR','DEX','END','INT','EDU','CHA'].includes(n)));
 }
 const low=choice('vargr.agent','enforcer','eligible-career');assert.ok(!low.tableSkills.includes('Medic'));assert.ok(!low.tableSkills.includes('Stealth'));
 assert.ok(choice('vargr.agent','enforcer','eligible-career',['service','assignment','advanced']).tableSkills.includes('Medic'));
 assert.equal(choice('companion.truther','investigator','eligible-career'),null);
});
test('assignment rows permit choice alternatives but not other assignments or invented specialities',()=>{
 const p=choice('vargr.loner','prospector','assignment');assert.equal(tableSkillAllowed('Profession (belter)',p.tableSkills),true);assert.equal(tableSkillAllowed('Profession (domestic servant)',p.tableSkills),false);assert.equal(tableSkillAllowed('Engineer (power)',p.tableSkills),true);assert.equal(tableSkillAllowed('Survival',p.tableSkills),false);
 const w=choice('vargr.loner','wanderer','assignment');assert.ok(w.tableSkills.includes('Drive'));assert.ok(w.tableSkills.includes('Flyer'));
});
test('public Loner reproduction is constrained, atomic, sourced, replayable and consumes no random rolls',()=>{
 let r=lonerTrainingFixture();assert.equal(r.state.stage,'skill-choice');assert.equal(r.state.pendingChoice.source.page,195);
 const original=structuredClone(r.session);
 for(const name of ['Admin','Medic','Profession (domestic servant)','Engineer']){const rejected=api({operation:'command',session:r.session,command:{type:'choose-skill',payload:{name}}});assert.equal(rejected.ok,false);assert.deepEqual(r.session,original);}
 r=run(r,'skill-award-source');assert.equal(r.state.pending.page,195);assert.deepEqual(r.state.pending.effect.trainingContext,{careerId:'vargr.loner',assignment:'prospector',tables:['assignment']});r=run(r,'retry-skill-choice');
 r=run(r,'choose-skill',{name:'Engineer (power)'});assert.equal(r.state.character.skills['Engineer (power)'],1);assert.equal(r.state.stage,'advancement');assert.match(r.log.at(-1).summary,/Aliens 2026 p. 195; vargr.loner \/ prospector/);assert.deepEqual(r.log.at(-1).rolls,[]);assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));
 assert.equal(api({operation:'command',session:r.session,command:{type:'choose-skill',payload:{name:'Vacc Suit'}}}).ok,false);
});
test('HTTP API rejects an out-of-table award and accepts valid sourced choice',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const r=lonerTrainingFixture();const send=async name=>{const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'command',session:r.session,command:{type:'choose-skill',payload:{name}}})});return response.json();};assert.equal((await send('Medic')).ok,false);const good=await send('Vacc Suit');assert.equal(good.ok,true);assert.equal(good.state.character.skills['Vacc Suit'],1);}finally{await new Promise(resolve=>server.close(resolve));}
});

test('public Merchant event uses actual EDU eligibility and preserves pending replay',()=>{
 for(const advanced of [false,true]){
  const r=merchantTrainingFixture({advanced});assert.equal(r.state.pendingChoice.source.page,197);assert.equal(r.state.pendingChoice.trainingContext.tables.includes('advanced'),advanced);
  assert.deepEqual(project(importSession(exportSession(r.session))),project(r.session));
  const skill=r.state.pendingChoice.tableSkills.find(n=>!n.includes(' (')&&!['Animals','Art','Athletics','Drive','Electronics','Engineer','Flyer','Gun Combat','Language','Melee','Pilot','Profession','Science','Seafarer'].includes(n));
  const next=run(r,'choose-skill',{name:skill});assert.equal(next.state.stage,'advancement');assert.deepEqual(next.log.at(-1).rolls,[]);assert.deepEqual(next.state.modifiers,r.state.modifiers);
 }
});
