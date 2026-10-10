import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {depositHarness,S,same,ui,flush} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {dashboardData} from '../js/dashboard-data.mjs';

// Real production Settings callbacks, controller, and Store. Private storage and
// modal DOM are doubled; the companion Chromium suite owns real inline form
// mounting, suspension, focus, native validation, gestures, and Web Locks.
// Bind the unchanged production editor callback into the existing app VM. No
// production bodies or shared test harness files are changed by this suite.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),appSource=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const marker='store=new Store(receiveCampaign,',start=appSource.indexOf(marker);assert.ok(start>=0);
const roleCallback=appSource.slice(start+marker.length).split(');try{state=store.read();}')[0];assert.ok(roleCallback.startsWith('(editable,text)=>'));
let roleSource=await readFile(harnessURL,'utf8');
roleSource=roleSource.replaceAll('import.meta.url',JSON.stringify(harnessURL.href)).replace(/from '(\.[^']+)'/g,(_match,path)=>'from '+JSON.stringify(new URL(path,harnessURL).href));
assert.ok(roleSource.includes('globalThis.api={setStore'));
roleSource=roleSource.replace('globalThis.api={setStore','globalThis.api={roleChange:'+roleCallback+',saveSettings,setStore');
const {harness:realRoleHarness}=await import('data:text/javascript;base64,'+Buffer.from(roleSource).toString('base64'));
const draft={name:'Completion Settings campaign',ship:'Completion Trader',capacity:'160.1',jump:'3',broker:'3',streetwise:'2',admin:'1',characteristic:'-1',rank:'4',soc:'2',mode:'custom',custom:'62.5',shipTons:'300',fuelCapacity:'60',bladderTons:'90',fuelAboard:'65','rooms-low':'1','roomService-low':'custom','roomCustom-low':'200','rooms-middle':'5','roomService-middle':'custom','roomCustom-middle':'1300','rooms-high':'2','roomService-high':'custom','roomCustom-high':'1700','people-middle':'6','people-high':'3',occupiedLowBerths:'2',luggageOverride:true,luggageTons:'7',supportCapacity:'35',supportRemaining:'13.75',supportUnits:'',creditStep:'100',scoops:false,armed:true,reducedProfitLimitsEnabled:true,minPurchasePercent:'90',maxSalePercent:'110',maxBaseRetailEnabled:true,maxBaseRetail:'50000',useRawIllegalPrices:true,tax:true,insurance:true,mortgageOriginal:'24000000',mortgagePayment:'100001',mortgageRemaining:'360',mortgagePaid:'12000000',mortgageDueDate:'029-1105',maintenancePayment:'2001',maintenanceDueDate:'015-1105'};
function fixture(){const s=guiFixture().state;s.ship.lifeSupport.elapsedHours=6;s.policies=[{id:'settings-policy',lotId:'lot-opening',claims:[],status:'active',initialQuantity:'2',remainingQuantity:'2',insuredValue:'2000',remainingValue:'2000',coverage:70,route:s.route.slice(s.routeIndex),routeProgress:0,destination:s.route.at(-1)}];return S.validate(s);}
function setup(saved=fixture(),{realRole=false}={}){
 const storage=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}});if(!realRole)return storage;
 const h=realRoleHarness(saved,[],{setTimeout:()=>0,clearTimeout(){}}),store=storage.store;
 store.onChange=(next,metadata)=>h.api.setState(next,metadata);store.onRole=(editable,text)=>h.api.roleChange(editable,text);h.api.setStore(store);
 return {...storage,...h,store,bytes:storage.bytes,persisted:storage.persisted,counters:storage.counters};
}
function open(h,edits=draft){h.api.actions['settings-edit']();h.fill(edits);assert.equal(ui(h).modalTitle,'Ship, trader & options');}
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
const noSuccess=h=>assert.doesNotMatch(ui(h).message,/Ship \/ trader settings saved\.|Settings saved\./);
function terminal(h){assert.equal(h.store.editable,false);assert.equal(h.store.reloadRequired,true);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('takeover').disabled,true);for(const id of ['message','save-status','modal-error'])assert.match(h.dom.ids.get(id).textContent,/reload/i);noSuccess(h);}
async function pending(t,h=setup(),edits=draft){
 const before=structuredClone(h.api.state),raw=h.bytes();open(h,edits);const gate=serviceSaveGate(h.store),detached=h.dom.ids.get('modal-form').onsubmit,operation=h.submit();
 await flush();assert.equal(gate.entries.length,1,'Production Settings callback reaches the real deferred Store once');
 t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 return {h,before,raw,gate,operation,detached,session:h.api.modalSession};
}
function exact(h,before,entry){same(h.persisted(),entry.args[0]);same(h.api.state,entry.args[0]);assert.equal(h.persisted().revision,before.revision+1);assert.equal(h.persisted().undo.length,before.undo.length+1);assert.equal(h.counters.writes,1);assert.equal(entry.args[1],before.revision);assert.ok(entry.args[2]);assert.doesNotMatch(h.bytes(),/saveToken|replacementToken/);}
function economics(saved,before){
 for(const key of ['bank','ledger','lots','contracts','policies','snapshots','route','routeIndex','actual','hours','dateLabel','dashboardBaseline'])same(saved[key],before[key]);
 assert.equal(saved.name,draft.name);assert.equal(saved.ship.name,draft.ship);assert.equal(saved.ship.capacity,'161');assert.equal(saved.ship.jump,3);same(saved.ship.fuel,configureFuel(300,60,65,90,3));
 same(saved.ship.lifeSupport,{capacityHours:840,stockUnits:{numerator:'55',denominator:'2'}});
 assert.equal(saved.ship.accommodation.passengers.middle,6);assert.equal(saved.ship.accommodation.passengers.high,3);assert.equal(saved.ship.accommodation.occupiedLowBerths,2);
 same(saved.ship.mortgage,{originalAmount:'24000000',payment:'100001',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'});
 same(saved.ship.maintenance,{payment:'2001',nextDueDate:'015-1105',paidSinceTracking:'0'});
 assert.equal(saved.settings.creditStep,100);assert.equal(saved.settings.profit,62.5);assert.equal(saved.settings.tax,true);assert.equal(saved.settings.insurance,true);
 const added=saved.events.slice(before.events.length);assert.ok(added.some(e=>e.label==='Mortgage settings audit'&&e.before===null&&e.after.payment==='100001'));assert.ok(added.some(e=>e.label==='Maintenance settings audit'&&e.before===null&&e.after.payment==='2001'));assert.ok(added.some(e=>e.label==='Rounding applied [R]'));
 same(dashboardData(saved).currentBank,dashboardData(before).currentBank);same(dashboardData(saved).operatingResult,dashboardData(before).operatingResult);
}
function canonical(state){const ids=new Map();return JSON.parse(JSON.stringify(state,(_key,value)=>{if(typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)){if(!ids.has(value))ids.set(value,'generated-'+ids.size);return ids.get(value);}return value;}));}

test('raw Settings save and production modal remain immediate for the synchronous Store',async()=>{
 const h=setup(fixture(),{realRole:true}),before=h.persisted();open(h);const result=h.submit();assert.equal(h.counters.writes,1);economics(h.persisted(),before);assert.match(ui(h).message,/Ship \/ trader settings saved\./);await result;assert.equal(ui(h).modalOpen,false);
 const raw=setup(fixture(),{realRole:true}),f={get:name=>typeof draft[name]==='boolean'?null:draft[name],has:name=>draft[name]===true};const saved=raw.api.saveSettings(f,raw.api.state.revision);assert.equal(typeof saved?.then,'undefined');assert.equal(raw.counters.writes,1);
});

test('Settings retains the exact normalized candidate, rounding and review through owned publication until completion',async t=>{
 const {h,before,raw,gate,operation,session}=await pending(t),body=h.dom.ids.get('modal-body').innerHTML,rounding=structuredClone(h.api.inputRounding);
 assert.equal(h.bytes(),raw);assert.equal(session.busy,true);assert.equal(session.awaitSave,true);assert.equal(ui(h).submitDisabled,true);noSuccess(h);assert.ok(rounding.length);
 gate.entries[0].write();exact(h,before,gate.entries[0]);economics(h.persisted(),before);assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalOpen,true);assert.equal(session.busy,true);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);same(h.api.inputRounding,rounding);noSuccess(h);
 gate.entries[0].fulfill();await operation;assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,/Ship \/ trader settings saved\./);
 const synchronous=setup(before);open(synchronous);await synchronous.submit();same(canonical(h.persisted()),canonical(synchronous.persisted()));
 for(const observation of h.trace)assert.doesNotMatch(observation.message,/Ship \/ trader settings saved\./);
});

