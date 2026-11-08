import {tiers,roomCounts,serviceRate} from './accommodation.mjs?v=fleet-20261108-2';
import {passengerShip} from './passengers.mjs?v=fleet-20261108-2';
import {supportCostBasis,supportPurchaseCost,combinedSupportReference} from './life-support.mjs?v=fleet-20261108-2';

export const consumableRefillReference=combinedSupportReference;
// Installed amount is informational; supportCostBasis applies zero when empty.
export function monthlyCabinUpkeep(ship){
 const rooms=roomCounts(ship);
 return tiers.reduce((total,tier)=>total+BigInt(rooms[tier]??0)*BigInt(serviceRate(tier,ship.accommodation?.roomService?.[tier])),0n);
}
export function consumableRefillBasis(state){return supportCostBasis(passengerShip(state));}
export function consumableRefillQuote(state,{purchasedUnits,comfortCost='0',comfortNote=''}){
 return supportPurchaseCost(passengerShip(state),purchasedUnits,{comfortCost,comfortNote});
}
