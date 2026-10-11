import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {campaign,attrs,element} from './app-harness.mjs';
import {S,same,flush} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {configureMortgage} from '../js/mortgage.mjs';
import {configureMaintenance} from '../js/maintenance.mjs';
import {expenseQuote} from '../js/expenses.mjs';
import {SaveNotCommittedError} from '../js/persistence.mjs';
import {createExpensePanels} from '../js/expense-panels.mjs';
import {createCampaignController} from '../js/campaign-controller.mjs';

// Run the real app, controller, rules and Store in isolated synthetic storage.
// Only boot and DOM are doubled. The browser suite owns Web Locks, real DOM,
// cache/ResizeObserver callbacks and pixels. No production save body is copied.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),storageURL=new URL('./deposit-save-harness.mjs',import.meta.url);
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const marker='store=new Store(receiveCampaign,',roleStart=app.indexOf(marker);assert.ok(roleStart>=0);
const roleCallback=app.slice(roleStart+marker.length).split(');try{state=store.read();}')[0];assert.ok(roleCallback.startsWith('(editable,text)=>'));
const absolutize=(source,url)=>source.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
function replace(source,from,to){assert.ok(source.includes(from),'Expected actual harness boundary '+from);return source.replace(from,to);}
let hs=absolutize(await readFile(harnessURL,'utf8'),harnessURL);
hs=replace(hs,'globalThis.api={setStore','globalThis.api={expenseServices,roleChange:'+roleCallback+',setStore');
hs=replace(hs,'priceDice:0','priceDice:0,expenseDice:0');
hs=replace(hs,'const sandbox={...bindings,','const sandbox={...bindings,createExpensePanels:options=>bindings.createExpensePanels({...options,rollDie:()=>{calls.expenseDice++;return 3;}}),');
const hm='data:text/javascript;base64,'+Buffer.from(hs).toString('base64');
let ss=absolutize(await readFile(storageURL,'utf8'),storageURL);ss=replace(ss,JSON.stringify(harnessURL.href),JSON.stringify(hm));
const {depositHarness}=await import('data:text/javascript;base64,'+Buffer.from(ss).toString('base64'));
const kinds=['mortgage','maintenance','salary','berthing','rate'];
const success=/^(?:Paid .+ saved\.|Starport berthing rate saved\.|.+ payment (?:saved|recorded)\.)$/i;
function fixture({creditStep=100,huge=false,zero=false,rate=true}={}){
 const s=campaign();s.bank=huge?'9007199254740993123456789':'5000000';s.hours=29;s.dateLabel='001-1105';s.settings.creditStep=creditStep;
 s.ship.mortgage=configureMortgage({originalAmount:'24000001',payment:huge?'90071992547409931':'100001',remainingPayments:'480',totalPaid:'0',nextDueDate:'029-1105'});
 s.ship.maintenance=configureMaintenance({payment:huge?'90071992547409931':'2001',nextDueDate:'015-1105'});s.ship.expenses={salary:'12001'};
 if(zero)s.worlds[s.actual].uwp='E788899-C';else if(rate)s.worlds[s.actual].berthingRate={port:'A',die:3};return S.validate(s);
}
function setup(saved=fixture()){
 const h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}}),document=h.dom.document,baseQuery=document.querySelector,baseAll=document.querySelectorAll;
 let markup=h.dom.ids.get('main').innerHTML,fields=new Map(),buttons=[],form=null,panel=null;
 function parse(html){
  markup=html;for(const id of ['expense-panel','expense-form','expense-quote','expense-status'])h.dom.ids.delete(id);fields=new Map();buttons=[];form=null;panel=null;
  const section=html.match(/<aside\b[^>]*id="expense-panel"[^>]*>[\s\S]*?<\/aside>/)?.[0];if(!section)return;
  panel=element(attrs(section.match(/^<aside\b([^>]*)>/)[1]));panel.innerHTML=section;h.dom.ids.set('expense-panel',panel);
  for(const match of section.matchAll(/<input\b([^>]*)>/g)){const node=element(attrs(match[1]));node.type=node.attributes.type??'text';fields.set(node.name,node);}
  buttons=[...section.matchAll(/<button\b([^>]*)>/g)].map(m=>element(attrs(m[1])));
  const tag=section.match(/<form\b([^>]*id="expense-form"[^>]*)>/);if(tag){form=element(attrs(tag[1]));form.elements=[...fields.values()];h.dom.ids.set('expense-form',form);}
  for(const id of ['expense-quote','expense-status']){const tag=section.match(new RegExp('<[a-z]+\\b([^>]*id="'+id+'"[^>]*)>([^<]*)'));if(tag){const node=element(attrs(tag[1]));node.hidden='hidden'in node.attributes;node.textContent=tag[2];h.dom.ids.set(id,node);}}
 }
 Object.defineProperty(h.dom.ids.get('main'),'innerHTML',{configurable:true,get:()=>markup,set:parse});
 document.querySelector=selector=>selector.startsWith('#expense-form')?fields.get(selector.match(/\[name="([^"]+)"\]/)?.[1])??form:baseQuery(selector);
 document.querySelectorAll=selector=>{
  if(!selector.includes('#expense-panel'))return baseAll(selector);const found=new Set();
  for(const part of selector.split(',')){if(/\binput\b/.test(part))for(const field of fields.values())found.add(field);if(/\bbutton\b|\[data-action/.test(part)){const action=part.match(/\[data-action="([^"]+)"\]/)?.[1];for(const button of buttons)if(!action||button.dataset.action===action)found.add(button);}}return [...found];
 };
 h.store.onRole=(editable,text)=>{h.roles.push([editable,text]);h.hooks.onRole?.(editable,text);h.api.roleChange(editable,text);};
 const expenses=h.api.expenseServices;
 const arg=(name,value)=>{const button=buttons.find(b=>b.dataset.action===name&&(value===undefined||b.dataset.arg.endsWith(':'+value)));assert.ok(button,'Expected rendered '+name);return button.dataset.arg;};
 return {...h,expenses,fields:()=>fields,buttons:()=>buttons,panel:()=>panel,form:()=>form,arg,
  open(kind,values={}){expenses.open(kind==='rate'?'berthing':kind,{fresh:true});this.fillExpense(values);},
  fillExpense(values){for(const [name,value]of Object.entries(values)){const field=fields.get(name);assert.ok(field,'Expected expense field '+name);field.value=String(value);}expenses.sync();},
  rawAction(name,value){return expenses.action(name,value===undefined?arg(name):value);},
  action(name,value){return h.api.safely(()=>expenses.action(name,value===undefined?arg(name):value))();},
  pay(){return this.action('expense-pay');},
  start(kind){return this.action(kind==='rate'?'expense-berthing-rate':'expense-pay');}
 };
}
const display=h=>({summary:h.dom.ids.get('summary').innerHTML,main:h.dom.ids.get('main').innerHTML});
const notice=h=>h.dom.ids.get('expense-status')?.textContent??'';
const message=h=>h.dom.ids.get('message').textContent;
const noSuccess=h=>assert.doesNotMatch(message(h),success);
const receipt=h=>assert.match(h.expenses.panel(),/Payment recorded/);
function terminal(h){assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.dom.ids.get('takeover').disabled,true);assert.match(h.dom.ids.get('save-status').textContent,/reload/i);noSuccess(h);assert.match(h.expenses.panel(),/reload/i);}
const edits=kind=>kind==='salary'?{monthly:'1234',payments:'2'}:kind==='berthing'?{weeks:'2'}:kind==='rate'?{}:{payments:'2'};
function canonical(state){const ids=new Map();return JSON.parse(JSON.stringify(state,(_key,value)=>{if(typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)){if(!ids.has(value))ids.set(value,'generated-'+ids.size);return ids.get(value);}return value;}));}
async function pending(t,kind='mortgage',saved=fixture({rate:kind!=='rate'})){
 const h=setup(saved);h.open(kind,edits(kind));const before=h.persisted(),raw=h.bytes(),route=structuredClone(h.expenses.route()),arg=h.arg(kind==='rate'?'expense-berthing-rate':'expense-pay'),gate=serviceSaveGate(h.store),operation=h.start(kind);
 await flush();assert.equal(gate.entries.length,1);const visible=display(h),panel=h.panel();t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});return {h,before,raw,route,arg,gate,operation,visible,panel};
}
function dispatch(h,name,arg=''){
 const button={disabled:false,dataset:{action:name,arg},closest:selector=>selector==='[data-action]'?button:null};h.dom.dispatch('click',button,{preventDefault(){}});return button;
}
function expectedAmount(kind){return {mortgage:'200002',maintenance:'4002',salary:'2500',berthing:'6000',rate:'0'}[kind];}

