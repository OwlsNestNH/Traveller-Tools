import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as S from '../js/state.mjs';
import {Store,KEY} from '../js/persistence.mjs';
import {createCampaignController as boundary} from '../js/campaign-controller.mjs';

// The same assertions first passed against the released app write functions.
// After relocation they exercise the public module and real Store directly.
const worlds=Object.fromEntries([0,1,2].map(x=>[`${x},0`,{id:`${x},0`,x,y:0,name:'World '+x,sector:'Test',hex:`0${x+1}01`,uwp:'A788899-C',zone:'Safe'}]));
function campaign(){const s=S.initial();Object.assign(s,{initialized:true,bank:'100000',actual:'0,0',worlds:structuredClone(worlds),route:['0,0','1,0'],dateLabel:'001-1105'});s.ship.capacity='100';s.ship.fuel={displacementTons:200,baseCapacityTons:40,aboardTons:20,capacityTons:40,bladderTons:0,bladderJumps:0};return S.validate(s);}
function harness(t,initial=campaign()){
 const values=new Map([[KEY,JSON.stringify(initial)]]),roles=[],notifications=[];
 let state=structuredClone(initial),failWrite=false,failNotify=false,known={},rounding=[],writes=0,controller;
 const globals={window:{addEventListener(){}},BroadcastChannel:undefined,localStorage:{getItem:key=>values.get(key)??null,setItem(key,value){if(failWrite){failWrite=false;throw Error('One-shot storage failure');}values.set(key,String(value));writes++;}}};
 const descriptors=Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,configurable:true});
 t.after(()=>{for(const[k,v]of Object.entries(descriptors)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}});
 const store=new Store(next=>{notifications.push({local:controller.isLocalSave(),revision:next.revision});if(failNotify){failNotify=false;throw Error('Notification failed after write');}state=next;},(...args)=>roles.push(args));store.editable=true;
 controller=boundary({getState:()=>state,getStore:()=>store,getKnownWorlds:()=>known,getRounding:()=>rounding});
 return {controller,store,roles,notifications,raw:()=>values.get(KEY),state:()=>state,writes:()=>writes,failWrite:()=>{failWrite=true;},failNotify:()=>{failNotify=true;},setKnown:v=>{known=v;},setRounding:v=>{rounding=v;},reload:()=>{state=store.read();}};
}
const json=v=>JSON.parse(JSON.stringify(v));
function unchangedSnapshot(h){return {raw:h.raw(),memory:structuredClone(h.state()),reference:h.state(),writes:h.writes(),notifications:json(h.notifications),roles:json(h.roles)};}
function assertUnchanged(h,before){
 assert.equal(h.raw(),before.raw);assert.equal(h.state(),before.reference);assert.deepEqual(structuredClone(h.state()),before.memory);
 assert.equal(h.writes(),before.writes);assert.deepEqual(h.notifications,before.notifications);assert.deepEqual(h.roles,before.roles);assert.equal(h.controller.isLocalSave(),false);
}
const jumpRoll=()=>({dice:[2,2,2,2,2,2],total:12});
function historyCampaign(){return S.transition(campaign(),'Supplies and freight',s=>{
 S.deposit(s,123,'Synthetic deposit');S.shipExpenses(s,[{kind:'fuel',tons:2,fuelType:'refined'}]);
 S.acceptContract(s,{offerId:'guard-freight',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true,reason:'Synthetic terms'}});
});}
function jumpedCampaign(){const p=S.prepareJump(historyCampaign(),jumpRoll);return S.transition(p.state,'Jump: World 0 → World 1',s=>S.commitJump(s,{attemptId:p.attempt.id,elapsed:160}));}
function advanceDiskWithoutMemory(h){
 const current=h.state();h.failNotify();
 assert.throws(()=>h.store.save(S.transition(current,'Other writer deposit',s=>S.deposit(s,17,'Saved in newer revision')),current.revision),/Notification failed/);
 assert.equal(h.store.read().revision,current.revision+1);assert.equal(h.state(),current);
}

