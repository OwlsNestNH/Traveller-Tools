import test from 'node:test';
import assert from 'node:assert/strict';
import {Store, KEY} from '../js/persistence.mjs';
import {initial, transition, validate, undo, prepareJump, commitJump, undoJump, jumpUndoEligibility, shipExpenses} from '../js/state.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));

function environment(t) {
  const values = new Map();
  const queue = [];
  const stores = [];
  let busy = false, requests = 0, rejectNext = false;
  const drain = () => {
    if (busy || !queue.length) return;
    const entry = queue.shift();
    busy = true;
    entry.signal?.removeEventListener('abort', entry.abort);
    Promise.resolve().then(() => entry.callback({name:'writer'}))
      .then(entry.resolve, entry.reject).finally(() => {busy=false; drain();});
  };
  const locks = {request(name, options, callback) {
    requests++;
    if(options.ifAvailable&&options.signal) return Promise.reject(new DOMException('ifAvailable cannot use signal','NotSupportedError'));
    if (rejectNext) {rejectNext=false; return Promise.reject(Error('Lock service unavailable'));}
    if (options.ifAvailable && busy) return Promise.resolve().then(() => callback(null));
    return new Promise((resolve, reject) => {
      const entry = {callback, resolve, reject, signal:options.signal};
      entry.abort = () => {
        const index = queue.indexOf(entry);
        if (index !== -1) {queue.splice(index,1); reject(new DOMException('Aborted', 'AbortError'));}
      };
      entry.signal?.addEventListener('abort', entry.abort, {once:true});
      queue.push(entry); drain();
    });
  }};
  const replacements = {
    window:{addEventListener(){}}, navigator:{locks}, BroadcastChannel:undefined,
    localStorage:{getItem:key=>values.get(key) ?? null, setItem:(key,value)=>values.set(key,String(value))},
  };
  const descriptors = Object.fromEntries(Object.keys(replacements).map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(replacements)) Object.defineProperty(globalThis,key,{value,configurable:true});
  t.after(async () => {
    for (const store of stores) {store.onRole=()=>{}; store.yield();}
    await tick();
    for (const key of Object.keys(replacements)) {
      if (descriptors[key]) Object.defineProperty(globalThis,key,descriptors[key]);
      else delete globalThis[key];
    }
  });
  return {
    store(onChange=()=>{}, onRole=()=>{}) {const store=new Store(onChange,onRole); stores.push(store); return store;},
    queued:()=>queue.length, requests:()=>requests, held:()=>busy,
    rejectNext:()=>{rejectNext=true;}, values,
  };
}

const changed = (store, value) => transition(store.read(), 'test update', state => {state.name=value;});

test('repeat takeover requests acquire once and never reacquire after yield', async t => {
  const env=environment(t), a=env.store(), b=env.store();
  await a.acquire(); await tick();
  await b.acquire(true); await b.acquire(true); await b.acquire(true);
  assert.equal(env.requests(),2); assert.equal(env.queued(),1);
  a.yield(); await tick();
  assert.equal(a.editable,false); assert.equal(b.editable,true); assert.equal(env.queued(),0);
  b.yield(); await tick();
  assert.equal(b.editable,false); assert.equal(env.held(),false); assert.equal(env.queued(),0);
  assert.throws(()=>b.save(changed(b,'unauthorized'),0),/read-only/);
});

test('yield cancels a waiting request; a fresh request can later take ownership', async t => {
  const env=environment(t), a=env.store(), b=env.store();
  await a.acquire(); await tick(); await b.acquire(true);
  b.yield(); await tick();
  assert.equal(env.queued(),0); assert.equal(b.editable,false);
  a.yield(); await tick(); assert.equal(b.editable,false);
  await b.acquire(true); await tick(); assert.equal(b.editable,true);
});

test('handoff reloads the latest revision and rejects old previews without changing saved data', async t => {
  const env=environment(t), seen=[], a=env.store(), b=env.store(s=>seen.push(s));
  await a.acquire(); await tick();
  const stale=changed(a,'stale');
  await b.acquire(true);
  a.save(changed(a,'saved by first tab'),0);
  a.yield(); await tick();
  assert.equal(seen.at(-1).name,'saved by first tab'); assert.equal(seen.at(-1).revision,1);
  const raw=env.values.get(KEY);
  assert.throws(()=>b.save(stale,0),/stale/); assert.equal(env.values.get(KEY),raw);
  b.save(changed(b,'saved after handoff'),1);
  assert.equal(b.read().revision,2); assert.equal(b.read().name,'saved after handoff');
});