for(const kind of kinds)test(`native synchronous ${kind} completes before returning and retains exact economic oracle`,async()=>{
 const h=setup(fixture({rate:kind!=='rate'}));h.open(kind,edits(kind));const before=h.persisted(),name=kind==='rate'?'expense-berthing-rate':'expense-pay',result=h.rawAction(name);
 assert.equal(h.counters.writes,1);assert.equal(h.expenses.committing(),false);if(kind!=='rate')receipt(h);else assert.match(message(h),/Starport berthing rate saved/);await result;
 assert.equal(h.persisted().bank,String(BigInt(before.bank)-BigInt(expectedAmount(kind))));assert.equal(h.persisted().revision,before.revision+1);assert.equal(h.persisted().undo.length,before.undo.length+1);assert.equal(h.calls.expenseDice,Number(kind==='rate'));assert.equal(h.persisted().ledger.length,before.ledger.length+Number(kind!=='rate'));
 const oracle=S.transition(before,kind==='rate'?'Saved starport berthing rate':{mortgage:'Paid mortgage',maintenance:'Paid monthly maintenance',salary:'Paid crew salaries',berthing:'Paid port costs'}[kind],s=>{if(kind==='rate')S.saveBerthingRate(s,3);else {S.shipExpense(s,{kind,creditStep:100,recurringShip:s.ship,...(kind==='mortgage'?{mortgagePayments:'2'}:kind==='maintenance'?{maintenancePayments:'2'}:kind==='salary'?{monthly:'1234',months:'2'}:{weeks:'2'})});s.ledger.at(-1).paidAt??={dateLabel:s.dateLabel,hours:s.hours};}});
 same(canonical(h.persisted()),canonical(oracle));
});
for(const kind of kinds)test(`delayed ${kind} separates durable publication from owned visible settlement`,async t=>{
 const {h,before,raw,route,gate,operation,visible,panel}=await pending(t,kind);assert.equal(h.bytes(),raw);assert.equal(h.expenses.committing(),true);noSuccess(h);
 gate.entries[0].write();assert.equal(h.counters.writes,1);same(h.persisted(),gate.entries[0].args[0]);same(h.api.state,gate.entries[0].args[0]);assert.equal(h.persisted().revision,before.revision+1);assert.equal(gate.entries[0].args[1],before.revision);assert.ok(gate.entries[0].args[2]);same(h.expenses.route(),route);same(display(h),visible);assert.equal(h.panel(),panel);noSuccess(h);h.api.render();same(display(h),visible);assert.equal(h.panel(),panel);
 gate.entries[0].fulfill();await operation;assert.equal(h.expenses.committing(),false);if(kind!=='rate')receipt(h);else assert.match(message(h),/Starport berthing rate saved/);assert.equal(notice(h),'');const sync=setup(before);sync.open(kind,edits(kind));await sync.start(kind);same(canonical(h.persisted()),canonical(sync.persisted()));assert.doesNotMatch(h.bytes(),/saveToken|replacementToken/);
});