test('ordinary writes preserve cached worlds, rounding audits, synchronous state, JSON and Undo',t=>{
 const h=harness(t),before=json(h.state());h.setKnown({'2,0':worlds['2,0'],'0,0':{...worlds['0,0'],name:'Cached name'}});h.setRounding([{label:'Deposit',before:'1.2',after:'2'}]);
 const next=h.controller.transition('Deposit',s=>S.deposit(s,2,'Synthetic payment'),0);
 assert.equal(typeof next?.then,'undefined');assert.deepEqual(json(next),h.store.read());assert.deepEqual(json(h.state()),h.store.read());
 assert.equal(next.bank,'100002');assert.equal(next.worlds['0,0'].name,'World 0');assert.equal(next.worlds['2,0'].name,'World 2');
 assert.deepEqual(json(next.events.find(e=>e.label==='Rounding applied [R]').roundingChanges),[{label:'Deposit',before:'1.2',after:'2'}]);
 assert.equal(next.revision,1);assert.equal(next.ledger.length,1);assert.equal(next.undo.length,1);assert.equal(h.notifications[0].local,true);assert.equal(h.controller.isLocalSave(),false);
 h.controller.undo(1);assert.equal(h.state().bank,before.bank);assert.equal(h.state().ledger.length,0);assert.equal(h.state().undo.length,0);assert.equal(h.state().revision,2);
});

for(const [name,change,verify]of [
 ['money',s=>S.deposit(s,123,'Synthetic deposit'),s=>assert.equal(s.bank,'100123')],
 ['stock service',s=>S.shipExpenses(s,[{kind:'fuel',tons:2,fuelType:'refined'}]),s=>{assert.equal(s.bank,'99000');assert.equal(s.ship.fuel.aboardTons,22);}],
 ['contract',s=>S.acceptContract(s,{offerId:'synthetic-freight',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true,reason:'Synthetic terms'}}),s=>assert.equal(s.contracts.length,1)]
])test(`${name}: a real storage failure leaves bytes and memory intact; retry records exactly one action`,t=>{
 const h=harness(t),raw=h.raw(),before=json(h.state());h.failWrite();
 assert.throws(()=>h.controller.transition(name,change,0),/storage failure/);assert.equal(h.raw(),raw);assert.deepEqual(json(h.state()),before);assert.equal(h.notifications.length,0);assert.equal(h.controller.isLocalSave(),false);
 h.controller.transition(name,change,0);verify(h.state());assert.equal(h.writes(),1);assert.equal(h.state().revision,1);assert.equal(h.state().undo.length,1);
 h.controller.undo(1);assert.equal(h.state().bank,before.bank);assert.deepEqual(h.state().ship,before.ship);assert.deepEqual(h.state().contracts,before.contracts);assert.equal(h.state().ledger.length,0);
});

test('memory and disk revision checks reject stale writes; ownership loss leaves saved bytes intact',t=>{
 const h=harness(t);h.controller.transition('First',s=>S.deposit(s,1,'First'),0);let raw=h.raw(),called=false;
 assert.throws(()=>h.controller.transition('Stale',()=>{called=true;},0),/Campaign changed/);assert.equal(called,false);assert.equal(h.raw(),raw);
 h.failNotify();assert.throws(()=>h.store.save(S.transition(h.state(),'External change',s=>S.deposit(s,1,'External')),1),/Notification failed/);raw=h.raw();
 assert.throws(()=>h.controller.transition('Disk stale',s=>S.deposit(s,1,'Old preview'),1),/stale/);assert.equal(h.raw(),raw);
 h.reload();h.store.editable=false;assert.throws(()=>h.controller.transition('Read only',s=>S.deposit(s,1,'Forbidden'),2),/read-only/);assert.equal(h.raw(),raw);
});

test('post-write notification failure is characterized separately: disk advanced, memory old, blind retry rejected',t=>{
 const h=harness(t),before=json(h.state());h.failNotify();
 assert.throws(()=>h.controller.transition('Deposit',s=>S.deposit(s,7,'Saved once'),0),/Notification failed/);
 assert.equal(h.store.read().revision,1);assert.equal(h.store.read().bank,'100007');assert.deepEqual(json(h.state()),before);assert.equal(h.controller.isLocalSave(),false);
 const raw=h.raw();assert.throws(()=>h.controller.transition('Retry',s=>S.deposit(s,7,'Do not repeat'),0),/stale/);assert.equal(h.raw(),raw);h.reload();assert.equal(h.state().ledger.length,1);
});

