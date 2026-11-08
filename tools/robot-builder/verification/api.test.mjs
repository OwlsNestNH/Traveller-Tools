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

test('delayed file import cannot replace a newer draft or change saved bytes',async()=>{
 const storage=memory();const instance=api(storage);await instance.saveDesign();const bytes=storage.getItem(STORE_KEY),old=instance.exportDesign(),revision=instance.getView().draftRevision;
 instance.setIdentity({name:'Newer edit'});assert.throws(()=>instance.importDesign(old,revision),{code:'draft-changed'});
 assert.equal(instance.getView().design.name,'Newer edit');assert.equal(storage.getItem(STORE_KEY),bytes);
 const current=instance.getView().draftRevision;instance.importDesign(old,current);assert.equal(instance.getView().design.name,'Untitled robot');
});

test('component commands reject ambiguous sources and unsupported types atomically',()=>{
 const instance=api(),before=instance.exportDesign();
 assert.throws(()=>instance.attachDesignReference({role:'body',savedId:'saved',json:before}),{code:'invalid-reference'});
 assert.throws(()=>instance.attachDesignReference({role:'body',json:before}),{code:'references-unavailable'});
 assert.throws(()=>instance.attachDesignReference({role:'body',json:before,extra:true}),{code:'invalid-reference'});
 assert.equal(instance.exportDesign(),before);
});
test('saved components are copied into a parent without mutating the original save',async()=>{
 const storage=memory();const instance=api(storage);instance.setIdentity({name:'Installed robot',techLevel:13});await instance.saveDesign();
 const savedId=instance.listSaved()[0].id,bytes=storage.getItem(STORE_KEY);instance.newDesign('ship-brain');
 instance.attachDesignReference({role:'installed-robot',savedId});let view=instance.getView();
 assert.equal(view.evaluation.status,'verified');assert.equal(view.evaluation.totals.cost,512000);assert.equal(view.design.special.designReferences[0].design.name,'Installed robot');assert.equal(storage.getItem(STORE_KEY),bytes);
 const exported=instance.exportDesign(),id=view.design.special.designReferences[0].id;instance.removeDesignReference(id);assert.equal(instance.getView().design.special.designReferences.length,0);
 instance.importDesign(exported);view=instance.getView();assert.equal(view.design.special.designReferences[0].id,id);assert.equal(view.currentId,null);assert.equal(storage.getItem(STORE_KEY),bytes);
 instance.loadDesign(savedId);instance.setIdentity({name:'Edited original'});assert.equal(JSON.parse(exported).special.designReferences[0].design.name,'Installed robot');
});

test('component file imports are atomic, revision guarded and never trust supplied totals',()=>{
 const instance=api();instance.setIdentity({techLevel:13});const child=instance.exportDesign();instance.newDesign('ship-brain');const before=instance.exportDesign(),revision=instance.getView().draftRevision;
 for(const command of [{role:'installed-robot',json:'{'},{role:'installed-robot',savedId:'missing'}])assert.throws(()=>instance.attachDesignReference(command));
 assert.equal(instance.exportDesign(),before);instance.setIdentity({name:'Revised host'});assert.throws(()=>instance.attachDesignReference({role:'installed-robot',json:child,expectedRevision:revision}),{code:'draft-changed'});
 const forged=JSON.parse(child);forged.totals={cost:0};assert.throws(()=>instance.attachDesignReference({role:'installed-robot',json:JSON.stringify(forged)}));
 instance.attachDesignReference({role:'installed-robot',json:child,expectedRevision:instance.getView().draftRevision});assert.equal(instance.getView().evaluation.totals.cost,512000);
});