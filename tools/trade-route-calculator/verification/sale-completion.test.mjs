import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {campaign,core,bindings,attrs,element} from './app-harness.mjs';
import {S,same,ui,flush} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import * as A from '../js/amounts.mjs';

// Real app callbacks, controller, rules, state and Store in isolated synthetic
// storage. In-memory exposure/counting only: no copied production save body and
// no shared-harness edits. Native DOM, Web Locks and gestures are browser gates.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),storageURL=new URL('./deposit-save-harness.mjs',import.meta.url);
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const marker='store=new Store(receiveCampaign,',roleStart=app.indexOf(marker);assert.ok(roleStart>=0);
const roleCallback=app.slice(roleStart+marker.length).split(');try{state=store.read();}')[0];assert.ok(roleCallback.startsWith('(editable,text)=>'));
const absolutize=(source,url)=>source.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
function replace(source,from,to){assert.ok(source.includes(from),'Expected actual harness boundary '+from);return source.replace(from,to);}
let hs=absolutize(await readFile(harnessURL,'utf8'),harnessURL);
hs=replace(hs,'globalThis.api={setStore','globalThis.api={saleForm,completeSaleWrite,get saleQuotes(){return saleQuotes;},get saleTaxDice(){return saleTaxDice;},get editSale(){return editSale;},get selectedSet(){return selected;},setSelectedSet(value){selected=value;},setPreviewSale(value){previewSale=value;},roleChange:'+roleCallback+',setStore');
hs=replace(hs,'priceDice:0','priceDice:0,taxDice:0,previews:0,reprices:0');
hs=replace(hs,'die:()=>3','die:()=>{calls.taxDice++;return 3;},salePreview(...args){calls.previews++;return bindings.R.salePreview(...args);},repriceQuote(...args){calls.reprices++;return bindings.R.repriceQuote(...args);}');
const hm='data:text/javascript;base64,'+Buffer.from(hs).toString('base64');
let ss=absolutize(await readFile(storageURL,'utf8'),storageURL);ss=replace(ss,JSON.stringify(harnessURL.href),JSON.stringify(hm));
const {depositHarness}=await import('data:text/javascript;base64,'+Buffer.from(ss).toString('base64'));
const success=/Sale to Synthetic buyer saved\./;
function fixture({lots=1,fractional=false,tax=true,criminal=false,creditStep=1,huge=false,insurance=true}={}){
 const s=campaign();s.worlds[s.actual].uwp='A788879-C';s.bank=huge?'9007199254740993123456789':'1000000';s.settings={...s.settings,tax,insurance,profit:75,creditStep};
 const world=bindings.R.context(s.worlds[s.actual],core),options={skill:1,counterparty:2,local:false};
 s.snapshots=[{id:'buyer',kind:'buyer',worldId:s.actual,party:'synthetic|buyer',partyName:'Synthetic buyer',hours:0,startedHours:0,success:true,criminal,world,options,offers:[]}];
 s.lots=Array.from({length:lots},(_,i)=>({id:'sale-'+i,commodity:'11',description:'Synthetic cargo '+i,quantity:fractional&&i===0?'1.5':'3',basis:huge?'90071992547409931234567':'30001',goodsValue:huge?'90071992547409931234001':'27001',world:s.actual,hours:0}));
 if(insurance)s.policies=s.lots.map(l=>({id:'policy-'+l.id,lotId:l.id,claims:[],status:'active',initialQuantity:l.quantity,remainingQuantity:l.quantity,insuredValue:l.goodsValue,remainingValue:l.goodsValue,coverage:70,route:s.route,routeProgress:0,destination:s.route.at(-1)}));
 return S.validate(s);
}
function setup(saved=fixture()){
 const h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}}),form=h.dom.ids.get('modal-form'),query=form.querySelectorAll;
 form.querySelectorAll=selector=>selector==='input,select,textarea,button'?[...h.dom.fields().values(),...modalButtons(h),h.dom.ids.get('modal-submit'),h.dom.ids.get('modal-cancel')]:query(selector);
 h.store.onRole=(editable,text)=>{h.roles.push([editable,text]);h.hooks.onRole?.(editable,text);h.api.roleChange(editable,text);};return h;
}
function modalButtons(h){return [...h.dom.ids.get('modal-body').innerHTML.matchAll(/<button\b([^>]*)>/g)].map(m=>element(attrs(m[1])));}
function prepare(h,edits={}){h.api.setSelected(h.api.state.lots.map(l=>l.id));h.api.saleForm(h.api.state.snapshots.find(x=>x.kind==='buyer'));h.fill({fee:5,...edits});return h.submit();}
const preview=h=>structuredClone(h.api.previewSale);
const cache=h=>({quotes:[...h.api.saleQuotes],tax:[...h.api.saleTaxDice]});
const count=h=>({quotes:h.calls.quotes,priceDice:h.calls.priceDice,taxDice:h.calls.taxDice,previews:h.calls.previews,reprices:h.calls.reprices});
const body=h=>h.dom.ids.get('modal-body').innerHTML;
const display=h=>({summary:h.dom.ids.get('summary').innerHTML,main:h.dom.ids.get('main').innerHTML});
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
function noSuccess(h){assert.doesNotMatch(ui(h).message,success);}
function terminal(h){assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.dom.ids.get('takeover').disabled,true);assert.match(h.dom.ids.get('save-status').textContent,/reload/i);noSuccess(h);if(ui(h).modalOpen){assert.equal(ui(h).submitDisabled,true);assert.match(ui(h).modalError,/reload/i);}}
function canonical(state){const ids=new Map();return JSON.parse(JSON.stringify(state,(_key,value)=>{if(typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)){if(!ids.has(value))ids.set(value,'generated-'+ids.size);return ids.get(value);}return value;}));}
function exact(h,before,entry){same(h.persisted(),entry.args[0]);same(h.api.state,entry.args[0]);assert.equal(h.bytes(),JSON.stringify(entry.args[0]));assert.equal(h.persisted().revision,before.revision+1);assert.equal(h.persisted().undo.length,before.undo.length+1);assert.equal(h.counters.writes,1);assert.equal(entry.args[1],before.revision);assert.ok(entry.args[2]);assert.doesNotMatch(h.bytes(),/saveToken|replacementToken/);}
async function pending(t,h=setup(),edits={}){
 const before=structuredClone(h.api.state),raw=h.bytes();await prepare(h,edits);assert.equal(ui(h).modalTitle,'Confirm sale');assert.equal(ui(h).modalError,'');
 const p=preview(h),rounding=structuredClone(h.api.inputRounding),counts=count(h),cached=structuredClone(cache(h)),selection=h.api.selected,session=h.api.modalSession,review=body(h),gate=serviceSaveGate(h.store),detached=h.dom.ids.get('modal-form').onsubmit,operation=h.submit();
 await flush();assert.equal(gate.entries.length,1,'One production SALE COMMIT reached the delayed provider');
 t.after(async()=>{for(const e of gate.entries)if(!e.settled)e.fulfill();await operation;gate.restore();});return {h,before,raw,p,rounding,counts,cached,selection,session,review,gate,detached,operation};
}
function dispatch(h,name,arg=''){
 const b={disabled:false,dataset:{action:name,arg},closest:selector=>selector==='[data-action]'?b:null};h.dom.dispatch('click',b,{preventDefault(){}});return b;
}