test('lock request rejection fails closed and permits a later retry', async t => {
  const env=environment(t), roles=[], store=env.store(()=>{},(...args)=>roles.push(args));
  env.rejectNext(); await store.acquire(); await tick();
  assert.equal(store.editable,false); assert.equal(store.acquisition,null);
  assert.match(roles.at(-1)[1],/unavailable/);
  assert.throws(()=>store.save(changed(store,'no lock'),0),/read-only/);
  await store.acquire(); await tick(); assert.equal(store.editable,true);
});

test('a failing render callback releases ownership and cannot leave save enabled', async t => {
  const env=environment(t);
  for (const callback of ['change','role']) {
    const store=env.store(
      ()=>{if(callback==='change')throw Error('Render failed');},
      editable=>{if(callback==='role'&&editable)throw Error('Render failed');},
    );
    await store.acquire(); await tick();
    assert.equal(env.held(),false); assert.equal(store.editable,false); assert.equal(store.release,null);
    assert.throws(()=>store.save(changed(store,'no lock'),0),/read-only/);
  }
});

test('yield during initial render cannot announce editing or retain the granted lock', async t => {
  const env=environment(t), roles=[];
  const store=env.store(()=>store.yield(),(...args)=>roles.push(args));
  await store.acquire(); await tick();
  assert.equal(store.editable,false); assert.equal(env.held(),false);
  assert.ok(roles.every(([editable])=>!editable));
});

test('without Web Locks the campaign remains read-only', async t => {
  const env=environment(t), roles=[], store=env.store(()=>{},(...args)=>roles.push(args));
  navigator.locks=undefined; await store.acquire();
  assert.equal(store.editable,false); assert.equal(env.requests(),0);
  assert.match(roles.at(-1)[1],/lacks safe editing locks/);
  assert.throws(()=>store.replace(initial(),0),/read-only/);
});

function populated(){
 const state=initial();
 state.initialized=true;state.bank='100000';state.actual='0,0';state.route=['0,0','0,1'];
 state.worlds=Object.fromEntries([0,1].map(y=>[`0,${y}`,{id:`0,${y}`,x:0,y,hex:`010${y+1}`,sector:'Test',name:`World ${y}`,uwp:'A788899-C',zone:'Safe'}]));
 state.lots=[{id:'lot',commodity:'11',description:'Saved cargo',quantity:'2',basis:'100',goodsValue:'100'}];
 state.policies=[{id:'policy',lotId:'lot',claims:[],amendments:[],route:['0,0','0,1'],destination:'0,1',status:'active',remainingQuantity:'2',remainingValue:'100',initialQuantity:'2',insuredValue:'100',coverage:70}];
 state.contracts=[{id:'contract',kind:'mail',status:'accepted',origin:'0,0',destination:'0,1',quantity:'5',payment:'25000',dueHours:null}];
 state.ledger=[{id:'ledger',type:'Historical entry',amount:'0',hours:0}];
 state.snapshots=[{id:'snapshot',kind:'supplier',hours:0,startedHours:0,worldId:'0,0',offers:[{id:'offer',commodity:'11',expired:false,remaining:'1',unitPrice:'100'}]}];
 state.cooldowns={'counterparty':168};
 return transition(state,'Advance clock',next=>{next.hours=24;});
}

