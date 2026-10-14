import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,campaign,element} from './app-harness.mjs';

function fixture(){
 const s=campaign();s.ship.capacity='100';
 s.lots=[{id:'one',commodity:'11',description:'Same commodity — first lot',quantity:'2.5',basis:'1001',goodsValue:'900'},
  {id:'two',commodity:'11',description:'Same commodity — second lot',quantity:'5',basis:'3001',goodsValue:'2800'}];
 s.snapshots=[{id:'buyer',kind:'buyer',worldId:s.actual,party:'synthetic|buyer',partyName:'Synthetic buyer',hours:0,success:true,criminal:false,options:{skill:1,counterparty:2},offers:[]}];
 return s;
}
test('Sell keeps separate lots, maximum defaults, unknown history and review-only actions',()=>{
 const h=harness(fixture()),before=JSON.stringify(h.persisted()),html=h.api.cargoPanel(false);
 assert.match(html,/data-sale-quantity="one" value="2.5"/);assert.match(html,/data-sale-quantity="two" value="5"/);
 assert.match(html,/Paid: Not recorded/);assert.match(html,/Sell Selected/);assert.match(html,/Select all cargo/);
 assert.match(html,/data-action="lot-audit"/);assert.match(html,/data-action="lot-correct"/);
 assert.match(html,/including selected lots hidden by this search/);
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