for(const full of [false,true])test(`native synchronous ${full?'full':'partial'} sale publishes exact economics before returning and clears its own warning`,async()=>{
 const h=setup(),before=h.persisted();await prepare(h,{'qty_sale-0':full?3:1});const p=preview(h),counts=count(h);const operation=h.submit();assert.equal(h.counters.writes,1);assert.match(ui(h).message,success);assert.equal(ui(h).modalError,'');same(count(h),counts);await operation;assert.equal(ui(h).modalOpen,false);same(h.api.selected,[]);assert.equal(ui(h).modalError,'');assert.equal(h.persisted().bank,String(BigInt(before.bank)+BigInt(p.bankDelta)));assert.equal(h.persisted().lots.length,full?0:1);
 const fresh=setup(h.store.read());await fresh.runAction('undo');for(const key of ['bank','lots','ledger','policies','snapshots'])same(fresh.persisted()[key],before[key]);
});
for(const full of [false,true])test(`delayed ${full?'full':'partial'} sale retains selected IDs and the exact displayed review through publication and settlement`,async t=>{
 const {h,before,raw,p,selection,session,review,rounding,counts,cached,gate,operation}=await pending(t,setup(),{'qty_sale-0':full?3:1});
 const visible=display(h);assert.equal(h.bytes(),raw);same(h.api.selected,selection);assert.equal(session.busy,true);assert.equal(session.awaitSave,true);assert.equal(ui(h).submitDisabled,true);noSuccess(h);
 gate.entries[0].write();exact(h,before,gate.entries[0]);same(h.api.selected,selection);same(preview(h),p);same(cache(h),cached);same(count(h),counts);same(h.api.inputRounding,rounding);assert.equal(body(h),review);assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalOpen,true);noSuccess(h);same(display(h),visible);h.api.render();same(display(h),visible);same(h.api.selected,selection);
 gate.entries[0].fulfill();await operation;assert.equal(ui(h).modalOpen,false);same(h.api.selected,[]);assert.equal(ui(h).modalError,'');assert.match(ui(h).message,success);same(count(h),counts);
 const sync=setup(before);await prepare(sync,{'qty_sale-0':full?3:1});await sync.submit();same(canonical(h.persisted()),canonical(sync.persisted()));for(const observation of h.trace)assert.doesNotMatch(observation.message,success);
});
test('same-stack duplicate submit, Enter and detached submit never queue another sale',async t=>{
 const {h,gate,operation,detached}=await pending(t);await h.submit();h.dom.dispatch('keydown',{matches:()=>false},{key:'Enter',preventDefault(){}});await h.submit();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.counters.writes,0);gate.entries[0].fulfill();await operation;const raw=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);assert.equal(ui(h).modalError,'');
});
for(const action of ['Cancel','X','Escape','replacement','sale-edit','saleForm','beginSale','buyer-search','sale-clear','sale-all','lot-sell'])test(`pending sale rejects ${action} before editing, rerolling, clearing selection or replacing its review`,async t=>{
 const {h,gate,operation,session,review,counts,cached,selection}=await pending(t);
 if(action==='Cancel')h.dom.ids.get('modal-cancel').onclick();else if(action==='X')h.dom.ids.get('modal-close').onclick();else if(action==='Escape'){let prevented=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);}else if(action==='replacement')h.api.modal('Unrelated review','Must stay hidden',null);else if(action==='saleForm')h.api.saleForm(h.api.state.snapshots[0]);else if(action==='beginSale')h.api.beginSale();else await h.runAction(action,'sale-0');
 assert.equal(h.api.modalSession,session);assert.equal(body(h),review);same(h.api.selected,selection);same(cache(h),cached);same(count(h),counts);assert.equal(gate.entries.length,1);assert.equal(ui(h).modalOpen,true);noSuccess(h);gate.entries[0].fulfill();await operation;assert.equal(ui(h).modalError,'');
});
for(const releaseWhen of ['pending','settled'])for(const action of ['sale-edit','buyer-search','sale','world'])test(`pre-yield ${action} dispatch is stale when released after sale is ${releaseWhen}`,async()=>{
 const h=setup();await prepare(h);const initial=ui(h),beforeView=h.api.view;let release,calls=0;const waiting=new Promise(r=>release=r);h.api.services.action=()=>{calls++;return waiting;};dispatch(h,action,action==='world'?'1,0':'');assert.equal(calls,1);
 const gate=serviceSaveGate(h.store),operation=h.submit();await flush();assert.equal(gate.entries.length,1);const expectedReview=body(h),counts=count(h);gate.entries[0].write();if(releaseWhen==='settled'){gate.entries[0].fulfill();await operation;}release(false);await flush();assert.equal(h.api.view,beforeView);same(count(h),counts);assert.equal(ui(h).modalTitle,initial.modalTitle);if(releaseWhen==='pending'){assert.equal(body(h),expectedReview);gate.entries[0].fulfill();await operation;}assert.equal(ui(h).modalOpen,false);assert.equal(h.counters.writes,1);assert.equal(gate.entries.length,1);assert.equal(ui(h).modalError,'');gate.restore();
});
test('known prewrite failure retains the exact p, quote/tax dice, rounding, prices and selection for one deliberate retry',async t=>{
 const {h,raw,before,p,rounding,counts,cached,selection,session,review,gate,operation,detached}=await pending(t,setup(),{'qty_sale-0':1,'price_sale-0':'25000.1',reason:'Known referee price',fee:7});h.failNext();gate.entries[0].fulfill();await operation;
 assert.equal(h.bytes(),raw);same(h.api.state,before);same(preview(h),p);same(cache(h),cached);same(count(h),counts);same(h.api.selected,selection);same(h.api.inputRounding,rounding);assert.equal(h.api.modalSession,session);assert.equal(body(h),review);assert.equal(ui(h).submitDisabled,false);assert.equal(h.store.reloadRequired??false,false);assert.match(ui(h).modalError,/quota/i);noSuccess(h);
 const retry=h.submit();await detached(submitEvent(h));assert.equal(gate.entries.length,2);same(canonical(gate.entries[1].args[0]),canonical(gate.entries[0].args[0]));gate.entries[1].write();assert.match(ui(h).modalError,/quota/i);same(h.api.selected,selection);gate.entries[1].fulfill();await retry;assert.equal(h.counters.writes,1);same(count(h),counts);assert.equal(ui(h).modalError,'');assert.equal(ui(h).modalOpen,false);same(h.api.selected,[]);assert.match(ui(h).message,success);
});
for(const afterWrite of [false,true])test(`unknown rejection ${afterWrite?'after':'before'} sale publication is terminal and never retryable`,async t=>{
 const {h,raw,gate,operation,detached}=await pending(t);if(afterWrite)gate.entries[0].write();gate.entries[0].reject();await operation;terminal(h);assert.match(ui(h).message,afterWrite?/saved, but/:/outcome.*could not be confirmed/);if(!afterWrite)assert.equal(h.bytes(),raw);const bytes=h.bytes();await detached(submitEvent(h));await h.store.acquire(true);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);terminal(h);
});
for(const point of ['beforeNotify','afterNotify'])test(`sale durable ${point} fault remains saved/reload-only and reload Undo restores all economic records`,async t=>{
 const {h,before,gate,operation}=await pending(t);h.hooks[point]=()=>{throw Error('Injected '+point+' failure');};gate.entries[0].fulfill();await operation;terminal(h);assert.equal(h.counters.writes,1);assert.match(ui(h).message,/saved, but/);same(h.persisted(),gate.entries[0].args[0]);const fresh=setup(h.store.read());await fresh.runAction('undo');for(const key of ['bank','lots','policies','ledger','snapshots'])same(fresh.persisted()[key],before[key]);
});
for(const publication of ['missing','missing token','wrong token','wrong revision'])test(`sale fulfillment with ${publication} publication fails closed`,async t=>{
 const {h,gate,operation}=await pending(t);if(publication==='missing')h.store.onChange=()=>{};else h.hooks.beforeNotify=(next,metadata)=>{if(publication==='missing token')delete metadata.saveToken;else if(publication==='wrong token')metadata.saveToken={};else next.revision++;};gate.entries[0].fulfill();await operation;terminal(h);assert.equal(h.counters.writes,1);assert.match(ui(h).message,/outcome.*could not be confirmed/);await h.submit();assert.equal(gate.entries.length,1);
});
test('observed sale publication outranks contradictory not-committed rejection',async t=>{const {h,gate,operation}=await pending(t);gate.entries[0].write();gate.entries[0].reject(Object.assign(Error('Contradictory prewrite claim'),{code:'SAVE_NOT_COMMITTED',committed:false}));await operation;terminal(h);assert.match(ui(h).message,/saved, but/);assert.equal(h.counters.writes,1);});
for(const when of ['before','after'])test(`foreign same-revision publication ${when} sale publication permanently retires old selection cleanup`,async t=>{
 const {h,gate,operation}=await pending(t);if(when==='after')gate.entries[0].write();h.external(structuredClone(h.persisted()));if(when==='before')gate.entries[0].write();h.api.setSelected(['newer-selection']);h.api.setView('1,0');gate.entries[0].fulfill();await operation;noSuccess(h);same(h.api.selected,['newer-selection']);assert.equal(h.api.view,'1,0');assert.equal(h.counters.writes,1);assert.equal(ui(h).submitDisabled,true);
});
for(const publish of [false,true])test(`newer ${publish?'published':'disk-only'} campaign revision cannot be overwritten by an old pending sale`,async t=>{
 const {h,gate,operation,detached}=await pending(t);h.external(S.transition(h.persisted(),'External deposit',s=>S.deposit(s,7,'New owner')),{publish});const bytes=h.bytes();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,0);noSuccess(h);gate.restore();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,0);assert.equal(h.store.reloadRequired??false,false);
});
for(const afterWrite of [false,true])test(`editing loss/regain afterWrite=${afterWrite} permanently retires that sale owner`,async t=>{
 const {h,gate,operation,detached}=await pending(t);if(afterWrite)gate.entries[0].write();h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');if(!afterWrite)gate.entries[0].write();h.api.setSelected(['newer-selection']);gate.entries[0].fulfill();await operation;noSuccess(h);same(h.api.selected,['newer-selection']);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('modal-cancel').disabled,false);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});
for(const knownFailure of [false,true])test(`native close preserves a newer dialog and selection after old sale ${knownFailure?'failure':'completion'}`,async t=>{
 const {h,gate,operation,detached}=await pending(t,setup(),{'qty_sale-0':1}),dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer review','Preserve this content',null);h.api.setSelected(['sale-0']);const session=h.api.modalSession;if(knownFailure)h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalTitle,'Newer review');assert.equal(ui(h).modalOpen,true);assert.equal(body(h),'Preserve this content');assert.equal(ui(h).modalError,'');same(h.api.selected,['sale-0']);noSuccess(h);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);
});
for(const fault of ['close before','close after','render','success reporting','terminal reporting','owned error clear','selection cleanup','control cleanup'])test(`sale ${fault} fault is observed and leaves the committed sale reload-only`,async t=>{
 const {h,gate,operation}=await pending(t);let faults=0;const dialog=h.dom.ids.get('modal');
 if(fault.startsWith('close')){const close=dialog.close;dialog.close=function(){if(faults++)return close.call(this);if(fault==='close after'){close.call(this);dialog.dispatch('close');}throw Error('Injected sale '+fault+' failure');};}
 else if(fault==='render'){const main=h.dom.ids.get('main');let html=main.innerHTML;Object.defineProperty(main,'innerHTML',{get:()=>html,set(next){if(gate.entries[0].settled&&!faults++)throw Error('Injected sale render failure');html=next;}});}
 else if(fault==='owned error clear'){const error=h.dom.ids.get('modal-error');let text=error.textContent;Object.defineProperty(error,'textContent',{get:()=>text,set(next){if(!faults&&gate.entries[0].settled&&next===''){faults++;throw Error('Injected sale owned error clear failure');}text=next;}});}
 else if(fault==='selection cleanup'){h.api.selectedSet.clear=()=>{faults++;throw Error('Injected selection cleanup failure');};}
 else if(fault==='control cleanup'){h.hooks.afterNotify=()=>{throw Error('Injected published-save display fault');};const submit=h.dom.ids.get('modal-submit');let disabled=submit.disabled;Object.defineProperty(submit,'disabled',{get:()=>disabled,set(next){if(gate.entries[0].settled&&!faults++){throw Error('Injected sale control cleanup failure');}disabled=next;}});}
 else{const message=h.dom.ids.get('message');let text=message.textContent;Object.defineProperty(message,'textContent',{get:()=>text,set(next){if(!faults&&((fault==='success reporting'&&success.test(next))||(fault==='terminal reporting'&&/Reload/.test(next)))){faults++;throw Error('Injected sale reporting failure');}text=next;}});}
 if(fault==='terminal reporting'){gate.entries[0].write();gate.entries[0].reject();}else gate.entries[0].fulfill();await operation;assert.ok(faults,'The exact requested fault boundary was reached');assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.counters.writes,1);assert.match(h.dom.ids.get('save-status').textContent,/Reload/);same(h.persisted(),gate.entries[0].args[0]);if(fault==='owned error clear')assert.match(ui(h).message,/saved, but/);const bytes=h.bytes();await h.submit();assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

test('known-unsaved retry remains valid after a benign background render with identical selected IDs',async t=>{
 const {h,raw,p,counts,cached,rounding,selection,gate,operation}=await pending(t,setup(),{'qty_sale-0':1,'price_sale-0':25000,reason:'Retained price'});h.failNext();gate.entries[0].fulfill();await operation;h.api.render();same(h.api.selected,selection);same(preview(h),p);same(cache(h),cached);same(count(h),counts);same(h.api.inputRounding,rounding);assert.equal(h.bytes(),raw);
 const retry=h.submit();await flush();assert.equal(gate.entries.length,2);gate.entries[1].fulfill();await retry;assert.equal(h.counters.writes,1);assert.equal(ui(h).modalError,'');assert.equal(ui(h).modalOpen,false);same(count(h),counts);
});
test('prewrite validation uses the captured preview and revision, remains editable, then correct retry clears warning',async()=>{
 const h=setup();await prepare(h);const counts=count(h),original=h.api.previewSale.lines[0].quantity;h.api.previewSale.lines[0].quantity='999';const gate=serviceSaveGate(h.store),raw=h.bytes();await h.submit();assert.equal(gate.entries.length,0);assert.equal(h.bytes(),raw);assert.match(ui(h).modalError,/stale|quantity/i);assert.equal(ui(h).submitDisabled,false);assert.equal(h.store.reloadRequired??false,false);
 h.api.previewSale.lines[0].quantity=original;h.api.setPreviewSale({revision:999,lines:[]});const retry=h.submit();assert.equal(gate.entries.length,1,'Submission uses the confirmation-owned p and revision rather than mutable previewSale');gate.entries[0].fulfill();await retry;assert.equal(h.counters.writes,1);same(count(h),counts);assert.equal(ui(h).modalError,'');assert.equal(ui(h).modalOpen,false);gate.restore();
});
test('throwing prewrite confirmation control freeze is known-unsaved and exact retry stays warning-free',async()=>{
 const h=setup();await prepare(h);const form=h.dom.ids.get('modal-form'),query=form.querySelectorAll,raw=h.bytes(),p=preview(h),counts=count(h);let faults=0,disabled=false;
 const control={get disabled(){return disabled;},set disabled(value){if(value&&!faults++){throw Error('Injected sale input freeze failure');}disabled=value;}};form.querySelectorAll=selector=>selector==='[data-round]'?query(selector):[control];const gate=serviceSaveGate(h.store);await h.submit();assert.equal(faults,1);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,0);assert.equal(h.store.reloadRequired??false,false);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/freeze failure/);same(preview(h),p);same(count(h),counts);form.querySelectorAll=query;
 const retry=h.submit();assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await retry;assert.equal(h.counters.writes,1);assert.equal(ui(h).modalError,'');same(count(h),counts);gate.restore();
});
for(const cause of ['cancel','replacement','foreign','editor'])test(`unsubmitted sale review is inert after ${cause} and cannot clear a newer selection`,async()=>{
 const h=setup();await prepare(h);const detached=h.dom.ids.get('modal-form').onsubmit,raw=h.bytes();if(cause==='cancel')h.api.closeModal();else if(cause==='replacement')h.api.modal('Replacement','Newer content',null);else if(cause==='foreign')h.external(structuredClone(h.persisted()));else{h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');}h.api.setSelected(['newer-selection']);await detached(submitEvent(h));assert.equal(h.bytes(),raw);same(h.api.selected,['newer-selection']);assert.equal(h.counters.writes,0);noSuccess(h);
});

// Existing Stage 2 cache promises only. Cancellation/reopening retains eligible
// price rolls. Edits rerun the preview but consume only missing tax faces.
// Other buyers replace per-lot price caches; revision changes invalidate them.
test('cancel, reopen, edit, retry and ordinary revision invalidation retain the existing explicit quote/tax call counts',async()=>{
 const h=setup(),buyer=h.api.state.snapshots[0];h.api.setSelected(['sale-0']);h.api.saleForm(buyer);same(count(h),{quotes:1,priceDice:3,taxDice:0,previews:0,reprices:0});const quoted=structuredClone(h.api.currentQuote('sale-0'));
 h.api.closeModal();h.api.saleForm(buyer);same(count(h),{quotes:1,priceDice:3,taxDice:0,previews:0,reprices:0});h.fill({'qty_sale-0':1,'price_sale-0':25000,reason:'Tax bracket proof',fee:0});await h.submit();same(count(h),{quotes:1,priceDice:3,taxDice:1,previews:1,reprices:0});assert.deepEqual(h.api.previewSale.tax.dice.dice,[3]);
 h.api.actions['sale-edit']();assert.equal(h.dom.fields().get('price_sale-0').value,'25000');h.fill({'qty_sale-0':3});await h.submit();same(count(h),{quotes:1,priceDice:3,taxDice:2,previews:2,reprices:0});assert.deepEqual(h.api.previewSale.tax.dice.dice,[3,3]);
 h.api.actions['sale-edit']();h.fill({'qty_sale-0':1});await h.submit();same(count(h),{quotes:1,priceDice:3,taxDice:2,previews:3,reprices:0});same(h.api.currentQuote('sale-0'),quoted);const p=preview(h),cached=structuredClone(cache(h)),gate=serviceSaveGate(h.store);h.failNext();const first=h.submit();gate.entries[0].fulfill();await first;const retry=h.submit();gate.entries[1].fulfill();await retry;gate.restore();same(count(h),{quotes:1,priceDice:3,taxDice:2,previews:3,reprices:0});same(cache(h),cached);same(preview(h),p);assert.equal(ui(h).modalError,'');assert.equal(h.api.currentQuote('sale-0'),null,'Saved revision invalidates eligible quotes without a Stage 3 cache redesign');
 await h.runAction('undo');h.api.setSelected(['sale-0']);h.api.saleForm(h.api.state.snapshots[0]);same(count(h),{quotes:2,priceDice:6,taxDice:2,previews:3,reprices:0});h.fill({'qty_sale-0':1,'price_sale-0':25000,reason:'New revision tax',fee:0});await h.submit();same(count(h),{quotes:2,priceDice:6,taxDice:3,previews:4,reprices:0});
});
test('buyer changes, editor handoff, modal replacement and actual-world changes preserve only existing cache eligibility',async()=>{
 const s=fixture();s.snapshots.push({...structuredClone(s.snapshots[0]),id:'buyer-two',party:'second',partyName:'Second buyer'});const h=setup(s),[first,second]=h.api.state.snapshots;h.api.setSelected(['sale-0']);h.api.saleForm(first);h.api.closeModal();h.api.saleForm(second);h.api.closeModal();h.api.saleForm(first);assert.equal(h.calls.quotes,3);assert.equal(h.calls.priceDice,9,'Returning to an earlier buyer is allowed to replace and reroll the per-lot quote');
 h.fill({'qty_sale-0':1,'price_sale-0':25000,reason:'Buyer tax'});await h.submit();assert.equal(h.calls.taxDice,1);h.api.modal('Unrelated','No cache clearing',null);h.api.closeModal();h.api.saleForm(first);assert.equal(h.calls.quotes,3);h.fill({'qty_sale-0':1,'price_sale-0':25000,reason:'Reopened'});await h.submit();assert.equal(h.calls.taxDice,1);
 h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');h.api.closeModal();h.api.saleForm(first);assert.equal(h.calls.quotes,3,'Editor loss invalidates the owner, not eligible quote caches');h.fill({'qty_sale-0':1,'price_sale-0':25000,reason:'New owned review'});await h.submit();assert.equal(h.calls.taxDice,1);
 h.api.closeModal();const moved=structuredClone(h.api.state);moved.actual='1,0';h.external(moved);assert.equal(h.api.currentQuote('sale-0'),null,'Actual world remains part of quote eligibility');
});

defineEconomics();
function defineEconomics(){
 const scenarios=[
  {name:'partial insured lot with fee, automatic tax and retained profit',options:{},edits:{'qty_sale-0':1,'price_sale-0':25000,fee:10,reason:'Explicit fixture'},expected:{gross:'25000',basis:'10000',goods:'9000',fee:'2500',tax:'150',adjustment:'-3087',bank:'19263',quantity:'2',basisLeft:'20001',goodsLeft:'18001',taxCalls:1}},
  {name:'full insured lot',options:{},edits:{'price_sale-0':25000,fee:10,reason:'Explicit fixture'},expected:{gross:'75000',basis:'30001',fee:'7500',tax:'900',adjustment:'-9149',bank:'57451',quantity:'0',taxCalls:2}},
  {name:'full fractional stock preserves its exact remaining quantity',options:{fractional:true,tax:false},edits:{'price_sale-0':25000,fee:10,reason:'Explicit fixture'},expected:{gross:'37500',basis:'30001',fee:'3750',tax:'0',adjustment:'-937',bank:'32813',quantity:'0',taxCalls:0}},
  {name:'manual tax uses no generated tax dice',options:{},edits:{'qty_sale-0':1,'price_sale-0':25000,taxRate:11,fee:10,reason:'Explicit fixture'},expected:{gross:'25000',basis:'10000',fee:'2500',tax:'550',adjustment:'-2987',bank:'18963',quantity:'2',taxCalls:0}},
  {name:'disabled tax uses no generated tax dice',options:{tax:false},edits:{'qty_sale-0':1,'price_sale-0':25000,fee:10,reason:'Explicit fixture'},expected:{gross:'25000',basis:'10000',fee:'2500',tax:'0',adjustment:'-3125',bank:'19375',quantity:'2',taxCalls:0}},
  {name:'criminal buyer remains tax-exempt',options:{criminal:true},edits:{'qty_sale-0':1,'price_sale-0':25000,fee:10,reason:'Explicit fixture'},expected:{gross:'25000',basis:'10000',fee:'2500',tax:'0',adjustment:'-3125',bank:'19375',quantity:'2',taxCalls:0}},
  {name:'hundred-credit rounding retains exact review rounding',options:{tax:false,creditStep:100},edits:{'qty_sale-0':1,'price_sale-0':'25000.1',fee:7,reason:'Explicit fixture'},expected:{gross:'25100',basis:'10000',fee:'1800',tax:'0',adjustment:'-3300',bank:'20000',quantity:'2',taxCalls:0}},
  {name:'multiple lots retain distinct basis and policy reductions',options:{lots:2},edits:{'qty_sale-0':1,'qty_sale-1':2,'price_sale-0':25000,'price_sale-1':27000,fee:10,reason:'Explicit fixture'}},
  {name:'local-ban repricing retains natural dice without reroll',options:{criminal:true},edits:{'qty_sale-0':1,'ban_sale-0':2,fee:0,reason:'Local ban fixture'}},
  {name:'very large credit strings remain beyond floating-point precision',options:{huge:true,tax:false},edits:{'qty_sale-0':1,'price_sale-0':'90071992547409931234567',fee:0,reason:'Exact huge fixture'}}
 ];
 for(const delayed of [false,true])for(const scenario of scenarios)test(`${delayed?'delayed':'synchronous'} economic fixture: ${scenario.name}`,async()=>{
  const h=setup(fixture(scenario.options)),before=h.persisted();await prepare(h,scenario.edits);assert.equal(ui(h).modalError,'');const p=preview(h),counts=count(h),rounding=structuredClone(h.api.inputRounding),gate=delayed?serviceSaveGate(h.store):null;const result=h.submit();if(gate){assert.equal(gate.entries.length,1);gate.entries[0].write();same(h.api.inputRounding,rounding);gate.entries[0].fulfill();}await result;gate?.restore();const saved=h.persisted();assert.equal(h.counters.writes,1);assert.equal(ui(h).modalError,'');assert.equal(saved.bank,String(BigInt(before.bank)+BigInt(p.bankDelta)));same(count(h),counts);assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length+1);
  const sales=saved.ledger.filter(e=>e.type==='Sale');assert.equal(sales.length,p.lines.length);
  for(const [i,line]of p.lines.entries()){
   const lot=before.lots.find(l=>l.id===line.lotId),remaining=saved.lots.find(l=>l.id===line.lotId),policy=saved.policies.find(x=>x.lotId===line.lotId),full=A.cmp(lot.quantity,line.quantity)===0;
   assert.equal(sales[i].amount,line.gross);same(sales[i].audit,{...line,commodity:lot.commodity,profitPercent:p.options.percent});
   for(const [type,amount]of [['Broker fee',String(-BigInt(line.fee))],['Tax',String(-BigInt(line.tax))],['Profit adjustment',line.adjustment]]){const record=saved.ledger.find(e=>e.type===type&&e.lotId===line.lotId);if(BigInt(amount)!==0n)assert.equal(record?.amount,amount);else assert.equal(record,undefined);}
   if(full){assert.equal(remaining,undefined);assert.equal(policy?.remainingQuantity,'0');assert.equal(policy?.remainingValue,'0');assert.equal(policy?.status,'closed');}
   else{assert.equal(remaining.quantity,A.decimal(A.sub(lot.quantity,line.quantity)));assert.equal(remaining.basis,String(BigInt(lot.basis)-BigInt(line.basis)));const value=String(BigInt(lot.goodsValue)-A.floor(A.mul(lot.goodsValue,A.div(line.quantity,lot.quantity))));assert.equal(remaining.goodsValue,value);assert.equal(policy.remainingQuantity,remaining.quantity);assert.equal(policy.remainingValue,value);assert.equal(policy.status,'active');}
  }
  if(scenario.expected){const expected=scenario.expected,line=p.lines[0];for(const key of ['gross','basis','fee','tax','adjustment'])assert.equal(line[key],expected[key],key+' has its independent expected value');assert.equal(p.bankDelta,expected.bank);assert.equal(h.calls.taxDice,expected.taxCalls);if(expected.basisLeft)assert.equal(saved.lots[0].basis,expected.basisLeft);if(expected.goodsLeft)assert.equal(saved.lots[0].goodsValue,expected.goodsLeft);}
  if(scenario.name.startsWith('local-ban')){assert.equal(h.calls.reprices,1);assert.equal(h.calls.quotes,1);assert.equal(h.calls.priceDice,3);assert.equal(p.lines[0].audit.sale.localIllegalDM,7);same(p.lines[0].audit.dice,h.api.saleQuotes.get('sale-0').audit.dice);}
  if(delayed){const sync=setup(before);await prepare(sync,scenario.edits);await sync.submit();same(canonical(saved),canonical(sync.persisted()),'The delayed completion preserves the complete canonical synchronous campaign');}
  if(scenario.options.huge){assert.ok(BigInt(saved.bank)>BigInt(Number.MAX_SAFE_INTEGER));assert.equal(p.lines[0].unitPrice,'90071992547409931234567');}
  for(const key of ['hours','actual','route','routeIndex','snapshots','contracts','trader','settings','ship'])same(saved[key],before[key]);assert.match(h.api.historyPanel(),/Sale to Synthetic buyer/);h.api.ledgerAudit(sales[0].id);assert.match(body(h),/Synthetic cargo/);h.api.closeModal();const fresh=setup(h.store.read());await fresh.runAction('undo');for(const key of ['bank','lots','policies','ledger','snapshots','contracts'])same(fresh.persisted()[key],before[key]);
 });
}
test('sale failure and terminal-reporting paths have no unhandled rejection',async()=>{
 const unhandled=[],listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);try{for(const committed of [false,true]){const h=setup();await prepare(h);const gate=serviceSaveGate(h.store),operation=h.submit();if(committed)gate.entries[0].write();gate.entries[0].reject();await operation;await flush();terminal(h);gate.restore();}await flush();assert.deepEqual(unhandled,[]);}finally{process.off('unhandledRejection',listener);}
});

