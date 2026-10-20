import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,campaign,S} from './app-harness.mjs';
import {refereeTradeInput} from '../js/referee-cargo.mjs';
function fixture(){const s=campaign();S.addRefereeTradeCargo(s,{commodity:'23',description:'GM machine cargo',quantity:'5',purchasePrice:'55000',reason:'Owned before play'});return s;}
test('GM receipt omits inapplicable generated fields and derives an honestly labelled retail comparison',()=>{
 const s=fixture(),lot=s.lots.at(-1),h=harness(s),bytes=JSON.stringify(h.persisted());h.api.actions['lot-audit'](lot.id);const html=h.dom.ids.get('modal-body').innerHTML;
 assert.match(html,/GM-added cargo/);assert.match(html,/Cr 55,000/);assert.match(html,/Cr 275,000/);assert.match(html,/Current retail reference/);assert.match(html,/derived comparison/);assert.match(html,/55% of base \(current retail\)/);
 assert.doesNotMatch(html,/3D price roll|Quantity dice|World trade codes|No current negotiated sale quote|No offer adjustments/);
 assert.match(html,/Acquisition world<\/dt><dd>Not recorded/);assert.match(html,/Added to record at/);assert.match(html,/Lot ID/);assert.match(html,/Owned before play/);assert.equal(JSON.stringify(h.persisted()),bytes);assert.equal(h.calls.priceDice,0);
});
test('unknown historical cost and generated provenance are not relabelled as GM entry',()=>{
 const s=fixture();delete s.lots[0].audit;const h=harness(s);h.api.actions['lot-audit'](s.lots[0].id);assert.match(h.dom.ids.get('modal-body').innerHTML,/Detailed purchase history was not recorded/);assert.doesNotMatch(h.dom.ids.get('modal-body').innerHTML,/GM-added cargo/);
 const generated=fixture();generated.lots[0].audit={price:{unitPrice:'55000',audit:{basePrice:'100000',percent:55}}};const g=harness(generated);g.api.actions['lot-audit'](generated.lots[0].id);assert.match(g.dom.ids.get('modal-body').innerHTML,/Purchase price calculation/);assert.match(g.dom.ids.get('modal-body').innerHTML,/Recorded retail reference/);assert.match(g.dom.ids.get('modal-body').innerHTML,/55% of base/);
});
test('optional acquisition facts stay separate from transaction time and escape untrusted text',()=>{
 const s=campaign(),before=structuredClone(s);S.addRefereeTradeCargo(s,{commodity:'11',description:'Synthetic',quantity:'1',purchasePrice:'10',reason:'Earlier acquisition',acquisitionWorld:'<img src=x onerror=alert(1)>',acquisitionDate:'365-1104'});
 const lot=s.lots.at(-1);assert.equal(lot.hours,before.hours);assert.equal(lot.world,before.actual);assert.equal(lot.audit.acquisition.dateLabel,'365-1104');assert.equal(s.bank,before.bank);assert.deepEqual(s.ledger,before.ledger);
 const h=harness(s);h.api.actions['lot-audit'](lot.id);const html=h.dom.ids.get('modal-body').innerHTML;assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/365-1104/);
 assert.throws(()=>refereeTradeInput({commodity:'11',description:'X',quantity:'1',purchasePrice:'0',acquisitionDate:'366-1105'}),/Imperial day/);
});