for(const kind of kinds)test(`${kind} duplicate, Enter, stale token and detached action never queue a second write`,async t=>{
 const {h,arg,gate,operation}=await pending(t,kind),name=kind==='rate'?'expense-berthing-rate':'expense-pay';await h.action(name,arg);h.dom.dispatch('keydown',{matches:()=>false},{key:'Enter',preventDefault(){}});await h.action(name,arg);await h.action(name,'');assert.equal(gate.entries.length,1);assert.equal(h.expenses.close(),false);assert.equal(h.expenses.open('salary',{fresh:true}),false);await h.action('expense-back',h.arg('expense-back'));assert.equal(h.expenses.route().kind,kind==='rate'?'berthing':kind);
 gate.entries[0].fulfill();await operation;const raw=h.bytes(),dice=h.calls.expenseDice;await h.action(name,arg);assert.equal(gate.entries.length,1);assert.equal(h.bytes(),raw);assert.equal(h.calls.expenseDice,dice);
});
for(const kind of kinds)test(`${kind} typed unwritten retry retains exact draft, quote and prepared die`,async t=>{
 const {h,raw,gate,operation}=await pending(t,kind),first=canonical(gate.entries[0].args[0]),values=[...h.fields()].map(([name,n])=>[name,n.value]);h.failNext();gate.entries[0].fulfill();await operation;
 assert.equal(h.bytes(),raw);assert.equal(h.store.reloadRequired??false,false);assert.equal(h.expenses.committing(),false);assert.match(notice(h),/quota/i);noSuccess(h);same([...h.fields()].map(([name,n])=>[name,n.value]),values);assert.equal(h.calls.expenseDice,Number(kind==='rate'));
 const retry=h.start(kind);assert.equal(gate.entries.length,2);same(canonical(gate.entries[1].args[0]),first);assert.equal(h.calls.expenseDice,Number(kind==='rate'));gate.entries[1].write();assert.match(notice(h),/Saving|confirmation/i);noSuccess(h);gate.entries[1].fulfill();await retry;assert.equal(h.counters.writes,1);assert.equal(notice(h),'');assert.equal(h.expenses.committing(),false);if(kind!=='rate')receipt(h);
});
for(const kind of kinds)for(const committed of [false,true])test(`${kind} unknown ${committed?'postpublication':'prewrite'} outcome latches reload and makes every replay inert`,async t=>{
 const {h,raw,arg,gate,operation}=await pending(t,kind);if(committed)gate.entries[0].write();gate.entries[0].reject();await operation;terminal(h);assert.match(message(h),committed?/saved, but/i:/outcome.*could not be confirmed/i);if(!committed)assert.equal(h.bytes(),raw);const bytes=h.bytes(),dice=h.calls.expenseDice;await h.action(kind==='rate'?'expense-berthing-rate':'expense-pay',arg);await h.store.acquire(true);assert.equal(h.bytes(),bytes);assert.equal(h.calls.expenseDice,dice);assert.equal(gate.entries.length,1);terminal(h);
});
for(const kind of ['mortgage','rate'])for(const fault of ['beforeNotify','afterNotify'])test(`${kind} durable ${fault} failure preserves saved campaign and requires reload`,async t=>{
 const {h,before,gate,operation}=await pending(t,kind);h.hooks[fault]=()=>{throw Error('Injected expense '+fault+' failure');};gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);terminal(h);assert.match(message(h),/saved, but/i);same(h.persisted(),gate.entries[0].args[0]);const fresh=setup(h.store.read());await fresh.runAction('undo');for(const key of ['bank','ship','worlds','ledger','hours','dateLabel','route','routeIndex'])same(fresh.persisted()[key],before[key]);
});
for(const kind of ['mortgage','rate'])for(const fault of ['missing','missing token','wrong token','wrong revision'])test(`${kind} ${fault} publication cannot infer ownership from matching saved values`,async t=>{
 const {h,gate,operation}=await pending(t,kind);if(fault==='missing')h.store.onChange=()=>{};else h.hooks.beforeNotify=(next,metadata)=>{if(fault==='missing token')delete metadata.saveToken;else if(fault==='wrong token')metadata.saveToken={};else next.revision++;};gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);terminal(h);assert.match(message(h),/outcome.*could not be confirmed/i);await h.start(kind);assert.equal(gate.entries.length,1);
});
for(const kind of ['mortgage','rate'])test(`${kind} observed owned publication outranks contradictory typed not-committed error`,async t=>{
 const {h,gate,operation}=await pending(t,kind);gate.entries[0].write();gate.entries[0].reject(new SaveNotCommittedError(Error('Contradictory prewrite claim')));await operation;terminal(h);assert.match(message(h),/saved, but/i);assert.equal(h.counters.writes,1);
});
for(const kind of ['mortgage','rate'])test(`${kind} fulfillment without write or publication fails closed`,async()=>{
 const h=setup(fixture({rate:kind!=='rate'}));h.open(kind,edits(kind));const raw=h.bytes();h.store.save=()=>Promise.resolve(undefined);await h.start(kind);terminal(h);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);
});
for(const kind of ['mortgage','rate'])for(const afterWrite of [false,true])test(`${kind} editing loss and regain ${afterWrite?'after':'before'} publication permanently retires the old attempt`,async t=>{
 const {h,arg,gate,operation}=await pending(t,kind);if(afterWrite)gate.entries[0].write();h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');if(!afterWrite)gate.entries[0].write();h.api.setSelected(['newer-selection']);h.api.setView('1,0');gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);noSuccess(h);assert.doesNotMatch(h.expenses.panel(),/Payment recorded/);same(h.api.selected,['newer-selection']);assert.equal(h.api.view,'1,0');const raw=h.bytes();await h.action(kind==='rate'?'expense-berthing-rate':'expense-pay',arg);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);
});
for(const kind of ['mortgage','rate'])for(const afterWrite of [false,true])test(`${kind} same-revision foreign publication ${afterWrite?'after':'before'} owned publication never revives old completion`,async t=>{
 const {h,arg,gate,operation}=await pending(t,kind);if(afterWrite)gate.entries[0].write();h.external(structuredClone(h.persisted()));if(!afterWrite)gate.entries[0].write();h.api.setView('1,0');h.api.modal('Newer work','Keep this dialog',null);const modal=h.api.modalSession;gate.entries[0].fulfill();await operation;noSuccess(h);assert.equal(h.api.modalSession,modal);assert.equal(h.dom.ids.get('modal-body').innerHTML,'Keep this dialog');assert.equal(h.api.view,'1,0');const raw=h.bytes();await h.action(kind==='rate'?'expense-berthing-rate':'expense-pay',arg);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);
});
for(const publish of [false,true])test(`newer ${publish?'published':'disk-only'} campaign cannot be overwritten by a pending expense`,async t=>{
 const {h,arg,gate,operation}=await pending(t);h.external(S.transition(h.persisted(),'Foreign deposit',s=>S.deposit(s,7,'Other owner')),{publish});const raw=h.bytes();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);noSuccess(h);assert.equal(h.store.reloadRequired??false,false);const replay=h.action('expense-pay',arg);await flush();assert.equal(gate.entries.length,1);await replay;assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);
});
for(const afterWrite of [false,true])test(`typed unwritten result after foreign ${afterWrite?'postpublication':'prepublication'} replacement cannot re-enable the retired panel`,async t=>{
 const {h,arg,gate,operation}=await pending(t);if(afterWrite)gate.entries[0].write();h.external(structuredClone(h.persisted()));const raw=h.bytes();gate.entries[0].reject(new SaveNotCommittedError(Error('Typed rejected stale operation')));await operation;assert.equal(h.bytes(),raw);noSuccess(h);if(afterWrite)terminal(h);else assert.equal(h.store.reloadRequired??false,false);await h.action('expense-pay',arg);assert.equal(gate.entries.length,1);
});
for(const releaseWhen of ['pending','settled'])for(const action of ['tab','world','deposit'])test(`queued ${action} released while expense is ${releaseWhen} never executes after an intervening write`,async()=>{
 const h=setup();h.open('mortgage',edits('mortgage'));let release;const waiting=new Promise(resolve=>release=resolve),original=h.api.services.action;h.api.services.action=()=>waiting;dispatch(h,action,action==='world'?'1,0':action==='tab'?'History':'');h.api.services.action=original;
 const gate=serviceSaveGate(h.store),operation=h.pay();gate.entries[0].write();if(releaseWhen==='settled'){gate.entries[0].fulfill();await operation;}const visible=display(h),view=h.api.view;release(false);await flush();same(display(h),visible);assert.equal(h.api.view,view);assert.equal(h.dom.ids.get('modal').open,false);if(releaseWhen==='pending'){gate.entries[0].fulfill();await operation;}assert.equal(h.counters.writes,1);assert.equal(gate.entries.length,1);gate.restore();
 // A genuinely new post-settlement navigation remains available.
 dispatch(h,'tab','History');await flush();assert.match(h.dom.ids.get('main').innerHTML,/Campaign history/);
});
test('rate retry, rate completion and subsequent payment have separate one-use owners and retain a single die',async()=>{
 const h=setup(fixture({rate:false}));h.open('rate');const rateArg=h.arg('expense-berthing-rate'),gate=serviceSaveGate(h.store);h.failNext();let operation=h.start('rate');gate.entries[0].fulfill();await operation;assert.equal(h.calls.expenseDice,1);assert.equal(h.counters.writes,0);operation=h.start('rate');gate.entries[1].write();gate.entries[1].fulfill();await operation;assert.equal(h.counters.writes,1);assert.equal(h.calls.expenseDice,1);assert.notEqual(h.arg('expense-pay'),rateArg);await h.action('expense-berthing-rate',rateArg);assert.equal(h.calls.expenseDice,1);assert.equal(gate.entries.length,2);
 h.fillExpense({weeks:2});const paidBefore=h.persisted();h.failNext();operation=h.pay();gate.entries[2].fulfill();await operation;assert.equal(h.counters.writes,1);assert.equal(h.calls.expenseDice,1);same(h.persisted(),paidBefore);operation=h.pay();gate.entries[3].fulfill();await operation;assert.equal(h.counters.writes,2);assert.equal(h.calls.expenseDice,1);assert.notEqual(gate.entries[1].args[2],gate.entries[3].args[2]);assert.equal(h.persisted().bank,'4994000');receipt(h);gate.restore();
});
for(const kind of kinds)test(`${kind} initial busy-control failure is unwritten, releases busy and permits exact retry`,async()=>{
 const h=setup(fixture({rate:kind!=='rate'}));h.open(kind,edits(kind));const raw=h.bytes(),button=h.buttons().find(b=>b.dataset.action===(kind==='rate'?'expense-berthing-rate':'expense-pay'));let disabled=button.disabled,faults=0;Object.defineProperty(button,'disabled',{get:()=>disabled,set(next){if(next&&!faults++){throw Error('Injected expense initial control failure');}disabled=next;}});
 const gate=serviceSaveGate(h.store);await h.start(kind);assert.ok(faults);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,0);assert.equal(h.expenses.committing(),false);assert.equal(h.store.reloadRequired??false,false);assert.match(message(h)+' '+notice(h),/initial control failure/);const operation=h.start(kind);assert.equal(gate.entries.length,1);gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);assert.equal(h.calls.expenseDice,Number(kind==='rate'));gate.restore();
});
for(const invalid of ['','0','-1','1.5','481','9007199254740992'])test(`invalid mortgage count ${JSON.stringify(invalid)} remains local and never claims a write`,async()=>{
 const h=setup();h.open('mortgage',{payments:invalid});const raw=h.bytes();await h.pay();assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.equal(h.expenses.committing(),false);assert.equal(h.store.reloadRequired??false,false);noSuccess(h);
});

