import {compositeControls,supportsReferences,validateReferences} from './composites.mjs';
import {equipmentCapabilities} from './capabilities.mjs';
import {getAugmentationControls,validateAugmentationRecords,evaluateAugmentations} from './augmentations.mjs';
import {evaluateEquipment,validateOptionInstances} from './equipment.mjs';
import {CUSTOM_PACKAGE_FIELDS} from './skills-data.mjs';
import {OPTIONS_ARRAY} from './options-data.mjs';
import {PACKAGES,LOCOMOTION,OPTIONS,DEFAULT_ITEMS,CORE_PACKAGES} from './catalogue.mjs';
// Pure special-construction API. Rules data, not reproduced source prose.
const copy = value => JSON.parse(JSON.stringify(value));
const source = pages => ({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const specialKinds = [
 ['clone','Clone','96-99','Template, growth and training budget implemented; character generation and ageing resolution remain external.'],
 ['microbot','Microbot','79-81','Miniature chassis, mass, movement, protection and p81 microbrain table implemented; source conflicts remain explicit.'],
 ['nanorobot','Nanorobot','82-85','Medical, construction and environmental nanorobot packages implemented with explicit operational limits and external controller dependencies.'],
 ['android','Android','86-87','Body tiers, half-slot reservation and physical-only price multiplier implemented.'],
 ['biological','Biological robot','88-89','Genome-dependent body tiers and three-quarter-slot reservation implemented; bespoke genomes require referee confirmation.'],
 ['cyborg','Cyborg','90-93','Full-body organic-brain conversion interfaces, procedure thresholds and degradation schedules calculated; replacement body construction remains external.'],
 ['avatar','Avatar','94-95','Robotic avatar links and biological BIACS/RIBACI implant estimates implemented; paired bodies, controllers and biological prerequisites remain external dependencies.'],
 ['drone','Drone','78-79','Onboard receiver and communications validated; operator-unit costs and control modifiers explicitly separate from robot construction.'],
 ['missile','Missile robot','100-101','Standard carrier procurement, payload bounds and burn rounds calculated; custom warhead robot construction is an external dependency.'],
 ['vehicle-brain','Vehicle brain','102-103','Interface cost and occupied vehicle Spaces calculated; host and installed brain require separate construction validation.'],
 ['ship-brain','Ship brain','102-103','Interface cost, occupied tonnage and operating modifiers calculated; High Guard host construction remains an external dependency.']
].map(([id,label,pages,reason])=>({id,label,source:source(pages),implemented:['clone','microbot','nanorobot','android','biological','avatar','cyborg','drone','missile','vehicle-brain','ship-brain'].includes(id),reason}));
export function getSpecialKinds(){return copy(specialKinds);}
const number=(field,label,min,max,value)=>({field,label,type:'number',min,max,default:value,source:source('96-99')});
const select=(field,label,values,value)=>({field,label,type:'select',choices:values.map(([id,label])=>({id,label})),default:value,source:source('96-99')});
const learnedSkillEligible=p=>p.implemented===true&&!p.refereeBroad&&!(p.packageCount>1)&&!p.coveredSpecialities&&!p.speciality?.startsWith('all');
const controls=[
 select('recordMode','Record purpose',[['construction','Commercial clone construction'],['traveller','Traveller creation limits']],'construction'),
 select('templateMode','Template source',[['catalogue','Catalogue template'],['donor','Donor sample']],'catalogue'),
 ...['STR','DEX','END','INT'].flatMap(stat=>[number('base'+stat,stat+' catalogue base (TL13+: 6–11; earlier: 3–8)',3,11,6),number('donor'+stat,stat+' donor at age 18',1,30,8),number('roll'+stat,stat+' recorded die (TL13+: D3; earlier: D6)',1,6,1)]),
 select('growth','Growth method',[['natural','Natural'],['spare','Spare body'],['accelerated','Accelerated (12×)'],['quick','Quick (50×)']],'quick'),
 select('procurement','Growth procurement',[['commercial','Commercial service'],['self','Own bioreaction chamber']],'commercial'),
 number('storageYears','Spare body storage years',0,200,0),
 number('trainingYears','Additional creche training years',0,16,0),
 number('adultYears','Years since reaching adulthood',0,200,0),
 select('eduAccounting','Automatic EDU point interpretation',[['unresolved','Not resolved'],['separate','Automatic EDU separate from four selectable points'],['included','Automatic EDU charged against four points']],'unresolved'),
 {field:'trainingSkills',label:'Creche skills (select final level once per skill or specialty)',type:'multiselect',default:[],choices:PACKAGES.filter(learnedSkillEligible).map(p=>({id:p.id,label:p.label,skill:p.skill,speciality:p.speciality,level:p.level})),source:source('98-99')},
 {field:'trainingCustomSkills',label:'Book-permitted custom learned specialities',type:'custom-packages',maxItems:200,default:[],addLabel:'Add learned speciality',itemFields:CUSTOM_PACKAGE_FIELDS.map(c=>c.field==='level'?{...c,label:'Learned skill level',max:4}:{...c}),source:source('98-99')},
 ...['STR','DEX','END','INT'].map(stat=>number('increase'+stat,stat+' additional creche increase',0,4,0)),
 number('intTrainingYear','Year when purchased INT increase is completed (end of year)',1,16,1),
 select('quickEducation','Quick clone creche initial EDU interpretation',[['unresolved','Not resolved'],['zero','Referee: start at EDU0 with annual catch-up']],'unresolved')
];
const skillChoices=controls.find(c=>c.field==='trainingSkills').choices;
skillChoices.push(...skillChoices.filter(p=>p.level===3).map(p=>({...p,id:p.id.replace(/-3$/,'-4'),label:p.label.replace(/ 3$/,' 4'),level:4})));
for(const c of controls){
 c.stage=['growth','procurement','storageYears'].includes(c.field)?'physical':['adultYears','recordMode'].includes(c.field)?'finalisation':['eduAccounting','quickEducation'].includes(c.field)||/INT$/.test(c.field)&&!c.field.startsWith('increase')?'brain':c.field.startsWith('training')||c.field==='intTrainingYear'||c.field.startsWith('increase')?'skills':'chassis';
 c.category=c.stage==='skills'?'Creche training':c.stage==='brain'?'Biological cognition':c.stage==='physical'?'Growth service':'Clone template';
 if(c.field.startsWith('base'))c.visibleWhen={field:'templateMode',equals:'catalogue'};
 if(c.field.startsWith('donor'))c.visibleWhen={field:'templateMode',equals:'donor'};
 if(c.field==='quickEducation')c.visibleWhen={field:'growth',equals:'quick'};
 if(c.field==='storageYears')c.visibleWhen={field:'growth',equals:'spare'};
}
function baseSpecialControls(kind){return kind==='clone'?copy(controls):kind==='microbot'?copy(microControls):kind==='nanorobot'?copy(nanoControls):kind==='avatar'?copy(avatarControls):kind==='missile'?copy(missileControls):kind==='cyborg'?copy(cyborgControls):kind==='drone'?copy(droneControls):['vehicle-brain','ship-brain'].includes(kind)?copy(hostControls(kind)):['android','biological'].includes(kind)?copy(bodyControls(kind).map(c=>({...c,source:source(kind==='android'?'86-87':'88-89')}))):[];}
export function getSpecialControls(kind,design={}){
 const base=[...baseSpecialControls(kind),...compositeControls(kind)];
 if(kind==='biological')return [...base,...getAugmentationControls(design).map(c=>c.stage==='physical'?{...c,category:'cybernetics',...(c.choices?{choices:c.choices.map(o=>({...o,category:'cybernetics'}))}:{})}:c)];
 if(kind!=='cyborg')return base;
 const mode={...select('cyborgMode','Cybernetic construction',[['full-body','Full-body conversion'],['augments','Individual augmentations']],'full-body'),stage:'chassis',source:source('89-93')};
 return [mode,...base.map(c=>({...c,visibleWhen:c.visibleWhen?{allOf:[{field:'cyborgMode',equals:'full-body'},c.visibleWhen]}:{field:'cyborgMode',equals:'full-body'}})),...getAugmentationControls(design).map(c=>({...c,visibleWhen:c.visibleWhen?{allOf:[{field:'cyborgMode',equals:'augments'},c.visibleWhen]}:{field:'cyborgMode',equals:'augments'}}))];
}
export function createSpecialDesignFields(kind,techLevel=13){const fields=Object.fromEntries(getSpecialControls(kind,{techLevel}).map(c=>[c.field,copy(c.default)]));if(kind==='clone'&&techLevel<13){fields.growth=techLevel>=10?'accelerated':'natural';for(const stat of ['STR','DEX','END','INT'])fields['base'+stat]=3;}return fields;}
export function validateSpecialFields(kind,fields){
 if(!fields||typeof fields!=='object'||Array.isArray(fields))throw new TypeError('special must be an object.');
 if(supportsReferences(kind))validateReferences(kind,fields.designReferences);
 if(kind==='microbot')validateOptionInstances(fields.optionInstances,MICRO_OPTIONS);
 if(kind==='clone')validateCloneCustomSkills(fields.trainingCustomSkills);
 if(['cyborg','biological'].includes(kind))validateAugmentationRecords({kind,special:fields});
 const cs=getSpecialControls(kind,{special:fields}),allowed=new Set(cs.map(c=>c.field));
 if(Object.keys(fields).some(k=>!allowed.has(k)))throw new TypeError('Unknown special field.');
 for(const c of cs){const v=fields[c.field];if(c.type==='number'&&(!Number.isInteger(v)||v<c.min||v>c.max))throw new TypeError(`special.${c.field} must be an integer from ${c.min} to ${c.max}.`);if(c.type==='multiselect'&&(!Array.isArray(v)||v.length>200||new Set(v).size!==v.length||v.some(id=>!c.choices.some(x=>x.id===id))))throw new TypeError(`special. has invalid selections.`);if(c.type==='select'&&!c.choices.some(x=>x.id===v))throw new TypeError(`special.${c.field} has an unknown choice.`);}
 return true;
}
export function cloneSkillPointCost(level){if(!Number.isInteger(level)||level<0||level>4)throw new TypeError('Skill level must be 0–4.');return 2**level;}
export function cloneCharacteristicPointCost(increase){if(!Number.isInteger(increase)||increase<0||increase>4)throw new TypeError('Characteristic increase must be 0–4.');return 2**(increase+1)-2;}
const priceRows=[0,5000,15000,30000,50000,75000];
function evaluateSpecialDesignRaw(design){
 if(usesStandaloneSpecialPath(design))return evaluateBiologicalAvatar(design);
 if(design.kind==='microbot')return evaluateMicrobot(design);
 if(design.kind==='nanorobot')return evaluateNanorobot(design);
 if(design.kind==='missile')return evaluateMissileCarrier(design);
 if(design.kind==='cyborg')return design.special?.cyborgMode==='augments'?evaluateIndividualAugments(design):evaluateCyborgConversion(design);
 if(['vehicle-brain','ship-brain'].includes(design.kind))return evaluateBrainHost(design);
 const diagnostics=[],ledger=[],coverage={complete:false,scope:'Clone template, growth and supported creche training construction; optional Traveller skill-limit checks',implemented:['Catalogue and donor template mechanics','Commercial growth and storage costs','Itemized learned skills, permitted custom specialities and characteristic point costs','Annual EDU/INT bookkeeping under explicit interpretations','Natural, accelerated and quick ageing schedules'],gaps:[
 {id:'clone-genetics',category:'construction',message:'Species/genetic-engineering variants and biological augmentations are not constructed or priced. Published nonstandard templates are not inferred from desired final characteristics.',source:source('96-99,246-248')},
 {id:'clone-facility',category:'construction',message:'Own-chamber growth does not validate the chamber, feedstock, capacity or complete facility cost; only consumables are estimated.',source:source('49-50,98')},
 {id:'clone-transplant-cost',category:'construction',message:'Brain transplantation, replacement organs/limbs and their augmentation/procedure costs are not included in clone construction totals.',source:source('99')},
 {id:'clone-training-interpretations',category:'interpretation',message:'Quick-clone initial EDU, automatic EDU versus selectable points, and INT changes after EDU surpasses the old INT require explicit interpretation. Multiple separately timed INT purchases are not represented.',source:source('98-99')},
 {id:'clone-natural-character',category:'external-dependency',message:'Natural EDU, SOC and career/background generation require the applicable character rules. Commercial construction is not a complete Traveller character record.',source:source('98-99')},
 {id:'clone-published-template',category:'unresolved-source-example',message:'Underworker INT4/EDU3 cannot be uniquely reconstructed from its published growth/training description and the ordinary TL13 catalogue template rows; no donor or genetic exception is invented.',source:source('97-99,248')}
],operationalDependencies:[{id:'clone-ageing-resolution',message:'Ageing schedule is calculated, but due ageing rolls, losses and survival must be resolved in play.',source:source('97-99')},{id:'clone-medical-outcomes',message:'Medical/transplant check outcomes and later training events are separate from construction accounting.',source:source('99')}]};
 const issue=(severity,code,path,message,pages='96-99')=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const entry=(id,label,cost,pages)=>ledger.push({id,label,cost,slots:0,source:source(pages)});
 const result=totals=>({costLabel:'Clone construction cost',status:diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified',diagnostics,totals:diagnostics.some(d=>['error','blocker'].includes(d.severity))?null:totals,ledger,coverage});
 if(design.kind!=='clone'){const kind=specialKinds.find(k=>k.id===design.kind);issue('blocker','SPECIAL_NOT_IMPLEMENTED','kind',kind?.reason??'This special construction path is not implemented.',kind?.source.pages??'79-105');return result(null);}
 if(Array.isArray(design.special?.trainingSkills)&&design.special.trainingSkills.some(id=>{const pkg=PACKAGES.find(p=>p.id===id);return pkg&&!learnedSkillEligible(pkg);})){issue('error','CLONE_SOFTWARE_BUNDLE','special.trainingSkills','Robot software bundles cannot be purchased as a single biological learned skill. Choose individual learned specialities.','98-99');return result(null);}
 try{validateSpecialFields('clone',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return result(null);}
 const s=design.special,tl=design.techLevel,high=tl>=13,stats={};let templateCost=10000;
 const selectedSkills=[...s.trainingSkills.map(id=>controls.find(c=>c.field==='trainingSkills').choices.find(p=>p.id===id)),...s.trainingCustomSkills.map(p=>({...p,skill:p.skill==='art-instrument'?'art':p.skill,speciality:(p.skill==='art-instrument'?'instrument: ':'')+p.speciality.trim(),label:p.skill+' ('+p.speciality.trim()+') '+p.level,grantsOtherSpecialitiesAtZero:p.skill!=='profession'&&p.level>0,custom:true}))];
 const spent=selectedSkills.reduce((n,p)=>n+cloneSkillPointCost(p.level),0)+['STR','DEX','END','INT'].reduce((n,stat)=>n+cloneCharacteristicPointCost(s['increase'+stat]),0);
 const skillKeys=new Set();
 for(const p of selectedSkills){const key=p.skill+':'+(p.speciality??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,'-');if(skillKeys.has(key))issue('error','CLONE_SKILL_DUPLICATE','special.trainingSkills','Choose a single final level for each skill or specialty.','99');skillKeys.add(key);if(!s.trainingYears&&p.level>1)issue('error','CLONE_INITIAL_SKILL','special.trainingSkills','Skills above level1 require subsequent creche years.','98-99');}
 if(!s.trainingYears&&['STR','DEX','END','INT'].some(stat=>s['increase'+stat]))issue('error','CLONE_INITIAL_CHARACTERISTIC','special','Initial creche points buy skills only; characteristic increases require subsequent years.','98-99');
 for(const stat of ['STR','DEX','END','INT']){
  const roll=s['roll'+stat];if(roll>(high?3:6))issue('error','CLONE_DIE','special.roll'+stat,high?'TL13+ templates require a recorded D3 result.':'Template requires a recorded D6 result.');
  if(s.templateMode==='donor')stats[stat]=Math.floor(s['donor'+stat]/2)+roll+(high?3:0);
  else{const base=s['base'+stat],row=base-(high?6:3),minTL=high?[13,13,13,13,14,15][row]:[8,8,8,9,10,12][row];
   if(minTL===undefined||tl<minTL)issue('error','CLONE_TEMPLATE_TL','special.base'+stat,'Catalogue base is unavailable at this technology.','97');
   else{templateCost+=priceRows[row];entry('template-'+stat,stat+' template adjustment',priceRows[row],'97');}
   stats[stat]=base+roll;
  }
 }
 entry('template','Template acquisition',10000,'96-97');
 const methods={natural:{tl:8,cost:50000,years:18},spare:{tl:9,cost:50000,years:null},accelerated:{tl:10,cost:tl>=13?150000:200000,years:1.5},quick:{tl:13,cost:50000,years:18/50}};
 const growth=methods[s.growth];if(tl<growth.tl)issue('error','CLONE_GROWTH_TL','special.growth','Growth method exceeds design technology.','98');
 let growthCost=growth.cost;
 if(s.procurement==='self'){growthCost=10000;issue('blocker','CLONE_FACILITY','special.procurement','Own-chamber consumables can be estimated, but chamber capability, acquisition cost, feedstock and legal growth setup require separate validation.','49,98');}
 else issue('warning','CLONE_SERVICE_INCLUSION','special.procurement','Estimate treats the commercial growth charge as including growth consumables; the book does not explicitly settle inclusion. Template acquisition is separate.','98');
 entry('growth','Growth '+(s.procurement==='self'?'consumables':'service'),growthCost,'98');
 let storageCost=s.storageYears*12000;if(s.storageYears&&s.growth!=='spare')issue('error','CLONE_STORAGE_METHOD','special.storageYears','Annual storage charge applies to spare bodies.','98');
 if(storageCost)entry('storage','Spare body storage',storageCost,'98');
 if(s.growth==='spare'&&(s.trainingYears||spent||s.adultYears))issue('error','CLONE_SPARE_MIND','special','Spare bodies have no higher mental function; training and playable adult age do not apply.','98');
 if(s.growth==='natural'&&(s.trainingYears||spent))issue('blocker','CLONE_NATURAL_TRAINING','special.trainingYears','Natural growth uses ordinary character education; creche rules are not substituted.','98-99');
 let edu=s.growth==='accelerated'?Math.ceil(stats.INT/2):s.growth==='quick'?0:null;
 let points=s.growth==='accelerated'?4:0,autoEduSpent=0;
 if(s.trainingYears&&s.eduAccounting==='unresolved')issue('blocker','CLONE_EDU_INTERPRETATION','special.eduAccounting','Choose how automatic EDU spending relates to the annual four selectable points. This interpretation must be agreed with the referee.','99');
 const initialEdu=edu;
 if(s.growth==='accelerated'&&s.trainingYears>15)issue('error','CLONE_CRECHE_LIMIT','special.trainingYears','Accelerated maturation already includes one creche year; at most fifteen additional years fit the sixteen-year total.','98-99');
 if(s.growth==='quick'&&s.trainingYears&&s.quickEducation==='unresolved')issue('blocker','CLONE_QUICK_EDU','special.trainingYears','Quick clones may train, but the initial EDU grant on entering a creche is not explicitly settled. The estimate starts from EDU0; referee resolution is required.','98-99');
 let trainedINT=stats.INT,above=0;const annualTraining=[];
 if(s.increaseINT&&s.intTrainingYear>s.trainingYears)issue('error','CLONE_INT_YEAR','special.intTrainingYear','INT completion year must fall within the additional training years.','99');
 if(edu!==null)for(let y=1;y<=s.trainingYears;y++){
  points+=4;autoEduSpent+=2;
  if(edu<trainedINT)edu++;
  else{above+=2;let n=0;while(n<4&&cloneCharacteristicPointCost(n+1)<=above)n++;edu=trainedINT+n;if(above>30)issue('blocker','CLONE_EDU_TABLE_LIMIT','special.trainingYears','Automatic EDU progression beyond the printed +4 characteristic table is unresolved.','99');}
  if(s.increaseINT&&y===s.intTrainingYear){
   const budget=points-(s.eduAccounting==='included'?autoEduSpent:0);
   if(cloneCharacteristicPointCost(s.increaseINT)>budget)issue('error','CLONE_INT_YEAR_BUDGET','special.intTrainingYear','Insufficient banked points in the selected year to complete this INT increase.','99');
   trainedINT=stats.INT+s.increaseINT;
   if(above)issue('blocker','CLONE_INT_EDU_REBASE','special.intTrainingYear','INT increases after EDU has exceeded the old INT need referee resolution of previously spent automatic EDU points.','99');
  }
  annualTraining.push({additionalYear:y,education:edu,intelligence:trainedINT,selectablePointsAccrued:points-(s.eduAccounting==='included'?autoEduSpent:0)});
 } if(s.eduAccounting==='included')points-=autoEduSpent;
 if(spent>points)issue('error','CLONE_TRAINING_BUDGET','special.trainingSkills','Allocated points exceed the available training budget.','99');

 const trainingCost=s.trainingYears*20000;if(trainingCost)entry('training','Additional creche training',trainingCost,'99');
 let ageing=null;
 if(['natural','accelerated','quick'].includes(s.growth)){const quick=s.growth==='quick',natural=s.growth==='natural',interval=quick?2:4,first=natural?16:8;ageing={firstCheckAdultYears:first,intervalYears:interval,firstDM:-4,extraDM:natural?0:quick?null:-2,checksDue:s.adultYears<first?0:Math.floor((s.adultYears-first)/interval)+1,postMaturityRate:quick?2:1};if(ageing.checksDue)issue('blocker','CLONE_AGEING_ROLLS','special.adultYears','Ageing checks are due; characteristic losses and survival must be resolved before certifying the current adult.','97-98');}
 issue('warning','CLONE_SCOPE','coverage','Checks the selected template, growth and supported training rules. Explicit construction gaps, unresolved interpretations and separate in-play outcomes are listed in coverage.','96-99');

 const cost=templateCost+growthCost+storageCost+trainingCost;
 const trainedStats=Object.fromEntries(Object.entries(stats).map(([stat,value])=>[stat,value+s['increase'+stat]]));

 if(s.recordMode==='traveller'){
  if(edu===null)issue('blocker','CLONE_TRAVELLER_EDU','special.recordMode','Traveller skill limits require resolved education; natural education or spare-body identity cannot be inferred.','98-99');
  else if(selectedSkills.reduce((n,p)=>n+p.level,0)>3*(trainedStats.INT+edu))diagnostics.push({severity:'error',code:'TRAVELLER_SKILL_LIMIT',path:'special.trainingSkills',message:'Total skill levels exceed three times INT plus EDU.',source:{book:'Traveller Core Rulebook Update',edition:'Mongoose 2022',pages:'18'}});
 }
 return result({cost,slots:null,bandwidth:null,intelligence:s.growth==='spare'?null:trainedStats.INT,clone:{characteristics:trainedStats,templateCharacteristics:stats,templateCost,growthCost,storageCost,trainingCost,maturityYears:growth.years,education:edu,initialEducation:initialEdu,annualTraining,trainingPoints:points,unspentTrainingPoints:points-spent,ageing,spareBody:s.growth==='spare'},traits:['Biological clone'],skills:copy(selectedSkills),manipulators:[]});
}



const BODY_TIERS={
 android:[['basic',8,1000,1],['improved',10,2000,2],['enhanced',12,5000,3],['advanced',14,10000,3],['superior',16,20000,4]],
 biological:[['basic',11,2000,1],['improved',13,5000,2],['enhanced',15,10000,3],['advanced',17,20000,4]]
};
function bodyControls(kind){return [
 {...select('bodyTier','Biological likeness tier',BODY_TIERS[kind].map(([id,tl])=>[id,`${id} (TL${tl})`]),'basic'),stage:'chassis'},
 ...(kind==='biological'?[
 {...select('genomeLocomotion','Locomotion supported by selected genome',[['unresolved','Not confirmed'],['confirmed','Confirmed by referee / template']],'unresolved'),stage:'locomotion'},
 {...select('genomeOptions','Coatings and protection encoded in genome',[['unresolved','Not confirmed'],['confirmed','Confirmed by referee / template']],'unresolved'),stage:'physical'},
 {...number('bodyTLReduction','Referee-approved biotechnology body TL reduction',0,4,0),stage:'chassis'}]:[])
 ];}
export function evaluateBodyType(design,{baseSlots,brainRank,physicalCost,softwareCost,armourSlots,installedOptions}){
 const kind=design.kind,s=design.special,diagnostics=[],traits=[];
 const issue=(severity,code,path,message,pages=kind==='android'?'86-87':'88-89')=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const physical=design.selections.physical;
 const installed=installedOptions??[...(physical.options??[]),...(physical.defaultSuite??[]),...(physical.optionInstances??[]).map(o=>o.optionId)].map(id=>OPTIONS_ARRAY.find(o=>o.id===id)??OPTIONS.find(o=>o.id===id)??DEFAULT_ITEMS.find(o=>o.id===id)??{id});
 const coatings=installed.filter(o=>o.id==='reflec'||/camouflage|solar-coating|full-surface-video-screen/.test(o.id));
 const genomic=installed.filter(o=>o.environment||o.requiresGenome||coatings.includes(o));
 if(!['android','biological'].includes(kind))throw new TypeError('Body decorator requires android or biological kind.');
 const row=BODY_TIERS[kind].find(r=>r[0]===s.bodyTier);
 if(!row)throw new TypeError('Unknown body tier.');
 const [tier,minTL,perSlot,recommendedRank]=row;
 const reduction=kind==='biological'?s.bodyTLReduction:0;
 if(reduction===1)issue('error','BIO_TL_EXCEPTION','special.bodyTLReduction','The referee exception permits a two-to-four-level reduction, or none.');
 if(design.techLevel<minTL-reduction)issue('error','BODY_TL','special.bodyTier','Body tier exceeds the design technology, after any explicitly approved body-only exception.');
 if(reduction)issue('warning','BIO_REFEREE_EXCEPTION','special.bodyTLReduction','Biotechnology exception requires referee agreement and never lowers brain technology requirements.');
 if(design.selections.physical.armourRemoved)issue('error','BODY_ARMOUR_REMOVAL','physical.armourRemoved','This body already has zero base armour; base armour cannot be removed for a saving.');
 if(kind==='android'&&armourSlots>2)issue('error','ANDROID_ARMOUR_SLOTS','physical.armourAdded','Android internal armour is limited to two Slots.');
 if(brainRank<recommendedRank){traits.push('Additional social DM -2 (brain below body recommendation)');issue('warning','BODY_BRAIN_SOCIAL','brain.model','A less capable brain is permitted but incurs an additional social DM−2.');}
 if(kind==='android'){
  traits.push(['basic','improved'].includes(tier)?(tier==='basic'?'Uncanny appearance: social DM -2':'Close scrutiny within 5m: social DM -2'):tier==='enhanced'?'Appearance failure on natural 2':tier==='advanced'?'Passes without scanning':'Passes most scans');
  if(['enhanced','advanced','superior'].includes(tier))traits.push('Invisitech');
  if(['advanced','superior'].includes(tier))traits.push('Self-repairing');
  if(coatings.length)issue('warning','ANDROID_EXTERNAL_APPEARANCE','physical.options','Conspicuous external equipment or coatings can compromise biological appearance.');
 }else{
  const p=design.selections.physical;
  const naturalModes=['none','walker','aquatic','aeroplane','vtol'];
  for(const mode of ['primary','secondary'])if(!naturalModes.includes(design.selections.locomotion?.[mode]))issue('blocker','BIO_NATURAL_LOCOMOTION','locomotion.'+mode,'This locomotion is outside the verified natural-mode set. Generic genome confirmation cannot authorize mechanical propulsion or an unsupported genome-specific interpretation.');
  if(s.genomeLocomotion!=='confirmed')issue('blocker','BIO_GENOME_LOCOMOTION','special.genomeLocomotion','Confirm that the chosen organism supports the selected locomotion.');
  if(genomic.length&&s.genomeOptions!=='confirmed')issue('blocker','BIO_GENOME_OPTIONS','special.genomeOptions','Biological coatings and protection must be encoded in the genome, not freely added as mechanical options.');
  if(installed.some(o=>o.id.startsWith('full-surface-video-screen')))issue('blocker','BIO_SURFACE_SCREEN','physical.options','A full-surface screen needs a separately verified implant/coating interpretation; generic genome confirmation does not establish that mechanical display hardware is genomic.');
  if(installed.some(o=>o.id==='vacuum-environment-protection'))issue('error','BIO_VACUUM_PRICE','physical.options','Purchased biological vacuum protection uses the biological TL10, Cr50000-per-Base-Slot row. Generic genome confirmation cannot substitute the Cr600 mechanical-body row. Native immunity requires a separately sourced template.','34,88');
  if(installed.some(o=>o.id==='no-internal-power'||o.effects?.removesInternalPower))issue('blocker','BIO_INTERNAL_POWER_CREDIT','physical.options','Biological bodies have no verified removable conventional power pack. The mechanical no-internal-power Slot credit cannot be applied to this body.');
  if(p.powerMode&&p.powerMode!=='conventional')issue('blocker','BIO_ALTERNATIVE_POWER','physical.powerMode','External electrical power or generators cannot replace biological food, water and air. Auxiliary implant power requires a separately supported augmentation route.');
  if(p.powerPacks||p.efficiency)issue('blocker','BIO_POWER_OPTIONS','physical','Conventional power packs and efficiency cannot be substituted for biological feeding without verified source support.');
  if(p.armourAdded)issue('blocker','BIO_ARMOUR_GENOME','physical.armourAdded','Genome-specific armour requires source verification; the android two-Slot cap is not automatically applied to biological bodies.');
  traits.push('Requires food, water and air','Natural healing DM '+[-2,0,2,4][BODY_TIERS.biological.findIndex(r=>r[0]===tier)]);
  issue('warning','BIO_FABRICATION_CONFLICT','special.bodyTier','Living-body fabrication technology differs between p87 (TL16) and pp105/121 (TL17); a self-fabrication claim requires reconciliation.');
 }
 const augmentation=kind==='biological'?evaluateAugmentations(design):null;
 if(augmentation)diagnostics.push(...augmentation.diagnostics);
 const bodyFee=baseSlots*perSlot;
 return {diagnostics,reservedSlots:Math.ceil(baseSlots*(kind==='android'?.5:.75)),bodyFee,augmentationCost:augmentation?.cost??0,augmentation,cost:3*(physicalCost+bodyFee)+softwareCost+(augmentation?.cost??0),baseArmour:0,traits,source:source(kind==='android'?'86-87':'88-89')};
}




const MICRO_BRAINS=[
 {id:'none',label:'Drone (no brain)',tl:8,bandwidth:0,intelligence:0,cost:0,family:'drone',rank:-1},
 {id:'primitive',label:'Primitive',tl:8,bandwidth:0,intelligence:1,cost:100,family:'primitive',rank:0},
 {id:'basic',label:'Basic',tl:11,bandwidth:1,intelligence:4,cost:4000,family:'basic',rank:1},
 {id:'hunter-killer',label:'Hunter/Killer',tl:11,bandwidth:1,intelligence:4,cost:6000,family:'hunter-killer',rank:1},
 {id:'advanced',label:'Advanced (p81 microbot row)',tl:12,bandwidth:2,intelligence:6,cost:10000,family:'advanced',rank:2},
 {id:'very-advanced',label:'Very Advanced',tl:15,bandwidth:3,intelligence:9,cost:500000,family:'very-advanced',rank:3},
 {id:'very-advanced-tl17',label:'Very Advanced Computer/4 (p104)',tl:17,bandwidth:4,intelligence:10,cost:500000,family:'very-advanced',rank:3},
 {id:'very-advanced-tl19',label:'Very Advanced Computer/5 (p104)',tl:19,bandwidth:5,intelligence:11,cost:500000,family:'very-advanced',rank:3}
];
const microEligible=o=>o?.zeroSlot===true&&o.slotsBasis==='fixed'&&o.slots===0&&o.implemented===true&&(!o.allowedKinds||o.allowedKinds.includes('microbot'))&&o.id!=='reflec'&&['each','baseSlots'].includes(o.costBasis);
const MICRO_OPTIONS=OPTIONS.filter(microEligible);const microControls=[
 {field:'optionInstances',label:'Separate microbot zero-slot installations',type:'option-instances',default:[],choices:MICRO_OPTIONS,stage:'physical',ledgerPrefix:'instance-',summaryLabel:'Repeated and configured hardware',description:'Each installed copy counts against the microbot technology-level allowance. No default suite or actual Slots are available.',expandByDefault:true,source:source('80-81')},
 {...select('selfDestruct','Microbot self-destruct',[['none','None'],['defensive','Defensive: 1D to self'],['offensive','Offensive: 1D to contact target, mass above1g']],'none'),stage:'physical',source:source('53,80-81')},
 {...select('massUnit','Mass unit',[['mg','Milligrams'],['microgram','Micrograms (TL19+)']],'mg'),stage:'chassis',source:source('80,105')},
 {...number('massMg','Mass (selected unit)',1,30000,1000),stage:'chassis'},
 {...select('locomotion','Microbot locomotion',LOCOMOTION.map(l=>[l.id,l.label]),'walker'),stage:'locomotion'},
 {...number('speedIncrease','Additional tactical movement (metres)',0,12,0),stage:'locomotion'},
 {...select('efficiency','Power efficiency',[['normal','Normal'],['improved','Improved efficiency']],'normal'),stage:'physical'},
 {...number('arms','Size0 arms (no free arms)',0,18,0),stage:'physical'},
 {...number('armDexIncrease','DEX increase for each arm',0,13,0),stage:'physical'},
 {...select('environment','Environmental protection',[['none','None'],['corrosive','Corrosive'],['insidious','Insidious']],'none'),stage:'physical'},
 {...number('radiationLevels','Radiation protection levels',0,18,0),stage:'physical'},
 {field:'options',label:'Microbot zero-slot hardware',type:'multiselect',default:[],choices:MICRO_OPTIONS,stage:'physical'},
 {...select('brain','Microbot brain',MICRO_BRAINS.map(b=>[b.id,`${b.label} (TL${b.tl})`]),'primitive'),stage:'brain'},
 {...number('intellectUpgrade','Intellect increase',0,3,0),stage:'brain'},
 {...select('hardened','Brain hardening',[['no','None'],['yes','Hardened']],'no'),stage:'brain'},
 {...select('advancedBrainInterpretation','Advanced brain source discrepancy',[['unresolved','Not resolved'],['micro-table','Use the explicit p81 microbot table (INT6, TL12)']],'unresolved'),stage:'brain',visibleWhen:{field:'brain',equals:'advanced'}},
 {...select('hunterBandwidth','Hunter/Killer package bandwidth interpretation',[['unresolved','Unresolved source ambiguity'],['zero','Referee interpretation: hard-coded package uses 0 BW'],['one','Referee interpretation: hard-coded package uses 1 BW']],'unresolved'),stage:'skills',visibleWhen:{field:'brain',equals:'hunter-killer'}},
 {...select('corePackage','Hard-coded skill package',CORE_PACKAGES.map(p=>[p.id,p.label]),'primitive-alert'),stage:'skills'},
 {field:'packages',label:'Installed microbot software',type:'multiselect',default:[],choices:PACKAGES,stage:'skills'}
].map(c=>({...c,source:source('79-81')}));
function evaluateMicrobot(design){
 const diagnostics=[],ledger=[];
 const issue=(severity,code,path,message,pages='79-81')=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const entry=(id,label,cost,pages='79-81')=>ledger.push({id,label,cost,slots:0,source:source(pages)});
 const coverage={complete:false,scope:'Microbot construction with implemented zero-slot catalogue',gaps:[{id:'micro-options',message:'Operational swarm coordination and non-catalogued custom device pricing require their separate source rules.',source:source('79-81')},{id:'micro-brain-conflict',message:'Advanced brain table p81 differs from ordinary p66; a recorded interpretation is required.',source:source('66,81')}]};
 const finish=totals=>{const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';return{costLabel:'Construction cost',status,diagnostics,ledger,totals:status==='verified'?totals:null,coverage};};
 for(const id of [...(Array.isArray(design.special?.options)?design.special.options:[]),...(Array.isArray(design.special?.optionInstances)?design.special.optionInstances.map(o=>o?.optionId):[])]){const option=OPTIONS.find(o=>o.id===id);if(option&&!microEligible(option))issue('error','MICRO_OPTION_ELIGIBILITY','special.options','This option is slotted, body-ineligible or outside the verified microbot zero-slot set.','80');}
 if(diagnostics.some(d=>d.severity==='error'))return finish(null);
 try{validateSpecialFields('microbot',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return finish(null);}
 const s=design.special,tl=design.techLevel,b=MICRO_BRAINS.find(b=>b.id===s.brain),l=LOCOMOTION.find(l=>l.id===s.locomotion),core=CORE_PACKAGES.find(p=>p.id===s.corePackage);
 if(tl<8)issue('error','MICRO_TL','techLevel','Microbots require TL8 or later.');
 const masses=[1000,500,250,125,60,30,15,8,4,2];const minMass=tl>=19?null:masses[Math.max(0,Math.min(9,tl-8))],massMg=s.massMg/(s.massUnit==='microgram'?1000:1);
 if(s.massUnit==='microgram'&&tl<19)issue('error','MICRO_SUBMILLIGRAM_TL','special.massUnit','Sub-milligram microbots require TL19.','105');
 if(minMass!==null&&massMg<minMass)issue('error','MICRO_MASS','special.massMg','Mass is below the minimum for this technology.');
 if(tl===18)issue('warning','MICRO_HIGH_TL_MASS','special.massMg','Minimum mass uses the last printed table row (TL17); smaller higher-TL extrapolations are not assumed.');
 if(l.tl>tl)issue('error','MICRO_LOCOMOTION_TL','special.locomotion','Locomotion exceeds design technology.');
 if(l.id==='aeroplane')issue('blocker','MICRO_AEROPLANE_CONFLICT','special.locomotion','Microbots allow locomotion options generally, but aeroplane movement requires vehicle movement, which microbots prohibit. Referee reconciliation is required.','17,80');
 if(l.id==='thruster')issue('blocker','MICRO_THRUSTER_PRIMARY','special.locomotion','Microbot general locomotion permission conflicts with the ordinary primary-thruster restriction; source reconciliation is required.','17,80');
 if(l.id==='none'&&s.speedIncrease)issue('error','MICRO_STATIONARY_SPEED','special.speedIncrease','Stationary microbots cannot buy tactical movement.');
 const baseCost=50*l.multiplier,baseSpeed=l.id==='none'?0:Math.ceil((5+l.agility)/2),speed=baseSpeed+s.speedIncrease;
 if(speed>12)issue('error','MICRO_SPEED_CAP','special.speedIncrease','Microbot tactical movement cannot exceed 12 metres.');
 if(s.speedIncrease>=10)issue('warning','MICRO_ENDURANCE','special.speedIncrease','Tactical increase leaves no positive internal endurance; an external power operating interpretation may be needed. The book does not explicitly ban this configuration.');
 let hardware=baseCost,software=0;entry('micro-body','Microbot chassis and locomotion',baseCost);
 if(s.efficiency==='improved'){hardware+=baseCost*.5;entry('efficiency','Improved efficiency',baseCost*.5);}
 if(s.speedIncrease){const cost=25*l.multiplier*s.speedIncrease;hardware+=cost;entry('movement','Increased tactical movement',cost);}
 if(s.armDexIncrease&&!s.arms)issue('error','MICRO_ARMS_REQUIRED','special.armDexIncrease','DEX upgrades require at least one arm.');
 const armDEX=Math.ceil(tl/2+1)+s.armDexIncrease;
 if(armDEX>tl+3)issue('error','MICRO_ARM_DEX','special.armDexIncrease','Manipulator DEX cannot exceed TL+3.','26,80');
 if(s.armDexIncrease)issue('blocker','MICRO_ARM_UPGRADE_PRICE','special.armDexIncrease','Size0 manipulator upgrade pricing is not resolved; do not apply the ordinary size multiplier to create free upgrades.','26,80');
 if(s.arms){hardware+=s.arms*10;entry('arms','Size0 manipulators',s.arms*10);}
 if(b.tl>tl)issue('error','MICRO_BRAIN_TL','special.brain','The microbot brain table availability exceeds design technology.');
 if(b.id==='advanced'){
  if(s.advancedBrainInterpretation==='unresolved')issue('blocker','MICRO_BRAIN_CONFLICT','special.advancedBrainInterpretation','p81 lists Advanced TL12 / INT6 / BW2 / Cr10000, unlike the ordinary p66 brain and shrink-fit rule. Choose the explicit microbot table to record that interpretation.','66,81');
  else issue('warning','MICRO_BRAIN_TABLE','special.brain','Using the explicit p81 microbot table: TL12, INT6, BW2, Cr10000; ordinary-brain INT8 and fit TL14 are not silently substituted.','66,81');
 }
 if(b.rank>=3&&tl>b.tl)issue('warning','MICRO_BRAIN_PRICE_INTERPRETATION','special.brain','Uses the printed microbot table price at higher TL; the book does not explicitly define a new retro-brain discount clock after microbot fit.','67,81');
 const brainCost=b.cost*(s.hardened==='yes'?1.5:1);hardware+=brainCost;entry('brain','Microbot brain',brainCost,'67,81');
 const intellectBW=s.intellectUpgrade*(s.intellectUpgrade+1)/2,intelligence=b.intelligence+s.intellectUpgrade;
 let intellectCost=s.intellectUpgrade?1000:0;for(let n=1;n<=s.intellectUpgrade;n++)intellectCost*=b.intelligence+n;if(intelligence>=12)intellectCost*=2;
 if(intellectCost){hardware+=intellectCost;entry('intellect','Intellect upgrade',intellectCost,'67');}
 let bw=intellectBW,zeroBW=0;const installed=[];
 if(b.rank<0){
  if(core.id!=='none'||s.packages.length||s.intellectUpgrade||s.hardened==='yes')issue('error','MICRO_NO_BRAIN_SOFTWARE','special.brain','A brainless microdrone cannot install brain upgrades or skill software.');
  if(!s.options.includes('drone-interface'))issue('error','MICRO_DRONE_INTERFACE','special.options','A brainless microdrone requires an onboard drone receiver.');
  if(!s.options.some(id=>id.startsWith('transceiver')||['wireless','wireless-data-link'].includes(id)))issue('error','MICRO_DRONE_COMMS','special.options','A brainless microdrone requires communications.');
 }else if(b.rank<2){
  if(core.family!==b.family)issue('error','MICRO_CORE_FAMILY','special.corePackage','Hard-coded package does not match the selected brain.','69-73');
  if(s.packages.length)issue('blocker','MICRO_CORE_ADDONS','special.packages','Additional hard-coded skills and bandwidth interpretation require their dedicated package rules.','69-73');
  if(core.reason||core.implemented===false)issue('blocker','MICRO_CORE_DETAIL','special.corePackage',core.reason??'The selected hard-coded package requires unresolved detail.','69-73');
  if(b.family==='hunter-killer'&&s.hunterBandwidth==='unresolved')issue('blocker','MICRO_HUNTER_BANDWIDTH','special.hunterBandwidth','Hunter/Killer hard-coded bandwidth differs between the package rules; record the referee interpretation.','72-73');
  software+=core.cost;bw+=b.family==='hunter-killer'&&s.hunterBandwidth==='zero'?0:core.bandwidth;installed.push(...core.skills.map(([skill,level])=>({skill,level})));entry('core-package','Hard-coded skill package',core.cost,'69-73');
 }else{
  if(core.id!=='none')issue('error','MICRO_CORE_ADVANCED','special.corePackage','Advanced brains use installed skill packages rather than hard-coded primitive packages.','69-73');
  const selected=s.packages.map(id=>PACKAGES.find(p=>p.id===id));const seen=new Set();
  for(const p of selected){
   const key=p.skill+':'+(p.speciality??'');if(seen.has(key))issue('error','MICRO_SKILL_DUPLICATE','special.packages','Install a single level of each skill or specialty.','73');seen.add(key);
   if(p.implemented===false)issue('blocker','MICRO_SKILL_SPECIALTY','special.packages',p.reason??'This package requires specialty details.','73-75');
   if(p.tl>tl)issue('error','MICRO_SKILL_TL','special.packages','Skill software exceeds design technology.','73');
   if((p.perPackageBandwidth??p.bandwidth)>b.bandwidth)issue('error','MICRO_SKILL_BW','special.packages','Skill exceeds inherent brain bandwidth.','73');
   if(p.bandwidth===0)zeroBW++;else bw+=p.bandwidth;
   software+=p.cost;entry(p.id,p.label,p.cost,'73-75');installed.push(copy(p));
  }
 }
 const zeroBWAllowance=b.rank>=2?b.bandwidth:0;if(zeroBW>zeroBWAllowance)bw+=zeroBW-zeroBWAllowance;
 if(bw>b.bandwidth)issue('error','MICRO_BANDWIDTH','special','Intellect and software exceed inherent bandwidth; microbots cannot add memory modules.','67,80-81');
 let zeroCount=s.arms+(s.environment==='none'?0:1)+s.radiationLevels+(s.selfDestruct==='none'?0:1);
 if(s.selfDestruct!=='none'){const destructCost=s.selfDestruct==='defensive'?250:500;hardware+=destructCost;entry('micro-self-destruct','Microbot '+s.selfDestruct+' self-destruct',destructCost,'53,80-81');if(s.selfDestruct==='offensive'&&massMg<=1000)issue('error','MICRO_OFFENSIVE_MASS','special.massMg','Offensive microbot self-destruct requires mass strictly above one gram.','81');issue('warning','MICRO_SELF_DESTRUCT_PRICE','special.selfDestruct','Price combines the p53 per-Base-Slot rate with p80 half-Base-Slot pricing; p81 supplies miniature effects and no separate price row.','53,80-81');}
 const equipment=evaluateEquipment({kind:'microbot',techLevel:tl,selections:{chassis:{size:'size-0'},physical:{options:s.options,defaultSuite:[],optionParameters:{},optionInstances:s.optionInstances,armourRemoved:false,vehicleSpeed:false,powerPacks:0,powerMode:'conventional'}}},MICRO_OPTIONS,.5);
 diagnostics.push(...equipment.diagnostics.map(d=>({...d,path:d.path.replace(/^physical/,'special')})));
 hardware+=equipment.cost;zeroCount+=equipment.installed.reduce((n,o)=>n+o.quantity,0);
 ledger.push(...equipment.ledger.filter(e=>e.id!=='zero-slot-overflow'));
 // Shared equipment checks prices/dependencies only. Microbots never receive ordinary default-suite/free-slot allowances.
 if(equipment.installed.some(o=>!microEligible(o)))issue('error','MICRO_OPTION_SLOT','special.options','Installed hardware must remain eligible zero-slot equipment.','80'); if(zeroCount>tl)issue('error','MICRO_ZERO_SLOTS','special','Microbot zero-slot choices exceed TL; no actual Slots are available for overflow.');
 const env=s.environment==='corrosive'?{tl:9,multiplier:2}:s.environment==='insidious'?{tl:11,multiplier:5}:{tl:0,multiplier:1};
 if(env.tl>tl)issue('error','MICRO_ENV_TL','special.environment','Environmental protection exceeds design technology.');
 const protectionMultiplier=env.multiplier*2**s.radiationLevels;
 if(protectionMultiplier>1)entry('protection','Cumulative protection hardware multiplier',hardware*(protectionMultiplier-1));
 hardware*=protectionMultiplier;
 const endurance=Math.round(l.endurance*(tl>=15?2:tl>=12?1.5:1)*(s.efficiency==='improved'?2:1)*(1-s.speedIncrease*.1));
 const capabilityEquipment=[...equipment.installed];
 if(s.environment!=='none')capabilityEquipment.push({...OPTIONS.find(o=>o.id===s.environment+'-environment-protection'),quantity:1,parameters:{}});
 if(s.radiationLevels)capabilityEquipment.push({...OPTIONS.find(o=>o.id==='radiation-environment-protection'),quantity:s.radiationLevels,parameters:{}});
 const capabilities=equipmentCapabilities(capabilityEquipment,{techLevel:tl,primary:l.id,tacticalSpeed:speed,brainFamily:b.family});
 issue('warning','MICRO_SCOPE','coverage','Checks the implemented microbot table and selected zero-slot hardware, not every Handbook device. No default suite, secondary locomotion, armour, memory module or power pack is included.');
 return finish({cost:hardware+software,capabilities,equipment:capabilityEquipment.map(o=>({id:o.instanceId??o.id,optionId:o.id,label:o.label,quantity:o.quantity,source:o.source})),slots:{base:0,capacity:0,used:0,remaining:0},bandwidth:{inherent:b.bandwidth,capacity:b.bandwidth,used:bw,remaining:b.bandwidth-bw},zeroSlot:{allowance:tl,used:zeroCount,overflow:0},zeroBandwidth:{allowance:zeroBWAllowance,used:zeroBW,overflow:Math.max(0,zeroBW-zeroBWAllowance)},hits:1,armour:0,tacticalSpeed:speed,endurance,intelligence,skills:installed,manipulators:Array.from({length:s.arms},(_,i)=>({id:'micro-'+(i+1),size:0,strength:0,dexterity:armDEX})),traits:['Small (-4)',...l.traits,...equipment.traits],microbot:{massMg,minMassMg:minMass,selfDestruct:s.selfDestruct==='none'?null:{type:s.selfDestruct,damageDice:1,target:s.selfDestruct==='defensive'?'self':'direct-contact target'},hardwareCost:hardware,softwareCost:software,protectionMultiplier}});
}



const nanoControls=[
 {...select('packageType','Nanorobot medical package',[['pharmaceutical','Pharmaceutical'],['physical','Physical enhancement'],['mental','Mental enhancement'],['anti-ageing','Anti-ageing'],['regenerative','Regenerative'],['construction-basic','Construction (basic)'],['construction-improved','Construction (improved)'],['excavation','Environmental excavation'],['soil','Soil enrichment'],['cleanup','Environmental cleanup'],['construction-enhanced','Nanoconstructor (enhanced)'],['construction-advanced','Nanoconstructor (advanced)'],['construction-superior','Nanoconstructor (superior)'],['distributed-conscious','Distributed conscious swarm']],'pharmaceutical'),stage:'chassis'},
 {...number('packages','Packages in this purchase',1,100,1),stage:'chassis'},
 {...number('otherActivePackages','Other active medical packages already in body',0,100,0),stage:'physical'},
 {...number('attributeIncrease','Requested attribute increase',1,3,1),stage:'physical'},
 {...number('continuousTreatmentYears','Years of continuous anti-ageing treatment',0,1000,0),stage:'physical',visibleWhen:{field:'packageType',equals:'anti-ageing'}},
 {...number('controllerMaxTasks','External controller maximum tasks',1,1000,1),stage:'brain'},
 {...select('materials','Construction materials',[['purchased','Purchased feedstock'],['local','Suitable local materials']],'purchased'),stage:'physical'},
 {...number('outputRetailValue','Retail value of planned construction output',0,1000000000,0),stage:'finalisation'},
 {...number('materialRoll','Recorded feedstock cost D6 result',1,6,1),stage:'finalisation'},
 {...select('excavationMaterial','Excavation material',[['normal','Normal'],['soft','Soft material'],['hard','Metal or rubble']],'normal'),stage:'physical'},
 {...number('cleanupUnitCost','Cleanup price per Slot/hour capacity',10000,100000,10000),stage:'physical'},
 {...select('uniqueCleanup','Unique cleanup formulation',[['no','Ordinary'],['yes','Unique formulation']],'no'),stage:'physical'},
 {...select('soilMaterial','Soil composition',[['ordinary','Supported soil materials'],['crystaliron','Crystaliron'],['diamond','Diamond'],['superdense','Superdense']],'ordinary'),stage:'physical'},
 {...select('regulatedExcavation','Regulated excavation operation',[['yes','Yes'],['no','No']],'yes'),stage:'finalisation'},
 {...select('shutdownFailsafe','Shutdown-signal failsafe',[['yes','Present'],['no','Absent']],'yes'),stage:'finalisation'},
 {...select('commsLossFailsafe','Communication-loss failsafe',[['yes','Present'],['no','Absent']],'yes'),stage:'finalisation'},
 {...number('checkinMinutes','Excavation check-in interval (minutes)',1,60,60),stage:'finalisation'},
 {...select('environment','Additional nano protection',[['none','Baseline vacuum and hostile'],['corrosive','Corrosive'],['insidious','Insidious']],'none'),stage:'physical'},
 {...number('radiationLevels','Radiation protection levels',0,10,0),stage:'physical'},
 {...select('existingAgeingPackage','Another anti-ageing package active',[['no','No'],['yes','Yes']],'no'),stage:'physical',visibleWhen:{field:'packageType',equals:'anti-ageing'}}
].map(c=>({...c,source:source('83-86')}));
function evaluateNanorobot(design){
 const diagnostics=[],ledger=[];const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source('83-86')});
 const coverage={complete:false,scope:'Selected medical nanorobot package cost, lifetime and supported effect parameters',gaps:[{id:'nano-mixed-medical-inventory',category:'construction',message:'A complete mixed medical-package inventory is not modelled; other active medical packages are supplied as a count, not a validated set of individual types and overlapping effects.',source:source('83-84')}],operationalDependencies:[{id:'nano-medical-application',message:'Target anatomy, specific pharmaceutical effects, drug interactions and actual treatment outcomes require their applicable rules.',source:source('83-84')}],constraints:[{id:'nano-neurology',message:'Regenerative nanorobots cannot repair brain damage.',source:source('83-84')}]};
 const finish=totals=>{const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';return{costLabel:design.kind==='nanorobot'?'Selected package cost':'Interface cost only',status,diagnostics,ledger,coverage,totals:status==='verified'?totals:null};};
 try{validateSpecialFields('nanorobot',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return finish(null);}
 const s=design.special,tl=design.techLevel;
 if(['construction-enhanced','construction-advanced','construction-superior','distributed-conscious'].includes(s.packageType))return evaluateHighNano(design);
 if(tl<13)issue('error','NANO_TL','techLevel','Practical medical nanorobot packages require TL13.');
 if(['construction-basic','construction-improved','excavation','soil','cleanup'].includes(s.packageType))return evaluateNanoSwarm(design);
 const price={pharmaceutical:20000,physical:20000,mental:40000,'anti-ageing':80000,regenerative:20000}[s.packageType];
 const lifeYears=2**(tl-13),totalActive=s.packages+s.otherActivePackages,enduranceLoss=Math.max(0,totalActive-15);
 let effect={};
 if(['physical','mental'].includes(s.packageType)){
  const required=[1,3,6][s.attributeIncrease-1];if(s.packages<required)issue('error','NANO_ATTRIBUTE_PACKAGES','special.packages','Requested attribute increase requires '+required+' packages.');
  effect={attributeIncrease:s.attributeIncrease,packagesRequired:required,attributeCategory:s.packageType};
  if(s.packages>required)issue('warning','NANO_EXTRA_PACKAGES','special.packages','Additional purchased packages do not increase this attribute beyond the selected effect. All active packages still count toward the medical limit.');
 }
 if(s.packageType==='anti-ageing'){
  if(s.packages!==1||s.existingAgeingPackage==='yes')issue('error','NANO_AGEING_SINGLE','special.packages','Only one anti-ageing package may be active.');
  const effectiveTL=tl-Math.floor(s.continuousTreatmentYears/20);
  effect={effectiveTL,ageingReduction:effectiveTL<13?0:effectiveTL===13?.5:effectiveTL===14?.75:.9};
  if(effectiveTL<13)issue('warning','NANO_AGEING_EFFECTIVE_TL','special.continuousTreatmentYears','Continuous treatment has reduced effective technology below the printed anti-ageing effect table.');
 }
 if(s.packageType==='regenerative'){
  if(s.packages>4)issue('error','NANO_REGEN_LIMIT','special.packages','At most four regenerative packages may be active.');
  effect={permanentCharacteristicPointsPerWeek:s.packages,repairsBrain:false,requiresNutrition:true};

 }
 if(enduranceLoss)issue('warning','NANO_PERMANENT_END','special.otherActivePackages','This active medical package total permanently reduces END by '+enduranceLoss+'.');
 const protectionMultiplier=(s.environment==='corrosive'?2:s.environment==='insidious'?5:1)*2**s.radiationLevels;
 const cost=price===null?null:price*s.packages*protectionMultiplier;
 if(cost!==null)ledger.push({id:'nano-packages',label:'Medical nanorobot packages',cost,slots:0,source:source('83-86')});
 return finish({cost,slots:null,bandwidth:null,nanorobot:{packageType:s.packageType,packages:s.packages,volumeLitres:s.packages*.1,massKg:s.packages*.1,pricePerPackage:price,lifeYears,totalActiveMedicalPackages:totalActive,permanentEnduranceLoss:enduranceLoss,...effect},traits:['Medical nanorobot package','Vacuum protection','Hostile environment protection'],skills:[],manipulators:[]});
}


function hostControls(kind){const ship=kind==='ship-brain';return [
 {...number('hostSize',ship?'Host hull displacement (tons)':'Host vehicle size (Spaces)',1,100000000,ship?100:10),stage:'chassis'},
 {...select('installation','Interface installation',[['new','New construction'],['retrofit','Retrofit']],'new'),stage:'chassis'},
 {...select('selfLabour','Perform retrofit labour personally',[['no','No'],['yes','Yes']],'no'),stage:'physical'},
 ...(!ship?[{...select('bodyMode','Installed robot hardware',[['bare','Bare brain and memory'],['body','Robot body with other equipment']],'bare'),stage:'chassis'}]:[]),
 {...number('bodySize','Installed robot body Size',1,8,5),stage:'chassis'},
 {...select('locomotion','Installed body has locomotion',[['no','No'],['yes','Yes']],'no'),stage:'locomotion'},
 {...select('manipulators','Installed body has manipulators',[['no','No'],['yes','Yes']],'no'),stage:'physical'},
 {...select('brainClass','Installed brain capability',[['primitive','Primitive'],['basic','Basic'],['hunter-killer','Hunter/Killer'],['advanced','Advanced'],['very-advanced','Very Advanced'],['self-aware','Self-Aware'],['conscious','Conscious']],'advanced'),stage:'brain'},
 {...number('brainTL','Installed brain technology',7,23,12),stage:'brain'},
 {...select('brainActive','Installed brain active',[['yes','Active'],['no','Inactive / hibernating']],'yes'),stage:'brain'},
 ...(ship?[
 {...select('fullHaptics','Ship-wide haptic controls',[['no','No'],['yes','Yes']],'no'),stage:'physical'},
 {...select('connection','Connection to ship interface',[['hardwired','Hardwired'],['wireless','Wireless only']],'hardwired'),stage:'physical'},
 {...select('astrogationReview','Conscious being reviews nonconscious astrogation',[['no','No'],['yes','Yes']],'no'),stage:'skills'},
 {...select('consciousOnboard','Conscious sentient present aboard',[['yes','Yes'],['no','No']],'yes'),stage:'finalisation'}]:[])
 ].map(c=>({...c,source:source(ship?'102-103':'101-102')}));}
function evaluateBrainHost(design){
 const ship=design.kind==='ship-brain',diagnostics=[],ledger=[],pages=ship?'102-103':'101-102';
 const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const coverage={complete:false,scope:'Host integration calculator only; neither the host nor the supplied robot/brain is construction-validated',gaps:[{id:'external-host',message:ship?'Ship hull, power, fittings and legality require High Guard.':'Vehicle construction and host capacity require the Vehicle Handbook.',source:source(pages)},{id:'installed-brain',message:'The installed robot/brain and its skills require a separate valid design. Entered metrics are not proof of source compliance.',source:source(pages)}]};
 const finish=totals=>{const status=diagnostics.some(d=>d.severity==='error')?'invalid':'verified';return{costLabel:design.kind==='nanorobot'?'Selected package cost':'Interface cost only',status,diagnostics,ledger,coverage,totals:status==='verified'?totals:null};};
 try{validateSpecialFields(design.kind,design.special);}catch(e){issue('error','SCHEMA','special',e.message);return finish(null);}
 const s=design.special;
 if(design.techLevel<10)issue('error','HOST_INTERFACE_TL','techLevel','Host interface requires TL10.');
 if(s.brainTL<({primitive:7,basic:8,'hunter-killer':8,advanced:10,'very-advanced':12,'self-aware':15,conscious:17})[s.brainClass])issue('error','HOST_BRAIN_CAPABILITY_TL','special.brainTL','Declared brain capability is unavailable at the supplied brain technology.');
 if(s.brainTL>design.techLevel)issue('error','HOST_BRAIN_TL','special.brainTL','Installed brain technology exceeds the declared design technology.');
 let occupied,rate,retrofitHours=null,retrofitPersonDays=null,effectiveDexterity=null,astrogationDM=null,misjumpDM=null;
 if(ship){
  if(['primitive','basic','hunter-killer'].includes(s.brainClass))issue('error','SHIP_MIN_BRAIN','special.brainClass','Ship brains require Advanced capability or better.');
  if(s.connection!=='hardwired')issue('error','SHIP_HARDWIRED','special.connection','The ship brain must be hardwired to the ship interface.');
  occupied=s.bodySize<=6?0:s.bodySize===7?.5:1;
  if(s.locomotion==='yes'&&s.manipulators==='yes')occupied*=2;
  rate=s.installation==='new'?5000:8000-(s.selfLabour==='yes'?1000:0);
  if(s.installation==='retrofit')retrofitPersonDays=s.hostSize/5;
  if(s.fullHaptics==='yes'){rate+=2000;effectiveDexterity=s.brainTL;}
  astrogationDM=s.brainActive==='no'?null:s.brainClass==='conscious'?0:s.astrogationReview==='yes'?-2:-4;
  misjumpDM=s.consciousOnboard==='yes'||s.brainClass==='conscious'&&s.brainActive==='yes'?0:-4;
 }else{
  occupied=s.bodyMode==='bare'||s.bodySize<=4?0:Math.ceil(({5:.5,6:1,7:2,8:4})[s.bodySize]);
  rate=s.installation==='new'?1000:2000-(s.selfLabour==='yes'?100:0);
  if(s.installation==='retrofit')retrofitHours=s.hostSize;
  if(s.bodyMode==='bare'&&(s.locomotion==='yes'||s.manipulators==='yes'))issue('error','VEHICLE_BARE_EQUIPMENT','special.bodyMode','Bare-brain installation cannot include locomotion or manipulators; additional hardware requires a body.');
 }
 if(s.installation==='new'&&s.selfLabour==='yes')issue('warning','HOST_NEW_SELF_LABOUR','special.selfLabour','Self-labour saving applies only to retrofit; no discount is applied to a new interface.');
 if(occupied>s.hostSize)issue('error','HOST_CAPACITY','special.bodySize','Installed robot occupancy exceeds the entered host size.');
 const cost=s.hostSize*rate;ledger.push({id:'host-interface',label:ship?'Ship brain interface':'Vehicle brain interface',cost,slots:0,source:source(pages)});
 issue('warning','EXTERNAL_HOST_DEPENDENCY','coverage','This total covers the Handbook interface only. It excludes host and robot purchase costs and does not certify their construction or available capacity.');
 if(ship)issue('warning','CHARTED_SPACE_NAVIGATION','special.brainClass','Displayed nonconscious navigation modifiers apply in Charted Space. Self-Aware is not Conscious.');
 return finish({cost,slots:null,bandwidth:null,integration:{integrationOnly:true,hostSize:s.hostSize,hostUnit:ship?'tons':'Spaces',interfaceRate:rate,occupiedHostCapacity:occupied,retrofitHours,retrofitPersonDays,effectiveDexterity,astrogationDM,misjumpDM,externalConstructionValidated:false},traits:[ship?'Ship interface':'Vehicle interface'],skills:[],manipulators:[]});
}
export function getSpecialStageNotes(kind){
 const pages=specialKinds.find(k=>k.id===kind)?.source.pages??'79-105';
 const common={};
 if(kind==='clone')Object.assign(common,{chassis:'Choose a biological template and record its characteristic rolls. This is not a robotic chassis.',locomotion:'Locomotion is inherited from the biological template. Ordinary robot locomotion hardware is not part of clone construction.',physical:'Choose growth and procurement. Natural growth, spare bodies, accelerated growth and quick growth have different costs and capabilities.',brain:'INT belongs to the biological template. Robot brains, bandwidth and software upgrades do not apply.',skills:'Allocate creche training points to biological skills and characteristics. These are learned abilities, not software.',finalisation:'Record adult age and optionally check Traveller creation limits. Resolve due ageing checks separately.'});
 else if(kind==='nanorobot')Object.assign(common,{chassis:'Select medical, construction or environmental package type and quantity; packages have no ordinary chassis.',locomotion:'Nanorobot packages do not use the ordinary robot locomotion step.',physical:'Review type-specific medical effects or industrial capacity, protection and material requirements.',brain:'Medical packages do not purchase robot brains. Industrial swarms use an externally constructed controller, limited by its Max Tasks.',skills:'Medical package effects are not installable robot skill software.',finalisation:'Package lifetime, operating limits and applicable END consequences appear in the result. Controller design and detailed drug interactions remain external dependencies.'});
 else if(['vehicle-brain','ship-brain'].includes(kind))Object.assign(common,{chassis:'Enter host and installed-robot metrics for interface calculations. This does not construct or validate the external host.',locomotion:'Indicate whether the installed robot body has locomotion; the host uses its own construction rules.',physical:'Configure the installation and applicable interfaces.',brain:'Record the externally constructed brain capability and technology.',skills:'Installed skills require a separate robot design. Applicable ship navigation modifiers are calculated here.',finalisation:'Review the interface cost and any attached robot construction costs. External host purchase and construction remain excluded.'});
 if(kind==='microbot')Object.assign(common,{chassis:'Choose mass within the microbot technology limits. Size0 has one Hit and no ordinary Slots.',locomotion:'Microbot movement starts at half normal speed, rounded up; secondary and vehicle movement are not part of this path.',physical:'There is no free default suite or free arm. Installed zero-slot choices are limited by technology.',brain:'Use the explicit microbot brain availability table. Its Advanced row has a documented source discrepancy.',skills:'Installed software uses inherent brain bandwidth. Brainless drones use an external controller.',finalisation:'Review construction cost, zero-slot count and bandwidth. Published catalogue prices may differ from raw construction cost.'});
 if(kind==='cyborg')Object.assign(common,{chassis:'Select a full-body conversion interface. The replacement robot, vehicle or ship body is a separate design.',locomotion:'Major changes to the original limb layout affect long-term degradation. Additional grav movement while retaining limbs is not inherently a major layout change.',physical:'Reserve capacity for the organic-brain interface in the separately constructed body.',brain:'Original organic intelligence and education are retained; this interface does not purchase a robot brain.',skills:'Biological learned skills are retained. Robot software is not automatically substituted or granted.',finalisation:'Procedure and degradation requirements are reported separately from the interface-only cost. Resolve actual surgery with the character rules.'});
 if(kind==='missile')Object.assign(common,{chassis:'Choose a standard carrier. Custom robot warheads require a separate construction record.',locomotion:'Carrier propulsion is fixed: primary and secondary thrusters with vehicle movement. Flight burn is measured in rounds.',physical:'Check custom warhead Size, base Slots and payload capacity. Removing the supplied warhead gives no credit.',brain:'Factory carrier uses a primitive homing brain and drone interface. A different control arrangement needs separately priced alterations.',skills:'A single controlling brain requires Pilot; a dedicated homing brain requires an interface/controller link.',finalisation:'Shown cost covers carrier procurement only. Long-range variant pricing remains unresolved; do not substitute the standard total.'});
 if(kind==='avatar')Object.assign(common,{chassis:'Choose a robotic avatar link or biological interface implant. Biological implants do not include a replacement body.',locomotion:'Robotic avatar bodies use their selected locomotion. Biological implant estimates rely on an external host body.',physical:'Robotic links require communications; biological implants require an existing neural link and any stated external hardware.',brain:'Robotic controller and receiver brains must be Advanced or better. Biological interfaces retain a biological host/controller rather than purchasing a robot brain.',skills:'Remote software fits the receiving robot bandwidth. Biological control interfaces do not grant learned skills.',finalisation:'Robotic links are counted in the body construction total. Biological-interface cost covers the implant only; control and mental-effect checks remain operational requirements.'});
 if(kind==='drone')Object.assign(common,{brain:'The drone may have no onboard brain. Operator interface hardware is external and its price is not added to the robot.',skills:'A brainless drone runs no onboard skill software; its operator and controller are separate requirements.'});
 const notes=Object.fromEntries(Object.entries(common).map(([stage,description])=>[stage,{description,source:source(pages)}]));
 if(kind==='microbot')notes.physical.categorize=false;
 if(kind==='cyborg'){notes.physical.categorize=false;notes.physical.description='Select individual cybernetic parts and their equipment, or reserve capacity for a full-body conversion interface. Costs exclude the separately constructed recipient body.';}
 if(kind==='biological')notes.physical={description:'Choose genome-dependent robot options or separately priced personal cybernetic augmentations.',source:source('88-94'),categories:[['chassis-modifications','Chassis Modifications'],['locomotive-modifications','Locomotive Modifications'],['manipulator-modification','Manipulator Modification'],['default-suites','Default Suites'],['zero-slot-options','Zero-Slot Options'],['slot-cost-options','Slot Cost Options'],['weapons','Weapons'],['cybernetics','Cybernetic augmentations']].map(([id,label])=>({id,label}))};
 return notes;
}


const AVATAR_CONTROLLERS=[['basic',11,2,1,50000],['improved',13,1,2,200000],['enhanced',14,1,4,500000],['advanced',16,1,8,1000000],['superior',18,1,64,5000000]];
const avatarControls=[
 {...select('superiorControllerSlots','Superior controller Slots interpretation',[['unresolved','Not resolved: p104 omits Slots'],['inherited-one','Referee: retain preceding one-Slot controller size']],'unresolved'),stage:'brain',visibleWhen:{field:'controllerTier',equals:'superior'},source:source('95,104')},
 {...select('avatarRole','Avatar link role',[['controller','Controller robot'],['receiver','Receiver / remote body']],'receiver'),stage:'chassis'},
 {...select('controllerTier','Avatar controller tier',AVATAR_CONTROLLERS.map(([id,tl])=>[id,`${id} (TL${tl})`]),'basic'),stage:'brain',visibleWhen:{field:'avatarRole',equals:'controller'}},
 {...number('controlledHosts','Simultaneously controlled hosts',1,64,1),stage:'brain',visibleWhen:{field:'avatarRole',equals:'controller'}},
 {...number('remoteSkillBandwidth','Bandwidth used by remote controller software',0,100,0),stage:'skills',visibleWhen:{field:'avatarRole',equals:'receiver'}}
].map(c=>({...c,source:source('95-96')}));
export function evaluateAvatarLink(design,{brainRank,hasTransceiver,bandwidthCapacity}){
 const s=design.special,diagnostics=[];const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source('95-96')});
 if(brainRank<2)issue('error','AVATAR_BRAIN','brain.model','Avatar controllers and receivers require an Advanced or better brain.');
 if(!hasTransceiver)issue('error','AVATAR_TRANSCEIVER','physical.options','Avatar links require a transceiver.');
 let minTL,cost,slots,maxHosts=null,bufferDays=null;
 if(s.avatarRole==='controller'){
  const row=AVATAR_CONTROLLERS.find(r=>r[0]===s.controllerTier);[,minTL,slots,maxHosts,cost]=row;
  if(s.controllerTier==='superior'&&s.superiorControllerSlots!=='inherited-one')issue('blocker','AVATAR_SUPERIOR_SLOTS','special.superiorControllerSlots','p104 provides TL18, 64 hosts and Cr5M, but no Slot count. Resolve the inherited one-Slot interpretation explicitly.');
  if(s.controlledHosts>maxHosts)issue('error','AVATAR_HOST_LIMIT','special.controlledHosts','Selected controller tier cannot control this many hosts simultaneously.');
 }else{
  minTL=11;cost=10000;slots=1;bufferDays=7;
  if(s.remoteSkillBandwidth>bandwidthCapacity)issue('error','AVATAR_HOST_BANDWIDTH','special.remoteSkillBandwidth','Remote software must fit the receiving host brain bandwidth.');
 }
 if(design.techLevel<minTL)issue('error','AVATAR_LINK_TL','techLevel','Selected avatar hardware exceeds design technology.');
 issue('warning','AVATAR_EXTERNAL_LINK','coverage','Paired avatar hardware, remote software, transceiver range and link conditions require separate validation. Hardware-granted host skills remain independent of remote software.');
 return{diagnostics,cost,slots,traits:['Avatar '+s.avatarRole,'No drone multitasking DM'],avatar:{role:s.avatarRole,maxHosts,bufferDays,remoteSkillBandwidth:s.avatarRole==='receiver'?s.remoteSkillBandwidth:null},source:source('95-96')};
}


function evaluateHighNano(design){
 const s=design.special,rows={'construction-enhanced':[18,100000,'Complex electronics and simple biomechanical structures'],'construction-advanced':[20,200000,'Living beings and any robot brain'],'construction-superior':[23,500000,'Self-replicating nanoswarm initiator'],'distributed-conscious':[22,200000,'Conscious interconnected nanorobot swarm']};
 const [minTL,price,capability]=rows[s.packageType],distributed=s.packageType==='distributed-conscious',diagnostics=[],volumeLitres=s.packages*.1;
 const issue=(severity,code,message)=>diagnostics.push({severity,code,path:'special.packageType',message,source:source('105')});
 if(design.techLevel<minTL)issue('error','NANO_HIGH_TL','Selected high-technology package requires TL'+minTL+'.');
 if(s.environment!=='none'||s.radiationLevels)issue('blocker','NANO_HIGH_PROTECTION','The high-technology table does not establish a price basis for extending ordinary package protection multipliers.');
 if(!distributed&&s.packageType!=='construction-superior'&&s.packages>s.controllerMaxTasks)issue('error','NANO_CONTROLLER_TASKS','Purchased 0.1-litre bags exceed the supplied simultaneous controller task capacity.');
 const cost=price*(distributed?s.packages:volumeLitres),status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';
 issue('warning','NANO_HIGH_SCOPE','This is the printed high-technology acquisition price and capability, not a validated production facility, brain design or operational swarm simulation.');
 return {status,costLabel:'Selected high-tech package cost',diagnostics,ledger:[{id:'nano-high-package',label:capability,cost,slots:0,source:source('105')}],coverage:{complete:false,scope:'High-technology nanorobot acquisition and stated capability',gaps:[{id:'nano-high-production',message:'p105 does not specify working lifetime, production speed or complete distributed-brain bandwidth/INT construction accounting.',source:source('105')}],operationalDependencies:[{id:'nano-high-control',message:'External controller and feedstock remain separate except for the superior self-replicating initiator. Autonomous growth is not simulated.',source:source('105')}]},totals:status==='verified'?{cost,slots:null,bandwidth:null,traits:[capability],skills:[],manipulators:[],nanorobot:{packageType:s.packageType,packages:s.packages,volumeLitres,costBasis:distributed?'per package':'per litre',unitPrice:price,capability,lifeHours:null,productionSlotsPerHour:null}}:null};
}

function evaluateNanoSwarm(design){
 const s=design.special,tl=design.techLevel,diagnostics=[],ledger=[];
 const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source('84-86')});
 const construction=s.packageType.startsWith('construction'),improved=s.packageType==='construction-improved',introTL=improved?15:13;
 if(tl<introTL)issue('error','NANO_SWARM_TL','techLevel','Selected swarm requires TL'+introTL+'.');
 if(s.packages>s.controllerMaxTasks)issue('error','NANO_CONTROLLER_TASKS','special.packages','Simultaneously controlled 0.1-litre bags exceed the supplied controller maximum tasks.');
 if(s.packageType==='cleanup'&&s.cleanupUnitCost>50000&&s.uniqueCleanup!=='yes')issue('error','NANO_CLEANUP_COST','special.cleanupUnitCost','Ordinary cleanup ranges from Cr10000 to Cr50000 per capacity unit; higher costs require a unique formulation.');
 if(s.packageType==='soil'&&s.soilMaterial!=='ordinary')issue('error','NANO_SOIL_MATERIAL','special.soilMaterial','Soil nanorobots cannot create crystaliron, diamond or superdense material.');
 if(s.packageType==='excavation'&&s.regulatedExcavation==='yes'&&(s.shutdownFailsafe!=='yes'||s.commsLossFailsafe!=='yes'))issue('error','NANO_EXCAVATION_FAILSAFE','special','Regulated excavation requires both shutdown-signal and communication-loss failsafes.');
 const unitPrice=construction?(improved?50000:10000):s.packageType==='excavation'?5000:s.packageType==='soil'?10000:s.cleanupUnitCost;
 const protectionMultiplier=(s.environment==='corrosive'?2:s.environment==='insidious'?5:1)*2**s.radiationLevels;
 const packageCost=unitPrice*s.packages*protectionMultiplier;
 const materialCost=construction&&s.materials==='purchased'?s.outputRetailValue*s.materialRoll*.1:0;
 const capacityMultiplier=s.packageType==='excavation'?(s.excavationMaterial==='soft'?2:s.excavationMaterial==='hard'?.5:1):construction&&s.materials==='local'?.5:1;
 const lifetimeHours=(construction?500:168)*2**(tl-introTL);
 ledger.push({id:'nano-swarm',label:'Nanorobot swarm capacity',cost:packageCost,slots:0,source:source('84-86')});
 if(materialCost)ledger.push({id:'nano-feedstock',label:'Planned output feedstock estimate',cost:materialCost,slots:0,source:source('84-85')});
 issue('warning','NANO_CONTROLLER_EXTERNAL','special.controllerMaxTasks','Controller construction is external. Its supplied Max Tasks is not validated here. Two-way communications normally impose a 50-metre operating range.');
 if(construction&&s.materials==='local')issue('warning','NANO_LOCAL_MATERIALS','special.materials','Free local feedstock requires suitable simple materials; production time doubles.');
 const coverage={complete:false,scope:'Nanorobot package cost and operational capacity, with an external controller',gaps:[{id:'nano-controller',message:'Controller design and target-material suitability require separate validation.',source:source('84-86')}]};
 const status=diagnostics.some(d=>d.severity==='error')?'invalid':'verified';
 return{costLabel:'Selected package and planned feedstock cost',status,diagnostics,ledger,coverage,totals:status==='verified'?{cost:packageCost+materialCost,slots:null,bandwidth:null,nanorobot:{packageType:s.packageType,packages:s.packages,unitPrice,packageCost,materialCost,volumeLitres:s.packages*.1,massKg:s.packages*.1,lifetimeHours,capacitySlotsPerHour:s.packages*capacityMultiplier,controllerMaxTasks:s.controllerMaxTasks,twoWayRangeMetres:50,checkinMinutes:s.packageType==='excavation'?s.checkinMinutes:null,medicalPackageLimitApplies:false,protectionMultiplier},traits:['Nanorobot swarm','Vacuum protection','Hostile environment protection'],skills:[],manipulators:[]}:null};
}


const nanoVisibility={
 otherActivePackages:['pharmaceutical','physical','mental','anti-ageing','regenerative'],attributeIncrease:['physical','mental'],
 controllerMaxTasks:['construction-basic','construction-improved','excavation','soil','cleanup'],materials:['construction-basic','construction-improved'],outputRetailValue:['construction-basic','construction-improved'],materialRoll:['construction-basic','construction-improved'],excavationMaterial:['excavation'],cleanupUnitCost:['cleanup'],uniqueCleanup:['cleanup'],soilMaterial:['soil'],regulatedExcavation:['excavation'],shutdownFailsafe:['excavation'],commsLossFailsafe:['excavation'],checkinMinutes:['excavation']
};
for(const c of nanoControls)if(nanoVisibility[c.field])c.visibleWhen={field:'packageType',oneOf:nanoVisibility[c.field]};


const MISSILE_CARRIERS={missile:{label:'Missile',size:4,baseSlots:8,payloadSlots:4,maxWarheadSize:2,maxWarheadSlots:2,burnRounds:10,cost:24000},'long-range':{label:'Long-range missile',size:4,baseSlots:8,payloadSlots:2,maxWarheadSize:1,maxWarheadSlots:1,burnRounds:20,cost:24000},torpedo:{label:'Torpedo',size:6,baseSlots:32,payloadSlots:16,maxWarheadSize:4,maxWarheadSlots:8,burnRounds:20,cost:150000}};
const missileControls=[
 {...select('carrier','Standard carrier',Object.entries(MISSILE_CARRIERS).map(([id,c])=>[id,c.label]),'missile'),stage:'chassis'},
 {...select('procurement','Carrier procurement',[['individual','Individual carrier'],['case12','Case of twelve missiles']],'individual'),stage:'finalisation'},
 {...select('customWarhead','Warhead selection',[['standard','Standard supplied warhead'],['robot','Separate robot warhead']],'standard'),stage:'physical'},
 {...number('warheadSize','External warhead robot Size',1,8,1),stage:'physical',visibleWhen:{field:'customWarhead',equals:'robot'}},
 {...number('warheadSlots','External warhead robot base Slots',1,128,1),stage:'physical',visibleWhen:{field:'customWarhead',equals:'robot'}},
 {...number('payloadSlotsUsed','Payload capacity used',0,16,0),stage:'physical',visibleWhen:{field:'customWarhead',equals:'robot'}},
 {...select('control','Carrier control arrangement',[['single','Single brain with Pilot'],['dedicated','Dedicated homing / locomotion brain']],'dedicated'),stage:'brain'},
 {...select('pilotSkill','Carrier brain has Pilot skill',[['yes','Present'],['no','Absent']],'yes'),stage:'skills',visibleWhen:{field:'control',equals:'single'}},
 {...select('droneControlLink','Drone controller/interface to dedicated brain',[['yes','Present'],['no','Absent']],'yes'),stage:'brain',visibleWhen:{field:'control',equals:'dedicated'}}
].map(c=>({...c,source:source('100-101,249')}));
function evaluateMissileCarrier(design){
 const diagnostics=[],ledger=[];const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source('100-101,249')});
 const coverage={complete:false,scope:'Standard carrier procurement and payload integration bounds only',gaps:[{id:'missile-payload',message:'Custom warhead robot construction, weapons, changes and added hardware must be calculated separately. Removing a supplied warhead gives no cost saving.',source:source('100-101,249')},{id:'missile-control',message:'Entered Pilot and controller availability are integration requirements, not validation of a separate brain design.',source:source('100-101')}]};
 const finish=totals=>{const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';return{status,costLabel:'Carrier procurement cost only',diagnostics,ledger,coverage,totals:status==='verified'?totals:null};};
 try{validateSpecialFields('missile',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return finish(null);}
 const s=design.special,c=MISSILE_CARRIERS[s.carrier];
 if(s.carrier==='long-range')issue('blocker','LONG_RANGE_PRICE','special.carrier','The book supplies long-range capacity and burn, but only standard missile procurement prices. High Guard variant pricing must be resolved before an exact long-range total is claimed.');
 if(design.techLevel<8)issue('error','MISSILE_CARRIER_TL','techLevel','The standard missile and torpedo carriers require TL8.');
 if(s.procurement==='case12'&&s.carrier==='torpedo')issue('error','TORPEDO_CASE_PRICE','special.procurement','The twelve-missile case price does not apply to torpedoes.');
 if(s.customWarhead==='robot'){
  if(s.warheadSize>c.maxWarheadSize||s.warheadSlots>c.maxWarheadSlots)issue('error','MISSILE_WARHEAD_SIZE','special.warheadSize','Warhead robot exceeds the selected carrier maximum chassis size or base Slots.');
  if(s.payloadSlotsUsed>c.payloadSlots)issue('error','MISSILE_PAYLOAD_CAPACITY','special.payloadSlotsUsed','Payload exceeds the selected carrier capacity.');
  if(s.warheadSlots!==2**(s.warheadSize-1))issue('error','MISSILE_WARHEAD_CHASSIS','special.warheadSlots','Declared warhead Size and base Slots must agree with the standard chassis table.');
 }
 if(s.control==='single')issue('warning','MISSILE_BRAIN_ALTERATION','special.control','Replacing the supplied homing brain with a single Pilot-capable brain requires a separately priced and validated alteration.');
 if(s.control==='single'&&s.pilotSkill!=='yes')issue('error','MISSILE_PILOT','special.pilotSkill','A single-brain carrier requires Pilot skill.');
 if(s.control==='dedicated'&&s.droneControlLink!=='yes')issue('error','MISSILE_DRONE_LINK','special.droneControlLink','A dedicated homing/locomotion brain requires a drone controller or interface link.');
 const quantity=s.procurement==='case12'?12:1,cost=quantity===12?250000:c.cost;
 ledger.push({id:'missile-carrier',label:quantity===12?'Case of twelve missile carriers':c.label+' carrier',cost,slots:0,source:source('100-101,249')});
 issue('warning','MISSILE_EXTERNAL_PAYLOAD','coverage','Carrier price excludes custom warhead robot, alterations and additional equipment; removal of the supplied warhead gives no saving. Carrier burn is measured in combat rounds, not ordinary endurance hours.');
 return finish({cost,slots:null,bandwidth:null,carrier:{integrationOnly:true,type:s.carrier,quantity,size:c.size,baseSlots:c.baseSlots,payloadSlots:c.payloadSlots,maxWarheadSize:c.maxWarheadSize,maxWarheadSlots:c.maxWarheadSlots,burnRounds:c.burnRounds,primaryLocomotion:'thruster',secondaryLocomotion:'thruster',vehicleMovement:true,externalWarheadValidated:false,stockBrain:'Primitive (homing)',stockIntelligence:1,stockEquipment:['Drone interface','Thermal sensor','Improved 5km transceiver','Vacuum protection','Visual sensor']},traits:['Thruster primary and secondary','Vehicle movement'],skills:[],manipulators:[]});
}


const CYBORG_TIERS=[['basic',12,3,1000000,14,'monthly',4],['improved',14,2,2000000,12,'annual',5],['advanced',16,2,5000000,10,'annual',3]];
const cyborgControls=[
 {...select('conversionTier','Full-body conversion interface',CYBORG_TIERS.map(([id,tl])=>[id,`${id} (TL${tl})`]),'basic'),stage:'chassis'},
 {...select('bodyType','Replacement body',[['robot','Robot body'],['vehicle','Vehicle body'],['ship','Ship body']],'robot'),stage:'chassis'},
 {...number('bodySize','Robot body Size (minimum Size2)',2,8,5),stage:'chassis',visibleWhen:{field:'bodyType',equals:'robot'}},
 {...number('availableSlots','Available robot-equivalent Slots for interface',0,1000,16),stage:'physical'},
 {...select('limbLayout','Limb configuration relative to original body',[['retained','Original limb layout retained'],['major','Major limb-layout change']],'retained'),stage:'locomotion'},
 {...select('surgeryState','Conversion procedure state',[['planned','Planned / not yet resolved'],['successful','Successful procedure recorded']],'planned'),stage:'finalisation'},
 {...number('surgeryDurationDie','Recorded surgery duration D6',1,6,1),stage:'finalisation'}
].map(c=>({...c,source:source('92-93')}));
function evaluateIndividualAugments(design){
 const result=evaluateAugmentations(design),status=result.diagnostics.some(d=>d.severity==='error')?'invalid':result.diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';
 return {status,costLabel:'Selected augmentations only',diagnostics:result.diagnostics,ledger:result.ledger,coverage:result.coverage,notApplicableMetrics:['slots','bandwidth'],totals:status==='verified'?{cost:result.cost,slots:null,bandwidth:null,augmentations:result.augmentations,sharedInterfaces:result.sharedInterfaces,augmentationEffects:result.effects,traits:[],skills:[],manipulators:[]}:null};
}
function evaluateCyborgConversion(design){
 const diagnostics=[],ledger=[];const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source('92-93')});
 const coverage={complete:false,scope:'Full-body conversion interface and procedure requirements only; replacement body and living character not validated',gaps:[{id:'cyborg-body',message:'Robot, vehicle or ship body, power and fittings need a separate valid construction record.',source:source('92-93')},{id:'cyborg-character',message:'Organic INT, EDU, learned skills, mental state and procedure results are retained from the biological character, not replaced by robot software.',source:source('92-93')}]};
 const finish=totals=>{const status=diagnostics.some(d=>d.severity==='error')?'invalid':'verified';return{status,costLabel:'Conversion interface cost only',diagnostics,ledger,coverage,totals:status==='verified'?totals:null};};
 try{validateSpecialFields('cyborg',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return finish(null);}
 const s=design.special,[,minTL,slots,cost,survivalTarget,frequency,degradationTarget]=CYBORG_TIERS.find(r=>r[0]===s.conversionTier);
 if(design.techLevel<minTL)issue('error','CYBORG_TIER_TL','techLevel','Conversion interface exceeds design technology.');
 if(slots>s.availableSlots)issue('error','CYBORG_INTERFACE_SLOTS','special.availableSlots','Conversion interface exceeds the available body Slots.');
 ledger.push({id:'cyborg-interface',label:'Full-body conversion interface',cost,slots,source:source('92-93')});
 if(s.surgeryState==='planned')issue('warning','CYBORG_SURGERY_PENDING','special.surgeryState','Conversion requires a separately resolved Medic survival procedure; a construction estimate does not certify a successful transplant.');
 issue('warning','CYBORG_BODY_EXTERNAL','coverage','Interface price excludes the replacement body. Entered available capacity and procedure status are not independent validation of body or character legality.');
 return finish({cost,slots:{base:null,capacity:s.availableSlots,used:slots,remaining:s.availableSlots-slots},bandwidth:null,cyborg:{integrationOnly:true,bodyType:s.bodyType,conversionTier:s.conversionTier,interfaceSlots:slots,survival:{skill:'Medic',target:survivalTarget,characteristic:'EDU',hours:s.surgeryDurationDie*4,supportSkill:'Science (robotics)',supportHours:1,supportDifficultyStep:-1,abortedEffect:-1,permanentCharacteristicLossAtEffect:-2,subsequentAttemptDM:-2,brainDeathAtEffect:-6},degradation:{frequency,target:degradationTarget,characteristic:'INT',limbLayoutDM:s.limbLayout==='major'?-2:0,failureLoss:1,lossCharacteristic:'Random INT or EDU'},externalBodyValidated:false},traits:['Organic brain','Retained biological intelligence and learned skills'],skills:[],manipulators:[]});
}



const DRONE_OPERATOR_INTERFACES=[['primitive',5,2,-4,1000],['basic',7,1,-2,2000],['improved',9,0,0,500],['advanced',11,0,1,4000]];
const droneControls=[
 {...select('operatorMode','External controller type',[['biological','Biological operator control unit'],['computer','TL8+ computer as basic control unit'],['robot','Separate robotic drone controller']],'biological'),stage:'brain'},
 {...select('operatorGrade','External operator interface grade',DRONE_OPERATOR_INTERFACES.map(([id,tl])=>[id,`${id} (TL${tl})`]),'improved'),stage:'brain',visibleWhen:{field:'operatorMode',equals:'biological'}},
 {...number('operatorTL','External operator equipment technology',5,23,12),stage:'brain'}
].map(c=>({...c,source:source('34-35,78-79')}));
export function evaluateDroneInterface(design,{hasDroneInterface,hasCommunications}){
 const s=design.special,diagnostics=[];const issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source('34-35,78-79')});
 if(design.techLevel<6)issue('blocker','DRONE_RECEIVER_LOW_TL','techLevel','The verified onboard receiver begins at TL6; a TL5 robot-sized receiver has not been sourced.');
 if(!hasDroneInterface)issue('error','DRONE_RECEIVER','physical.defaultSuite','Remote drone control requires an onboard Drone Interface receiver.');
 if(!hasCommunications)issue('error','DRONE_COMMUNICATIONS','physical.options','Remote drone control requires an onboard transceiver or wireless link.');
 let externalOperatorCost=null,externalOperatorSlots=null,externalControlDM=null;
 if(s.operatorMode==='biological'){
  const [,minTL,slots,dm,cost]=DRONE_OPERATOR_INTERFACES.find(r=>r[0]===s.operatorGrade);
  if(s.operatorTL<minTL)issue('error','DRONE_OPERATOR_TL','special.operatorTL','External operator control-unit grade exceeds its declared technology.');
  externalOperatorCost=cost;externalOperatorSlots=slots;externalControlDM=dm;
 }else if(s.operatorMode==='computer'){
  if(s.operatorTL<8)issue('error','DRONE_COMPUTER_TL','special.operatorTL','Computer substitution for the basic operator interface requires TL8.');
  externalControlDM=-2;
 }
 issue('warning','DRONE_EXTERNAL_CONTROLLER','coverage','Operator interface or robotic controller is external and not added to robot construction cost. Its communications, operator skills and control software need separate validation.');
 return{diagnostics,cost:0,slots:0,traits:['Remote-control drone'],drone:{externalOperatorCost,externalOperatorSlots,externalControlDM,operatorCostIncluded:false},source:source('34-35,78-79')};
}
export function evaluateSpecialDesign(design){
 const result=evaluateSpecialDesignRaw(design),t=result.totals;
 result.notApplicableMetrics=(['clone','nanorobot','vehicle-brain','ship-brain','missile'].includes(design.kind)||usesStandaloneSpecialPath(design))?['slots','bandwidth']:design.kind==='cyborg'?(design.special?.cyborgMode==='augments'?['slots','bandwidth']:['bandwidth']):[];
 result.summaryMetrics=[];
 if(!t)return result;
 const metric=(label,value,unit)=>{if(value!==null&&value!==undefined)result.summaryMetrics.push({label,value,...(unit?{unit}: {})});};
 if(t.clone){for(const [stat,value]of Object.entries(t.clone.characteristics))metric(stat,value);metric('EDU',t.clone.education);metric('Unspent training points',t.clone.unspentTrainingPoints);metric('Time to maturity',t.clone.maturityYears,'years');}
 if(t.nanorobot){const n=t.nanorobot;metric('Packages',n.packages);metric('Package lifetime',n.lifeYears,'years');metric('Working lifetime',n.lifetimeHours,'hours');metric('Production capacity',n.capacitySlotsPerHour,'Slots/hour');metric('Permanent END loss',n.permanentEnduranceLoss);metric('Ageing reduction',n.ageingReduction===undefined?undefined:n.ageingReduction*100,'%');}
 if(t.integration){const h=t.integration;metric('Occupied host capacity',h.occupiedHostCapacity,h.hostUnit);metric('Retrofit work',h.retrofitHours,'hours');metric('Retrofit work',h.retrofitPersonDays,'person-days');metric('Haptic DEX',h.effectiveDexterity);metric('Astrogation DM',h.astrogationDM);metric('Misjump DM',h.misjumpDM);}
 if(t.carrier){metric('Carriers',t.carrier.quantity);metric('Payload capacity',t.carrier.payloadSlots,'Slots');metric('Maximum warhead Size',t.carrier.maxWarheadSize);metric('Flight burn',t.carrier.burnRounds,'rounds');}
 if(t.biologicalAvatar){metric('Simultaneous hosts',t.biologicalAvatar.maxHosts);metric('Control reclamation target',t.biologicalAvatar.reclaimTarget,'+');metric('Degradation checks due',t.biologicalAvatar.degradationChecksDue);}
 if(t.cyborg){metric('Conversion Medic target',t.cyborg.survival.target,'+');metric('Surgery duration',t.cyborg.survival.hours,'hours');metric('Degradation INT target',t.cyborg.degradation.target,'+');metric('Degradation interval',t.cyborg.degradation.frequency);}
 return result;
}


