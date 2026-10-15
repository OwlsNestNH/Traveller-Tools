import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/amounts.mjs';
import * as S from '../js/state.mjs';
import {supportCompartments,consumeReserveCompartments} from '../js/lss-compartments.mjs';
import {supportAmount,consumeSupport,supportCargo,supportStock} from '../js/life-support.mjs';
import {campaignRefillDraft,editRefillDraft,renderRefillDraft} from '../js/lss-refill-draft.mjs';
import {compartmentRefillQuote} from '../js/lss-refill-transaction.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';
const allocation=(internal,cargo)=>({internal,cargo,total:A.auditNumber(A.add(internal,cargo))});
const equal=(actual,expected)=>assert.equal(A.cmp(supportAmount(actual),supportAmount(expected)),0);
const ship=()=>{const s=guiFixture().state;s.ship.lifeSupport={capacityHours:672,stockUnits:'1000',cargoUnits:'200',roundCargoSpace:true};return s;};
test('reserve consumption stays internal until a whole-ton space opens',()=>{
 let n=consumeReserveCompartments(allocation(800,200),'99.99',800);equal(n.internal,'700.01');equal(n.cargo,200);equal(n.transferred,0);equal(n.total,'900.01');
 n=consumeReserveCompartments(n,'0.01',800);equal(n.internal,800);equal(n.cargo,100);equal(n.transferred,100);equal(n.total,900);
 n=consumeReserveCompartments(n,100,800);equal(n.internal,800);equal(n.cargo,0);equal(n.total,800);
});
test('room for a batch triggers a full transfer and never a partial transfer',()=>{
 for(const [internal,expectedCargo,expectedInternal] of [[701,200,701],[700,100,800],[650,100,750],[600,0,800]]){
  const n=consumeReserveCompartments(allocation(internal,200),0,800);equal(n.cargo,expectedCargo);equal(n.internal,expectedInternal);equal(n.total,internal+200);
 }
});
test('large and partitioned hourly consumption conserve exact stock and produce identical allocations',()=>{
 const s=ship(),a=structuredClone(s.ship),b=structuredClone(a);consumeSupport(a,2400);for(let i=0;i<2400;i++)consumeSupport(b,1);
 assert.deepEqual(a.lifeSupport,b.lifeSupport);equal(supportCompartments(a).total,800);equal(supportCompartments(a).cargo,0);equal(supportCompartments(a).internal,800);
});
test('legacy fractional reserve remains aboard without fabrication or partial transfer',()=>{
 const n=consumeReserveCompartments(allocation(700,'101.5'),900,800);equal(n.transferred,100);equal(n.internal,0);equal(n.cargo,'1.5');equal(n.total,'1.5');equal(n.consumed,800);
 const s=ship();s.ship.lifeSupport={capacityHours:672,stockUnits:'1.5',cargoUnits:'1.5',roundCargoSpace:true};equal(supportCargo(s.ship),1);assert.equal(supportStock(s.ship).remainingDays,'0','Unusable legacy fraction cannot extend endurance');
});
test('small internal capacity cannot receive a whole reserve ton',()=>{
 const n=consumeReserveCompartments(allocation(80,200),100,80);equal(n.internal,0);equal(n.cargo,200);equal(n.transferred,0);equal(n.total,200);
});
test('new cargo refill batches add exactly 100 LSS and retain existing legacy fractions',()=>{
 const s=ship();s.ship.lifeSupport={capacityHours:672,stockUnits:'901.5',cargoUnits:'101.5',roundCargoSpace:true};
 let d=campaignRefillDraft(s).draft;assert.equal(d.cargoBatches,true);d=editRefillDraft(d,'cargo-step',1);equal(d.cargo,'201.5');
 const q=compartmentRefillQuote(s,d);equal(q.purchasedUnits,100);equal(q.discardedUnits,0);equal(q.afterCargoUnits,'201.5');equal(q.afterStockUnits,'1001.5');
 const n=S.transition(s,'Life support refill',v=>S.refillCompartments(v,d));equal(n.ship.lifeSupport.stockUnits,'1001.5');assert.equal(n.ship.lifeSupport.roundCargoSpace,true);S.validate(n);
 assert.throws(()=>editRefillDraft(d,'cargo','202'),/whole tons/);assert.match(renderRefillDraft(d,{quote:q,blocked:''}),/step="100"/);
});
test('GM reserve reduction is whole batches, preserves legacy remainder, charges nothing',()=>{
 const s=ship();s.ship.lifeSupport={capacityHours:672,stockUnits:'901.5',cargoUnits:'101.5',roundCargoSpace:true};
 const d=editRefillDraft(campaignRefillDraft(s).draft,'cargo-step',-1),q=compartmentRefillQuote(s,d,{gm:true});equal(q.afterCargoUnits,'1.5');
 assert.throws(()=>compartmentRefillQuote(s,d),/GM Adjustment/);const n=S.transition(s,'GM reserve adjustment',v=>S.refillCompartments(v,d,{gm:true}));assert.equal(n.bank,s.bank);assert.deepEqual(n.ledger,s.ledger);equal(n.ship.lifeSupport.stockUnits,'801.5');
});
test('refill preview includes automatic whole-batch transfers without altering total or internal purchase terms',()=>{
 const s=ship();let d=campaignRefillDraft(s).draft;d=editRefillDraft(d,'internal','600');
 const q=compartmentRefillQuote(s,d,{gm:true});equal(q.transferredUnits,200);equal(q.compartments.internal.after,800);equal(q.compartments.cargo.after,0);equal(q.afterStockUnits,800);
 const n=S.transition(s,'GM storage adjustment',v=>S.refillCompartments(v,d,{gm:true}));equal(supportCompartments(n.ship).internal,800);equal(supportCompartments(n.ship).cargo,0);S.validate(n);
});
test('refill available space uses rounded reserved cargo rather than double charging the legacy tail',()=>{
 const s=ship();s.ship.lifeSupport={capacityHours:672,stockUnits:'901.5',cargoUnits:'101.5',roundCargoSpace:true};
 const d=campaignRefillDraft(s).draft,full=editRefillDraft(d,'fill-cargo'),q=compartmentRefillQuote(s,full);const n=S.transition(s,'Life support refill',v=>S.refillCompartments(v,full));S.validate(n);assert.ok(A.cmp(S.used(n),n.ship.capacity)<=0);equal(q.discardedUnits,0);
});

test('recurring legacy tails use exact batch buttons instead of incompatible native decimal editing',()=>{
 const s=ship();s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'2701',denominator:'3'},cargoUnits:{numerator:'301',denominator:'3'},roundCargoSpace:true};
 const original=campaignRefillDraft(s).draft,plus=editRefillDraft(original,'cargo-step',1),q=compartmentRefillQuote(s,plus);equal(q.purchasedUnits,100);equal(q.discardedUnits,0);equal(q.afterCargoUnits,{numerator:'601',denominator:'3'});
 assert.match(renderRefillDraft(original,{quote:q,blocked:''}),/readonly aria-label="Approximate cargo LSS; use exact reserve buttons"/);
 const restored=editRefillDraft(plus,'cargo-step',-1);assert.deepEqual(restored.cargo,original.cargo);
});

test('physical supply consumption without a recorded hull still works before compartment setup',()=>{
 const s=ship();delete s.ship.fuel;s.ship.lifeSupport={capacityHours:672,stockUnits:'1000',roundCargoSpace:true};consumeSupport(s.ship,24);equal(s.ship.lifeSupport.stockUnits,998);assert.equal(s.ship.lifeSupport.cargoUnits,undefined);
});