for(const kind of ['mortgage','rate'])test(`${kind} a duplicate already-consumed publication token retires the attempt and cannot replay`,async t=>{
 const {h,arg,gate,operation}=await pending(t,kind);gate.entries[0].write();const note=h.notifications.at(-1);h.store.onChange(structuredClone(note.next),note.metadata);assert.equal(h.notifications.length,2);gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);noSuccess(h);assert.equal(h.store.reloadRequired??false,false);assert.doesNotMatch(h.expenses.panel(),/Payment recorded/);const raw=h.bytes();await h.action(kind==='rate'?'expense-berthing-rate':'expense-pay',arg);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);
});
for(const kind of ['mortgage','rate'])for(const point of ['render','success reporting'])test(`${kind} owned ${point} fault after durable write becomes saved/reload-only`,async t=>{
 const {h,gate,operation}=await pending(t,kind);let faults=0;
 const node=h.dom.ids.get(point==='render'?'main':'message'),property=point==='render'?'innerHTML':'textContent',descriptor=Object.getOwnPropertyDescriptor(node,property);let value=node[property];Object.defineProperty(node,property,{configurable:true,get:descriptor.get??(()=>value),set(next){if(gate.entries[0].settled&&!faults++){throw Error('Injected expense '+point+' failure');}if(descriptor.set)descriptor.set(next);else value=next;}});
 gate.entries[0].fulfill();await operation;assert.ok(faults);assert.equal(h.counters.writes,1);terminal(h);assert.match(message(h),/saved, but/i);
});
for(const committed of [false,true])test(`throwing app role reporter cannot undo expense reload latch, committed=${committed}`,async t=>{
 const {h,arg,gate,operation}=await pending(t);if(committed)gate.entries[0].write();h.hooks.onRole=()=>{throw Error('Injected expense role failure');};gate.entries[0].reject();await operation;terminal(h);const raw=h.bytes();await h.action('expense-pay',arg);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);
});
for(const outcome of ['success','known unwritten','unknown'])test(`newer dialog and selected world survive expense ${outcome} completion without old reporting`,async t=>{
 const {h,gate,operation}=await pending(t);if(outcome==='success')gate.entries[0].write();h.api.modal('Newer review','Preserve new dialog and view',null);h.api.setView('1,0');const modal=h.api.modalSession,raw=h.bytes(),reported='Newer surface status';h.dom.ids.get('message').textContent=reported;
 if(outcome==='known unwritten')gate.entries[0].reject(new SaveNotCommittedError(Error('Old rejected expense')));else if(outcome==='unknown')gate.entries[0].reject();else gate.entries[0].fulfill();await operation;assert.equal(h.api.modalSession,modal);assert.equal(h.dom.ids.get('modal-body').innerHTML,'Preserve new dialog and view');assert.equal(h.api.view,'1,0');assert.equal(message(h),reported);assert.equal(h.bytes(),raw);if(outcome==='unknown'){assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);}else assert.equal(h.store.reloadRequired??false,false);h.api.closeModal();h.api.render();h.expenses.syncControls();assert.match(h.expenses.panel(),outcome==='unknown'?/Reload/i:/ownership changed/i);assert.equal(h.buttons().find(b=>b.dataset.action==='expense-pay').disabled,true,'Closing newer context must not revive an enabled old Pay button');
});

