import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession,api} from '../engine/session.mjs';
import {statisticEditTarget} from '../gui/statistic-editor.mjs';
const run=(r,type,payload={},options)=>execute(r.session??r,{type,payload},options);
function start(psiGm=false,extras=['PSI'],revision){let s=createSession('psi-only-gm');if(revision)s.rulesRevision='character-preview-2026-11-09.'+revision;let r=run(s,'configure',{extras,...(psiGm?{psiGm:true}:{})});r=run(r,'setup',{species:'human'});return run(r,'roll-statistics');}
const edit=(r,value=9)=>run(r,'gm-override',{field:'stat.PSI',value,reason:'Referee assigns psionic potential only'});

test('isolated activation defaults off, enables PSI only and consumes no dice',()=>{
 let r=start();assert.equal(r.state.config.psiGm,undefined);const before=r.state,rng=before.rng;r=run(r,'gm-psi-mode',{enabled:true},{id:'activate-once'});
 assert.equal(r.state.config.psiGm,true);assert.equal(r.state.config.gm,false);assert.deepEqual(r.state.character,before.character);assert.equal(r.state.rng,rng);assert.deepEqual(r.log.at(-1).rolls,[]);
 assert.deepEqual(run(r,'gm-psi-mode',{enabled:true},{id:'activate-once'}).session,r.session);
 for(const field of ['stat.STR','stat.CHA','stat.REP','cash','debt','age','pool','pool-score','stat.PSI '])assert.throws(()=>run(r,'gm-override',{field,value:10,index:0,reason:'Not authorized'}),/GM/);
 assert.throws(()=>run(r,'gm-academy-training',{enabled:true}),/GM/);assert.throws(()=>run(r,'restore',{revision:1}),/GM/);assert.throws(()=>run(r,'gm-replay',{revision:3,rollIndex:0,values:[6,6],reason:'Not authorized'}),/GM/);
 assert.equal(statisticEditTarget(r.state,'PSI').field,'stat.PSI');assert.equal(statisticEditTarget(r.state,'STR',true),null);
 r=run(r,'accept-statistics');assert.equal(r.state.character.stats.PSI,undefined);assert.equal(r.state.rng,rng);assert.equal(r.state.canStartPsionicTraining,false);
});

test('setup activation selects PSI, assigning preserves audit and Keep never fabricates a test',()=>{
 let r=start(true,[]);assert.ok(r.state.config.extras.includes('PSI'));r=edit(r);assert.equal(r.state.config.gm,false);const rng=r.state.rng;r=run(r,'accept-statistics');assert.equal(r.state.character.stats.PSI,9);assert.equal(r.state.rng,rng);assert.deepEqual(r.state.character.psionics.tests,[]);assert.deepEqual(r.state.character.psionics.training,[]);assert.deepEqual(r.state.character.skills,{});assert.match(r.log.at(-2).summary,/GM override stat.PSI: absent/);
 const character=structuredClone(r.state.character);r=run(r,'gm-psi-mode',{enabled:false});assert.deepEqual(r.state.character,character);assert.throws(()=>edit(r,12),/GM/);assert.equal(statisticEditTarget(r.state,'PSI'),null);
 r=run(r,'gm-psi-mode',{enabled:true});assert.deepEqual(r.state.character,character);const raw=exportSession(r.session);assert.equal(exportSession(importSession(raw)),raw);assert.deepEqual(project(importSession(raw)).state,r.state);
});

test('malformed activation and PSI score payloads reject without mutation',()=>{
 const initial=start(),raw=exportSession(initial.session);for(const payload of [{},{enabled:1},{enabled:'yes'},{enabled:true,gm:true},{enabled:true,value:12}]){assert.throws(()=>run(initial,'gm-psi-mode',payload));assert.equal(exportSession(initial.session),raw);}assert.throws(()=>run(createSession('invalid'),'configure',{psiGm:1}));
 const r=run(initial,'gm-psi-mode',{enabled:true}),saved=exportSession(r.session);for(const value of [-1,41,2.5,'9'])assert.throws(()=>edit(r,value));assert.throws(()=>run(r,'gm-override',{field:'stat.PSI',value:9,reason:' '}));assert.equal(exportSession(r.session),saved);
});

