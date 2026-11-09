// Typed ordinary medical nanorobot inventory. Source facts only; no treatment simulation.
const copy=value=>JSON.parse(JSON.stringify(value));
const source=pages=>({book:'Robot Handbook',edition:'Mongoose 2022',pages});
const characteristicDefinitions=()=>({book:'Traveller Core Rulebook Update 2022',edition:'Mongoose 2022',pages:'9'});
const TYPES=[['pharmaceutical','Pharmaceutical',20000],['physical','Physical enhancement',20000],['mental','Mental enhancement',40000],['anti-ageing','Anti-ageing',80000],['regenerative','Regenerative',20000],['nanotech-defence','Prophylactic nanotech defence',20000]];
const ROLES=[['purchased-active','Purchased, active'],['purchased-reserve','Purchased, reserve'],['existing-active','Existing, active (declared effective)']];
const number=(field,label,min,max,value)=>({field,label,type:'number',min,max,default:value});
const select=(field,label,choices,value)=>({field,label,type:'select',choices:choices.map(([id,label])=>({id,label})),default:value});
const enhancement={field:'packageType',oneOf:['physical','mental']};
export function medicalInventoryControls(techLevel=13){
 const itemFields=[
  select('packageType','Medical package',TYPES,'pharmaceutical'),
  number('count','Package count (app limit 10,000 per record)',1,10000,1),
  number('hardwareTL','Package hardware TL',13,23,Math.max(13,Math.min(23,techLevel))),
  select('role','Purchase / active role',ROLES,'purchased-active'),
  {...select('target','Characteristic', [['unresolved','Select characteristic'],['STR','STR'],['DEX','DEX'],['END','END'],['INT','INT']],'unresolved'),visibleWhen:enhancement,choicesBy:{field:'packageType',values:{physical:[{id:'unresolved',label:'Select characteristic'},...['STR','DEX','END'].map(id=>({id,label:id}))],mental:[{id:'INT',label:'INT'}]}},resetWhenUnavailable:true},
  {...number('attributeIncrease','Requested increase contributed by record',1,3,1),visibleWhen:enhancement},
  {...number('continuousTreatmentYears','Cumulative anti-ageing treatment (years)',0,1000,0),visibleWhen:{field:'packageType',equals:'anti-ageing'}},
  {field:'pharmaceuticalPurpose',label:'Pharmaceutical purpose label',type:'text',default:'',maxLength:120,required:false,visibleWhen:{field:'packageType',equals:'pharmaceutical'}},
  select('environment','Additional protection',[['none','Baseline vacuum and hostile'],['corrosive','Corrosive'],['insidious','Insidious']],'none'),
  number('radiationLevels','Radiation protection levels',0,10,0)
 ].map(c=>({...c,source:source(c.field==='environment'||c.field==='radiationLevels'?'81,83':'83-84,86'),...(c.field==='target'?{definitionSource:characteristicDefinitions()}: {})}));
 return [
  {...select('medicalMode','Nanorobot record mode',[['legacy-single','Single package / industrial swarm'],['itemised','Itemised medical inventory']],'legacy-single'),stage:'chassis',source:source('83-86')},
  {field:'medicalPackages',label:'Medical package records',type:'custom-packages',default:null,maxItems:200,applicationLimit:true,stage:'chassis',recordNameField:'packageType',recordDetailField:'role',recordIdPrefix:'med-',summaryFields:['count','hardwareTL','role','target'],composerLabel:'New medical package record',addLabel:'Add medical package record',itemFields,visibleWhen:{field:'medicalMode',equals:'itemised'},source:source('81,83-84,86')}
 ];
}
export function validateMedicalInventory(s){
 if(s.medicalMode===undefined&&s.medicalPackages===undefined)return; // Pre-extension records remain readable.
 if(!['legacy-single','itemised'].includes(s.medicalMode))throw new TypeError('Invalid medical inventory mode.');
 if(s.medicalPackages===null){if(s.medicalMode!=='legacy-single')throw new TypeError('Initialise the itemised medical inventory.');return;}
 if(!Array.isArray(s.medicalPackages)||s.medicalPackages.length>200)throw new TypeError('Medical inventory supports at most 200 records (application limit).');
 const ids=new Set(),fields=medicalInventoryControls()[1].itemFields,allowed=['id',...fields.map(f=>f.field)];
 for(const r of s.medicalPackages){
  if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!allowed.includes(k)))throw new TypeError('Invalid medical package record.');
  if(typeof r.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(r.id)||ids.has(r.id))throw new TypeError('Medical records require unique stable IDs.');ids.add(r.id);
  for(const f of fields){
   const v=r[f.field];
   if(f.type==='number'&&(!Number.isInteger(v)||v<f.min||v>f.max))throw new TypeError('Invalid medical record '+f.field+'.');
   if(f.type==='select'&&!f.choices.some(c=>c.id===v))throw new TypeError('Invalid medical record '+f.field+'.');
   if(f.type==='text'&&(typeof v!=='string'||v.length>f.maxLength))throw new TypeError('Invalid pharmaceutical purpose label.');
  }
  if(r.packageType==='physical'&&!['unresolved','STR','DEX','END'].includes(r.target))throw new TypeError('Physical medical enhancement targets STR, DEX or END.');
  if(r.packageType==='mental'&&!['unresolved','INT'].includes(r.target))throw new TypeError('Mental medical enhancement targets INT.');
 }
}
export function initialiseMedicalInventory(design,patch){
 // Conversion is an explicit editing transition, never an import/evaluation side effect.
 if(design.kind!=='nanorobot'||patch.kind&&patch.kind!=='nanorobot'||patch.special?.medicalMode!=='itemised'||design.special.medicalMode==='itemised'||patch.special.medicalPackages!==undefined||design.special.medicalPackages!==null)return patch;
 const s={...design.special,...patch.special},type=TYPES.find(t=>t[0]===s.packageType);
 const record=type?{id:'nano-legacy',...Object.fromEntries(medicalInventoryControls(design.techLevel)[1].itemFields.map(f=>[f.field,copy(f.default)])),packageType:s.packageType,count:s.packages,hardwareTL:patch.techLevel??design.techLevel,target:s.packageType==='mental'?'INT':'unresolved',attributeIncrease:s.attributeIncrease,continuousTreatmentYears:s.continuousTreatmentYears,environment:s.environment,radiationLevels:s.radiationLevels}:null;
 return {...patch,special:{...patch.special,medicalPackages:record?[record]:[]}};
}
export function evaluateMedicalInventory(design){
 const s=design.special,diagnostics=[],ledger=[],records=copy(s.medicalPackages),issue=(severity,code,path,message,pages='83-84')=>diagnostics.push({severity,code,path,message,source:source(pages)});
 const untyped=s.otherActivePackages;
 const coverage={complete:false,scope:'Itemised ordinary medical package acquisition and declared active effects; recipient and application outcomes are external',implemented:['Typed purchased-active, purchased-reserve and existing-active medical records','Per-record hardware lifetime and protection pricing','Combined target enhancement budgets and active medical limits'],gaps:[],operationalDependencies:[{id:'nano-medical-application',message:'Initial programming requires a swarm controller. Application, target anatomy, drug outcomes and interactions remain external; existing-active records declare current effectiveness without proving it.',source:source('83-84')},{id:'nano-medical-expiry',message:'Lifetimes are rated hardware durations. Elapsed use, expiry and remaining treatment time are not simulated.',source:source('83-84')}],constraints:[{id:'nano-neurology',message:'Regenerative nanorobots cannot repair brain damage and require normal nutrition.',source:source('83')}]};
 if(!records.length)issue('blocker','NANO_MEDICAL_EMPTY','special.medicalPackages','Add a typed medical record. The retained single-package selection is not included in itemised totals.');
 const active=records.filter(r=>r.role!=='purchased-reserve'),purchased=records.filter(r=>r.role!=='existing-active');
 const activeCount=active.reduce((n,r)=>n+r.count,0),purchasedCount=purchased.reduce((n,r)=>n+r.count,0),totalActive=activeCount+untyped;
 if(untyped){
  issue('warning','NANO_UNTYPED_ACTIVE','special.otherActivePackages','Untyped active packages count toward END loss only. Their overlapping characteristic effects, regeneration and ageing caps, and additional defence are not certified.');
  coverage.gaps.push({id:'nano-untyped-medical-inventory',category:'external-dependency',message:'Untyped active packages cannot certify overlapping characteristic enhancements or regeneration/ageing limits. Typed effects exclude these unknown packages.',source:source('83-84,86')});
 }
 const legacyAgeingUnresolved=s.existingAgeingPackage==='yes';
 if(legacyAgeingUnresolved){
  issue('warning','NANO_LEGACY_AGEING_UNRESOLVED','special.existingAgeingPackage','The retained legacy declaration of another active anti-ageing package needs reconciliation. It is not added to itemised counts or costs; clear it after recording the existing package and reconciling the untyped count.');
  coverage.gaps.push({id:'nano-legacy-ageing-declaration',category:'external-dependency',message:'A legacy active-ageing declaration has no typed hardware record and may overlap the untyped active count.',source:source('83-84')});
 }
 let cost=0;
 for(const r of records){
  const path='special.medicalPackages.'+r.id,price=TYPES.find(t=>t[0]===r.packageType)[2],protectionMultiplier=(r.environment==='corrosive'?2:r.environment==='insidious'?5:1)*2**r.radiationLevels;
  const isPurchased=r.role!=='existing-active',isActive=r.role!=='purchased-reserve';
  if(isPurchased&&r.hardwareTL>design.techLevel)issue('error','NANO_MEDICAL_PURCHASE_TL',path+'.hardwareTL','Purchased package technology exceeds the design technology.');
  if(['physical','mental'].includes(r.packageType)&&r.target==='unresolved')issue('blocker','NANO_ATTRIBUTE_TARGET',path+'.target','Select the enhancement characteristic; no target is inferred from the legacy physical category.');
  Object.assign(r,{purchased:isPurchased,active:isActive,pricePerPackage:price,protectionMultiplier,cost:isPurchased?price*r.count*protectionMultiplier:0,lifeYears:2**(r.hardwareTL-13),volumeLitres:r.count*.1,massKg:r.count*.1,remainingLifeYears:null,currentEffectivenessDeclared:r.role==='existing-active',acquisitionTechnologyChecked:isPurchased,acquisitionTechnologyValid:isPurchased?r.hardwareTL<=design.techLevel:null,applicationVerified:false,source:source(r.packageType==='nanotech-defence'?'81,83,86':'81,83-84')});
  if(isPurchased){cost+=r.cost;ledger.push({id:'nano-'+r.id,label:TYPES.find(t=>t[0]===r.packageType)[1]+' ('+r.role+')',cost:r.cost,slots:0,source:copy(r.source)});}
 }
 const targets=[];
 for(const target of ['STR','DEX','END','INT']){
  const same=active.filter(r=>['physical','mental'].includes(r.packageType)&&r.target===target);if(!same.length)continue;
  const increase=same.reduce((n,r)=>n+r.attributeIncrease,0),count=same.reduce((n,r)=>n+r.count,0),required=[0,1,3,6][increase]??null;
  if(increase>3)issue('error','NANO_ATTRIBUTE_MAX','special.medicalPackages','Combined '+target+' increase exceeds +3.');
  else if(count<required)issue('error','NANO_ATTRIBUTE_PACKAGES','special.medicalPackages','Combined '+target+' increase requires '+required+' active packages.');
  else if(count>required)issue('warning','NANO_EXTRA_PACKAGES','special.medicalPackages','Extra '+target+' packages count toward END but do not raise the selected increase.');
  targets.push({target,attributeIncrease:increase,activePackages:count,packagesRequired:required,recordIds:same.map(r=>r.id),includesOnlyTypedPackages:true,combinedWithUntypedPackagesVerified:untyped===0,source:source('83-84'),definitionSource:characteristicDefinitions()});
 }
 const countType=type=>active.filter(r=>r.packageType===type).reduce((n,r)=>n+r.count,0);
 const regenerationCount=countType('regenerative'),ageingCount=countType('anti-ageing'),defenceCount=countType('nanotech-defence');
 if(regenerationCount>4)issue('error','NANO_REGEN_LIMIT','special.medicalPackages','At most four regenerative packages may be active across all records.');
 if(ageingCount>1)issue('error','NANO_AGEING_SINGLE','special.medicalPackages','Only one anti-ageing package may be active across all records.');
 if(ageingCount&&legacyAgeingUnresolved)issue('blocker','NANO_AGEING_RECONCILIATION','special.existingAgeingPackage','Reconcile the legacy active-ageing declaration before certifying the typed active ageing package.');
 const ageing=records.filter(r=>r.packageType==='anti-ageing').map(r=>{
  const effectiveTL=r.hardwareTL-Math.floor(r.continuousTreatmentYears/20),ageingReduction=effectiveTL<13?0:effectiveTL===13?.5:effectiveTL===14?.75:effectiveTL===15?.9:null;
  if(r.active&&effectiveTL>15)issue('blocker','NANO_AGEING_HIGH_TL_UNRESOLVED','special.medicalPackages.'+r.id+'.hardwareTL','The printed ageing reduction table ends at effective TL15; no higher-TL percentage is inferred.');
  if(r.active&&effectiveTL<13)issue('warning','NANO_AGEING_EFFECTIVE_TL','special.medicalPackages.'+r.id+'.continuousTreatmentYears','Treatment history places effective technology below the printed ageing-effect table.');
  return {id:r.id,active:r.active,hardwareTL:r.hardwareTL,effectiveTL,lifeYears:r.lifeYears,ageingReduction:r.active?ageingReduction:null,continuousTreatmentYears:r.continuousTreatmentYears};
 });
 const loss=Math.max(0,totalActive-15);
 if(loss)issue('warning','NANO_PERMANENT_END','special.medicalPackages','Declared active medical package total permanently reduces END by '+loss+'.');
 const status=diagnostics.some(d=>d.severity==='error')?'invalid':diagnostics.some(d=>d.severity==='blocker')?'blocked':'verified';
 const nanorobot={medicalMode:'itemised',packageType:'mixed-medical',packages:purchasedCount,purchasedPackages:purchasedCount,purchasedActivePackages:active.filter(r=>r.role==='purchased-active').reduce((n,r)=>n+r.count,0),reservePackages:purchased.filter(r=>r.role==='purchased-reserve').reduce((n,r)=>n+r.count,0),existingActivePackages:active.filter(r=>r.role==='existing-active').reduce((n,r)=>n+r.count,0),untypedActivePackages:untyped,totalActiveMedicalPackages:totalActive,activeCountComplete:!legacyAgeingUnresolved,permanentEnduranceLoss:loss,enduranceLossIsMinimum:legacyAgeingUnresolved,volumeLitres:purchasedCount*.1,massKg:purchasedCount*.1,activeVolumeLitres:totalActive*.1,medicalPackages:records,characteristicEnhancements:targets,regeneration:{activePackages:regenerationCount,permanentCharacteristicPointsPerWeek:regenerationCount,repairsBrain:false,requiresNutrition:true,includesOnlyTypedPackages:true},ageingTreatments:ageing,nanotechDefence:{resistanceDM:defenceCount,dmPerActivePackage:1,linearStacking:true,includesOnlyTypedPackages:true,scope:'Resistance to nanotech infections while the typed active packages remain effective',automaticImmunity:false,applicationVerified:false,infectionResolutionPerformed:false,initialProgrammingRequiresSwarmController:true,autonomousAfterApplication:true,source:source('83,86')},activeLimits:{regeneration:{knownActivePackages:regenerationCount,maximum:4,allActiveTypesKnown:untyped===0},antiAgeing:{knownActivePackages:ageingCount,maximum:1,allActiveTypesKnown:untyped===0&&!legacyAgeingUnresolved}},legacySelectionIncluded:false,initialProgrammingRequiresSwarmController:true,autonomousAfterApplication:true,applicationVerified:false,expirySimulated:false};
 return {costLabel:'Purchased medical packages only',status,diagnostics,ledger,coverage,medicalInventory:{purchaseCost:cost,records:copy(records),effectCertification:status==='verified'?(untyped||legacyAgeingUnresolved?'partial':'typed-parameters-only'):status,existingTreatmentsDeclared:true,legacySelectionIncluded:false},totals:status==='verified'?{cost,slots:null,bandwidth:null,nanorobot,traits:['Medical nanorobot inventory','Vacuum protection','Hostile environment protection'],skills:[],manipulators:[]}:null};
}
