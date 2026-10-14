import test from 'node:test';
import assert from 'node:assert/strict';
import {statusGaugeValues} from '../js/status-gauges.mjs';
const ship=(aboard=51,bladder=20,capacity='65')=>({capacity,jump:2,fuel:{displacementTons:200,baseCapacityTons:41,aboardTons:aboard,bladderTons:bladder,capacityTons:41+bladder}});
for(const [aboard,capacity,show]of [[0,20,false],[41,20,false],[41.5,20,false],[42,20,true],[61,20,true],[41,0,false]])test(`status presentation: ${aboard}t aboard, ${capacity}t bladder`,()=>{
 const s=ship(aboard,capacity),before=JSON.stringify(s),fuel=Math.max(0,aboard-41),g=statusGaugeValues(s,String(6+fuel));
 assert.equal(g.fuel.showBladder,show);assert.equal(g.fuel.mainTons,Math.min(41,aboard));assert.equal(g.fuel.bladderFuel,fuel);assert.equal(g.cargo.ordinary,'6');assert.equal(Number(g.cargo.free),59-fuel);assert.equal(JSON.stringify(s),before);
});
test('cargo gauge counts only actual bladder fuel, preserving the real free gap',()=>{
 const empty=statusGaugeValues(ship(41),'6'),full=statusGaugeValues(ship(61),'26');assert.equal(empty.cargo.bladderPercent,'0');assert.equal(empty.cargo.free,'59');assert.equal(full.cargo.free,'39');assert.ok(Number(full.cargo.ordinaryPercent)+Number(full.cargo.bladderPercent)<100);
});
test('overloaded and zero-capacity displays stay bounded and preserve exact excess',()=>{
 const g=statusGaugeValues(ship(61,20,'25'),'26').cargo;assert.equal(g.overCapacity,true);assert.equal(g.free,'-1');assert.ok(Math.abs(Number(g.ordinaryPercent)+Number(g.bladderPercent)-100)<2e-6);
 const zero=statusGaugeValues({capacity:'0'},'0');assert.equal(zero.fuel,null);assert.equal(zero.cargo.ordinaryPercent,'0');assert.equal(zero.cargo.bladderPercent,'0');
});
