import test from 'node:test';
import assert from 'node:assert/strict';
import {displayPreferences} from '../display-preferences.mjs';
import {renderSensorPings} from '../sensor-pings.mjs';
import {createState,normalizeState,applyCommand} from '../engine.mjs';
import {bandRadii} from '../range-overlay.mjs';
test('fresh and legacy views default on, explicit saved off survives normalization and commands',()=>{const state=createState();assert.deepEqual(displayPreferences(state.display),{rangeBands:true,sensorPings:true});state.display={rangeBands:false,sensorPings:false};const saved=normalizeState(JSON.parse(JSON.stringify(state)));assert.deepEqual(saved.display,state.display);assert.deepEqual(applyCommand(saved,{type:'coast',shipId:saved.ships[0].id}).display,state.display);});
test('pings use only visible active ships and the existing Short boundary without mutation',()=>{const all=createState().ships;all.forEach(s=>{s.systems.sensorsEnabled=true;s.systems.sensorMode='active';});all[1].systems.sensorMode='passive';all[2].systems.sensorsEnabled=false;const visible=all.slice(0,3),before=structuredClone(all),html=renderSensorPings(visible,true);assert.match(html,new RegExp('data-ping-ship="'+all[0].id+'"'));for(const s of all.slice(1))assert.ok(!html.includes('data-ping-ship="'+s.id+'"'));assert.ok(html.includes('r="'+bandRadii().find(b=>b.name==='Short').radius+'"'));assert.equal(renderSensorPings(visible,false),'');assert.deepEqual(all,before);});

test('sensor mode changes gate pings independently of the visual filter',()=>{const ship=createState().ships[0];ship.systems.sensorsEnabled=true;ship.systems.sensorMode='active';assert.match(renderSensorPings([ship],true,2),/stroke-width="4.5"/);ship.systems.sensorMode='passive';assert.equal(renderSensorPings([ship],true),'');ship.systems.sensorMode='active';assert.equal(renderSensorPings([ship],false),'');assert.match(renderSensorPings([ship],true),/sensor-ping/);assert.equal(ship.systems.sensorMode,'active');});
