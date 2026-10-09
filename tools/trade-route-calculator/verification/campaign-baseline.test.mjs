import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {campaignBaseline,byHex,hexDistance,routePlan} from './fixtures/campaign-baseline.mjs';
import {passengerLuggage} from '../js/accommodation.mjs';
import {supportStock,monthlySupport} from '../js/life-support.mjs';
import {used} from '../js/state.mjs';
import {decimal} from '../js/amounts.mjs';
import {expenseOverview} from '../js/expense-panels.mjs';
import {campaignDate} from '../js/calendar.mjs';
import {distance} from '../js/map.mjs';
test('five independent journeys share byte-identical stated baseline',()=>{
 const baseline=campaignBaseline(),digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
 for(let i=0;i<5;i++)assert.equal(digest(campaignBaseline()),digest(baseline));
 assert.equal(baseline.bank,'400000');assert.equal(baseline.hours,0);assert.equal(baseline.actual,'-107,-17');assert.equal(baseline.ship.capacity,'50');assert.equal(baseline.ship.expenses.salary,'20000');
 assert.deepEqual(baseline.trader,{broker:2,streetwise:2,admin:2,characteristic:1,rank:3,soc:1});
 assert.equal(baseline.lots.length+baseline.contracts.length+baseline.policies.length,0);assert.equal(baseline.ledger.length,1);assert.equal(baseline.ledger[0].type,'Opening bank');
 assert.equal(passengerLuggage(baseline.ship),'1');assert.equal(decimal(used(baseline)),'1');assert.equal(monthlySupport(baseline.ship),14000n);assert.equal(expenseOverview(baseline).total,'186300');
 const stock=supportStock(baseline.ship);assert.equal(stock.dailyUnits,'5');assert.equal(stock.remainingUnits,'140');assert.equal(stock.remainingDays,'28');assert.equal(stock.internalCapacityUnits,'800');assert.equal(stock.cargoTons,'0');
 assert.equal(baseline.ship.fuel.aboardTons,40);assert.equal(baseline.ship.fuel.bladderTons,40);assert.equal(baseline.ship.fuel.capacityTons,80);
 assert.equal(baseline.ship.mortgage.originalAmount,'36000000');assert.equal(baseline.ship.mortgage.payment,'150000');assert.equal(baseline.ship.mortgage.remainingPayments,480);assert.equal(baseline.ship.mortgage.totalPaid,'0');assert.equal(baseline.ship.maintenance.payment,'2300');assert.equal(baseline.ship.maintenance.paidSinceTracking,'0');
});
test('published radius-verified route distances match separate integer cube geometry and application geometry',()=>{
 assert.deepEqual(routePlan.routes.map(r=>r.destination),['Theev','Fist','Acis','Fantasy','Homestead']);
 for(const trip of routePlan.routes){assert.equal(trip.hexes[0],'2223');const worlds=trip.hexes.map(hex=>byHex(hex)||{WorldX:-108,WorldY:-23});
  const legs=worlds.slice(1).map((w,i)=>hexDistance(worlds[i],w));assert.deepEqual(legs,trip.legParsecs);assert.ok(legs.every(n=>n===1||n===2));
  assert.deepEqual(worlds.slice(1).map((w,i)=>distance({x:worlds[i].WorldX,y:worlds[i].WorldY},{x:w.WorldX,y:w.WorldY})),trip.legParsecs);
 }
 assert.equal(byHex('2117'),undefined);assert.equal(byHex('1715').Name,'Homestead');
});
test('first due028 is648 elapsed hours and subsequent dues are672h apart',()=>{
 assert.equal(campaignDate('001-1105',647),'027-1105 · 23:00');assert.equal(campaignDate('001-1105',648),'028-1105 · 00:00');assert.equal(campaignDate('001-1105',1320),'056-1105 · 00:00');
});
