import assert from 'node:assert/strict';
import test from 'node:test';
import {ARMY_TEMPLATE,careerTemplateModel,armyOutcome,armyTagline,armyResultTagline,careerPhase,armyRecordedDice} from '../gui/career-template.mjs';
import {CAREERS} from '../engine/catalog.mjs';
import {api} from '../engine/session.mjs';
import {careerOutcomeSummary} from '../engine/career-outcome-summary.mjs';
import {getCoreCareerPack} from '../engine/core-pack.mjs';
const catalog=api({operation:'catalog'}),career=CAREERS.find(c=>c.id==='core.army');
const state={stage:'training',active:0,character:{species:'human',careers:[{id:'core.army',assignment:'infantry',rank:1,officer:false}]}};
test('Army template reuses exact source rank/reward grid without rule duplication',()=>{assert.equal(catalog.careerPresentation['core.army'].ranks.enlisted[1].reward,careerOutcomeSummary(getCoreCareerPack('core.army').ranks.enlisted[1].effects));const before=JSON.stringify(state),model=careerTemplateModel(state,catalog);assert.equal(model.rank.title,'Lance Corporal');assert.equal(model.rank.reward,'Recon at least level 1.');assert.equal(JSON.stringify(state),before);assert.equal(careerTemplateModel({...state,character:{...state.character,species:'aslan'}},catalog),null);const navy=careerTemplateModel({...state,character:{...state.character,careers:[{id:'core.navy',assignment:'crew',rank:0,officer:false}]}},catalog);assert.equal(navy.template.id,'core.navy');assert.equal(navy.template.page,36);});
test('specialty count is data driven for two, three or four entries',()=>{for(const count of [2,3,4]){const assignments=Array.from({length:count},(_,i)=>career.assignments[i]??{id:'synthetic-extra',name:'Synthetic extra specialty'});const model=careerTemplateModel({...state,stage:'career',careerChoices:[{...career,assignments}]},catalog,'core.army');assert.equal(model.specialties.length,count);assert.deepEqual(model.specialties.map(s=>s.name),assignments.map(a=>a.name));}});
test('current rank shows commissioned title and does not award rewards',()=>{const model=careerTemplateModel({...state,character:{...state.character,careers:[{...state.character.careers[0],officer:true,rank:3}]}},catalog);assert.equal(model.rank.title,'Major');assert.equal(model.rank.reward,'Tactics (military) at least level 1.');});
test('cosmetic outcome categories follow actual validated results, not natural dice',()=>{assert.equal(armyOutcome({type:'survival-check'},{status:'failure'}),'army.survival-failed');assert.equal(armyOutcome({type:'survival-check'},{status:'success'}),'army.survived');assert.equal(armyOutcome({type:'career-event'},{}),'army.event');assert.equal(armyOutcome({type:'benefit'},{}),'army.benefit');assert.equal(armyOutcome({type:'commission',summary:'Commission: {"success":true,"total":14,"target":8}.'},{status:'success'}),'army.exceptional');assert.equal(armyOutcome({type:'commission',rolls:[{total:12}]},{status:'success'}),'army.success');assert.equal(armyOutcome({type:'restore'},{status:'success'}),null);});
test('six variants are reachable, stable, and independent of generation random state',()=>{for(const [event,result] of [[{type:'career'},{status:'success'}],[{type:'career'},{status:'failure'}],[{type:'survival-check'},{status:'failure'}],[{type:'survival-check'},{status:'success'}],[{type:'career-event'},{}],[{type:'training'},{}],[{type:'choose-skill'},{}],[{type:'benefit'},{}],[{type:'commission',summary:'Commission: {"success":true,"total":14,"target":8}.'},{status:'success'}]]){const values=new Set();for(let i=0;i<300;i++){const e={...event,id:'synthetic-'+i},a=armyTagline(e,result);assert.equal(a,armyTagline(e,result));values.add(a);}assert.equal(values.size,6);}});

