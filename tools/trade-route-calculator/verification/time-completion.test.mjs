import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {S,same,ui,flush} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {guiFixture} from './fixtures/gui-parity.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {supportAmount,supportStock} from '../js/life-support.mjs';
import {cmp} from '../js/amounts.mjs';
import {displayDate} from '../js/calendar.mjs';

// Actual production app/controller/state/Store, isolated synthetic storage and
// the established DOM double. The companion Chromium suite owns native DOM,
// pointer/keyboard/Enter, Settings mounting and real Web Locks. Expose production
// callbacks in memory; do not copy save bodies or change the shared harness.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),storageURL=new URL('./deposit-save-harness.mjs',import.meta.url);
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const marker='store=new Store(receiveCampaign,',roleStart=app.indexOf(marker);assert.ok(roleStart>=0);
const roleCallback=app.slice(roleStart+marker.length).split(');try{state=store.read();}')[0];assert.ok(roleCallback.startsWith('(editable,text)=>'));
const absolutize=(source,url)=>source.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
function replace(source,from,to){assert.ok(source.includes(from),'Expected existing harness boundary '+from);return source.replace(from,to);}
let harnessSource=absolutize(await readFile(harnessURL,'utf8'),harnessURL);
harnessSource=replace(harnessSource,'globalThis.api={setStore','globalThis.api={changeCampaignDay,timeForm,campaignTimeCounter,lifeSupportCounter,get timeOperation(){return timeWriteOperation;},roleChange:'+roleCallback+',setStore');
const harnessModule='data:text/javascript;base64,'+Buffer.from(harnessSource).toString('base64');
let storageSource=absolutize(await readFile(storageURL,'utf8'),storageURL);
storageSource=replace(storageSource,JSON.stringify(harnessURL.href),JSON.stringify(harnessModule));
const {depositHarness}=await import('data:text/javascript;base64,'+Buffer.from(storageSource).toString('base64'));
const reason='Verified referee time correction';
const paths=['forward','back','form'];
const success=/Time (?:advanced|correction)[\s\S]* saved\./;
function fixture({hours=47,date='365-1105',stock='legacy',awake=1,frozen=1}={}){
 const s=guiFixture().state;s.hours=hours;s.dateLabel=date;
 s.ship.accommodation={rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:awake,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:frozen,luggageTons:'0'};
 if(stock==='legacy')s.ship.lifeSupport={capacityHours:672,remainingHours:336,elapsedHours:6};
 else if(stock==='untracked')delete s.ship.lifeSupport;
 else s.ship.lifeSupport={capacityHours:672,stockUnits:stock};
 s.contracts.push({id:'time-mail',kind:'mail',status:'accepted',origin:s.actual,destination:s.route[4],quantity:'2',payment:'9007199254740993',dueHours:null,firstDeparture:null,audit:{manual:true,reason:'Saved mail terms'}});
 s.policies=[{id:'time-policy',lotId:'lot-opening',claims:[],status:'active',initialQuantity:'2',remainingQuantity:'2',insuredValue:'2000',remainingValue:'2000',coverage:70,route:s.route.slice(s.routeIndex),routeProgress:0,destination:s.route.at(-1)}];
 return S.validate(s);
}
function setup(saved=fixture()){
 const h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}});
 const form=h.dom.ids.get('modal-form'),query=form.querySelectorAll;
 form.querySelectorAll=selector=>selector==='input,select,textarea,button'?[...h.dom.fields().values(),h.dom.ids.get('modal-submit'),h.dom.ids.get('modal-cancel')]:query(selector);
 h.store.onRole=(editable,text)=>{h.roles.push([editable,text]);h.hooks.onRole?.(editable,text);h.api.roleChange(editable,text);};
 h.api.setTab('Overview');h.api.render();return h;
}
function open(h,edits={}){h.api.actions.time();h.fill({date:h.api.state.dateLabel,hours:h.api.state.hours+25,reason,...edits});assert.equal(ui(h).modalTitle,'Campaign time');}
function begin(h,path,edits={}){if(path==='form'){open(h,edits);return h.submit();}return h.runAction(path==='forward'?'day-forward':'day-back');}
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
function semanticUI(h){return {summary:h.dom.ids.get('summary').innerHTML,shipActions:h.dom.ids.get('ship-actions').innerHTML};}
function noSuccess(h){assert.doesNotMatch(ui(h).message,success);}
function terminal(h){assert.equal(h.store.editable,false);assert.equal(h.store.reloadRequired,true);assert.equal(h.dom.ids.get('takeover').disabled,true);assert.match(h.dom.ids.get('save-status').textContent,/reload/i);noSuccess(h);if(ui(h).modalOpen){assert.equal(ui(h).submitDisabled,true);assert.match(ui(h).modalError,/reload/i);}}
function unchanged(saved,before){for(const key of ['bank','ledger','lots','contracts','policies','snapshots','route','routeIndex','actual','dashboardBaseline','cooldowns','trader','settings'])same(saved[key],before[key]);for(const key of ['name','capacity','fuel','accommodation','jump','armed','scoops'])same(saved.ship[key],before.ship[key]);}
function exact(h,before,entry){same(h.persisted(),entry.args[0]);same(h.api.state,entry.args[0]);assert.equal(h.bytes(),JSON.stringify(entry.args[0]));assert.equal(h.persisted().revision,before.revision+1);assert.equal(h.persisted().undo.length,before.undo.length+1);assert.equal(h.persisted().events.length,before.events.length+1);assert.equal(h.counters.writes,1);assert.equal(entry.args[1],before.revision);assert.ok(entry.args[2]);assert.doesNotMatch(h.bytes(),/saveToken|replacementToken/);unchanged(h.persisted(),before);}
function canonical(state){const ids=new Map();return JSON.parse(JSON.stringify(state,(_key,value)=>{if(typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)){if(!ids.has(value))ids.set(value,'generated-'+ids.size);return ids.get(value);}return value;}));}
function exactStock(s,n,d=1){assert.equal(cmp(supportAmount(s.ship.lifeSupport.stockUnits),{n:BigInt(n),d:BigInt(d)}),0);}
async function pending(t,path='form',h=setup(),edits={}){
 const before=structuredClone(h.api.state),raw=h.bytes(),gate=serviceSaveGate(h.store);const operation=begin(h,path,edits);await flush();
 assert.equal(gate.entries.length,1,'One actual production write reaches the delayed provider');const session=h.api.modalSession,detached=h.dom.ids.get('modal-form').onsubmit;
 t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 return {h,path,before,raw,gate,operation,session,detached};
}
function dispatchDay(h,path='forward'){
 const b={disabled:false,dataset:{action:path==='forward'?'day-forward':'day-back',arg:''},closest:selector=>selector==='[data-action]'?b:null};
 h.dom.dispatch('click',b,{preventDefault(){}});return b;
}

