import {sum,mul,decimal,cmp,credit} from './amounts.mjs';

export const tiers=['low','middle','high'];
export const luggageRates={low:'0.01',middle:'0.1',high:'1'};
export const monthlyRates={low:100,middle:1000,high:3000};
export function serviceRate(tier,service){
 const level=service?.level??tier;
 if(level==='custom'){const rate=credit(service.monthly);if(rate<0n)throw Error('Custom life support must be zero or more Credits per person per month.');return String(rate);}
 if(!tiers.includes(level))throw Error('Choose a life-support service level.');
 return String(monthlyRates[level]);
}
export function serviceLabel(tier,service){const level=service?.level??tier;return level[0].toUpperCase()+level.slice(1);}
export function occupants(ship){return ship.accommodation||ship.supportOccupants||{passengers:{},crew:{}};}
export function validateAccommodation(ship){
 const a=ship.accommodation;if(a===undefined)return;
 if(!a||!Number.isSafeInteger(a.lowBerths)||a.lowBerths<0)throw Error('Low berths must be a non-negative whole number.');
 for(const role of ['passengers','crew'])for(const tier of tiers){
  if(!Number.isSafeInteger(a[role]?.[tier])||a[role][tier]<0)throw Error('Passenger and crew counts must be non-negative whole numbers.');
  serviceRate(tier,a[role+'Service']?.[tier]);
 }
 if(a.luggageTons!=null&&cmp(a.luggageTons,0)<0)throw Error('Passenger luggage cannot be negative.');
}
export function luggageAllowance(ship){
 // Legacy refill headcounts were never an onboard manifest. Reserve only after explicit setup.
 const p=ship.accommodation?.passengers;if(!p)return '0';
 return decimal(sum(tiers.map(t=>mul(p[t]??0,luggageRates[t]))));
}
export function passengerLuggage(ship){return ship.accommodation?.luggageTons!=null?decimal(ship.accommodation.luggageTons):luggageAllowance(ship);}
