import {sourceReference} from './rules-presentation.mjs';
// Display-only adapter: identities and quantities come from the engine contract.
const number = new Intl.NumberFormat('en-US',{maximumFractionDigits:9});
export const magazineProductId = item => item.productId ?? item.sourceWeaponId+':'+(item.variant??item.id);
export const magazineVariantLabel = variant => variant==='high-capacity'?'High-capacity':'Standard';
export const magazineProductLabel = item => `${item.sourceWeaponLabel||'Unavailable magazine source'} / ${magazineVariantLabel(item.variant??item.id)}`;
export function magazineProductFacts(product) {
 if(!product)return 'Compatibility unresolved';
 return [Number.isFinite(product.capacity)?`${number.format(product.capacity)} rounds`:'Capacity unresolved',Number.isFinite(product.unitCost)?`Cr ${number.format(product.unitCost)} each`:'Price unresolved',Number.isFinite(product.estimate?.unitMassKg)?`${number.format(product.estimate.unitMassKg)} kg estimated; source-magazine basis`:'Mass estimate unresolved',product.qualification?.refereeMayReject?'High-capacity: referee approval required':''].filter(Boolean).join(' · ');
}
export function magazineProductSources(product) {
 return [...new Set([product?.source,product?.estimate?.source,product?.interchangeSource,product?.qualification?.source].map(sourceReference).filter(Boolean))].join(' · ');
}
export function magazinePanelModel(record,selection,control) {
 if(!selection)return null;
 const products=selection.products||[],supplies=record[selection.alternateSuppliesField]||[];
 if(!products.length&&!Object.hasOwn(record,selection.initialSourceField)&&!supplies.length)return null;
 const sourceChoices=selection.sources.map(item=>({...item,eligibility:{available:item.available}}));
 if(!sourceChoices.some(item=>item.id===record.weaponId))sourceChoices.unshift({id:record.weaponId,label:control.itemFields?.find(item=>item.field==='weaponId')?.choices?.find(item=>item.id===record.weaponId)?.label||'Receiving weapon'});
 const available=products.filter(product=>selection.sources.some(source=>source.id===product.sourceWeaponId&&source.alternateAllowed));
 const choice=product=>({id:magazineProductId(product),label:magazineProductLabel(product)});
 const storageChoices=control.itemFields?.find(item=>item.field==='spareMagazineStorageId')?.choices||[];
 const rows=supplies.map((supply,index)=>{
  const productId=magazineProductId(supply),product=available.find(item=>magazineProductId(item)===productId);
  const choices=available.filter(item=>!supplies.some((other,i)=>i!==index&&magazineProductId(other)===magazineProductId(item))).map(choice);
  if(!choices.some(item=>item.id===productId))choices.push({id:productId,label:magazineProductLabel({sourceWeaponLabel:sourceChoices.find(source=>source.id===supply.sourceWeaponId)?.label,variant:supply.variant}),eligibility:{available:false}});
  const storage=[...storageChoices];
  if(!storage.some(item=>item.id===supply.storageId))storage.push({id:supply.storageId,label:'Unavailable storage',eligibility:{available:false}});
  return {index,supply:structuredClone(supply),productId,product:product?structuredClone(product):null,choices,storageChoices:storage};
 });
 return {visible:true,forceGroupOpen:selection.forceGroupOpen||rows.some(row=>!row.product||!storageChoices.some(choice=>choice.id===row.supply.storageId)),sourceChoices,initialSourceId:selection.initialSourceId,initialProduct:products.find(product=>product.sourceWeaponId===selection.initialSourceId&&product.id===(record.initialMagazineType??'standard'))??null,rows,
  addChoices:available.filter(product=>!supplies.some(item=>magazineProductId(item)===magazineProductId(product))).map(choice),products:structuredClone(available),maximumAlternateProducts:selection.maximumAlternateProducts,numericControls:structuredClone(selection.numericControls)};
}