for(const path of paths)test(`native synchronous ${path} immediately preserves time/economics and ordinary revision/event/Undo`,async()=>{
 const h=setup(),before=h.persisted(),result=begin(h,path);assert.equal(h.counters.writes,1);assert.equal(h.persisted().hours,before.hours+(path==='back'?-24:path==='forward'?24:25));assert.match(ui(h).message,success);assert.equal(ui(h).modalError,'','Successful time completion leaves no hidden ownership-loss warning');unchanged(h.persisted(),before);assert.equal(h.persisted().revision,before.revision+1);assert.equal(h.persisted().events.length,before.events.length+1);assert.equal(h.persisted().undo.length,before.undo.length+1);await result;assert.equal(ui(h).modalOpen,false);assert.equal(ui(h).modalError,'','Successful synchronous form/day completion remains warning-free after its handler settles');
 const fresh=setup(h.store.read());assert.equal(fresh.bytes(),h.bytes());await fresh.runAction('undo');for(const key of ['ship','hours','dateLabel','bank','ledger','lots','contracts','policies','snapshots','dashboardBaseline'])same(fresh.persisted()[key],before[key]);
});
test('raw day caller retains the native non-Promise return and new deliberate actions work after completion',()=>{
 const h=setup(),before=h.persisted();const result=h.api.changeCampaignDay(1);assert.notEqual(typeof result?.then,'function');assert.equal(h.counters.writes,1);assert.equal(h.persisted().hours,before.hours+24);assert.match(ui(h).message,success);assert.equal(ui(h).modalError,'','Successful time completion leaves no hidden ownership-loss warning');h.api.changeCampaignDay(-1);assert.equal(h.counters.writes,2);assert.equal(h.persisted().hours,before.hours);assert.equal(h.persisted().undo.length,before.undo.length+2);assert.equal(ui(h).modalError,'','Fresh deliberate day completion also remains warning-free');
});
for(const path of paths)test(`delayed ${path} keeps the prewrite time and LSS display until exact publication AND provider completion`,async t=>{
 const {h,before,raw,gate,operation,session}=await pending(t,path),body=h.dom.ids.get('modal-body').innerHTML,display=semanticUI(h),owner=h.api.timeOperation;
 assert.equal(h.bytes(),raw);assert.equal(session.busy,true);assert.equal(session.awaitSave,true);assert.equal(ui(h).submitDisabled,true);assert.equal(owner.revision,before.revision);noSuccess(h);
 // Capture immediately before the real write: opening a pending surface is
 // allowed to change controls, while publication must not reveal new semantics.
 let writeBaseline;h.hooks.beforeWrite=()=>{writeBaseline=semanticUI(h);};gate.entries[0].write();assert.ok(writeBaseline);same(semanticUI(h),writeBaseline);same(semanticUI(h),display);exact(h,before,gate.entries[0]);assert.equal(h.api.modalSession,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(session.busy,true);noSuccess(h);
 h.api.render();same(semanticUI(h),writeBaseline,'A background render cannot expose published time or consumed LSS');gate.entries[0].fulfill();await operation;assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,success);assert.equal(ui(h).modalError,'','Successful time completion leaves no hidden ownership-loss warning');assert.match(h.dom.ids.get('ship-actions').innerHTML,new RegExp(displayDate(h.persisted().dateLabel,h.persisted().hours).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 const synchronous=setup(before);await begin(synchronous,path);same(canonical(h.persisted()),canonical(synchronous.persisted()));for(const observation of h.trace)assert.doesNotMatch(observation.message,success);
});
for(const path of paths)test(`pending ${path} rejects duplicate actions, detached submit, Close, Escape and replacement without replay`,async t=>{
 const {h,raw,gate,operation,detached,session}=await pending(t,path),body=h.dom.ids.get('modal-body').innerHTML;
 await h.submit();await detached(submitEvent(h));await h.runAction('day-forward');await h.runAction('day-back');dispatchDay(h);h.dom.ids.get('modal-cancel').onclick();h.dom.ids.get('modal-close').onclick();let cancelled=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){cancelled=true;}});assert.equal(cancelled,true);h.api.modal('Unrelated review','Must not replace pending time',null);await h.runAction('reset');
 assert.equal(h.bytes(),raw);assert.equal(h.api.modalSession,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await operation;const bytes=h.bytes();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);gate.restore();await h.runAction('day-forward');assert.equal(h.counters.writes,2,'A deliberate new action after completion remains usable');
});
for(const deferred of [false,true])test(`day event dispatch owns the write before any service-action await, deferred=${deferred}`,async()=>{
 const h=setup(),before=h.persisted();let serviceCalls=0;const original=h.api.services.action;h.api.services.action=(...args)=>{serviceCalls++;return original(...args);};const gate=deferred?serviceSaveGate(h.store):null;
 dispatchDay(h);assert.equal(serviceCalls,0,'Day dispatch must bypass the unrelated asynchronous service entry point');assert.equal(deferred?gate.entries.length:h.counters.writes,1,'Owner is established in the original click stack');
 if(deferred){dispatchDay(h);assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await flush();gate.restore();}else await flush();assert.equal(h.counters.writes,1);assert.equal(h.persisted().hours,before.hours+24);
});
for(const path of paths)test(`synchronous ${path} publication rejects reentrant action and submit in the provider callback`,async()=>{
 const h=setup();let reentrant,callbacks=0;h.hooks.beforeNotify=()=>{callbacks++;reentrant=h.runAction('day-forward');if(path==='form')h.submit();dispatchDay(h);};await begin(h,path);await reentrant;assert.equal(callbacks,1);assert.equal(h.counters.writes,1);
});

