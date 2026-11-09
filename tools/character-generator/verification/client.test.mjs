import test from 'node:test';
import assert from 'node:assert/strict';
import {call} from '../gui/client.mjs';

test('HTTP validation errors preserve the useful engine message',async()=>{
 const oldLocation=globalThis.location,oldFetch=globalThis.fetch;
 try{
  globalThis.location={search:'?api=local'};
  globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,error:{code:'INVALID_REQUEST',message:'Choose exactly 3 distinct background skills.'}}),{status:400,headers:{'Content-Type':'application/json'}});
  const result=await call({operation:'command'});
  assert.equal(result.ok,false);assert.match(result.error.message,/3 distinct/);
 }finally{globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});

test('non-JSON transport failures are readable and do not masquerade as engine success',async()=>{
 const oldLocation=globalThis.location,oldFetch=globalThis.fetch;
 try{
  globalThis.location={search:'?api=local'};globalThis.fetch=async()=>new Response('Unavailable',{status:503});
  await assert.rejects(()=>call({operation:'catalog'}),/unreadable response/);
 }finally{globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});

test('default transport exposes the same engine API without network activity',async()=>{
 const oldLocation=globalThis.location,oldFetch=globalThis.fetch;
 try{
  globalThis.location={search:''};globalThis.fetch=()=>{throw new Error('Unexpected network');};
  const result=await call({operation:'catalog'});assert.equal(result.ok,true);assert.equal(result.apiVersion,1);
 }finally{globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});

test('GUI transport has no static engine dependency',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../gui/client.mjs',import.meta.url),'utf8');
 assert.equal(source.split('\n').some(line=>line.startsWith('import ')&&line.includes('/engine/')),false);
 assert.ok(source.includes("await import('../engine/session.mjs')"));
});
