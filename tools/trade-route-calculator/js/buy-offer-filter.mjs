import * as A from './amounts.mjs';

// Compare the actual saved quote, not a possibly stale pre-override table percent.
export function buyOfferRetailRatio(offer){
 if(offer?.manualRequired||offer?.unitPrice==null||offer?.audit?.basePrice==null)return null;
 try{const price=A.dec(offer.unitPrice),base=A.dec(offer.audit.basePrice);return A.cmp(price,0)>=0&&A.cmp(base,0)>0?A.div(price,base):null;}catch{return null;}
}
export function matchesBuyRetailFilter(offer,enabled){
 const ratio=buyOfferRetailRatio(offer);
 return !enabled||ratio===null||A.cmp(ratio,'0.95')<=0;
}
export function buyOfferRetailLabel(offer){
 const ratio=buyOfferRetailRatio(offer);
 if(ratio===null)return 'Unknown';
 // Display two decimal places without letting display rounding decide inclusion.
 return A.decimal(A.rat(A.floor(A.mul(ratio,10000)),100))+'%';
}
