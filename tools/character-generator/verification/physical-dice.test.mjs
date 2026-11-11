import test from 'node:test';
import assert from 'node:assert/strict';
import {api,createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function start(species='human',config={},identity={}){let r=run(createSession('physical-dice-'+species),'configure',{physicalDice:true,...config});return run(r,'setup',{species,...(species==='aslan'?{gender:'male'}:{}),...identity});}
function fill(r,value=7){for(const p of r.state.physicalDiceTargets)r=run(r,'enter-physical-statistic',{code:p.key,value:Math.min(value,p.max)});return r;}

test('physical entry is off by default, independently enabled, and rejects invalid requests atomically',()=>{
 let r=run(createSession('off'),'setup',{species:'human'});const before=exportSession(r.session);
 assert.throws(()=>run(r,'enter-physical-statistic',{code:'STR',value:7}),/Enable physical dice/);
 assert.equal(exportSession(r.session),before);
 r=run(r,'gm-physical-dice',{enabled:true});assert.equal(r.state.config.gm,false);assert.equal(r.state.pool.length,0);assert.equal(r.state.character.physicalDiceEntered,undefined);
 for(const payload of [{code:'PSI',value:7},{code:'STR',value:1},{code:'STR',value:13},{code:'STR',value:7.5},{code:'STR',value:'7'},{code:'STR',value:7,reason:'extra'}])assert.throws(()=>run(r,'enter-physical-statistic',payload));
 assert.throws(()=>run(r,'gm-physical-dice',{enabled:'true'}));assert.throws(()=>run(r,'configure',{physicalDice:1}));
});

test('six physical totals require no generated dice, allow partial saves, and retain provenance after acceptance',()=>{
 const initial=start();let r=run(initial,'enter-physical-statistic',{code:'STR',value:8});
 assert.equal(r.state.rng,initial.state.rng);assert.equal(r.state.pool.length,6);assert.equal(r.state.pool[1].base,null);assert.equal(r.state.pool[1].value,null);assert.equal(r.state.rollTotal,null);assert.equal(r.state.statisticsComplete,false);
 assert.throws(()=>run(r,'accept-statistics'),/all six/);assert.throws(()=>run(r,'swap-statistics',{a:0,b:1}),/all six/);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 r=fill(r);assert.equal(r.state.statisticsComplete,true);assert.equal(r.state.rollTotal,42);assert.equal(r.state.rng,initial.state.rng);assert.equal(r.log.flatMap(e=>e.rolls).length,0);
 assert.match(r.log.at(-1).summary,/unverified/);assert.match(r.log.at(-1).summary,/No app dice/);
 r=run(r,'gm-physical-dice',{enabled:false});assert.equal(r.state.character.physicalDiceEntered,true);assert.throws(()=>run(r,'enter-physical-statistic',{code:'STR',value:7}),/Enable physical/);
 r=run(r,'accept-statistics');assert.equal(r.state.character.stats.STR,7);assert.equal(r.state.character.physicalDiceEntered,true);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 assert.throws(()=>run(r,'gm-physical-dice',{enabled:true}),/before accepting/);assert.throws(()=>run(r,'enter-physical-statistic',{code:'STR',value:7}),/before accepting/);
});

test('same-value entry is marked, original app rolls are retained, and rerolls keep the warning',()=>{
 let r=run(start(),'roll-statistics');const original=r.log.at(-1),value=r.state.pool[0].base,rng=r.state.rng;
 r=run(r,'enter-physical-statistic',{code:'STR',value});assert.equal(r.state.character.physicalDiceEntered,true);assert.equal(r.state.rng,rng);assert.deepEqual(r.log.find(e=>e.type==='roll-statistics'),original);
 r=run(r,'gm-mode',{enabled:true});r=run(r,'roll-statistics');assert.equal(r.state.character.physicalDiceEntered,true);assert.ok(r.state.pool.every(p=>!p.physicalDiceEntered));
});

test('species formulas, Aezorgh house rounding and Vargr characteristic identity are preserved',()=>{
 for(const species of ['human','aslan','vargr','aezorgh'])for(const house of species==='aezorgh'?[false,true]:[false]){
  let r=start(species,{aezorghTwoDice:house,boons:2});const targets=r.state.physicalDiceTargets;
  assert.ok(targets.slice(0,2).every(p=>p.boon));assert.ok(targets.slice(2).every(p=>!p.boon));
  for(const p of targets){assert.equal(p.min,p.count);assert.equal(p.max,p.count*6);r=run(r,'enter-physical-statistic',{code:p.key,value:p.count===1?5:9});const score=r.state.pool.find(x=>x.key===p.key);assert.equal(score.value,Math.max(1,Math.ceil(score.base/p.divisor)+p.adjustment));}
  assert.equal(r.state.statisticsRerollThreshold,species==='aezorgh'&&!house?30:43);
 }
 const imperial=start('vargr',{}, {culture:'imperial'});assert.ok(imperial.state.physicalDiceTargets.some(p=>p.key==='SOC'));assert.ok(!imperial.state.physicalDiceTargets.some(p=>p.key==='CHA'));
 const native=start('vargr');assert.ok(native.state.physicalDiceTargets.some(p=>p.key==='CHA'));
});

test('raw totals, swap restrictions, thresholds and independent GM correction semantics remain enforced',()=>{
 let r=fill(start(),8);assert.equal(r.state.statisticsCanReroll,false);assert.throws(()=>run(r,'roll-statistics'),/base total of 43/);
 r=run(r,'enter-physical-statistic',{code:'STR',value:2});assert.equal(r.state.statisticsCanReroll,true);const total=r.state.rollTotal;r=run(r,'swap-statistics',{a:0,b:1});assert.equal(r.state.rollTotal,total);
 const disabled=fill(start('human',{allocation:false}));assert.throws(()=>run(disabled,'swap-statistics',{a:0,b:1}),/assignment/);
 const aezorgh=fill(start('aezorgh'));assert.throws(()=>run(aezorgh,'swap-statistics',{a:0,b:1}),/formulas differ/);
 assert.doesNotThrow(()=>run(fill(start('aezorgh',{aezorghTwoDice:true})),'swap-statistics',{a:0,b:1}));
 r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'pool-score',index:0,value:40,reason:'GM final correction'});assert.equal(r.state.pool[0].value,40);
 r=run(r,'enter-physical-statistic',{code:'STR',value:6});assert.equal(r.state.pool[0].value,6);assert.equal(r.state.pool[0].finalOverride,undefined);
 const partial=run(start(),'enter-physical-statistic',{code:'STR',value:7});assert.doesNotThrow(()=>run(partial,'roll-statistics'));
});

