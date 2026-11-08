// Fictional Traveller equipment data and construction accounting; no real-world instructions.
import {assertKeys,integer} from './schema.mjs';
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
export const MOUNTS={small:{slots:1,cost:500,armSize:3},medium:{slots:2,cost:1000,armSize:5},heavy:{slots:10,cost:5000,armSize:7},vehicle:{slots:15,cost:10000,armSize:null}};
export const FIRE_CONTROL=[{id:'none',label:'No fire control',tl:0,cost:0,dm:0},...['Basic','Improved','Enhanced','Advanced'].map((label,i)=>({id:label.toLowerCase(),label,tl:6+i*2,cost:[10000,25000,50000,100000][i],dm:i+1}))];
export function weaponControl(design){return {field:'weapons',label:'Installed weapons',category:'Weapons',type:'weapons',maxItems:100,addLabel:'Add weapon',description:'Source-defined weapons, mounts and ammunition. The current weapon catalogue is incomplete; other weapons are not certified.',itemFields:[
 {field:'weaponId',label:'Weapon',type:'select',default:'handbook-stunner-12',choices:WEAPONS.map(w=>({...w,eligibility:{available:!design||w.tl<=design.techLevel,reason:design&&w.tl>design.techLevel?'Requires TL'+w.tl:null}}))},
 {field:'placement',label:'Placement',type:'select',default:'body',choices:[{id:'body',label:'Body mount'},{id:'arm',label:'Manipulator mount'},{id:'held',label:'Held in manipulator'}]},
 {field:'manipulatorId',label:'Manipulator',type:'select',default:'none',choices:[{id:'none',label:'None'},...(design?.selections.physical.manipulators??[]).map(a=>({id:a.id,label:a.id}))],visibleWhen:{field:'placement',oneOf:['arm','held']}},
 {field:'linkedWeapons',label:'Linked weapons',type:'number',min:1,max:4,default:1,visibleWhen:{field:'placement',oneOf:['body','arm']}},
 {field:'fireControl',label:'Fire control',type:'select',default:'none',choices:FIRE_CONTROL},
 {field:'autoload',label:'Autoloader',type:'select',default:false,choices:[{id:false,label:'None'},{id:true,label:'Installed'}],visibleWhen:{field:'placement',oneOf:['body','arm']}},
 {field:'extraMagazines',label:'Extra magazines per weapon',type:'number',min:0,max:10,default:0},
 {field:'initialMagazines',label:'Initial magazine per weapon',type:'select',default:1,choices:[{id:0,label:'None'},{id:1,label:'One'}]}
 ],source:book('61-64')};}