for(const path of paths)test(`known prewrite ${path} failure keeps bytes unchanged and permits one deliberate retry`,async t=>{
 const {h,before,raw,gate,operation,session}=await pending(t,path),body=h.dom.ids.get('modal-body').innerHTML;h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),raw);same(h.api.state,before);assert.equal(h.store.reloadRequired??false,false);noSuccess(h);
 let retry;if(path==='form'){assert.equal(h.api.modalSession,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/quota/i);h.fill({hours:before.hours+49,reason:'Corrected after known prewrite failure'});retry=h.submit();}else{assert.match(ui(h).message+' '+ui(h).modalError,/quota/i);if(ui(h).modalOpen)h.api.closeModal();retry=begin(h,path);}
 await flush();assert.equal(gate.entries.length,2);gate.entries[1].fulfill();await retry;assert.equal(h.counters.attempts,2);assert.equal(h.counters.writes,1);assert.equal(h.persisted().undo.length,before.undo.length+1);assert.equal(ui(h).modalError,'','A successful deliberate retry clears only this form’s prior known-unsaved error');
});
for(const path of paths)for(const afterWrite of [false,true])test(`unknown ${path} rejection ${afterWrite?'after':'before'} publication is reload-only with no unsafe retry`,async t=>{
 const {h,raw,gate,operation,detached}=await pending(t,path);if(afterWrite)gate.entries[0].write();gate.entries[0].reject();await operation;terminal(h);assert.match(ui(h).message,afterWrite?/saved, but/:/outcome.*could not be confirmed/);if(!afterWrite)assert.equal(h.bytes(),raw);const bytes=h.bytes();await detached(submitEvent(h));await h.runAction('day-forward');await h.store.acquire(true);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});
