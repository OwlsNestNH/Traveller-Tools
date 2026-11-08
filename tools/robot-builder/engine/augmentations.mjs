import {CSC_MASS_DEVICES} from './csc-mass-devices.mjs';
import {CSC_COMPACT_TOOLS} from './csc-compact-tools.mjs';
import {CSC_SIGNAL_DEVICES} from './csc-signal-devices.mjs';
import {HANDBOOK_MASS_DEVICES} from './handbook-mass-devices.mjs';
import {computerParameters,neuralComputerParameters,computerSoftwareControl,validateComputerSoftware,evaluateComputer,isComputerId} from './computer-implants.mjs';
import {weaponControl,validateWeapons,evaluateWeapons} from './weapons.mjs';
import {evaluateBrainSoftware,validateSoftwareSelection} from './brain-software.mjs';
import {equipmentCapabilities} from './capabilities.mjs';
import {CUSTOM_PACKAGE_FIELDS} from './skills-data.mjs';
import {OPTIONS,BANDWIDTH,PACKAGES} from './catalogue.mjs';
import {evaluateEquipment,validateOptionInstances} from './equipment.mjs';
const source=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const clone=value=>JSON.parse(JSON.stringify(value));
const number=(field,label,min,max,value)=>({field,label,type:'number',min,max,default:value});
const select=(field,label,rows,value)=>({field,label,type:'select',choices:rows.map(([id,label])=>({id,label})),default:value});
const text=(field,label,value='primary')=>({field,label,type:'text',maxLength:80,default:value});
const yesno=(field,label)=>select(field,label,[['no','No'],['yes','Yes']],'no');
const LIMB_INTERFACES={basic:{tl:8,dexterity:6,endurance:300,cost:20000},improved:{tl:10,dexterity:10,endurance:null,cost:10000},enhanced:{tl:12,dexterity:12,endurance:null,cost:20000},advanced:{tl:14,dexterity:15,endurance:null,cost:50000}};
const SENSORY_INTERFACES={ear:{tl:7,cost:2000},eye:{tl:8,cost:10000},nose:{tl:9,cost:10000},tongue:{tl:9,cost:10000}};
const SENSOR_ROWS=[
 ['ear-basic','Basic cybernetic ear','ear',7,1000,{hearingHz:[20,20000]}],['ear-improved','Improved cybernetic ear','ear',9,5000,{hearingHz:[1,100000],heightenedSenses:true}],
 ['eye-basic','Basic cybernetic eye','eye',8,5000,{visionDexterityDM:-2}],['eye-improved','Improved cybernetic eye','eye',10,10000,{standardVision:true}],['eye-enhanced','Enhanced cybernetic eye','eye',13,10000,{binocularZoom:true,infraredVision:true,lightIntensifier:true}],['eye-advanced','Advanced cybernetic eye','eye',14,20000,{prisVision:true,infraredVision:true,ultravioletVision:true}],
 ...['nose','tongue'].flatMap(sense=>[[`${sense}-basic`,`Basic cybernetic ${sense}`,sense,9,5000,{crudeChemicalSense:true}],[`${sense}-improved`,`Improved cybernetic ${sense}`,sense,11,10000,{vargrLevelSensitivity:true,heightenedSenses:true}],[`${sense}-advanced`,`Advanced cybernetic ${sense}`,sense,13,20000,{traceChemicalDetection:true,heightenedSenses:true}]])
];
const NEURAL_ROWS=[['neural-comm-basic','Basic neural comm',10,1000,'comm',null,'audio'],['neural-comm-improved','Improved neural comm',12,5000,'comm',0,'visual'],['neural-comm-advanced','Advanced neural comm',14,20000,'comm',1,'full sensory'],['neural-link-basic','Basic neural link',13,30000,'link',0,'visual'],['neural-link-improved','Improved neural link',14,45000,'link',1,'full sensory']];
const BRAIN_ROWS=[['brain-implant-basic','Basic robot brain implant',13,100000,2,8],['brain-implant-improved','Improved robot brain implant',14,1000000,3,9],['brain-implant-enhanced','Enhanced robot brain implant',15,1500000,4,10],['brain-implant-advanced','Advanced robot brain implant',16,2000000,5,11]];
const coreSource=pages=>({book:'Core Rulebook Update 2022',edition:'Mongoose 2022',pages});
const MASS_DEVICES=[
 ...CSC_MASS_DEVICES,
 ...CSC_COMPACT_TOOLS,
 ...CSC_SIGNAL_DEVICES,
 ...HANDBOOK_MASS_DEVICES,
 {id:'computer-terminal-7',label:'Computer terminal (TL7)',tl:7,massKg:2,cost:200,source:coreSource('111'),effects:{processing:0,includedSoftware:['Interface/0'],networkRequired:true,independentProcessing:false,robotBrain:false}},
 {id:'electronics-toolkit-7',label:'Electronics toolkit (TL7)',tl:7,massKg:2,cost:2000,source:coreSource('120'),effects:{electronicsToolkit:true,taskTechnologyModifiers:{minimumGap:2,lowerTaskTL:2,higherTaskTL:-2},recipientSkillGranted:false}},
 ...[[8,1,1000,0],[10,1,1500,1],[12,1,5000,2],[14,0,10000,3]].map(([tl,massKg,cost,firstAidDM])=>({id:'medikit-'+tl,label:'Medikit (TL'+tl+')',tl,massKg,cost,source:coreSource('114'),effects:{firstAidDM,condition:'First aid with appropriate use; not a universal Medic modifier',recipientSkillGranted:false}})),
 ...[[7,0,5,500],[8,1,2,250],[9,1,1,100],[10,2,.5,500],[11,2,.5,300],[12,3,.5,1000],[13,4,.5,1500],[14,5,.5,5000]].map(([tl,processing,massKg,cost])=>({id:'portable-computer-'+tl,label:'Portable Computer/'+processing+' (TL'+tl+')',tl,massKg,cost,source:coreSource('110,112'),effects:{processing,includedSoftware:tl>=8?['Interface/0','Security/0']:['Interface/0'],purchasedExpertAgentIntellectIncluded:false,robotBrain:false}})),
 ...[['binoculars-3','Binoculars',3,1,75,{distantVision:true}],['binoculars-8','Electronic binoculars',8,1,750,{imageCapture:true,lightIntensification:true}],['binoculars-12','PRIS binoculars',12,1,3500,{emSpectrum:'Infrared through gamma rays'}],['em-probe','EM probe',10,1,1000,{detectsElectromagneticEmissions:true}],['geiger-5','Geiger counter',5,2,250,{detectsRadiation:true}],['light-intensifier-7','Light intensifier goggles',7,1,500,{lowLightVision:true,totalDarkness:false}]].map(([id,label,tl,massKg,cost,effects])=>({id,label,tl,massKg,cost,effects,source:coreSource('116-117')}))
];
const MISC_OPTIONS=OPTIONS.filter(o=>o.implemented===true&&o.costBasis==='each'&&Number.isFinite(o.slots)&&o.slots>=0&&o.slots<=1&&o.id!=='no-internal-power'&&(!o.allowedKinds||o.allowedKinds.includes('cyborg')));
const ORGAN_ROWS=[['organ-basic','Basic artificial organ',7,50000],['organ-improved','Improved artificial organ',9,50000],['organ-enhanced','Enhanced artificial organ',11,100000],['organ-advanced','Advanced artificial organ',13,200000]];
const modifierFields=()=>[
 yesno('detachable','Detachable socket (external augment only)'),yesno('remote','Remote operation while detached'),yesno('grav','Grav movement while detached'),
 select('invisitech','Invisitech',[['none','None'],['tl12','Electronic concealment (TL12)'],['tl16','Electronic and psionic concealment (TL16)']],'none'),
 select('naturalLooking','Natural-looking',[['none','None'],['tl10','Passing appearance, Deception +2 (TL10)'],['tl14','Improved appearance, Deception +4 (TL14)']],'none'),
 yesno('ruggedised','Ruggedised circuitry'),yesno('selfRepairing','Self-repairing augment (TL14)')
].map(c=>({...c,group:'Optional modifications'}));
function row(id,label,type,tl,cost,extra={}){return{id,label,type,tl,cost,implemented:true,source:source(type==='limb'?'89-90':type==='sensor'?'90-91':'91'),...extra};}
export function getAugmentationCatalogue(design={}){
 const quantity=()=>number('quantity','Identical copies',1,20,1),placement=()=>select('placement','Placement',[['replacement','Replace natural part'],['additional','Additional part beyond normal anatomy']],'replacement');
 const limbFields=type=>[quantity(),placement(),number('size','Manipulator-equivalent Size',1,10,type==='leg'?6:(design.techLevel??13)<=10?6:5),select('interfaceTier','Limb interface grade',Object.keys(LIMB_INTERFACES).map(id=>[id,`${id} (TL${LIMB_INTERFACES[id].tl})`]),(design.techLevel??13)<10?'basic':'improved'),number('strengthIncrease','Limb STR increase',0,19,0),number('dexterityIncrease','Limb DEX increase',0,13,0),...(type==='leg'?[number('movementIncrease','Movement increase above 6 metres',0,9,0)]:[]),number('armourAdded','Added limb armour',0,60,0),...modifierFields()];
 return clone([row('biacs-master','BIACS master augmentation interface','master',13,100000,{source:source('89,95'),parameterControls:[number('masterDexterity','Referee-specified master DEX cap (0 = unresolved)',0,23,0),...modifierFields()]}),row('cybernetic-arm','Cybernetic arm','limb',8,null,{limb:'arm',parameterControls:limbFields('arm')}),row('cybernetic-leg','Cybernetic leg','limb',8,null,{limb:'leg',parameterControls:limbFields('leg')}),
 ...SENSOR_ROWS.map(([id,label,sense,tl,cost,effects])=>row(id,label,'sensor',tl,cost,{sense,effects,parameterControls:[quantity(),placement(),text('interfaceGroup','Shared normal-sense interface group'),...modifierFields()]})),
 ...MASS_DEVICES.map(device=>row('misc-mass-'+device.id,'Implanted '+device.label,'misc-mass',device.tl,device.cost,{source:source('92'),device,parameterControls:[quantity(),select('interfaceMode','Implant control interface',[['limb','Dedicated limb-equivalent interface'],['neural','Installed neural link']],'limb'),select('interfaceTier','Dedicated interface grade',Object.keys(LIMB_INTERFACES).map(id=>[id,id]),'improved'),...(device.effects.electronicsToolkit?[select('electronicsSpeciality','Electronics toolkit speciality',[['comms','Communications'],['computers','Computers'],['remote-ops','Remote operations'],['sensors','Sensors']],'computers')]:[]),...(device.effects.processing!==undefined?[yesno('computerComms','Specify computer comms at purchase (TL8+)'),...computerParameters()]:[]),...modifierFields()]})),
 ...MISC_OPTIONS.map(o=>row('misc-'+o.id,'Implanted '+o.label,'misc',o.tl,o.cost,{source:source('92'),device:o,parameterControls:[quantity(),select('interfaceMode','Implant control interface',[['limb','Dedicated limb-equivalent interface'],['neural','Installed neural link']],'limb'),select('interfaceTier','Dedicated interface grade',Object.keys(LIMB_INTERFACES).map(id=>[id,id]),'improved'),...o.parameterControls.filter(c=>c.field!=='quantity'&&c.appliesTo!=='defaultSuite'),...modifierFields()]})),
 ...BRAIN_ROWS.map(([id,label,tl,cost,bandwidth,intelligence])=>row(id,label,'brain',tl,cost,{source:source('92'),bandwidth,intelligence,parameterControls:[{...select('implantRetrotech','Later-TL implant hardware price',[['unresolved','Unresolved: printed implant price or p67 retrotech'],['printed-price','Use printed p92 implant price'],['ordinary-retrotech','Apply p67 halving per TL from implant introduction']],'unresolved'),source:source('67,92')},select('bandwidthUpgrade','Bandwidth module',BANDWIDTH.map(o=>[o.id,o.label]),'none'),number('intellectUpgrade','Implant INT increase',0,3,0),yesno('brainHardened','Harden brain and bandwidth module'),{field:'softwarePackages',label:'Implant skill software',type:'multiselect',choices:PACKAGES,default:[],maxItems:100,group:'Skill software'},{...select('softwareModifierBasis','Software in cybernetic percentage basis',[['unresolved','Unresolved: pp89/94 do not explicitly exclude software'],['include-all-fixed-costs','Include software among all fixed costs (pp89/94)'],['physical-only','Referee interpretation: exclude software from physical modifiers']],'unresolved'),group:'Optional modifications',source:source('89,93-94')},...modifierFields()]})),
 ...NEURAL_ROWS.map(([id,label,tl,cost,neuralType,computer,sensory])=>row(id,label,'neural',tl,cost,{source:source('92'),neuralType,computer,sensory,parameterControls:[yesno('computerUpgrade','Computer/2 upgrade (TL15)'),...(computer!==null?neuralComputerParameters():[]),...modifierFields()]})),
 ...ORGAN_ROWS.map(([id,label,tl,cost])=>row(id,label,'organ',tl,cost,{parameterControls:[quantity(),select('complexity','Organ complexity',[['major','Major organ, e.g. heart or lung'],['simple','Simpler organ, e.g. liver or kidney']],'major'),text('procedureGroup','Same procedure-session group'),select('externalPower','External power for basic organ',[['unconfirmed','Not confirmed'],['provided','Provided separately']],'unconfirmed'),...modifierFields()] }))]);
}
const standardLimbWeapon=({parentLimb,...record})=>({...record,manipulatorId:record.placement==='arm'?parentLimb:'none'});
function limbWeaponControl(design){
 const parents=(design.special?.augmentations??[]).filter(r=>['cybernetic-arm','cybernetic-leg'].includes(r.optionId)).map((r,i)=>[r.id,'Cybernetic '+r.optionId.replace('cybernetic-','')+' '+(i+1)]);
 const {category,...base}=weaponControl({techLevel:design.techLevel??13,selections:{physical:{manipulators:[],options:[],optionInstances:design.special?.augmentOptions??[]}}});
 return {...base,field:'augmentWeapons',label:'Weapons installed in cybernetic limbs',stage:'physical',default:[],ledgerPrefix:'augment:',collapsedByDefault:true,canAdd:parents.length>0,unavailableReason:parents.length?null:'Add a cybernetic arm or leg before installing weapons.',prerequisiteReady:parents.length>0,prerequisiteHint:parents.length?'Choose the existing parent limb for each weapon.':'Add a cybernetic arm or leg before installing weapons.',description:'Mounts, fire control and ammunition occupy the parent limb capacity. Every identical limb copy receives this installation; recipient skills are external.',itemFields:[select('parentLimb','Parent cybernetic limb',parents.length?parents:[['unassigned','Add a limb first']],'unassigned'),...base.itemFields.filter(c=>c.field!=='manipulatorId').map(c=>c.field==='placement'?{...c,label:'Limb weapon mounting',choices:[{id:'body',label:'Internal separate servo (no limb characteristic DM)'},{id:'arm',label:'Limb attachment (actual Size and DEX)'}]}:c)],source:source('60-64,89-90')};
}
export function getAugmentationControls(design={}){
 const records=design.special?.augmentations??[],parents=records.filter(r=>['cybernetic-arm','cybernetic-leg'].includes(r.optionId)||r.optionId.startsWith('neural-')).map((r,i)=>[r.id,(getAugmentationCatalogue(design).find(o=>o.id===r.optionId)?.label??'Augment')+' '+(i+1)]);
 const choices=OPTIONS.filter(o=>o.id!=='no-internal-power'&&(!o.allowedKinds||o.allowedKinds.includes('cyborg'))).map(o=>({...o,parameterControls:[select('parentLimb','Parent limb or neural implant',parents.length?parents:[['unassigned','Add a limb first']],'unassigned'),...o.parameterControls.filter(c=>c.appliesTo!=='defaultSuite')]}));
 const brainParents=records.filter(r=>r.optionId.startsWith('brain-implant-')).map((r,i)=>[r.id,'Robot brain implant '+(i+1)]);
 return [
 computerSoftwareControl(design),
 {field:'brainCustomPackages',label:'Custom implant software specialities',type:'custom-packages',canAdd:brainParents.length>0,collapseUnavailable:true,unavailableReason:'Install a robot brain implant before adding custom implant software specialities.',maxItems:200,default:[],stage:'skills',addLabel:'Add implant speciality',itemFields:[select('parentBrain','Implant brain',brainParents.length?brainParents:[['unassigned','Add a brain implant first']],'unassigned'),...CUSTOM_PACKAGE_FIELDS],source:source('73-74,92')},
 {...select('augmentRecipient','Recipient anatomy',[['human','Human adult baseline'],['other','Other species/body plan']],'human'),stage:'chassis'},
 {...select('augmentSpeciesVerified','External species geometry/capabilities',[['unconfirmed','Not confirmed'],['confirmed','Supplied by a separate body/character record']],'unconfirmed'),stage:'chassis',visibleWhen:{field:'augmentRecipient',equals:'other'}},
 ...[['Arms',2],['Legs',2],['Eyes',2],['Ears',2],['Noses',1],['Tongues',1]].map(([part,count])=>({...number('augmentNatural'+part,'Natural '+part.toLowerCase(),0,20,count),stage:'chassis',visibleWhen:{field:'augmentRecipient',equals:'other'}})),
 {...select('limbPriceInterpretation','Cyberlimb price conflict',[['unresolved','Unresolved prose / worked-example conflict'],['table','Apply the p26 Size multiplier to increases'],['worked','Use p89-90 worked-example increase prices']],'unresolved'),stage:'physical'},
 {field:'augmentations',ledgerPrefix:'augment:',label:'Cybernetic augments',type:'option-instances',default:[],choices:getAugmentationCatalogue(design),stage:'physical',summaryLabel:'Individual cybernetic parts',description:'Design each limb, sense or organ. Identical copies share the same specifications. Interfaces and optional modifiers are priced explicitly.',expandByDefault:true,source:source('89-94')},
 {field:'augmentOptions',label:'Equipment inside cybernetic parts',type:'option-instances',default:[],choices,stage:'physical',summaryLabel:'Limb equipment and coatings',description:'Choose an existing limb or neural record. Limb equipment uses standard prices; neural additions must be zero-slot communications and cost triple. Optional cybernetic modifiers apply afterward.',expandByDefault:(design.special?.augmentOptions??[]).length>0,source:source('89-90')},
 limbWeaponControl(design),
 {...number('augmentControllerRadioKm','External controller transceiver range (km; 0 = wireless only)',0,100000,0),stage:'finalisation'}
 ].map(c=>({...c,source:c.source??source('89-94')}));
}
export function createAugmentationFields(design={}){return Object.fromEntries(getAugmentationControls(design).map(c=>[c.field,clone(c.default)]));}
export function validateAugmentationRecords(design){
 const controls=getAugmentationControls(design),s=design.special;
 validateComputerSoftware(s.computerSoftware,s.augmentations);
 for(const c of controls){const value=s[c.field];if(c.type==='select'&&!c.choices.some(x=>x.id===value))throw new TypeError('Invalid '+c.field);if(c.type==='number'&&(!Number.isInteger(value)||value<c.min||value>c.max))throw new TypeError('Invalid '+c.field);}
 if(!Array.isArray(s.brainCustomPackages)||s.brainCustomPackages.length>200)throw new TypeError('Invalid custom implant packages.');
 if(!Array.isArray(s.augmentWeapons))throw new TypeError('Invalid cyberlimb weapon records.');
 for(const w of s.augmentWeapons){if(!w||!['body','arm'].includes(w.placement)||Object.hasOwn(w,'manipulatorId')||!s.augmentations.some(r=>r.id===w.parentLimb&&['cybernetic-arm','cybernetic-leg'].includes(r.optionId)))throw new TypeError('Weapon requires an existing parent limb and explicit internal-servo or limb attachment.');}
 validateWeapons(s.augmentWeapons.map(standardLimbWeapon));
 const customIds=new Set();for(const pkg of s.brainCustomPackages){if(!pkg||Object.keys(pkg).some(k=>!['id','parentBrain','skill','speciality','level'].includes(k))||typeof pkg.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(pkg.id)||customIds.has(pkg.id)||!s.augmentations.some(r=>r.id===pkg.parentBrain&&r.optionId.startsWith('brain-implant-'))||!['language','profession','science','art-instrument'].includes(pkg.skill)||typeof pkg.speciality!=='string'||!pkg.speciality.trim()||pkg.speciality.length>120||!Number.isInteger(pkg.level)||pkg.level<0||pkg.level>3)throw new TypeError('Invalid custom implant speciality or parent brain.');customIds.add(pkg.id);}
 for(const record of s.augmentations){if(record.optionId.startsWith('brain-implant-')){const ids=record.parameters?.softwarePackages??[];validateSoftwareSelection({packages:ids,customPackages:s.brainCustomPackages.filter(p=>p.parentBrain===record.id).map(({parentBrain,...p})=>p)});}}
 validateOptionInstances(s.augmentations,controls.find(c=>c.field==='augmentations').choices);
 validateOptionInstances(s.augmentOptions,controls.find(c=>c.field==='augmentOptions').choices);
 for(const option of s.augmentOptions)if(!s.augmentations.some(r=>r.id===option.parameters.parentLimb&&(['cybernetic-arm','cybernetic-leg'].includes(r.optionId)||r.optionId.startsWith('neural-'))))throw new TypeError('Limb equipment requires an existing parent limb record.');
}
const paramsFor=(row,record)=>({...Object.fromEntries(row.parameterControls.map(c=>[c.field,c.default])),...record.parameters});
const modifierKeys=['detachable','remote','grav','invisitech','naturalLooking','ruggedised','selfRepairing'];
function modifiers(p,external,tl,issue,path){
 let fixed=0,percentage=0;const traits=[];
 const requireTL=(minimum,label)=>{if(tl<minimum)issue('error','AUGMENT_MODIFIER_TL',path,`${label} requires TL${minimum}.`,'93-94');};
 if(p.detachable==='yes'){requireTL(9,'Detachable');if(!external)issue('error','AUGMENT_DETACHABLE_INTERNAL',path,'Only external augments may use a detachable socket.','93');fixed+=5000;percentage+=.25;traits.push('Detach/reconnect uses a Significant Action');}
 if(p.remote==='yes'){requireTL(11,'Remote detachable operation');if(p.detachable!=='yes')issue('error','AUGMENT_REMOTE_SOCKET',path,'Remote operation requires a detachable augment.','94');fixed+=10000;}
 if(p.grav==='yes'){requireTL(13,'Grav propulsion');if(p.detachable!=='yes'||p.remote!=='yes')issue('error','AUGMENT_GRAV_REMOTE',path,'Detached grav operation requires detachable and remote-interface options.','94');percentage+=2;traits.push('Detached grav movement: 6 metres per Minor Action');}
 if(p.invisitech!=='none'){const high=p.invisitech==='tl16';requireTL(high?16:12,'Invisitech');percentage+=high?2:1;traits.push(high?'Electronic and psionic concealment; examination/direct contact still possible':'Electronic concealment; examination/direct contact still possible');}
 if(p.naturalLooking!=='none'){const high=p.naturalLooking==='tl14';requireTL(high?14:10,'Natural-looking');percentage+=high?.75:.25;traits.push(`Deception +${high?4:2} when concealing the augment's nature`);}
 if(p.ruggedised==='yes'){requireTL(8,'Ruggedised');percentage+=.25;traits.push('Hardened against energy effects specifically targeting cybernetic augments');}
 if(p.selfRepairing==='yes'){requireTL(14,'Self-repairing');percentage+=1;traits.push('Natural-like augment healing, not self-repairing chassis rules');}
 return{fixed,percentage,traits,signature:JSON.stringify(modifierKeys.map(k=>p[k]))};
}
const armourBand=tl=>tl<9?{max:20,percent:.01,perSlot:1,cost:250}:tl<12?{max:30,percent:.005,perSlot:2,cost:1000}:tl<15?{max:40,percent:.004,perSlot:3,cost:1500}:tl<18?{max:50,percent:.003,perSlot:4,cost:2500}:{max:60,percent:.0025,perSlot:5,cost:5000};
function evaluateImplantBrain(row,p,custom,tl,issue){
 const rank=row.bandwidth===2?2:3,upgrade=BANDWIDTH.find(x=>x.id===p.bandwidthUpgrade),hardened=p.brainHardened==='yes';
 if(upgrade.bandwidth&&tl<row.tl+2)issue('error','IMPLANT_MEMORY_TL','Implant bandwidth upgrades require two technology levels beyond the printed implant grade.','92');
 const retrotechApplies=rank>=3&&tl>row.tl;
 if(retrotechApplies&&p.implantRetrotech==='unresolved')issue('blocker','IMPLANT_RETROTECH_UNRESOLVED','Later-TL Very Advanced implant hardware may use its printed p92 price or the general p67 retrotech rule. Record the specific interpretation.','67,92');
 if(retrotechApplies&&p.implantRetrotech!=='unresolved')issue('warning','IMPLANT_RETROTECH_INTERPRETATION',p.implantRetrotech==='printed-price'?'Retaining printed implant hardware price by explicit interpretation.':'Applying ordinary brain retrotech halving from the implant row introduction TL by explicit interpretation.','67,92');
 const result=evaluateBrainSoftware({brain:{...row,rank,family:rank===2?'advanced':'very-advanced'},upgrade,techLevel:tl,settings:{hardened,intellectUpgrade:p.intellectUpgrade},selection:{packages:p.softwarePackages,customPackages:custom.map(({parentBrain,...pkg})=>({...pkg,speciality:pkg.speciality.normalize('NFKC').trim().replace(/\s+/g,' ')}))},brainSlots:0,retrotech:retrotechApplies&&p.implantRetrotech==='ordinary-retrotech'});
 const codes={BANDWIDTH_UPGRADE:'IMPLANT_MEMORY_CLASS',DUPLICATE_SKILL:'IMPLANT_DUPLICATE_SKILL',INHERENT_BANDWIDTH:'IMPLANT_INHERENT_BANDWIDTH',BANDWIDTH_EXCEEDED:'IMPLANT_BANDWIDTH_EXCEEDED',SPECIALITY_REQUIRED:'IMPLANT_SPECIALITY_REQUIRED',MIN_TL:'IMPLANT_SKILL_TL'};
 for(const d of result.diagnostics)issue(d.severity,codes[d.code]??'IMPLANT_'+d.code,d.message,d.source.pages);
 if(upgrade.bandwidth||p.intellectUpgrade||hardened||result.packages.length)issue('warning','IMPLANT_GENERAL_BRAIN_RULES','Uses ordinary p67/73 robot-brain upgrade and software prices with p92 implant hardware and any explicitly recorded later-TL price interpretation; no recipient Slot cost is inferred.','67,73,92');
 const skills=result.skills.map(skill=>({...skill,scope:'implant-only',recipientSkillGranted:false,source:source('73-74,92')}));
 return{brainCost:result.brainCost,upgradeCost:result.upgradeCost,intellectCost:result.intellectCost,softwareCost:result.softwareCost??result.packages.reduce((n,p)=>n+p.cost,0),profile:{retrotech:{required:retrotechApplies,interpretation:p.implantRetrotech,introductionTL:row.tl,resolved:!retrotechApplies||p.implantRetrotech!=='unresolved',source:source('67,92')},intelligence:result.intelligence,inherentBandwidth:row.bandwidth,bandwidth:{inherent:row.bandwidth,capacity:result.bandwidthCapacity,used:result.bwUsed,remaining:result.bandwidthCapacity-result.bwUsed},zeroBandwidth:{allowance:result.zeroBWAllowance,used:result.zeroBW,overflow:Math.max(0,result.zeroBW-result.zeroBWAllowance)},intellectBandwidth:result.intellectBW,hardened,minimumBandwidthUpgradeTL:row.tl+2,recipientSlots:null,recipientSkillsGranted:false,skills,scope:'implant-only',source:source('67,73-74,92')}};
}
function partCapabilities(installed,context,recordId){
 return equipmentCapabilities(installed,context).map(cap=>{
  const result={...cap,scope:'augment-only',augmentRecordId:recordId,recipientProtectionGranted:false};
  if(cap.id==='environment-summary'){delete result.underwater;delete result.safeWaterDepthM;result.condition+=' These protections apply to this augment only, not its biological recipient.';}
  if(cap.category==='mobility'&&context.tacticalSpeed===null){result.surfaceSpeed=null;result.condition+=' Movement rate depends on the supplied recipient or detached-part movement configuration.';}
  return result;
 });
}
export function evaluateAugmentations(design){
 const s=design.special,tl=design.techLevel,diagnostics=[],ledger=[],augmentations=[],sharedInterfaces=[],groups=new Map();
 const issue=(severity,code,path,message,pages='89-94')=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const entry=(id,label,cost,pages,extra={})=>ledger.push({id,label,cost,slots:0,source:source(pages),...extra});
 const coverage={complete:false,scope:'Individual augmentation construction for supplied recipient anatomy, excluding clinical outcomes and the underlying body',gaps:[{id:'augment-master-interface',category:'interpretation',message:'Master substitution uses the printed neural-link/BIACS cost; its absent DEX rating and mixed modifier allocations require explicit interpretations.',source:source('89,95')},{id:'augment-neural',category:'construction',message:'Miscellaneous devices outside the source-priced Slot or explicit-mass catalogues, including variable body-size coatings and computer accessories without published implant fit dimensions, still require separate construction accounting. Implant robot software belongs to the implant, not automatically to the recipient.',source:source('92')},{id:'augment-limb-price',category:'interpretation',message:'p89-90 limb worked examples omit the Size multiplier referenced by the prose/p26; increases require a recorded interpretation.',source:source('26,89-90')}],operationalDependencies:[{id:'augment-clinical',message:'Installation procedures, acclimation and survival/maintenance conditions are reported but not resolved.',source:source('90-93')}]};
 try{validateAugmentationRecords(design);}catch(error){issue('error','AUGMENT_SCHEMA','special.augmentations',error.message);return{cost:0,diagnostics,ledger,augmentations,sharedInterfaces,coverage};}
 const human=s.augmentRecipient==='human';
 if(!human&&s.augmentSpeciesVerified!=='confirmed')issue('blocker','AUGMENT_SPECIES_RECORD','special.augmentSpeciesVerified','Other-species limb geometry and natural sensory capabilities require a supplied body/character record.');
 const normal={arm:human?2:s.augmentNaturalArms,leg:human?2:s.augmentNaturalLegs,eye:human?2:s.augmentNaturalEyes,ear:human?2:s.augmentNaturalEars,nose:human?1:s.augmentNaturalNoses,tongue:human?1:s.augmentNaturalTongues},used={};
 const catalogue=getAugmentationCatalogue(design),masterRecord=s.augmentations.find(r=>r.optionId==='biacs-master'),masterParams=masterRecord?paramsFor(catalogue.find(r=>r.id==='biacs-master'),masterRecord):null,masterDEX=masterParams?.masterDexterity,optionChoices=getAugmentationControls(design).find(c=>c.field==='augmentOptions').choices;
 for(const record of s.augmentations){
  const row=catalogue.find(r=>r.id===record.optionId),p=paramsFor(row,record),q=p.quantity??1,path='special.augmentations.'+record.id;
  if(tl<row.tl&&!(row.type==='misc-mass'&&row.device.effects.processing!==undefined))issue('error','AUGMENT_TL',path,`${row.label} requires TL${row.tl}.`,row.source.pages);
  const external=['limb','sensor'].includes(row.type),mod=modifiers(p,external,tl,issue,path),out={id:record.id,optionId:row.id,label:row.label,source:row.source,quantity:q,structureCost:0,interfaceCost:0,optionCost:0,weaponCost:0,softwareCost:0,fixedModifierCost:mod.fixed*q,percentageModifier:mod.percentage,modifierCost:0,totalCost:0,traits:mod.traits};
  if(row.type==='limb'){
   const size=p.size,iface=LIMB_INTERFACES[p.interfaceTier],baseSTR=2*size-1,baseDEX=Math.ceil(tl/2+1),move=p.movementIncrease??0;
   if(!masterRecord&&tl<iface.tl)issue('error','LIMB_INTERFACE_TL',path,'Selected limb interface exceeds design technology.','89');
   if(human&&((row.limb==='leg'&&size!==6)||(row.limb==='arm'&&(tl<=10?size!==6:size>5))))issue('error','HUMAN_LIMB_SIZE',path,'Human legs use Size6; human arms use Size6 through TL10 and Size5 or smaller at TL11+.','89');
   if(p.strengthIncrease>baseSTR)issue('error','LIMB_STR_LIMIT',path,'Manipulator STR may not exceed twice its default value.','26,89');
   if(baseDEX+p.dexterityIncrease>tl+3)issue('error','LIMB_DEX_LIMIT',path,'Manipulator DEX exceeds TL+3.','26,89');
   const hasIncrease=p.strengthIncrease||p.dexterityIncrease||move;
   if(hasIncrease&&s.limbPriceInterpretation==='unresolved')issue('blocker','LIMB_PRICE_CONFLICT',path,'Choose prose/table or worked-example pricing for cyberlimb increases.','26,89-90');
   const factor=s.limbPriceInterpretation==='table'?size:1;
   const structure=3*(size*100+factor*(p.strengthIncrease**2*100+p.dexterityIncrease**2*200+move**2*100));
   const baseSlots=row.limb==='arm'?4:6,capacity=row.limb==='arm'?3:4;
   const associated=s.augmentOptions.filter(o=>o.parameters.parentLimb===record.id).map(o=>({...o,parameters:Object.fromEntries(Object.entries(o.parameters).filter(([k])=>k!=='parentLimb'))}));
   const equipment=evaluateEquipment({kind:'cyborg',techLevel:tl,selections:{chassis:{size:'size-0'},physical:{options:[],defaultSuite:[],optionParameters:{},optionInstances:associated,powerMode:'conventional',powerPacks:0,armourRemoved:false,vehicleSpeed:false}}},optionChoices,baseSlots);
   diagnostics.push(...equipment.diagnostics.map(d=>({...d,path:path+'.equipment.'+d.path})));
   const weaponRecords=s.augmentWeapons.filter(w=>w.parentLimb===record.id).map(standardLimbWeapon),limbDex=masterRecord&&!masterDEX?null:Math.min(baseDEX+p.dexterityIncrease,masterRecord?masterDEX:iface.dexterity);
   const weaponResult=evaluateWeapons({techLevel:tl,kind:'drone',selections:{physical:{weapons:weaponRecords},brain:{model:'none'}}},[{id:record.id,size,dexterity:limbDex??0}],[],equipment.installed);
   diagnostics.push(...weaponResult.diagnostics.map(d=>({...d,path:path+'.weapons.'+d.path})));
   out.weaponCost=weaponResult.cost*q;
   out.weapons=weaponResult.weapons.map(w=>({...w,parentLimb:record.id,copies:q,perLimbCost:w.cost,scope:'parent-limb-only',softwareLevel:null,baseAttackModifier:null,attackModifier:null,...(limbDex===null?{manipulatorDM:null}:{}),attackContext:'Recipient skills and control mode are external. Limb DM applies only to limb attachment; internal servo uses no limb characteristic DM.',constructionSource:source('60-64,89-90')}));
   out.weaponAccounting={perLimbCost:weaponResult.cost,copies:q,totalCost:out.weaponCost,perLimbSlots:weaponResult.slots,ammunitionStorage:weaponResult.ammunitionStorage??[],source:source('60-64,89-90')};
   const hardwareSlots=equipment.ledger.filter(e=>e.id!=='zero-slot-overflow').reduce((n,e)=>n+(e.slots??0),0),band=armourBand(tl);
   if(p.armourAdded>band.max)issue('error','LIMB_ARMOUR_LIMIT',path,'Limb armour exceeds its technology limit.','19,89');
   const armourSlots=p.armourAdded?Math.max(Math.ceil(p.armourAdded*baseSlots*band.percent),Math.ceil(p.armourAdded/band.perSlot)):0,armourCost=armourSlots*band.cost;
   if(hardwareSlots+armourSlots+weaponResult.slots>capacity)issue('error','LIMB_SLOT_LIMIT',path,'Installed options, armour and weapon systems exceed this individual limb capacity.','89-90');
   out.structureCost=structure*q;out.interfaceCost=masterRecord?0:iface.cost*q;out.optionCost=(equipment.cost+armourCost)*q;
   out.slots={base:baseSlots,capacity,used:hardwareSlots+armourSlots+weaponResult.slots,remaining:capacity-hardwareSlots-armourSlots-weaponResult.slots};
   out.characteristics={strength:baseSTR+p.strengthIncrease,nominalDexterity:baseDEX+p.dexterityIncrease,interfaceDexterityCap:masterRecord?(masterDEX||null):iface.dexterity,effectiveDexterity:masterRecord&&!masterDEX?null:Math.min(baseDEX+p.dexterityIncrease,masterRecord?masterDEX:iface.dexterity)};
   out.limb=row.limb;out.placement=p.placement;out.enduranceHours=masterRecord?null:iface.endurance;out.biologicallyPowered=masterRecord?tl>=10:iface.tl>=10;out.fullHaptics=masterRecord?tl>=10:iface.tl>=10;
   if(out.characteristics.nominalDexterity>(masterRecord?masterDEX||Infinity:iface.dexterity))issue('warning','LIMB_INTERFACE_CAP',path,'Purchased limb DEX is capped by its interface; extra hardware DEX is not an effective characteristic.','89');
   if(row.limb==='leg'){out.movementMetres=6+move;if(6+move>(masterRecord?masterDEX||Infinity:iface.dexterity))issue('error','LEG_MOVEMENT_INTERFACE',path,'Leg movement rate exceeds the limb interface DEX rating.','89-90');}
   out.equipment=equipment.installed.map(o=>({id:o.instanceId,optionId:o.id,label:o.label,quantity:o.quantity,source:o.source}));
   out.capabilities=partCapabilities(equipment.installed,{techLevel:tl,primary:row.limb==='leg'?'walker':'none',tacticalSpeed:row.limb==='leg'?out.movementMetres:p.grav==='yes'?6:null},record.id);
   out.acclimation={condition:'Only if size/performance differs from the natural limb',weeksPerD6:p.placement==='additional'?2:1};
   if(p.placement==='replacement')used[row.limb]=(used[row.limb]??0)+q;
   if(p.remote==='yes'){const radio=Math.max(0,...equipment.installed.filter(o=>o.family==='transceiver').map(o=>o.effects?.rangeKm??0));out.remoteRangeMetres=radio&&s.augmentControllerRadioKm?Math.min(radio,s.augmentControllerRadioKm)*1000:50;out.controllerRadioCostIncluded=false;out.remoteLink={rangeMetres:out.remoteRangeMetres,wirelessFallbackMetres:50,externalControllerRangeKm:s.augmentControllerRadioKm||null,externalControllerVerified:false,externalControllerTechnologyVerified:false,condition:'Extended range is conditional on the supplied external controller record and both transceivers; external controller is not purchased or validated here.',source:source('94')};}
  }else if(row.type==='sensor'){
   const iface=SENSORY_INTERFACES[row.sense];out.structureCost=row.cost*q;out.sense=row.sense;out.effects=clone(row.effects);out.placement=p.placement;
   if(p.placement==='additional')out.interfaceCost=masterRecord?0:iface.cost*2*q;
   else{
    used[row.sense]=(used[row.sense]??0)+q;
    if(!p.interfaceGroup.trim())issue('error','SENSORY_GROUP_EMPTY',path,'Shared sensory interface group must have a name.','90');
    const groupKey=row.sense+':'+p.interfaceGroup.trim().toLowerCase();let group=groups.get(groupKey);
    if(!group){group={id:groupKey,sense:row.sense,cost:masterRecord?0:iface.cost,percentage:mod.percentage,signature:mod.signature,recordIds:[]};groups.set(groupKey,group);}
    if(group.signature!==mod.signature)issue('blocker','SENSORY_SHARED_MODIFIERS',path,'Sensors sharing one interface need a consistent optional-modifier set; mixed interface surcharge allocation is not defined. Use explicitly separate interface groups or resolve the source interpretation.','90,93-94');
    group.recordIds.push(record.id);out.sharedInterfaceGroup=groupKey;
   }
  }else if(row.type==='master'){
   out.structureCost=row.cost;out.masterInterface={dexterityCap:masterDEX||null,sourceDexteritySpecified:false};
   if(!s.augmentations.some(r=>r.optionId.startsWith('neural-link-')))issue('error','MASTER_NEURAL_LINK',path,'BIACS master substitution requires an installed TL13+ neural link.','89,95');
   if(!masterDEX)issue('blocker','MASTER_DEX_UNRESOLVED',path,'The master-interface substitution has no printed DEX rating. Record a specific referee cap before claiming effective limb characteristics.','89,95');
   else issue('warning','MASTER_DEX_INTERPRETATION',path,'Master DEX cap is an explicit referee input, not a printed Handbook rating.','89,95');
  }else if(row.type==='misc-mass'){
   const device=row.device,computer=device.effects.processing!==undefined?evaluateComputer(device,p,s.computerSoftware.filter(r=>r.parentComputer===record.id),tl,{neuralLink:p.interfaceMode==='neural'&&s.augmentations.some(r=>r.optionId.startsWith('neural-link-'))}):null;
   if(computer){diagnostics.push(...computer.diagnostics.map(d=>({...d,path})));out.generalComputer=computer.profile;out.softwareCost=computer.softwareCost*q;}
   if((computer?.massKg??device.massKg)>2)issue('error','MISC_IMPLANT_MASS',path,'The mass-only implant route requires each source-priced device to be at most two kilograms.','92');
   out.structureCost=(computer?.hardwareCost??device.cost)*3*q;out.miscDevice={id:device.id,label:device.label,source:device.source,massKg:computer?.massKg??device.massKg,slots:null,fitBasis:'mass-at-most-2kg',quantity:q,standardUnitPrice:computer?.hardwareCost??device.cost,implantedUnitPrice:(computer?.hardwareCost??device.cost)*3};
   out.capabilities=[{id:record.id,optionId:device.id,label:device.label,category:device.effects.processing!==undefined?'computer':'sensor',...device.effects,...(p.electronicsSpeciality?{electronicsSpeciality:p.electronicsSpeciality}:{}),scope:'augment-only',recipientProtectionGranted:false,source:device.source}];
   if(p.computerComms==='yes'){if((computer?.profile.ratedTL??device.tl)<8)issue('error','MISC_COMPUTER_COMMS_TL',path,'The optional integrated computer comm requires a TL8+ computer.','92');out.capabilities.push({id:record.id+'-comms',category:'communications',shortRange:true,rangeKm:null,scope:'augment-only',condition:'Specified at purchase; Core p112 does not give a numeric short-range distance here.',source:coreSource('112')});}
   if(p.interfaceMode==='neural'){if(!s.augmentations.some(r=>r.optionId.startsWith('neural-link-')))issue('error','MISC_IMPLANT_NEURAL_LINK',path,'Selected shared control requires an installed neural link.','92');}
   else{const iface=LIMB_INTERFACES[p.interfaceTier];out.interfaceCost=masterRecord?0:iface.cost*q;if(!masterRecord&&tl<iface.tl)issue('error','LIMB_INTERFACE_TL',path,'Selected interface exceeds design technology.','89,92');}
  }else if(row.type==='misc'){
   const device=row.device,parameters=Object.fromEntries(Object.entries(record.parameters).filter(([key])=>device.parameterControls.some(c=>c.field===key&&c.appliesTo!=='defaultSuite')&&key!=='quantity'));
   const equipment=evaluateEquipment({kind:'cyborg',techLevel:tl,selections:{chassis:{size:'size-0'},physical:{options:[],defaultSuite:[],optionParameters:{},optionInstances:[{id:record.id,optionId:device.id,parameters}],powerMode:'conventional',powerPacks:0,armourRemoved:false,vehicleSpeed:false}}},OPTIONS,1);
   diagnostics.push(...equipment.diagnostics.map(d=>({...d,path:path+'.device.'+d.path})));
   const slots=equipment.ledger.filter(e=>e.id!=='zero-slot-overflow').reduce((n,e)=>n+(e.slots??0),0);
   if(slots>1)issue('error','MISC_IMPLANT_SIZE',path,'Each implanted device must fit one Slot or a separately verified two-kilogram physical alternative.','92');
   out.capabilities=partCapabilities(equipment.installed,{techLevel:tl,primary:'none',tacticalSpeed:null},record.id);
   out.structureCost=equipment.cost*3*q;out.miscDevice={id:device.id,source:device.source,slots,quantity:q};
   if(p.interfaceMode==='neural'){if(!s.augmentations.some(r=>r.optionId.startsWith('neural-link-')))issue('error','MISC_IMPLANT_NEURAL_LINK',path,'Selected shared control requires an installed neural link.','92');}
   else{const iface=LIMB_INTERFACES[p.interfaceTier];out.interfaceCost=masterRecord?0:iface.cost*q;if(!masterRecord&&tl<iface.tl)issue('error','LIMB_INTERFACE_TL',path,'Selected interface exceeds design technology.','89,92');}
  }else if(row.type==='brain'){
   const evaluated=evaluateImplantBrain(row,p,s.brainCustomPackages.filter(pkg=>pkg.parentBrain===record.id),tl,(severity,code,message,pages)=>issue(severity,code,path,message,pages));
   out.structureCost=evaluated.brainCost;out.optionCost=evaluated.upgradeCost+evaluated.intellectCost;out.softwareCost=evaluated.softwareCost;out.robotBrain=evaluated.profile;
   if(!s.augmentations.some(r=>r.optionId.startsWith('neural-link-')))issue('error','BRAIN_IMPLANT_NEURAL_LINK',path,'Robot brain implants require an installed neural link.','92');
  }else if(row.type==='neural'){
   out.structureCost=row.cost;out.neuralType=row.neuralType;out.computer=row.computer;out.communication={rangeKm:5,wirelessDataLink:true,sensory:row.sensory};out.neuralLace=row.neuralType==='link';
   const linked=s.augmentOptions.filter(o=>o.parameters.parentLimb===record.id),eligible=optionChoices.filter(o=>o.zeroSlot&&o.slots===0&&o.costBasis==='each'&&(['transceiver','encryption'].includes(o.family)||o.id==='wireless'));
   const legal=linked.filter(o=>eligible.some(x=>x.id===o.optionId));
   if(legal.length!==linked.length)issue('error','NEURAL_OPTION_ELIGIBILITY',path,'Neural implant additions must be supported zero-slot communications options.','92');
   const instances=legal.map(o=>({...o,parameters:Object.fromEntries(Object.entries(o.parameters).filter(([k])=>k!=='parentLimb'))}));
   if(instances.reduce((n,o)=>n+(o.parameters.quantity??1),0)>5)issue('error','NEURAL_OPTIONS_LIMIT',path,'A neural implant permits at most five zero-slot additions.','92');
   const equipment=evaluateEquipment({kind:'cyborg',techLevel:tl,selections:{chassis:{size:'size-0'},physical:{options:[],defaultSuite:legal.some(o=>eligible.find(x=>x.id===o.optionId)?.family==='transceiver')?[]:['transceiver-improved'],optionParameters:{},optionInstances:instances,powerMode:'conventional',powerPacks:0,armourRemoved:false,vehicleSpeed:false}}},optionChoices,0);
   diagnostics.push(...equipment.diagnostics.map(d=>({...d,path:path+'.equipment.'+d.path})));
   out.optionCost=equipment.cost*3;out.equipment=equipment.installed.filter(o=>!o.fromDefault).map(o=>({id:o.instanceId,optionId:o.id,label:o.label,quantity:o.quantity,source:o.source}));
   out.capabilities=partCapabilities(equipment.installed,{techLevel:tl,primary:'none',tacticalSpeed:null},record.id);
   out.communication.rangeKm=Math.max(5,...equipment.installed.map(o=>o.effects?.rangeKm??0));
   if(p.computerUpgrade==='yes'){if(tl<15)issue('error','NEURAL_COMPUTER_UPGRADE',path,'Computer/2 upgrade requires TL15.','92');if(row.neuralType==='link'&&row.computer===0)issue('blocker','NEURAL_COMPUTER_UPGRADE',path,'The neural-link paragraph permits a computer upgrade at TL15, but does not explicitly price or define the basic link Computer/0 to Computer/2 route. The advanced neural-comm Computer/1 upgrade cannot be assumed to establish this price.','92');else if(row.computer!==1)issue('error','NEURAL_COMPUTER_UPGRADE',path,'The printed neural-comm Computer/2 upgrade requires advanced neural-comm features.','92');if(row.computer===1){out.optionCost+=10000;out.computer=2;}}
   if(out.computer!==null){const computerTL=p.computerUpgrade==='yes'?15:row.tl;const evaluated=evaluateComputer({tl:computerTL,cost:0,massKg:0,effects:{processing:out.computer,includedSoftware:['Interface/0','Security/0']}},p,s.computerSoftware.filter(r=>r.parentComputer===record.id),tl,{bundledNeural:true,neuralLink:row.neuralType==='link'});diagnostics.push(...evaluated.diagnostics.map(d=>({...d,path})));out.generalComputer={...evaluated.profile,hardwareCostIncludedInImplant:true,additionalHardwareCost:0,massKg:null,source:{...source('92'),computerRules:coreSource('110-113')}};out.softwareCost=evaluated.softwareCost;}
  }else{
   out.structureCost=row.cost*(p.complexity==='simple'?.5:1)*q;out.organ=true;out.procedureGroup=p.procedureGroup;out.overallEnduranceModifier=row.id==='organ-advanced'?2:0;
   out.procedure={count:q,target:row.id==='organ-basic'?12:row.id==='organ-improved'?10:8,characteristic:'EDU',duration:row.id==='organ-basic'?'1D x 4 hours':row.id==='organ-improved'?'1D hours':'1 hour',techDM:row.id==='organ-basic'&&tl>=8?2:0,weeklySurvival:row.id==='organ-basic'?{target:6,characteristic:'END',techDM:tl>=8?2:0}:null,annualMaintenance:row.id==='organ-improved',selfRepairing:['organ-enhanced','organ-advanced'].includes(row.id)};
   if(row.id==='organ-basic'&&p.externalPower!=='provided')issue('blocker','ORGAN_EXTERNAL_POWER',path,'Basic organs require an external power source or battery pack, priced and validated separately.','91');
  }
  if(masterRecord&&['limb','sensor','misc','misc-mass'].includes(row.type)){const masterMod=modifiers(masterParams,false,tl,()=>{},path);if(mod.percentage!==masterMod.percentage)issue('blocker','MASTER_SHARED_MODIFIERS',path,'Mixed percentage modifiers on augments sharing a master interface need a separate cost-allocation interpretation. Matching percentages have an unambiguous aggregate basis.','89,93-94');}
  const subtotal=out.structureCost+out.interfaceCost+out.optionCost+out.weaponCost+out.fixedModifierCost;
  const softwareBasisRequired=(row.type==='brain'||out.generalComputer)&&out.softwareCost>0&&mod.percentage>0;
  if(softwareBasisRequired&&p.softwareModifierBasis==='unresolved')issue('blocker','IMPLANT_SOFTWARE_MODIFIER_BASIS',path,'Cybernetic percentage rules cover capabilities and added fixed costs but do not explicitly exclude software. Select a recorded interpretation; the android physical-only exception is not automatically applied.','89,93-94');
  if(softwareBasisRequired&&p.softwareModifierBasis!=='unresolved')issue('warning','IMPLANT_SOFTWARE_MODIFIER_INTERPRETATION',path,p.softwareModifierBasis==='include-all-fixed-costs'?'Software included in cybernetic percentage basis using the all-fixed-cost reading.':'Software excluded from cybernetic percentage basis by an explicit physical-only referee interpretation.','89,93-94');
  const modifierBasis=subtotal+(softwareBasisRequired&&p.softwareModifierBasis==='include-all-fixed-costs'?out.softwareCost:0);
  out.modifierCost=modifierBasis*mod.percentage;out.totalCost=subtotal+out.modifierCost+out.softwareCost;
  if(row.type==='brain'||out.generalComputer)out.softwareModifierBasis={required:softwareBasisRequired,interpretation:p.softwareModifierBasis,source:source('89,93-94'),resolved:!softwareBasisRequired||p.softwareModifierBasis!=='unresolved',basisCost:softwareBasisRequired&&p.softwareModifierBasis==='unresolved'?null:modifierBasis};
  for(const [suffix,label,key]of [['structure','Structure / sensor / organ','structureCost'],['interface','Individual interface','interfaceCost'],['options','Installed equipment and armour','optionCost'],['weapons','Installed weapon systems and ammunition','weaponCost'],['fixed','Fixed optional features','fixedModifierCost'],['modifiers','Additive percentage features','modifierCost'],['software','Implant software base price','softwareCost']])if(out[key])entry('augment:'+record.id+':'+suffix,row.label+' : '+label,out[key],suffix==='modifiers'||suffix==='fixed'?'93-94':row.source.pages,{recordId:record.id});
  augmentations.push(out);
 }
 if(s.augmentations.filter(r=>r.optionId==='biacs-master').length>1)issue('error','MASTER_SINGLE','special.augmentations','Install only one master augmentation controller.','89');
 for(const [part,count]of Object.entries(used))if(count>normal[part])issue('error','AUGMENT_REPLACEMENT_COUNT','special.augmentations',`Replacement ${part} count exceeds the supplied natural anatomy; mark extra parts as additional.`,'89-90');
 for(const group of groups.values()){const modifierCost=group.cost*group.percentage,totalCost=group.cost+modifierCost;sharedInterfaces.push({id:group.id,sense:group.sense,recordIds:group.recordIds,cost:group.cost,modifierCost,totalCost,source:source('90,93-94')});entry('augment-interface:'+group.id,'Shared '+group.sense+' interface',totalCost,'90,93-94',{recordIds:group.recordIds});}
 if(augmentations.filter(a=>a.miscDevice).reduce((n,a)=>n+a.quantity,0)>3)issue('error','MISC_IMPLANT_COUNT','special.augmentations','No more than three miscellaneous devices may be implanted.','92');
 if(augmentations.filter(a=>a.neuralType).length>1)issue('error','NEURAL_SINGLE_INSTALLATION','special.augmentations','A recipient may have one neural comm or one neural link, not both or multiple grades.','92');
 const cost=ledger.reduce((sum,e)=>sum+e.cost,0),replacementLegs=augmentations.filter(a=>a.limb==='leg'&&a.placement==='replacement'),bothLegs=human&&replacementLegs.reduce((n,a)=>n+a.quantity,0)===2;
 const speeds=[...new Set(replacementLegs.map(a=>a.movementMetres))];
 const effects={overallEnduranceModifier:augmentations.some(a=>a.overallEnduranceModifier===2)?2:0,walkingRunningEndurance:bothLegs?15:null,pairedLegMovementMetres:bothLegs&&speeds.length===1?speeds[0]:null,multiLimbRule:'Use the average STR or DEX of the limbs actually participating; do not globally substitute the best limb.'};
 if(effects.overallEnduranceModifier&&effects.walkingRunningEndurance)issue('warning','AUGMENT_END_CONTEXT','special.augmentations','Overall END+2 and effective walking/running END15 are separate contextual effects, not automatically summed.','90-91');
 return{cost,diagnostics,ledger,augmentations,sharedInterfaces,effects,coverage};
}