test('malformed imports fail before replacing any saved bytes', async t => {
 const env=environment(t), store=env.store();
 await store.acquire();await tick();store.replace(populated(),0);
 const raw=env.values.get(KEY), expected=store.read().revision;
 const cases=[
  s=>{s.ship=[];},s=>{s.trader='bad';},s=>{s.settings=[];},s=>{s.worlds=[];},s=>{s.cooldowns='bad';},
  s=>{s.cooldowns=[];},s=>{s.cooldowns.party=-1;},s=>{s.cooldowns.party='168';},
  ...['0',-1,999,null].map(value=>s=>{s.routeIndex=value;}),
  s=>{s.route=[];s.routeIndex=1;},s=>{s.route[1]='999,999';},s=>{s.route[1]={};},
  s=>{s.policies[0].route='bad';},s=>{s.policies[0].route=['999,999'];},s=>{s.policies[0].amendments='bad';},
  s=>{s.snapshots[0].offers.push({...s.snapshots[0].offers[0]});},
  s=>{s.snapshots.push({...structuredClone(s.snapshots[0]),id:'second-snapshot'});},
  s=>{s.undo[0].inverse='bad';},s=>{s.undo[0].label=null;},
  ...[
   {path:[],value:null}, {path:['__proto__','polluted'],value:true}, {path:['lots',-1],remove:true},
   {path:[{}],value:1}, {path:['bank']}, {path:['bank'],remove:true,insert:true,value:'0'},
   {path:['bank'],remove:'yes'}, {path:['bank'],insert:false,value:'0'},
  ].map(op=>s=>{s.undo[0].inverse=[op];}),
 ];
 for(const mutate of cases){
  const invalid=populated();mutate(invalid);
  assert.throws(()=>store.replace(invalid,expected));
  assert.equal(env.values.get(KEY),raw,'failed import must preserve current campaign bytes');
 }
});

test('schema-1 campaigns retain populated history, optional legacy fields and working undo', async t => {
 const env=environment(t), store=env.store();await store.acquire();await tick();
 const saved=populated();
 assert.deepEqual(validate(JSON.parse(JSON.stringify(saved))),saved);
 store.replace(saved,0);const restored=store.read();
 assert.deepEqual(restored,saved);assert.equal(undo(restored).hours,0);
 assert.deepEqual(undo(restored).policies,saved.policies);assert.deepEqual(undo(restored).ledger,saved.ledger);
 const legacy=structuredClone(saved);
 delete legacy.settings.reducedProfitLimitsEnabled;delete legacy.settings.minPurchasePercent;delete legacy.settings.maxSalePercent;
 delete legacy.policies[0].amendments;
 store.replace(legacy,restored.revision);
 const read=store.read();assert.equal(read.schema,1);assert.equal(read.settings.reducedProfitLimitsEnabled,false);
 assert.equal(read.settings.minPurchasePercent,85);assert.equal(read.settings.maxSalePercent,115);
 assert.deepEqual(read.ledger,saved.ledger);assert.deepEqual(read.undo,saved.undo);
 assert.equal(read.contracts[0].audit,undefined);assert.equal(read.policies[0].amendments,undefined);
 assert.equal(undo(read).hours,0);
});

// Exercise the real JSON boundary, including changes before any page reload.
test('blank fuel, configuration, clearing and reconfiguration remain reloadable and undoable', async t => {
 const env=environment(t), observed=[], store=env.store(s=>observed.push(s));
 await store.acquire();await tick();
 const initialState=store.read(),fuel={displacementTons:200,capacityTons:40,aboardTons:20};
 const save=(label,action)=>{
  const before=observed.at(-1),next=transition(before,label,action);
  store.save(next,before.revision);
  assert.deepEqual(observed.at(-1),store.read(),'Memory and reloaded JSON agree after every save');
  return store.read();
 };
 save('Blank fuel settings',s=>{s.ship.fuel=undefined;});
 assert.equal(Object.hasOwn(observed.at(-1).ship,'fuel'),false);
 const blank=store.read(),configured=save('Configure fuel',s=>{s.ship.fuel=fuel;});
 assert.deepEqual(configured.undo.at(-1).inverse,[{path:['ship','fuel'],remove:true}]);
 assert.deepEqual(configured.ship.fuel,fuel);
 const cleared=save('Clear fuel',s=>{s.ship.fuel=undefined;});
 assert.equal(Object.hasOwn(cleared.ship,'fuel'),false);
 const again=save('Reconfigure fuel',s=>{s.ship.fuel={...fuel,aboardTons:30};});
 assert.equal(again.ship.fuel.aboardTons,30);
 for(const expected of [cleared,configured,blank,initialState]){
  const current=store.read();store.save(undo(current),current.revision);
  const restored=store.read();
  assert.deepEqual(restored.ship,expected.ship);assert.equal(restored.bank,expected.bank);
  assert.equal(restored.hours,expected.hours);assert.deepEqual(restored.ledger,expected.ledger);
  assert.deepEqual(restored.undo,expected.undo);
 }
 save('Edit after all Undo operations',s=>{s.name='Still editable';});
 assert.equal(store.read().name,'Still editable');
});

