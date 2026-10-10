import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {depositHarness,campaign,S,same,ui,flush} from './deposit-save-harness.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {latestMailCheck} from '../js/mail-history.mjs';

// Actual app callbacks/controller/Store; only DOM and private browser storage
// are doubled. The companion suite owns actual file gestures and Web Locks.
// Inject the unchanged production boot role callback into the existing VM
// harness API. The real callback shares the app's lexical generations; no
// role/invalidation body is reproduced and no shared harness file is edited.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),appSource=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const roleMarker='store=new Store(receiveCampaign,',roleStart=appSource.indexOf(roleMarker);assert.ok(roleStart>=0,'Production Store boot callback exists');
const roleCallback=appSource.slice(roleStart+roleMarker.length).split(');try{state=store.read();}')[0];assert.ok(roleCallback.startsWith('(editable,text)=>'));assert.match(roleCallback,/invalidateReplacementEditing\(\)/);
let roleHarnessSource=await readFile(harnessURL,'utf8');roleHarnessSource=roleHarnessSource.replaceAll('import.meta.url',JSON.stringify(harnessURL.href)).replace(/from '(\.[^']+)'/g,(_match,path)=>'from '+JSON.stringify(new URL(path,harnessURL).href));assert.ok(roleHarnessSource.includes('globalThis.api={setStore'));roleHarnessSource=roleHarnessSource.replace('globalThis.api={setStore','globalThis.api={roleChange:'+roleCallback+',setStore');
const {harness:productionRoleHarness}=await import('data:text/javascript;base64,'+Buffer.from(roleHarnessSource).toString('base64'));
function setupRealRole(){const saved=fixture(),storage=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}}),h=productionRoleHarness(saved,[],{setTimeout:()=>0,clearTimeout(){}}),store=storage.store;store.onChange=(next,metadata)=>h.api.setState(next,metadata);store.onRole=(editable,text)=>h.api.roleChange(editable,text);h.api.setStore(store);return {...h,store,bytes:storage.bytes,persisted:storage.persisted,counters:storage.counters};}
const noSuccess=h=>assert.doesNotMatch(ui(h).message,/Campaign replaced\./);
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
const drafts=[{offerId:'replacement-freight',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true}}];
function fixture(){let s=campaign();s.ship.capacity='100';s.lots=[{id:'replacement-cargo',commodity:'11',description:'Retained cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];s=S.transition(s,'Manual deposit',next=>S.deposit(next,125,'Retained import economics'));s.dashboardBaseline=createDashboardBaseline(s);return S.validate(s);}
function replacement({baseline=true}={}){const s=S.transition(fixture(),'Imported deposit',next=>S.deposit(next,77,'Imported history'));s.revision=91;s.actual='1,0';s.name='Imported synthetic campaign';if(!baseline)delete s.dashboardBaseline;return S.validate(s);}
function setup({recovery=false}={}){const h=depositHarness(recovery?S.initial():fixture(),{setTimeout:()=>0,clearTimeout(){}});h.store.recovery=recovery;return h;}
const candidate=path=>path==='import'?replacement():S.initial();
function open(h,path,next=candidate(path)){if(path==='import')h.api.backupReplace('Load campaign (JSON)',next);else h.api.actions.reset();assert.match(ui(h).modalTitle,path==='import'?/Load campaign/:/Reset campaign/);return next;}
function exact(h,next,expected){const wanted=structuredClone(next);wanted.revision=expected+1;if(wanted.initialized&&!wanted.dashboardBaseline)wanted.dashboardBaseline=createDashboardBaseline(wanted);same(h.persisted(),wanted);same(h.api.state,wanted);assert.equal(h.store.recovery,false);assert.equal(h.notifications.at(-1).local,false);assert.ok(h.notifications.at(-1).metadata.replacementToken);assert.doesNotMatch(h.bytes(),/replacementToken|saveToken/);}
function gateReplace(store){const original=store.replace,entries=[],observed=[];store.replace=function(...args){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});const entry={args,promise,wrote:false,settled:false,result:undefined,error:null,write(){assert.equal(this.wrote,false);this.wrote=true;try{this.result=Reflect.apply(original,store,args);}catch(error){this.error=error;}},fulfill(){assert.equal(this.settled,false);if(!this.wrote)this.write();this.settled=true;if(this.error)reject(this.error);else resolve(this.result);},reject(error=Error('Unknown replacement completion')){assert.equal(this.settled,false);this.settled=true;reject(error);}};promise.catch(error=>observed.push(error));entries.push(entry);return promise;};return {entries,observed,restore(){store.replace=original;}};}
async function pending(t,path,{recovery=false,next=candidate(path)}={}){const h=setup({recovery}),before=structuredClone(h.api.state),raw=h.bytes(),gate=gateReplace(h.store);open(h,path,next);h.fill({backed:true});const operation=h.submit();await flush();assert.equal(gate.entries.length,1);t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});return {h,next,before,raw,gate,operation,session:h.api.modalSession,detached:h.dom.ids.get('modal-form').onsubmit};}
function busy(h,session){assert.equal(ui(h).modalOpen,true);assert.equal(h.api.modalSession,session);assert.equal(session.busy,true);assert.equal(session.awaitSave,true);assert.equal(ui(h).submitDisabled,true);for(const id of ['modal-cancel','modal-close'])assert.equal(h.dom.ids.get(id).disabled,true);noSuccess(h);}
function terminal(h){assert.equal(h.store.editable,false);assert.equal(h.store.reloadRequired,true);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('takeover').disabled,true);for(const id of ['message','save-status','modal-error'])assert.match(h.dom.ids.get(id).textContent,/reload/i);noSuccess(h);}
function fileRead(h){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}),input=h.dom.ids.get('import-file');input.files=[{size:100,text:()=>promise}];input.value='synthetic.json';const operation=input.onchange({target:input});return {resolve,reject,operation};}

