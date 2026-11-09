import test from 'node:test';
import assert from 'node:assert/strict';
import {api,developmentApi,createSession,execute,exportSession,RULES_REVISION,COMPATIBLE_RULES_REVISIONS} from '../engine/session.mjs';
import {ZHODANI_RELEASE_REVISION,assertReleaseRequest} from '../engine/release-scope.mjs';
import {inspectRecordedHistory} from '../gui/legacy-history.mjs';
import {createServer} from '../server.mjs';
const command=(session,type,payload)=>({operation:'command',session,command:{type,payload}});
const saved=()=>execute(createSession('zhodani-save'),{type:'setup',payload:{species:'zhodani',name:'Original history'}}).session;
test('public catalog includes five species and all nine Zhodani careers within 45 careers',()=>{
 const c=api({operation:'catalog'});assert.equal(c.species.length,5);assert.ok(c.species.some(s=>s.id==='zhodani'));assert.equal(c.careers.length,45);assert.equal(c.careers.filter(c=>c.group==='zhodani').length,9);
 assert.deepEqual(c,developmentApi({operation:'catalog'}));assert.equal(RULES_REVISION,ZHODANI_RELEASE_REVISION);
});
test('new public Zhodani setup, native PSI and GM PSI survive export and replay',()=>{
 for(const optional of [false,true]){
  let r=api({operation:'create',seed:'release-psi'});
  for(const [type,payload] of [['gm-mode',{enabled:optional}],['configure',{zhodaniPsi:optional}],['setup',{species:'zhodani'}],['roll-statistics',{}],['accept-statistics',{}]]){r=api(command(r.session,type,payload));assert.equal(r.ok,true,r.error?.message);}
  assert.equal(typeof r.state.character.stats.PSI,'number');if(optional){assert.ok(r.state.character.stats.PSI>=9);assert.ok(r.state.character.stats.SOC>=10);assert.equal(r.state.stage,'psionic-training');}
  assert.deepEqual(api({operation:'project',session:r.session}).state,r.state);
  const raw=exportSession(r.session);assert.deepEqual(api({operation:'import',raw}).state,r.state);assert.equal(exportSession(api({operation:'import',raw}).session),raw);
 }
});
test('GM PSI option still requires GM mode and Zhodani species when rolling',()=>{
 for(const [gm,species] of [[false,'zhodani'],[true,'human']]){
  let r=api({operation:'create',seed:'invalid-option'});for(const [type,payload] of [['gm-mode',{enabled:gm}],['configure',{zhodaniPsi:true}],['setup',{species}]]){r=api(command(r.session,type,payload));assert.equal(r.ok,true);}
  const raw=exportSession(r.session);assert.equal(api(command(r.session,'roll-statistics',{})).ok,false);assert.equal(exportSession(r.session),raw);
 }
});
test('older public revisions still reject formerly deferred commands and superseded histories',()=>{
 for(const rulesRevision of ['character-preview-2026-11-09.16','character-preview-2026-11-09.17','character-preview-2026-11-09.18']){
  const session={...createSession('old'),rulesRevision};for(const [type,payload] of [['setup',{species:'zhodani'}],['configure',{zhodaniPsi:true}],['career',{id:'zhodani.army'}]])assert.throws(()=>assertReleaseRequest(command(session,type,payload)),/deferred/);
  const old={...saved(),rulesRevision},raw=JSON.stringify(old);for(const request of [{operation:'project',session:old},{operation:'import',raw},command(old,'restore',{revision:0})])assert.equal(api(request).ok,false);
  assert.equal(JSON.stringify(old),raw);assert.equal(inspectRecordedHistory(raw).events.length,1);
  const superseded={...session,events:[{command:{type:'setup',payload:{species:'zhodani'}}},{command:{type:'restore',payload:{revision:0}}}]};assert.throws(()=>assertReleaseRequest({session:superseded}),/deferred/);
 }
 for(const rulesRevision of COMPATIBLE_RULES_REVISIONS){const session={...createSession('human'),rulesRevision};const r=api(command(session,'setup',{species:'human',name:'Zhodani visitor'}));assert.equal(r.ok,true,r.error?.message);assert.equal(r.session.rulesRevision,rulesRevision);}
});
test('public HTTP supports current Zhodani and rejects old history without a flag bypass',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{for(const suffix of ['', '?development=true']){
  const response=await fetch(origin+'/api/v1'+suffix,{method:'POST',body:JSON.stringify({...command(createSession('http'),'setup',{species:'zhodani'}),development:true})});assert.equal(response.status,200);assert.equal((await response.json()).state.character.species,'zhodani');
  const raw=JSON.stringify({...saved(),rulesRevision:'character-preview-2026-11-09.17'});const rejected=await fetch(origin+'/api/v1'+suffix,{method:'POST',body:JSON.stringify({operation:'import',raw,development:true})});assert.equal(rejected.status,400);assert.equal((await rejected.json()).ok,false);
 }}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
