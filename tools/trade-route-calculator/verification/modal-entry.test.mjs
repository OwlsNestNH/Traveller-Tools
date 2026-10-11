import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {campaign,core,S,same} from './app-harness.mjs';
import {prepareDeposit,ui,flush} from './deposit-save-harness.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {recordWorldOverride} from '../js/world-change-history.mjs';

// Initial-entry containment only. Execute actual app/controller/Store source;
// test-owned DOM, map transport and storage isolate synthetic campaigns. Extend
// harness exports/boundaries in memory, never replace an application function.
// Native tests do not certify browser layout, gestures or Web Locks.
const harnessURL=new URL('./app-harness.mjs',import.meta.url),storageURL=new URL('./deposit-save-harness.mjs',import.meta.url);
const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
const marker='store=new Store(receiveCampaign,',start=app.indexOf(marker);assert.ok(start>=0);
const role=app.slice(start+marker.length).split(');try{state=store.read();}')[0];assert.ok(role.startsWith('(editable,text)=>'));
const absolutize=(source,url)=>source.replaceAll('import.meta.url',JSON.stringify(url.href)).replace(/from '(\.[^']+)'/g,(_all,path)=>'from '+JSON.stringify(new URL(path,url).href));
function replace(source,from,to){assert.ok(source.includes(from),'Existing harness boundary: '+from);return source.replace(from,to);}
let harnessSource=absolutize(await readFile(harnessURL,'utf8'),harnessURL);
harnessSource=replace(harnessSource,'clearTimeout:cancel=clearTimeout}={}','clearTimeout:cancel=clearTimeout,mapControl,entryProbe}={}');
harnessSource=replace(harnessSource,'...bindings,R:rules,document:dom.document','...bindings,M:{...bindings.M,nearby:(...args)=>mapControl.nearby(...args)},createWorldPicker:(...args)=>mapControl.createPicker(...args),R:rules,document:dom.document');
harnessSource=replace(harnessSource,'FormData:dom.FormData','FormData:class extends dom.FormData{constructor(...args){entryProbe.formData++;if(entryProbe.failFormData){entryProbe.failFormData=false;throw Error("Injected FormData construction fault");}super(...args);}}');
harnessSource=replace(harnessSource,"'takeover','import-file'","'takeover','setup-world','import-file'");
harnessSource=replace(harnessSource,'globalThis.api={setStore','globalThis.api={setup,setLocation,roleChange:'+role+',setStore');
const harnessModule='data:text/javascript;base64,'+Buffer.from(harnessSource).toString('base64');
let storageSource=absolutize(await readFile(storageURL,'utf8'),storageURL);
storageSource=replace(storageSource,JSON.stringify(harnessURL.href),JSON.stringify(harnessModule));
const {depositHarness}=await import('data:text/javascript;base64,'+Buffer.from(storageSource).toString('base64'));
const paths=['deposit','time','reset','import','settings','setup','location','jump','undoJump','worldRevert','generic','readOnly'];
const writes=new Set(paths.slice(0,10));
const reason='Retained initial-entry review';
const setupDraft={name:'Entry containment campaign',ship:'Entry Trader',bank:'100000.1',capacity:'100.1',jump:'2',date:'032-1105',shipTons:'200',fuelCapacity:'40',fuelAboard:'40',bladderTons:'0','rooms-middle':'2','people-middle':'2',supportCapacity:'28',supportRemaining:'14',supportUnits:'28'};
const event=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
const fields=h=>Object.fromEntries([...h.dom.fields()].map(([name,field])=>[name,{value:field.value,checked:!!field.checked}]));
const material=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','events','undo','jumpAttempts','dashboardBaseline'].includes(key)));
function fixture(){const s=campaign();s.ship.capacity='100';s.ship.fuel=configureFuel(200,40,60,40,2);s.ship.staterooms=2;s.ship.accommodation={rooms:{low:0,middle:2,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}};s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}};return S.validate(s);}
function jumped(s){const p=S.prepareJump(s,()=>({dice:[3,3,3,3,3,3],total:18}));return S.transition(p.state,'Jump: Origin → Destination',n=>S.commitJump(n,{attemptId:p.attempt.id,elapsed:160}));}
function worldEdited(){const s=fixture();return S.transition(s,'World override',n=>recordWorldOverride(n,n.actual,{uwp:'A788899-D',zone:'Safe',fuelOverride:null,accessibleWater:false,reason:'Synthetic survey'},core));}
function create(path){
 const original=fixture(),saved=path==='setup'?S.initial():path==='undoJump'?jumped(original):path==='worldRevert'?worldEdited():original;
 const map={calls:{resolve:0,nearby:0,create:0},selected:original.worlds['1,0'],createPicker(){this.calls.create++;return {resolve:async()=>{this.calls.resolve++;return this.selected;}};},async nearby(){this.calls.nearby++;return Object.values(original.worlds);}};
 const probe={formData:0,normalise:0,callback:0,dice:0,provider:0,failFormData:false},h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){},mapControl:map,entryProbe:probe});
 h.hooks.onRole=(editable,text)=>h.api.roleChange(editable,text);
 const form=h.dom.ids.get('modal-form'),query=form.querySelectorAll;form.querySelectorAll=selector=>{if(selector==='[data-round]')probe.normalise++;return selector==='input,select,textarea,button'?[...h.dom.fields().values()]:query(selector);};
 for(const method of ['save','replace']){const native=h.store[method];h.store[method]=function(...args){probe.provider++;return native.apply(this,args);};}
 const prepare=h.api.controller.prepareJump;h.api.controller.prepareJump=(roll,expected)=>prepare(()=>{probe.dice++;return roll();},expected);
 return {...h,path,map,probe,original};
}
async function open(h){
 if(h.path==='deposit')await prepareDeposit(h,'10.1');
 else if(h.path==='time'){h.api.actions.time();h.fill({date:'001-1105',hours:25,reason});}
 else if(h.path==='reset'||h.path==='import'){if(h.path==='reset')h.api.actions.reset();else{h.imported=fixture();h.imported.name='Imported review';h.imported.bank='123456';h.api.backupReplace('Load campaign (JSON)',h.imported);}h.fill({backed:true});}
 else if(h.path==='settings'){h.api.actions['settings-edit']();h.fill({name:'Retained Settings name',capacity:'100.1',broker:'3'});}
 else if(h.path==='setup'){await h.api.setup();h.fill(setupDraft);}
 else if(h.path==='location'){h.api.setLocation(h.map.selected);h.fill({reason});}
 else if(h.path==='jump'){await h.runAction('jump');h.fill({hours:160});}
 else if(h.path==='undoJump')h.api.actions['jump-undo']();
 else if(h.path==='worldRevert')h.api.actions['world-field-revert'](h.api.state.events.findLast(e=>e.worldChangeAudit).id+'|techLevel');
 else{if(h.path==='readOnly')h.store.editable=false;h.api.modal(h.path==='readOnly'?'Read-only browse':'Ordinary generic review','<input name="detail" value="retain me">',()=>{h.probe.callback++;return h.callbackDelay?new Promise(resolve=>{h.callbackResolve=()=>resolve(false);}):false;},'Continue',h.path!=='readOnly');}
 assert.equal(ui(h).modalOpen,true);assert.equal(ui(h).submitDisabled,false);return h;
}
const snapshot=h=>({raw:h.bytes(),state:structuredClone(h.api.state),probe:{...h.probe},counters:{...h.counters},map:{...h.map.calls},rounding:structuredClone(h.api.inputRounding),fields:fields(h),body:h.dom.ids.get('modal-body').innerHTML,title:ui(h).modalTitle,message:ui(h).message,session:h.api.modalSession});
function noEntry(h,b,{normalize=true,presentation=true}={}){
 assert.equal(h.bytes(),b.raw,'No new durable write');same(h.api.state,b.state);same(h.counters,b.counters);same(h.map.calls,b.map);
 for(const key of ['provider','callback','dice'])assert.equal(h.probe[key],b.probe[key],'No '+key+' entry');
 if(normalize){assert.equal(h.probe.normalise,b.probe.normalise);assert.equal(h.probe.formData,b.probe.formData);same(h.api.inputRounding,b.rounding);same(fields(h),b.fields);}
 if(presentation){assert.equal(h.dom.ids.get('modal-body').innerHTML,b.body);assert.equal(ui(h).modalTitle,b.title);assert.equal(ui(h).message,b.message);}
}
function recovered(h,b){assert.equal(h.api.modalSession,b.session);assert.equal(b.session.busy,false);assert.equal(b.session.terminal,false);assert.equal(h.store.reloadRequired??false,false);assert.equal(h.store.editable,h.path!=='readOnly');assert.equal(ui(h).modalOpen,true);assert.match(ui(h).modalError,/Injected/);assert.equal(ui(h).submitDisabled,false);for(const id of ['modal-cancel','modal-close'])assert.equal(h.dom.ids.get(id).disabled,false);if(h.path==='jump')assert.equal(h.dom.fields().get('hours').readOnly,false);}
function fault(h,target='modal-submit',hook){
 const field=target==='hours',node=field?h.dom.fields().get('hours'):h.dom.ids.get(target),property=field?'readOnly':'disabled';let value=node[property],calls=0,partial;
 Object.defineProperty(node,property,{configurable:true,get:()=>value,set(next){if(++calls===1){partial={submit:h.dom.ids.get('modal-submit').disabled,cancel:h.dom.ids.get('modal-cancel').disabled,close:h.dom.ids.get('modal-close').disabled,busy:h.api.modalSession.busy};hook?.();throw Error('Injected initial '+target+' setter fault');}value=next;}});
 return {get calls(){return calls;},get partial(){return partial;}};
}
function gate(store,method){const native=store[method],entries=[];store[method]=function(...args){let yes,no;const promise=new Promise((resolve,reject)=>{yes=resolve;no=reject;});promise.catch(()=>{});const entry={args,settled:false,finish(){assert.equal(this.settled,false);this.settled=true;try{yes(native.apply(store,args));}catch(error){no(error);}}};entries.push(entry);return promise;};return {entries,restore(){store[method]=native;}};}
function assertSaved(h,b){
 const after=h.persisted();assert.equal(after.revision,b.state.revision+1);assert.equal(h.probe.provider,b.probe.provider+1,'Exactly one real provider invocation');assert.equal(h.counters.writes,b.counters.writes+1);assert.equal(h.counters.attempts,b.counters.attempts+1);assert.equal(ui(h).modalOpen,false);assert.equal(h.store.reloadRequired??false,false);
 if(['reset','import'].includes(h.path)){const wanted=structuredClone(h.path==='reset'?S.initial():h.imported);wanted.revision=after.revision;if(wanted.initialized&&!wanted.dashboardBaseline)wanted.dashboardBaseline=createDashboardBaseline(wanted);same(after,wanted);return;}
 assert.equal(after.undo.length,b.state.undo.length+(h.path==='undoJump'?-1:1));
 if(h.path==='deposit'){assert.equal(after.bank,String(BigInt(b.state.bank)+11n));assert.equal(after.ledger.at(-1).amount,'11');assert.ok(after.events.some(e=>e.label==='Rounding applied [R]'));}
 if(h.path==='time')assert.equal(after.hours,25);
 if(h.path==='settings'){assert.equal(after.name,'Retained Settings name');assert.equal(after.ship.capacity,'101');assert.equal(after.trader.broker,3);}
 if(h.path==='setup'){assert.equal(after.bank,'100001');assert.equal(after.ship.capacity,'101');assert.equal(after.actual,h.map.selected.id);}
 if(h.path==='location'){assert.equal(after.actual,h.map.selected.id);assert.equal(after.bank,b.state.bank);}
 if(h.path==='jump'){assert.equal(after.actual,'1,0');assert.equal(after.hours,b.state.hours+160);same(after.jumpAttempts,b.state.jumpAttempts);assert.equal(h.probe.dice,b.probe.dice);assert.equal(S.jumpUndoEligibility(after).allowed,true);}
 if(h.path==='undoJump'){same(material(after),material(h.original));assert.equal(after.jumpAttempts[0].mulliganUsed,true);}
 if(h.path==='worldRevert'){assert.equal(after.worlds[after.actual].overrideUWP??after.worlds[after.actual].uwp,'A788899-C');assert.equal(after.events.findLast(e=>e.worldChangeAudit).worldChangeAudit.kind,'revert');}
}

