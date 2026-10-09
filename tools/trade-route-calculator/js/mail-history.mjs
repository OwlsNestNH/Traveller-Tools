import {cmp,credit} from './amounts.mjs';
// Mail results are immutable history. Only this reference is replaced; session
// offers are never reconstructed here, including after reload, import or Undo.
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_,.:-]{1,100}$/.test(value);
const auditLabel=event=>['Mail check audit','Contract search audit'].includes(event?.label);
const scalar=value=>value==null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value);
const fields=(value,keys)=>value==null||record(value)&&keys.every(key=>scalar(value[key]));
const roll=value=>fields(value,['total','manual'])&&(value?.dice==null||Array.isArray(value.dice)&&value.dice.every(n=>typeof n==='number'&&Number.isFinite(n)));
function readableAudit(a){
 if(!record(a)||!fields(a,['manual','reason','distance','searchSkill','searchCharacteristic','modifierTotal','total'])||!['searchDice','dice','count'].every(key=>roll(a[key]))||!fields(a.modifiers,['freight','armed','lowTech','rank','soc'])||!fields(a.dm,['origin','destination','distance','effect','total']))return false;
 for(const [value,keys]of [[a.worldInputs,['name','population','starport','techLevel','zone']],[a.dm?.components,['population','starport','techLevel','zone']]])if(value!=null&&(!record(value)||!['origin','destination'].every(key=>fields(value[key],keys))))return false;
 return true;
}
function isCheck(event){
 if(!auditLabel(event)||!readableAudit(event.mailAudit)||!Array.isArray(event.offers)||!validId(event.world)||!validId(event.destination)||!roll(event.searchDice)||!roll(event.generatedSearchDice))return false;
 let mail=0;
 try{
  for(const offer of event.offers){
   if(!record(offer))return false;
   if(offer.kind==='mail'&&!(++mail===1&&['offerId','origin','destination'].every(key=>validId(offer[key]))&&['quantity','payment'].every(key=>['string','number'].includes(typeof offer[key]))&&cmp(offer.quantity,0)>0&&credit(offer.payment)>=0n))return false;
  }
  return true;
 }catch{return false;}
}
const actionLabel=event=>event.label==='Mail check audit'?'Mail check':'Contract search';

// Pair each saved check with its committing action, then replay Undo. Revision
// gaps are harmless for this read-only reference, but missing/mismatched actions
// and a surviving stack different from saved Undo cannot establish a latest.
function activeChecks(state,start=0){
 if(!Array.isArray(state.events)||!Array.isArray(state.undo))return null;
 const stack=[];let pending=[];
 for(const event of state.events.slice(start)){
  if(auditLabel(event)){pending.push(event);continue;}
  if(!Number.isSafeInteger(event.revision))continue;
  if(event.revision<1||typeof event.label!=='string')return null;
  if(event.label.startsWith('Undo: ')){
   if(pending.length||stack.at(-1)?.action.label!==event.label.slice(6))return null;
   stack.pop();
  }else{
   const check=['Mail check','Contract search'].includes(event.label);
   if(check&&(pending.length!==1||!isCheck(pending[0])||actionLabel(pending[0])!==event.label||pending[0].hours!==event.hours||pending[0].world!==event.world)||!check&&pending.length)return null;
   stack.push({action:event,check:check?pending[0]:null});
  }
  pending=[];
 }
 if(pending.length||stack.length>state.undo.length)return null;
 const saved=start===0?state.undo:state.undo.slice(state.undo.length-stack.length);
 if(stack.length!==saved.length||stack.some((entry,i)=>entry.action.label!==saved[i].label))return null;
 return stack.flatMap(entry=>entry.check?[entry.check]:[]);
}

export function latestMailCheck(state){
 if(!Array.isArray(state.events))return null;
 if(Object.hasOwn(state,'latestMailCheckId')){
  if(!validId(state.latestMailCheckId))return null;
  const index=state.events.findIndex(event=>event.id===state.latestMailCheckId&&isCheck(event));
  if(index<0)return null;
  // A new explicit reference remains usable even if an older imported prefix
  // is incomplete. Its own audit/action and retained Undo suffix must agree.
  const checks=activeChecks(state,index);
  return checks?.at(-1)?.id===state.latestMailCheckId?checks.at(-1):null;
 }
 return activeChecks(state)?.at(-1)||null;
}

export function recordMailCheck(state,event){
 if(!isCheck(event)||!validId(event.id)||state.events.some(saved=>saved.id===event.id))throw Error('Invalid Mail check audit');
 const previous=latestMailCheck(state),saved=structuredClone(event);
 // Caller-provided links must not override the actually current branch.
 delete saved.supersedesMailCheckId;
 if(previous)saved.supersedesMailCheckId=previous.id;
 state.events.push(saved);
 state.latestMailCheckId=saved.id;
 return saved;
}

export function mailCheckHistoryStatus(state,id){
 const latest=latestMailCheck(state);
 if(latest?.id===id)return {status:'latest'};
 const byId=new Map((state.events||[]).filter(isCheck).map(event=>[event.id,event])),seen=new Set();
 let current=latest;
 while(current?.supersedesMailCheckId&&!seen.has(current.id)){
  seen.add(current.id);
  if(current.supersedesMailCheckId===id)return {status:'superseded',supersededById:current.id};
  current=byId.get(current.supersedesMailCheckId);
 }
 return {status:'historical'};
}

export function validateMailHistory(state){
 const earlier=new Map();
 for(const event of state.events){
  if(Object.hasOwn(event,'supersedesMailCheckId')){
   if(!isCheck(event)||!validId(event.supersedesMailCheckId)||!earlier.has(event.supersedesMailCheckId))throw Error('Invalid Mail check supersession reference');
  }
  if(isCheck(event))earlier.set(event.id,event);
 }
 if(Object.hasOwn(state,'latestMailCheckId')&&state.latestMailCheckId!==null&&(!validId(state.latestMailCheckId)||!latestMailCheck(state)))throw Error('Invalid latest Mail check reference');
 return state;
}
