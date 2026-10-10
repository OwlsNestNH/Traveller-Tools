import test from 'node:test';
import assert from 'node:assert/strict';
import {depositHarness,campaign,S,same,ui,flush} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {configureFuel} from '../js/fuel.mjs';

// Execute the actual app callbacks, controller and Store with private synthetic
// storage. The existing test-owned completion gate calls the real Store body;
// native DOM doubles do not certify browser gestures or native Web Locks.
const offer={offerId:'jump-retained-offer',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true}};
const material=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','jumpAttempts','events','undo'].includes(key)));
const noSuccess=h=>assert.doesNotMatch(ui(h).message,/Jump:.*saved\./);
function fixture(){
 const s=campaign();s.ship.capacity='100';s.ship.fuel=configureFuel(200,40,60,40,2);
 s.ship.staterooms=2;s.ship.accommodation={rooms:{low:0,middle:2,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}};
 s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}};
 s.lots=[{id:'jump-cargo',commodity:'11',description:'Saved jump cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];
 s.contracts=[{id:'jump-mail',kind:'mail',status:'accepted',firstDeparture:null,origin:'0,0',destination:'1,0',quantity:'5',payment:'1000',dueHours:null}];
 s.policies=[{id:'jump-policy',lotId:'jump-cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'1000',remainingValue:'1000',coverage:70,route:['0,0','1,0'],routeProgress:0,destination:'1,0'}];
 s.snapshots=[{id:'jump-supplier',kind:'supplier',worldId:'0,0',hours:0,startedHours:0,party:'Saved supplier',offers:[{id:'jump-stock',commodity:'11',description:'Saved offer',expired:false,remaining:'2',unitPrice:'100'}]}];
 return S.validate(s);
}
function jumpHarness(saved=fixture()){
 const h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}}),prepare=h.api.controller.prepareJump;
 const dice={calls:0};h.api.controller.prepareJump=(roll,expected)=>prepare(()=>{dice.calls++;return roll();},expected);
 return {...h,dice};
}
async function review(h){await h.runAction('jump');assert.match(ui(h).modalTitle,/^Commit jump/);assert.equal(ui(h).submitDisabled,false);return h.persisted();}
function exactPreparation(saved,before){
 assert.equal(saved.revision,before.revision+1);same(material(saved),material(before));same(saved.undo,before.undo);
 assert.equal(saved.jumpAttempts.length,1);assert.equal(saved.jumpAttempts[0].rolls.length,1);same(saved.jumpAttempts[0].rolls[0],{dice:[3,3,3,3,3,3],total:18});
 assert.equal(saved.events.filter(e=>e.label==='Jump roll prepared').length,1);assert.equal(saved.events.filter(e=>e.label==='Jump audit').length,0);
}
function exactJump(saved,before){
 assert.equal(saved.revision,before.revision+1);assert.equal(saved.actual,'1,0');assert.equal(saved.routeIndex,1);assert.equal(saved.hours,before.hours+160);assert.equal(saved.bank,before.bank);
 assert.equal(saved.ship.fuel.aboardTons,40);same(saved.ship.lifeSupport.stockUnits,{numerator:'128',denominator:'3'});
 same(saved.lots,before.lots);same(saved.snapshots,before.snapshots);same(saved.route,before.route);same(saved.jumpAttempts,before.jumpAttempts);
 assert.equal(saved.ledger.length,before.ledger.length+1);assert.equal(saved.ledger.at(-1).type,'Jump');assert.equal(saved.ledger.at(-1).amount,'0');assert.equal(saved.undo.length,before.undo.length+1);
 const audit=saved.events.filter(e=>e.label==='Jump audit');assert.equal(audit.length,1);same(audit[0].dice,before.jumpAttempts[0].rolls.at(-1));assert.equal(audit[0].generatedHours,166);assert.equal(audit[0].effectiveHours,160);
 assert.equal(saved.contracts[0].firstDeparture.eventId,audit[0].id);assert.equal(saved.contracts[0].firstDeparture.from,'0,0');assert.equal(saved.contracts[0].firstDeparture.to,'1,0');
 assert.equal(saved.policies[0].routeProgress,1);assert.equal(saved.policies[0].status,'arrived');assert.equal(S.jumpUndoEligibility(saved).allowed,true);
}
async function pending(t,phase,h=jumpHarness()){
 if(phase==='commit'){await review(h);h.fill({hours:160});}
 const before=structuredClone(h.api.state),raw=h.bytes(),gate=serviceSaveGate(h.store),operation=phase==='prepare'?h.runAction('jump'):h.submit();
 operation?.catch(()=>{});t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 await flush();assert.equal(gate.entries.length,1);return {h,before,raw,gate,operation,session:h.api.modalSession,detached:h.dom.ids.get('modal-form').onsubmit};
}
function busy(h,session){
 assert.equal(ui(h).modalOpen,true);assert.equal(h.api.modalSession,session);assert.equal(session.busy,true);assert.equal(ui(h).submitDisabled,true);
 for(const id of ['modal-cancel','modal-close'])assert.equal(h.dom.ids.get(id).disabled,true);if(session.jumpCommit){assert.equal(h.dom.fields().get('hours').readOnly,true,'Elapsed hours freezes during completion');assert.equal(h.dom.fields().get('hours').disabled,false,'Elapsed hours remains in FormData');}noSuccess(h);
}
function terminal(h){
 assert.equal(h.store.editable,false);assert.equal(h.store.reloadRequired,true);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('takeover').disabled,true);
 for(const id of ['modal-error','message','save-status'])assert.match(h.dom.ids.get(id).textContent,/reload/i);noSuccess(h);
}
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});

