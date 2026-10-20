import {consumeReserveCompartments} from './lss-compartments.mjs?v=zone-zoom-20261020-105';
import * as A from './amounts.mjs';
import {campaignRefillDraft,editRefillDraft} from './lss-refill-draft.mjs?v=zone-zoom-20261020-105';
import {consumableRefillQuote} from './lss-refill-pricing.mjs?v=zone-zoom-20261020-105';
import {supportAmount} from './life-support.mjs?v=zone-zoom-20261020-105';
export function compartmentRefillQuote(state,draft,{gm=false}={}){
 const original=campaignRefillDraft(state).draft;
 let checked=original,purchased=A.rat(0),discarded=A.rat(0),changed=false;
 const compartments={};
 for(const key of ['internal','cargo']){
  const before=supportAmount(original[key]);let after=before,removed=A.rat(0),loaded=A.rat(0);
  if(draft.changed?.[key]){
   checked=editRefillDraft(checked,key,supportAmount(draft[key]));
   const requested=supportAmount(checked[key]);
   if(gm)after=requested;
   else if(key==='cargo'&&original.cargoBatches){if(A.cmp(requested,before)<0)throw Error('Use GM Adjustment to reduce cargo reserves.');loaded=A.sub(requested,before);after=requested;}
   else{
    const whole=A.floor(before);
    if(A.cmp(requested,whole)<0)throw Error('Use GM Adjustment to reduce supplies; paid refill only adds supplies.');
    // Merely selecting the displayed current whole number is not a refill.
    if(A.cmp(requested,whole)>0){removed=A.sub(before,whole);loaded=A.sub(requested,whole);after=requested;}
   }
  }
  if(A.cmp(before,after)!==0)changed=true;
  purchased=A.add(purchased,loaded);discarded=A.add(discarded,removed);
  compartments[key]={before:A.auditNumber(before),after:A.auditNumber(after),discarded:A.auditNumber(removed),loaded:A.auditNumber(loaded)};
 }
 const price=gm?{amount:'0',comfortAmount:'0',supplyAmount:'0'}:consumableRefillQuote(state,{purchasedUnits:purchased,comfortCost:draft.comfortCredits,comfortNote:draft.comfortNote});
 if(!gm&&A.credit(price.amount)>A.credit(state.bank))throw Error('Insufficient funds for this refill.');
 let transferred=A.rat(0);
 if(original.cargoBatches){const allocation={internal:compartments.internal.after,cargo:compartments.cargo.after,total:A.auditNumber(A.add(supportAmount(compartments.internal.after),supportAmount(compartments.cargo.after)))},moved=consumeReserveCompartments(allocation,0,original.internalCapacity);compartments.internal.after=moved.internal;compartments.cargo.after=moved.cargo;transferred=supportAmount(moved.transferred);}
 const after=A.add(supportAmount(compartments.internal.after),supportAmount(compartments.cargo.after));
 return {...price,pricingModel:'compartments-v1',cargoBatches:original.cargoBatches,transferredUnits:A.auditNumber(transferred),gm,changed:changed||!gm&&A.credit(price.comfortAmount)>0n,compartments,purchasedUnits:A.auditNumber(purchased),discardedUnits:A.auditNumber(discarded),afterStockUnits:A.auditNumber(after),afterCargoUnits:compartments.cargo.after,reason:String(draft.reason??'').trim(),capacityHours:state.ship.lifeSupport.capacityHours};
}

export function refillPricingAudit(q){
 if(q.gm)return [['Accounting','GM inventory adjustment; no purchase or comfort charge']];
 const exact=value=>{const n=supportAmount(value);return n.d===1n?String(n.n):String(n.n)+' / '+String(n.d);};
 return [['Middle people / Cr per 28 days',q.middle+' / '+q.rates.middle],['High people / Cr per 28 days',q.high+' / '+q.rates.high],['Occupied frozen Low / Cr per 28 days',q.low+' / '+q.rates.low],['Daily consumption - exact LSS',exact(q.dailyUnits)],['Purchased duration - exact days',exact(q.days)],['Consumables - exact Cr',exact(q.exactAmount)],['Consumables charged - Cr',q.supplyAmount],['Comfort charged - Cr',q.comfortAmount],['Credit rounding','Each supply/comfort charge rounded up to Cr '+q.roundingStep+' once'],['Reserve transfer - exact LSS',exact(q.transferredUnits??0)],['Fraction policy',q.cargoBatches?'Cargo changes by full 100-LSS batches; legacy cargo fractions stay exact. Internal purchase fraction policy is unchanged.':'Only a compartment receiving purchased whole LSS discards its prior fraction; other stock stays exact']];
}
