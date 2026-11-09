import {resolveSkillLevel} from './skill-coverage.mjs';
// Fictional Traveller equipment data and construction accounting; no real-world instructions.
import {assertKeys,integer,clone} from './schema.mjs';
import {CSC_WORN_WEAPONS,evaluateWornWeapon,retainedWearChoices} from './csc-worn-weapons.mjs';
import {characteristicDM} from './characteristics.mjs';
import {CSC_SLUG_WEAPONS} from './csc-slug-weapons.mjs';
import {CSC_ENERGY_WEAPONS} from './csc-energy-weapons.mjs';
import {CSC_HEAVY_WEAPONS} from './csc-heavy-weapons.mjs';
import {CSC_SHIELDS_EXPENDABLE_MELEE_WEAPONS} from './csc-shields-expendable-melee-weapons.mjs';
import {CSC_CONDITIONAL_MELEE_WEAPONS} from './csc-conditional-melee-weapons.mjs';
import {CSC_MELEE_WEAPONS} from './csc-melee-weapons.mjs';
import {CSC_POWERED_MELEE_WEAPONS,resolvePoweredMeleeOperation} from './csc-powered-melee-weapons.mjs';
import {CSC_STANDARD_LAUNCHERS,CSC_DIRECT_PAYLOADS} from './csc-launcher-payloads.mjs';
import {CSC_SPECIAL_ENERGY_WEAPONS} from './csc-special-energy-weapons.mjs';
import {CSC_ADDITIONAL_SLUG_WEAPONS} from './csc-additional-slug-weapons.mjs';
import {CSC_ARCHAIC_WEAPONS} from './csc-archaic-weapons.mjs';
import {estimateCscMagazineMass,cscMagazineVariants,cscMagazineSourceIds,cscInterchangeMagazineProducts,CSC_HIGH_CAPACITY_MAGAZINE_IDS} from './csc-ammunition-storage.mjs';
import {specialisedAmmunitionCategory,specialisedAmmunitionChoices,specialisedAmmunitionAssessment,ammunitionModificationLabel,ammunitionProductIdentity,manufactureDeclaration,transformSpecialisedAmmunition,qualifyModifiedMagazine,recordUsesSpecialisedAmmunition} from './csc-specialised-ammunition.mjs';
import {CSC_WEAPON_ACCESSORIES,cscAccessoryEligibility,evaluateCscAccessories} from './csc-weapon-accessories.mjs';
const book=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const core=pages=>({book:'Core Rulebook Update 2022',edition:'Mongoose 2022',pages});
export const WEAPONS=[
 ['laser-pistol-9','Laser Pistol (TL9)',9,'small',20,'3D',2000,100,1000],
 ['laser-pistol-11','Laser Pistol (TL11)',11,'small',30,'3D+3',3000,100,1200],
 ['stunner-8','Stunner (TL8)',8,'small',5,'2D',500,100,200],
 ['stunner-10','Stunner (TL10)',10,'small',5,'2D+3',750,100,200],
 ['stunner-12','Stunner (TL12, Core)',12,'small',10,'3D',1000,100,200],
 ['laser-carbine-9','Laser Carbine (TL9)',9,'medium',150,'4D',2500,50,1000],
 ['laser-carbine-11','Laser Carbine (TL11)',11,'medium',200,'4D+3',4000,50,3000],
 ['laser-rifle-9','Laser Rifle (TL9)',9,'medium',200,'5D',3500,100,1500],
 ['laser-rifle-11','Laser Rifle (TL11)',11,'medium',400,'5D+3',8000,100,3500],
 ['laser-sniper-12','Laser Sniper Rifle',12,'medium',600,'5D+3',9000,6,250],
 ['plasma-rifle-16','Plasma Rifle',16,'medium',300,'6D',100000,null,0]
].map(([id,label,tl,mountClass,range,damage,cost,magazine,magazineCost])=>({id,label,tl,mountClass,range,damage,cost,magazine,magazineCost,initialIncluded:true,skill:'gun-combat',speciality:'energy',traits:id.startsWith('stunner')?['Stun','Zero-G']:id.startsWith('plasma')?[]:id.startsWith('laser-sniper')?['Scope','Zero-G']:['Zero-G'],source:core('129'),implemented:true}));
WEAPONS.push({...WEAPONS.find(w=>w.id==='stunner-12'),id:'handbook-stunner-12',label:'Stunner (Handbook example)',initialIncluded:false,source:book('64'),interpretation:'The Handbook worked example charges Cr200 for its initial power pack; Core p129 includes a pack. This entry follows the explicitly selected Handbook example.'});
WEAPONS.push(...[
 ['antique-pistol','Antique Pistol',2,'small',5,'2D-3',100,1,5,[]],
 ['autopistol','Autopistol',5,'small',10,'3D-3',200,15,10,[]],
 ['body-pistol','Body Pistol',8,'small',5,'2D',500,6,10,[]],
 ['gauss-pistol','Gauss Pistol',13,'small',20,'3D',500,40,20,['AP 3','Auto 2']],
 ['revolver','Revolver',4,'small',10,'3D-3',150,6,5,[]],
 ['snub-pistol','Snub Pistol',8,'small',5,'3D-3',150,6,10,['Zero-G']],
 ['accelerator-rifle','Accelerator Rifle',9,'medium',250,'3D',900,15,30,['Zero-G']],
 ['advanced-combat-rifle','Advanced Combat Rifle',10,'medium',450,'3D',1000,40,15,['Auto 3','Scope']],
 ['antique-rifle','Antique Rifle',2,'medium',25,'3D-3',150,1,10,[]],
 ['assault-rifle','Assault Rifle',7,'medium',200,'3D',500,30,15,['Auto 2']],
 ['autorifle','Autorifle',6,'medium',300,'3D',750,20,10,['Auto 2']],
 ['gauss-rifle','Gauss Rifle',12,'medium',600,'4D',1500,80,40,['AP 5','Auto 3','Scope']],
 ['rifle','Rifle',5,'medium',250,'3D',200,5,10,[]],
 ['shotgun','Shotgun',4,'medium',50,'4D',200,6,10,['Bulky']],
 ['submachine-gun','Submachine Gun',6,'medium',25,'3D',400,20,10,['Auto 3']]
].map(([id,label,tl,mountClass,range,damage,cost,magazine,magazineCost,traits])=>({id,label,tl,mountClass,range,damage,cost,magazine,magazineCost,traits,initialIncluded:false,skill:'gun-combat',speciality:'slug',source:core('126-127'),implemented:true,...(id==='advanced-combat-rifle'?{interpretation:'The integral grenade launcher is not included in this attack record; grenade ammunition and its separate attack profile require a separate supported record.'}:{}),...(id.startsWith('antique')?{interpretation:'Ordinary antique weapons impose DM-1 and have special reload checks; attack resolution must apply those conditions.'}:{})})));
const grenadeEffects={aerosol:{laserDamageReduction:10,laserCommunicationsBlocked:true,normalVisionObscured:false,duration:'1D x 3 rounds',condition:'Laser attacks or laser communications passing through the cloud; strong wind or rain can disperse it sooner.'},smoke:{attackDM:-2,infraredVisionBypasses:true,duration:'1D x 3 rounds',condition:'Attacks against targets within the smoke cloud; infrared vision bypasses the smoke penalty. Strong wind or rain can disperse it sooner.'}};
export const GRENADES=[['aerosol','Aerosol',9,null,15,['Blast 9']],['frag','Fragmentation',6,'5D',30,['Blast 9']],['smoke','Smoke',6,null,15,['Blast 9']],['stun','Stun',7,'3D',30,['Blast 9','Stun']]].map(([id,label,tl,damage,cost,traits])=>({id,label,tl,damage,cost,traits,...(grenadeEffects[id]?{conditionalEffects:{...grenadeEffects[id],source:core('131')}}:{}),source:core('131')}));
WEAPONS.push(...[
 ['fghp-14','FGHP-14',14,450,'2DD',100000,null,0,['Radiation','Very Bulky']],
 ['fghp-15','FGHP-15',15,450,'2DD',400000,null,0,['Bulky','Radiation']],
 ['fghp-16','FGHP-16',16,450,'2DD',500000,null,0,['Radiation']],
 ['machinegun','Machinegun',6,500,'3D',1500,60,100,['Auto 4']],
 ['pghp-12','PGHP-12',12,250,'1DD',20000,null,0,['Very Bulky']],
 ['pghp-13','PGHP-13',13,450,'1DD',65000,null,0,['Bulky']],
 ['pghp-14','PGHP-14',14,450,'1DD',100000,null,0,[]],
 ['rocket-launcher-6','Rocket Launcher (TL6)',6,120,'4D',2000,1,300,['Blast 6']],
 ['rocket-launcher-7','Rocket Launcher (TL7)',7,150,'4D+3',2000,1,400,['Blast 6','Smart']],
 ['rocket-launcher-8','Rocket Launcher (TL8)',8,200,'5D',2000,2,600,['Blast 6','Scope','Smart']],
 ['rocket-launcher-9','Rocket Launcher (TL9)',9,250,'5D+6',2000,2,800,['Blast 6','Scope','Smart']],
 ['grenade-launcher','Grenade Launcher',7,100,null,400,6,null,['Bulky']],
 ['ram-grenade-launcher','RAM Grenade Launcher',8,250,null,800,6,null,['Auto 3','Bulky']]
].map(([id,label,tl,range,damage,cost,magazine,magazineCost,traits])=>({id,label,tl,range,damage,cost,magazine,magazineCost,traits,mountClass:'heavy',initialIncluded:magazine===null,skill:'heavy-weapons',speciality:'portable',grenade:magazineCost===null,source:core('132'),implemented:true})));
WEAPONS.push(...[
 ['blade','Blade',2,'small','2D',100,'blade',[]],
 ['broadsword','Broadsword',2,'medium','4D',500,'blade',['Bulky']],
 ['cutlass','Cutlass',2,'small','3D',200,'blade',[]],
 ['dagger','Dagger',1,'small','1D+2',10,'blade',[]],
 ['rapier','Rapier',3,'small','2D',200,'blade',[]],
 ['shield','Shield',1,'small','1D',150,'bludgeon',[]],
 ['stunstick','Stunstick',8,'small','2D',300,'bludgeon',['Stun']]
].map(([id,label,tl,mountClass,damage,cost,speciality,traits])=>({id,label,tl,mountClass,damage,cost,speciality,traits,range:'Melee',magazine:null,magazineCost:0,initialIncluded:true,skill:'melee',...(id==='broadsword'?{requiresTwoHands:true,handednessSource:core('125')}:{}),source:core('124-125'),implemented:true})));
WEAPONS.push(...[['heavy-machinegun','Heavy Machinegun',6,1000,'4D',4500,100,400,100,['Auto 3']],['light-autocannon','Light Autocannon',6,1000,'6D',10000,500,1000,250,['Auto 3']]].map(([id,label,tl,range,damage,cost,magazine,magazineCost,massKg,traits])=>({id,label,tl,range,damage,cost,magazine,magazineCost,massKg,traits,mountClass:'vehicle',initialIncluded:false,skill:'heavy-weapons',speciality:'vehicle',source:core('142'),implemented:true})));
export const WEAPON_ACCESSORIES=[
 ['gyrostabiliser','Gyrostabiliser',9,500,'gyrostabiliser'],['intelligent-0','Intelligent weapon Computer/0',11,1000,'intelligent'],['intelligent-1','Intelligent weapon Computer/1',13,5000,'intelligent'],
 ['laser-sight-8','Laser sight',8,200,'laser-sight'],['laser-sight-10','Ultraviolet laser sight',10,200,'laser-sight'],['scope-5','Telescopic scope',5,50,'scope'],['scope-7','Low-light scope',7,50,'scope'],['secure','Secure weapon',10,250,'secure'],['suppressor','Suppressor',8,250,'suppressor']
].map(([id,label,tl,cost,family])=>({id,label,tl,cost,family,sourceFamily:'core-2022',source:core('135')}));
WEAPON_ACCESSORIES.push(...clone(CSC_WEAPON_ACCESSORIES));
WEAPONS.push(...[['handbook-stun-rifle','Stun Rifle',12,50,'3D',2000,['Stun','Zero-G']],['handbook-stun-shotgun','Stun Shotgun',12,10,'3D',2000,['Blast 5','Stun','Zero-G']],['handbook-pulse-carbine','Pulse Carbine',11,50,'2D',5000,['Blast 5','Ion','Zero-G']]].map(([id,label,tl,range,damage,cost,traits])=>({id,label,tl,range,damage,cost,traits,mountClass:'medium',magazine:50,magazineCost:200,initialIncluded:false,skill:'gun-combat',speciality:'energy',source:book('107'),implemented:true,interpretation:'Initial power-pack purchase is recorded separately at the printed Cr200 rate. Special electromagnetic effects and range-specific bonuses are not applied as universal attack modifiers.'})));
export const RIFLE_WEAPON_IDS=['accelerator-rifle','advanced-combat-rifle','antique-rifle','assault-rifle','autorifle','gauss-rifle','rifle','shotgun','submachine-gun','laser-carbine-9','laser-carbine-11','laser-rifle-9','laser-rifle-11','laser-sniper-12','plasma-rifle-16'];
// Directly carried or mounted fictional game payloads; no launcher or operating procedure implied.
WEAPONS.push(...GRENADES.map(g=>({id:'direct-grenade-'+g.id,label:g.label+' grenade (direct payload)',tl:g.tl,massKg:.5,mountClass:'small',range:null,thrownRange:20,conditionalEffects:g.conditionalEffects??null,damage:g.damage,cost:g.cost,traits:g.traits,magazine:null,magazineCost:0,initialIncluded:true,skill:'athletics',speciality:'dexterity',directPayload:true,implemented:true,source:core('131')})));
WEAPONS.push({id:'direct-pocket-nuke',label:'Pocket nuke (fictional direct payload)',tl:12,massKg:4,mountClass:'medium',range:null,damage:'6DD',cost:250000,traits:['Blast 1000','Radiation'],magazine:null,magazineCost:0,initialIncluded:true,skill:'explosives',directPayload:true,implemented:true,source:core('134'),interpretation:'Fictional game item. Source setting law severely restricts it; this construction record does not determine legality or resolve explosive effects.'});
// Weapon families are source categories, never a mass or mount-size heuristic.
// Retain legacy Core accessory/launcher rules without extending them to CSC rows.
const LEGACY_PISTOLS=['laser-pistol-9','laser-pistol-11','stunner-8','stunner-10','stunner-12','handbook-stunner-12','antique-pistol','autopistol','body-pistol','gauss-pistol','revolver','snub-pistol'];
const HANDBOOK_RIFLES=['handbook-stun-rifle','handbook-stun-shotgun','handbook-pulse-carbine'];
for(const w of WEAPONS){
 w.sourceFamily=w.source.book==='Robot Handbook'?'robot-handbook-2022':'core-2022';
 w.weaponFamily=w.directPayload?'payload':w.skill==='melee'?'melee':w.skill==='heavy-weapons'?'heavy-'+w.speciality:RIFLE_WEAPON_IDS.includes(w.id)||HANDBOOK_RIFLES.includes(w.id)?'rifle':LEGACY_PISTOLS.includes(w.id)?'pistol':null;
 if(!w.weaponFamily)throw new TypeError('Weapon requires an explicit source family: '+w.id);
 w.compatibility={accessoryRules:'core-2022',associatedLauncherRules:'core-2022',attachedLauncher:RIFLE_WEAPON_IDS.includes(w.id),specialisedAmmunitionRules:null};
}
WEAPONS.push(...clone(CSC_SLUG_WEAPONS),...clone(CSC_ENERGY_WEAPONS),...clone(CSC_HEAVY_WEAPONS),...clone(CSC_MELEE_WEAPONS),...clone(CSC_CONDITIONAL_MELEE_WEAPONS),...clone(CSC_SHIELDS_EXPENDABLE_MELEE_WEAPONS),...clone(CSC_POWERED_MELEE_WEAPONS),...clone(CSC_STANDARD_LAUNCHERS),...clone(CSC_DIRECT_PAYLOADS),...clone(CSC_SPECIAL_ENERGY_WEAPONS),...clone(CSC_ADDITIONAL_SLUG_WEAPONS),...clone(CSC_ARCHAIC_WEAPONS));
WEAPONS.push(...CSC_WORN_WEAPONS);
for(const weapon of WEAPONS)if(specialisedAmmunitionCategory(weapon))weapon.compatibility.specialisedAmmunitionRules='csc-single-modification-v1';
export const MOUNTS={small:{slots:1,cost:500,armSize:3},medium:{slots:2,cost:1000,armSize:5},heavy:{slots:10,cost:5000,armSize:7},vehicle:{slots:15,cost:10000,armSize:null}};
export const FIRE_CONTROL=[{id:'none',label:'No fire control',tl:0,cost:0,dm:0},...['Basic','Improved','Enhanced','Advanced'].map((label,i)=>({id:label.toLowerCase(),label,tl:6+i*2,cost:[10000,25000,50000,100000][i],dm:i+1}))];
const STORAGE_IDS=['storage-compartment','refrigerated-storage-compartment','hazardous-material-storage-compartment'];
const storageKey=storage=>storage.instanceId?'instance:'+storage.instanceId:'option:'+storage.id;
const massPrecision=kg=>Math.round(kg*1e9)/1e9;
function storageChoices(design){const p=design?.selections?.physical,labels={'storage-compartment':'Storage Compartment','refrigerated-storage-compartment':'Refrigerated Storage Compartment','hazardous-material-storage-compartment':'Hazardous Material Storage Compartment'};return[{id:'none',label:'No storage assigned'},...(p?.options??[]).filter(id=>STORAGE_IDS.includes(id)).map(id=>({id:'option:'+id,label:labels[id]+' (standard selection)'})),...(p?.optionInstances??[]).filter(o=>STORAGE_IDS.includes(o.optionId)).map((o,index)=>({id:'instance:'+o.id,label:labels[o.optionId]+' '+(index+1)}))];}
const retainedChoice=(field,defaultValue,normal)=>({anyOf:[{field,notEquals:defaultValue},normal]});
const noMeleeAmmunition=weapon=>weapon?.weaponFamily==='melee'&&weapon.magazine===null&&!weapon.poweredMelee&&!weapon.expendableMelee;
const supportsSecondGrip=weapon=>Boolean(weapon.requiresTwoHands||weapon.handedness?.alternateTwoHandedUse);
const manipulatorLabel=(arm,index)=>`${arm.kind==='base'?'Base arm':arm.kind==='leg'?'Converted leg':'Additional arm'} ${index+1}`;
function manipulatorChoices(design,field){
 const physical=design?.selections?.physical,arms=physical?.manipulators??[];
 const choices=[{id:'none',label:'None'},...arms.map((arm,index)=>({id:arm.id,label:manipulatorLabel(arm,index)}))];
 for(const record of physical?.weapons??[]){const id=record[field];if(id&&id!=='none'&&!choices.some(choice=>choice.id===id))choices.push({id,label:'Unavailable manipulator',eligibility:{available:false,reason:'Select an installed manipulator'}});}
 return choices;
}
const characteristic=value=>Number.isInteger(value)?characteristicDM(value):null;
// Occupancy concerns this configured held loadout, not ownership or stowed inventory.
// An attached mount alone does not reserve a gripping hand.
function heldOccupancy(records,manipulators){
 const occupancy=new Map();
 for(const record of records.filter(record=>record.placement==='held'))for(const id of new Set([record.manipulatorId,record.supportManipulatorId])){
  if(id&&id!=='none'&&manipulators.some(arm=>arm.id===id)){if(!occupancy.has(id))occupancy.set(id,new Set());occupancy.get(id).add(record.id);}
 }
 return occupancy;
}
function heldGripProfile(record,weapon,manipulators,occupancy){
 const held=record.placement==='held',primary=manipulators.find(arm=>arm.id===record.manipulatorId),supportId=record.supportManipulatorId??'none',hasSupport=supportId!=='none',support=manipulators.find(arm=>arm.id===supportId);
 const gripManipulatorIds=held?[...new Set([record.manipulatorId,...(hasSupport?[supportId]:[])].filter(id=>id&&id!=='none'))]:[];
 const conflicting=held&&gripManipulatorIds.some(id=>(occupancy.get(id)?.size??0)>1);
 const gripAssignmentStatus=!held?(hasSupport?'non-held-support':'not-applicable'):conflicting?'conflicting':!primary?'missing-primary':weapon.requiresTwoHands&&!hasSupport?'missing-support':hasSupport&&!support?'missing-support':hasSupport&&supportId===record.manipulatorId?'same-manipulator':hasSupport&&!supportsSecondGrip(weapon)?'unsupported-support':'assigned';
 const multiArm=held&&(weapon.requiresTwoHands||hasSupport),resolved=gripAssignmentStatus==='assigned';
 const gripManipulators=gripManipulatorIds.map(id=>manipulators.find(arm=>arm.id===id)).filter(Boolean).map(arm=>({manipulatorId:arm.id,size:arm.size,strength:arm.strength??null,dexterity:arm.dexterity??null,strengthDM:characteristic(arm.strength),dexterityDM:characteristic(arm.dexterity)}));
 const source=weapon.handednessSource??weapon.handedness?.source??weapon.source;
 return {gripManipulatorIds,gripAssignmentStatus,gripManipulators,multiArm,
  handednessBasis:{requiresTwoHands:Boolean(weapon.requiresTwoHands),optionalSecondGrip:Boolean(weapon.handedness?.alternateTwoHandedUse),explicitPrintedHandCount:weapon.handedness?.explicitPrintedHandCount??(supportsSecondGrip(weapon)?true:null),basis:weapon.handedness?.basis??(supportsSecondGrip(weapon)?'explicit-source-configuration':'single-selected-manipulator'),source},
  carryingFit:held?'referee-dependent':'not-applicable',effectiveStrength:held&&resolved&&!multiArm?primary.strength??null:null,effectiveDexterity:held&&resolved&&!multiArm?primary.dexterity??null:null,
  characteristicResolution:held?(multiArm?'referee-dependent':resolved?'selected-manipulator':'grip-unresolved'):'mount-rules',additionalAttacksGranted:false,gripBenefitGranted:false};
}

