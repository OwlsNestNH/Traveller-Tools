import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as S from '../js/state.mjs';
import * as P from '../js/passengers.mjs';
import * as A from '../js/amounts.mjs';
import * as R from '../js/rules.mjs';
import {passengerOffers} from '../js/passenger-rules.mjs';
import {supportStock,configureSupport,monthlySupport,refillQuote} from '../js/life-support.mjs';
import {manualLuggage,passengerLuggage} from '../js/accommodation.mjs';
import {campaignReport} from '../js/report.mjs';
import {cargoManifest} from '../js/cargo-hold.mjs';
import {expenseOverview} from '../js/expense-panels.mjs';
const core=JSON.parse(await readFile(new URL('../rules/core-2022.json',import.meta.url)));
function base({awake=4,rooms=5,reserved=2,low=6}={}){
 let s=S.initial();s.initialized=true;s.actual='0,0';s.worlds={'0,0':{id:'0,0',name:'Origin',sector:'Test',hex:'0101',uwp:'A788999-C',zone:'Safe',x:0,y:0,raw:{PBG:'100'}},'1,0':{id:'1,0',name:'Destination',sector:'Test',hex:'0201',uwp:'A788999-C',zone:'Safe',x:1,y:0,raw:{PBG:'100'}}};s.bank='100000';s.ship.capacity='60';s.ship.fuel={displacementTons:200,capacityTons:40,aboardTons:40};
 s.ship.accommodation={rooms:{low:0,middle:0,high:rooms},passengers:{low:0,middle:awake,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,combinedPeople:true,luggageMode:'auto',luggageTons:'0'};
 s.ship.lifeSupport=configureSupport(s.ship,{stockUnits:'140'});s=S.transition(s,'Passenger capacity settings',n=>S.configurePassengerCapacity(n,{reservedCabins:reserved,installedLowBerths:low}));
 const offers=passengerOffers(R.context(s.worlds['0,0'],core),R.context(s.worlds['1,0'],core),1,{effect:5,steward:1},core,()=>2).map(o=>({...o,offerId:S.uid(),origin:'0,0',destination:'1,0'}));
 return S.transition(s,'Passenger search',n=>S.recordPassengerSearch(n,{id:S.uid(),label:'Passenger search audit',hours:0,world:'0,0',destination:'1,0',offers}));
}
const offer=(s,type)=>P.latestPassengerSearch(s).offers.find(o=>o.passageClass===type);
const board=(s,type,count=1,mode=type==='low'?'low':type==='basic'?'shared':'private')=>S.transition(s,'Accepted passenger booking',n=>S.acceptPassengers(n,offer(s,type).offerId,{count,cabinMode:mode,serviceConfirmed:true,spaceConfirmed:true}));
const stock=s=>supportStock(P.passengerShip(s));
test('boarding is derived once, preserves baseline/stock/bank, and cannot miscount people as cargo tons',()=>{
 const s=base(),before=structuredClone(s.ship),n=board(s,'middle',2);
 assert.deepEqual(n.ship,s.ship);assert.equal(n.bank,s.bank);assert.deepEqual(n.ship.accommodation,before.accommodation);assert.equal(stock(n).awakePeople,6);assert.equal(stock(n).dailyUnits,'6');assert.equal(stock(n).remainingUnits,'140');assert.equal(A.decimal(S.used(n)),'0');assert.equal(P.passengerCapacity(n).freeCabins,1);
 assert.equal(P.passengerOfferRemaining(n,offer(n,'middle')),offer(n,'middle').count-2);assert.equal(n.contracts[0].count,2);assert.equal(n.contracts[0].quantity,undefined);
 assert.deepEqual(S.undo(n).ship,s.ship);assert.deepEqual(S.undo(n).contracts,s.contracts);S.validate(JSON.parse(JSON.stringify(n)));
});
test('High double occupancy preserves the established Cr7000 shared-cabin example',()=>{
 const s=base({awake:0,rooms:1,reserved:0}),n=board(s,'high',2,'shared'),ship=P.passengerShip(n);
 assert.equal(P.passengerCapacity(n).bookedCabins,1);assert.equal(monthlySupport(ship),7000n);assert.equal(expenseOverview(n).rows.find(x=>x.kind==='support').amount,'7000');assert.equal(passengerLuggage(ship),'2');
 assert.throws(()=>board(n,'high',1,'shared'),/cabins/);assert.throws(()=>board(s,'high',2,'private'),/cabins/);assert.equal(s.contracts.length,0);
});
test('partial bookings share compatible seats and never exceed source availability',()=>{
 let s=base({awake:0,rooms:1,reserved:0});s=board(s,'basic',1);s=board(s,'basic',1);assert.equal(P.passengerCapacity(s).bookedCabins,1);assert.throws(()=>board(s,'basic',1),/cabins/);
 let lots=base({awake:0,rooms:30,reserved:0});const count=offer(lots,'middle').count;lots=board(lots,'middle',count-1);lots=board(lots,'middle',1);assert.equal(P.passengerOfferRemaining(lots,offer(lots,'middle')),0);assert.throws(()=>board(lots,'middle',1),/availability/);
 for(const n of [0,-1,0.5,'2',NaN])assert.throws(()=>board(base(),'middle',n));
});
test('frozen Low is separate from low-service cabins and changes LSS/billing only once',()=>{
 const s=base({low:1}),n=board(s,'low');assert.equal(stock(n).awakePeople,4);assert.equal(stock(n).occupiedLowBerths,1);assert.equal(stock(n).dailyUnits,'4.1');assert.equal(monthlySupport(P.passengerShip(n)),9100n);assert.equal(refillQuote(n).monthly,'9100');assert.throws(()=>board(n,'low'),/Low berths/);
 const day=S.transition(n,'Time advanced',v=>v.hours+=24);assert.equal(stock(day).remainingUnits,'135.9');assert.deepEqual(S.undo(day).ship.lifeSupport,n.ship.lifeSupport);
 const paid=S.transition(n,'Support expense',v=>S.shipExpenses(v,[{kind:'passengerSupport',period:'month',units:1}]));assert.equal(paid.ledger.at(-1).expense.amount,'4100');assert.deepEqual(paid.ship.accommodation,n.ship.accommodation);
});
test('baggage rounds the aggregate once; fixed legacy and current whole-ship overrides retain zero/custom values',()=>{
 let s=base();s.ship.roundTons=true;let n=board(s,'low');n=board(n,'low');assert.equal(A.decimal(S.used(n)),'1');
 for(const value of ['0','3'])for(const legacy of [false,true]){s=base();s.ship.accommodation.luggageTons=value;if(legacy){delete s.ship.accommodation.combinedPeople;delete s.ship.accommodation.luggageMode;}else s.ship.accommodation.luggageMode='manual';assert.equal(manualLuggage(s.ship),true);n=board(s,'high');assert.equal(passengerLuggage(P.passengerShip(n)),value);}
 s=base();s.ship.accommodation.passengers.high=1;s.ship.accommodation.luggageTons='999';assert.equal(manualLuggage(s.ship),false);assert.equal(passengerLuggage(P.passengerShip(board(s,'high'))),'2');
});
test('fitted Basic space and baggage are reserved once alongside freight and existing goods',()=>{
 const s=base();s.contracts.push({id:'freight',kind:'freight',status:'accepted',origin:'0,0',destination:'1,0',quantity:'5',payment:'1000',dueHours:null});const n=board(s,'basic',2,'cargo');assert.equal(A.decimal(S.used(n)),'9.02');assert.equal(P.passengerCapacity(n).bookedCabins,0);const m=cargoManifest(n);assert.equal(A.decimal(m.freight),'5');assert.equal(A.decimal(m.passengerAccommodation),'4');assert.equal(m.contracts.length,1);
 s.ship.capacity='7';assert.throws(()=>board(s,'basic',1,'cargo'),/cargo capacity/);
});
test('destination-only payment is once, releases occupancy, leaves consumed stock, and Undo restores booking and bank',()=>{
 let s=board(base(),'high',2,'shared');const id=s.contracts[0].id,payment=s.contracts[0].payment;
 assert.throws(()=>S.transition(s,'Deliver',n=>S.deliver(n,id)),/actual|ship|world/i);s=S.transition(s,'Arrive',n=>{n.actual='1,0';n.hours+=168;});const before=structuredClone(s),n=S.transition(s,'Delivered passenger booking',v=>S.deliver(v,id));
 assert.equal(n.bank,String(BigInt(s.bank)+BigInt(payment)));assert.equal(n.ledger.filter(e=>e.type==='Passenger delivery').length,1);assert.deepEqual(n.ship.lifeSupport,s.ship.lifeSupport);assert.equal(stock(n).awakePeople,4);assert.equal(A.decimal(S.used(n)),'0');assert.throws(()=>S.transition(n,'Again',v=>S.deliver(v,id)),/awaiting/);
 const restored=S.undo(n);assert.deepEqual(restored.contracts,before.contracts);assert.equal(restored.bank,before.bank);assert.deepEqual(restored.ship.lifeSupport,before.ship.lifeSupport);S.validate(JSON.parse(JSON.stringify(n)));
 const report=campaignReport(n,core);assert.match(report,/Passenger income:\s+Cr 18,000/);assert.equal(n.contracts[0].late,undefined);assert.equal(n.contracts[0].penaltyDie,undefined);
});
test('malformed imports and active capacity reductions fail before replacing valid state',()=>{
 const n=board(base(),'high');for(const change of [s=>s.contracts[0].count=1.5,s=>s.contracts[0].payment='1',s=>s.contracts[0].quantity='1',s=>s.contracts[0].offerId='missing',s=>s.contracts[0].serviceConfirmed=false,s=>s.ship.accommodation.passengerCapacity.installedLowBerths=-1]){const bad=structuredClone(n);change(bad);assert.throws(()=>S.validate(bad));}
 assert.throws(()=>S.transition(n,'Reduce cabins',s=>s.ship.accommodation.rooms.high=2),/cabins/);assert.deepEqual(n.contracts[0].count,1);
});
test('legacy day stock anchors before boarding; roundExisting never reprices accepted passages',()=>{
 const s=base();s.ship.lifeSupport={capacityHours:672,remainingHours:336};const n=board(s,'middle');assert.equal(stock(n).remainingUnits,'56');assert.equal(stock(n).remainingDays,'11.2');assert.deepEqual(S.undo(n).ship.lifeSupport,s.ship.lifeSupport);
 const round=S.transition(n,'Rounding',v=>S.applyRounding(v));assert.equal(round.contracts[0].payment,n.contracts[0].payment);assert.deepEqual(round.contracts[0].audit,n.contracts[0].audit);
});

test('origin population threshold applies across classes and explicit exceptions are audited',()=>{
 const s=base();const search=P.latestPassengerSearch(s);for(const o of search.offers)o.audit.originPopulation='2';const first=board(s,'middle',2);
 assert.throws(()=>board(first,'low'),/population/);const exception=S.transition(first,'Accepted exceptional passenger',n=>S.acceptPassengers(n,offer(n,'low').offerId,{count:1,cabinMode:'low',populationException:'Stranded visitor, not a permanent resident.'}));assert.equal(exception.contracts.at(-1).populationException,'Stranded visitor, not a permanent resident.');assert.equal(exception.contracts.at(-1).count,1);
 const zero=base();for(const o of P.latestPassengerSearch(zero).offers)o.audit.originPopulation='0';assert.throws(()=>board(zero,'low'),/population/);
});
test('baseline frozen billing stays unchanged while newly booked Low adds Cr100 and physical consumption once',()=>{
 const s=base();s.ship.accommodation.occupiedLowBerths=2;assert.equal(monthlySupport(s.ship),9000n);assert.equal(stock(s).dailyUnits,'4.2');const n=board(s,'low');assert.equal(monthlySupport(P.passengerShip(n)),9100n);assert.equal(stock(n).dailyUnits,'4.3');assert.equal(stock(n).occupiedLowBerths,3);assert.equal(refillQuote(n).monthly,'9100');assert.deepEqual(n.ship.accommodation,s.ship.accommodation);
});
