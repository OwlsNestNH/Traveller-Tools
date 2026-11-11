import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSession,execute,project,exportSession,importSession,api} from '../engine/session.mjs';
import {BACKGROUND_SKILLS} from '../engine/catalog.mjs';
import {createServer} from '../server.mjs';
const frozen=JSON.parse(readFileSync(new URL('./background-culture-historical.json',import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const run=(r,type,payload={})=>execute(r.session??r,{type,payload});
function background(gender){const old=JSON.parse(frozen.cases.find(c=>c.revision===24&&c.gender===gender&&c.stage==='background').raw);let session=createSession(old.seed);for(const event of old.events)session=execute(session,event.command).session;return {...project(session),session};}
test('frozen pre-change .16-.24 saves, projections including RNG, and audits remain byte identical',()=>{
 assert.equal(frozen.cases.length,72);
 for(const c of frozen.cases){const s=importSession(c.raw),r=project(s);assert.equal(hash(exportSession(s)),c.saveHash);assert.equal(exportSession(s),c.raw);assert.equal(hash(JSON.stringify(r.state)),c.stateHash,c.revision+' '+c.gender+' '+c.stage);assert.equal(hash(JSON.stringify(r.log)),c.logHash);assert.equal(r.state.cultureAwareBackground,undefined);assert.equal(s.rulesRevision,'character-preview-2026-11-09.'+c.revision);if(c.stage==='finish')for(const skill of ['Melee','Tolerance'])assert.equal(r.state.character.skills[skill],0);}
});
test('new Imperial Aslan of both genders use the entire Core pool, with atomic rejection and restore',()=>{
 for(const gender of ['male','female']){let r=background(gender);assert.deepEqual(r.state.backgroundOptions,BACKGROUND_SKILLS);assert.equal(r.state.cultureAwareBackground,true);const raw=exportSession(r.session),skills=r.state.backgroundOptions.slice(0,r.state.backgroundRemaining);assert.throws(()=>run(r,'background',{skills:['Tolerance',...skills.slice(1)]}),/background list/);assert.equal(exportSession(r.session),raw);const revision=r.revision;r=run(r,'background',{skills});r=run(r,'restore',{revision});assert.deepEqual(r.state.backgroundOptions,BACKGROUND_SKILLS);assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);}
});
test('native gender pools and Human, Vargr, Aezorgh rules are unchanged',()=>{
 for(const species of ['human','aslan','vargr','aezorgh'])for(const gender of ['male','female'])for(const culture of ['native','imperial']){if(species==='aslan'&&culture==='imperial')continue;let s=createSession('background-matrix-'+species+gender+culture);s=run(s,'setup',{species,gender,culture}).session;const current=project(s),legacy=project({...s,rulesRevision:'character-preview-2026-11-09.24'});assert.deepEqual(current.state.backgroundOptions,legacy.state.backgroundOptions);if(species==='aslan')assert.ok(current.state.backgroundOptions.includes('Tolerance'));else assert.deepEqual(current.state.backgroundOptions,BACKGROUND_SKILLS);let r=run(s,'roll-statistics');r=run(r,'accept-statistics');if(species==='vargr')assert.equal(r.state.character.skills.Melee,0);if(species==='aezorgh'){assert.equal(r.state.backgroundRemaining,1);for(const x of ['Athletics','Mechanic','Recon','Stealth'])assert.equal(r.state.character.skills[x],0);}}
});
test('in-process and HTTP APIs agree on corrected and legacy selection/import behavior',async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const http=async request=>(await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',body:JSON.stringify(request)})).json();for(const call of [api,http]){for(const gender of ['male','female']){const r=background(gender);let out=await call({operation:'project',session:r.session});assert.equal(out.ok,true);assert.deepEqual(out.state.backgroundOptions,BACKGROUND_SKILLS);out=await call({operation:'command',session:r.session,command:{type:'background',payload:{skills:['Melee',...BACKGROUND_SKILLS.slice(0,r.state.backgroundRemaining-1)]}}});assert.equal(out.ok,false);out=await call({operation:'command',session:r.session,command:{type:'background',payload:{skills:BACKGROUND_SKILLS.slice(0,r.state.backgroundRemaining)}}});assert.equal(out.ok,true);const raw=exportSession(out.session),reloaded=await call({operation:'import',raw});assert.equal(reloaded.ok,true);assert.deepEqual(reloaded.state,out.state);}for(const c of frozen.cases.filter(c=>c.stage==='finish')){const out=await call({operation:'import',raw:c.raw});assert.equal(out.ok,true);assert.equal(hash(JSON.stringify(out.state)),c.stateHash);assert.equal(exportSession(out.session),c.raw);}}}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
