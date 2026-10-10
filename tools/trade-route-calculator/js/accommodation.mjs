import {up} from './rounding.mjs?v=jump-completion-20261010-42';
import {sum,mul,decimal,cmp,credit} from './amounts.mjs';

export const tiers=['low','middle','high'];
export const luggageRates={low:'0.01',middle:'0.1',high:'1'};
export const monthlyRates={low:100,middle:1000,high:1000};
export function serviceRate(tier,service){
 const level=service?.level??tier;
 if(level==='custom'){const rate=credit(service.monthly);if(rate<0n)throw Error('Custom life support must be zero or more Credits per stateroom per month.');return String(rate);}
 if(!tiers.includes(level))throw Error('Choose a life-support service level.');
 return String(monthlyRates[level]);
}
export function serviceLabel(tier,service){const level=service?.level??tier;return level[0].toUpperCase()+level.slice(1);}
export const personMonthlyRate=1000;
export const personRate=tier=>tier==='high'?3000:1000;
// Old totals excluded low rooms. Preserve them as middle until the user reviews setup.
export function roomCounts(ship){return ship.accommodation?.rooms??{low:ship.accommodation?.lowBerths??0,middle:ship.staterooms??0,high:0};}
export function roomTotal(ship){return tiers.reduce((n,t)=>n+(roomCounts(ship)[t]??0),0);}
export function occupants(ship){return ship.accommodation||ship.supportOccupants||{passengers:{},crew:{}};}
export function validateAccommodation(ship){
 const a=ship.accommodation;if(a===undefined)return;
 if(!a||Object.hasOwn(a,'bookedLowSupport'))throw Error('Invalid accommodation.');
 for(const tier of tiers){
  const n=roomCounts(ship)[tier];if(!Number.isSafeInteger(n)||n<0)throw Error('Stateroom counts must be non-negative whole numbers.');
  serviceRate(tier,a.roomService?.[tier]);
 }
 for(const role of ['passengers','crew'])for(const tier of tiers){
  if(!Number.isSafeInteger(a[role]?.[tier])||a[role][tier]<0)throw Error('Passenger and crew counts must be non-negative whole numbers.');

 }
 if(a.luggageTons!=null&&cmp(a.luggageTons,0)<0)throw Error('Passenger luggage cannot be negative.');
}
export function luggageAllowance(ship){
 // Legacy refill headcounts were never an onboard manifest. Reserve only after explicit setup.
 const p=ship.accommodation?.passengers;if(!p)return '0';
 return decimal(sum(tiers.map(t=>mul(p[t]??0,luggageRates[t]))));
}
export function passengerLuggage(ship){if(ship.accommodation?.combinedPeople&&ship.accommodation.luggageMode!=='manual')return String((ship.accommodation.passengers?.high??0)+(ship.accommodation.crew?.high??0));const value=ship.accommodation?.luggageTons!=null?ship.accommodation.luggageTons:luggageAllowance(ship);return ship.roundTons?String(up(value)):decimal(value);}

// Older saves stored an explicit total without a mode flag. Keep zero, too.
export function manualLuggage(ship){const a=ship.accommodation;return !!a&&(a.luggageMode==='manual'||a.luggageMode===undefined&&!a.combinedPeople&&a.luggageTons!=null);}
