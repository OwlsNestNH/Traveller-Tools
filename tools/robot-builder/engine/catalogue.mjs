import {OPTIONS_ARRAY} from './options-data.mjs';
import {clone} from './schema.mjs';
export const source = pages => ({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const choice = (id,label,pages,extra={}) => ({id,label,implemented:true,source:source(pages),...extra});
export const SIZES = [
 [1,1,1,-4,0,100],[2,2,4,-3,.02,200],[3,4,8,-2,.1,400],[4,8,12,-1,.25,800],
 [5,16,20,0,.5,1000],[6,32,32,1,1,2000],[7,64,50,2,2,4000],[8,128,72,3,4,8000]
].map(([size,slots,hits,attackDM,vehicleSpaces,cost])=>choice(`size-${size}`,`Size ${size}`, '13',{size,slots,hits,attackDM,vehicleSpaces,cost}));
export const LOCOMOTION = [
 ['none','Stationary',5,0,216,1,[]],['wheels','Wheels',5,0,72,2,[]],['wheels-atv','Wheels (ATV)',5,0,72,3,['ATV']],
 ['tracks','Tracks',5,-1,72,2,['ATV']],['grav','Grav',9,1,24,20,['Flyer (Idle)']],['aeroplane','Aeroplane',5,1,12,12,['Flyer']],
 ['aquatic','Aquatic',6,-2,72,4,['Seafarer']],['vtol','VTOL',7,0,24,14,['Flyer (Idle)']],['walker','Walker',8,0,72,10,['ATV']],
 ['hovercraft','Hovercraft',7,1,24,10,['ACV']],['thruster','Thruster',7,1,2,20,['Thruster (0.1G)']]
].map(([id,label,tl,agility,endurance,multiplier,traits])=>choice(id,label,'16–17',{tl,agility,endurance,multiplier,traits}));
export const BRAINS = [
 ['primitive',7,0,10000,1,0],['primitive',8,0,100,1,0],['basic',8,1,20000,3,1],['hunter-killer',8,1,30000,3,1],
 ['basic',10,1,4000,4,1],['hunter-killer',10,1,6000,4,1],['advanced',10,2,100000,6,2],['advanced',11,2,50000,7,2],
 ['advanced',12,2,10000,8,2],['very-advanced',12,3,500000,9,3],['very-advanced',13,4,500000,10,3],['very-advanced',14,5,500000,11,3],
 ['self-aware',15,10,1000000,12,4],['self-aware',16,15,1000000,13,4],['conscious',17,20,5000000,15,5],['conscious',18,30,1000000,15,5]
].map(([family,tl,bandwidth,cost,intelligence,rank])=>choice(`${family}-tl${tl}`,`${({'primitive':'Primitive','basic':'Basic','hunter-killer':'Hunter/Killer','advanced':'Advanced','very-advanced':'Very Advanced','self-aware':'Self-Aware','conscious':'Conscious'})[family]} (TL${tl})`,'65–67',{family,tl,bandwidth,cost,intelligence,rank}));
export const BANDWIDTH = [choice('none','None','67',{tl:0,rank:0,bandwidth:0,cost:0}), ...[
 [8,1,1,5000],[10,2,2,5000],[11,2,3,10000],[12,2,4,20000],[12,3,6,50000],[12,3,8,100000],
 [15,4,10,500000],[15,4,15,1000000],[15,4,20,2500000],[15,4,25,5000000],[17,5,30,5000000],[17,5,40,10000000],[18,5,50,5000000]
].map(([tl,rank,bandwidth,cost])=>choice(`bw-${bandwidth}`,`+${bandwidth} bandwidth (TL${tl})`,'67',{tl,rank,bandwidth,cost}))];
export const SKILLS = [
 ['Admin',8,0,'INT',100],['Advocate',10,0,'INT',500],['Animals',9,0,'DEX',200],['Art',10,0,'INT',500],['Astrogation',12,1,'INT',500],
 ['Athletics',8,0,'variable',100],['Broker',10,0,'INT',200],['Carouse',11,1,'INT',500],['Deception',13,1,'INT',1000],['Diplomat',10,1,'INT',500],
 ['Drive',8,0,'DEX',100],['Electronics',8,0,'INT',100],['Engineer',9,0,'INT',200],['Explosives',8,0,'INT',100],['Flyer',8,0,'DEX',100],
 ['Gambler',10,0,'INT',500],['Gun Combat',8,0,'DEX',100],['Gunner',8,0,'DEX',100],['Heavy Weapons',8,0,'DEX',100],['Investigate',11,1,'INT',500],
 ['Language',9,0,'INT',200],['Leadership',13,1,'INT',1000],['Mechanic',8,0,'INT',100],['Medic',9,0,'INT',200],['Melee',8,0,'DEX',100],
 ['Navigation',8,0,'INT',100],['Persuade',11,1,'INT',500],['Pilot',8,0,'DEX',100],['Profession',9,0,'INT',200],['Recon',10,0,'INT',500],
 ['Science',9,0,'INT',200],['Seafarer',8,0,'DEX',100],['Stealth',10,0,'DEX',500],['Steward',8,0,'INT',100],['Streetwise',13,1,'INT',1000],
 ['Survival',10,0,'INT',200],['Tactics',8,0,'INT',100]
].map(([label,tl,bandwidth,characteristic,cost])=>({id:label.toLowerCase().replaceAll(' ','-'),label,tl,bandwidth,characteristic,cost}));
const specialtySkills = ['animals','art','athletics','drive','electronics','engineer','flyer','gun-combat','gunner','heavy-weapons','language','melee','pilot','profession','science','seafarer','tactics'];
export const PACKAGES = SKILLS.flatMap(skill=>[0,1,2,3].map(level=>choice(`${skill.id}-${level}`,`${skill.label} ${level}`,'73–74',{
 skill:skill.id,level,tl:skill.tl+level,bandwidth:skill.bandwidth+level,cost:skill.cost*10**level,characteristic:skill.characteristic,
 implemented:!(level>0&&specialtySkills.includes(skill.id)),reason:level>0&&specialtySkills.includes(skill.id)?'Speciality selection is not yet implemented.':undefined
}))).map(({reason,...rest})=>reason?{...rest,reason}:rest);
const documentedSpecialities={electronics:['comms','computers','remote-ops','sensors'],engineer:['m-drive','j-drive','life-support','power']};
for(const [skillId,specialities] of Object.entries(documentedSpecialities)){
 const skill=SKILLS.find(s=>s.id===skillId);
 for(const speciality of [...specialities,'all'])for(const level of [1,2,3]){
  const count=speciality==='all'?4:1;
  PACKAGES.push(choice(skillId+'-'+speciality+'-'+level,skill.label+' ('+speciality.replaceAll('-',' ')+') '+level,'73–75',{
   skill:skillId,speciality,level,tl:skill.tl+level,bandwidth:(skill.bandwidth+level)*count,perPackageBandwidth:skill.bandwidth+level,packageCount:count,cost:skill.cost*10**level*count,characteristic:skill.characteristic
  }));
 }
}
const optionAliases={'visual-spectrum-sensor':'visual-spectrum','voder-speaker':'voder','auditory-sensor':'auditory','wireless-data-link':'wireless','transceiver-5km-improved':'transceiver-improved','transceiver-5km-basic':'transceiver-basic','video-screen-basic':'video-basic'};
export const OPTIONS=OPTIONS_ARRAY.map(row=>({...row,id:optionAliases[row.id]??row.id,parameterControls:[
 ...(row.repeatable||row.slotsBasis==='allocated'?[{field:'quantity',label:row.slotsBasis==='allocated'?'Allocated slots':'Quantity',type:'number',min:1,max:1000,default:1,step:1}]:[]),
 ...(row.requiresDetail?[{field:'detail',label:row.requiresDetail,type:'text',maxLength:120,default:''}]:[])
]}));
export const DEFAULT_ITEMS = [
 ['visual-spectrum','Visual spectrum sensor',7,50],['voder','Voder speaker',8,100],['auditory','Auditory sensor',5,10],['wireless','Wireless data link',8,10],
 ['transceiver-improved','Transceiver 5km (improved)',8,100],['drone-interface','Drone interface',6,100],['transceiver-basic','Transceiver 5km (basic)',7,250],['video-basic','Video screen (basic)',7,200]
].map(([id,label,tl,cost])=>choice(id,label,'29,34–39',{tl,cost,zeroSlot:true,freeInDefault:true,category:'Default Suites'}));
export const CORE_PACKAGES=[choice('none','No hard-coded package','69–73',{family:'standard',bandwidth:0,cost:0,skills:[]}),
 ...[
 ['primitive-alert','Primitive (alert)','primitive',0,[['recon',0]]],['primitive-clean','Primitive (clean)','primitive',0,[['profession-domestic-cleaner',2]]],
 ['primitive-evade','Primitive (evade)','primitive',0,[['athletics-dexterity',1],['stealth',2]]],['primitive-homing','Primitive (homing)','primitive',0,[['weapon',1]]],
 ['basic-labourer','Basic (labourer)','basic',1,[['profession-labourer',2]]],['basic-locomotion','Basic (locomotion)','basic',1,[]],['basic-none','Basic (none)','basic',0,[]],
 ['basic-recon','Basic (recon)','basic',1,[['recon',2]]],['basic-security','Basic (security)','basic',1,[['weapon',1],['tactics-military',1]]],
 ['basic-servant','Basic (servant)','basic',1,[['profession-domestic-servant',2]]],['basic-service','Basic (service)','basic',1,[['mechanic',0],['steward',0]]],
 ['basic-target','Basic (target)','basic',1,[['explosives',1],['recon',0]]],['hunter-standard','Hunter/Killer (standard)','hunter-killer',1,[['weapon',0],['recon',0]]],
 ['hunter-tactical','Hunter/Killer (tactical)','hunter-killer',1,[['weapon',0],['recon',0],['tactics-military',2]]]
 ].map(([id,label,family,bandwidth,skills])=>choice(id,label,'69–73',{family,bandwidth,skills,cost:id==='hunter-tactical'?10000:0,
 implemented:!['primitive-homing','basic-security','hunter-standard','hunter-tactical'].includes(id),
 ...(['primitive-homing','basic-security','hunter-standard','hunter-tactical'].includes(id)?{reason:'Weapon speciality selection and hard-coded bandwidth confirmation are pending.'}:{})}))
];

export const KINDS = [choice('standard','Ordinary robot','13–78'),...[
 ['drone','Drone','79'],['microbot','Microbot','80'],['nanorobot','Nanorobot','83'],['android','Android','86'],['biological','Biological robot','89'],
 ['cyborg','Cyborg','93'],['avatar','Avatar','95'],['clone','Clone','98'],['missile','Missile robot','100'],['vehicle-brain','Vehicle brain','102'],['ship-brain','Ship brain','103']
].map(([id,label,pages])=>choice(id,label,'79–105',{implemented:false,reason:'This type requires its own design sequence; implementation and source verification are pending.'}))];
const select=(field,label,choices,category)=>({field,label,type:'select',choices,...(category?{category}:{})});
const number=(field,label,min,max,pages,category)=>({field,label,type:'number',min,max,step:1,source:source(pages),...(category?{category}:{})});
const boolean=(field,label,pages,category)=>select(field,label,[choice(false,'No',pages),choice(true,'Yes',pages)],category);
export const STAGES = [
 {id:'chassis',label:'Chassis Size',description:'Ordinary robot chassis sizes. Special designs have separate, currently blocked paths.',controls:[select('size','Chassis size',SIZES)]},
 {id:'locomotion',label:'Locomotion',description:'Select primary and optional secondary movement systems.',controls:[select('primary','Primary locomotion',LOCOMOTION),select('secondary','Secondary locomotion',[choice('none','No secondary system','23'),...LOCOMOTION.filter(x=>x.id!=='none')])]},
 {id:'physical',label:'Physical Options',description:'Only implemented controls are calculated. The coverage list records outstanding option families.',controls:[
 number('armourAdded','Additional armour',0,60,'19','Chassis Modifications'),boolean('armourRemoved','Remove one point of base armour','19','Chassis Modifications'),
 boolean('efficiency','Improved efficiency','19–20','Chassis Modifications'),number('powerPacks','Additional power packs',0,3,'19–20','Chassis Modifications'),number('resiliency','Hit adjustment',-36,64,'20','Chassis Modifications'),
 number('agility','Agility enhancement',0,4,'22','Locomotive Modifications'),number('tacticalSpeed','Tactical movement adjustment',-6,7,'22','Locomotive Modifications'),boolean('vehicleSpeed','Vehicle speed movement','23','Locomotive Modifications'),{...number('vehicleBands','Extra vehicle speed bands',0,3,'23','Locomotive Modifications'),visibleWhen:{field:'vehicleSpeed',equals:true}},
 {field:'defaultSuite',label:'Default suite (up to five items)',category:'Default Suites',type:'multiselect',maxItems:5,choices:OPTIONS.filter(o=>o.zeroSlot)},
 {field:'options',label:'Installed options',type:'multiselect',choices:OPTIONS},
 {field:'optionParameters',label:'Installed option settings',type:'option-parameters',choices:OPTIONS},
 {field:'manipulators',label:'Manipulators',type:'manipulators',baseIds:['base-1','base-2'],kinds:[{id:'additional',label:'Additional arm'},{id:'leg',label:'Converted walker leg'}],itemFields:[select('size','Manipulator size',[{id:'chassis',label:'Match chassis'},...Array.from({length:10},(_,i)=>({id:i+1,label:`Size ${i+1}`}))]),number('strengthIncrease','STR increase',0,19,'26'),number('dexterityIncrease','DEX increase',0,13,'26')],category:'Manipulator Modification',source:source('25–26'),description:'Two base arms; additional arms and converted walker legs may be specified. Empty list removes both base arms.'}
 ]},
 {id:'brain',label:'Robot Brain',description:'Brain generation controls inherent bandwidth; storage upgrades do not increase the per-package limit.',controls:[select('model','Brain model',BRAINS),select('bandwidthUpgrade','Bandwidth upgrade',BANDWIDTH),number('intellectUpgrade','Intellect increase',0,3,'67'),boolean('hardened','Hardened brain and storage','67')]},
 {id:'skills',label:'Skill Packages',description:'Standard packages. Positive-level speciality packages and hard-coded primitive/basic packages remain blocked.',controls:[select('corePackage','Hard-coded package',CORE_PACKAGES),{field:'packages',label:'Installed packages',type:'multiselect',choices:PACKAGES}]},
 {id:'finalisation',label:'Finalisation',description:'Remove only genuinely unused slots; the original base slots remain the basis for other costs.',controls:[number('removedSlots','Permanently remove unused slots',0,160,'13'),select('priceMode','Final price',[choice('construction','Calculated construction cost','76'),choice('custom','Custom list price (book-permitted adjustment)','76')]),{...number('customPrice','Custom final list price (Cr)',0,Number.MAX_SAFE_INTEGER,'76'),visibleWhen:{field:'priceMode',equals:'custom'}}]}
];
export const COVERAGE = {complete:false,scope:'Verified ordinary construction subset; not full Handbook coverage.',gaps:[
 {id:'option-catalogue',message:'224 source-cited ordinary option rows are catalogued. Short-duration RTG pricing, autoloaders, detailed weapon integration and conditional operational performance require additional handling.',source:source('29–64')},
 {id:'special-types',message:'Special robot forms, clones, vehicle brains and ship brains are blocked.',source:source('79–105')},
 {id:'hardcoded-packages',message:'Weapon-specific hard-coded packages and Hunter/Killer bandwidth interpretation remain blocked.',source:source('69–73')},
 {id:'speciality-packages',message:'Electronics and Engineer specialities (including four-package all-speciality coverage) are implemented. Other positive-level specialities require verified source enumeration.',source:source('73–74')},
 {id:'finalisation',message:'Complete finalisation including all cost adjustments and characteristic/trait output is pending.',source:source('76–78')}
]};
export function getCatalogue(){return clone({schemaVersion:1,kinds:KINDS,techLevels:Array.from({length:12},(_,i)=>({id:i+7,label:`TL${i+7}`})),stages:STAGES,coverage:COVERAGE});}
