import test from 'node:test';
import assert from 'node:assert/strict';
import {depositHarness,campaign,S,same,ui,prepareDeposit,deferredSave,flush} from './deposit-save-harness.mjs';

// Only Confirm deposit opts into completion-aware UI. These are actual-app
// native tests with a delayed adapter around the real localStorage Store;
// browser gestures, Web Locks and other async callers need separate evidence.
const noSuccess=h=>assert.doesNotMatch(ui(h).message,/saved\.|replaced\.|undone\./i);
const syntheticOffer={offerId:'retained-freight',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true}};
const unchanged=(h,raw,state)=>{assert.equal(h.bytes(),raw);same(h.api.state,state);};
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
async function pendingDeposit(t,h=depositHarness()){
 await prepareDeposit(h);const gate=deferredSave(h.store),detached=h.dom.ids.get('modal-form').onsubmit;
 const operation=h.submit();operation.catch(()=>{});
 t.after(async()=>{for(const entry of gate.pending)if(!entry.settled)entry.resolve();await operation;gate.restore();});
 await flush();return {h,gate,operation,detached};
}
function terminal(h){
 assert.equal(h.store.editable,false,'A terminal result yields editing');
 assert.equal(h.store.reloadRequired,true,'Terminal results require reloading durable data');
 assert.equal(ui(h).submitDisabled,true,'finally must not enable an unsafe retry');
 assert.match(ui(h).modalError+' '+ui(h).message,/reload/i);noSuccess(h);
}

test('real Store known prewrite failure preserves exact bytes/history and publication, then retries once',()=>{
 const h=depositHarness(),before=h.api.state,raw=h.bytes(),candidate=S.transition(before,'Manual deposit',s=>S.deposit(s,11,'Synthetic'));
 h.failNext();assert.throws(()=>h.store.save(candidate,before.revision),error=>{assert.equal(error.code,'SAVE_NOT_COMMITTED');assert.equal(error.committed,false);assert.match(error.message,/quota/);return true;});
 unchanged(h,raw,before);assert.equal(h.counters.writes,0);assert.equal(h.counters.notifications,0);
 assert.equal(h.store.save(candidate,before.revision),undefined);assert.equal(h.counters.writes,1);assert.equal(h.persisted().bank,'100011');
 assert.equal(h.persisted().undo.length,1);assert.equal(h.persisted().ledger.length,1);
});
for(const point of ['beforeNotify','afterNotify'])test(`real Store ${point} error is a durable commit with failed publication, never a prewrite failure`,()=>{
 const h=depositHarness(),before=h.api.state,raw=h.bytes(),candidate=S.transition(before,'Manual deposit',s=>S.deposit(s,11,'Synthetic'));
 h.hooks[point]=()=>{throw Error('Injected '+point+' publication failure');};
 assert.throws(()=>h.store.save(candidate,before.revision),error=>{assert.equal(error.code,'SAVE_COMMITTED_PUBLICATION_FAILED');assert.equal(error.committed,true);assert.equal(error.revision,1);assert.match(error.message,new RegExp(point));return true;});
 assert.notEqual(h.bytes(),raw);assert.equal(h.counters.writes,1);assert.equal(h.persisted().bank,'100011');assert.equal(h.persisted().undo.length,1);
 assert.equal(h.api.state.revision,point==='beforeNotify'?0:1);
});

test('synchronous save, ordinary transition, preparation, Undo, mulligan and replacement retain synchronous returns',()=>{
 const h=depositHarness();const next=h.api.controller.transition('Legacy deposit',s=>S.deposit(s,1,'Legacy'),0);
 assert.equal(typeof next?.then,'undefined');assert.equal(next.bank,'100001');assert.equal(h.api.state.revision,1);
 assert.equal(h.api.controller.undo(1),undefined);assert.equal(h.api.state.bank,'100000');
 const prepared=h.api.controller.prepareJump(()=>({dice:[2,2,2,2,2,2],total:12}),2);
 assert.equal(typeof prepared?.then,'undefined');assert.equal(prepared.state.revision,3);
 h.api.controller.transition('Jump',s=>S.commitJump(s,{attemptId:prepared.attempt.id,elapsed:160}),3);
 assert.equal(h.api.controller.undoJump(4),undefined);assert.equal(h.api.state.actual,'0,0');
 assert.equal(h.api.controller.replace(campaign(),5),undefined);assert.equal(h.api.state.revision,6);
});

