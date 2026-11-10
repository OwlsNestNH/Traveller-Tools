import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSession,execute,project,exportSession,importSession,api,catalog} from '../engine/session.mjs';
import {emptyStatisticsView,statisticsCardsView} from '../gui/characteristics-presentation.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
const hash=s=>createHash('sha256').update(s).digest('hex');
function start({culture='imperial',extras=[],boons=0,variant='standard',seed='imperial-vargr'}={}){
 return run(run(createSession(seed),'configure',{extras,boons}),'setup',{species:'vargr',culture,variant});
}
const rolled=r=>run(r,'roll-statistics');
const accepted=r=>run(rolled(r),'accept-statistics');
const esc=String;
const chaRolls=r=>r.log.at(-1).rolls.filter(x=>x.label.includes('CHA'));
for(const variant of catalog().species.find(s=>s.id==='vargr').variants.map(v=>v.id))for(const boons of [0,6]){
 test(variant+' Imperial Vargr, boons '+boons+': no optional CHA means no score or roll',()=>{
  let r=rolled(start({variant,boons}));const before=structuredClone(r.state);assert.deepEqual(before.pool.map(x=>x.key),['STR','DEX','END','INT','EDU','SOC']);
  r=run(r,'accept-statistics');assert.equal(Object.hasOwn(r.state.character.stats,'CHA'),false);assert.deepEqual(chaRolls(r),[]);assert.equal(r.state.rng,before.rng);assert.equal(r.state.character.stats.SOC,before.pool[5].value);assert.equal(r.state.character.skills.Melee,0);
 });
 test(variant+' Imperial Vargr, boons '+boons+': enabled CHA rolls exactly 1D6+2 once outside the pool',()=>{
  let r=rolled(start({variant,boons,extras:['CHA','MRL']})),before=structuredClone(r.state);r=run(r,'swap-statistics',{a:0,b:5});const soc=r.state.pool[5].value;r=run(r,'accept-statistics');
  assert.deepEqual(chaRolls(r).map(x=>[x.label,x.values.length]),[['Imperial Vargr CHA',1]]);assert.equal(r.state.character.stats.CHA,chaRolls(r)[0].total+2);assert.ok(r.state.character.stats.CHA>=3&&r.state.character.stats.CHA<=8);assert.equal(r.state.character.stats.SOC,soc);assert.equal(r.state.pool.length,6);assert.equal(r.state.rollTotal,before.rollTotal);assert.deepEqual(r.log.at(-1).rolls.map(x=>[x.label,x.values.length]),[['Imperial Vargr CHA',1],['MRL',2]]);assert.match(r.log.at(-1).summary,/1D6 \+ 2/);
  const raw=exportSession(r.session);assert.equal(exportSession(importSession(raw)),raw);assert.deepEqual(project(importSession(raw)).state,r.state);
 });
 test(variant+' native Vargr, boons '+boons+': CHA remains automatic with no duplicate optional roll',()=>{
  const normal=accepted(start({culture:'native',variant,boons})),selected=accepted(start({culture:'native',variant,boons,extras:['CHA']}));
  assert.ok(normal.state.pool.some(p=>p.key==='CHA'));assert.equal(normal.state.character.stats.SOC,undefined);assert.equal(normal.state.character.stats.CHA,normal.state.pool.find(p=>p.key==='CHA').value);assert.deepEqual(normal.state.character,selected.state.character);assert.equal(normal.state.rng,selected.state.rng);assert.deepEqual(chaRolls(selected),[]);
 });
}
test('later add explicitly enables Imperial CHA with the same single 1D6+2 formula and rejects repeats atomically',()=>{
 let r=accepted(start());r=run(r,'add-extra',{id:'CHA'});assert.equal(r.state.character.stats.CHA,chaRolls(r)[0].total+2);assert.equal(chaRolls(r)[0].values.length,1);assert.deepEqual(r.state.config.extras,['CHA']);assert.match(r.log.at(-1).summary,/1D6 \+ 2/);
 const raw=exportSession(r.session),result=api({operation:'command',session:r.session,command:{type:'add-extra',payload:{id:'CHA'}}});assert.equal(result.ok,false);assert.match(result.error.message,/already exists/);assert.equal(exportSession(r.session),raw);assert.deepEqual(project(importSession(raw)).state,r.state);
});
test('human optional CHA remains 2D and Aezorgh CHA remains derived',()=>{
 let r=run(run(createSession('non-vargr'),'configure',{extras:['CHA']}),'setup',{species:'human'});r=accepted(r);assert.equal(chaRolls(r)[0].values.length,2);assert.equal(r.state.character.stats.CHA,chaRolls(r)[0].total);
 r=accepted(run(createSession('aezorgh'),'setup',{species:'aezorgh'}));assert.equal(r.state.character.stats.CHA,Math.floor(r.state.character.stats.SOC/2));
});
test('pending optional card appears only for selected Imperial CHA and is absent from base placeholders',()=>{
 for(const culture of ['imperial','native'])for(const extras of [[],['CHA']]){const r=start({culture,extras}),raw=exportSession(r.session),html=statisticsCardsView(r.state,catalog(),emptyStatisticsView(r.state,catalog(),{esc}),{esc});assert.equal((html.match(/data-optional-stat="CHA"/g)??[]).length,culture==='imperial'&&extras.length?1:0);assert.equal(exportSession(r.session),raw);}
});
test('GM-preexisting optional CHA is preserved; acceptance cannot reroll or overwrite it',()=>{
 let r=run(start({extras:['CHA']}),'gm-mode',{enabled:true});r=run(r,'gm-override',{field:'stat.CHA',value:11,reason:'Explicit campaign starting CHA'});r=accepted(r);assert.equal(r.state.character.stats.CHA,11);assert.deepEqual(chaRolls(r),[]);assert.doesNotMatch(r.log.at(-1).summary,/1D6 \+ 2/);
});
test('replay and restore preserve one-die identity, untouched earlier rolls and audit history',()=>{
 let r=rolled(run(start({extras:['MRL','CHA']}),'gm-mode',{enabled:true}));const checkpoint=r.revision;r=run(r,'accept-statistics');const acceptedRevision=r.revision,original=structuredClone(r.log.at(-1));
 const repeated=execute(r.session,{type:'accept-statistics',payload:{}},{id:'action-'+acceptedRevision});assert.deepEqual(repeated.session,r.session);
 r=run(r,'gm-replay',{revision:acceptedRevision,rollIndex:1,values:[6],reason:'Confirm one-die campaign CHA'});assert.equal(r.state.character.stats.CHA,8);assert.equal(r.log.at(-1).rolls[1].values.length,1);assert.deepEqual(r.log.at(-1).rolls[0],original.rolls[0]);
 const raw=exportSession(r.session);assert.throws(()=>run(r,'gm-replay',{revision:acceptedRevision,rollIndex:1,values:[1,2],reason:'Wrong dice count'}),/match|dice count/);assert.equal(exportSession(r.session),raw);
 r=run(r,'restore',{revision:checkpoint});assert.equal(r.state.character.stats.CHA,undefined);r=run(r,'accept-statistics');assert.equal(chaRolls(r).length,1);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
});
// Captured before changes from 5e2f4a74f4e6567564af63e6314ea909b293154e, synthetic data only.
test('all .16-.22 native/Imperial selected/unselected saves preserve exact bytes and projected state',()=>{
 const cases=JSON.parse(readFileSync(new URL('./imperial-vargr-historical.json',import.meta.url),'utf8'));
 for(const c of cases){let r={...createSession('vargr-historical'),rulesRevision:'character-preview-2026-11-09.'+c.revision};
  for(const [type,payload] of [['configure',{extras:c.extras,boons:2}],['setup',{species:'vargr',culture:c.culture}],['roll-statistics',{}]])r=run(r,type,payload);
  // Resuming an interrupted old save must use its old acceptance semantics.
  r=run(importSession(exportSession(r.session)),'accept-statistics');const raw=exportSession(r.session);assert.equal(hash(raw),c.hash,JSON.stringify(c));assert.equal(hash(JSON.stringify(r.state)),c.stateHash);assert.equal(exportSession(importSession(raw)),raw);assert.deepEqual(project(importSession(raw)).state,r.state);
  if(c.culture==='imperial'){assert.ok(Object.hasOwn(r.state.character.stats,'CHA'));assert.equal(chaRolls(r).length,c.extras.includes('CHA')?2:1);}
 }
});