// Callback fault containment at the module boundary uses the actual controller
// and Store too. The host's explicit provenance callback is wired independently
// of app rendering so navigation/report/control callbacks can be adversarial.
function callbackHarness(options={}){
 const h=setup(fixture({rate:options.kind!=='rate'}));let state=h.api.state,expenses;const hooks={};
 const controller=createCampaignController({getState:()=>state,getStore:()=>h.store,getKnownWorlds:()=>state.worlds,getRounding:()=>[]});
 const render=()=>{h.dom.ids.get('main').innerHTML=expenses.panel();hooks.render?.();};
 expenses=createExpensePanels({document:h.dom.document,getState:()=>state,isEditable:()=>h.store.editable,commit(label,fn,revision,contract){assert.equal(contract.announce,false);hooks.beforeTransition?.(fn);return controller.transition(label,fn,revision,contract);},render,showOverview:()=>hooks.overview?.(),onNavigate:route=>hooks.navigate?.(route),message:text=>{h.dom.ids.get('message').textContent=text;hooks.message?.(text);},rollDie:()=>{h.calls.expenseDice++;return 3;},canRetry:()=>hooks.canRetry?.()??true,onTerminalFailure(error,guidance,report){h.store.reloadRequired=true;h.store.editable=false;hooks.terminal?.(error,guidance,report);}});
 h.store.onChange=(next,metadata)=>{expenses.receiveCampaign(next,controller.isLocalPublication(next,metadata));state=next;};
 const arg=(name)=>{const matches=[...expenses.panel().matchAll(/data-action="([^"]+)" data-arg="([^"]+)"/g)],button=matches.find(m=>m[1]===name);assert.ok(button,'Expected module action '+name);return button[2];};
 return {...h,expenses,hooks,get state(){return state;},arg,open(kind=options.kind??'mortgage'){expenses.open(kind==='rate'?'berthing':kind,{fresh:true});},action(name='expense-pay',token=arg(name)){return expenses.action(name,token);}};
}
for(const kind of ['mortgage','rate'])for(const point of (kind==='rate'?['navigation','render','report','controls']:['navigation','render','report']))test(`${kind} ${point} callback throw after owned publication latches module and host safety before reporting`,async()=>{
 const h=callbackHarness({kind});h.open();const gate=serviceSaveGate(h.store),name=kind==='rate'?'expense-berthing-rate':'expense-pay',operation=h.action(name);let faults=0;
 const fault=()=>{if(gate.entries[0].settled&&!faults++){throw Error('Injected '+point+' callback failure');}};
 if(point==='navigation')h.hooks.navigate=fault;else if(point==='render')h.hooks.render=fault;else if(point==='report')h.hooks.message=fault;else{const query=h.dom.document.querySelectorAll;h.dom.document.querySelectorAll=selector=>{if(selector.includes('#expense-panel')&&gate.entries[0].settled)fault();return query(selector);};}
 h.hooks.terminal=()=>{assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.throws(()=>h.expenses.open('salary',{fresh:true}),/reload/i);throw Error('Secondary terminal reporter failure');};
 gate.entries[0].fulfill();await operation;assert.ok(faults);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.match(h.expenses.panel(),/reload/i);assert.equal(h.counters.writes,1);gate.restore();
});
for(const kind of ['mortgage','rate'])for(const point of ['navigation','render','report'])test(`${kind} reentrant newer expense at ${point} is never overwritten by old cleanup`,async()=>{
 const h=callbackHarness({kind});h.open();const gate=serviceSaveGate(h.store),name=kind==='rate'?'expense-berthing-rate':'expense-pay',old=h.arg(name),operation=h.action(name);let replaced=false;
 const replacePanel=()=>{if(!gate.entries[0].settled||replaced)return;replaced=true;h.expenses.open('salary',{fresh:true});h.dom.ids.get('message').textContent='Newer expense status';};
 h.hooks[point==='navigation'?'navigate':point==='report'?'message':'render']=replacePanel;gate.entries[0].fulfill();await operation;assert.equal(replaced,true);assert.equal(h.expenses.route().kind,'salary');assert.match(h.expenses.panel(),/Crew salaries/);assert.equal(h.expenses.committing(),false);assert.equal(message(h),'Newer expense status');const route=h.expenses.route(),html=h.expenses.panel(),raw=h.bytes();await h.action(name,old);same(h.expenses.route(),route);assert.equal(h.expenses.panel(),html);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);gate.restore();
});
test('prewrite and terminal expense paths produce no unhandled rejections',async()=>{
 const unhandled=[],listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);try{for(const committed of [false,true]){const h=setup();h.open('mortgage');const gate=serviceSaveGate(h.store),operation=h.pay();if(committed)gate.entries[0].write();gate.entries[0].reject();await operation;await flush();assert.equal(h.store.reloadRequired,true);gate.restore();}await flush();same(unhandled,[]);}finally{process.off('unhandledRejection',listener);}
});
for(const kind of kinds)for(const delayed of [false,true])test(`${delayed?'delayed':'native'} ${kind} reload, recorded date/location, Back and exact History Undo`,async()=>{
 const h=setup(fixture({rate:kind!=='rate'})),before=h.persisted();h.open(kind,edits(kind));const gate=delayed?serviceSaveGate(h.store):null,operation=h.start(kind);gate?.entries[0].fulfill();await operation;gate?.restore();
 const saved=h.persisted(),route=h.expenses.route(),fresh=setup(saved);if(kind!=='rate'){fresh.expenses.open(route.kind,{receiptId:route.receiptId});receipt(fresh);assert.match(fresh.expenses.panel(),/002-1105 · 05:00/);assert.match(fresh.expenses.panel(),/Recorded location: Origin/);await fresh.action('expense-back');assert.match(fresh.expenses.panel(),/Regular 4-week total/);fresh.expenses.close();}
 await fresh.runAction('tab','History');assert.match(fresh.dom.ids.get('main').innerHTML,kind==='rate'?/Saved starport berthing rate/:/Paid /);await fresh.runAction('undo');assert.equal(fresh.persisted().revision,saved.revision+1);for(const key of ['bank','ship','worlds','ledger','hours','dateLabel','route','routeIndex','lots','policies','contracts'])same(fresh.persisted()[key],before[key]);
 if(kind!=='rate'){const traveled=structuredClone(saved);traveled.actual='1,0';traveled.worlds['0,0'].name='Renamed origin';traveled.dateLabel='001-1200';traveled.hours=200;const reopened=setup(traveled);reopened.expenses.open(route.kind,{receiptId:route.receiptId});assert.match(reopened.expenses.panel(),/Recorded location: Origin/);assert.match(reopened.expenses.panel(),/002-1105 · 05:00/);assert.doesNotMatch(reopened.expenses.panel(),/Renamed origin|Recorded location: Destination|001-1200/);}
});
for(const delayed of [false,true])for(const kind of ['mortgage','maintenance','salary','berthing'])test(`${delayed?'delayed':'native'} ${kind} huge Credits and bounded count/rounding oracle`,async()=>{
 const s=fixture({huge:true,zero:kind==='berthing'}),h=setup(s),values=kind==='mortgage'?{payments:'480'}:kind==='maintenance'?{payments:'1000000000'}:kind==='salary'?{monthly:'900719925474099312345',payments:'3'}:{weeks:'1000000000'};
 // Keep the exact huge schedule affordable while exceeding safe integers.
 if(kind==='maintenance'){s.ship.maintenance.payment='900719925474099';s.bank='9007199254740993123456789';}h.external(s);h.open(kind,values);const before=h.persisted(),input={kind,creditStep:100,recurringShip:before.ship,...(kind==='mortgage'?{mortgagePayments:values.payments}:kind==='maintenance'?{maintenancePayments:values.payments}:kind==='salary'?{monthly:values.monthly,months:values.payments}:{weeks:values.weeks})},quote=expenseQuote(before.worlds[before.actual],input),html=h.expenses.panel();assert.ok(html.length<18000);if(kind==='maintenance')assert.match(html,/data-payment-count="1000000000"/);if(kind==='mortgage'||kind==='maintenance'){assert.match(html,/<tbody><\/tbody>/);assert.equal(quote.amount,String(BigInt(before.ship[kind].payment)*BigInt(values.payments)));}if(kind==='berthing')assert.equal(quote.amount,'0');if(kind==='salary')assert.equal(quote.amount,'2702159776422297937100');
 const gate=delayed?serviceSaveGate(h.store):null,operation=h.pay();gate?.entries[0].fulfill();await operation;gate?.restore();assert.equal(h.counters.writes,1);assert.equal(h.persisted().bank,String(BigInt(before.bank)-BigInt(quote.amount)));assert.equal(h.persisted().ledger.at(-1).expense.amount,quote.amount);receipt(h);assert.ok(h.expenses.panel().length<18000);assert.equal(h.persisted().events.filter(e=>e.label==='Rounding applied [R]').length,0,'Fixed values retain their exemption; salary carries its existing quote rounding rather than unrelated input rounding');const oracle=S.transition(before,{mortgage:'Paid mortgage',maintenance:'Paid monthly maintenance',salary:'Paid crew salaries',berthing:'Paid port costs'}[kind],s=>{S.shipExpense(s,input);s.ledger.at(-1).paidAt??={dateLabel:s.dateLabel,hours:s.hours};});same(canonical(h.persisted()),canonical(oracle));
});

