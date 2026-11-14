import{nobleInjuryTreatmentFixture}from'./injury-presentation-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../engine/session.mjs';
import {conciseResult} from '../gui/concise-result.mjs';
import {injuryRecordedDiceEvent} from '../gui/career-template.mjs';
const injury={tableResult:1,tableRolls:[1],severityDie:4,losses:{STR:4,DEX:2,END:2}};
const event={type:'injury-loss',summary:'Injury loss selected: STR -4, DEX -2, END -2.',rolls:[],changes:[{path:'stats.STR',before:7,after:3}]};
test('treatment keeps actual injury/loss concise and billing explanations informational',()=>{
 const state={stage:'injury-treatment',currentInjury:injury,active:0,character:{species:'human',careers:[{id:'core.army',assignment:'infantry',rank:0}],stats:{},skills:{}}},before=JSON.stringify({state,event}),r=conciseResult(event,state,catalog());
 assert.equal(r.title,'STR −4 · DEX −2 · END −2.');assert.deepEqual(r.details,['Injury table result 1. Choose treatment below.']);
 assert.match(r.information.paragraphs.join(' '),/Cr5,000.*2D.*rank.*unpaid.*debt/);assert.match(r.information.paragraphs.join(' '),/Strength: 7 → 3/);
 assert.equal(JSON.stringify({state,event}),before);
});
test('loss choice and treatment retain separate accepted table/severity dice, fixed outcomes invent none',()=>{
 for(const stage of ['injury-loss','injury-treatment'])assert.deepEqual(injuryRecordedDiceEvent({stage,currentInjury:injury},event).rolls.map(r=>[r.label,r.values]),[['Injury table',[1]],['Injury severity',[4]]]);
 assert.deepEqual(injuryRecordedDiceEvent({stage:'injury-loss',currentInjury:{tableResult:2,tableRolls:[],severityDie:4}},event).rolls.map(r=>r.label),['Injury severity']);
 assert.equal(injuryRecordedDiceEvent({stage:'career-event'},event),event);
});

test('no-career education and unsupported legacy species keep their complete established result',()=>{
 for(const character of [{species:'human',careers:[]},{species:'aezorgh',careers:[{id:'core.army',assignment:'infantry',rank:0}]}]){
 const r=conciseResult(event,{stage:'injury-treatment',currentInjury:injury,active:character.careers.length?0:null,character},catalog());assert.notEqual(r.information?.label,'About your injury and medical care');assert.match(r.text,/Strength: 7 → 3/);
 }
});
for(const personalCost of[0,10000])test('treatment completion leads with the actual personal bill '+personalCost,()=>{
 const state={stage:'term-end',active:0,character:{species:'human',careers:[{id:'core.army',assignment:'infantry',rank:0,forcedExit:true}],stats:{},skills:{},injuries:[{id:'injury-1',restoration:{STR:4}}]}};
 const event={type:'injury-treatment',summary:'Treatment recorded.',rolls:[{label:'Medical contribution',values:[2,3],total:5}],changes:[{path:'medicalBills.0',before:null,after:{injuryId:'injury-1',totalCost:40000,coveredCost:40000-personalCost,personalCost}},{path:'stats.STR',before:3,after:7}]};const before=JSON.stringify({state,event}),r=conciseResult(event,state,catalog());
 assert.equal(r.title,personalCost?'Medical bill: Cr10,000.':'No personal medical bill.');assert.match(r.text,personalCost?/Medical bill: Cr10,000/:/No personal medical bill/);assert.match(r.details.join(' '),/Leave this career/);assert.doesNotMatch(r.details.join(' '),/Strength|Source|Mishap/);assert.match(r.information.paragraphs.join(' '),/Treatment Cr40,000; employer contribution/);assert.equal(injuryRecordedDiceEvent(state,event),event);assert.equal(JSON.stringify({state,event}),before);
});

test('treatment keeps newly drained consequences visible while suppressing restoration duplication',()=>{
 const state={stage:'skill-choice',active:0,character:{species:'human',careers:[{id:'core.noble',assignment:'administrator',rank:0}],stats:{STR:7,SOC:7},skills:{},injuries:[{id:'injury-1',restoration:{STR:4,DEX:2,END:2}}]}};
 const event={type:'injury-treatment',summary:'Treatment recorded.',rolls:[],changes:[{path:'stats.STR',before:3,after:7},{path:'stats.SOC',before:8,after:7},{path:'medicalBills.0',before:null,after:{injuryId:'injury-1',totalCost:40000,coveredCost:30000,personalCost:10000}},{path:'relationships.0',before:null,after:{role:'Enemy',name:'Duel opponent'}}]};
 const r=conciseResult(event,state,catalog());assert.match(r.details.join(' '),/Social standing: 8 → 7/);assert.match(r.details.join(' '),/Duel opponent/);assert.doesNotMatch(r.details.join(' '),/Strength: 3 → 7/);assert.match(r.text,/Cr10,000/);
});

test('actual Noble duel retains its SOC penalty when treatment drains the event continuation',()=>{
 const r=nobleInjuryTreatmentFixture(),event=r.log.at(-1),before=JSON.stringify(r),view=conciseResult(event,r.state,catalog());
 assert.equal(event.type,'injury-treatment');assert.deepEqual(event.changes.find(c=>c.path==='stats.SOC'),{path:'stats.SOC',before:11,after:10});assert.match(view.details.join(' '),/Social standing: 11 → 10/);assert.doesNotMatch(view.details.join(' '),/Strength:|Dexterity:|Endurance:/);assert.equal(view.title,'Medical bill: Cr40,000.');assert.deepEqual(injuryRecordedDiceEvent(r.state,event).rolls.map(v=>v.values),[[1],[4]]);assert.equal(JSON.stringify(r),before);
});

test('a distinct physical continuation loss remains visible after recorded restoration',()=>{
 const state={stage:'effect-choice',active:0,character:{species:'human',careers:[{id:'core.noble',assignment:'administrator',rank:0}],stats:{STR:6},skills:{},injuries:[{id:'injury-1',restoration:{STR:4}}]}};
 const event={type:'injury-treatment',summary:'Treatment recorded.',rolls:[],changes:[{path:'stats.STR',before:3,after:6},{path:'medicalBills.0',before:null,after:{injuryId:'injury-1',totalCost:20000,coveredCost:0,personalCost:20000}}]};
 const view=conciseResult(event,state,catalog());assert.match(view.details.join(' '),/Strength: 7 → 6/);assert.doesNotMatch(view.details.join(' '),/Strength: 3 → 6/);
});

test('explicit referee preservation of all physical scores has a meaningful no-loss headline',()=>{
 const state={stage:'injury-treatment',active:0,currentInjury:{...injury,losses:{STR:0,DEX:0,END:0},zeroRuling:{survives:true,note:'Synthetic referee preservation of original physical scores'}},character:{species:'human',careers:[{id:'core.army',assignment:'infantry',rank:0}],skills:{},stats:{STR:2,DEX:2,END:2}}};
 const result=conciseResult(event,state,catalog());assert.equal(result.title,'No physical characteristic loss recorded.');assert.deepEqual(injuryRecordedDiceEvent(state,event).rolls.map(r=>r.values),[[1],[4]]);
});
