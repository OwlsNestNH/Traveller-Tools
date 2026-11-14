import test from 'node:test';import assert from 'node:assert/strict';
import {api,exportSession,project} from '../engine/session.mjs';
import {conciseResult} from '../gui/concise-result.mjs';
import {armyRecordedDice} from '../gui/career-template.mjs';
import {nestedResultFixture} from './nested-result-fixtures.mjs';
const catalog=api({operation:'catalog'});
for(const id of ['core.drifter','core.army','core.marine','aslan.envoy'])test(id+' nested result retains the latest story, actual effects and complete informational',()=>{
 const r=nestedResultFixture(id).result,event=r.log.at(-1),raw=exportSession(r.session),view=conciseResult(event,r.state,catalog,{recordedDiceVisible:true});
 assert.equal(view.title,event.eventResults.at(-1).description);assert.equal(view.information.keepGuidance,true);if(id==='aslan.envoy')assert.equal(view.information.nextRollLabel,'Aslan Clan Event');
 assert.doesNotMatch(view.text,/Table outcome:|Source:|roll borrowed event result/);
 for(const line of [view.full.title,...view.full.details])assert.ok(view.information.paragraphs.includes(line),'Full accepted explanation remains available');
 assert.match(armyRecordedDice(event,{esc:String}),/Recorded total:/);
 if(id==='core.marine')assert.match(view.text,/Life event benefit bonus \+2 \(available\)/);
 assert.equal(exportSession(r.session),raw);assert.deepEqual(project(r.session).state,r.state);
});
test('nested presentation retains actual awards, restrictions and future entry rights',()=>{
 const r=nestedResultFixture().result,event={...r.log.at(-1),changes:[{path:'cash',before:0,after:1000},{path:'skills.Admin',before:0,after:1},{path:'careers.0.forcedExit',before:false,after:true}],pendingEffectChanges:{before:{automaticCareers:[]},after:{forcedCareer:'core.prisoner',automaticCareers:['core.army']}}},view=conciseResult(event,r.state,catalog,{recordedDiceVisible:true});
 assert.match(view.text,/Cash: Cr0 → Cr1,000/);assert.match(view.text,/Skill Admin: 0 → 1/);assert.match(view.text,/Must leave/);assert.match(view.text,/Required next career: Prisoner/);assert.match(view.text,/Automatic entry available: Army/);
});
test('unknown or missing nested narrative keeps the complete fallback instead of presenting the parent as the new outcome',()=>{
 const r=nestedResultFixture().result;
 for(const modify of [e=>e.eventResults.at(-1).description='',e=>e.eventResults.at(-1).table='unknown.unverified',e=>e.eventResults.at(-1).table='core.pre-career-events',e=>e.eventResults.at(-1).roll.total++,e=>e.rolls[0].label='Medic check',e=>e.eventResults.push(structuredClone(e.eventResults.at(-1)))]){
  const e=structuredClone(r.log.at(-1));modify(e);const view=conciseResult(e,r.state,catalog,{recordedDiceVisible:true});assert.notEqual(view.information?.keepGuidance,true);assert.ok(view.full.details.length>0);
 }
});

test('legacy presentation without a recorded-dice renderer keeps its original full roll visible',()=>{
 const r=nestedResultFixture().result,e=r.log.at(-1),view=conciseResult(e,r.state,catalog);assert.notEqual(view.information?.keepGuidance,true);assert.match(view.details.join(' '),/Roll \[1\] = 1|\[1\].*1/);
});

test('recorded nested dice use a verified readable table label without rewriting the accepted evidence',()=>{
 const r=nestedResultFixture().result,e=r.log.at(-1),raw=JSON.stringify(e),html=armyRecordedDice(e,{esc:String});assert.match(html,/Core Unusual Event/);assert.doesNotMatch(html,/core\.unusual-events/);assert.equal(JSON.stringify(e),raw);
 for(const modify of[x=>x.eventResults.at(-1).table='unknown.table',x=>x.eventResults.push(structuredClone(x.eventResults.at(-1)))]){const ambiguous=structuredClone(e);modify(ambiguous);assert.match(armyRecordedDice(ambiguous,{esc:String}),/core\.unusual-events/,'Unknown or ambiguous identity retains the exact recorded label');}
});
