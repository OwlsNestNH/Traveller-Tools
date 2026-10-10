import {parseUWP} from './rules.mjs?v=dashboard-20261010-41';

// Audit only the editable world fields. A selective correction must never
// replay an old world object, campaign inverse, price quote or transaction.
export const WORLD_UWP_FIELDS=Object.freeze({starport:0,size:1,atmosphere:2,hydrographics:3,population:4,government:5,law:6,techLevel:8});
export const WORLD_FIELD_LABELS=Object.freeze({starport:'Starport',size:'Size',atmosphere:'Atmosphere',hydrographics:'Hydrographics',population:'Population',government:'Government',law:'Law level',techLevel:'Tech level',zone:'Travel zone',fuelOverride:'Fuel availability',accessibleWater:'Accessible water'});
const storedFields=['overrideUWP','zone','fuelOverride','accessibleWater'];
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(object,key)=>Object.hasOwn(object,key);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_,.:-]{1,100}$/.test(value);
const slot=(object,key)=>own(object,key)&&object[key]!==undefined?{present:true,value:object[key]}:{present:false};
const effective=s=>s.overrideUWP.present&&s.overrideUWP.value?s.overrideUWP.value:s.publishedUWP;
const supported=e=>e?.worldChangeAudit?.version===1;
export const isWorldChangeAudit=supported;
export function worldOverrideSnapshot(world){return {publishedUWP:world.uwp,...Object.fromEntries(storedFields.map(key=>[key,slot(world,key)]))};}
function semantic(snapshot,key){
 if(own(WORLD_UWP_FIELDS,key))return effective(snapshot)?.[WORLD_UWP_FIELDS[key]];
 const saved=snapshot[key];
 return key==='fuelOverride'?saved.present&&typeof saved.value==='boolean'?saved.value:null:key==='accessibleWater'?saved.present&&saved.value===true:saved.value;
}
function readableUWP(value){return typeof value==='string'&&/^[ABCDEFGHXY?][0-9A-Z?]{6}-[0-9A-Z?]$/.test(value);}
export function worldChangeFields(event){
 if(!supported(event))return [];
 const {before,after}=event.worldChangeAudit;if(!record(before)||!record(after))return [];
 return Object.keys(WORLD_FIELD_LABELS).filter(key=>!own(WORLD_UWP_FIELDS,key)||readableUWP(effective(before))&&readableUWP(effective(after))).flatMap(key=>{
  const previous=semantic(before,key),next=semantic(after,key);
  return previous===next?[]:[{key,label:WORLD_FIELD_LABELS[key],before:previous,after:next}];
 });
}
export function worldFieldValue(key,value){
 if(key==='fuelOverride')return value===true?'Referee: available':value===false?'Referee: unavailable':'Automatic facilities / scoops';
 if(key==='accessibleWater')return value?'Yes':'No';
 return value==null?'Not recorded':String(value);
}
function appendAudit(state,world,before,reason,extra={}){
 const event={id:crypto.randomUUID(),label:'World change audit',hours:state.hours,world:world.id,reason,
  worldChangeAudit:{version:1,kind:'edit',committedRevision:state.revision+1,worldId:world.id,worldName:world.name,sector:world.sector,hex:world.hex,before,after:worldOverrideSnapshot(world),...extra}};
 state.events.push(event);return event;
}
export function recordWorldOverride(state,worldId,values,data){
 const world=state.worlds[worldId];if(!world||world.emptySpace)throw Error('Choose a saved world before editing its values.');
 const uwp=String(values.uwp).trim().toUpperCase();parseUWP(uwp,data);
 const reason=String(values.reason||'').trim();if(!reason)throw Error('Reason required');
 if(!['Safe','Amber','Red'].includes(values.zone)||![true,false,null].includes(values.fuelOverride)||typeof values.accessibleWater!=='boolean')throw Error('Invalid world override values.');
 const before=worldOverrideSnapshot(world);
 Object.assign(world,{overrideUWP:uwp,zone:values.zone,fuelOverride:values.fuelOverride,accessibleWater:values.accessibleWater,overrideReason:reason});
 return appendAudit(state,world,before,reason);
}
function restoreSlot(world,key,saved){if(saved.present)world[key]=saved.value;else delete world[key];}
function revertedWorld(world,audit,key){
 const result=structuredClone(world);
 if(own(WORLD_UWP_FIELDS,key)){
  const chars=[...(result.overrideUWP||result.uwp)];chars[WORLD_UWP_FIELDS[key]]=semantic(audit.before,key);
  const uwp=chars.join('');
  // Removing the old override is safe only if no other component still differs.
  if(!audit.before.overrideUWP.present&&uwp===result.uwp)delete result.overrideUWP;
  else result.overrideUWP=uwp;
 }else restoreSlot(result,key,audit.before[key]);
 return result;
}
export function worldFieldRevertEligibility(state,eventId,key,data){
 const event=state.events.find(e=>e.id===eventId),audit=event?.worldChangeAudit;
 if(!supported(event))return {allowed:false,reason:'This older entry has no complete world-change audit. Edit the selected world using World override instead.'};
 const change=worldChangeFields(event).find(change=>change.key===key);
 if(!change)return {allowed:false,reason:'This field has no recorded before-and-after change.'};
 const world=state.worlds[audit.worldId];if(!world)return {allowed:false,reason:'This world is no longer in the current campaign.',change};
 const position=state.undo.findIndex(entry=>entry.worldChangeEventId===eventId);
 if(position<0)return {allowed:false,reason:'This action was already undone or its retained Undo record is unavailable.',change};
 for(const entry of state.undo.slice(position+1)){
  const later=state.events.find(e=>e.id===entry.worldChangeEventId);
  if(!supported(later)){
   if(entry.label==='World override'||entry.label==='World field reverted')return {allowed:false,reason:'A later world edit has incomplete history. Its values cannot safely be overwritten.',change};
   continue;
  }
  if(later.worldChangeAudit.worldId===audit.worldId&&worldChangeFields(later).some(c=>c.key===key))return {allowed:false,reason:'A later change already updated this field. Review that newer entry first.',change};
 }
 if(semantic(worldOverrideSnapshot(world),key)!==change.after)return {allowed:false,reason:'The current field no longer matches this entry. Reopen History to review its latest value.',change};
 const next=revertedWorld(world,audit,key);
 if(own(WORLD_UWP_FIELDS,key))try{parseUWP(next.overrideUWP||next.uwp,data);}catch{return {allowed:false,reason:'The recorded previous UWP value cannot safely be restored. Edit World override instead.',change};}
 return {allowed:true,reason:'Restore the recorded previous value only. This may itself be an earlier override, not the published default.',change,world,next};
}
export function revertWorldField(state,eventId,key,data){
 const eligible=worldFieldRevertEligibility(state,eventId,key,data);if(!eligible.allowed)throw Error(eligible.reason);
 const {world,next,change}=eligible,before=worldOverrideSnapshot(world),reason='Restored previous '+change.label.toLowerCase()+' from History';
 // Copy only the requested override field; preserve all unrelated live fields.
 const property=own(WORLD_UWP_FIELDS,key)?'overrideUWP':key;
 restoreSlot(world,property,slot(next,property));world.overrideReason=reason;
 return appendAudit(state,world,before,reason,{kind:'revert',sourceEventId:eventId,field:key});
}
function validateSnapshot(snapshot){
 if(!record(snapshot)||typeof snapshot.publishedUWP!=='string')throw Error('Invalid world-change snapshot');
 for(const key of storedFields){
  const saved=snapshot[key];if(!record(saved)||typeof saved.present!=='boolean'||saved.present!==own(saved,'value'))throw Error('Invalid world-change field');
  if(!saved.present)continue;
  if(key==='overrideUWP'&&typeof saved.value!=='string'||key==='zone'&&!['Safe','Amber','Red'].includes(saved.value)||key==='fuelOverride'&&![true,false,null].includes(saved.value)||key==='accessibleWater'&&typeof saved.value!=='boolean')throw Error('Invalid world-change field value');
 }
}
export function validateWorldChangeHistory(state){
 // No migration: unrelated/legacy history and unsupported future audit
 // versions stay readable, but never become selective-revert evidence.
 const audits=new Map();
 for(const event of state.events){
  if(!supported(event))continue;
  const audit=event.worldChangeAudit;
  if(event.label!=='World change audit'||event.revision!==undefined||!id(audit.worldId)||event.world!==audit.worldId||typeof audit.worldName!=='string'||typeof audit.sector!=='string'||!/^\d{4}$/.test(audit.hex)||!['edit','revert'].includes(audit.kind)||!Number.isSafeInteger(audit.committedRevision)||audit.committedRevision<1||typeof event.reason!=='string'||!event.reason.trim())throw Error('Invalid world-change audit');
  validateSnapshot(audit.before);validateSnapshot(audit.after);
  if(audit.before.publishedUWP!==audit.after.publishedUWP)throw Error('World corrections cannot change published UWP');
  if(audit.kind==='revert'){
   const source=audits.get(audit.sourceEventId),field=worldChangeFields(event),original=worldChangeFields(source).find(c=>c.key===audit.field);
   if(!source||source.worldChangeAudit.worldId!==audit.worldId||!original||field.length!==1||field[0].key!==audit.field||field[0].before!==original.after||field[0].after!==original.before)throw Error('Invalid world-change revert audit');
  }
  audits.set(event.id,event);
 }
 const linked=new Set(),summaries=new Map();
 for(const entry of state.undo){
  if(entry.worldChangeEventId===undefined)continue;
  if(!id(entry.worldChangeEventId)||!audits.has(entry.worldChangeEventId)||linked.has(entry.worldChangeEventId))throw Error('Invalid world-change Undo reference');
  const audit=audits.get(entry.worldChangeEventId).worldChangeAudit;
  if(entry.label!==(audit.kind==='edit'?'World override':'World field reverted'))throw Error('Invalid world-change action label');
  linked.add(entry.worldChangeEventId);
 }
 for(const [index,event]of state.events.entries()){
  if(event.worldChangeEventId===undefined)continue;
  const source=audits.get(event.worldChangeEventId),audit=source?.worldChangeAudit;
  if(!source||summaries.has(source.id)||event.label!==(audit.kind==='edit'?'World override':'World field reverted')||event.revision!==audit.committedRevision||event.hours!==source.hours||state.events.indexOf(source)>=index)throw Error('Invalid world-change action reference');
  const nextAction=state.events.slice(state.events.indexOf(source)+1).find(e=>Number.isSafeInteger(e.revision));
  if(nextAction!==event)throw Error('World-change audit is not paired with its action');
  summaries.set(source.id,{event,index});
 }
 if(summaries.size!==audits.size)throw Error('Missing world-change action summary');
 // Verify only the new, explicitly linked history suffix. Legacy prefixes may
 // be incomplete; they do not grant evidence and do not need to be rewritten.
 const start=Math.min(...[...summaries.values()].map(s=>s.index)),stack=[];
 for(const event of state.events.slice(start)){
  if(!Number.isSafeInteger(event.revision))continue;
  if(event.label.startsWith('Undo: ')){
   if(stack.length&&stack.at(-1).label!==event.label.slice(6))throw Error('World-change action and Undo history disagree');
   stack.pop();
  }else stack.push(event);
 }
 if(stack.length>state.undo.length)throw Error('World-change retained Undo history is incomplete');
 const suffix=stack.length?state.undo.slice(-stack.length):[];
 if(stack.some((event,index)=>event.label!==suffix[index].label||event.worldChangeEventId!==suffix[index].worldChangeEventId))throw Error('World-change retained Undo order does not match history');
 const active=new Set(stack.map(e=>e.worldChangeEventId).filter(Boolean));
 if(linked.size!==active.size||[...linked].some(reference=>!active.has(reference)))throw Error('World-change active references do not match history');
 return state;
}
