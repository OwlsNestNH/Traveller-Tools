import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {api,createSession,execute,project,exportSession,importSession,catalog} from '../engine/session.mjs';
import {statisticsCardsView,emptyStatisticsView} from '../gui/characteristics-presentation.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function start(options={},species='human',seed='flat-luck') {let r=run(createSession(seed),'configure',options);return run(r,'setup',{species});}
function accept(r){return run(run(r,'roll-statistics'),'accept-statistics');}

test('flat starting Luck defaults off; explicit false retains the same standard 2D dice and RNG',()=>{
 const omitted=accept(start({extras:['LCK','MRL']})),off=accept(start({extras:['LCK','MRL'],flatLuck:false}));
 assert.equal(Object.hasOwn(omitted.state.config,'flatLuck'),false);
 assert.equal(off.state.config.flatLuck,false);
 assert.deepEqual(off.state.character,omitted.state.character);assert.equal(off.state.rng,omitted.state.rng);
 assert.deepEqual(off.log.at(-1).rolls,omitted.log.at(-1).rolls);
 assert.deepEqual(omitted.log.at(-1).rolls.map(r=>[r.label,r.values.length]),[['LCK',2],['MRL',2]]);
 assert.match(off.log[0].summary,/flat starting Luck off \(normal 2D\)/);
});

test('enabled Luck starts at 6 without a roll and never enters the six-score pool',()=>{
 for(const species of ['human','aslan','vargr','aezorgh'])for(const boons of [0,6]){
  let r=run(start({extras:['LCK'],flatLuck:true,boons},species),'roll-statistics');
  const before=structuredClone(r.state),raw=r.state.rollTotal;
  assert.equal(r.state.character.stats.LCK,undefined);assert.equal(r.state.pool.length,6);
  r=run(r,'accept-statistics');assert.equal(r.state.character.stats.LCK,6);
  assert.equal(r.state.rollTotal,raw);assert.equal(r.log.at(-1).rolls.some(roll=>roll.label==='LCK'),false);
  assert.match(r.log.at(-1).summary,/House rule: Luck starts at 6; no Luck dice/);
  for(const p of before.pool)assert.equal(r.state.character.stats[p.key],p.value);
  const saved=exportSession(r.session);assert.equal(exportSession(importSession(saved)),saved);assert.deepEqual(project(importSession(saved)).state,r.state);
 }
});

test('flat Luck does not consume randomness or change other extra characteristic rules',()=>{
 const rest=['PSI','MRL','STY','WLT','CHA'];
 const flat=accept(start({extras:['LCK',...rest],flatLuck:true,boons:6}));
 const without=accept(start({extras:rest,boons:6}));
 assert.equal(flat.state.rng,without.state.rng);
 const stats={...flat.state.character.stats};delete stats.LCK;assert.deepEqual(stats,without.state.character.stats);
 assert.deepEqual(flat.log.at(-1).rolls,without.log.at(-1).rolls);
 assert.deepEqual(flat.log.at(-1).rolls.map(r=>[r.label,r.values.length]),[['MRL',2],['STY',2],['CHA',2]]);
 assert.equal(flat.state.character.stats.WLT,flat.state.character.stats.SOC);
});

test('the option does not select Luck; adding it later creates 6 once and keeps existing values',()=>{
 let r=accept(start({flatLuck:true}));assert.equal(Object.hasOwn(r.state.character.stats,'LCK'),false);
 const rng=r.state.rng;r=run(r,'add-extra',{id:'LCK'});assert.equal(r.state.character.stats.LCK,6);assert.equal(r.state.rng,rng);assert.deepEqual(r.log.at(-1).rolls,[]);assert.match(r.log.at(-1).summary,/House rule/);
 assert.throws(()=>run(r,'add-extra',{id:'LCK'}),/already exists/);
 r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.LCK',value:4,reason:'Luck spent in play'});
 assert.equal(project(importSession(exportSession(r.session))).state.character.stats.LCK,4);
 const standard=run(accept(start()),'add-extra',{id:'LCK'});assert.equal(standard.log.at(-1).rolls[0].label,'LCK');assert.equal(standard.log.at(-1).rolls[0].values.length,2);
});

test('configuration rejects invalid values atomically and locks after base rolling',()=>{
 const session=createSession('bad-luck'),before=exportSession(session);
 for(const flatLuck of [null,6,0,'true',[],{}]){const result=api({operation:'command',session,command:{type:'configure',payload:{flatLuck}}});assert.equal(result.ok,false);assert.match(result.error.message,/true or false/);assert.equal(exportSession(session),before);}
 let r=start({flatLuck:true});r=run(r,'configure',{flatLuck:false});assert.equal(r.state.config.flatLuck,false);
 r=run(r,'roll-statistics');assert.throws(()=>run(r,'configure',{flatLuck:true}),/before rolling/);
 r=run(r,'accept-statistics');assert.throws(()=>run(r,'configure',{flatLuck:true}),/before rolling/);
});

