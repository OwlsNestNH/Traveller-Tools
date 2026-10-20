import test from 'node:test';
import assert from 'node:assert/strict';
import {depositHarness,campaign,S,ui,same} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {SaveNotCommittedError} from '../js/persistence.mjs';
const types=['trade','other-add','other-adjust','other-sale','trade-edit','trade-delete','other-delete'];
function setup(type){let saved=campaign();if(type==='other-adjust'||type==='other-sale'||type==='other-delete')saved=S.transition(saved,'Other initial',n=>S.addOtherCargo(n,{description:'Synthetic Other',quantity:'3',saleValue:'421',reason:'Initial referee item'}));if(type==='trade-edit'||type==='trade-delete')saved=S.transition(saved,'Trade initial',n=>S.addRefereeTradeCargo(n,{commodity:'11',description:'Synthetic Trade',quantity:'3',purchasePrice:'17',reason:'Initial owned goods'}));const h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}});h.api.setTab('Cargo');
 if(type==='trade'){h.api.actions['add-lot']();h.fill({commodity:'11',description:'Synthetic Trade',quantity:'2',purchasePrice:'17',reason:'Existing owned goods'});}
 else if(type==='other-add'){h.api.actions['add-lot']('other');h.fill({description:'Synthetic Other',quantity:'3',saleValue:'421',reason:'Referee addition'});}
 else if(type==='other-adjust'){h.api.actions['other-adjust'](saved.otherCargo[0].id);h.fill({description:'Adjusted Other',quantity:'2',saleValue:'99',reason:'Referee correction'});}
 else if(type==='other-sale')h.api.actions['other-sell'](saved.otherCargo[0].id);
 else if(type==='other-delete'){h.api.actions['other-adjust'](saved.otherCargo[0].id);h.api.actions['other-delete'](saved.otherCargo[0].id);}
 else {h.api.actions['lot-correct'](saved.lots.at(-1).id);if(type==='trade-delete')h.api.actions['lot-delete'](saved.lots.at(-1).id);else h.fill({description:'Edited synthetic lot',quantity:'2',reason:'Correction'});}
 return h;
}
for(const type of types)test(type+': accepted delayed save freezes navigation/repeated submit and publishes once',async()=>{const h=setup(type),before=h.persisted(),body=h.dom.ids.get('modal-body').innerHTML,gate=serviceSaveGate(h.store),operation=h.submit();assert.equal(gate.entries.length,1);await h.submit();await h.runAction('tab','Overview');assert.equal(gate.entries.length,1);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);same(h.persisted(),before);gate.entries[0].write();assert.equal(h.dom.ids.get('modal-body').innerHTML,body);gate.entries[0].fulfill();await operation;gate.restore();assert.equal(h.counters.writes,1);assert.equal(ui(h).modalOpen,false);assert.equal(h.persisted().revision,before.revision+1);assert.equal(BigInt(h.persisted().bank)-BigInt(before.bank),type==='other-sale'?421n:0n);});
for(const type of types)test(type+': rejected unwritten save retains exact terms for one safe retry',async()=>{const h=setup(type),before=h.bytes(),fields=[...h.dom.fields()].map(([k,v])=>[k,v.value]),gate=serviceSaveGate(h.store),operation=h.submit();gate.entries[0].reject(new SaveNotCommittedError(Error('Synthetic referee rejection')));await operation;assert.equal(h.bytes(),before);same([...h.dom.fields()].map(([k,v])=>[k,v.value]),fields);assert.equal(ui(h).submitDisabled,false);const retry=h.submit();assert.equal(gate.entries.length,2);gate.entries[1].fulfill();await retry;gate.restore();assert.equal(h.counters.writes,1);assert.equal(ui(h).modalOpen,false);});
for(const type of types)test(type+': uncertain outcome is terminal and cannot duplicate the action',async()=>{const h=setup(type),before=h.bytes(),gate=serviceSaveGate(h.store),operation=h.submit();gate.entries[0].reject(Error('Synthetic unknown outcome'));await operation;assert.equal(h.bytes(),before);assert.equal(h.store.reloadRequired,true);assert.equal(ui(h).submitDisabled,true);await h.submit();assert.equal(gate.entries.length,1);gate.restore();});
for(const type of types)test(type+': rejection after actual publication cannot retry committed action',async()=>{const h=setup(type),before=h.persisted(),gate=serviceSaveGate(h.store),operation=h.submit();gate.entries[0].write();gate.entries[0].reject(new SaveNotCommittedError(Error('Synthetic contradictory result')));await operation;assert.equal(h.counters.writes,1);assert.equal(h.persisted().revision,before.revision+1);assert.equal(BigInt(h.persisted().bank)-BigInt(before.bank),type==='other-sale'?421n:0n);assert.equal(h.store.reloadRequired,true);await h.submit();assert.equal(gate.entries.length,1);gate.restore();});

for(const type of ['trade-delete','other-delete'])test(type+': cancellation, deletion and Undo isolate one lot and retain every unrelated record',async()=>{
 const h=setup(type),before=h.persisted(),id=type==='trade-delete'?before.lots.at(-1).id:before.otherCargo[0].id;
 h.api.closeModal();same(h.persisted(),before);
 if(type==='trade-delete'){h.api.actions['lot-correct'](id);h.api.actions['lot-delete'](id);}else{h.api.actions['other-adjust'](id);h.api.actions['other-delete'](id);}
 await h.submit();const after=h.persisted();assert.equal(after.bank,before.bank);same(after.ledger,before.ledger);same(after.ship,before.ship);same(after.contracts,before.contracts);
 same(type==='trade-delete'?after.lots:after.otherCargo,(type==='trade-delete'?before.lots:before.otherCargo).filter(l=>l.id!==id));
 assert.equal(after.events.findLast(e=>e.before?.id===id).before.id,id);await h.runAction('undo');
 const restored=h.persisted();same(restored.lots,before.lots);assert.equal(JSON.stringify(restored.otherCargo),JSON.stringify(before.otherCargo));same(restored.ship,before.ship);assert.equal(restored.bank,before.bank);
});
