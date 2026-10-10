import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as S from '../js/state.mjs';
import * as A from '../js/amounts.mjs';
import {configureFuel,fuelCapacities,validateFuel,bladderSpace,jumpFuel} from '../js/fuel.mjs';
import {Store,KEY} from '../js/persistence.mjs';

const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
function legacy(extra=2,{hull=200,jump=2,aboard=40,hold='100'}={}){
 const s=S.initial();s.ship.jump=jump;s.ship.capacity=hold;
 const bladderTons=extra*Math.ceil(hull*jump/10);
 s.ship.fuel={displacementTons:hull,baseCapacityTons:40,aboardTons:aboard,bladderJumps:extra,bladderTons,capacityTons:40+bladderTons};return s;
}
function readSettings(state,changes={}){
 const f=state.ship.fuel,c=fuelCapacities(state.ship),values={shipTons:f?.displacementTons??'',fuelCapacity:c?.baseCapacityTons??'',fuelAboard:f?.aboardTons??'',bladderTons:c?.bladderTons??0,capacity:state.ship.capacity,jump:state.ship.jump,...changes};
 const sandbox={state,A,configureFuel,fuelCapacities};vm.runInNewContext(app.match(/^function readFuel.*$/m)[0]+';globalThis.read=readFuel;',sandbox);
 return sandbox.read({get:name=>values[name]??null});
}
const roundtrip=s=>S.validate(JSON.parse(JSON.stringify(s)));

test('legacy full-range jumps use actual hull/rating while new input 2 means exactly 2 tons',()=>{
 for(const [hull,jump,extra,want]of [[200,2,2,80],[201,2,2,82],[300,3,1,90],[200,1,2,40]]){
  const s=legacy(extra,{hull,jump,hold:'160'}),bytes=JSON.stringify(s);S.validate(s);
  assert.equal(fuelCapacities(s.ship).bladderTons,want);assert.equal(readSettings(s).bladderTons,want);assert.equal(JSON.stringify(s),bytes,'Reading does not rewrite the save or Undo');
 }
 const s=legacy();s.ship.fuel=readSettings(s,{bladderTons:'2'});assert.equal(s.ship.fuel.capacityTons,42);assert.equal(s.ship.fuel.bladderTons,2);assert.equal(Object.hasOwn(s.ship.fuel,'bladderJumps'),false);
 assert.equal(jumpFuel(s.ship,2).tons,40);s.ship.jump=3;S.validate(s);assert.equal(s.ship.fuel.capacityTons,42);assert.equal(jumpFuel(s.ship,3).tons,60);
});

test('legacy alternate count key needs actual hull/rating and cannot overwrite contradictory saved capacity',()=>{
 const s=legacy();s.ship.fuel.extraFullRangeJumps=s.ship.fuel.bladderJumps;delete s.ship.fuel.bladderJumps;delete s.ship.fuel.bladderTons;
 assert.equal(fuelCapacities(s.ship).bladderTons,80);assert.equal(readSettings(s).bladderTons,80);
 for(const change of [s=>delete s.ship.jump,s=>delete s.ship.fuel.displacementTons,s=>s.ship.fuel.bladderTons=2,s=>s.ship.fuel.extraFullRangeJumps=1.5,s=>s.ship.fuel.capacityTons=42]){
  const bad=structuredClone(s);change(bad);assert.throws(()=>validateFuel(bad.ship));
 }
});

test('direct capacities have specific bounds, preserve existing fuel, and do not reserve empty cargo',()=>{
 const s=legacy(1,{hold:'50',aboard:60});
 for(const [changes,error]of [[{bladderTons:'-1'},/nonnegative whole/],[{bladderTons:'2.5'},/nonnegative whole/],[{bladderTons:'NaN'},/nonnegative whole/],[{bladderTons:'Infinity'},/nonnegative whole/],[{bladderTons:'161'},/exceed ship displacement/],[{bladderTons:'51'},/exceeds cargo hold capacity.*50 tons/],[{bladderTons:'19'},/Fuel aboard exceeds total fuel capacity/],[{bladderTons:'0'},/shrinking or removing/]])assert.throws(()=>readSettings(s,changes),error);
 s.ship.fuel=readSettings(s,{bladderTons:'20'});assert.equal(s.ship.fuel.aboardTons,60);assert.equal(bladderSpace(s.ship),20);
 s.lots=[{id:'cargo',commodity:'11',description:'Cargo',quantity:'31',basis:'0',goodsValue:'0'}];assert.throws(()=>S.validate(s),/Fuel in bladders would exceed cargo capacity: 20 t of fuel, with 19 t available/);
 s.ship.fuel.aboardTons=40;S.validate(s);assert.equal(bladderSpace(s.ship),0);assert.equal(A.decimal(S.used(s)),'31');
});

