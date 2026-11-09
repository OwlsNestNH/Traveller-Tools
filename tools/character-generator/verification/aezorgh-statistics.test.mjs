// Preserved full-engine development regression, including deferred Zhodani.
import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentApi as api,createSession as createCurrentSession,execute,project,exportSession,importSession} from '../engine/session.mjs';

// Preserve the historical floor-division contract; current rounding-up is covered separately.
function createSession(seed){return {...createCurrentSession(seed),rulesRevision:'character-preview-2026-11-09.21'};}
function run(r,type,payload={},options={}){return execute(r.session??r,{type,payload},options);}
function start(species='aezorgh',options={}){
 let r=run(createSession('aezorgh-statistics-'+species),'setup',{species});
 r=run(r,'configure',options);return r;
}
function pool(values,species='aezorgh',options={}){
 let r=run(start(species,options),'roll-statistics');r=run(r,'gm-mode',{enabled:true});
 values.forEach((value,index)=>{r=run(r,'gm-override',{field:'pool',index,value,reason:'Exact reroll boundary fixture'});});
 return run(r,'gm-mode',{enabled:false});
}
function reject(r,type,payload,pattern){
 const before=exportSession(r.session),result=api({operation:'command',session:r.session,command:{type,payload}});
 assert.equal(result.ok,false);assert.match(result.error.message,pattern);assert.equal(exportSession(r.session),before);
}

test('standard Aezorgh projects30 before rolls and after acceptance; other species retain43',()=>{
 assert.equal(start().state.statisticsRerollThreshold,30);
 let r=run(start(),'roll-statistics');assert.equal(r.state.statisticsRerollThreshold,30);
 r=run(r,'accept-statistics');assert.equal(r.state.statisticsRerollThreshold,30);
 for(const species of ['human','aslan','vargr','zhodani'])assert.equal(start(species).state.statisticsRerollThreshold,43);
});

test('configuration summary uses the same authoritative Aezorgh minimum',()=>{
 const r=start();assert.match(r.log.at(-1).summary,/below-30 reroll on/);
 const human=start('human');assert.match(human.log.at(-1).summary,/below-43 reroll on/);
});

test('raw standard total29 rerolls, exact30 does not',()=>{
 const below=pool([5,6,4,6,4,4]);assert.equal(below.state.rollTotal,29);assert.equal(below.state.config.gm,false);
 const next=run(below,'roll-statistics');assert.equal(next.revision,below.revision+1);
 assert.equal(next.log.at(-1).rolls.length,6);assert.notEqual(next.state.rng,below.state.rng);
 assert.match(next.log.at(-1).summary,/Rerolled statistics; previous 5, 6, 4, 6, 4, 4/);
 const exact=pool([6,6,4,6,4,4]);assert.equal(exact.state.rollTotal,30);
 reject(exact,'roll-statistics',{},/base total of 30/);
});

test('standard Aezorgh30 through42 is not accidentally eligible under the old43 minimum',()=>{
 for(const values of [[6,6,4,6,4,4],[6,10,5,10,5,6]]){
  const r=pool(values);assert.ok(r.state.rollTotal>=30&&r.state.rollTotal<43);
  reject(r,'roll-statistics',{},/30/);
 }
});

test('minimum-disabled blocks even a low total, while GM mode can reroll any total',()=>{
 const disabled=pool([1,2,1,2,1,1],'aezorgh',{minimumReroll:false});assert.equal(disabled.state.rollTotal,8);
 reject(disabled,'roll-statistics',{},/30/);
 const maximum=pool([6,12,6,12,6,6]);reject(maximum,'roll-statistics',{},/30/);
 const gm=run(maximum,'gm-mode',{enabled:true});assert.doesNotThrow(()=>run(gm,'roll-statistics'));
});

test('all other species retain the strict raw42/43 boundary',()=>{
 for(const species of ['human','aslan','vargr','zhodani']){
  const below=pool([7,7,7,7,7,7],species),exact=pool([8,7,7,7,7,7],species);
  assert.equal(below.state.rollTotal,42);assert.doesNotThrow(()=>run(below,'roll-statistics'));
  assert.equal(exact.state.rollTotal,43);reject(exact,'roll-statistics',{},/43/);
 }
});

