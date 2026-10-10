import test from 'node:test';
import assert from 'node:assert/strict';
import {depositHarness,campaign,S,same,ui,flush} from './deposit-save-harness.mjs';
import {serviceSaveGate} from './service-save-harness.mjs';
import {core,bindings} from './app-harness.mjs';
import {recordMailCheck,latestMailCheck} from '../js/mail-history.mjs';
import {configureFuel} from '../js/fuel.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import {dashboardData} from '../js/dashboard-data.mjs';
import {recordWorldOverride,revertWorldField,worldFieldRevertEligibility} from '../js/world-change-history.mjs';

// Actual app callbacks, controller and Store with private synthetic storage.
// The provider gate executes the real save body; DOM doubles do not certify
// browser gestures or native Web Locks (the paired browser suite does that).
const drafts=[{offerId:'undo-freight',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true}}];
const material=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['revision','jumpAttempts','events','undo'].includes(key)));
const noSuccess=h=>assert.doesNotMatch(ui(h).message,/Jump undone\.|Latest action undone\./);
const submitEvent=h=>({preventDefault(){},currentTarget:h.dom.ids.get('modal-form')});
function fixture(){
 const s=campaign();s.ship.capacity='100';s.ship.fuel=configureFuel(200,40,60,40,2);s.ship.staterooms=2;
 s.ship.accommodation={rooms:{low:0,middle:2,high:0},passengers:{low:0,middle:0,high:0},crew:{low:0,middle:2,high:0}};s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'56',denominator:'1'}};
 s.lots=[{id:'undo-cargo',commodity:'11',description:'Saved cargo',quantity:'5',basis:'1000',goodsValue:'1000'}];
 s.contracts=[{id:'undo-mail-contract',kind:'mail',status:'accepted',firstDeparture:null,origin:'0,0',destination:'1,0',quantity:'5',payment:'1000',dueHours:null}];
 s.policies=[{id:'undo-policy',lotId:'undo-cargo',claims:[],status:'active',initialQuantity:'5',remainingQuantity:'5',insuredValue:'1000',remainingValue:'1000',coverage:70,route:['0,0','1,0'],routeProgress:0,destination:'1,0'}];
 s.snapshots=[{id:'undo-supplier',kind:'supplier',worldId:'0,0',hours:0,startedHours:0,party:'Retained supplier',offers:[{id:'undo-stock',commodity:'11',description:'Saved offer',expired:false,remaining:'2',unitPrice:'100'}]}];
 s.dashboardBaseline=createDashboardBaseline(s);return S.validate(s);
}
function jump(s=fixture()){const p=S.prepareJump(s,()=>({dice:[3,3,3,3,3,3],total:18}));return S.transition(p.state,'Jump: Origin → Destination',next=>S.commitJump(next,{attemptId:p.attempt.id,elapsed:160}));}
const deposited=(label='Manual deposit')=>S.transition(fixture(),label,s=>S.deposit(s,125,'Undo fixture'));
const setup=(saved=deposited())=>{const h=depositHarness(saved,{setTimeout:()=>0,clearTimeout(){}});h.api.setTab('History');h.api.render();return h;};
function exactUndo(saved,before){const expected=S.undo(before);expected.events.at(-1).id=saved.events.at(-1).id;same(saved,expected);assert.equal(saved.revision,before.revision+1);assert.equal(saved.undo.length,before.undo.length-1);same(saved.events.slice(0,-1),before.events);assert.equal(saved.events.at(-1).label,'Undo: '+before.undo.at(-1).label);}
function begin(h,path){if(path==='jump'){h.api.actions['jump-undo']();assert.match(ui(h).modalTitle,/Undo Jump/);return h.submit();}return h.runAction('undo');}
async function pending(t,path,h=setup(path==='jump'?jump():deposited())){
 const before=structuredClone(h.api.state),raw=h.bytes(),gate=serviceSaveGate(h.store),operation=begin(h,path);operation?.catch(()=>{});await flush();assert.equal(gate.entries.length,1);
 t.after(async()=>{for(const entry of gate.entries)if(!entry.settled)entry.fulfill();await operation;gate.restore();});
 return {h,before,raw,gate,operation,session:h.api.modalSession,detached:h.dom.ids.get('modal-form').onsubmit};
}
function busy(h,session){assert.equal(ui(h).modalOpen,true);assert.equal(h.api.modalSession,session);assert.equal(session.busy,true);assert.equal(ui(h).submitDisabled,true);for(const id of ['modal-cancel','modal-close'])assert.equal(h.dom.ids.get(id).disabled,true);noSuccess(h);}
function terminal(h){assert.equal(h.store.editable,false);assert.equal(h.store.reloadRequired,true);assert.equal(ui(h).submitDisabled,true);assert.equal(h.dom.ids.get('takeover').disabled,true);for(const id of ['message','save-status','modal-error'])assert.match(h.dom.ids.get(id).textContent,/reload/i);noSuccess(h);}
async function retry(h,path){if(path==='jump')return h.submit();h.api.closeModal();return h.runAction('undo');}