test('inverse changes also normalize unsaved optional undefined values before JSON export', () => {
 const blank=transition(initial(),'Blank fuel',s=>{s.ship.fuel=undefined;});
 assert.equal(Object.hasOwn(blank.ship,'fuel'),true,'Reproduces the former in-memory input');
 const fuel={displacementTons:200,capacityTons:40,aboardTons:20};
 const configured=transition(blank,'Configure fuel',s=>{s.ship.fuel=fuel;});
 const loaded=validate(JSON.parse(JSON.stringify(configured)));
 assert.deepEqual(loaded.undo.at(-1).inverse,[{path:['ship','fuel'],remove:true}]);
 assert.equal(Object.hasOwn(undo(loaded).ship,'fuel'),false);
 const cleared=transition(configured,'Clear fuel',s=>{s.ship.fuel=undefined;});
 assert.deepEqual(undo(validate(JSON.parse(JSON.stringify(cleared)))).ship.fuel,fuel);
});

test('writes reject undefined Undo values and JSON-invalid campaigns before changing bytes', async t => {
 const env=environment(t), changes=[], store=env.store(s=>changes.push(s));
 await store.acquire();await tick();store.replace(populated(),0);
 const raw=env.values.get(KEY),expected=store.read().revision,notifications=changes.length;
 for(const mutate of [
  s=>{s.undo[0].inverse=[{path:['ship','fuel'],value:undefined}];},
  // Reject malformed fields and values that disappear during serialization.
  s=>{s.trader.broker=Infinity;},
  s=>{s.undo[0].inverse[0].value={toJSON:()=>undefined};},
 ]){
  const next=store.read();mutate(next);
  assert.throws(()=>store.save(next,expected));
  assert.equal(env.values.get(KEY),raw);assert.equal(changes.length,notifications);
 }
});

test('already damaged Undo stays in Recovery with its raw history preserved', async t => {
 const env=environment(t), changes=[], roles=[], store=env.store(s=>changes.push(s),(...args)=>roles.push(args));
 const damaged=populated();damaged.undo[0].inverse=[{path:['ship','fuel']}];
 const raw=JSON.stringify(damaged);env.values.set(KEY,raw);
 await store.acquire();await tick();
 assert.equal(store.recovery,true);assert.match(store.recoveryMessage,/Invalid undo operation/);
 assert.equal(env.values.get(KEY),raw,'Acquiring the writer never rewrites ambiguous damaged history');
 assert.throws(()=>store.read(),/Invalid undo operation/);
 assert.throws(()=>store.save(initial(),damaged.revision),/Restore or reset/);
 assert.equal(env.values.get(KEY),raw);
 const invalid=populated();invalid.undo[0].inverse=[{path:['ship','fuel'],value:undefined}];
 assert.throws(()=>store.replace(invalid,damaged.revision),/Invalid undo operation/);
 assert.equal(env.values.get(KEY),raw);assert.equal(store.recovery,true);
 const restored=populated();restored.ship.fuel=undefined;
 store.replace(restored,damaged.revision);
 assert.equal(store.recovery,false);assert.deepEqual(changes.at(-1),store.read());
 assert.deepEqual(store.read().undo,restored.undo,'An explicit valid restore retains its own complete history');
 assert.equal(Object.hasOwn(changes.at(-1).ship,'fuel'),false);
});


test('prepared and spent jump allowances survive real Store.replace revision rebasing and reload', async t => {
 const env=environment(t),store=env.store();await store.acquire();await tick();
 const w=x=>({id:x+',0',x,y:0,name:x?'Destination':'Origin',sector:'Test',hex:x?'0201':'0101',uwp:'A788899-C',zone:'Safe'});
 let source=transition(initial(),'Campaign setup',s=>{s.initialized=true;s.actual='0,0';s.worlds={'0,0':w(0),'1,0':w(1)};s.route=['0,0','1,0'];});
 const first=prepareJump(source,()=>({dice:[2,2,2,2,2,2],total:12})),prepared=first.state;
 const committed=transition(prepared,'Jump: Origin → Destination',s=>commitJump(s,{attemptId:first.attempt.id,elapsed:160}));
 const spent=undoJump(committed),second=prepareJump(spent,()=>({dice:[6,6,6,6,6,6],total:36}));
 const retried=transition(second.state,'Jump: Origin → Destination',s=>commitJump(s,{attemptId:second.attempt.id,elapsed:184}));
 for(const exported of [prepared,spent,second.state,retried]){
  env.values.set(KEY,JSON.stringify(initial()));
  store.replace(JSON.parse(JSON.stringify(exported)),0);
  const restored=store.read();assert.equal(restored.revision,1);assert.deepEqual(restored.jumpAttempts,exported.jumpAttempts);assert.deepEqual(restored.events,exported.events);
  if(restored.actual==='0,0'&&restored.jumpAttempts[0].rolls.length===(restored.jumpAttempts[0].mulliganUsed?2:1))assert.deepEqual(prepareJump(restored,()=>{throw Error('Must reuse imported dice');}).roll,restored.jumpAttempts[0].rolls.at(-1));
  if(restored.actual==='1,0')assert.equal(jumpUndoEligibility(restored).allowed,false);
 }
});

