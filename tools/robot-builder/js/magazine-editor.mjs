import {magazinePanelModel,magazineProductId,magazineProductFacts,magazineProductSources} from './magazine-presentation.mjs';
// DOM adapter only. Opening/picking never edits the design until a field or Add changes.
export function renderMagazinePanel({record,selection,control,prefix,shared,groupKey,recordGroups,onChange,el,selectChoices,numericPicker}) {
 const model=magazinePanelModel(record,selection,control);if(!model)return null;
 const panel=el('details',undefined,'wide parameter-group');panel.id=prefix+'-compatible-magazines';
 panel.open=model.forceGroupOpen||(recordGroups.get(groupKey)??false);
 panel.addEventListener('toggle',()=>recordGroups.set(groupKey,panel.open));
 panel.append(el('summary',(shared?'Shared · ':'')+'Compatible magazines'));
 const content=el('div',undefined,'fields-grid'),sourceRow=el('label','Initial magazine source'),source=el('select');source.id=prefix+'-'+selection.initialSourceField;sourceRow.htmlFor=source.id;
 selectChoices(source,model.sourceChoices,model.initialSourceId);
 source.addEventListener('change',()=>onChange(selection.initialSourceField,source.value===record.weaponId?undefined:source.value));sourceRow.append(source);content.append(sourceRow);
 const initialFacts=el('output',magazineProductFacts(model.initialProduct),'wide derived-value');initialFacts.id=source.id+'-facts';content.append(initialFacts);
 const initialSource=magazineProductSources(model.initialProduct);if(initialSource)content.append(el('p',initialSource,'wide source'));
 const supplies=record[selection.alternateSuppliesField]||[];
 const productSelection=product=>({sourceWeaponId:product.sourceWeaponId,variant:product.variant??product.id,modification:product.modification&&product.modification!=='standard'?product.modification:undefined});
 const updateRow=(index,patch)=>onChange(selection.alternateSuppliesField,supplies.map((row,i)=>i===index?Object.fromEntries(Object.entries({...row,...patch}).filter(([,value])=>value!==undefined)):row));
 for(const selected of model.rows){
  const index=selected.index,rowPrefix=prefix+'-'+selection.alternateSuppliesField+'-'+index,card=el('div',undefined,'wide option-settings'),fields=el('div',undefined,'fields-grid');
  const productRow=el('label','Additional magazine product'),product=el('select');product.id=rowPrefix+'-product';productRow.htmlFor=product.id;selectChoices(product,selected.choices,selected.productId);
  product.addEventListener('change',()=>{const chosen=model.products.find(item=>magazineProductId(item)===product.value);if(chosen)updateRow(index,productSelection(chosen));});productRow.append(product);fields.append(productRow);
  for(const [field,label] of [['extraMagazines','Total extras per weapon'],['autoloadMagazines','Allocated to loader']]){
   const inputRow=el('label',label),input=numericPicker(model.numericControls[field],selected.supply[field],value=>updateRow(index,{[field]:value}));input.id=rowPrefix+'-'+field;inputRow.htmlFor=input.id;inputRow.append(input);fields.append(inputRow);
  }
  const storageRow=el('label','Reserve storage (estimated)'),storage=el('select');storage.id=rowPrefix+'-storageId';storageRow.htmlFor=storage.id;selectChoices(storage,selected.storageChoices,selected.supply.storageId);storage.addEventListener('change',()=>updateRow(index,{storageId:storage.value}));storageRow.append(storage);fields.append(storageRow);
  const facts=el('output',magazineProductFacts(selected.product),'wide derived-value');facts.id=rowPrefix+'-facts';fields.append(facts);
  const references=magazineProductSources(selected.product);if(references)fields.append(el('p',references,'wide source'));
  const remove=el('button','Remove magazine product');remove.type='button';remove.id=rowPrefix+'-remove';remove.addEventListener('click',()=>{const remaining=supplies.filter((_,i)=>i!==index);onChange(selection.alternateSuppliesField,remaining.length?remaining:undefined);});
  card.append(fields,remove);content.append(card);
 }
 if(model.addChoices.length&&supplies.length<model.maximumAlternateProducts){
  const pickerRow=el('label','Add compatible spares'),picker=el('select');picker.id=prefix+'-'+selection.alternateSuppliesField+'-add-product';pickerRow.htmlFor=picker.id;selectChoices(picker,model.addChoices,'','Choose a magazine product');pickerRow.append(picker);
  const add=el('button','Add magazine product');add.type='button';add.id=prefix+'-'+selection.alternateSuppliesField+'-add';add.disabled=true;picker.addEventListener('change',()=>{add.disabled=!picker.value;});
  add.addEventListener('click',()=>{const product=model.products.find(item=>magazineProductId(item)===picker.value);if(product)onChange(selection.alternateSuppliesField,[...supplies,{...Object.fromEntries(Object.entries(productSelection(product)).filter(([,value])=>value!==undefined)),extraMagazines:0,autoloadMagazines:0,storageId:'none'}]);});content.append(pickerRow,add);
 }
 panel.append(content);return panel;
}
