// Fictional Traveller equipment data and construction accounting; no real-world instructions.
import {assertKeys,integer,clone} from './schema.mjs';
import {CSC_SLUG_WEAPONS} from './csc-slug-weapons.mjs';
import {CSC_ENERGY_WEAPONS} from './csc-energy-weapons.mjs';
import {CSC_HEAVY_WEAPONS} from './csc-heavy-weapons.mjs';
import {CSC_MELEE_WEAPONS} from './csc-melee-weapons.mjs';
import {CSC_STANDARD_LAUNCHERS,CSC_DIRECT_PAYLOADS} from './csc-launcher-payloads.mjs';
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
WEAPONS.push(...clone(CSC_SLUG_WEAPONS),...clone(CSC_ENERGY_WEAPONS),...clone(CSC_HEAVY_WEAPONS),...clone(CSC_MELEE_WEAPONS),...clone(CSC_STANDARD_LAUNCHERS),...clone(CSC_DIRECT_PAYLOADS));
export const MOUNTS={small:{slots:1,cost:500,armSize:3},medium:{slots:2,cost:1000,armSize:5},heavy:{slots:10,cost:5000,armSize:7},vehicle:{slots:15,cost:10000,armSize:null}};
export const FIRE_CONTROL=[{id:'none',label:'No fire control',tl:0,cost:0,dm:0},...['Basic','Improved','Enhanced','Advanced'].map((label,i)=>({id:label.toLowerCase(),label,tl:6+i*2,cost:[10000,25000,50000,100000][i],dm:i+1}))];
const STORAGE_IDS=['storage-compartment','refrigerated-storage-compartment','hazardous-material-storage-compartment'];
function storageChoices(design){const p=design?.selections?.physical,labels={'storage-compartment':'Storage Compartment','refrigerated-storage-compartment':'Refrigerated Storage Compartment','hazardous-material-storage-compartment':'Hazardous Material Storage Compartment'};return[{id:'none',label:'No storage assigned'},...(p?.options??[]).filter(id=>STORAGE_IDS.includes(id)).map(id=>({id:'option:'+id,label:labels[id]+' (standard selection)'})),...(p?.optionInstances??[]).filter(o=>STORAGE_IDS.includes(o.optionId)).map((o,index)=>({id:'instance:'+o.id,label:labels[o.optionId]+' '+(index+1)}))];}
function accessoryChoices(design,weapon){return WEAPON_ACCESSORIES.filter(a=>!weapon||a.sourceFamily===weapon.compatibility.accessoryRules&&(a.sourceFamily!=='csc-2023'||cscAccessoryEligibility(weapon,a).available)).map(a=>({...clone(a),eligibility:{available:!design||a.tl<=design.techLevel,reason:design&&a.tl>design.techLevel?'Requires TL'+a.tl:null}}));}
export function weaponControl(design){return {field:'weapons',label:'Installed weapons',category:'Weapons',type:'weapons',maxItems:100,addLabel:'Add weapon',description:'Source-defined weapons, mounts and ammunition. The current weapon catalogue is incomplete; other weapons are not certified.',itemFields:[
 {field:'weaponId',label:'Weapon',type:'select',default:'handbook-stunner-12',choices:WEAPONS.map(w=>({...clone(w),eligibility:{available:!design||w.tl<=design.techLevel,reason:design&&w.tl>design.techLevel?'Requires TL'+w.tl:null}}))},
 {field:'placement',label:'Placement',type:'select',default:'body',choices:[{id:'body',label:'Body mount'},{id:'arm',label:'Manipulator mount'},{id:'held',label:'Held in manipulator'}]},
 {field:'manipulatorId',resetWhenHidden:true,label:'Manipulator',type:'select',default:'none',choices:[{id:'none',label:'None'},...(design?.selections.physical.manipulators??[]).map(a=>({id:a.id,label:a.id}))],visibleWhen:{field:'placement',oneOf:['arm','held']}},
 {field:'linkedWeapons',resetWhenHidden:true,label:'Linked weapons',type:'number',min:1,max:4,default:1,visibleWhen:{field:'placement',oneOf:['body','arm']}},
 {field:'fireControl',label:'Fire control',type:'select',default:'none',choices:FIRE_CONTROL.map(f=>({...f,eligibility:{available:!design||f.tl<=design.techLevel,reason:design&&f.tl>design.techLevel?'Requires TL'+f.tl:null}}))},
 {field:'autoload',resetWhenHidden:true,label:'Autoloader',type:'select',default:false,choices:[{id:false,label:'None'},{id:true,label:'Installed'}],visibleWhen:{field:'placement',oneOf:['body','arm']}},
 {field:'extraMagazines',label:'Extra magazines per weapon',type:'number',min:0,max:10,default:0},
 {field:'accessories',label:'Weapon accessories',type:'multiselect',default:[],maxItems:6,choices:accessoryChoices(design),choicesBy:{field:'weaponId',values:Object.fromEntries(WEAPONS.map(w=>[w.id,accessoryChoices(design,w)]))}},
 {field:'ammunition',resetWhenHidden:true,label:'Grenade ammunition',type:'select',default:'standard',choices:[{id:'standard',label:'Select ammunition'},...GRENADES.map(g=>({...g,eligibility:{available:!design||g.tl<=design.techLevel,reason:design&&g.tl>design.techLevel?'Requires TL'+g.tl:null}}))],visibleWhen:{field:'weaponId',oneOf:['grenade-launcher','ram-grenade-launcher']}},
 {field:'auxiliaryLauncher',group:'Associated launcher',label:'Associated grenade launcher',type:'select',default:'none',choices:[{id:'none',label:'No secondary attack configured'},{id:'attached',label:'Attached launcher (TL7, Cr1000)',eligibility:{available:!design||design.techLevel>=7,reason:design&&design.techLevel<7?'Requires TL7':null}},{id:'integral-acr',label:'Included Advanced Combat Rifle launcher'},{id:'both-acr',label:'ACR included and attached launchers'}]},
 {field:'auxiliaryAmmunition',group:'Associated launcher',resetWhenHidden:true,label:'Associated launcher grenade',type:'select',default:'standard',choices:[{id:'standard',label:'Select ammunition'},...GRENADES.map(g=>({...g,eligibility:{available:!design||g.tl<=design.techLevel,reason:design&&g.tl>design.techLevel?'Requires TL'+g.tl:null}}))],visibleWhen:{field:'auxiliaryLauncher',group:'Associated launcher',oneOf:['attached','integral-acr','both-acr']}},
 {field:'auxiliaryLoaded',group:'Associated launcher',resetWhenHidden:true,label:'Associated launcher loaded grenade',type:'select',default:0,choices:[{id:0,label:'Empty'},{id:1,label:'One grenade'}],visibleWhen:{field:'auxiliaryLauncher',group:'Associated launcher',oneOf:['attached','integral-acr','both-acr']}},
 {field:'integralAmmunition',group:'Associated launcher',resetWhenHidden:true,label:'Included ACR grenade',type:'select',default:'standard',choices:[{id:'standard',label:'Select ammunition'},...GRENADES.map(g=>({...g,eligibility:{available:!design||g.tl<=design.techLevel,reason:design&&g.tl>design.techLevel?'Requires TL'+g.tl:null}}))],visibleWhen:{field:'auxiliaryLauncher',equals:'both-acr'}},
 {field:'integralLoaded',group:'Associated launcher',resetWhenHidden:true,label:'Included ACR loaded grenade',type:'select',default:0,choices:[{id:0,label:'Empty'},{id:1,label:'One grenade'}],visibleWhen:{field:'auxiliaryLauncher',equals:'both-acr'}},
 {field:'looseGrenades',group:'Loose ammunition storage',label:'Loose grenade rounds (not magazines)',type:'number',min:0,max:100,default:0},
 {field:'looseAmmunitionFor',group:'Loose ammunition storage',label:'Loose rounds for',type:'select',default:'primary',choices:[{id:'primary',label:'Primary grenade launcher'},{id:'auxiliary',label:'Associated grenade launcher'},{id:'integral',label:'Included ACR launcher (both mode)'}]},
 {field:'ammunitionStorageId',group:'Loose ammunition storage',label:'Loose round storage',type:'select',default:'none',choices:storageChoices(design)},
 {field:'initialMagazines',label:'Initial magazine per weapon',type:'select',default:1,choices:[{id:0,label:'None'},{id:1,label:'One'}]}
 ],source:book('61-64')};}
