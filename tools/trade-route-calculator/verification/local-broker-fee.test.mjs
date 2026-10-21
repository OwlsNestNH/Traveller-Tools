import test from 'node:test';
import assert from 'node:assert/strict';
import {localBrokerFeePercent} from '../js/local-broker-fee.mjs';
test('only a chosen local broker receives a new transaction commission',()=>{
 for(const contact of [null,{}, {options:{}},{options:{local:false}}])for(const input of [undefined,10,100,'bad'])assert.equal(localBrokerFeePercent(contact,input),0);
 const local={options:{local:true}};assert.equal(localBrokerFeePercent(local),10);
 for(const fee of [0,7.5,10,20,100])assert.equal(localBrokerFeePercent(local,String(fee)),fee);
 assert.equal(localBrokerFeePercent({options:{local:false}},7.5),0,'switching away removes effective commission');
});
test('local commission requires a finite bounded numeric input',()=>{
 for(const input of ['', ' ',null,true,{},NaN,Infinity,-1,100.01,'bad'])assert.throws(()=>localBrokerFeePercent({options:{local:true}},input),/0 to 100/);
});
test('reading new terms never changes old saved commission data',()=>{
 const contact={options:{local:true},history:{fee:'2400',percent:20}},before=structuredClone(contact);
 assert.equal(localBrokerFeePercent(contact),10);assert.deepEqual(contact,before);
});

import {harness,campaign} from './app-harness.mjs';
function purchase(local){const s=campaign();s.bank='100000';s.ship.capacity='100';s.snapshots=[{id:'supplier',kind:'supplier',hours:0,startedHours:0,worldId:s.actual,party:'test',partyName:'Synthetic supplier',options:{local},offers:[{id:'offer',commodity:'11',description:'Synthetic electronics',remaining:'10',expired:false,unitPrice:'1000',audit:{}}]}];return harness(s);}
for(const local of [false,true])test('purchase fee visibility and persisted amount, local='+local,async()=>{
 const h=purchase(local),before=JSON.stringify(h.persisted());h.api.buyForm('offer');const html=h.dom.ids.get('modal-body').innerHTML;
 assert.equal(/Broker commission · %/.test(html),local);assert.equal(h.dom.fields().get('fee').value,local?'10':'0');
 h.fill({quantity:'2',fee:'7.5'});h.api.updatePurchaseTotals();assert.equal(JSON.stringify(h.persisted()),before);
 await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');const s=h.persisted();assert.equal(s.bank,local?'97850':'98000');assert.equal(s.lots[0].audit.feePercent,local?7.5:0);assert.equal(s.lots[0].audit.fee,local?'150':'0');
});
test('cancelled local purchase does not persist fee changes',()=>{const h=purchase(true),before=JSON.stringify(h.persisted());h.api.buyForm('offer');h.fill({fee:'33'});h.api.updatePurchaseTotals();h.api.closeModal();assert.equal(JSON.stringify(h.persisted()),before);h.api.buyForm('offer');assert.equal(h.dom.fields().get('fee').value,'10');});
for(const local of [false,true])test('sale commission stays conditional and is recorded once, local='+local,async()=>{
 const s=campaign();s.bank='100000';s.ship.capacity='100';s.lots=[{id:'lot',commodity:'11',description:'Synthetic cargo',quantity:'2',basis:'1000',goodsValue:'1000'}];s.snapshots=[{id:'buyer',kind:'buyer',worldId:s.actual,party:'test',partyName:'Synthetic buyer',hours:0,startedHours:0,success:true,criminal:false,options:{local,skill:1,counterparty:2},offers:[]}];
 const h=harness(s);h.api.setSelected(['lot']);h.api.beginSale();assert.equal(/Broker commission — %/.test(h.dom.ids.get('modal-body').innerHTML),local);assert.equal(h.dom.fields().get('fee').value,local?'10':'0');h.fill({fee:'7.5'});h.api.updateSaleReview();const preview=structuredClone(h.api.modalSession.saleOwner.preview);assert.equal(preview.options.feePercent,local?7.5:0);await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');const saved=h.persisted();assert.equal(saved.bank,String(100000n+BigInt(preview.bankDelta)));assert.equal(saved.ledger.find(e=>e.type==='Sale').audit.feePercent,local?7.5:0);assert.equal(saved.ledger.filter(e=>e.type==='Broker fee').length,local?1:0);
});
test('commodity information opens existing recorded audit without a transaction or reroll',()=>{
 const h=purchase(false),before=JSON.stringify(h.persisted()),calls={...h.calls};
 const html=h.api.marketPanel();assert.match(html,/aria-label="Information and audit for/);assert.match(html,/data-action="offer-audit"/);
 h.api.actions['offer-audit']('offer');assert.match(h.dom.ids.get('modal-body').innerHTML,/Available quantity/);h.api.closeModal();
 assert.equal(JSON.stringify(h.persisted()),before);assert.deepEqual(h.calls,calls);
});
test('Add trade good explicitly records aboard standard or Other cargo',()=>{
 const h=purchase(false);assert.match(h.api.tradeToolbar(),/Add trade good/);h.api.actions['add-lot']();const html=h.dom.ids.get('modal-body').innerHTML;
 assert.match(html,/Standard commodity \(catalog\)/);assert.match(html,/Other \(custom item\)/);assert.match(html,/does not debit the bank/);
});
