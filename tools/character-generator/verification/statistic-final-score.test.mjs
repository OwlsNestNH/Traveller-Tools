import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function fixture(species='human'){let r=run(createSession('final-score-'+species),'configure',{aezorghTwoDice:species==='aezorgh'});r=run(r,'setup',{species});r=run(r,'gm-mode',{enabled:true});return run(r,'roll-statistics');}
for(const species of ['human','aslan','aezorgh'])test(species+' GM final scores bypass species bonuses and halving, retain raw dice, survive Keep and replay',()=>{
 let r=fixture(species);const initial=r,raw=r.state.pool[0].base,total=r.state.rollTotal,roll=structuredClone(r.log.at(-1));
 r=run(r,'gm-override',{field:'pool-score',index:0,value:10,reason:'Final score requested'});
 assert.equal(r.state.pool[0].value,10);assert.equal(r.state.pool[0].base,raw);assert.equal(r.state.rollTotal,total);assert.deepEqual(r.log.find(x=>x.type==='roll-statistics'),roll);
 assert.deepEqual(r.session.events.slice(0,initial.session.events.length),initial.session.events);assert.match(r.log.at(-1).summary,/final displayed score/i);
 const current=r;r=run(r,'swap-statistics',{a:0,b:1});assert.equal(r.state.pool[0].value,10);assert.equal(r.state.rollTotal,total);
 r=run(r,'accept-statistics');assert.equal(r.state.character.stats.STR,10);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 const rerolled=run(current,'roll-statistics');assert.ok(rerolled.state.pool.every(p=>p.finalOverride===undefined));
 const rawChanged=run(current,'gm-override',{field:'pool',index:0,value:9,reason:'Explicit raw correction'});assert.equal(rawChanged.state.pool[0].finalOverride,undefined);assert.equal(rawChanged.state.pool[0].base,9);
});
test('GM final pool score bounds and permission fail atomically; zero and forty accepted',()=>{
 const r=fixture(),before=exportSession(r.session);for(const value of [-1,41,1.5,'10'])assert.throws(()=>run(r,'gm-override',{field:'pool-score',index:0,value,reason:'Invalid'}));assert.equal(exportSession(r.session),before);
 for(const value of [0,40])assert.equal(run(r,'gm-override',{field:'pool-score',index:0,value,reason:'Valid final'}).state.pool[0].value,value);
 const corrected=run(r,'gm-override',{field:'pool-score',index:0,value:10,reason:'Retained'}),disabled=run(corrected,'gm-mode',{enabled:false});assert.equal(disabled.state.pool[0].value,10);assert.throws(()=>run(disabled,'gm-override',{field:'pool-score',index:0,value:11,reason:'No permission'}),/GM/);
});
