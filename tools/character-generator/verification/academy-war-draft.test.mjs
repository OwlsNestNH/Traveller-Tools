import {requiredDraftPresentation,requiredDraftChoices,requiredDraftResult}from'../gui/required-draft-presentation.mjs';
import {currentActionNumbers}from'../gui/final-sheet-history.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash}from'node:crypto';
import {execute,project,exportSession,importSession,api}from'../engine/session.mjs';
import {educationSetup,forceEducation,command}from'./education-result-fixtures.mjs';
import {educationWarDraftModel,educationWarDraftView}from'../gui/education-war-draft.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
import {ready,war}from'./academy-war-draft-fixtures.mjs';
const digest=r=>createHash('sha256').update(JSON.stringify({state:r.state,log:r.log})).digest('hex');
const roundtrip=r=>{const raw=exportSession(r.session),restored=importSession(raw);assert.equal(exportSession(restored),raw);assert.deepEqual(project(restored).state,r.state);return r;};
test('accepted combined academy rolls keep state/log/RNG and show their historical modifier',()=>{
 let r=war('core.academy-army',false);assert.equal(r.state.stage,'effect-choice');const before=digest(r),raw=exportSession(r.session),view=educationWarDraftModel(r);assert.equal(view.check.natural,7);assert.equal(view.check.total,7);assert.deepEqual(view.check.values,[3,4]);assert.deepEqual(view.eventDice,[5,6]);assert.equal(view.separateDraftRoll,false);assert.equal(Object.keys(project(r.session)).includes('educationWarDraftView'),false);
 assert.equal(api({operation:'project',session:r.session}).educationWarDraftView.check.total,7);
 r=command(r,'gm-override',{field:'stat.SOC',value:15,reason:'Synthetic later correction'});assert.equal(educationWarDraftModel(r).check.modifier,0,'read the accepted pre-roll snapshot, not edited SOC');assert.equal(educationWarDraftModel(r).check.total,7);
 assert.equal(digest(project(importSession(raw))),before);roundtrip(r);const model=educationWarDraftModel(project(importSession(raw)));assert.match(educationWarDraftView(model,{esc}),/no graduation this term/);
});
test('future academy War event, SOC check and draft each require one explicit action',()=>{
 for(const id of ['core.academy-army','core.academy-marine','core.academy-navy']){
  let r=war(id);assert.equal(r.state.stage,'education-event-roll');assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.state.character.terms,0);assert.equal(r.state.character.age,18);roundtrip(r);
  const pendingId=r.state.pendingEducationEventRoll.id;r=forceEducation(r,'roll-education-event-step',{pendingId},[3,4]);assert.equal(r.state.stage,'effect-choice');assert.equal(r.state.character.educations[0].graduationAllowed,false);assert.equal(r.log.at(-1).rolls.length,1);assert.throws(()=>execute(r.session,{type:'roll-education-event-step',payload:{pendingId}}));assert.equal(educationWarDraftModel(r).check.total,7);roundtrip(r);
  const rng=r.state.rng;r=command(r,'choose-effect',{index:1});assert.equal(r.state.rng,rng);assert.equal(r.state.stage,'education-event-roll');assert.equal(r.state.pendingEducationEventRoll.label,'Draft assignment');assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.character.terms,0);roundtrip(r);
  r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[3]);assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.forcedCareer,'core.army');assert.equal(r.state.forcedCareerDraft,true);assert.equal(r.state.draftUsed,true);assert.equal(r.state.character.terms,1);assert.equal(r.state.character.age,22);assert.equal(r.state.character.educations[0].graduation.attempted,false);roundtrip(r);
  const accepted=structuredClone(r.state.character),acceptedRng=r.state.rng;r=command(r,'acknowledge-education-event',{pendingId:r.state.educationEventResult.id});assert.equal(r.state.stage,'career');assert.deepEqual(r.state.character,accepted);assert.equal(r.state.rng,acceptedRng);assert.equal(r.state.careerChoices.filter(c=>!c.disabled).map(c=>c.id).join(','),'core.army');assert.throws(()=>execute(r.session,{type:'career',payload:{id:'core.navy',assignment:'line'}}));roundtrip(r);
 }
});
test('Flee preserves initial awards, completes education then requires Drifter next term',()=>{
 let r=war();r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[3,4]);const rng=r.state.rng,skills=structuredClone(r.state.character.skills);r=command(r,'choose-effect',{index:0});assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.forcedCareer,'core.drifter');assert.equal(r.state.rng,rng);assert.deepEqual(r.state.character.skills,skills);assert.equal(r.state.character.terms,1);assert.equal(r.state.character.age,22);roundtrip(r);
});
test('SOC success permits actual graduation; no departure or graduation award is invented',()=>{
 let r=war();const edu=r.state.character.stats.EDU;r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[6,6]);assert.equal(r.state.stage,'education-event-result');assert.equal(r.state.character.educations[0].graduationAllowed,true);assert.equal(r.state.forcedCareer??null,null);assert.equal(r.state.character.stats.EDU,edu);r=command(r,'acknowledge-education-event',{pendingId:r.state.educationEventResult.id});assert.equal(r.state.stage,'education-graduation');assert.equal(r.state.character.terms,0);r=forceEducation(r,'education-graduation',{},[6,6]);assert.equal(r.state.character.stats.EDU,edu+1);roundtrip(r);
});
test('opt-in is narrow and old empty-payload academy commands retain historical combined rolls',()=>{
 const old=war('core.academy-army',false);assert.equal(old.log.at(-1).rolls.length,2);assert.equal(old.state.educationEventContext,undefined);assert.equal(old.state.character.terms,0);assert.equal(digest(project(old.session)),digest(old));
 for(const bad of [false,1,'true',{}])assert.throws(()=>execute(ready().session,{type:'education-event',payload:{separateAcademyWarRolls:bad}}));
});

