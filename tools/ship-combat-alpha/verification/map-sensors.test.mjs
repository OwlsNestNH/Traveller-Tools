import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand,normalizeState} from '../engine.mjs';
import {rangeInfo} from '../movement-rules.mjs';
import {bandRadii,renderRangeOverlay} from '../range-overlay.mjs';
import {renderSensorPings} from '../sensor-pings.mjs';
import {directFireFixture} from './direct-fire-fixture.mjs';
import {directFireProfile,directFireQueue} from '../direct-fire-profile.mjs';
import {prepareDirectFireCommand} from '../direct-fire-resolution.mjs';
const zero={q:0,r:0};
test('Short choices classify exact Euclidean boundaries and preserve kilometre distances',()=>{
 for(const short of [1,2]){const radii=bandRadii(short);assert.equal(radii[0].km,648*short);assert.equal(radii[0].radius,bandRadii()[0].radius*short);assert.deepEqual(radii.slice(1),bandRadii().slice(1));assert.equal(rangeInfo(zero,zero,short).band,'Adjacent / Close');assert.equal(rangeInfo(zero,{q:short,r:0},short).band,'Short');assert.equal(rangeInfo(zero,{q:short+.00001,r:0},short).band,'Medium');}
 assert.equal(rangeInfo(zero,{q:1,r:1},1).band,'Medium');assert.equal(rangeInfo(zero,{q:1,r:1},2).band,'Short');assert.equal(rangeInfo(zero,{q:2,r:0},2).km,1296);
 const html=renderRangeOverlay(createState().ships[0],'on',1,null,2);assert.match(html.rings,/Short ≤ 2 spaces · 1,296 km/);assert.match(html.shade,/data-outer-spaces="2"/);assert.match(html.shade,/data-inner-spaces="2" data-outer-spaces="15"/);
});
test('encounter rule is validated, revision guarded, locked during workflow, and retained on JSON roundtrip',()=>{
 const initial=createState(),next=applyCommand(initial,{type:'set-short-range',spaces:2,expectedRevision:initial.revision});assert.equal(next.shortRange,2);assert.equal(next.revision,initial.revision+1);assert.deepEqual(next.ships,initial.ships);assert.equal(initial.shortRange,undefined);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(next))),next);
 for(const spaces of [0,.5,3,'2',null])assert.throws(()=>applyCommand(initial,{type:'set-short-range',spaces}));assert.throws(()=>applyCommand(next,{type:'set-short-range',spaces:1,expectedRevision:0}),/revision/);
 const fixture=directFireFixture();assert.throws(()=>applyCommand(fixture,{type:'set-short-range',spaces:2}),/workflow/);assert.throws(()=>applyCommand(applyCommand(initial,{type:'begin-acceleration'}),{type:'set-short-range',spaces:2}),/declarations/);
});
test('combat profiles and immutable replay snapshots retain the chosen Short rule',()=>{
 let state=directFireFixture();state.ships.find(s=>s.id==='high').motion.position={q:2,r:0};state.ships.find(s=>s.id==='low').motion.position=zero;
 const entry=directFireQueue(state)[0];assert.equal(directFireProfile(state,entry).range.band,'Medium');state.shortRange=2;assert.equal(directFireProfile(state,entry).range.band,'Short');
 const resolved=applyCommand(state,prepareDirectFireCommand(state,()=>.4));assert.equal(resolved.combatHistory[0].snapshot.shortRange,2);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(resolved))),resolved);
 resolved.shortRange=1;assert.equal(normalizeState(resolved).combatHistory[0].snapshot.shortRange,2);
});
test('independent per-ship cosmetic choices survive all visibility gates and saved systems',()=>{
 const state=createState(),[a,b]=state.ships;for(const s of [a,b]){s.systems.sensorMode='active';s.systems.sensorsEnabled=true;}a.systems.sensorPing=false;
 assert.equal(renderSensorPings([a],true),'');assert.match(renderSensorPings([b],true),/sensor-ping/);assert.equal(renderSensorPings([b],false),'');b.systems.sensorMode='passive';assert.equal(renderSensorPings([b],true),'');b.systems.sensorMode='active';b.systems.sensorsEnabled=false;assert.equal(renderSensorPings([b],true),'');b.systems.sensorsEnabled=true;assert.match(renderSensorPings([b],true,1,2),new RegExp('r="'+bandRadii(2)[0].radius+'"'));
 const saved=normalizeState(JSON.parse(JSON.stringify(state)));assert.equal(saved.ships[0].systems.sensorPing,false);assert.deepEqual(saved.ships,state.ships);delete saved.ships[0].systems.sensorPing;assert.equal(normalizeState(saved).ships[0].systems.sensorPing,true);
});