test('standard mixed formulas and original bonuses remain unchanged',()=>{
 const r=run(start(),'roll-statistics');
 assert.deepEqual(r.state.pool.map(p=>p.count),[1,2,1,2,1,1]);
 assert.deepEqual(r.state.pool.map(p=>p.adjustment),[0,3,1,2,0,0]);
 assert.deepEqual(r.log.at(-1).rolls.map(p=>p.values.length),[1,2,1,2,1,1]);
 assert.equal(r.state.rollTotal,r.state.pool.reduce((n,p)=>n+p.base,0));
 const accepted=run(r,'accept-statistics');
 for(const p of r.state.pool)assert.equal(accepted.state.character.stats[p.key],p.base+p.adjustment);
 assert.equal(accepted.state.character.stats.CHA,Math.floor(accepted.state.character.stats.SOC/2));
});

test('standard Aezorgh boons keep the best published dice count without optional halving',()=>{
 const r=run(start('aezorgh',{boons:6}),'roll-statistics');
 assert.deepEqual(r.log.at(-1).rolls.map(p=>p.values.length),[2,3,2,3,2,2]);
 for(const [i,roll] of r.log.at(-1).rolls.entries()){
  const count=r.state.pool[i].count;
  assert.equal(roll.kept.length,count);
  assert.deepEqual(roll.kept,[...roll.values].sort((a,b)=>b-a).slice(0,count));
  assert.equal(r.state.pool[i].base,roll.kept.reduce((n,d)=>n+d,0));
 }
 assert.equal(r.state.statisticsRerollThreshold,30);
});

test('bonuses and extras are excluded from raw threshold and remain excluded after acceptance',()=>{
 let r=pool([4,6,4,6,4,4],'aezorgh',{extras:['LCK','WLT']});
 assert.equal(r.state.rollTotal,28);assert.equal(r.state.pool.reduce((n,p)=>n+p.base+p.adjustment,0),34);
 assert.doesNotThrow(()=>run(r,'roll-statistics'));
 r=run(r,'accept-statistics');assert.equal(r.state.rollTotal,28);
 assert.equal(r.state.character.stats.WLT,r.state.character.stats.SOC);assert.ok(r.log.at(-1).rolls.some(x=>x.label==='LCK'));
});

test('standard one-die swaps preserve destination formulas and bonuses with source provenance',()=>{
 let r=pool([2,8,5,7,3,4],'aezorgh',{boons:1});const before=structuredClone(r.state.pool),total=r.state.rollTotal;
 r=run(r,'swap-statistics',{a:0,b:2});
 assert.equal(r.state.pool[0].base,5);assert.equal(r.state.pool[2].base,2);
 assert.equal(r.state.pool[0].count,1);assert.equal(r.state.pool[2].count,1);
 assert.equal(r.state.pool[0].adjustment,0);assert.equal(r.state.pool[2].adjustment,1);
 assert.equal(r.state.pool[0].origin,before[2].origin);assert.equal(r.state.pool[2].origin,before[0].origin);
 assert.equal(r.state.pool[2].boon,true);assert.equal(r.state.rollTotal,total);
 const accepted=run(r,'accept-statistics');assert.equal(accepted.state.character.stats.STR,5);assert.equal(accepted.state.character.stats.END,3);
});

test('standard two-die swaps are allowed but ordinary mixed-count swaps remain blocked',()=>{
 let r=pool([2,8,5,7,3,4]);r=run(r,'swap-statistics',{a:1,b:3});
 assert.equal(r.state.pool[1].base,7);assert.equal(r.state.pool[1].adjustment,3);
 assert.equal(r.state.pool[3].base,8);assert.equal(r.state.pool[3].adjustment,2);
 reject(r,'swap-statistics',{a:0,b:1},/Published dice formulas differ/);
});

test('GM mixed-count exception stays explicit and does not alter standard destination formulas',()=>{
 let r=pool([2,8,5,7,3,4]);r=run(r,'gm-mode',{enabled:true});r=run(r,'swap-statistics',{a:0,b:1});
 assert.equal(r.state.pool[0].base,8);assert.equal(r.state.pool[1].base,2);assert.match(r.log.at(-1).summary,/GM exception/);
 assert.deepEqual(r.state.pool.slice(0,2).map(p=>p.formulaCount),[1,2]);assert.deepEqual(r.state.pool.slice(0,2).map(p=>p.count),[2,1]);assert.equal(r.state.statisticsRerollThreshold,30);
 const accepted=run(r,'accept-statistics');assert.equal(accepted.state.character.stats.STR,8);assert.equal(accepted.state.character.stats.DEX,5);
});

