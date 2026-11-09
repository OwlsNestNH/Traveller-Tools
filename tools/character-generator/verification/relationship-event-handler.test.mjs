import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {api,exportSession,importSession,project} from '../engine/session.mjs';
import {relationshipEventPayload} from '../gui/relationship-event-view.mjs';
import {relationshipFixture,psionRelationshipFixture} from './relationship-event-fixtures.mjs';

// Execute the actual application's registered click listener, not a copied branch.
// No browser/global `state` is supplied: app handlers must read projection.state.
const source=await readFile(new URL('../gui/app.mjs',import.meta.url),'utf8');
const start=source.indexOf("document.addEventListener('click',async event=>{");
assert.ok(start>=0);const listener=source.slice(start,source.indexOf('\n});',start)+4);
for(const scenario of [
 {career:'core.entertainer',people:0},
 {career:'core.drifter',people:2},
 {career:'core.rogue',people:0},
 {career:'aslan.outcast',people:0},
 {career:'aslan.outcast',people:2},
 {career:'aslan.outlaw',people:2},
 {career:'core.psion',people:2}
])test('actual click handler submits exactly one typed consequence: '+scenario.career+' / '+scenario.people,async()=>{
 let r=scenario.career==='core.psion'?psionRelationshipFixture(scenario):relationshipFixture(scenario);
 const before=r,originalSave=exportSession(r.session),removing=scenario.career==='aslan.outcast';
 const fields={'#relationship-event-confirm':{checked:false}};
 if(!removing)fields['#relationship-event-role']={value:'Rival'};
 if(scenario.people)fields['#relationship-event-person']={value:r.state.character.relationships[1].id};
 else if(!removing)fields['#relationship-event-name']={value:'Source-earned rival'};
 let click,calls=0,lastResult;
 const context={busy:false,projection:r,relationshipEventPayload,
  document:{addEventListener(type,handler){assert.equal(type,'click');click=handler;}},
  $:selector=>fields[selector]??null,
  send:async(type,payload)=>{
   calls++;lastResult=api({operation:'command',session:r.session,command:{type,payload}});
   if(lastResult.ok){r=lastResult;context.projection=r;for(const key of Object.keys(fields))delete fields[key];}
   return lastResult.ok;
  }
 };
 vm.runInNewContext(listener,context);
 const event=detail=>({detail,target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'resolve-relationship-event'}}:null}});
 await click(event(1));assert.equal(calls,1);assert.equal(lastResult.ok,false);assert.match(lastResult.error.message,/Confirm/);assert.equal(exportSession(r.session),originalSave);
 fields['#relationship-event-confirm'].checked=true;
 await click(event(1));assert.equal(lastResult.ok,true,lastResult.error?.message);
 // The second click can arrive after synchronous/local transport has rendered
 // the next checkpoint and removed all relationship fields. It must be ignored.
 await click(event(2));assert.equal(calls,2);assert.equal(r.revision,before.revision+1);
 assert.equal(r.state.character.relationshipEvents.length,1);
 const record=r.state.character.relationshipEvents[0];assert.equal(record.careerId,scenario.career);assert.deepEqual(record.source,before.state.pendingChoice.source);
 if(scenario.people)assert.equal(record.before.id,before.state.character.relationships[1].id);
 assert.deepEqual(project(importSession(exportSession(r.session))).state,r.state);
 context.busy=true;await click(event(1));assert.equal(calls,2);
});