for(const path of paths)for(const target of ['modal-submit','modal-cancel','modal-close',...(path==='jump'?['hours']:[])])test(`${path}: one-shot initial ${target} failure releases partial control sync and remains dismissible`,async()=>{
 const h=await open(create(path)),b=snapshot(h),f=fault(h,target);await h.submit();noEntry(h,b);recovered(h,b);assert.ok(f.calls>=2);assert.equal(f.partial.busy,true);if(target!=='modal-submit')assert.equal(f.partial.submit,true,'Earlier submit mutation really occurred');if(target==='modal-close')assert.equal(f.partial.cancel,!!b.session.awaitSave,'Earlier Cancel mutation really occurred');
 h.dom.ids.get(target==='modal-close'?'modal-close':'modal-cancel').onclick();assert.equal(ui(h).modalOpen,false);assert.equal(h.bytes(),b.raw);
});
for(const path of paths)for(const delayed of [false,true])test(`${path}: explicit ${delayed?'delayed':'synchronous'} retry after entry fault invokes only one callback/provider`,async t=>{
 const h=await open(create(path)),b=snapshot(h),detached=h.dom.ids.get('modal-form').onsubmit;fault(h,path==='jump'?'hours':'modal-close');await h.submit();noEntry(h,b);recovered(h,b);
 const g=delayed&&writes.has(path)?gate(h.store,['reset','import'].includes(path)?'replace':'save'):null;t.after(()=>g?.restore());
 if(delayed&&!writes.has(path))h.callbackDelay=true;
 const retry=h.submit();if(g){await flush();assert.equal(g.entries.length,1);assert.equal(h.bytes(),b.raw);assert.equal(h.api.modalSession.busy,true);await h.submit();await detached(event(h));assert.equal(g.entries.length,1);g.entries[0].finish();}else if(h.callbackDelay){await flush();assert.equal(h.api.modalSession.busy,true);assert.equal(h.probe.callback,1);await h.submit();await detached(event(h));assert.equal(h.probe.callback,1);h.callbackResolve();}await retry;
 if(writes.has(path)){assertSaved(h,b);const raw=h.bytes(),providers=h.probe.provider;await detached(event(h));assert.equal(h.bytes(),raw);assert.equal(h.probe.provider,providers);g?.restore();if(!['reset','import','undoJump','setup'].includes(path)){await h.runAction('undo');same(material(h.persisted()),material(b.state));}}
 else{assert.equal(h.probe.callback,1);assert.equal(h.probe.provider,b.probe.provider);assert.equal(h.bytes(),b.raw);h.api.closeModal();}
});
for(const path of paths)for(const type of ['normalise','FormData'])test(`${path}: ${type} failure remains pre-callback and recovers without a saved/unknown classification`,async()=>{
 const h=await open(create(path)),b=snapshot(h);if(type==='FormData')h.probe.failFormData=true;else{const form=h.dom.ids.get('modal-form'),query=form.querySelectorAll;let failed=false;form.querySelectorAll=selector=>{if(selector==='[data-round]'&&!failed){failed=true;throw Error('Injected normalization fault');}return query(selector);};}
 await h.submit();noEntry(h,b,{normalize:false});recovered(h,b);h.api.closeModal();assert.equal(h.bytes(),b.raw);
});
for(const path of paths)test(`${path}: reentrant submit during initial setter is coalesced before callback`,async()=>{
 const h=await open(create(path)),b=snapshot(h);let nested;fault(h,'modal-cancel',()=>{nested=h.submit();});await h.submit();await nested;noEntry(h,b);recovered(h,b);h.api.closeModal();
});
for(const path of paths)for(const change of ['newer modal','foreign publication','editor loss'])test(`${path}: initial setter fault after ${change} cannot touch newer presentation or revive detached submit`,async()=>{
 const h=await open(create(path)),b=snapshot(h),detached=h.dom.ids.get('modal-form').onsubmit;let newer,presentation;
 fault(h,'modal-submit',()=>{
  if(change==='foreign publication')h.external(structuredClone(h.persisted()));
  if(change==='editor loss'){h.store.yield();h.store.editable=true;h.store.onRole(true,'Editing again');}
  const dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer review','<input name="detail" value="newer retained value">',()=>false,'Continue',false);newer=h.api.modalSession;newer.valid=false;h.api.syncModalSubmit();presentation={...ui(h),body:h.dom.ids.get('modal-body').innerHTML,fields:fields(h),cancel:h.dom.ids.get('modal-cancel').disabled,close:h.dom.ids.get('modal-close').disabled};
 });
 await h.submit();assert.equal(h.api.modalSession,newer);assert.deepEqual({...ui(h),body:h.dom.ids.get('modal-body').innerHTML,fields:fields(h),cancel:h.dom.ids.get('modal-cancel').disabled,close:h.dom.ids.get('modal-close').disabled},presentation);assert.equal(ui(h).modalError,'');assert.equal(ui(h).submitDisabled,true);assert.equal(newer.busy,false);assert.equal(h.bytes(),b.raw);assert.equal(h.probe.provider,b.probe.provider);assert.equal(h.probe.callback,b.probe.callback);assert.equal(h.probe.dice,b.probe.dice);same(h.counters,{...b.counters,notifications:b.counters.notifications+(change==='foreign publication'?1:0)});same(h.map.calls,b.map);
 await detached(event(h));assert.equal(h.api.modalSession,newer);assert.equal(h.bytes(),b.raw);assert.equal(ui(h).modalError,'');assert.equal(h.probe.provider,b.probe.provider);
});
// These are existing persistent-cleanup limitations, deliberately separate
// from the transient acceptance gate. No claim of retryability is made here.
for(const path of ['deposit','reset','settings','time'])test(`${path}: characterize unchanged persistent cleanup fallback after normalization error`,async()=>{
 const h=await open(create(path)),b=snapshot(h),form=h.dom.ids.get('modal-form'),query=form.querySelectorAll,submit=h.dom.ids.get('modal-submit');let normalise=false,sets=0,value=submit.disabled;
 form.querySelectorAll=selector=>{if(selector==='[data-round]'&&!normalise){normalise=true;throw Error('Injected normalization fault');}return query(selector);};Object.defineProperty(submit,'disabled',{configurable:true,get:()=>value,set(next){if(++sets>=2)throw Error('Injected persistent cleanup fault');value=next;}});
 if(path==='time')await h.submit();else await assert.rejects(h.submit(),/persistent cleanup/);
 assert.equal(h.bytes(),b.raw);same(h.counters,b.counters);assert.equal(h.probe.provider,b.probe.provider);assert.equal(h.api.modalSession.busy,false);assert.equal(ui(h).submitDisabled,true);
 if(path==='time'){assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.match(ui(h).modalError,/could not be confirmed|Reload/i);}
 else{assert.equal(h.store.reloadRequired??false,false);assert.equal(h.store.editable,true);for(const id of ['modal-cancel','modal-close'])assert.equal(h.dom.ids.get(id).disabled,true);}
});
test('actual no-submit read-only audit never enters synchronization or a callback',async()=>{
 const h=create('generic');h.store.editable=false;h.api.modal('Read-only audit','Retained audit',null);const b=snapshot(h);let touched=0;const button=h.dom.ids.get('modal-submit');Object.defineProperty(button,'disabled',{configurable:true,get:()=>false,set(){touched++;throw Error('Must not run');}});await h.submit();assert.equal(touched,0);assert.equal(h.dom.ids.get('modal-submit').hidden,true);noEntry(h,b);h.api.closeModal();assert.equal(ui(h).modalOpen,false);
});