for(const point of ['navigation','render','report'])test(`same-session rate→payment reentry during ${point} keeps the new payment busy and separately owned`,async()=>{
 const h=callbackHarness({kind:'rate'});h.open();const gate=serviceSaveGate(h.store),rateArg=h.arg('expense-berthing-rate'),rate=h.action('expense-berthing-rate');let payment,started=false;
 h.hooks[point==='navigation'?'navigate':point==='report'?'message':'render']=()=>{if(!gate.entries[0].settled||started)return;started=true;h.dom.ids.get('main').innerHTML=h.expenses.panel();payment=h.action('expense-pay');};
 gate.entries[0].fulfill();await rate;assert.equal(started,true);assert.equal(gate.entries.length,2);assert.equal(h.expenses.committing(),true,'Old rate finally cannot clear the new payment busy state');assert.equal(h.store.reloadRequired??false,false);assert.equal(h.counters.writes,1);assert.equal(h.calls.expenseDice,1);assert.equal(h.state.ledger.length,0);assert.notEqual(gate.entries[0].args[2],gate.entries[1].args[2]);
 await h.action('expense-berthing-rate',rateArg);assert.equal(gate.entries.length,2);assert.equal(h.calls.expenseDice,1);gate.entries[1].write();assert.equal(h.expenses.committing(),true);gate.entries[1].fulfill();await payment;assert.equal(h.counters.writes,2);assert.equal(h.expenses.committing(),false);assert.equal(h.state.bank,'4997000');assert.match(h.expenses.panel(),/Payment recorded/);assert.equal(h.store.reloadRequired??false,false);gate.restore();
});
for(const kind of ['mortgage','salary','berthing'])test(`${kind} pending edit and sync cannot change captured economic intent`,async t=>{
 const {h,gate,operation}=await pending(t,kind),prepared=structuredClone(gate.entries[0].args[0]);h.fillExpense(kind==='salary'?{monthly:'999999',payments:'4'}:kind==='berthing'?{weeks:'7'}:{payments:'4'});h.expenses.sync();same(gate.entries[0].args[0],prepared);gate.entries[0].fulfill();await operation;same(h.persisted(),prepared);receipt(h);
});
for(const mode of ['same-revision disk change','failed disk read'])test(`typed unwritten retry eligibility fails closed after ${mode}`,async t=>{
 const {h,gate,operation,arg}=await pending(t);if(mode==='same-revision disk change'){const foreign=h.persisted();foreign.bank='4999993';h.external(foreign,{publish:false});}else h.store.read=()=>{throw Error('Injected saved-campaign read failure');};const raw=h.bytes();gate.entries[0].reject(new SaveNotCommittedError(Error('Known expense write rejected')));await operation;assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.equal(h.store.reloadRequired??false,false);assert.match(h.expenses.panel(),/Reload|ownership changed/i);noSuccess(h);const retry=h.action('expense-pay',arg);await flush();assert.equal(gate.entries.length,1);await retry;assert.equal(h.bytes(),raw);
});
for(const replacement of ['same session','new session'])test(`retry-eligibility callback reentry into ${replacement} cannot retire or unlock the newer write`,async()=>{
 const h=callbackHarness();h.open();const gate=serviceSaveGate(h.store),first=h.action();let second,entered=false;
 h.hooks.canRetry=()=>{if(entered)return true;entered=true;if(replacement==='new session')h.expenses.open('salary',{fresh:true});second=h.action();return false;};
 gate.entries[0].reject(new SaveNotCommittedError(Error('First write was not committed')));await first;assert.equal(entered,true);assert.equal(gate.entries.length,2);assert.equal(h.expenses.committing(),true);assert.equal(h.counters.writes,0);assert.equal(h.store.reloadRequired??false,false);const expected=structuredClone(gate.entries[1].args[0]);gate.entries[1].fulfill();await second;assert.equal(h.counters.writes,1);assert.equal(h.expenses.committing(),false);same(h.persisted(),expected);assert.match(h.expenses.panel(),/Payment recorded/);assert.equal(h.store.reloadRequired??false,false);gate.restore();
});