for(const [name,initial,perform]of [
 ['fresh prepared jump',historyCampaign,(h,r)=>h.controller.prepareJump(jumpRoll,r)],
 ['mulligan prepared jump',()=>S.undo(jumpedCampaign()),(h,r)=>h.controller.prepareJump(jumpRoll,r)],
 ['ordinary History Undo',historyCampaign,(h,r)=>h.controller.undo(r)],
 ['jump History Undo',jumpedCampaign,(h,r)=>h.controller.undo(r)]
])test(`${name}: newer disk expectation cannot authorize a candidate derived from older memory`,t=>{
 const h=harness(t,initial()),revision=h.state().revision;advanceDiskWithoutMemory(h);
 const before=unchangedSnapshot(h);
 // Matching the disk is insufficient: the candidate must use that revision too.
 // Fresh preparation may generate a pure candidate before rejecting the write.
 for(const expected of [revision+1,revision-1,revision+2]){
  assert.throws(()=>perform(h,expected),/Campaign changed/);assertUnchanged(h,before);
 }
 assert.throws(()=>perform(h,revision),/stale/);assertUnchanged(h,before);
 h.reload();const loaded=unchangedSnapshot(h);h.store.editable=false;
 assert.throws(()=>perform(h,revision+1),/read-only/);assertUnchanged(h,loaded);
 h.store.editable=true;perform(h,revision+1);
 assert.equal(h.state().revision,revision+2);assert.equal(h.writes(),before.writes+1);assert.equal(h.notifications.length,before.notifications.length+1);assert.equal(h.notifications.at(-1).local,true);
 assert.deepEqual(json(h.state()),h.store.read());assert.equal(h.controller.isLocalSave(),false);
 if(name.includes('prepared')){
  for(const key of ['bank','ship','lots','contracts','snapshots','policies','ledger','undo','actual','routeIndex','hours'])assert.deepEqual(h.state()[key],loaded.memory[key]);
 }else{
  assert.equal(h.state().bank,before.memory.bank);assert.deepEqual(h.state().ledger,before.memory.ledger);assert.deepEqual(h.state().ship,before.memory.ship);assert.deepEqual(h.state().contracts,before.memory.contracts);
 }
});

test('History Undo checks the memory revision before interpreting an empty Undo stack',t=>{
 const h=harness(t),before=unchangedSnapshot(h);
 assert.throws(()=>h.controller.undo(1),/Campaign changed/);assertUnchanged(h,before);
 assert.throws(()=>h.controller.undo(0),/Nothing to undo/);assertUnchanged(h,before);
});

test('saved roll reuse stays non-writing with stale expectations, newer disk and read-only ownership',t=>{
 const h=harness(t),prepared=h.controller.prepareJump(jumpRoll,0);advanceDiskWithoutMemory(h);h.store.editable=false;
 const before=unchangedSnapshot(h);
 for(const expected of [0,1,2,3]){
  const reused=h.controller.prepareJump(()=>assert.fail('A saved roll must not reroll'),expected);
  assert.equal(reused.state,h.state());assert.deepEqual(reused.roll,prepared.roll);assert.deepEqual(reused.attempt,prepared.attempt);assertUnchanged(h,before);
 }
});

for(const undoMethod of ['undoJump','undo'])test(`prepared jump persists dice without an Undo entry; reopen/reload reuse, ${undoMethod} permits one final roll`,t=>{
 const h=harness(t);let rolls=0;const roll=()=>({dice:Array(6).fill(++rolls),total:6*rolls});
 const p=h.controller.prepareJump(roll,0);assert.equal(h.state().revision,1);assert.equal(h.state().undo.length,0);assert.equal(h.state().actual,'0,0');assert.equal(h.writes(),1);
 h.reload();const reused=h.controller.prepareJump(roll,1);assert.deepEqual(reused.roll,p.roll);assert.equal(rolls,1);assert.equal(h.writes(),1);
 h.controller.transition('Jump: World 0 → World 1',s=>S.commitJump(s,{attemptId:p.attempt.id,elapsed:154}),1);assert.equal(h.state().actual,'1,0');h.controller[undoMethod](2);assert.equal(h.state().actual,'0,0');assert.equal(h.state().ship.fuel.aboardTons,20);
 h.reload();const final=h.controller.prepareJump(roll,3);assert.equal(rolls,2);assert.equal(final.attempt.mulliganUsed,true);assert.equal(h.state().revision,4);
 h.controller.transition('Jump: World 0 → World 1',s=>S.commitJump(s,{attemptId:final.attempt.id,elapsed:160}),4);
 const raw=h.raw();assert.throws(()=>h.controller.undoJump(5),/Mulligan used/);assert.throws(()=>h.controller.undo(5),/Mulligan used/);assert.equal(h.raw(),raw);
});

