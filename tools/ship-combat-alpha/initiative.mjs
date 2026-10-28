import {normalizeCrew,crewSkill,RATINGS} from './setup.mjs';
import {assignedSkill} from './crew-roster.mjs';
// Core 2022 pp.60–61,165. Simplified rating-as-skill is the selected UI policy.
export function initiativeProfile(ship){
 const c=normalizeCrew(ship.crew),simple=role=>c.mode==='quick'||c.mode==='compact'&&!c.activeDetails.includes(role);
 const pilot=simple('pilot')?RATINGS[c.rating]:/^pilot(?:\s*\(|$)/i.test(c.details.pilot?.skillName?.trim()??'')?crewSkill(c,'pilot'):null;
 const d=c.details.captain,a=c.roster?.assignments.captain,m=c.roster?.members.find(m=>m.id===a?.memberId),naval=m?.skills.find(s=>/^tactics\s*\(naval\)$/i.test(s.name.trim()));
 const explicit=naval??(/^tactics\s*\(naval\)$/i.test(d?.skillName?.trim()??'')?assignedSkill(c,'captain')??{level:d.skill,other:d.characteristicDM}:null);
 const tactics=simple('captain')?RATINGS[c.rating]:explicit?explicit.level+(explicit.stat??0)+(explicit.other??0):null;
 return {pilot,tactics,pilotSimple:simple('pilot'),tacticsSimple:simple('captain'),rating:c.rating,thrust:ship.capabilities.thrust};
}
const integer=(n,label,min,max)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+' is outside its allowed whole-number range.');return n;};
const dice=v=>{if(!Array.isArray(v)||v.length!==2)throw Error('Two dice required.');return v.map(n=>integer(n,'Die',1,6));};
export function openingInitiative({pilot,thrust,tacticsModifier=null,recordedEffect=0,baseDice,tacticsDice}){
 integer(pilot,'Pilot skill',0,10);integer(thrust,'Thrust',0,10000);const base=dice(baseDice);
 let effect=integer(recordedEffect,'Recorded Tactics Effect',-100,100),tactics=null;
 if(tacticsModifier!==null){integer(tacticsModifier,'Tactics modifier',-30,40);tactics=dice(tacticsDice);effect=tactics[0]+tactics[1]+tacticsModifier-8;}
 return {baseDice:base,tacticsDice:tactics,pilot,thrust,tacticsModifier,tacticsEffect:effect,total:base[0]+base[1]+pilot+thrust+effect};
}

// Optional provenance: legacy/manual totals deliberately have no invented breakdown.
export function normalizeInitiativeRecord(value){
 if(value==null)return null;
 if(value.version!==1||!value.profile)throw Error('Unsupported initiative record.');
 const p=value.profile,pilot=p.pilot==null?null:integer(p.pilot,'Snapshot Pilot',0,10),tactics=p.tactics==null?null:integer(p.tactics,'Snapshot Tactics',-30,40);
 if(typeof p.pilotSimple!=='boolean'||typeof p.tacticsSimple!=='boolean'||!Object.hasOwn(RATINGS,p.rating))throw Error('Invalid initiative crew snapshot.');
 const profile={pilot,tactics,pilotSimple:p.pilotSimple,tacticsSimple:p.tacticsSimple,rating:p.rating,thrust:integer(p.thrust,'Snapshot thrust',0,10000)};
 const result=openingInitiative({...value.result,recordedEffect:value.result.tacticsEffect});
 return {version:1,profile,result};
}
export const initiativeInputsChanged=ship=>!!ship.flight.initiativeRecord&&JSON.stringify(initiativeProfile(ship))!==JSON.stringify(ship.flight.initiativeRecord.profile);
