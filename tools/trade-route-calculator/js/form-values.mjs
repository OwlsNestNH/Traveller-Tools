import {cmp} from './amounts.mjs';
import {up} from './rounding.mjs?v=expanded-map-20261010-32';

// Normalize one entry without campaign, DOM, transaction or validation state.
// The exact-remainder exception preserves historical fractional full sales.
// Non-Credit metadata retains the existing whole-unit path; field builders
// remain responsible for declaring supported units explicitly.
export function normalizeAmount(raw,{unit,creditStep=1,exactRemainder}={}) {
 if(exactRemainder!==undefined&&cmp(raw,exactRemainder)===0)return {value:raw,rounding:null};
 const after=String(up(raw,unit==='credits'?creditStep:1));
 return cmp(raw,after)?{value:after,rounding:{before:raw,after}}:{value:raw,rounding:null};
}

// The adapter accepts the opted-in fields, not a document or a campaign.
// Preserve sequential mutation: a later invalid entry must not erase earlier
// normalized values or their annotations, including a Settings-owned array.
export function normalizeAmountFields(fields,{creditStep=1,rounding=[]}={}) {
 for(const field of fields) {
  if(field.disabled||field.value==='')continue;
  const result=normalizeAmount(field.value,{unit:field.dataset.round,creditStep,exactRemainder:field.dataset.roundExact});
  if(result.rounding) {
   rounding.push({label:field.dataset.roundLabel,...result.rounding});
   field.value=result.value;
  }
 }
 return rounding;
}