test('unfinished older academy saves can opt in only on their next new War action',()=>{
 for(const suffix of ['29','30','31']){let r=ready('core.academy-army','academy-war-audit-4','character-preview-2026-11-09.'+suffix);const prefix=exportSession(r.session);r=forceEducation(r,'education-event',{separateAcademyWarRolls:true},[5,6]);assert.equal(r.state.stage,'education-event-roll');assert.deepEqual(r.session.events.slice(0,JSON.parse(prefix).events.length),JSON.parse(prefix).events);roundtrip(r);r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[3,4]);assert.equal(r.state.stage,'effect-choice');assert.equal(educationWarDraftModel(r).check.total,7);roundtrip(r);}
});

test('fixed draft presentation never creates alternate eligibility or guesses a species table',()=>{
 for(const species of ['human','aslan','vargr','aezorgh']){const required=species==='vargr'||species==='aezorgh'?'vargr.military':'core.army',choices=[{id:required,disabled:false},{id:'core.navy',disabled:true},{id:'vargr.agent',disabled:true}],state={stage:'career',forcedCareer:required,forcedCareerDraft:true,careerChoices:choices,character:{species,terms:1,educations:[]}};assert.deepEqual(requiredDraftChoices(state,choices),[choices[0]]);assert.equal(requiredDraftPresentation(state).ids,null,'unknown table is not replaced with human six');assert.equal(choices[1].disabled,true);state.careerChoices=[...choices,{id:'core.scout',disabled:false}];assert.equal(requiredDraftChoices(state,state.careerChoices),state.careerChoices,'do not hide a genuinely eligible alternative');}
 const state={stage:'career',forcedCareer:'core.prisoner',forcedCareerDraft:false,character:{}};assert.equal(requiredDraftPresentation(state),null);
});
test('required result retains its real draft die across acknowledgement and notes',()=>{
 let r=war();r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[3,4]);r=command(r,'choose-effect',{index:1});r=forceEducation(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[3]);r=command(r,'acknowledge-education-event',{pendingId:r.state.educationEventResult.id});r=command(r,'notes',{text:'Synthetic retained result check'});const result=requiredDraftResult(r,r.session,currentActionNumbers(r.session));assert.match(result.result.title,/Drafted into Army/);assert.deepEqual(result.event.rolls[0].values,[3]);assert.equal(result.result.information.source,undefined);assert.equal(requiredDraftChoices(r.state,r.state.careerChoices).length,3);roundtrip(r);
});
