import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {harness,campaign,S,same} from './app-harness.mjs';
export {campaign,S,same};

// Execute the actual Store with isolated browser storage. Hooks sit immediately
// around real setItem and real receiveCampaign; no write logic is reproduced.
const persistenceURL=new URL('../js/persistence.mjs',import.meta.url);
const source=await readFile(persistenceURL,'utf8'),imports={};
for(const[,names,path]of source.matchAll(/^import (.+) from '([^']+)';$/gm)){
 const module=await import(new URL(path,persistenceURL));
 if(names.startsWith('* as '))imports[names.slice(5)]=module;
 else for(const name of names.slice(1,-1).split(','))imports[name.trim()]=module[name.trim()];
}
const executable=source.replace(/^import .*;\n/gm,'').replaceAll('export ','');
export function depositHarness(saved=campaign()){
 const h=harness(saved),values=new Map(),trace=[],roles=[],notifications=[];
 const hooks={beforeWrite:null,afterWrite:null,beforeNotify:null,afterNotify:null,onRole:null};
 const counters={attempts:0,writes:0,notifications:0};let failCount=0;
 const localStorage={getItem:key=>values.get(key)??null,setItem(key,value){
  counters.attempts++;trace.push({stage:'before-write',...ui(h)});hooks.beforeWrite?.();
  if(failCount){failCount--;throw Error('Synthetic localStorage quota failure');}
  values.set(key,String(value));counters.writes++;trace.push({stage:'durable-write',...ui(h)});hooks.afterWrite?.();
 }};
 const browserListeners=new Map();
 const {Store,KEY}=vm.runInNewContext(executable+'\n({Store,KEY});',{...imports,localStorage,crypto:webcrypto,structuredClone,console,window:{addEventListener(name,callback){browserListeners.set(name,callback);}}},{filename:'actual persistence.mjs (isolated storage)'});
 values.set(KEY,JSON.stringify(saved));
 const store=new Store((next,metadata)=>{
  counters.notifications++;notifications.push({next,metadata,local:h.api.controller.isLocalSave()});
  hooks.beforeNotify?.(next,metadata);h.api.setState(next,metadata);hooks.afterNotify?.(next,metadata);trace.push({stage:'published',...ui(h)});
 },(...args)=>{roles.push(args);hooks.onRole?.(...args);h.api.syncModalSubmit();h.api.render();});
 store.editable=true;h.api.setStore(store);
 return {...h,store,hooks,counters,trace,roles,notifications,bytes:()=>values.get(KEY),persisted:()=>JSON.parse(values.get(KEY)),failNext:(n=1)=>{failCount=n;},
  external(next,{publish=true}={}){values.set(KEY,JSON.stringify(next));if(publish)browserListeners.get('storage')({key:KEY});},
  runAction:(name,arg)=>h.api.safely(h.api.actions[name])(arg)};
}
export function ui(h){return {message:h.dom.ids.get('message').textContent,modalTitle:h.dom.ids.get('modal-title').textContent,modalOpen:h.dom.ids.get('modal').open,modalError:h.dom.ids.get('modal-error').textContent,submitDisabled:h.dom.ids.get('modal-submit').disabled,stateRevision:h.api.state.revision,stateBank:h.api.state.bank,selected:[...h.api.selected],draftCount:h.api.drafts.length,view:h.api.view};}
export async function prepareDeposit(h,amount='10.1'){
 h.api.actions.deposit();h.fill({amount,reason:'Synthetic deposit completion check'});await h.submit();
 assert.equal(ui(h).modalTitle,'Confirm deposit');assert.equal(ui(h).modalError,'');
}
export function deferredSave(store){
 const original=store.save,pending=[],observed=[];
 store.save=function(...args){
  let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
  const entry={args,promise,settled:false,
   resolve(){assert.equal(this.settled,false);this.settled=true;try{resolve(original.apply(store,args));}catch(error){reject(error);}},
   reject(error=Error('Unclassified delayed provider failure')){assert.equal(this.settled,false);this.settled=true;reject(error);}
  };
  // Observe the original rejection before exposing the same Promise to the app.
  // This prevents test-induced unhandled events without changing its outcome.
  promise.catch(error=>observed.push(error));pending.push(entry);return promise;
 };
 return {pending,observed,restore(){store.save=original;}};
}
export const flush=()=>new Promise(resolve=>setImmediate(resolve));