test('pending Settings duplicate click, Enter, detached handler, Close, Escape and replacement cannot replay',async t=>{
 const {h,raw,gate,operation,detached,session}=await pending(t),body=h.dom.ids.get('modal-body').innerHTML;
 await h.submit();await detached(submitEvent(h));h.dom.dispatch('keydown',{matches:()=>false},{key:'Enter',preventDefault(){}});h.dom.ids.get('modal-cancel').onclick();h.dom.ids.get('modal-close').onclick();let blocked=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){blocked=true;}});assert.equal(blocked,true);h.api.modal('Unrelated review','Must not replace Settings',null);await h.runAction('reset');
 assert.equal(h.bytes(),raw);assert.equal(h.api.modalSession,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await operation;const bytes=h.bytes();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);
});

test('known prewrite failure retains the exact review and allows one corrected deliberate retry',async t=>{
 const {h,before,raw,gate,operation,session,detached}=await pending(t),body=h.dom.ids.get('modal-body').innerHTML,rounding=structuredClone(h.api.inputRounding);h.failNext();gate.entries[0].fulfill();await operation;
 assert.equal(h.bytes(),raw);same(h.api.state,before);assert.equal(h.api.modalSession,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);same(h.api.inputRounding,rounding);assert.match(ui(h).modalError,/quota/i);assert.equal(ui(h).submitDisabled,false);assert.equal(h.store.reloadRequired??false,false);noSuccess(h);
 h.fill({name:'Corrected after prewrite failure'});const retry=h.submit();await flush();assert.equal(gate.entries.length,2);await detached(submitEvent(h));assert.equal(gate.entries.length,2);gate.entries[1].fulfill();await retry;assert.equal(h.counters.attempts,2);assert.equal(h.counters.writes,1);assert.equal(h.persisted().undo.length,before.undo.length+1);assert.equal(h.persisted().name,'Corrected after prewrite failure');
});