for(const path of paths)for(const point of ['beforeNotify','afterNotify'])test(`${path} durable ${point} exception remains saved/reload-only and reload Undo restores exact legacy supply`,async t=>{
 const {h,before,gate,operation}=await pending(t,path);h.hooks[point]=()=>{throw Error('Injected '+point+' failure');};gate.entries[0].fulfill();await operation;terminal(h);assert.equal(h.counters.writes,1);same(h.persisted(),gate.entries[0].args[0]);assert.match(ui(h).message,/saved, but/);const fresh=setup(h.store.read());await fresh.runAction('undo');for(const key of ['ship','hours','dateLabel','bank','ledger','lots','contracts','policies','snapshots','dashboardBaseline'])same(fresh.persisted()[key],before[key]);
});
for(const path of paths)for(const publication of ['missing','missing token','wrong token','wrong revision'])test(`${path} fulfillment with ${publication} publication fails closed`,async t=>{
 const {h,gate,operation}=await pending(t,path);if(publication==='missing')h.store.onChange=()=>{};else h.hooks.beforeNotify=(next,metadata)=>{if(publication==='missing token')delete metadata.saveToken;else if(publication==='wrong token')metadata.saveToken={};else next.revision++;};gate.entries[0].fulfill();await operation;terminal(h);assert.equal(h.counters.writes,1);assert.match(ui(h).message,/outcome.*could not be confirmed/);await h.runAction('day-forward');assert.equal(gate.entries.length,1);
});
for(const path of paths)test(`${path} observed publication outranks a contradictory not-committed rejection`,async t=>{
 const {h,gate,operation}=await pending(t,path);gate.entries[0].write();gate.entries[0].reject(Object.assign(Error('Contradictory prewrite claim'),{code:'SAVE_NOT_COMMITTED',committed:false}));await operation;terminal(h);assert.match(ui(h).message,/saved, but/);assert.equal(h.counters.writes,1);
});
for(const path of paths)for(const when of ['before','after'])test(`foreign same-revision publication ${when} ${path} write permanently retires old completion cleanup`,async t=>{
 const {h,gate,operation}=await pending(t,path);if(when==='after')gate.entries[0].write();h.external(structuredClone(h.persisted()));if(when==='before')gate.entries[0].write();h.api.setView(h.api.state.route.at(-1));h.api.setSelected(['newer-selection']);gate.entries[0].fulfill();await operation;noSuccess(h);same(h.api.selected,['newer-selection']);assert.equal(h.api.view,h.api.state.route.at(-1));if(ui(h).modalOpen)assert.equal(ui(h).submitDisabled,true);assert.equal(h.counters.writes,1);
});
for(const path of paths)for(const publication of [false,true])test(`pending ${path} cannot overwrite a newer ${publication?'published':'disk-only'} revision`,async t=>{
 const {h,gate,operation}=await pending(t,path),next=S.transition(h.persisted(),'External deposit',s=>S.deposit(s,7,'New owner'));h.external(next,{publish:publication});const bytes=h.bytes();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,0);noSuccess(h);assert.equal(h.store.reloadRequired??false,false);
});
for(const path of paths)for(const afterWrite of [false,true])test(`editor loss/regain before ${path} completion afterWrite=${afterWrite} retires that owner permanently`,async t=>{
 const {h,gate,operation,detached}=await pending(t,path);if(afterWrite)gate.entries[0].write();h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');if(!afterWrite)gate.entries[0].write();gate.entries[0].fulfill();await operation;noSuccess(h);assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('modal-cancel').disabled,false);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});
for(const path of paths)for(const rejection of [false,true])test(`native-closed ${path} callback never closes or reports in a newer dialog, rejected=${rejection}`,async t=>{
 const {h,gate,operation,detached}=await pending(t,path),dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer unrelated review','Preserve this newer dialog',null);const session=h.api.modalSession;if(rejection)h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.api.modalSession,session);assert.equal(ui(h).modalTitle,'Newer unrelated review');assert.equal(ui(h).modalError,'');assert.equal(ui(h).modalOpen,true);noSuccess(h);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(h.bytes(),bytes);
});
for(const path of paths)for(const fault of ['close before','close after','render','success reporting','terminal reporting','owned error clear'])test(`${path} ${fault} fault is observed and leaves durable time save reload-only`,async t=>{
 const {h,gate,operation}=await pending(t,path);let count=0;const dialog=h.dom.ids.get('modal');
 if(fault.startsWith('close')){const close=dialog.close;dialog.close=function(){if(count++)return close.call(this);if(fault==='close after'){close.call(this);dialog.dispatch('close');}throw Error('Injected time '+fault+' failure');};}
 else if(fault==='render'){const main=h.dom.ids.get('main');let html=main.innerHTML;Object.defineProperty(main,'innerHTML',{get:()=>html,set(next){if(gate.entries[0].settled&&!count++)throw Error('Injected time cleanup render failure');html=next;}});}
 else if(fault==='owned error clear'){const error=h.dom.ids.get('modal-error');let text=error.textContent;Object.defineProperty(error,'textContent',{get:()=>text,set(next){if(!count&&gate.entries[0].settled&&next===''){count++;throw Error('Injected owned-success error clear failure');}text=next;}});}
 else{const message=h.dom.ids.get('message');let text=message.textContent;Object.defineProperty(message,'textContent',{get:()=>text,set(next){if(!count&&((fault==='success reporting'&&success.test(next))||(fault==='terminal reporting'&&/Reload/.test(next)))){count++;throw Error('Injected time reporting failure');}text=next;}});}
 if(fault==='terminal reporting'){gate.entries[0].write();gate.entries[0].reject();}else gate.entries[0].fulfill();await operation;assert.ok(count);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.counters.writes,1);assert.match(h.dom.ids.get('save-status').textContent,/Reload/);if(fault==='owned error clear'){assert.match(ui(h).message,/saved, but/);same(h.persisted(),gate.entries[0].args[0]);}const bytes=h.bytes();await h.runAction('day-forward');assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

for(const published of [false,true])for(const point of ['modal-title','modal-body','showModal'])test(`day pending-screen ${point} construction failure observes the provider and prevents native form navigation, published=${published}`,async()=>{
 const h=setup(),raw=h.bytes(),gate=serviceSaveGate(h.store);if(published){const save=h.store.save;h.store.save=function(...args){const pending=save.apply(this,args);gate.entries.at(-1).write();return pending;};}let faults=0;const form=h.dom.ids.get('modal-form');form.id='modal-form';
 if(point==='showModal')h.dom.ids.get('modal').showModal=()=>{faults++;throw Error('Injected pending time showModal failure');};
 else{const node=h.dom.ids.get(point),property=point==='modal-title'?'textContent':'innerHTML';let value=node[property];Object.defineProperty(node,property,{configurable:true,get:()=>value,set(next){if(!faults++){throw Error('Injected pending time '+point+' failure');}value=next;}});}
 const operation=h.runAction('day-forward');await flush();assert.equal(gate.entries.length,1);assert.ok(faults);let prevented=0;h.dom.dispatch('submit',form,{preventDefault(){prevented++;}});await flush();assert.equal(prevented,1);gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,published?1:0);if(!published)assert.equal(h.bytes(),raw);assert.match(ui(h).message,published?/saved, but/:/outcome.*could not be confirmed/);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);const bytes=h.bytes();await h.runAction('day-forward');assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);gate.restore();
});

