import {supportCompartments} from './lss-compartments.mjs?v=inline-buy-20261021-110';
// Explicit whole-ton Cargo previews. Nothing here runs during load or render.
import * as A from './amounts.mjs';
import {passengerShip,passengerSpace,luggageSources} from './passengers.mjs?v=inline-buy-20261021-110';
import {passengerLuggage} from './accommodation.mjs?v=inline-buy-20261021-110';
import {supportCargo,supportAmount,anchorSupport,supportDisplay} from './life-support.mjs?v=inline-buy-20261021-110';
import {bladderSpace} from './fuel.mjs?v=inline-buy-20261021-110';
export const cargoNumber=value=>supportAmount(value);
const exact=value=>{try{return A.decimal(value);}catch{return A.auditNumber(value);}};
export const wholeCargo=value=>String(-A.floor(A.mul(cargoNumber(value),-1)));
export function cargoRemovalEntries(s){
 const rows=[...(s.otherCargo??[]).map(l=>({key:'other:'+l.id,kind:'other',id:l.id,quantity:l.quantity})),...s.lots.map(l=>({key:'lot:'+l.id,kind:'lot',id:l.id,quantity:l.quantity})),...s.contracts.filter(c=>c.kind!=='passenger'&&c.status==='accepted').map(c=>({key:'contract:'+c.id,kind:'contract',id:c.id,quantity:c.quantity})),
  {key:'luggage',kind:'luggage',quantity:A.decimal(passengerLuggage(passengerShip(s)))},
  {key:'support',kind:'support',quantity:exact(supportCargo(s.ship))},
  {key:'bladders',kind:'bladders',quantity:String(bladderSpace(s.ship))}];
 return rows.filter(r=>A.cmp(cargoNumber(r.quantity),0)>0).map(r=>({...r,original:wholeCargo(r.quantity)}));
}
export function createCargoRemoval(s){
 const entries=cargoRemovalEntries(s),remaining=Object.fromEntries(entries.map(e=>[e.key,e.original]));
 const occupied=exact(A.add(A.sum(entries.map(e=>cargoNumber(e.quantity))),passengerSpace(s)));
 let precondition='';
 if(s.ship.lifeSupport&&s.ship.lifeSupport.stockUnits===undefined){const detached=structuredClone(s.ship);anchorSupport(detached,{complementShip:passengerShip(s)});const overflow=supportCargo(detached);if(A.cmp(overflow,0)>0)precondition='Confirm physical supplies in Life Support settings (Ship, trader & options) before removing cargo. Converting this legacy days record would introduce '+supportDisplay(overflow)+' t of cargo LSS; the recorded manifest is unchanged.';}
 return {revision:s.revision,entries,remaining,occupied,capacity:String(s.ship.capacity),...(precondition?{precondition}:{})};
}
export function setCargoRemaining(draft,key,value){
 const entry=draft.entries.find(e=>e.key===key);
 if(!entry||!/^\d+$/.test(String(value))||A.cmp(value,entry.original)>0)throw Error('Remaining cargo must be whole tons between zero and the original quantity.');
 return {...draft,remaining:{...draft.remaining,[key]:String(BigInt(value))}};
}
export function cargoRemovalSummary(draft){
 let rounded=A.rat(0),removed=A.rat(0);
 for(const e of draft.entries){const value=draft.remaining[e.key];setCargoRemaining(draft,e.key,value);rounded=A.add(rounded,A.sub(e.original,cargoNumber(e.quantity)));removed=A.add(removed,A.sub(e.original,value));}
 const normalized=A.add(cargoNumber(draft.occupied),rounded),revised=A.sub(normalized,removed);
 return {original:draft.occupied,normalized:exact(normalized),revised:exact(revised),rounded:exact(rounded),removed:A.decimal(removed),overCapacity:A.cmp(revised,draft.capacity)>0,changed:A.cmp(rounded,0)>0||A.cmp(removed,0)>0};
}
export function applyCargoRemoval(s,draft,{reducePolicy,uid}){
 const fresh=createCargoRemoval(s);
 if(draft.precondition||fresh.precondition)throw Error(draft.precondition||fresh.precondition);
 if(draft.revision!==s.revision||JSON.stringify(fresh.entries)!==JSON.stringify(draft.entries)||JSON.stringify(fresh.occupied)!==JSON.stringify(draft.occupied)||fresh.capacity!==draft.capacity)throw Error('Cargo changed. Cancel and reopen the removal preview.');
 const summary=cargoRemovalSummary(draft);
 if(!summary.changed)throw Error('No cargo changes to confirm.');
 if(summary.overCapacity)throw Error('Rounded cargo exceeds hold capacity. Remove more cargo before confirming.');
 const changes=[];
 for(const e of draft.entries){
  const remaining=draft.remaining[e.key],removed=A.decimal(A.sub(e.original,remaining)),record={kind:e.kind,id:e.id??e.key,before:e.quantity,normalized:e.original,remaining,removed};
  if(e.kind==='lot'){
   const lot=s.lots.find(l=>l.id===e.id);
   // Quantity normalization never changes frozen quotes, historical cost or coverage.
   if(A.cmp(removed,0)>0){
    for(const key of ['basis','goodsValue']){const lost=A.cmp(remaining,0)===0?A.credit(lot[key]):A.floor(A.mul(lot[key],A.div(removed,e.original)));record[key+'WrittenOff']=String(lost);lot[key]=String(A.credit(lot[key])-lost);}
    reducePolicy(s,lot.id,removed);
   }
   lot.quantity=remaining;
  }else if(e.kind==='other'){
   const item=s.otherCargo.find(x=>x.id===e.id);item.quantity=remaining;
   if(A.cmp(removed,0)>0){record.previousSaleValue=item.saleValue??null;delete item.saleValue;(item.losses??=[]).push({...record,hours:s.hours});}
  }else if(e.kind==='contract'){
   const contract=s.contracts.find(c=>c.id===e.id);contract.quantity=remaining;
   if(A.cmp(removed,0)>0){(contract.cargoLosses??=[]).push({...record,hours:s.hours});if(A.cmp(remaining,0)===0)contract.status='lost';}
  }else if(e.kind==='luggage'){
   const sources=luggageSources(s),raw=A.sum(sources.map(x=>x.quantity)),rounding=A.sub(e.original,raw);
   const owner=source=>source.kind==='baseline'?s.ship.accommodation:s.contracts.find(c=>c.id===source.id);
   // Attach the upward adjustment to surviving baggage, so it leaves when its
   // booking leaves. It never changes automatic allowance or passenger counts.
   const roundedSource=[...sources].reverse().find(x=>A.cmp(x.quantity,0)>0);
   if(A.cmp(rounding,0)>0){const o=owner(roundedSource);o.cargoLuggageRounding=A.decimal(A.add(o.cargoLuggageRounding??0,rounding));roundedSource.quantity=A.decimal(A.add(roundedSource.quantity,rounding));}
   let loss=A.dec(removed);record.allocations=[];
   for(const source of sources){const q=A.cmp(loss,source.quantity)<0?loss:A.dec(source.quantity);if(A.cmp(q,0)>0){const o=owner(source);o.cargoLuggageLost=A.decimal(A.add(o.cargoLuggageLost??0,q));loss=A.sub(loss,q);record.allocations.push({source:source.id??'baseline',quantity:A.decimal(q)});}}
   if(A.cmp(loss,0)!==0)throw Error('Luggage loss exceeds recorded luggage.');
  }else if(e.kind==='support'){
   const compartments=supportCompartments(s.ship),cargo=supportAmount(compartments.cargo),limit=A.mul(remaining,100),next=A.cmp(cargo,limit)<0?cargo:limit;
   s.ship.lifeSupport.roundCargoSpace=true;
   s.ship.lifeSupport.cargoUnits=A.auditNumber(next);
   s.ship.lifeSupport.stockUnits=A.auditNumber(A.add(supportAmount(compartments.internal),next));
   record.suppliesLost=A.auditNumber(A.sub(cargo,next));
  }else if(e.kind==='bladders')s.ship.fuel.aboardTons-=Number(removed);
  if(A.cmp(cargoNumber(e.quantity),remaining)!==0)changes.push(record);
 }
 s.lots=s.lots.filter(l=>A.cmp(l.quantity,0)>0);
 if(s.otherCargo)s.otherCargo=s.otherCargo.filter(l=>A.cmp(l.quantity,0)>0);
 s.events.push({id:uid(),label:'Cargo removal audit',hours:s.hours,world:s.actual,...summary,changes});
 return summary;
}
