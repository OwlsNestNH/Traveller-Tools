import test from 'node:test';
import assert from 'node:assert/strict';
import {consumableRefillBasis,consumableRefillQuote,monthlyCabinUpkeep} from '../js/lss-refill-pricing.mjs';
import {campaignBaseline} from './fixtures/campaign-baseline.mjs';
import * as A from '../js/amounts.mjs';
const quote=(s,units)=>consumableRefillQuote(s,{purchasedUnits:units});
const campaign=()=>{const s=campaignBaseline();s.ship.accommodation.rooms={low:0,middle:1,high:0};s.ship.accommodation.passengers={low:0,middle:0,high:0};s.ship.accommodation.crew={low:0,middle:0,high:0};s.ship.accommodation.occupiedLowBerths=0;return s;};

test('one cabin plus one Middle person rounds combined daily 71.43 up to 72 before duration',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=1;const q=quote(s,28);
 assert.equal(q.cabinMonthly,'1000');assert.equal(q.peopleMonthly,'1000');assert.equal(q.monthly,'2000');assert.equal(q.dailyCredits,'72');assert.equal(q.amount,'2016');assert.equal(quote(s,7).amount,'504');assert.deepEqual(q.days,A.auditNumber(28));assert.equal(q.cabinAmount,'0');
 s.ship.accommodation.crew={low:0,middle:0,high:1};assert.equal(quote(s,28).amount,'4004');assert.deepEqual(quote(s,28).dailyUnits,A.auditNumber(1));
});
test('frozen Low costs Cr100 monthly before combined daily rounding and is not discounted twice',()=>{
 const s=campaign();s.ship.accommodation.rooms.middle=0;s.contracts=[{kind:'passenger',status:'accepted',passageClass:'low',count:1,cabinMode:'low'}];
 assert.equal(quote(s,'2.8').monthly,'100');assert.equal(quote(s,'2.8').dailyCredits,'4');assert.equal(quote(s,'2.8').amount,'112');assert.equal(quote(s,'1.4').amount,'56');assert.deepEqual(quote(s,'0.1').exactAmount,A.auditNumber(4));
});
test('mixed complement combines cabins and all service tiers once without reserve boundary',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=2;s.ship.accommodation.passengers.high=1;s.ship.accommodation.passengers.luxury=1;s.contracts=[{kind:'passenger',status:'accepted',passageClass:'low',count:2,cabinMode:'low'}];
 const bytes=JSON.stringify(s);assert.equal(consumableRefillBasis(s).monthly,'11200');assert.equal(quote(s,'117.6').amount,'11200');assert.equal(quote(s,'235.2').amount,'22400');assert.equal(quote(s,'58.8').amount,'5600');assert.equal(JSON.stringify(s),bytes);
});
test('custom cabin and person rates affect combined price; stock location and target do not',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=4;assert.equal(quote(s,100).amount,'4475');assert.equal(monthlyCabinUpkeep(s.ship),1000n);
 s.ship.accommodation.roomService={middle:{level:'custom',monthly:'5555'}};s.ship.lifeSupport.capacityHours=24;s.ship.lifeSupport.stockUnits=A.auditNumber(5000);
 assert.equal(quote(s,100).amount,'8550');s.ship.accommodation.refillRates={middle:'2000'};assert.equal(quote(s,100).amount,'12125');
});
test('precise purchased fractions remain exact; daily tariff stays whole Credits while final expense follows the selected Cr100 setting',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=1;const units=A.auditNumber(A.rat(1,24)),q=quote(s,units);assert.deepEqual(q.purchasedUnits,units);assert.deepEqual(q.exactAmount,A.auditNumber(3));assert.equal(q.amount,'3');s.settings.creditStep=100;assert.equal(quote(s,units).amount,'100');assert.equal(quote(s,1).dailyCredits,'72');assert.equal(quote(s,7).amount,'600');assert.equal(quote(s,0).amount,'0');
});
test('empty ship has zero cabin tariff; paid stock needs complement while comfort is allowed',()=>{
 const s=campaign(),bytes=JSON.stringify(s),basis=consumableRefillBasis(s);assert.equal(basis.installedCabinMonthly,'1000');assert.equal(basis.cabinMonthly,'0');assert.equal(basis.monthly,'0');assert.equal(basis.dailyCredits,'0');assert.deepEqual(basis.dailyUnits,A.auditNumber(0));assert.equal(quote(s,0).amount,'0');assert.throws(()=>quote(s,1),/positive complement/);assert.throws(()=>quote(s,-1),/negative/);assert.equal(JSON.stringify(s),bytes);
 assert.equal(consumableRefillQuote(s,{purchasedUnits:0,comfortCost:'71',comfortNote:'Coffee'}).amount,'71');
});
test('one-time comfort cost is separate and adds no supplies or days',()=>{
 const s=campaign();s.ship.accommodation.crew.middle=1;const plain=quote(s,28),q=consumableRefillQuote(s,{purchasedUnits:28,comfortCost:'2000',comfortNote:'  Fresh fruit  '});
 assert.equal(q.amount,'4016');assert.equal(q.supplyAmount,'2016');assert.equal(q.comfortAmount,'2000');assert.equal(q.comfortNote,'Fresh fruit');assert.deepEqual(q.purchasedUnits,plain.purchasedUnits);assert.deepEqual(q.days,plain.days);
 const only=consumableRefillQuote(s,{purchasedUnits:0,comfortCost:'2000',comfortNote:'Coffee'});assert.equal(only.amount,'2000');assert.deepEqual(only.purchasedUnits,A.auditNumber(0));assert.deepEqual(only.days,A.auditNumber(0));
 assert.throws(()=>consumableRefillQuote(s,{purchasedUnits:0,comfortCost:'1'}),/note/);assert.throws(()=>consumableRefillQuote(s,{purchasedUnits:0,comfortCost:'-1'}),/negative/);
});