// The baseline probes deliberately fail the pre-migration app at both asynchronous
// boundaries while preserving the synchronous and rule-level positive controls.
test('synchronous preparation and jump keep immediate durable writes, exact accounting, roll reuse and one mulligan',async()=>{
 const h=jumpHarness(),original=structuredClone(h.api.state),result=h.api.actions.jump();
 assert.equal(result,undefined);assert.equal(h.counters.writes,1);assert.match(ui(h).modalTitle,/^Commit jump/);exactPreparation(h.persisted(),original);
 const prepared=h.persisted();h.api.closeModal();await review(h);assert.equal(h.counters.writes,1);assert.equal(h.dice.calls,1);same(h.persisted(),prepared);
 const reloaded=jumpHarness(h.store.read());await review(reloaded);assert.equal(reloaded.counters.writes,0);assert.equal(reloaded.dice.calls,0);
 reloaded.fill({hours:160});const commit=reloaded.submit();assert.equal(reloaded.counters.writes,1);assert.equal(reloaded.api.view,'1,0');assert.match(ui(reloaded).message,/Jump:.*saved\./);await commit;exactJump(reloaded.persisted(),prepared);
 reloaded.api.actions['jump-undo']();await reloaded.submit();same(material(reloaded.persisted()),material(original));assert.equal(reloaded.persisted().jumpAttempts[0].mulliganUsed,true);
 await review(reloaded);assert.equal(reloaded.dice.calls,1);const finalRoll=reloaded.persisted();assert.equal(finalRoll.jumpAttempts[0].rolls.length,2);reloaded.api.closeModal();await review(reloaded);same(reloaded.persisted(),finalRoll);assert.equal(reloaded.dice.calls,1);
 reloaded.fill({hours:160});await reloaded.submit();assert.equal(S.jumpUndoEligibility(reloaded.persisted()).allowed,false);assert.match(S.jumpUndoEligibility(reloaded.persisted()).reason,/mulligan|final|already/i);
});

for(const phase of ['prepare','commit'])test(`baseline probe: delayed jump ${phase} waits through durable publication until completion before UI cleanup`,async t=>{
 const h=jumpHarness();h.api.setDrafts([offer]);h.api.setSelected(['jump-cargo']);const p=await pending(t,phase,h);const {gate,operation,before,raw,session}=p;
 assert.equal(h.bytes(),raw);same(h.api.state,before);busy(h,session);assert.equal(h.api.view,'0,0');
 gate.entries[0].write();busy(h,session);assert.equal(h.api.view,'0,0','Publication alone must not run the arrival completion callback');same(h.api.drafts,[offer]);
 if(phase==='prepare')exactPreparation(h.persisted(),before);else exactJump(h.persisted(),before);
 gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,phase==='prepare'?1:2);
 if(phase==='prepare'){assert.match(ui(h).modalTitle,/^Commit jump/);assert.equal(ui(h).submitDisabled,false);same(h.api.drafts,[offer]);noSuccess(h);}
 else{assert.equal(ui(h).modalOpen,false);assert.equal(h.api.view,'1,0');assert.match(ui(h).message,/Jump:.*saved\./);}
 for(const observation of h.trace)assert.doesNotMatch(observation.message,/Jump:.*saved\./,'No successful jump announcement before completion');
});

