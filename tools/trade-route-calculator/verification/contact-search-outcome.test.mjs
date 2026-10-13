import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {prepareContactSearchOutcome,contactSearchStatus} from '../js/contact-search.mjs';
import {harness,campaign,core,origin} from './app-harness.mjs';
const source=await readFile(new URL('fixtures/contact-search-outcome-before-pilot.mjs',import.meta.url),'utf8');
const before=vm.runInNewContext(source+'\nbeforeContactSearchOutcome');
const input=()=>({skill:0,rolled:2,duration:2,characteristic:0,counterparty:2,starport:'A',starportDM:{...core.search.starportDM},previous:0,durationUnit:'days',successOverride:false});
function result(call){try{const {port,total,success,hours}=call();return {port,total,success,hours};}catch(e){return {error:e.message};}}
test('search totals, success flags and elapsed hours equal checkpoint arithmetic without input mutation',()=>{
 let count=0;
 for(const skill of [-3,0,2])for(const rolled of [2,7,8,12])for(const duration of [1,6])for(const characteristic of [-2,0,3])for(const counterparty of [-2,0,3])for(const starport of ['A','X','?'])for(const previous of [0,1,7])for(const durationUnit of ['days','hours'])for(const successOverride of [false,true]){
  const i={...input(),skill,rolled,duration,characteristic,counterparty,starport,previous,durationUnit,successOverride},saved=structuredClone(i);Object.freeze(i);
  assert.deepEqual(result(()=>prepareContactSearchOutcome(i)),result(()=>before(i)),JSON.stringify(i));assert.deepEqual(i,saved);count++;
 }
 assert.equal(count,7776);
});
test('integer/range errors precede starport lookup and retain exact message; no new skill or counterparty bounds',()=>{
 for(const field of ['skill','rolled','duration','characteristic','counterparty'])for(const value of [NaN,Infinity,-Infinity,1.5,'2',null,undefined]){
  const i={...input(),[field]:value,starportDM:null};assert.deepEqual(result(()=>prepareContactSearchOutcome(i)),result(()=>before(i)));assert.equal(result(()=>prepareContactSearchOutcome(i)).error,'Invalid search input');
 }
 for(const [field,values]of [['rolled',[-2,0,1,13]],['duration',[-1,0,7]]])for(const value of values){const i={...input(),[field]:value};assert.deepEqual(result(()=>prepareContactSearchOutcome(i)),{error:'Invalid search input'});assert.deepEqual(result(()=>prepareContactSearchOutcome(i)),result(()=>before(i)));}
 const absentTable={...input(),starportDM:null};assert.deepEqual(result(()=>prepareContactSearchOutcome(absentTable)),result(()=>before(absentTable)));
 for(const starportDM of [{},{A:0},{A:-2}])for(const durationUnit of ['days','hours','other']){const i={...input(),starportDM,durationUnit};assert.deepEqual(result(()=>prepareContactSearchOutcome(i)),result(()=>before(i)));}
 const freeIntegers={...input(),skill:-100,characteristic:100,counterparty:-100};assert.deepEqual(result(()=>prepareContactSearchOutcome(freeIntegers)),result(()=>before(freeIntegers)));
});
test('headless consumer derives outcome and proposed end time using an existing period without dice or campaign mutation',()=>{
 const state=campaign(),saved=structuredClone(state),previous=contactSearchStatus(state).previous;
 const i={...input(),previous};assert.deepEqual(prepareContactSearchOutcome(i),{port:6,total:8,success:true,hours:48});
 assert.equal(state.hours+prepareContactSearchOutcome(i).hours,48);
 assert.deepEqual(prepareContactSearchOutcome({...i,durationUnit:'hours'}),{port:6,total:8,success:true,hours:2});
 assert.deepEqual(prepareContactSearchOutcome({...i,previous:1}),{port:6,total:7,success:false,hours:48});
 assert.deepEqual(prepareContactSearchOutcome({...i,previous:1,successOverride:true}),{port:6,total:7,success:true,hours:48});
 assert.deepEqual(state,saved);
});
test('production buyer/supplier adapter retains eligibility, identity and cooldown errors before numeric validation',async()=>{
 for(const kind of ['supplier','buyer'])for(const scenario of ['method','tech','party','cooldown','numeric']){
  const state=campaign();if(scenario==='tech')state.worlds[origin.id].uwp='A788899-7';if(scenario==='cooldown')state.cooldowns[origin.id+'|synthetic party']=10;
  const h=harness(state);h.api.searchDialog(kind);h.fill({method:scenario==='method'?'bad':scenario==='tech'?'online':'normal',party:scenario==='party'?'  ':'Synthetic party',dice:1,duration:1});await h.submit();
  const expected={method:'Invalid search method',tech:'Online search requires TL8+',party:'Counterparty identity required',cooldown:'This counterparty is still in rejection cooldown.',numeric:'Invalid search input'};
  assert.equal(h.dom.ids.get('modal-error').textContent,expected[scenario]);assert.equal(h.calls.saves,0);assert.deepEqual(h.persisted(),state);
 }
});
