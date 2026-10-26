import {synchronizeRoster} from './crew-roster.mjs';
import {validateInventoryFit} from './ammunition.mjs';
import {validateWeaponFits} from './weapon-fit.mjs';
import {normalizeRecord,normalizeManualCondition,optionalName} from './ship-record.mjs';
// Setup data is independent of motion. No storage, I/O, dice or combat resolution.
export const MAX_SHIPS=10;
export const ROLES=Object.freeze(['captain','pilot','astrogator','sensors','engineer','gunner','medic','steward']);
export const RATINGS=Object.freeze({Green:1,Regular:2,Veteran:3,Elite:4,Heroic:5});
const LEGACY_RATINGS=Object.freeze({Green:1,Veteran:2,Elite:3});
export const CREW_RATING_VERSION=2;
const text=(v,label,max=60)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${label} must contain 1 to ${max} characters.`);return v.trim();};
const int=(v,label,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(`${label} must be a whole number from ${min} to ${max}.`);return v;};
const optional=(v,label,min,max)=>v===null||v===undefined?null:int(v,label,min,max);
export function normalizeTemplate(v){
 if(v==null)return null;
 if(!Number.isFinite(v.tons)||v.tons<=0||v.tons>400)throw Error('Ship displacement must be greater than zero and at most 400 tons.');
 const result={name:text(v.name,'Design name'),tons:v.tons,thrust:int(v.thrust,'Design thrust',0,10000),hull:optional(v.hull,'Design hull',1,1000000),armour:optional(v.armour,'Armour',0,1000),record:normalizeRecord(v.record),notes:v.notes==null?'':String(v.notes).slice(0,240),source:v.source==null?null:{book:text(v.source.book,'Source book',100),page:int(v.source.page,'Printed page',1,1000),endPage:optional(v.source.endPage,'Last printed page',v.source.page,1000)}};validateWeaponFits(result);return result;
}
export function normalizeCrew(v={}){
 const mode=v.mode??'quick',rawRating=v.rating??'Green',version=v.ratingVersion??(Object.hasOwn(LEGACY_RATINGS,rawRating)?1:2);
 if(![1,2].includes(version)||!['quick','detailed','compact'].includes(mode)||!Object.hasOwn(version===1?LEGACY_RATINGS:RATINGS,rawRating))throw Error('Choose a valid crew mode and experience rating.');
 const rating=version===1?Object.keys(RATINGS).find(k=>RATINGS[k]===LEGACY_RATINGS[rawRating]):rawRating;
 const overrides={},details={};
 for(const role of ROLES){
  overrides[role]=optional(v.overrides?.[role],role+' total override',-10,20);
  const d=v.details?.[role];details[role]=d==null?null:{name:optionalName(d.name),skillName:text(d.skillName,'Skill / specialty'),skill:int(d.skill,'Skill level',0,10),characteristicDM:int(d.characteristicDM,'Characteristic DM',-5,5)};
 }
 const extra={};
 if(mode==='compact'||v.activeDetails!=null){
  if(!Array.isArray(v.activeDetails)||v.activeDetails.some(r=>!ROLES.includes(r)))throw Error('Choose valid detailed roles.');
  extra.activeDetails=[...new Set(v.activeDetails)];
 }
 if(v.gunnerStations!=null){
  if(!Array.isArray(v.gunnerStations)||v.gunnerStations.length>32)throw Error('Record at most 32 gunner stations.');
  extra.gunnerStations=v.gunnerStations.map(d=>{if(!/^[-a-z0-9]{1,32}$/.test(d.mountId))throw Error('Choose a valid weapon mount ID.');return {mountId:d.mountId,name:optionalName(d.name),skillName:text(d.skillName,'Skill / specialty'),skill:int(d.skill,'Skill level',0,10),characteristicDM:int(d.characteristicDM,'Other modifier',-5,5)};});
  if(new Set(extra.gunnerStations.map(d=>d.mountId)).size!==extra.gunnerStations.length)throw Error('Gunner stations must have unique mount IDs.');
 }
 return synchronizeRoster({mode,rating,ratingVersion:CREW_RATING_VERSION,bonus:optional(v.bonus,'General crew contribution',-10,20),overrides,details,...extra,...(v.roster==null?{}:{roster:v.roster})},ROLES);
}
export function normalizeSituational(v={}){return Object.fromEntries(ROLES.map(role=>[role,int(v[role]??0,role+' situational DM',-20,20)]));}
export function crewContribution(crew,role){
 if(!ROLES.includes(role))throw Error('Unknown crew role.');
 const c=normalizeCrew(crew);
 if(c.mode==='quick'||c.mode==='compact'&&!c.activeDetails.includes(role))return c.overrides[role]??c.bonus??RATINGS[c.rating];
 const d=c.details[role];return d?d.skill+d.characteristicDM:c.mode==='compact'?(c.overrides[role]??c.bonus??RATINGS[c.rating]):null;
}
export function normalizeCondition(v,template){
 const manual=normalizeManualCondition(v,template?.record,template?.hull);validateInventoryFit(manual.ammunition,template);
 const hull=optional(v?.hull,'Current hull',0,manual.usableHull??template?.hull??1000000);
 return {hull,...manual};
}

export function effectiveDesign(ship){const base=ship.template;if(!base)return null;const o=ship.designOverrides??{};return normalizeTemplate({...base,...o,record:{...base.record,...o.record},source:base.source,notes:base.notes});}
export function normalizeOverrides(value,base){
 if(value==null)return null;if(typeof value!=='object'||Array.isArray(value))throw Error('Design overrides must be a record.');if(!base)throw Error('Define a base design before applying overrides.');
 const merged=normalizeTemplate({...base,...value,record:{...base.record,...value.record},source:base.source,notes:base.notes}),out={};
 for(const key of ['name','tons','thrust','hull','armour'])if(JSON.stringify(merged[key])!==JSON.stringify(base[key]))out[key]=merged[key];
 const record={};for(const key of new Set([...Object.keys(base.record),...Object.keys(merged.record)]))if(JSON.stringify(merged.record[key])!==JSON.stringify(base.record[key]))record[key]=merged.record[key];if(Object.keys(record).length)out.record=record;
 return Object.keys(out).length?out:null;
}
export function overrideFields(ship){return Object.entries(ship.designOverrides??{}).flatMap(([key,v])=>key==='record'?Object.keys(v).map(k=>'record.'+k):[key]);}

// A total crew rating never implies training or an actual skill level.
export function crewSkill(crew,role){
 if(!ROLES.includes(role))throw Error('Unknown crew role.');
 const c=normalizeCrew(crew);return c.mode==='detailed'||c.mode==='compact'&&c.activeDetails.includes(role)?c.details[role]?.skill??null:null;
}
