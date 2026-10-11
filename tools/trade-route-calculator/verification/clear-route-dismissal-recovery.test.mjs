import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setup,serviceSaveGate,same,ui,noSuccess,terminal} from './clear-route-save-harness.mjs';

// Regression for actual Chromium controls-1440. Unlike an after-assignment
// observer, this setter throws BEFORE changing disabled, just like the browser
// fault that left physical Close and X unavailable. The app/Store/role callback
// and all three production-form chrome identities are the existing real-source
// harness. Chromium, rather than this native click boundary, certifies pixels
// and physical pointer dismissal.
function failRestore(h,id,{persistent=false,afterRestore=null}={}){
 const node=h.dom.ids.get(id);let disabled=node.disabled,faults=0,attempts=0;
 Object.defineProperty(node,'disabled',{configurable:true,get:()=>disabled,set(value){
  if(value===false&&h.store.reloadRequired){attempts++;if(persistent||faults===0){faults++;throw Error('Synthetic '+id+' terminal restoration fault');}}
  disabled=value;if(value===false&&h.store.reloadRequired)afterRestore?.();
 }});
 return {node,get faults(){return faults;},get attempts(){return attempts;}};
}
function clickEnabled(h,id){const node=h.dom.ids.get(id);assert.equal(node.disabled,false,id+' must genuinely be enabled before native click boundary dispatch');node.onclick({currentTarget:node,target:node});}
function prepare({delayed=true}={}){
 const h=setup(),before=h.persisted();h.open();const session=h.api.modalSession,detached=h.dom.ids.get('modal-form').onsubmit,gate=delayed?serviceSaveGate(h.store):null;
 h.hooks.afterNotify=()=>{throw Error('Synthetic committed Clear publication callback failure');};
 return {h,before,session,detached,gate};
}
async function unchangedAfterRetry({h,gate,detached},saved){await detached(h.event());await h.submit();assert.equal(h.bytes(),saved);assert.equal(h.counters.writes,1);if(gate)assert.equal(gate.entries.length,1);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);}

