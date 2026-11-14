import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession,COMPATIBLE_RULES_REVISIONS,RULES_REVISION} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function start(revision=RULES_REVISION,boons=0){let r=run({...createSession('aezorgh-round-up'),rulesRevision:revision},'configure',{aezorghTwoDice:true,boons});return run(r,'setup',{species:'aezorgh'});}
function pool(values,revision=RULES_REVISION){let r=run(start(revision),'roll-statistics');r=run(r,'gm-mode',{enabled:true});values.forEach((value,index)=>{r=run(r,'gm-override',{field:'pool',index,value,reason:'Explicit odd/even rounding regression'});});return run(r,'gm-mode',{enabled:false});}
test('new optional Aezorgh sessions round every raw2D total up after placement, before bonuses',()=>{
 for(let value=2;value<=12;value++){
  const r=pool(Array(6).fill(value)),half=Math.ceil(value/2);assert.equal(r.state.aezorghRoundUp,true);
  assert.deepEqual(r.state.pool.map(p=>p.derivedBase),[half,value,half,value,half,half]);
  assert.deepEqual(r.state.pool.map(p=>p.value),[half,value+3,half+1,value+2,half,half]);
  assert.equal(r.state.rollTotal,value*6);assert.equal(r.state.statisticsRerollThreshold,43);
  const accepted=run(r,'accept-statistics');for(const p of r.state.pool)assert.equal(accepted.state.character.stats[p.key],p.value);
  assert.equal(Object.hasOwn(accepted.state.character.stats,'CHA'),false);
 }
});
test('all swaps recalculate destination ceiling, leave raw total unchanged and replay exactly',()=>{
 const initial=pool([5,8,7,9,3,11]);
 for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){
  const r=run(initial,'swap-statistics',{a,b});assert.equal(r.state.rollTotal,43);
  for(const p of r.state.pool)assert.equal(p.derivedBase,Math.ceil(p.base/p.divisor));
  const saved=exportSession(r.session);assert.equal(exportSession(importSession(saved)),saved);assert.deepEqual(project(importSession(saved)).state,r.state);
 }
});
test('new boons retain best two before rounding; targeted replay and original audit preserved',()=>{
 for(let boons=0;boons<=6;boons++){
  let r=run(start(RULES_REVISION,boons),'roll-statistics');const revision=r.revision,original=structuredClone(r.log.at(-1).rolls);
  assert.equal(original.filter(x=>x.values.length===3).length,boons);
  r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-replay',{revision,rollIndex:0,values:boons?[1,4,3]:[4,3],reason:'Odd kept total rounds up'});
  assert.equal(r.state.pool[0].base,7);assert.equal(r.state.pool[0].derivedBase,4);assert.equal(r.state.pool[0].value,4);assert.deepEqual(r.log[revision-1].rolls,original);
  assert.match(r.log.at(-1).summary,/round up before species bonuses/);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 }
});
test('compatible .16-.21 revisions retain floor outcomes, summaries, bytes and continued play',()=>{
 for(const revision of COMPATIBLE_RULES_REVISIONS.filter(x=>![RULES_REVISION,'character-preview-2026-11-13.34','character-preview-2026-11-13.33','character-preview-2026-11-13.32','character-preview-2026-11-09.31','character-preview-2026-11-09.30','character-preview-2026-11-09.29','character-preview-2026-11-09.27','character-preview-2026-11-09.22','character-preview-2026-11-09.23','character-preview-2026-11-09.24','character-preview-2026-11-09.25'].includes(x))){
  let r=pool([5,8,7,9,3,11],revision);assert.equal(r.state.aezorghRoundUp,undefined);assert.deepEqual(r.state.pool.map(p=>p.derivedBase),[2,8,3,9,1,5]);
  assert.match(r.log.find(x=>x.type==='roll-statistics').summary,/round down before species bonuses/);
  const saved=exportSession(r.session);assert.equal(exportSession(importSession(saved)),saved);assert.deepEqual(project(importSession(saved)).state,r.state);
  r=run(r,'swap-statistics',{a:0,b:3});assert.equal(r.state.pool[0].derivedBase,4);r=run(r,'accept-statistics');assert.equal(r.state.character.stats.STR,4);assert.equal(r.session.rulesRevision,revision);
 }
});
test('new setup and configure explicitly state round-up; standard formulas remain unchanged',()=>{
 const r=start();assert.match(r.log[0].summary,/rounding up/);assert.match(r.log[1].summary,/rounding up/);
 let standard=run(createSession('standard-rounding'),'setup',{species:'aezorgh'});standard=run(standard,'roll-statistics');assert.deepEqual(standard.state.pool.map(p=>p.count),[1,2,1,2,1,1]);for(const p of standard.state.pool)assert.equal(p.derivedBase,p.base);assert.equal(standard.state.statisticsRerollThreshold,30);
});

test('compatible .22 preserves its historical ceiling and continued play',()=>{let r=pool([5,8,7,9,3,11],'character-preview-2026-11-09.22');assert.equal(r.state.aezorghRoundUp,true);assert.deepEqual(r.state.pool.map(p=>p.derivedBase),[3,8,4,9,2,6]);const raw=exportSession(r.session);assert.equal(exportSession(importSession(raw)),raw);r=run(r,'swap-statistics',{a:0,b:3});assert.equal(r.state.pool[0].derivedBase,5);r=run(r,'accept-statistics');assert.equal(r.state.character.stats.STR,5);assert.equal(r.session.rulesRevision,'character-preview-2026-11-09.22');});