test('synchronous History Undo remains immediate and controller Undo returns raw provider completion',async()=>{
 const h=setup(),before=h.persisted(),result=h.api.actions.undo();assert.equal(result,undefined);assert.equal(ui(h).modalOpen,false);assert.equal(h.counters.writes,1);exactUndo(h.persisted(),before);assert.equal(ui(h).message,'Latest action undone.');
 for(const path of ['undo','undoJump'])for(const asynchronous of [false,true]){
  const c=setup(path==='undoJump'?jump():deposited()),native=c.store.save,sentinel={provider:'raw completion'};c.store.save=function(...args){native.apply(this,args);return asynchronous?Promise.resolve(sentinel):sentinel;};
  const value=c.api.controller[path](c.api.state.revision);if(asynchronous){assert.equal(typeof value.then,'function');assert.equal(await value,sentinel);}else assert.equal(value,sentinel);assert.equal(c.counters.writes,1);
 }
});

test('synchronous dedicated Undo Jump requires confirmation and preserves exact economics, immutable audit and one mulligan',async()=>{
 const original=fixture(),h=setup(jump(original)),before=h.persisted();h.api.actions['jump-undo']();assert.equal(h.counters.writes,0);h.api.closeModal();assert.equal(h.bytes(),JSON.stringify(before));
 h.api.actions['jump-undo']();const result=h.submit();assert.equal(h.counters.writes,1);assert.equal(h.api.view,'0,0');await result;exactUndo(h.persisted(),before);same(material(h.persisted()),material(original));assert.equal(h.persisted().jumpAttempts[0].mulliganUsed,true);
 const fresh=setup(h.store.read());fresh.api.actions.jump();const rerolled=fresh.persisted();assert.equal(rerolled.jumpAttempts[0].rolls.length,2);fresh.api.closeModal();fresh.api.actions.jump();same(fresh.persisted(),rerolled);fresh.fill({hours:160});await fresh.submit();assert.equal(S.jumpUndoEligibility(fresh.persisted()).allowed,false);
 await fresh.runAction('undo');assert.match(ui(fresh).message,/Cannot undo this protected jump/);assert.equal(fresh.persisted().events.filter(e=>e.label.startsWith('Undo: Jump')).length,1);
});

for(const path of ['history','jump'])test(`delayed ${path} Undo retains its owned UI until durable write AND publication completion`,async t=>{
 const h=setup(path==='jump'?jump():deposited());h.api.setDrafts(structuredClone(drafts));h.api.setSelected(['undo-cargo']);h.api.setView('1,0');const {gate,operation,before,raw,session}=await pending(t,path,h);
 assert.equal(h.bytes(),raw);same(h.api.state,before);busy(h,session);same(h.api.drafts,drafts);same(h.api.selected,['undo-cargo']);assert.equal(h.api.view,'1,0');
 gate.entries[0].write();exactUndo(h.persisted(),before);busy(h,session);same(h.api.drafts,drafts);same(h.api.selected,['undo-cargo']);assert.equal(h.api.view,'1,0','Publication alone cannot clear jump previews');
 gate.entries[0].fulfill();await operation;assert.equal(h.counters.writes,1);assert.equal(ui(h).modalOpen,false);assert.match(ui(h).message,/undone\./);if(path==='jump'){same(h.api.drafts,[]);same(h.api.selected,[]);assert.equal(h.api.view,'0,0');}else{same(h.api.drafts,drafts);same(h.api.selected,['undo-cargo']);}
 assert.equal(h.bytes(),JSON.stringify(gate.entries[0].args[0]));for(const observation of h.trace)assert.doesNotMatch(observation.message,/undone\./,'No success before completion');
});

