import test from 'node:test';
import assert from 'node:assert/strict';

// One preserved supplier offer, using actual app callbacks and the existing
// native DOM/store doubles. This does not exercise browser or visual rendering.
const explanation='Current retail uses current settings. Price % and Purchase Price use the saved supplier quote and its original retail basis; see Audit for the calculation.';
const clean=html=>html.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const facts=html=>Object.fromEntries([...html.matchAll(/<dt>([\s\S]*?)<\/dt><dd(?: [^>]*)?>([\s\S]*?)<\/dd>/g)].map(m=>[clean(m[1]),clean(m[2])]));
const market=html=>({headers:[...html.matchAll(/<th(?: [^>]*)?>([\s\S]*?)<\/th>/g)].map(m=>clean(m[1])),cells:[...html.matchAll(/<td(?: [^>]*)?>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]))});

test('current retail explains a Settings cap change while the saved supplier quote, Audit and purchase stay frozen',async t=>{
 let attemptedFetches=0;
 t.mock.method(globalThis,'fetch',()=>{attemptedFetches++;throw Error('Network is disabled for this native test');});
 const {harness,campaign,core,bindings,S,same}=await import('./app-harness.mjs');
 const seed=campaign();seed.bank='1000000';seed.trader.broker=6;
 Object.assign(seed.settings,{insurance:false,creditStep:1,reducedProfitLimitsEnabled:true,minPurchasePercent:85,maxSalePercent:115,maxBaseRetailEnabled:true,maxBaseRetail:'100000',useRawIllegalPrices:false});
 const good=core.commodities.find(g=>g.baseCreditsPerTon===1000000&&!g.universallyIllegal);
 assert.ok(good,'Use an existing legal Cr1,000,000 base commodity');
 const world=bindings.R.context(seed.worlds[seed.actual],core);
 const options={...seed.settings,skill:seed.trader.broker,counterparty:0,local:false,side:'buy'};
 const quoted=bindings.R.quote(good,world,options,core,()=>6);
 assert.equal(quoted.audit.rawBasePrice,1000000);
 assert.equal(quoted.audit.basePrice,100000);
 assert.equal(quoted.audit.percent,85);
 assert.equal(quoted.unitPrice,'85000');
 seed.snapshots=[{id:'cap-supplier',kind:'supplier',worldId:seed.actual,world,party:'0,0|cap supplier',partyName:'Cap supplier',hours:seed.hours,startedHours:seed.hours,success:true,options,offers:[{...quoted,id:'cap-offer',commodity:good.id,description:'Preserved cap offer',remaining:'5',expired:false,illegal:false}]}];
 S.validate(seed);
 const h=harness(seed,[],{setTimeout:()=>0,clearTimeout(){}});
 const originalOffer=structuredClone(seed.snapshots[0].offers[0]);
 const expectedHeaders=['Commodity','Available','Current retail','Price %','Purchase Price','Offer Status','Actions'];
 const beforeMarkup=h.api.marketPanel(),beforeRow=market(beforeMarkup);
 assert.deepEqual(beforeRow.headers,expectedHeaders);
 assert.ok(clean(beforeMarkup).includes(explanation),'Explain the current and saved retail bases before changing Settings');
 assert.equal(beforeRow.cells[2],'Cr 100,000 / t');
 assert.equal(beforeRow.cells[3],'85%');
 assert.equal(beforeRow.cells[4],'Cr 85,000 / t');

 // Submit the actual Settings form. The minimal DOM double needs its native
 // checkbox initialization mirrored before changing only the retail cap.
 h.api.actions['settings-edit']();
 assert.equal(h.dom.ids.get('modal-title').textContent,'Ship, trader & options');
 for(const field of h.dom.fields().values())if(field.attributes.type==='checkbox')field.checked='checked' in field.attributes;
 h.fill({maxBaseRetail:'50000'});
 await h.submit();
 assert.equal(h.dom.ids.get('modal-error').textContent,'');
 assert.equal(h.dom.ids.get('modal').open,false);
 const afterSettings=h.persisted();
 assert.equal(h.calls.saves,1);
 assert.equal(afterSettings.settings.maxBaseRetail,'50000');
 same(afterSettings.settings,{...seed.settings,maxBaseRetail:'50000'});
 same(afterSettings.snapshots,seed.snapshots);
 same(afterSettings.lots,seed.lots);
 same(afterSettings.ledger,seed.ledger);
 assert.equal(afterSettings.bank,seed.bank);

 const afterMarkup=h.api.marketPanel(),afterRow=market(afterMarkup);
 assert.deepEqual(afterRow.headers,expectedHeaders);
 assert.ok(clean(afterMarkup).includes(explanation),'Explain why current retail times saved Price % is not the Purchase Price');
 assert.equal(afterRow.cells[2],'Cr 50,000 / t');
 assert.equal(afterRow.cells[3],'85%');
 assert.equal(afterRow.cells[4],'Cr 85,000 / t');
 h.api.actions['offer-audit']('cap-offer');
 const audit=facts(h.dom.ids.get('modal-body').innerHTML);
 assert.equal(audit['RAW base retail'],'Cr 1,000,000 / ton');
 assert.equal(audit['Effective base retail'],'Cr 100,000 / ton');
 assert.equal(audit['Retail cap'],'Cr 100,000 / ton');
 assert.equal(audit['Effective price percentage before fees'],'85%');
 assert.equal(audit['Effective purchase price'],'Cr 85,000 / ton');
 h.api.closeModal();

 h.api.actions.buy('cap-offer');
 assert.match(h.dom.ids.get('modal-body').innerHTML,/Price: Cr 85,000 per ton/);
 h.fill({quantity:'1',fee:'10',description:'Preserved cap offer'});
 h.api.updatePurchaseTotals();
 assert.equal(h.dom.ids.get('modal-title').textContent,'Review purchase · Preserved cap offer');
 assert.equal(h.dom.ids.get('modal-error').textContent,'');
 const confirmation=facts(h.dom.ids.get('purchase-totals').innerHTML);
 assert.equal(h.dom.fields().get('quantity').value,'1');
 assert.equal(confirmation.Goods,'Cr 85,000');
 assert.equal(confirmation['Broker fee'],'Cr 8,500');
 assert.equal(confirmation['Total debit'],'Cr 93,500');
 assert.equal(h.calls.saves,1,'Preview is nonmutating');
 same(h.persisted(),afterSettings);
 await h.submit();
 assert.equal(h.dom.ids.get('modal-error').textContent,'');
 assert.equal(h.dom.ids.get('modal').open,false);
 const saved=h.persisted(),lot=saved.lots[0],purchase=saved.ledger.find(entry=>entry.type==='Purchase'),fee=saved.ledger.find(entry=>entry.type==='Broker fee');
 assert.equal(h.calls.saves,2,'Exactly one Settings save and one purchase');
 assert.equal(saved.bank,'906500');
 assert.equal(String(BigInt(afterSettings.bank)-BigInt(saved.bank)),'93500');
 assert.equal(lot.quantity,'1');
 assert.equal(lot.goodsValue,'85000');
 assert.equal(lot.basis,'93500');
 assert.equal(lot.audit.fee,'8500');
 same(lot.audit.price,originalOffer);
 same(purchase.purchase.priceAudit,originalOffer.audit);
 assert.equal(purchase.amount,'-85000');
 assert.equal(purchase.purchase.unitPrice,'85000');
 assert.equal(fee.amount,'-8500');
 assert.equal(saved.snapshots[0].offers[0].remaining,'4');
 same(saved.snapshots[0].offers[0],{...originalOffer,remaining:'4'});
 assert.equal(h.calls.quotes,0,'Settings, Audit, Preview and Commit must not reprice the saved offer');
 assert.equal(h.calls.priceDice,0,'No negotiation dice are rerolled');
 assert.equal(attemptedFetches,0);
});
