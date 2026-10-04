import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/state.mjs';
import {decimal} from '../js/amounts.mjs';
import {passengerLuggage} from '../js/accommodation.mjs';
const manifest=()=>({lowBerths:5,passengers:{low:2,middle:3,high:1},crew:{low:0,middle:4,high:0}});
function campaign(){const s=S.initial();s.initialized=true;s.actual='0,0';s.bank='100000';s.worlds={'0,0':{id:'0,0',x:0,y:0,hex:'0101',sector:'Test',name:'Port',uwp:'A788899-C',zone:'Safe'}};s.ship.accommodation=manifest();return s;}
test('only actual passengers reserve luggage; legacy refill defaults do not silently reserve space',()=>{
 const s=campaign();assert.equal(passengerLuggage(s.ship),'1.32');assert.equal(decimal(S.used(s)),'1.32');
 s.ship.supportOccupants=manifest();delete s.ship.accommodation;assert.equal(passengerLuggage(s.ship),'0');S.validate(s);
});
test('boarding and disembarking reconcile cargo space, preserve bank and undo atomically',()=>{
 const s=campaign(),next=S.transition(s,'Passengers leave',n=>n.ship.accommodation.passengers.high=0);
 assert.equal(decimal(S.used(next)),'0.32');assert.equal(next.bank,s.bank);assert.equal(decimal(S.used(S.undo(next))),'1.32');
 assert.deepEqual(S.validate(JSON.parse(JSON.stringify(next))),next);
 for(const value of [-1,0.5,'2',null]){const bad=campaign();bad.ship.accommodation.passengers.middle=value;assert.throws(()=>S.validate(bad));}
 const full=campaign();full.ship.capacity='1.32';assert.throws(()=>S.transition(full,'Board',n=>n.ship.accommodation.passengers.high++));assert.equal(full.ship.accommodation.passengers.high,1);
 assert.throws(()=>S.acceptContract(full,{kind:'freight',origin:'0,0',destination:'0,0',quantity:'0.01',payment:'100',offerId:'f'}));
 full.snapshots=[{id:'s',kind:'supplier',worldId:'0,0',party:'a',offers:[{id:'o',commodity:'11',remaining:'1',unitPrice:'100'}]}];
 assert.throws(()=>S.buy(full,{snapshotId:'s',offerId:'o',quantity:'0.01'}));
});
test('life support always uses saved actual headcounts and cannot change luggage by paying',()=>{
 const s=campaign(),before=structuredClone(s.ship.accommodation),next=S.transition(s,'Refill',n=>S.shipExpenses(n,[{kind:'passengerSupport',period:'week',units:1,passengers:{high:999},crew:{}}]));
 assert.equal(next.ledger.at(-1).expense.amount,'2500');assert.equal(next.bank,'97500');assert.deepEqual(next.ship.accommodation,before);assert.equal(passengerLuggage(next.ship),'1.32');
 assert.equal(S.undo(next).bank,s.bank);
});
test('actual luggage including zero replaces allowance independently of service upgrades',()=>{
 const s=campaign();s.ship.accommodation.luggageTons='0';
 s.ship.accommodation.passengersService={middle:{level:'high'},high:{level:'custom',monthly:'3500'}};
 assert.equal(passengerLuggage(s.ship),'0');S.validate(s);
 const next=S.transition(s,'Upgraded refill',n=>S.shipExpenses(n,[{kind:'passengerSupport',period:'week',units:1}]));
 assert.equal(next.ledger.at(-1).expense.amount,'2500');assert.match(JSON.stringify(next.ledger.at(-1).expense.details),/same rate for every person/);
 assert.equal(passengerLuggage(next.ship),'0');
 s.ship.accommodation.luggageTons='0.125';assert.equal(decimal(S.used(s)),'0.125');
 s.ship.accommodation.luggageTons=null;assert.equal(decimal(S.used(s)),'1.32');
 for(const luggageTons of ['-1','NaN'])assert.throws(()=>S.validate({...s,ship:{...s.ship,accommodation:{...s.ship.accommodation,luggageTons}}}));
 s.ship.accommodation.roomService={high:{level:'custom',monthly:'-1'}};assert.throws(()=>S.validate(s));
});

test('room breakdown migrates legacy totals and saved room services govern future expenses only',()=>{
 const s=campaign();s.ship.staterooms=3;
 const original=S.transition(s,'Old payment',n=>S.shipExpenses(n,[{kind:'staterooms',period:'week',units:1}]));
 assert.equal(original.ledger[0].expense.amount,'875'); // 5 low + 3 middle, including empty
 const next=S.transition(original,'Upgrade rooms',n=>{n.ship.accommodation.rooms={low:2,middle:3,high:1};n.ship.staterooms=6;n.ship.accommodation.roomService={middle:{level:'high'}};});
 const paid=S.transition(next,'Refill',n=>S.shipExpenses(n,[{kind:'staterooms',rooms:{middle:999},roomService:{middle:{level:'low'}},period:'week',units:1}]));
 assert.equal(paid.ledger.at(-1).expense.amount,'3050');assert.deepEqual(paid.ledger[0],original.ledger[0]);
 assert.deepEqual(S.validate(JSON.parse(JSON.stringify(paid))),paid);assert.equal(S.undo(paid).bank,next.bank);
 for(const value of [-1,1.5,'2',null]){const bad=structuredClone(next);bad.ship.accommodation.rooms.low=value;assert.throws(()=>S.validate(bad));}
});