for(const path of ['import','reset'])for(const recovery of [false,true])test(`${path} ${recovery?'recovery':'normal'} requires backup acknowledgement and preserves cancellation; synchronous replace stays immediate`,async()=>{
 const h=setup({recovery}),before=h.bytes(),next=open(h,path),input=structuredClone(next);assert.equal(h.counters.writes,0);await h.submit();assert.equal(h.bytes(),before);assert.match(ui(h).modalError,/backup|proceed/i);assert.equal(h.store.reloadRequired??false,false);assert.equal(ui(h).submitDisabled,false);h.api.closeModal();assert.equal(h.bytes(),before);
 open(h,path,next);h.fill({backed:true});const result=h.submit();assert.equal(h.counters.writes,1,'Raw synchronous provider does not add a microtask before writing');exact(h,next,JSON.parse(before).revision);assert.equal(ui(h).message,'Campaign replaced.');await result;assert.equal(ui(h).modalOpen,false);same(next,input);
});

test('replacement controller preserves raw synchronous and asynchronous provider results',async()=>{
 for(const asynchronous of [false,true]){const h=setup(),native=h.store.replace,sentinel={provider:'replacement result'};h.store.replace=function(...args){native.apply(this,args);return asynchronous?Promise.resolve(sentinel):sentinel;};const value=h.api.controller.replace(replacement(),h.api.state.revision);if(asynchronous){assert.equal(typeof value.then,'function');assert.equal(await value,sentinel);}else assert.equal(value,sentinel);assert.equal(h.counters.writes,1);}
});

