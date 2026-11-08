import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import * as P from '../js/passengers.mjs';
import * as A from '../js/amounts.mjs';
import {personRate,serviceRate,validateAccommodation,passengerLuggage} from '../js/accommodation.mjs';
import {supportStock,monthlySupport,refillQuote} from '../js/life-support.mjs';
import {consumableRefillQuote,consumableRefillBasis,monthlyCabinUpkeep} from '../js/lss-refill-pricing.mjs';
import {refillPricingAudit} from '../js/lss-refill-transaction.mjs';
import {expenseQuote} from '../js/expenses.mjs';
import {passengerOffers,passengerFare,PASSAGE_CLASSES,BOOKING_CLASSES} from '../js/passenger-rules.mjs';
import {readFile} from 'node:fs/promises';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
function fixture(){
 const s=S.initial();Object.assign(s,{initialized:true,bank:'100000',actual:'0,0',route:['0,0'],worlds:{'0,0':{id:'0,0',name:'Synthetic origin',sector:'Test',hex:'0101',uwp:'A788999-C',zone:'Safe',x:0,y:0},'1,0':{id:'1,0',name:'Synthetic destination',sector:'Test',hex:'0201',uwp:'A788999-C',zone:'Safe',x:1,y:0}}});
 s.ship.capacity='60';s.ship.staterooms=3;s.ship.fuel={displacementTons:200,capacityTons:40,aboardTons:40};
 s.ship.accommodation={rooms:{low:0,middle:1,high:1,luxury:1},passengers:{low:0,middle:1,high:0},crew:{low:0,middle:0,high:0},combinedPeople:true,luggageMode:'auto',occupiedLowBerths:0,passengerCapacity:{reservedCabins:1,installedLowBerths:0}};
 s.ship.lifeSupport={capacityHours:672,stockUnits:A.auditNumber(140)};S.validate(s);return s;
}
function board(s,{count=2,fare='27000',cabinMode='shared',serviceConfirmed=true}={}){
 const event={id:S.uid(),label:'Manual passenger terms audit',world:s.actual,destination:'1,0',hours:s.hours,offers:[{offerId:S.uid(),origin:s.actual,destination:'1,0',passageClass:'luxury',count,fare,audit:{manual:true,reason:'Synthetic agreed per-person allocation: Cr36,000 room plus 50% for the second person, divided between two people.'}}]};
 return S.transition(s,'Accepted manual Luxury passengers',n=>S.acceptManualPassengers(n,event,{count,cabinMode,serviceConfirmed}));
}
test('Luxury cabin and person components combine in the daily tariff; physical consumption does not scale with price',()=>{
 const s=fixture();s.ship.accommodation.passengers.luxury=2;const ship=s.ship,q=consumableRefillQuote(s,{purchasedUnits:84});
 assert.equal(personRate('luxury'),5000);assert.equal(serviceRate('luxury'),'1000');assert.equal(monthlyCabinUpkeep(ship),3000n);assert.equal(monthlySupport(ship),14000n);
 assert.equal(supportStock(ship).dailyUnits,'3');assert.equal(q.amount,'14000');assert.equal(q.cabinAmount,'0');assert.equal(passengerLuggage(ship),'4');assert.equal(q.luxury,2);assert.equal(q.middle,1);assert.equal(q.rates.luxury,'5000');assert.ok(refillPricingAudit(q).some(([label,value])=>label.startsWith('Luxury')&&value==='2 / 5000'));
 s.ship.accommodation.refillRates={luxury:'7000'};assert.equal(consumableRefillQuote(s,{purchasedUnits:84}).amount,'18004');assert.equal(supportStock(ship).dailyUnits,'3');assert.equal(monthlyCabinUpkeep(ship),3000n);
});
test('Luxury booking derives two people once; keeps stock and bank; import and Undo preserve terms',()=>{
 const s=fixture(),before=structuredClone(s),n=board(s),ship=P.passengerShip(n);
 assert.deepEqual(n.ship,before.ship);assert.equal(n.bank,before.bank);assert.equal(P.passengerTotals(n).luxury,2);assert.equal(P.passengerTotals(n).awake,2);assert.equal(supportStock(ship).awakePeople,3);assert.equal(supportStock(ship).remainingUnits,'140');assert.equal(P.passengerCapacity(n).bookedCabins,1);assert.equal(passengerLuggage(ship),'4');assert.equal(n.contracts[0].payment,'54000');assert.equal(consumableRefillBasis(n).monthly,'14000');S.validate(JSON.parse(JSON.stringify(n)));assert.deepEqual(S.undo(n).contracts,s.contracts);
 const elapsed=S.transition(n,'Advance day',v=>v.hours+=24);assert.equal(supportStock(P.passengerShip(elapsed)).remainingUnits,'137');
 const arrived=S.transition(elapsed,'Arrive',v=>v.actual='1,0'),delivered=S.transition(arrived,'Complete passage',v=>S.deliverPassengers(v,n.contracts[0].id));
 assert.equal(delivered.bank,'154000');assert.equal(P.passengerTotals(delivered).total,0);assert.equal(supportStock(P.passengerShip(delivered)).remainingUnits,'137');assert.equal(passengerLuggage(P.passengerShip(delivered)),'0');assert.deepEqual(S.undo(delivered).contracts,arrived.contracts);assert.throws(()=>S.transition(delivered,'Duplicate delivery',v=>S.deliverPassengers(v,n.contracts[0].id)),/awaiting/);
});
test('Luxury requires eligible cabins, service confirmation, capacity and valid counts',()=>{
 assert.throws(()=>board(fixture(),{serviceConfirmed:false}),/Steward/);
 const s=fixture();s.ship.accommodation.rooms={low:0,middle:3,high:0};assert.throws(()=>board(s),/High or Luxury cabins/);
 for(const cabinMode of ['cargo','low'])assert.throws(()=>board(fixture(),{cabinMode}));
 assert.throws(()=>board(fixture(),{count:3,cabinMode:'private'}),/cabins/);
 for(const count of [-1,0,1.5,NaN])assert.throws(()=>board(fixture(),{count}));
 const small=fixture();small.ship.capacity='3';assert.throws(()=>board(small),/cargo capacity/);
 for(const field of ['rooms','passengers','crew'])for(const value of [-1,1.5,'2',NaN]){const bad=fixture();bad.ship.accommodation[field].luxury=value;assert.throws(()=>validateAccommodation(bad.ship));}
 const bad=fixture();bad.ship.accommodation.refillRates={luxury:'-1'};assert.throws(()=>validateAccommodation(bad.ship));
});
test('old saves, old core traffic, zero luggage overrides and historical rates remain intact',()=>{
 const s=fixture();delete s.ship.accommodation.rooms.luxury;const bytes=JSON.stringify(s);S.validate(s);supportStock(s.ship);consumableRefillBasis(s);assert.equal(JSON.stringify(s),bytes);assert.equal(Object.hasOwn(P.passengerTotals(s),'luxury'),false);
 for(const override of ['0','7']){const fixed=fixture();fixed.ship.accommodation.luggageMode='manual';fixed.ship.accommodation.luggageTons=override;assert.equal(passengerLuggage(P.passengerShip(board(fixed))),override);}
 assert.deepEqual(PASSAGE_CLASSES,['low','basic','middle','high']);assert.ok(BOOKING_CLASSES.includes('luxury'));assert.throws(()=>passengerFare('luxury',1,core));
 const ctx={world:{name:'Test',raw:{PBG:'100'}},uwp:{population:5,starport:'C'},zone:'Safe'};assert.deepEqual(passengerOffers(ctx,ctx,1,{},core,()=>2).map(o=>o.passageClass),PASSAGE_CLASSES);assert.equal(passengerFare('high',1,core),'9000');
});
test('Luxury expenses and legacy refill audit reconcile without changing stock or cabin prices',()=>{
 const s=fixture();s.ship.accommodation.passengers={low:0,middle:0,high:0,luxury:2};s.ship.accommodation.rooms={low:0,middle:0,high:0,luxury:1};s.ship.accommodation.passengerCapacity.reservedCabins=0;
 assert.equal(expenseQuote(s.worlds[s.actual],{kind:'staterooms',period:'month',units:1,rooms:s.ship.accommodation.rooms}).amount,'1000');
 assert.equal(expenseQuote(s.worlds[s.actual],{kind:'passengerSupport',period:'week',units:1,passengers:s.ship.accommodation.passengers}).amount,'2500');
 s.ship.lifeSupport.stockUnits=A.auditNumber(0);const q=refillQuote(s);assert.equal(q.monthly,'11000');assert.equal(q.cabinCharge,'1000');assert.equal(q.luxuryServiceCharge,'8000');assert.equal(q.basicSupplyCharge,'2000');assert.equal(q.highServiceCharge,'0');assert.equal(q.amount,'11004');
});


test('untyped crew reservations require explicit referee confirmation of free premium cabins',()=>{
 const s=fixture();s.ship.accommodation.rooms={low:0,middle:2,high:1,luxury:0};s.ship.accommodation.passengerCapacity.reservedCabins=1;
 // The app cannot infer which installed cabin the crew reservation uses.
 assert.throws(()=>board(s,{serviceConfirmed:false}),/Steward/);
 const n=board(s,{serviceConfirmed:true});assert.equal(n.contracts[0].serviceConfirmed,true);assert.match(n.contracts[0].audit.reason,/allocation/);
});