for(const phase of ['prepare','commit'])test(`known delayed jump ${phase} rejection preserves its exact draft for one deliberate retry`,async t=>{
 const {h,gate,operation,session,before,raw}=await pending(t,phase);const rolled=structuredClone(gate.entries[0].args[0].jumpAttempts[0].rolls),body=h.dom.ids.get('modal-body').innerHTML;
 h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),raw);same(h.api.state,before);assert.equal(h.api.modalSession,session);assert.equal(session.busy,false);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/quota/i);noSuccess(h);
 if(phase==='commit'){assert.equal(h.dom.fields().get('hours').readOnly,false,'Known no-commit failure releases the elapsed-hours editor');assert.equal(h.dom.fields().get('hours').value,'160');assert.equal(h.dom.ids.get('modal-body').innerHTML,body);}
 const retry=h.submit();await flush();assert.equal(gate.entries.length,2);same(gate.entries[1].args[0].jumpAttempts[0].rolls,rolled);assert.equal(h.dice.calls,phase==='prepare'?2:1,'Controller requests the captured app roll on preparation retry; browser coverage counts actual RNG calls');
 await h.submit();assert.equal(gate.entries.length,2);gate.entries[1].fulfill();await retry;
 if(phase==='prepare')exactPreparation(h.persisted(),before);else exactJump(h.persisted(),before);
 assert.equal(h.counters.writes,phase==='prepare'?1:2);assert.equal(h.counters.attempts,phase==='prepare'?2:3);
});

for(const phase of ['prepare','commit'])test(`pending jump ${phase} blocks repeated jump, detached submit, dismissal and replacement modal`,async t=>{
 const {h,gate,operation,session,detached,raw}=await pending(t,phase);const body=h.dom.ids.get('modal-body').innerHTML;
 const repeatedJump=h.runAction('jump');await h.submit();await detached(submitEvent(h));
 h.dom.ids.get('modal-cancel').onclick();h.dom.ids.get('modal-close').onclick();let prevented=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);
 h.api.modal('Unrelated replacement','<p>Must stay out</p>',null);await h.runAction('reset');busy(h,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);assert.equal(h.dice.calls,1);
 gate.entries[0].fulfill();await operation;await repeatedJump;const bytes=h.bytes();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes,'Detached completion from prior phase cannot submit the replacement review');
});

for(const phase of ['prepare','commit'])for(const point of ['beforeNotify','afterNotify'])for(const roleThrows of [false,true])test(`jump ${phase} durable ${point} failure is reload-only, role callback throws=${roleThrows}`,async t=>{
 const {h,gate,operation,detached,before}=await pending(t,phase);h.hooks[point]=()=>{throw Error('Injected '+point+' failure');};if(roleThrows)h.hooks.onRole=()=>{throw Error('Injected role callback failure');};
 gate.entries[0].fulfill();await operation;terminal(h);if(phase==='prepare')exactPreparation(h.persisted(),before);else exactJump(h.persisted(),before);
 const bytes=h.bytes();await detached(submitEvent(h));await h.runAction('jump');h.api.syncModalSubmit();terminal(h);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
 const fresh=jumpHarness(h.store.read());if(phase==='prepare'){await review(fresh);assert.equal(fresh.counters.writes,0);assert.equal(fresh.dice.calls,0);}else{fresh.api.actions.undo();same(material(fresh.persisted()),material(before));}
});

