import test from 'node:test';import assert from 'node:assert/strict';
import {benefitRollEvidence,benefitAwardHeadline,benefitRecordedDiceEvent} from '../gui/benefit-presentation.mjs';
import{conciseResult}from'../gui/concise-result.mjs';import{armyRecordedDice}from'../gui/career-template.mjs';import{catalog}from'../engine/session.mjs';import{cashRollDisplay}from'../gui/aslan-access-view.mjs';
const record={table:'material',natural:2,modifier:1,result:3,appliedResult:3,rolls:[{natural:2,modifier:1,result:3}]};
const state={stage:'benefits',active:0,character:{species:'human',careers:[{id:'core.army',assignment:'infantry',rank:0}],stats:{EDU:12},skills:{}}};
const event={type:'benefit',summary:'Rolled material benefit 3 (DM 1).',rolls:[{label:'Material benefit',values:[2],total:2}],changes:[{path:'stats.EDU',before:11,after:12},{path:'benefitRollHistory.0',before:null,after:record},{path:'careers.0.benefitRolls',before:3,after:2}]};
test('material benefit leads with the actual awarded characteristic, not the table row',()=>{
 const before=JSON.stringify({state,event}),r=conciseResult(event,state,catalog());assert.equal(r.title,'Education +1 (11 → 12).');assert.doesNotMatch(r.details.join(' '),/benefit rolls remain|Rolled material|Education:/);assert.match(r.information.paragraphs.join(' '),/Rolled material benefit 3/);assert.equal(JSON.stringify({state,event}),before);
});
test('gold benefit dice show natural, actual modifier, total and a distinct applied cap',()=>{
 const html=armyRecordedDice(event,{esc:String,benefitContext:benefitRollEvidence(event,state)});assert.match(html,/Natural 2 · DM \+1 · Result 3/);assert.equal((html.match(/education-result-die/g)??[]).length,1);
 const capped={...record,appliedResult:2};assert.match(armyRecordedDice(event,{esc:String,benefitContext:capped}),/Table uses 2/);
});
test('completed deferred choices retain known totals without reconstructing unavailable raw faces',()=>{
 const choice={...event,type:'choose-skill',rolls:[]};const shown=benefitRecordedDiceEvent(choice,state);assert.deepEqual(shown.rolls,[{label:'Material benefit',total:2}]);assert.match(armyRecordedDice(shown,{esc:String}),/recorded-total-die/g);assert.equal(choice.rolls.length,0);assert.equal(benefitRollEvidence({...choice,changes:[]},state),null);assert.equal(benefitRecordedDiceEvent(event,state),event);
});
test('cash payout leads ahead of a separate Wealth increase',()=>{assert.deepEqual(benefitAwardHeadline({changes:[{path:'stats.WLT',before:5,after:6},{path:'cash',before:0,after:10000}]}),{title:'Received Cr10,000.',path:'cash'});});
test('cash availability uses the actual source/account limit rather than hard coding three',()=>{
 for(const[used,limit,disabled]of[[2,3,false],[3,3,true],[0,0,true],[1,2,false],[2,2,true],[3,999,false]])assert.equal(cashRollDisplay({cashRolls:used,cashLimit:limit}).disabled,disabled);
 assert.equal(cashRollDisplay({cashRolls:8,cashRollsUsed:2,cashRollAccount:'core',cashLimit:3}).disabled,false);
});
test('unrendered legacy contexts retain the established complete benefit result',()=>{const r=conciseResult(event,{...state,character:{...state.character,species:'aezorgh'}},catalog());assert.notEqual(r.information?.label,'About your mustering-out result');assert.match(r.text,/Education/);});

test('deferred benefits show recorded totals without inventing unavailable faces',()=>{
 for(const rolls of [undefined,[],[{natural:9,modifier:1,result:10}]]){
  const typed={...record,rolls},choice={...event,type:'choose-skill',rolls:[],changes:[{path:'benefitRollHistory.0',before:null,after:typed}]};
  const before=JSON.stringify(choice),shown=benefitRecordedDiceEvent(choice,state),html=armyRecordedDice(shown,{esc:String});
  assert.match(html,/recorded-total-die/g);assert.equal((html.match(/<svg\b/g)??[]).length,0);assert.equal(JSON.stringify(choice),before);
 }
});
