import test from 'node:test';
import assert from 'node:assert/strict';
import {separateTrainingPermission as permission} from '../engine/psionic-training-access.mjs';
import {createSession,execute,exportSession,importSession,project} from '../engine/session.mjs';
import {lifeFixture,run as lifeRun} from './core-life-event-fixtures.mjs';
import {lifePsionAccess} from '../engine/core-life-events.mjs';
const state=()=>({config:{gm:true},character:{stats:{PSI:9},terms:2,careers:[{}],psionics:{tests:[]}}});
test('score and general GM mode are not course permission; specific house option is',()=>{const s=state();assert.equal(permission(s).allowed,false);s.config.psiTestingWithoutEvent=true;assert.equal(permission(s).allowed,true);});
test('event permission allows later training without extending the Psion career-entry window',()=>{let s=state();s.character.psionEntryPermission=true;assert.equal(permission(s).allowed,true);s=state();s.character.psionics.tests=[{context:'source-event'}];assert.equal(permission(s).allowed,true);s=state();s.character.psionics.tests=[{context:'referee-potential'}];assert.equal(permission(s).allowed,false);s.character.lifePsionAccess={availableAtTerms:2,careerCount:1};assert.equal(permission(s).allowed,true);assert.equal(lifePsionAccess(s),true);s.character.terms=3;assert.equal(permission(s).allowed,true);assert.equal(lifePsionAccess(s),false);});
test('new course command rejects ungated access atomically; legacy commands still replay',()=>{
 const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
 let r=run(createSession('access-regression'),'setup',{species:'human'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.PSI',value:9,reason:'Synthetic known PSI'});r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'skip-precareer');
 assert.equal(r.state.canStartPsionicTraining,false);const before=exportSession(r.session);assert.throws(()=>run(r,'begin-psionic-training',{separateCourse:true}),/qualifying event/);assert.equal(exportSession(r.session),before);
 const legacy=run(r,'begin-psionic-training');assert.deepEqual(project(importSession(exportSession(legacy.session))),project(legacy.session));
 r=run(r,'gm-psi-testing',{enabled:true});assert.equal(r.state.canStartPsionicTraining,true);const next=run(r,'begin-psionic-training',{separateCourse:true});assert.equal(next.state.pending.kind,'psionic-training-terms');assert.equal(next.state.rng,r.state.rng);assert.equal(next.state.character.careers.length,0);
});
test('actual unusual event unlocks separate training at term end without extending career entry',()=>{
 let r=lifeFixture({seed:'life-566',unusual:1});
 r=lifeRun(r,'resolve-life-event',{confirmed:true,reason:'Institute offers testing',outcome:'test',funding:'provided',cost:0,timingConfirmed:true});
 assert.ok(r.state.character.stats.PSI>0);assert.notEqual(r.state.config.psiTestingWithoutEvent,true);assert.equal(r.state.canStartPsionicTraining,false);
 r=lifeRun(r,'advancement');
 while(['training','skill-choice'].includes(r.state.stage)){
  if(r.state.stage==='training')r=lifeRun(r,'training',{table:'personal'});
  else {const name=r.state.pendingChoice.allowed[0];r=lifeRun(r,'choose-skill',{name:name==='Profession'?'Profession (construction)':name});}
 }
 assert.equal(r.state.stage,'term-end');r=lifeRun(r,'leave-career');
 while(r.state.stage==='benefits')r=lifeRun(r,'benefit',{cash:true});
 assert.equal(r.state.stage,'career');assert.equal(r.state.canStartPsionicTraining,true);
 const course=lifeRun(r,'begin-psionic-training',{separateCourse:true});assert.equal(course.state.pending.kind,'psionic-training-terms');assert.equal(course.state.rng,r.state.rng);assert.equal(course.state.character.careers.length,r.state.character.careers.length);assert.deepEqual(project(importSession(exportSession(course.session))).state,course.state);
 const other=lifeRun(r,'career',{id:'core.drifter',assignment:'wanderer'});assert.equal(lifePsionAccess(other.state),false);assert.equal(permission(other.state).allowed,true);assert.equal(other.state.canStartPsionicTraining,false);assert.throws(()=>execute(other.session,{type:'begin-psionic-training',payload:{separateCourse:true}}),/between careers/);
});