test('disabled allocation blocks even same-count swaps until GM explicitly overrides',()=>{
 const r=pool([2,8,5,7,3,4],'aezorgh',{allocation:false});reject(r,'swap-statistics',{a:0,b:2},/not enabled/);
 assert.doesNotThrow(()=>run(run(r,'gm-mode',{enabled:true}),'swap-statistics',{a:0,b:2}));
});

test('reroll command retry is idempotent and stale revisions do not mutate the pool',()=>{
 const r=pool([4,6,4,6,4,4]),next=run(r,'roll-statistics',{}, {id:'aezorgh-reroll-once',expectedRevision:r.revision});
 const retry=run(next,'roll-statistics',{}, {id:'aezorgh-reroll-once',expectedRevision:r.revision});
 assert.equal(retry.revision,next.revision);assert.deepEqual(retry.state,next.state);
 assert.throws(()=>run(next,'notes',{text:'stale'}, {expectedRevision:r.revision}),/changed/);
});

test('save import/project and targeted GM replay retain dice, threshold and full audit',()=>{
 let r=run(start(),'roll-statistics');const target=r.revision,original=structuredClone(r.log.at(-1).rolls);
 r=run(r,'gm-mode',{enabled:true});
 r=run(r,'gm-replay',{revision:target,rollIndex:2,values:[6],reason:'Correct one Aezorgh END die'});
 assert.deepEqual(r.log.at(-1).rolls.slice(0,2),original.slice(0,2));
 assert.deepEqual(r.log.at(-1).rolls[2].values,[6]);assert.equal(r.state.pool[2].base,6);
 assert.equal(r.state.statisticsRerollThreshold,30);assert.equal(r.state.rollTotal,r.state.pool.reduce((n,p)=>n+p.base,0));
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 assert.deepEqual(r.log[target-1].rolls,original);
});

test('threshold does not grant post-acceptance rerolls or allow configuration after rolling',()=>{
 const r=run(start(),'roll-statistics');reject(r,'configure',{minimumReroll:false},/before rolling/);
 const accepted=run(r,'accept-statistics');reject(accepted,'roll-statistics',{},/stage/);
});

const optional={aezorghTwoDice:true};

test('optional Aezorgh rolls six raw2D totals and exposes target formula, divisor, derived base and final preview',()=>{
 const r=run(start('aezorgh',optional),'roll-statistics');
 assert.equal(r.state.config.aezorghTwoDice,true);assert.equal(r.state.statisticsRerollThreshold,43);
 assert.deepEqual(r.state.pool.map(p=>p.count),[2,2,2,2,2,2]);
 assert.deepEqual(r.state.pool.map(p=>p.formulaCount),[1,2,1,2,1,1]);
 assert.deepEqual(r.state.pool.map(p=>p.divisor),[2,1,2,1,2,2]);
 assert.deepEqual(r.log.at(-1).rolls.map(x=>x.values.length),[2,2,2,2,2,2]);
 for(const [i,p] of r.state.pool.entries()){
  assert.equal(p.base,r.log.at(-1).rolls[i].total);assert.equal(p.derivedBase,Math.floor(p.base/p.divisor));
  assert.equal(p.value,Math.max(1,p.derivedBase+p.adjustment));
 }
 assert.equal(r.state.rollTotal,r.state.pool.reduce((n,p)=>n+p.base,0));
 assert.match(r.log.at(-1).summary,/round down before species bonuses/);
 assert.match(r.log.at(-1).summary,/STR raw \d+\/2 = \d+, species \+0/);
});

test('optional raw42 rerolls but exact43 remains ineligible even when post-halving totals are smaller',()=>{
 const below=pool([7,7,7,7,7,7],'aezorgh',optional),exact=pool([5,8,7,9,4,10],'aezorgh',optional);
 assert.equal(below.state.rollTotal,42);assert.equal(below.state.statisticsCanReroll,true);assert.doesNotThrow(()=>run(below,'roll-statistics'));
 assert.equal(exact.state.rollTotal,43);assert.ok(exact.state.pool.reduce((n,p)=>n+p.derivedBase,0)<43);
 assert.equal(exact.state.statisticsCanReroll,false);reject(exact,'roll-statistics',{},/43/);
});