test('physical LSS fractions survive writer save, import replacement and retained Undo',async t=>{
 const {configureSupport,supportAmount,supportCargo}=await import('../js/life-support.mjs');
 const {configureFuel}=await import('../js/fuel.mjs');
 const {cmp}=await import('../js/amounts.mjs');
 const env=environment(t),store=env.store();await store.acquire();await tick();
 const source=initial();source.ship.fuel=configureFuel(10,2,0,0,2);source.ship.accommodation={rooms:{low:0,middle:1,high:0},passengers:{low:0,middle:1,high:0},crew:{low:0,middle:0,high:0},luggageTons:'0'};
 source.ship.lifeSupport=configureSupport(source.ship,{stockUnits:41});
 store.replace(source,0);const before=store.read(),advanced=transition(before,'One hour',x=>x.hours++);store.save(advanced,before.revision);
 const reloaded=store.read();assert.equal(cmp(supportAmount(reloaded.ship.lifeSupport.stockUnits),{n:983n,d:24n}),0);assert.equal(cmp(supportCargo(reloaded.ship),{n:23n,d:2400n}),0);
 const imported=JSON.parse(JSON.stringify(reloaded));store.replace(imported,reloaded.revision);const restored=undo(store.read());assert.deepEqual(restored.ship,before.ship);assert.equal(restored.hours,0);
 const bytes=env.values.get(KEY),bad=JSON.parse(bytes);bad.ship.lifeSupport.stockUnits={numerator:'1000000',denominator:'1'};assert.throws(()=>store.replace(bad,store.read().revision),/capacity/);assert.equal(env.values.get(KEY),bytes);
});

test('mortgage and maintenance save/reload/import atomically, with stale and storage failures preserving the prior schedule',async t=>{
 const env=environment(t),store=env.store();await store.acquire();await tick();
 const before=transition(initial(),'Setup recurring expenses',s=>{
  s.bank='1000000';s.actual='0,0';s.initialized=true;s.worlds={'0,0':{id:'0,0',x:0,y:0,name:'Test',sector:'Test',hex:'0101',uwp:'E000000-0',zone:'Safe'}};s.route=['0,0'];
  s.ship.mortgage={originalAmount:'24000000',payment:'100000',remainingPayments:360,totalPaid:'12000000',nextDueDate:'029-1105'};
  s.ship.maintenance={payment:'2000',nextDueDate:'015-1105',paidSinceTracking:'0'};
 });store.save(before,0);
 const paid=transition(before,'Pay both',s=>shipExpenses(s,[{kind:'mortgage',mortgagePayments:2},{kind:'maintenance',maintenancePayments:3}]));
 const originalWrite=localStorage.setItem,bytes=env.values.get(KEY);
 localStorage.setItem=()=>{throw Error('Quota exceeded');};assert.throws(()=>store.save(paid,before.revision),/Quota/);localStorage.setItem=originalWrite;
 assert.equal(env.values.get(KEY),bytes);assert.deepEqual(store.read().ship,before.ship);
 store.save(paid,before.revision);assert.deepEqual(store.read(),paid);assert.throws(()=>store.save(paid,before.revision),/stale/);
 const restored=store.read();assert.equal(restored.bank,'794000');assert.equal(restored.ship.mortgage.nextDueDate,'085-1105');assert.equal(restored.ship.maintenance.nextDueDate,'099-1105');
 const imported=JSON.parse(JSON.stringify(paid));store.replace(imported,restored.revision);assert.deepEqual(store.read().ship,paid.ship);assert.deepEqual(store.read().ledger,paid.ledger);
 store.save(undo(store.read()),store.read().revision);assert.deepEqual(store.read().ship,before.ship);assert.equal(store.read().bank,before.bank);
});

