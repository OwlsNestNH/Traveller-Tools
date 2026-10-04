import test from 'node:test';
import assert from 'node:assert/strict';
import {up,roundExisting} from '../js/rounding.mjs';
import * as S from '../js/state.mjs';
import * as E from '../js/expenses.mjs';
const world={id:'0,0',x:0,y:0,name:'Port',hex:'0101',sector:'Test',uwp:'A788899-C',zone:'Safe'};
function campaign(){const s=S.initial();s.worlds={'0,0':world};s.actual='0,0';s.initialized=true;s.bank='100001';s.ship.capacity='60';s.ship.accommodation={lowBerths:1,passengers:{low:1,middle:0,high:0},crew:{low:0,middle:0,high:0},luggageTons:'0.01'};s.lots=[{id:'l',commodity:'11',description:'Cargo',quantity:'0.2',basis:'151',goodsValue:'149'}];return s;}
test('exact upward rounding keeps zero and already rounded amounts, including large values',()=>{
 for(const [v,step,want]of [['0.01',1,1n],['0',100,0n],['100',100,100n],['100.01',100,200n],['149',100,200n],['-149',100,-100n],['999999999999999999.01',1,1000000000000000000n]])assert.equal(up(v,step),want);
});
test('bulk preview is separate, commits a balancing bank entry and undoes every current-value change',()=>{
 const s=campaign(),copy=structuredClone(s),preview=structuredClone(s),changes=roundExisting(preview);assert.deepEqual(s,copy);assert.ok(changes.some(c=>c.before==='0.01'&&c.after==='1'));
 const n=S.transition(s,'Round',x=>S.applyRounding(x));assert.equal(n.bank,'100100');assert.equal(n.ledger.at(-1).amount,'99');assert.equal(n.lots[0].quantity,'1');assert.equal(n.lots[0].basis,'200');assert.equal(n.ship.accommodation.luggageTons,'1');assert.equal(n.settings.creditStep,100);
 const undone=S.undo(n);assert.equal(undone.bank,s.bank);assert.deepEqual(undone.lots,s.lots);assert.deepEqual(undone.ship,s.ship);assert.deepEqual(undone.ledger,s.ledger);
});
test('rounding cannot overfill cargo or rewrite historical audits',()=>{
 const s=campaign();s.ship.capacity='1';s.ship.accommodation.luggageTons='0';s.lots.push({...s.lots[0],id:'l2',quantity:'0.2'});const before=structuredClone(s);assert.throws(()=>S.transition(s,'Round',x=>S.applyRounding(x)),/capacity/);assert.deepEqual(s,before);
 s.ship.capacity='60';s.ledger=[{id:'h',hours:0,type:'Old expense',amount:'-149',audit:{quantity:'0.1'}}];const n=S.transition(s,'Round',x=>S.applyRounding(x));assert.deepEqual(n.ledger[0],s.ledger[0]);
});
test('new weekly support rounds up once to Cr1 or Cr100 and fuel uses whole tons',()=>{
 const input={kind:'staterooms',period:'week',units:1,rooms:{middle:1},roomService:{middle:{level:'custom',monthly:'101'}}};
 assert.equal(E.expenseQuote(world,input).amount,'26');assert.equal(E.expenseQuote(world,{...input,creditStep:100}).amount,'100');
 assert.equal(E.expenseQuote(world,{kind:'fuel',fuelType:'refined',tons:'0.01'}).amount,'500');
});
