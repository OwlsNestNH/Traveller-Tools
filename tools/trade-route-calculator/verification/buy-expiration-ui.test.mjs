import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,same} from './app-harness.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';

for(const editable of [true,false])test(`Buy rendering preserves historical expiration and campaign data (${editable?'editor':'reader'})`,()=>{
 const saved=guiFixture().state,snap=saved.snapshots[0],active=snap.offers[0];
 snap.offers.push({...structuredClone(active),id:'historical-expired',expired:true,expirationNote:'Historical fixture'});
 const h=harness(saved);h.store.editable=editable;
 const before=structuredClone(h.api.state),persisted=h.persisted(),dice=h.calls.priceDice;
 const html=h.api.marketPanel();
 assert.doesNotMatch(html,/data-expire=|>Expired<\/label>/);
 assert.match(html,/<span class="offer-status">Active<\/span>/);
 assert.match(html,/<option value="expired"/);
 assert.match(html,/data-action="expire-all"/);
 assert.throws(()=>h.api.buyForm('historical-expired'),/Offer is expired/);
 same(h.api.state,before);same(h.persisted(),persisted);
 assert.equal(h.calls.saves,0);assert.equal(h.calls.priceDice,dice);
 assert.equal(h.api.state.snapshots[0].offers.at(-1).expirationNote,'Historical fixture');
});
