import {up} from './rounding.mjs?v=time-completion-20261010-48';
export const fuelReference='Traveller Core Rulebook Update 2022, p. 157: jump fuel is 10% of ship hull tonnage per parsec (minimum Jump-1). Fuel prices: p. 154. Power-plant and small-craft use are not tracked separately. Final fuel tonnage rounds up to whole tons [R].';
// Read legacy jump-count saves without rewriting their retained Undo patches.
// New configuration always stores capacity directly in tons.
export function fuelCapacities(ship){
 const f=ship.fuel;if(f==null)return null;
 const legacy=f.bladderJumps!==undefined?f.bladderJumps:f.extraFullRangeJumps;
 if(legacy!==undefined&&(!Number.isSafeInteger(legacy)||legacy<0||f.bladderJumps!==undefined&&f.extraFullRangeJumps!==undefined&&f.bladderJumps!==f.extraFullRangeJumps))throw Error('Invalid legacy fuel bladder jump count.');
 let bladderTons=f.bladderTons===undefined?0:f.bladderTons;
 if(legacy!==undefined){
  if(!Number.isSafeInteger(f.displacementTons)||f.displacementTons<1||!Number.isInteger(ship.jump)||ship.jump<1||ship.jump>6)throw Error('Legacy fuel bladder capacity needs a valid ship displacement and Jump-1 to Jump-6 rating.');
  const converted=legacy*Math.ceil(f.displacementTons*ship.jump/10);
  if(!Number.isSafeInteger(converted)||f.bladderTons!==undefined&&f.bladderTons!==converted)throw Error('Legacy fuel bladder capacity does not match the saved ship displacement and jump rating.');
  bladderTons=converted;
 }
 const baseCapacityTons=f.baseCapacityTons===undefined?(bladderTons===0?f.capacityTons:undefined):f.baseCapacityTons;
 if(!Number.isSafeInteger(baseCapacityTons)||baseCapacityTons<1)throw Error('Base fuel tank capacity must be a positive whole number of tons.');
 if(!Number.isSafeInteger(bladderTons)||bladderTons<0)throw Error('Fuel bladder capacity must be a nonnegative whole number of tons.');
 if(!Number.isSafeInteger(baseCapacityTons+bladderTons)||f.capacityTons!==baseCapacityTons+bladderTons)throw Error('Total fuel capacity must equal base tank capacity plus bladder capacity.');
 return {baseCapacityTons,bladderTons,capacityTons:f.capacityTons};
}
export function validateFuel(ship){
 const f=ship.fuel;if(f==null)return;
 if(!Number.isSafeInteger(f.displacementTons)||f.displacementTons<1)throw Error('Ship displacement must be a positive whole number of tons.');
 if(!Number.isSafeInteger(f.aboardTons)||f.aboardTons<0)throw Error('Fuel aboard must be a nonnegative whole number of tons.');
 const capacities=fuelCapacities(ship);
 if(capacities.capacityTons>f.displacementTons)throw Error('Base tank and bladder capacity together exceed ship displacement.');
 if(f.aboardTons>capacities.capacityTons)throw Error('Fuel aboard exceeds total fuel capacity. Reduce fuel aboard before shrinking or removing the bladders.');
}
export function configureFuel(displacementTons,baseCapacityTons,aboardTons,bladderTons,jump){
 if(!Number.isSafeInteger(bladderTons)||bladderTons<0)throw Error('Fuel bladder capacity must be a nonnegative whole number of tons.');
 if(!Number.isInteger(jump)||jump<1||jump>6)throw Error('Jump rating must be 1 to 6.');
 const fuel={displacementTons,baseCapacityTons,aboardTons,bladderTons,capacityTons:baseCapacityTons+bladderTons};validateFuel({fuel,jump});return fuel;
}
export function bladderSpace(ship){const f=ship.fuel;if(!f)return 0;const capacities=fuelCapacities(ship);return Math.max(0,f.aboardTons-capacities.baseCapacityTons);}
export function jumpFuel(ship,parsecs){validateFuel(ship);if(!ship.fuel)return null;if(!Number.isSafeInteger(parsecs)||parsecs<0||parsecs>ship.jump)throw Error('Jump distance exceeds the configured jump rating.');const distance=Math.max(1,parsecs),f=ship.fuel,tons=Number((BigInt(f.displacementTons)*BigInt(distance)+9n)/10n);return {distance,displacementTons:f.displacementTons,tons,before:f.aboardTons,after:Math.max(0,f.aboardTons-tons),consumed:Math.min(f.aboardTons,tons),shortfall:Math.max(0,tons-f.aboardTons),capacity:f.capacityTons};}
export function fuelPurchase(ship,value){validateFuel(ship);if(!ship.fuel)return null;const tons=Number(up(value)),f=ship.fuel;if(!Number.isSafeInteger(tons)||tons<=0)throw Error('Enter a positive whole fuel quantity.');if(tons>f.capacityTons-f.aboardTons)throw Error('Fuel purchase exceeds available total fuel capacity.');return {tons,before:f.aboardTons,after:f.aboardTons+tons,capacity:f.capacityTons,displacementTons:f.displacementTons};}
export function consumeJumpFuel(ship,parsecs){const q=jumpFuel(ship,parsecs);if(!q)return null;ship.fuel.aboardTons=q.after;return q;}
