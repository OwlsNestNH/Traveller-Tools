import test from 'node:test';
import assert from 'node:assert/strict';
import {api,developmentApi,createSession,execute,exportSession,RULES_REVISION} from '../engine/session.mjs';
import {inspectRecordedHistory} from '../gui/legacy-history.mjs';
import {createServer} from '../server.mjs';
const command=(session,type,payload)=>({operation:'command',session,command:{type,payload}});
const denied=result=>{assert.equal(result.ok,false);assert.match(result.error.message,/deferred/);};
const saved=()=>execute(createSession('deferred-save'),{type:'setup',payload:{species:'zhodani',name:'Original history'}}).session;
test('release catalog keeps four species and all 36 non-Zhodani careers; development coverage stays intact',()=>{
 const catalog=api({operation:'catalog'});assert.deepEqual(catalog.species.map(s=>s.id),['human','aslan','vargr','aezorgh']);assert.equal(catalog.careers.length,36);assert.equal(catalog.careers.some(c=>c.group==='zhodani'),false);
 for(const id of ['core.psion','companion.truther','aslan.military','vargr.psion'])assert.ok(catalog.careers.some(c=>c.id===id));assert.equal(catalog.precareers.length,9);assert.ok(catalog.extraStats.some(s=>s.id==='PSI'));
 assert.equal(developmentApi({operation:'catalog'}).careers.length,45);assert.equal(developmentApi({operation:'catalog'}).species.length,5);
});
test('public setup, career and PSI paths reject deferred choices without changing the input',()=>{
 const session=createSession('release'),before=JSON.stringify(session);
 for(const [type,payload] of [['setup',{species:'zhodani'}],['configure',{zhodaniPsi:true}],['career',{id:'zhodani.army',assignment:'infantry'}]])denied(api(command(session,type,payload)));
 assert.equal(JSON.stringify(session),before);
 for(const species of ['human','aslan','vargr','aezorgh'])assert.equal(api(command(session,'setup',{species})).ok,true);
 let r=api(command(session,'gm-mode',{enabled:true}));r=api(command(r.session,'configure',{extras:['PSI'],zhodaniPsi:false}));assert.equal(r.ok,true);
});
test('all public session entry points reject deferred history and retain exact recovery bytes',()=>{
 const session=saved(),raw=exportSession(session);assert.equal(session.rulesRevision,RULES_REVISION);
 for(const request of [{operation:'import',raw},{operation:'project',session},command(session,'notes',{text:'Continue'}),command(session,'restore',{revision:0}),command(session,'gm-replay',{revision:1,rollIndex:0,values:[1],reason:'Replay'})])denied(api(request));
 assert.equal(exportSession(session),raw);assert.equal(inspectRecordedHistory(raw).events.length,1);
 // A restore cannot launder a superseded Zhodani setup into a blank session.
 let restored=execute(createSession('restore'),{type:'gm-mode',payload:{enabled:true}});
 restored=execute(restored.session,{type:'setup',payload:{species:'zhodani'}});restored=execute(restored.session,{type:'restore',payload:{revision:1}});
 denied(api({operation:'project',session:restored.session}));denied(api({operation:'import',raw:exportSession(restored.session)}));
});
test('prose mentioning deferred content is not mistaken for a species choice',()=>{
 const r=api(command(createSession('prose'),'setup',{species:'human',name:'Zhodani visitor'}));assert.equal(r.ok,true);assert.equal(api(command(r.session,'notes',{text:'zhodani.army'})).ok,true);
});
test('HTTP uses the same release boundary and has no request-controlled development unlock',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{
  for(const suffix of ['', '?development=true']){
   const response=await fetch(origin+'/api/v1'+suffix,{method:'POST',body:JSON.stringify({...command(createSession('http'),'setup',{species:'zhodani'}),development:true})});assert.equal(response.status,400);denied(await response.json());
  }
  const response=await fetch(origin+'/api/v1',{method:'POST',body:JSON.stringify({operation:'import',raw:exportSession(saved())})});assert.equal(response.status,400);denied(await response.json());
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
