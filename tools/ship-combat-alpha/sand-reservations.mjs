import {effectiveDesign} from './setup.mjs';
import {inventoryFromShip} from './ammunition.mjs';
import {gunneryMounts} from './gunnery.mjs';
import {combatCrew} from './direct-fire-profile.mjs';
// Core2022 pp.168,171: linked bonus, one canister per reaction. The per-turret
// reaction limit is the fixed one-use home rule, distinct from magazine capacity.
export function sandReservation(ship,row,used=0){
 if(!Number.isSafeInteger(used)||used<0)throw Error('Invalid sand-use count.');
 const limit=1;
 if(row?.action!=='sand'||row.weapon!=='Sandcaster')return {available:0,reason:'No committed sand reservation.'};
 const design=effectiveDesign(ship),mount=gunneryMounts(ship).find(m=>m.id===row.mountId),weapon=design?.record.weapons?.find(w=>w.id===mount?.mountId),fit=weapon?.fit;
 if(ship.condition.hull===0||!mount||['offline','destroyed'].includes(mount.status))return {available:0,reason:'Sand turret unavailable.'};
 if(design.tons<100)return {available:0,reason:'Small-craft sand defenses remain manual.'};
 if(!fit||fit.quantity!==1)return {available:0,reason:'A verified individual turret magazine is required.'};
 const count=fit.slots.filter(t=>t==='Sandcaster').length,crew=combatCrew(ship,'gunner',mount.mountId),inventory=inventoryFromShip(ship,design),pool=inventory.loaded.find(p=>p.mountId===mount.mountId&&p.kind==='sand');
 if(!count||crew.modifier==null||mount.status==='damaged'||(ship.condition.criticals??[]).some(c=>c.status!=='resolved'))return {available:0,reason:'Sand fit, gunner or damage effect needs GM reconciliation.'};
 if(fit.tech?.some((t,i)=>t&&fit.slots[i]==='Sandcaster'))return {available:0,reason:'Modified sandcaster technology remains manual.'};
 if(pool?.count==null)return {available:0,reason:'Loaded sand ammunition is unknown.'};
 return {available:Math.min(Math.max(0,limit-used),pool.count),limit,used,count,linkedBonus:count-1,crew,poolId:pool.id,ammunition:pool.count,inventory};
}
export function consumeSandReservation(ship,row,used=0){
 const reservation=sandReservation(ship,row,used);if(!reservation.available)throw Error(reservation.reason??'Sand limit or ammunition exhausted.');
 const next=structuredClone(ship),inventory=reservation.inventory;inventory.loaded.find(p=>p.id===reservation.poolId).count--;
 next.condition.ammunition=inventory;return {ship:next,used:used+1,linkedBonus:reservation.linkedBonus,count:reservation.count,modifier:reservation.crew.modifier,poolId:reservation.poolId};
}