for(const path of ['import','reset'])for(const recovery of [false,true])test(`${path} ${recovery?'recovery':'normal'} waits for publication AND completion, then cleans up once`,async t=>{
 const {h,next,before,raw,gate,operation,session}=await pending(t,path,{recovery});h.api.setDrafts(structuredClone(drafts));h.api.setSelected(['replacement-cargo']);h.api.setView('0,0');busy(h,session);same(h.api.state,before);assert.equal(h.bytes(),raw);same(h.api.drafts,drafts);same(h.api.selected,['replacement-cargo']);
 gate.entries[0].write();exact(h,next,before.revision);busy(h,session);assert.equal(h.api.view,'0,0','Owned completion alone resets browsing');same(h.api.selected,['replacement-cargo']);same(h.api.drafts,[],'Real replacement invalidates current offers at publication');assert.equal(h.counters.writes,1);
 gate.entries[0].fulfill();await operation;assert.equal(ui(h).modalOpen,false);assert.equal(ui(h).message,'Campaign replaced.');assert.equal(h.api.view,next.actual);same(h.api.selected,[]);same(h.api.drafts,[]);assert.equal(h.counters.writes,1);for(const observation of h.trace)assert.doesNotMatch(observation.message,/Campaign replaced\./);assert.equal(gate.entries[0].args.length,3);assert.ok(gate.entries[0].args[2]);
});

for(const path of ['import','reset'])test(`pending ${path} blocks repeated submission, detached replay, dismissal and replacement dialogs`,async t=>{
 const {h,gate,operation,session,detached,raw}=await pending(t,path),body=h.dom.ids.get('modal-body').innerHTML;await h.submit();await detached(submitEvent(h));h.dom.ids.get('modal-cancel').onclick();h.dom.ids.get('modal-close').onclick();let prevented=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);h.api.modal('Unrelated review','<p>Newer dialog</p>',null);await h.runAction('reset');h.api.backupReplace('New import',replacement());busy(h,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(gate.entries.length,1);assert.equal(h.bytes(),raw);gate.entries[0].fulfill();await operation;const bytes=h.bytes();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);
});

for(const path of ['import','reset'])for(const recovery of [false,true])test(`known ${path} ${recovery?'recovery':'normal'} failure leaves bytes untouched and enables one deliberate retry`,async t=>{
 const {h,next,before,raw,gate,operation}=await pending(t,path,{recovery});h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),raw);same(h.api.state,before);assert.equal(h.store.recovery,recovery);assert.equal(h.store.reloadRequired??false,false);assert.match(ui(h).modalError,/quota/i);noSuccess(h);assert.equal(h.api.modalSession.busy,false);assert.equal(ui(h).submitDisabled,false);const retry=h.submit();await flush();assert.equal(gate.entries.length,2);assert.equal(gate.entries[1].args[1],before.revision);await h.submit();gate.entries[1].fulfill();await retry;exact(h,next,before.revision);assert.equal(h.counters.writes,1);assert.equal(h.counters.attempts,2);
});

for(const path of ['import','reset'])for(const recovery of [false,true])for(const point of ['beforeNotify','afterNotify'])test(`${path} ${recovery?'recovery':'normal'} durable ${point} failure is reload-only`,async t=>{
 const {h,next,before,gate,operation,detached}=await pending(t,path,{recovery});h.hooks[point]=()=>{throw Error('Synthetic '+point+' failure');};gate.entries[0].fulfill();await operation;terminal(h);assert.match(ui(h).message,/saved/i);const wanted=structuredClone(next);wanted.revision=before.revision+1;same(h.persisted(),wanted);const bytes=h.bytes();await detached(submitEvent(h));await h.runAction('reset');await h.store.acquire(true);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);assert.equal(h.counters.writes,1);
});

