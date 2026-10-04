import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/expenses.mjs';
import * as S from '../js/state.mjs';
const world=(port='A')=>({id:'0,0',name:'Port',uwp:port+'788899-C',x:0,y:0,sector:'Test',hex:'0101',zone:'Safe'});
const campaign=()=>{const s=S.initial();s.initialized=true;s.actual='0,0';s.worlds={'0,0':world()};s.bank='100000';return s;};
test('stateroom and per-person refills use separate counts and weekly billing',()=>{
 const s=campaign();s.ship.staterooms=10;
 const support={kind:'passengerSupport',period:'week',units:2,passengers:{low:2,middle:3,high:1},crew:{middle:4}};
 assert.equal(E.expenseQuote(world(),support).amount,'5100');
 assert.equal(E.expenseQuote(world(),{...support,period:'month',units:1}).amount,'10200');
 assert.equal(E.expenseQuote(world(),{...support,passengers:{high:1},crew:{},units:1}).amount,'750');
 const after=S.transition(s,'Refill',n=>S.shipExpenses(n,[{kind:'staterooms',staterooms:999,period:'week',units:2},support]));
 assert.equal(after.bank,'89900');assert.equal(after.ledger[0].expense.amount,'5000');assert.deepEqual(after.ship.supportOccupants.passengers,support.passengers);assert.equal(S.undo(after).bank,s.bank);
 for(const invalid of [{...support,units:0},{...support,period:'day'},{...support,crew:{low:-1}},{...support,passengers:{},crew:{}}])assert.throws(()=>E.expenseQuote(world(),invalid));
 const legacy=campaign();delete legacy.ship.staterooms;assert.equal(S.validate(legacy),legacy);
 for(const staterooms of [-1,1.5,'4'])assert.throws(()=>S.validate({...s,ship:{...s.ship,staterooms}}));
});
test('all four expenses pay atomically, retain separate audits and undo together',()=>{
 const s=campaign();S.saveBerthingRate(s,2);
 const inputs=[{kind:'berthing',weeks:2},{kind:'fuel',fuelType:'unrefined',tons:'12.5',otherSupplier:true,notes:'Private depot'},{kind:'lifeSupport',monthly:'2000',months:2},{kind:'salary',monthly:'6000',months:1}];
 const after=S.transition(s,'Combined expenses',n=>S.shipExpenses(n,inputs));
 assert.equal(after.bank,'84700');assert.equal(after.ledger.length,4);assert.equal(new Set(after.ledger.map(e=>e.batchId)).size,1);assert.ok(after.ledger[0].batchId);
 assert.deepEqual(after.ledger.map(e=>e.expense.amount),['4000','1300','4000','6000']);assert.equal(after.ship.expenses.salary,'6000');assert.equal(after.ship.expenses.lifeSupport,'2000');
 assert.equal(S.undo(after).bank,s.bank);assert.equal(S.undo(after).ledger.length,0);assert.deepEqual(S.validate(JSON.parse(JSON.stringify(after))),after);
});
test('invalid or unaffordable batches never partially charge',()=>{
 const s=campaign(),before=structuredClone(s);
 for(const inputs of [[],[{kind:'salary',monthly:'60000',months:1},{kind:'lifeSupport',monthly:'60000',months:1}],[{kind:'salary',monthly:'600',months:1},{kind:'fuel',tons:'0',fuelType:'refined'}],[{kind:'salary',monthly:'600',months:1},{kind:'salary',monthly:'600',months:1}]]){
  assert.throws(()=>S.shipExpenses(s,inputs));assert.deepEqual(s,before);
 }
});
test('all starport weekly rates; saved roll reused and class change needs a new rate',()=>{
 for(const [port,rate] of Object.entries({A:4000,B:2000,C:400,D:40,E:0,X:0})){
  const w={...world(port),berthingRate:{port,die:4}};
  assert.equal(E.expenseQuote(w,{kind:'berthing',weeks:2}).amount,String(rate*2));
 }
 const s=campaign();assert.throws(()=>E.berthRate(s.worlds[s.actual]));S.saveBerthingRate(s,4);assert.throws(()=>S.saveBerthingRate(s,2));
 const before=structuredClone(s);S.shipExpense(s,{kind:'berthing',weeks:1});S.shipExpense(s,{kind:'berthing',weeks:2});assert.equal(s.bank,'88000');assert.deepEqual(s.worlds[s.actual].berthingRate,before.worlds[s.actual].berthingRate);
 s.worlds[s.actual].overrideUWP='B788899-C';assert.throws(()=>E.berthRate(s.worlds[s.actual]));
});
test('fuel type, fractional tons, availability and zero/invalid input',()=>{
 assert.equal(E.expenseQuote(world(),{kind:'fuel',fuelType:'refined',tons:'12.5'}).amount,'6500');
 assert.equal(E.expenseQuote(world('C'),{kind:'fuel',fuelType:'unrefined',tons:'12.5'}).amount,'1300');
 assert.throws(()=>E.expenseQuote(world('E'),{kind:'fuel',fuelType:'refined',tons:'1'}));
 assert.equal(E.expenseQuote(world('E'),{kind:'fuel',fuelType:'refined',tons:'1',otherSupplier:true,notes:'Private fuel depot'}).amount,'500');
 for(const tons of ['0','-1','NaN'])assert.throws(()=>E.expenseQuote(world(),{kind:'fuel',fuelType:'refined',tons}));
});
test('entered monthly costs persist, round-trip, and undo without affecting cargo basis or time',()=>{
 const s=campaign(),after=S.transition(s,'Salary',n=>S.shipExpense(n,{kind:'salary',monthly:'6500',months:2,notes:'001–060'}));
 assert.equal(after.bank,'87000');assert.equal(after.ship.expenses.salary,'6500');assert.equal(after.ledger[0].expense.amount,'13000');assert.equal(after.hours,s.hours);assert.deepEqual(after.lots,s.lots);
 assert.deepEqual(S.validate(JSON.parse(JSON.stringify(after))),after);assert.equal(S.undo(after).bank,s.bank);assert.equal(S.undo(after).ledger.length,0);
 assert.equal(E.expenseQuote(world(),{kind:'lifeSupport',monthly:'2000',months:3}).amount,'6000');
 for(const months of [0,-1,1.5,''])assert.throws(()=>E.expenseQuote(world(),{kind:'salary',monthly:'500',months}));
});
test('insufficient funds leaves state untouched; zero-cost berthing can be recorded',()=>{
 const s=campaign(),before=structuredClone(s);assert.throws(()=>S.shipExpense(s,{kind:'salary',monthly:'100001',months:1}));assert.deepEqual(s,before);
 s.worlds[s.actual]=world('E');S.shipExpense(s,{kind:'berthing',weeks:1});assert.equal(s.bank,'100000');assert.equal(s.ledger[0].amount,'0');
});
