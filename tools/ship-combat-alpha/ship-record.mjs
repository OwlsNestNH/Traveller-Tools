import {normalizeAmmunition} from './ammunition.mjs';
import {normalizeWeaponFit} from './weapon-fit.mjs';
import {normalizePublished,powerProvenance} from './catalogue-provenance.mjs';
// Optional setup/equipment facts and manual condition only. No combat resolution.
const whole=(v,label,min=0,max=1000000)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(`${label} must be a whole number from ${min} to ${max}.`);return v;};
const amount=(v,label,max=1000000)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)throw Error(`${label} must be a finite amount from 0 to ${max}.`);return v===0?0:v;};
const optional=(v,fn)=>v===null||v===undefined?null:fn(v);
const text=(v,label,max=100,empty=false)=>{if(typeof v!=='string'||v.length>max||(!empty&&!v.trim()))throw Error(`${label} must contain ${empty?'0':'1'} to ${max} characters.`);return v.trim();};
export const optionalName=v=>v==null?'':text(v,'Crew name',60,true);
const id=v=>{if(typeof v!=='string'||!/^[-a-z0-9]{1,32}$/.test(v))throw Error('Mount ID must use 1 to 32 lowercase letters, digits or hyphens.');return v;};
const list=(v,label,max,fn)=>{if(v==null)return null;if(!Array.isArray(v)||v.length>max)throw Error(`${label} supports at most ${max} records.`);return Array.from(v,fn);};
export function normalizeRecord(v={}){
 v??={};if(typeof v!=='object'||Array.isArray(v))throw Error('Equipment must be a record.');
 const weapons=list(v.weapons,'Weapon setup',32,w=>({id:id(w.id),name:text(w.name,'Mount name',60),type:text(w.type,'Weapon type'),count:whole(w.count,'Weapons in mount',1,32),ammunition:optional(w.ammunition,n=>whole(n,'Initial ammunition')),...(w.fit==null?{}:{fit:normalizeWeaponFit(w.fit)})}));
 if(weapons&&new Set(weapons.map(w=>w.id)).size!==weapons.length)throw Error('Mount IDs must be unique.');
 return {...(v.published==null?{}:{published:normalizePublished(v.published)}),tl:optional(v.tl,n=>whole(n,'Tech level',0,100)),className:optional(v.className,n=>text(n,'Class',80)),reference:optional(v.reference,n=>text(n,'User source reference',300)),ratedPower:optional(v.ratedPower,n=>amount(n,'Rated plant output')),fuelCapacity:optional(v.fuelCapacity,n=>amount(n,'Fuel capacity')),cargoCapacity:optional(v.cargoCapacity,n=>amount(n,'Cargo capacity')),crewTotal:optional(v.crewTotal,n=>whole(n,'Crew complement')), jump:optional(v.jump,n=>whole(n,'Jump rating',0,1000)),sensors:optional(v.sensors,n=>text(n,'Sensors')),computer:optional(v.computer,n=>text(n,'Computer')),software:optional(v.software,n=>text(n,'Software',1000)),requirements:list(v.requirements,'Power requirements',24,r=>({...powerProvenance(r),name:text(r.name,'Power system',60),power:optional(r.power,n=>amount(n,'System requirement'))})),weapons};
}
export function normalizeManualCondition(v={},record={},ratedHull=null){
 const usableHull=optional(v.usableHull,n=>whole(n,'Manual usable hull maximum',0,ratedHull??1000000)),usablePower=optional(v.usablePower,n=>amount(n,'Manual usable output maximum',record.ratedPower??1000000)),usableFuel=optional(v.usableFuel,n=>amount(n,'Manual usable fuel capacity',record.fuelCapacity??1000000));
 const fuel=optional(v.fuel,n=>amount(n,'Current fuel',usableFuel??record.fuelCapacity??1000000));
 const rawCriticals=typeof v.criticals==='string'?[{system:'Manual note',effect:v.criticals,status:'open'}]:v.criticals;
 const criticals=list(rawCriticals,'Critical records',32,c=>({system:text(c.system,'Critical system',60),severity:optional(c.severity,n=>whole(n,'Recorded severity',0,100)),effect:optional(c.effect,n=>text(n,'Recorded effect',300)),status:c.status??'open'}));
 if(criticals?.some(c=>!['open','resolved','unknown'].includes(c.status)))throw Error('Choose a manual critical status.');
 const weapons=list(v.weapons,'Weapon condition',64,w=>({id:id(w.id),ammunition:optional(w.ammunition,n=>whole(n,'Current ammunition')),status:w.status??'unknown'}));
 if(weapons){if(new Set(weapons.map(w=>w.id)).size!==weapons.length)throw Error('Weapon condition IDs must be unique.');if(weapons.some(w=>!['unknown','ready','offline','damaged','destroyed'].includes(w.status)))throw Error('Choose a recorded weapon status.');}
 return {...(v.ammunition==null?{}:{ammunition:normalizeAmmunition(v.ammunition)}),usableHull,usablePower,usableFuel,fuel,powerOutput:optional(v.powerOutput,n=>amount(n,'Current plant output',usablePower??1000000)),powerUsed:optional(v.powerUsed,n=>amount(n,'Current used power')),criticals,cargo:optional(v.cargo,n=>amount(n,'Current cargo',record.cargoCapacity??1000000)),crewAvailable:optional(v.crewAvailable,n=>whole(n,'Available crew',0,record.crewTotal??1000000)),lifeSupport:optional(v.lifeSupport,n=>text(n,'Life support status',100)),weapons};
}
export function remainingPower(condition){return condition.powerOutput==null||condition.powerUsed==null?null:condition.powerOutput-condition.powerUsed;}
