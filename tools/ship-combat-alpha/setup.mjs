import {normalizeRecord,normalizeManualCondition,optionalName} from './ship-record.mjs';
// Setup data is independent of motion. No storage, I/O, dice or combat resolution.
export const MAX_SHIPS=10;
export const ROLES=Object.freeze(['captain','pilot','astrogator','sensors','engineer','gunner','medic','steward']);
export const RATINGS=Object.freeze({Green:1,Veteran:2,Elite:3});
const text=(v,label,max=60)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${label} must contain 1 to ${max} characters.`);return v.trim();};
const int=(v,label,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(`${label} must be a whole number from ${min} to ${max}.`);return v;};
const optional=(v,label,min,max)=>v===null||v===undefined?null:int(v,label,min,max);
export function normalizeTemplate(v){
 if(v==null)return null;
 if(!Number.isFinite(v.tons)||v.tons<=0||v.tons>400)throw Error('Ship displacement must be greater than zero and at most 400 tons.');
 return {name:text(v.name,'Design name'),tons:v.tons,thrust:int(v.thrust,'Design thrust',0,10000),hull:optional(v.hull,'Design hull',1,1000000),armour:optional(v.armour,'Armour',0,1000),record:normalizeRecord(v.record),notes:v.notes==null?'':String(v.notes).slice(0,240),source:v.source==null?null:{book:text(v.source.book,'Source book',100),page:int(v.source.page,'Printed page',1,1000),endPage:optional(v.source.endPage,'Last printed page',v.source.page,1000)}};
}
export function normalizeCrew(v={}){
 const mode=v.mode??'quick',rating=v.rating??'Green';
 if(!['quick','detailed'].includes(mode)||!Object.hasOwn(RATINGS,rating))throw Error('Choose a crew mode and Green, Veteran or Elite rating.');
 const overrides={},details={};
 for(const role of ROLES){
  overrides[role]=optional(v.overrides?.[role],role+' total override',-10,20);
  const d=v.details?.[role];details[role]=d==null?null:{name:optionalName(d.name),skillName:text(d.skillName,'Skill / specialty'),skill:int(d.skill,'Skill level',0,10),characteristicDM:int(d.characteristicDM,'Characteristic DM',-5,5)};
 }
 return {mode,rating,bonus:optional(v.bonus,'General crew contribution',-10,20),overrides,details};
}
export function normalizeSituational(v={}){return Object.fromEntries(ROLES.map(role=>[role,int(v[role]??0,role+' situational DM',-20,20)]));}
export function crewContribution(crew,role){
 if(!ROLES.includes(role))throw Error('Unknown crew role.');
 const c=normalizeCrew(crew);
 if(c.mode==='quick')return c.overrides[role]??c.bonus??RATINGS[c.rating];
 const d=c.details[role];return d?d.skill+d.characteristicDM:null;
}
export function normalizeCondition(v,template){
 const hull=optional(v?.hull,'Current hull',0,template?.hull??1000000);
 return {hull,...normalizeManualCondition(v,template?.record)};
}