test('Confirm deposit stays open/busy without success until the real durable save and publication settle',async t=>{
 const h=depositHarness(),raw=h.bytes(),before=structuredClone(h.api.state),p=await pendingDeposit(t,h);
 assert.equal(p.gate.pending.length,1);unchanged(h,raw,before);assert.equal(ui(h).modalOpen,true);assert.equal(h.api.modalSession.busy,true);assert.equal(ui(h).submitDisabled,true);noSuccess(h);
 p.gate.pending[0].resolve();await p.operation;
 assert.equal(h.counters.writes,1);assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,/Manual deposit saved\./);assert.equal(h.persisted().bank,'100011');
 assert.equal(h.persisted().ledger.length,1);assert.equal(h.persisted().undo.length,1);
 for(const snapshot of h.trace){assert.doesNotMatch(snapshot.message,/saved\./);assert.equal(snapshot.modalOpen,true);}
});

test('repeated click, Enter form submission and detached submit reach the pending provider exactly once',async t=>{
 const {h,gate,operation,detached}=await pendingDeposit(t);
 await h.submit();h.dom.dispatch('keydown',{matches:()=>false},{key:'Enter',preventDefault(){}});await h.submit();await detached(submitEvent(h));
 assert.equal(gate.pending.length,1);assert.equal(h.counters.writes,0);gate.pending[0].resolve();await operation;
 const raw=h.bytes();await detached(submitEvent(h));assert.equal(gate.pending.length,1);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,1);
});

for(const dismiss of ['Cancel','X','Escape','replacement dialog','replacement campaign'])test(`pending deposit rejects ${dismiss} without abandoning or replacing its review`,async t=>{
 const {h,gate,operation}=await pendingDeposit(t),session=h.api.modalSession,body=h.dom.ids.get('modal-body').innerHTML;
 if(dismiss==='Cancel')h.dom.ids.get('modal-cancel').onclick();
 if(dismiss==='X')h.dom.ids.get('modal-close').onclick();
 if(dismiss==='Escape'){let prevented=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);}
 if(dismiss==='replacement dialog')h.api.modal('Unrelated replacement','<p>Must not replace review</p>',null);
 if(dismiss==='replacement campaign')await h.runAction('reset');
 assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).modalTitle,'Confirm deposit');assert.equal(h.dom.ids.get('modal-body').innerHTML,body);
 assert.equal(gate.pending.length,1);assert.equal(h.counters.writes,0);noSuccess(h);gate.pending[0].resolve();await operation;assert.equal(h.counters.writes,1);
});

test('known delayed prewrite rejection preserves the same review, exact state and rounding for one explicit retry',async t=>{
 const h=depositHarness(),raw=h.bytes(),before=structuredClone(h.api.state);h.api.setDrafts([syntheticOffer]);
 const {gate,operation,detached}=await pendingDeposit(t,h),session=h.api.modalSession,body=h.dom.ids.get('modal-body').innerHTML,rounding=structuredClone(h.api.inputRounding);
 h.failNext();gate.pending[0].resolve();await operation;
 unchanged(h,raw,before);assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/quota/);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);same(h.api.inputRounding,rounding);same(h.api.drafts,[syntheticOffer]);noSuccess(h);
 const retry=h.submit();await flush();assert.equal(gate.pending.length,2);await detached(submitEvent(h));assert.equal(gate.pending.length,2);
 gate.pending[1].resolve();await retry;assert.equal(h.counters.attempts,2);assert.equal(h.counters.writes,1);assert.equal(h.persisted().ledger.length,1);assert.equal(h.persisted().undo.length,1);assert.equal(h.persisted().bank,'100011');
});

for(const loss of ['disk revision','published revision','editing authority'])test(`delayed deposit rechecks ${loss} at settlement and preserves the newer durable state`,async t=>{
 const {h,gate,operation,detached}=await pendingDeposit(t);
 if(loss==='editing authority'){h.store.yield();}else{const next=S.transition(h.persisted(),'External deposit',s=>S.deposit(s,23,'External'));h.external(next,{publish:loss==='published revision'});}
 const raw=h.bytes(),before=structuredClone(h.api.state);gate.pending[0].resolve();await operation;
 unchanged(h,raw,before);assert.equal(h.counters.writes,0);noSuccess(h);assert.match(ui(h).modalError,/stale|changed|read-only|editing/i);
 const staleRetry=detached(submitEvent(h));await flush();for(const entry of gate.pending)if(!entry.settled)entry.resolve();await staleRetry;assert.equal(h.counters.writes,0);assert.equal(h.bytes(),raw);
});

