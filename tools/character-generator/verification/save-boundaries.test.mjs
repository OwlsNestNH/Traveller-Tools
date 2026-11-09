import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';

test('an identical accepted request can be retried with its original revision',()=>{
 const command={type:'gm-mode',payload:{enabled:true}},options={id:'retry',expectedRevision:0};
 const first=execute(createSession('retry'),command,options);
 const retry=execute(first.session,command,options);
 assert.deepEqual(retry,first);
 assert.throws(()=>execute(first.session,{type:'gm-mode',payload:{enabled:false}},options),/different command/);
 assert.throws(()=>execute(first.session,command,{id:'different',expectedRevision:0}),/changed/);
});

test('accepted Unicode-heavy sessions always export to an importable save',()=>{
 let s=createSession('size');let rejected=false;
 const note=String.fromCodePoint(0x4e00).repeat(9000);
 for(let i=0;i<100;i++){
  const original=JSON.stringify(s);
  try{s=execute(s,{type:'notes',payload:{text:note}}).session;}
  catch(error){assert.match(error.message,/size limit/);assert.equal(JSON.stringify(s),original);rejected=true;break;}
 }
 assert.equal(rejected,true);
 const save=exportSession(s);assert.ok(new TextEncoder().encode(save).byteLength<=2000000);
 assert.deepEqual(project(importSession(save)),project(s));
});

test('UTF-8 bytes, not JavaScript character count, bound imports',()=>{
 const raw=JSON.stringify({padding:String.fromCodePoint(0x4e00).repeat(700000)});
 assert.ok(raw.length<2000000);
 assert.throws(()=>importSession(raw),/too large/);
});
