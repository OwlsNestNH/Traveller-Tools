import {evaluateEquipment,validateOptionParameters} from './equipment.mjs';
import {SCHEMA_VERSION,STAGE_IDS,isRecord,assertJson,clone,assertKeys,integer,mergeKnown} from './schema.mjs';
import {getCatalogue as baseCatalogue,STAGES,KINDS,SIZES,LOCOMOTION,BRAINS,BANDWIDTH,PACKAGES,OPTIONS,DEFAULT_ITEMS,CORE_PACKAGES,COVERAGE,source} from './catalogue.mjs';
import {getSpecialKinds,getSpecialControls,createSpecialDesignFields,validateSpecialFields,evaluateSpecialDesign,evaluateBodyType} from './special-types.mjs';
export function getCatalogue(design){
 const catalogue=baseCatalogue();catalogue.kinds=[catalogue.kinds[0],...getSpecialKinds()];
 if(design&&design.kind!=='standard'){
  const body=['android','biological'].includes(design.kind),controls=getSpecialControls(design.kind).map(c=>({...c,target:'special'}));
  catalogue.stages=catalogue.stages.map(stage=>({...stage,description:body?stage.description:'This type uses a separate construction sequence; ordinary robot cost, slots and bandwidth do not apply.',controls:[...(body?stage.controls:[]),...controls.filter(c=>(c.stage??'chassis')===stage.id)]}));
 }
 for(const stage of catalogue.stages)for(const control of stage.controls)if(control.choices)control.choices=control.choices.map(choice=>({...choice,eligibility:{available:choice.implemented!==false&&(!design||choice.tl===undefined||choice.tl<=design.techLevel),reason:choice.implemented===false?(choice.reason??'Not implemented'):design&&choice.tl>design.techLevel?'Requires TL'+choice.tl:null}}));
 return catalogue;
}
export const API_VERSION = SCHEMA_VERSION;
const defaultArm=id=>({id,kind:'base',size:'chassis',strengthIncrease:0,dexterityIncrease:0});
const initial = (kind,techLevel) => ({schemaVersion:1,name:'Untitled robot',kind,techLevel,special:createSpecialDesignFields(kind),selections:{
 chassis:{size:'size-5'},locomotion:{primary:'wheels',secondary:'none'},
 physical:{optionParameters:{},defaultSuite:['visual-spectrum','voder','auditory','wireless','transceiver-improved'],armourAdded:0,armourRemoved:false,efficiency:false,powerPacks:0,resiliency:0,agility:0,tacticalSpeed:0,vehicleSpeed:false,vehicleBands:0,options:[],manipulators:[defaultArm('base-1'),defaultArm('base-2')]},
 brain:{model:techLevel>=12?'advanced-tl12':techLevel>=10?'advanced-tl10':techLevel>=8?'basic-tl8':'primitive-tl7',bandwidthUpgrade:'none',intellectUpgrade:0,hardened:false},
 skills:{corePackage:techLevel>=10?'none':techLevel>=8?'basic-none':'primitive-alert',packages:[]},finalisation:{removedSlots:0,priceMode:'construction',customPrice:0}
}});
function checked(value){
 assertJson(value); assertKeys(value,['schemaVersion','name','kind','techLevel','special','selections'],'design');
 if(value.schemaVersion!==SCHEMA_VERSION)throw new TypeError('Unsupported design schema version.');
 if(typeof value.name!=='string'||!value.name.trim()||value.name.length>120)throw new TypeError('Name must contain 1 to 120 characters.');
 if(!KINDS.some(k=>k.id===value.kind))throw new TypeError('Unknown robot kind.');
 integer(value.techLevel,7,18,'techLevel');validateSpecialFields(value.kind,value.special);
 assertKeys(value.selections,STAGE_IDS,'selections');
 for(const stage of STAGES){
  const values=value.selections[stage.id]; assertKeys(values,stage.controls.map(c=>c.field),`selections.${stage.id}`);
  for(const control of stage.controls){
   const v=values[control.field],path=`selections.${stage.id}.${control.field}`;
   if(control.type==='number')integer(v,control.min,control.max,path);
   else if(control.type==='select'){if(!control.choices.some(c=>c.id===v))throw new TypeError(`${path}: unknown choice.`);}
   else if(control.type==='multiselect'){
    if(!Array.isArray(v)||v.length>(control.maxItems??200)||v.some(id=>!control.choices.some(c=>c.id===id)))throw new TypeError(`${path}: invalid choices.`);
    if(new Set(v).size!==v.length)throw new TypeError(`${path}: duplicate choices.`);
   }else if(control.type==='option-parameters'){validateOptionParameters(v,control.choices);
   }else if(control.type==='manipulators'){
    if(!Array.isArray(v)||v.length>100)throw new TypeError(`${path}: expected up to 100 manipulators.`);
    const ids=new Set();
    v.forEach((arm,i)=>{
     const p=`${path}[${i}]`;assertKeys(arm,['id','kind','size','strengthIncrease','dexterityIncrease'],p);
     if(typeof arm.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(arm.id)||ids.has(arm.id))throw new TypeError(`${p}: invalid or duplicate ID.`);ids.add(arm.id);
     if(!['base','additional','leg'].includes(arm.kind))throw new TypeError(`${p}: invalid manipulator kind.`);
     if((arm.kind==='base')!==['base-1','base-2'].includes(arm.id))throw new TypeError(`${p}: base arms require IDs base-1 and base-2.`);
     if(arm.size!=='chassis')integer(arm.size,1,10,p+'.size');integer(arm.strengthIncrease,0,19,p+'.strengthIncrease');integer(arm.dexterityIncrease,0,13,p+'.dexterityIncrease');
    });
   }
  }
 }
 return clone(value);
}
export function createDesign(options={}){assertKeys(options,['kind','techLevel'],'options');return checked(initial(options.kind??'standard',options.techLevel??(options.kind==='clone'?13:12)));}
export function validateDesign(design){try{checked(design);return{valid:true,diagnostics:[]};}catch(error){return{valid:false,diagnostics:[{severity:'error',code:'SCHEMA',path:'design',message:error.message}]};}}
export function updateDesign(design,patch){assertJson(patch);const base=checked(design);if(patch.kind!==undefined&&patch.kind!==base.kind){base.kind=patch.kind;base.special=createSpecialDesignFields(patch.kind);}return checked(mergeKnown(base,patch));}
export function applySelection(design,command){
 assertJson(command);assertKeys(command,['stage','field','value'],'command');
 if(!STAGE_IDS.includes(command.stage))throw new TypeError('Unknown stage.');
 if(design.kind!=='standard'&&getSpecialControls(design.kind).some(c=>c.field===command.field&&(c.stage??'chassis')===command.stage))return updateDesign(design,{special:{[command.field]:command.value}});
 if(!STAGES.find(s=>s.id===command.stage).controls.some(c=>c.field===command.field))throw new TypeError('Unknown selection field.');
 if(command.stage==='brain'&&command.field==='model'){
  const brain=BRAINS.find(b=>b.id===command.value);if(!brain)throw new TypeError('Unknown brain.');
  const corePackage=brain.family==='primitive'?'primitive-alert':brain.family==='basic'?'basic-none':brain.family==='hunter-killer'?'hunter-standard':'none';
  return updateDesign(design,{selections:{brain:{model:command.value},skills:{corePackage}}});
 }
 if(command.stage==='physical'&&['options','defaultSuite'].includes(command.field)){
  const other=command.field==='options'?'defaultSuite':'options',active=[...command.value,...design.selections.physical[other]];
  const optionParameters=Object.fromEntries(Object.entries(design.selections.physical.optionParameters).filter(([id])=>active.includes(id)));
  return updateDesign(design,{selections:{physical:{[command.field]:command.value,optionParameters}}});
 }
 return updateDesign(design,{selections:{[command.stage]:{[command.field]:command.value}}});
}
export function exportDesign(design){return JSON.stringify(checked(design),null,2);}
export function importDesign(json){if(typeof json!=='string'||json.length>1000000)throw new TypeError('Expected a design JSON string of at most 1 MB.');return checked(JSON.parse(json));}
export function characteristicDM(value){integer(value,0,100,'characteristic');return value===0?-3:value<=2?-2:value<=5?-1:value<=8?0:value<=11?1:value<=14?2:3;}
const lookup=(items,id)=>items.find(x=>x.id===id);
const armourBand=tl=>tl<9?{base:2,max:20,percent:.01,perSlot:1,cost:250}:tl<12?{base:3,max:30,percent:.005,perSlot:2,cost:1000}:tl<15?{base:4,max:40,percent:.004,perSlot:3,cost:1500}:tl<18?{base:4,max:50,percent:.003,perSlot:4,cost:2500}:{base:5,max:60,percent:.0025,perSlot:5,cost:5000};
export function manipulatorSlots(baseSlots,chassisSize,armSize){integer(baseSlots,1,128,'baseSlots');integer(chassisSize,1,8,'chassisSize');integer(armSize,1,10,'armSize');const diff=armSize-chassisSize;if(diff>2)throw new TypeError('Manipulator exceeds chassis size by more than two.');return Math.ceil(baseSlots*(diff===2?.4:diff===1?.2:diff===0?.1:diff===-1?.05:diff===-2?.02:.01));}
export function evaluateDesign(input){
 const validation=validateDesign(input);if(!validation.valid)return{status:'invalid',diagnostics:validation.diagnostics,totals:null,ledger:[],coverage:clone(COVERAGE)};
 const design=checked(input);if(!['standard','android','biological'].includes(design.kind))return evaluateSpecialDesign(design);
 const {selections:s,techLevel:tl}=design,p=s.physical,brain=lookup(BRAINS,s.brain.model),upgrade=lookup(BANDWIDTH,s.brain.bandwidthUpgrade),chassis=lookup(SIZES,s.chassis.size),primary=lookup(LOCOMOTION,s.locomotion.primary),secondary=lookup(LOCOMOTION,s.locomotion.secondary);
 const diagnostics=[],ledger=[],kind=lookup(getCatalogue().kinds,design.kind),bodyType=['android','biological'].includes(design.kind);
 const issue=(severity,code,path,message,pages)=>diagnostics.push({severity,code,path,message,...(pages?{source:source(pages)}:{})});
 const error=(code,path,message,pages)=>issue('error',code,path,message,pages);
 const block=(code,path,message,pages)=>issue('blocker',code,path,message,pages);
 const entry=(id,label,cost,slots,pages,extra={})=>ledger.push({id,label,cost,slots,source:source(pages),...extra});
 if(!kind.implemented)block('KIND_NOT_IMPLEMENTED','kind',kind.reason,kind.source.pages);

 if(primary.tl>tl)error('MIN_TL','locomotion.primary','Primary locomotion exceeds design technology.','16');
 if(primary.id==='thruster')error('THRUSTER_PRIMARY','locomotion.primary','Ordinary robots use thrusters as secondary locomotion. Missile designs require their separate path.','17');
 if(primary.id==='aeroplane')block('AEROPLANE_SPEED','locomotion.primary','Aeroplane vehicle-speed mapping requires source reconciliation before calculation.','17,23');
 const baseSlots=chassis.slots,baseCost=chassis.cost*primary.multiplier;
 let capacity=baseSlots+(primary.id==='none'?Math.ceil(baseSlots*.25):0),used=0,cost=baseCost,hits=chassis.hits;
 entry('chassis','Base chassis with primary locomotion',baseCost,0,'13,16',{baseSlots});
 if(s.locomotion.secondary!=='none'){
  if(secondary.tl>tl)error('MIN_TL','locomotion.secondary','Secondary locomotion exceeds design technology.','16');
  if(secondary.multiplier>primary.multiplier&&!(primary.id==='none'&&secondary.id==='thruster'))error('SECONDARY_MULTIPLIER','locomotion.secondary','Secondary multiplier cannot exceed the primary multiplier, except stationary robots using thrusters.','17,23');
  const slots=Math.ceil(baseSlots*.25),price=slots*500*secondary.multiplier;used+=slots;cost+=price;entry('secondary','Secondary locomotion',price,slots,'23');
 }
 const armour=armourBand(tl);
 if(p.armourAdded>armour.max)error('ARMOUR_MAX','physical.armourAdded','Additional armour exceeds the technology limit.','19');
 if(p.armourRemoved&&p.armourAdded)error('ARMOUR_CONFLICT','physical.armourAdded','Removed base armour prevents additional armour.','19');
 if(p.armourRemoved){cost-=baseCost*.1;entry('removed-armour','Remove base armour',-baseCost*.1,0,'19');}
 if(p.armourAdded){const slots=Math.max(Math.ceil(p.armourAdded*baseSlots*armour.percent),Math.ceil(p.armourAdded/armour.perSlot));const price=slots*armour.cost;used+=slots;cost+=price;entry('armour','Additional armour',price,slots,'19');}
 let endurance=primary.endurance*(tl>=15?2:tl>=12?1.5:1);
 if(p.efficiency){endurance*=2;cost+=baseCost*.5;entry('efficiency','Improved efficiency',baseCost*.5,0,'19–20');}
 if(p.powerPacks){if(tl<8)error('MIN_TL','physical.powerPacks','Power packs require TL8.','20');const slots=Math.ceil(baseSlots*.1)*p.powerPacks,price=slots*500;used+=slots;cost+=price;endurance*=1+p.powerPacks;entry('power-packs','Additional power packs',price,slots,'19–20');}
 if(p.resiliency>Math.floor(baseSlots/2)||p.resiliency < -Math.floor(chassis.hits/2))error('RESILIENCY_LIMIT','physical.resiliency','Resiliency adjustment exceeds half the base slots or base hits.','20');
 hits+=p.resiliency;if(p.resiliency){const slots=Math.max(0,p.resiliency),price=p.resiliency>0?p.resiliency*.05*baseCost:p.resiliency*50*primary.multiplier;used+=slots;cost+=price;entry('resiliency','Chassis resiliency',price,slots,'20');}
 const stationary=primary.id==='none';
 if(stationary&&(p.agility||p.tacticalSpeed||p.vehicleSpeed))error('STATIONARY_MOVEMENT','physical','Stationary chassis cannot use movement enhancements.','16,22');
 if(p.tacticalSpeed<0&&p.agility)error('SPEED_AGILITY_CONFLICT','physical.tacticalSpeed','Tactical speed reduction cannot combine with agility enhancement.','22');
 if(p.vehicleSpeed&&p.tacticalSpeed)error('SPEED_MODE_CONFLICT','physical.tacticalSpeed','Tactical adjustment cannot combine with vehicle speed.','22');
 if(!p.vehicleSpeed&&p.vehicleBands)error('VEHICLE_SPEED_REQUIRED','physical.vehicleBands','Extra speed bands require vehicle speed movement.','23');
 const tacticalSpeed=stationary?0:5+primary.agility+p.agility+p.tacticalSpeed;
 if(tacticalSpeed<0||tacticalSpeed>12)error('TACTICAL_SPEED_LIMIT','physical.tacticalSpeed','Tactical movement must be between 0 and 12 metres.','22');
 if(p.agility){const price=baseCost*2**(p.agility-1);cost+=price;entry('agility','Agility enhancement',price,0,'22');}
 if(p.tacticalSpeed){const price=baseCost*.1*p.tacticalSpeed;cost+=price;endurance*=1-.1*p.tacticalSpeed;entry('tactical-speed','Tactical movement adjustment',price,0,'22');}
 let vehicleEndurance=null,vehicleBand=null;
 if(p.vehicleSpeed){
  const bands=['Idle','Very Slow','Slow','Medium','High','Fast','Very Fast','Subsonic','Supersonic','Hypersonic'];
  const map={wheels:2,'wheels-atv':2,tracks:1,grav:4,aquatic:1,vtol:3,walker:1,hovercraft:3};
  if(map[primary.id]===undefined)block('VEHICLE_SPEED_MAPPING','physical.vehicleSpeed','Vehicle speed mapping is not implemented for this locomotion.','23');
  else vehicleBand=bands[map[primary.id]+p.vehicleBands];
  const slots=Math.ceil(baseSlots*.25)+p.vehicleBands*Math.ceil(baseSlots*.1),price=baseCost*2**p.vehicleBands;
  used+=slots;cost+=price;vehicleEndurance=Math.round(endurance/4/2**p.vehicleBands);entry('vehicle-speed','Vehicle speed movement',price,slots,'23');
 }
 const manipulators=[];let reduction=0;
 for(const id of ['base-1','base-2'])if(!p.manipulators.some(a=>a.id===id)){const slots=-Math.ceil(baseSlots*.1),price=-100*chassis.size;used+=slots;reduction+=-price;entry(id+'-removed','Removed base manipulator',price,slots,'25');}
 if(p.manipulators.filter(a=>a.kind==='leg').length>2)error('LEG_COUNT','physical.manipulators','At most two walker legs may be converted under the construction abstraction.','26');
 for(const arm of p.manipulators){
  const size=arm.size==='chassis'?chassis.size:arm.size,path=`physical.manipulators.${arm.id}`;
  if(size>chassis.size+2){error('MANIPULATOR_SIZE',path,'Manipulator cannot be more than two sizes larger than the chassis.','25');continue;}
  if(arm.kind==='leg'&&(size!==chassis.size||![primary.id,secondary?.id].includes('walker')))error('WALKER_LEG',path,'Converted legs require walker locomotion and must match chassis size.','26');
  const str=2*size-1,dex=Math.ceil(tl/2+1);
  if(arm.strengthIncrease>str)error('MANIPULATOR_STR',path,'Strength cannot exceed twice the default strength.','26');
  if(dex+arm.dexterityIncrease>tl+3)error('MANIPULATOR_DEX',path,'Dexterity cannot exceed TL+3.','26');
  let slots=0,price=0;
  if(arm.kind==='base'&&size!==chassis.size){const delta=manipulatorSlots(baseSlots,chassis.size,size)-manipulatorSlots(baseSlots,chassis.size,chassis.size);slots=size>chassis.size?Math.max(1,delta):Math.min(-1,delta);price=slots*100;if(price<0)reduction-=price;}
  else if(arm.kind==='additional'){slots=manipulatorSlots(baseSlots,chassis.size,size);price=100*size;}
  else if(arm.kind==='leg')price=100*size;
  price+=size*arm.strengthIncrease**2*100+size*arm.dexterityIncrease**2*200;used+=slots;cost+=price;
  entry(arm.id,'Manipulator '+arm.id,price,slots,'25–26');manipulators.push({...arm,size,strength:str+arm.strengthIncrease,dexterity:dex+arm.dexterityIncrease});
 }
 // The base-arm saving is capped; return the excess above the 20% allowance.
 const rawRemoval=100*chassis.size*(2-p.manipulators.filter(a=>a.kind==='base').length);cost-=rawRemoval;
 if(reduction>baseCost*.2){const correction=reduction-baseCost*.2;cost+=correction;entry('arm-savings-cap','Manipulator saving limit',correction,0,'25–26');}
 const equipment=evaluateEquipment(design,OPTIONS,baseSlots),options=equipment.installed,defaultSuite=options.filter(o=>o.fromDefault);
 diagnostics.push(...equipment.diagnostics);ledger.push(...equipment.ledger);cost+=equipment.cost;used+=equipment.slots;
 const zeroSlotCount=equipment.zeroSlot.used,zeroSlotAllowance=equipment.zeroSlot.allowance,overflow=equipment.zeroSlot.overflow;
 if(equipment.noInternalPower){endurance=endurance*p.powerPacks/(1+p.powerPacks);if(p.vehicleSpeed)vehicleEndurance=Math.round(endurance/4/2**p.vehicleBands);}
 if(brain.tl>tl)error('MIN_TL','brain.model','Brain generation exceeds design technology.','66');
 const core=lookup(CORE_PACKAGES,s.skills.corePackage),coreSkills=[];
 if((brain.rank>=2&&core.id!=='none')||(brain.rank<2&&core.family!==brain.family))error('CORE_PACKAGE_FAMILY','skills.corePackage','Hard-coded package does not match the selected brain family.','69–73');
 if(!core.implemented)block('CORE_PACKAGE_PENDING','skills.corePackage',core.reason,'69–73');
 if(core.id==='primitive-clean'&&!options.some(o=>o.id.includes('clean')))error('CLEANING_EQUIPMENT','skills.corePackage','Primitive cleaning requires a domestic or industrial cleaning option.','69');
 for(const [id,level] of core.skills)coreSkills.push({id,level,characteristic:'hard-coded',modifier:0,effectiveLevel:level});
 if(core.id==='basic-locomotion'){coreSkills.push({id:'athletics-dexterity',level:p.agility,characteristic:'hard-coded',modifier:0,effectiveLevel:p.agility},{id:'vehicle-'+primary.id,level:p.agility,characteristic:'hard-coded',modifier:0,effectiveLevel:p.agility});}
 cost+=core.cost;if(core.id!=='none')entry('core-package',core.label,core.cost,0,'69–73',{bandwidth:core.bandwidth});
 if(upgrade.tl>tl||upgrade.rank>brain.rank)error('BANDWIDTH_UPGRADE','brain.bandwidthUpgrade','This bandwidth module requires higher technology or brain capability.','67');
 if(s.brain.hardened&&tl<8)error('MIN_TL','brain.hardened','Brain hardening requires TL8.','67');
 const brainSlots=chassis.size>=brain.bandwidth-(tl-brain.tl)?0:1;
 const brainCost=brain.cost*(brain.rank>=3?.5**(tl-brain.tl):1)*(s.brain.hardened?1.5:1),upgradeCost=upgrade.cost*(s.brain.hardened?1.5:1);
 used+=brainSlots+(upgrade.bandwidth?1:0);cost+=brainCost+upgradeCost;entry('brain','Robot brain',brainCost,brainSlots,'66–67');if(upgrade.bandwidth)entry('bandwidth','Bandwidth upgrade',upgradeCost,1,'67');
 const intellect=s.brain.intellectUpgrade,intelligence=brain.intelligence+intellect,intellectBW=intellect*(intellect+1)/2;
 let intellectCost=intellect?1000:0;for(let n=1;n<=intellect;n++)intellectCost*=brain.intelligence+n;if(intelligence>=12)intellectCost*=2;cost+=intellectCost;if(intellect)entry('intellect','Intellect upgrade',intellectCost,0,'67',{bandwidth:intellectBW});
 let bwUsed=intellectBW+core.bandwidth,zeroBW=0;const packages=s.skills.packages.map(id=>lookup(PACKAGES,id)),skillIds=new Set(),skills=[...coreSkills];
 if(brain.rank===0&&packages.length)error('PRIMITIVE_STANDARD_SKILLS','skills.packages','Primitive brains cannot install standard skill packages.','69');
 if(brain.family==='basic'&&core.id!=='basic-none'&&packages.length)error('BASIC_FIXED_SKILLS','skills.packages','This Basic brain uses its fixed function rather than general skill packages.','70–71');
 for(const pkg of packages){
  if(brain.family==='basic'&&pkg.level>1)error('BASIC_SKILL_LEVEL','skills.packages','Basic (none) is limited to skill level one.','71');
  if(!pkg.implemented)block('SPECIALITY_REQUIRED','skills.packages',pkg.reason,'73–74');
  const skillKey=pkg.skill+(pkg.speciality?':'+pkg.speciality:'');
  if(skillIds.has(skillKey)||skillIds.has(pkg.skill+':all')||(pkg.speciality==='all'&&[...skillIds].some(k=>k.startsWith(pkg.skill+':'))))error('DUPLICATE_SKILL','skills.packages','Install only one level of each skill.','73');skillIds.add(skillKey);
  if(pkg.tl>tl)error('MIN_TL','skills.packages',`${pkg.label} exceeds design technology.`,'73–74');
  if((pkg.perPackageBandwidth??pkg.bandwidth)>brain.bandwidth)error('INHERENT_BANDWIDTH','skills.packages',`${pkg.label} exceeds inherent brain bandwidth; storage upgrades do not raise this limit.`,'67,73');
  if(pkg.bandwidth===0)zeroBW++;else bwUsed+=pkg.bandwidth;
  cost+=pkg.cost;entry(pkg.id,pkg.label,pkg.cost,0,'73–74',{bandwidth:pkg.bandwidth});
  const modifier=pkg.characteristic==='INT'?characteristicDM(intelligence):null;
  const modifierOptions=pkg.characteristic==='DEX'?manipulators.map(a=>({manipulatorId:a.id,modifier:characteristicDM(a.dexterity),effectiveLevel:pkg.level+characteristicDM(a.dexterity)})):[];
  skills.push({id:skillKey,...(pkg.speciality?{speciality:pkg.speciality}:{}),level:pkg.level,characteristic:pkg.characteristic,modifier,effectiveLevel:modifier===null?null:pkg.level+modifier,...(modifierOptions.length?{modifierOptions}:{})});
 }
 const zeroBWAllowance=brain.rank>=2?brain.bandwidth:0;bwUsed+=Math.max(0,zeroBW-zeroBWAllowance);
 const bandwidthCapacity=brain.bandwidth+upgrade.bandwidth;
 if(bwUsed>bandwidthCapacity)error('BANDWIDTH_EXCEEDED','skills.packages','Installed packages and intellect upgrade exceed available bandwidth.','67,73');
 let body=null;
 if(bodyType){
  const softwareCost=core.cost+packages.reduce((sum,pkg)=>sum+pkg.cost,0),physicalCost=cost-softwareCost;
  body=evaluateBodyType(design,{baseSlots,brainRank:brain.rank,physicalCost,softwareCost,armourSlots:ledger.find(x=>x.id==='armour')?.slots??0});
  diagnostics.push(...body.diagnostics);used+=body.reservedSlots;
  entry('body-tier','Special body tier',body.bodyFee,body.reservedSlots,body.source.pages);
  entry('body-multiplier','Physical construction multiplier',body.cost-cost-body.bodyFee,0,body.source.pages);cost=body.cost;
 }
 const removed=s.finalisation.removedSlots;
 if(removed>capacity-used)error('REMOVE_USED_SLOTS','finalisation.removedSlots','Only unused slots may be permanently removed.','13');
 capacity-=removed;const slotSaving=removed*100*(bodyType?3:1);cost-=slotSaving;if(removed)entry('removed-slots','Permanently removed slots',-slotSaving,0,'13');
 if(cost<chassis.cost){entry('minimum-cost','Minimum basic chassis cost',chassis.cost-cost,0,'13');cost=chassis.cost;}
 if(used>capacity)error('SLOTS_EXCEEDED','physical','Installed components exceed available slots.','13');
 issue('warning','PARTIAL_COVERAGE','coverage','This result checks selected implemented rules only, not every Handbook option. See coverage gaps.');
 const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';
 const athletics=packages.find(p=>p.skill==='athletics');
 const skillEquivalents=athletics?manipulators.flatMap(a=>[{skill:'athletics',speciality:'strength',manipulatorId:a.id,level:athletics.level+characteristicDM(a.strength)},{skill:'athletics',speciality:'dexterity',manipulatorId:a.id,level:athletics.level+characteristicDM(a.dexterity)}]):[];
 if(p.agility)skillEquivalents.push({skill:'athletics',speciality:'dexterity',source:'agility-enhancement',level:p.agility});
 if(p.powerPacks)skillEquivalents.push({skill:'athletics',speciality:'endurance',source:'power-packs',level:p.powerPacks});
 const constructionCost=cost;if(s.finalisation.priceMode==='custom'){issue('warning','CUSTOM_LIST_PRICE','finalisation.customPrice','Custom list price changes the sale price, not construction accounting.','76');cost=s.finalisation.customPrice;}
 const totals={cost,constructionCost,baseChassisCost:baseCost,basicCost:chassis.cost,slots:{base:baseSlots,capacity,used,remaining:capacity-used},bandwidth:{inherent:brain.bandwidth,capacity:bandwidthCapacity,used:bwUsed,remaining:bandwidthCapacity-bwUsed},zeroSlot:{allowance:zeroSlotAllowance,used:zeroSlotCount,overflow},zeroBandwidth:{allowance:zeroBWAllowance,used:zeroBW,overflow:Math.max(0,zeroBW-zeroBWAllowance)},hits,armour:(bodyType?0:armour.base)+p.armourAdded-(p.armourRemoved?1:0),endurance:design.kind==='biological'?null:Math.round(endurance),vehicleEndurance:design.kind==='biological'?null:vehicleEndurance,tacticalSpeed,vehicleBand,intelligence,intelligenceDM:characteristicDM(intelligence),defaultSuite:defaultSuite.map(o=>({id:o.id,label:o.label})),manipulators,skills,skillEquivalents,powerModes:equipment.powerModes,toolCaps:equipment.toolCaps,hardwareSkills:equipment.hardwareSkills,traits:[...(body?.traits??[]),...equipment.traits,...primary.traits.map(t=>p.vehicleSpeed&&t.startsWith('Flyer')?'Flyer ('+vehicleBand+')':t),...(secondary?.id!=='none'?secondary?.traits??[]:[]),...(chassis.attackDM<0?[`Small (${chassis.attackDM})`]:chassis.attackDM>0?[`Large (+${chassis.attackDM})`]:[])]};
 return{status,diagnostics,totals:status==='verified'?totals:null,...(status==='invalid'&&!diagnostics.some(d=>d.severity==='blocker')?{previewTotals:{...totals,provisional:true}}:{}),ledger,coverage:clone(COVERAGE)};
}

const EXAMPLES=[{id:'inspection-platform',name:'Inspection platform',description:'An authored TL12 ordinary construction example using implemented rules, not a published catalogue robot.'}];
export function getExamples(){return clone(EXAMPLES);}
export function createExample(id){
 if(id!=='inspection-platform')throw new TypeError('Unknown example.');
 return updateDesign(createDesign(),{name:'Inspection platform',selections:{chassis:{size:'size-4'},physical:{efficiency:true,options:['hostile-environment']},skills:{packages:['admin-0','recon-0']}}});
}
