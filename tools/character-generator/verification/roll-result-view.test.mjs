import test from 'node:test';
import assert from 'node:assert/strict';
import {rollResult,characterEffectDetails,modifierEffectDetails} from '../gui/roll-result-view.mjs';
import {CAREERS,SPECIES} from '../engine/catalog.mjs';
import {characterChanges} from '../engine/audit.mjs';
import {laterTermVargrFixture,run} from './survival-result-fixtures.mjs';
import {exportSession} from '../engine/session.mjs';
const catalog={careers:CAREERS};
const event=(changes=[],extra={})=>({type:'training',summary:'Training service result 3.',rolls:[{label:'Training: service',total:3,values:[3]}],changes,...extra});
test('all released species and every career use the same concrete roll/effect presentation',()=>{
 for(const species of SPECIES)for(const career of CAREERS){
  const before={species:species.id,stats:{INT:7},skills:{},careers:[]};
  const after={...before,stats:{INT:8},skills:{Medic:1},careers:[{id:career.id,assignment:career.assignments[0].id,rank:0}]};
  const result=rollResult(event(characterChanges(before,after)),{character:after},catalog);
  assert.match(result.text,/Training: service: 3/);assert.match(result.text,/Skill Medic: untrained → 1/);assert.match(result.text,/Intellect: 7 → 8/);
  assert.ok(result.text.includes(career.name));assert.doesNotMatch(result.text,/careers\.0|stats\.INT|\{"/);
 }
});
test('actual audited gains, losses, finances, injuries and entitlement are all visible',()=>{
 const before={stats:{STR:8},skills:{Medic:0},cash:5000,debt:0,relationships:[{role:'Contact',name:'Lost friend'}]};
 const after={stats:{STR:6},skills:{Medic:1},cash:4000,debt:2000,qualificationBanned:true,medicalCosts:3000,relationships:[{role:'Ally',name:'New friend'},{role:'Enemy',name:'Rival'}],benefits:[{name:'Clan Share',quantity:2}],assets:[{name:'Scout Ship',ownership:'borrowed',mortgagePaidPercent:0}],injuries:[{tableResult:2,completed:true,losses:{STR:2},restoration:{STR:1},statsAfterTreatment:{STR:7}}],medicalBills:[{personalCost:3000,coveredCost:1000,settled:true,paid:1000,debt:2000}],careers:[{rank:2,benefitRolls:3,forcedExit:true,pensionEntitlement:{annualCredits:10000}}],futureConditions:[{trigger:'expose-secret',effects:[{kind:'relationship',type:'Enemy'}]}]};
 const text=rollResult(event(characterChanges(before,after)),{},catalog).text;
 for(const expected of ['Strength: 8 → 6','Medic: 0 → 1','Ally','New friend','Enemy','Rival','Clan Share × 2','Scout Ship (borrowed)','Injury result 2','Injury loss: Strength −2','Treatment restores Strength +1','Cr3,000 owed personally','Cr1,000 paid, Cr2,000 debt','qualification is barred','Benefit rolls: none → 3','Must leave','Pension entitlement: Cr10,000 annually','expose secret → Enemy'])assert.ok(text.includes(expected),expected+' missing from '+text);
 assert.doesNotMatch(text,/\{"|futureConditions|medicalBills|careers\.0/);
});
test('all roll categories are identified individually even without a known summary parser',()=>{
 const labels=['STR','Qualification','Draft','Education entry','Training: assignment','Survival','Event table','Mishap table','Skill check','Commission','Advancement','Ageing','Injury table','Injury severity','Medical coverage','Cash result','Material benefit','Psionic strength','Psionic talent','Aslan Rite'];
 const result=rollResult(event([],{summary:'Unknown: {"internal":"not player prose"}',rolls:labels.map(label=>({label,total:6,values:[3,3]}))}),{},catalog);
 for(const label of labels)assert.ok(result.text.includes(label+(/check|survival|advancement|commission|qualification/i.test(label)?' dice total: ':': ')+'6.'));
 assert.doesNotMatch(result.text,/\[3, 3\]/);
 assert.doesNotMatch(result.text,/internal|succeeded|failed/);
});
test('source decisions and unresolved choice are pending, never fictitious awards',()=>{
 const result=rollResult(event([],{summary:'Training table requires source resolution.'}),{stage:'book-step',pending:{label:'Resolve special training'}},catalog);
 assert.equal(result.status,'pending');assert.match(result.text,/Pending source resolution: Resolve special training/);assert.doesNotMatch(result.text,/Skill .*untrained/);
 const choice=rollResult(event(),{stage:'skill-choice',pendingChoice:{label:'Choose a Science specialisation'}},catalog);
 assert.match(choice.text,/Pending: Choose a Science specialisation/);
});
test('unknown changed objects do not leak raw JSON, property paths or internal effects',()=>{
 const result=rollResult(event([{path:'hidden.0.internal',after:{secret:'no'}},{path:'unknown.0',after:{effects:[{kind:'secret'}]}}]),{},catalog);
 assert.doesNotMatch(result.text,/secret|hidden|internal|unknown/);
});
test('future modifiers use actual additions and distinguish scope',()=>{
 const old={target:'survival',value:1,scope:'all',careerId:'core.army'};
 const bonus={target:'advancement',value:4,scope:'next',careerId:'vargr.agent'};
 const result=rollResult(event([],{modifierChanges:{before:[old],after:[old,bonus]}}),{},catalog);
 assert.match(result.text,/Advancement modifier \+4 for the next applicable check in Agent/);assert.doesNotMatch(result.text,/Survival modifier/);
 assert.deepEqual(modifierEffectDetails({modifiers:[old]},{modifiers:[old]},catalog),[]);
});
test('real later-term Vargr event and romance results retain every roll and saved history',()=>{
 for(const r of laterTermVargrFixture()){
  const saved=exportSession(r.session),before=structuredClone(r.log),last=r.log.at(-1),result=rollResult(last,r.state,catalog);
  assert.match(result.text,/Survival succeeded/);
  for(const roll of last.rolls.filter(r=>r.label!=='Survival'))assert.ok(result.text.includes(String(roll.total)));
  if(last.rolls.some(r=>r.label==='Event table'&&r.total===11))assert.match(result.text,/Available advancement DM: \+4/);
  if(last.rolls.some(r=>r.label==='vargr.life-events (2D)'&&r.total===5))assert.match(result.text,/romantic relationship/);
  assert.equal(exportSession(r.session),saved);assert.deepEqual(r.log,before);
 }
});
test('failed survival and advancement distinguish roll success from promotion',()=>{
 const r=laterTermVargrFixture()[0],revision=r.session.events.findIndex(e=>e.command.type==='survival')+1;
 const failed=run(r,'gm-replay',{revision,rollIndex:0,values:[1,1],reason:'Result display regression'});
 assert.match(rollResult(failed.log.at(-1),failed.state,catalog).text,/Survival failed.*Mishap rolled/);
 const advancement=rollResult(event([],{type:'advancement',summary:'Advancement: {"total":8,"target":6,"success":true}. Rank 0.'}),{},catalog);
 assert.match(advancement.text,/Advancement succeeded.*Rank remains 0/);assert.doesNotMatch(advancement.text,/Promoted/);
});
test('life event identities are not duplicated by punctuation and removed modifiers are explicit',()=>{
 const result=rollResult(event([],{rolls:[{label:'vargr.life-events (2D)',total:5,values:[2,3]}],modifierChanges:{before:[{target:'advancement',value:4,careerId:'vargr.agent'}],after:[]}}),{},catalog);
 assert.equal(result.details.filter(s=>s.startsWith('Vargr Life Event 5')).length,1);
 assert.match(result.text,/Advancement modifier \+4 is no longer available/);
});
test('proposed treatment is not presented as applied until committed treatment statistics exist',()=>{
 const injury={tableResult:2,restoration:{STR:2},losses:{STR:2}};
 const pending=rollResult(event([{path:'injuries.0',after:injury}]),{},catalog);
 assert.match(pending.text,/Proposed treatment \(pending\): Strength \+2/);assert.doesNotMatch(pending.text,/Treatment restores/);
 const applied=rollResult(event([{path:'injuries.0',after:{...injury,statsAfterTreatment:{STR:8}}}]),{},catalog);
 assert.match(applied.text,/Treatment restores Strength \+2/);assert.doesNotMatch(applied.text,/Proposed treatment/);
});
test('use-only ships retain Clan or Pack ownership and recall restrictions',()=>{
 for(const owner of ['Clan','Pack']){
  const result=rollResult(event([{path:'assets.0',after:{name:'Scout Ship',ownership:'use',owner,recallable:true}}]),{},catalog);
  assert.match(result.text,/Scout Ship \(use only\)/);assert.ok(result.text.includes('Owned by '+owner));assert.match(result.text,/May be recalled by the owner/);
 }
});
test('specialized adjusted checks and awards are not duplicated by raw totals or generic effects',()=>{
 const result=rollResult(event([{path:'skills.Medic',before:0,after:1},{path:'careers.0.rank',before:0,after:1}],{type:'advancement',summary:'Advancement: {"total":8,"target":6,"success":true}. Rank 1.',rolls:[{label:'Advancement',total:6,values:[3,3]},{label:'Cash result',total:4,values:[4]}]}),{},catalog);
 assert.match(result.text,/Check total 8 against target 6/);assert.doesNotMatch(result.text,/Advancement: 6|Advancement dice total|\[3, 3\]/);
 assert.equal((result.text.match(/Medic:/g)??[]).length,1);assert.equal((result.text.match(/rank 0 → 1/gi)??[]).length,1);assert.match(result.text,/Cash result: 4/);
});
test('benefit wagers report benefit roll counts, never credits',()=>{
 for(const delta of [-2,2]){
  const text=rollResult(event([{path:'benefitWagers.0.delta',after:delta}]),{},catalog).text;
  assert.ok(text.includes('Benefit rolls: '+(delta>0?'+':'')+delta));assert.doesNotMatch(text,/Cr/);
 }
});
test('new automatic rights are pending entitlements, not already-applied promotions',()=>{
 const before={forcedCareer:null,automaticCareers:[],careers:[{id:'core.army'}]};
 const after={forcedCareer:'core.prisoner',automaticCareers:['core.agent'],careers:[{id:'core.army',automaticPromotion:true,automaticCommission:true,commissionBlockedFirstTerm:true}]};
 const result=rollResult(event([],{pendingEffectChanges:{before,after}}),{},catalog);
 assert.match(result.text,/Required next career: Prisoner/);assert.match(result.text,/Automatic entry available: Agent/);
 assert.match(result.text,/Automatic promotion is pending in Army/);assert.match(result.text,/Automatic commission is pending in Army/);assert.match(result.text,/First-term commission restriction applies in Army/);assert.doesNotMatch(result.text,/Promoted:|Commissioned as/);
 const used=rollResult(event([],{pendingEffectChanges:{before:after,after:before}}),{},catalog);
 assert.match(used.text,/Automatic promotion is no longer pending/);assert.match(used.text,/Automatic entry right no longer available/);
});
test('pending life event choices name both concrete offered effects',()=>{
 const result=rollResult(event(),{stage:'effect-choice',pendingChoice:{},lifeEventPresentation:{description:'Choose one Benefit roll or Charisma +1.'}},catalog);
 assert.match(result.text,/Pending: Choose one Benefit roll or Charisma \+1/);
});
