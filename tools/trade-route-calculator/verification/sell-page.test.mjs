import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,campaign,element} from './app-harness.mjs';

function fixture(){
 const s=campaign();s.ship.capacity='100';
 s.lots=[{id:'one',commodity:'11',description:'Same commodity — first lot',quantity:'2.5',basis:'1001',goodsValue:'900'},
  {id:'two',commodity:'11',description:'Same commodity — second lot',quantity:'5',basis:'3001',goodsValue:'2800'}];
 s.snapshots=[{id:'buyer',kind:'buyer',worldId:s.actual,party:'synthetic|buyer',partyName:'Synthetic buyer',hours:0,startedHours:0,success:true,criminal:false,options:{skill:1,counterparty:2},offers:[]}];
 return s;
}
test('Sell keeps separate lots, maximum defaults, unknown history and review-only actions',()=>{
 const h=harness(fixture()),before=JSON.stringify(h.persisted()),html=h.api.tradeToolbar()+h.api.cargoPanel(false);
 assert.match(html,/data-sale-quantity="one" value="2.5"/);assert.match(html,/data-sale-quantity="two" value="5"/);
 assert.match(html,/Not recorded/);assert.match(html,/data-action="buyer-search"[^>]*>Find buyer/);assert.match(html,/Select all cargo/);assert.match(html,/Clear selection/);
 assert.doesNotMatch(html,/data-action="sale"/);
 h.api.setSelected(['one']);const selectedHtml=h.api.tradeToolbar()+h.api.cargoPanel(false);
 assert.match(selectedHtml,/data-action="sale"[^>]*>Review sale/);assert.doesNotMatch(selectedHtml,/data-action="buyer-search"/);
 assert.match(html,/data-action="lot-audit"/);assert.doesNotMatch(html,/data-action="lot-correct"|data-action="lot-sell"/);
 assert.doesNotMatch(html,/sale-selection-preview|Cargo projected/);
 assert.equal(JSON.stringify(h.persisted()),before);assert.equal(h.calls.priceDice,0);assert.equal(h.calls.saves,0);
});
test('quantity edits are session-only and follow the same lot into review without rolling',()=>{
 const h=harness(fixture()),before=JSON.stringify(h.persisted());h.api.setSelected(['two']);
 h.dom.dispatch('input',element({'data-sale-quantity':'two',value:'2'}));
 assert.equal(h.calls.priceDice,0);assert.equal(h.calls.saves,0);assert.equal(JSON.stringify(h.persisted()),before);
 h.api.beginSale();assert.equal(h.dom.fields().get('qty_two').value,'2');assert.equal(h.dom.fields().has('qty_one'),false);
 const dice=h.calls.priceDice;h.api.closeModal();h.api.render();h.api.beginSale();assert.equal(h.calls.priceDice,dice);
 assert.equal(h.dom.fields().get('qty_two').value,'2');assert.equal(JSON.stringify(h.persisted()),before);
});
test('new revision retires unsaved quantities and read-only edits do not change them',()=>{
 const h=harness(fixture());h.dom.dispatch('input',element({'data-sale-quantity':'one',value:'1'}));
 assert.match(h.api.cargoPanel(false),/data-sale-quantity="one" value="1"/);
 h.store.editable=false;h.dom.dispatch('input',element({'data-sale-quantity':'one',value:'2'}));
 assert.match(h.api.cargoPanel(false),/data-sale-quantity="one" value="1"/);
 const next=structuredClone(h.api.state);next.revision++;h.api.setState(next);
 assert.match(h.api.cargoPanel(false),/data-sale-quantity="one" value="2.5"/);assert.equal(h.calls.saves,0);
});
test('turning automatic taxes off retires an open review and reopens with a visible zero GM rate',async()=>{
 const s=fixture();s.settings.tax=true;s.worlds[s.actual].uwp='A788879-C';const h=harness(s);h.api.setSelected(['two']);h.api.beginSale();
 h.fill({qty_two:'1',price_two:'25000',reason:'Synthetic GM quote'});h.api.updateSaleReview();
 const next=structuredClone(h.api.state);next.revision++;next.settings.tax=false;h.api.setState(next);
 assert.equal(h.dom.ids.get('modal-submit').disabled,true);await h.submit();assert.equal(h.calls.saves,0);
 h.api.closeModal();h.api.beginSale();assert.equal(h.dom.fields().get('taxRate').value,'0');assert.equal(h.api.modalSession.saleOwner.preview.tax.amount,'0');
 assert.match(h.api.modalSession.saleOwner.preview.tax.provenance,/Automatic taxes off/);assert.equal(h.calls.saves,0);
});
test('same-reference campaign drift cannot replace or commit a previously reviewed sale',async()=>{
 const h=harness(fixture());h.api.setSelected(['one']);h.api.beginSale();h.api.state.bank='999';
 await h.submit();assert.equal(h.calls.saves,0);assert.match(h.dom.ids.get('modal-error').textContent,/Campaign changed|ownership changed/);
});
test('live GM price and benchmark rounding matches Enter commitment before a blur event',async()=>{
 const s=fixture();s.settings.creditStep=100;const h=harness(s);h.api.setSelected(['two']);h.api.beginSale();
 h.fill({qty_two:'1',price_two:'50000.1',benchmark_two:'20000.1',reason:'Synthetic fractional GM amounts'});h.api.updateSaleReview();
 const p=structuredClone(h.api.modalSession.saleOwner.preview);assert.equal(p.lines[0].unitPrice,'50100');assert.equal(p.lines[0].benchmarkPrice,'20100');
 await h.submit();assert.equal(h.dom.ids.get('modal-error').textContent,'');assert.equal(h.calls.saves,1);assert.equal(h.persisted().ledger.find(e=>e.type==='Sale').audit.unitPrice,p.lines[0].unitPrice);assert.equal(h.persisted().bank,String(BigInt(s.bank)+BigInt(p.bankDelta)));
});