function accessoryChoices(design,weapon){return WEAPON_ACCESSORIES.filter(a=>!weapon||a.sourceFamily===weapon.compatibility.accessoryRules&&(a.sourceFamily!=='csc-2023'||cscAccessoryEligibility(weapon,a).available)).map(a=>({...clone(a),eligibility:{available:!design||a.tl<=design.techLevel,reason:design&&a.tl>design.techLevel?'Requires TL'+a.tl:null}}));}
// Absent allocation preserves the original all-or-nothing loader interpretation.
// Split quantities are per linked copy. An impossible partition is never clamped.
export function ammunitionPartition(record){
 const alternates=record.alternateMagazineSupplies??[],split=record.autoloadAllocation!==undefined||alternates.length>0,standard=record.extraMagazines??0,high=record.extraHighCapacityMagazines??0;
 const allocated=record.autoloadAllocation??{standard:record.autoload?standard:0,highCapacity:record.autoload?high:0};
 const resolved=allocated.standard<=standard&&allocated.highCapacity<=high&&alternates.every(item=>item.autoloadMagazines<=item.extraMagazines);
 const autoloadCountPerWeapon=allocated.standard+allocated.highCapacity+alternates.reduce((sum,item)=>sum+item.autoloadMagazines,0);
 const storedCountPerWeapon=resolved?standard+high+alternates.reduce((sum,item)=>sum+item.extraMagazines,0)-autoloadCountPerWeapon:null;
 const valid=resolved&&autoloadCountPerWeapon<=10&&(record.autoload||autoloadCountPerWeapon===0)&&storedCountPerWeapon<=100;
 return {mode:split?'split':'legacy',resolved,valid,standard:{type:'standard',totalPerWeapon:standard,autoloadPerWeapon:allocated.standard,storedPerWeapon:resolved?standard-allocated.standard:null},highCapacity:{type:'high-capacity',totalPerWeapon:high,autoloadPerWeapon:allocated.highCapacity,storedPerWeapon:resolved?high-allocated.highCapacity:null},
  ...(alternates.length?{alternates:alternates.map(item=>({sourceWeaponId:item.sourceWeaponId,type:item.variant,totalPerWeapon:item.extraMagazines,autoloadPerWeapon:item.autoloadMagazines,storedPerWeapon:resolved?item.extraMagazines-item.autoloadMagazines:null}))}:{}),
  autoloadCountPerWeapon,storedCountPerWeapon,autoloadMaximumPerWeapon:10,storedApplicationMaximumPerWeapon:100};
}
const MODIFICATION_FIELDS=['initialAmmunitionModification','spareAmmunitionModification','highCapacityAmmunitionModification'];
const OPTIONAL_AMMUNITION_FIELDS=['autoloadAllocation','initialMagazineSourceId','alternateMagazineSupplies',...MODIFICATION_FIELDS];
const AMMUNITION_FIELDS=['initialMagazines','initialMagazineType','extraMagazines','extraHighCapacityMagazines','spareMagazineStorageId','highCapacityMagazineStorageId',...OPTIONAL_AMMUNITION_FIELDS];
function ammunitionSpecification(record){
 return {initialMagazines:record.initialMagazines,initialMagazineType:record.initialMagazineType??'standard',extraMagazines:record.extraMagazines,extraHighCapacityMagazines:record.extraHighCapacityMagazines??0,spareMagazineStorageId:record.spareMagazineStorageId??'none',highCapacityMagazineStorageId:record.highCapacityMagazineStorageId??'none',...Object.fromEntries(OPTIONAL_AMMUNITION_FIELDS.filter(field=>record[field]!==undefined).map(field=>[field,clone(record[field])]))};
}
function legacyMagazineSupplyPresentation(record){
 const weapon=WEAPONS.find(item=>item.id===record.weaponId),products=cscInterchangeMagazineProducts(weapon,WEAPONS),allowed=cscMagazineSourceIds(weapon);
 const retained=[record.initialMagazineSourceId,...(record.alternateMagazineSupplies??[]).map(item=>item.sourceWeaponId)].filter(Boolean);
 return {initialSourceField:'initialMagazineSourceId',alternateSuppliesField:'alternateMagazineSupplies',maximumAlternateProducts:2,numericControls:{extraMagazines:{min:0,max:110,step:1},autoloadMagazines:{min:0,max:110,step:1}},identityFields:['sourceWeaponId','variant'],products,
  initialSourceId:record.initialMagazineSourceId??record.weaponId,
  sources:[...new Set([...allowed,...retained])].map(id=>({id,label:WEAPONS.find(item=>item.id===id)?.label??'Unavailable magazine source',available:id===record.weaponId||allowed.includes(id),alternateAllowed:id!==record.weaponId&&allowed.includes(id)})),
  forceGroupOpen:retained.some(id=>id!==record.weaponId&&!allowed.includes(id))||(record.alternateMagazineSupplies??[]).some(item=>item.sourceWeaponId===record.weaponId)||Boolean(record.alternateMagazineSupplies?.length&&!ammunitionPartition(record).valid),
  scope:'Alternate supplies keep their source magazine identity, purchase price and labelled source-based mass estimate. Own-profile spare fields remain independent. Each copy shares one ten-supply loader limit and one hundred-reserve application bound.'};
}