test('failed prepared-jump save does not retain an uncommitted roll',t=>{
 const h=harness(t),before=unchangedSnapshot(h);h.failWrite();assert.throws(()=>h.controller.prepareJump(()=>({dice:[1,1,1,1,1,1],total:6}),0),/storage failure/);assertUnchanged(h,before);assert.equal(h.state().jumpAttempts?.length??0,0);
 const p=h.controller.prepareJump(()=>({dice:[2,2,2,2,2,2],total:12}),0);assert.equal(p.roll.total,12);assert.equal(h.state().revision,1);
});

test('History Undo storage failure preserves the full campaign; retry reverses one saved action',t=>{
 const h=harness(t,historyCampaign()),before=unchangedSnapshot(h);h.failWrite();
 assert.throws(()=>h.controller.undo(1),/storage failure/);assertUnchanged(h,before);
 h.controller.undo(1);assert.equal(h.state().revision,2);assert.equal(h.writes(),1);assert.equal(h.notifications.length,1);
 assert.equal(h.state().bank,'100000');assert.equal(h.state().ship.fuel.aboardTons,20);assert.equal(h.state().contracts.length,0);assert.equal(h.state().ledger.length,0);assert.equal(h.state().undo.length,0);
 assert.equal(h.state().events.filter(e=>e.label==='Undo: Supplies and freight').length,1);assert.deepEqual(json(h.state()),h.store.read());
});

for(const [name,perform]of [
 ['prepared jump',(h,r)=>h.controller.prepareJump(jumpRoll,r)],
 ['History Undo',(h,r)=>h.controller.undo(r)]
])test(`${name}: post-write notification failure requires reload before using the advanced revision`,t=>{
 const h=harness(t,historyCampaign()),before=unchangedSnapshot(h);h.failNotify();
 assert.throws(()=>perform(h,1),/Notification failed/);
 assert.equal(h.store.read().revision,2);assert.notEqual(h.raw(),before.raw);assert.equal(h.state(),before.reference);assert.deepEqual(structuredClone(h.state()),before.memory);
 assert.equal(h.writes(),1);assert.equal(h.notifications.length,1);assert.equal(h.notifications[0].local,true);assert.equal(h.controller.isLocalSave(),false);
 const saved=unchangedSnapshot(h);
 assert.throws(()=>perform(h,1),/stale/);assertUnchanged(h,saved);
 assert.throws(()=>perform(h,2),/Campaign changed/);assertUnchanged(h,saved);
 h.reload();assert.deepEqual(json(h.state()),h.store.read());const loaded=unchangedSnapshot(h);
 if(name==='prepared jump'){
  assert.equal(h.state().jumpAttempts.length,1);assert.equal(h.state().jumpAttempts[0].rolls.length,1);perform(h,2);
 }else{
  assert.equal(h.state().undo.length,0);assert.equal(h.state().ledger.length,0);assert.equal(h.state().bank,'100000');assert.throws(()=>perform(h,2),/Nothing to undo/);
 }
 assertUnchanged(h,loaded);
});

for(const recovery of [false,true])test(`replacement ${recovery?'in recovery':'normally'} preserves synchronous external notification and failure/retry behavior`,t=>{
 const h=harness(t),raw=h.raw(),replacement=campaign();replacement.bank='76543';replacement.revision=42;h.store.recovery=recovery;
 h.failWrite();assert.throws(()=>h.controller.replace(replacement,0),/storage failure/);assert.equal(h.raw(),raw);assert.equal(h.store.recovery,recovery);assert.equal(h.state().bank,'100000');
 h.controller.replace(replacement,0);assert.equal(h.state().bank,'76543');assert.equal(h.state().revision,1);assert.equal(replacement.revision,42);assert.equal(h.notifications.at(-1).local,false);assert.equal(h.store.recovery,false);
});

