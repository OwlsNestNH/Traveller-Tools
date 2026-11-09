import test from 'node:test';
import assert from 'node:assert/strict';
import {api,createSession,execute,project,importSession,exportSession} from '../engine/session.mjs';

const act=(s,type,payload={})=>execute(s,{type,payload});
for(const species of ['human','aslan','vargr','zhodani','aezorgh']) {
 for(const boons of [0,3,6]) {
  test(species+' / '+boons+' boons: replay and allocation preserve every raw roll',()=>{
   let s=createSession('invariant-'+species+'-'+boons);
   s=act(s,'configure',{boons}).session;
   s=act(s,'setup',{name:'Invariant <test>',species,gender:'female'}).session;
   let r=act(s,'roll-statistics');
   const recorded=structuredClone(r.log.at(-1).rolls),total=r.state.rollTotal;
   const original=structuredClone(r.state.pool);
   const pair=original.findIndex((p,i)=>i>0&&p.count===original[0].count);
   r=act(r.session,'swap-statistics',{a:0,b:pair});
   assert.equal(r.state.rollTotal,total);
   assert.equal(r.state.pool[0].origin,original[pair].origin);
   assert.equal(r.state.pool[0].boon,original[pair].boon);
   assert.deepEqual(r.log.at(-2).rolls,recorded);
   r=act(r.session,'accept-statistics');
   const loaded=project(importSession(exportSession(r.session)));
   assert.deepEqual(loaded.state,r.state);
   assert.deepEqual(loaded.log,r.log);
   assert.equal(r.log.filter(e=>e.type==='roll-statistics').length,1);
   assert.ok(r.log.every(e=>Array.isArray(e.rolls)));
  });
 }
}

test('rejected commands leave the original session and revision unchanged',()=>{
 const s=createSession('rejection');const frozen=JSON.stringify(s);
 for(const command of [null,{}, {type:'unknown'}, {type:'setup',payload:{species:'kkree'}}, {type:'benefit'}, {type:'gm-override',payload:{field:'stat.STR',value:12,reason:'not enabled'}}]) {
  const result=api({operation:'command',session:s,command});
  assert.equal(result.ok,false);assert.equal(JSON.stringify(s),frozen);assert.equal(project(s).revision,0);
 }
});

test('every import must satisfy its replay stage constraints',()=>{
 const s=createSession('malformed-sequence');
 s.events.push({id:'invalid-first',command:{type:'survival'}});
 assert.throws(()=>importSession(JSON.stringify(s)),/survival|stage|career/i);
});

test('duplicate action IDs cannot disguise a different command',()=>{
 const s=createSession('duplicate');const first=execute(s,{type:'gm-mode',payload:{enabled:true}},{id:'unique'});
 assert.throws(()=>execute(first.session,{type:'gm-mode',payload:{enabled:false}},{id:'unique'}),/different command/);
 assert.equal(project(first.session).state.config.gm,true);
});

test('external character input is retained as text, not interpreted',()=>{
 let s=createSession('text');s=act(s,'setup',{name:'<img src=x onerror=alert(1)>',species:'human',homeworld:'<script>example</script>'}).session;
 const state=project(s).state;assert.equal(state.character.name,'<img src=x onerror=alert(1)>');
 assert.deepEqual(project(importSession(exportSession(s))).state,state);
});