// Passenger contracts use the real Store and existing schema-1 replacement boundary.
import {recordPassengerSearch,configurePassengerCapacity,acceptPassengers,deliverPassengers} from '../js/state.mjs';
import {passengerOffers} from '../js/passenger-rules.mjs';
import {passengerShip} from '../js/passengers.mjs';
import {context as passengerWorldContext} from '../js/rules.mjs';
import {supportStock as passengerStock} from '../js/life-support.mjs';
import {readFile as readPassengerData} from 'node:fs/promises';
const passengerData=JSON.parse(await readPassengerData(new URL('../rules/core-2022.json',import.meta.url)));
function passengerStoreFixture(){
 let s=initial();s.initialized=true;s.actual='0,0';s.bank='100000';s.worlds=Object.fromEntries([0,1].map(x=>[x+',0',{id:x+',0',x,y:0,name:'Passenger port '+x,sector:'Test',hex:'0'+(x+1)+'01',uwp:'A788999-C',zone:'Safe',raw:{PBG:'100'}}]));
 s.ship.accommodation={combinedPeople:true,rooms:{low:0,middle:4,high:0},passengers:{low:0,middle:2,high:0},crew:{low:0,middle:0,high:0},occupiedLowBerths:0,luggageMode:'auto',luggageTons:'0'};s.ship.lifeSupport={capacityHours:672,stockUnits:{numerator:'112',denominator:'1'}};
 s=transition(s,'Passenger capacity settings',n=>configurePassengerCapacity(n,{reservedCabins:1,installedLowBerths:3}));
 const offers=passengerOffers(passengerWorldContext(s.worlds['0,0'],passengerData),passengerWorldContext(s.worlds['1,0'],passengerData),1,{effect:4,steward:1},passengerData,()=>3).map((o,i)=>({...o,offerId:'passenger-offer-'+i,origin:'0,0',destination:'1,0'}));
 return transition(s,'Passenger search',n=>recordPassengerSearch(n,{id:'passenger-search',label:'Passenger search audit',hours:0,world:'0,0',destination:'1,0',offers}));
}
test('passenger Store save/reload/import replacement preserves baseline, receipts, exact supplies and Undo',async t=>{
 const env=environment(t),original=passengerStoreFixture();env.values.set(KEY,JSON.stringify(original));const store=env.store();await store.acquire();await tick();
 const boarded=transition(store.read(),'Accepted passenger booking',n=>acceptPassengers(n,'passenger-offer-3',{count:2,cabinMode:'shared',serviceConfirmed:true}));store.save(boarded,original.revision);
 const loaded=store.read();assert.deepEqual(loaded.ship,original.ship);assert.equal(passengerStock(passengerShip(loaded)).dailyUnits,'4');assert.equal(loaded.contracts[0].count,2);
 const imported=JSON.parse(env.values.get(KEY));store.replace(imported,loaded.revision);const rebased=store.read();assert.equal(rebased.contracts[0].payment,'18000');
 const arrived=transition(rebased,'Arrived',n=>{n.actual='1,0';n.hours=25;});store.save(arrived,rebased.revision);const stockBefore=store.read().ship.lifeSupport;
 const delivered=transition(store.read(),'Delivered passenger booking',n=>deliverPassengers(n,n.contracts[0].id));store.save(delivered,arrived.revision);assert.equal(store.read().bank,'118000');assert.equal(store.read().ledger.filter(e=>e.type==='Passenger delivery').length,1);
 const restored=undo(store.read());store.save(restored,delivered.revision);assert.equal(store.read().bank,'100000');assert.equal(store.read().contracts[0].status,'accepted');assert.deepEqual(store.read().ship.lifeSupport,stockBefore);
 const before=env.values.get(KEY),bad=store.read();bad.contracts[0].count=-1;assert.throws(()=>store.replace(bad,restored.revision));assert.equal(env.values.get(KEY),before);
 store.editable=false;assert.throws(()=>store.save(transition(store.read(),'No write',n=>n.name='No'),restored.revision),/read-only/);assert.equal(env.values.get(KEY),before);
});