test('first submit-control freeze failure leaves no write or unhandled rejection and permits exact retry',async()=>{
 const h=setup();await prepare(h);const raw=h.bytes(),p=preview(h),cached=structuredClone(cache(h)),counts=count(h),submit=h.dom.ids.get('modal-submit');let failures=0,disabled=submit.disabled;
 Object.defineProperty(submit,'disabled',{get:()=>disabled,set(next){if(next&&!failures++){throw Error('Injected initial sale submit lock failure');}disabled=next;}});const gate=serviceSaveGate(h.store);await h.submit();assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,0);assert.equal(h.api.modalSession.busy,false);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/initial sale submit lock/);same(preview(h),p);same(cache(h),cached);same(count(h),counts);
 const retry=h.submit();assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await retry;assert.equal(h.counters.writes,1);assert.equal(ui(h).modalError,'');assert.equal(ui(h).modalOpen,false);same(count(h),counts);gate.restore();
});
for(const newerRevision of [false,true])test(`foreign ${newerRevision?'newer':'same'} publication plus typed known-unsaved result retires the old sale without global terminalizing`,async t=>{
 const {h,gate,operation,detached}=await pending(t),next=newerRevision?S.transition(h.persisted(),'Other deposit',s=>S.deposit(s,9,'Different owner')):structuredClone(h.persisted());h.external(next);const bytes=h.bytes();gate.entries[0].reject(Object.assign(Error('Typed known-unsaved stale sale'),{code:'SAVE_NOT_COMMITTED',committed:false}));await operation;assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,0);assert.equal(h.store.reloadRequired??false,false);assert.equal(h.store.editable,true);assert.equal(ui(h).submitDisabled,true);noSuccess(h);await detached(submitEvent(h));assert.equal(gate.entries.length,1);
});
for(const point of ['clear warning','native close'])test(`newer modal and selection created during sale ${point} are preserved without old success announcement`,async t=>{
 const {h,gate,operation}=await pending(t,setup(),{'qty_sale-0':1});let switched=0;
 const replaceUI=()=>{if(switched++)return;const dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer result','Preserve newer controls',null);h.api.setSelected(['sale-0']);};
 if(point==='clear warning'){const error=h.dom.ids.get('modal-error');let text=error.textContent;Object.defineProperty(error,'textContent',{get:()=>text,set(next){text=next;if(gate.entries[0].settled&&next===''&&!switched)replaceUI();}});}
 else{const dialog=h.dom.ids.get('modal'),close=dialog.close;dialog.close=function(){close.call(this);dialog.dispatch('close');if(!switched){switched++;h.api.modal('Newer result','Preserve newer controls',null);h.api.setSelected(['sale-0']);}};}
 gate.entries[0].fulfill();await operation;assert.ok(switched);assert.equal(h.counters.writes,1);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).modalTitle,'Newer result');assert.equal(body(h),'Preserve newer controls');assert.equal(ui(h).modalError,'');same(h.api.selected,['sale-0']);noSuccess(h);
});
for(const committed of [false,true])test(`throwing role reporter cannot unlatch sale terminal safety, committed=${committed}`,async t=>{
 const {h,gate,operation,detached}=await pending(t);if(committed)gate.entries[0].write();h.hooks.onRole=()=>{throw Error('Injected sale onRole reporter failure');};gate.entries[0].reject();await operation;terminal(h);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);assert.equal(h.counters.writes,Number(committed));
});

