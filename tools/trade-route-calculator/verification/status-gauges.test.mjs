import * as A from '../js/amounts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {statusGaugeValues,lifeSupportGaugeValues} from '../js/status-gauges.mjs';
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

for(const [stock,shown] of [['29.96','29'],['27.96','27'],['27.999999999999999999','27'],['28.01','28'],['1','1'],['0','0'],['0.99','0'],['28','28'],['29.999999999999999999','29']])test(`Main life-support remaining days rounds down: ${stock} → ${shown}`,()=>{
 const s=campaign();s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:1,high:0}};
 s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:stock,targetDays:28});
 const before=JSON.stringify(s),h=harness(s),summary=h.dom.ids.get('summary').innerHTML;
 assert.match(summary,new RegExp('class="value">'+shown+' days'));
 assert.match(summary,new RegExp('value="'+shown+'" aria-label="Life support endurance'));
 assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(h.persisted()),before);assert.equal(h.calls.saves,0);
});
test('Main life-support keeps unknown endurance and unconfigured guidance',()=>{
 const s=campaign();delete s.ship.lifeSupport;
 assert.match(harness(s).dom.ids.get('summary').innerHTML,/Set in Settings/);
 s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:0,high:0}};
 s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'10',targetDays:28});
 const h=harness(s),summary=h.dom.ids.get('summary').innerHTML;
 assert.match(summary,/Unknown days/);assert.doesNotMatch(summary,/aria-label="Life support endurance/);assert.equal(h.calls.saves,0);
});

for(const stock of ['0','10'])test('Zero-demand LSS has no misleading full/infinite gauge with '+stock+' stock',()=>{
 const s=campaign();s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:0,high:0}};s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:stock,targetDays:28});
 const before=JSON.stringify(s),h=harness(s),summary=h.dom.ids.get('summary').innerHTML;assert.match(summary,/Unknown days/);assert.doesNotMatch(summary,/aria-label="Life support endurance|Infinity|NaN/);assert.equal(JSON.stringify(h.persisted()),before);assert.equal(h.calls.saves,0);
});
test('Custom target uses the same floored days and preserves sub-day stock',()=>{
 const s=campaign();s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:1,high:0}};s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'13.999',targetDays:14});
 const before=JSON.stringify(s),h=harness(s),summary=h.dom.ids.get('summary').innerHTML;assert.match(summary,/class="value">13 days/);assert.match(summary,/<progress max="14" value="13" aria-label="Life support endurance/);assert.equal(JSON.stringify(h.persisted()),before);assert.equal(h.calls.saves,0);
});

for(const [remaining,target,whole,scale,base,above,basePercent,abovePercent]of [
 ['27.96','28','27','28','27','0','96.428571','0'],['28.99','28','28','28','28','0','100','0'],
 ['40.7','28','40','40','28','12','70','30'],['56.9','28','56','56','28','28','50','50'],
 ['1000000.9','28','1000000','1000000','28','999972','0.0028','99.9972'],['15.9','14','15','15','14','1','93.333333','6.666666'],
 ['0.99','28','0','28','0','0','0','0']
])test('Extended LSS scale '+remaining+' / '+target,()=>{assert.deepEqual(lifeSupportGaugeValues(remaining,target),{wholeDays:whole,targetDays:target,scaleDays:scale,baseDays:base,aboveDays:above,basePercent,abovePercent});});
test('No-demand scale stays absent and invalid finite inputs never draw infinity',()=>{assert.equal(lifeSupportGaugeValues(null,'28'),null);assert.throws(()=>lifeSupportGaugeValues('Infinity','28'));assert.throws(()=>lifeSupportGaugeValues('20','0'));});
for(const station of [false,true])test('Above-target LSS is labeled as total endurance, including station state '+station,()=>{
 const s=campaign();s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:1,high:0}};s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'40.7',targetDays:28});s.ship.stationLifeSupport=station;
 const before=JSON.stringify(s),h=harness(s),summary=h.dom.ids.get('summary').innerHTML;assert.match(summary,station?/class="value">Station supply/:/class="value">40 days/);assert.match(summary,/<progress max="40" value="40"/);assert.match(summary,/28d target/);assert.match(summary,/12d above/);assert.match(summary,/class="status-lss-above" aria-hidden="true" style="width:30%"/);assert.match(summary,/40 whole days onboard; 28-day target; 12 days above target. Scale: 0 to 40 days./);if(station)assert.match(summary,/Station supply active; onboard consumption paused/);assert.equal(JSON.stringify(h.persisted()),before);assert.equal(h.calls.saves,0);
});