test('production Settings cross-field and invalid data failures never invoke the provider or consume Undo',async()=>{
 for(const [name,value,pattern]of [['shipTons','',/together/],['fuelAboard','151',/capacity|fuel/i],['capacity','1',/capacity|cargo|hold/i],['supportRemaining','',/recorded days/i],['broker','1.5',/whole numbers/],['minPurchasePercent','401',/400/],['mortgagePayment','',/mortgage/]]){
  const h=setup(),raw=h.bytes();open(h,{...draft,[name]:value});const gate=serviceSaveGate(h.store);await h.submit();assert.equal(h.bytes(),raw,name);assert.equal(gate.entries.length,0,name);assert.match(ui(h).modalError,pattern,name);assert.equal(h.store.reloadRequired??false,false,name);gate.restore();
 }
});

for(const point of ['beforeNotify','afterNotify'])test(`Settings durable ${point} failure is reload-only and Undo restores all pre-save economics`,async t=>{
 const {h,before,gate,operation,detached}=await pending(t);h.hooks[point]=()=>{throw Error('Injected '+point+' failure');};gate.entries[0].fulfill();await operation;terminal(h);same(h.persisted(),gate.entries[0].args[0]);economics(h.persisted(),before);assert.match(ui(h).message,/Settings saved, but/);const bytes=h.bytes();await detached(submitEvent(h));await h.store.acquire(true);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
 const fresh=setup(h.store.read());await fresh.runAction('undo');for(const key of ['name','ship','trader','settings','bank','ledger','lots','contracts','policies','snapshots','route','actual','hours','dashboardBaseline'])same(fresh.persisted()[key],before[key]);
});
for(const afterWrite of [false,true])test(`Settings unknown rejection ${afterWrite?'after':'before'} publication is terminal, never an unsafe retry`,async t=>{
 const {h,raw,gate,operation,detached}=await pending(t);if(afterWrite)gate.entries[0].write();gate.entries[0].reject();await operation;terminal(h);assert.match(ui(h).message,afterWrite?/Settings saved, but/:/outcome.*could not be confirmed/);if(!afterWrite)assert.equal(h.bytes(),raw);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);
});
for(const publication of ['missing','wrong token','wrong revision'])test(`Settings fulfillment with ${publication} publication fails closed`,async t=>{
 const {h,gate,operation}=await pending(t);if(publication==='missing')h.store.onChange=()=>{};else h.hooks.beforeNotify=(next,metadata)=>{if(publication==='wrong token')metadata.saveToken={};else next.revision++;};gate.entries[0].fulfill();await operation;terminal(h);assert.match(ui(h).message,/outcome.*could not be confirmed/);assert.equal(h.counters.writes,1);await h.submit();assert.equal(gate.entries.length,1);
});
test('owned publication outranks contradictory known prewrite Settings rejection',async t=>{
 const {h,gate,operation}=await pending(t);gate.entries[0].write();gate.entries[0].reject(Object.assign(Error('Contradictory prewrite claim'),{code:'SAVE_NOT_COMMITTED',committed:false}));await operation;terminal(h);assert.match(ui(h).message,/Settings saved, but/);await h.submit();assert.equal(h.counters.writes,1);assert.equal(gate.entries.length,1);
});
for(const when of ['before','after'])test(`foreign same-revision publication ${when} owned Settings write permanently retires UI cleanup`,async t=>{
 const {h,gate,operation}=await pending(t);if(when==='after')gate.entries[0].write();h.external(structuredClone(h.persisted()));if(when==='before')gate.entries[0].write();h.api.setView(h.api.state.route.at(-1));h.api.setSelected(['newer-selection']);gate.entries[0].fulfill();await operation;noSuccess(h);same(h.api.selected,['newer-selection']);assert.equal(h.api.view,h.api.state.route.at(-1));assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,true);
});
for(const change of ['disk only','published revision'])test(`pending Settings rechecks ${change} and cannot overwrite newer state`,async t=>{
 const {h,gate,operation}=await pending(t),next=S.transition(h.persisted(),'External deposit',s=>S.deposit(s,7,'New owner'));h.external(next,{publish:change==='published revision'});const bytes=h.bytes();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,0);noSuccess(h);assert.match(ui(h).modalError,/stale|changed|editing|read-only/i);
});
for(const afterWrite of [false,true])test(`production editor loss and regain retires Settings ${afterWrite?'after':'before'} publication`,async t=>{
 const {h,gate,operation,detached}=await pending(t,setup(fixture(),{realRole:true}));if(afterWrite)gate.entries[0].write();h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');if(!afterWrite)gate.entries[0].write();gate.entries[0].fulfill();await operation;noSuccess(h);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('modal-cancel').disabled,false);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});
for(const rejection of [false,true])test(`detached Settings completion cannot close or report into a newer modal, rejection=${rejection}`,async t=>{
 const {h,gate,operation,detached}=await pending(t),dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer unrelated review','Preserve this newer dialog',null);const session=h.api.modalSession;if(rejection)h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalTitle,'Newer unrelated review');assert.equal(ui(h).modalError,'');assert.equal(ui(h).modalOpen,true);noSuccess(h);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);
});
for(const fault of ['close before','close after','render','success reporting','terminal reporting'])test(`Settings ${fault} fault is observed and leaves the durable save reload-only`,async t=>{
 const {h,gate,operation}=await pending(t);let count=0;const dialog=h.dom.ids.get('modal');
 if(fault.startsWith('close')){const close=dialog.close;dialog.close=function(){if(count++)return close.call(this);if(fault==='close after'){close.call(this);dialog.dispatch('close');}throw Error('Injected Settings '+fault+' failure');};}
 else if(fault==='render'){const main=h.dom.ids.get('main');let html=main.innerHTML;Object.defineProperty(main,'innerHTML',{get:()=>html,set(next){if(gate.entries[0].settled&&!count++){throw Error('Injected Settings cleanup render failure');}html=next;}});}
 else {const message=h.dom.ids.get('message');let text=message.textContent;Object.defineProperty(message,'textContent',{get:()=>text,set(next){if(!count&&((fault==='success reporting'&&/Ship \/ trader settings saved\./.test(next))||(fault==='terminal reporting'&&/Reload/.test(next)))){count++;throw Error('Injected Settings reporting failure');}text=next;}});}
 if(fault==='terminal reporting')gate.entries[0].write(),gate.entries[0].reject();else gate.entries[0].fulfill();await operation;assert.ok(count);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.counters.writes,1);assert.match(h.dom.ids.get('save-status').textContent,/Reload/);assert.equal(ui(h).submitDisabled,true);const bytes=h.bytes();await h.submit();assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});
test('completed Settings reload and Undo preserve the Dashboard baseline and exact supply/cargo records',async t=>{
 const {h,before,gate,operation}=await pending(t);gate.entries[0].fulfill();await operation;const fresh=setup(h.store.read());assert.equal(fresh.bytes(),h.bytes());economics(fresh.persisted(),before);await fresh.runAction('undo');for(const key of ['name','ship','trader','settings','bank','ledger','lots','contracts','policies','route','actual','hours','dashboardBaseline'])same(fresh.persisted()[key],before[key]);assert.equal(fresh.persisted().undo.length,before.undo.length);
});
test('saving Settings closes a pending consumed mulligan without altering rolls; Undo cannot reopen its allowance',async()=>{
 const base=fixture();base.ship.fuel=configureFuel(200,40,60,40,2);base.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'560',denominator:'1'}};const prepared=S.prepareJump(base,()=>({dice:[3,3,3,3,3,3],total:18}));const committed=S.transition(prepared.state,'Jump',s=>S.commitJump(s,{attemptId:prepared.attempt.id,elapsed:160}));const reverted=S.undoJump(committed);assert.equal(reverted.jumpAttempts[0].mulliganUsed,true);const replacement=S.prepareJump(reverted,()=>({dice:[2,2,2,2,2,2],total:12}));const finalJump=S.transition(replacement.state,'Jump',s=>S.commitJump(s,{attemptId:replacement.attempt.id,elapsed:160}));const h=setup(finalJump);open(h,{...draft,supportRemaining:'100'});await h.submit();assert.equal(h.counters.writes,1);const saved=h.persisted();same(saved.jumpAttempts[0].rolls,finalJump.jumpAttempts[0].rolls);assert.equal(saved.jumpAttempts[0].mulliganUsed,true);assert.equal(saved.jumpAttempts[0].closed,true);await h.runAction('undo');assert.equal(h.persisted().jumpAttempts[0].mulliganUsed,true);assert.equal(h.persisted().jumpAttempts[0].closed,true);assert.equal(S.jumpUndoEligibility(h.persisted()).allowed,false);
});