for(const id of ['modal-cancel','modal-close'])for(const delayed of [false,true])for(const dismiss of ['modal-cancel','modal-close'])test(`${delayed?'delayed':'native'} one-shot ${id} restore fault independently repairs both dismissal buttons; dismiss via ${dismiss}`,async()=>{
 const ctx=prepare({delayed}),{h,before,session,gate}=ctx,fault=failRestore(h,id),operation=h.submit();
 if(gate){assert.equal(gate.entries.length,1);for(const name of ['modal-submit','modal-cancel','modal-close'])assert.equal(h.dom.ids.get(name).disabled,true);gate.entries[0].fulfill();}
 await operation;terminal(h);assert.equal(fault.faults,1);assert.ok(fault.attempts>=2,'A swallowed role-callback fault must be retried by caller-local terminal repair');assert.equal(h.api.modalSession,session);assert.equal(session.terminal,true);assert.equal(session.cancelled,true);
 assert.equal(h.dom.ids.get('modal-submit').disabled,true);assert.equal(h.dom.ids.get('modal-cancel').disabled,false);assert.equal(h.dom.ids.get('modal-close').disabled,false);assert.equal(h.counters.writes,1);assert.equal(h.persisted().revision,before.revision+1);same(h.persisted().route,[before.actual]);
 const saved=h.bytes();await unchangedAfterRetry(ctx,saved);clickEnabled(h,dismiss);assert.equal(ui(h).modalOpen,false);await unchangedAfterRetry(ctx,saved);gate?.restore();
});
for(const id of ['modal-cancel','modal-close'])test(`persistent ${id} restoration failure leaves other dismissal usable and never restores write authority`,async()=>{
 const ctx=prepare(),{h,gate,session}=ctx,fault=failRestore(h,id,{persistent:true}),operation=h.submit();gate.entries[0].fulfill();await operation;terminal(h);assert.ok(fault.faults>=2);assert.equal(fault.node.disabled,true,'Throwing setters leave disabled unchanged');assert.equal(session.cancelled,true);assert.equal(session.terminal,true);assert.equal(h.dom.ids.get('modal-submit').disabled,true);
 const other=id==='modal-cancel'?'modal-close':'modal-cancel';assert.equal(h.dom.ids.get(other).disabled,false,'Independent best-effort writes must reach the other dismissal');const saved=h.bytes();await unchangedAfterRetry(ctx,saved);clickEnabled(h,other);assert.equal(ui(h).modalOpen,false);await unchangedAfterRetry(ctx,saved);gate.restore();
});
test('persistent failure of both dismissal setters remains terminal, read-only and one-write',async()=>{
 const ctx=prepare(),{h,gate,session}=ctx,failures=['modal-cancel','modal-close'].map(id=>failRestore(h,id,{persistent:true})),operation=h.submit();gate.entries[0].fulfill();await operation;terminal(h);for(const fault of failures){assert.ok(fault.faults>=1);assert.equal(fault.node.disabled,true);}assert.equal(session.cancelled,true);assert.equal(session.terminal,true);assert.equal(h.dom.ids.get('modal-submit').disabled,true);const saved=h.bytes();await unchangedAfterRetry(ctx,saved);
 // Escape is an independent production dismissal path even if both physical
 // setters themselves remain broken. It must not reset the reload latch.
 let prevented=false;h.dom.ids.get('modal').dispatch('cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(ui(h).modalOpen,false);await unchangedAfterRetry(ctx,saved);gate.restore();
});

for(const trigger of ['modal-cancel','modal-close'])for(const replacement of ['newer dialog','newer chrome'])test(`${trigger} repair reentry into ${replacement} stops subsequent old-owner control writes`,async()=>{
 const ctx=prepare(),{h,gate,session}=ctx;let replaced=false,newSession=null,snapshot=null,newNodes=null,lateWrites=[];
 const fault=failRestore(h,trigger,{afterRestore(){
  if(replaced)return;replaced=true;
  if(replacement==='newer dialog'){
   const dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Newer terminal review','Retain new review and controls',null,'Unrelated',false);newSession=h.api.modalSession;
  }else{
   newNodes=Object.fromEntries(['modal-submit','modal-cancel','modal-close'].map(id=>{const old=h.dom.ids.get(id),next={...old,disabled:true};h.dom.ids.set(id,next);return [id,next];}));
  }
  // Distinct values make even a single stale assignment observable. Installing
  // observers only after the newer owner is fully constructed excludes its own
  // legitimate initial sync and counts exclusively resumed old cleanup.
  for(const id of ['modal-submit','modal-cancel','modal-close']){
   const node=h.dom.ids.get(id);let disabled=id!=='modal-submit';Object.defineProperty(node,'disabled',{configurable:true,get:()=>disabled,set(value){lateWrites.push({id,value});disabled=value;}});
  }
  snapshot={title:ui(h).modalTitle,body:h.dom.ids.get('modal-body').innerHTML,disabled:['modal-submit','modal-cancel','modal-close'].map(id=>h.dom.ids.get(id).disabled)};
 }}),operation=h.submit();gate.entries[0].fulfill();await operation;
 assert.equal(fault.faults,1);assert.equal(replaced,true);assert.deepEqual(lateWrites,[],'An old repair stops immediately when generation or captured chrome changes');assert.equal(ui(h).modalTitle,snapshot.title);assert.equal(h.dom.ids.get('modal-body').innerHTML,snapshot.body);same(['modal-submit','modal-cancel','modal-close'].map(id=>h.dom.ids.get(id).disabled),snapshot.disabled);
 if(replacement==='newer dialog'){assert.notEqual(newSession,session);assert.equal(h.api.modalSession,newSession);assert.equal(ui(h).modalOpen,true);}else for(const [id,node]of Object.entries(newNodes))assert.equal(h.dom.ids.get(id),node);
 assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(session.cancelled,true);assert.equal(session.terminal,true);noSuccess(h);const saved=h.bytes();await ctx.detached(h.event());assert.equal(h.bytes(),saved);assert.equal(h.counters.writes,1);assert.equal(gate.entries.length,1);gate.restore();
});

for(const id of ['modal-cancel','modal-close'])test(`retired Clear owner never repairs replacement ${id} after late saved failure`,async()=>{
 const ctx=prepare(),{h,gate,session}=ctx,operation=h.submit();gate.entries[0].write();const dialog=h.dom.ids.get('modal');dialog.close();dialog.dispatch('close');h.api.modal('Current read-only review','Do not restore old control ownership',null);const current=h.api.modalSession,old=h.dom.ids.get(id),replacement={...old,disabled:true};h.dom.ids.set(id,replacement);
 // A real role change legitimately synchronizes the CURRENT dialog. Keep that
 // callback intact and distinguish its writes from the retired caller's repair.
 let inCurrentRole=false,currentRoleWrites=0,oldRepairWrites=0,disabled=true;const onRole=h.store.onRole;h.store.onRole=function(...args){inCurrentRole=true;try{return onRole.apply(this,args);}finally{inCurrentRole=false;}};
 Object.defineProperty(replacement,'disabled',{configurable:true,get:()=>disabled,set(value){if(inCurrentRole)currentRoleWrites++;else oldRepairWrites++;disabled=value;}});gate.entries[0].fulfill();await operation;
 assert.ok(currentRoleWrites>0,'Current dialog receives the actual global read-only role notification');assert.equal(oldRepairWrites,0,'Retired Clear cannot repair replacement chrome');assert.equal(replacement.disabled,false,'Current read-only review retains its own usable dismissal');assert.equal(ui(h).modalTitle,'Current read-only review');assert.equal(h.dom.ids.get('modal-body').innerHTML,'Do not restore old control ownership');assert.equal(h.api.modalSession,current);assert.notEqual(current,session);assert.equal(h.dom.ids.get(id),replacement);assert.equal(h.store.reloadRequired,true);assert.equal(h.store.editable,false);assert.equal(h.counters.writes,1);const saved=h.bytes();await ctx.detached(h.event());assert.equal(h.bytes(),saved);assert.equal(gate.entries.length,1);gate.restore();
});

test('Clear location wrapping is caller-scoped and retains the complete accepted world name',async()=>{
 const h=setup();h.open();const name=h.api.state.worlds[h.api.state.actual].name,body=h.dom.ids.get('modal-body').innerHTML,css=await readFile(new URL('../style.css',import.meta.url),'utf8');
 assert.ok(body.includes(name),'No truncation of the accepted adversarial world name');assert.match(body,/<p class="clear-route-location">[\s\S]*?<strong>/);assert.match(css,/(?:^|\n)\.clear-route-location\s*\{[^}]*overflow-wrap:\s*anywhere/);
});
