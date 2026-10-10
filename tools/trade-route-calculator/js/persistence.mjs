import {createDashboardBaseline,sameDashboardBaseline} from './dashboard-baseline.mjs?v=jump-completion-20261010-42';
import {initial,validate} from './state.mjs?v=jump-completion-20261010-42';
export const KEY='traveller-trade-route-calculator:v1';
const LOCK=KEY+':writer';
// Only the provider can distinguish a rejected write from failed publication.
// Keep errors thrown (including for synchronous callers), with their cause.
export class SaveNotCommittedError extends Error{
 constructor(cause){super(String(cause?.message??cause),{cause});this.name='SaveNotCommittedError';this.code='SAVE_NOT_COMMITTED';this.committed=false;}
}
export class SaveCommittedPublicationError extends Error{
 constructor(revision,cause){super('Saved revision '+revision+', but publication failed: '+String(cause?.message??cause),{cause});this.name='SaveCommittedPublicationError';this.code='SAVE_COMMITTED_PUBLICATION_FAILED';this.committed=true;this.revision=revision;}
}
function serializedCampaign(next){
 validate(next);
 const raw=JSON.stringify(next),state=validate(JSON.parse(raw));
 return {raw,state};
}
function saveWithBoundary(next,expected,saveToken,replacement){
  let saved;
  try{
   if(this.reloadRequired)throw Error('Reload this page before editing the campaign again.');
   if(this.recovery)throw Error('Restore or reset the saved campaign before editing.');
   if(!this.editable)throw Error('This tab is read-only. Take over editing first.');
   const current=this.read();if(current.revision!==expected)throw Error('This preview is stale. Reload it before committing.');
   if(!replacement&&current.dashboardBaseline&&!sameDashboardBaseline(current.dashboardBaseline,next.dashboardBaseline)&&!( !current.initialized&&next.initialized&&sameDashboardBaseline(next.dashboardBaseline,createDashboardBaseline(next,'opening')) ))throw Error('Dashboard starting point changed. Reopen this preview before committing.');
   saved=serializedCampaign(next);
   // localStorage.setItem is atomic: a throwing write leaves the old value.
   localStorage.setItem(KEY,saved.raw);
  }catch(cause){throw new SaveNotCommittedError(cause);}
  const revision=saved.state.revision;
  try{this.onChange(saved.state,{saveToken});}
  catch(cause){throw new SaveCommittedPublicationError(revision,cause);}
 }
export class Store{
 constructor(onChange,onRole){this.onChange=onChange;this.onRole=onRole;this.editable=false;this.release=null;this.acquisition=null;this.id=crypto.randomUUID();this.channel=typeof BroadcastChannel==='function'?new BroadcastChannel(KEY):null;this.channel?.addEventListener('message',e=>{if(e.data.type==='takeover'&&e.data.id!==this.id)this.yield();});window.addEventListener('storage',e=>{if(e.key===KEY){this.onChange(this.read());}if(e.key===KEY+':takeover'&&e.newValue!==this.id)this.yield();});}
 read(){const raw=localStorage.getItem(KEY);if(!raw)return initial();let s;try{s=JSON.parse(raw);}catch{throw Error('Saved data could not be read. Export the raw backup before resetting.');}return validate(s);}
 async acquire(takeover=false){
  if(this.reloadRequired){this.onRole(false,'Reload this page before editing the campaign again.');return;}
  // A request remains owned until its held lock is released. Repeated clicks
  // must not leave another request queued to steal editing back after yield.
  if(this.editable||this.acquisition)return;
  if(!navigator.locks){this.onRole(false,'This browser lacks safe editing locks. Use a current browser.');return;}
  const request={controller:new AbortController(),release:null};
  this.acquisition=request;
  const finish=()=>{if(this.acquisition===request){this.acquisition=null;this.editable=false;this.release=null;}};
  const failed=error=>{
   if(this.acquisition!==request)return;
   finish();
   // A rendering callback can also fail. Ownership must still fail closed.
   try{this.onRole(false,error.message);}catch(roleError){console.error('Could not display read-only status',roleError);}
  };
  try{
   if(takeover){this.channel?.postMessage({type:'takeover',id:this.id});localStorage.setItem(KEY+':takeover',this.id);}
   navigator.locks.request(LOCK,takeover?{signal:request.controller.signal}:{ifAvailable:true},async lock=>{
    if(this.acquisition!==request||request.controller.signal.aborted)return;
    if(!lock){this.onRole(false,'Read-only: campaign open in another tab.');return;}
    const held=new Promise(resolve=>{request.release=resolve;this.release=resolve;});
    let state;
    try{state=this.read();this.recovery=false;}catch(error){this.recovery=true;this.recoveryMessage=error.message;state=initial();}
    if(!this.recovery&&state.initialized&&!state.dashboardBaseline){
     // Granted lock, no published editor or drafts yet. This is metadata only:
     // keep the action revision, Undo trail and jump mulligan exactly as saved.
     // Preserve legacy fields verbatim; validate a clone so normalization does
     // not turn this one-time snapshot into an unrelated campaign migration.
     const raw=localStorage.getItem(KEY),next=JSON.parse(raw);
     if(next.revision!==state.revision)throw Error('Campaign changed while starting Dashboard tracking. Reload to retry.');
     next.dashboardBaseline=createDashboardBaseline(state);
     validate(structuredClone(next));
     localStorage.setItem(KEY,JSON.stringify(next));
     state=validate(next);
    }
    this.editable=true;
    this.onChange(state);
    if(this.acquisition!==request)return;
    this.onRole(true,this.recovery?'Recovery mode: restore saved data':'Editing in this tab');
    await held;
   }).catch(failed).finally(finish);
  }catch(error){failed(error);}
 }
 yield(){
  const request=this.acquisition;
  this.acquisition=null;this.editable=false;this.release=null;
  request?.controller.abort();
  request?.release?.();
  this.onRole(false,'Read-only: editing transferred to another tab.');
 }
 save(next,expected,saveToken){return saveWithBoundary.call(this,next,expected,saveToken,false);}

 backup(){const raw=localStorage.getItem(KEY)||JSON.stringify(initial());const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='traveller-campaign-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 replace(next,expected){
  let saved;
  try{
   if(this.reloadRequired)throw Error('Reload this page before editing the campaign again.');
   next=structuredClone(validate(next));next.revision=expected+1;
   if(next.initialized&&!next.dashboardBaseline)next.dashboardBaseline=createDashboardBaseline(next);
   if(this.recovery){
    if(!this.editable)throw Error('Take over editing before restoring');
    saved=serializedCampaign(next);localStorage.setItem(KEY,saved.raw);
   }
  }catch(cause){throw new SaveNotCommittedError(cause);}
  if(!saved)return saveWithBoundary.call(this,next,expected,undefined,true);
  this.recovery=false;
  const revision=saved.state.revision;
  try{this.onChange(saved.state);this.onRole(true,'Editing in this tab');}
  catch(cause){throw new SaveCommittedPublicationError(revision,cause);}
 }
}
