import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,KEY,SaveNotCommittedError} from '../js/persistence.mjs';
import {createCampaignController} from '../js/campaign-controller.mjs';
import {createDashboardBaseline} from '../js/dashboard-baseline.mjs';
import * as S from '../js/state.mjs';

function campaign(){
 const state=S.initial();state.initialized=true;state.bank='100000';state.actual='0,0';state.route=['0,0'];
 state.worlds={'0,0':{id:'0,0',x:0,y:0,name:'Origin',sector:'Test',hex:'0101',uwp:'A788899-C',zone:'Safe'}};
 return S.validate(state);
}
function harness(t,{recovery=false,consume=true}={}){
 const current=campaign();current.revision=7;
 const values=new Map([[KEY,recovery?'corrupt saved campaign':JSON.stringify(current)]]),notifications=[],roles=[];
 const hooks={beforePublish:null,afterPublish:null};let state=structuredClone(current),controller,writes=0,failWrite=false;
 const globals={window:{addEventListener(){}},BroadcastChannel:undefined,localStorage:{getItem:key=>values.get(key)??null,setItem(key,value){if(failWrite){failWrite=false;throw Error('Storage rejected replacement');}values.set(key,String(value));writes++;}}};
 const descriptors=Object.fromEntries(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true});
 t.after(()=>{for(const[key,descriptor]of Object.entries(descriptors)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 const store=new Store((next,metadata)=>{
  hooks.beforePublish?.(next,metadata);
  const notice={next,metadata,localSave:controller.isLocalSave(),local:controller.isLocalPublication(next,metadata),replacement:consume?controller.takeReplacementPublication(next,metadata):null};
  notifications.push(notice);state=next;hooks.afterPublish?.(notice);
 },(...args)=>roles.push(args));
 store.editable=true;store.recovery=recovery;
 controller=createCampaignController({getState:()=>state,getStore:()=>store,getKnownWorlds:()=>({}),getRounding:()=>[]});
 return {store,controller,hooks,notifications,roles,bytes:()=>values.get(KEY),writes:()=>writes,state:()=>state,failNext:()=>{failWrite=true;}};
}
function delayedReplacement(store){
 const native=store.replace,entries=[];
 store.replace=function(...args){
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  const entry={args,promise,write:()=>native.apply(store,args),resolve,reject};entries.push(entry);return promise;
 };
 return entries;
}

for(const recovery of [false,true])test(`replacement publishes separate ephemeral provenance, recovery=${recovery}`,t=>{
 const h=harness(t,{recovery}),candidate=campaign();candidate.revision=42;candidate.bank='76543';
 const original=structuredClone(candidate),tokenArguments=[],native=h.store.replace;
 h.store.replace=function(...args){tokenArguments.push(args[2]);return native.apply(this,args);};
 assert.equal(h.controller.replace(candidate,7),undefined);
 const notice=h.notifications.at(-1),token=tokenArguments[0];assert.ok(token);assert.equal(notice.metadata.replacementToken,token);
 assert.deepEqual(Object.keys(notice.metadata),['replacementToken']);assert.equal(notice.localSave,false);assert.equal(notice.local,false);assert.equal(notice.replacement,true);
 assert.equal(h.controller.isLocalSave(),false);assert.equal(h.controller.takeReplacementPublication(notice.next,notice.metadata),false);
 assert.equal(h.store.recovery,false);assert.equal(h.writes(),1);assert.equal(h.state().revision,8);assert.deepEqual(candidate,original);
 const expected={...original,revision:8,dashboardBaseline:createDashboardBaseline(original)};
 assert.equal(h.bytes(),JSON.stringify(expected));assert.deepEqual(h.store.read(),expected);
 if(recovery)assert.deepEqual(h.roles,[[true,'Editing in this tab']]);else assert.deepEqual(h.roles,[]);
});

for(const recovery of [false,true])test(`replacement rejects mismatched provenance without consuming its own publication, recovery=${recovery}`,t=>{
 const h=harness(t,{recovery}),candidate=campaign();candidate.revision=42;
 h.hooks.beforePublish=(next,metadata)=>{
  assert.equal(h.controller.takeReplacementPublication(next),false);
  assert.equal(h.controller.takeReplacementPublication(next,{replacementToken:{}}),false);
  assert.equal(h.controller.takeReplacementPublication(next,{saveToken:metadata.replacementToken}),false);
  assert.equal(h.controller.takeReplacementPublication({...next,revision:42},metadata),false);
  assert.equal(h.controller.takeReplacementPublication({...next,revision:7},metadata),false);
  assert.equal(h.controller.isLocalPublication(next,{saveToken:metadata.replacementToken}),false);
 };
 h.hooks.afterPublish=({next,metadata,replacement})=>{assert.equal(replacement,true);assert.equal(h.controller.takeReplacementPublication(next,metadata),false);};
 h.controller.replace(candidate,7);assert.equal(h.notifications.length,1);
});

test('ordinary-save and replacement token namespaces cannot classify one another',t=>{
 const h=harness(t);
 h.hooks.beforePublish=(next,metadata)=>{
  assert.ok(metadata.saveToken);assert.equal(h.controller.takeReplacementPublication(next,{replacementToken:metadata.saveToken}),false);
 };
 h.controller.transition('Synthetic deposit',next=>S.deposit(next,10,'Token isolation'),7);
 const notice=h.notifications.at(-1);assert.equal(notice.localSave,true);assert.equal(notice.local,true);assert.equal(notice.replacement,false);
 assert.deepEqual(Object.keys(notice.metadata),['saveToken']);assert.equal(h.controller.isLocalSave(),false);
});

for(const asynchronous of [false,true])for(const recovery of [false,true])test(`replacement preserves raw provider completion and pending ownership, async=${asynchronous}, recovery=${recovery}`,async t=>{
 const h=harness(t,{recovery}),candidate=campaign(),sentinel={provider:'replacement completion'};candidate.revision=99;
 let completion;
 if(asynchronous){
  const entries=delayedReplacement(h.store);completion=h.controller.replace(candidate,7);
  assert.equal(typeof completion.then,'function');assert.equal(h.controller.isLocalSave(),false);assert.equal(h.writes(),0);
  assert.equal(entries.length,1);assert.notEqual(entries[0].args[0],candidate);candidate.bank='1';
  assert.equal(entries[0].args[0].bank,'100000');assert.equal(entries[0].args[1],7);assert.ok(entries[0].args[2]);
  assert.throws(()=>h.controller.replace(campaign(),7),error=>error.code==='SAVE_NOT_COMMITTED'&&/current campaign save/.test(error.message));
  entries[0].write();assert.equal(h.notifications.at(-1).replacement,true);assert.equal(h.state().revision,8);
  assert.throws(()=>h.controller.transition('Competing change',()=>{},8),/current campaign save/);
  entries[0].resolve(sentinel);assert.equal(await completion,sentinel);
 }else{
  const native=h.store.replace;h.store.replace=function(...args){native.apply(this,args);return sentinel;};
  completion=h.controller.replace(candidate,7);assert.equal(completion,sentinel);
 }
 assert.equal(h.writes(),1);assert.equal(h.store.read().bank,'100000');assert.equal(h.controller.isLocalSave(),false);
 // A later write proves settlement released the controller's pending owner.
 h.controller.transition('After replacement',next=>S.deposit(next,1,'Released owner'),8);assert.equal(h.state().revision,9);
});

for(const asynchronous of [false,true])test(`successful completion retires an unconsumed replacement token, async=${asynchronous}`,async t=>{
 const h=harness(t,{consume:false});let result;
 if(asynchronous){const entries=delayedReplacement(h.store);result=h.controller.replace(campaign(),7);entries[0].write();entries[0].resolve();await result;}
 else result=h.controller.replace(campaign(),7);
 assert.equal(!!result&&typeof result.then==='function',asynchronous);const {next,metadata}=h.notifications.at(-1);
 assert.equal(h.controller.takeReplacementPublication(next,metadata),false);assert.equal(h.controller.isLocalPublication(next,{saveToken:metadata.replacementToken}),false);
});

for(const recovery of [false,true])test(`synchronous write failure retires token, preserves bytes and permits a new token on retry, recovery=${recovery}`,t=>{
 const h=harness(t,{recovery}),raw=h.bytes(),tokens=[],native=h.store.replace;
 h.store.replace=function(...args){tokens.push(args[2]);return native.apply(this,args);};h.failNext();
 assert.throws(()=>h.controller.replace(campaign(),7),error=>error.code==='SAVE_NOT_COMMITTED'&&error.committed===false);
 assert.equal(h.bytes(),raw);assert.equal(h.store.recovery,recovery);assert.equal(h.notifications.length,0);
 assert.equal(h.controller.takeReplacementPublication({revision:8},{replacementToken:tokens[0]}),false);
 h.hooks.beforePublish=(next,metadata)=>{assert.notEqual(metadata.replacementToken,tokens[0]);assert.equal(h.controller.takeReplacementPublication(next,{replacementToken:tokens[0]}),false);};
 h.controller.replace(campaign(),7);assert.equal(h.writes(),1);assert.equal(h.notifications.at(-1).replacement,true);
});

for(const error of [new SaveNotCommittedError(Error('Known rejection')),Error('Unknown provider result')])test(`delayed ${error.code||'unknown'} rejection retires its token`,async t=>{
 const h=harness(t),raw=h.bytes(),entries=delayedReplacement(h.store),completion=h.controller.replace(campaign(),7),first=entries[0];
 first.reject(error);await assert.rejects(completion,cause=>cause===error);
 assert.equal(h.bytes(),raw);assert.equal(h.controller.takeReplacementPublication({revision:8},{replacementToken:first.args[2]}),false);
 const retried=h.controller.replace(campaign(),7);assert.notEqual(entries[1].args[2],first.args[2]);entries[1].write();entries[1].resolve();await retried;
 assert.equal(h.writes(),1);assert.equal(h.notifications.at(-1).replacement,true);
});

for(const recovery of [false,true])for(const asynchronous of [false,true])test(`committed publication failure preserves saved replacement and retires token, recovery=${recovery}, async=${asynchronous}`,async t=>{
 const h=harness(t,{recovery,consume:false});let token;
 h.hooks.beforePublish=(next,metadata)=>{token=metadata.replacementToken;throw Error('Publication failed');};
 const check=error=>error.code==='SAVE_COMMITTED_PUBLICATION_FAILED'&&error.committed===true&&error.revision===8;
 if(asynchronous){const entries=delayedReplacement(h.store),completion=h.controller.replace(campaign(),7);try{entries[0].write();assert.fail('Expected publication failure');}catch(error){entries[0].reject(error);}await assert.rejects(completion,check);}
 else assert.throws(()=>h.controller.replace(campaign(),7),check);
 assert.ok(token);assert.equal(h.writes(),1);assert.equal(h.store.read().revision,8);assert.equal(h.store.recovery,false);
 assert.equal(h.controller.takeReplacementPublication({revision:8},{replacementToken:token}),false);assert.equal(h.controller.isLocalSave(),false);
});

test('recovery role-notification failure retains durable classification and retires provenance',t=>{
 const h=harness(t,{recovery:true,consume:false});h.store.onRole=()=>{throw Error('Role publication failed');};
 assert.throws(()=>h.controller.replace(campaign(),7),error=>error.code==='SAVE_COMMITTED_PUBLICATION_FAILED'&&error.revision===8);
 assert.equal(h.writes(),1);assert.equal(h.store.recovery,false);const {next,metadata}=h.notifications.at(-1);
 assert.equal(h.controller.takeReplacementPublication(next,metadata),false);assert.equal(h.store.read().revision,8);
});

for(const recovery of [false,true])test(`legacy tokenless Store.replace remains synchronous and replacement metadata stays external, recovery=${recovery}`,t=>{
 const h=harness(t,{recovery});assert.equal(h.store.replace(campaign(),7),undefined);
 const notice=h.notifications.at(-1);assert.equal(notice.metadata.replacementToken,undefined);assert.equal(notice.local,false);assert.equal(notice.replacement,false);assert.equal(notice.next.revision,8);
});

test('invalid replacement revision arithmetic cannot strand the pending controller owner',t=>{
 const h=harness(t),raw=h.bytes();
 for(const expected of [7n,Symbol('invalid revision')])assert.throws(()=>h.controller.replace(campaign(),expected),error=>error.code==='SAVE_NOT_COMMITTED'&&error.committed===false);
 assert.equal(h.bytes(),raw);assert.equal(h.writes(),0);h.controller.replace(campaign(),7);assert.equal(h.state().revision,8);
});