test('unsubmitted time review becomes stale after foreign campaign publication and after native dismissal',async()=>{
 for(const cause of ['foreign','dismiss']){const h=setup(),raw=h.bytes();open(h);const detached=h.dom.ids.get('modal-form').onsubmit;if(cause==='foreign')h.external(structuredClone(h.persisted()));else{h.dom.ids.get('modal').close();h.dom.ids.get('modal').dispatch('close');h.api.modal('Newer review','Retain',null);}await detached(submitEvent(h));assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);noSuccess(h);}
});

// Semantic expectations are explicit and independent of completion logic. The
// real state transition remains the oracle for retained History/Undo structure.
for(const delayed of [false,true])for(const [name,options,path,edits,wantedHours,n,d]of [
 ['forward remainder',{hours:23,stock:{numerator:'11',denominator:'5'}},'forward',{},47,11,10],
 ['back remainder',{hours:47,stock:{numerator:'11',denominator:'5'}},'back',{},23,11,5],
 ['one fractional hour',{hours:23,stock:{numerator:'11',denominator:'5'}},'form',{hours:24},24,517,240],
 ['zero stock',{stock:{numerator:'0',denominator:'1'}},'forward',{},71,0,1],
 ['exhaust stock',{stock:{numerator:'1',denominator:'100'}},'forward',{},71,0,1],
 ['zero complement',{awake:0,frozen:0,stock:{numerator:'17',denominator:'3'}},'forward',{},71,17,3],
 ['low berths only',{awake:0,frozen:3,stock:{numerator:'11',denominator:'5'}},'forward',{},71,19,10],
 ['legacy normalization',{stock:'legacy'},'forward',{},71,561,40],
 ['legacy rewind',{stock:'legacy'},'back',{},23,121,8],
 ['date-only correction',{stock:'legacy'},'form',{hours:47,date:'001-1200'},47,121,8],
 ['same-hours correction',{stock:'legacy'},'form',{hours:47},47,121,8]
])test(`${delayed?'delayed':'synchronous'} ${name} preserves exact positive-only LSS and original legacy Undo`,async()=>{
 const h=setup(fixture(options)),before=h.persisted(),gate=delayed?serviceSaveGate(h.store):null,result=begin(h,path,edits);if(gate){assert.equal(gate.entries.length,1);gate.entries[0].fulfill();}await result;gate?.restore();assert.equal(h.counters.writes,1);const saved=h.persisted();assert.equal(saved.hours,wantedHours);exactStock(saved,n,d);assert.equal(saved.dateLabel,edits.date??before.dateLabel);unchanged(saved,before);assert.equal(saved.revision,before.revision+1);assert.equal(saved.events.length,before.events.length+1);assert.equal(saved.undo.length,before.undo.length+1);const raw=h.bytes(),fresh=setup(h.store.read());assert.equal(fresh.bytes(),raw);await fresh.runAction('undo');for(const key of ['ship','hours','dateLabel','bank','ledger','lots','contracts','snapshots'])same(fresh.persisted()[key],before[key]);
});
for(const stock of ['untracked','legacy unknown'])test(`${stock} time advances do not invent physical supplies and Undo preserves original representation`,async()=>{
 const saved=fixture({stock:stock==='untracked'?'untracked':'legacy'});if(stock==='legacy unknown')delete saved.ship.accommodation;const h=setup(saved),before=h.persisted();await begin(h,'forward');assert.equal(h.persisted().hours,before.hours+24);if(stock==='untracked')assert.equal(h.persisted().ship.lifeSupport,undefined);else{assert.equal(supportStock(h.persisted().ship).remainingUnits,null);assert.equal(h.persisted().ship.lifeSupport.migrationRequired,true);assert.equal(h.persisted().ship.lifeSupport.remainingHours,336);assert.equal(h.persisted().ship.lifeSupport.elapsedHours,6);}await h.runAction('undo');same(h.persisted().ship,before.ship);
});
test('day rollover and supported start/max-safe boundaries keep old synchronous behavior',async()=>{
 const year=setup(fixture({hours:0,date:'365-1105'}));await begin(year,'forward');assert.equal(displayDate(year.persisted().dateLabel,year.persisted().hours),'001-1106 · 00:00');
 for(const [hours,path,wanted]of [[0,'back',0],[23,'back',23],[24,'back',0],[Number.MAX_SAFE_INTEGER-24,'forward',Number.MAX_SAFE_INTEGER],[Number.MAX_SAFE_INTEGER-23,'forward',Number.MAX_SAFE_INTEGER-23]]){const h=setup(fixture({hours,stock:'untracked'})),raw=h.bytes();await begin(h,path);assert.equal(h.persisted().hours,wanted);if(wanted===hours){assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.match(ui(h).message,/outside.*supported|before.*start/i);}else assert.equal(h.counters.writes,1);}
});
for(const [field,value,pattern]of [['reason','   ',/reason/i],['date','366-1105',/date|day/i],['hours','-1',/hours/i],['hours','1.5',/hours/i],['hours',String(Number.MAX_SAFE_INTEGER+1),/hours/i]])test(`invalid time ${field}=${JSON.stringify(value)} rejects before provider/Undo`,async()=>{
 const h=setup(),raw=h.bytes();open(h,{[field]:value});const gate=serviceSaveGate(h.store);await h.submit();assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,0);assert.equal(h.counters.writes,0);assert.match(ui(h).modalError,pattern);assert.equal(ui(h).submitDisabled,false);assert.equal(h.store.reloadRequired??false,false);gate.restore();
});
for(const path of paths)test(`${path} followed by Undo cannot reopen a consumed prior jump mulligan or reroll saved dice`,async()=>{
 let saved=fixture({stock:{numerator:'560',denominator:'1'}});saved.ship.fuel=configureFuel(200,40,60,40,2);
 const commit=(state,face)=>{const prepared=S.prepareJump(state,()=>({dice:Array(6).fill(face),total:face*6}));return S.transition(prepared.state,'Jump',s=>S.commitJump(s,{attemptId:prepared.attempt.id,elapsed:160}));};saved=commit(S.undoJump(commit(saved,3)),2);assert.equal(saved.jumpAttempts[0].mulliganUsed,true);assert.equal(saved.jumpAttempts[0].rolls.length,2);const h=setup(saved);await begin(h,path);const changed=h.persisted();assert.equal(changed.jumpAttempts[0].closed,true);same(changed.jumpAttempts[0].rolls,saved.jumpAttempts[0].rolls);unchanged(changed,saved);await h.runAction('undo');same(h.persisted().ship,saved.ship);assert.equal(h.persisted().hours,saved.hours);assert.equal(h.persisted().jumpAttempts[0].closed,true);assert.equal(h.persisted().jumpAttempts[0].mulliganUsed,true);same(h.persisted().jumpAttempts[0].rolls,saved.jumpAttempts[0].rolls);assert.equal(S.jumpUndoEligibility(h.persisted()).allowed,false);
});

