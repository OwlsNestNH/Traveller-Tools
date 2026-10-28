import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,normalizeState,applyCommand} from '../engine.mjs';
import {beginShipSheet,commitShipSheet} from '../ship-sheet-draft.mjs';
test('sensor mode defaults Active without changing legacy sensor power or data',()=>{
 const state=createState(),legacy=structuredClone(state);for(const ship of legacy.ships){delete ship.systems.sensorMode;ship.systems.sensorsEnabled=false;}
 const loaded=normalizeState(legacy);for(const ship of loaded.ships){assert.equal(ship.systems.sensorMode,'active');assert.equal(ship.systems.sensorsEnabled,false);}
 const draft=beginShipSheet(state,state.ships[0].id);draft.values.sensorMode='passive';const next=commitShipSheet(state,draft);
 assert.equal(state.ships[0].systems.sensorMode,'active');assert.equal(next.ships[0].systems.sensorMode,'passive');assert.deepEqual(next.ships[0].condition,state.ships[0].condition);assert.deepEqual(next.ships[0].template,state.ships[0].template);assert.deepEqual(next.ships.slice(1),state.ships.slice(1));assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(next))),next);
 draft.values.sensorMode='invalid';assert.throws(()=>commitShipSheet(state,draft),/Active or Passive/);assert.throws(()=>commitShipSheet(next,beginShipSheet(state,state.ships[0].id)),/State changed/);
});
test('explicitly leaving workflow preserves records before manual reinforcement setup',()=>{
 let state=createState();state=applyCommand(state,{type:'record-initiatives',entries:state.ships.map((s,i)=>({shipId:s.id,initiative:i,tie:0}))});state=applyCommand(state,{type:'start-battle'});const next=applyCommand(state,{type:'leave-battle'});assert.deepEqual(next.ships,state.ships);assert.equal(next.round,state.round);assert.equal(next.workflow,null);assert.equal(next.acceleration,null);
});