for(const deferred of [false,true])test(`optional onPrepared hook runs synchronously once before the provider, delayed=${deferred}`,async()=>{
 const h=setup(),events=[],original=h.store.save;h.store.save=function(...args){events.push('provider');return original.apply(this,args);};const gate=deferred?serviceSaveGate(h.store):null;
 const result=h.api.controller.transition('Prepared Settings contract',s=>{events.push('mutator');s.name='Prepared';},h.api.state.revision,{onPrepared(...args){assert.equal(args.length,0,'Observer does not receive a mutable candidate');events.push('prepared');}});
 assert.deepEqual(events,deferred?['mutator','prepared']:['mutator','prepared','provider']);assert.equal(typeof result?.then,deferred?'function':'undefined');if(deferred){gate.entries[0].fulfill();const saved=await result;assert.equal(saved.name,'Prepared');gate.restore();}else assert.equal(result.name,'Prepared');assert.deepEqual(events,['mutator','prepared','provider']);assert.equal(h.counters.writes,1);
});
test('onPrepared hook is never called for invalid, stale or already-busy transitions',async()=>{
 for(const failure of ['invalid','stale','busy']){const h=setup(),raw=h.bytes();let called=0,operation,gate;if(failure==='busy'){gate=serviceSaveGate(h.store);operation=h.api.controller.transition('Pending operation',s=>{s.name='First';},h.api.state.revision);}
  assert.throws(()=>h.api.controller.transition('Invalid observer phase',s=>{if(failure==='invalid')s.ship.capacity='-1';},h.api.state.revision+(failure==='stale'?1:0),{onPrepared(){called++;}}),e=>e.code==='SAVE_NOT_COMMITTED'&&e.committed===false);assert.equal(called,0);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);if(gate){gate.entries[0].fulfill();await operation;gate.restore();}
 }
});
test('throwing onPrepared observer is known prewrite and leaves the synchronous raw return contract available',()=>{
 const h=setup(),raw=h.bytes();let called=0;assert.throws(()=>h.api.controller.transition('Throwing observer',s=>{s.name='Never saved';},h.api.state.revision,{onPrepared(){called++;throw Error('Synthetic prepared phase fault');}}),e=>e.code==='SAVE_NOT_COMMITTED'&&e.committed===false&&/prepared phase/.test(e.message));assert.equal(called,1);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);const saved=h.api.controller.transition('Default legacy transition',s=>{s.name='Legacy';},h.api.state.revision);assert.equal(typeof saved?.then,'undefined');assert.equal(saved.name,'Legacy');assert.equal(h.counters.writes,1);
});

