import {lawyerFixture} from './prisoner-lawyer-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {decorateEventResults} from '../engine/event-result-projection.mjs';
import {rollResult} from '../gui/roll-result-view.mjs';
import {conciseResult} from '../gui/concise-result.mjs';
import {fullActionLog} from '../gui/log-download.mjs';
import {PRECAREER_EVENTS} from '../engine/education-pack.mjs';
import {CORE_PACK} from '../engine/core-pack.mjs';
import {EXPANSION_PACK,EXPANSION_TABLES} from '../engine/expansion-pack.mjs';
import {CORE_LIFE_TABLES} from '../engine/core-life-events.mjs';
const packs={...CORE_PACK,...EXPANSION_PACK};
export function educationFixture(seed='event-display'){
 let r=force(assignmentSetup(seed),'precareer',{id:'core.university'},[6,6]);
 r=run(r,'education-skill',{name:'Admin'});r=run(r,'education-skill',{name:'Medic'});return r;
}
function fake(label,total,careerId){
 const state={active:careerId?0:null,character:{careers:careerId?[{id:careerId}]:[]}};
 const log=[{type:'table',summary:'Recorded table result.',rolls:[{label,total,values:[total],kept:[total]}],changes:[]}];
 decorateEventResults({log,snapshots:[state,state],events:[{command:{type:'table',payload:{}}}]});return log[0];
}
test('every encoded primary and shared event row has concrete visible table context',()=>{
 for(const row of Object.keys(PRECAREER_EVENTS))assert.ok(fake('Pre-career event',+row).eventResults[0].description);
 for(const [id,pack] of Object.entries(packs))for(const [field,label] of [['events','Event table'],['mishaps','Mishap table']])for(const row of Object.keys(pack[field]??{})){
  const e=fake(label,+row,id),result=e.eventResults[0];assert.ok(result.summary.length>0,id+' '+row);assert.equal(result.table,id+'.'+field);assert.ok(result.source,id);assert.ok(rollResult(e,{}).text.includes(result.summary));
 }
 for(const [id,table] of Object.entries({...CORE_LIFE_TABLES,...EXPANSION_TABLES}))for(const row of Object.keys(table.results))assert.ok(fake(id,+row).eventResults[0].summary.length>0,id+' '+row);
});
test('reported pre-career event five shows story, dice, floor award and observed gain without altering save',()=>{
 const r=force(educationFixture(),'education-event',{},[2,3]);const raw=exportSession(r.session);
 const result=rollResult(r.log.at(-1),r.state);assert.match(result.text,/part/i);assert.match(result.text,/Carouse at least level 1/);assert.match(result.text,/Roll \[2, 3\] = 5/);assert.match(result.text,/Skill Carouse:/);assert.match(result.text,/Core Rulebook Update 2022.*17/);
 assert.match(fullActionLog(r.log),/part/i);assert.equal(exportSession(importSession(raw)),raw);assert.deepEqual(project(importSession(raw)).log,r.log);assert.match(r.log.at(-1).summary,/Pre-career event 5\.$/);
});
test('choice continuation retains parent event and shows actual choice result',()=>{
 let r=run(assignmentSetup('event-choice-context'),'skip-precareer');r=settleAssignment(force(r,'career',{id:'core.army',assignment:'support'},[6,6]));
 r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},[2,2]);assert.equal(r.state.stage,'effect-choice');
 const parent=r.log.at(-1).eventResults;r=run(r,'choose-effect',{index:0});assert.deepEqual(r.log.at(-1).eventResults,parent);assert.match(rollResult(r.log.at(-1),r.state).text,/Stealth/);
 r=run(r,'advancement');assert.equal(r.log.at(-1).eventResults,undefined);
});
test('nested life event retains both rolls; unresolved choices remain distinct from awards',()=>{
 let r=force(educationFixture('nested-education'),'education-event',{},[3,4]);assert.equal(r.log.at(-1).rolls.length,1);assert.equal(r.state.stage,'education-event-roll');r=force(r,'roll-education-event-step',{pendingId:r.state.pendingEducationEventRoll.id},[1,2]);assert.equal(r.log.at(-1).rolls.length,1);const e=r.log.at(-1);assert.ok(e.eventResults.length>=2);assert.equal(e.eventResults[0].table,'core.pre-career-events');assert.equal(e.eventResults[1].table,'core.life-events');assert.ok(rollResult(e,r.state).text.includes(e.eventResults[1].summary));
});
test('compact asset results retain table story and outcomes',()=>{
 const event={...fake('Pre-career event',5),changes:[{path:'assets.0',after:{name:'Test ship'}}]};assert.match(conciseResult(event,{}).text,/Carouse/);assert.match(conciseResult(event,{}).text,/part/i);
});
test('unknown borrowed provenance never attributes result to current career',()=>{
 const e=fake('core.events',5,'core.army');assert.match(e.eventResults[0].summary,/source resolution/);assert.doesNotMatch(e.eventResults[0].title,/Army/);
});