test('restore, repeated action IDs, and replay preserve the choice and explicit fixed result',()=>{
 let r=run(start({extras:['LCK','MRL'],flatLuck:true}),'roll-statistics');const rolled=r.revision;
 r=run(r,'gm-mode',{enabled:true});r=run(r,'accept-statistics');const accepted=r.revision,session=r.session;
 assert.deepEqual(execute(session,{type:'accept-statistics',payload:{}},{id:'action-'+accepted}).session,session);
 r=run(r,'gm-replay',{revision:accepted,rollIndex:0,values:[1,2],reason:'Morale regression'});
 assert.equal(r.state.character.stats.LCK,6);assert.equal(r.state.character.stats.MRL,3);assert.equal(r.log.at(-1).rolls[0].label,'MRL');
 r=run(r,'restore',{revision:rolled});assert.equal(r.state.config.flatLuck,true);assert.equal(r.state.character.stats.LCK,undefined);
 r=run(r,'accept-statistics');assert.equal(r.state.character.stats.LCK,6);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

// Captured from unmodified b4a5825989ebd870caa1d85ced3d5ea576aab4f4.
const historicalHashes={
 '22':'872b7246856b9c9f9a3779246ccc6c6eb25035344f418166c7c2491d3fd2f583',
 '21':'848a5deb2566da6486d8a29ee22e0d9fa89d76def232c4c0b425b9eac8f27f19',
 '20':'fd41884a8d17770c3302097a04ebe783916c63a7b0f3f6c552a89a0e7e108cb5',
 '19':'9959a92a17249e8e3416d3427e1c4e88c83848a0e1bf79d88af53fd4ed460c2e',
 '18':'d905ad5f5677a1db9dfa630c2a119fcac0c1781ba77efed0fc1bd01546f2cb90',
 '17':'c26919da1a928f158a6f49470703f9dfebc564ec24a80f0f26d72face91899cf',
 '16':'a7ecbf3c1202f4682dd9663fcf1f61c74e67633cc328054a5b85bb83a276f613'
};
test('all historical rules revisions retain byte-identical saved commands, summaries, rolls and continuation',()=>{
 for(const [revision,digest] of Object.entries(historicalHashes)){
  let r={...createSession('flat-luck-historical'),rulesRevision:'character-preview-2026-11-09.'+revision};
  for(const [type,payload] of [['configure',{extras:['LCK','MRL','WLT'],boons:2}],['setup',{species:'human'}],['roll-statistics',{}],['accept-statistics',{}],['add-extra',{id:'STY'}]])r=run(r,type,payload);
  const saved=exportSession(r.session);assert.equal(createHash('sha256').update(saved).digest('hex'),digest);assert.equal(exportSession(importSession(saved)),saved);assert.equal(Object.hasOwn(r.state.config,'flatLuck'),false);assert.deepEqual(project(importSession(saved)).state,r.state);
 }
});

test('pending Luck card explains the house rule without awarding it or mutating the save',()=>{
 const r=start({extras:['LCK'],flatLuck:true}),before=exportSession(r.session),c=catalog();
 const html=statisticsCardsView(r.state,c,emptyStatisticsView(r.state,c,{esc}),{esc});
 assert.match(html,/>Pending</);assert.match(html,/6 after Keep \(house rule\)/);assert.equal(exportSession(r.session),before);assert.equal(r.state.character.stats.LCK,undefined);
});

test('a pre-accept GM Luck override is preserved and never logged as a newly generated 6',()=>{
 let r=start({extras:['LCK'],flatLuck:true});r=run(r,'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.LCK',value:4,reason:'Explicit starting Luck ruling'});r=accept(r);
 assert.equal(r.state.character.stats.LCK,4);assert.equal(r.log.at(-1).rolls.some(roll=>roll.label==='LCK'),false);assert.doesNotMatch(r.log.at(-1).summary,/Luck starts at 6/);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});

import {flatLuckSetupView,syncFlatLuckSelection} from '../gui/flat-luck-setup.mjs';
test('checking the setup rule also selects Luck; switching it off preserves selection and other extras',()=>{
 const luck={checked:false,disabled:false},morale={checked:true},toggle={checked:true},form={elements:{flatLuck:toggle},querySelector:()=>luck};
 assert.equal(syncFlatLuckSelection(form),true);assert.equal(luck.checked,true);assert.equal(morale.checked,true);assert.equal(syncFlatLuckSelection(form),false);
 toggle.checked=false;assert.equal(syncFlatLuckSelection(form),false);assert.equal(luck.checked,true);
 luck.checked=false;assert.equal(syncFlatLuckSelection(form),false);assert.equal(luck.checked,false);
});
test('rendering a saved rule never changes selections and uses the shared aligned House Rules structure',()=>{
 const state={config:{flatLuck:true,extras:[]}},before=structuredClone(state);const html=flatLuckSetupView(state,id=>'<button>'+id+'</button>');
 assert.match(html,/class="opening-house-rule"/);assert.match(html,/<button>flatLuck<\/button><input/);assert.match(html,/id="setup-flat-luck"[^>]* checked/);assert.match(html,/<label for="setup-flat-luck">/);assert.deepEqual(state,before);
});
