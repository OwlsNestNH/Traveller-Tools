import test from'node:test';import assert from'node:assert/strict';
import{api,project,exportSession}from'../engine/session.mjs';
import{assignmentSetup,run,force}from'./assignment-fixtures.mjs';
import{basicTrainingChoiceModel}from'../gui/basic-training-presentation.mjs';
import{skillAwardSource,pendingAwardInformation,skillAwardResult}from'../gui/skill-award-provenance.mjs';
const catalog=api({operation:'catalog'}),origin={kind:'basic-training',careerId:'core.army',source:{id:'core',page:25}};
test('training labels expose the actual fixed award rather than inventing a specialised level',()=>{
 const state={stage:'effect-choice',pendingChoice:{kind:'choice',options:[{label:'Drive',effects:[{kind:'skill',name:'Drive',mode:'set',value:0}]},{label:'Pilot (small craft)',effects:[{kind:'skill',name:'Pilot',mode:'set',value:0}]}]}};
 const before=structuredClone(state),model=basicTrainingChoiceModel(state,origin,catalog);assert.equal(model.fixedLevel,0);assert.equal(model.options[0].label,'Drive 0');assert.equal(model.options[1].label,'Pilot (small craft)');assert.equal(model.options[1].detail,'Awards Pilot 0');assert.deepEqual(state,before);
 assert.equal(basicTrainingChoiceModel(state,{kind:'rank',careerId:'core.army',rank:0},catalog),null);assert.equal(basicTrainingChoiceModel(state,null,catalog),null);
});
test('mixed or nested effects do not masquerade as a single fixed skill award',()=>{
 const model=basicTrainingChoiceModel({stage:'effect-choice',pendingChoice:{kind:'choice',options:[{label:'An option',effects:[{kind:'stat',stat:'EDU',value:1}]}]}},origin,catalog);assert.equal(model.fixedLevel,null);assert.equal(model.title,'Choose a basic training option');assert.equal(model.options[0].detail,null);
});
for(const[id,assignment,skill]of[['core.army','infantry','Drive'],['core.scholar','field','Drive'],['core.scout','courier','Pilot']])test(id+' basic training has producer evidence, preserved history and distinct rank rewards',()=>{
 let r=force(run(assignmentSetup('training-context-'+id),'skip-precareer'),'career',{id,assignment},[6,6]);const raw=exportSession(r.session),p=r.skillAwardPresentation.pending;assert.equal(r.state.stage,'effect-choice');assert.equal(p.kind,'basic-training');assert.equal(p.careerId,id);assert.equal(p.firstCareer,true);assert.equal(p.table,'service');assert.match(skillAwardSource(p,catalog),/basic training award/);
 const model=basicTrainingChoiceModel(r.state,p,catalog);assert.equal(model.fixedLevel,0);assert.match(model.instruction,/level 0/);const info=pendingAwardInformation(r.skillAwardPresentation,r.state,catalog);assert.match(info.paragraphs.join(' '),/separate from academy awards and actual rank rewards/);assert.match(info.source,/Core Rulebook/);
 const imported=api({operation:'import',raw});assert.deepEqual(imported.state,r.state);assert.deepEqual(imported.log,r.log);assert.deepEqual(imported.skillAwardPresentation,r.skillAwardPresentation);assert.equal(exportSession(imported.session),raw);assert.equal(Object.keys(project(r.session)).includes('skillAwardPresentation'),false);
 r=run(r,'choose-effect',{index:0});assert.equal(r.state.character.skills[skill],0);const awards=r.skillAwardPresentation.byAction[r.revision]??[];assert.ok(awards.some(a=>a.name===skill&&a.origin.kind==='basic-training'&&a.after===0));if(id==='core.army'){assert.equal(r.state.stage,'skill-choice');assert.equal(r.skillAwardPresentation.pending.kind,'rank');assert.equal(r.skillAwardPresentation.pending.rank,0);assert.equal(r.state.pendingChoice.value,1);}
});

test('automatic basic-training metadata does not replace an accepted entry result with a long skill list',()=>{const result={title:'Entered Army / Infantry.',details:['Qualification succeeded.']};assert.equal(skillAwardResult(result,[{name:'Recon',after:0,changed:true,origin}],catalog,{event:{type:'career'}}),result);});
