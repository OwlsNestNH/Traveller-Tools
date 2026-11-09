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
 r=studies(r);r=force(r,'education-event',{},event);
 if(r.state.stage==='education-graduation')r=force(r,'education-graduation',{},graduation);
 return r;
}
test('University flow records initial skills, event, honours and one four-year term',()=>{
 let r=university();
 assert.equal(r.state.stage,'career');assert.equal(r.state.character.age,22);assert.equal(r.state.character.terms,1);
 assert.equal(r.state.character.skills.Admin,1);assert.equal(r.state.character.skills.Medic,2);
 assert.equal(r.state.character.skills.Carouse,1);assert.equal(r.state.character.stats.EDU,9);
 const e=r.state.character.educations[0];assert.equal(e.completed,true);assert.equal(e.graduation.honours,true);
 assert.deepEqual(e.selections,{'university-0':'Admin','university-1':'Medic'});
 assert.equal(r.state.character.careers.length,0);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 assert.ok(r.log.some(e=>e.type==='education-event'));assert.ok(r.log.some(e=>e.type==='education-graduation'));
});
test('failed entry consumes no term and prevents another education attempt in the same term',()=>{
 const r=force(setup('failed-entry'),'precareer',{id:'core.university'},[1,1]);
 assert.equal(r.state.stage,'career');assert.equal(r.state.character.terms,0);assert.equal(r.state.character.age,18);
 assert.equal(r.state.canChooseEducation,false);
 assert.throws(()=>run(r,'open-precareer'),/already been attempted/);
});
test('University specialities are saved, level0 normalized and graduation raises chosen specialty',()=>{
 let r=force(setup('specialities'),'precareer',{id:'core.university'},[3,3]);
 r=run(r,'education-skill',{name:'Science (physics)'});
 assert.equal(r.state.character.skills.Science,0);assert.equal(r.state.character.skills['Science (physics)'],undefined);
 assert.throws(()=>run(r,'education-skill',{name:'Science (chemistry)'}),/Overlapping/);
 r=run(r,'education-skill',{name:'Animals (training)'});
 assert.equal(r.state.character.skills['Animals (training)'],1);
 r=force(r,'education-event',{},[2,3]);r=force(r,'education-graduation',{},[3,3]);
 assert.equal(r.state.character.skills['Science (physics)'],1);
 assert.equal(r.state.character.skills['Animals (training)'],2);
});
test('source-restricted University choices reject invalid subject or animal specialization',()=>{
 let r=force(setup('choices'),'precareer',{id:'core.university'},[3,3]);
 for(const name of ['Gun Combat (slug)','Animals (riding)','Science'])assert.throws(()=>run(r,'education-skill',{name}),/listed|specialisation/);
});
test('education tragedy preserves initial awards but skips graduation and awards',()=>{
 let r=university('tragedy',[1,2]);
 assert.equal(r.state.stage,'career');assert.equal(r.state.character.terms,1);
 assert.equal(r.state.character.educations[0].graduation.attempted,false);
 assert.equal(r.state.character.stats.EDU,8);assert.equal(r.state.character.skills.Medic,1);
 assert.throws(()=>run(r,'education-graduation'),/No graduation/);
});
test('prank total2 forces Prisoner without an active career and completes failed education',()=>{
 let r=force(setup('prison'),'precareer',{id:'core.university'},[3,3]);r=studies(r);
 const state=structuredClone(r.state);state._override={index:0,values:[1,1]};
 a.queueEffects(state,[{kind:'check',stat:'SOC',target:8,success:[{kind:'relationship',type:'Rival'}],failure:[{kind:'relationship',type:'Enemy'}],total:{2:[{kind:'education-status',graduationAllowed:false},{kind:'career-status',action:'next',career:'core.prisoner'}]}}],'education-graduation',[]);
 assert.equal(state.forcedCareer,'core.prisoner');assert.equal(state.character.sentenced,true);
 assert.equal(state.stage,'career');assert.equal(state.character.terms,1);
 assert.equal(state.character.educations[0].graduation.graduated,false);
 assert.equal(state.character.relationships.at(-1).role,'Enemy');
});
test('native life event works without active career and preserves education continuation',()=>{
 let r=force(setup('life'),'precareer',{id:'core.university'},[3,3]);r=studies(r);
 r=force(r,'education-event',{},[3,4]);assert.equal(r.state.stage,'education-graduation');
 assert.equal(r.state.pending,null);assert.deepEqual(r.state.character.lifeEvents[0].source,{id:'core',page:46});
 assert.equal(r.state.character.lifeEvents[0].row,9);assert.equal(r.state.character.lifeEvents[0].status,'completed');
 assert.ok(r.state.modifiers.some(m=>m.target==='qualification'&&m.value===2&&m.careerId==='any'));
 assert.equal(r.state.character.terms,0);assert.equal(r.state.character.educations[0].graduationAllowed,true);
 assert.equal(r.log.at(-1).rolls.length,2);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('hobby event excludes JaT and awards only level0',()=>{
 let r=force(setup('hobby'),'precareer',{id:'core.university'},[3,3]);r=studies(r);
 r=force(r,'education-event',{},[4,5]);assert.equal(r.state.stage,'education-skill');
 assert.throws(()=>run(r,'education-skill',{name:'Jack-of-all-Trades'}),/listed/);
 r=run(r,'education-skill',{name:'Engineer'});
 assert.equal(r.state.character.skills.Engineer,0);assert.equal(r.state.stage,'education-graduation');
});
test('tutor challenge can only use a skill learned this term and raises the selected one',()=>{
 let r=force(setup('tutor'),'precareer',{id:'core.university'},[3,3]);r=studies(r,'Advocate','Medic');
 r=force(r,'education-event',{},[5,5]);assert.equal(r.state.stage,'education-check');
 assert.throws(()=>run(r,'education-check',{name:'Leadership'}),/learned or improved/);
 r=force(r,'education-check',{name:'Advocate'},[5,4]);assert.equal(r.state.character.skills.Advocate,1);
 assert.equal(r.state.character.relationships.at(-1).role,'Rival');assert.equal(r.state.stage,'education-graduation');
});
test('honours qualification modifier and pre-term commission are applied in the native career flow',()=>{
 let r=university('officer');
 r=force(r,'career',{id:'core.army',assignment:'support'},[2,2]);
 assert.equal(r.state.stage,'preterm-commission');
 assert.match(r.log.at(-1).summary,/"modifier":2/);
 r=force(r,'preterm-commission',{attempt:true},[3,3]);
 while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
 assert.equal(r.state.stage,'survival');assert.equal(r.state.character.careers[0].officer,true);
 assert.equal(r.state.character.careers[0].rank,1);assert.equal(r.state.character.skills.Leadership,1);
 assert.equal(r.state.character.skills['Gun Combat (slug)'],undefined);
 assert.equal(r.state.character.skills['Gun Combat'],0);
});
test('matching academy auto-entry, honours commission and distinct service awards are integrated',()=>{
 let r=force(setup('academy'),'precareer',{id:'core.academy-army'},[4,4]);
 while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
 assert.equal(r.state.stage,'education-event');assert.equal(r.state.character.skills['Gun Combat'],0);
 r=force(r,'education-event',{},[2,3]);r=force(r,'education-graduation',{},[5,6]);
 r=run(r,'career',{id:'core.army',assignment:'support'});
 assert.equal(r.log.at(-1).rolls.length,0);assert.equal(r.state.stage,'preterm-commission');
 r=run(r,'preterm-commission',{attempt:true});
 while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});
 assert.equal(r.state.stage,'education-service');
 r=run(r,'education-service',{name:'Gun Combat'});r=run(r,'choose-skill',{name:'Gun Combat (slug)'});
 assert.equal(r.state.stage,'education-service');
 assert.throws(()=>run(r,'education-service',{name:'Gun Combat'}),/different/);
 r=run(r,'education-service',{name:'Recon'});
 r=run(r,'education-service',{name:'Vacc Suit'});
 assert.equal(r.state.stage,'survival');
 assert.equal(r.state.character.skills['Gun Combat (slug)'],1);assert.equal(r.state.character.skills.Recon,1);
 assert.equal(r.state.character.skills['Vacc Suit'],1);assert.equal(r.state.character.skills.Leadership,1);
 assert.equal(r.state.character.educations[0].serviceAwardUsed,true);
 assert.equal(r.state.character.careers[0].officer,true);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
test('failed academy total3 grants automatic entry but no pre-term commission',()=>{
 let r=force(setup('failed-academy'),'precareer',{id:'core.academy-navy'},[4,4]);
 r=force(r,'education-event',{},[2,3]);r=force(r,'education-graduation',{},[1,2]);
 r=run(r,'career',{id:'core.navy',assignment:'crew'});
 assert.equal(r.log.at(-1).rolls.length,0);
 assert.equal(r.state.stage,'survival');assert.equal(r.state.character.careers[0].commissionBlockedFirstTerm,true);
});
test('psionic education opportunity tests potential and grants recorded permission without talents',()=>{
 let r=force(setup('psion'),'precareer',{id:'core.university'},[3,3]);r=studies(r);
 r=force(r,'education-event',{},[1,1]);assert.equal(r.state.stage,'effect-choice');
 r=run(r,'choose-effect',{index:0});
 assert.equal(r.state.character.psionEntryPermission,true);
 assert.ok(Object.hasOwn(r.state.character.stats,'PSI'));
 assert.equal(r.state.character.skills.Telepathy,undefined);
});
test('interface source is valid UTF8, includes education controls and stage-change focus',async()=>{
 const app=await readFile(new URL('../gui/app.mjs',import.meta.url),'utf8');
 const engine=await readFile(new URL('../engine/session.mjs',import.meta.url),'utf8');
 for(const text of [app,engine]){assert.ok(!text.includes('\uFFFD'));assert.ok(!text.includes('\u001a'));}
 assert.match(app,/focusAfterAction\(previousStage,focused\)/);assert.match(app,/tabindex="-1"/);
 assert.match(app,/education-graduation/);assert.match(app,/education-service/);
 assert.match(app,/Debt/);assert.match(app,/historyNotes/);assert.match(app,/futureConditions/);
});
