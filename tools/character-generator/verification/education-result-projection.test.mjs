import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
import {educationResultProjection} from '../engine/education-result-projection.mjs';
import {educationResultModel} from '../gui/education-result-model.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function setup(seed='result-projection'){
 let r=run(createSession(seed),'setup',{species:'human'});r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');
 for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:7,reason:'Synthetic education result'});
 r=run(r,'accept-statistics');return run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});
}
function force(r,type,payload,values){const rolled=run(r,type,payload);return run(rolled,'gm-replay',{revision:rolled.revision,rollIndex:0,values,reason:'Synthetic education result dice'});}
function graduate(id,dice=[3,4]){
 let r=force(setup('projection-'+id),'precareer',{id},[6,6]);
 if(id==='core.university'){r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});}else {for(let n=0;['effect-choice','skill-choice'].includes(r.state.stage)&&n<20;n++){if(r.state.stage==='effect-choice'){r=run(r,'choose-effect',{index:0});continue;}const p=r.state.pendingChoice,base=p.allowed?.[0]??p.names?.[0]??p.name;const specialties={'Gun Combat':'slug','Melee':'blade','Athletics':'dexterity','Drive':'wheel','Flyer':'grav','Pilot':'spacecraft','Gunner':'turret'};r=run(r,'choose-skill',{name:specialties[base]?base+' ('+specialties[base]+')':base});}r=run(r,'acknowledge-education-result');}
 r=force(r,'education-event',{},[2,3]);return force(r,'education-graduation',{},dice);
}
test('University study result shows verified replacement dice and stable exact outcome identity',()=>{
 let r=force(setup(),'precareer',{id:'core.university'},[3,4]);const first=r.educationResultView;
 assert.equal(first.study,true);assert.equal(first.studyStep,1);assert.deepEqual(first.dice,[3,4]);assert.equal(first.total,7);assert.equal(first.modifier,0);assert.equal(first.actionId,r.log.at(-1).id);
 const before=exportSession(r.session),tagline=educationResultModel(r).tagline;assert.ok(tagline);assert.equal(exportSession(r.session),before);
 r=run(r,'education-skill',{name:'Admin'});assert.equal(r.educationResultView.studyStep,2);assert.equal(educationResultModel(r).tagline,tagline);assert.equal(r.educationResultView.actionId,first.actionId);
 r=run(r,'notes',{text:'Synthetic note'});assert.equal(educationResultModel(r).tagline,tagline);
 assert.deepEqual(project(importSession(exportSession(r.session))).educationResultView,r.educationResultView);
});
test('admission failure has no invented education record, awards or term',()=>{
 const r=force(setup('failure-projection'),'precareer',{id:'core.university'},[1,1]),m=r.educationResultView;
 assert.equal(m.outcome,'failure');assert.deepEqual(m.dice,[1,1]);assert.equal(m.terms,0);assert.deepEqual(m.benefits,[]);assert.equal(m.study,false);assert.equal(m.continuation,'career');
});
test('ordinary, honours and failed University results derive resolved gains and different rights',()=>{
 for(const [dice,outcome] of [[[3,4],'success'],[[5,5],'honours'],[[1,2],'failure']]){
  let r=graduate('core.university',dice),m=r.educationResultView;assert.equal(m.outcome,outcome);assert.equal(m.years,4);assert.equal(m.terms,1);assert.deepEqual(m.dice,dice);
  if(outcome==='failure'){assert.deepEqual(m.actualAwardChanges,[]);assert.ok(m.retained.includes('Admin 0'));assert.ok(m.retained.includes('Medic 1'));assert.ok(m.missed.some(x=>x.includes('No graduation')));}
  else {assert.ok(m.benefits.some(x=>x==='Admin 0 → 1'));assert.ok(m.benefits.some(x=>x==='Medic 1 → 2'));assert.ok(m.benefits.some(x=>x.startsWith('EDU +1')));assert.ok(m.benefits.some(x=>x.includes('Qualification DM +'+(outcome==='honours'?2:1))));}
  const original=structuredClone(m);r=run(r,'gm-override',{field:'stat.EDU',value:15,reason:'Later correction must not rewrite resolved gains'});assert.deepEqual(r.educationResultView,original);
  r=run(r,'acknowledge-education-result');assert.equal(r.educationResultView,undefined);
 }
});
test('academies retain distinct failed-graduation threshold and honours awards',()=>{
 for(const id of ['core.academy-army','core.academy-marine','core.academy-navy']){
  const low=graduate(id,[1,1]).educationResultView,high=graduate(id,[1,2]).educationResultView,honours=graduate(id,[6,6]).educationResultView;
  assert.equal(low.outcome,'failure');assert.equal(low.total,2);assert.ok(!low.benefits.some(x=>x.includes('Automatic entry')));
  assert.equal(high.total,3);assert.ok(high.benefits.some(x=>x.includes('Automatic entry')));assert.ok(high.benefits.some(x=>x.includes('No commission')));
  assert.equal(honours.outcome,'honours');assert.ok(honours.benefits.some(x=>x.startsWith('EDU +1')));assert.ok(honours.benefits.some(x=>x.startsWith('SOC +1')));assert.ok(honours.benefits.some(x=>x.includes('Automatic commission')));
 }
});
test('event ejection is not a failed graduation or a tagline opportunity',()=>{
 let r=force(setup('blocked-projection'),'precareer',{id:'core.university'},[6,6]);r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});r=force(r,'education-event',{},[1,2]);
 assert.equal(r.state.character.educations[0].graduation.attempted,false);assert.equal(r.educationResultView,undefined);assert.equal(educationResultModel(r),null);
});

test('pending award completion excludes an intervening GM stat correction from graduation gains',()=>{
 const finished=graduate('core.university',[3,4]),end=structuredClone(finished.state),result=end.educationResult.result;
 const before=structuredClone(end);delete before.educationResult;before.stage='education-graduation';before.education=0;before.character.age-=4;before.character.terms-=1;before.character.stats.EDU-=1;before.character.skills.Admin-=1;before.character.skills.Medic-=1;before.character.educations[0].completed=false;delete before.character.educations[0].graduation;
 const pending=structuredClone(before);pending.stage='book-step';pending.effectNext='education-finish';pending.character.educations[0].graduation=structuredClone(result);
 const corrected=structuredClone(pending);corrected.character.stats.STR=25;end.character.stats.STR=25;
 const events=[{id:'synthetic-graduation',command:{type:'education-graduation',payload:{}}},{id:'synthetic-correction',command:{type:'gm-override',payload:{field:'stat.STR',value:25}}},{id:'synthetic-award',command:{type:'resolve-book',payload:{}}}];
 const log=[{id:'synthetic-graduation',rolls:[{label:'Graduation',kept:[3,4]}]},{id:'synthetic-correction',rolls:[]},{id:'synthetic-award',rolls:[]}];
 const model=educationResultProjection({state:end,events,log,snapshots:[before,pending,corrected,end]});
 assert.ok(model);assert.ok(model.benefits.some(x=>x.startsWith('EDU +1')));assert.equal(model.actualAwardChanges.some(c=>c.path==='stats.STR'),false);
});
