// Original bounded male Clan Share asset procedure. Aliens Vol1 Update2026 p47.
// These input bounds are implementation limits, not printed weapon or TL limits.
export const CLAN_SHARE_ASSET_RULES=Object.freeze({valuePerShare:10000,nameMaxLength:120,maxItems:20,minItemQuantity:1,maxItemQuantity:100,minUnitCost:1,maxUnitCost:1000000000,minTL:0,maxTL:40,sourceReferenceMaxLength:160,reasonMaxLength:500,weaponsRequireGM:true,valuationBasis:'share-redemption-not-resale'});
const need=(v,message)=>{if(!v)throw Error(message);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed,message)=>need(object(v)&&Object.keys(v).every(k=>allowed.includes(k)),message);
const integer=(v,min,max,label)=>{need(Number.isSafeInteger(v)&&v>=min&&v<=max,label+' is out of range.');return v;};
const text=(v,max,label)=>{need(typeof v==='string'&&v.trim().length>0&&v.length<=max,label+' must be a nonempty string of at most '+max+' characters.');return v.trim();};
export function clanShareAssets({kind,quantity,payload,gm=false}={}){
 const limits=CLAN_SHARE_ASSET_RULES;integer(quantity,1,100000000,'Share quantity');const budget=quantity*limits.valuePerShare;
 if(kind==='art'){
  keys(payload,['kind','inputs','name'],'Use only share inputs and an art description.');
  const name=text(payload.name,limits.nameMaxLength,'Art description');
  return {budget,assessedValue:budget,unusedValue:0,unusedValueDisposition:'none',sourceVerification:{method:'source-derived',source:{id:'aliens',page:47}},lowerValueAcceptance:null,items:[{name,category:'art',quantity:1,assessedValue:budget,valuationBasis:limits.valuationBasis}]};
 }
 need(kind==='weapons','Choose art or weapons for this asset procedure.');
 keys(payload,['kind','inputs','items','sourceConfirmed','sourceReason','lowerValueAcceptance'],'Use only weapon items, source verification and any explicit lower-value ruling.');
 need(gm,'Enable GM mode to record referee-confirmed weapon sources.');need(payload.sourceConfirmed===true,'Explicitly confirm the selected weapons, quantities, prices, TLs and total against their sources.');
 const reason=text(payload.sourceReason,limits.reasonMaxLength,'Weapon source reason');
 need(Array.isArray(payload.items)&&payload.items.length>0&&payload.items.length<=limits.maxItems,'Select 1–'+limits.maxItems+' weapon item rows.');
 const items=payload.items.map(item=>{
  keys(item,['name','quantity','unitCost','tl','sourceReference'],'Use only the weapon description, quantity, unit price, TL and source reference.');
  const name=text(item.name,limits.nameMaxLength,'Weapon description'),count=integer(item.quantity,limits.minItemQuantity,limits.maxItemQuantity,'Item quantity'),unitCost=integer(item.unitCost,limits.minUnitCost,limits.maxUnitCost,'Weapon unit price'),tl=integer(item.tl,limits.minTL,limits.maxTL,'Weapon TL'),sourceReference=text(item.sourceReference,limits.sourceReferenceMaxLength,'Weapon source reference');
  return {name,category:'weapon',quantity:count,unitCost,tl,sourceReference,assessedValue:count*unitCost,valuationBasis:'referee-confirmed-item-prices'};
 });
 const assessedValue=items.reduce((n,item)=>n+item.assessedValue,0);need(Number.isSafeInteger(assessedValue)&&assessedValue<=budget,'Selected weapons exceed the share-derived budget. Cash supplementation is not supported.');
 const unusedValue=budget-assessedValue;let lowerValueAcceptance=null;
 if(unusedValue){
  keys(payload.lowerValueAcceptance,['confirmed','reason'],'The selected weapons are below budget. Keep the shares or record a typed GM acceptance of lower value.');
  need(payload.lowerValueAcceptance.confirmed===true,'Explicitly accept the lower-value exception before surrendering unused value.');
  lowerValueAcceptance={confirmed:true,reason:text(payload.lowerValueAcceptance.reason,limits.reasonMaxLength,'Lower-value referee reason'),unusedValue,interpretation:'referee-exception'};
 }else need(!Object.hasOwn(payload,'lowerValueAcceptance'),'An exact-value exchange needs no lower-value exception.');
 return {budget,assessedValue,unusedValue,unusedValueDisposition:unusedValue?'surrendered':'none',sourceVerification:{method:'referee-confirmed',confirmed:true,reason,catalogChecked:false},lowerValueAcceptance,items};
}
