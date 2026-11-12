import {acknowledgeEducationEvent} from './education-event-scenario.mjs';
// Synthetic public-command fixtures. No private campaign data or saved-state edits.
import assert from 'node:assert/strict';
import {api,createSession,execute,project} from '../engine/session.mjs';
export const coreEducationIds=['core.university','core.academy-army','core.academy-marine','core.academy-navy'];
export const command=(r,type,payload={})=>{const result=api({operation:'command',session:r.session??r,command:{type,payload}});assert.equal(result.ok,true,type+': '+result.error?.message);return result;};
export function forceEducation(r,type,payload,values){const rolled=command(r,type,payload);return command(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values,reason:'Synthetic education result review'});}
export function educationSetup(seed='education-result-review',species='human'){
 let r={session:createSession(seed)};r=command(r,'setup',{species,name:'Review Traveller'});r=command(r,'gm-mode',{enabled:true});r=command(r,'roll-statistics');r=command(r,'accept-statistics');
 for(const stat of Object.keys(r.state.character.stats))r=command(r,'gm-override',{field:'stat.'+stat,value:7,reason:'Synthetic education review characteristics'});
 r=command(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});assert.equal(r.state.stage,'precareer');return r;
}
export function admissionFixture(id='core.university',success=true){let r=forceEducation(educationSetup('education-review-'+id+'-'+success),'precareer',{id},success?[6,6]:[1,1]);for(let i=0;i<12&&r.state.stage==='effect-choice';i++)r=command(r,'choose-effect',{index:0});return r;}
export function studyFixture(step=1,specialty=false){let r=admissionFixture();if(step===2)r=command(r,'education-skill',{name:specialty?'Science (physics)':'Admin'});return r;}
export function educationReady(id='core.university'){
 let r=admissionFixture(id);
 if(id==='core.university'){r=command(r,'education-skill',{name:'Admin'});r=command(r,'education-skill',{name:'Medic'});}else r=command(r,'acknowledge-education-result');
 assert.equal(r.state.stage,'education-event');return r;
}
export function graduationFixture(id='core.university',outcome='ordinary'){
 let r=forceEducation(educationReady(id),'education-event',{},[2,3]);r=acknowledgeEducationEvent(r);assert.equal(r.state.stage,'education-graduation');
 const values=outcome==='honours'?[6,5]:outcome==='failure'?[1,1]:outcome==='failure-high'?[2,2]:[4,4];r=forceEducation(r,'education-graduation',{},values);
 assert.equal(r.state.stage,'education-result');assert.equal(r.educationResultView?.kind,'graduation');return r;
}
export function eventBlockedFixture(){return acknowledgeEducationEvent(forceEducation(educationReady(),'education-event',{},[1,2]));}
export function sourceEducationFixture(species='vargr'){return command(educationSetup('education-source-'+species,species),'precareer',{id:'core.university'});}
export function validateEducationFixtures(){
 const rows=[];
 for(const id of coreEducationIds){for(const success of [true,false]){const r=admissionFixture(id,success);assert.equal(r.educationResultView?.outcome,success?'success':'failure');rows.push([id,'admission',success,r.state.stage]);}
 for(const outcome of ['ordinary','honours','failure',...(id==='core.university'?[]:['failure-high'])]){const r=graduationFixture(id,outcome);assert.equal(r.educationResultView.outcome,outcome==='ordinary'?'success':outcome.startsWith('failure')?'failure':'honours');const ack=command(r,'acknowledge-education-result');assert.equal(ack.state.stage,'career');assert.deepEqual(ack.state.character,r.state.character);assert.equal(ack.state.rng,r.state.rng);rows.push([id,'graduation',outcome,r.state.stage]);}}
 for(const species of ['vargr','aezorgh']){const r=sourceEducationFixture(species);assert.equal(r.state.stage,'book-step');assert.equal(r.educationResultView,undefined);}
 const blocked=eventBlockedFixture();assert.equal(blocked.state.character.educations[0].graduation.attempted,false);assert.equal(blocked.educationResultView,undefined);
 return rows;
}