test('delayed own save carries a one-use provenance token and retains unrelated freight offers',async t=>{
 const h=depositHarness();h.api.setDrafts([syntheticOffer]);const {gate,operation}=await pendingDeposit(t,h);
 assert.equal(h.api.controller.isLocalSave(),false,'Boolean local-save window must end before deferred completion');
 const token=gate.pending[0].args[2];assert.ok(token,'Each ordinary save carries publication provenance');gate.pending[0].resolve();await operation;
 same(h.api.drafts,[syntheticOffer]);assert.equal(h.notifications[0].metadata.saveToken,token);
 h.api.setState(h.api.state,h.notifications[0].metadata);assert.equal(h.api.drafts.length,0,'Replaying a consumed token is external');
});

test('tokenless external publication during a pending deposit clears offers and is not mistaken for its own save',async t=>{
 const h=depositHarness();h.api.setDrafts([syntheticOffer]);const {gate,operation}=await pendingDeposit(t,h);
 h.external(structuredClone(h.persisted()));assert.equal(h.api.drafts.length,0);assert.equal(h.counters.writes,0);noSuccess(h);
 gate.pending[0].resolve();await operation;assert.equal(h.counters.writes,1);assert.equal(h.api.drafts.length,0);
});

test('replacement stays external and clears offers even when saved IDs are reused',()=>{
 const h=depositHarness();h.api.setDrafts([syntheticOffer]);assert.equal(h.api.controller.replace(campaign(),0),undefined);
 assert.equal(h.api.drafts.length,0);assert.equal(h.counters.writes,1);
});

for(const point of ['beforeNotify','afterNotify'])for(const roleThrows of [false,true])test(`delayed committed ${point} failure is terminal, including onRole throw=${roleThrows}`,async t=>{
 const {h,gate,operation,detached}=await pendingDeposit(t);h.hooks[point]=()=>{throw Error('Injected '+point+' failure');};
 if(roleThrows)h.hooks.onRole=()=>{throw Error('Injected onRole render failure');};
 gate.pending[0].resolve();await operation;terminal(h);assert.equal(h.counters.writes,1);assert.equal(h.api.state.revision,point==='beforeNotify'?0:1);
 assert.equal(h.persisted().bank,'100011');assert.equal(h.persisted().ledger.length,1);assert.equal(h.persisted().undo.length,1);
 await h.submit();await detached(submitEvent(h));assert.equal(gate.pending.length,1);assert.equal(h.counters.writes,1);h.api.syncModalSubmit();assert.equal(ui(h).submitDisabled,true);
 const reloaded=depositHarness(h.store.read());assert.equal(reloaded.persisted().bank,'100011');assert.equal(reloaded.persisted().ledger.length,1);
 reloaded.api.actions.undo();assert.equal(reloaded.persisted().bank,'100000');assert.equal(reloaded.persisted().ledger.length,0);assert.equal(reloaded.persisted().undo.length,0);
});

for(const roleThrows of [false,true])test(`unclassified rejection is terminal with no automatic or manual retry, onRole throw=${roleThrows}`,async t=>{
 const {h,gate,operation,detached}=await pendingDeposit(t),raw=h.bytes();if(roleThrows)h.hooks.onRole=()=>{throw Error('Injected onRole failure');};
 gate.pending[0].reject();await operation;terminal(h);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);
 await h.submit();await detached(submitEvent(h));assert.equal(gate.pending.length,1);assert.equal(h.bytes(),raw);
});

test('successful delayed deposit reloads once and History Undo restores the original bank and ledger',async t=>{
 const {h,gate,operation}=await pendingDeposit(t);gate.pending[0].resolve();await operation;
 const reloaded=depositHarness(h.store.read());assert.equal(reloaded.persisted().bank,'100011');assert.equal(reloaded.persisted().ledger.length,1);assert.equal(reloaded.persisted().undo.length,1);
 reloaded.api.actions.undo();assert.equal(reloaded.persisted().bank,'100000');assert.equal(reloaded.persisted().ledger.length,0);assert.equal(reloaded.persisted().undo.length,0);
});

test('controller isolates save candidates from later caller mutation while its provider is pending',async()=>{
 const h=depositHarness(),gate=deferredSave(h.store),candidate=S.transition(h.api.state,'Manual deposit',s=>S.deposit(s,11,'Original'));
 const completion=h.api.controller.save(candidate,0);candidate.bank='900000';candidate.ledger[0].reason='Mutated outside provider';
 assert.notEqual(gate.pending[0].args[0],candidate);assert.equal(gate.pending[0].args[0].bank,'100011');
 gate.pending[0].resolve();await completion;assert.equal(h.persisted().bank,'100011');assert.notEqual(h.persisted().ledger[0].reason,'Mutated outside provider');gate.restore();
});

