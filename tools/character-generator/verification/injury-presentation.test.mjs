import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../engine/session.mjs';
import {conciseResult} from '../gui/concise-result.mjs';
import {injuryRecordedDiceEvent} from '../gui/career-template.mjs';
const injury={tableResult:1,tableRolls:[1],severityDie:4,losses:{STR:4,DEX:2,END:2}};
const event={type:'injury-loss',summary:'Injury loss selected: STR -4, DEX -2, END -2.',rolls:[],changes:[{path:'stats.STR',before:7,after:3}]};
test('treatment keeps actual injury/loss concise and billing explanations informational',()=>{
 const state={stage:'injury-treatment',currentInjury:injury,active:0,character:{species:'human',careers:[{id:'core.army',assignment:'infantry',rank:0}],stats:{},skills:{}}},before=JSON.stringify({state,event}),r=conciseResult(event,state,catalog());
 assert.equal(r.title,'Injury table result 1.');assert.deepEqual(r.details,['Loss recorded: STR −4, DEX −2, END −2.']);
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
 const state={stage:'term-end',active:0,character:{species:'human',careers:[{id:'core.army',assignment:'infantry',rank:0,forcedExit:true}],stats:{},skills:{}}};
 const event={type:'injury-treatment',summary:'Treatment recorded.',rolls:[{label:'Medical contribution',values:[2,3],total:5}],changes:[{path:'medicalBills.0',before:null,after:{totalCost:40000,coveredCost:40000-personalCost,personalCost}},{path:'stats.STR',before:3,after:7}]};const before=JSON.stringify({state,event}),r=conciseResult(event,state,catalog());
 assert.equal(r.title,'Injury treatment complete.');assert.match(r.details.join(' '),personalCost?/Your medical bill: Cr10,000/:/No personal medical bill/);assert.match(r.details.join(' '),/Leave this career/);assert.doesNotMatch(r.details.join(' '),/Strength|Source|Mishap/);assert.match(r.information.paragraphs.join(' '),/Treatment Cr40,000; employer contribution/);assert.equal(injuryRecordedDiceEvent(state,event),event);assert.equal(JSON.stringify({state,event}),before);
});