for(const phase of ['prepare','commit'])for(const afterWrite of [false,true])test(`jump ${phase} unknown rejection ${afterWrite?'after':'before'} write locks until reload without unsafe retry`,async t=>{
 const {h,gate,operation,detached,before,raw}=await pending(t,phase);if(afterWrite)gate.entries[0].write();gate.entries[0].reject();await operation;terminal(h);
 if(afterWrite){if(phase==='prepare')exactPreparation(h.persisted(),before);else exactJump(h.persisted(),before);}else assert.equal(h.bytes(),raw);
 const bytes=h.bytes();await h.submit();await detached(submitEvent(h));await h.store.acquire(true);terminal(h);assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);
 h.external(structuredClone(h.persisted()));terminal(h);
 h.api.closeModal();await h.runAction('jump');assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);assert.equal(h.store.reloadRequired,true);
});

for(const phase of ['prepare','commit'])for(const loss of ['disk revision','published revision','editing authority'])test(`jump ${phase} late save respects ${loss} without overwriting authoritative campaign`,async t=>{
 const {h,gate,operation,detached}=await pending(t,phase);
 if(loss==='editing authority')h.store.yield();else h.external(S.transition(h.persisted(),'External deposit',s=>S.deposit(s,23,'External')),{publish:loss==='published revision'});
 const bytes=h.bytes(),current=structuredClone(h.api.state),writes=h.counters.writes;gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);same(h.api.state,current);assert.equal(h.counters.writes,writes);noSuccess(h);assert.equal(h.api.view,'0,0');
 assert.match(ui(h).modalError,/stale|changed|editing|read-only/i);const retry=detached(submitEvent(h));await flush();for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await retry;assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,writes);
});

for(const phase of ['prepare','commit'])for(const outcome of ['fulfillment','known failure'])test(`external same-revision publication during jump ${phase} cannot revive stale review after ${outcome}`,async t=>{
 const {h,gate,operation,before,detached}=await pending(t,phase);h.external(structuredClone(h.persisted()));if(outcome==='known failure')h.failNext();gate.entries[0].fulfill();await operation;
 if(outcome==='fulfillment'){if(phase==='prepare')exactPreparation(h.persisted(),before);else exactJump(h.persisted(),before);}
 else same(h.persisted(),before);
 const bytes=h.bytes();await detached(submitEvent(h));await flush();assert.equal(gate.entries.length,1,'Observed replacement must retire old modal session');assert.equal(h.bytes(),bytes);if(phase==='prepare')assert.notEqual(ui(h).modalTitle.startsWith('Commit jump')&&ui(h).submitDisabled===false,true,'Late preparation must not open an actionable stale commit review');
});

for(const phase of ['prepare','commit'])test(`jump ${phase} success callback render fault after completion is a durable reload-only failure`,async t=>{
 const {h,gate,operation,before}=await pending(t,phase);let injected=false;
 if(phase==='prepare'){
  const title=h.dom.ids.get('modal-title');let value=title.textContent;Object.defineProperty(title,'textContent',{get:()=>value,set(next){if(/^Commit jump/.test(next)&&!injected){injected=true;throw Error('Injected prepared review render fault');}value=next;}});
 }else{
  const main=h.dom.ids.get('main');let value=main.innerHTML;Object.defineProperty(main,'innerHTML',{get:()=>value,set(next){if(h.api.view==='1,0'&&!injected){injected=true;throw Error('Injected arrival render fault');}value=next;}});
 }
 gate.entries[0].fulfill();await operation;assert.equal(injected,true,'The intended real post-save callback was exercised');terminal(h);if(phase==='prepare')exactPreparation(h.persisted(),before);else exactJump(h.persisted(),before);
 const bytes=h.bytes();await h.submit();assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

test('invalid elapsed-hours remains an ordinary retryable validation error without any provider call',async()=>{
 const h=jumpHarness();await review(h);const bytes=h.bytes(),writes=h.counters.writes;h.fill({hours:'-1'});await h.submit();assert.match(ui(h).modalError,/whole nonnegative hours/i);assert.equal(ui(h).submitDisabled,false);assert.equal(!!h.store.reloadRequired,false);assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,writes);
 h.fill({hours:160});await h.submit();assert.equal(h.persisted().actual,'1,0');
});

test('controller saved-roll reuse remains synchronous and non-writing while the app guards read-only initiation',async()=>{
 const h=jumpHarness();await review(h);h.api.closeModal();let rolls=0;const bytes=h.bytes(),writes=h.counters.writes;
 const reused=h.api.controller.prepareJump(()=>{rolls++;return {dice:[1,1,1,1,1,1],total:6};},0);
 assert.equal(typeof reused?.then,'undefined');assert.equal(rolls,0);assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,writes);
 h.store.yield();await h.runAction('jump');assert.equal(ui(h).modalOpen,false);assert.equal(h.counters.writes,writes);assert.equal(h.bytes(),bytes);assert.match(ui(h).message,/editing|read-only/i);
});

