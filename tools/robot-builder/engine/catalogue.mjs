import {verifiedVehicleControl} from './verified-vehicle-options.mjs';
import {externalVehicleControl} from './vehicle-options.mjs';
import {externalWearControl} from './csc-worn-weapons.mjs';
import {weaponControl} from './weapons.mjs';
import {SPECIALITIES,SOURCE_SPECIALITIES,CUSTOM_PACKAGE_FIELDS} from './skills-data.mjs';
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
 ['self-aware',15,10,1000000,12,4],['self-aware',16,15,1000000,13,4],['conscious',17,20,5000000,15,5],['conscious',18,30,1000000,15,5],['conscious',19,50,1000000,18,5]
].map(([family,tl,bandwidth,cost,intelligence,rank])=>choice(`${family}-tl${tl}`,`${({'primitive':'Primitive','basic':'Basic','hunter-killer':'Hunter/Killer','advanced':'Advanced','very-advanced':'Very Advanced','self-aware':'Self-Aware','conscious':'Conscious'})[family]} (TL${tl})`,'65–67',{family,tl,bandwidth,cost,intelligence,rank,...(tl===19?{source:source('104')}: {})}));
BRAINS.push(choice('none','No onboard brain (drone)','78-79',{family:'none',tl:6,bandwidth:0,cost:0,intelligence:0,rank:0}));
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
for(const [skillId,specialities] of Object.entries(SPECIALITIES)){
 const skill=SKILLS.find(s=>s.id===skillId);
 const allId=['electronics','engineer'].includes(skillId)?'all':'all-listed';
 // Old referee IDs covered only listed examples. Preserve saved scope; full coverage is a new explicit choice.
 const legacyBroad=skillId==='profession'||skillId==='art'?[]:skillId==='science'?['all-referee-four','all-referee-eight']:['all-referee-four'];
 const broadChoices=[...legacyBroad,'all-referee-four-full','all-referee-eight-full'];
 for(const speciality of [...specialities,allId,...broadChoices])for(const level of [1,2,3]){
  const refereeBroad=speciality.startsWith('all-referee-'),broad=speciality===allId||refereeBroad,count=refereeBroad?(speciality.includes('-eight')?8:4):broad?specialities.length:1,fullCoverage=refereeBroad&&speciality.endsWith('-full'),requiresInstrument=skillId==='art'&&!fullCoverage&&(speciality==='instrument'||broad);
  const scopeLabel=refereeBroad?(fullCoverage?'all specialities; referee '+count+'-package rule':'listed only; legacy referee '+count+'-package selection'):speciality.replaceAll('-',' ');
  PACKAGES.push(choice(skillId+'-'+speciality.toLowerCase()+'-'+level,skill.label+' ('+scopeLabel+') '+level,'73-75',{
   skill:skillId,speciality,level,tl:skill.tl+level,bandwidth:(skill.bandwidth+level)*count,perPackageBandwidth:skill.bandwidth+level,packageCount:count,cost:skill.cost*10**level*count,characteristic:skill.characteristic,
   specialtySource:{book:'Core Rulebook Update 2022',pages:'64-72'},...(broad?{coveredSpecialities:specialities}:{}),...(fullCoverage?{coversAllSpecialities:true}:{}),...(refereeBroad?{refereeBroad:true}:{}),
   ...(requiresInstrument?{implemented:false,reason:'Name the actual instrument in a custom package.'}:{})
  }));
 }
}
const optionAliases={'visual-spectrum-sensor':'visual-spectrum','voder-speaker':'voder','auditory-sensor':'auditory','wireless-data-link':'wireless','transceiver-5km-improved':'transceiver-improved','transceiver-5km-basic':'transceiver-basic','video-screen-basic':'video-basic'};
for(const [skillId,specialities] of Object.entries(SOURCE_SPECIALITIES))for(const speciality of specialities)for(const level of [1,2,3]){
 const skill=SKILLS.find(s=>s.id===skillId);
 PACKAGES.push(choice(`${skillId}-${speciality.id}-${level}`,`${skill.label} (${speciality.id}, CSC 2023) ${level}`,'73-75',{
  skill:skillId,speciality:speciality.id,level,tl:skill.tl+level,bandwidth:skill.bandwidth+level,perPackageBandwidth:skill.bandwidth+level,packageCount:1,cost:skill.cost*10**level,characteristic:skill.characteristic,specialtySource:speciality.source
 }));
}
export const OPTIONS=OPTIONS_ARRAY.map(row=>({...row,id:optionAliases[row.id]??row.id,...(row.category==='Weapons'?{label:row.label+' (unassociated hardware)',description:'For a complete installation use Installed weapons. This legacy hardware entry is separate and does not supply or connect to a weapon record.',preferredEditor:'weapons'}:{}),parameterControls:[
 ...(row.repeatable||row.slotsBasis==='allocated'?[{field:'quantity',label:row.slotsBasis==='allocated'?'Allocated slots':'Quantity',type:'number',min:1,max:1000,default:1,step:1,appliesTo:'options'}]:[]),
 ...(row.zeroSlot?[{field:'suiteQuantity',label:'Default-suite copies',type:'number',min:1,max:5,default:1,step:1,appliesTo:'defaultSuite'}]:[]),
 ...(['rtg-long-duration','rtg-short-duration'].includes(row.family)?[{field:'powerCondition',label:'RTG operating condition',type:'select',default:'full',choices:[{id:'full',label:'Before rated half-life'},{id:'degraded',label:'After one rated half-life'},{id:'expired',label:'After twice rated half-life'}]}]:[]),
 ...(row.family==='solar-power-unit'?[{field:'panelState',label:'Solar panels',type:'select',default:'deployed',choices:[{id:'deployed',label:'Deployed'},{id:'stowed',label:'Stowed'}]}]:[]),
 ...(row.requiresPriceInterpretation?[{field:'costInterpretation',label:'Short RTG price interpretation',type:'select',default:'unresolved',choices:[{id:'unresolved',label:'Resolve table/prose conflict'},{id:'baseSlots',label:'Prose: cost per chassis Base Slot'},{id:'installedSlots',label:'Table: cost per installed option Slot'}]}]:[]),
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
 implemented:true}))
];

