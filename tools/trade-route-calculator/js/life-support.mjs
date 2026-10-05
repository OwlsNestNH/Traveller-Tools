import {tiers,roomCounts,serviceRate,occupants,personRate} from './accommodation.mjs?v=passenger-input-3';
import {mul,div} from './amounts.mjs';
import {up,creditStep} from './rounding.mjs';
export function validateSupport(ship){const x=ship.lifeSupport;if(x===undefined)return;if(!x||!Number.isSafeInteger(x.capacityHours)||x.capacityHours<1||!Number.isSafeInteger(x.remainingHours)||x.remainingHours<0||x.remainingHours>x.capacityHours)throw Error('Life support remaining must be between zero and capacity, in whole hours.');if(x.elapsedHours!==undefined&&(!Number.isSafeInteger(x.elapsedHours)||x.elapsedHours<0||x.elapsedHours>=24||x.remainingHours%24!==0||x.capacityHours%24!==0))throw Error('Invalid whole-day life support stock.');}
export function monthlySupport(ship){const a=occupants(ship),rooms=roomCounts(ship);return tiers.reduce((n,t)=>n+BigInt(rooms[t]??0)*BigInt(serviceRate(t,ship.accommodation?.roomService?.[t]))+BigInt((a.passengers?.[t]??0)+(a.crew?.[t]??0))*BigInt(personRate(t)),0n);}
// Legacy hour-based stock becomes whole days plus time used toward the next day.
export function supportStock(x){const remainingDays=Math.ceil(x.remainingHours/24);return {capacityDays:Math.ceil(x.capacityHours/24),remainingDays,elapsedHours:x.elapsedHours??(remainingDays*24-x.remainingHours)};}
export function consumeSupport(ship,hours){
 if(!ship.lifeSupport)return;
 const x=ship.lifeSupport,q=supportStock(x),elapsed=q.elapsedHours+hours;
 x.capacityHours=q.capacityDays*24;x.remainingHours=Math.max(0,q.remainingDays-Math.floor(elapsed/24))*24;
 x.elapsedHours=x.remainingHours?elapsed%24:0;
}
export function refillQuote(s){
 validateSupport(s.ship);const x=s.ship.lifeSupport;if(!x)throw Error('Set life support capacity and remaining supplies first.');
 const stock=supportStock(x),partialDay=stock.elapsedHours>0?1:0,missingDays=stock.capacityDays-stock.remainingDays+partialDay,monthly=monthlySupport(s.ship);
 if(missingDays&&monthly<=0n)throw Error('Enter cabins and people in ship settings before buying supplies.');
 return {missingDays,partialDay,missingHours:missingDays*24,capacityHours:stock.capacityDays*24,beforeHours:stock.remainingDays*24,monthly:String(monthly),amount:String(up(mul(monthly,div(missingDays,28)),creditStep(s)))};
}