for(const path of ['import','reset'])for(const afterWrite of [false,true])test(`${path} unknown ${afterWrite?'after':'before'} write outcome blocks replay until reload`,async t=>{
 const {h,raw,gate,operation,detached}=await pending(t,path);if(afterWrite)gate.entries[0].write();gate.entries[0].reject();await operation;terminal(h);assert.match(ui(h).message,afterWrite?/saved/i:/outcome.*could not be confirmed/i);if(!afterWrite)assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,afterWrite?1:0);const bytes=h.bytes();await detached(submitEvent(h));await h.runAction('reset');await h.store.acquire(true);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

for(const path of ['import','reset'])for(const afterWrite of [false,true])test(`${path} foreign same-revision publication retires old completion ${afterWrite?'after':'before'} its own write`,async t=>{
 const {h,gate,operation,detached}=await pending(t,path);if(afterWrite)gate.entries[0].write();h.external(structuredClone(h.persisted()));if(!afterWrite)gate.entries[0].write();h.api.setSelected(['newer-selection']);h.api.setView('8,0');gate.entries[0].fulfill();await operation;noSuccess(h);same(h.api.selected,['newer-selection']);assert.equal(h.api.view,'8,0');const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

for(const path of ['import','reset'])test(`${path} lost editor and newer revision cannot overwrite current saved campaign`,async t=>{
 const {h,gate,operation}=await pending(t,path);const changed=S.transition(h.persisted(),'External deposit',s=>S.deposit(s,9,'New owner'));h.external(changed);h.store.yield();const bytes=h.bytes();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);same(h.api.state,changed);assert.equal(h.counters.writes,0);noSuccess(h);assert.match(ui(h).modalError,/changed|editing|read-only|stale/i);
});

for(const baseline of [false,true])test(`import rebases revision, ${baseline?'retains':'creates'} baseline, and preserves all economic, history and Undo values exactly`,async()=>{
 const h=setup(),next=replacement({baseline}),before=structuredClone(next);open(h,'import',next);h.fill({backed:true});await h.submit();exact(h,next,1);same(next,before);for(const key of ['bank','ship','lots','contracts','policies','ledger','events','undo','jumpAttempts','hours','route','actual'])same(h.persisted()[key],before[key]);if(baseline)same(h.persisted().dashboardBaseline,before.dashboardBaseline);else same(h.persisted().dashboardBaseline,createDashboardBaseline(before));
});

test('real import publication invalidates live offers even when imported mail audit and offer IDs are reused',async()=>{
 const h=setup();await h.check();const before=structuredClone(h.api.state),check=latestMailCheck(before),offers=structuredClone(h.api.drafts);assert.ok(check);assert.ok(offers.length);open(h,'import',before);h.fill({backed:true});await h.submit();same(h.api.drafts,[]);assert.equal(h.api.check.historical,true);const bytes=h.bytes();await h.runAction('contract-accept',offers[0].offerId);assert.equal(h.bytes(),bytes);assert.match(ui(h).message,/not.*available|no longer|not found|expired/i);same(latestMailCheck(h.persisted()),check);
});

for(const outcome of ['resolve','reject'])for(const staleBy of ['new selection','new modal','campaign publication'])test(`actual import onchange ignores stale ${outcome} after ${staleBy}`,async()=>{
 const h=setup(),before=h.bytes(),old=fileRead(h);let fresh;
 if(staleBy==='new selection'){fresh=fileRead(h);fresh.resolve(JSON.stringify(replacement()));await fresh.operation;}
 else if(staleBy==='new modal')h.api.modal('Newer unrelated dialog','<p>Keep this review</p>',null);
 else h.external(structuredClone(h.persisted()));
 const uiBefore=ui(h),session=h.api.modalSession;if(outcome==='resolve')old.resolve(JSON.stringify(replacement({baseline:false})));else old.reject(Error('Obsolete file read failed'));await old.operation;assert.equal(h.bytes(),before);assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalTitle,uiBefore.modalTitle);assert.equal(ui(h).modalOpen,uiBefore.modalOpen);assert.equal(ui(h).message,uiBefore.message);assert.equal(h.counters.writes,0);
});

test('actual import onchange clears the input, rejects current bad/oversized files, and only opens valid current review',async()=>{
 const h=setup(),before=h.bytes();let file=fileRead(h);assert.equal(h.dom.ids.get('import-file').value,'');file.resolve('{bad json');await file.operation;assert.match(ui(h).message,/JSON|Unexpected|property/i);assert.equal(ui(h).modalOpen,false);file=fileRead(h);file.reject(Error('Current file read failed'));await file.operation;assert.equal(ui(h).message,'Current file read failed');const input=h.dom.ids.get('import-file');input.files=[{size:20000001,text:()=>assert.fail('Oversized files must not read')}];await input.onchange({target:input});assert.match(ui(h).message,/20 MB/);file=fileRead(h);file.resolve(JSON.stringify(replacement()));await file.operation;assert.match(ui(h).modalTitle,/Load campaign/);assert.equal(h.bytes(),before);assert.equal(h.counters.writes,0);
});

for(const path of ['import','reset'])for(const recovery of [false,true])test(`${path} ${recovery?'recovery':'normal'} native close throws before detaching: saved result stays visible and dismissible`,async t=>{
 const {h,gate,operation,next,before}=await pending(t,path,{recovery}),dialog=h.dom.ids.get('modal'),close=dialog.close;let faults=0;dialog.close=function(){faults++;throw Error('Synthetic native close before detaching');};gate.entries[0].fulfill();await operation;assert.equal(faults,1);assert.equal(dialog.open,true);terminal(h);assert.match(ui(h).modalError,/saved[\s\S]*Reload/i);assert.equal(h.dom.ids.get('modal-cancel').disabled,false);assert.equal(h.dom.ids.get('modal-close').disabled,false);exact(h,next,before.revision);const bytes=h.bytes();dialog.close=close;h.dom.ids.get('modal-cancel').onclick();assert.equal(dialog.open,false);assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,1);
});