test('last Army benefit retains its comment after leaving; another career does not inherit it',()=>{const event={id:'last-benefit',type:'benefit'},result={status:'info'};const exited={...state,active:null,stage:'career'};assert.equal(armyResultTagline(event,result,exited),armyTagline(event,result));assert.equal(armyResultTagline(event,result,{...exited,character:{...exited.character,careers:[...exited.character.careers,{id:'core.navy'}]}}),null);assert.equal(armyResultTagline(event,result,{...exited,character:{...exited.character,species:'aslan'}}),null);});

test('benefit consequence choices remain in mustering out; unrelated later choices do not receive Army tags',()=>{assert.equal(careerTemplateModel({...state,stage:'effect-choice',effectNext:'benefit-complete'},catalog).phase,6);const inactive={...state,active:null,stage:'education-skill'};assert.equal(armyResultTagline({id:'later-study',type:'choose-skill'},{status:'info'},inactive),null);assert.equal(armyResultTagline({id:'next-entry',type:'career'},{status:'failure'},{...inactive,stage:'failed-entry',character:{...inactive.character,careerTransitions:[{toCareerId:'core.navy'}]}}),null);});

test('actual Army engine benefit events select the benefit bank and material choices keep their phase',async()=>{
 const {buildAssignmentFixture,run,force}=await import('./assignment-fixtures.mjs');
 const ready=run(buildAssignmentFixture({careerId:'core.army'}),'leave-career');
 const cash=run(ready,'benefit',{cash:true}),event=cash.log.at(-1);
 assert.equal(event.type,'benefit');assert.equal(armyOutcome(event,{status:'info'}),'army.benefit');assert.ok(armyResultTagline(event,{status:'info'},cash.state));
 const material=force(ready,'benefit',{cash:false},[6]);
 assert.equal(material.state.stage,'effect-choice');assert.equal(material.state.effectNext,'benefit-complete');assert.equal(careerTemplateModel(material.state,catalog).phase,6);
});

test('unknown or exceptional steps never invent a mustering-out instruction',()=>{assert.equal(careerPhase('psionic-games-final'),null);assert.equal(careerPhase('deceased'),null);assert.equal(careerPhase('unknown-future-stage'),null);assert.equal(careerPhase('benefits'),6);});

test('a verified failed event check uses failure copy rather than the neutral event bank',()=>{assert.equal(armyOutcome({id:'checked-event',type:'career-event'},{status:'failure'}),'army.failure');assert.equal(armyOutcome({id:'checked-event',type:'career-event'},{status:'pending'}),'army.event');assert.equal(armyOutcome({id:'checked-event',type:'career-event'},{status:'success'}),'army.success');});

test('gold dice use recorded faces without RNG or fabricated placeholders',()=>{const event={rolls:[{label:'Survival',values:[2,6],total:8}]},before=JSON.stringify(event),esc=s=>String(s).replaceAll('<','&lt;');const html=armyRecordedDice(event,{esc});assert.equal((html.match(/<svg/g)??[]).length,2);assert.match(html,/Recorded dice: 2, 6/);assert.match(html,/Recorded total: 8/);assert.equal(JSON.stringify(event),before);assert.match(armyRecordedDice({rolls:[{values:[0,7]}]},{esc}),/Recorded total unavailable/);});

