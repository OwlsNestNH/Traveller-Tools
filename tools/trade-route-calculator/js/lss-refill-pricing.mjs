import * as A from './amounts.mjs';
import {tiers,roomCounts,serviceRate,refillPersonRate} from './accommodation.mjs?v=row-bands-20261021-109';
import {passengerShip} from './passengers.mjs?v=row-bands-20261021-109';
import {supportAmount,supportComplement} from './life-support.mjs?v=row-bands-20261021-109';
import {up,creditStep} from './rounding.mjs?v=row-bands-20261021-109';

export const consumableRefillReference='Campaign decision 2026-10-15: consumable LSS defaults to Cr1,000 per Middle person and Cr3,000 per High person per 28 days; the saved audit records configured rates. Frozen Low costs Cr100 per person per 28 days. Costs are prorated by supported duration. Internal and cargo supplies use the same tariff. Cabin upkeep is a separate operating expense.';
export function monthlyCabinUpkeep(ship){
 const rooms=roomCounts(ship);
 return tiers.reduce((total,tier)=>total+BigInt(rooms[tier]??0)*BigInt(serviceRate(tier,ship.accommodation?.roomService?.[tier])),0n);
}
export function consumableRefillBasis(state){
 const ship=passengerShip(state),complement=supportComplement(ship);
 if(!complement.known)throw Error('Enter the awake complement before quoting consumable supplies.');
 const high=['passengers','crew'].reduce((n,role)=>n+(ship.accommodation[role].high??0),0);
 // Legacy awake low-service occupants remain awake, never frozen berths.
 const middle=complement.awakePeople-high,low=complement.occupiedLowBerths,rates={middle:refillPersonRate(ship,'middle'),high:refillPersonRate(ship,'high'),low:'100'};
 return {middle,high,low,dailyUnits:A.auditNumber(complement.dailyUnits),monthly:String(BigInt(middle)*BigInt(rates.middle)+BigInt(high)*BigInt(rates.high)+BigInt(low)*100n),rates,billingDays:28};
}
// The owner supplies exact purchased LSS after the separately approved disposal
// policy. This calculator neither rounds nor mutates stock, allocation or money.
export function consumableRefillQuote(state,{purchasedUnits,comfortCost='0',comfortNote=''}){
 const basis=consumableRefillBasis(state),units=supportAmount(purchasedUnits),daily=supportAmount(basis.dailyUnits);
 if(A.cmp(units,0)<0)throw Error('Purchased LSS cannot be negative.');
 if(A.cmp(daily,0)<=0)throw Error('Enter a positive complement before buying consumable supplies.');
 const comfort=A.credit(comfortCost);if(comfort<0n)throw Error('Comfort provisions cost cannot be negative.');
 if(typeof comfortNote!=='string'||comfort>0n&&!comfortNote.trim())throw Error('Add a note for optional comfort provisions.');
 const days=A.div(units,daily),cost=A.mul(basis.monthly,A.div(days,28)),supplyAmount=up(cost,creditStep(state)),comfortAmount=up(comfort,creditStep(state));
 return {...basis,purchasedUnits:A.auditNumber(units),days:A.auditNumber(days),exactAmount:A.auditNumber(cost),supplyAmount:String(supplyAmount),comfortAmount:String(comfortAmount),comfortNote:comfortNote.trim(),amount:String(supplyAmount+comfortAmount),cabinAmount:'0',roundingStep:creditStep(state),reference:consumableRefillReference};
}