test('all15 optional swaps work without GM, preserve raw total and recalculate destination halving',()=>{
 const initial=pool([5,8,7,9,4,10],'aezorgh',{...optional,boons:2});
 for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){
  const r=run(initial,'swap-statistics',{a,b}),before=initial.state.pool;
  assert.equal(r.state.config.gm,false);assert.equal(r.state.rollTotal,43);assert.equal(r.state.statisticsCanReroll,false);
  assert.equal(r.state.pool[a].base,before[b].base);assert.equal(r.state.pool[b].base,before[a].base);
  for(const i of [a,b]){
   const p=r.state.pool[i];assert.equal(p.formulaCount,before[i].formulaCount);assert.equal(p.divisor,before[i].divisor);
   assert.equal(p.adjustment,before[i].adjustment);assert.equal(p.derivedBase,Math.floor(p.base/p.divisor));
   assert.equal(p.value,p.derivedBase+p.adjustment);
  }
  assert.equal(r.state.pool[a].origin,before[b].origin);assert.equal(r.state.pool[a].boon,before[b].boon);
  assert.doesNotMatch(r.log.at(-1).summary,/GM exception/);
 }
});

test('optional odd raw totals round down after placement and before species bonuses',()=>{
 let r=pool([5,8,7,9,4,10],'aezorgh',optional);
 r=run(r,'swap-statistics',{a:0,b:1}); // STR receives raw8/2; DEX receives unhalved raw5 +3.
 assert.deepEqual(r.state.pool.map(p=>p.derivedBase),[4,5,3,9,2,5]);
 assert.deepEqual(r.state.pool.map(p=>p.value),[4,8,4,11,2,5]);
 const final=run(r,'accept-statistics');
 for(const p of r.state.pool)assert.equal(final.state.character.stats[p.key],p.value);
 assert.equal(final.state.character.stats.CHA,2);assert.equal(final.state.rollTotal,43);
});

test('every possible raw2D total uses floor division only for the four one-die destinations',()=>{
 for(let total=2;total<=12;total++){
  const r=pool([total,total,total,total,total,total],'aezorgh',optional);
  const half=Math.floor(total/2);assert.deepEqual(r.state.pool.map(p=>p.derivedBase),[half,total,half,total,half,half]);
  assert.deepEqual(r.state.pool.map(p=>p.value),[half,total+3,half+1,total+2,half,half]);
  const accepted=run(r,'accept-statistics');for(const p of r.state.pool)assert.equal(accepted.state.character.stats[p.key],p.value);
 }
});

for(let boons=0;boons<=6;boons++)test('optional '+boons+' boon rolls keep the best2 of3 before destination halving',()=>{
 const r=run(start('aezorgh',{...optional,boons}),'roll-statistics');
 assert.equal(r.log.at(-1).rolls.filter(x=>x.values.length===3).length,boons);
 for(const [i,row] of r.log.at(-1).rolls.entries()){
  const p=r.state.pool[i];assert.equal(row.kept.length,2);
  assert.deepEqual(row.kept,i<boons?[...row.values].sort((a,b)=>b-a).slice(0,2):row.values);
  assert.equal(p.base,row.kept.reduce((n,d)=>n+d,0));assert.equal(p.derivedBase,Math.floor(p.base/p.divisor));
 }
});

