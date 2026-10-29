import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,normalizeState} from '../engine.mjs';
import {gunneryFixture} from './gunnery-fixture.mjs';
import {holdMounts} from '../gunnery.mjs';
import {directFireFixture} from './direct-fire-fixture.mjs';
import {roundReviewHTML,reportDocument} from '../combat-report.mjs';
const fixture=()=>applyCommand(directFireFixture({}),{type:'next-battle-phase',phase:'attacks'});
const end=s=>applyCommand(s,{type:'end-combat',expectedRevision:s.revision,note:'GM ends the engagement; unresolved effects retained.'});
test('ending captures exact final workflow and conditions without replay or discarded pending records',()=>{
 const s=fixture(),before=JSON.stringify(s),next=end(s);assert.equal(JSON.stringify(s),before);assert.equal(next.workflow,null);assert.equal(next.acceleration,null);assert.deepEqual(next.completedCombats[0].snapshot,s);assert.equal(next.revision,s.revision+1);
 assert.deepEqual(next.combatHistory,s.combatHistory);assert.deepEqual(next.missileCombat,s.missileCombat);assert.deepEqual(next.ships.map(s=>s.condition),s.ships.map(s=>s.condition));assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(next))),next);
 assert.throws(()=>end(next),/No active combat/);assert.throws(()=>applyCommand(s,{type:'end-combat',note:''}),/Review/);assert.throws(()=>applyCommand(s,{type:'end-combat',expectedRevision:s.revision-1,note:''}),/State changed/);
});
test('saved reports survive later edits and subsequent combat without nested archives',()=>{
 let s=end(fixture());const saved=JSON.stringify(s.completedCombats);s=applyCommand(s,{type:'set-condition',shipId:s.ships[0].id,condition:{...s.ships[0].condition,hull:0}});assert.equal(JSON.stringify(s.completedCombats),saved);
 s=applyCommand(s,{type:'start-battle'});s=end(s);assert.equal(s.completedCombats.length,2);assert.equal(s.completedCombats[1].snapshot.completedCombats,undefined);assert.equal(JSON.stringify(s.completedCombats.slice(0,1)),saved);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))),s);
 const bad=structuredClone(s);bad.completedCombats[0].snapshot.completedCombats=[];assert.throws(()=>normalizeState(bad),/Recursive/);
 const dup=structuredClone(s);dup.completedCombats.push(dup.completedCombats[0]);assert.throws(()=>normalizeState(dup),/Invalid completed/);
});
test('round review and printable report are read-only and escape user text with unknown information explicit',()=>{
 const s=fixture();s.ships[0].name='<img src=x onerror=alert(1)>';const e=end(s).completedCombats[0],before=JSON.stringify(e),html=reportDocument(e);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img|<script|onload=/);assert.match(html,/Unknown/);assert.match(html,/GM record/);assert.match(html,/Current automatic severities/);assert.match(html,/Temporary|temporary/);assert.match(html,/@media print/);assert.match(roundReviewHTML(s),/full next round/);assert.equal(JSON.stringify(e),before);
});

test('early ending and partial declarations remain explicit in the exported report',()=>{
 let s=gunneryFixture();const id=s.workflow.gunnery.order[0];s=applyCommand(s,{type:'declare-gunnery',shipId:id,mounts:holdMounts(s.ships.find(x=>x.id===id))});const e=end(s).completedCombats[0],html=reportDocument(e);assert.match(html,/Phase at capture/);assert.match(html,/attacks/);assert.match(html,/Committed choices retained/);assert.match(html,/No gunnery declaration committed/);assert.match(html,/hold/);assert.equal(e.snapshot.workflow.gunnery.declarations.length,1);
 const fresh=applyCommand(end(fixture()),{type:'start-battle'}),early=end(fresh).completedCombats.at(-1);assert.match(reportDocument(early),/Round 2/);
});

test('report preserves crew overrides and distinguishes mount quantity from weapon slots',()=>{
 const s=fixture();s.ships[0].crew.bonus=4;s.ships[0].crew.overrides.pilot=5;s.ships[0].crew.gunnerStations=[{mountId:'mixed',name:'Legacy gunner',skillName:'Gunner',skill:3,characteristicDM:1}];const e=end(s).completedCombats[0],html=reportDocument(e);assert.match(html,/General contribution override/);assert.match(html,/Role: pilot · Value: 5/);assert.match(html,/Legacy gunner/);assert.match(html,/4 weapons per mount · mount quantity 1/);
});
