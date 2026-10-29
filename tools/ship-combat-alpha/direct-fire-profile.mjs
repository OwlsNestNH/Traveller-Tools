import {effectiveDesign,normalizeCrew,RATINGS} from './setup.mjs';
import {assignedSkill} from './crew-roster.mjs';
import {gunneryMounts} from './gunnery.mjs';
import {rangeInfo} from './movement-rules.mjs';
import {LASERS} from './direct-fire-rules.mjs';

// Rating substitutes for skill in simplified crews. Recorded totals are not added
// again as characteristic modifiers. Detailed roles retain their actual skills.
export function combatCrew(ship,role,mountId=null){
 const c=normalizeCrew(ship.crew),station=mountId?c.gunnerStations?.find(d=>d.mountId===mountId):null;
 const detailed=!!station||c.mode==='detailed'||c.mode==='compact'&&c.activeDetails.includes(role);
 if(!detailed)return {skill:RATINGS[c.rating],modifier:c.overrides[role]??c.bonus??RATINGS[c.rating],simple:true,source:c.rating+' crew; rating as skill'};
 const d=station??c.details[role],key=station?'mount:'+mountId:role,a=assignedSkill(c,key);
 const tons=effectiveDesign(ship)?.tons,valid=role==='gunner'?/^gunner\s*\(turret\)$/i:tons==null?/^$/:tons<100?/^pilot\s*\(small craft\)$/i:tons<=5000?/^pilot\s*\(spacecraft\)$/i:/^pilot\s*\(capital ships\)$/i;
 if(!d||!valid.test(d.skillName.trim()))return {skill:null,modifier:null,simple:false,source:'Required '+role+' skill not recorded'};
 return {skill:d.skill,modifier:d.skill+d.characteristicDM,simple:false,source:d.skillName,breakdown:{skill:d.skill,stat:a?.stat??null,other:a?.stat==null?d.characteristicDM:a.other}};
}
export function directFireQueue(state){
 const g=state.workflow?.gunnery;if(!g||g.declarations.length!==g.order.length)return [];
 const order=[...state.workflow.initiatives].sort((a,b)=>b.initiative-a.initiative||a.tie-b.tie||a.shipId.localeCompare(b.shipId));
 return order.flatMap(({shipId})=>g.declarations.find(d=>d.shipId===shipId)?.mounts.filter(m=>m.action==='attack'&&Object.hasOwn(LASERS,m.weapon)).map(m=>({id:shipId+'/'+m.mountId,shipId,...m}))??[]);
}
export function unresolvedDeclarations(state){return (state.workflow?.gunnery?.declarations??[]).flatMap(d=>d.mounts.filter(m=>m.action==='attack'&&!Object.hasOwn(LASERS,m.weapon)||m.action==='point-defense').map(m=>({shipId:d.shipId,...m})));}
export function directFireProfile(state,entry){
 const attacker=state.ships.find(s=>s.id===entry.shipId),target=state.ships.find(s=>s.id===entry.targetId),design=attacker&&effectiveDesign(attacker),targetDesign=target&&effectiveDesign(target),mount=attacker&&gunneryMounts(attacker).find(m=>m.id===entry.mountId);
 if(!attacker||!target||target.condition.hull===0||attacker.condition.hull===0)return {status:'hold',reason:'Attacker or declared target unavailable; no retargeting.'};
 if(!mount||['offline','destroyed'].includes(mount.status))return {status:'hold',reason:'Declared turret unavailable.'};
 const w=design?.record.weapons?.find(w=>w.id===mount.mountId),fit=w?.fit,range=rangeInfo(attacker.motion.position,target.motion.position),crew=combatCrew(attacker,'gunner',mount.mountId),pilot=combatCrew(target,'pilot');
 const issues=[];
 if(!fit||!fit.quantity)issues.push('Individual slot counts need a verified structured fit.');
 if(fit?.tech?.some((t,i)=>t&&fit.slots[i]===entry.weapon))issues.push('Modified weapon technology requires manual resolution in this stage.');
 if(design?.tons<100||targetDesign?.tons<100)issues.push('Small-craft rules remain manual.');
 if(range.band==='Adjacent / Close')issues.push('Close-range dogfighting remains manual.');
 const count=fit?.slots.filter(t=>t===entry.weapon).length??0;
 if(!count)issues.push('The declared weapon fit is unverified.');
 if(crew.modifier==null)issues.push('Record a Gunner (turret) contribution.');
 if(target.condition.hull==null||targetDesign?.hull==null||targetDesign.armour==null)issues.push('Target hull, starting hull and armour must be known.');
 if([attacker,target].some(s=>(s.condition.criticals??[]).some(c=>c.status!=='resolved')||s.combatDamage?.pending?.length))issues.push('Existing manual critical effects need GM reconciliation.');
 if(mount.status==='damaged')issues.push('The damaged turret needs a verified current effect.');
 const bandIndex={Short:0,Medium:1,Long:2,'Very Long':3,Distant:4};
 if(range.band!=='Adjacent / Close'&&bandIndex[range.band]>bandIndex[LASERS[entry.weapon]?.maxRange])return {status:'hold',reason:'Declared target beyond weapon range; no retargeting.',range};
 return {status:issues.length?'manual':'eligible',issues,range,count,crew,pilot,mountId:mount.mountId,armour:targetDesign?.armour==null?null:Math.max(0,targetDesign.armour-(target.combatDamage?.armourLoss??0)),targetTons:targetDesign?.tons??null};
}
