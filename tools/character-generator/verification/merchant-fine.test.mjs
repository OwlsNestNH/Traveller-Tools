import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantFineRoll,merchantFineOptions,merchantFineOutcome} from '../engine/merchant-fine.mjs';
test('six fine rows use the supplied die and p269 source',()=>{
 for(let die=1;die<=6;die++){const r=merchantFineRoll({die});assert.equal(r.amount,die*1000);assert.equal(r.source.page,269);}
 for(const die of [undefined,null,0,7,1.5,'3'])assert.throws(()=>merchantFineRoll({die}));
});
test('only affordable full cash payment is offered; decline remains available',()=>{
 for(const cash of [2999,3000,3001]){const r=merchantFineOptions({die:3,cash});assert.equal(r[0].available,cash>=3000);assert.equal(r[1].available,true);}
 assert.throws(()=>merchantFineOptions({die:3,cash:NaN}));
 assert.throws(()=>merchantFineOutcome({die:3,cash:2999,socialStanding:9,decision:'pay'}),/Insufficient cash/);
 const paid=merchantFineOutcome({die:3,cash:3000,socialStanding:9,decision:'pay'});
 assert.equal(paid.cashAfter,0);assert.equal(paid.reeducation,false);assert.equal(paid.disposition,'stay');assert.deepEqual(paid.payment,{amount:3000,funding:'cash'});
});
test('declining never invents debt and the SOC9/10 boundary governs separate re-education',()=>{
 for(const socialStanding of [0,9,10,15])for(const protectedStay of [false,true]){
  const r=merchantFineOutcome({die:6,cash:6000,socialStanding,decision:'decline',protectedStay});
  assert.equal(r.cashAfter,6000);assert.equal(r.debtDelta,0);assert.equal(r.payment,null);
  assert.equal(r.reeducation,socialStanding<=9);assert.equal(r.disposition,protectedStay?'stay':'leave');
  assert.equal(r.nonpaymentDischarge,!protectedStay);assert.equal(r.elapsedMonths,0);assert.equal(r.careerTerms,0);
 }
});
test('missing or invalid decisions and context are rejected, never guessed',()=>{
 const base={die:2,cash:10000,socialStanding:9,decision:'decline'};
 for(const decision of [undefined,null,'debt','partial'])assert.throws(()=>merchantFineOutcome({...base,decision}));
 for(const socialStanding of [undefined,NaN,9.5,-1,41])assert.throws(()=>merchantFineOutcome({...base,socialStanding}));
 assert.throws(()=>merchantFineOutcome({...base,protectedStay:1}));
});