export function validateWeapons(records){
 if(!Array.isArray(records)||records.length>100)throw new TypeError('Expected up to 100 weapon records.');const ids=new Set();
 for(const w of records){assertKeys(w,['id','weaponId','placement','manipulatorId','linkedWeapons','fireControl','autoload','extraMagazines','initialMagazines'],'physical.weapons');
 if(typeof w.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(w.id)||ids.has(w.id))throw new TypeError('Invalid or duplicate weapon ID.');ids.add(w.id);
 if(!WEAPONS.some(v=>v.id===w.weaponId)||!['body','arm','held'].includes(w.placement)||!FIRE_CONTROL.some(v=>v.id===w.fireControl)||typeof w.autoload!=='boolean'||typeof w.manipulatorId!=='string'||w.manipulatorId.length>40)throw new TypeError('Invalid weapon configuration.');
 integer(w.linkedWeapons,1,4,'linkedWeapons');integer(w.extraMagazines,0,10,'extraMagazines');integer(w.initialMagazines,0,1,'initialMagazines');}
}
export function evaluateWeapons(design,manipulators,skills){
 let cost=0,slots=0;const diagnostics=[],ledger=[],weapons=[];
 const add=(severity,code,id,message)=>diagnostics.push({severity,code,path:'physical.weapons.'+id,message,source:book('61-64')});
 for(const record of design.selections.physical.weapons){const w=WEAPONS.find(w=>w.id===record.weaponId),mount=MOUNTS[w.mountClass],fcs=FIRE_CONTROL.find(f=>f.id===record.fireControl),arm=manipulators.find(a=>a.id===record.manipulatorId),n=record.linkedWeapons,held=record.placement==='held';
 if(w.tl>design.techLevel||fcs.tl>design.techLevel)add('error','WEAPON_TL',record.id,'Weapon or fire control exceeds design technology.');
 if(record.placement==='body'&&record.manipulatorId!=='none')add('error','WEAPON_UNUSED_ARM',record.id,'Body-mounted weapons cannot specify a manipulator.');
 if(record.placement!=='body'&&!arm)add('error','WEAPON_ARM_REQUIRED',record.id,'Select an installed manipulator.');
 if(arm&&(mount.armSize===null||arm.size<mount.armSize+(record.autoload?1:0)))add('error','WEAPON_ARM_SIZE',record.id,'Manipulator is too small for this weapon installation.');
 if(held&&(n!==1||record.autoload))add('error','HELD_WEAPON_MOUNT',record.id,'Linked weapons and autoloaders require a mount.');
 if(!w.magazine&&(record.extraMagazines||!record.initialMagazines))add('error','WEAPON_AMMO_INAPPLICABLE',record.id,'This weapon has an unlimited power supply; do not configure spare magazines or remove its integral supply.');
 if(record.extraMagazines&&!record.autoload)add('blocker','SPARE_AMMO_STORAGE',record.id,'Loose spare ammunition needs a separate storage allocation; only autoloader magazines are currently accounted.');
 if(record.autoload&&!record.extraMagazines)add('error','EMPTY_AUTOLOADER',record.id,'Specify one to ten extra magazines for the autoloader.');
 if(w.initialIncluded&&!record.initialMagazines)add('error','INCLUDED_POWER_PACK',record.id,'The source price includes its initial power pack; no removal discount is defined.');
 if(w.interpretation)add('warning','WEAPON_SOURCE_INTERPRETATION',record.id,w.interpretation);
 if(record.autoload&&design.techLevel<6)add('error','AUTOLOADER_TL',record.id,'Autoloaders require TL6.');
 const mountSlots=held?0:mount.slots*n*(record.autoload?2:1),fcsSlots=fcs.id==='none'?0:1,ammoCost=w.magazineCost*((record.autoload?0:record.extraMagazines)+(!w.initialIncluded?record.initialMagazines:0))*n;
 const itemCost=w.cost*n+(held?0:mount.cost*n)+fcs.cost+ammoCost+(record.autoload?2*w.magazineCost*record.extraMagazines*n:0),itemSlots=mountSlots+fcsSlots;
 cost+=itemCost;slots+=itemSlots;ledger.push({id:'weapon-'+record.id,label:w.label,cost:itemCost,slots:itemSlots,source:book('61-64'),weaponSource:w.source});
 const software=skills.filter(s=>s.id===w.skill||s.id===w.skill+':'+w.speciality||s.speciality===w.speciality&&s.id.startsWith(w.skill)).reduce((v,s)=>Math.max(v,s.level),-3);
 const dex=arm?(arm.dexterity===0?-3:arm.dexterity<=2?-2:arm.dexterity<=5?-1:arm.dexterity<=8?0:arm.dexterity<=11?1:arm.dexterity<=14?2:3):null;
 weapons.push({...record,label:w.label,range:w.range,damage:w.damage,linkedDamageBonus:n>1?Number(w.damage.match(/^([0-9]+)/)?.[1]??0)*(n-1):0,traits:w.traits,magazine:w.magazine,softwareLevel:software,fireControlDM:fcs.dm,manipulatorDM:dex,attackModifier:null,cost:itemCost,slots:itemSlots,source:w.source});
 add('warning','WEAPON_ATTACK_CONTEXT',record.id,'Attack resolution depends on control mode, applicable weapon software and target conditions. Hardware and software modifiers are reported separately.');
 }
 return{cost,slots,diagnostics,ledger,weapons};
}