test('PSI-only activation can enable independent testing without bypassing source terms or separate training',()=>{
 let r=run(start(),'accept-statistics');r=run(r,'background',{skills:r.state.backgroundOptions.slice(0,r.state.backgroundRemaining)});r=run(r,'gm-psi-mode',{enabled:true});assert.equal(r.state.psionicTestingOptions.available,false);r=run(r,'gm-psi-testing',{enabled:true});assert.equal(r.state.config.gm,false);assert.equal(r.state.psionicTestingOptions.available,true);
 assert.throws(()=>run(r,'test-psionic-potential',{}));r=run(r,'test-psionic-potential',{accessConfirmed:true,timingConfirmed:true,funding:'provided',cost:0,providedConfirmed:true,reason:'Confirmed teacher and two-week interval'});const psi=r.state.character.stats.PSI;assert.equal(r.state.character.psionics.tests.length,1);assert.deepEqual(r.state.character.psionics.training,[]);
 r=run(r,'gm-psi-mode',{enabled:false});assert.equal(r.state.character.stats.PSI,psi);assert.throws(()=>run(r,'test-psionic-potential',{}),/retained|reroll/);
 if(psi>0){r=run(r,'begin-psionic-training');assert.equal(r.state.pending.testingNeeded,false);assert.equal(r.state.pending.minimumCost,100000);}
});

test('old saves retain their known scores; only explicit new activation changes the old pre-Keep PSI option',()=>{
 let legacy=run(start(false,['PSI'],23),'accept-statistics');const score=legacy.state.character.stats.PSI,history=structuredClone(legacy.state.character.psionics);assert.equal(typeof score,'number');legacy=run(legacy,'gm-psi-mode',{enabled:true});assert.equal(legacy.state.character.stats.PSI,score);assert.deepEqual(legacy.state.character.psionics,history);assert.equal(exportSession(importSession(exportSession(legacy.session))),exportSession(legacy.session));
 let pending=start(false,['PSI'],23);pending=run(pending,'gm-psi-mode',{enabled:true});pending=run(pending,'accept-statistics');assert.equal(pending.state.character.stats.PSI,undefined);assert.equal(pending.state.character.psionics,undefined);assert.equal(pending.state.canStartPsionicTraining,false);pending=run(pending,'background',{skills:pending.state.backgroundOptions.slice(0,pending.state.backgroundRemaining)});pending=run(pending,'gm-psi-testing',{enabled:true});assert.equal(pending.state.psionicTestingOptions.available,true);pending=run(pending,'gm-psi-mode',{enabled:false});assert.equal(pending.state.psionicTestingOptions.available,true);assert.throws(()=>run(pending,'begin-psionic-training'),/Test psionic/);assert.throws(()=>run(pending,'add-extra',{id:'PSI'}),/already enabled/);
 let assigned=start(false,['PSI'],23);assigned=run(assigned,'gm-psi-mode',{enabled:true});assigned=edit(assigned);assigned=run(assigned,'gm-psi-mode',{enabled:false});assigned=run(assigned,'accept-statistics');assert.equal(assigned.state.character.stats.PSI,9);assert.deepEqual(assigned.state.character.psionics.tests,[]);
});

test('public API keeps isolated PSI commands scoped and still rejects deferred Zhodani',()=>{
 const r=run(start(),'gm-psi-mode',{enabled:true});const request=(type,payload)=>api({operation:'command',session:r.session,command:{type,payload}});assert.equal(request('gm-override',{field:'stat.PSI',value:9,reason:'Synthetic assigned PSI'}).ok,true);assert.equal(request('gm-override',{field:'cash',value:999,reason:'Not permitted'}).ok,false);assert.equal(api({operation:'command',session:createSession('no-zhodani'),command:{type:'setup',payload:{species:'zhodani'}}}).ok,false);
});
