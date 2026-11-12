import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession} from '../engine/session.mjs';
import {educationGraduationCheck} from '../engine/education-pack.mjs';
import {educationGraduationPreviewProjection} from '../engine/education-result-projection.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
const force=(r,type,payload,values)=>{const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values,reason:'Synthetic graduation preview'});};
function fixture(){
 let r=run(createSession('graduation-preview'),'setup',{species:'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:7,reason:'Synthetic graduation preview'});
 r=run(r,'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=force(r,'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});return force(r,'education-event',{},[2,3]);
}
test('University preview is projected from current rules without changing session, log or random state',()=>{
 const r=fixture(),before=exportSession(r.session),state=structuredClone(r.state),log=structuredClone(r.log),preview=r.educationGraduationPreview;
 assert.equal(r.state.stage,'education-graduation');assert.deepEqual(preview,{id:'core.university',name:'University',stat:'INT',score:7,characteristicDM:0,thresholdModifier:0,modifier:0,target:6,honoursTarget:10,source:{id:'core',title:'Core Rulebook Update 2022',page:16}});
 for(let i=0;i<3;i++){assert.deepEqual(project(r.session).educationGraduationPreview,preview);assert.deepEqual(r.state,state);assert.deepEqual(r.log,log);assert.equal(exportSession(r.session),before);}
 assert.equal(Object.hasOwn(r.state,'educationGraduationPreview'),false);assert.doesNotMatch(before,/educationGraduationPreview/);assert.equal(Object.hasOwn(preview,'roll'),false);assert.equal(Object.hasOwn(preview,'graduated'),false);
});
test('live INT correction refreshes preview and actual check agrees at each modifier boundary',()=>{
 let r=fixture();for(const score of [0,1,3,6,9,12,15,40]){
  r=run(r,'gm-override',{field:'stat.INT',value:score,reason:'Synthetic current INT'});const p=r.educationGraduationPreview;
  assert.equal(p.score,score);for(const roll of [2,7,12]){const actual=educationGraduationCheck({id:p.id,stats:r.state.character.stats,roll});assert.equal(actual.total,roll+p.modifier);assert.equal(actual.target,p.target);assert.equal(actual.honoursTarget,p.honoursTarget);}
 }
 const outcome=run(r,'education-graduation');assert.equal(outcome.educationGraduationPreview,undefined);
});
test('non-University, source-pending, completed and event-blocked paths never get an ordinary preview',()=>{
 const r=fixture(),state=r.state,index=state.education;
 for(const changes of [{stage:'education-event'},{stage:'book-step'},{pending:{kind:'native-effect'}}])assert.equal(educationGraduationPreviewProjection({...state,...changes}),null);
 for(const changes of [{id:'core.academy-army'},{id:'companion.colonial'},{graduationAllowed:false},{completed:true},{graduation:{attempted:false}},{entry:{manual:true,success:true,total:8,roll:8}},{entry:{success:true}},{entry:{...state.character.educations[index].entry,needsAdjudication:true}}]){
  const altered=structuredClone(state);Object.assign(altered.character.educations[index],changes);assert.equal(educationGraduationPreviewProjection(altered),null);
 }
});
