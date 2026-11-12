import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {project,execute,exportSession,importSession} from '../engine/session.mjs';
import {buildAslanOriginFixture} from './aslan-origin-fixtures.mjs';
import {forceEducation,command} from './education-result-fixtures.mjs';
const url=new URL('../engine/session.mjs',import.meta.url);
const source=(await readFile(url,'utf8')).replace(/from\s+'(\.\/[^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,url).href));
const guard="if(state.deferredSpecializations&&state.character.species==='aslan'&&Array.isArray(state.pendingChoice?.options))";
assert.ok(source.includes(guard));
const load=s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
// Retain the former decorator to demonstrate the failing save, and bypass only
// that final presentation line as an independent legacy mechanical oracle.
const broken=await load(source.replace(guard,"if(state.deferredSpecializations&&state.character.species==='aslan'&&state.pendingChoice?.options)"));
const mechanical=await load(source.replace(guard,"if(false)"));
for(const revision of ['29','30'])test('.'+revision+' native Aslan hobby save recovers without rewriting or changed continuation',()=>{
 let r=buildAslanOriginFixture({stage:'precareer',rulesRevision:'character-preview-2026-11-09.'+revision});
 // Valid array decoration must remain byte-for-byte equivalent.
 r=forceEducation(r,'precareer',{id:'core.university'},[6,6]);
 assert.ok(Array.isArray(r.state.pendingChoice.options));
 assert.deepEqual(project(r.session),broken.project(r.session));
 r=command(r,'education-skill',{name:'Admin'});
 r=command(r,'education-skill',{name:'Medic'});
 r=forceEducation(r,'education-event',{},[4,5]);
 const raw=JSON.stringify(r.session,null,2);
 assert.throws(()=>broken.project(JSON.parse(raw)),/map is not a function/);
 const recovered=importSession(raw),view=project(recovered);
 assert.equal(view.state.pendingChoice.options,'any');
 assert.equal(view.state.stage,'education-skill');
 assert.equal(view.state.educationEventCheckpoints,undefined);
 assert.equal(exportSession(recovered),raw);
 assert.deepEqual(view,mechanical.project(JSON.parse(raw)));
 for(const name of ['Engineer','Independence']){
  const action={type:'education-skill',payload:{name}};
  const next=execute(recovered,action),expected=mechanical.execute(JSON.parse(raw),action);
  assert.deepEqual(next.state,expected.state);
  assert.deepEqual(next.log.map(({id,...entry})=>entry),expected.log.map(({id,...entry})=>entry));
  assert.equal(next.state.stage,'education-graduation');
  assert.equal(exportSession(recovered),raw);
 }
});