test('all three Army specialties complete native training, rank rewards, commission and benefits',async()=>{
 const {assignmentSetup,run,force,settleAssignment}=await import('./assignment-fixtures.mjs');
 const {api,exportSession}=await import('../engine/session.mjs');
 for(const assignment of ['support','infantry','cavalry']){
  let entry=run(assignmentSetup('army-all-specialties-'+assignment),'skip-precareer');entry=settleAssignment(force(entry,'career',{id:'core.army',assignment},[6,6]));
  assert.equal(entry.state.character.careers[0].assignment,assignment);assert.ok(entry.state.character.skills['Gun Combat (slug)']>=1);
  let event=force(entry,'survival-check',{},[6,6]);event=settleAssignment(force(event,'career-event',{},[4,5]));
  const commissioned=settleAssignment(force(event,'commission',{},[6,6]));assert.equal(commissioned.state.character.careers[0].officer,true);assert.ok(commissioned.state.character.skills.Leadership>=1);assert.equal(careerTemplateModel(commissioned.state,catalog).rank.title,'Lieutenant');
  let promoted=settleAssignment(force(event,'advancement',{},[4,4]));assert.equal(promoted.state.character.careers[0].rank,1);assert.ok(promoted.state.character.skills.Recon>=1);
  if(promoted.state.stage==='training')promoted=settleAssignment(force(promoted,'training',{table:'personal'},[1]));
  let next=run(promoted,'continue-career');assert.ok(next.state.trainingOptions.some(t=>t.id==='assignment'));next=settleAssignment(force(next,'training',{table:'assignment'},[1]));assert.equal(next.state.stage,'survival');assert.equal(next.state.character.careers[0].assignment,assignment);
  const benefits=run(run(promoted,'leave-career'),'benefit',{cash:true});assert.equal(benefits.state.cashRolls,1);assert.ok(benefits.state.character.cash>0);assert.equal(api({operation:'import',raw:exportSession(benefits.session)}).ok,true);
 }
});

test('check dice show recorded modifiers, target and outcome without inferring from faces',()=>{const esc=String;const event={type:'survival-check',summary:'Survival: {"natural":8,"total":10,"target":6,"success":true}.',rolls:[{label:'Survival',values:[5,3],total:8}]};const html=armyRecordedDice(event,{esc});assert.match(html,/\+ 2 = 10/);assert.match(html,/Total 10 · Target 6\+ · Success/);assert.doesNotMatch(armyRecordedDice({...event,summary:'Survival: {"natural":7,"total":10,"target":6,"success":true}.'},{esc}),/army-dice-equation/);});

test('Crow tone uses explicit outcome status and keeps new choices informational',async()=>{const {careerCrowTone}=await import('../gui/career-template.mjs');assert.equal(careerCrowTone('success'),'success');assert.equal(careerCrowTone('failure'),'failure');for(const status of [null,undefined,'information','error'])assert.equal(careerCrowTone(status),'information');assert.equal(careerCrowTone('failure',true),'information');assert.equal(careerCrowTone('success',true),'information');});

test("Army contextual rule information has verified book pages and publisher link",async()=>{const {armyRuleInformation}=await import("../gui/career-template.mjs");for(let phase=0;phase<7;phase++){const info=armyRuleInformation(phase);assert.equal(info.book,"Core Rulebook Update 2022");assert.ok([24,25].includes(info.page));assert.equal(info.url,"https://www.mongoosepublishing.com/products/traveller-core-rulebook-update-2022");assert.ok(info.summary.length>50);}assert.equal(armyRuleInformation(3).page,25);});

test("specialty summaries project names without effect levels or table rows",()=>{const names=catalog.careerPresentation["core.army"].specialtySkills;assert.deepEqual(Object.keys(names),["support","infantry","cavalry"]);assert.deepEqual(names.support,["Drive","Electronics (comms)","Explosives","Flyer","Mechanic","Medic","Profession"]);assert.deepEqual(names.infantry,["Athletics","Gun Combat","Heavy Weapons","Melee","Recon","Stealth"]);assert.deepEqual(names.cavalry,["Drive","Electronics (sensors)","Flyer","Heavy Weapons (vehicle)","Mechanic","Recon"]);const model=careerTemplateModel(state,catalog);for(const specialty of model.specialties)assert.deepEqual(specialty.skills,names[specialty.id]);});