for(const path of ['history','jump'])test(`pending ${path} Undo coalesces repeats, detached submit, dismissal and replacement modal`,async t=>{
 const {h,gate,operation,session,detached,raw}=await pending(t,path),body=h.dom.ids.get('modal-body').innerHTML;
 const repeat=h.runAction(path==='jump'?'jump-undo':'undo');await h.submit();await detached(submitEvent(h));h.dom.ids.get('modal-cancel').onclick();h.dom.ids.get('modal-close').onclick();let prevented=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);
 h.api.modal('Unrelated replacement','<p>Must not replace pending Undo</p>',null);await h.runAction('reset');busy(h,session);assert.equal(h.dom.ids.get('modal-body').innerHTML,body);assert.equal(h.bytes(),raw);assert.equal(gate.entries.length,1);
 gate.entries[0].fulfill();await operation;await repeat;const bytes=h.bytes();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);
});

for(const path of ['history','jump'])test(`known ${path} Undo failure preserves exact saved bytes for one deliberate retry`,async t=>{
 const {h,gate,operation,before,raw}=await pending(t,path);h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),raw);same(h.api.state,before);assert.equal(h.store.reloadRequired??false,false);assert.match(ui(h).modalError,/quota/i);noSuccess(h);assert.equal(h.api.modalSession.busy,false);
 if(path==='history'){assert.equal(h.dom.ids.get('modal-submit').hidden,true);assert.match(h.dom.ids.get('modal-body').innerHTML,/close.*undo|close.*try/i);}else assert.equal(ui(h).submitDisabled,false);
 const retried=retry(h,path);await flush();assert.equal(gate.entries.length,2);assert.equal(gate.entries[1].args[1],before.revision);const repeated=h.runAction(path==='jump'?'jump-undo':'undo');gate.entries[1].fulfill();await retried;await repeated;exactUndo(h.persisted(),before);assert.equal(h.counters.writes,1);assert.equal(h.counters.attempts,2);
});

for(const path of ['history','jump'])for(const point of ['beforeNotify','afterNotify'])for(const roleThrows of [false,true])test(`${path} Undo durable ${point} failure is reload-only; role callback throws=${roleThrows}`,async t=>{
 const {h,gate,operation,before,detached}=await pending(t,path);h.hooks[point]=()=>{throw Error('Injected '+point+' fault');};if(roleThrows)h.hooks.onRole=()=>{h.hooks.onRole=null;throw Error('Injected role fault');};gate.entries[0].fulfill();await operation;terminal(h);exactUndo(h.persisted(),before);
 const bytes=h.bytes();await detached(submitEvent(h));await h.runAction('undo');await h.runAction('jump-undo');await h.store.acquire(true);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);terminal(h);const fresh=setup(h.store.read());assert.equal(fresh.bytes(),bytes);assert.equal(fresh.counters.writes,0);
});

for(const path of ['history','jump'])for(const afterWrite of [false,true])test(`${path} Undo unknown ${afterWrite?'after':'before'} write locks until reload without replay`,async t=>{
 const {h,gate,operation,before,raw,detached}=await pending(t,path);if(afterWrite)gate.entries[0].write();gate.entries[0].reject();await operation;terminal(h);if(afterWrite)exactUndo(h.persisted(),before);else assert.equal(h.bytes(),raw);
 const bytes=h.bytes();await detached(submitEvent(h));await h.runAction('undo');await h.store.acquire(true);h.external(structuredClone(h.persisted()));terminal(h);assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);const fresh=setup(h.store.read());assert.equal(fresh.bytes(),bytes);assert.equal(fresh.counters.writes,0);
});

for(const path of ['history','jump'])for(const loss of ['disk revision','published revision','editing authority'])test(`late ${path} Undo respects ${loss} and current authoritative campaign`,async t=>{
 const {h,gate,operation}=await pending(t,path);if(loss==='editing authority')h.store.yield();else h.external(S.transition(h.persisted(),'External deposit',s=>S.deposit(s,23,'Other tab')),{publish:loss==='published revision'});
 const bytes=h.bytes(),current=structuredClone(h.api.state),writes=h.counters.writes;gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);same(h.api.state,current);assert.equal(h.counters.writes,writes);noSuccess(h);assert.match(ui(h).modalError,/stale|changed|editing|read-only/i);
});

