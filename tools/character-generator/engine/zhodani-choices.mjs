// Original constrained choices: Aliens of Charted Space Volume 1 Update 2026,
// printed pp.273 and 275. No random generation, missing-person invention or source prose.
import {normalizeSkillName} from './skills.mjs';
const need=(value,message)=>{if(!value)throw new Error(message);};
export function relationshipLossOptions(relationships){
 need(Array.isArray(relationships),'Relationship history is required.');
 return relationships.flatMap((entry,index)=>['Ally','Contact'].includes(entry?.role)?[{index,role:entry.role,name:entry.name}]:[]);
}
export function relationshipLoss(relationships,decision){
 const options=relationshipLossOptions(relationships);
 need(decision&&typeof decision==='object'&&!Array.isArray(decision),'A typed relationship decision is required.');
 if(options.length){
  need(Object.keys(decision).length===1&&Object.hasOwn(decision,'index'),'Select exactly one existing Ally or Contact.');
  const index=decision.index;need(Number.isInteger(index)&&options.some(o=>o.index===index),'Select an eligible relationship.');
  return {relationshipIndex:index,removed:structuredClone(relationships[index]),absent:false,reason:null,
   remaining:relationships.filter((_,i)=>i!==index).map(x=>structuredClone(x))};
 }
 need(Object.keys(decision).length===2&&decision.absent===true&&typeof decision.reason==='string'&&decision.reason.trim()&&decision.reason.length<=500,
  'No eligible Ally or Contact exists. Confirm the absent relationship with a referee reason.');
 return {relationshipIndex:null,removed:null,absent:true,reason:decision.reason.trim(),remaining:structuredClone(relationships)};
}
export function scienceSelectionKey(name){
 const parsed=normalizeSkillName(name,{requireSpeciality:true});need(parsed.base==='Science','Choose a Science specialisation.');
 return parsed.speciality.normalize('NFKC').replace(/\s+/g,' ').toLowerCase();
}
export function distinctScienceSelection(name,selected=[]){
 need(Array.isArray(selected),'Previous Science choices are invalid.');const key=scienceSelectionKey(name);
 need(!selected.some(previous=>scienceSelectionKey(previous)===key),'Choose a different Science specialisation.');
 return normalizeSkillName(name,{requireSpeciality:true}).name;
}
