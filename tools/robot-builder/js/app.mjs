import { createRobotApi } from './api.mjs';
import { renderReview } from './review.mjs';
import {renderMagazinePanel} from './magazine-editor.mjs';
import {sourceReference,diagnosticLabel,coverageLabel,sourceExampleLabel} from './rules-presentation.mjs';

const $ = id => document.getElementById(id);
const stages = [
  ['chassis', 'Chassis Size'], ['locomotion', 'Locomotion'],
  ['physical', 'Physical Options'], ['brain', 'Robot Brain'],
  ['skills', 'Skill Packages'], ['finalisation', 'Finalisation'],
];
const categories = [
  ['chassis-modifications', 'Chassis Modifications'],
  ['locomotive-modifications', 'Locomotive Modifications'],
  ['manipulator-modification', 'Manipulator Modification'],
  ['default-suites', 'Default Suites'], ['zero-slot-options', 'Zero-Slot Options'],
  ['slot-cost-options', 'Slot Cost Options'], ['weapons', 'Weapons'],
];
let api;
let view;
let pointerActive = false;
let deferredView = null;
let currentStage = 'chassis';
let physicalCategory = 'chassis-modifications';
const searches = new Map();
const customDrafts = new Map();
const recordGroups = new Map();
const ammunitionCopies = new Map();
const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function notify(message, error = false) {
  $('notice').textContent = message;
  $('notice').classList.toggle('error', error);
}
async function safely(action, success) {
  try {
    const result = await action();
    if (success) notify(success);
    return result;
  } catch (error) {
    notify(error.message || 'This action could not be completed.', true);
    if (api) render(api.getView());
    return null;
  }
}
function option(id, label) { const node = el('option', label); node.value = id??''; return node; }
function numericPicker(control, value, onChange) {
  const min = Number(control.min), max = Number(control.max), step = Number(control.step ?? 1);
  const count = Math.floor((max - min) / step) + 1;
  if (Number.isFinite(min) && Number.isFinite(max) && step > 0 && count > 0 && count <= 1001) {
    const input = el('select');
    selectChoices(input, Array.from({ length: count }, (_, i) => ({ id: min + i * step, label: String(min + i * step) })), value);
    input.addEventListener('change', () => onChange(input.value === '' ? null : Number(input.value)));
    return input;
  }
  const input = el('input'); input.type = 'number'; input.value = value ?? '';
  for (const key of ['min', 'max', 'step']) if (control[key] !== undefined) input[key] = control[key];
  input.addEventListener('change', () => onChange(input.value === '' ? null : Number(input.value)));
  return input;
}
function choiceLabel(choice) { return choice.label + (choice.eligibility?.available === false ? ' (unavailable)' : choice.implemented === false ? ' (not yet implemented)' : ''); }
const sourceText = sourceReference;