test('synchronous publication reentrancy preserves newer dialog, real selection and newer rounding ownership',async()=>{
 const h=setup();await prepare(h,{'qty_sale-0':1,'price_sale-0':'25000.1',reason:'Rounded owned sale'});const previous=structuredClone(h.api.inputRounding),newRounding=[{label:'Newer referee credits',before:'17.1',after:'18',kind:'credits',step:1}];assert.ok(previous.length);
 h.hooks.beforeNotify=()=>{const dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer rounding review','Keep newer contents',null);h.api.setSelected(['sale-0']);h.api.setInputRounding(newRounding);};const result=h.submit();assert.equal(h.counters.writes,1);await result;assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).modalTitle,'Newer rounding review');assert.equal(body(h),'Keep newer contents');assert.equal(ui(h).modalError,'');same(h.api.selected,['sale-0']);same(h.api.inputRounding,newRounding);noSuccess(h);
});

test('raw production SALE COMMIT callback keeps the native non-Promise completion contract',async()=>{
 const h=setup();await prepare(h);const result=h.api.completeSaleWrite(h.api.modalSession.saleOwner);assert.notEqual(typeof result?.then,'function');assert.equal(h.counters.writes,1);assert.equal(ui(h).modalOpen,false);assert.equal(ui(h).modalError,'');assert.match(ui(h).message,success);
});
test('fulfilled provider without any durable write or expected publication requires reload',async()=>{
 const h=setup();await prepare(h);const raw=h.bytes();h.store.save=()=>Promise.resolve(undefined);await h.submit();terminal(h);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.match(ui(h).message,/outcome.*could not be confirmed/);
});
test('synchronous known-unsaved sale stays retryable and does not regenerate its review',async()=>{
 const h=setup();await prepare(h,{'qty_sale-0':1,'price_sale-0':25000,reason:'Exact retry'});const raw=h.bytes(),p=preview(h),counts=count(h),cached=structuredClone(cache(h));h.failNext();await h.submit();assert.equal(h.bytes(),raw);assert.match(ui(h).modalError,/quota/);assert.equal(ui(h).submitDisabled,false);same(preview(h),p);same(count(h),counts);same(cache(h),cached);await h.submit();assert.equal(h.counters.writes,1);assert.equal(ui(h).modalError,'');same(count(h),counts);
});
test('known-unsaved sale permits the existing edit/cancel/reopen loop while reusing eligible price and tax dice',async()=>{
 const h=setup();await prepare(h,{'qty_sale-0':1,'price_sale-0':25000,reason:'Retained typed price',fee:7});const p=preview(h);h.failNext();await h.submit();h.api.actions['sale-edit']();assert.match(ui(h).modalTitle,/Prepare sale/);assert.equal(h.dom.fields().get('price_sale-0').value,'25000');assert.equal(h.dom.fields().get('qty_sale-0').value,'1');assert.equal(h.dom.fields().get('fee').value,'7');h.fill({fee:8});await h.submit();assert.equal(h.calls.quotes,1);assert.equal(h.calls.priceDice,3);assert.equal(h.calls.taxDice,1);assert.equal(h.calls.previews,2);assert.notEqual(h.api.previewSale.fee,p.fee);h.api.closeModal();h.api.beginSale();assert.equal(h.calls.quotes,1);assert.equal(h.calls.taxDice,1);assert.equal(h.counters.writes,0);assert.equal(ui(h).modalError,'');
});
test('known-unsaved control restoration failure latches reload before reporting and blocks all retry',async t=>{
 const {h,raw,gate,operation,detached}=await pending(t),submit=h.dom.ids.get('modal-submit');let faults=0,disabled=submit.disabled;Object.defineProperty(submit,'disabled',{get:()=>disabled,set(next){if(!next&&!faults++){throw Error('Injected unsaved control restore failure');}disabled=next;}});h.failNext();gate.entries[0].fulfill();await operation;assert.ok(faults);terminal(h);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);await detached(submitEvent(h));assert.equal(gate.entries.length,1);
});
for(const afterWrite of [false,true])test(`newer real selection alone afterWrite=${afterWrite} is never cleared by stale sale completion`,async t=>{
 const {h,gate,operation}=await pending(t,setup(fixture({lots:2})),{'qty_sale-0':1,'qty_sale-1':1});if(afterWrite)gate.entries[0].write();h.api.setSelected(['sale-1']);gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);same(h.api.selected,['sale-1']);assert.equal(ui(h).submitDisabled,true);noSuccess(h);
});