test('existing oversized legacy capacity survives unrelated settings saves but not new installation or hold reduction',()=>{
 const s=legacy(2,{hold:'50'}),before=JSON.stringify(s);
 const migrated=readSettings(s);assert.equal(migrated.bladderTons,80);assert.equal(JSON.stringify(s),before);
 s.ship.fuel=migrated;assert.equal(readSettings(s).bladderTons,80,'Subsequent unrelated saves keep the same installed capacity');
 assert.throws(()=>readSettings(s,{bladderTons:'81'}),/exceeds cargo hold capacity/);
 assert.throws(()=>readSettings(s,{capacity:'49'}),/exceeds cargo hold capacity/);
 assert.equal(readSettings(s,{capacity:'51'}).bladderTons,80);
 assert.equal(readSettings(s,{bladderTons:'50'}).bladderTons,50);
 const fresh=S.initial();assert.throws(()=>readSettings(fresh,{shipTons:'200',fuelCapacity:'40',fuelAboard:'40',bladderTons:'80',capacity:'50'}),/exceeds cargo hold capacity/);
});

test('supplied null, fractional, negative and inconsistent imported capacities are rejected',()=>{
 for(const key of ['bladderJumps','bladderTons','baseCapacityTons','capacityTons'])for(const value of [null,-1,1.5,'40']){
  const s=legacy();s.ship.fuel[key]=value;assert.throws(()=>validateFuel(s.ship),key+' '+value);
 }
 for(const key of ['bladderTons','baseCapacityTons']){
  const s=legacy(0);delete s.ship.fuel.bladderJumps;s.ship.fuel[key]=null;assert.throws(()=>validateFuel(s.ship));
 }
});

test('blank untracked fuel stays absent and a bladder-only setup is not silently discarded',()=>{
 const s=S.initial();assert.equal(readSettings(s),undefined);
 assert.throws(()=>readSettings(s,{bladderTons:'2'}),/before adding bladder capacity/);
 assert.throws(()=>readSettings(s,{fuelCapacity:'40'}),/fuel aboard together/);
});

test('real persistence preserves legacy Undo through migration, save, import, reload, and repeated Undo',t=>{
 const descriptors=Object.fromEntries(['window','localStorage','BroadcastChannel'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const values=new Map();Object.defineProperties(globalThis,{window:{value:{addEventListener(){}},configurable:true},localStorage:{value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))},configurable:true},BroadcastChannel:{value:undefined,configurable:true}});
 t.after(()=>{for(const [k,d]of Object.entries(descriptors))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];});
 const initial=legacy(1,{aboard:60,hold:'50'}),old=S.transition(initial,'Legacy extra jump',n=>{n.ship.fuel=legacy(2,{aboard:60}).ship.fuel;});
 values.set(KEY,JSON.stringify(old));let rendered;const store=new Store(s=>rendered=s,()=>{});store.editable=true;
 const bytes=values.get(KEY),loaded=store.read();assert.equal(values.get(KEY),bytes);assert.equal(loaded.ship.fuel.bladderTons,80);
 const settings=S.transition(loaded,'Settings direct tons',n=>{n.ship.fuel=readSettings(loaded);n.settings.insurance=true;});store.save(settings,loaded.revision);
 assert.equal(rendered.ship.fuel.bladderTons,80);assert.equal(Object.hasOwn(rendered.ship.fuel,'bladderJumps'),false);assert.equal(bladderSpace(rendered.ship),20);
 const saved=store.read();store.replace(roundtrip(saved),saved.revision);assert.equal(store.read().ship.fuel.bladderTons,80);
 const undone=S.undo(store.read());store.save(undone,store.read().revision);assert.deepEqual(store.read().ship.fuel,old.ship.fuel);assert.equal(store.read().settings.insurance,false);
 const older=S.undo(store.read());store.save(older,store.read().revision);assert.deepEqual(store.read().ship.fuel,initial.ship.fuel);assert.equal(store.read().ship.fuel.aboardTons,60);
 const direct=S.transition(store.read(),'Direct two tons',n=>{n.ship.fuel=readSettings(n,{fuelAboard:'40',bladderTons:'2'});});store.save(direct,store.read().revision);assert.equal(store.read().ship.fuel.capacityTons,42);
 const shrink=S.transition(store.read(),'Remove bladders',n=>{n.ship.fuel=readSettings(n,{bladderTons:'0'});});store.save(shrink,store.read().revision);assert.equal(store.read().ship.fuel.capacityTons,40);
 const restored=S.undo(store.read());store.save(restored,store.read().revision);assert.equal(store.read().ship.fuel.bladderTons,2);
});

test('compact Overview labels base tanks and bladders distinctly, including old tank-only campaigns',()=>{
 for(const state of [legacy(),{ship:{fuel:{displacementTons:200,capacityTons:40,aboardTons:10}}}]){
  const sandbox={state,fuelCapacities};const fn=app.slice(app.indexOf('function fuelCounter(){'),app.indexOf('\nfunction shipActions()'));
  vm.runInNewContext(fn+';globalThis.markup=fuelCounter();',sandbox);
  assert.match(sandbox.markup,/Tank 40t/);assert.match(sandbox.markup,state.ship.fuel.bladderJumps?/Aboard 40t · Tank 40t · Bladder 80t/:/Aboard 10t · Tank 40t · Bladder 0t/);
  assert.match(sandbox.markup,/tons total capacity/);assert.doesNotMatch(sandbox.markup,/Tank 120t/);
 }
});