for(const path of ['history','jump'])for(const afterWrite of [false,true])for(const outcome of (afterWrite?['fulfillment']:['fulfillment','known failure']))test(`${path} Undo foreign same-revision publication ${afterWrite?'after':'before'} write retires cleanup after ${outcome}`,async t=>{
 const {h,gate,operation,before,detached}=await pending(t,path);if(afterWrite)gate.entries[0].write();h.external(structuredClone(h.persisted()));h.api.setDrafts(structuredClone(drafts));h.api.setSelected(['undo-cargo']);h.api.setView('1,0');if(outcome==='known failure')h.failNext();gate.entries[0].fulfill();await operation;
 if(outcome==='fulfillment')exactUndo(h.persisted(),before);else same(h.persisted(),before);same(h.api.drafts,drafts);same(h.api.selected,['undo-cargo']);assert.equal(h.api.view,'1,0');noSuccess(h);const bytes=h.bytes();await detached(submitEvent(h));assert.equal(gate.entries.length,1);assert.equal(h.bytes(),bytes);
});

for(const path of ['history','jump'])test(`${path} Undo loses ownership after durable write without late view/draft cleanup`,async t=>{
 const {h,gate,operation,before}=await pending(t,path);gate.entries[0].write();h.store.yield();h.api.setDrafts(structuredClone(drafts));h.api.setSelected(['undo-cargo']);h.api.setView('1,0');const bytes=h.bytes();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),bytes);exactUndo(h.persisted(),before);same(h.api.drafts,drafts);same(h.api.selected,['undo-cargo']);assert.equal(h.api.view,'1,0');noSuccess(h);
});

for(const path of ['history','jump'])test(`${path} Undo cleanup render exception after fulfillment is a committed reload-only failure`,async t=>{
 const {h,gate,operation,before}=await pending(t,path);let injected=false;const main=h.dom.ids.get('main');let value=main.innerHTML;
 Object.defineProperty(main,'innerHTML',{get:()=>value,set(next){if(gate.entries[0].settled&&!injected){injected=true;throw Error('Injected post-Undo render fault');}value=next;}});
 gate.entries[0].fulfill();await operation;assert.equal(injected,true);terminal(h);assert.match(ui(h).modalError,/saved/i);exactUndo(h.persisted(),before);const bytes=h.bytes();await h.submit();assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);
});

function checkedCampaign(label){
 const append=(state,id,combined)=>S.transition(state,combined?'Contract search':'Mail check',next=>recordMailCheck(next,{id,label:combined?'Contract search audit':'Mail check audit',hours:next.hours,world:'0,0',destination:'1,0',mailAudit:{dice:{dice:[6,6],total:12},modifiers:{freight:1,armed:0,lowTech:0,rank:0,soc:0},total:13,target:12,count:{dice:[1],total:1}},searchDice:{dice:[4,4],total:8},offers:[...drafts,{offerId:id+'-mail',kind:'mail',origin:'0,0',destination:'1,0',quantity:'5',payment:'25000',dueHours:null,audit:{manual:true}}]}));
 let s=append(fixture(),'earlier-mail-check',false);s=append(s,'current-mail-check',label==='Contract search');if(label==='Contract offer edited')s=S.transition(s,label,next=>{next.notes='Edited retained offer';});return s;
}
for(const label of ['Mail check','Contract search','Contract offer edited'])test(`${label} History Undo preserves valid mail/freight session data until completion, then only label-specific cleanup`,async t=>{
 const saved=checkedCampaign(label),offers=latestMailCheck(saved).offers,h=setup(saved);h.api.setTab('Contracts');h.api.render();h.api.setTab('History');h.api.render();h.api.setDrafts(structuredClone(offers));const check=structuredClone(h.api.check),{gate,operation}=await pending(t,'history',h);
 same(h.api.drafts,offers);same(h.api.check,check);gate.entries[0].write();same(h.api.drafts,offers);same(h.api.check,check);gate.entries[0].fulfill();await operation;same(h.api.drafts,label==='Mail check'?offers.filter(d=>d.kind!=='mail'):[]);assert.notEqual(h.api.check?.checkId,'current-mail-check','No live current mail preview survives this Undo');
});
for(const label of ['Mail check','Contract search','Contract offer edited'])test(`${label} late Undo cannot clear a replacement session's freight offers`,async t=>{
 const {h,gate,operation}=await pending(t,'history',setup(checkedCampaign(label)));h.external(structuredClone(h.persisted()));h.api.setDrafts(structuredClone(drafts));gate.entries[0].fulfill();await operation;same(h.api.drafts,drafts);noSuccess(h);
});