test('optional boon replay proves both odd kept dice are summed before halving, with originals preserved',()=>{
 let r=run(start('aezorgh',{...optional,boons:6}),'roll-statistics');
 const revision=r.revision,original=structuredClone(r.log.at(-1).rolls);
 r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-replay',{revision,rollIndex:0,values:[1,5,3],reason:'Check keep-best-two then halve'});
 assert.deepEqual(r.log.at(-1).rolls[0].values,[1,5,3]);assert.deepEqual(r.log.at(-1).rolls[0].kept,[5,3]);
 assert.equal(r.state.pool[0].base,8);assert.equal(r.state.pool[0].derivedBase,4);assert.equal(r.state.pool[0].value,4);
 assert.deepEqual(r.log[revision-1].rolls,original);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('optional GM pool correction recomputes raw total, destination-derived base and minimum1 preview',()=>{
 let r=pool([5,8,7,9,4,10],'aezorgh',optional);r=run(r,'gm-mode',{enabled:true});
 const originalRoll=structuredClone(r.log.find(x=>x.type==='roll-statistics').rolls);
 r=run(r,'gm-override',{field:'pool',index:0,value:1,reason:'Explicit out-of-normal-range referee correction'});
 assert.equal(r.state.pool[0].base,1);assert.equal(r.state.pool[0].derivedBase,0);assert.equal(r.state.pool[0].value,1);
 assert.equal(r.state.rollTotal,39);assert.equal(r.state.statisticsRerollThreshold,43);
 assert.match(r.log.at(-1).summary,/STR raw 1\/2 = 0/);
 assert.deepEqual(r.log.find(x=>x.type==='roll-statistics').rolls,originalRoll);
 r=run(r,'gm-mode',{enabled:false});assert.equal(r.state.statisticsCanReroll,true);
 const accepted=run(r,'accept-statistics');assert.equal(accepted.state.character.stats.STR,1);
});

test('optional authoritative reroll availability handles no pool, stage, switch and GM mode',()=>{
 let r=start('aezorgh',optional);assert.equal(r.state.statisticsCanReroll,false);
 const low=pool([2,2,2,2,2,2],'aezorgh',optional),high=pool([12,12,12,12,12,12],'aezorgh',optional);
 assert.equal(low.state.statisticsCanReroll,true);assert.equal(high.state.statisticsCanReroll,false);
 assert.equal(run(high,'gm-mode',{enabled:true}).state.statisticsCanReroll,true);
 assert.equal(pool([2,2,2,2,2,2],'aezorgh',{...optional,minimumReroll:false}).state.statisticsCanReroll,false);
 assert.equal(run(low,'accept-statistics').state.statisticsCanReroll,false);
});

test('optional mode cannot silently apply to another species or change after rolling',()=>{
 for(const species of ['human','aslan','vargr','zhodani']){
  const r=start(species);reject(r,'configure',optional,/only to Aezorgh/);
 }
 let identity=run(createSession('identity-optional'),'configure',optional);
 reject(identity,'setup',{species:'human'},/only to Aezorgh/);
 assert.equal(run(identity,'setup',{species:'aezorgh'}).state.config.aezorghTwoDice,true);
 identity=run(identity,'configure',{aezorghTwoDice:false});assert.doesNotThrow(()=>run(identity,'setup',{species:'human'}));
 for(const value of ['true',1,null])reject(start(),'configure',{aezorghTwoDice:value},/true or false/);
 const rolled=run(start('aezorgh',optional),'roll-statistics');reject(rolled,'configure',{aezorghTwoDice:false},/before rolling/);
});

test('both optional and standard can be deliberately selected before rolling, with authoritative threshold updates',()=>{
 let r=start('aezorgh',optional);assert.equal(r.state.statisticsRerollThreshold,43);
 r=run(r,'configure',{aezorghTwoDice:false});assert.equal(r.state.statisticsRerollThreshold,30);
 r=run(r,'configure',optional);assert.equal(r.state.statisticsRerollThreshold,43);
 assert.match(r.log.at(-1).summary,/below-43/);assert.match(r.log.at(-1).summary,/six raw 2D totals/);
});

test('optional raw threshold is unaffected by extras or destination bonuses',()=>{
 const r=pool([7,7,7,7,7,7],'aezorgh',{...optional,extras:['LCK','WLT']});
 assert.equal(r.state.rollTotal,42);assert.equal(r.state.statisticsCanReroll,true);
 const accepted=run(r,'accept-statistics');assert.equal(accepted.state.rollTotal,42);
 assert.equal(accepted.state.character.stats.WLT,accepted.state.character.stats.SOC);
 assert.ok(accepted.log.at(-1).rolls.some(x=>x.label==='LCK'));
});

test('optional cross-formula swap requires allocation permission but not GM permission',()=>{
 const r=pool([5,8,7,9,4,10],'aezorgh',{...optional,allocation:false});
 reject(r,'swap-statistics',{a:0,b:1},/not enabled/);
 const swapped=run(run(r,'gm-mode',{enabled:true}),'swap-statistics',{a:0,b:1});
 assert.equal(swapped.state.pool[0].derivedBase,4);
});

test('standard GM exception moves actual dice provenance but not destination swap groups',()=>{
 let r=pool([2,8,5,7,3,4]);r=run(r,'gm-mode',{enabled:true});r=run(r,'swap-statistics',{a:0,b:1});
 assert.deepEqual(r.state.pool.slice(0,2).map(p=>p.count),[2,1]);
 assert.deepEqual(r.state.pool.slice(0,2).map(p=>p.formulaCount),[1,2]);
 r=run(r,'gm-mode',{enabled:false});
 assert.doesNotThrow(()=>run(r,'swap-statistics',{a:0,b:2}));
 reject(r,'swap-statistics',{a:1,b:2},/Published dice formulas differ/);
});

test('optional save replay and GM restore retain raw/derived pools, flag and audit without rewinding RNG',()=>{
 let r=pool([5,8,7,9,4,10],'aezorgh',optional),original=structuredClone(r.state.pool),revision=r.revision;
 r=run(r,'swap-statistics',{a:0,b:1});r=run(r,'gm-mode',{enabled:true});const rng=r.state.rng;
 r=run(r,'restore',{revision});assert.deepEqual(r.state.pool,original);assert.equal(r.state.rng,rng);
 assert.equal(r.state.config.aezorghTwoDice,true);assert.equal(r.state.statisticsRerollThreshold,43);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('optional reroll retry cannot duplicate a whole new six2D pool',()=>{
 const r=pool([7,7,7,7,7,7],'aezorgh',optional);
 const next=run(r,'roll-statistics',{}, {id:'optional-reroll-once',expectedRevision:r.revision});
 const retry=run(next,'roll-statistics',{}, {id:'optional-reroll-once',expectedRevision:r.revision});
 assert.equal(retry.revision,next.revision);assert.deepEqual(retry.state,next.state);
 assert.deepEqual(next.log.at(-1).rolls.map(row=>row.values.length),[2,2,2,2,2,2]);
});

test('actual UI configure(false) then Aezorgh setup defers unknown threshold and records standard30',()=>{
 let r=run(createSession('ui-aezorgh-standard'),'configure',{boons:0,allocation:true,minimumReroll:true,extras:[],aezorghTwoDice:false,zhodaniPsi:false});
 assert.match(r.log.at(-1).summary,/minimum-total reroll on \(threshold confirmed at species setup\)/);
 assert.doesNotMatch(r.log.at(-1).summary,/below-43/);
 r=run(r,'setup',{species:'aezorgh'});
 assert.match(r.log.at(-1).summary,/Standard Aezorgh method/);assert.match(r.log.at(-1).summary,/raw reroll minimum 30/);
 assert.match(r.log.at(-1).summary,/matching formula groups/);assert.equal(r.state.statisticsRerollThreshold,30);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('actual UI configure(true) then Aezorgh setup records optional43 and post-placement floor division',()=>{
 let r=run(createSession('ui-aezorgh-optional'),'configure',{aezorghTwoDice:true,minimumReroll:true});
 assert.match(r.log.at(-1).summary,/threshold confirmed at species setup/);
 r=run(r,'setup',{species:'aezorgh'});
 assert.match(r.log.at(-1).summary,/Optional Aezorgh method: six raw 2D totals/);
 assert.match(r.log.at(-1).summary,/reroll minimum 43 before placement and halving/);
 assert.match(r.log.at(-1).summary,/rounding down before species bonuses/);
 assert.equal(r.state.statisticsRerollThreshold,43);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('legacy human configure and setup summaries retain exact wording without the new option field',()=>{
 let r=run(createSession('legacy-summary'),'configure',{});
 assert.equal(r.log.at(-1).summary,'Generation options: 0 boon rolls; player placement on; below-43 reroll on; extras none; Zhodani PSI option off.');
 r=run(r,'setup',{species:'human'});
 assert.equal(r.log.at(-1).summary,'Started an unnamed Traveller (Human).');
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

test('new pre-setup summary does not guess a species threshold when rerolls are disabled',()=>{
 const r=run(createSession('ui-disabled'),'configure',{aezorghTwoDice:false,minimumReroll:false});
 assert.match(r.log.at(-1).summary,/minimum-total reroll off \(threshold confirmed at species setup\)/);
 assert.doesNotMatch(r.log.at(-1).summary,/below-43/);
});
