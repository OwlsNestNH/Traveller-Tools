// Equipment accounting is independent of DOM, persistence and presentation.
import {assertKeys,integer,isRecord} from './schema.mjs';
export function validateOptionParameters(value,choices){
 assertKeys(value,choices.map(o=>o.id),'physical.optionParameters');
 for(const [id,parameters] of Object.entries(value)){
  const option=choices.find(o=>o.id===id),controls=option.parameterControls;
  assertKeys(parameters,controls.map(c=>c.field),'physical.optionParameters.'+id);
  for(const [field,v] of Object.entries(parameters)){
   const c=controls.find(c=>c.field===field);
   if(c.type==='number')integer(v,c.min,c.max,'physical.optionParameters.'+id+'.'+field);
   else if(c.type==='text'&&(typeof v!=='string'||v.length>c.maxLength))throw new TypeError('Invalid option detail.');
  }
 }
}
export function evaluateEquipment(design,choices,baseSlots){
 const {physical:p}=design.selections,tl=design.techLevel,diagnostics=[],ledger=[],traits=[],installed=[],groups=new Map(),counts=new Map();
 const add=(severity,code,path,message,option)=>diagnostics.push({severity,code,path,message,source:option?.source});
 for(const [id,params]of Object.entries(p.optionParameters))if(!p.options.includes(id)&&!p.defaultSuite.includes(id))add('error','ORPHAN_OPTION_PARAMETERS','physical.optionParameters.'+id,'Remove settings for options that are no longer installed.',choices.find(o=>o.id===id));
 for(const [ids,fromDefault] of [[p.defaultSuite,true],[p.options,false]])for(const id of ids){
  const option=choices.find(o=>o.id===id),params=p.optionParameters[id]??{},quantity=fromDefault?1:params.quantity??1;
  installed.push({...option,quantity,fromDefault,parameters:params});
 }
 const semanticId=id=>({'wireless':'wireless-data-link','visual-spectrum':'visual-spectrum-sensor','auditory':'auditory-sensor','voder':'voder-speaker','hostile-environment':'hostile-environment-protection'}[id]??id);
 const has=dependency=>installed.some(o=>o.id===dependency||semanticId(o.id)===dependency||o.family===dependency||o.exclusive===dependency);
 let cost=0,slots=0,zeroCount=0;
 for(const option of installed){
  const path=(option.fromDefault?'physical.defaultSuite':'physical.options')+'.'+option.id,q=option.quantity;
  if(option.tl>tl)add('error','MIN_TL',path,option.label+' exceeds design technology.',option);
  if(option.allowedKinds&&!option.allowedKinds.includes(design.kind))add('error','OPTION_KIND',path,option.label+' does not apply to this body type.',option);
  if(!option.implemented)add('blocker','OPTION_NOT_IMPLEMENTED',path,option.reason??'This option is not implemented.',option);
  if(option.requiresBaseArmour&&p.armourRemoved)add('error','EXPOSED_ENVIRONMENT',path,'Removed base armour prevents environmental protection.',option);
  if(option.requiresVehicleSpeed&&!p.vehicleSpeed)add('error','OPTION_VEHICLE_SPEED',path,'This option requires vehicle-speed locomotion.',option);
  if(option.requiresDetail&&!option.parameters.detail?.trim())add('blocker','OPTION_DETAIL',path,'Specify '+option.requiresDetail.toLowerCase()+' for this installation.',option);
  if(option.category==='Weapons'&&option.requiresDetail)add('blocker','WEAPON_ASSOCIATION',path,'Weapon and linked-mount association has not yet been validated.',option);
  for(const dependency of option.dependencies??[])if(!has(dependency))add('error','OPTION_DEPENDENCY',path,option.label+' requires '+dependency.replaceAll('-',' ')+'.',option);
  for(const incompatible of option.incompatibilities??[])if(has(incompatible))add('error','OPTION_INCOMPATIBLE',path,option.label+' conflicts with '+incompatible.replaceAll('-',' ')+'.',option);
  if(option.exclusive||option.maxCopies===1){const key=option.exclusive??option.family??option.id;counts.set(key,(counts.get(key)??0)+q);if(counts.get(key)>1)add('error','OPTION_EXCLUSIVE',path,'Only one '+key.replaceAll('-',' ')+' option may be installed.',option);}
  if(option.sourceConflict)add('warning','SOURCE_INTERPRETATION',path,option.sourceConflict,option);
  if(option.operationalReview)add('warning','CONDITIONAL_OPERATION',path,option.operationalNotes??'Operation depends on external conditions.',option);
  if(option.operationRequiresSkills)add('warning','OPTION_OPERATION_SKILL',path,'Operation requires '+option.operationRequiresSkills.map(s=>s.skill+(s.specialty?' ('+s.specialty+')':'')+' '+s.minimumLevel).join(', ')+'. This installation does not grant that skill.',option);
  let price=null,itemSlots=null;
  if(option.costBasis==='each'&&Number.isFinite(option.cost))price=option.cost*q;
  if(option.costBasis==='baseSlots'&&Number.isFinite(option.costPerBaseSlot))price=option.costPerBaseSlot*baseSlots*q;
  if(option.costBasis==='allocatedSlots'&&Number.isFinite(option.costPerAllocatedSlot))price=option.costPerAllocatedSlot*q;
  if(option.fromDefault&&option.defaultSuiteFree)price=0;
  if(price===null)add('blocker','OPTION_COST_BASIS',path,'An explicit pricing interpretation or missing weapon input is required; cost is not assumed zero.',option);
  if(option.slotsBasis==='fixed'&&Number.isFinite(option.slots))itemSlots=option.slots*q;
  if(option.slotsBasis==='allocated')itemSlots=q;
  if(option.slotsBasis==='basePercent'&&Number.isFinite(option.slotPercent)){
   const fraction=baseSlots*Math.abs(option.slotPercent)*q;
   if(option.roundingGroup){const g=groups.get(option.roundingGroup)??{fraction:0,source:option.source};g.fraction+=fraction;groups.set(option.roundingGroup,g);itemSlots=0;}
   else itemSlots=(option.slotCredit?-1:1)*Math.ceil(fraction);
  }
  if(itemSlots===null)add('blocker','OPTION_SLOT_BASIS',path,'Slot accounting for this option is not implemented.',option);
  if(price!==null)cost+=price;if(itemSlots!==null)slots+=itemSlots;
  if(option.zeroSlot&&!option.fromDefault)zeroCount+=q;
  traits.push(...(option.traits??[]));if(option.effects?.heightenedSenses)traits.push('Heightened Senses');
  ledger.push({id:(option.fromDefault?'default-':'option-')+option.id,label:option.label,cost:price,slots:itemSlots,quantity:q,source:option.source});
 }
 for(const [id,g]of groups){const n=Math.ceil(g.fraction);slots+=n;ledger.push({id:'group-'+id,label:'Combined '+id.replaceAll('-',' '),cost:0,slots:n,source:g.source});}
 const noInternalPower=installed.some(o=>o.effects?.removesInternalPower),alternativePower=installed.filter(o=>o.id.startsWith('rtg-')||o.id.startsWith('solar-')||o.id==='external-power');
 if(noInternalPower&&!p.powerPacks&&!alternativePower.length)add('error','NO_POWER_SOURCE','physical.options','Removing internal power requires another power source.',installed.find(o=>o.effects?.removesInternalPower));
 const zeroSlot={allowance:design.techLevel+Number(design.selections.chassis.size.split('-')[1]),used:zeroCount};zeroSlot.overflow=Math.max(0,zeroCount-zeroSlot.allowance);slots+=zeroSlot.overflow;
 if(zeroSlot.overflow)ledger.push({id:'zero-slot-overflow',label:'Excess zero-slot options',cost:0,slots:zeroSlot.overflow,source:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'31'}});
 return{cost,slots,diagnostics,ledger,traits:[...new Set(traits)],installed,zeroSlot,noInternalPower,powerModes:alternativePower.map(o=>({id:o.id,label:o.label,effects:o.effects,conditions:o.operationalNotes})),toolCaps:installed.filter(o=>o.effects?.toolSkillCaps).map(o=>({id:o.id,skills:o.effects.toolSkillCaps,grantsSkill:false})),hardwareSkills:installed.flatMap(o=>[['recon',o.effects?.reconSkill],['navigation',o.effects?.navigationSkill],['stealth',o.effects?.stealthHardware]].filter(([,v])=>v!==undefined).map(([skill,level])=>({skill,level,sourceOption:o.id,characteristicModifier:0})))};
}