for(const path of ['import','reset'])test(`${path} post-fulfillment cleanup render failure requires reload without replay`,async t=>{
 const {h,gate,operation,next,before}=await pending(t,path),main=h.dom.ids.get('main');let value=main.innerHTML,faults=0;Object.defineProperty(main,'innerHTML',{get:()=>value,set(next){if(gate.entries[0].settled&&!faults){faults++;throw Error('Synthetic replacement cleanup render fault');}value=next;}});gate.entries[0].fulfill();await operation;assert.equal(faults,1);terminal(h);exact(h,next,before.revision);assert.match(ui(h).modalError,/saved[\s\S]*Reload/i);const bytes=h.bytes();await h.submit();assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

for(const path of ['import','reset'])for(const failure of [false,true])test(`${path} detached owner cannot close or report into a newer dialog after ${failure?'known failure':'fulfillment'}`,async t=>{
 const {h,gate,operation,detached}=await pending(t,path),dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer read-only review','<p>Keep this newer view</p>',null);const newer=h.api.modalSession,body=h.dom.ids.get('modal-body').innerHTML;if(failure)h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.api.modalSession,newer);assert.equal(dialog.open,true);assert.equal(ui(h).modalTitle,'Newer read-only review');assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(ui(h).modalError,'');noSuccess(h);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

for(const publication of ['missing','wrong token','wrong revision'])test(`replacement fulfillment with ${publication} publication fails closed without false success`,async t=>{
 const {h,gate,operation,next,before}=await pending(t,'import');if(publication==='missing')h.store.onChange=()=>{};else h.hooks.beforeNotify=(next,metadata)=>{if(publication==='wrong token')metadata.replacementToken={};else next.revision++;};gate.entries[0].fulfill();await operation;terminal(h);assert.match(ui(h).message,/outcome.*could not be confirmed/i);const wanted=structuredClone(next);wanted.revision=before.revision+1;same(h.persisted(),wanted);const bytes=h.bytes();await h.submit();assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,1);
});

test('observed owned replacement publication outranks contradictory SAVE_NOT_COMMITTED rejection',async t=>{
 const {h,gate,operation,next,before}=await pending(t,'import');gate.entries[0].write();gate.entries[0].reject(Object.assign(Error('Contradictory provider rejection'),{code:'SAVE_NOT_COMMITTED',committed:false}));await operation;terminal(h);assert.match(ui(h).modalError,/saved[\s\S]*Reload/i);exact(h,next,before.revision);await h.submit();assert.equal(gate.entries.length,1);assert.equal(h.counters.writes,1);
});

for(const newer of [false,true])test(`native close throws after detach${newer?' and opening a newer dialog':''}: committed failure stays reload-only`,async t=>{
 const {h,gate,operation,next,before}=await pending(t,'import'),dialog=h.dom.ids.get('modal'),close=dialog.close;let faults=0;dialog.close=function(){close.call(this);dialog.dispatch('close');if(newer)h.api.modal('Newer read-only review','<p>Must remain intact</p>',null);faults++;throw Error('Synthetic native close after detaching');};gate.entries[0].fulfill();await operation;assert.equal(faults,1);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);for(const id of ['message','save-status'])assert.match(h.dom.ids.get(id).textContent,/saved[\s\S]*Reload/i);noSuccess(h);exact(h,next,before.revision);if(newer){assert.equal(dialog.open,true);assert.equal(ui(h).modalTitle,'Newer read-only review');assert.equal(ui(h).modalError,'');}else assert.equal(dialog.open,false);dialog.close=close;assert.equal(h.counters.writes,1);
});

for(const outcome of ['resolve','reject'])test(`actual production editor-loss callback permanently invalidates file ${outcome} after reacquisition without publication`,async()=>{
 const h=setupRealRole(),before=h.bytes(),file=fileRead(h);h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');const message=ui(h).message;if(outcome==='resolve')file.resolve(JSON.stringify(replacement()));else file.reject(Error('Obsolete read after lost editor'));await file.operation;assert.equal(ui(h).modalOpen,false);assert.equal(ui(h).message,message);assert.equal(h.bytes(),before);assert.equal(h.counters.writes,0);
});

for(const afterWrite of [false,true])test(`actual production loss and reacquisition before completion retires replacement ${afterWrite?'after':'before'} publication`,async()=>{
 const h=setupRealRole(),gate=gateReplace(h.store);open(h,'import');h.fill({backed:true});const operation=h.submit();await flush();if(afterWrite)gate.entries[0].write();h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');if(!afterWrite)gate.entries[0].write();h.api.setSelected(['replacement-cargo']);h.api.setView('0,0');gate.entries[0].fulfill();await operation;noSuccess(h);same(h.api.selected,['replacement-cargo']);assert.equal(h.api.view,'0,0');assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('modal-cancel').disabled,false);assert.equal(h.dom.ids.get('modal-close').disabled,false);assert.equal(h.counters.writes,1);gate.restore();
});

test('import and reload retain consumed jump mulligan, both saved rolls and exact protected Undo/audit links without reroll',async()=>{
 const jump=s=>{const prepared=S.prepareJump(s,()=>({dice:[3,3,3,3,3,3],total:18}));return S.transition(prepared.state,'Jump: Origin → Destination',next=>S.commitJump(next,{attemptId:prepared.attempt.id,elapsed:160}));};
 const source=fixture();source.ship.fuel=configureFuel(200,40,60,40,2);source.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}};const imported=jump(S.undoJump(jump(S.validate(source))));imported.revision=913;const unchanged=structuredClone(imported);assert.equal(imported.jumpAttempts.length,1);assert.equal(imported.jumpAttempts[0].rolls.length,2);assert.equal(imported.jumpAttempts[0].mulliganUsed,true);assert.equal(S.jumpUndoEligibility(imported).allowed,false);assert.throws(()=>S.undo(imported),/Mulligan used/);
 const h=setup();open(h,'import',imported);h.fill({backed:true});await h.submit();exact(h,imported,1);same(imported,unchanged);for(const key of ['jumpAttempts','events','undo','ledger','bank','ship','hours','actual'])same(h.persisted()[key],unchanged[key]);const bytes=h.bytes();await h.runAction('jump-undo');assert.match(ui(h).message,/Mulligan used/);await h.runAction('undo');assert.match(ui(h).message,/Mulligan used/);assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,1);
 const fresh=depositHarness(h.store.read(),{setTimeout:()=>0,clearTimeout(){}});assert.equal(fresh.bytes(),bytes);assert.equal(S.jumpUndoEligibility(fresh.api.state).allowed,false);await fresh.runAction('jump-undo');await fresh.runAction('undo');assert.equal(fresh.bytes(),bytes);assert.equal(fresh.counters.writes,0);same(fresh.api.state.jumpAttempts,unchanged.jumpAttempts);same(fresh.api.state.events,unchanged.events);same(fresh.api.state.undo,unchanged.undo);
});