test('delayed History Undo restores only the latest World Changes field correction and retains later economic history',async t=>{
 let s=fixture();s=S.transition(s,'World override',next=>recordWorldOverride(next,'0,0',{uwp:'A788899-D',zone:'Amber',fuelOverride:true,accessibleWater:true,reason:'Survey'},core));const source=s.events.findLast(e=>e.worldChangeAudit);
 s=jump(s);s=S.transition(s,'Manual deposit',next=>S.deposit(next,75,'Later receipt'));s=S.transition(s,'World field reverted',next=>revertWorldField(next,source.id,'techLevel',core));const {h,gate,operation,before}=await pending(t,'history',setup(s));gate.entries[0].fulfill();await operation;exactUndo(h.persisted(),before);const saved=h.persisted();assert.equal(saved.worlds['0,0'].overrideUWP,'A788899-D');assert.equal(saved.worlds['0,0'].zone,'Amber');assert.equal(saved.worlds['0,0'].fuelOverride,true);assert.equal(saved.worlds['0,0'].accessibleWater,true);
 for(const key of ['bank','ship','contracts','policies','lots','snapshots','ledger','actual','hours','jumpAttempts','dashboardBaseline'])same(saved[key],before[key]);assert.equal(worldFieldRevertEligibility(saved,source.id,'techLevel',core).allowed,true);assert.equal(S.jumpUndoEligibility(saved).allowed,false);
});

test('delayed History Undo crosses Dashboard baseline without rewriting it or treating the correction as profit',async t=>{
 const source=deposited();source.dashboardBaseline=createDashboardBaseline(source);const {h,gate,operation,before}=await pending(t,'history',setup(source));gate.entries[0].fulfill();await operation;exactUndo(h.persisted(),before);same(h.persisted().dashboardBaseline,source.dashboardBaseline);const data=dashboardData(h.persisted());assert.equal(data.currentBank,'100000');assert.equal(data.adjustment,'-125');assert.equal(data.operatingResult,'0');assert.equal(data.cashPoints.at(-1).balance,'100000');
});

for(const protectedBy of ['later action','spent mulligan'])test(`History Undo preserves protected jump barrier after ${protectedBy}`,async()=>{
 let s=jump();if(protectedBy==='later action'){s=S.transition(s,'Manual deposit',next=>S.deposit(next,1,'Later change'));s=S.undo(s);}else s=jump(S.undoJump(s));const h=setup(s),bytes=h.bytes();await h.runAction('undo');assert.match(ui(h).message,/Cannot undo this protected jump.*Nothing was changed/);assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,0);assert.equal(ui(h).modalOpen,false);
});

for(const point of ['beforeNotify','afterNotify'])test(`synchronous reentrant History Undo during ${point} publication cannot apply a second inverse`,()=>{
 const s=S.transition(deposited(),'Second deposit',next=>S.deposit(next,10,'Keep the previous inverse')),h=setup(s);let calls=0;h.hooks[point]=()=>{calls++;const result=h.api.actions.undo();assert.equal(result,false);};h.api.actions.undo();assert.equal(calls,1);assert.equal(h.counters.writes,1);assert.equal(h.persisted().undo.length,1);exactUndo(h.persisted(),s);
});

for(const afterWrite of [false,true])test(`History Undo pending-screen construction fault ${afterWrite?'after':'before'} durable write observes original completion and stays reload-only`,async()=>{
 const h=setup(),before=h.persisted(),raw=h.bytes(),gate=serviceSaveGate(h.store),title=h.dom.ids.get('modal-title');let value=title.textContent,injected=false;
 if(afterWrite){const deferred=h.store.save;h.store.save=function(...args){const completion=deferred.apply(this,args);gate.entries.at(-1).write();return completion;};}
 Object.defineProperty(title,'textContent',{get:()=>value,set(next){if(/Undoing latest action/.test(next)&&!injected){injected=true;throw Error('Injected pending Undo screen fault');}value=next;}});
 const operation=h.runAction('undo');await flush();assert.equal(injected,true);assert.equal(gate.entries.length,1);assert.equal(h.store.reloadRequired,true);const bytes=h.bytes();if(afterWrite)exactUndo(h.persisted(),before);else assert.equal(bytes,raw);gate.entries[0].fulfill();await operation;gate.restore();assert.equal(h.bytes(),bytes);assert.equal(h.counters.writes,afterWrite?1:0);assert.equal(h.store.reloadRequired,true);assert.match(ui(h).message,/reload/i);noSuccess(h);
});

