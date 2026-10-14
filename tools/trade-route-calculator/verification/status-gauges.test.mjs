import * as A from '../js/amounts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {statusGaugeValues} from '../js/status-gauges.mjs';
import {configureSupport,supportDisplay} from '../js/life-support.mjs';
import {harness,campaign,S} from './app-harness.mjs';
const ship=(aboard=51,bladder=20,capacity='65')=>({capacity,jump:2,fuel:{displacementTons:200,baseCapacityTons:41,aboardTons:aboard,bladderTons:bladder,capacityTons:41+bladder}});
for(const [aboard,capacity,show]of [[0,20,false],[41,20,false],[41.5,20,false],[42,20,true],[61,20,true],[41,0,false]])test(`status presentation: ${aboard}t aboard, ${capacity}t bladder`,()=>{
 const s=ship(aboard,capacity),before=JSON.stringify(s),fuel=Math.max(0,aboard-41),g=statusGaugeValues(s,String(6+fuel));
 assert.equal(g.fuel.showBladder,show);assert.equal(g.fuel.mainTons,Math.min(41,aboard));assert.equal(g.fuel.bladderFuel,fuel);assert.equal(A.decimal(g.cargo.ordinary),'6');assert.equal(Number(A.decimal(g.cargo.free)),59-fuel);assert.equal(JSON.stringify(s),before);
});
test('cargo gauge counts only actual bladder fuel, preserving the real free gap',()=>{
 const empty=statusGaugeValues(ship(41),'6'),full=statusGaugeValues(ship(61),'26');assert.equal(empty.cargo.bladderPercent,'0');assert.equal(A.decimal(empty.cargo.free),'59');assert.equal(A.decimal(full.cargo.free),'39');assert.ok(Number(full.cargo.ordinaryPercent)+Number(full.cargo.bladderPercent)<100);
});
test('overloaded and zero-capacity displays stay bounded and preserve exact excess',()=>{
 const g=statusGaugeValues(ship(61,20,'25'),'26').cargo;assert.equal(g.overCapacity,true);assert.equal(A.decimal(g.free),'-1');assert.ok(Math.abs(Number(g.ordinaryPercent)+Number(g.bladderPercent)-100)<2e-6);
 const zero=statusGaugeValues({capacity:'0'},'0');assert.equal(zero.fuel,null);assert.equal(zero.cargo.ordinaryPercent,'0');assert.equal(zero.cargo.bladderPercent,'0');
});
test('nonterminating Life Support overflow renders through advance, reload and Undo',async()=>{
 const s=campaign();s.ship.fuel=ship(41).fuel;s.ship.capacity='65';s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:1,high:0}};s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'801',targetDays:28});S.validate(s);
 const first=harness(s);assert.equal(supportDisplay(S.used(s)),'0.01');const advanced=S.transition(s,'One hour',n=>n.hours++);assert.equal(A.cmp(S.used(advanced),A.rat(23,2400)),0);first.store.save(advanced,s.revision);assert.match(first.dom.ids.get('summary').innerHTML,/0\.009583 \/ 65 t/);
 const reloaded=harness(JSON.parse(JSON.stringify(first.persisted()))),model=statusGaugeValues(reloaded.api.state.ship,S.used(reloaded.api.state));assert.equal(A.cmp(model.cargo.total,A.rat(23,2400)),0);assert.equal(A.cmp(model.cargo.free,A.sub(65,A.rat(23,2400))),0);
 await reloaded.api.actions.undo();assert.equal(A.cmp(S.used(reloaded.persisted()),'0.01'),0);assert.deepEqual(reloaded.persisted().ship,s.ship);
});
