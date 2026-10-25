import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,applyCommand,normalizeState} from '../engine.mjs';
import {beginSystemsDraft,commitSystemsDraft} from '../systems-draft.mjs';
import {stationPowerRows,setStationSystem} from '../station-power.mjs';
import {powerReport} from '../systems.mjs';
test('station rows retain disabled source weapons and do not invent unknown installations',()=>{
 const state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'drinax-harrier-restored',name:'Test',position:{q:0,r:0},velocity:{q:0,r:0}}),ship=state.ships[0],before=structuredClone(ship),rows=stationPowerRows(ship);
 assert.ok(rows.some(r=>/missile turret|particle barbette/i.test(r.name)&&!r.value));assert.deepEqual(ship,before);
 const unknown=structuredClone(ship);unknown.systems.driveKind='unknown';unknown.systems.sensorInstalled=null;
 assert.ok(!stationPowerRows(unknown).some(r=>['drive','sensors'].includes(r.id)));
});
test('station systems draft cancels independently, commits once, and preserves manual used power/source',()=>{
 const state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'core-190',name:'Test',position:{q:0,r:0},velocity:{q:0,r:0}}),ship=state.ships[0],draft=beginSystemsDraft(state,ship.id);
 for(const level of [0,50,100]){draft.systems=setStationSystem(draft.systems,'basic',level);assert.equal(draft.systems.basic,level);assert.equal(ship.systems.basic,100);}
 const load=stationPowerRows(ship).find(r=>r.name==='Fuel Processor');draft.systems=setStationSystem(draft.systems,load.key,true);
 const next=commitSystemsDraft(state,draft,ship.id);assert.deepEqual(next.ships[0].template,ship.template);assert.equal(next.ships[0].condition.powerUsed,ship.condition.powerUsed);assert.match(powerReport(next.ships[0]).rows.find(r=>r.name==='Fuel Processor').note,/calculated/);
 assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(next))),next);assert.throws(()=>commitSystemsDraft(next,draft,ship.id));assert.throws(()=>commitSystemsDraft(state,draft,'wrong'));assert.throws(()=>setStationSystem(ship.systems,'basic',25));
});