export const KINDS = [choice('standard','Ordinary robot','13–78'),...[
 ['metamorphic','Metamorphic (provisional)','104'],['drone','Drone','79'],['microbot','Microbot','80'],['nanorobot','Nanorobot','83'],['android','Android','86'],['biological','Biological robot','89'],
 ['cyborg','Cyborg','93'],['avatar','Avatar','95'],['clone','Clone','98'],['missile','Missile robot','100'],['vehicle-brain','Vehicle brain','102'],['ship-brain','Ship brain','103']
].map(([id,label,pages])=>choice(id,label,'79–105',{implemented:false,reason:'This type requires its own design sequence; implementation and source verification are pending.'}))];
const select=(field,label,choices,category)=>({field,label,type:'select',choices,...(category?{category}:{})});
const number=(field,label,min,max,pages,category)=>({field,label,type:'number',min,max,step:1,source:source(pages),...(category?{category}:{})});
const boolean=(field,label,pages,category)=>select(field,label,[choice(false,'No',pages),choice(true,'Yes',pages)],category);
export const STAGES = [
 {id:'chassis',label:'Chassis Size',description:'Choose an ordinary chassis size. Special designs use their own scoped body, biological or integration rules; see the selected type’s notes and remaining gaps.',controls:[select('size','Chassis size',SIZES)]},
 {id:'locomotion',label:'Locomotion',description:'Select primary and optional secondary movement systems.',controls:[select('primary','Primary locomotion',LOCOMOTION),select('secondary','Secondary locomotion',[choice('none','No secondary system','23'),...LOCOMOTION.filter(x=>x.id!=='none')])]},
 {id:'physical',label:'Physical Options',description:'Only implemented controls are calculated. The coverage list records outstanding option families.',controls:[
 number('armourAdded','Additional armour',0,60,'19','Chassis Modifications'),boolean('armourRemoved','Remove one point of base armour','19','Chassis Modifications'),
 boolean('efficiency','Improved efficiency','19–20','Chassis Modifications'),number('powerPacks','Additional power packs',0,3,'19–20','Chassis Modifications'),number('resiliency','Hit adjustment',-36,64,'20','Chassis Modifications'),
 number('agility','Agility enhancement',0,4,'22','Locomotive Modifications'),number('tacticalSpeed','Tactical movement adjustment',-6,7,'22','Locomotive Modifications'),boolean('vehicleSpeed','Vehicle speed movement','23','Locomotive Modifications'),{...number('vehicleBands','Extra vehicle speed bands',0,3,'23','Locomotive Modifications'),visibleWhen:{field:'vehicleSpeed',equals:true}},
 select('powerMode','Operating power assumption',[choice('conventional','Conventional power / added packs','19,55-57'),choice('direct-connection','Direct connection to an external supply','19,55-56'),choice('alternate-full','Installed RTG / solar units at full capability','55-57'),choice('conditioned-alternative','RTG / solar units under selected conditions','55-57'),choice('solar-coating-only','Solar coating only','33')],'Slot Cost Options'),
 {field:'defaultSuite',label:'Default suite (up to five items)',category:'Default Suites',type:'multiselect',maxItems:5,choices:OPTIONS.filter(o=>o.zeroSlot)},
 {field:'options',label:'Installed options',type:'multiselect',choices:OPTIONS},
 externalWearControl(),weaponControl(),verifiedVehicleControl(),externalVehicleControl(OPTIONS),
 { ...select('solarLight','Available solar light',[choice('full','Adequate sunlight','33,57'),choice('low','Low light / cloudy / indoors','33,57'),choice('none','No sunlight','33,57')],'Slot Cost Options'),visibleWhen:{field:'powerMode',oneOf:['conditioned-alternative','solar-coating-only']}},
 { ...select('solarZone','Distance beyond habitable zone',[choice('habitable','Habitable zone','33,57'),choice('first-cold','One orbit beyond','33,57'),choice('second-cold','Two orbits beyond','33,57'),choice('frozen','Three orbits beyond','33,57'),choice('outer','Four or more orbits beyond','33,57')],'Slot Cost Options'),visibleWhen:{field:'powerMode',oneOf:['conditioned-alternative','solar-coating-only']}},
 { ...select('alternativeActivity','Solar unit activity',[choice('normal','Normal solar-powered activity','57'),choice('quarter','Quarter-power activity','57'),choice('stationary','Stationary / limited physical activity','57')],'Slot Cost Options'),visibleWhen:{field:'powerMode',equals:'conditioned-alternative'}},
 { ...select('coatingPowerRule','Solar-coating STR / Agility interpretation',[choice('unresolved','Unresolved source scope','33,55'),choice('coating-specific','Use coating-specific movement restrictions','33'),choice('general-power','Apply general STR / Agility penalties too','33,55')],'Slot Cost Options'),visibleWhen:{field:'powerMode',equals:'solar-coating-only'}},
 {field:'optionInstances',label:'Separate equipment installations',type:'option-instances',maxItems:100,addLabel:'Add separate installation',choices:OPTIONS.map(o=>{const parameterControls=o.parameterControls.filter(c=>c.appliesTo!=='defaultSuite');return {...o,parameterControls,defaultParameters:Object.fromEntries(parameterControls.map(c=>[c.field,c.default??(c.type==='text'?'':c.type==='select'?c.choices[0].id:1)]))};}),source:source('29-64')},
 {field:'optionParameters',label:'Installed option settings',type:'option-parameters',choices:OPTIONS},
 {field:'manipulators',label:'Manipulators',type:'manipulators',baseIds:['base-1','base-2'],kinds:[{id:'additional',label:'Additional arm'},{id:'leg',label:'Converted walker leg'}],itemFields:[select('size','Manipulator size',[{id:'chassis',label:'Match chassis'},...Array.from({length:10},(_,i)=>({id:i+1,label:`Size ${i+1}`}))]),number('strengthIncrease','STR increase',0,19,'26'),number('dexterityIncrease','DEX increase',0,13,'26')],category:'Manipulator Modification',source:source('25–26'),description:'Two base arms; additional arms and converted walker legs may be specified. Empty list removes both base arms.'}
 ]},
 {id:'brain',label:'Robot Brain',description:'Brain generation controls inherent bandwidth; storage upgrades do not increase the per-package limit.',controls:[select('model','Brain model',BRAINS),select('bandwidthUpgrade','Bandwidth upgrade',BANDWIDTH),number('intellectUpgrade','Intellect increase',0,3,'67'),boolean('hardened','Hardened brain and storage','67')]},
 {id:'skills',label:'Skill Packages',description:'Choose published specialities or a book-permitted custom language, profession, science field or instrument. Profession never grants other specialities at level zero.',controls:[select('corePackage','Hard-coded package',CORE_PACKAGES),{...select('servantProfession','Servant profession',[choice('domestic-servant','Domestic servant','70'),choice('domestic-cleaner','Domestic cleaner','70')]),visibleWhen:{field:'corePackage',equals:'basic-servant'}},{...select('targetMode','Target package',[choice('explosives','Explosives and Recon','72'),choice('weapon','Installed weapon and Recon','72')]),visibleWhen:{field:'corePackage',equals:'basic-target'}},select('coreWeapon','Hard-coded weapon speciality',[choice('unspecified','Select a weapon speciality','69-73'),...['gun-combat','melee','heavy-weapons','gunner'].flatMap(skill=>SPECIALITIES[skill].map(speciality=>choice(skill+':'+speciality,SKILLS.find(s=>s.id===skill).label+' ('+speciality.replaceAll('-',' ')+')','69-73')))]),select('hunterBandwidth','Hunter/Killer package bandwidth interpretation',[choice('unresolved','Unresolved source ambiguity','72-73'),choice('zero','Referee interpretation: hard-coded package uses 0 BW','72-73'),choice('one','Referee interpretation: hard-coded package uses 1 BW','72-73')]),{field:'packages',label:'Installed packages',type:'multiselect',choices:PACKAGES},{field:'customPackages',label:'Custom specialities permitted by the book',type:'custom-packages',maxItems:200,itemFields:CUSTOM_PACKAGE_FIELDS,source:{book:'Core Rulebook Update 2022',pages:'64-72'}}]},
 {id:'finalisation',label:'Finalisation',description:'Remove only genuinely unused slots; the original base slots remain the basis for other costs.',controls:[number('removedSlots','Permanently remove unused slots',0,160,'13'),select('priceMode','Final price',[choice('construction','Calculated construction cost','76'),choice('custom','Custom list price (book-permitted adjustment)','76')]),{...number('customPrice','Custom final list price (Cr)',0,Number.MAX_SAFE_INTEGER,'76'),visibleWhen:{field:'priceMode',equals:'custom'}}]}
];
for(const control of STAGES.find(s=>s.id==='skills').controls){
 if(control.field==='coreWeapon'){
  control.visibleWhen={field:'corePackage',oneOf:['primitive-homing','basic-security','basic-target','hunter-standard','hunter-tactical']};
  for(const [skill,specialities]of Object.entries(SOURCE_SPECIALITIES))for(const speciality of specialities)control.choices.push(choice(skill+':'+speciality.id,SKILLS.find(s=>s.id===skill).label+' ('+speciality.id+', CSC 2023)','69-73',{specialtySource:speciality.source}));
 }
 if(control.field==='hunterBandwidth')control.visibleWhen={field:'corePackage',oneOf:['hunter-standard','hunter-tactical']};
}
export const COVERAGE = {complete:false,scope:'Selected-rule construction checks, not certification of every possible Handbook design.',supportedTechLevels:{minimum:5,maximum:23,note:'Displayed implementation scope follows published component and high-technology milestones, not a universal campaign TL limit. Ordinary armour below TL6 remains unresolved.'},gaps:[
 {id:'metamorphic-body',status:'provisional-supported',message:'Provisional current-form construction uses the printed tier rate against immutable Base Slots, ordinary chassis/equipment costs, zero additional body reservation and ordinary manipulator rules. These fixed application assumptions are not RAW. Size and locomotion remain fixed; transient forms, arbitrary free limbs and combat simulation are not implemented.',source:source('104')},
 {id:'high-tech-backup-services',message:'Published high-tech backup, restore, continuous-backup implant and body-transformation prices are reference estimates. Compatible bodies, storage, implanted capacity and actual transfer procedures remain separate source-dependent work.',source:source('104,113')},
 {id:'open-fabrication-output',message:'Superior and open fabrication have installed Slot/cost accounting. Maximum external output size, controller compatibility, feedstock and licensed source templates remain qualified operating prerequisites, not unlimited manufacturing.',source:source('51-52,105')},
 {id:'vehicle-option-conversion',message:'Handbook conversion is64 robot Slots per vehicle Space, with robot-book equivalents taking precedence. External records calculate qualified conversion estimates while blocking source/prerequisite certification. Three source-verified Update 2026 dischargers, six fixed-Space utility choices, four whole-robot-priced parachutes and allocated whole-Space UNREP use immutable catalogue facts with individually scoped operation. Other items, prototype variants, charge procurement and full vehicle-host construction remain separate work.',source:source('62')},
 {id:'weapons',message:'Core priced melee, slug, energy, portable heavy weapons and vehicle weapons up to250kg support mounts, links and autoloaders. Grenade launchers use four Core grenade types. Unpriced/improvised weapons, standalone explosives, auxiliary grenade-launcher accessories, external weapon books, loose ammunition storage and complete attack-context resolution remain incomplete.',source:source('60-64')},
 {id:'power-conditions',message:'Direct connection, coating grade/light/orbit caps, single-source RTG degradation and solar-unit quarter power have selected-state projections. Mixed degraded sources, dark stored-energy history and stationary usable STR remain unresolved; coating STR/Agility scope is an explicit interpretation.',source:source('33,55-57')},
 {id:'short-rtg-interpretation',message:'Short RTG table/prose pricing conflicts are exposed as an explicit user/referee interpretation, not silently reconciled.',source:source('56')},
 {id:'generic-weapon-associations',message:'Independent equipment instances support distinct field/species details and quantities. Generic fire-control options still require validated weapon associations; use weapon records.',source:source('41-64')},
 {id:'aeroplane-speed',message:'Aeroplane vehicle-speed mapping is absent from the p23 table and remains blocked pending a disclosed source interpretation.',source:source('17,23')},
 ...OPTIONS.filter(o=>!o.implemented).map(o=>({id:'option-'+o.id,message:o.label+': '+o.reason,source:o.source}))
]};
export function getCatalogue(){return clone({schemaVersion:1,kinds:KINDS,techLevels:Array.from({length:19},(_,i)=>({id:i+5,label:`TL${i+5}`})),stages:STAGES,coverage:COVERAGE});}