// A hostile host may catch a failed mutator and invoke that same callback again.
// Claim use before mutation work, even when that first mutation-stage call throws.
test('throwing first expense mutator call cannot be reused inside the same attempt; deliberate retry has a fresh callback',async()=>{
 for(const kind of ['mortgage','rate']){
  const h=callbackHarness({kind});h.open();const name=kind==='rate'?'expense-berthing-rate':'expense-pay',raw=h.bytes();let reached=0;
  h.hooks.beforeTransition=fn=>{const changed=structuredClone(h.state);if(kind==='rate')changed.worlds[changed.actual].uwp='B788899-C';else changed.ship.mortgage.payment='100002';assert.throws(()=>fn(changed),kind==='rate'?/Starport changed/:/preview changed/);reached++;h.hooks.beforeTransition=null;};
  await assert.rejects(h.action(name),/callback cannot be reused/);assert.equal(reached,1);assert.equal(h.bytes(),raw);assert.equal(h.counters.writes,0);assert.equal(h.expenses.committing(),false);assert.equal(h.store.reloadRequired??false,false);assert.equal(h.calls.expenseDice,Number(kind==='rate'));
  await h.action(name);assert.equal(h.counters.writes,1);assert.equal(h.calls.expenseDice,Number(kind==='rate'));assert.equal(h.expenses.committing(),false);if(kind==='mortgage')assert.match(h.expenses.panel(),/Payment recorded/);else same(h.state.worlds[h.state.actual].berthingRate,{port:'A',die:3});
 }
});
