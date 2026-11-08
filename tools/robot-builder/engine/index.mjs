import {initialiseMedicalInventory} from './medical-nanorobots.mjs';
import {supportsReferences,validateReferences,prepareComposite,finishComposite,compositeDerivedFields} from './composites.mjs';
import {characteristicDM} from './characteristics.mjs';
import {evaluateBrainSoftware} from './brain-software.mjs';
import {equipmentCapabilities} from './capabilities.mjs';
import {verifiedVehicleOptionCatalogue,validateVerifiedVehicleOptions,evaluateVerifiedVehicleOptions} from './verified-vehicle-options.mjs';
export {vehicleOptionRecordPresentation} from './verified-vehicle-options.mjs';
import {validateExternalVehicleOptions,evaluateExternalVehicleOptions} from './vehicle-options.mjs';
import {fabricationCapabilities,highTechnologyInventory} from './high-technology.mjs';
export {weaponRecordPresentation} from './weapons.mjs';
import {weaponControl,validateWeapons,evaluateWeapons,WEAPONS} from './weapons.mjs';
import {evaluateEquipment,validateOptionParameters,validateOptionInstances} from './equipment.mjs';
import {SCHEMA_VERSION,STAGE_IDS,isRecord,assertJson,clone,assertKeys,integer,mergeKnown} from './schema.mjs';
import {getCatalogue as baseCatalogue,STAGES,KINDS,SIZES,LOCOMOTION,BRAINS,BANDWIDTH,PACKAGES,SKILLS,OPTIONS,DEFAULT_ITEMS,CORE_PACKAGES,COVERAGE,source} from './catalogue.mjs';
import {getSpecialKinds,getSpecialControls,createSpecialDesignFields,validateSpecialFields,evaluateSpecialDesign,evaluateBodyType,getSpecialStageNotes,evaluateAvatarLink,evaluateDroneInterface,usesStandaloneSpecialPath} from './special-types.mjs';
export function getCatalogue(design){
 const catalogue=baseCatalogue();catalogue.highTechnology=highTechnologyInventory();catalogue.stages.find(s=>s.id==='physical').controls=catalogue.stages.find(s=>s.id==='physical').controls.map(c=>c.type==='weapons'?weaponControl(design):c);catalogue.kinds=[catalogue.kinds[0],...getSpecialKinds()];catalogue.coverage=getCoverage();
 if(design&&design.kind!=='standard'){
  const body=['android','biological','avatar','drone'].includes(design.kind)&&!usesStandaloneSpecialPath(design),notes=getSpecialStageNotes(design.kind),controls=getSpecialControls(design.kind,design).map(c=>({...c,target:'special'}));
  catalogue.stages=catalogue.stages.map(stage=>({...stage,description:notes[stage.id]?.description??(body?stage.description:'This type uses a separate construction sequence; ordinary robot cost, slots and bandwidth do not apply.'),...(notes[stage.id]?.source?{source:notes[stage.id].source}:{}),...(notes[stage.id]?.categories!==undefined?{categories:notes[stage.id].categories}:{}),...(notes[stage.id]?.categorize!==undefined?{categorize:notes[stage.id].categorize}:{}),...(notes[stage.id]?.categoryLabel!==undefined?{categoryLabel:notes[stage.id].categoryLabel}:{}),controls:[...(body?stage.controls:[]),...controls.filter(c=>(c.stage??'chassis')===stage.id)]}));
 }
 if(design?.selections.skills.corePackage==='basic-target'){const control=catalogue.stages.find(s=>s.id==='skills').controls.find(c=>c.field==='coreWeapon');if(control)control.visibleWhen={field:'targetMode',equals:'weapon'};}
 for(const stage of catalogue.stages)for(const control of stage.controls)if(control.choices)control.choices=control.choices.map(choice=>({...choice,eligibility:{available:choice.implemented!==false&&(!design||choice.tl===undefined||choice.tl<=design.techLevel),reason:choice.implemented===false?(choice.reason??'Not implemented'):design&&choice.tl>design.techLevel?'Requires TL'+choice.tl:null}}));
 const derivedFields=compositeDerivedFields(design??{});if(derivedFields.length){const evaluation=evaluateDesign(design);for(const stage of catalogue.stages)for(const control of stage.controls)if(control.target==='special'&&derivedFields.includes(control.field)){control.readOnly=true;control.derivedFromReferences=true;control.derivedValue=evaluation.status==='verified'?evaluation.composite?.derivedInputs?.[control.field]??null:null;control.description=evaluation.status==='verified'?'Derived from independently validated component snapshots. Remove or replace references to change this value.':'Component references are invalid or blocked; repair or remove them before this derived value can be used.';}}
 return clone(catalogue);
}
export function getCoverage(){
 const special=getSpecialKinds();return {...clone(COVERAGE),inventory:{verifiedVehicleOptionRows:verifiedVehicleOptionCatalogue().length,weaponCatalogueRows:WEAPONS.length,ordinaryEquipmentRows:OPTIONS.length,equipmentRowsWithResolvedAccounting:OPTIONS.filter(o=>o.implemented).length,standardSkillChoices:PACKAGES.length,implementedKinds:['standard',...special.filter(k=>k.implemented).map(k=>k.id)],blockedKinds:special.filter(k=>!k.implemented).map(k=>k.id)},gaps:[...clone(COVERAGE.gaps).map(g=>g.id==='weapons'?{...g,message:'Supported Core and source-specific CSC weapon profiles, direct payload mounts, associated launchers and known-mass loose grenade storage are implemented. Explicitly classified CSC spare loads use qualified mass estimates and shared storage reservations. Remaining weapon rows, unpriced or improvised items, unclassified supplies and ambiguous combined launcher mounts remain gaps. Full attack-context resolution is separate.'}:g),...special.filter(k=>!k.implemented).map(k=>({id:'kind-'+k.id,message:k.label+': '+k.reason,source:k.source}))]};
}
export const API_VERSION = SCHEMA_VERSION;
const defaultArm=id=>({id,kind:'base',size:'chassis',strengthIncrease:0,dexterityIncrease:0});
const initial = (kind,techLevel) => ({schemaVersion:1,name:'Untitled robot',kind,techLevel,special:createSpecialDesignFields(kind,techLevel),selections:{
 chassis:{size:'size-5'},locomotion:{primary:'wheels',secondary:'none'},
 physical:{verifiedVehicleOptions:[],externalVehicleOptions:[],solarLight:'full',solarZone:'habitable',alternativeActivity:'normal',coatingPowerRule:'unresolved',optionInstances:[],weapons:[],powerMode:'conventional',optionParameters:{},defaultSuite:['visual-spectrum','voder','auditory','wireless','transceiver-improved'],armourAdded:0,armourRemoved:false,efficiency:false,powerPacks:0,resiliency:0,agility:0,tacticalSpeed:0,vehicleSpeed:false,vehicleBands:0,options:[],manipulators:[defaultArm('base-1'),defaultArm('base-2')]},
 brain:{model:techLevel>=12?'advanced-tl12':techLevel>=10?'advanced-tl10':techLevel>=8?'basic-tl8':'primitive-tl7',bandwidthUpgrade:'none',intellectUpgrade:0,hardened:false},
 skills:{servantProfession:'domestic-servant',targetMode:'explosives',coreWeapon:'unspecified',hunterBandwidth:'unresolved',corePackage:techLevel>=10?'none':techLevel>=8?'basic-none':'primitive-alert',packages:[],customPackages:[]},finalisation:{removedSlots:0,priceMode:'construction',customPrice:0}
}});
function checked(value){
 assertJson(value); assertKeys(value,['schemaVersion','name','kind','techLevel','special','selections'],'design');
 if(value.schemaVersion!==SCHEMA_VERSION)throw new TypeError('Unsupported design schema version.');
 if(typeof value.name!=='string'||!value.name.trim()||value.name.length>120)throw new TypeError('Name must contain 1 to 120 characters.');
 if(!KINDS.some(k=>k.id===value.kind))throw new TypeError('Unknown robot kind.');
 integer(value.techLevel,5,23,'techLevel');validateSpecialFields(value.kind,value.special);
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
    }else if(control.type==='custom-packages'){
    if(!Array.isArray(v)||v.length>control.maxItems)throw new TypeError(path+': too many custom packages.');
    const ids=new Set();for(const pkg of v){
     assertKeys(pkg,['id','skill','speciality','level'],path);
     if(typeof pkg.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(pkg.id)||ids.has(pkg.id))throw new TypeError(path+': invalid or duplicate package ID.');ids.add(pkg.id);
     if(!['language','profession','science','art-instrument'].includes(pkg.skill))throw new TypeError(path+': custom specialities are not permitted for this skill.');
     if(typeof pkg.speciality!=='string'||!pkg.speciality.trim()||pkg.speciality.length>120)throw new TypeError(path+': name the custom speciality (1-120 characters).');integer(pkg.level,0,3,path+'.level');
    }
   }else if(control.type==='verified-vehicle-options'){validateVerifiedVehicleOptions(v);
   }else if(control.type==='external-vehicle-options'){validateExternalVehicleOptions(v,OPTIONS);
   }else if(control.type==='option-instances'){validateOptionInstances(v,OPTIONS);
   }else if(control.type==='weapons'){validateWeapons(v);
   }else if(control.type==='option-parameters'){
validateOptionParameters(v,control.choices);
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
 for(const ref of value.special.designReferences??[])checked(ref.design);
 return clone(value);
}
export function createDesign(options={}){assertKeys(options,['kind','techLevel'],'options');const design=initial(options.kind??'standard',options.techLevel??(options.kind==='clone'?13:12));if(design.kind==='biological')design.selections.locomotion.primary='walker';if(design.kind==='drone'){design.selections.brain.model='none';design.selections.skills.corePackage='none';design.selections.physical.defaultSuite=['visual-spectrum','voder','auditory','wireless','drone-interface'];}return checked(design);}
export function validateDesign(design){try{checked(design);return{valid:true,diagnostics:[]};}catch(error){return{valid:false,diagnostics:[{severity:'error',code:'SCHEMA',path:'design',message:error.message}]};}}
export function updateDesign(design,patch){assertJson(patch);const base=checked(design);if(base.kind==='nanorobot'&&base.special.medicalMode===undefined&&base.special.medicalPackages===undefined){base.special.medicalMode='legacy-single';base.special.medicalPackages=null;}if(patch.kind!==undefined&&patch.kind!==base.kind){base.kind=patch.kind;base.special=createSpecialDesignFields(patch.kind,patch.techLevel??base.techLevel);}return checked(mergeKnown(base,initialiseMedicalInventory(base,patch)));}
export function applySelection(design,command){
 assertJson(command);assertKeys(command,['stage','field','value'],'command');
 if(!STAGE_IDS.includes(command.stage))throw new TypeError('Unknown stage.');
 if(design.kind!=='standard'&&getSpecialControls(design.kind,design).some(c=>c.field===command.field&&(c.stage??'chassis')===command.stage))return updateDesign(design,{special:{[command.field]:command.value}});
 if(!STAGES.find(s=>s.id===command.stage).controls.some(c=>c.field===command.field))throw new TypeError('Unknown selection field.');
 if(command.stage==='brain'&&command.field==='model'){
  const brain=BRAINS.find(b=>b.id===command.value);if(!brain)throw new TypeError('Unknown brain.');
  const corePackage=brain.family==='primitive'?'primitive-alert':brain.family==='basic'?'basic-none':brain.family==='hunter-killer'?'hunter-standard':'none';
  return updateDesign(design,{selections:{brain:{model:command.value},skills:{corePackage}}});
 }
 if(command.stage==='physical'&&['options','defaultSuite'].includes(command.field)){
  const other=command.field==='options'?'defaultSuite':'options',active=[...command.value,...design.selections.physical[other]];
  const placements={...design.selections.physical,[command.field]:command.value};
  const optionParameters=Object.fromEntries(Object.entries(design.selections.physical.optionParameters).filter(([id])=>active.includes(id)).map(([id,params])=>[id,Object.fromEntries(Object.entries(params).filter(([field])=>{const c=OPTIONS.find(o=>o.id===id).parameterControls.find(c=>c.field===field);return !c.appliesTo||placements[c.appliesTo].includes(id);}))]));
  return updateDesign(design,{selections:{physical:{[command.field]:command.value,optionParameters}}});
 }
 return updateDesign(design,{selections:{[command.stage]:{[command.field]:command.value}}});
}
export function exportDesign(design){return JSON.stringify(checked(design),null,2);}
export function importDesign(json){if(typeof json!=='string'||json.length>1000000)throw new TypeError('Expected a design JSON string of at most 1 MB.');const value=JSON.parse(json);if(value?.schemaVersion===1&&isRecord(value.selections)){if(isRecord(value.selections.physical)){if(value.selections.physical.verifiedVehicleOptions===undefined)value.selections.physical.verifiedVehicleOptions=[];if(value.selections.physical.externalVehicleOptions===undefined)value.selections.physical.externalVehicleOptions=[];for(const [key,defaultValue]of Object.entries({solarLight:'full',solarZone:'habitable',alternativeActivity:'normal',coatingPowerRule:'unresolved'}))if(value.selections.physical[key]===undefined)value.selections.physical[key]=defaultValue;if(value.selections.physical.weapons===undefined)value.selections.physical.weapons=[];if(value.selections.physical.optionInstances===undefined)value.selections.physical.optionInstances=[];}if(isRecord(value.selections.skills)){if(value.selections.skills.customPackages===undefined)value.selections.skills.customPackages=[];if(value.selections.skills.servantProfession===undefined)value.selections.skills.servantProfession='domestic-servant';if(value.selections.skills.targetMode===undefined)value.selections.skills.targetMode='explosives';}}if(value?.schemaVersion===1&&isRecord(value.special)){if(value.kind==='nanorobot'&&value.special.medicalMode===undefined&&value.special.medicalPackages===undefined){value.special.medicalMode='legacy-single';value.special.medicalPackages=null;}if(supportsReferences(value.kind)){if(value.special.designReferences===undefined)value.special.designReferences=[];validateReferences(value.kind,value.special.designReferences);for(const ref of value.special.designReferences)ref.design=importDesign(JSON.stringify(ref.design));}if(['cyborg','biological'].includes(value.kind)){const defaults=createSpecialDesignFields(value.kind,value.techLevel);const added=['computerSoftware','augmentWeapons','brainCustomPackages','augmentRecipient','augmentSpeciesVerified','augmentNaturalArms','augmentNaturalLegs','augmentNaturalEyes','augmentNaturalEars','augmentNaturalNoses','augmentNaturalTongues','limbPriceInterpretation','augmentations','augmentOptions','augmentControllerRadioKm',...(value.kind==='cyborg'?['cyborgMode']:[])];for(const key of added)if(value.special[key]===undefined)value.special[key]=defaults[key];}if(value.kind==='microbot'&&value.special.optionInstances===undefined)value.special.optionInstances=[];if(value.kind==='microbot'&&value.special.selfDestruct===undefined)value.special.selfDestruct='none';if(value.kind==='microbot'&&value.special.massUnit===undefined)value.special.massUnit='mg';if(value.kind==='avatar'&&value.special.superiorControllerSlots===undefined)value.special.superiorControllerSlots='unresolved';if(value.kind==='microbot'&&value.special.hunterBandwidth===undefined)value.special.hunterBandwidth='unresolved';if(value.kind==='clone'&&value.special.trainingCustomSkills===undefined)value.special.trainingCustomSkills=[];if(value.kind==='clone'){const defaults=createSpecialDesignFields('clone',value.techLevel);for(const key of ['acceleratedStop','acceleratedStopMonths','acceleratedCalendar','earlyGrowthPrice','partialCrecheEducation','trainingIntSchedule'])if(value.special[key]===undefined)value.special[key]=defaults[key];}if(value.kind==='avatar'){const defaults=createSpecialDesignFields('avatar',value.techLevel);for(const key of ['biologicalNeuralLink','remoteAvatarController','biologicalConnection','recipientBrain','remoteConnectionState','cumulativeControlDays'])if(value.special[key]===undefined)value.special[key]=defaults[key];}}return checked(value);}
export {characteristicDM} from './characteristics.mjs';
const lookup=(items,id)=>items.find(x=>x.id===id);
const armourBand=tl=>tl<9?{base:2,max:20,percent:.01,perSlot:1,cost:250}:tl<12?{base:3,max:30,percent:.005,perSlot:2,cost:1000}:tl<15?{base:4,max:40,percent:.004,perSlot:3,cost:1500}:tl<18?{base:4,max:50,percent:.003,perSlot:4,cost:2500}:{base:5,max:60,percent:.0025,perSlot:5,cost:5000};
export function manipulatorSlots(baseSlots,chassisSize,armSize){integer(baseSlots,1,128,'baseSlots');integer(chassisSize,1,8,'chassisSize');integer(armSize,1,10,'armSize');const diff=armSize-chassisSize;if(diff>2)throw new TypeError('Manipulator exceeds chassis size by more than two.');return Math.ceil(baseSlots*(diff===2?.4:diff===1?.2:diff===0?.1:diff===-1?.05:diff===-2?.02:.01));}
export function evaluateDesign(input){
 const validation=validateDesign(input);if(!validation.valid)return{status:'invalid',diagnostics:validation.diagnostics,totals:null,ledger:[],coverage:getCoverage()};
 const design=checked(input),refs=design.special.designReferences??[];if(!refs.length)return evaluateSingleDesign(design);
 const children=refs.map(ref=>({ref,evaluation:evaluateSingleDesign(ref.design)}));
 const prepared=prepareComposite(design,children),base=evaluateSingleDesign(prepared.design);
 return finishComposite(design,prepared,base,children);
}
function evaluateSingleDesign(input){
 const validation=validateDesign(input);if(!validation.valid)return{status:'invalid',diagnostics:validation.diagnostics,totals:null,ledger:[],coverage:getCoverage()};
 const design=checked(input);if(usesStandaloneSpecialPath(design)||!['standard','android','biological','avatar','drone'].includes(design.kind))return evaluateSpecialDesign(design);
 const {selections:s,techLevel:tl}=design,p=s.physical,brain=lookup(BRAINS,s.brain.model),upgrade=lookup(BANDWIDTH,s.brain.bandwidthUpgrade),chassis=lookup(SIZES,s.chassis.size),primary=lookup(LOCOMOTION,s.locomotion.primary),secondary=lookup(LOCOMOTION,s.locomotion.secondary);
 const diagnostics=[],ledger=[],kind=design.kind==='standard'?KINDS[0]:lookup(getSpecialKinds(),design.kind),bodyType=['android','biological'].includes(design.kind);
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
 if(tl<6)block('PRE_TL6_ARMOUR','techLevel','The ordinary armour table begins at TL6. No lower-tech protection value is inferred.','19');
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
 let tacticalSpeed=stationary?0:5+primary.agility+p.agility+p.tacticalSpeed;
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
 const verifiedVehicle=evaluateVerifiedVehicleOptions(design);diagnostics.push(...verifiedVehicle.diagnostics);ledger.push(...verifiedVehicle.ledger);cost+=verifiedVehicle.cost;used+=verifiedVehicle.slots;
 const externalVehicle=evaluateExternalVehicleOptions(design,chassis,OPTIONS);diagnostics.push(...externalVehicle.diagnostics);ledger.push(...externalVehicle.ledger);cost+=externalVehicle.cost;used+=externalVehicle.slots;
 const zeroSlotCount=equipment.zeroSlot.used,zeroSlotAllowance=equipment.zeroSlot.allowance,overflow=equipment.zeroSlot.overflow;
 if(equipment.noInternalPower){endurance=endurance*p.powerPacks/(1+p.powerPacks);if(p.vehicleSpeed)vehicleEndurance=Math.round(endurance/4/2**p.vehicleBands);}
 const nominalTacticalSpeed=tacticalSpeed;
 if(equipment.powerState.limited||p.powerMode==='solar-coating-only'){tacticalSpeed=Math.floor(tacticalSpeed*equipment.powerState.movementFactor);for(const arm of manipulators){arm.nominalStrength=arm.strength;arm.strength=Math.floor(arm.strength*equipment.powerState.strengthFactor);}vehicleEndurance=null;vehicleBand=null;}
 const solarCap=['grav','vtol','aeroplane','thruster'].includes(primary.id)?equipment.powerState.maximumFlyingSpeed:equipment.powerState.maximumGroundSpeed;if(solarCap!==null)tacticalSpeed=Math.min(tacticalSpeed,solarCap);
 if(equipment.powerState.external||equipment.powerState.sustainedAlternative)endurance=null;
 const noBrain=brain.id==='none';if(noBrain&&design.kind!=='drone')error('BRAIN_REQUIRED','brain.model','Only a separately controlled drone may omit its onboard brain.','78-79');
 if(noBrain&&(s.brain.bandwidthUpgrade!=='none'||s.brain.intellectUpgrade||s.brain.hardened||s.skills.corePackage!=='none'||s.skills.packages.length||s.skills.customPackages.length))error('DRONE_SOFTWARE_WITHOUT_BRAIN','brain','A brainless drone cannot install brain upgrades or robot software.','78-79');
 if(brain.tl>tl)error('MIN_TL','brain.model','Brain generation exceeds design technology.','66');
 const core=lookup(CORE_PACKAGES,s.skills.corePackage),coreSkills=[];let coreBandwidth=core.bandwidth;
 if((brain.rank>=2&&core.id!=='none')||(brain.rank<2&&brain.id!=='none'&&core.family!==brain.family))error('CORE_PACKAGE_FAMILY','skills.corePackage','Hard-coded package does not match the selected brain family.','69–73');
 if(!core.implemented)block('CORE_PACKAGE_PENDING','skills.corePackage',core.reason,'69–73');
 if(core.id==='primitive-clean'&&!options.some(o=>o.id.includes('clean')))error('CLEANING_EQUIPMENT','skills.corePackage','Primitive cleaning requires a domestic or industrial cleaning option.','69');
 if(core.family==='hunter-killer'){
  if(s.skills.hunterBandwidth==='unresolved')block('HUNTER_BANDWIDTH_INTERPRETATION','skills.hunterBandwidth','The Hunter/Killer package section does not explicitly state bandwidth occupancy. Select a disclosed referee interpretation.','72-73');
  else{coreBandwidth=s.skills.hunterBandwidth==='zero'?0:1;issue('warning','HUNTER_BANDWIDTH_INTERPRETATION','skills.hunterBandwidth','Using the explicitly chosen '+coreBandwidth+' BW interpretation for the hard-coded package.','72-73');}
 }
 const coreSkillEntries=core.id==='basic-servant'?[['profession-'+s.skills.servantProfession,2]]:core.id==='basic-target'&&s.skills.targetMode==='weapon'?[['weapon',1],['recon',0],...(options.some(o=>o.exclusive==='self-destruct')?[['explosives',0]]:[])]:core.skills;
 if(core.id==='basic-target'&&s.skills.targetMode==='weapon'&&!p.weapons.some(record=>{const w=WEAPONS.find(w=>w.id===record.weaponId);return w.skill+':'+w.speciality===s.skills.coreWeapon;}))error('TARGET_WEAPON_REQUIRED','skills.coreWeapon','The target package weapon speciality must match an installed melee or ranged weapon.','72');
 for(const [id,level] of coreSkillEntries){
  let skillId=id;if(id==='weapon'){
   if(s.skills.coreWeapon==='unspecified')block('CORE_WEAPON_REQUIRED','skills.coreWeapon','Choose the hard-coded weapon speciality.','69-73');
   else{skillId=s.skills.coreWeapon;if(core.family==='hunter-killer'&&!['gun-combat','melee'].includes(skillId.split(':')[0]))error('HUNTER_WEAPON','skills.coreWeapon','Hunter/Killer standard packages specify Gun Combat or Melee.','73');}
  }
  coreSkills.push({id:skillId,level,characteristic:'hard-coded',modifier:0,effectiveLevel:level});
 }
 if(core.id==='basic-locomotion'){coreSkills.push({id:'athletics-dexterity',level:p.agility,characteristic:'hard-coded',modifier:0,effectiveLevel:p.agility},{id:'vehicle-'+primary.id,level:p.agility,characteristic:'hard-coded',modifier:0,effectiveLevel:p.agility});}
 cost+=core.cost;if(core.id!=='none')entry('core-package',core.label,core.cost,0,'69–73',{bandwidth:coreBandwidth});
 const brainAccounting=evaluateBrainSoftware({brain,upgrade,techLevel:tl,settings:s.brain,selection:{packages:s.skills.packages,customPackages:s.skills.customPackages},core,coreBandwidth,coreSkills,manipulators,brainSlots:chassis.size>=brain.bandwidth-(tl-brain.tl)?0:1});
 const {intelligence,intellectBW,bwUsed,zeroBW,zeroBWAllowance,bandwidthCapacity,packages,skills}=brainAccounting;
 cost+=brainAccounting.cost;used+=brainAccounting.slots;diagnostics.push(...brainAccounting.diagnostics);ledger.push(...brainAccounting.ledger);
 const equipmentOperations=options.filter(o=>o.operationRequiresSkills).map(o=>{const missing=o.operationRequiresSkills.filter(required=>{const skill=required.skill.toLowerCase().replaceAll(' ','-'),speciality=required.specialty?.replaceAll(' ','-');return !skills.some(s=>{const [base,spec]=s.id.split(':');if(base!==skill)return false;if(!speciality||spec===speciality||spec==='all')return s.level>=required.minimumLevel;if(!spec)return s.level>=required.minimumLevel;if(s.grantsOtherSpecialitiesAtZero&&required.minimumLevel===0)return true;return false;});});if(missing.length)issue('warning','EQUIPMENT_INACTIVE_SKILL','physical.'+(o.instanceId?'optionInstances.'+o.instanceId:'options.'+o.id),o.label+' is installed but lacks required operating software: '+missing.map(r=>r.skill+(r.specialty?' ('+r.specialty+')':'')+' '+r.minimumLevel).join(', ')+'.',o.source.pages);return{id:o.instanceId??o.id,optionId:o.id,status:missing.length?'inactive':'software-ready',missingRequirements:missing,externalConditionsStillApply:true};});
 const weaponResult=evaluateWeapons(design,manipulators,skills,options);diagnostics.push(...weaponResult.diagnostics);ledger.push(...weaponResult.ledger);cost+=weaponResult.cost;used+=weaponResult.slots;
 let droneLink=null;if(design.kind==='drone'){droneLink=evaluateDroneInterface(design,{hasDroneInterface:options.some(o=>o.effects?.droneInterface),hasCommunications:options.some(o=>o.family==='transceiver'||o.id==='wireless')});diagnostics.push(...droneLink.diagnostics);}
 let avatarLink=null;
 if(design.kind==='avatar'){
  avatarLink=evaluateAvatarLink(design,{brainRank:brain.rank,hasTransceiver:options.some(o=>o.family==='transceiver'),bandwidthCapacity:bandwidthCapacity-intellectBW});
  diagnostics.push(...avatarLink.diagnostics);cost+=avatarLink.cost;used+=avatarLink.slots;entry('avatar-link','Avatar '+design.special.avatarRole+' link',avatarLink.cost,avatarLink.slots,avatarLink.source.pages);
 }
 let body=null;
 if(bodyType){
  const softwareCost=core.cost+packages.reduce((sum,pkg)=>sum+pkg.cost,0),physicalCost=cost-softwareCost;
  body=evaluateBodyType(design,{baseSlots,brainRank:brain.rank,physicalCost,softwareCost,installedOptions:options,armourSlots:ledger.find(x=>x.id==='armour')?.slots??0});
  diagnostics.push(...body.diagnostics);used+=body.reservedSlots;
  entry('body-tier','Special body tier',body.bodyFee,body.reservedSlots,body.source.pages);
  entry('body-multiplier','Physical construction multiplier',body.cost-cost-body.bodyFee-(body.augmentationCost??0),0,body.source.pages);if(body.augmentation)ledger.push(...body.augmentation.ledger);cost=body.cost;
 }
 const removed=s.finalisation.removedSlots;
 if(removed>0&&removed>capacity-used)error('REMOVE_USED_SLOTS','finalisation.removedSlots','Only unused slots may be permanently removed.','13');
 capacity-=removed;const slotSaving=removed*100*(bodyType?3:1);cost-=slotSaving;if(removed)entry('removed-slots','Permanently removed slots',-slotSaving,0,'13');
 if(cost<chassis.cost){entry('minimum-cost','Minimum basic chassis cost',chassis.cost-cost,0,'13');cost=chassis.cost;}
 if(used>capacity)error('SLOTS_EXCEEDED','physical','Installed components exceed available slots.','13');
 issue('warning','PARTIAL_COVERAGE','coverage','This result checks selected implemented rules only, not every Handbook option. See coverage gaps.');
 const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';
 const athletics=packages.find(p=>p.skill==='athletics'&&p.level===0);
 const athleticsStrength=packages.find(p=>p.skill==='athletics'&&p.speciality==='strength')??athletics,athleticsDexterity=packages.find(p=>p.skill==='athletics'&&p.speciality==='dexterity')??athletics;
 const skillEquivalents=manipulators.flatMap(arm=>[
 ...(athleticsStrength?[{skill:'athletics',speciality:'strength',manipulatorId:arm.id,level:athleticsStrength.level+characteristicDM(arm.strength)}]:[]),
 ...(athleticsDexterity?[{skill:'athletics',speciality:'dexterity',manipulatorId:arm.id,level:athleticsDexterity.level+characteristicDM(arm.dexterity)}]:[])
 ]);
 if(p.agility)skillEquivalents.push({skill:'athletics',speciality:'dexterity',source:'agility-enhancement',level:p.agility});
 if(p.powerPacks&&!equipment.powerState.limited)skillEquivalents.push({skill:'athletics',speciality:'endurance',source:'power-packs',level:p.powerPacks});
 const constructionCost=cost;if(s.finalisation.priceMode==='custom'){issue('warning','CUSTOM_LIST_PRICE','finalisation.customPrice','Custom list price changes the sale price, not construction accounting.','76');cost=s.finalisation.customPrice;}
 const totals={...(body?.augmentation?{augmentation:body.augmentation}:{}),fabricationCapabilities:fabricationCapabilities(options),equipmentCapabilities:equipmentCapabilities(options,{techLevel:tl,primary:primary.id,tacticalSpeed,operations:equipmentOperations,brainFamily:brain.family}),equipmentOperations,...(droneLink?{drone:droneLink.drone}:{}),weapons:weaponResult.weapons,ammunitionStorage:weaponResult.ammunitionStorage,cost,costLabel:s.finalisation.priceMode==='custom'?'List price':'Construction cost',constructionCost,...(avatarLink?{avatar:avatarLink.avatar}:{}),baseChassisCost:baseCost,basicCost:chassis.cost,slots:{base:baseSlots,capacity,used,remaining:capacity-used},bandwidth:noBrain?null:{inherent:brain.bandwidth,capacity:bandwidthCapacity,used:bwUsed,remaining:bandwidthCapacity-bwUsed},zeroSlot:{allowance:zeroSlotAllowance,used:zeroSlotCount,overflow},zeroBandwidth:{allowance:zeroBWAllowance,used:zeroBW,overflow:Math.max(0,zeroBW-zeroBWAllowance)},hits,armour:(bodyType?0:armour.base)+p.armourAdded-(p.armourRemoved?1:0),endurance:design.kind==='biological'||endurance===null?null:Math.round(endurance),vehicleEndurance:design.kind==='biological'?null:vehicleEndurance,tacticalSpeed,nominalTacticalSpeed,agility:primary.agility+p.agility-equipment.powerState.agilityPenalty,vehicleBand,intelligence,intelligenceDM:characteristicDM(intelligence),defaultSuite:defaultSuite.map(o=>({id:o.id,label:o.label})),manipulators,skills,skillEquivalents,powerState:equipment.powerState,powerProjections:equipment.powerProjections.map(projection=>({...projection,...(projection.deployment?{deployment:{...projection.deployment,panelHits:Math.ceil(hits*.1)}}:{})})),powerModes:equipment.powerModes,toolCaps:equipment.toolCaps,contextualModifiers:equipment.contextualModifiers,hardwareSkills:equipment.hardwareSkills,traits:[...(droneLink?.traits??[]),...(avatarLink?.traits??[]),...(body?.traits??[]),...equipment.traits,...primary.traits.map(t=>vehicleBand&&t.startsWith('Flyer')?'Flyer ('+vehicleBand+')':t),...(secondary?.id!=='none'?secondary?.traits??[]:[]),...(chassis.attackDM<0?[`Small (${chassis.attackDM})`]:chassis.attackDM>0?[`Large (+${chassis.attackDM})`]:[])]};
 return clone({status,diagnostics,verifiedVehicleInstallations:verifiedVehicle.installations,externalVehicleEstimates:externalVehicle.estimates,totals:status==='verified'?totals:null,...(status==='invalid'&&!diagnostics.some(d=>d.severity==='blocker')?{previewTotals:{...totals,provisional:true}}:{}),ledger,coverage:getCoverage()});
}