test('idle Undo Jump review is invalidated by foreign same-revision publication and requires a fresh review',async()=>{
 const h=setup(jump()),before=h.persisted();h.api.actions['jump-undo']();const detached=h.dom.ids.get('modal-form').onsubmit;h.external(structuredClone(before));assert.match(ui(h).modalError,/changed|reopen/i);assert.equal(ui(h).submitDisabled,true);await detached(submitEvent(h));assert.equal(h.counters.writes,0);h.api.closeModal();h.api.actions['jump-undo']();await h.submit();exactUndo(h.persisted(),before);assert.equal(h.counters.writes,1);
});

test('owned delayed History Undo does not prune a selected removed lot or route preview during local publication',async t=>{
 const s=S.transition(fixture(),'Added existing cargo',next=>next.lots.push({id:'undo-added-lot',commodity:'12',description:'Selected added cargo',quantity:'1',basis:'50',goodsValue:'50'}));
 const h=setup(s);h.api.setSelected(['undo-added-lot']);h.api.setRouteDraft({mode:'build',revision:s.revision,origin:s.actual,path:['0,0'],stops:[],selections:[],loading:false,error:''});
 const {gate,operation,before}=await pending(t,'history',h);same(h.api.selected,['undo-added-lot']);assert.match(h.api.routeJumpControl(),/Finish or cancel route planning/);gate.entries[0].write();exactUndo(h.persisted(),before);assert.equal(h.api.state.lots.some(l=>l.id==='undo-added-lot'),false);same(h.api.selected,['undo-added-lot']);assert.match(h.api.routeJumpControl(),/Finish or cancel route planning/);
 gate.entries[0].fulfill();await operation;same(h.api.selected,[]);assert.doesNotMatch(h.api.routeJumpControl(),/Finish or cancel route planning/);
});


test('background nearby refresh resolving after owned Undo publication cannot prune selected cargo or route before completion',async t=>{
 const s=S.transition(fixture(),'Added existing cargo',next=>next.lots.push({id:'background-selected-lot',commodity:'12',description:'Refresh retention probe',quantity:'1',basis:'50',goodsValue:'50'}));
 let resolveNearby;const delayed=new Promise(resolve=>{resolveNearby=resolve;}),originalMap=bindings.M;bindings.M={...originalMap,nearby:()=>delayed};let h;try{h=setup(s);}finally{bindings.M=originalMap;}
 h.api.setSelected(['background-selected-lot']);h.api.setRouteDraft({mode:'build',revision:s.revision,origin:s.actual,path:['0,0'],stops:[],selections:[],loading:false,error:''});const refresh=h.runAction('nearby'),{gate,operation,session}=await pending(t,'history',h);gate.entries[0].write();resolveNearby([]);await refresh;
 same(h.api.selected,['background-selected-lot']);assert.match(h.api.routeJumpControl(),/Finish or cancel route planning/);busy(h,session);gate.entries[0].fulfill();await operation;same(h.api.selected,[]);assert.doesNotMatch(h.api.routeJumpControl(),/Finish or cancel route planning/);assert.equal(h.counters.writes,1);
});

for(const outcome of ['unknown before write','unknown after write','committed publication'])test(`forcibly closed pending Undo Jump still locks ${outcome} failure without replay`,async t=>{
 const {h,gate,operation,before,raw}=await pending(t,'jump');h.dom.ids.get('modal').close();if(outcome==='unknown after write')gate.entries[0].write();if(outcome==='committed publication'){h.hooks.beforeNotify=()=>{throw Error('Detached Undo publication failure');};gate.entries[0].fulfill();}else gate.entries[0].reject();await operation;
 assert.equal(ui(h).modalOpen,false);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.dom.ids.get('takeover').disabled,true);for(const id of ['message','save-status'])assert.match(h.dom.ids.get(id).textContent,/reload/i);noSuccess(h);if(outcome==='unknown before write')assert.equal(h.bytes(),raw);else exactUndo(h.persisted(),before);
 const bytes=h.bytes();await h.runAction('jump-undo');await h.runAction('undo');assert.equal(h.bytes(),bytes);assert.equal(gate.entries.length,1);const fresh=setup(h.store.read());assert.equal(fresh.bytes(),bytes);assert.equal(fresh.counters.writes,0);
});