test('public API permits physical entry and preserves extra-characteristic generation',()=>{
 let r=start('human',{extras:['LCK','PSI'],flatLuck:true});const result=api({operation:'command',session:r.session,command:{type:'enter-physical-statistic',payload:{code:'STR',value:7}}});assert.equal(result.ok,true);
 r=run(fill(result),'accept-statistics');assert.equal(r.state.character.stats.LCK,6);assert.equal(r.state.character.stats.PSI,undefined);assert.equal(r.log.at(-1).rolls.length,0);
});

test('manual-entry warning survives GM restore and replacement without rewriting retained history',()=>{
 const rolled=run(start(),'roll-statistics'),revision=rolled.revision,original=structuredClone(rolled.session.events);
 let r=run(rolled,'enter-physical-statistic',{code:'STR',value:7});r=run(r,'gm-mode',{enabled:true});
 const restored=run(r,'restore',{revision});assert.equal(restored.state.character.physicalDiceEntered,true);assert.deepEqual(restored.state.pool,rolled.state.pool);assert.deepEqual(restored.session.events.slice(0,original.length),original);
 const replayed=run(r,'gm-replay',{revision,rollIndex:0,values:[3,4],reason:'Replace original computer dice'});assert.equal(replayed.state.character.physicalDiceEntered,true);assert.equal(replayed.state.pool[0].base,7);assert.equal(replayed.state.pool[0].physicalDiceEntered,undefined);
 for(const branch of [restored,replayed]){assert.deepEqual(project(importSession(exportSession(branch.session))).state,branch.state);assert.ok(branch.log.some(e=>e.type==='enter-physical-statistic'));assert.equal(branch.log.filter(e=>e.type==='enter-physical-statistic').length,1);}
});

test('physical entries use standard idempotency and stale-revision guards',()=>{
 const initial=start(),command={type:'enter-physical-statistic',payload:{code:'STR',value:9}};
 const once=execute(initial.session,command,{id:'physical-str',expectedRevision:initial.revision});
 const twice=execute(once.session,command,{id:'physical-str',expectedRevision:initial.revision});assert.deepEqual(twice.session,once.session);assert.equal(twice.log.filter(e=>e.type==='enter-physical-statistic').length,1);
 assert.throws(()=>execute(once.session,{...command,payload:{code:'DEX',value:8}},{expectedRevision:initial.revision}),/changed/);
});

test('explicit legacy opt-in retains its Aezorgh floor division and original saved actions',()=>{
 const session={...createSession('old-physical'),rulesRevision:'character-preview-2026-11-09.21'};
 let r=run(session,'configure',{aezorghTwoDice:true});r=run(r,'setup',{species:'aezorgh'});const original=structuredClone(r.session.events);
 r=run(r,'gm-physical-dice',{enabled:true});r=run(r,'enter-physical-statistic',{code:'STR',value:9});assert.equal(r.state.pool[0].derivedBase,4);assert.deepEqual(r.session.events.slice(0,original.length),original);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('preserved development Zhodani manual sets resolve optional PSI once at Keep',()=>{
 let r=run(createSession('physical-zhodani'),'gm-mode',{enabled:true});r=run(r,'configure',{physicalDice:true,zhodaniPsi:true});r=run(r,'setup',{species:'zhodani'});r=fill(r);assert.equal(r.state.optionalPsi,undefined);const kept=run(r,'accept-statistics');assert.ok([9,10,11,12].includes(kept.state.character.stats.PSI));assert.equal(kept.log.at(-1).rolls.filter(x=>x.label==='Zhodani optional PSI').length,1);assert.deepEqual(project(importSession(exportSession(kept.session))).state,kept.state);
 let rolled=run(createSession('physical-zhodani-existing'),'gm-mode',{enabled:true});rolled=run(rolled,'configure',{physicalDice:true,zhodaniPsi:true});rolled=run(rolled,'setup',{species:'zhodani'});rolled=run(rolled,'roll-statistics');const psi=rolled.state.optionalPsi;rolled=run(fill(rolled),'accept-statistics');assert.equal(rolled.state.character.stats.PSI,psi);assert.equal(rolled.log.at(-1).rolls.filter(x=>x.label==='Zhodani optional PSI').length,0);
});
