import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as A from '../js/amounts.mjs';
import * as S from '../js/state.mjs';
import {up,creditStep} from '../js/rounding.mjs';
import {normalizeAmount} from '../js/form-values.mjs';
import {preparePurchaseAmounts} from '../js/purchase-amounts.mjs';
import {harness,campaign,origin} from './app-harness.mjs';
const source=await readFile(new URL('fixtures/purchase-amounts-before-pilot.mjs',import.meta.url),'utf8');
const before=vm.runInNewContext(source+'\nbeforePurchaseAmounts',{A,up,creditStep});
function legacy(i){return before({get:key=>key==='quantity'?i.quantity:i.fee},{unitPrice:i.unitPrice},{settings:{creditStep:i.creditStep}});}
function result(call){try{const {quantity,feePercent,cost,fee}=call();return {quantity,feePercent,cost,fee};}catch(e){return {error:e.message};}}
test('exact amounts and errors match checkpoint across ordinary, fractional, huge and invalid entries',()=>{
 let count=0;
 for(const quantity of ['1','2','1.1','0.01',' 02.00 ','90071992547409931234567','0','-1','','bad','1e2'])for(const fee of ['0','7','7.1','100','-1','101','','bad','Infinity','1e-7'])for(const unitPrice of ['0','1001','1000.1','90071992547409931234567','-1','bad'])for(const creditStep of [1,100]){
  const i=Object.freeze({quantity,fee,unitPrice,creditStep});assert.deepEqual(result(()=>preparePurchaseAmounts(i)),result(()=>legacy(i)),JSON.stringify(i));count++;
 }
 assert.equal(count,1320);
});
test('preparation keeps quantity normalization and authoritative fee validation with existing owners',()=>{
 const raw=preparePurchaseAmounts({quantity:'1.1',fee:'101',unitPrice:'1001',creditStep:1});
 assert.equal(raw.quantity,'1.1','No new whole-ton normalization');assert.equal(raw.feePercent,101,'No new broker-fee validation');assert.equal(raw.cost,1102n);
 assert.equal(preparePurchaseAmounts({quantity:'2',fee:'7',unitPrice:'1001',creditStep:1}).fee,141n);
 assert.deepEqual(result(()=>preparePurchaseAmounts({quantity:'0',fee:'bad',unitPrice:'bad',creditStep:1})),{error:'Quantity must be positive.'});
});
test('headless consumer normalizes an entry, prepares amounts and feeds existing buy without DOM or new quote dice',()=>{
 for(const step of [1,100]){
  const state=campaign();state.settings.creditStep=step;state.ship.capacity='10';
  const offer={id:'synthetic-offer',commodity:'11',description:'Synthetic cargo',remaining:'6',unitPrice:'1000.1',audit:{dice:{dice:[5,5,2],total:12},tradeComplication:{version:1,result:'complication'}}};
  state.snapshots=[{id:'synthetic-supplier',worldId:origin.id,party:'synthetic|supplier',offers:[offer]}];
  const saved=structuredClone(state),quantity=normalizeAmount('1.1',{unit:'tons'}).value;
  const prepared=preparePurchaseAmounts({quantity,fee:'7',unitPrice:offer.unitPrice,creditStep:step});
  const args={snapshotId:state.snapshots[0].id,offerId:offer.id,quantity:prepared.quantity,feePercent:prepared.feePercent,description:offer.description};
  S.buy(state,args);const lot=state.lots[0];
  assert.equal(lot.quantity,'2');assert.equal(lot.goodsValue,String(prepared.cost));assert.equal(lot.basis,String(prepared.cost+prepared.fee));assert.equal(state.bank,String(BigInt(saved.bank)-prepared.cost-prepared.fee));assert.deepEqual(lot.audit.price.audit,offer.audit);assert.deepEqual(saved.snapshots[0].offers[0].audit,offer.audit);
 }
});
test('production adapter keeps amount errors before insurance and cloned-state errors without a save',async()=>{
 const saved=campaign();saved.settings.insurance=true;
 saved.snapshots=[{id:'synthetic-supplier',worldId:origin.id,party:'synthetic|supplier',partyName:'Supplier',options:{local:false},offers:[{id:'synthetic-offer',commodity:'11',description:'Synthetic cargo',remaining:'6',unitPrice:'1001',audit:{dice:{dice:[5,5,2],total:12}}}]}];
 for(const [quantity,fee,expected]of [['0','bad','Quantity must be positive.'],['1','bad','Enter a nonnegative insured distance in parsecs'],['1','101','Enter a nonnegative insured distance in parsecs']]){
  const h=harness(saved);h.api.buyForm('synthetic-offer');h.fill({quantity,fee,insure:true,insuranceDistance:'',insuranceLegs:1});await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,expected);assert.equal(h.calls.saves,0);assert.deepEqual(h.persisted(),saved);
 }
});
