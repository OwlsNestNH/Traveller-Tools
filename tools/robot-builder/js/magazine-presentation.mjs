import {sourceReference} from './rules-presentation.mjs';
// Display-only adapter: identities and quantities come from the engine contract.
const number = new Intl.NumberFormat('en-US',{maximumFractionDigits:9});
const modificationLabels={'standard':'Standard','armour-piercing':'Armour Piercing','solid-shot':'Solid Shot','apds':'APDS','baton':'Baton','extended-range':'Extended Range'};
export const ammunitionModificationLabel = modification => modificationLabels[modification??'standard']||'Unavailable ammunition modification';
const modified = item => item?.modification!=null&&item.modification!=='standard';
export const magazineProductId = item => item.productId ?? item.sourceWeaponId+':'+(item.variant??item.id)+(modified(item)?':'+item.modification:'');
export const magazineVariantLabel = variant => variant==='high-capacity'?'High-capacity':variant==='standard'?'Standard':'Unavailable capacity variant';
export const magazineProductLabel = item => (item.sourceWeaponLabel||'Unavailable magazine source')+' / '+magazineVariantLabel(item.variant??item.id)+(modified(item)?' / '+(item.modificationLabel||ammunitionModificationLabel(item.modification)):'');
export function magazineProductFacts(product) {
 if(!product)return 'Compatibility unresolved; price unresolved; mass estimate unresolved; source unresolved';
 return [Number.isFinite(product.capacity)?number.format(product.capacity)+' rounds':'Capacity unresolved',Number.isFinite(product.unitCost)?'Cr '+number.format(product.unitCost)+' each':'Price unresolved',Number.isFinite(product.estimate?.unitMassKg)?number.format(product.estimate.unitMassKg)+' kg estimated; '+(modified(product)?'Standard-load-based estimate; modified mass unresolved':'source-magazine basis'):'Mass estimate unresolved',!sourceReference(product.source)?'Source unresolved':'',(product.available===false||product.eligibility?.available===false)?'Unavailable selection':'',product.qualification?.refereeMayReject?'High-capacity: referee approval required':''].filter(Boolean).join(' · ');
}
export function magazineProductSources(product) {
 return [...new Set([product?.source,product?.modificationSource,product?.estimate?.source,product?.interchangeSource,product?.qualification?.source].map(sourceReference).filter(Boolean))].join(' · ');
}
export function magazinePanelModel(record,selection,control) {
 if(!selection)return null;
 const products=selection.products||[],supplies=record[selection.alternateSuppliesField]||[],sources=selection.sources||[];
 if(!products.length&&!Object.hasOwn(record,selection.initialSourceField)&&!supplies.length)return null;
 const sourceChoices=sources.map(item=>({...item,eligibility:{available:item.available}}));
 if(!sourceChoices.some(item=>item.id===record.weaponId))sourceChoices.unshift({id:record.weaponId,label:control.itemFields?.find(item=>item.field==='weaponId')?.choices?.find(item=>item.id===record.weaponId)?.label||'Receiving weapon'});
 const available=products.filter(product=>product.alternateAllowed??sources.some(source=>source.id===product.sourceWeaponId&&source.alternateAllowed));
 const choice=product=>({id:magazineProductId(product),label:magazineProductLabel(product),...(product.eligibility?{eligibility:structuredClone(product.eligibility)}:product.available===false?{eligibility:{available:false}}:{})});
 const storageChoices=control.itemFields?.find(item=>item.field==='spareMagazineStorageId')?.choices||[];
 const rows=supplies.map((supply,index)=>{
  const productId=magazineProductId(supply),product=available.find(item=>magazineProductId(item)===productId);
  const choices=available.filter(item=>!supplies.some((other,i)=>i!==index&&magazineProductId(other)===magazineProductId(item))).map(choice);
  if(!choices.some(item=>item.id===productId))choices.push({id:productId,label:magazineProductLabel({...supply,sourceWeaponLabel:sourceChoices.find(source=>source.id===supply.sourceWeaponId)?.label}),eligibility:{available:false}});
  const storage=[...storageChoices];
  if(!storage.some(item=>item.id===supply.storageId))storage.push({id:supply.storageId,label:'Unavailable storage',eligibility:{available:false}});
  return {index,supply:structuredClone(supply),productId,product:product?structuredClone(product):null,choices,storageChoices:storage};
 });
 const initialProductId=magazineProductId({sourceWeaponId:selection.initialSourceId,variant:record.initialMagazineType??'standard',modification:record.initialAmmunitionModification});
 return {visible:true,forceGroupOpen:selection.forceGroupOpen||rows.some(row=>!row.product||row.product.available===false||row.product.eligibility?.available===false||!storageChoices.some(choice=>choice.id===row.supply.storageId)),sourceChoices,initialSourceId:selection.initialSourceId,initialProduct:structuredClone(products.find(product=>magazineProductId(product)===initialProductId)??null),rows,
  addChoices:available.filter(product=>!supplies.some(item=>magazineProductId(item)===magazineProductId(product))).map(choice),products:structuredClone(available),maximumAlternateProducts:selection.maximumAlternateProducts,numericControls:structuredClone(selection.numericControls)};
}