test('Army first service training explicitly offers Drive or Vacc Suit and records only the selected award',async()=>{
 const {assignmentSetup,run}=await import('./assignment-fixtures.mjs');
 const entry=run(run(assignmentSetup('army-pilot-1'),'skip-precareer'),'career',{id:'core.army',assignment:'support'});
 assert.equal(entry.state.stage,'effect-choice');assert.deepEqual(entry.state.pendingChoice.options.map(o=>o.label),['Drive','Vacc Suit']);
 assert.deepEqual(getCoreCareerPack('core.army').training.service[0][0].options.map(o=>o.label),['Drive','Vacc Suit']);
 const raw=JSON.stringify(entry.session);for(const [index,name,other] of [[0,'Drive','Vacc Suit'],[1,'Vacc Suit','Drive']]){
  assert.equal(entry.state.character.skills[name],undefined);const result=run(entry,'choose-effect',{index});assert.equal(result.state.character.skills[name],0);assert.equal(result.state.character.skills[other],undefined);assert.equal(result.session.events.length,entry.session.events.length+1);assert.equal(result.state.rng,entry.state.rng);assert.equal(JSON.stringify(entry.session),raw);
  const replay=api({operation:'import',raw:JSON.stringify(result.session)});assert.equal(replay.ok,true);assert.equal(replay.state.character.skills[name],0);assert.equal(replay.state.character.skills[other],undefined);
 }
});

test('each gold face contains its stored number of pips, independently of the total',()=>{
 for(let face=1;face<=6;face++){
  const event={rolls:[{label:'Recorded roll',values:[face],total:99}]},before=JSON.stringify(event);
  const html=armyRecordedDice(event,{esc:String});
  assert.equal((html.match(/<circle\b/g)??[]).length,face);
  assert.match(html,/Recorded total: 99/);assert.equal(JSON.stringify(event),before);
 }
 const html=armyRecordedDice({rolls:[{values:[2,6],total:8}]},{esc:String});
 const svg=[...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(x=>x[0]);
 assert.deepEqual(svg.map(x=>(x.match(/<circle\b/g)??[]).length),[2,6]);
});
test('raw faces remain visible with separate kept values, conversions and signed adjustments',()=>{
 for(const roll of [{values:[2,6,6],kept:[6,6],total:12},{label:'Damage (2D3-1)',values:[3,6],kept:[2,3],modifier:-1,total:4}]){
  const event={rolls:[roll]},before=JSON.stringify(event),html=armyRecordedDice(event,{esc:String});
  assert.equal((html.match(/<svg\b/g)??[]).length,roll.values.length);
  assert.match(html,/Kept dice:|Converted D3 values:/);
  if(roll.modifier)assert.match(html,/Roll adjustment: -1/);
  assert.equal(JSON.stringify(event),before);
 }
 for(const values of [undefined,[],[0],[7],[2,NaN]]){
  const html=armyRecordedDice({rolls:[{values,total:8}]},{esc:String});
  assert.match(html,/recorded-total-die/);assert.match(html,/>8<\/span>/);assert.match(html,/>Total<\/span>/);assert.equal((html.match(/<svg\b/g)??[]).length,0);assert.match(html,/Recorded total: 8/);
 }
});

test('checked boon equation identifies the kept subtotal instead of summing discarded raw faces',()=>{
 const event={type:'survival-check',summary:'Survival: {"natural":11,"total":12,"target":8,"success":true}.',rolls:[{label:'Survival',values:[1,5,6],kept:[6,5],total:11}]};
 const html=armyRecordedDice(event,{esc:String});assert.match(html,/Natural 11 \+ 1 = 12/);assert.match(html,/Kept dice: 6, 5/);assert.match(html,/Recorded dice: 1, 5, 6/);
});

test('a checked result with unavailable faces still identifies its recorded natural subtotal',()=>{
 const event={type:'survival-check',summary:'Survival: {"natural":11,"total":12,"target":8,"success":true}.',rolls:[{label:'Survival',total:11}]};
 const html=armyRecordedDice(event,{esc:String});assert.match(html,/recorded-total-die/);assert.match(html,/>11<\/span>/);assert.match(html,/\+ 1 = 12/);assert.match(html,/Final total 12 · Target 8\+ · Success/);assert.equal((html.match(/<svg\b/g)??[]).length,0);
});
