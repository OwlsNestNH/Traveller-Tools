import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {api,createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function start(species='human',minimumTotal=43,extra={}){let r=run(createSession('threshold-'+species),'configure',{minimumTotal,...extra});return run(r,'setup',{species});}
function pool(total,minimumTotal){let r=run(start('human',minimumTotal),'roll-statistics');r=run(r,'gm-mode',{enabled:true});for(let i=0;i<6;i++)r=run(r,'gm-override',{field:'pool',index:i,value:Math.floor(total/6)+(i<total%6?1:0),reason:'Threshold boundary test'});return run(r,'gm-mode',{enabled:false});}
test('adjusted thresholds enforce strict boundaries above and below default',()=>{
 for(const threshold of [35,50]){const below=pool(threshold-1,threshold),exact=pool(threshold,threshold);assert.equal(below.state.statisticsRerollThreshold,threshold);assert.doesNotThrow(()=>run(below,'roll-statistics'));assert.throws(()=>run(exact,'roll-statistics'),new RegExp(String(threshold)));}
});
test('custom threshold is validated atomically by public API',()=>{
 const session=createSession('invalid-threshold'),before=exportSession(session);
 for(const value of [5,73,42.5,'43',null,NaN,Infinity]){const result=api({operation:'command',session,command:{type:'configure',payload:{minimumTotal:value}}});assert.equal(result.ok,false);assert.match(result.error.message,/Minimum raw total/);assert.equal(exportSession(session),before);}
 for(const minimumTotal of [6,72])assert.equal(start('human',minimumTotal).state.statisticsRerollThreshold,minimumTotal);
});
test('custom threshold and checkbox persist through save replay without changing dice formulas',()=>{
 for(const species of ['human','aezorgh'])for(const aezorghTwoDice of species==='aezorgh'?[false,true]:[false]){
  let r=start(species,38,{aezorghTwoDice,minimumReroll:false});assert.match(r.log[0].summary,/below-38 reroll off/);r=run(r,'roll-statistics');
  assert.deepEqual(r.state.pool.map(p=>p.count),species==='aezorgh'&&!aezorghTwoDice?[1,2,1,2,1,1]:[2,2,2,2,2,2]);
  assert.equal(r.state.statisticsRerollThreshold,38);assert.throws(()=>run(r,'roll-statistics'),/38/);
  assert.throws(()=>run(r,'configure',{minimumTotal:40}),/before rolling/);
  const saved=exportSession(r.session);assert.equal(exportSession(importSession(saved)),saved);assert.deepEqual(project(importSession(saved)).state,r.state);
 }
});
test('omitted option keeps original config shape and species defaults',()=>{
 for(const species of ['human','aezorgh']){let r=run(createSession('legacy-threshold-'+species),'setup',{species});assert.equal(Object.hasOwn(r.state.config,'minimumTotal'),false);assert.equal(r.state.statisticsRerollThreshold,species==='aezorgh'?30:43);const saved=exportSession(r.session);assert.equal(exportSession(importSession(saved)),saved);}
});
test('spinner defaults follow species and method while custom values survive switches',()=>{
 const source=fs.readFileSync(new URL('../gui/app.mjs',import.meta.url),'utf8'),a=source.indexOf('function syncRerollOptions('),b=source.indexOf('\nfunction syncIdentityOptions',a),nodes={};
 const sync=vm.runInNewContext(source.slice(a,b)+';syncRerollOptions',{$:id=>nodes[id]??={}});
 const input={value:'43',dataset:{}},form={elements:{species:{value:'human'},aezorghTwoDice:{checked:false},minimumTotal:input}};
 sync(form);assert.equal(input.value,'43');form.elements.species.value='aezorgh';sync(form);assert.equal(input.value,'30');form.elements.aezorghTwoDice.checked=true;sync(form);assert.equal(input.value,'43');
 input.value='50';input.dataset.customTotal='true';sync(form);form.elements.aezorghTwoDice.checked=false;sync(form);assert.equal(input.value,'50');form.elements.species.value='human';sync(form);assert.equal(input.value,'50');assert.match(nodes['#reroll-option-text'].textContent,/50/);input.value='43';form.elements.species.value='aezorgh';sync(form);assert.equal(input.value,'43');assert.match(nodes['#reroll-option-text'].textContent,/43/);
});