test('stale or read-only replacement confirmation cannot overwrite saved bytes',t=>{
 const h=harness(t);h.controller.transition('Change',s=>S.deposit(s,1,'Change'),0);const raw=h.raw();assert.throws(()=>h.controller.replace(campaign(),0),/stale/);assert.equal(h.raw(),raw);
 h.store.editable=false;assert.throws(()=>h.controller.replace(campaign(),1),/read-only/);assert.equal(h.raw(),raw);
});

test('recovery notification failure leaves replacement on disk and recovery cleared; repeat with old revision is rejected',t=>{
 const h=harness(t),replacement=campaign();replacement.bank='12345';h.store.recovery=true;h.failNotify();assert.throws(()=>h.controller.replace(replacement,0),/Notification failed/);
 assert.equal(h.store.read().bank,'12345');assert.equal(h.store.read().revision,1);assert.equal(h.store.recovery,false);assert.equal(h.state().bank,'100000');assert.equal(h.controller.isLocalSave(),false);
 const raw=h.raw();assert.throws(()=>h.controller.replace(replacement,0),/stale/);assert.equal(h.raw(),raw);h.reload();assert.equal(h.state().bank,'12345');
});


function replay(h){
 const snapshots=[],capture=()=>snapshots.push(h.raw());
 capture();h.setKnown({'2,0':worlds['2,0']});h.setRounding([{label:'Deposit',before:'1.2',after:'2'}]);
 h.controller.transition('Deposit',s=>S.deposit(s,2,'Synthetic parity'),0);capture();h.setRounding([]);
 h.controller.transition('Refuel',s=>S.shipExpenses(s,[{kind:'fuel',tons:2,fuelType:'refined'}]),1);capture();
 h.controller.transition('Freight',s=>S.acceptContract(s,{offerId:'parity-freight',kind:'freight',origin:'0,0',destination:'1,0',quantity:'2',payment:'2000',dueHours:null,audit:{manual:true,reason:'Synthetic parity'}}),2);capture();
 const roll=()=>({dice:[2,2,2,2,2,2],total:12}),prepared=h.controller.prepareJump(roll,3);capture();
 h.reload();h.controller.prepareJump(roll,4);capture();
 h.controller.transition('Jump: World 0 → World 1',s=>S.commitJump(s,{attemptId:prepared.attempt.id,elapsed:160}),4);capture();
 h.controller.undoJump(5);capture();const final=h.controller.prepareJump(()=>({dice:[3,3,3,3,3,3],total:18}),6);capture();
 h.controller.transition('Jump: World 0 → World 1',s=>S.commitJump(s,{attemptId:final.attempt.id,elapsed:166}),7);capture();
 h.controller.replace(campaign(),8);capture();
 h.controller.transition('Deposit after replacement',s=>S.deposit(s,1,'After import'),9);capture();h.controller.undo(10);capture();
 return snapshots;
}
function deterministicIds(t){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');let counter=0;
 Object.defineProperty(globalThis,'crypto',{value:{randomUUID:()=>`parity-id-${++counter}`},configurable:true});
 t.after(()=>Object.defineProperty(globalThis,'crypto',descriptor));
}

test('every checkpoint matches released campaign JSON bytes apart from explicit Dashboard metadata',async t=>{
 deterministicIds(t);const expected=JSON.parse(await readFile(new URL('./fixtures/campaign-writes-baseline.json',import.meta.url),'utf8')),actual=replay(harness(t));
 assert.deepEqual(actual.map((raw,index)=>{const state=JSON.parse(raw);if(index>=10)assert.deepEqual(state.dashboardBaseline,{version:1,origin:'current',bank:'100000',dateLabel:'001-1105',hours:0,excludedLedgerIds:[]});else assert.equal(state.dashboardBaseline,undefined);delete state.dashboardBaseline;return JSON.stringify(state);}),expected);
});
