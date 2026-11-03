import test from 'node:test';
import assert from 'node:assert/strict';
import {sensorDisplayView} from '../sensor-display-settings.mjs';
import {renderSensorPings} from '../sensor-pings.mjs';
import {createState,normalizeState} from '../engine.mjs';
test('Settings reports actual state separately from display choice and matches existing ping gates',()=>{
 const ship=createState().ships[0];
 for(const sensorMode of ['active','passive'])for(const sensorsEnabled of [true,false])for(const sensorPing of [true,false])for(const global of [true,false]){
  Object.assign(ship.systems,{sensorMode,sensorsEnabled,sensorPing});const before=structuredClone(ship),view=sensorDisplayView(ship,{sensorPings:global});assert.equal(view.displayOn,sensorPing);assert.equal(view.pingEnabled,!!renderSensorPings([ship],global));assert.match(view.sensorState,sensorsEnabled?(sensorMode==='active'?/^Active$/:/^Passive$/):/^Sensors Off/);assert.deepEqual(ship,before);
 }
 assert.equal(sensorDisplayView(null),null);
});
test('legacy defaults, saved per-ship display choices and actual modes remain independent',()=>{
 const state=createState(),[a,b]=state.ships;a.systems.sensorMode='passive';a.systems.sensorPing=false;b.systems.sensorMode='active';state.display={sensorPings:false,rangeBands:true};
 const saved=normalizeState(JSON.parse(JSON.stringify(state)));assert.deepEqual(saved,state);assert.equal(sensorDisplayView(saved.ships[0],saved.display).displayOn,false);assert.equal(sensorDisplayView(saved.ships[1],saved.display).displayOn,true);assert.equal(saved.ships[0].systems.sensorMode,'passive');assert.equal(saved.ships[1].systems.sensorMode,'active');
 delete a.systems.sensorPing;assert.equal(sensorDisplayView(a).displayOn,true);assert.equal(sensorDisplayView(a).pingEnabled,false);
});