function validateCloneCustomSkills(records){
 if(!Array.isArray(records)||records.length>200)throw new TypeError('special.trainingCustomSkills must contain at most 200 records.');
 const ids=new Set();
 for(const record of records){
  if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).some(k=>!['id','skill','speciality','level'].includes(k)))throw new TypeError('Invalid custom learned skill record.');
  if(typeof record.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(record.id)||ids.has(record.id))throw new TypeError('Invalid or duplicate custom learned skill ID.');ids.add(record.id);
  if(!['language','profession','science','art-instrument'].includes(record.skill))throw new TypeError('This skill does not permit an open custom speciality.');
  if(typeof record.speciality!=='string'||!record.speciality.trim()||record.speciality.length>120)throw new TypeError('Name the learned speciality using 1-120 characters.');
  if(!Number.isInteger(record.level)||record.level<0||record.level>4)throw new TypeError('Supported clone learned skill levels are 0-4.');
 }
}



avatarControls.find(c=>c.field==='avatarRole').choices.push({id:'biacs',label:'BIACS biological controller implant'},{id:'ribaci',label:'RIBACI biological receiver implant'});
avatarControls.push(
 {...select('biologicalNeuralLink','Existing biological neural link',[['unconfirmed','Not confirmed'],['present','Present in separate character record']],'unconfirmed'),stage:'physical',visibleWhen:{field:'avatarRole',oneOf:['biacs','ribaci']},source:source('95-96')},
 {...select('remoteAvatarController','Remote controller has Avatar Controller hardware',[['unconfirmed','Not confirmed'],['present','Present in separate controller design']],'unconfirmed'),stage:'brain',visibleWhen:{field:'avatarRole',equals:'ribaci'},source:source('96')},
 {...select('biologicalConnection','Connection to remote controller',[['unconfirmed','Not confirmed'],['implant','Compatible implant link'],['wireless','Wireless link'],['transceiver','Transceiver link']],'unconfirmed'),stage:'physical',visibleWhen:{field:'avatarRole',equals:'ribaci'},source:source('96')},
 {...select('recipientBrain','Recipient biological brain state',[['developed','Developed'],['undeveloped','Undeveloped'],['wiped','Wiped']],'developed'),stage:'brain',visibleWhen:{field:'avatarRole',equals:'ribaci'},source:source('96')},
 {...select('remoteConnectionState','Remote link state',[['connected','Connected'],['disconnected','Disconnected']],'connected'),stage:'finalisation',visibleWhen:{field:'avatarRole',equals:'ribaci'},source:source('96')},
 {...number('cumulativeControlDays','Cumulative days under remote control',0,36500,0),stage:'finalisation',visibleWhen:{field:'avatarRole',equals:'ribaci'},source:source('96')}
);
export function usesStandaloneSpecialPath(design){return design.kind==='avatar'&&['biacs','ribaci'].includes(design.special?.avatarRole);}
function evaluateBiologicalAvatar(design){
 const diagnostics=[],ledger=[],issue=(severity,code,path,message)=>diagnostics.push({severity,code,path,message,source:source('95-96')});
 const coverage={complete:false,scope:'Biological avatar implant cost and operational requirements only; biological character and remote host are not construction-validated',gaps:[{id:'biological-avatar-host',message:'Neural links, remote controller/receiver, recipient character and applicable procedure rules require separate records. Entered confirmations do not certify those records.',source:source('95-96')}]};
 const finish=totals=>{const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';return{status,costLabel:'Biological interface implant cost only',diagnostics,ledger,coverage,totals:status==='verified'?totals:null};};
 try{validateSpecialFields('avatar',design.special);}catch(e){issue('error','SCHEMA','special',e.message);return finish(null);}
 const s=design.special,receiver=s.avatarRole==='ribaci';
 if(design.techLevel<13)issue('error','BIO_AVATAR_TL','techLevel','BIACS and RIBACI require TL13.');
 if(s.biologicalNeuralLink!=='present')issue('blocker','BIO_AVATAR_NEURAL_LINK','special.biologicalNeuralLink','This implant requires an existing biological neural link in a separately validated character record.');
 if(receiver&&s.remoteAvatarController!=='present')issue('blocker','RIBACI_REMOTE_CONTROLLER','special.remoteAvatarController','The remote controller requires Avatar Controller hardware.');
 if(receiver&&s.biologicalConnection==='unconfirmed')issue('blocker','RIBACI_CONNECTION','special.biologicalConnection','A compatible implant, wireless or transceiver connection is required.');
 const developed=receiver&&s.recipientBrain==='developed',degradationChecksDue=developed?Math.floor(s.cumulativeControlDays/30):0;
 const cost=100000;ledger.push({id:s.avatarRole,label:receiver?'RIBACI implant':'BIACS implant',cost,slots:0,source:source('95-96')});
 issue('warning','BIO_AVATAR_EXTERNAL_RECORDS','coverage','Implant price excludes neural link, remote hardware, body and procedure costs. Biological character and connected host legality must be checked separately.');
 if(developed)issue('warning','RIBACI_RECIPIENT_AGENCY','special.recipientBrain','Developed recipients can regain control through daily checks; each thirty cumulative control days also requires the stated degradation checks. These outcomes are not automatically resolved.');
 return finish({cost,slots:null,bandwidth:null,biologicalAvatar:{integrationOnly:true,role:s.avatarRole,maxHosts:receiver?null:1,neuralLinkRequired:true,disconnectEffect:receiver?'Recipient retains the opportunity to regain control':'Biological controller consciousness returns; host resumes local control',reclaimTarget:developed?(s.remoteConnectionState==='connected'?12:9):null,reclaimCheckFrequency:developed?'daily':null,degradationChecksDue,intCheckTarget:developed?3:null,intLossOnFailure:developed?1:0,optionalStyCheckTarget:developed?4:null,optionalStyLossOnFailure:developed?1:0,externalCharacterValidated:false},traits:[receiver?'Biological avatar receiver':'Biological avatar controller'],skills:[],manipulators:[]});
}