const EXAMPLES=[{id:'startek',name:'StarTek (Handbook worked example)',description:'Published TL14 example. The explicit Cr200 initial power pack yields Cr697,300; the printed Cr697,100 total omits that pack.',source:source('13-78')},{id:'steward-droid',name:'Steward Droid (Handbook worked example)',description:'Published construction example: Cr39,800 before the book’s discretionary Cr35,000 list price.',source:source('13-77')},{id:'inspection-platform',name:'Inspection platform',description:'An authored TL12 ordinary construction example using implemented rules, not a published catalogue robot.'}];
export function getExamples(){return clone(EXAMPLES);}
export function createExample(id){
 if(id==='startek')return updateDesign(createDesign({techLevel:14}),{name:'StarTek',selections:{locomotion:{primary:'grav',secondary:'walker'},physical:{armourAdded:6,efficiency:true,manipulators:[{id:'base-1',kind:'base',size:'chassis',strengthIncrease:3,dexterityIncrease:0},{id:'base-2',kind:'base',size:'chassis',strengthIncrease:3,dexterityIncrease:0},{id:'arm-3',kind:'additional',size:3,strengthIncrease:0,dexterityIncrease:4}],defaultSuite:['auditory','voder','wireless','transceiver-improved','pris-sensor'],options:['vacuum-environment-protection','starship-engineering-toolkit-advanced','medikit-enhanced','radiation-environment-protection'],weapons:[{id:'wpn-startek',weaponId:'handbook-stunner-12',placement:'arm',manipulatorId:'arm-3',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1}]},brain:{model:'very-advanced-tl14',bandwidthUpgrade:'bw-6',intellectUpgrade:1},skills:{packages:['electronics-all-1','engineer-all-1','mechanic-1','athletics-0','medic-0','explosives-0','gun-combat-0']}}});
 if(id==='steward-droid')return updateDesign(createDesign(),{name:'Steward Droid',selections:{chassis:{size:'size-4'},locomotion:{primary:'walker'},physical:{resiliency:-2,tacticalSpeed:1,options:['olfactory-sensor-improved','autobar-enhanced','autochef-enhanced','medikit-basic','refrigerated-storage-compartment'],optionParameters:{'refrigerated-storage-compartment':{quantity:2}}},skills:{packages:['steward-2','medic-0','flyer-0']},finalisation:{priceMode:'custom',customPrice:35000}}});
 if(id!=='inspection-platform')throw new TypeError('Unknown example.');
 return updateDesign(createDesign(),{name:'Inspection platform',selections:{chassis:{size:'size-4'},physical:{efficiency:true,options:['hostile-environment']},skills:{packages:['admin-0','recon-0']}}});
}