test('all production rejection paths settle without unhandled rejections',async()=>{
 const unhandled=[],listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);
 try{for(const path of paths)for(const committed of [false,true]){const h=setup(),gate=serviceSaveGate(h.store),operation=begin(h,path);await flush();if(committed)gate.entries[0].write();gate.entries[0].reject();await operation;await flush();terminal(h);gate.restore();}await flush();assert.deepEqual(unhandled,[]);}finally{process.off('unhandledRejection',listener);}
});

test('an earlier unrelated service-action continuation cannot navigate or publish new time while the day owner is pending',async()=>{
 const h=setup(),beforeView=h.api.view,gate=serviceSaveGate(h.store);let release,serviceCalls=0;
 const held=new Promise(resolve=>{release=resolve;});h.api.services.action=()=>{serviceCalls++;return held;};
 const other={disabled:false,dataset:{action:'world',arg:h.api.state.route.at(-1)},closest:selector=>selector==='[data-action]'?other:null};h.dom.dispatch('click',other,{preventDefault(){}});assert.equal(serviceCalls,1);
 dispatchDay(h);assert.equal(gate.entries.length,1);assert.equal(serviceCalls,1,'The time path cannot cross the older service await');const display=semanticUI(h);gate.entries[0].write();release(false);await flush();assert.equal(h.api.view,beforeView);same(semanticUI(h),display);noSuccess(h);gate.entries[0].fulfill();await flush();assert.equal(h.counters.writes,1);gate.restore();
});
test('throwing time form control freeze is known prewrite, preserves the review and permits correction/retry',async()=>{
 const h=setup(),raw=h.bytes();open(h);const form=h.dom.ids.get('modal-form'),query=form.querySelectorAll;let failed=0,disabled=false;
 const control={get disabled(){return disabled;},set disabled(value){if(value&&!failed++){throw Error('Injected time input freeze failure');}disabled=value;}};
 form.querySelectorAll=selector=>selector==='[data-round]'?query(selector):[control];const gate=serviceSaveGate(h.store);await h.submit();assert.equal(failed,1);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,0);assert.equal(h.store.reloadRequired??false,false);assert.equal(h.store.editable,true);assert.equal(ui(h).submitDisabled,false);assert.match(ui(h).modalError,/freeze failure/);noSuccess(h);
 form.querySelectorAll=query;h.fill({hours:100,reason:'Corrected deliberate retry'});const retry=h.submit();assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await retry;assert.equal(h.counters.writes,1);assert.equal(h.persisted().hours,100);gate.restore();
});

