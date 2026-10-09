import {initial,validate} from './state.mjs?v=cargo-hex-20261009-22';
export const KEY='traveller-trade-route-calculator:v1';
const LOCK=KEY+':writer';
function serializedCampaign(next){
 validate(next);
 const raw=JSON.stringify(next),state=validate(JSON.parse(raw));
 return {raw,state};
}
export class Store{
 constructor(onChange,onRole){this.onChange=onChange;this.onRole=onRole;this.editable=false;this.release=null;this.acquisition=null;this.id=crypto.randomUUID();this.channel=typeof BroadcastChannel==='function'?new BroadcastChannel(KEY):null;this.channel?.addEventListener('message',e=>{if(e.data.type==='takeover'&&e.data.id!==this.id)this.yield();});window.addEventListener('storage',e=>{if(e.key===KEY){this.onChange(this.read());}if(e.key===KEY+':takeover'&&e.newValue!==this.id)this.yield();});}
 read(){const raw=localStorage.getItem(KEY);if(!raw)return initial();let s;try{s=JSON.parse(raw);}catch{throw Error('Saved data could not be read. Export the raw backup before resetting.');}return validate(s);}
 async acquire(takeover=false){
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
    this.editable=true;
    let state;
    try{state=this.read();this.recovery=false;}catch(error){this.recovery=true;this.recoveryMessage=error.message;state=initial();}
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
 save(next,expected){if(this.recovery)throw Error('Restore or reset the saved campaign before editing.');if(!this.editable)throw Error('This tab is read-only. Take over editing first.');const current=this.read();if(current.revision!==expected)throw Error('This preview is stale. Reload it before committing.');const saved=serializedCampaign(next);localStorage.setItem(KEY,saved.raw);this.onChange(saved.state);}
 backup(){const raw=localStorage.getItem(KEY)||JSON.stringify(initial());const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='traveller-campaign-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 replace(next,expected){next=structuredClone(validate(next));next.revision=expected+1;if(this.recovery){if(!this.editable)throw Error('Take over editing before restoring');const saved=serializedCampaign(next);localStorage.setItem(KEY,saved.raw);this.recovery=false;this.onChange(saved.state);this.onRole(true,'Editing in this tab');}else this.save(next,expected);}
}
