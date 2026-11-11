import test from 'node:test';
import assert from 'node:assert/strict';
import {educationEntryPreview,educationEntryCheck,EDUCATION_PACK} from '../engine/education-pack.mjs';
import {api,catalog,project,exportSession,createSession,execute} from '../engine/session.mjs';
import {assignmentSetup,run} from './assignment-fixtures.mjs';
import {admissionPreviewView} from '../gui/precareer-popup.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={esc,sourceLabel:(s,p)=>s+' p. '+p},c=catalog();
test('every Core preview matches actual checks across all terms, scores and threshold bonuses',()=>{
 for(const id of Object.keys(EDUCATION_PACK))for(const term of [1,2,3])for(const value of [0,1,2,3,5,6,8,9,11,12,14,15,40])for(const soc of [0,8,9,15]){
  const stats={STR:value,DEX:value,END:value,INT:value,EDU:value,SOC:soc},before=structuredClone(stats),p=educationEntryPreview({id,term,stats});
  for(const roll of [2,7,12]){const actual=educationEntryCheck({id,term,stats,roll});assert.equal(actual.total,roll+p.modifier);for(const k of ['stat','target','characteristicDM','termDM','thresholdModifier'])assert.equal(actual[k],p[k]);}
  assert.deepEqual(stats,before);assert.equal(p.source.id,'core');assert.equal(p.source.page,16);
 }
});
test('preview projections and markup leave session, random state, log and attempts untouched',()=>{
 const fixture=assignmentSetup('preview-no-mutation'),before=exportSession(fixture.session),original=project(fixture.session);
 for(let i=0;i<3;i++){
  const projected=project(fixture.session);assert.equal(Object.keys(projected.educationAdmissionPreviews).length,4);
  for(const id of Object.keys(projected.educationAdmissionPreviews)){
   const html=admissionPreviewView({...projected.state,educationAdmissionPreviews:projected.educationAdmissionPreviews},c,id,helpers);assert.match(html,/Roll for Admission/);assert.match(html,/Back to Pre-Career/);assert.match(html,/One admission attempt/);assert.match(html,/core p\. 16/);assert.doesNotMatch(html,/data-action="precareer"/);
  }
  assert.deepEqual(projected,original);assert.equal(exportSession(fixture.session),before);
 }
});
test('projection uses current GM-edited scores and never persists preview data',()=>{
 let r=assignmentSetup('preview-edit');assert.equal(r.educationAdmissionPreviews['core.university'].modifier,0);
 r=run(r,'gm-override',{field:'stat.EDU',value:12,reason:'Admission preview test'});
 assert.equal(r.educationAdmissionPreviews['core.university'].characteristicDM,2);
 assert.equal(r.educationAdmissionPreviews['core.university'].score,12);
 assert.doesNotMatch(exportSession(r.session),/educationAdmissionPreviews|characteristicDM/);
 const before=r.session.events.length;r=run(r,'precareer',{id:'core.university'});assert.equal(r.session.events.length,before+1);assert.deepEqual(r.state.educationAttemptTerms,[0]);assert.equal(r.log.at(-1).rolls[0].label,'Education entry');assert.equal(r.educationAdmissionPreviews?.['core.university'],undefined);
});
test('blocked, unknown and Companion options have no Core preview action',()=>{
 const r=assignmentSetup('preview-blocked');r.state={...r.state,educationAdmissionPreviews:r.educationAdmissionPreviews};assert.match(admissionPreviewView(r.state,c,'core.university',helpers),/Roll for Admission/);for(const id of ['unknown','companion.colonial'])assert.equal(admissionPreviewView(r.state,c,id,helpers),'');
 assert.equal(admissionPreviewView({...r.state,educationAttemptTerms:[0]},c,'core.university',helpers),'');
 assert.equal(admissionPreviewView({...r.state,character:{...r.state.character,terms:3}},c,'core.university',helpers),'');
});
test('source-assisted preview has no invented target, modifier or automated-roll promise',()=>{
 const r=assignmentSetup('preview-source'),state={...r.state,educationAdmissionPreviews:{'core.university':{sourceAssisted:true,source:{id:'core',page:16},reason:'Referee <required>'}}};
 const html=admissionPreviewView(state,c,'core.university',helpers);assert.match(html,/Continue to source resolution/);assert.match(html,/No automated admission roll/);assert.match(html,/Referee &lt;required&gt;/);assert.doesNotMatch(html,/Roll 2D|Admission target:|Roll for Admission/);
});
test('read-only preview projection is identical through public API and direct projection',()=>{
 const r=assignmentSetup('preview-api');const result=api({operation:'project',session:r.session});assert.equal(result.ok,true);assert.deepEqual(result.educationAdmissionPreviews,project(r.session).educationAdmissionPreviews);
});

test('native Vargr and Aezorgh project source-assisted previews and retain no-roll resolution',()=>{
 for(const species of ['vargr','aezorgh']){
  let session=createSession('admission-source-'+species);
  for(const command of [{type:'setup',payload:{species}},{type:'roll-statistics'},{type:'accept-statistics'}])session=execute(session,command).session;
  let state=project(session).state;session=execute(session,{type:'background',payload:{skills:state.backgroundOptions.slice(0,state.backgroundRemaining)}}).session;state={...project(session).state,educationAdmissionPreviews:project(session).educationAdmissionPreviews};
  assert.equal(state.stage,'precareer');const before=exportSession(session);
  for(const id of Object.keys(EDUCATION_PACK)){
   assert.equal(state.educationAdmissionPreviews[id].sourceAssisted,true);assert.equal(state.educationAdmissionPreviews[id].target,undefined);
   admissionPreviewView(state,c,id,helpers);assert.equal(exportSession(session),before);
   const result=execute(session,{type:'precareer',payload:{id}});assert.equal(result.state.stage,'book-step');assert.equal(result.log.at(-1).rolls.length,0);assert.deepEqual(result.state.educationAttemptTerms,[0]);
  }
 }
});