for(const mismatch of ['unrelated token','wrong revision'])test(`pending provenance treats ${mismatch} as external without consuming the matching publication`,async t=>{
 const h=depositHarness();h.api.setDrafts([syntheticOffer]);const {gate,operation}=await pendingDeposit(t,h),token=gate.pending[0].args[2];
 const published=structuredClone(mismatch==='unrelated token'?gate.pending[0].args[0]:h.api.state),metadata={saveToken:mismatch==='unrelated token'?{}:token};
 h.api.setState(published,metadata);assert.equal(h.api.drafts.length,0);assert.equal(h.api.controller.isLocalSave(),false);
 h.api.setDrafts([syntheticOffer]);gate.pending[0].resolve();await operation;same(h.api.drafts,[syntheticOffer]);assert.equal(h.counters.writes,1);
});

test('failed save retires its token so a later matching revision notification is external',async t=>{
 const h=depositHarness(),{gate,operation}=await pendingDeposit(t,h),entry=gate.pending[0];h.failNext();entry.resolve();await operation;
 h.api.setDrafts([syntheticOffer]);h.api.setState(entry.args[0],{saveToken:entry.args[2]});assert.equal(h.api.drafts.length,0);assert.equal(h.counters.writes,0);
});

for(const delay of [false,true])test(`controller blocks reentrant writes during publication, delayed=${delay}`,async t=>{
 const h=depositHarness();let invoked=false,reentrantError;
 h.hooks.beforeNotify=()=>{try{h.api.controller.transition('Nested mutation',()=>{invoked=true;},h.api.state.revision);}catch(error){reentrantError=error;}};
 if(delay){const p=await pendingDeposit(t,h);p.gate.pending[0].resolve();await p.operation;}
 else{await prepareDeposit(h);await h.submit();}
 assert.equal(invoked,false);assert.equal(reentrantError.code,'SAVE_NOT_COMMITTED');assert.match(reentrantError.message,/current campaign save/);assert.equal(h.counters.writes,1);assert.equal(h.persisted().ledger.length,1);
});

test('unmigrated expense, History Undo and reset callbacks still publish and report success synchronously',async()=>{
 const h=depositHarness();h.api.actions.expense();h.fill({amount:17,reason:'Synchronous compatibility'});
 const expense=h.submit();assert.equal(h.persisted().bank,'99983');assert.match(ui(h).message,/Manual expense saved\./);assert.equal(h.counters.writes,1);await expense;
 assert.equal(h.api.actions.undo(),undefined);assert.equal(h.persisted().bank,'100000');assert.equal(h.counters.writes,2);assert.match(ui(h).message,/undone/i);
 h.api.actions.reset();h.fill({backed:true});const replace=h.submit();assert.equal(h.counters.writes,3);assert.equal(h.persisted().initialized,false);assert.match(ui(h).message,/Campaign replaced\./);await replace;
});

test('terminal outcome cannot be cleared by takeover, later role callbacks or a new deposit dialog',async t=>{
 const {h,gate,operation}=await pendingDeposit(t);gate.pending[0].reject();await operation;terminal(h);
 const raw=h.bytes();await h.store.acquire(true);terminal(h);assert.equal(h.dom.ids.get('takeover').disabled,true);
 h.api.closeModal();h.api.actions.deposit();h.fill({amount:11,reason:'Must remain blocked'});await h.submit();assert.equal(h.counters.writes,0);assert.equal(h.bytes(),raw);assert.equal(ui(h).submitDisabled,true);
});

test('terminal deposit sets modal reload guidance and Close before the final banner can fail to render',async()=>{
 const h=depositHarness();await prepareDeposit(h);const gate=deferredSave(h.store),operation=h.submit();await flush();
 const banner=h.dom.ids.get('message');let value=banner.textContent;
 Object.defineProperty(banner,'textContent',{get:()=>value,set(next){if(String(next).includes('Reload this page'))throw Error('Injected final message display fault');value=next;}});
 gate.pending[0].reject(Error('Unknown provider outcome'));
 await assert.rejects(operation,/Injected final message display fault/);gate.restore();
 assert.match(h.dom.ids.get('modal-error').textContent,/Reload this page/);assert.equal(h.dom.ids.get('modal-cancel').textContent,'Close');
 assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('takeover').disabled,true);
 assert.match(h.dom.ids.get('save-status').textContent,/Reload this page/);assert.equal(h.counters.writes,0);
});