for(const [correction,value,wanted]of [['supportUnits','30.5',{numerator:'61',denominator:'2'}],['supportRemaining','13',{numerator:'598',denominator:'5'}]])test(`delayed Settings ${correction} is an inventory correction, never a bank payment`,async t=>{
 const {h,before,gate,operation}=await pending(t,setup(),{...draft,[correction]:value});gate.entries[0].fulfill();await operation;exact(h,before,gate.entries[0]);same(h.persisted().ship.lifeSupport,{capacityHours:840,stockUnits:wanted});for(const key of ['bank','ledger','lots','contracts','policies','actual','hours','dashboardBaseline'])same(h.persisted()[key],before[key]);gate.restore();await h.runAction('undo');for(const key of ['ship','bank','ledger','lots','contracts','policies','actual','hours','dashboardBaseline'])same(h.persisted()[key],before[key]);
});
test('Settings owner exists before synchronous publication and rejects reentrant submission before its provider is invoked twice',async()=>{
 const h=setup(),before=h.persisted();open(h);let calls=0,reentrant;
 h.hooks.beforeNotify=()=>{calls++;reentrant=h.submit();};const operation=h.submit();assert.equal(h.counters.writes,1);await operation;await reentrant;assert.equal(calls,1);assert.equal(h.counters.writes,1);assert.equal(h.persisted().undo.length,before.undo.length+1);economics(h.persisted(),before);
});
