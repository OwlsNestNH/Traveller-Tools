import {diagnosticLabel,diagnosticContext,coverageLabel,conditionLabel,presentationFacts,sourceReference} from './rules-presentation.mjs';
import {magazineProductId,magazineProductLabel,magazineProductFacts,magazineProductSources,magazineVariantLabel} from './magazine-presentation.mjs';
// Read-only presentation projection. No construction rules or calculated totals live here.
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const massFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 9 });
const present = value => value !== undefined && value !== null;
const noMeleeAmmunition=weapon=>weapon?.weaponFamily==='melee'&&weapon.magazine===null&&!weapon.poweredMelee;
const weaponRange=range=>present(range)?`Range: ${valueText(range)}${typeof range==='number'?' m':''}`:'Range not calculated';
export function humanLabel(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_:]/g, ' ').replace(/^./, ch => ch.toUpperCase());
}
export const sourceLabel = sourceReference;

function valueText(value) {
  if (value === null || value === undefined) return 'Not calculated';
  if (typeof value === 'number') return format.format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(valueText).join('; ') : 'None';
  if (typeof value === 'object') return Object.entries(value).map(([key,item]) => `${humanLabel(key)}: ${valueText(item)}`).join(' · ');
  return String(value);
}
const money = value => present(value) ? `Cr ${valueText(value)}` : 'Not calculated';
function row(label, value, source, detail = '') { return { label, value: valueText(value), source: sourceLabel(source), detail }; }
function vehicleOptionReviewRow(item,component=null) {
  const componentState=component?({verified:'Subset checked',invalid:'Needs correction',blocked:'Rules incomplete'}[component.status]||'Not verified'):null;
  return {
    ...row(component?component.name+' / '+item.label:item.label,money(item.cost)+' / '+valueText(item.slots)+' Slots'+(component?' per component copy':''),item.source,component?'Component-only hardware; no host grant':'Source hardware; deployment conditional'),
    details:[...(component?[row('Component copies',component.quantity),row('Component construction',componentState),row('Accounting','Per component copy; no host grant')]:[]),row('Installations'+(component?' per component copy':''),item.quantity),row('Capacity per installation',item.capacityPerInstallation),row('Initial contents','Unverified'),row('Replacement charge price','Unknown'),...(item.additionalCharges?[row('Additional charges'+(component?' per component copy':''),item.additionalCharges),row('Additional charge cost',item.additionalChargeCost),row('Additional charge mass',item.additionalChargeMassKg)]:[]),row('Conditions',item.conditionLabels),row('Conversion source',sourceLabel(item.conversionSource))]
  };
}
function section(id, title, rows, extra = {}) { return { id, title, rows, ...extra }; }
function objectRows(records, labelFor) {
  return (records || []).map((record,index) => {
    if (typeof record !== 'object' || record === null) return row(String(index + 1), record);
    const label = labelFor?.(record) || record.label || record.name || humanLabel(record.skill || record.id || String(index + 1));
    const details = Object.entries(record).filter(([key]) => !['label','name','source'].includes(key));
    return row(label, Object.fromEntries(details), record.source);
  });
}
function titleName(value) {
  return humanLabel(value).replace(/\b\w/g, letter => letter.toUpperCase());
}
function profileRow(label, summary, record, omitted = [], detail = '') {
  const hidden = new Set(['id','weaponId','optionId','sourceOption','label','name','source','ammunitionOverrides','ammunitionCopies','alternateMagazineSupplies',...omitted]);
  if(record.ammunitionCopies?.length||record.ammunitionOverrides?.length)for(const field of ['extraMagazines','extraHighCapacityMagazines','initialMagazines','initialMagazineType','autoloadAllocation'])hidden.add(field);
  if(record.ammunitionInventory?.products)for(const field of ['ammunitionInventory','initialAmmunition','magazineVariants','spareAmmunition','highCapacitySpareAmmunition','extraMagazines','extraHighCapacityMagazines','initialMagazines','initialMagazineType','autoloadAllocation','ammoCost','autoloadCost'])hidden.add(field);
  // A legacy initialMagazines=1 is a schema sentinel for no-ammunition melee,
  // not an included magazine or power pack. Invalid selections remain editable.
  if(noMeleeAmmunition(record)||record.poweredMelee)for(const field of ['initialMagazines','initialMagazineType','initialMagazineSourceId','extraMagazines','extraHighCapacityMagazines','autoload','autoloadAllocation','magazine','initialAmmunition','ammunitionInventory','ammunitionAccounting','magazineVariants','spareAmmunition','highCapacitySpareAmmunition'])hidden.add(field);
  if(record.poweredMelee)for(const field of ['poweredMelee','powerOperation','acquisition'])hidden.add(field);
  const details = Object.entries(presentationFacts(record)||{}).filter(([key])=>!hidden.has(key)).map(([key,value])=>row(humanLabel(key),value));
  if(noMeleeAmmunition(record))details.push(row('Ammunition','Not applicable'));
  if(record.poweredMelee)details.push(...poweredMeleeRows(record));
  return {...row(label,summary,record.source,detail),details};
}
function poweredMeleeRows(weapon){
 const power=weapon.powerOperation,endurance=power?.endurance,recharge=power?.recharge;
 const duration=endurance?.basis==='printed-source'?`${endurance.duration} · Printed duration${endurance.condition?' · '+conditionLabel(endurance.condition):''}`:
  `${present(endurance?.hours)?valueText(endurance.hours)+' hours':'Host endurance unresolved'} · ${endurance?.reference==='recipient-robot-endurance'?'Recipient robot endurance':'Robot endurance'} · User/referee ruling`;
 return [row('Acquisition','Complete weapon hardware; initial charge unspecified',weapon.acquisition?.source||weapon.source),
  row('Power endurance',duration,endurance?.source),row('Recharge',recharge?.duration||'Recharge duration unstated',recharge?.source),
  row('Power supplies','Replacement price unspecified; charger provisioning unspecified',power?.supply?.source)];
}
function ammunitionMassDisplay(value) {
  if(Array.isArray(value))return value.map(ammunitionMassDisplay);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key.endsWith('Kg')&&typeof item==='number'?massFormat.format(item):ammunitionMassDisplay(item)]));
}
function spareAmmunitionDisplay({storageId,...ammunition},storage) {
  return {...ammunitionMassDisplay(ammunition),storage};
}
function ammunitionInventoryDisplay(weapon) {
  if(!weapon.ammunitionInventory)return {};
  const inventory=weapon.ammunitionInventory;
  if(!inventory.allocation)return {ammunitionInventory:inventory};
  const {supplyWeaponId,sourceFamily,mode,...allocation}=inventory.allocation;
  return {ammunitionInventory:{...inventory,allocation:{mode:mode==='per-copy'?'Per-copy totals':mode==='split'?'Split loader and storage':'All extras follow loader setting',supply:weapon.label||humanLabel(supplyWeaponId),sourceFamily:humanLabel(sourceFamily),...allocation}}};
}
function magazineSelectionRows(spec,label,weapon,storageName,sourceName) {
  const source=spec.initialMagazineSourceId??weapon.weaponId;
  const initial=row(label,`Initial: ${valueText(spec.initialMagazines)} · ${sourceName(source)} / ${magazineVariantLabel(spec.initialMagazineType??'standard')}`,weapon.source);
  const donors=(spec.alternateMagazineSupplies||[]).map((supply,index)=>row(`${label} / compatible spares ${index+1}`,`${sourceName(supply.sourceWeaponId)} / ${magazineVariantLabel(supply.variant)} · Extras: ${valueText(supply.extraMagazines)} · Selected loader: ${valueText(supply.autoloadMagazines)} · Storage: ${storageName(supply.storageId)}`,weapon.source));
  return [initial,...donors];
}
function ammunitionProductRows(weapon,storageName,sourceName) {
  if(noMeleeAmmunition(weapon)||weapon.poweredMelee)return [];
  const inventory=weapon.ammunitionInventory;
  if(!inventory?.products){
    if(weapon.ammunitionOverrides?.length)return [];
    return Object.hasOwn(weapon,'initialMagazineSourceId')||weapon.alternateMagazineSupplies?.length?magazineSelectionRows(weapon,'Magazine selection',weapon,storageName,sourceName):[];
  }
  const summary=(inventory,label)=>{
    const initial=inventory.initial,allocation=inventory.allocation,countScope=allocation?.linkedWeapons>1&&allocation.mode!=='per-copy'?' per weapon':'';
    return row(label,[`Total: ${valueText(inventory.totalRounds)} rounds · ${money(inventory.totalCost)}`,`Initial: ${valueText(initial?.count)} magazines / ${valueText(initial?.totalRounds)} rounds · ${money(initial?.purchaseCost)}`,`Loader: ${valueText(inventory.autoload?.count??inventory.autoload?.countPerWeapon??0)} magazines${countScope} / ${valueText(allocation?.autoloadRounds)} rounds${countScope?' total':''} · ${money(inventory.autoloadCost)} package`,`Stored: ${valueText(allocation?.storedCount??allocation?.storedCountPerWeapon)} magazines${countScope} / ${valueText(allocation?.storedRounds)} rounds${countScope?' total':''} · ${money(allocation?.reservePurchaseCost)}`,inventory.autoload?.composition?'Mixed-loader pricing: combined source rules':''].filter(Boolean).join(' · '),[...new Set([initial?.source,allocation?.source].map(sourceLabel).filter(Boolean))].join(' · '));
  };
  const products=(inventory,spec,prefix='')=>{
    const retained=new Set((spec.alternateMagazineSupplies||[]).map(magazineProductId));
    if(Object.hasOwn(spec,'initialMagazineSourceId'))retained.add((spec.initialMagazineSourceId??weapon.weaponId)+':'+(spec.initialMagazineType??'standard'));
    return inventory.products.filter(product=>product.initialCount||product.extraCount||product.compatible===false||retained.has(product.productId)||(product.storageId&&product.storageId!=='none')).map(product=>{
      const counts=[`Initial: ${valueText(product.initialCount)} / ${valueText(product.initialRounds)} rounds`,`Extras: ${valueText(product.extraCount)} / ${valueText(product.extraRounds)} rounds`,`Loader: ${valueText(product.autoloadCount)} / ${valueText(product.autoloadRounds)} rounds`,`Stored: ${valueText(product.storedCount)} / ${valueText(product.storedRounds)} rounds`];
      const reservations=(product.storageReservations||[]).map(reservation=>`${reservation.copyIndex?'Copy '+reservation.copyIndex+': ':''}${storageName(reservation.storageId)} · ${valueText(reservation.count)} magazines · ${massFormat.format(reservation.massKg)} kg estimated`);
      if(!reservations.length&&product.storageId&&product.storageId!=='none')reservations.push(storageName(product.storageId)+' · Retained storage selection');
      return row(prefix+magazineProductLabel(product),[magazineProductFacts(product),...counts,...reservations,product.compatible===false?'Incompatible magazine selection':''].filter(Boolean).join(' · '),magazineProductSources(product));
    });
  };
  const rows=[summary(inventory,'Ammunition totals')];
  if(weapon.ammunitionCopies?.length){
    for(const copy of weapon.ammunitionCopies){
      const spec=weapon.ammunitionOverrides?.find(item=>item.copyIndex===copy.copyIndex)??weapon;
      rows.push(summary(copy.ammunitionInventory,`Copy ${copy.copyIndex} ammunition · ${copy.customized?'Customized':'Shared'}`),...products(copy.ammunitionInventory,spec,`Copy ${copy.copyIndex} / `));
    }
    for(const copy of weapon.ammunitionOverrides||[])if(copy.copyIndex>weapon.linkedWeapons)rows.push(...magazineSelectionRows(copy,`Copy ${copy.copyIndex} ammunition selection · Not installed`,weapon,storageName,sourceName));
  }else rows.push(...products(inventory,weapon));
  return rows;
}
function ammunitionCopyRows(weapon,storageName,sourceName=()=> 'Selected weapon') {
  if(noMeleeAmmunition(weapon)||weapon.poweredMelee)return [];
  if(weapon.ammunitionInventory?.products)return [];
  if(!weapon.ammunitionCopies?.length&&weapon.ammunitionOverrides?.length){
    const selectedRow=(spec,label)=>{
      const allocation=spec.autoloadAllocation;
      const parts=[`Initial: ${valueText(spec.initialMagazines)} ${humanLabel(spec.initialMagazineType??'standard')}`,
        `Extras: standard ${valueText(spec.extraMagazines)}, high-capacity ${valueText(spec.extraHighCapacityMagazines??0)}`,
        allocation?`Selected loader: standard ${valueText(allocation.standard)}, high-capacity ${valueText(allocation.highCapacity)}`:'All extras follow loader setting',
        `Standard storage: ${storageName(spec.spareMagazineStorageId??'none','spareAmmunition')}`,
        `High-capacity storage: ${storageName(spec.highCapacityMagazineStorageId??'none','highCapacitySpareAmmunition')}`];
      if(Object.hasOwn(spec,'initialMagazineSourceId')||spec.alternateMagazineSupplies?.length)parts.push(...magazineSelectionRows(spec,label,weapon,storageName,sourceName).map(item=>item.value));
      return row(label,parts.join(' · '),weapon.source);
    };
    return [selectedRow(weapon,'Shared ammunition selection'),...weapon.ammunitionOverrides.map(copy=>selectedRow(copy,`Copy ${copy.copyIndex} ammunition selection${copy.copyIndex>weapon.linkedWeapons?' · Not installed':''}`))];
  }
  return (weapon.ammunitionCopies||[]).map(copy=>{
    const initial=copy.initialAmmunition,inventory=copy.ammunitionInventory,allocation=inventory?.allocation;
    const parts=[copy.customized?'Customized':'Shared'];
    if(initial)parts.push(`Initial: ${valueText(initial.count)}${initial.type?' '+humanLabel(initial.type):''} · ${valueText(initial.totalRounds)} rounds`);
    for(const [key,label] of [['standard','Standard'],['highCapacity','High-capacity']]){
      const supply=allocation?.[key];
      if(supply)parts.push(`${label}: loader ${valueText(supply.autoloadCount)}, stored ${valueText(supply.storedCount)}`);
    }
    for(const [key,label] of [['spareAmmunition','Standard storage'],['highCapacitySpareAmmunition','High-capacity storage']]){
      const spare=copy[key];if(spare)parts.push(`${label}: ${storageName(spare.storageId,key)} · ${valueText(spare.count)} · ${present(spare.massKg)?massFormat.format(spare.massKg):'Unresolved'} kg estimated`);
    }
    if(inventory)parts.push(`Total: ${valueText(inventory.totalRounds)} rounds · ${money(inventory.totalCost)}`);
    const sources=[weapon.source,initial?.source,allocation?.source,copy.spareAmmunition?.source,copy.highCapacitySpareAmmunition?.source].map(sourceLabel).filter(Boolean);
    return row(`Copy ${copy.copyIndex} ammunition`,parts.join(' · '),[...new Set(sources)].join(' · '));
  });
}
function weaponGripDisplay(weapon,armName) {
  const display={};
  if(weapon.placement==='held'||weapon.placement==='arm')display.primaryManipulator=armName(weapon.manipulatorId);
  if(weapon.supportManipulatorId&&weapon.supportManipulatorId!=='none')display.supportManipulator=armName(weapon.supportManipulatorId);
  if(weapon.gripManipulatorIds)display.grippingManipulators=weapon.gripManipulatorIds.map(armName);
  if(weapon.gripManipulators)display.gripManipulators=weapon.gripManipulators.map(({manipulatorId,...arm})=>({manipulator:armName(manipulatorId),...arm}));
  if(weapon.gripAssignmentStatus)display.gripAssignmentStatus=humanLabel(weapon.gripAssignmentStatus);
  if(Object.hasOwn(weapon,'primaryManipulatorDM'))display.primaryManipulatorHardwareDexDM=weapon.primaryManipulatorDM;
  return display;
}
function metamorphicRows(body,component=false){return [row('Construction status','Provisional'),row('Selected tier',body.label,body.source),row('Tier rate',money(body.pricePerSlot)+' / Slot',body.source),row('Price basis',body.priceBasisSlots+' Base Slots'),row(component?'Body surcharge per component copy':'Body surcharge',money(body.bodyCost)),row('Morph time',body.morphTime,body.source),row('Appearance',body.appearance,body.source),...body.assumptions.map(a=>row(a.label,a.value,a.source,a.provenance)),row('Fixed Size',body.fixedProperties.size),row('Fixed locomotion',humanLabel(body.fixedProperties.primaryLocomotion)+' / '+humanLabel(body.fixedProperties.secondaryLocomotion)),row('Operating scope',body.operatingScope)];}
export function projectReview(design, catalogue, evaluation) {
  const totals = evaluation.totals || evaluation.previewTotals;
  const provisional = evaluation.provisional === true || !evaluation.totals && !!evaluation.previewTotals;
  const provisionalLabel=evaluation.provisional===true?(evaluation.composite?'Provisional component source; purchase scope below':'Provisional construction assumptions; current form only'):'Provisional values only; unresolved errors';
  const coverage = evaluation.coverage || catalogue.coverage || {};
  const status = evaluation.status === 'verified'
    ? evaluation.provisional ? 'Provisional assumptions checked; coverage incomplete' : coverage.complete === true ? 'Checked' : 'Implemented rules checked; coverage incomplete'
    : evaluation.status === 'invalid' ? 'Needs correction' : 'Rules or referee decisions outstanding';
  const sections = [];
  const visible=(rule,values)=>!rule || (rule.anyOf ? rule.anyOf.some(item=>visible(item,values)) : rule.allOf ? rule.allOf.every(item=>visible(item,values)) : Array.isArray(rule.oneOf) ? rule.oneOf.includes(values?.[rule.field]) : Object.hasOwn(rule,'notEquals') ? values?.[rule.field]!==rule.notEquals : values?.[rule.field]===rule.equals);
  const controls = (catalogue.stages || []).flatMap(stage => stage.controls.map(control => ({ ...control, stage:stage.id }))).filter(control=>visible(control.visibleWhen,control.target==='special'?design.special:design.selections?.[control.stage]));
  const physical = design.selections?.physical || {};
  const options = new Map(controls.filter(control => control.type === 'option-instances' || ['options','defaultSuite','optionInstances','optionParameters'].includes(control.field)).flatMap(control => control.choices || []).map(choice => [choice.id,choice]));
  const excluded = evaluation.notApplicableMetrics || [];
  const costLabel = evaluation.costLabel || totals?.costLabel || 'Construction cost';
  const costs = [row(costLabel, money(totals?.cost))];
  if (present(totals?.constructionCost) && totals.constructionCost !== totals.cost) costs.push(row('Construction cost', money(totals.constructionCost)));
  for (const [key,label] of [['slots','Slots'],['bandwidth','Bandwidth']]) if (!excluded.includes(key)) {
    const item = totals?.[key];
    costs.push(row(label, item ? `${valueText(item.used)} / ${valueText(item.capacity)} used${present(item.remaining) ? ` · ${valueText(item.remaining)} free` : ''}` : null));
  }
  sections.push(section('costs','Cost & capacity',costs,{kind:'metrics'}));
  if (totals) {
    const stats = [];
    for (const [key,label,unit] of [['hits','Hits',''],['armour','Protection',''],['intelligence','Intelligence',''],['intelligenceDM','Intelligence DM',''],['agility','Agility',''],['tacticalSpeed','Movement per minor action',' m'],['endurance','Endurance',' hours'],['vehicleEndurance','Vehicle movement endurance',' hours'],['vehicleBand','Vehicle speed band','']]) if (present(totals[key])) stats.push(row(label,valueText(totals[key])+unit));
    for (const [key,label] of [['zeroSlot','Zero-Slot options'],['zeroBandwidth','Zero-bandwidth packages']]) if (totals[key]) stats.push(row(label,`${valueText(totals[key].used)} / ${valueText(totals[key].allowance)}`));
    if (totals.traits?.length) stats.push(row('Traits',totals.traits));
    if (stats.length) sections.push(section('statistics','Robot statistics',stats,{kind:'metrics'}));
  }
  if(evaluation.metamorphic)sections.push(section('metamorphic','Metamorphic body (provisional)',metamorphicRows(evaluation.metamorphic),{note:'Application assumptions; not full-book certification'}));
  const cloneDetails=totals?.clone;
  const development=cloneDetails||evaluation.development;
  if(development){
    const calendar=development.growthCalendar,ageing=development.ageing,source=calendar?.source||evaluation.development?.source;
    const rows=[];
    if(calendar)rows.push(profileRow('Growth calendar',present(calendar.trainingExitApparentAge)?`Apparent age ${valueText(calendar.trainingExitApparentAge)} at training completion`:'Growth calendar requires the selected character pathway',calendar,['trainingExitApparentAge'],'Source interpretation; provisional calendar'));
    if(ageing)rows.push(profileRow('Ageing obligations',`${valueText(ageing.checksDue)} checks due · ${valueText(ageing.effectiveAdultYears)} elapsed adult years`,{...ageing,source},['checksDue','effectiveAdultYears'],'Ageing outcomes unresolved'));
    if(rows.length)sections.push(section('clone-development','Clone growth and ageing',rows,{note:cloneDetails?'Selected growth/training pathway':'Development only; characteristics/prices unresolved'}));
  }
  if(cloneDetails){
    const source=cloneDetails.growthCalendar?.source||{book:'Robot Handbook',pages:'96-99'};
    const stats=Object.entries(cloneDetails.characteristics||{}).map(([name,value])=>row(name,value,source));
    if(present(cloneDetails.education))stats.push(row('EDU',cloneDetails.education,source));
    if(stats.length)sections.push(section('clone-characteristics','Clone characteristics',stats,{kind:'metrics'}));
    sections.push(section('clone-training','Creche training',[
      row('Training points earned',cloneDetails.trainingPoints,source),row('Unspent training points',cloneDetails.unspentTrainingPoints,source),row('Initial EDU',cloneDetails.initialEducation,source),row('Maturity time',present(cloneDetails.maturityYears)?valueText(cloneDetails.maturityYears)+' years':'Not calculated',source),row('Training fee years',cloneDetails.chargedTrainingYears,source)
    ],{note:'EDU before year-end INT; selected convention; character background separate'}));
    if(cloneDetails.annualTraining?.length)sections.push(section('clone-training-years','Annual clone training records',cloneDetails.annualTraining.map(year=>profileRow(`Year ${year.additionalYear}`,`EDU ${valueText(year.education)} · INT ${valueText(year.intelligence)}`,{...year,source},['additionalYear','education','intelligence','timing'],'EDU before year-end INT; other purchases by graduation')),{collapsed:true}));
    sections.push(section('clone-template','Clone template and timing details',[profileRow('Selected template','Adult template characteristics and explicit schedule',{templateCharacteristics:cloneDetails.templateCharacteristics,intTrainingSchedule:cloneDetails.intTrainingSchedule,spareBody:cloneDetails.spareBody,source})],{collapsed:true}));
  }
  // Only describe selections exposed by this type's catalogue; clones must not inherit ordinary defaults.
  const configuration = controls.filter(control => !['physical','skills','finalisation'].includes(control.stage) && ['select','number','text'].includes(control.type)).map(control => {
    const value = control.readOnly && Object.hasOwn(control,'derivedValue') ? control.derivedValue : control.target === 'special' ? design.special?.[control.field] : design.selections?.[control.stage]?.[control.field];
    if (!present(value)) return null;
    const choice = control.choices?.find(item => item.id === value);
    return row(control.label,choice?.label ?? value,choice?.source || control.source);
  }).filter(Boolean);
  if (configuration.length) sections.push(section('configuration','Selected construction',configuration,{collapsed:true}));
  const equipment = [];
  const equipmentRow = (id,params,context,instanceId,ledgerPrefix = 'instance-') => {
    const choice = options.get(id);
    const ledgerId = instanceId ? `${ledgerPrefix}${instanceId}` : `${context==='Default suite'?'default':'option'}-${id}`;
    const ledger = evaluation.ledger?.find(item => item.id === ledgerId || item.id?.startsWith(ledgerId + ':'));
    const parameterContext = context === 'Default suite' ? 'defaultSuite' : 'options';
    const visibleParameters = Object.entries(params).filter(([key]) => {
      const control = choice?.parameterControls?.find(item => item.field === key);
      return (!control?.appliesTo || control.appliesTo === parameterContext) && visible(control?.visibleWhen,params);
    });
    const parameterValues = Object.fromEntries(visibleParameters.map(([key,value]) => {
      const control = choice?.parameterControls?.find(item => item.field === key);
      const selected = control?.choices?.find(item => item.id === value);
      return [control?.label || key,Array.isArray(value)?value.map(id=>control?.choices?.find(choice=>choice.id===id)?.label??id):selected?.label ?? value];
    }));
    const hasQuantity = visibleParameters.some(([key]) => key === 'quantity' || key === 'suiteQuantity');
    const compactParameters=Object.fromEntries(visibleParameters.filter(([key,value])=>{
      const control=choice?.parameterControls?.find(item=>item.field===key);
      return !control || !Object.hasOwn(control,'default') || JSON.stringify(value)!==JSON.stringify(control.default);
    }).map(([key])=>{const label=choice?.parameterControls?.find(item=>item.field===key)?.label||key;return[label,parameterValues[label]];}));
    const summary={placement:context,...(present(ledger?.quantity)&&!hasQuantity?{quantity:ledger.quantity}:{}),...compactParameters};
    return {...row(choice?.label || humanLabel(id),summary,choice?.source || ledger?.source),details:[...Object.entries(parameterValues).map(([label,value])=>row(label,value)),...(instanceId?[row('Installation','Separate copy')]:[])]};
  };
  for(const control of controls.filter(control=>['defaultSuite','options'].includes(control.field))){
    const values=control.target==='special'?design.special:design.selections?.[control.stage];
    for(const id of values?.[control.field]||[])equipment.push(equipmentRow(id,values.optionParameters?.[id]||{},control.field==='defaultSuite'?'Default suite':'Installed option'));
  }
  for (const control of controls.filter(control => control.type === 'option-instances' || control.field === 'optionInstances')) {
    const records = control.target === 'special' ? design.special?.[control.field] : design.selections?.[control.stage]?.[control.field];
    for (const item of records || []) equipment.push(equipmentRow(item.optionId,item.parameters || {},control.field === 'optionInstances' ? 'Separate installation' : control.label,item.id,control.ledgerPrefix));
  }
  if (equipment.length) sections.push(section('equipment','Installed equipment',equipment));
  const augmentResult = totals?.augmentation;
  const augmentations = totals?.augmentations || augmentResult?.augmentations || [];
  if (augmentations.length) sections.push(section('augmentations','Cybernetic part profiles',augmentations.map(item => {
    const attributes = item.characteristics;
    const summary = [
      money(item.totalCost),
      present(item.quantity) ? `${valueText(item.quantity)} part(s)` : '',
      attributes ? `STR ${valueText(attributes.strength)} / DEX ${valueText(attributes.effectiveDexterity)}` : '',
      present(item.slots?.remaining) ? `${valueText(item.slots.remaining)} free limb Slots` : ''
    ].filter(Boolean).join(' · ');
    return profileRow(item.label || options.get(item.optionId)?.label || 'Cybernetic part',summary,item,['totalCost','quantity','robotBrain','generalComputer','weapons','weaponAccounting'],'Part-specific effects; no automatic recipient grant');
  }),{note:'Part-specific effects; shared interfaces separate'}));
  const sharedInterfaces = totals?.sharedInterfaces || augmentResult?.sharedInterfaces || [];
  if (sharedInterfaces.length) sections.push(section('augmentation-interfaces','Shared cybernetic interfaces',sharedInterfaces.map(item=>profileRow(`${titleName(item.sense)} interface`,money(item.totalCost),item,['totalCost','recordIds'])),{collapsed:true}));
  const augmentationEffects = totals?.augmentationEffects || augmentResult?.effects;
  if (augmentationEffects) sections.push(section('augmentation-effects','Cybernetic effects',Object.entries(presentationFacts(augmentationEffects)||{}).filter(([,value])=>present(value)).map(([key,value])=>row(humanLabel(key),value)),{collapsed:true}));
  const verifiedRecords=evaluation.verifiedVehicleInstallations||[];
  if(verifiedRecords.length)sections.push(section('verified-vehicle-options','Vehicle options (2026 source)',verifiedRecords.map(item=>vehicleOptionReviewRow(item))));
  const externalControl = controls.find(control=>control.type==='external-vehicle-options');
  const externalRecords = externalControl ? design.selections?.[externalControl.stage]?.[externalControl.field] || [] : [];
  if (externalRecords.length) sections.push(section('external-options','Unverified external vehicle options',externalRecords.map(record=>{
    const estimate=evaluation.externalVehicleEstimates?.find(item=>item.id===record.id);
    const fields=(externalControl.itemFields || []).filter(field=>present(record[field.field])&&visible(field.visibleWhen,record)).map(field=>{
      const value=record[field.field],choice=field.choices?.find(item=>item.id===value);
      return row(field.label,choice?.label??value);
    });
    const result=row(record.name || 'External option',estimate ? `${money(estimate.quotedCost)} quoted; ${present(estimate.convertedSlots)?valueText(estimate.convertedSlots)+' converted Slots':'Slots unresolved'}` : 'Not calculated',{book:record.sourceTitle,edition:record.sourceEdition,pages:record.sourcePage},'Source estimate; installation unverified; not certified');
    return {...result,details:fields};
  }),{note:'External conversion estimate; Handbook equivalence required'}));
  const referenceControl=controls.find(control=>control.type==='design-references');
  const selectedReferences=referenceControl?design.special?.[referenceControl.field]||[]:[];
  const components=evaluation.composite?.components||totals?.composite?.components||[];
  if(selectedReferences.length){
    const rows=selectedReferences.map(reference=>{
      const component=components.find(item=>item.id===reference.id);
      const role=referenceControl.choices?.find(choice=>choice.id===reference.role)?.label||humanLabel(reference.role);
      const summary=component ? `${money(component.constructionCost)} construction · ${role}` : `Selected ${role}; construction not calculated`;
      const details=[row('Quantity',reference.quantity),row('Robot type',catalogue.kinds?.find(kind=>kind.id===reference.design?.kind)?.label||humanLabel(reference.design?.kind)),row('Tech level',reference.design?.techLevel)];
      if(component){
        details.push(row('Construction check',component.status==='verified'?(component.provisional?'Provisional assumptions checked':'Implemented component rules checked'):humanLabel(component.status)),row('Construction per copy',money(component.constructionUnitCost)),row('Listed price per copy',money(component.listedUnitCost)),row('Cost scope',component.costScope));
        if(component.metamorphic&&component.role!=='installed-brain')details.push(...metamorphicRows(component.metamorphic,true));
        if(component.sourceProvenance?.kind==='metamorphic')details.push(row('Source construction','Provisional metamorphic snapshot'),row('Purchase boundary','Brain and software only; source body excluded'),row('Morph capability','Not purchased'));
        if(component.slots)details.push(row(component.role==='installed-brain'?'Source body Slots (not purchased)':'Component Slots',component.slots));
        if(component.bandwidth)details.push(row('Component Bandwidth',component.bandwidth));
        if(component.coverage)details.push(row('Coverage',component.coverage.complete?'Selected construction covered':'Coverage incomplete'));
      }
      return {...row(reference.design?.name||'Unnamed component',summary,component?.source||referenceControl.source,'Detached snapshot; rechecked'),details};
    });
    sections.push(section('components','Referenced component designs',rows,{note:'Component accounting; external host unverified'}));
    const componentVehicleRows=components.flatMap(component=>(component.verifiedVehicleInstallations||[]).map(item=>vehicleOptionReviewRow(item,component)));
    if(componentVehicleRows.length)sections.push(section('component-vehicle-options','Component vehicle options (2026 source)',componentVehicleRows,{collapsed:true,note:'Per component copy; no host grant'}));
    const profiles=[];
    for(const component of components.filter(component=>component.profile)){
      const profile=component.profile;
      profiles.push(profileRow(component.name,'Referenced robot profile',{...profile,manipulators:(profile.manipulators||[]).map(({id,...arm},index)=>({arm:index+1,...arm}))},['scope','weapons','skills','hardwareSkills'],component.role==='installed-brain'?'Source robot context; only brain/software purchased':'Component-only values; no host grant'));
      for(const skill of profile.skills||[])profiles.push(profileRow(`${component.name} / ${skill.label||titleName(skill.skill||skill.id)}`,`Installed level ${valueText(skill.level)} · Effective ${valueText(skill.effectiveLevel)}`,skill,['level','effectiveLevel'],'Component-only software'));
      for(const weapon of profile.weapons||[]){
        const snapshot=selectedReferences.find(reference=>reference.id===component.id)?.design;
        const storageName=id=>{
          const instance=(snapshot?.selections?.physical?.optionInstances||[]).find(item=>'instance:'+item.id===id);
          if(instance)return titleName(instance.optionId)+' (separate installation '+((snapshot.selections.physical.optionInstances.indexOf(instance))+1)+')';
          const standard=(snapshot?.selections?.physical?.options||[]).find(option=>'option:'+option===id);
          return standard?titleName(standard)+' (standard selection)':'Unresolved storage';
        };
        const componentArmNames=new Map((profile.manipulators||snapshot?.selections?.physical?.manipulators||[]).map((arm,index)=>[arm.id,`${arm.kind==='base'?'Base arm':arm.kind==='leg'?'Converted leg':'Additional arm'} ${index+1}`]));
        const display={...weapon,...weaponGripDisplay(weapon,id=>componentArmNames.get(id)||'Unspecified manipulator'),...ammunitionInventoryDisplay(weapon),...(weapon.magazineVariants?{magazineVariants:ammunitionMassDisplay(weapon.magazineVariants)}:{}),...(weapon.highCapacitySpareAmmunition?{highCapacitySpareAmmunition:spareAmmunitionDisplay(weapon.highCapacitySpareAmmunition,storageName(weapon.highCapacitySpareAmmunition.storageId))}:{}),...(weapon.spareAmmunition?{spareAmmunition:spareAmmunitionDisplay(weapon.spareAmmunition,storageName(weapon.spareAmmunition.storageId))}:{})};
        const weaponRow=profileRow(`${component.name} / ${weapon.label||'Weapon'}`,`${present(weapon.damage)?weapon.damage+' damage':'Damage not calculated'} · ${weaponRange(weapon.range)}`,display,['damage','range','manipulatorId','supportManipulatorId','gripManipulatorIds','primaryManipulatorDM','parentLimb','spareMagazineStorageId','highCapacityMagazineStorageId'],'Component-only weapon; attack/delivery conditional');
        for(const item of weaponRow.details){if(item.label==='Autoload Allocation')item.label='Selected loader allocation per weapon';if(item.label==='High Capacity Spare Ammunition')item.label='High-capacity spare ammunition (estimated mass)';if(item.label==='Spare Ammunition')item.label='Spare ammunition (estimated mass)';if(item.label==='Mass Kg')item.label='Source weapon mass (kg)';}
        const sourceName=id=>profile.weapons?.find(item=>item.weaponId===id)?.label||catalogue.stages?.flatMap(stage=>stage.controls||[]).flatMap(control=>control.itemFields||[]).find(item=>item.field==='weaponId')?.choices?.find(item=>item.id===id)?.label||'Unavailable magazine source';
        weaponRow.details.push(...ammunitionProductRows(weapon,storageName,sourceName),...ammunitionCopyRows(weapon,storageName,sourceName));
        profiles.push(weaponRow);
      }
      for(const effect of component.equipmentOperations||[])profiles.push(profileRow(`${component.name} / ${effect.label||'Equipment readiness'}`,conditionLabel(effect.condition)||humanLabel(effect.status||'Conditional'),effect,['condition','status'],'Component-only condition'));
    }
    if(profiles.length)sections.push(section('component-profiles','Referenced robot profiles',profiles,{collapsed:true}));
    const derived=evaluation.composite?.derivedInputs||totals?.composite?.derivedInputs;
    if(derived&&Object.keys(derived).length)sections.push(section('component-derived','Integration values from component designs',Object.entries(presentationFacts(derived)||{}).map(([key,value])=>row(humanLabel(key),value,evaluation.composite?.source||referenceControl.source)),{collapsed:true,note:'Source-derived component inputs'}));
  }
  const armNames = new Map((totals?.manipulators || physical.manipulators || []).map((arm,index)=>[arm.id,`${arm.kind==='base'?'Base arm':arm.kind==='leg'?'Converted leg':'Additional arm'} ${index+1}`]));
  const armName = id => armNames.get(id) || 'Unspecified manipulator';
  if (totals?.manipulators?.length) sections.push(section('manipulators','Manipulators',totals.manipulators.map(arm => profileRow(armName(arm.id),`Size ${valueText(arm.size)} · STR ${valueText(arm.strength)} · DEX ${valueText(arm.dexterity)}`,arm,['kind','size','strength','dexterity']))));
  const skillRows = records => (records || []).map(skill => {
    const name = skill.label || skill.name || titleName(skill.skill || skill.id || 'Skill');
    const idName = skill.id?.includes(':') ? `${titleName(skill.id.split(':')[0])} (${skill.id.split(':').slice(1).join(':')})` : name;
    const summary = [`Installed level ${valueText(skill.level)}`,`Effective ${present(skill.effectiveLevel)?valueText(skill.effectiveLevel):'level unresolved'}`,skill.characteristic ? `${skill.characteristic==='variable'?'Variable characteristic':skill.characteristic}` : ''].filter(Boolean).join(' · ');
    const details = {...skill};
    if(skill.modifierOptions)details.modifierOptions=skill.modifierOptions.map(item=>({manipulator:armName(item.manipulatorId),modifier:item.modifier,effectiveLevel:item.effectiveLevel}));
    return profileRow(idName,summary,details,['level','effectiveLevel','characteristic','speciality']);
  });
  const implantBrains=augmentations.filter(item=>item.robotBrain);
  if(implantBrains.length){
    const name=item=>item.label||options.get(item.optionId)?.label||'Implant brain';
    sections.push(section('implant-brains','Implant brains',implantBrains.map(item=>{
      const brain=item.robotBrain;
      return profileRow(name(item),`INT ${valueText(brain.intelligence)} · Bandwidth ${valueText(brain.bandwidth?.used)} / ${valueText(brain.bandwidth?.capacity)}`,brain,['intelligence','skills'],'Implant-only skills; no recipient grant');
    })));
    const rows=implantBrains.flatMap(item=>skillRows(item.robotBrain.skills).map(record=>({...record,label:name(item)+' / '+record.label,detail:'Implant-only skill; no recipient grant',source:sourceLabel(item.robotBrain.source)})));
    if(rows.length)sections.push(section('implant-skills','Implant skill software',rows));
  }
  const computers=augmentations.filter(item=>item.generalComputer);
  if(computers.length){
    sections.push(section('computers','Implanted general computers',computers.map(item=>profileRow(item.label||options.get(item.optionId)?.label||'Computer',`Processing ${valueText(item.generalComputer.activeBandwidth)} active / ${valueText(item.generalComputer.processing)} available`,item.generalComputer,['programs'],'Computer-only software; no robot/recipient skill grant'))));
    const programs=computers.flatMap(item=>(item.generalComputer.programs||[]).map(program=>profileRow(`${item.label||'Computer'} / ${program.label}${program.subject?' ('+program.subject+')':''}`,`Purchased rating ${valueText(program.rating)} · ${program.active?'Running at rating '+valueText(program.runningBandwidth):'Stored, not running'}`,program,['parentComputer','program','rating','runningBandwidth','subject','databasePrice','expertUse'],'Computer-only program; conditional use')));
    if(programs.length)sections.push(section('computer-programs','Computer program states',programs));
  }
  const selectedCustom=[],selectedMedical=[];
  const recordChoice=(field,record)=>((field?.choicesBy?.values?.[record?.[field.choicesBy.field]])||field?.choices||[]).find(choice=>choice.id===record[field?.field]);
  for(const control of controls.filter(control=>control.type==='custom-packages'&&control.field!=='customPackages')){
    const records=control.target==='special'?design.special?.[control.field]:design.selections?.[control.stage]?.[control.field];
    for(const record of records||[]){
      const nameField=control.itemFields?.find(field=>field.field===(control.recordNameField||'skill'));
      const name=recordChoice(nameField,record)?.label||titleName(record[control.recordNameField||'skill']);
      const detail=record[control.recordDetailField||'speciality'];
      const details=(control.itemFields||[]).filter(field=>present(record[field.field])&&visible(field.visibleWhen,record)).map(field=>row(field.label,recordChoice(field,record)?.label??record[field.field]));
      const summary=control.summaryFields?control.summaryFields.map(key=>{const field=control.itemFields.find(field=>field.field===key);return (field?.label||humanLabel(key))+': '+(recordChoice(field,record)?.label??valueText(record[key]));}).join(' · '):`Selected level ${valueText(record.level)}`;
      (control.field==='medicalPackages'?selectedMedical:selectedCustom).push({...row(name+(detail?' ('+detail+')':''),summary,control.source||recordChoice(nameField,record)?.source,control.label),details});
    }
  }
  if(selectedCustom.length)sections.push(section('selected-custom-skills','Selected programs and training',selectedCustom,{collapsed:true,note:'Retained selections; checked effects separate'}));
  if(selectedMedical.length)sections.push(section('selected-medical-packages','Selected medical packages',selectedMedical,{collapsed:true,note:'Retained selections; purchased/active totals separate'}));
  const skills = skillRows(totals?.skills);
  if (!totals) {
    const skillControl = controls.find(control => control.field === 'packages');
    for (const id of skillControl ? design.selections?.skills?.packages || [] : []) {
      const choice = skillControl.choices?.find(item=>item.id===id);
      skills.push(row(choice?.label || titleName(id),'Selected; effective level not calculated',choice?.source));
    }
    if (controls.some(control=>control.field==='customPackages')) skills.push(...skillRows(design.selections?.skills?.customPackages));
  }
  if (skills.length) sections.push(section('skills','Skill packages',skills));
  if (totals?.hardwareSkills?.length) sections.push(section('hardware-skills','Hardware skills',totals.hardwareSkills.map(item=>profileRow(titleName(item.skill),`Level ${valueText(item.level)} · Characteristic DM ${valueText(item.characteristicModifier)}`,item,['skill','level','characteristicModifier'],options.get(item.sourceOption)?.label || 'Hardware-provided skill'))));
  if (totals?.skillEquivalents?.length) sections.push(section('skill-equivalents','Characteristic-based equivalents',totals.skillEquivalents.map(item=>profileRow(`${titleName(item.skill)}${item.speciality?' ('+item.speciality+')':''}`,`Level: ${valueText(item.level)}${item.manipulatorId?' · '+armName(item.manipulatorId):''}`,item,['skill','speciality','level','manipulatorId'])),{collapsed:true}));
  if (totals?.toolCaps?.length) sections.push(section('tool-caps','Tool skill limits',totals.toolCaps.map(item=>profileRow(options.get(item.optionId)?.label || titleName(item.optionId),Object.entries(item.skills || {}).map(([skill,level])=>`${titleName(skill)} up to ${valueText(level)}`).join(' · '),item,['skills','detail'],item.detail || '')),{note:'Tool limits only; no software grant'}));
  const capabilities=totals?.equipmentCapabilities || totals?.capabilities || [];
  for(const category of [...new Set(capabilities.map(item=>item.category||'equipment'))]) {
    const records=capabilities.filter(item=>(item.category||'equipment')===category);
    sections.push(section('capabilities-'+category,`${titleName(category)} capabilities`,records.map(item=>profileRow(item.label || options.get(item.optionId)?.label || titleName(item.id),[item.status?titleName(item.status):'',conditionLabel(item.condition)||'Source-defined limits'].filter(Boolean).join(' · '),item,['category','status','condition'])),{collapsed:true,note:'Conditional capabilities; task outcomes unresolved'}));
  }
  const choiceLabel = (control,field,id,fallback) => control?.itemFields?.find(item=>item.field===field)?.choices?.find(item=>item.id===id)?.label || fallback || humanLabel(id);
  const weaponRows = (weapons,control,parentLabel='') => weapons.flatMap(weapon=>{
    const selected=control?.itemFields?.find(item=>item.field==='weaponId')?.choices?.find(item=>item.id===weapon.weaponId);
    if(!weapon.poweredMelee&&selected?.poweredMelee)weapon={...weapon,poweredMelee:true,acquisition:selected.acquisition,powerOperation:selected.powerOperation,conditionalEffects:selected.conditionalEffects,source:selected.source};
    const name=weapon.label || choiceLabel(control,'weaponId',weapon.weaponId,'Selected weapon');
    const storageName=id=>choiceLabel(control,'ammunitionStorageId',id,'Unresolved storage');
    const ammunitionName=id=>choiceLabel(control,'auxiliaryAmmunition',id);
    const summary=[present(weapon.damage)?`${weapon.damage} damage`:'Damage not calculated',weaponRange(weapon.range),weapon.traits?.length?weapon.traits.join(', '):''].filter(Boolean).join(' · ');
    const placement=parentLabel ? choiceLabel(control,'placement',weapon.placement) : weapon.placement==='arm' ? `Mounted on ${armName(weapon.manipulatorId)}` : weapon.placement==='held' ? `Held by ${armName(weapon.manipulatorId)}${weapon.supportManipulatorId&&weapon.supportManipulatorId!=='none'?' and '+armName(weapon.supportManipulatorId):''}` : weapon.placement ? `${titleName(weapon.placement)} mount` : 'Placement unresolved';
    const detail=[parentLabel,placement,`Software Level: ${valueText(weapon.softwareLevel)}`,`FCS DM: ${valueText(weapon.fireControlDM)}`,`DEX DM: ${valueText(weapon.manipulatorDM)}`].filter(Boolean).join(' · ');
    const accessoryChoices=control?.itemFields?.find(item=>item.field==='accessories')?.choices||[];
    const accessoryName=id=>accessoryChoices.find(item=>item.id===id)?.label||humanLabel(id);
    const displayWeapon={...weapon,...weaponGripDisplay(weapon,parentLabel?()=>parentLabel:armName),...ammunitionInventoryDisplay(weapon),...(weapon.magazineVariants?{magazineVariants:ammunitionMassDisplay(weapon.magazineVariants)}:{}),...(weapon.highCapacitySpareAmmunition?{highCapacitySpareAmmunition:spareAmmunitionDisplay(weapon.highCapacitySpareAmmunition,choiceLabel(control,'highCapacityMagazineStorageId',weapon.highCapacitySpareAmmunition.storageId,'Unresolved storage'))}:{}),...(weapon.spareAmmunition?{spareAmmunition:spareAmmunitionDisplay(weapon.spareAmmunition,choiceLabel(control,'spareMagazineStorageId',weapon.spareAmmunition.storageId,'Unresolved storage'))}:{}),...(weapon.looseAmmunition?{looseAmmunition:(({storageId,...rest})=>({...rest,storage:storageName(storageId),grenade:ammunitionName(rest.grenade)}))(weapon.looseAmmunition)}:{}),accessoryEffects:(weapon.accessoryEffects||[]).map(effect=>({...effect,accessory:accessoryName(effect.accessory)}))};
    const result=profileRow(name,summary,displayWeapon,['damage','range','traits','placement','manipulatorId','supportManipulatorId','gripManipulatorIds','primaryManipulatorDM','parentLimb','accessories','auxiliary','associatedAttacks','ammunitionStorageId','spareMagazineStorageId','highCapacityMagazineStorageId'],detail);
    for(const item of result.details){if(item.label==='Autoload Allocation')item.label='Selected loader allocation per weapon';if(item.label==='High Capacity Spare Ammunition')item.label='High-capacity spare ammunition (estimated mass)';if(item.label==='Spare Ammunition')item.label='Spare ammunition (estimated mass)';if(item.label==='Mass Kg')item.label='Source weapon mass (kg)';}
    for(const id of weapon.accessories||[]){const accessory=accessoryChoices.find(item=>item.id===id);result.details.push(row('Accessory',accessoryName(id),accessory?.source));}
    const magazineStorageName=(id,key)=>choiceLabel(control,key==='highCapacitySpareAmmunition'?'highCapacityMagazineStorageId':'spareMagazineStorageId',id,'Unresolved storage'),magazineSourceName=id=>choiceLabel(control,'weaponId',id,'Unavailable magazine source');
    result.details.push(...ammunitionProductRows(weapon,magazineStorageName,magazineSourceName),...ammunitionCopyRows(weapon,magazineStorageName,magazineSourceName));
    const rows=[result];
    for(const attack of weapon.associatedAttacks || (weapon.auxiliary?[weapon.auxiliary]:[])){
      const label=attack.mode==='integral-acr'?'included muzzle launcher':attack.mode==='attached'?'attached launcher':'secondary launcher';
      rows.push(profileRow(name+' / secondary launcher / '+label,`${present(attack.damage)?attack.damage+' damage':'Damage unresolved'} · Range ${valueText(attack.range)} m`,{...attack,ammunition:attack.ammunition?ammunitionName(attack.ammunition):null},['profileId','parentWeaponId','damage','range','context'],[parentLabel,'Secondary attack; cost included'].filter(Boolean).join(' ')));
    }
    return rows;
  });
  const storageRows=(records,control)=>records.map(item=>profileRow(choiceLabel(control,'ammunitionStorageId',item.storageId,'Unresolved storage'),`${massFormat.format(item.reservedKg)} / ${massFormat.format(item.capacityKg)} kg reserved · ${massFormat.format(item.remainingKg)} kg remaining`,item,['storageId','reservedKg','capacityKg','remainingKg','scope'],'Source estimate; other cargo/handling unverified'));
  const weaponControl=controls.find(control=>control.field==='weapons');
  const weapons=totals?.weapons || (weaponControl?physical.weapons||[]:[]);
  if(weapons.length)sections.push(section('weapons','Weapons',weaponRows(weapons,weaponControl),{note:totals?'Attack modifiers contextual; hardware/software separate':'Selected installations; performance not calculated'}));
  if(totals?.ammunitionStorage?.length)sections.push(section('ammunition-storage','Ammunition storage reservations',storageRows(totals.ammunitionStorage,weaponControl),{collapsed:true}));
  const limbWeaponControl=controls.find(control=>control.field==='augmentWeapons');
  const limbRows=[];
  if(augmentations.length){
    for(const part of augmentations.filter(part=>part.weapons?.length)){
      const name=choiceLabel(limbWeaponControl,'parentLimb',part.id,part.label||'Cybernetic limb');
      limbRows.push(profileRow(name,`${money(part.weaponAccounting?.totalCost)} weapon installations`,part.weaponAccounting||{},['ammunitionStorage'],'Per-limb capacity; cost included in part total'));
      limbRows.push(...weaponRows(part.weapons,limbWeaponControl,name));
      if(part.weaponAccounting?.ammunitionStorage?.length)limbRows.push(...storageRows(part.weaponAccounting.ammunitionStorage,limbWeaponControl));
    }
  }else if(limbWeaponControl){
    for(const weapon of design.special?.augmentWeapons||[])limbRows.push(...weaponRows([weapon],limbWeaponControl,choiceLabel(limbWeaponControl,'parentLimb',weapon.parentLimb,'Unresolved parent limb')));
  }
  if(limbRows.length)sections.push(section('limb-weapons','Cyberlimb weapons',limbRows,{note:totals?'Part-specific effects; recipient skill/attack modifiers unresolved':'Selected limb weapons; performance/cost not calculated'}));
  const handled = new Set(['cost','constructionCost','costLabel','slots','bandwidth','zeroSlot','zeroBandwidth','hits','armour','intelligence','intelligenceDM','agility','tacticalSpeed','endurance','vehicleEndurance','vehicleBand','traits','manipulators','skills','hardwareSkills','skillEquivalents','toolCaps','weapons','defaultSuite','provisional','augmentation','augmentations','sharedInterfaces','augmentationEffects','equipmentCapabilities','capabilities','ammunitionStorage','composite','clone','metamorphic']);
  const extra = Object.entries(presentationFacts(totals)||{}).filter(([key,value])=>!handled.has(key)&&present(value)&&(!Array.isArray(value)||value.length)).map(([key,value])=>row(humanLabel(key),value));
  if (extra.length) sections.push(section('additional','Operating details',extra,{collapsed:true}));
  const ledger = (evaluation.ledger || []).map(item => row(armNames.has(item.id)?armName(item.id):item.label || item.name || item.id,
    [present(item.cost) ? money(item.cost) : item.cost===null?'Cost unresolved':null,present(item.slots)?`${valueText(item.slots)} slots`:item.slots===null?'Slots unresolved':null,present(item.bandwidth)?`${valueText(item.bandwidth)} bandwidth`:null,present(item.quantity)?`Quantity ${valueText(item.quantity)}`:null].filter(Boolean).join(' · '),item.source,[item.note?'Source-qualified accounting':'',sourceLabel(item.weaponSource),sourceLabel(item.externalSource)].filter(Boolean).join(' · ')));
  if (ledger.length) sections.push(section('ledger','Construction breakdown',ledger,{collapsed:true}));
  const warnings = (evaluation.diagnostics || []).map(item => row(humanLabel(item.severity || 'Check'),diagnosticLabel(item),item.source,diagnosticContext(item,design,catalogue)));
  if (!warnings.length) warnings.push(row('Checks',evaluation.status==='verified'?'Implemented checks passed; coverage incomplete':'Calculation not verified'));
  sections.push(section('warnings','Checks and limitations',warnings));
  const gaps = [...(coverage.gaps || []),...(coverage.compositeBoundaries||[])].map(item=>row('Coverage',coverageLabel(item),item.source));
  if (gaps.length) sections.push(section('coverage','Implementation coverage',gaps,{collapsed:true,note:'Coverage incomplete'}));
  const sources = [...new Set(sections.flatMap(item=>item.rows.flatMap(record=>[record.source,...(record.details||[]).map(detail=>detail.source)])).filter(Boolean))];
  if (sources.length) sections.push(section('sources','Source references',sources.map((source,index)=>row(String(index+1),source)),{collapsed:true}));
  return { name:design.name || 'Untitled robot', kind:catalogue.kinds?.find(item=>item.id===design.kind)?.label || design.kind, techLevel:design.techLevel, status, provisional, provisionalLabel, unavailable:!totals, sections };
}
export function formatStatblock(review) {
  const rows = [review.name,`${review.kind} | TL ${review.techLevel}`,review.status];
  if (review.provisional) rows.push(review.provisionalLabel);
  if (review.unavailable) rows.push('Totals are not calculated; selected components only; not verified');
  for (const group of review.sections) {
    rows.push('',group.title);
    if (group.note) rows.push(group.note);
    for (const item of group.rows) {
      rows.push(`${item.label}: ${item.value}${item.detail?' | '+item.detail:''}${item.source?' | '+item.source:''}`);
      for(const detail of item.details || [])rows.push(`  ${detail.label}: ${detail.value}${detail.detail?' | '+detail.detail:''}${detail.source?' | '+detail.source:''}`);
    }
  }
  rows.push('','Robot Handbook (Mongoose Publishing, 2022). Unofficial fan-made tool.','Implemented rules only; coverage incomplete; outstanding checks apply');
  return rows.join('\n');
}