test('nested prison incident and riot name only the branches actually rolled',()=>{
 const state={active:0,character:{careers:[{id:'core.prisoner'}]}};
 const log=[{summary:'Career event result 7.',rolls:[{label:'Event table',total:7,values:[3,4]},{label:'Event random result',total:1,values:[1]},{label:'Event random result',total:5,values:[5]}]}];
 decorateEventResults({log,snapshots:[state,state],events:[{command:{type:'career-event',payload:{}}}]});
 assert.deepEqual(log[0].eventResults.map(r=>r.table),['core.prisoner.events','core.prisoner.incidents','core.prisoner.riot']);
 assert.match(log[0].eventResults[1].description,/riot/i);assert.match(log[0].eventResults[2].description,/loot/i);
});

test('prison lawyer decline retains event context through notes and records its result',()=>{
 let r=lawyerFixture();const parent=r.log.at(-1).eventResults;
 assert.ok(parent?.length);r=run(r,'notes',{text:'A note during the event.'});r=run(r,'resolve-prisoner-lawyer',{outcome:'decline'});
 assert.deepEqual(r.log.at(-1).eventResults,parent);assert.match(rollResult(r.log.at(-1),r.state).text,/Prisoner event 9/);
});

test('ordinary disaster event resolves its known same-career nested mishap',()=>{
 let r=run(assignmentSetup('review-nested'),'skip-precareer');r=settleAssignment(force(r,'career',{id:'core.army',assignment:'support'},[6,6]));r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},[1,1]);
 const results=r.log.at(-1).eventResults;assert.equal(results[1].table,'core.army.mishaps');assert.ok(results[1].description);assert.ok(results[1].source);assert.match(results[1].summary,/ejection.*waived/);assert.doesNotMatch(results[1].summary,/recorded source resolution/);
});

test('every formatted table outcome avoids invalid placeholder values',()=>{
 for(const [id,pack] of Object.entries(packs))for(const [field,label] of [['events','Event table'],['mishaps','Mishap table']])for(const row of Object.keys(pack[field]??{}))assert.doesNotMatch(fake(label,+row,id).eventResults[0].summary,/undefined|NaN|\[object Object\]/,id+' '+row);
});

test('failed event checks retain uniquely proven nested career table provenance',()=>{
 let r=run(assignmentSetup('review-scout8-0'),'skip-precareer');r=settleAssignment(force(r,'career',{id:'core.scout',assignment:'courier'},[6,6]));r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},[4,4]);
 const result=r.log.at(-1).eventResults.find(r=>r.table==='core.scout.mishaps');assert.ok(result);assert.ok(result.description);
});

test('Rite of Passage doubles show their source event, non-doubles do not invent one',()=>{
 const state={active:null,character:{careers:[],species:'aslan'}};
 for(const values of [[2,2],[1,3]]){
  const log=[{summary:'Rite of Passage',rolls:[{label:'Rite of Passage',values,total:4}]}];decorateEventResults({log,snapshots:[state,state],events:[{command:{type:'roll-aslan-rite',payload:{}}}]});
  if(values[0]===values[1]){assert.equal(log[0].eventResults[0].table,'aslan.rite-doubles');assert.ok(log[0].eventResults[0].description);}else assert.equal(log[0].eventResults,undefined);
 }
});
