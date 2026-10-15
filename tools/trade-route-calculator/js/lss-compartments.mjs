// Exact allocation scaffolding. No migration or campaign write occurs on read.
import * as A from './amounts.mjs';
import {supportAmount,supportInternalCapacity,supportStock} from './life-support.mjs?v=lss-refill-20261015-90';
const exact=A.auditNumber;
const min=(a,b)=>A.cmp(a,b)<0?a:b;
export function supportCompartments(ship){
 const stock=supportStock(ship),capacity=supportInternalCapacity(ship);
 if(stock.stockUnits===null||capacity===null)throw Error('Known supplies and ship displacement are required.');
 const total=supportAmount(stock.stockUnits);
 // Optional allocation is a subset of the authoritative total, never a second total.
 const cargo=ship.lifeSupport?.cargoUnits===undefined?A.sub(total,min(total,capacity)):supportAmount(ship.lifeSupport.cargoUnits);
 const internal=A.sub(total,cargo);
 if(A.cmp(cargo,0)<0||A.cmp(internal,0)<0||A.cmp(internal,capacity)>0)throw Error('Invalid life support compartment allocation.');
 return {total:exact(total),internal:exact(internal),cargo:exact(cargo),cargoTons:exact(A.mul(cargo,'0.01'))};
}
export function consumeCompartments(allocation,quantity){
 const total=supportAmount(allocation.total),cargo=supportAmount(allocation.cargo),internal=supportAmount(allocation.internal),requested=supportAmount(quantity);
 if(A.cmp(requested,0)<0||A.cmp(cargo,0)<0||A.cmp(internal,0)<0||A.cmp(A.add(cargo,internal),total)!==0)throw Error('Invalid life support consumption or allocation.');
 const consumed=min(requested,total),cargoUsed=min(consumed,cargo),nextCargo=A.sub(cargo,cargoUsed),nextInternal=A.sub(internal,A.sub(consumed,cargoUsed));
 return {total:exact(A.sub(total,consumed)),internal:exact(nextInternal),cargo:exact(nextCargo),cargoTons:exact(A.mul(nextCargo,'0.01'))};
}