function magazineSupplyPresentation(record){
 const legacy=legacyMagazineSupplyPresentation(record),weapon=WEAPONS.find(item=>item.id===record.weaponId);
 if(!specialisedAmmunitionCategory(weapon)&&!recordUsesSpecialisedAmmunition(record))return legacy;
 const variants=cscMagazineVariants(weapon),standard={id:'standard',variant:'standard',productId:ammunitionProductIdentity(weapon.id,'standard'),sourceWeaponId:weapon.id,sourceWeaponLabel:weapon.label,sourceFamily:weapon.sourceFamily,capacity:weapon.magazine,unitCost:weapon.magazineCost,estimate:estimateCscMagazineMass(weapon),source:weapon.source};
 const bases=legacy.products.length?legacy.products:[standard,...(variants?[{...variants.highCapacity,variant:'high-capacity',sourceWeaponId:weapon.id,sourceWeaponLabel:weapon.label,sourceFamily:weapon.sourceFamily,productId:ammunitionProductIdentity(weapon.id,'high-capacity')}]:[])];
 const products=bases.flatMap(base=>specialisedAmmunitionChoices(weapon).map(choice=>{
  const modification=choice.id,assessment=specialisedAmmunitionAssessment(weapon,modification,record.weaponManufactureTL,Infinity),product=qualifyModifiedMagazine(base,assessment);
  const ownField=base.id==='high-capacity'?'highCapacityAmmunitionModification':'spareAmmunitionModification';
  return {...product,modification,modificationLabel:ammunitionModificationLabel(modification),alternateAllowed:base.sourceWeaponId!==weapon.id||modification!==(record[ownField]??'standard'),eligibility:{available:assessment.valid},issues:assessment.issues};
 }));
 return {...legacy,products,maximumAlternateProducts:12,identityFields:['sourceWeaponId','variant','modification'],sources:legacy.sources.map(source=>({...source,alternateAllowed:source.id===weapon.id||source.alternateAllowed})),forceGroupOpen:legacy.forceGroupOpen||(record.alternateMagazineSupplies??[]).some(item=>!products.some(product=>product.productId===ammunitionProductIdentity(item.sourceWeaponId,item.variant,item.modification??'standard')&&product.alternateAllowed))};
}

function effectiveAmmunitionRecord(record,copyIndex){
 const override=record.ammunitionOverrides?.find(item=>item.copyIndex===copyIndex),effective={...record};
 delete effective.ammunitionOverrides;
 if(override){for(const field of AMMUNITION_FIELDS)delete effective[field];Object.assign(effective,ammunitionSpecification(override));}
 return effective;
}
export function weaponRecordPresentation(record,copyIndex){
 const original=record,overrides=record.ammunitionOverrides??[];
 record=effectiveAmmunitionRecord(original,copyIndex);
 const weapon=WEAPONS.find(w=>w.id===record.weaponId),noAmmunition=noMeleeAmmunition(weapon);
 const allocation=ammunitionPartition(record),split=allocation.mode==='split',max=split?110:record.autoload?10:100;
 const summary=allocation.resolved?(record.alternateMagazineSupplies?.length?'Receiving-weapon stored remainder per weapon: ':'Stored remainder per weapon: ')+allocation.standard.storedPerWeapon+' standard, '+allocation.highCapacity.storedPerWeapon+' high-capacity':'Stored remainder unresolved: loader allocation exceeds additional supplies';
 const fields={extraMagazines:{max},extraHighCapacityMagazines:{max},autoloadAllocation:{mode:record.autoloadAllocation===undefined?'legacy':'split',materializedValue:{standard:allocation.standard.autoloadPerWeapon,highCapacity:allocation.highCapacity.autoloadPerWeapon},summary,forceGroupOpen:split&&(!allocation.valid||Boolean(record.autoload&&allocation.autoloadCountPerWeapon===0))}};
 if(split){
  const weapon=WEAPONS.find(w=>w.id===record.weaponId);
  fields.spareMagazineStorageId={visible:(record.spareMagazineStorageId??'none')!=='none'||Boolean(weapon&&estimateCscMagazineMass(weapon)&&allocation.standard.storedPerWeapon>0)};
  fields.highCapacityMagazineStorageId={visible:(record.highCapacityMagazineStorageId??'none')!=='none'||Boolean(weapon&&cscMagazineVariants(weapon)&&allocation.highCapacity.storedPerWeapon>0)};
 }
 if(noAmmunition||weapon?.poweredMelee||weapon?.expendableMelee){
  fields.initialMagazines={visible:record.initialMagazines!==1};
  fields.extraMagazines.visible=(record.extraMagazines??0)!==0;
  fields.autoload={visible:record.autoload===true};
  fields.autoloadAllocation.visible=record.autoloadAllocation!==undefined;
 }
 for(const field of MODIFICATION_FIELDS){
  const selected=record[field]??'standard',choices=specialisedAmmunitionChoices(weapon);
  if(!choices.some(choice=>choice.id===selected))choices.push({id:selected,label:ammunitionModificationLabel(selected),eligibility:{available:false}});
  fields[field]={visible:Boolean(specialisedAmmunitionCategory(weapon))&&(field!=='highCapacityAmmunitionModification'||Boolean(cscMagazineVariants(weapon)))||selected!=='standard',choices};
 }
 fields.weaponManufactureTL={visible:Boolean(specialisedAmmunitionCategory(weapon))||original.weaponManufactureTL!=null};
 const retainedCopyIndices=overrides.filter(item=>item.copyIndex>original.linkedWeapons).map(item=>item.copyIndex);
 const choices=[...new Set([...Array.from({length:original.linkedWeapons},(_,i)=>i+1),...retainedCopyIndices])].sort((a,b)=>a-b).map(index=>{const customized=overrides.some(item=>item.copyIndex===index),installed=index<=original.linkedWeapons;return {id:index,label:'Copy '+index+(customized?' · Customized':' · Shared')+(installed?'':' · Not installed'),installed,customized};});
 const invalidCopy=overrides.some(item=>{const effective=effectiveAmmunitionRecord(original,item.copyIndex),partition=ammunitionPartition(effective);return !partition.valid||Boolean(original.autoload&&!partition.autoloadCountPerWeapon)||magazineSupplyPresentation(effective).forceGroupOpen;});
 if(weapon?.wearable||record.placement==='worn'){
  const retained=retainedWearChoices(record);
  for(const field of [...MODIFICATION_FIELDS,'weaponManufactureTL','linkedWeapons','fireControl','supportManipulatorId','autoload','autoloadAllocation','initialMagazines','extraMagazines','extraHighCapacityMagazines','initialMagazineType','ammunition','accessories','extraFofTags','auxiliaryLauncher','auxiliaryAmmunition','auxiliaryLoaded','integralAmmunition','integralLoaded','looseGrenades','looseAmmunitionFor','ammunitionStorageId','spareMagazineStorageId','highCapacityMagazineStorageId'])fields[field]={...fields[field],visible:Object.hasOwn(retained,field)};
 }
 return clone({fields,...((weapon?.wearable||record.placement==='worn')&&copyIndex==null?{wearMetadataRemovals:['ammunitionOverrides','initialMagazineSourceId','alternateMagazineSupplies',...MODIFICATION_FIELDS,'weaponManufactureTL'].filter(field=>Object.hasOwn(retainedWearChoices(original),field))}:{}),magazineSupplySelection:magazineSupplyPresentation(record),ammunitionCustomization:(noAmmunition||weapon?.poweredMelee||weapon?.expendableMelee)&&!overrides.length?null:{field:'ammunitionOverrides',label:'Linked ammunition',mode:overrides.length?'custom':'shared',choices,fields:AMMUNITION_FIELDS,selectedCopyIndex:copyIndex??null,materializedValue:ammunitionSpecification(record),effectiveRecord:record,overridden:overrides.some(item=>item.copyIndex===copyIndex),retainedCopyIndices,forceGroupOpen:Boolean(retainedCopyIndices.length||invalidCopy||weapon?.poweredMelee||weapon?.expendableMelee)}});
}
export function weaponControl(design){return {field:'weapons',label:'Installed weapons',category:'Weapons',type:'weapons',maxItems:100,addLabel:'Add weapon',description:'Source-defined weapons, mounts and ammunition. The current weapon catalogue is incomplete; other weapons are not certified.',itemFields:[
 {field:'weaponId',label:'Weapon',type:'select',default:'handbook-stunner-12',choices:WEAPONS.map(w=>({...clone(w),...(cscMagazineVariants(w)?{magazineVariants:cscMagazineVariants(w)}:{}),...(cscMagazineSourceIds(w).length?{magazineProducts:cscInterchangeMagazineProducts(w,WEAPONS)}:{}),eligibility:{available:!design||w.tl<=design.techLevel,reason:design&&w.tl>design.techLevel?'Requires TL'+w.tl:null}}))},
 {field:'placement',label:'Placement',type:'select',default:'body',choices:[{id:'body',label:'Body mount'},{id:'arm',label:'Manipulator mount'},{id:'held',label:'Held in manipulator'},{id:'worn',label:'External wear'}],choicesBy:{field:'weaponId',values:Object.fromEntries(WEAPONS.map(w=>[w.id,w.wearable?[{id:'worn',label:'External wear'}]:[{id:'body',label:'Body mount'},{id:'arm',label:'Manipulator mount'},{id:'held',label:'Held in manipulator'}]]))}},
 {field:'manipulatorId',resetWhenHidden:true,label:'Manipulator',type:'select',default:'none',choices:manipulatorChoices(design,'manipulatorId'),choicesBy:{field:'placement',values:{worn:manipulatorChoices(design,'manipulatorId').filter(choice=>choice.id==='none'||!(design?.selections?.physical?.manipulators??[]).some(arm=>arm.id===choice.id&&arm.kind==='leg'))}},visibleWhen:{anyOf:[{field:'placement',oneOf:['arm','held','worn']},{field:'weaponId',oneOf:CSC_WORN_WEAPONS.map(w=>w.id)}]}},
 {field:'wearSite',label:'Wear site',type:'select',default:'unresolved',omitByDefault:true,choices:[{id:'unresolved',label:'Unselected'},{id:'hand',label:'Hand'},{id:'forearm',label:'Forearm'}],choicesBy:{field:'weaponId',values:Object.fromEntries(WEAPONS.filter(w=>w.wearable).map(w=>[w.id,[{id:'unresolved',label:'Unselected'},...w.wearable.sites.map(id=>({id,label:id==='hand'?'Hand':'Forearm'}))]]))},visibleWhen:retainedChoice('wearSite','unresolved',{field:'placement',equals:'worn'})},
 {field:'supportManipulatorId',label:'Support manipulator',type:'select',default:'none',omitByDefault:true,choices:manipulatorChoices(design,'supportManipulatorId'),visibleWhen:retainedChoice('supportManipulatorId','none',{allOf:[{field:'placement',equals:'held'},{field:'weaponId',oneOf:WEAPONS.filter(supportsSecondGrip).map(weapon=>weapon.id)}]})},
 {field:'linkedWeapons',label:'Linked weapons',type:'number',min:1,max:4,default:1,visibleWhen:retainedChoice('linkedWeapons',1,{field:'placement',oneOf:['body','arm']})},
 {field:'fireControl',label:'Fire control',type:'select',default:'none',choices:FIRE_CONTROL.map(f=>({...f,eligibility:{available:!design||f.tl<=design.techLevel,reason:design&&f.tl>design.techLevel?'Requires TL'+f.tl:null}}))},
 {field:'autoload',label:'Autoloader',type:'select',default:false,choices:[{id:false,label:'None'},{id:true,label:'Installed'}],visibleWhen:retainedChoice('autoload',false,{field:'placement',oneOf:['body','arm']})},
 {field:'ammunitionOverrides',label:'Linked ammunition',type:'ammunition-overrides',omitByDefault:true,maxItems:4,collapsedByDefault:true},
 {field:'autoloadAllocation',label:'Allocation mode',type:'optional-object',omitByDefault:true,group:'Ammunition allocation',collapsedByDefault:true,absentMode:'legacy',presentMode:'split',choices:[{id:'legacy',label:'All extras follow loader setting'},{id:'split',label:'Split loader and storage'}],itemFields:[{field:'standard',label:'Standard loader supplies per weapon',type:'number',min:0,max:10},{field:'highCapacity',label:'High-capacity loader supplies per weapon',type:'number',min:0,max:10}],limitScope:'Ten additional magazines or power packs per loader is a source limit. One hundred stored reserves per weapon is an application bound.'},
 {field:'extraMagazines',label:'Standard spares per weapon',type:'number',min:0,max:100,maxBy:{field:'autoload',values:{true:10,false:100}},default:0,limitScope:'The non-autoloaded maximum of 100 is an application bound, not a source limit.'},
 {field:'spareMagazineStorageId',label:'Standard spare storage (estimated)',type:'select',default:'none',choices:storageChoices(design),visibleWhen:retainedChoice('spareMagazineStorageId','none',{allOf:[{field:'weaponId',oneOf:WEAPONS.filter(w=>estimateCscMagazineMass(w)).map(w=>w.id)},{field:'autoload',equals:false},{field:'extraMagazines',notEquals:0}]})},
 {field:'extraHighCapacityMagazines',label:'High-capacity spares per weapon',type:'number',min:0,max:100,maxBy:{field:'autoload',values:{true:10,false:100}},default:0,limitScope:'Combined standard and high-capacity spares: ten per autoloader; otherwise one hundred is an application bound.',visibleWhen:retainedChoice('extraHighCapacityMagazines',0,{field:'weaponId',oneOf:[...CSC_HIGH_CAPACITY_MAGAZINE_IDS]})},
 {field:'highCapacityMagazineStorageId',label:'High-capacity spare storage (estimated)',type:'select',default:'none',choices:storageChoices(design),visibleWhen:retainedChoice('highCapacityMagazineStorageId','none',{allOf:[{field:'weaponId',oneOf:[...CSC_HIGH_CAPACITY_MAGAZINE_IDS]},{field:'autoload',equals:false},{field:'extraHighCapacityMagazines',notEquals:0}]})},
 {field:'accessories',label:'Weapon accessories',type:'multiselect',default:[],maxItems:WEAPON_ACCESSORIES.length,choices:accessoryChoices(design),choicesBy:{field:'weaponId',values:Object.fromEntries(WEAPONS.map(w=>[w.id,accessoryChoices(design,w)]))}},
 {field:'extraFofTags',label:'Extra FOF tags (installation total)',type:'number',min:0,max:100,default:0,limitScope:'Application quantity bound; not multiplied by linked weapons and retained when the safety is removed.',visibleWhen:{field:'weaponId',oneOf:WEAPONS.filter(w=>w.compatibility.accessoryRules==='csc-2023').map(w=>w.id)}},
 {field:'ammunition',resetWhenHidden:true,label:'Grenade ammunition',type:'select',default:'standard',choices:[{id:'standard',label:'Select ammunition'},...GRENADES.map(g=>({...g,eligibility:{available:!design||g.tl<=design.techLevel,reason:design&&g.tl>design.techLevel?'Requires TL'+g.tl:null}}))],visibleWhen:{field:'weaponId',oneOf:['grenade-launcher','ram-grenade-launcher']}},
 {field:'auxiliaryLauncher',group:'Associated launcher',label:'Associated grenade launcher',type:'select',default:'none',choices:[{id:'none',label:'No secondary attack configured'},{id:'attached',label:'Attached launcher (TL7, Cr1000)',eligibility:{available:!design||design.techLevel>=7,reason:design&&design.techLevel<7?'Requires TL7':null}},{id:'integral-acr',label:'Included Advanced Combat Rifle launcher'},{id:'both-acr',label:'ACR included and attached launchers'}]},
 {field:'auxiliaryAmmunition',group:'Associated launcher',resetWhenHidden:true,label:'Associated launcher grenade',type:'select',default:'standard',choices:[{id:'standard',label:'Select ammunition'},...GRENADES.map(g=>({...g,eligibility:{available:!design||g.tl<=design.techLevel,reason:design&&g.tl>design.techLevel?'Requires TL'+g.tl:null}}))],visibleWhen:{field:'auxiliaryLauncher',group:'Associated launcher',oneOf:['attached','integral-acr','both-acr']}},
 {field:'auxiliaryLoaded',group:'Associated launcher',resetWhenHidden:true,label:'Associated launcher loaded grenade',type:'select',default:0,choices:[{id:0,label:'Empty'},{id:1,label:'One grenade'}],visibleWhen:{field:'auxiliaryLauncher',group:'Associated launcher',oneOf:['attached','integral-acr','both-acr']}},
 {field:'integralAmmunition',group:'Associated launcher',resetWhenHidden:true,label:'Included ACR grenade',type:'select',default:'standard',choices:[{id:'standard',label:'Select ammunition'},...GRENADES.map(g=>({...g,eligibility:{available:!design||g.tl<=design.techLevel,reason:design&&g.tl>design.techLevel?'Requires TL'+g.tl:null}}))],visibleWhen:{field:'auxiliaryLauncher',equals:'both-acr'}},
 {field:'integralLoaded',group:'Associated launcher',resetWhenHidden:true,label:'Included ACR loaded grenade',type:'select',default:0,choices:[{id:0,label:'Empty'},{id:1,label:'One grenade'}],visibleWhen:{field:'auxiliaryLauncher',equals:'both-acr'}},
 {field:'looseGrenades',group:'Loose ammunition storage',label:'Loose grenade rounds (not magazines)',type:'number',min:0,max:100,default:0},
 {field:'looseAmmunitionFor',group:'Loose ammunition storage',label:'Loose rounds for',type:'select',default:'primary',choices:[{id:'primary',label:'Primary grenade launcher'},{id:'auxiliary',label:'Associated grenade launcher'},{id:'integral',label:'Included ACR launcher (both mode)'}]},
 {field:'ammunitionStorageId',group:'Loose ammunition storage',label:'Loose round storage',type:'select',default:'none',choices:storageChoices(design)},
 {field:'initialMagazineType',label:'Initial magazine type',type:'select',default:'standard',choices:[{id:'standard',label:'Standard'},{id:'high-capacity',label:'High-capacity (TL4)',eligibility:{available:!design||design.techLevel>=4,reason:design&&design.techLevel<4?'Requires TL4':null}}],visibleWhen:retainedChoice('initialMagazineType','standard',{field:'weaponId',oneOf:[...CSC_HIGH_CAPACITY_MAGAZINE_IDS]})},
  {field:'weaponManufactureTL',label:'Declared manufacture TL (all linked copies)',type:'select',default:null,omitByDefault:true,choices:[{id:null,label:'Unknown'},...Array.from({length:31},(_,id)=>({id,label:'TL'+id}))]},
  ...MODIFICATION_FIELDS.map((field,index)=>({field,label:['Initial ammunition modification','Standard spare ammunition modification','High-capacity spare ammunition modification'][index],type:'select',default:'standard',omitByDefault:true,choices:[{id:'standard',label:'Standard'}]})),
  {field:'initialMagazines',label:'Initial magazine per weapon',type:'select',default:1,choices:[{id:0,label:'None'},{id:1,label:'One'}]}
 ],source:book('61-64')};}