for(const phase of ['prepare','commit'])for(const loss of ['publication','editing authority'])test(`late ${loss} after durable jump ${phase} write prevents old-session UI completion`,async t=>{
 const {h,gate,operation,before,session,detached}=await pending(t,phase);gate.entries[0].write();const bytes=h.bytes();
 if(loss==='publication')h.external(structuredClone(h.persisted()));else h.store.yield();
 gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);assert.equal(h.api.view,'0,0','An invalidated owner must not overwrite browsing position on late completion');
 if(phase==='prepare'){exactPreparation(h.persisted(),before);assert.notEqual(ui(h).modalTitle.startsWith('Commit jump')&&!ui(h).submitDisabled,true);}
 else exactJump(h.persisted(),before);
 await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);if(h.api.modalSession===session)assert.equal(ui(h).submitDisabled,true);
});

for(const afterWrite of [false,true])test(`preparation pending-screen construction fault ${afterWrite?'after':'before'} durable write keeps reload lock until original completion settles`,async()=>{
 const h=jumpHarness(),before=structuredClone(h.api.state),raw=h.bytes(),gate=serviceSaveGate(h.store),title=h.dom.ids.get('modal-title');let value=title.textContent,injected=false;
 if(afterWrite){const deferred=h.store.save;h.store.save=function(...args){const completion=deferred.apply(this,args);gate.entries.at(-1).write();return completion;};}
 Object.defineProperty(title,'textContent',{get:()=>value,set(next){if(/^Preparing jump/.test(next)&&!injected){injected=true;throw Error('Injected preparing screen construction fault');}value=next;}});
 const operation=h.runAction('jump');await flush();assert.equal(injected,true);assert.equal(gate.entries.length,1);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.match(ui(h).message,/reload/i);const bytes=h.bytes();
 if(afterWrite)exactPreparation(h.persisted(),before);else assert.equal(bytes,raw);
 const repeated=h.runAction('jump');gate.entries[0].fulfill();await operation;await repeated;gate.restore();assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,afterWrite?1:0);assert.equal(h.store.reloadRequired,true);assert.equal(h.dom.ids.get('takeover').disabled,true);
 if(afterWrite){const fresh=jumpHarness(h.store.read());await review(fresh);assert.equal(fresh.counters.writes,0);assert.equal(fresh.dice.calls,0);}
});

test('idle commit review immediately shows stale guidance and disables confirmation after foreign same-revision publication',async()=>{
 const h=jumpHarness();await review(h);const bytes=h.bytes(),writes=h.counters.writes,detached=h.dom.ids.get('modal-form').onsubmit;h.external(structuredClone(h.persisted()));
 assert.match(ui(h).modalError,/changed|reopen/i);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.fields().get('hours').readOnly,true);await detached(submitEvent(h));assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,writes);
 h.api.closeModal();await review(h);assert.equal(ui(h).submitDisabled,false);assert.equal(h.dom.fields().get('hours').readOnly,false);assert.equal(h.counters.writes,writes);assert.equal(h.dice.calls,1);h.fill({hours:160});await h.submit();assert.equal(h.persisted().actual,'1,0');
});

for(const point of ['beforeNotify','afterNotify'])test(`synchronous reentrant jump during ${point} preparation publication cannot write or roll again`,()=>{
 const h=jumpHarness();let reentries=0;h.hooks[point]=()=>{reentries++;assert.equal(h.api.actions.jump(),false);};
 const result=h.api.actions.jump();assert.equal(result,undefined);assert.equal(reentries,1);assert.equal(h.counters.writes,1);assert.equal(h.dice.calls,1);assert.equal(h.persisted().jumpAttempts.length,1);assert.equal(h.persisted().jumpAttempts[0].rolls.length,1);assert.match(ui(h).modalTitle,/^Commit jump/);
});
