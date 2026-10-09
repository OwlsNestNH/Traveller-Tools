import test from 'node:test';
import assert from 'node:assert/strict';
import {Store, KEY} from '../js/persistence.mjs';
import {initial, transition, validate, undo} from '../js/state.mjs';

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
