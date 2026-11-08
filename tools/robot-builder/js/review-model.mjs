// Read-only presentation projection. No construction rules or calculated totals live here.
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const present = value => value !== undefined && value !== null;
export function humanLabel(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_:]/g, ' ').replace(/^./, ch => ch.toUpperCase());
}
export function sourceLabel(source) {
  if (!source) return '';
  if (typeof source === 'string') return source;
  return [source.book || source.title, source.edition, present(source.pages ?? source.page) ? `p. ${source.pages ?? source.page}` : '', source.note].filter(Boolean).join(' · ');
}
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
  const hidden = new Set(['id','weaponId','optionId','sourceOption','label','name','source',...omitted]);
  const details = Object.entries(record).filter(([key])=>!hidden.has(key)).map(([key,value])=>row(humanLabel(key),value));
  return {...row(label,summary,record.source,detail),details};
}
export function projectReview(design, catalogue, evaluation) {
  const totals = evaluation.totals || evaluation.previewTotals;
  const provisional = !evaluation.totals && !!evaluation.previewTotals;
  const coverage = evaluation.coverage || catalogue.coverage || {};
  const status = evaluation.status === 'verified'
    ? coverage.complete === true ? 'Checked' : 'Implemented rules checked; coverage incomplete'
    : evaluation.status === 'invalid' ? 'Needs correction' : 'Rules or referee decisions outstanding';
  const sections = [];
  const visible=(rule,values)=>!rule || (rule.allOf ? rule.allOf.every(item=>visible(item,values)) : Array.isArray(rule.oneOf) ? rule.oneOf.includes(values?.[rule.field]) : Object.hasOwn(rule,'notEquals') ? values?.[rule.field]!==rule.notEquals : values?.[rule.field]===rule.equals);
  const controls = (catalogue.stages || []).flatMap(stage => stage.controls.map(control => ({ ...control, stage:stage.id }))).filter(control=>visible(control.visibleWhen,control.target==='special'?design.special:design.selections?.[control.stage]));
  const physical = design.selections?.physical || {};
  const options = new Map(controls.filter(control => control.type === 'option-instances' || ['options','defaultSuite','optionInstances','optionParameters'].includes(control.field)).flatMap(control => control.choices || []).map(choice => [choice.id,choice]));
  const excluded = evaluation.notApplicableMetrics || [];
  const costLabel = evaluation.costLabel || totals?.costLabel || 'Construction cost';
  const costs = [row(costLabel, money(totals?.cost))];
  if (present(totals?.constructionCost) && (totals.constructionCost !== totals.cost || costLabel !== 'Construction cost')) costs.push(row('Construction cost', money(totals.constructionCost)));
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
  // Only describe selections exposed by this type's catalogue; clones must not inherit ordinary defaults.
  const configuration = controls.filter(control => !['physical','skills','finalisation'].includes(control.stage) && ['select','number','text'].includes(control.type)).map(control => {
    const value = control.target === 'special' ? design.special?.[control.field] : design.selections?.[control.stage]?.[control.field];
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
      return [control?.label || key,selected?.label ?? value];
    }));
    const hasQuantity = visibleParameters.some(([key]) => key === 'quantity' || key === 'suiteQuantity');
    const details = { placement:context, ...(present(ledger?.quantity) && !hasQuantity ? { quantity:ledger.quantity } : {}), ...parameterValues };
    return {...row(choice?.label || humanLabel(id),details,choice?.source || ledger?.source),details:instanceId?[row('Installation reference',instanceId)]:[]};
  };
  if (controls.some(control => control.field === 'defaultSuite')) for (const id of physical.defaultSuite || []) equipment.push(equipmentRow(id,physical.optionParameters?.[id] || {},'Default suite'));
  if (controls.some(control => control.field === 'options')) for (const id of physical.options || []) equipment.push(equipmentRow(id,physical.optionParameters?.[id] || {},'Installed option'));
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
    return profileRow(item.label || options.get(item.optionId)?.label || 'Cybernetic part',summary,item,['totalCost','quantity']);
  }),{note:'Shared interfaces are itemised separately. Limb and sensory effects apply only in their stated context.'}));
  const sharedInterfaces = totals?.sharedInterfaces || augmentResult?.sharedInterfaces || [];
  if (sharedInterfaces.length) sections.push(section('augmentation-interfaces','Shared cybernetic interfaces',sharedInterfaces.map(item=>profileRow(`${titleName(item.sense)} interface`,money(item.totalCost),item,['totalCost','recordIds'])),{collapsed:true}));
  const augmentationEffects = totals?.augmentationEffects || augmentResult?.effects;
  if (augmentationEffects) sections.push(section('augmentation-effects','Cybernetic effects',Object.entries(augmentationEffects).filter(([,value])=>present(value)).map(([key,value])=>row(humanLabel(key),value)),{collapsed:true}));
  const externalControl = controls.find(control=>control.type==='external-vehicle-options');
  const externalRecords = externalControl ? design.selections?.[externalControl.stage]?.[externalControl.field] || [] : [];
  if (externalRecords.length) sections.push(section('external-options','Unverified external vehicle options',externalRecords.map(record=>{
    const estimate=evaluation.externalVehicleEstimates?.find(item=>item.id===record.id);
    const fields=(externalControl.itemFields || []).filter(field=>present(record[field.field])&&visible(field.visibleWhen,record)).map(field=>{
      const value=record[field.field],choice=field.choices?.find(item=>item.id===value);
      return row(field.label,choice?.label??value);
    });
    const result=row(record.name || 'External option',estimate ? `${money(estimate.quotedCost)} quoted; ${present(estimate.convertedSlots)?valueText(estimate.convertedSlots)+' converted Slots':'Slots unresolved'}` : 'Not calculated',{book:record.sourceTitle,edition:record.sourceEdition,pages:record.sourcePage},'Source, equivalence and installation prerequisites are unverified. These estimates do not certify the design.');
    return {...result,details:fields};
  }),{note:'Conversion of supplied figures only. Use the Robot Handbook option wherever an equivalent exists.'}));
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
  if (totals?.toolCaps?.length) sections.push(section('tool-caps','Tool skill limits',totals.toolCaps.map(item=>profileRow(options.get(item.optionId)?.label || titleName(item.optionId),Object.entries(item.skills || {}).map(([skill,level])=>`${titleName(skill)} up to ${valueText(level)}`).join(' · '),item,['skills','detail'],item.detail || '')),{note:'Tool limits do not grant software skill levels.'}));
  const capabilities=totals?.equipmentCapabilities || [];
  for(const category of [...new Set(capabilities.map(item=>item.category||'equipment'))]) {
    const records=capabilities.filter(item=>(item.category||'equipment')===category);
    sections.push(section('capabilities-'+category,`${titleName(category)} capabilities`,records.map(item=>profileRow(item.label || options.get(item.optionId)?.label || titleName(item.id),[item.status?titleName(item.status):'',item.condition||'Source-defined operating limits'].filter(Boolean).join(' · '),item,['category','status','condition'])),{collapsed:true,note:'These are construction capabilities and conditions, not resolved task outcomes.'}));
  }
  const weapons = totals?.weapons || (controls.some(control=>control.field==='weapons') ? physical.weapons || [] : []);
  const weaponControl = controls.find(control=>control.field==='weapons');
  const weaponName = weapon => weapon.label || weaponControl?.itemFields?.find(item=>item.field==='weaponId')?.choices?.find(item=>item.id===weapon.weaponId)?.label || 'Selected weapon';
  const weaponRows = weapons.map(weapon=>{
    const summary = [present(weapon.damage)?`${weapon.damage} damage`:'Damage not calculated',present(weapon.range)?`Range: ${valueText(weapon.range)} m`:'Range not calculated',weapon.traits?.length?weapon.traits.join(', '):''].filter(Boolean).join(' · ');
    const placement = weapon.placement==='arm' ? `Mounted on ${armName(weapon.manipulatorId)}` : weapon.placement ? `${titleName(weapon.placement)} mount` : 'Placement unresolved';
    const detail = `${placement} · Software Level: ${valueText(weapon.softwareLevel)} · FCS DM: ${valueText(weapon.fireControlDM)} · DEX DM: ${valueText(weapon.manipulatorDM)}`;
    const accessoryChoices=weaponControl?.itemFields?.find(item=>item.field==='accessories')?.choices||[];
    const accessoryName=id=>accessoryChoices.find(item=>item.id===id)?.label||humanLabel(id);
    const displayWeapon={...weapon,accessoryEffects:(weapon.accessoryEffects||[]).map(effect=>({...effect,accessory:accessoryName(effect.accessory)}))};
    const result=profileRow(weaponName(weapon),summary,displayWeapon,['damage','range','traits','placement','manipulatorId','accessories'],detail);
    for(const id of weapon.accessories||[]){const accessory=accessoryChoices.find(item=>item.id===id);result.details.push(row('Accessory',accessoryName(id),accessory?.source));}
    return result;
  });
  if (weapons.length) sections.push(section('weapons','Weapons',weaponRows,{note:totals ? 'Attack modifiers are contextual. Read the separate hardware/software values and outstanding checks.' : 'Selected installations only. Weapon performance has not been calculated.'}));  const handled = new Set(['cost','constructionCost','costLabel','slots','bandwidth','zeroSlot','zeroBandwidth','hits','armour','intelligence','intelligenceDM','agility','tacticalSpeed','endurance','vehicleEndurance','vehicleBand','traits','manipulators','skills','hardwareSkills','skillEquivalents','toolCaps','weapons','defaultSuite','provisional','augmentation','augmentations','sharedInterfaces','augmentationEffects','equipmentCapabilities']);
  const extra = Object.entries(totals || {}).filter(([key,value])=>!handled.has(key)&&present(value)&&(!Array.isArray(value)||value.length)).map(([key,value])=>row(humanLabel(key),value));
  if (extra.length) sections.push(section('additional','Operating details',extra,{collapsed:true}));
  const ledger = (evaluation.ledger || []).map(item => row(item.label || item.name || item.id,
    [present(item.cost) ? money(item.cost) : item.cost===null?'Cost unresolved':null,present(item.slots)?`${valueText(item.slots)} slots`:item.slots===null?'Slots unresolved':null,present(item.bandwidth)?`${valueText(item.bandwidth)} bandwidth`:null,present(item.quantity)?`Quantity ${valueText(item.quantity)}`:null].filter(Boolean).join(' · '),item.source,[item.note,sourceLabel(item.weaponSource),sourceLabel(item.externalSource)].filter(Boolean).join(' · ')));
  if (ledger.length) sections.push(section('ledger','Construction breakdown',ledger,{collapsed:true}));
  const diagnosticContext=path=>{
    const parts=String(path||'').split('.');
    const control=controls.find(control=>parts.includes(control.field)&&(control.target==='special'?parts[0]==='special':control.stage===parts[0]));
    if(!control)return '';
    const stage=catalogue.stages.find(stage=>stage.id===control.stage);
    const option=parts.map(part=>options.get(part)).find(Boolean);
    return [...new Set([stage?.label,control.label,option?.label].filter(Boolean))].join(' · ');
  };
  const warnings = (evaluation.diagnostics || []).map(item => row(humanLabel(item.severity || 'Check'),item.message || String(item),item.source,diagnosticContext(item.path)));
  if (!warnings.length) warnings.push(row('Checks',evaluation.status==='verified'?'No outstanding checks in implemented rules.':'Calculation has not been verified.'));
  sections.push(section('warnings','Checks and limitations',warnings));
  const gaps = (coverage.gaps || []).map(item=>row('Coverage',typeof item==='string'?item:item.message,item.source));
  if (gaps.length) sections.push(section('coverage','Implementation coverage',gaps,{collapsed:true,note:coverage.scope || ''}));
  const sources = [...new Set(sections.flatMap(item=>item.rows.flatMap(record=>[record.source,...(record.details||[]).map(detail=>detail.source)])).filter(Boolean))];
  if (sources.length) sections.push(section('sources','Source references',sources.map((source,index)=>row(String(index+1),source)),{collapsed:true}));
  return { name:design.name || 'Untitled robot', kind:catalogue.kinds?.find(item=>item.id===design.kind)?.label || design.kind, techLevel:design.techLevel, status, provisional, unavailable:!totals, sections };
}
export function formatStatblock(review) {
  const rows = [review.name,`${review.kind} | TL ${review.techLevel}`,review.status];
  if (review.provisional) rows.push('Provisional values only. This design has unresolved errors.');
  if (review.unavailable) rows.push('Totals are not calculated. Selected components below are not a verified statblock.');
  for (const group of review.sections) {
    rows.push('',group.title);
    if (group.note) rows.push(group.note);
    for (const item of group.rows) {
      rows.push(`${item.label}: ${item.value}${item.detail?' | '+item.detail:''}${item.source?' | '+item.source:''}`);
      for(const detail of item.details || [])rows.push(`  ${detail.label}: ${detail.value}${detail.source?' | '+detail.source:''}`);
    }
  }
  rows.push('','Robot Handbook (Mongoose Publishing, 2022). Unofficial fan-made tool.','Only implemented rules are checked. Review the coverage gaps and any referee decisions before play.');
  return rows.join('\n');
}