function selectChoices(select, choices, selected, placeholder = 'Choose an option') {
  const prompt = option('', placeholder); prompt.disabled = true;
  select.replaceChildren(...((choices||[]).some(choice=>choice.id==null||choice.id==='')?[]:[prompt]));
  for (const choice of choices || []) select.append(option(choice.id, choiceLabel(choice)));
  if (selected !== undefined && selected !== null && selected !== '' && ![...select.options].some(item => item.value === String(selected))) {
    select.append(option(selected, `${selected} · unavailable selection`));
  }
  select.value = selected ?? '';
}
function updateIdentity() {
  selectChoices($('robot-kind'), view.catalogue.kinds, view.design.kind, 'Choose robot type');
  $('robot-name').value = view.design.name || '';
  const levels = view.catalogue.techLevels || [];
  selectChoices($('robot-tl'), levels.map(item => typeof item === 'number' ? { id: item, label: `TL ${item}` } : item), view.design.techLevel, 'Choose TL');
  const kind = view.catalogue.kinds.find(item => item.id === view.design.kind);
  $('type-note').textContent = kind?.implemented===false?'Construction path not implemented':'Construction preview; coverage incomplete';
}
function renderNavigation() {
  $('stage-nav').replaceChildren(...stages.map(([id, label], i) => {
    const button = el('button', undefined, id === currentStage ? 'stage-button active' : 'stage-button');
    button.type = 'button';
    button.append(el('span', String(i + 1), 'stage-number'), el('span', label));
    button.setAttribute('aria-controls', 'stage-panel');
    if (id === currentStage) button.setAttribute('aria-current', 'step');
    button.addEventListener('click', () => {
      currentStage = id;
      renderNavigation();
      renderStage();
      $('stage-panel').focus({ preventScroll: true });
      if(window.matchMedia('(max-width:800px)').matches) $('stage-panel').scrollIntoView({block:'start',behavior:'instant'});
    });
    return button;
  }));
}
function selectedValue(control) { return control.target === 'special' ? view.design.special?.[control.field] : view.design.selections?.[currentStage]?.[control.field]; }
function submitSelection(control, value, completedDraftKey) {
  return safely(() => {
    const draft = completedDraftKey === undefined ? undefined : customDrafts.get(completedDraftKey);
    // The API emits synchronously. Reset for its successful render, but restore
    // the complete composer before safely redraws any rejected Add.
    if (completedDraftKey !== undefined) customDrafts.delete(completedDraftKey);
    try { return api.select({ stage: currentStage, field: control.field, value }); }
    catch (error) { if (draft !== undefined) customDrafts.set(completedDraftKey, draft); throw error; }
  });
}
function recordChoices(field,record,fieldView={}) {
  const choices=fieldView.choices??field.choicesBy?.values?.[record?.[field.choicesBy.field]]??field.choices??[];
  return field.maxValueField && Number.isFinite(record?.[field.maxValueField]) ? choices.filter(choice=>typeof choice.id!=='number'||choice.id<=record[field.maxValueField]) : choices;
}
function dependsOn(rule,key){return rule?.field===key || rule?.allOf?.some(item=>dependsOn(item,key)) || rule?.anyOf?.some(item=>dependsOn(item,key));}
function renderControl(control, choicesOverride) {
  const field = el('div', undefined, 'field');
  const id = ['field',currentStage,control.field,control.category && String(control.category).toLowerCase().replace(/[^a-z0-9_-]+/g,'-')].filter(Boolean).join('-');
  const label = el('label', control.label); label.htmlFor = id; field.append(label);
  const choices = choicesOverride || control.choices || [];
  const selected = control.readOnly && Object.hasOwn(control,'derivedValue') ? control.derivedValue : selectedValue(control) ?? control.default;
  if(control.readOnly){
    const output=el('output',choices.find(choice=>choice.id===selected)?.label ?? (selected===undefined||selected===null?'Not calculated':String(selected)),'derived-value');output.id=id;
    field.append(output,el('p','Derived from component designs','help'));
    const source=sourceText(control.source);if(source)field.append(el('small',source,'source'));
    return field;
  }
  if (control.type === 'option-parameters') {
    field.classList.add('wide');
    const all = view.design.selections.physical;
    const settings = selected || {};
    const installed = new Set([...(all.options || []),...(all.defaultSuite || [])]);
    let shown=0;
    for(const choice of choices.filter(item=>installed.has(item.id))) {
      const controls=(choice.parameterControls || []).filter(item=>(!control.paramContext || !item.appliesTo || item.appliesTo===control.paramContext) && (!item.appliesTo || item.appliesTo==='options'&&(all.options||[]).includes(choice.id) || item.appliesTo==='defaultSuite'&&(all.defaultSuite||[]).includes(choice.id)));
      if(!controls.length)continue;
      shown++;
      const card=el('div',undefined,'option-settings');card.append(el('h4',choice.label));
      const grid=el('div',undefined,'fields-grid');
      for(const item of controls) {
        const row=el('label',item.label);const fieldId=id+'-'+choice.id+'-'+item.field;row.htmlFor=fieldId;
        const value=settings[choice.id]?.[item.field] ?? item.default ?? '';
        const change=value=>submitSelection(control,{...settings,[choice.id]:{...(settings[choice.id]||{}),[item.field]:value}});
        let input;
        if(item.type==='number') input=numericPicker(item,value,change);
        else if(item.type==='select') {input=el('select');selectChoices(input,item.choices,value);input.addEventListener('change',()=>change(item.choices.find(c=>String(c.id)===input.value)?.id??null));}
        else {input=el('input');input.type='text';input.value=value;input.maxLength=item.maxLength||200;input.addEventListener('change',()=>change(input.value));}
        input.id=fieldId;row.append(input);grid.append(row);
      }
      card.append(grid);if(choice.source)card.append(el('p',sourceText(choice.source),'source'));field.append(card);
    }
    if(!shown)return el('span',undefined,'empty-settings');
  } else if (control.type === 'option-instances') {
    field.replaceChildren();field.classList.add('wide');
    const installed=Array.isArray(selected)?selected:[];
    const local=installed.filter(record=>choices.some(choice=>choice.id===record.optionId));
    const details=el('details');details.open=local.length>0||control.expandByDefault===true;
    details.append(el('summary',(control.summaryLabel||'Separate copies with different settings')+(local.length?' ('+local.length+')':'')));
    details.append(el('p','Separate copies: individual settings. Quantity: identical copies.','help'));
    const parametersFor=choice=>(choice?.parameterControls||[]).filter(item=>!item.appliesTo||item.appliesTo==='options');
    const makeParameters=(choice,parameters,prefix,onChange)=>{
      const grid=el('div',undefined,'fields-grid');const groups=new Map();
      const targetFor=item=>{
        if(!item.group)return grid;
        if(!groups.has(item.group)){
          const details=el('details',undefined,'wide parameter-group');
          details.open=parametersFor(choice).filter(field=>field.group===item.group).some(field=>Object.hasOwn(parameters,field.field)&&JSON.stringify(parameters[field.field])!==JSON.stringify(field.default));
          details.append(el('summary',item.group));const content=el('div',undefined,'fields-grid');details.append(content);grid.append(details);groups.set(item.group,content);
        }
        return groups.get(item.group);
      };
      for(const item of parametersFor(choice)){
        if(!matchesVisibility(item,parameters))continue;
        const row=el('label',item.label);const inputId=prefix+'-'+item.field;row.htmlFor=inputId;
        const value=parameters[item.field]??item.default??'';let input;
        if(item.type==='multiselect'){
          input=el('div',undefined,'record-multiselect');let values=Array.isArray(value)?[...value]:[];
          const draw=()=>{
            const picker=el('div',undefined,'option-picker'),select=el('select'),add=el('button','Add');
            select.setAttribute('aria-label',item.label||item.field);add.type='button';
            selectChoices(select,(item.choices||[]).filter(choice=>!values.includes(choice.id)),'');
            add.disabled=true;select.addEventListener('change',()=>{add.disabled=!select.value||values.length>=(item.maxItems||200);});
            add.addEventListener('click',()=>{values.push(select.value);onChange(item.field,[...values]);draw();});
            picker.append(select,add);const list=el('div',undefined,'installed-list');
            for(const value of values){
              const choice=item.choices?.find(choice=>choice.id===value),entry=el('div',undefined,'installed-row'),remove=el('button','Remove');
              remove.type='button';remove.setAttribute('aria-label','Remove '+(choice?.label||value));
              remove.addEventListener('click',()=>{values=values.filter(id=>id!==value);onChange(item.field,[...values]);draw();});
              entry.append(el('span',choice?.label||value),remove);list.append(entry);
            }
            const search=el('input');search.type='search';search.placeholder='Find a book option';search.setAttribute('aria-label','Search '+(item.label||item.field));
            search.addEventListener('input',()=>{
              const query=search.value.toLowerCase();selectChoices(select,(item.choices||[]).filter(choice=>!values.includes(choice.id)&&choice.label.toLowerCase().includes(query)),'');add.disabled=true;
            });
            input.replaceChildren(...((item.choices||[]).length>30?[search]:[]),picker,list);
          };draw();row.classList.add('wide');
        }else if(item.type==='number')input=numericPicker(item,value,value=>onChange(item.field,value));
        else if(item.type==='select'){
          input=el('select');selectChoices(input,item.choices,value);
          input.addEventListener('change',()=>onChange(item.field,item.choices.find(c=>String(c.id)===input.value)?.id??null));
        }else{
          input=el('input');input.type='text';input.value=value;input.maxLength=item.maxLength||120;
          input.addEventListener('change',()=>onChange(item.field,input.value));
        }
        input.id=inputId;row.append(input);targetFor(item).append(row);
      }
      return grid;
    };
    for(const record of local){
      const choice=choices.find(choice=>choice.id===record.optionId);
      const card=el('div',undefined,'option-settings');const heading=el('div',undefined,'manipulator-heading');
      heading.append(el('h4',choice.label));const remove=el('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove separate '+choice.label);
      remove.addEventListener('click',()=>submitSelection(control,installed.filter(item=>item.id!==record.id)));
      heading.append(remove);card.append(heading);
      card.append(makeParameters(choice,record.parameters,id+'-'+record.id,(key,value)=>submitSelection(control,installed.map(item=>item.id===record.id?{...item,parameters:{...item.parameters,[key]:value}}:item))));
      card.append(el('p',sourceText(choice.source),'source'));details.append(card);
    }
    const draftKey=view.design.kind+':'+id;
    const draft=customDrafts.get(draftKey)||{optionId:'',parameters:{}};customDrafts.set(draftKey,draft);
    const composer=el('div',undefined,'option-settings');const picker=el('select');picker.id=id+'-new-optionId';
    picker.setAttribute('aria-label','Separate installation option');selectChoices(picker,choices,draft.optionId);
    const hint=el('p',undefined,'help source');const container=el('div');
    const add=el('button',control.addLabel||'Add separate installation');add.type='button';add.className='primary';
    const redraw=()=>{
      const choice=choices.find(item=>item.id===draft.optionId);
      hint.textContent=sourceText(choice?.source);add.disabled=!choice||installed.length>=(control.maxItems||100);
      container.replaceChildren(makeParameters(choice,draft.parameters,id+'-new',(key,value)=>{draft.parameters[key]=value;customDrafts.set(draftKey,draft);if(parametersFor(choice).find(item=>item.field===key)?.type!=='text')redraw();}));
    };
    picker.addEventListener('change',()=>{
      draft.optionId=picker.value;const choice=choices.find(item=>item.id===draft.optionId);
      draft.parameters=Object.fromEntries(parametersFor(choice).map(item=>[item.field,item.default??(item.type==='multiselect'?[]:item.type==='number'?item.min??0:item.type==='select'?item.choices?.[0]?.id:'')]));
      customDrafts.set(draftKey,draft);redraw();
    });
    add.addEventListener('click',()=>{
      const next={id:'eqp-'+globalThis.crypto.randomUUID(),optionId:draft.optionId,parameters:{...draft.parameters}};
      submitSelection(control,[...installed,next],draftKey);
    });
    composer.append(picker,hint,container,add);redraw();details.append(composer);field.append(details);
  } else if (control.type === 'design-references') {
    field.classList.add('wide');
    const installed=Array.isArray(selected)?selected:[];
    const roles=control.choices || control.itemFields?.find(item=>item.field==='role')?.choices || [];
    for(const record of installed){
      const card=el('div',undefined,'option-settings'),heading=el('div',undefined,'manipulator-heading');
      const name=record.design?.name || 'Unnamed component';
      heading.append(el('h4',name));
      const remove=el('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove referenced '+name);
      remove.addEventListener('click',()=>safely(()=>api.removeDesignReference(record.id),'Component reference removed from this draft.'));
      heading.append(remove);card.append(heading);
      card.append(el('p',[roles.find(role=>role.id===record.role)?.label||record.role,`TL ${record.design?.techLevel}`,`Quantity ${record.quantity}`].join(' · '),'help'));
      card.append(el('p','This is a copied design snapshot. Its construction is checked again with the current rules; the original saved design is unchanged.','help'));
      field.append(card);
    }
    const draftKey=view.design.kind+':'+id;
    const draft=customDrafts.get(draftKey)||{role:'',quantity:1,savedId:''};customDrafts.set(draftKey,draft);
    const grid=el('div',undefined,'fields-grid');
    const roleLabel=el('label','Component role'),role=el('select');role.id=id+'-role';roleLabel.htmlFor=role.id;selectChoices(role,roles,draft.role);roleLabel.append(role);grid.append(roleLabel);
    const quantityLabel=el('label','Identical copies');
    const quantity=numericPicker(control.quantityControl||{min:control.quantityMin||1,max:control.quantityMax||control.maxQuantity||1,step:1},draft.quantity,value=>{draft.quantity=value;});quantity.id=id+'-quantity';quantityLabel.htmlFor=quantity.id;quantityLabel.append(quantity);grid.append(quantityLabel);
    const savedLabel=el('label','Saved robot design'),savedPicker=el('select');savedPicker.id=id+'-saved';savedLabel.htmlFor=savedPicker.id;
    selectChoices(savedPicker,(view.savedDesigns||[]).map(item=>({id:item.id,label:`${item.name||'Unnamed robot'} (TL${item.techLevel})`})),draft.savedId,'Choose a saved design');savedLabel.append(savedPicker);grid.append(savedLabel);
    const actions=el('div',undefined,'row-actions wide');const add=el('button','Use saved component'),importButton=el('button','Import component JSON');add.type=importButton.type='button';add.className='primary';
    const fileInput=el('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true;fileInput.id=id+'-file';
    const update=()=>{draft.role=role.value;draft.savedId=savedPicker.value;const full=installed.length>=(control.maxItems||16);add.disabled=full||!draft.role||!draft.savedId;importButton.disabled=full||!draft.role;};
    role.addEventListener('change',update);savedPicker.addEventListener('change',update);update();
    add.addEventListener('click',()=>safely(()=>api.attachDesignReference({role:draft.role,quantity:draft.quantity,savedId:draft.savedId}),'Component snapshot added. Check its construction results below.'));
    importButton.addEventListener('click',()=>fileInput.click());
    fileInput.addEventListener('change',async()=>{
      const file=fileInput.files?.[0];if(!file)return;
      const revision=view.draftRevision,request={role:draft.role,quantity:draft.quantity};
      try{if(file.size>2*1024*1024)throw new Error('Choose a robot design smaller than 2 MB.');const json=await file.text();await safely(()=>api.attachDesignReference({...request,json,expectedRevision:revision}),'Component snapshot imported. Original saves are unchanged.');}
      catch(error){notify(error.message,true);}finally{fileInput.value='';}
    });
    actions.append(add,importButton,fileInput);grid.append(actions);field.append(grid);
  } else if (control.type === 'custom-packages' || control.type === 'weapons' || control.type === 'external-vehicle-options' || control.type === 'verified-vehicle-options') {
    field.classList.add('wide');
    const installed=Array.isArray(selected)?selected:[];
    const isWeapon = control.type === 'weapons';
    const isExternal = control.type === 'external-vehicle-options';
    if(control.collapseUnavailable && control.canAdd===false && installed.length===0){
      field.append(el('p',control.unavailableReason || 'Add the required component first.','help'));
      const add=el('button',control.addLabel || 'Add custom package');add.type='button';add.disabled=true;field.append(add);
      return field;
    }
    const recordLabel = record => {
      if(control.recordNameField){const field=control.itemFields?.find(item=>item.field===control.recordNameField),name=recordChoices(field||{},record).find(choice=>choice.id===record[control.recordNameField])?.label||record[control.recordNameField]||'New record';return name+(control.recordDetailField&&record[control.recordDetailField]?' ('+record[control.recordDetailField]+')':'');}
      return isWeapon ? (control.itemFields?.find(item=>item.field==='weaponId')?.choices?.find(choice=>choice.id===record.weaponId)?.label || 'Weapon installation') : record.speciality || 'Custom package';
    };
    const makeFields=(record,prefix,onChange,onlyFields=null)=>{
      const grid=el('div',undefined,'fields-grid'),groups=new Map(),presentation=api.getRecordPresentation(control,record);
      // Optional fields in older backups use control defaults for display only.
      const displayRecord={...Object.fromEntries((control.itemFields||[]).filter(item=>Object.hasOwn(item,'default')).map(item=>[item.field,item.default])),...record};
      const targetFor=item=>{
        if(!item.group)return grid;
        if(!groups.has(item.group)){
          const details=el('details',undefined,'wide parameter-group');
          const groupKey=view.design.kind+':'+prefix+':'+item.group;
          const forceOpen=(control.itemFields||[]).some(field=>field.group===item.group&&presentation.fields?.[field.field]?.forceGroupOpen);
          details.open=forceOpen||(item.collapsedByDefault?(recordGroups.get(groupKey)??false):(control.itemFields||[]).filter(field=>field.group===item.group).some(field=>Object.hasOwn(record,field.field)&&JSON.stringify(record[field.field])!==JSON.stringify(field.default)));
          if(item.collapsedByDefault)details.addEventListener('toggle',()=>recordGroups.set(groupKey,details.open));
          details.append(el('summary',item.group));const content=el('div',undefined,'fields-grid');details.append(content);grid.append(details);groups.set(item.group,content);
        }
        return groups.get(item.group);
      };
      for(const item of control.itemFields || []) {
        if(onlyFields&&!onlyFields.includes(item.field))continue;
        const fieldView=presentation.fields?.[item.field]||{};
        if(item.type==='ammunition-overrides'){
          const customization=presentation.ammunitionCustomization;
          if(!customization)continue;
          const panel=el('details',undefined,'wide parameter-group'),key=view.design.kind+':'+prefix+':linked-ammunition';
          panel.open=customization.forceGroupOpen||recordGroups.get(key)||customization.mode==='custom';
          panel.addEventListener('toggle',()=>recordGroups.set(key,panel.open));
          panel.append(el('summary','Linked ammunition'));
          const modeRow=el('label','Ammunition settings'),mode=el('select');mode.id=prefix+'-ammunitionOverrides-mode';modeRow.htmlFor=mode.id;
          selectChoices(mode,[{id:'shared',label:'Same ammunition for all'},{id:'custom',label:'Customize linked copy'}],customization.mode);
          const chosen=customization.choices.find(choice=>choice.id===ammunitionCopies.get(key))||customization.choices.find(choice=>choice.customized)||customization.choices[0];
          const copyIndex=chosen?.id;
          const copyView=api.getRecordPresentation(control,record,copyIndex).ammunitionCustomization;
          const replaceCopy=value=>onChange(item.field,[...(record[item.field]||[]).filter(copy=>copy.copyIndex!==copyIndex),{copyIndex,...value}].sort((a,b)=>a.copyIndex-b.copyIndex));
          mode.addEventListener('change',()=>{
            if(mode.value==='shared')onChange(item.field,undefined);
            else if(copyView)replaceCopy(structuredClone(copyView.materializedValue));
          });
          modeRow.append(mode);panel.append(modeRow);
          if(customization.mode==='custom'&&copyView){
            const pickerRow=el('label','Linked copy'),picker=el('select');picker.id=prefix+'-ammunitionOverrides-copy';pickerRow.htmlFor=picker.id;
            selectChoices(picker,customization.choices,copyIndex);
            picker.addEventListener('change',()=>{ammunitionCopies.set(key,Number(picker.value));const replacement=makeFields(record,prefix,onChange);grid.replaceWith(replacement);});
            pickerRow.append(picker);panel.append(pickerRow);
            if(!chosen.installed)panel.append(el('p','Retained copy · Not installed','help'));
            const revert=el('button',copyView.overridden?'Revert copy to shared ammunition':'Customize this copy');revert.type='button';
            revert.addEventListener('click',()=>{
              if(copyView.overridden){const remaining=(record[item.field]||[]).filter(copy=>copy.copyIndex!==copyIndex);onChange(item.field,remaining.length?remaining:undefined);}
              else replaceCopy(structuredClone(copyView.materializedValue));
            });panel.append(revert);
            if(copyView.overridden)panel.append(makeFields(copyView.effectiveRecord,prefix+'-copy-'+copyIndex,(field,value)=>{
              const next=structuredClone(copyView.materializedValue);if(value===undefined)delete next[field];else next[field]=value;replaceCopy(next);
            },customization.fields));
          }
          grid.append(panel);continue;
        }
        if (!(typeof fieldView.visible==='boolean'?fieldView.visible:matchesVisibility(item, displayRecord))) continue;
        if(item.type==='optional-object'){
          const fieldId=prefix+'-'+item.field,wrapper=el('div',undefined,'wide fields-grid'),label=el('label',item.label),mode=el('select');
          label.htmlFor=fieldId;mode.id=fieldId;selectChoices(mode,item.choices,fieldView.mode);
          mode.addEventListener('change',()=>onChange(item.field,mode.value===item.absentMode?undefined:structuredClone(fieldView.materializedValue)));
          label.append(mode);wrapper.append(label);
          if(fieldView.mode===item.presentMode)for(const child of item.itemFields||[]){
            const childId=fieldId+'-'+child.field,row=el('label',child.label),input=numericPicker(child,record[item.field]?.[child.field],value=>onChange(item.field,{...record[item.field],[child.field]:value}));
            row.htmlFor=childId;input.id=childId;row.append(input);wrapper.append(row);
          }
          const summary=el('output',fieldView.summary,'wide derived-value');summary.id=fieldId+'-summary';wrapper.append(summary);
          targetFor(item).append(wrapper);continue;
        }
        const sharedLabel=!onlyFields&&presentation.ammunitionCustomization?.mode==='custom'&&presentation.ammunitionCustomization.fields.includes(item.field)?'Shared · ':'';
        const row=el('label',sharedLabel+(fieldView.label || item.labelBy?.values?.[record[item.labelBy.field]] || item.label || item.field));
        const fieldId=prefix+'-'+item.field;row.htmlFor=fieldId;
        let input;
if(item.type==='multiselect'){
          input=el('div',undefined,'record-multiselect');let selected=[...(record[item.field]||[])];
          const draw=()=>{
            const picker=el('div',undefined,'option-picker'),select=el('select'),add=el('button','Add');
            select.setAttribute('aria-label',item.label||item.field);add.type='button';
            selectChoices(select,recordChoices(item,record).filter(choice=>!selected.includes(choice.id)),'');
            add.disabled=true;select.addEventListener('change',()=>{add.disabled=!select.value||selected.length>=(item.maxItems||100);});
            add.addEventListener('click',()=>{selected.push(select.value);onChange(item.field,[...selected]);draw();});
            picker.append(select,add);const list=el('div',undefined,'installed-list');
            for(const value of selected){
              const choice=item.choices?.find(choice=>choice.id===value),row=el('div',undefined,'installed-row');
              const remove=el('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+(choice?.label||value));
              remove.addEventListener('click',()=>{selected=selected.filter(id=>id!==value);onChange(item.field,[...selected]);draw();});
              row.append(el('span',choice?.label||value),remove);list.append(row);
            }
            const search=el('input');search.type='search';search.placeholder='Find a book option';search.setAttribute('aria-label','Search '+(item.label||item.field));
            search.addEventListener('input',()=>{
              const query=search.value.toLowerCase();selectChoices(select,recordChoices(item,record).filter(choice=>!selected.includes(choice.id)&&choice.label.toLowerCase().includes(query)),'');add.disabled=true;
            });
            input.replaceChildren(...((item.choices||[]).length>30?[search]:[]),picker,list);
          };draw();row.classList.add('wide');
        }
        else if(item.type==='number')input=numericPicker({...item,max:fieldView.max??item.maxBy?.values?.[record[item.maxBy.field]]??item.max},record[item.field]??item.min,value=>onChange(item.field,value));
        else if(item.type==='select'){input=el('select');const choices=recordChoices(item,displayRecord,fieldView);selectChoices(input,choices,displayRecord[item.field]);input.addEventListener('change',()=>{const value=choices.find(c=>String(c.id??'')===input.value)?.id??null;onChange(item.field,item.omitByDefault&&Object.hasOwn(item,'default')&&value===item.default?undefined:value);});}
        else {input=el('input');input.type='text';input.value=record[item.field]??'';input.maxLength=item.maxLength||120;input.addEventListener('input',()=>onChange(item.field,input.value));}
        input.id=fieldId;row.append(input);targetFor(item).append(row);
      }
      if(!onlyFields)for(const field of presentation.wearMetadataRemovals||[]){const remove=el('button','Clear retained '+({ammunitionOverrides:'linked ammunition',initialMagazineSourceId:'initial magazine source',alternateMagazineSupplies:'alternate supplies',initialAmmunitionModification:'initial ammunition modification',spareAmmunitionModification:'spare ammunition modification',highCapacityAmmunitionModification:'high-capacity ammunition modification',weaponManufactureTL:'manufacture declaration'}[field]));remove.type='button';remove.addEventListener('click',()=>onChange(field,undefined));grid.append(remove);}
      if(presentation.vehicleOption){
        const facts=presentation.vehicleOption;
        grid.append(el('p','Cr '+facts.unitCost.toLocaleString()+' / '+facts.slotsPerInstallation+' Slots'+(facts.family==='discharger'?' / Capacity '+facts.capacityPerInstallation:'')+' per installation','wide help'));
        grid.append(el('p',[facts.loadLabel,facts.replacementPriceLabel,...(facts.selectedFacts||[]).map(fact=>fact.label+': '+fact.value),...facts.conditionLabels].filter(Boolean).join(' · '),'wide help'));
        grid.append(el('p',sourceText(facts.source)+' · '+sourceText(facts.conversionSource),'wide source'));
      }
      const selection=presentation.magazineSupplySelection;
      if(!onlyFields||onlyFields.includes(selection?.alternateSuppliesField)){
        const panel=renderMagazinePanel({record,selection,control,prefix,shared:!onlyFields&&presentation.ammunitionCustomization?.mode==='custom',groupKey:view.design.kind+':'+prefix+':compatible-magazines',recordGroups,onChange,el,selectChoices,numericPicker});
        if(panel)grid.append(panel);
      }
      return grid;
    };
    for(const record of installed) {
      const card=el('div',undefined,'option-settings');
      const heading=el('div',undefined,'manipulator-heading');heading.append(el('h4',recordLabel(record)));
      const remove=el('button','Remove');remove.type='button';remove.setAttribute('aria-label','Remove '+recordLabel(record));
      remove.addEventListener('click',()=>submitSelection(control,installed.filter(item=>item.id!==record.id)));
      heading.append(remove);card.append(heading);
      const grid=makeFields(record,id+'-'+record.id,(key,value)=>{
        // Keep text edits local until blur, so typing does not redraw the form.
        const changed={...record};if(value===undefined)delete changed[key];else changed[key]=value;
        const next=resetHiddenFields(control,changed);
        if((control.itemFields||[]).some(item=>item.field===key&&item.type==='text')){record[key]=value;return;}
        submitSelection(control,installed.map(item=>item.id===record.id?next:item));
      });
      for(const input of grid.querySelectorAll('input[type=text]'))input.addEventListener('change',()=>submitSelection(control,installed));
      card.append(grid);field.append(card);
    }
    const draftKey=view.design.kind+':'+id;
    const draft=customDrafts.get(draftKey)||Object.fromEntries((control.itemFields||[]).filter(item=>!item.omitByDefault).map(item=>[item.field,item.default??(item.type==='multiselect'?[]:item.type==='select'?item.choices?.[0]?.id:item.type==='number'?item.min??0:'')]));
    customDrafts.set(draftKey,draft);
    const composer=el('div',undefined,'option-settings');
    composer.append(el('h4',control.composerLabel||(isWeapon?'Add a weapon installation':isExternal?'Add a source-defined external vehicle option':'Add a book-permitted custom package')));
    const add=el('button',control.addLabel || (isWeapon?'Add weapon':isExternal?'Add external vehicle option':'Add custom package'));add.type='button';add.className='primary';
    const valid=()=>control.canAdd!==false&&!(control.itemFields||[]).some(item=>matchesVisibility(item,draft)&&item.type==='text'&&item.required!==false&&item.optional!==true&&!String(draft[item.field]||'').trim())&&installed.length<(control.maxItems||200);
    add.disabled=!valid();
    const redrawComposer = () => {
      const next = makeFields(draft, id+'-new', (key, value) => {
        if(value===undefined)delete draft[key];else draft[key]=value;Object.assign(draft,resetHiddenFields(control,draft));customDrafts.set(draftKey,draft);add.disabled=!valid();
        if (control.type==='weapons'||control.type==='verified-vehicle-options'||(control.itemFields||[]).some(item=>dependsOn(item.visibleWhen,key)||item.choicesBy?.field===key||item.labelBy?.field===key||item.maxBy?.field===key||item.maxValueField===key)) redrawComposer();
      });
      const previous=composer.querySelector('.fields-grid');
      if(previous)previous.replaceWith(next);else composer.append(next);
    };
    redrawComposer();
    add.addEventListener('click',()=>{
      const next={id:(control.recordIdPrefix||(isWeapon?'wpn-':isExternal?'veh-':'pkg-'))+globalThis.crypto.randomUUID(),...draft};
      submitSelection(control,[...installed,next],draftKey);
    });
    composer.append(add);
    if(control.canAdd===false&&control.unavailableReason)composer.append(el('p',control.unavailableReason,'help'));
    if(isExternal){
      const disclosure=el('details',undefined,'external-composer');disclosure.open=installed.length===0;
      const heading=composer.querySelector('h4');disclosure.append(el('summary',heading?.textContent||'Add external vehicle option'));heading?.remove();disclosure.append(composer);field.append(disclosure);
    }else field.append(composer);

  } else if (control.type === 'manipulators') {
    field.classList.add('wide');
    if (!control.itemFields?.length) {
      field.append(el('p', 'Manipulator editing is not available in this preview. Existing manipulators are retained in the design.', 'help'));
      return field;
    }
    const arms = Array.isArray(selected) ? selected : [];
    const update = (armId, patch) => submitSelection(control, arms.map(arm => arm.id === armId ? { ...arm, ...patch } : arm));
    for (const [index, arm] of arms.entries()) {
      const card = el('div', undefined, 'manipulator');
      const heading = el('div', undefined, 'manipulator-heading');
      heading.append(el('h3', `${arm.kind === 'base' ? 'Base arm' : arm.kind === 'leg' ? 'Converted leg' : 'Additional arm'} ${index + 1}`));
      const remove = el('button', 'Remove'); remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${arm.id}`);
      remove.addEventListener('click', () => submitSelection(control, arms.filter(item => item.id !== arm.id)));
      heading.append(remove); card.append(heading);
      const grid = el('div', undefined, 'fields-grid');
      for (const item of control.itemFields) {
        const itemId = `${id}-${arm.id}-${item.field}`;
        const row = el('label', item.label); row.htmlFor = itemId;
        let input;
        if (item.type === 'select') {
          input = el('select'); selectChoices(input, item.choices, arm[item.field]);
          input.addEventListener('change', () => { const choice = item.choices.find(value => String(value.id) === input.value); if (choice) update(arm.id, { [item.field]: choice.id }); });
        } else {
          input = numericPicker(item, arm[item.field], value => update(arm.id, { [item.field]: value }));
        }
        input.id = itemId; row.append(input); grid.append(row);
      }
      card.append(grid); field.append(card);
    }
    const actions = el('div', undefined, 'file-actions');
    const addArm = (kind, armId) => {
      const arm = { id: armId || `arm-${globalThis.crypto.randomUUID()}`, kind };
      for (const item of control.itemFields) arm[item.field] = item.default ?? (item.type === 'select' ? item.choices[0].id : item.min ?? 0);
      submitSelection(control, [...arms, arm]);
    };
    for (const kind of control.kinds || []) {
      const button = el('button', `Add ${kind.label.toLowerCase()}`); button.type = 'button';
      button.addEventListener('click', () => addArm(kind.id)); actions.append(button);
    }
    for (const baseId of control.baseIds || []) if (!arms.some(arm => arm.id === baseId)) {
      const button = el('button', `Restore ${baseId.replace('-', ' ')}`); button.type = 'button';
      button.addEventListener('click', () => addArm('base', baseId)); actions.append(button);
    }
    field.append(actions);
  } else if (control.type === 'multiselect') {
    field.classList.add('wide');
    const chosen = Array.isArray(selected) ? selected : [];
    const picker = el('div', undefined, 'option-picker');
    const select = el('select'); select.id = id; select.setAttribute('aria-label', control.label);
    const add = el('button', 'Add'); add.type = 'button'; add.className = 'primary';
    const sourceHint = el('p', undefined, 'help source');
    let filter;
    const draw = () => {
      const current = select.value;
      const query = (filter?.value || '').trim().toLowerCase();
      const available = choices.filter(choice => !chosen.includes(choice.id) && choice.label.toLowerCase().includes(query));
      selectChoices(select, available, current, available.length ? 'Choose an option' : 'No matching options');
      add.disabled = !select.value || !available.some(choice => String(choice.id) === select.value);
      sourceHint.textContent = sourceText(available.find(choice => String(choice.id) === select.value)?.source);
    };
    if (choices.length > 16) {
      filter = el('input'); filter.type = 'search'; filter.placeholder = 'Find a book option';
      filter.setAttribute('aria-label', 'Search ' + control.label);
      filter.value = searches.get(id) || '';
      filter.addEventListener('input', () => { searches.set(id, filter.value); draw(); }); field.append(filter);
    }
    select.addEventListener('change', () => {
      const choice = choices.find(item => String(item.id) === select.value);
      add.disabled = !choice; sourceHint.textContent = sourceText(choice?.source);
    });
    add.addEventListener('click', () => {
      const choice = choices.find(item => String(item.id) === select.value);
      if (choice) submitSelection(control, [...chosen, choice.id]);
    });
    picker.append(select, add); field.append(picker, sourceHint); draw();
    const installed = el('div', undefined, 'installed-list');
    for (const choiceId of chosen.filter(value => choices.some(choice => choice.id === value))) {
      const choice = choices.find(item => item.id === choiceId);
      const row = el('div', undefined, 'installed-row');
      const description = el('div'); description.append(el('strong', choiceLabel(choice)));
      const source = sourceText(choice.source); if (source) description.append(el('small', source, 'source'));
      const remove = el('button', 'Remove'); remove.type = 'button'; remove.setAttribute('aria-label', 'Remove ' + choice.label);
      remove.addEventListener('click', () => submitSelection(control, chosen.filter(value => value !== choiceId)));
      row.append(description,remove); installed.append(row);
    }
    if (!installed.children.length) installed.append(el('p','No added options in this category.','help'));
    field.append(installed);

  } else {
    let input;
    if (control.type === 'number') {
      input = numericPicker(control, selected, value => submitSelection(control, value));
    } else if (control.type === 'text') {
      input=el('input');input.type='text';input.value=selected??'';input.maxLength=control.maxLength||120;
      input.addEventListener('change',()=>submitSelection(control,input.value));
    } else {
      input = el('select'); selectChoices(input, choices, selected);
      input.addEventListener('change', () => submitSelection(control, choices.find(choice => String(choice.id) === input.value)?.id ?? null));
    }
    input.id = id; field.append(input);
  }
  // Source descriptions remain in the API, not the labels-only editor.
  const source = sourceText(control.source || choices.find(choice=>choice.id===selected)?.source); if (source) field.append(el('p', source, 'source'));
  if (control.type !== 'multiselect' && control.choices?.length === 0) field.append(el('p', 'Book choices pending verification. No custom values are substituted.', 'help'));
  if(control.collapsedByDefault){
    label.remove();const disclosure=el('details',undefined,'wide optional-control');disclosure.open=Array.isArray(selected)&&selected.length>0;
    disclosure.append(el('summary',control.label+(selected?.length?' ('+selected.length+')':'')),field);return disclosure;
  }
  if(control.type==='external-vehicle-options'){
    label.remove();const disclosure=el('details',undefined,'wide external-options');
    disclosure.open=Array.isArray(selected)&&selected.length>0;
    disclosure.append(el('summary',control.label+(selected?.length?' ('+selected.length+')':'')),field);return disclosure;
  }
  return field;
}
function resetHiddenFields(control, record) {
  const next={...record};
  if(control.type==='weapons'&&(record.placement==='worn'||record.wearSite!==undefined||control.itemFields.find(f=>f.field==='weaponId')?.choices?.find(w=>w.id===record.weaponId)?.wearable))return next;
  for(const item of control.itemFields||[]){
    if(item.resetWhenHidden&&!matchesVisibility(item,next))next[item.field]=item.default;
    if(item.resetWhenUnavailable){const choices=recordChoices(item,next);if(!choices.some(choice=>choice.id===next[item.field]))next[item.field]=choices.some(choice=>choice.id===item.default)?item.default:choices[0]?.id;}
  }
  return next;
}
function matchesVisibility(control, values) {
  if(!control.visibleWhen)return true;
  const rule=control.visibleWhen,value=values?.[rule.field];
  if(Array.isArray(rule.allOf))return rule.allOf.every(item=>matchesVisibility({visibleWhen:item},values));
  if(Array.isArray(rule.anyOf))return rule.anyOf.some(item=>matchesVisibility({visibleWhen:item},values));
  if(Array.isArray(rule.oneOf))return rule.oneOf.includes(value);
  if(Object.hasOwn(rule,'notEquals'))return value!==rule.notEquals;
  return value===rule.equals;
}

function controlVisible(control) {
  return matchesVisibility(control, control.target==='special'?view.design.special:view.design.selections?.[currentStage]);
}

function renderStage() {
  const index = stages.findIndex(([id]) => id === currentStage);
  $('stage-position').textContent = `STAGE ${index + 1} OF 6`;
  $('stage-title').textContent = stages[index][1];
  const content = $('stage-content'); content.replaceChildren();
  const sourceStage = view.catalogue.stages.find(item => item.id === currentStage);
  const stage = sourceStage ? { ...sourceStage, controls: sourceStage.controls.filter(controlVisible) } : null;
  const activeCategories=Array.isArray(stage?.categories)&&stage.categories.length?stage.categories.map(item=>[item.id,item.label]):categories;

  if (currentStage === 'physical' && stage?.categorize!==false && (stage?.controls || []).some(control=>control.category || control.choices?.some(choice=>choice.category))) {
    const layout = el('div', undefined, 'category-layout');
    const navigation = el('div', undefined, 'category-picker');
    const label = el('label', stage.categoryLabel || 'Physical-option category'); label.htmlFor = 'physical-category';
    const picker = el('select'); picker.id = 'physical-category';
    if(!activeCategories.some(([id])=>id===physicalCategory))physicalCategory=activeCategories[0]?.[0];
    selectChoices(picker,activeCategories.map(([id,label])=>({id,label})),physicalCategory);
    picker.addEventListener('change',()=>{physicalCategory=picker.value;renderStage();});
    label.append(picker);navigation.append(label,el('p','Choose a category to keep the workspace focused. Installed options remain with the design.','help'));
    const body = el('div', undefined, 'category-content');
    const category = activeCategories.find(([id])=>id===physicalCategory) || activeCategories[0];
    const [categoryId,labelText] = category;
    body.append(el('h3',labelText));
    const controls = (stage?.controls || []).filter(control => control.category === categoryId || control.category === labelText);
    for (const control of controls) body.append(renderControl(control));
    for (const control of (stage?.controls || []).filter(control => !control.category)) {
      const context = categoryId==='default-suites'?'defaultSuite':'options';
      const choices = (control.choices || []).filter(choice => control.type==='option-parameters'
        ? (view.design.selections.physical[context]||[]).includes(choice.id) && (context==='defaultSuite'||choice.category===categoryId||choice.category===labelText)
        : choice.category === categoryId || choice.category === labelText);
      if (choices.length) body.append(renderControl({ ...control, label:control.type==='option-parameters'?'Installed option settings':labelText, category:categoryId, ...(control.type==='option-parameters'?{paramContext:context}:{}) }, choices));
    }
    if (body.children.length===1) body.append(el('p','This category is awaiting verified book choices.','help'));
    layout.append(navigation,body);content.append(layout);

  } else if (currentStage === 'finalisation') {
    content.append(el('p', 'Review the statblock and outstanding checks before using this robot in play.', 'stage-description'));
    const choices=el('div',undefined,'fields-grid');
    for (const control of stage?.controls || []) choices.append(renderControl(control));
    content.append(choices,renderReview(view.review));
  } else {
    const grid = el('div', undefined, 'fields-grid');
    for (const control of stage?.controls || []) grid.append(renderControl(control));
    if (!grid.children.length) grid.append(el('p', 'This stage is awaiting source-verified construction choices.', 'help'));
    content.append(grid);
  }
  // Reference tables remain API-only; the editor displays selected choices and checks.

}
function metric(label, value) { const row = el('div', undefined, 'metric'); row.append(el('dt', label), el('dd', value)); return row; }
function formatted(value, suffix = '') { return typeof value === 'number' && Number.isFinite(value) ? `${number.format(value)}${suffix}` : 'Not calculated'; }
function renderSummary() {
  const evaluation = view.evaluation;
  $('design-status').textContent = { verified: evaluation.provisional ? 'Provisional assumptions' : evaluation.coverage?.complete === true ? 'Verified' : 'Subset checked', invalid: 'Needs correction', blocked: 'Rules incomplete' }[evaluation.status] || 'Not verified';
  $('design-status').className = `tag ${evaluation.status === 'verified' && !evaluation.provisional ? 'success' : 'review'}`;
  const provisional = evaluation.provisional === true || !evaluation.totals && !!evaluation.previewTotals;
  const totals = evaluation.totals || evaluation.previewTotals;
  const costLabel = evaluation.costLabel || totals?.costLabel || 'Construction cost';
  const excluded = evaluation.notApplicableMetrics || [];
  const list = el('dl', undefined, 'metrics');
  list.append(metric((provisional ? 'Provisional ' : '') + costLabel, totals?.cost != null ? 'Cr ' + formatted(totals.cost) : 'Not calculated'));
  if (totals?.constructionCost != null && totals.constructionCost !== totals.cost) list.append(metric('Construction cost', 'Cr ' + formatted(totals.constructionCost)));
  for (const [key, label] of [['slots', 'Slots'], ['bandwidth', 'Bandwidth']]) {
    if (excluded.includes(key)) continue;
    list.append(metric(label, totals?.[key] ? formatted(totals[key].used) + ' / ' + formatted(totals[key].capacity) : 'Not calculated'));
  }
  $('summary-metrics').replaceChildren(list);
  const stats = el('dl',undefined,'quick-stats');
  const summaryStats = evaluation.summaryMetrics || [['hits','Hits'],['armour','Protection'],['intelligence','Intelligence'],['tacticalSpeed','Move / action']].filter(([key])=>totals?.[key]!=null).map(([key,label])=>({label,value:totals[key],unit:key==='tacticalSpeed'?' m':''}));
  const showMetric = item => typeof item.value==='number'?formatted(item.value)+(item.unit||''):String(item.value??'Not calculated');
  for(const item of summaryStats) stats.append(metric(item.label,showMetric(item)));
  $('summary-metrics').append(stats);
  const compact = [[(provisional?'Provisional ':'')+costLabel,totals?.cost!=null?'Cr '+formatted(totals.cost):'Pending']];
  for(const [key,label] of [['slots','Slots'],['bandwidth','Bandwidth']])if(!excluded.includes(key))compact.push([label,totals?.[key]?formatted(totals[key].used)+' / '+formatted(totals[key].capacity):'--']);
  if(compact.length===1)for(const item of summaryStats.slice(0,2))compact.push([item.label,showMetric(item)]);
  $('compact-summary').replaceChildren(...compact.map(([label,value])=>{const span=el('span',label);span.append(el('b',value));return span;}));

  const diagnostics = evaluation.diagnostics || [];
  $('issues').replaceChildren(...diagnostics.map((issue,index) => {
    const node = el('div', undefined, `issue ${issue.severity}`);
    const context=view.review?.sections.find(section=>section.id==='warnings')?.rows[index]?.detail;
    if(context)node.append(el('small',context,'help'));
    node.append(el('p', `${issue.severity||'Check'}: ${view.review?.sections.find(section=>section.id==='warnings')?.rows[index]?.value||diagnosticLabel(issue)}`));
    const source = sourceText(issue.source); if (source) node.append(el('small', source, 'source')); return node;
  }));
  if (!diagnostics.length) $('issues').append(el('p', evaluation.status === 'verified' ? 'No outstanding construction checks.' : 'Construction rules have not been fully verified.', 'help'));
  const coverage = evaluation.coverage || view.catalogue.coverage;
  if (coverage?.gaps?.length || coverage?.compositeBoundaries?.length) {
    const details = el('details', undefined, 'coverage'); details.append(el('summary', 'Implementation coverage'));
    details.append(el('p', 'Coverage incomplete', 'help'));
    for (const gap of [...(coverage.gaps||[]),...(coverage.compositeBoundaries||[])]) { const item=el('p',coverageLabel(gap),'help');const source=sourceText(gap?.source);if(source)item.append(el('small',source,'source'));details.append(item); }
    $('issues').append(details);
  }
}
function renderSaved() {
  const selected = $('saved-design').value;
  const saved = view.savedDesigns || api.listSaved();
  $('saved-design').replaceChildren(option('', 'Choose a saved design'), ...saved.map(item => option(item.id, item.name || item.design?.name || 'Unnamed robot')));
  if (saved.some(item => item.id === selected)) $('saved-design').value = selected;
  $('load-design').disabled = !$('saved-design').value;
  $('save-design').disabled = view.storageStatus?.canSave === false;
  $('save-copy').disabled = view.storageStatus?.canSave === false;
  $('new-design').disabled = view.busy;
  $('refresh-saved').disabled = view.busy;
  $('storage-note').textContent = typeof view.storageStatus === 'string' ? view.storageStatus : view.storageStatus?.message || 'Saved designs stay in this browser. Export JSON to keep a portable backup.';
}
function renderExamples() {
  const selected = $('example-design').value;
  const examples = api.listExamples?.() || [];
  $('example-design').replaceChildren(option('', 'Choose an example'), ...examples.map(item => option(item.id, item.name || item.label)));
  if (examples.some(item => item.id === selected)) $('example-design').value = selected;
  $('load-example').disabled = !$('example-design').value || view.busy;
  updateExampleNote(examples);
}
function updateExampleNote(examples=api.listExamples?.()||[]) {
  const selected=examples.find(item=>item.id===$('example-design').value);

  $('example-note').textContent = examples.length
    ? [sourceExampleLabel(selected),sourceText(selected?.source),'Examples replace the draft without changing your saved designs.'].filter(Boolean).join(' · ')
    : 'No construction examples are available yet.';
}
// A change event fires on blur before a pointer click. Preserve the clicked
// control until that click finishes, while exposing the fresh API state now.
const finishPointer = () => setTimeout(() => {
  pointerActive = false;
  if (deferredView) { const next = deferredView; deferredView = null; render(next); }
  $('stage-panel').setAttribute('aria-busy','false');
}, 0);
document.addEventListener('pointerdown', () => { pointerActive = true; $('stage-panel').setAttribute('aria-busy','true'); }, true);
window.addEventListener('pointerup', finishPointer, true);
window.addEventListener('pointercancel', finishPointer, true);
window.addEventListener('blur', finishPointer);
function render(next) {
  view = next || api.getView();
  if (pointerActive) { deferredView = view; $('stage-panel').setAttribute('aria-busy','true'); return; }
  const focused = document.activeElement?.id;
  updateIdentity(); renderNavigation(); renderStage(); renderSummary(); renderSaved(); renderExamples();
  if (focused && $(focused)) $(focused).focus({ preventScroll: true });
  $('stage-panel').setAttribute('aria-busy','false');
}
function download() {
  const result = api.exportDesign();
  const json = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = el('a'); anchor.href = url;
  anchor.download = `${(view.design.name || 'robot-design').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}.json`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function printDesign() {
  const output = $('print-output');
  output.replaceChildren(el('h1', view.design.name || 'Robot design'), el('pre', api.getStatblock?.() || view.statblock || 'Statblock unavailable.'));
  window.print();
}
try {
  api = createRobotApi();
  api.subscribe(render);
  render(api.getView());
  $('robot-kind').addEventListener('change', event => {
    if (view.dirty && !window.confirm('Changing robot type resets construction choices for the new rules. Save or export first to keep this design. Continue?')) { event.target.value = view.design.kind; return; }
    safely(() => api.setIdentity({ kind: event.target.value }));
  });
  $('robot-name').addEventListener('change', event => safely(() => api.setIdentity({ name: event.target.value })));
  $('robot-tl').addEventListener('change', event => safely(() => api.setIdentity({ techLevel: Number(event.target.value) })));
  $('saved-design').addEventListener('change', () => { $('load-design').disabled = !$('saved-design').value; });
  $('new-design').addEventListener('click', () => {
    if (view.dirty && !window.confirm('Start a new blank design and replace your unsaved changes? Save or export first to keep them.')) return;
    safely(() => api.newDesign(view.design.kind), 'New design started.');
  });
  $('refresh-saved').addEventListener('click', () => safely(() => api.refreshSaved(), 'Saved list refreshed. Your current draft is unchanged.'));
  $('example-design').addEventListener('change', () => { $('load-example').disabled = !$('example-design').value || view.busy; updateExampleNote(); });
  $('load-example').addEventListener('click', () => {
    if (view.dirty && !window.confirm('Load this example and replace your unsaved changes? Save or export first to keep them.')) return;
    safely(() => api.loadExample($('example-design').value), 'Example loaded as an unsaved draft.');
  });
  window.addEventListener('beforeunload', event => {
    if (view.dirty || view.busy || $('robot-name').value !== (view.design.name || '')) { event.preventDefault(); event.returnValue = ''; }
  });
  $('save-design').addEventListener('click', () => safely(() => api.saveDesign(), 'Design saved.'));
  $('save-copy').addEventListener('click', () => safely(() => api.saveDesign({ asNew: true }), 'New design copy saved.'));
  $('load-design').addEventListener('click', () => {
    if (view.dirty && !window.confirm('Load this design and replace your current unsaved changes? Export or save first to keep them.')) return;
    safely(() => api.loadDesign($('saved-design').value), 'Design loaded.');
  });
  $('export-design').addEventListener('click', () => safely(download, 'JSON export prepared.'));
  $('import-design').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('This JSON file is too large. Choose a robot design smaller than 2 MB.');
      if (view.dirty && !window.confirm('Import this design and replace your current unsaved changes?')) return;
      const revision = view.draftRevision; const json = await file.text(); safely(() => api.importDesign(json,revision), 'Design imported. Save it to keep it in this browser.');
    } catch (error) { notify(error.message, true); }
    finally { event.target.value = ''; }
  });
  $('print-design').addEventListener('click', () => safely(printDesign));
} catch (error) {
  $('stage-content').replaceChildren(el('p', 'The construction workbench could not start. Your saved designs have not been changed.', 'error'));
  notify(error.message || 'Please reload the page and try again.', true);
}
