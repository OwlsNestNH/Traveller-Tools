import test from 'node:test';
import assert from 'node:assert/strict';
import {SaveBoundary, SAVE_KEY, browserExclusive} from '../js/persistence.mjs';

const initial = () => ({schemaVersion:1, revision:0, appliedCommands:[], cash:600000, quote:null});
function validate(s) {
  assert.equal(s.schemaVersion, 1);
  assert.ok(Number.isSafeInteger(s.revision) && s.revision >= 0);
  assert.ok(Array.isArray(s.appliedCommands));
  assert.ok(Number.isSafeInteger(s.cash) && s.cash >= 0);
}
function setup() {
  const data = new Map();
  const storage = {getItem:k=>data.get(k) ?? null, setItem:(k,v)=>data.set(k,v)};
  let tail = Promise.resolve();
  const exclusive = fn => { const next = tail.then(fn); tail = next.catch(()=>{}); return next; };
  const load = () => new SaveBoundary({storage,initial:initial(),validate,exclusive});
  return {storage,data,load};
}
test('simultaneous repeated commit charges once and retains original quote through reload', async () => {
  const {load} = setup(); const store = load();
  let rolls = 0;
  await store.command('quote-1', s => { s.quote = {dice:++rolls,value:110000,cost:100000}; return s; });
  const reloaded = load();
  const sell = s => { s.cash += s.quote.value; s.quote.sold = true; return s; };
  await Promise.all([reloaded.command('sale-1',sell),reloaded.command('sale-1',sell)]);
  assert.equal(load().snapshot().cash,710000);
  assert.equal(load().snapshot().quote.cost,100000);
  assert.equal(rolls,1);
});
test('known unwritten save retains prepared dice and retries without command execution', async () => {
  const {storage,load} = setup(); const store = load(); const write = storage.setItem;
  storage.setItem = () => { throw Error('quota'); }; let rolls = 0;
  await assert.rejects(store.command('quote',s=>{s.quote={dice:++rolls,value:123};return s;}),/not written/);
  assert.equal(store.snapshot().quote,null);
  await assert.rejects(store.command('other',s=>s),/pending/);
  storage.setItem = write; await store.retry();
  assert.equal(load().snapshot().quote.dice,1); assert.equal(rolls,1);
});
test('throw after successful write is recognized and is never charged twice', async () => {
  const {storage,load} = setup(); const store = load(); const write = storage.setItem;
  storage.setItem = (k,v)=>{write(k,v);throw Error('late failure');};
  await store.command('buy',s=>{s.cash-=100000;return s;});
  await store.command('buy',()=>{throw Error('duplicate executed');});
  assert.equal(load().snapshot().cash,500000);
});
test('unreadable outcome stops edits and retry; reload recovers actual saved candidate', async () => {
  const {storage,load} = setup(); const store = load(); const read = storage.getItem, write = storage.setItem;
  storage.setItem = (k,v)=>{write(k,v);storage.getItem=()=>{throw Error('read failed');};};
  await assert.rejects(store.command('buy',s=>{s.cash-=100000;return s;}),/uncertain/);
  await assert.rejects(store.retry(),/uncertain/);
  storage.getItem=read; assert.equal(load().snapshot().cash,500000);
});
test('stale editor cannot overwrite another editor', async () => {
  const {load} = setup(); const first=load(), stale=load();
  await first.command('buy',s=>{s.cash-=100000;return s;});
  await assert.rejects(stale.command('other',s=>{s.cash=1;return s;}),/another editor/);
  assert.equal(load().snapshot().cash,500000);
});
test('invalid transition or cancellation writes nothing and leaves save usable', async () => {
  const {data,load} = setup(); const store=load();
  await assert.rejects(store.command('invalid',s=>{s.cash=-1;return s;}));
  await assert.rejects(store.command('cancel',()=>{throw Error('cancelled');}),/cancelled/);
  assert.equal(data.has(SAVE_KEY),false);
  await store.command('valid',s=>s); assert.equal(load().snapshot().revision,1);
});
test('unsupported browser locks fail closed', () => {
  assert.throws(()=>browserExclusive({})(()=>{}),/safe editor locks/);
});
test('queued clicks cannot replace a failed prepared result; simultaneous retries save it once', async () => {
  const {storage,load}=setup(); const store=load(), write=storage.setItem;
  storage.setItem=()=>{throw Error('quota');}; let runs=0;
  const outcomes=await Promise.allSettled([
    store.command('first',s=>{runs++;s.cash-=100;return s;}),
    store.command('second',s=>{runs++;s.cash-=200;return s;})
  ]);
  assert.ok(outcomes.every(x=>x.status==='rejected')); assert.equal(runs,1);
  storage.setItem=write;
  await Promise.all([store.retry(),store.retry()]);
  assert.equal(load().snapshot().cash,599900);
  assert.deepEqual(load().snapshot().appliedCommands,['first']);
});
test('importing an earlier save replaces command history so future deterministic commands can execute again',async()=>{
  const {load}=setup(),store=load();const earlier=store.snapshot();
  await store.command('arrive:1',s=>{s.cash+=100;return s;});
  await store.command('import:1',()=>earlier,{replaceHistory:true});
  await store.command('arrive:1',s=>{s.cash+=100;return s;});
  assert.equal(load().snapshot().cash,600100);
  assert.deepEqual(load().snapshot().appliedCommands,['import:1','arrive:1']);
});
test('explicit validated backup recovery retains corrupt bytes until replacement save succeeds',async()=>{
  const {storage,data}=setup();data.set(SAVE_KEY,'invalid-json');
  const store=new SaveBoundary({storage,initial:initial(),validate,exclusive:fn=>fn(),allowInvalidExisting:true});
  assert.equal(storage.getItem(SAVE_KEY),'invalid-json');
  const write=storage.setItem;storage.setItem=()=>{throw Error('quota');};
  await assert.rejects(store.command('restore',()=>initial(),{replaceHistory:true}),/not written/);
  assert.equal(storage.getItem(SAVE_KEY),'invalid-json');storage.setItem=write;await store.retry();
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).cash,600000);
});
