import * as A from './amounts.mjs';
import * as R from './rules.mjs?v=hex-labels-20261020-102';

// One referee override boundary: validate normalized entries and optionally
// quote using the submitted roll/legality, then apply to a caller-owned offer.
// Preserve validation -> quote -> draft mutation ordering. No random roll,
// re-rounding, IDs, campaign lookup, revision, persistence or Undo ownership.
// Optional rules binding preserves application harness quote observations.
export function prepareMarketOfferOverride({values,commodity,world,options,creditStep,core},rules=R){
 if(!values.reason.trim()||A.cmp(values.quantity,0)<0||A.cmp(values.price,0)<0)throw Error('Valid values and reason required');
 const recalculated=values.useRoll?rules.quote(core.commodities.find(g=>g.id===commodity),world,{...options,creditStep,side:'buy',rollTotal:Number(values.roll),illegalGood:values.illegal},core):null;
 return {values,recalculated};
}

// Use only in the existing validated transition/act draft. Prepared values
// retain entered reason/description and quote audit; this action returns void.
export function applyMarketOfferOverride(o,hours,{values,recalculated}){
 o.overrides??=[];
 o.overrides.push({hours,reason:values.reason,before:{remaining:o.remaining,unitPrice:o.unitPrice},after:{remaining:A.decimal(values.quantity),unitPrice:recalculated?recalculated.unitPrice:A.decimal(values.price)}});
 o.remaining=A.decimal(values.quantity);
 o.unitPrice=recalculated?recalculated.unitPrice:A.decimal(values.price);
 if(recalculated){o.previousAudits??=[];o.previousAudits.push(o.audit);o.audit={...o.audit,...recalculated.audit};}
 o.expirationNote=values.expirationNote;
 o.description=values.description;
 o.illegal=values.illegal;
 o.manualRequired=false;
}
