import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import http from 'node:http';
test('localhost rules API and static boundary',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/Character Generator/);
  const api=await fetch(base+'/api/v1',{method:'POST',body:JSON.stringify({operation:'catalog'})});assert.equal(api.status,200);assert.equal((await api.json()).apiVersion,1);
  const bad=await fetch(base+'/api/v1',{method:'POST',body:'bad'});assert.equal(bad.status,400);
  const origin=await fetch(base+'/api/v1',{method:'POST',headers:{Origin:'https://example.com'},body:'{}'});assert.equal(origin.status,403);
  const parent=await fetch(base+'/%2e%2e%2findex.html');assert.equal(parent.status,404);
  const wrongHost=await new Promise((resolve,reject)=>{const r=http.get(base+'/',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);});assert.equal(wrongHost,403);
  const put=await fetch(base+'/',{method:'PUT'});assert.equal(put.status,405);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('chunked UTF-8 names roundtrip without silent character replacement',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const seed=await (await fetch(base+'/api/v1',{method:'POST',body:JSON.stringify({operation:'create',seed:'utf8'})})).json();
  const name='Zo'+String.fromCodePoint(0xeb);
  const body=Buffer.from(JSON.stringify({operation:'command',session:seed.session,command:{type:'setup',payload:{name,species:'human'}}}),'utf8');
  const split=body.indexOf(Buffer.from([0xc3,0xab]))+1;assert.ok(split>1);
  const result=await new Promise((resolve,reject)=>{
   const req=http.request(base+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'}},res=>{
    const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
   });req.on('error',reject);req.write(body.subarray(0,split));setTimeout(()=>req.end(body.subarray(split)),25);
  });
  assert.equal(result.ok,true);assert.equal(result.state.character.name,name);assert.match(result.log.at(-1).summary,new RegExp(name));
  const malformed=await fetch(base+'/api/v1',{method:'POST',body:Buffer.from([123,34,120,34,58,34,0xc3,34,125])});assert.equal(malformed.status,400);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('a valid near-limit save roundtrips through the escaped HTTP import envelope',async()=>{
 const {createSession,execute,exportSession,MAX_SAVE_BYTES}=await import('../engine/session.mjs');
 let session=createSession('http-near-cap');let reachedLimit=false;
 for(let i=0;i<130;i++){
  try{session=execute(session,{type:'notes',payload:{text:'"'.repeat(9000)}}).session;}
  catch(error){assert.match(error.message,/size limit/);reachedLimit=true;break;}
 }
 assert.equal(reachedLimit,true);
 const raw=exportSession(session),body=JSON.stringify({operation:'import',raw});
 assert.ok(Buffer.byteLength(raw)<=MAX_SAVE_BYTES);assert.ok(Buffer.byteLength(body)>MAX_SAVE_BYTES);
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',headers:{'Content-Type':'application/json'},body});
  assert.equal(response.status,200);const restored=await response.json();assert.equal(restored.ok,true);assert.deepEqual(restored.session,session);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