export function validateWeapons(records){
 if(!Array.isArray(records)||records.length>100)throw new TypeError('Expected up to 100 weapon records.');const ids=new Set();
 for(const w of records){assertKeys(w,['id','weaponId','placement','manipulatorId','linkedWeapons','fireControl','autoload','extraMagazines','initialMagazines','ammunition','accessories','auxiliaryLauncher','auxiliaryAmmunition','auxiliaryLoaded','integralAmmunition','integralLoaded','looseGrenades','looseAmmunitionFor','ammunitionStorageId'],'physical.weapons');
 if(typeof w.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(w.id)||ids.has(w.id))throw new TypeError('Invalid or duplicate weapon ID.');ids.add(w.id);
 if(!WEAPONS.some(v=>v.id===w.weaponId)||!['body','arm','held'].includes(w.placement)||!FIRE_CONTROL.some(v=>v.id===w.fireControl)||typeof w.autoload!=='boolean'||typeof w.manipulatorId!=='string'||w.manipulatorId.length>40)throw new TypeError('Invalid weapon configuration.');
 if(w.looseGrenades!==undefined)integer(w.looseGrenades,0,100,'looseGrenades');if(w.looseAmmunitionFor!==undefined&&!['primary','auxiliary','integral'].includes(w.looseAmmunitionFor))throw new TypeError('Invalid loose ammunition association');if(w.ammunitionStorageId!==undefined&&(typeof w.ammunitionStorageId!=='string'||w.ammunitionStorageId.length>100))throw new TypeError('Invalid storage reference');
 if(w.auxiliaryLauncher!==undefined&&!['none','attached','integral-acr','both-acr'].includes(w.auxiliaryLauncher))throw new TypeError('Invalid auxiliary launcher');if(w.auxiliaryAmmunition!==undefined&&!['standard',...GRENADES.map(g=>g.id)].includes(w.auxiliaryAmmunition))throw new TypeError('Invalid auxiliary ammunition');if(w.auxiliaryLoaded!==undefined)integer(w.auxiliaryLoaded,0,1,'auxiliaryLoaded');
 if(w.integralAmmunition!==undefined&&!['standard',...GRENADES.map(g=>g.id)].includes(w.integralAmmunition))throw new TypeError('Invalid integral ammunition');if(w.integralLoaded!==undefined)integer(w.integralLoaded,0,1,'integralLoaded');
 if(w.accessories!==undefined&&(!Array.isArray(w.accessories)||w.accessories.length>6||new Set(w.accessories).size!==w.accessories.length||w.accessories.some(id=>!WEAPON_ACCESSORIES.some(a=>a.id===id))))throw new TypeError('Invalid weapon accessories.');
 if(w.ammunition!==undefined&&!['standard',...GRENADES.map(g=>g.id)].includes(w.ammunition))throw new TypeError('Unknown ammunition choice.');
 integer(w.linkedWeapons,1,4,'linkedWeapons');integer(w.extraMagazines,0,10,'extraMagazines');integer(w.initialMagazines,0,1,'initialMagazines');}
}
export function evaluateWeapons(design,manipulators,skills,installedEquipment=[]){
 let cost=0,slots=0;const diagnostics=[],ledger=[],weapons=[],ammunitionStorage=[],storageUsed=new Map();
 const add=(severity,code,id,message,source)=>diagnostics.push({severity,code,path:'physical.weapons.'+id,message,source:source??book('61-64')});
 for(const record of design.selections.physical.weapons){const original=WEAPONS.find(w=>w.id===record.weaponId),ammo=GRENADES.find(g=>g.id===record.ammunition),w=original.grenade&&ammo?{...original,conditionalEffects:ammo.conditionalEffects??null,damage:ammo.damage,magazineCost:ammo.cost*original.magazine,traits:[...original.traits,...ammo.traits]}:original,mount=MOUNTS[w.mountClass],fcs=FIRE_CONTROL.find(f=>f.id===record.fireControl),arm=manipulators.find(a=>a.id===record.manipulatorId),n=record.linkedWeapons,held=record.placement==='held';
 const accessories=(record.accessories??[]).map(id=>WEAPON_ACCESSORIES.find(a=>a.id===id)),families=new Set();let accessoryCost=0;const accessoryEffects=[];
 const cscWeapon=w.sourceFamily==='csc-2023',cscAccessories=cscWeapon&&w.compatibility.accessoryRules==='csc-2023'?evaluateCscAccessories(w,record,design.techLevel):null;
 const unsupportedAccessories=accessories.some(a=>a.sourceFamily!==w.compatibility.accessoryRules)||cscAccessories?.cost===null;
 const unsupportedLaunchers=cscWeapon&&((record.auxiliaryLauncher??'none')!=='none'||(record.auxiliaryAmmunition??'standard')!=='standard'||(record.auxiliaryLoaded??0)>0||(record.integralAmmunition??'standard')!=='standard'||(record.integralLoaded??0)>0||(record.looseGrenades??0)>0);
 const unsupportedAmmunition=cscWeapon&&(record.ammunition??'standard')!=='standard';
 if(unsupportedAccessories&&!cscAccessories?.diagnostics.length)add('error',cscWeapon?'CSC_ACCESSORIES_UNSUPPORTED':'ACCESSORY_SOURCE',record.id,'Accessory definitions must match the selected weapon source; this combination is not implemented.');
 if(cscAccessories){for(const d of cscAccessories.diagnostics)add('error',d.code,record.id,d.message,d.source);accessoryCost=cscAccessories.cost??0;accessoryEffects.push(...cscAccessories.effects);}
 if(unsupportedLaunchers)add('error','CSC_LAUNCHERS_UNSUPPORTED',record.id,'Additional CSC auxiliary/integral launcher configurations and loose ammunition storage are not implemented for this source profile.');
 if(unsupportedAmmunition)add('error','CSC_AMMUNITION_UNSUPPORTED',record.id,'Selected Core or specialised ammunition cannot replace this source-defined CSC profile.');
 for(const accessory of unsupportedAccessories||cscWeapon?[]:accessories){accessoryCost+=accessory.cost;if(accessory.tl>design.techLevel)add('error','ACCESSORY_TL',record.id,accessory.label+' exceeds design technology.');if(families.has(accessory.family))add('error','ACCESSORY_FAMILY',record.id,'Choose only one accessory of each family.');families.add(accessory.family);
 if(accessory.family==='gyrostabiliser'&&(!w.traits.includes('Bulky')||w.damage?.includes('DD')))add('error','GYROSTABILISER_WEAPON',record.id,'Gyrostabilisers require a Bulky, non-Destructive weapon.');
 if(accessory.family==='scope'&&!['rifle','heavy-portable','heavy-vehicle'].includes(w.weaponFamily))add('error','SCOPE_WEAPON',record.id,'Scopes require a rifle or heavy weapon.');
 if(accessory.family==='suppressor'&&(w.speciality!=='slug'||w.traits.some(t=>t.startsWith('Auto '))))add('error','SUPPRESSOR_WEAPON',record.id,'Suppressors require a non-automatic slug thrower.');
 if(accessory.family==='laser-sight')accessoryEffects.push({accessory:accessory.id,modifier:1,context:'Attacks at less than50m; not an unconditional attack modifier.'});
 if(accessory.family==='intelligent')accessoryEffects.push({accessory:accessory.id,computerRating:accessory.id==='intelligent-1'?1:0,context:'Weapon computer only; does not grant robot brain bandwidth or skill software.'});
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
  if(grenade&&storage){const massKg=.5*looseCount;looseCost=grenade.cost*looseCount;storageUsed.set(storageRef,(storageUsed.get(storageRef)??0)+massKg);looseAmmunition={storageId:storageRef,for:looseFor,grenade:grenade.id,count:looseCount,massKg,cost:looseCost,source:core('131'),scope:'Individual loose grenade rounds only, without magazine/container mass. Storage capacity is approximate; other contents must fit in remaining capacity.'};if(grenade.id==='frag'&&storage.id!=='hazardous-material-storage-compartment')add('warning','AMMUNITION_HAZARD_CLASSIFICATION',record.id,'The source does not classify all packaged fragmentation ammunition as hazardous cargo. Storage safety and any need for special safeguards remain a referee condition; mass reservation alone is not such a determination.');}
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
 if(held&&w.requiresTwoHands)add('blocker','HELD_TWO_HANDED_WEAPON_UNRESOLVED',record.id,'This weapon requires two-handed use. A single selected manipulator does not validate the second grip, coordinated operation or carrying fit; choose a supported mount until that route is modelled.',w.handednessSource??w.handedness?.source??w.source);
 if(held&&(n!==1||record.autoload))add('error','HELD_WEAPON_MOUNT',record.id,'Linked weapons and autoloaders require a mount.');
 if(!w.magazine&&(record.extraMagazines||!record.initialMagazines))add('error','WEAPON_AMMO_INAPPLICABLE',record.id,'This weapon has no separately purchased ammunition magazine; do not configure spare magazines or remove an initial magazine.');
 if(record.extraMagazines&&!record.autoload)add('blocker','SPARE_AMMO_STORAGE',record.id,'Loose spare ammunition needs a separate storage allocation; only autoloader magazines are currently accounted.');
 if(record.autoload&&(!Number.isFinite(w.magazine)||w.magazine<=0))add('error','AUTOLOADER_AMMUNITION',record.id,'An autoloader requires a source-defined finite magazine or power pack; this weapon has none.');
 if(record.autoload&&!record.extraMagazines)add('error','EMPTY_AUTOLOADER',record.id,'Specify one to ten extra magazines for the autoloader.');
 if(w.initialIncluded&&!w.directPayload&&!record.initialMagazines)add('error','INCLUDED_POWER_PACK',record.id,'The source price includes its initial power pack; no removal discount is defined.');
 if(w.interpretation&&!(w.id==='advanced-combat-rifle'&&(auxiliaryMode==='integral-acr'||bothLaunchers)))add('warning','WEAPON_SOURCE_INTERPRETATION',record.id,w.interpretation);
 if(record.autoload&&design.techLevel<6)add('error','AUTOLOADER_TL',record.id,'Autoloaders require TL6.');
 const mountSlots=held?0:mount.slots*n*(record.autoload?2:1),fcsSlots=fcs.id==='none'?0:1,ammoCost=w.magazineCost*((record.autoload?0:record.extraMagazines)+(!w.initialIncluded?record.initialMagazines:0))*n;
 const itemCost=(unsupportedAccessories||unsupportedLaunchers||unsupportedAmmunition||w.grenade&&!ammo||auxiliaryMode!=='none'&&!auxiliaryAmmo||bothLaunchers&&!integralAmmo)?null:auxiliaryCost+looseCost+(w.cost+accessoryCost)*n+(held?0:mount.cost*n)+fcs.cost+ammoCost+(record.autoload?2*w.magazineCost*record.extraMagazines*n:0),itemSlots=mountSlots+fcsSlots;
 if(itemCost!==null)cost+=itemCost;slots+=itemSlots;ledger.push({id:'weapon-'+record.id,label:w.label,cost:itemCost,slots:itemSlots,source:book('61-64'),weaponSource:w.source});
 const software=skills.filter(s=>s.id===w.skill||s.id===w.skill+':'+w.speciality||s.speciality===w.speciality&&s.id.startsWith(w.skill)).reduce((v,s)=>Math.max(v,s.level),-3);
 const dex=arm?(arm.dexterity===0?-3:arm.dexterity<=2?-2:arm.dexterity<=5?-1:arm.dexterity<=8?0:arm.dexterity<=11?1:arm.dexterity<=14?2:3):null;
 const baseAttackModifier=w.directPayload||held&&(w.mountClass==='vehicle'||w.requiresTwoHands)?null:design.kind==='drone'&&design.selections.brain.model==='none'?null:record.placement==='body'?(fcs.id==='none'?software:fcs.dm):(fcs.id==='none'?software+(dex??0):Math.max(0,software)+Math.max(dex??0,fcs.dm));
 weapons.push({...record,weaponFamily:w.weaponFamily,sourceFamily:w.sourceFamily,mountClass:w.mountClass,compatibility:w.compatibility,...(w.ammunitionAccounting?{ammunitionAccounting:w.ammunitionAccounting}:{}),...(w.sourceFamily==='csc-2023'?{massKg:w.massKg}:{}),...(w.conditionalEffects?{conditionalEffects:{...w.conditionalEffects,...(cscWeapon&&w.traits.includes('Scope')&&!w.conditionalEffects.holographicSight?{scopeUsage:{trait:'Scope',active:held,condition:'Hand-held use of the printed weapon scope',independentFireControlScope:fcs.id!=='none',source:{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'176'}}}:{})}}:{}),...(w.directPayload?{directPayload:true,massKg:w.massKg,conditionalEffects:w.conditionalEffects??null,fireControlStatus:fcs.id==='none'?'not-installed':'inactive-delivery-unresolved',effectContext:'Direct installation or carriage only. No ranged-launch mechanism, automatic trigger, attack-roll modifier or combined explosive effect is granted.',...(w.thrownRange?{thrownRange:w.thrownRange}:{}),effectResolution:w.skill==='explosives'?'Source Explosives check and game conditions determine the final effect.':'Grenade effect depends on delivery and target conditions.'}:{}),associatedAttacks,...(auxiliary?{auxiliary}:{}),...(looseAmmunition?{looseAmmunition}:{}),baseAttackModifier,attackContext:'Before range, cover, recoil, aim and situational modifiers; external drone operator skills are not assumed.',label:w.label,range:w.range,damage:w.damage,linkedDamageBonus:!w.directPayload&&n>1&&w.damage&&!w.damage.includes('DD')?Number(w.damage.match(/^([0-9]+)/)?.[1]??0)*(n-1):0,traits:finalTraits,accessories:record.accessories??[],accessoryEffects,...(cscAccessories?{accessoryDetails:cscAccessories.details}:{}),magazine:w.magazine,softwareLevel:software,fireControlDM:fcs.dm,manipulatorDM:dex,attackModifier:null,cost:itemCost,slots:itemSlots,source:w.source});
 add('warning','WEAPON_ATTACK_CONTEXT',record.id,'Attack resolution depends on control mode, applicable weapon software and target conditions. Hardware and software modifiers are reported separately.');
 }
 for(const [storageId,reservedKg]of storageUsed){const storage=installedEquipment.find(o=>(o.instanceId?'instance:'+o.instanceId:'option:'+o.id)===storageId),capacityKg=2*storage.quantity;ammunitionStorage.push({storageId,capacityKg,reservedKg,remainingKg:capacityKg-reservedKg,source:book('55'),scope:'Approximate mass capacity; no unrecorded cargo or magazine containers are assumed.'});if(reservedKg>capacityKg)add('error','AMMUNITION_STORAGE_CAPACITY',storageId,'Combined loose-round reservations exceed this storage compartment capacity.');}
 return clone({cost,slots,diagnostics,ledger,weapons,ammunitionStorage});
}