for(const path of paths)test(`${path} closes an initially unused jump mulligan permanently even after time Undo`,async()=>{
 const base=fixture({stock:{numerator:'560',denominator:'1'}});base.ship.fuel=configureFuel(200,40,60,40,2);const prepared=S.prepareJump(base,()=>({dice:[3,3,3,3,3,3],total:18}));const jumped=S.transition(prepared.state,'Jump',s=>S.commitJump(s,{attemptId:prepared.attempt.id,elapsed:160}));assert.equal(S.jumpUndoEligibility(jumped).allowed,true);assert.equal(jumped.jumpAttempts[0].mulliganUsed,false);
 const h=setup(jumped);await begin(h,path);assert.equal(h.persisted().jumpAttempts[0].closed,true);await h.runAction('undo');const restored=h.persisted();assert.equal(restored.hours,jumped.hours);same(restored.ship,jumped.ship);assert.equal(restored.jumpAttempts[0].mulliganUsed,false);assert.equal(restored.jumpAttempts[0].closed,true);assert.equal(S.jumpUndoEligibility(restored).allowed,false);same(restored.jumpAttempts[0].rolls,jumped.jumpAttempts[0].rolls);assert.equal(restored.jumpAttempts[0].rolls.length,1);
});

for(const delayed of [false,true])test(`corrected local time validation completes without retaining the earlier warning, delayed=${delayed}`,async()=>{
 const h=setup(),raw=h.bytes();open(h,{reason:'   '});await h.submit();assert.equal(h.bytes(),raw);assert.match(ui(h).modalError,/reason/i);assert.equal(h.counters.writes,0);h.fill({reason:'Corrected referee explanation'});const gate=delayed?serviceSaveGate(h.store):null,result=h.submit();if(gate){assert.equal(gate.entries.length,1);assert.match(ui(h).modalError,/reason/i,'Previous review error remains until successful settlement');gate.entries[0].write();assert.match(ui(h).modalError,/reason/i);gate.entries[0].fulfill();}await result;assert.equal(ui(h).modalError,'','Only exact owned success clears the old local validation warning');assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,success);assert.equal(h.counters.writes,1);gate?.restore();
});