export function validateWeapons(records){
 if(!Array.isArray(records)||records.length>100)throw new TypeError('Expected up to 100 weapon records.');const ids=new Set();
 for(const w of records){assertKeys(w,['id','weaponId','placement','wearSite','manipulatorId','supportManipulatorId','linkedWeapons','fireControl','autoload','extraMagazines','initialMagazines','ammunition','accessories','extraFofTags','auxiliaryLauncher','auxiliaryAmmunition','auxiliaryLoaded','integralAmmunition','integralLoaded','looseGrenades','looseAmmunitionFor','ammunitionStorageId','spareMagazineStorageId','initialMagazineType','extraHighCapacityMagazines','highCapacityMagazineStorageId','autoloadAllocation','ammunitionOverrides','initialMagazineSourceId','alternateMagazineSupplies','weaponManufactureTL',...MODIFICATION_FIELDS],'physical.weapons');
 if(typeof w.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(w.id)||ids.has(w.id))throw new TypeError('Invalid or duplicate weapon ID.');ids.add(w.id);
 if(!WEAPONS.some(v=>v.id===w.weaponId)||!['body','arm','held','worn'].includes(w.placement)||!FIRE_CONTROL.some(v=>v.id===w.fireControl)||typeof w.autoload!=='boolean'||typeof w.manipulatorId!=='string'||w.manipulatorId.length>40)throw new TypeError('Invalid weapon configuration.');
 if(w.wearSite!==undefined&&(typeof w.wearSite!=='string'||!/^[-a-z0-9]{1,60}$/.test(w.wearSite)))throw new TypeError('Invalid wear site.');
  if(w.weaponManufactureTL!=null)integer(w.weaponManufactureTL,0,30,'weaponManufactureTL');
  for(const field of MODIFICATION_FIELDS)if(w[field]!==undefined&&(typeof w[field]!=='string'||!/^[-a-z0-9]{1,80}$/.test(w[field])))throw new TypeError('Invalid ammunition modification identity.');
  if(w.supportManipulatorId!==undefined&&(typeof w.supportManipulatorId!=='string'||!/^[-a-z0-9]{1,40}$/.test(w.supportManipulatorId)))throw new TypeError('Invalid support manipulator reference.');
 if(w.ammunitionOverrides!==undefined){
  if(!Array.isArray(w.ammunitionOverrides)||w.ammunitionOverrides.length>4)throw new TypeError('Expected up to four ammunition overrides.');
  const copies=new Set();
  for(const override of w.ammunitionOverrides){
   assertKeys(override,['copyIndex',...AMMUNITION_FIELDS],'ammunitionOverrides');integer(override.copyIndex,1,4,'ammunitionOverrides.copyIndex');
   if(copies.has(override.copyIndex))throw new TypeError('Duplicate ammunition override copy index.');copies.add(override.copyIndex);
   for(const field of AMMUNITION_FIELDS.filter(field=>!OPTIONAL_AMMUNITION_FIELDS.includes(field)))if(!Object.hasOwn(override,field)||override[field]===undefined)throw new TypeError('Ammunition overrides require a complete specification: '+field+'.');
   validateWeapons([effectiveAmmunitionRecord(w,override.copyIndex)]);
  }
 }
  if(w.looseGrenades!==undefined)integer(w.looseGrenades,0,100,'looseGrenades');if(w.looseAmmunitionFor!==undefined&&!['primary','auxiliary','integral'].includes(w.looseAmmunitionFor))throw new TypeError('Invalid loose ammunition association');if(w.ammunitionStorageId!==undefined&&(typeof w.ammunitionStorageId!=='string'||w.ammunitionStorageId.length>100))throw new TypeError('Invalid storage reference');
 if(w.initialMagazineType!==undefined&&!['standard','high-capacity'].includes(w.initialMagazineType))throw new TypeError('Invalid initial magazine type.');
 if(w.initialMagazineSourceId!==undefined&&(typeof w.initialMagazineSourceId!=='string'||!/^[-a-z0-9]{1,80}$/.test(w.initialMagazineSourceId)))throw new TypeError('Invalid initial magazine source.');
 if(w.alternateMagazineSupplies!==undefined){
  const maximumProducts=specialisedAmmunitionCategory(WEAPONS.find(item=>item.id===w.weaponId))||recordUsesSpecialisedAmmunition(w)?12:2;
  if(!Array.isArray(w.alternateMagazineSupplies)||w.alternateMagazineSupplies.length>maximumProducts)throw new TypeError('Too many additional magazine products for this inventory scope.');
  const products=new Set();
  for(const item of w.alternateMagazineSupplies){
   assertKeys(item,['sourceWeaponId','variant','modification','extraMagazines','autoloadMagazines','storageId'],'alternateMagazineSupplies');
   if(typeof item.sourceWeaponId!=='string'||!/^[-a-z0-9]{1,80}$/.test(item.sourceWeaponId)||!['standard','high-capacity'].includes(item.variant))throw new TypeError('Invalid alternate magazine identity.');
   if(item.modification!==undefined&&(typeof item.modification!=='string'||!/^[-a-z0-9]{1,80}$/.test(item.modification)))throw new TypeError('Invalid ammunition modification identity.');
   const key=ammunitionProductIdentity(item.sourceWeaponId,item.variant,item.modification??'standard');if(products.has(key))throw new TypeError('Duplicate alternate magazine product.');products.add(key);
   integer(item.extraMagazines,0,110,'alternateMagazineSupplies.extraMagazines');integer(item.autoloadMagazines,0,110,'alternateMagazineSupplies.autoloadMagazines');
   if(typeof item.storageId!=='string'||!/^(?:none|(?:option|instance):[-a-z0-9]{1,80})$/.test(item.storageId))throw new TypeError('Invalid alternate magazine storage reference.');
  }
 }
 const split=w.autoloadAllocation!==undefined||(w.alternateMagazineSupplies?.length??0)>0,maxExtra=split?110:w.autoload?10:100;
 if(w.autoloadAllocation!==undefined){assertKeys(w.autoloadAllocation,['standard','highCapacity'],'autoloadAllocation');integer(w.autoloadAllocation.standard,0,110,'autoloadAllocation.standard');integer(w.autoloadAllocation.highCapacity,0,110,'autoloadAllocation.highCapacity');}
 if(w.extraHighCapacityMagazines!==undefined)integer(w.extraHighCapacityMagazines,0,maxExtra,'extraHighCapacityMagazines');
 if(w.highCapacityMagazineStorageId!==undefined&&(typeof w.highCapacityMagazineStorageId!=='string'||!/^(?:none|(?:option|instance):[-a-z0-9]{1,80})$/.test(w.highCapacityMagazineStorageId)))throw new TypeError('Invalid high-capacity magazine storage reference.');
 if(w.spareMagazineStorageId!==undefined&&(typeof w.spareMagazineStorageId!=='string'||!/^(?:none|(?:option|instance):[-a-z0-9]{1,80})$/.test(w.spareMagazineStorageId)))throw new TypeError('Invalid spare magazine storage reference.');
 if(w.auxiliaryLauncher!==undefined&&!['none','attached','integral-acr','both-acr'].includes(w.auxiliaryLauncher))throw new TypeError('Invalid auxiliary launcher');if(w.auxiliaryAmmunition!==undefined&&!['standard',...GRENADES.map(g=>g.id)].includes(w.auxiliaryAmmunition))throw new TypeError('Invalid auxiliary ammunition');if(w.auxiliaryLoaded!==undefined)integer(w.auxiliaryLoaded,0,1,'auxiliaryLoaded');
 if(w.integralAmmunition!==undefined&&!['standard',...GRENADES.map(g=>g.id)].includes(w.integralAmmunition))throw new TypeError('Invalid integral ammunition');if(w.integralLoaded!==undefined)integer(w.integralLoaded,0,1,'integralLoaded');
 if(w.accessories!==undefined&&(!Array.isArray(w.accessories)||w.accessories.length>WEAPON_ACCESSORIES.length||new Set(w.accessories).size!==w.accessories.length||w.accessories.some(id=>!WEAPON_ACCESSORIES.some(a=>a.id===id))))throw new TypeError('Invalid weapon accessories.');
 if(w.extraFofTags!==undefined)integer(w.extraFofTags,0,100,'extraFofTags');
 if(w.ammunition!==undefined&&!['standard',...GRENADES.map(g=>g.id)].includes(w.ammunition))throw new TypeError('Unknown ammunition choice.');
 integer(w.linkedWeapons,1,4,'linkedWeapons');integer(w.extraMagazines,0,maxExtra,'extraMagazines');integer(w.initialMagazines,0,1,'initialMagazines');integer(w.extraMagazines+(w.extraHighCapacityMagazines??0),0,maxExtra,'combinedExtraMagazines');}
}
function aggregateMagazineProducts(copies){
 const sum=values=>values.some(value=>value===null)?null:values.reduce((total,value)=>total+value,0),products=new Map();
 for(const copy of copies)for(const product of copy.ammunitionInventory.products??[]){
  if(!products.has(product.productId))products.set(product.productId,[]);
  products.get(product.productId).push({...product,copyIndex:copy.copyIndex});
 }
 return [...products.values()].map(items=>{
  const {totalPerWeapon,autoloadPerWeapon,storedPerWeapon,storageId,copyIndex,...metadata}=items[0];
  return {...metadata,...Object.fromEntries(['initialCount','initialRounds','initialPurchaseCost','extraCount','extraRounds','autoloadCount','storedCount','autoloadRounds','storedRounds','reservePurchaseCost','loaderSupplyPurchaseCost'].map(field=>[field,sum(items.map(item=>item[field]))])),
   storageReservations:items.flatMap(item=>item.storageReservations.map(reservation=>({...reservation,copyIndex:item.copyIndex})))};
 });
}
function aggregateAmmunition(copies,record){
 const sum=values=>values.some(value=>value===null)?null:values.reduce((total,value)=>total+value,0);
 const noAmmunition=copies.every(copy=>copy.initialAmmunition.status==='not-applicable'),hardwareOnly=copies.every(copy=>copy.initialAmmunition.status==='hardware-only'),expendable=copies.every(copy=>copy.initialAmmunition.status==='complete-expendable-weapon');
 const initialAmmunition={...(expendable?{status:'complete-expendable-weapon'}:hardwareOnly?{status:'hardware-only',included:null,unitCost:null}:noAmmunition?{status:'not-applicable'}:{}),mode:'per-copy',count:sum(copies.map(copy=>copy.initialAmmunition.count)),totalRounds:sum(copies.map(copy=>copy.initialAmmunition.totalRounds)),purchaseCost:sum(copies.map(copy=>copy.initialAmmunition.purchaseCost))};
 const inventories=copies.map(copy=>copy.ammunitionInventory),allocations=inventories.map(inventory=>inventory.allocation);
 const variant=key=>Object.fromEntries(['autoloadCount','storedCount','autoloadRounds','storedRounds'].map(field=>[field,sum(allocations.map(allocation=>allocation[key][field]))]));
 const allocation={mode:'per-copy',resolved:allocations.every(item=>item.resolved),valid:allocations.every(item=>item.valid),supplyWeaponId:allocations[0].supplyWeaponId,sourceFamily:allocations[0].sourceFamily,linkedWeapons:copies.length,standard:variant('standard'),highCapacity:variant('highCapacity'),reservePurchaseCost:sum(allocations.map(item=>item.reservePurchaseCost)),loaderSupplyPurchaseCost:sum(allocations.map(item=>item.loaderSupplyPurchaseCost)),autoloadRounds:sum(allocations.map(item=>item.autoloadRounds)),storedRounds:sum(allocations.map(item=>item.storedRounds)),autoloadCount:sum(allocations.map(item=>item.autoloadCountPerWeapon)),storedCount:sum(allocations.map(item=>item.storedCountPerWeapon)),source:book('61')};
 const ammunitionInventory={...(expendable?{status:'complete-expendable-weapon'}:hardwareOnly?{status:'hardware-only'}:noAmmunition?{status:'not-applicable'}:{}),mode:'per-copy',initial:initialAmmunition,...(inventories.some(item=>item.products)?{products:aggregateMagazineProducts(copies)}:{}),...Object.fromEntries(['alternateSpareCount','alternateSpareRounds','standardSpareCount','highCapacitySpareCount','standardSpareRounds','highCapacitySpareRounds','totalRounds','ammunitionCost','autoloadCost','totalCost'].map(field=>[field,sum(inventories.map(inventory=>inventory[field]))])),allocation,...(record.autoload?{autoload:{count:sum(allocations.map(item=>item.autoloadCountPerWeapon)),maximumPerWeapon:10,source:book('61')}}:{})};
 return {initialAmmunition,ammunitionInventory,magazineVariants:copies[0].magazineVariants,ammoCost:ammunitionInventory.ammunitionCost,autoloadCost:ammunitionInventory.autoloadCost,unsupportedHighCapacity:copies.some(copy=>copy.unsupportedHighCapacity),replacementAmmoUnsupported:copies.some(copy=>copy.replacementAmmoUnsupported),unknownAmmunitionCost:copies.some(copy=>copy.unknownAmmunitionCost)};
}
function ammunitionCopyResult({copyIndex,customized,initialAmmunition,ammunitionInventory,spareAmmunition,highCapacitySpareAmmunition}){
 return {copyIndex,customized,initialAmmunition,ammunitionInventory,...(spareAmmunition?{spareAmmunition}:{}),...(highCapacitySpareAmmunition?{highCapacitySpareAmmunition}:{})};
}
export function evaluateWeapons(design,manipulators,skills,installedEquipment=[],hostEndurance={}){
 let cost=0,slots=0;const diagnostics=[],ledger=[],weapons=[],ammunitionStorage=[],storageUsed=new Map(),spareReservations=[];
 const occupancy=heldOccupancy(design.selections.physical.weapons,manipulators);
 const add=(severity,code,id,message,source)=>diagnostics.push({severity,code,path:'physical.weapons.'+id,message,source:source??book('61-64')});
 for(const record of design.selections.physical.weapons){const original=WEAPONS.find(w=>w.id===record.weaponId),ammo=GRENADES.find(g=>g.id===record.ammunition),w=original.grenade&&ammo?{...original,conditionalEffects:ammo.conditionalEffects??null,damage:ammo.damage,magazineCost:ammo.cost*original.magazine,traits:[...original.traits,...ammo.traits]}:original,mount=MOUNTS[w.mountClass],fcs=FIRE_CONTROL.find(f=>f.id===record.fireControl),arm=manipulators.find(a=>a.id===record.manipulatorId),n=record.linkedWeapons,held=record.placement==='held';
 if(record.placement==='worn'||w.wearable){const result=evaluateWornWeapon(design,record,w,manipulators);diagnostics.push(...result.diagnostics);ledger.push(result.ledger);weapons.push(result.weapon);cost+=result.weapon.cost??0;continue;}
 if(record.wearSite!==undefined&&record.wearSite!=='unresolved')add('error','EXTERNAL_WEAR_UNUSED_SITE',record.id,'Clear retained wear site or select supported external wear.');
 const specialisedSelection=recordUsesSpecialisedAmmunition(record),supportedSpecialised=Boolean(specialisedAmmunitionCategory(w)),manufactureSelected=Object.hasOwn(record,'weaponManufactureTL');
 const specialisedMode=supportedSpecialised&&(specialisedSelection||manufactureSelected),manufacture={...manufactureDeclaration(w,record.weaponManufactureTL),...(!supportedSpecialised?{status:'unsupported-profile'}:{})};
 const unsupportedManufacture=record.weaponManufactureTL!=null&&(!supportedSpecialised||record.weaponManufactureTL!==w.tl);
 if(unsupportedManufacture)add('blocker',supportedSpecialised?'CSC_AMMO_MANUFACTURE_TIER_UNRESOLVED':'CSC_AMMO_PROFILE_UNSUPPORTED',record.id,supportedSpecialised?'Declared manufacture TL is retained; catalogue-tier hardware pricing is not certified for this declaration.':'Retained manufacture declaration is outside this specialised-ammunition source scope. It does not change source attack, power, conditional-operation or acquisition rules.',manufacture.source);
 const grip=heldGripProfile(record,w,manipulators,occupancy),supportId=record.supportManipulatorId??'none';
 const accessories=(record.accessories??[]).map(id=>WEAPON_ACCESSORIES.find(a=>a.id===id)),families=new Set();let accessoryCost=0;const accessoryEffects=[];
 const cscWeapon=w.sourceFamily==='csc-2023',cscAccessories=cscWeapon&&w.compatibility.accessoryRules==='csc-2023'?evaluateCscAccessories(w,record,design.techLevel):null;
 const unassociatedFofTags=(record.extraFofTags??0)>0&&!cscAccessories;
 const unsupportedAccessories=accessories.some(a=>a.sourceFamily!==w.compatibility.accessoryRules)||cscAccessories?.cost===null||unassociatedFofTags;
 if(unassociatedFofTags)add('error','CSC_FOF_TAG_ASSOCIATION',record.id,'Extra FOF tags require a compatible CSC FOF Safety installation.');
 const unsupportedLaunchers=cscWeapon&&((record.auxiliaryLauncher??'none')!=='none'||(record.auxiliaryAmmunition??'standard')!=='standard'||(record.auxiliaryLoaded??0)>0||(record.integralAmmunition??'standard')!=='standard'||(record.integralLoaded??0)>0||(record.looseGrenades??0)>0);
 const unsupportedAmmunition=cscWeapon&&(record.ammunition??'standard')!=='standard';
 if(unsupportedAccessories&&!cscAccessories?.diagnostics.length)add('error',cscWeapon?'CSC_ACCESSORIES_UNSUPPORTED':'ACCESSORY_SOURCE',record.id,'Accessory definitions must match the selected weapon source; this combination is not implemented.');
 if(cscAccessories){for(const d of cscAccessories.diagnostics)add(d.severity??'error',d.code,record.id,d.message,d.source);accessoryCost=cscAccessories.cost??0;accessoryEffects.push(...cscAccessories.effects);}
 if(unsupportedLaunchers)add('error','CSC_LAUNCHERS_UNSUPPORTED',record.id,'Additional CSC auxiliary/integral launcher configurations and loose ammunition storage are not implemented for this source profile.');
 if(unsupportedAmmunition)add('error','CSC_AMMUNITION_UNSUPPORTED',record.id,'Selected Core or specialised ammunition cannot replace this source-defined CSC profile.');
 for(const accessory of unsupportedAccessories||cscWeapon?[]:accessories){accessoryCost+=accessory.cost;if(accessory.tl>design.techLevel)add('error','ACCESSORY_TL',record.id,accessory.label+' exceeds design technology.');if(families.has(accessory.family))add('error','ACCESSORY_FAMILY',record.id,'Choose only one accessory of each family.');families.add(accessory.family);
 if(accessory.family==='gyrostabiliser'&&(!w.traits.includes('Bulky')||w.damage?.includes('DD')))add('error','GYROSTABILISER_WEAPON',record.id,'Gyrostabilisers require a Bulky, non-Destructive weapon.');
 if(accessory.family==='scope'&&!['rifle','heavy-portable','heavy-vehicle'].includes(w.weaponFamily))add('error','SCOPE_WEAPON',record.id,'Scopes require a rifle or heavy weapon.');
 if(accessory.family==='suppressor'&&(w.speciality!=='slug'||w.traits.some(t=>t.startsWith('Auto '))))add('error','SUPPRESSOR_WEAPON',record.id,'Suppressors require a non-automatic slug thrower.');
 if(accessory.family==='laser-sight')accessoryEffects.push({accessory:accessory.id,modifier:1,context:'Attacks at less than50m; not an unconditional attack modifier.'});
 if(accessory.family==='intelligent')accessoryEffects.push({accessory:accessory.id,computerRating:accessory.id==='intelligent-1'?1:0,context:'Weapon computer only; does not grant robot brain bandwidth or skill software.'});
 }
 if(!held&&w.mountClass==='vehicle'&&cscAccessories?.mass){
  const mass=cscAccessories.mass,knownCrossing=w.massKg+mass.knownKgPerWeapon>250,unknownBoundary=w.massKg+mass.knownKgPerWeapon>=250&&mass.unresolvedAccessoryIds.length>0;
  if(knownCrossing||unknownBoundary)add('blocker','CSC_ACCESSORY_MOUNT_MASS_UNRESOLVED',record.id,'The weapon is within the 250 kg vehicle-mount limit, but selected accessory mass could exceed that boundary. Robot Handbook p61 does not settle accessory-mass aggregation; no mount fit or extra Slots are inferred.',book('61'));
 }
 const bothLaunchers=!cscWeapon&&record.auxiliaryLauncher==='both-acr',auxiliaryMode=cscWeapon?'none':bothLaunchers?'attached':record.auxiliaryLauncher??'none',integralAmmo=GRENADES.find(g=>g.id===record.integralAmmunition),integralLoaded=record.integralLoaded??0,associatedAttacks=[],auxiliaryAmmo=GRENADES.find(g=>g.id===record.auxiliaryAmmunition),auxiliaryLoaded=record.auxiliaryLoaded??0;let auxiliaryCost=0,auxiliary=null;
 if(auxiliaryMode==='none'){if(auxiliaryLoaded||record.auxiliaryAmmunition&&record.auxiliaryAmmunition!=='standard')add('error','AUXILIARY_UNUSED_AMMUNITION',record.id,'Associated ammunition requires an associated launcher.');}
 else{
  if(auxiliaryMode==='integral-acr'&&w.id!=='advanced-combat-rifle')add('error','AUXILIARY_INTEGRAL_WEAPON',record.id,'Only the Advanced Combat Rifle includes this source-defined launcher.');
  if(auxiliaryMode==='attached'&&(w.weaponFamily!=='rifle'||!w.compatibility.attachedLauncher))add('error','AUXILIARY_RIFLE_REQUIRED',record.id,'An attached auxiliary launcher requires a supported source-defined rifle-category weapon.');
  if(auxiliaryMode==='attached'&&design.techLevel<7)add('error','AUXILIARY_TL',record.id,'Attached auxiliary launchers require TL7.');
  if(auxiliaryMode==='attached'&&!held)add('blocker','AUXILIARY_MOUNT_FIT',record.id,'The source does not resolve combined rifle and Heavy Weapons mounting treatment for this attached accessory. No unchanged or additional mount class is assumed.');
  if(auxiliaryMode==='attached'&&w.id==='advanced-combat-rifle'&&!bothLaunchers)add('warning','ACR_INCLUDED_LAUNCHER_UNCONFIGURED',record.id,'This additional launcher is a separate attack. The source-included rifle-grenade capability remains unconfigured and its hardware price is not added again.');
  if(!auxiliaryAmmo)add('blocker','AUXILIARY_AMMUNITION',record.id,'Choose a grenade profile for the associated launcher; empty versus loaded is specified separately.');
  if(auxiliaryAmmo&&auxiliaryAmmo.tl>design.techLevel)add('error','AUXILIARY_AMMUNITION_TL',record.id,'Associated grenade exceeds design technology.');
  auxiliaryCost=((auxiliaryMode==='attached'?1000:0)+(auxiliaryAmmo?.cost??0)*auxiliaryLoaded)*n;
  auxiliary={parentWeaponId:record.id,mode:auxiliaryMode,copies:n,hardwareCostPerWeapon:auxiliaryMode==='attached'?1000:0,cost:auxiliaryAmmo?auxiliaryCost:null,range:auxiliaryMode==='integral-acr'?250:100,magazine:1,loadedPerWeapon:auxiliaryLoaded,ammunition:auxiliaryAmmo?.id??null,conditionalEffects:auxiliaryAmmo?.conditionalEffects??null,damage:auxiliaryAmmo?.damage??null,traits:auxiliaryAmmo?[...auxiliaryAmmo.traits,...(auxiliaryMode==='attached'?['Bulky']:[])]:[],skill:'heavy-weapons:portable',reloadMinorActions:auxiliaryMode==='attached'?3:null,attackModifier:null,fireControlAssociationVerified:false,context:'Separate attack profile; parent weapon software, fire control, accessories and linked-fire effects are not automatically inherited.',source:core(auxiliaryMode==='attached'?'131-133,135':'126,131')};
 }
 if(auxiliary)associatedAttacks.push({...auxiliary,profileId:record.id+':'+auxiliaryMode});
 if(bothLaunchers){
  if(w.id!=='advanced-combat-rifle')add('error','AUXILIARY_INTEGRAL_WEAPON',record.id,'The included and attached configuration requires an Advanced Combat Rifle.');
  if(!integralAmmo)add('blocker','INTEGRAL_AMMUNITION',record.id,'Select the included ACR launcher grenade separately from the attached launcher.');
  if(integralAmmo&&integralAmmo.tl>design.techLevel)add('error','INTEGRAL_AMMUNITION_TL',record.id,'Included launcher grenade exceeds design technology.');
  const integralCost=(integralAmmo?.cost??0)*integralLoaded*n;auxiliaryCost+=integralCost;
  associatedAttacks.push({profileId:record.id+':integral-acr',parentWeaponId:record.id,mode:'integral-acr',copies:n,hardwareCostPerWeapon:0,cost:integralAmmo?integralCost:null,range:250,magazine:1,loadedPerWeapon:integralLoaded,ammunition:integralAmmo?.id??null,conditionalEffects:integralAmmo?.conditionalEffects??null,damage:integralAmmo?.damage??null,traits:integralAmmo?.traits??[],skill:'heavy-weapons:portable',reloadMinorActions:null,attackModifier:null,fireControlAssociationVerified:false,context:'Included ACR attack; no parent or attached-launcher control modifiers are inherited.',source:core('126,131')});
 }else if(integralLoaded||record.integralAmmunition&&record.integralAmmunition!=='standard')add('error','INTEGRAL_UNUSED_AMMUNITION',record.id,'Additional included-launcher ammunition fields apply only when both ACR attacks are configured.');
 const looseCount=record.looseGrenades??0,looseFor=record.looseAmmunitionFor??'primary',storageRef=record.ammunitionStorageId??'none';let looseCost=0,looseAmmunition=null;
 if(looseCount){
  const grenade=looseFor==='integral'?(bothLaunchers?integralAmmo:null):looseFor==='auxiliary'?(auxiliaryMode==='none'?null:auxiliaryAmmo):(w.grenade?ammo:null),storage=installedEquipment.find(o=>STORAGE_IDS.includes(o.id)&&(o.instanceId?'instance:'+o.instanceId:'option:'+o.id)===storageRef);
  if(!grenade)add('blocker','LOOSE_GRENADE_ASSOCIATION',record.id,'Loose grenade rounds need a configured grenade-launcher attack and its grenade type.');
  if(!storage)add('error','AMMUNITION_STORAGE_REQUIRED',record.id,'Assign loose rounds to an installed storage compartment.');
  if(grenade&&storage){const massKg=.5*looseCount;looseCost=grenade.cost*looseCount;storageUsed.set(storageRef,massPrecision((storageUsed.get(storageRef)??0)+massKg));looseAmmunition={storageId:storageRef,for:looseFor,grenade:grenade.id,count:looseCount,massKg,cost:looseCost,source:core('131'),scope:'Individual loose grenade rounds only, without magazine/container mass. Storage capacity is approximate; other contents must fit in remaining capacity.'};if(grenade.id==='frag'&&storage.id!=='hazardous-material-storage-compartment')add('warning','AMMUNITION_HAZARD_CLASSIFICATION',record.id,'The source does not classify all packaged fragmentation ammunition as hazardous cargo. Storage safety and any need for special safeguards remain a referee condition; mass reservation alone is not such a determination.');}
 }else if(storageRef!=='none')add('error','UNUSED_AMMUNITION_STORAGE',record.id,'A storage association requires loose rounds.');
 if(w.directPayload){if(fcs.id!=='none')add('warning','DIRECT_PAYLOAD_TARGETING_UNRESOLVED',record.id,'Fire-control hardware is installed, but direct-payload targeting is inactive without a specified delivery mechanism. No fire-control attack bonus is applied.');if(record.autoload)add('error','DIRECT_PAYLOAD_AUTOLOADER',record.id,'A direct payload has no source-defined magazine or compatible autoloader.');if(accessories.length)add('blocker','DIRECT_PAYLOAD_ACCESSORY',record.id,'Accessory compatibility for a direct payload is not specified.');if(n>1)add('blocker','DIRECT_PAYLOAD_LINKED_EFFECT',record.id,'Linked direct-payload effects require source reconciliation; no combined detonation or damage scaling is inferred.');}
 const accessoryTraits=cscAccessories?.traits??w.traits,finalTraits=cscWeapon?[...accessoryTraits,...(fcs.id!=='none'&&!accessoryTraits.includes('Scope')?['Scope']:[])]:[...w.traits.filter(t=>!(families.has('gyrostabiliser')&&t==='Bulky')),...((families.has('scope')||fcs.id!=='none')&&!w.traits.includes('Scope')?['Scope']:[])];
 if(w.grenade&&!ammo)add('blocker','GRENADE_AMMUNITION',record.id,'Select a source-defined grenade type before calculating ammunition cost or damage.');
 if(ammo&&!w.grenade)add('error','AMMUNITION_INAPPLICABLE',record.id,'This weapon does not use selectable grenade ammunition.');
 if(ammo&&ammo.tl>design.techLevel)add('error','AMMUNITION_TL',record.id,'Selected ammunition exceeds design technology.');
 if(n>1&&w.damage?.includes('DD'))add('blocker','DESTRUCTIVE_LINKED_DAMAGE',record.id,'Linked destructive-damage scaling requires source reconciliation; no damage bonus is guessed.');
 if(w.tl>design.techLevel||fcs.tl>design.techLevel)add('error','WEAPON_TL',record.id,'Weapon or fire control exceeds design technology.');
 if(record.placement==='body'&&record.manipulatorId!=='none')add('error','WEAPON_UNUSED_ARM',record.id,'Body-mounted weapons cannot specify a manipulator.');
 if(record.placement!=='body'&&!arm)add('error','WEAPON_ARM_REQUIRED',record.id,'Select an installed manipulator.');
 if(arm&&!held&&(mount.armSize===null||arm.size<mount.armSize+(record.autoload?1:0)))add('error','WEAPON_ARM_SIZE',record.id,'Manipulator is too small for this weapon installation.');
 if(held&&w.mountClass==='vehicle')add('blocker','HELD_VEHICLE_WEAPON_UNRESOLVED',record.id,'Hand-held support, carrying fit and attack modifiers for a Heavy Weapons (vehicle) weapon are not defined by this construction route. Choose a body mount; a separate supported tripod or vehicle installation is not assumed.',book('60-61'));
 if(!held&&supportId!=='none')add('error','WEAPON_UNUSED_SUPPORT',record.id,'A support grip applies only to a held weapon. Clear the retained support selection or change its placement.');
 if(held){
  const support=manipulators.find(a=>a.id===supportId);
  if(w.requiresTwoHands&&supportId==='none'||supportId!=='none'&&!support)add('error','HELD_SUPPORT_REQUIRED',record.id,(w.requiresTwoHands&&w.handedness?.explicitPrintedHandCount===false?'The supported physical interpretation uses two hands. ':'')+'Select an installed second manipulator for the support grip.',grip.handednessBasis.source);
  if(supportId!=='none'&&supportId===record.manipulatorId)add('error','HELD_GRIPS_MUST_DIFFER',record.id,'The primary and support grip must use two distinct manipulators.');
  if(supportId!=='none'&&!supportsSecondGrip(w))add('error','HELD_SUPPORT_UNSUPPORTED',record.id,'A second grip is not supported for this weapon profile. Clear the retained selection; no handling or damage benefit is granted.',grip.handednessBasis.source);
  if(grip.gripAssignmentStatus==='conflicting')add('error','HELD_GRIP_OCCUPIED',record.id,'Incompatible held loadout: a selected manipulator also grips another weapon. Assign a free hand or remove a weapon from this held loadout. Owning or stowing both weapons is not prohibited.',book('60,115'));
  if(grip.multiArm)add('warning','HELD_MULTI_ARM_CHARACTERISTICS',record.id,'The participating manipulators are reported separately. General robot rules do not specify how their STR or DEX combine; effective characteristics, melee STR damage and attack modifiers remain referee-dependent. No extra attacks or automatic parry are granted.',book('25-28,60,115'));
  if(grip.handednessBasis.explicitPrintedHandCount===false)add('warning',w.requiresTwoHands?'HELD_HANDEDNESS_INTERPRETATION':'HELD_ONE_HANDED_INTERPRETATION',record.id,(w.requiresTwoHands?'Two-handed':'One-handed')+' operation is a qualified physical interpretation, not an explicit printed hand-count rule.',grip.handednessBasis.source);
  add('warning','HELD_CARRYING_FIT',record.id,'Grip assignments do not establish physical reach, coordination or carrying fit. Reasonable load remains a referee condition; arm STR is not summed and operating endurance hours are not END.',core('98'));
 }
 if(held&&(n!==1||record.autoload))add('error','HELD_WEAPON_MOUNT',record.id,'Linked weapons and autoloaders require a mount.');
 // Ammunition is evaluated per installed copy only. Mounts, FCS, accessories,
 // auxiliary launchers and loose cargo remain installation-scoped above/below.
 const evaluateAmmunition=(record,n,add)=>{
  if(!w.magazine&&!w.poweredMelee&&!w.expendableMelee&&(record.extraMagazines||!record.initialMagazines))add('error','WEAPON_AMMO_INAPPLICABLE',record.id,'This weapon has no separately purchased ammunition magazine; do not configure spare magazines or remove an initial magazine.');
  if(w.poweredMelee&&record.initialMagazines!==1)add('error','POWERED_MELEE_INITIAL_SELECTION',record.id,'Restore the legacy initial selection to its default. This is complete-weapon hardware acquisition, not a separately selected initial magazine or a charge declaration.',w.source);
  if(w.poweredMelee&&record.autoloadAllocation!==undefined)add('error','POWERED_MELEE_ALLOCATION',record.id,'Remove the retained ammunition allocation. Powered melee hardware has no supported replacement supplies or autoloader allocation.',w.source);
  if(w.expendableMelee&&record.initialMagazines!==1)add('error','EXPENDABLE_MELEE_INITIAL_SELECTION',record.id,'Restore the legacy initial selection. Each purchase is one complete expendable weapon, not a selected load.',w.source);
  if(w.expendableMelee&&record.autoloadAllocation!==undefined)add('error','EXPENDABLE_MELEE_ALLOCATION',record.id,'Remove retained supply allocation; no reusable or reloadable supplies are defined.',w.source);
  const magazineVariants=cscMagazineVariants(w),highCapacity=magazineVariants?.highCapacity,initialType=record.initialMagazineType??'standard',highCount=record.extraHighCapacityMagazines??0;
  const alternateRows=record.alternateMagazineSupplies??[],initialSourceId=record.initialMagazineSourceId??w.id,allowedSources=cscMagazineSourceIds(w),interchangeProducts=cscInterchangeMagazineProducts(w,WEAPONS);
  const sourceAllowed=id=>id===w.id||allowedSources.includes(id);
  const alternateAllowed=item=>item.sourceWeaponId!==w.id?allowedSources.includes(item.sourceWeaponId):Boolean(specialisedAmmunitionCategory(w))&&(item.modification??'standard')!==(record[item.variant==='high-capacity'?'highCapacityAmmunitionModification':'spareAmmunitionModification']??'standard');
  const initialSourceValid=sourceAllowed(initialSourceId),alternateSourcesValid=alternateRows.every(alternateAllowed);
  const invalidSource=!initialSourceValid||!alternateSourcesValid;
  if(!initialSourceValid)add('error','MAGAZINE_SOURCE_INCOMPATIBLE',record.id,'The retained initial magazine source is not compatible with this receiver. Only CSC standard/support ARLs explicitly interchange; restore a compatible receiver or correct the source.',w.source);
  for(const item of alternateRows)if(!alternateAllowed(item))add('error','MAGAZINE_SOURCE_INCOMPATIBLE',record.id,'The retained alternate magazine source '+item.sourceWeaponId+' is not an alternate compatible source. Own-profile supplies use the existing spare fields; capacity and calibre do not establish interchange.',w.source);
  const baseProduct=(sourceWeaponId,type,compatible=true)=>{
   const shared=interchangeProducts.find(item=>item.sourceWeaponId===sourceWeaponId&&item.id===type);
   if(compatible&&shared)return {...shared,variant:type,compatible:true};
   const own=compatible&&sourceWeaponId===w.id,variant=own&&type==='high-capacity'?highCapacity:null;
   return {productId:sourceWeaponId+':'+type,compatible,sourceWeaponId,sourceWeaponLabel:WEAPONS.find(item=>item.id===sourceWeaponId)?.label??null,sourceFamily:own?w.sourceFamily:null,variant:type,
    capacity:own?(type==='standard'?w.magazine:variant?.capacity)??null:null,unitCost:own?(type==='standard'?w.magazineCost:variant?.unitCost)??null:null,
    estimate:own?(type==='standard'?estimateCscMagazineMass(w):variant?.estimate)??null:null,source:own?(variant?.source??w.source):null};
  };
  const assessments=new Map();let invalidModification=false;
  const assessmentFor=id=>{
   if(!assessments.has(id)){
    const assessment=specialisedAmmunitionAssessment(w,id,record.weaponManufactureTL,design.techLevel);assessments.set(id,assessment);
    for(const issue of assessment.issues)add(issue.severity,issue.code,record.id,issue.message,issue.source);
    if(!assessment.valid)invalidModification=true;
   }
   return assessments.get(id);
  };
  const product=(sourceWeaponId,type,compatible=true,modification='standard')=>qualifyModifiedMagazine(baseProduct(sourceWeaponId,type,compatible),assessmentFor(modification));
  const initialModification=record.initialAmmunitionModification??'standard';
  // Retained selections are checked even at zero quantities; none become free defaults.
  for(const field of MODIFICATION_FIELDS)if(record[field]!==undefined)assessmentFor(record[field]);
  if(recordUsesSpecialisedAmmunition(record))add('warning','CSC_AMMO_MASS_ESTIMATE',record.id,'Modified supply mass uses only the standard-load-based estimate; actual modified-load mass remains unresolved.',{...w.source,pages:'142,175,178-181'});
  const allocation=ammunitionPartition(record),splitAllocation=allocation.mode==='split';
  if(splitAllocation){
   if(!allocation.resolved)add('error','AUTOLOAD_ALLOCATION_EXCEEDS_SUPPLY',record.id,'Loader allocation exceeds the additional supplies of at least one product. The stored remainder and allocation costs are unresolved.');
   if(allocation.autoloadCountPerWeapon>10)add('error','AUTOLOAD_ALLOCATION_LIMIT',record.id,'A loader holds up to ten additional physical magazines or power packs, combining all source products and variants.',book('61'));
   if(!record.autoload&&allocation.autoloadCountPerWeapon>0)add('error','AUTOLOAD_ALLOCATION_WITHOUT_LOADER',record.id,'Positive loader quantities require an installed autoloader. Retained quantities have not been moved into storage.');
   if(allocation.storedCountPerWeapon>100)add('error','STORED_AMMO_APPLICATION_LIMIT',record.id,'Combined stored reserves exceed the application bound of one hundred per weapon. This is not a source prohibition.');
  }
  const highCapacityRequested=initialType==='high-capacity'||(record.highCapacityAmmunitionModification??'standard')!=='standard'||highCount>0||allocation.highCapacity.autoloadPerWeapon>0||(record.highCapacityMagazineStorageId??'none')!=='none'||alternateRows.some(item=>item.variant==='high-capacity');
  const unsupportedHighCapacity=highCapacityRequested&&!highCapacity;
  if(unsupportedHighCapacity)add('blocker','CSC_HIGH_CAPACITY_UNSUPPORTED',record.id,'High-capacity magazine compatibility is not established for this source profile. No conversion, replacement price or included-load discount is inferred.',{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'175'});
  if(highCapacityRequested&&highCapacity){
   if(design.techLevel<highCapacity.tl)add('error','CSC_HIGH_CAPACITY_TL',record.id,'High-capacity magazines require TL4.',highCapacity.source);
   add('warning','CSC_HIGH_CAPACITY_REFEREE',record.id,highCapacity.qualification.shotgunReview?'High-capacity assault-shotgun magazines remain subject to referee approval; CSC specifically qualifies shotgun suitability.':'High-capacity magazine suitability remains subject to referee approval.',highCapacity.source);
  }
  const hasInterchange=initialSourceId!==w.id||alternateRows.some(item=>item.sourceWeaponId!==w.id);
  if(hasInterchange&&!invalidSource){
   add('warning','CSC_ARL_MAGAZINE_MASS_CONVENTION',record.id,'Magazine estimates retain their source weapon basis when transferred. CSC p142 does not settle donor versus receiver basis; this is a labelled inventory convention, not measured mass.',{...w.source,pages:'142,160-161'});
   if(initialSourceId!==w.id&&initialType==='high-capacity'||alternateRows.some(item=>item.variant==='high-capacity'))add('warning','CSC_ARL_HIGH_CAPACITY_COMPOSITION',record.id,'Cross-fitting a high-capacity magazine combines CSC p160 interchange with p175 conversion, subject to referee suitability; it is not a worked source example.',{...w.source,pages:'160,175'});
  }
  const reserveSpares=(supply,countPerWeapon,spareRef)=>{
   const {variant,estimate,unitCost}=supply;
   if(spareRef!=='none'){
    if(countPerWeapon===0)add('error','UNUSED_SPARE_AMMO_STORAGE',record.id,'Spare magazine storage requires a positive count for its selected product.');
    if(record.autoload&&!splitAllocation)add('error','SPARE_AMMO_STORAGE_AUTOLOADER',record.id,'Autoloader magazines use their mount allocation, not a separate storage reservation.');
    if(!estimate)add('error','SPARE_AMMO_STORAGE_UNSUPPORTED',record.id,'This source profile has no supported mass estimate for the selected magazine product.');
   }
   if(countPerWeapon===null||!countPerWeapon||record.autoload&&!splitAllocation)return null;
   const storage=installedEquipment.find(o=>STORAGE_IDS.includes(o.id)&&storageKey(o)===spareRef);
   if(spareRef!=='none'&&!storage)add('error','SPARE_AMMO_STORAGE_REQUIRED',record.id,'Assign spare magazines to an installed storage compartment in this construction.');
   if(!estimate||!storage){add('blocker','SPARE_AMMO_STORAGE',record.id,'Spare ammunition requires a supported source mass estimate and an installed storage allocation with sufficient capacity.');return null;}
   const count=countPerWeapon*n,massKg=massPrecision(estimate.unitMassKg*count);
   storageUsed.set(spareRef,massPrecision((storageUsed.get(spareRef)??0)+massKg));spareReservations.push({recordId:record.id,storageId:spareRef});
   return {variant,productId:supply.productId,sourceWeaponId:supply.sourceWeaponId,...(supply.modification?{modification:supply.modification,modificationLabel:supply.modificationLabel}:{}),storageId:spareRef,countPerWeapon,linkedWeapons:n,count,estimated:true,unitMassKg:estimate.unitMassKg,massKg,cost:Number.isFinite(unitCost)?unitCost*count:null,estimate,source:estimate.source,storageSource:book('55'),scope:'Estimated stored reserves only; initial and autoloader ammunition are excluded. The ammunition cost subtotal is already included in the weapon cost. Capacity does not establish hazardous-material suitability.'};
  };
  // Normalize identities before accounting. Equal capacities never coalesce products.
  const products=[
   {...product(w.id,'standard',true,record.spareAmmunitionModification??'standard'),...allocation.standard,storageId:record.spareMagazineStorageId??'none'},
   {...product(w.id,'high-capacity',true,record.highCapacityAmmunitionModification??'standard'),...allocation.highCapacity,storageId:record.highCapacityMagazineStorageId??'none'},
   ...alternateRows.map((item,index)=>({...product(item.sourceWeaponId,item.variant,alternateAllowed(item),item.modification??'standard'),...allocation.alternates[index],storageId:item.storageId}))
  ];
  if(!products.some(item=>item.productId===ammunitionProductIdentity(initialSourceId,initialType,initialModification)))products.push({...product(initialSourceId,initialType,initialSourceValid,initialModification),totalPerWeapon:0,autoloadPerWeapon:0,storedPerWeapon:allocation.resolved?0:null,storageId:'none'});
  const noAmmunition=noMeleeAmmunition(w),initialQuantity=w.poweredMelee||w.expendableMelee?null:noAmmunition?0:record.initialMagazines;
  const initialProduct=product(initialSourceId,initialType,initialSourceValid,initialModification),initialCount=initialQuantity===null?null:initialQuantity*n;
  const purchase=(count,unitCost)=>count===null?null:count===0?0:Number.isFinite(unitCost)?count*n*unitCost:null;
  const sum=values=>values.some(value=>value===null)?null:values.reduce((total,value)=>total+value,0);
  const rounds=(count,capacity)=>count===null?null:count===0?0:Number.isFinite(capacity)?count*n*capacity:null;
  const initialPurchaseCost=w.poweredMelee||w.expendableMelee||w.initialIncluded?0:purchase(record.initialMagazines,initialProduct.unitCost);
  const initialAmmunition=w.expendableMelee?{status:'complete-expendable-weapon',countPerWeapon:null,linkedWeapons:n,count:null,totalRounds:null,purchaseCost:0,source:w.source}:w.poweredMelee?{status:'hardware-only',countPerWeapon:null,linkedWeapons:n,count:null,capacityPerMagazine:null,totalRounds:null,included:null,unitCost:null,purchaseCost:0,source:w.source}:noAmmunition?{status:'not-applicable',countPerWeapon:0,linkedWeapons:n,count:0,totalRounds:0,purchaseCost:0,source:w.source}:{type:initialType,...(initialModification!=='standard'?{modification:initialModification,modificationLabel:ammunitionModificationLabel(initialModification),modificationSource:initialProduct.modificationSource}:{}),productId:initialProduct.productId,sourceWeaponId:initialSourceId,source:initialProduct.source,countPerWeapon:record.initialMagazines,linkedWeapons:n,count:initialCount,capacityPerMagazine:initialProduct.capacity,totalRounds:rounds(record.initialMagazines,initialProduct.capacity),included:w.initialIncluded,unitCost:initialProduct.unitCost,purchaseCost:initialPurchaseCost};
  for(const supply of products){
   supply.initialCount=supply.compatible&&supply.productId===initialProduct.productId?initialCount:0;
   supply.initialRounds=supply.compatible&&supply.productId===initialProduct.productId?initialAmmunition.totalRounds:0;
   supply.initialPurchaseCost=supply.compatible&&supply.productId===initialProduct.productId?initialPurchaseCost:0;
   supply.extraCount=supply.totalPerWeapon*n;supply.extraRounds=rounds(supply.totalPerWeapon,supply.capacity);
   supply.autoloadCount=supply.autoloadPerWeapon*n;supply.storedCount=supply.storedPerWeapon===null?null:supply.storedPerWeapon*n;
   supply.autoloadRounds=rounds(supply.autoloadPerWeapon,supply.capacity);supply.storedRounds=rounds(supply.storedPerWeapon,supply.capacity);
   supply.reservePurchaseCost=purchase(supply.storedPerWeapon,supply.unitCost);supply.loaderSupplyPurchaseCost=purchase(supply.autoloadPerWeapon,supply.unitCost);
   // Legacy all-loader records retain their old invalid storage-choice diagnostics.
   const reserved=reserveSpares(supply,!splitAllocation&&record.autoload?supply.totalPerWeapon:supply.storedPerWeapon,supply.storageId);
   supply.storageReservations=reserved?[reserved]:[];
  }
  const spareAmmunition=products[0].storageReservations[0],highCapacitySpareAmmunition=products[1].storageReservations[0];
  const totalExtra=products.reduce((count,item)=>count+item.totalPerWeapon,0);
  if(record.autoload&&(!Number.isFinite(w.magazine)||w.magazine<=0))add('error','AUTOLOADER_AMMUNITION',record.id,'An autoloader requires a source-defined finite magazine or power pack; this weapon has none.');
  if(record.autoload&&!allocation.autoloadCountPerWeapon)add('error','EMPTY_AUTOLOADER',record.id,'Specify one to ten additional magazines or power packs for the autoloader. Empty fitted-loader pricing remains unresolved.');
  if(w.initialIncluded&&!w.directPayload&&!noAmmunition&&!record.initialMagazines)add('error','INCLUDED_POWER_PACK',record.id,'The source price includes its initial power pack; no removal discount is defined.');
  if(record.autoload&&design.techLevel<6)add('error','AUTOLOADER_TL',record.id,'Autoloaders require TL6.');
  const replacementAmmoUnsupported=w.ammunitionAccounting?.replacementPurchasesSupported===false&&(record.autoload||totalExtra>0);
  if(replacementAmmoUnsupported)add('blocker',w.expendableMelee?'EXPENDABLE_MELEE_SUPPLY_UNAVAILABLE':w.poweredMelee?'POWERED_MELEE_SUPPLY_UNAVAILABLE':'CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE',record.id,w.expendableMelee?'Each purchase is one complete expendable weapon. No reusable shaft, warhead replacement, magazine or autoloader supply is defined.':w.poweredMelee?'Replacement supplies and autoloading are not source-defined. Only the complete weapon hardware is priced; no free replacement or included charged pack is assumed.':'Replacement packs, spare ammunition purchases and autoloading are not source-defined for this weapon supply. Its included supply remains available without inventing a replacement price.',w.source);
  const reservePurchaseCost=sum(products.map(item=>item.reservePurchaseCost)),loaderSupplyCost=sum(products.map(item=>item.loaderSupplyPurchaseCost));
  const ammoCost=allocation.valid&&!invalidSource&&!invalidModification?sum([initialPurchaseCost,reservePurchaseCost]):null;
  const autoloadCost=!allocation.valid||invalidSource||invalidModification?null:!record.autoload?0:!allocation.autoloadCountPerWeapon||loaderSupplyCost===null?null:2*loaderSupplyCost;
  const variantInventory=(part,supply)=>({...part,autoloadCount:supply.autoloadCount,storedCount:supply.storedCount,autoloadRounds:supply.autoloadRounds,storedRounds:supply.storedRounds});
  const allocationInventory={...allocation,supplyWeaponId:w.id,sourceFamily:w.sourceFamily,linkedWeapons:n,standard:variantInventory(allocation.standard,products[0]),highCapacity:variantInventory(allocation.highCapacity,products[1]),reservePurchaseCost,loaderSupplyPurchaseCost:loaderSupplyCost,autoloadRounds:sum(products.map(item=>item.autoloadRounds)),storedRounds:sum(products.map(item=>item.storedRounds)),source:book('61')};
  const ammunitionInventory={...(w.expendableMelee?{status:'complete-expendable-weapon'}:w.poweredMelee?{status:'hardware-only'}:noAmmunition?{status:'not-applicable'}:{}),initial:initialAmmunition,...(allowedSources.length||hasInterchange||specialisedMode?{products}:{}),standardSpareCount:record.extraMagazines*n,highCapacitySpareCount:highCount*n,standardSpareRounds:products[0].extraRounds,highCapacitySpareRounds:products[1].extraRounds,
   alternateSpareCount:sum(products.slice(2).map(item=>item.extraCount)),alternateSpareRounds:sum(products.slice(2).map(item=>item.extraRounds)),
   totalRounds:sum([initialAmmunition.totalRounds,...products.map(item=>item.extraRounds)]),ammunitionCost:ammoCost,autoloadCost,totalCost:sum([ammoCost,autoloadCost]),allocation:allocationInventory,
   ...(record.autoload?{autoload:{countPerWeapon:allocation.autoloadCountPerWeapon,maximumPerWeapon:10,source:book('61'),...(allocation.highCapacity.autoloadPerWeapon||alternateRows.length?{composition:'Mixed source products and variants combine CSC pp160,175 magazine quantities/prices with Robot Handbook p61 autoloading; this is not a worked source example.',variantSource:highCapacity?.source??null}:{})}}:{})};
  const unknownAmmunitionCost=ammoCost===null||autoloadCost===null;
  if(unknownAmmunitionCost&&!replacementAmmoUnsupported&&!(w.grenade&&!ammo))add('blocker','WEAPON_AMMUNITION_PRICE_UNRESOLVED',record.id,'The required ammunition purchase or allocation is unresolved; no zero-cost purchase is assumed.',w.source);
  return {spareAmmunition,highCapacitySpareAmmunition,initialAmmunition,ammunitionInventory,magazineVariants,ammoCost,autoloadCost,unsupportedHighCapacity,replacementAmmoUnsupported,unknownAmmunitionCost};
 };
 if(w.expendableMelee&&record.ammunitionOverrides?.length)add('error','EXPENDABLE_MELEE_COPY_SUPPLY',record.id,'Remove retained per-copy supply settings. Linked copies purchase complete weapons independently; supply customization is unsupported.',w.source);
 const customized=Boolean(record.ammunitionOverrides?.length);
 const retainedCopies=(record.ammunitionOverrides??[]).filter(item=>item.copyIndex>n);
 for(const override of retainedCopies)add('error','AMMUNITION_COPY_NOT_INSTALLED',record.id+'.ammunitionOverrides.'+override.copyIndex,'Copy '+override.copyIndex+' is not installed. Restore the linked count or remove its retained ammunition override.');
 const ammunitionCopies=customized?Array.from({length:n},(_,index)=>{
  const copyIndex=index+1,effective=effectiveAmmunitionRecord(record,copyIndex);
  const result=evaluateAmmunition(effective,1,(severity,code,id,message,source)=>add(severity,code,id+'.ammunitionOverrides.'+copyIndex,'Copy '+copyIndex+': '+message,source));
  return {copyIndex,customized:record.ammunitionOverrides.some(item=>item.copyIndex===copyIndex),...result};
 }):null;
 const result=ammunitionCopies?aggregateAmmunition(ammunitionCopies,record):evaluateAmmunition(record,n,add);
 const {spareAmmunition,highCapacitySpareAmmunition,initialAmmunition,ammunitionInventory,magazineVariants,ammoCost,autoloadCost,unsupportedHighCapacity,replacementAmmoUnsupported,unknownAmmunitionCost}=result;
 if(w.interpretation&&!(w.id==='advanced-combat-rifle'&&(auxiliaryMode==='integral-acr'||bothLaunchers)))add('warning','WEAPON_SOURCE_INTERPRETATION',record.id,w.interpretation);
 const mountSlots=held?0:mount.slots*n*(record.autoload?2:1),fcsSlots=fcs.id==='none'?0:1;
 const itemCost=(unsupportedManufacture||unsupportedAccessories||unsupportedLaunchers||unsupportedAmmunition||unsupportedHighCapacity||replacementAmmoUnsupported||unknownAmmunitionCost||w.grenade&&!ammo||auxiliaryMode!=='none'&&!auxiliaryAmmo||bothLaunchers&&!integralAmmo)?null:auxiliaryCost+looseCost+(cscAccessories?.additionalCost??0)+(w.cost+accessoryCost)*n+(held?0:mount.cost*n)+fcs.cost+ammoCost+autoloadCost,itemSlots=mountSlots+fcsSlots;
 if(itemCost!==null)cost+=itemCost;slots+=itemSlots;ledger.push({id:'weapon-'+record.id,label:w.label,cost:itemCost,slots:itemSlots,source:book('61-64'),weaponSource:w.source});

 let ammunitionAttackProjection=manufactureSelected&&!supportedSpecialised?{weaponManufacture:manufacture}:{};
 // Metadata on another source must never turn an initial-load schema sentinel
 // into ammunition or bypass direct/conditional/expendable attack restrictions.
 if(specialisedSelection&&!supportedSpecialised)Object.assign(ammunitionAttackProjection,{sourceWeaponProfile:{weaponId:w.id,label:w.label,damage:w.damage,range:w.range,traits:clone(w.traits),conditionalEffects:clone(w.conditionalEffects??{}),source:clone(w.source)},damage:null,range:null,traits:[],linkedDamageBonus:null});
 if(specialisedMode){
  const profiles=Array.from({length:n},(_,index)=>{
   const effective=effectiveAmmunitionRecord(record,index+1),modification=effective.initialAmmunitionModification??'standard',assessment=specialisedAmmunitionAssessment(w,modification,record.weaponManufactureTL,design.techLevel),sourceValid=(effective.initialMagazineSourceId??w.id)===w.id||cscMagazineSourceIds(w).includes(effective.initialMagazineSourceId);
   const initialCapacityValid=(effective.initialMagazineType??'standard')==='standard'||Boolean(cscMagazineVariants(w))&&design.techLevel>=4;
   const profile=assessment.valid&&!unsupportedManufacture&&!unsupportedAmmunition&&sourceValid&&initialCapacityValid&&design.techLevel>=w.tl?transformSpecialisedAmmunition(w,modification,finalTraits):null;
   if(profile&&cscWeapon&&w.traits.includes('Scope')&&!w.conditionalEffects?.holographicSight)profile.conditionalEffects.scopeUsage={trait:'Scope',active:held,condition:'Hand-held use of the printed weapon scope',independentFireControlScope:fcs.id!=='none',source:{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'176'}};
   return {copyIndex:index+1,modification,modificationLabel:ammunitionModificationLabel(modification),status:profile?'configured':'unresolved',initialCount:effective.initialMagazines,loaded:effective.initialMagazines>0,damage:profile?.damage??null,range:profile?.range??null,traits:profile?.traits??[],conditionalEffects:profile?.conditionalEffects??{},source:assessment.source};
  });
  const allLoaded=profiles.every(profile=>profile.loaded),noneLoaded=profiles.every(profile=>!profile.loaded),allResolved=profiles.every(profile=>profile.status==='configured');
  const homogeneous=allLoaded&&allResolved&&profiles.every(profile=>profile.modification===profiles[0].modification);
  const status=noneLoaded?'unloaded':!allResolved?'unresolved':homogeneous?'homogeneous':'mixed-unresolved';
  const common=homogeneous?profiles[0]:null;
  const linkedDamageBonus=common?(n>1&&!common.damage?.includes('DD')?Number(common.damage?.match(/^(\d+)/)?.[1]??0)*(n-1):n===1?0:null):null;
  const loadedAmmunitionAttack={status,damage:common?.damage??null,range:common?.range??null,traits:common?.traits??[],conditionalEffects:common?.conditionalEffects??{},linkedDamageBonus,operationalUse:'conditional-not-simulated'};
  ammunitionAttackProjection={sourceWeaponProfile:{weaponId:w.id,label:w.label,damage:w.damage,range:w.range,traits:clone(w.traits),conditionalEffects:clone(w.conditionalEffects??{}),source:clone(w.source)},weaponManufacture:manufacture,ammunitionAttackProfiles:profiles,loadedAmmunitionAttack,damage:loadedAmmunitionAttack.damage,range:loadedAmmunitionAttack.range,traits:loadedAmmunitionAttack.traits,conditionalEffects:loadedAmmunitionAttack.conditionalEffects,linkedDamageBonus};
  if(status==='mixed-unresolved')add('warning','CSC_AMMO_LINKED_ATTACK_UNRESOLVED',record.id,'Mixed or partially loaded linked copies have no common attack profile or certified linked damage bonus. Per-copy profiles and purchased inventories remain separate.',{...w.source,pages:'178-181'});
 }
 const software=resolveSkillLevel(skills,w.skill,w.speciality);
 const primaryManipulatorDM=arm?characteristic(arm.dexterity):null,dex=held&&(grip.multiArm||grip.gripAssignmentStatus!=='assigned')?null:primaryManipulatorDM;
 const heldStrengthRequirement=held&&(finalTraits.includes('Very Bulky')||finalTraits.includes('Bulky'))?{trait:finalTraits.includes('Very Bulky')?'Very Bulky':'Bulky',minimumStrength:finalTraits.includes('Very Bulky')?12:9,constructionBan:false,effectiveStrength:grip.effectiveStrength,penaltyResolved:false,source:core('79')}:null;
 if(heldStrengthRequirement)add('warning','HELD_STRENGTH_CONDITION',record.id,'Bulky and Very Bulky impose operational STR conditions, not a construction ban. Apply the source penalty using the applicable STR; no arm-combination rule is inferred.',core('79'));
 const baseAttackModifier=w.directPayload||held&&(w.mountClass==='vehicle'||grip.multiArm||grip.gripAssignmentStatus!=='assigned')||supportId!=='none'&&!held?null:design.kind==='drone'&&design.selections.brain.model==='none'?null:record.placement==='body'?(fcs.id==='none'?software:fcs.dm):(fcs.id==='none'?software+(dex??0):Math.max(0,software)+Math.max(dex??0,fcs.dm));
 weapons.push({...record,...grip,primaryManipulatorDM,...(w.sourceBaseProfile?{sourceBaseProfile:w.sourceBaseProfile,sourceMeasurements:w.sourceMeasurements}:{}),...(w.expendableMelee?{expendableMelee:true,acquisition:w.acquisition,linkedOperation:w.linkedOperation}:{}),...(w.attackProfiles?{attackProfiles:w.attackProfiles}:{}),...(w.poweredMelee?{poweredMelee:true,acquisition:w.acquisition,powerOperation:resolvePoweredMeleeOperation(w,hostEndurance)}:{}),...(heldStrengthRequirement?{heldStrengthRequirement}:{}),weaponFamily:w.weaponFamily,sourceFamily:w.sourceFamily,mountClass:w.mountClass,compatibility:w.compatibility,...(w.ammunitionAccounting?{ammunitionAccounting:w.ammunitionAccounting}:{}),...(w.sourceFamily==='csc-2023'?{massKg:w.massKg}:{}),...(w.conditionalEffects?{conditionalEffects:{...w.conditionalEffects,...(cscWeapon&&w.traits.includes('Scope')&&!w.conditionalEffects.holographicSight?{scopeUsage:{trait:'Scope',active:held,condition:'Hand-held use of the printed weapon scope',independentFireControlScope:fcs.id!=='none',source:{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'176'}}}:{})}}:{}),...(w.directPayload?{directPayload:true,massKg:w.massKg,conditionalEffects:w.conditionalEffects??null,fireControlStatus:fcs.id==='none'?'not-installed':'inactive-delivery-unresolved',effectContext:'Direct installation or carriage only. No ranged-launch mechanism, automatic trigger, attack-roll modifier or combined explosive effect is granted.',...(w.thrownRange?{thrownRange:w.thrownRange}:{}),effectResolution:w.skill==='explosives'?'Source Explosives check and game conditions determine the final effect.':'Grenade effect depends on delivery and target conditions.'}:{}),associatedAttacks,...(auxiliary?{auxiliary}:{}),...(looseAmmunition?{looseAmmunition}:{}),...(spareAmmunition?{spareAmmunition}:{}),...(highCapacitySpareAmmunition?{highCapacitySpareAmmunition}:{}),initialAmmunition,ammunitionInventory,...(ammunitionCopies?{ammunitionCopies:ammunitionCopies.map(ammunitionCopyResult)}:{}),...(magazineVariants?{magazineVariants}:{}),baseAttackModifier,attackContext:'Before range, cover, recoil, aim and situational modifiers; external drone operator skills are not assumed.',label:w.label,range:w.range,damage:w.damage,linkedDamageBonus:w.linkedOperation&&!w.linkedOperation.resolved||w.attackProfiles&&!w.attackProfiles.resolved?null:!w.directPayload&&n>1&&w.damage&&!w.damage.includes('DD')?Number(w.damage.match(/^([0-9]+)/)?.[1]??0)*(n-1):0,traits:finalTraits,accessories:record.accessories??[],accessoryEffects,...(cscAccessories?{accessoryDetails:cscAccessories.details,...(cscAccessories.tagInventory?{fofTags:cscAccessories.tagInventory}:{}),...(cscAccessories.mass?{accessoryMass:cscAccessories.mass}:{})}:{}),magazine:w.magazine,softwareLevel:software,fireControlDM:fcs.dm,manipulatorDM:dex,attackModifier:null,cost:itemCost,slots:itemSlots,source:w.source,...ammunitionAttackProjection});
 add('warning','WEAPON_ATTACK_CONTEXT',record.id,'Attack resolution depends on control mode, applicable weapon software and target conditions. Hardware and software modifiers are reported separately.');
 }
 for(const [storageId,reservedKg]of storageUsed){
  const storage=installedEquipment.find(o=>STORAGE_IDS.includes(o.id)&&storageKey(o)===storageId),capacityKg=2*storage.quantity;
  ammunitionStorage.push({storageId,capacityKg,reservedKg,remainingKg:massPrecision(capacityKg-reservedKg),source:book('55'),scope:'Approximate shared mass capacity for recorded loose rounds and estimated spare magazines; other cargo and volume fit remain external. Capacity does not establish hazardous-material suitability.'});
  if(reservedKg>capacityKg){
   add('error','AMMUNITION_STORAGE_CAPACITY',storageId,'Combined ammunition reservations exceed this storage compartment capacity.');
   for(const reservation of spareReservations.filter(r=>r.storageId===storageId))add('blocker','SPARE_AMMO_STORAGE',reservation.recordId,'Spare ammunition and other recorded contents exceed the assigned storage capacity.');
  }
 }
 return clone({cost,slots,diagnostics,ledger,weapons,ammunitionStorage});
}
