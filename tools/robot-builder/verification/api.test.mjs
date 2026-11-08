import test from 'node:test';
import assert from 'node:assert/strict';
import {createRobotApi,STORE_KEY} from '../js/api.mjs';

function memory(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value))};
}
function serialLocks() {
  let tail = Promise.resolve();
  return {request:(_name,_options,callback)=>{const task=tail.then(callback);tail=task.catch(()=>{});return task;}};
}
let serial = 0;
function api(storage=memory(),extra={}) {
  return createRobotApi({storage,locks:serialLocks(),idFactory:()=>`design-${++serial}`,clock:()=> '2026-11-08T00:00:00.000Z',...extra});
}
function rename(instance,name) { instance.setIdentity({name}); }

test('controller imports only its own storage and saves explicit drafts', async()=>{
  const storage=memory({'traveller.trade.save':'untouched'});
  const instance=api(storage);
  rename(instance,'Workshop assistant');
  assert.equal(storage.getItem(STORE_KEY),null);
  await instance.saveDesign();
  assert.equal(instance.listSaved().length,1);
  assert.equal(instance.getView().dirty,false);
  assert.equal(storage.getItem('traveller.trade.save'),'untouched');
  assert.equal(api(storage).listSaved()[0].name,'Workshop assistant');
});
test('save as copy preserves original, loading is non-mutating',async()=>{
  const storage=memory(); const instance=api(storage);
  rename(instance,'Original'); await instance.saveDesign();
  const original=instance.listSaved()[0].id;
  rename(instance,'Copy'); await instance.saveDesign({asNew:true});
  const before=storage.getItem(STORE_KEY);
  instance.loadDesign(original);
  assert.equal(instance.getView().design.name,'Original');
  assert.equal(instance.listSaved().length,2);
  assert.equal(storage.getItem(STORE_KEY),before);
});
test('an update replaces only the selected saved design',async()=>{
  const instance=api(); rename(instance,'A');await instance.saveDesign();
  const a=instance.listSaved()[0].id;
  instance.newDesign();rename(instance,'B');await instance.saveDesign();
  const b=instance.listSaved()[1].id;
  instance.loadDesign(a);rename(instance,'A revised');await instance.saveDesign();
  assert.deepEqual(instance.listSaved().map(d=>[d.id,d.name]),[[a,'A revised'],[b,'B']]);
});
test('import stages a draft and never silently overwrites a save',async()=>{
  const storage=memory();const instance=api(storage);rename(instance,'Preserve');await instance.saveDesign();
  const bytes=storage.getItem(STORE_KEY);
  const imported=JSON.parse(instance.exportDesign());imported.name='Imported';
  instance.importDesign(JSON.stringify(imported));
  assert.equal(instance.getView().currentId,null);
  assert.equal(instance.getView().dirty,true);
  assert.equal(storage.getItem(STORE_KEY),bytes);
  await instance.saveDesign();
  assert.deepEqual(instance.listSaved().map(d=>d.name),['Preserve','Imported']);
});
test('invalid import preserves current draft and saved bytes',async()=>{
  const storage=memory();const instance=api(storage);rename(instance,'Keep');await instance.saveDesign();
  const before=instance.exportDesign(), bytes=storage.getItem(STORE_KEY);
  for(const json of ['{', '{"schemaVersion":999}', '{"__proto__":{"polluted":true}}']) assert.throws(()=>instance.importDesign(json));
  assert.equal(instance.exportDesign(),before);assert.equal(storage.getItem(STORE_KEY),bytes);
  assert.equal({}.polluted,undefined);
});
test('view and list snapshots cannot mutate the engine state',()=>{
  const instance=api();const before=instance.exportDesign();
  const view=instance.getView();view.design.name='Mutated';
  view.catalogue.kinds.length=0;
  assert.equal(instance.exportDesign(),before);
  assert.ok(instance.getView().catalogue.kinds.length>0);
});
test('damaged store blocks writes without deleting recoverable bytes',async()=>{
  for(const bytes of ['{','[]','{"schemaVersion":2,"revision":0,"designs":[]}']) {
    const storage=memory({[STORE_KEY]:bytes});const instance=api(storage);
    assert.equal(instance.getView().storageStatus.canSave,false);
    await assert.rejects(instance.saveDesign());
    assert.equal(storage.getItem(STORE_KEY),bytes);
    assert.ok(instance.exportDesign());
  }
});
test('stale tabs cannot overwrite newer saved designs',async()=>{
  const storage=memory(), locks=serialLocks();
  const a=api(storage,{locks}),b=api(storage,{locks});
  rename(a,'A');await a.saveDesign();
  rename(b,'B');await assert.rejects(b.saveDesign(),{code:'stale-store'});
  assert.equal(b.getView().design.name,'B');
  b.refreshSaved();await b.saveDesign();
  assert.deepEqual(b.listSaved().map(d=>d.name),['A','B']);
});
test('simultaneous saves are serialized and stale editor must refresh',async()=>{
  const storage=memory(),locks=serialLocks();
  const a=api(storage,{locks}),b=api(storage,{locks});rename(a,'A');rename(b,'B');
  const result=await Promise.allSettled([a.saveDesign(),b.saveDesign()]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(JSON.parse(storage.getItem(STORE_KEY)).designs.length,1);
});
test('write failure keeps old bytes and supports explicit retry',async()=>{
  const storage=memory(),set=storage.setItem;const instance=api(storage);rename(instance,'Retry');
  storage.setItem=()=>{throw new Error('quota');};
  await assert.rejects(instance.saveDesign(),{code:'save-failed'});
  assert.equal(storage.getItem(STORE_KEY),null);
  assert.equal(instance.getView().dirty,true);
  storage.setItem=set;await instance.saveDesign();
  assert.equal(instance.listSaved().length,1);
});
test('write then throw is reconciled as one successful save',async()=>{
  const storage=memory(),set=storage.setItem;
  storage.setItem=(k,v)=>{set(k,v);throw new Error('after write');};
  const instance=api(storage);rename(instance,'Written');await instance.saveDesign();
  assert.equal(instance.listSaved().length,1);assert.equal(instance.getView().dirty,false);
});
test('unconfirmed write blocks automatic retries and preserves draft',async()=>{
  const storage=memory(),get=storage.getItem,set=storage.setItem;let written=false;
  storage.getItem=key=>{if(written)throw new Error('read denied');return get(key);};
  storage.setItem=(key,value)=>{set(key,value);written=true;throw new Error('uncertain');};
  const instance=api(storage);rename(instance,'Uncertain');
  await assert.rejects(instance.saveDesign(),{code:'save-uncertain'});
  assert.equal(instance.getView().storageStatus.canSave,false);
  assert.equal(instance.getView().design.name,'Uncertain');
  await assert.rejects(instance.saveDesign());
  assert.equal(JSON.parse(storage.map.get(STORE_KEY)).designs.length,1);
});
test('missing safe locking disables writes but leaves build/export available',async()=>{
  const instance=api(memory(),{locks:{}});
  assert.equal(instance.getView().storageStatus.canSave,false);
  rename(instance,'Exportable');assert.ok(instance.exportDesign().includes('Exportable'));
  await assert.rejects(instance.saveDesign(),{code:'locks-unavailable'});
});
test('busy save prevents repeated clicks and intervening edits',async()=>{
  let release;const locks={request:async(_name,_options,callback)=>{await new Promise(resolve=>release=resolve);return callback();}};
  const instance=api(memory(),{locks});rename(instance,'One');
  const pending=instance.saveDesign();
  assert.equal(instance.getView().busy,true);
  assert.throws(()=>rename(instance,'Two'),{code:'save-pending'});
  await assert.rejects(instance.saveDesign(),{code:'save-pending'});
  release();await pending;assert.equal(instance.listSaved().length,1);
});
test('failed refresh cannot erase an in-progress design',()=>{
  const storage=memory();const instance=api(storage);rename(instance,'Keep my draft');
  storage.setItem(STORE_KEY,'broken');
  assert.throws(()=>instance.refreshSaved());
  assert.equal(instance.getView().design.name,'Keep my draft');
  assert.equal(storage.getItem(STORE_KEY),'broken');
});
test('controller observers receive detached snapshots and can unsubscribe',()=>{
  const instance=api();let calls=0;
  const off=instance.subscribe(view=>{calls++;view.design.name='Changed by listener';});
  rename(instance,'Visible');assert.equal(instance.getView().design.name,'Visible');assert.equal(calls,1);
  off();rename(instance,'Another');assert.equal(calls,1);
});

