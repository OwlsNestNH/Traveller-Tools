import {evaluatePowerMode} from './power.mjs';
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
   else if(c.type==='select'&&!c.choices.some(choice=>choice.id===v))throw new TypeError('Unknown option interpretation.');
   else if(c.type==='text'&&(typeof v!=='string'||v.length>c.maxLength))throw new TypeError('Invalid option detail.');
  }
 }
}
export function validateOptionInstances(value,choices){
 if(!Array.isArray(value)||value.length>100)throw new TypeError('Expected up to 100 separate option installations.');const ids=new Set();
 for(const item of value){assertKeys(item,['id','optionId','parameters'],'physical.optionInstances');if(typeof item.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(item.id)||ids.has(item.id))throw new TypeError('Invalid or duplicate installation ID.');ids.add(item.id);if(!choices.some(o=>o.id===item.optionId))throw new TypeError('Unknown option installation.');validateOptionParameters({[item.optionId]:item.parameters},choices);if(Object.keys(item.parameters).some(field=>choices.find(o=>o.id===item.optionId).parameterControls.find(c=>c.field===field).appliesTo==='defaultSuite'))throw new TypeError('Separate installations cannot occupy default-suite placements.');}
}
export function evaluateEquipment(design,choices,baseSlots){
 const {physical:p}=design.selections,tl=design.techLevel,diagnostics=[],ledger=[],traits=[],installed=[],groups=new Map(),counts=new Map();
 const add=(severity,code,path,message,option)=>diagnostics.push({severity,code,path,message,source:option?.source??{book:'Robot Handbook',edition:'Mongoose 2022',pages:'55-57'}});
 for(const [id,params]of Object.entries(p.optionParameters))if(!p.options.includes(id)&&!p.defaultSuite.includes(id))add('error','ORPHAN_OPTION_PARAMETERS','physical.optionParameters.'+id,'Remove settings for options that are no longer installed.',choices.find(o=>o.id===id));
 for(const [ids,fromDefault] of [[p.defaultSuite,true],[p.options,false]])for(const id of ids){
  const option=choices.find(o=>o.id===id),params=p.optionParameters[id]??{},quantity=fromDefault?(params.suiteQuantity??1):(params.quantity??1);
  installed.push({...option,quantity,fromDefault,parameters:params});
 }
 for(const [id,parameters]of Object.entries(p.optionParameters)){
  if(parameters.quantity!==undefined&&!p.options.includes(id))add('error','UNUSED_OPTION_QUANTITY','physical.optionParameters.'+id+'.quantity','Extra quantity applies only to an option installed outside the default suite.',choices.find(o=>o.id===id));
  if(parameters.suiteQuantity!==undefined&&!p.defaultSuite.includes(id))add('error','UNUSED_SUITE_QUANTITY','physical.optionParameters.'+id+'.suiteQuantity','Default-suite quantity requires a default-suite placement.',choices.find(o=>o.id===id));
 }
 for(const item of p.optionInstances){const option=choices.find(o=>o.id===item.optionId);installed.push({...option,quantity:item.parameters.quantity??1,fromDefault:false,parameters:item.parameters,instanceId:item.id});}
 const suiteCount=installed.filter(o=>o.fromDefault).reduce((n,o)=>n+o.quantity,0);
 if(suiteCount>5)add('error','DEFAULT_SUITE_CAPACITY','physical.defaultSuite','The default suite has only five placements.',installed.find(o=>o.fromDefault));
 const semanticId=id=>({'wireless':'wireless-data-link','visual-spectrum':'visual-spectrum-sensor','auditory':'auditory-sensor','voder':'voder-speaker','hostile-environment':'hostile-environment-protection'}[id]??id);
 const has=dependency=>installed.some(o=>o.id===dependency||semanticId(o.id)===dependency||o.family===dependency||o.exclusive===dependency);
 let cost=0,slots=0,zeroCount=0;
 for(const option of installed){
  const path=option.instanceId?'physical.optionInstances.'+option.instanceId:(option.fromDefault?'physical.defaultSuite':'physical.options')+'.'+option.id,q=option.quantity;
  if(option.tl>tl)add('error','MIN_TL',path,option.label+' exceeds design technology.',option);
  if(option.allowedKinds&&!option.allowedKinds.includes(design.kind))add('error','OPTION_KIND',path,option.label+' does not apply to this body type.',option);
  if(!option.implemented)add('blocker','OPTION_NOT_IMPLEMENTED',path,option.reason??'This option is not implemented.',option);
  if(option.requiresBaseArmour&&p.armourRemoved)add('error','EXPOSED_ENVIRONMENT',path,'Removed base armour prevents environmental protection.',option);
  if(option.requiresVehicleSpeed&&!p.vehicleSpeed)add('error','OPTION_VEHICLE_SPEED',path,'This option requires vehicle-speed locomotion.',option);
  if(option.requiresDetail&&!option.parameters.detail?.trim())add('blocker','OPTION_DETAIL',path,'Specify '+option.requiresDetail.toLowerCase()+' for this installation.',option);
  if(option.category==='Weapons'&&design.selections.physical.weapons?.length)add('blocker','SEPARATE_WEAPON_HARDWARE',path,'This unassociated weapon hardware is separate from the mount and fire control already included in Installed weapons. Remove it or resolve the intended independent installation; costs are not silently merged.',option);
  if(option.category==='Weapons'&&option.requiresDetail)add('blocker','WEAPON_ASSOCIATION',path,'Weapon and linked-mount association has not yet been validated.',option);
  for(const dependency of option.dependencies??[])if(!has(dependency))add('error','OPTION_DEPENDENCY',path,option.label+' requires '+dependency.replaceAll('-',' ')+'.',option);
  if(option.dependenciesAny&&!option.dependenciesAny.some(has))add('error','OPTION_DEPENDENCY',path,option.label+' requires one of: '+option.dependenciesAny.join(', ')+'.',option);
  for(const incompatible of option.incompatibilities??[])if(has(incompatible))add('error','OPTION_INCOMPATIBLE',path,option.label+' conflicts with '+incompatible.replaceAll('-',' ')+'.',option);
  if(option.exclusive||option.maxCopies===1){const key=option.exclusive??option.family??option.id;counts.set(key,(counts.get(key)??0)+q);if(counts.get(key)>1)add('error','OPTION_EXCLUSIVE',path,'Only one '+key.replaceAll('-',' ')+' option may be installed.',option);}
  if(option.minimumTransceiverRangeKm&&!installed.some(o=>o.family==='transceiver'&&o.effects?.rangeKm>=option.minimumTransceiverRangeKm))add('error','TRANSCEIVER_RANGE',path,option.label+' requires an installed transceiver with range at least '+option.minimumTransceiverRangeKm+' km.',option);
  if(option.sourceConflict)add('warning','SOURCE_INTERPRETATION',path,option.sourceConflict,option);
  if(option.operationalReview)add('warning','CONDITIONAL_OPERATION',path,option.operationalNotes??'Operation depends on external conditions.',option);
  if(option.operationRequiresSkills)add('warning','OPTION_OPERATION_SKILL',path,'Operation requires '+option.operationRequiresSkills.map(s=>s.skill+(s.specialty?' ('+s.specialty+')':'')+' '+s.minimumLevel).join(', ')+'. This installation does not grant that skill.',option);
  let price=null,itemSlots=null;
  if(option.costBasis==='each'&&Number.isFinite(option.cost))price=option.cost*q;
  if(option.costBasis==='baseSlots'&&Number.isFinite(option.costPerBaseSlot))price=option.costPerBaseSlot*baseSlots*q;
  if(option.costBasis==='allocatedSlots'&&Number.isFinite(option.costPerAllocatedSlot))price=option.costPerAllocatedSlot*q;
  if(option.costBasis==='interpretation'){
   const interpretation=option.parameters.costInterpretation??'unresolved';
   if(interpretation==='baseSlots')price=option.cost*baseSlots*q;
   else if(interpretation==='installedSlots')price=option.cost*Math.ceil(baseSlots*Math.abs(option.slotPercent))*q;
   if(price!==null)add('warning','OPTION_PRICE_INTERPRETATION',path,'Using explicitly chosen '+interpretation+' pricing for the conflicting short RTG rule.',option);
  }
  if(option.fromDefault&&option.defaultSuiteFree)price=0;
  if(price===null)add('blocker','OPTION_COST_BASIS',path,'An explicit pricing interpretation or missing weapon input is required; cost is not assumed zero.',option);
  if(option.slotsBasis==='fixed'&&Number.isFinite(option.slots))itemSlots=option.slots*q;
  if(option.slotsBasis==='allocated')itemSlots=q;
  if(option.slotsBasis==='basePercent'&&Number.isFinite(option.slotPercent)){
   const fraction=baseSlots*Math.abs(option.slotPercent)*q;
   if(option.roundingGroup){const g=groups.get(option.roundingGroup)??{fraction:0,source:option.source};g.fraction+=fraction;groups.set(option.roundingGroup,g);itemSlots=0;}
   else itemSlots=(option.slotCredit?-1:1)*q*Math.ceil(baseSlots*Math.abs(option.slotPercent));
  }
  if(itemSlots===null)add('blocker','OPTION_SLOT_BASIS',path,'Slot accounting for this option is not implemented.',option);
  if(price!==null)cost+=price;if(itemSlots!==null)slots+=itemSlots;
  if(option.zeroSlot&&!option.fromDefault)zeroCount+=q;
  traits.push(...(option.traits??[]));if(option.effects?.heightenedSenses)traits.push('Heightened Senses');
  ledger.push({id:option.instanceId?'instance-'+option.instanceId:(option.fromDefault?'default-':'option-')+option.id,label:option.label,cost:price,slots:itemSlots,quantity:q,source:option.source});
 }
 for(const [id,g]of groups){const n=Math.ceil(g.fraction);slots+=n;ledger.push({id:'group-'+id,label:'Combined '+id.replaceAll('-',' '),cost:0,slots:n,source:g.source});}
 const power=evaluatePowerMode(design,installed),{noInternalPower,powerState}=power;diagnostics.push(...power.diagnostics);const alternativePower=installed.filter(o=>o.id.startsWith('rtg-')||o.id.startsWith('solar-')||o.id==='external-power');
 const zeroSlot={allowance:design.techLevel+Number(design.selections.chassis.size.split('-')[1])+Math.max(0,5-suiteCount),used:zeroCount,defaultUsed:suiteCount,totalAllowance:5+design.techLevel+Number(design.selections.chassis.size.split('-')[1])};zeroSlot.overflow=Math.max(0,zeroCount-zeroSlot.allowance);slots+=zeroSlot.overflow;
 if(zeroSlot.overflow)ledger.push({id:'zero-slot-overflow',label:'Excess zero-slot options',cost:0,slots:zeroSlot.overflow,source:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'31'}});
 return{cost,slots,diagnostics,ledger,traits:[...new Set(traits)],installed,zeroSlot,noInternalPower,powerState,powerProjections:power.powerProjections,powerModes:alternativePower.map(o=>({id:o.id,label:o.label,effects:o.effects,conditions:o.operationalNotes})),toolCaps:installed.filter(o=>o.effects?.toolSkillCaps).map(o=>({id:o.instanceId??o.id,optionId:o.id,detail:o.parameters.detail??null,skills:o.effects.toolSkillCaps,grantsSkill:false,source:o.source,context:'Using this installed internal toolkit; external specialised tools may support different tasks.',contextualCaps:[...(o.family==='medikit'&&installed.some(v=>v.effects?.medikitMaximumBonus)?[{skill:'Medic',maximum:o.effects.toolSkillCaps.Medic+1,context:'Treating a patient inside an installed medical chamber of adequate capacity.',source:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'46'}}]:[]),...(o.family==='scientific-toolkit'&&o.parameters.detail?.trim().toLowerCase()==='planetology'&&installed.some(v=>v.effects?.planetologyToolCapBonus)?[{skill:'Science (planetology)',maximum:o.effects.toolSkillCaps.Science+1,context:'Using the installed Planetology Sensor Suite with this toolkit.',source:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'58'}}]:[])]})),contextualModifiers:installed.filter(o=>o.effects?.planetologyCheckDM).map(o=>({id:o.instanceId??o.id,appliesTo:'Applicable checks using suite data',modifier:1,context:'Only checks using relevant data from this Planetology Sensor Suite; referee determines applicability.',grantsSkill:false,source:o.source})),hardwareSkills:installed.flatMap(o=>[['recon',o.effects?.reconSkill],['navigation',o.effects?.navigationSkill],['stealth',o.effects?.stealthHardware]].filter(([,v])=>v!==undefined).map(([skill,level])=>({skill,level,sourceOption:o.id,characteristicModifier:0})))};
}
