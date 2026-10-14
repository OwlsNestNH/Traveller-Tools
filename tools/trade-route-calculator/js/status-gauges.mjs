// Presentation only: empty installed bladders never reserve cargo space.
import * as A from './amounts.mjs?v=status-strip-20261014-87';
import {fuelCapacities,bladderSpace} from './fuel.mjs?v=status-strip-20261014-87';
const positive=value=>A.cmp(value,0)>0?value:'0';
const percent=(value,total)=>A.cmp(total,0)>0?String(Number(A.floor(A.mul(A.div(value,total),100000000)))/1000000):'0';
export function fuelGaugeValues(ship){const c=fuelCapacities(ship),f=ship.fuel;if(!f)return null;const bladder=bladderSpace(ship);return {...c,aboardTons:f.aboardTons,mainTons:Math.min(f.aboardTons,c.baseCapacityTons),bladderFuel:bladder,showBladder:bladder>=1};}
export function statusGaugeValues(ship,occupied){
 const capacity=A.decimal(ship.capacity),total=A.decimal(occupied),bladder=bladderSpace(ship),ordinary=positive(A.sub(total,bladder));
 // An overloaded hold fills the track proportionally; exact excess stays labelled.
 const scale=A.cmp(total,capacity)>0?total:capacity;
 return {cargo:{capacity,total,bladder,ordinary:A.decimal(ordinary),free:A.decimal(A.sub(capacity,total)),overCapacity:A.cmp(total,capacity)>0,ordinaryPercent:percent(ordinary,scale),bladderPercent:percent(bladder,scale)},fuel:fuelGaugeValues(ship)};
}
