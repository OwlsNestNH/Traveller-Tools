import {outcomeTagline} from './outcome-taglines.mjs';

// Presentation classification from Aliens of Charted Space Volume 1 Update 2026,
// p. 19 (engine/aslan-skill-culture.mjs). These are cultural associations, not
// eligibility restrictions. Keep this independent of engine imports for HTTP UI.
export const ASLAN_TAGLINE_SOURCE=Object.freeze({id:'aliens',page:19});
export function femaleAssociatedSkill(name){
 if(typeof name!=='string')return false;
 const match=/^([^()]+?)(?: \(([^()]+)\))?$/.exec(name);if(!match)return false;
 const [,base,subject]=match;
 return ['Astrogation','Broker','Engineer','Mechanic','Profession','Science','Steward'].includes(base)
  ||base==='Animals'&&subject==='veterinary'
  ||base==='Electronics'&&['comms','computers','remote ops'].includes(subject);
}
export function maleAslanIdentity(state){
 const c=state?.character;if(c?.species!=='aslan')return false;
 // Explicit identity takes precedence over a referee-selected rules branch.
 // An unspecified identity that actually rolled male still qualifies.
 const identity=c.identityGender||c.aslanOrigin?.identityGender||c.gender;
 return identity==='male';
}
const gains=event=>(event?.changes??[]).filter(c=>c.path?.startsWith('skills.')&&femaleAssociatedSkill(c.path.slice(7))&&Number.isInteger(c.after)&&c.after>=0&&(c.before===null||Number.isInteger(c.before)&&c.after>c.before));
const choices=new Set(['choose-skill','choose-effect']);
function trainingOrigin(origin){
 // This marker is generated only by native training and its replacement roll.
 return typeof origin?.careerId==='string'&&origin.careerId.length>0&&typeof origin.assignment==='string'&&typeof origin.table==='string'&&origin.table.length>0&&Number.isInteger(origin.result)&&origin.result>=1&&origin.result<=9;
}
const sameSkill=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.trim().toLowerCase()===b.trim().toLowerCase();
function selectedSkillEffects(effects){
 // Only explicitly selected, marked skill effects, never an unchosen option or
 // an unrelated award resumed later by the engine's continuation queue.
 return (effects??[]).flatMap(e=>e.kind==='skill'&&trainingOrigin(e.psionicOrigin)?[e.name]:[]);
}
export function aslanTrainingTagline(event,state,{previousState,command}={}){
 if(!maleAslanIdentity(state)||!event?.id)return null;
 const awards=gains(event);if(!awards.length)return null;
 if(event.type==='training')return outcomeTagline('aslan.training.female-associated',event.id);
 if(!choices.has(event.type)||command?.type!==event.type)return null;
 const pending=previousState?.pendingChoice;
 if(!trainingOrigin(pending?.psionicOrigin))return null;
 let names=[];
 if(event.type==='choose-skill'&&previousState.stage==='skill-choice'&&pending.kind==='skill-choice'){
  // The verified log names the engine-normalized selection (e.g. Engineer
  // (power plant) becomes Engineer (power)); do not duplicate skill aliases.
  const selected=/^Selected (.{1,80}) for a skill award\./.exec(event.summary??'')?.[1];
  names=[selected??command.payload?.name];
 }
 if(event.type==='choose-effect'&&previousState.stage==='effect-choice'&&Number.isInteger(command.payload?.index))names=selectedSkillEffects(pending.options?.[command.payload.index]?.effects);
 if(!awards.some(c=>names.some(name=>sameSkill(name,c.path.slice(7)))))return null;
 return outcomeTagline('aslan.training.female-associated',event.id);
}

export async function restoredAslanTrainingTagline(session,projection,call){
 const event=projection?.log?.at(-1),state=projection?.state,record=session?.events?.at(-1);
 if(!maleAslanIdentity(state)||!gains(event).length)return null;
 if(event.type==='training')return aslanTrainingTagline(event,state);
 if(!choices.has(event.type)||record?.id!==event.id)return null;
 try{
  // Recover provenance with the existing read-only API. No saved presentation
  // fields, commands, rolls or browser engine imports are added by this lookup.
  const before=await call({operation:'project',session:{...session,events:session.events.slice(0,-1)}});
  if(!before.ok)return null;
  return aslanTrainingTagline(event,state,{previousState:before.state,command:record.command});
 }catch{return null;} // Missing provenance must never obstruct a valid save.
}