test('forcibly closed pending Undo Jump known-unsaved failure remains retryable without reload',async t=>{
 const {h,gate,operation,before,raw}=await pending(t,'jump');h.dom.ids.get('modal').close();h.failNext();gate.entries[0].fulfill();await operation;assert.equal(h.bytes(),raw);assert.equal(h.store.reloadRequired??false,false);assert.equal(h.store.editable,true);noSuccess(h);h.api.actions['jump-undo']();const retry=h.submit();await flush();assert.equal(gate.entries.length,2);gate.entries[1].fulfill();await retry;exactUndo(h.persisted(),before);assert.equal(h.counters.writes,1);
});

// These probes enter the actual document-level delegated click listeners. Direct
// api.actions calls alone cannot expose an async dispatcher yield or a duplicate
// click attaching safely() to the original confirmation's rejecting Promise.
function documentActionClick(h,name){
 const button={id:'',disabled:false,dataset:{action:name,arg:''},closest(selector){return selector==='[data-action]'||selector==='button'?this:null;}};
 h.dom.dispatch('click',button,{detail:0,button:0,preventDefault(){},stopImmediatePropagation(){}});
}
for(const point of ['beforeNotify','afterNotify'])test(`actual document click dispatch synchronously coalesces reentrant History Undo during ${point}`,async()=>{
 const before=S.transition(deposited(),'Second deposit',next=>S.deposit(next,10,'Retain prior inverse')),h=setup(before);let reentries=0;
 h.hooks[point]=()=>{h.hooks[point]=null;reentries++;documentActionClick(h,'undo');};documentActionClick(h,'undo');
 assert.equal(h.counters.writes,1,'Dispatcher enters synchronous Undo before yielding to unrelated service routing');await flush();await flush();assert.equal(reentries,1);assert.equal(h.counters.writes,1,'Reentrant click cannot escape the synchronous owner guard through a microtask');assert.equal(h.persisted().undo.length,1);exactUndo(h.persisted(),before);assert.equal(ui(h).message,'Latest action undone.');
});

for(const outcome of ['unknown before write','unknown after write','committed beforeNotify','committed afterNotify','committed cleanup'])test(`actual repeated document Undo Jump clicks retain complete reload guidance after ${outcome}`,async t=>{
 const {h,gate,operation,before,raw}=await pending(t,'jump');documentActionClick(h,'jump-undo');documentActionClick(h,'jump-undo');documentActionClick(h,'undo');await flush();assert.equal(gate.entries.length,1);
 if(outcome==='unknown after write')gate.entries[0].write();
 if(outcome.startsWith('committed ')){
  if(outcome==='committed cleanup'){const main=h.dom.ids.get('main');let value=main.innerHTML,injected=false;Object.defineProperty(main,'innerHTML',{get:()=>value,set(next){if(gate.entries[0].settled&&!injected){injected=true;throw Error('Injected dispatcher cleanup failure');}value=next;}});}
  else h.hooks[outcome.slice('committed '.length)]=()=>{throw Error('Injected dispatcher publication failure');};
  gate.entries[0].fulfill();
 }else gate.entries[0].reject(Error('Injected dispatcher unknown outcome'));
 await operation;await flush();await flush();terminal(h);const guidance=ui(h).modalError;assert.equal(ui(h).message,guidance,'Repeated click wrappers cannot overwrite full terminal guidance with the raw provider error');assert.equal(h.dom.ids.get('save-status').textContent,guidance);
 assert.match(guidance,outcome.startsWith('committed ')?/Undo Jump saved[\s\S]*Reload[\s\S]*do not record/i:/undo jump save outcome could not be confirmed[\s\S]*Reload[\s\S]*History/i);assert.equal(gate.entries.length,1);if(outcome==='unknown before write')assert.equal(h.bytes(),raw);else exactUndo(h.persisted(),before);
});
