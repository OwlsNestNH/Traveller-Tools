import test from 'node:test';
import assert from 'node:assert/strict';
import {consumableRefillBasis,consumableRefillQuote,monthlyCabinUpkeep} from '../js/lss-refill-pricing.mjs';
import {campaignBaseline} from './fixtures/campaign-baseline.mjs';
import * as A from '../js/amounts.mjs';
const quote=(s,units)=>consumableRefillQuote(s,{purchasedUnits:units});
const campaign=()=>{const s=campaignBaseline();s.ship.accommodation.passengers={low:0,middle:0,high:0};s.ship.accommodation.crew={low:0,middle:0,high:0};return s;};
test('Middle and High use identical consumption and separate monthly person prices',()=>{
 for(const [tier,amount]of [['middle','1000'],['high','3000']]){const s=campaign();s.ship.accommodation.crew[tier]=1;const q=quote(s,28);assert.equal(q.amount,amount);assert.deepEqual(q.days,A.auditNumber(28));assert.equal(q.cabinAmount,'0');}
});
test('booked frozen Low costs Cr100 for 2.8 LSS / 28 days, never Cr10',()=>{
 const s=campaign();s.contracts=[{kind:'passenger',status:'accepted',passageClass:'low',count:1,cabinMode:'low'}];
 assert.equal(quote(s,'2.8').amount,'100');assert.equal(quote(s,'1.4').amount,'50');assert.deepEqual(quote(s,'0.1').exactAmount,A.auditNumber(A.rat(100,28)));
});
test('mixed complement has one exact prorated charge and no reserve tariff boundary',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=2;s.ship.accommodation.passengers.high=1;s.contracts=[{kind:'passenger',status:'accepted',passageClass:'low',count:2,cabinMode:'low'}];
 const bytes=JSON.stringify(s);assert.equal(consumableRefillBasis(s).monthly,'5200');assert.equal(quote(s,'89.6').amount,'5200');assert.equal(quote(s,'179.2').amount,'10400');assert.equal(quote(s,'44.8').amount,'2600');assert.equal(JSON.stringify(s),bytes);
});
test('custom cabin rates affect upkeep only; stock location and old refill target do not affect consumable price',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=4;assert.equal(quote(s,100).amount,'3572');const before=monthlyCabinUpkeep(s.ship);
 s.ship.accommodation.roomService={middle:{level:'custom',monthly:'5555'}};s.ship.lifeSupport.capacityHours=24;s.ship.lifeSupport.stockUnits=A.auditNumber(5000);
 assert.notEqual(monthlyCabinUpkeep(s.ship),before);assert.equal(quote(s,100).amount,'3572');
});
test('precise purchased fractions remain exact; only final money uses configured rounding',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=1;const units=A.auditNumber(A.rat(1,24)),q=quote(s,units);assert.deepEqual(q.purchasedUnits,units);assert.deepEqual(q.exactAmount,A.auditNumber(A.rat(1000,672)));assert.equal(q.amount,'2');s.settings.creditStep=100;assert.equal(quote(s,units).amount,'100');assert.equal(quote(s,0).amount,'0');
});
test('manual frozen Low is billed and invalid quantities fail without mutation',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=1;s.ship.accommodation.occupiedLowBerths=1;const bytes=JSON.stringify(s);assert.equal(quote(s,'30.8').amount,'1100');assert.equal(JSON.stringify(s),bytes);s.ship.accommodation.occupiedLowBerths=0;assert.throws(()=>quote(s,-1));s.ship.accommodation.crew.middle=0;assert.throws(()=>quote(s,1),/positive complement/);
});
test('one-time comfort spending is charged exactly once and supplies/days stay unchanged',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=1;const plain=quote(s,28),q=consumableRefillQuote(s,{purchasedUnits:28,comfortCost:'2000',comfortNote:'  Fresh fruit  '});
 assert.equal(q.amount,'3000');assert.equal(q.supplyAmount,'1000');assert.equal(q.comfortAmount,'2000');assert.equal(q.comfortNote,'Fresh fruit');assert.deepEqual(q.purchasedUnits,plain.purchasedUnits);assert.deepEqual(q.days,plain.days);
 const only=consumableRefillQuote(s,{purchasedUnits:0,comfortCost:'2000',comfortNote:'Coffee'});assert.equal(only.amount,'2000');assert.deepEqual(only.purchasedUnits,A.auditNumber(0));assert.deepEqual(only.days,A.auditNumber(0));
 assert.throws(()=>consumableRefillQuote(s,{purchasedUnits:0,comfortCost:'1'}),/note/);assert.throws(()=>consumableRefillQuote(s,{purchasedUnits:0,comfortCost:'-1'}),/negative/);
});
