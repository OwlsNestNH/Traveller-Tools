import test from 'node:test';
import assert from 'node:assert/strict';
import {project,importSession,exportSession} from '../engine/session.mjs';
import {relationshipFixture,psionRelationshipFixture,run,rejected} from './relationship-event-fixtures.mjs';
const roundtrip=r=>assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
for(const career of ['core.entertainer','core.drifter','core.rogue','aslan.outcast','aslan.outlaw'])for(const people of [0,2])test(career+' exact identity/source and absent fallback, people '+people,()=>{
 let r=relationshipFixture({career,people}),pending=r;roundtrip(r);const before=structuredClone(r.state.character.relationships),removing=career==='aslan.outcast',payload={confirmed:true,...(removing?{}:{role:'Rival'}),...(people?{relationshipId:before[1].id}:{})};
 for(const invalid of [{...payload,confirmed:false},{...payload,relationshipId:'unknown'},{...payload,effects:[]},{...payload,role:'Ally'},...(people?[{...payload,name:'replacement'}]:[])])rejected(r,'resolve-relationship-event',invalid);
 rejected(r,'gm-override',{field:'stat.SOC',value:12,reason:'Forbidden pending mutation'},/pending relationship/);
 r=run(r,'gm-mode',{enabled:false});r=run(r,'resolve-relationship-event',payload,{id:'relationship-once'});assert.equal(r.state.character.relationshipEvents.length,1);
 assert.deepEqual(run(r,'resolve-relationship-event',payload,{id:'relationship-once'}).session,r.session);rejected(r,'resolve-relationship-event',payload);
 const record=r.state.character.relationshipEvents[0];assert.equal(record.careerId,career);assert.deepEqual(record.source,pending.state.pendingChoice.source);assert.equal(record.absent,!people);assert.equal(record.before?.id,people?before[1].id:undefined);
 if(people){assert.deepEqual(r.state.character.relationships[0],before[0]);if(removing)assert.equal(r.state.character.relationships.length,before.length-1);else{assert.equal(r.state.character.relationships[1].id,before[1].id);assert.equal(r.state.character.relationships[1].name,before[1].name);assert.equal(r.state.character.relationships[1].role,'Rival');}}
 else if(removing){assert.deepEqual(r.state.character.relationships,before);assert.equal(r.state.character.careers[0].benefitRolls,0);}else assert.equal(r.state.character.relationships.at(-1).role,'Rival');
 assert.ok(r.log.at(-1).changes.some(c=>c.path.startsWith('relationshipEvents.')));roundtrip(r);
 r=run(r,'gm-mode',{enabled:true});r=run(r,'restore',{revision:pending.revision});assert.deepEqual(r.state.character.relationships,before);assert.equal(r.state.character.relationshipEvents,undefined);r=run(r,'resolve-relationship-event',{...payload,...(people?{relationshipId:before[0].id}:{})});roundtrip(r);
});
test('Public Core Psion history converts exactly, while absent-person ambiguity stays explicit',()=>{
 for(const event of [true,false])for(const people of [0,2]){
  let r=psionRelationshipFixture({people,event});roundtrip(r);
  if(!people){assert.equal(r.state.stage,'book-step');assert.equal(r.state.pending.page,237);assert.match(JSON.stringify(r.state.pending),/no replacement relationship/i);assert.equal(r.state.character.relationships.length,0);continue;}
  const before=structuredClone(r.state.character.relationships),role=event?'Rival':'Enemy';
  rejected(r,'resolve-relationship-event',{confirmed:true,relationshipId:before[1].id,role:event?'Enemy':'Rival'});
  r=run(r,'resolve-relationship-event',{confirmed:true,relationshipId:before[1].id,role});assert.deepEqual(r.state.character.relationships[0],before[0]);assert.equal(r.state.character.relationships[1].role,role);assert.equal(r.state.character.relationshipEvents[0].source.page,237);roundtrip(r);
 }
});
test('HTTP uses the same atomic typed relationship command and replay save',async()=>{
 const {createServer}=await import('../server.mjs');const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const r=relationshipFixture({people:2}),call=async payload=>(await fetch('http://127.0.0.1:'+server.address().port+'/api/v1',{method:'POST',body:JSON.stringify({operation:'command',session:r.session,command:{type:'resolve-relationship-event',payload}})})).json();
 const bad=await call({confirmed:true,role:'Enemy',relationshipId:'missing'});assert.equal(bad.ok,false);const good=await call({confirmed:true,role:'Enemy',relationshipId:r.state.character.relationships[1].id});assert.equal(good.ok,true);assert.equal(good.state.character.relationshipEvents[0].after.role,'Enemy');roundtrip(good);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
