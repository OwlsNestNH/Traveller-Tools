import {assertKeys,integer,clone} from './schema.mjs';
// Audited numerical facts only. Private source pages are not distributed.
const conversionSource={book:'Robot Handbook',edition:'Mongoose 2022',pages:'62'};
const source=pages=>({book:'Vehicle Handbook Update 2026',edition:'Mongoose 2026',pages});
const equivalenceAudit=pages=>({status:'No matching construction equivalent identified; related RH paths reviewed.',relatedHandbookSource:{book:'Robot Handbook',edition:'Mongoose 2022',pages}});
const rows=[
 {id:'vh2026-decoy-dispenser',family:'discharger',label:'Decoy Dispenser',tl:5,spaces:1,cost:2500,capacity:60,source:source('74-75'),conditionLabels:['Smart attack DM -2 (conditional)','Smart weapon TL <= robot TL','Deployment each round','TL7 or less: aware crew + Minor Action'],effects:{smartAttackDM:-2,maximumAttackerTLRelativeToRobot:0,deploymentEachAttackedRound:true,manualTriggerThroughTL:7,sensorDetectionBonus:0}},
 {id:'vh2026-prismatic-aerosol-discharger',family:'discharger',label:'Prismatic Aerosol Discharger',tl:9,spaces:1,cost:4000,capacity:30,source:source('77'),conditionLabels:['Laser damage -2D (conditional)','Stationary','Moderate breeze or less','Non-Destructive lasers only'],effects:{laserDamageReductionDice:2,stationaryOnly:true,windAtMostModerateBreeze:true,destructiveWeaponsAffected:false,nonLaserWeaponsAffected:false}},
 {id:'vh2026-smoke-discharger',family:'discharger',label:'Smoke Discharger',tl:3,spaces:1,cost:1000,capacity:30,source:source('77'),conditionLabels:['Incoming attack DM -2 (conditional)','Stationary','Moderate breeze or less','No effect against TL9+ fire control'],effects:{incomingAttackDM:-2,stationaryOnly:true,windAtMostModerateBreeze:true,maximumAffectedFireControlTL:8}},
 {id:'vh2026-light-crane',family:'utility',utilityType:'crane',label:'Light Crane',tl:1,spaces:1,cost:1000,maximumLoadKg:500,source:source('68'),equivalenceAudit:equivalenceAudit('25-28,52'),conditionLabels:['Individual load: 500 kg','Physical reach; clearance conditional','Hardware TL 1; fixed introduction configuration','No arm, STR or extra attack grant'],operation:{requiresPower:false,powerRequiredFromHardwareTL:5,physicalReachRequired:true,reachMetres:null,clearanceVerified:false,operatorSkill:null,autonomousOperationVerified:false,cooperativeLiftingVerified:false,higherHardwareTLScalingImplemented:false},effects:{maximumLoadKgPerInstallation:500,pooledLiftingGranted:false,robotManipulatorGranted:false,extraAttackGranted:false}},
 ...[{grade:'basic',tl:8,spaces:3,cost:10000},{grade:'improved',tl:10,spaces:1,cost:15000}].map(row=>({...row,id:'vh2026-external-sampler-'+row.grade,family:'utility',utilityType:'sampler',label:'External Sampler ('+row.grade[0].toUpperCase()+row.grade.slice(1)+')',source:source('69'),equivalenceAudit:equivalenceAudit('34-35,57-59'),conditionLabels:['Power required','One medium per installation','Electronics (sensors) or appropriate Science check','Isolated delivery: adjacent laboratory','Laboratory not included; analysis conditional'],operation:{requiresPower:true,allowedPowerSources:['onboard','grid','beamed'],insufficientPowerSources:['muscle','wind'],mediumPerInstallation:1,usefulInformationCheck:{alternatives:[{skill:'Electronics',specialty:'sensors'},{skill:'Science',specialty:'appropriate'}],difficulty:null,characteristics:null,duration:null},specimenDelivery:{isolated:true,requiresAdjacentLaboratory:true,laboratoryIncluded:false},specimenStorageCapacity:null,autonomousOperationVerified:false},effects:{skillGranted:false,guaranteedAnalysis:false}})),
 ...[{grade:'basic',tl:7,spaces:2,cost:20000,nominalDepthMetres:100},{grade:'improved',tl:9,spaces:1,cost:50000,nominalDepthMetres:200},{grade:'advanced',tl:11,spaces:1,cost:100000,nominalDepthMetres:500}].map(row=>({...row,id:'vh2026-ground-penetrating-radar-'+row.grade,family:'utility',utilityType:'radar',label:'Ground Penetrating Radar ('+row.grade[0].toUpperCase()+row.grade.slice(1)+')',source:source('69'),equivalenceAudit:equivalenceAudit('57'),conditionLabels:['Power required','Average (8+) Electronics (sensors)','INT or EDU; 1D rounds','Solid rock/metal: up to 75% reduced effectiveness','Crystaliron/superdense or better armour: blocked','Deployment/clearance conditional',...(row.grade==='advanced'?['3 dedicated grav drones','Detection DM +2 (conditional; not general/stacking)']:[])],operation:{requiresPower:true,allowedPowerSources:['onboard','grid','beamed'],insufficientPowerSources:['muscle','wind'],detectionCheck:{skill:'Electronics',specialty:'sensors',difficulty:8,characteristics:['INT','EDU'],durationDice:'1D',durationUnit:'rounds',purpose:['detect','identify']},environment:{nominalMedium:['soil','loose-rock'],solidRockOrMetal:{maximumEffectivenessReductionPercent:75,fixedDepthMultiplier:null},blockingArmour:['crystaliron','superdense','more-advanced']},deployment:{clearanceVerified:false,dedicatedGravDrones:row.grade==='advanced'?3:0,independentRobotGrant:false,separateDroneControllerRequired:false},autonomousOperationVerified:false},effects:{nominalDepthMetres:row.nominalDepthMetres,detectionDM:row.grade==='advanced'?2:0,detectionOnly:true,stackingGranted:false,skillGranted:false,extraAttackGranted:false}}))
];
const media=['gas','liquid','solid'];
const mediumLabel=value=>({gas:'Gas',liquid:'Liquid',solid:'Solid'}[value]||'Not selected');
const isDischarger=row=>row.family==='discharger';
const isSampler=row=>row.utilityType==='sampler';
export function verifiedVehicleOptionCatalogue(){return clone(rows.map(row=>({...row,hardwareTL:row.tl,implemented:true,sourceVerified:true,handbookEquivalent:null,slots:row.spaces*64,conversionSource,...(row.family==='utility'?{powerSource:source('57'),technologySource:source('57')}:{}),scope:'Source hardware and fixed-Space accounting; operation remains contextual.'})));}
export function verifiedVehicleControl(){return{field:'verifiedVehicleOptions',label:'Vehicle options (2026 source)',category:'Slot Cost Options',type:'verified-vehicle-options',recordNameField:'optionId',recordIdPrefix:'v26-',composerLabel:'Vehicle Handbook Update 2026',maxItems:50,addLabel:'Add source vehicle option',collapsedByDefault:true,source:source('57,68-69,74-75,77'),itemFields:[
 {field:'optionId',label:'Vehicle option',type:'select',default:rows[0].id,choices:verifiedVehicleOptionCatalogue()},
 {field:'quantity',label:'Installations',type:'number',min:1,max:1000,default:1},
 {field:'extraCharges',label:'Additional charges per installation (unpriced)',type:'number',min:0,max:1000,default:0,optional:true},
 {field:'samplerMedium',label:'Sampler medium',type:'select',default:'',omitByDefault:true,optional:true,choices:[{id:'',label:'None selected'},...media.map(id=>({id,label:mediumLabel(id)}))]}
]};}
export function validateVerifiedVehicleOptions(records){
 if(!Array.isArray(records)||records.length>50)throw new TypeError('Expected up to 50 source vehicle option records.');
 const ids=new Set();
 for(const record of records){
  assertKeys(record,['id','optionId','quantity','extraCharges','samplerMedium'],'physical.verifiedVehicleOptions');
  if(typeof record.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(record.id)||ids.has(record.id))throw new TypeError('Invalid or duplicate source vehicle option ID.');ids.add(record.id);
  if(!rows.some(row=>row.id===record.optionId))throw new TypeError('Unknown verified vehicle option. Use a source catalogue ID.');
  integer(record.quantity,1,1000,'quantity');if(record.extraCharges!==undefined)integer(record.extraCharges,0,1000,'extraCharges');
  if(record.samplerMedium!==undefined&&!['',...media].includes(record.samplerMedium))throw new TypeError('Sampler medium must be gas, liquid, solid or unselected.');
 }
}
function utilityFacts(row,record){
 return [{label:'Hardware TL',value:row.tl},...(row.utilityType==='crane'?[{label:'Maximum load per installation',value:row.maximumLoadKg+' kg'},{label:'Power requirement',value:'Not required at hardware TL 1'}]:[]),...(isSampler(row)?[{label:'Medium per installation',value:mediumLabel(record.samplerMedium)}]:[]),...(row.utilityType==='radar'?[{label:'Nominal depth per installation',value:row.nominalDepthMetres+' m'},{label:'Detection DM',value:row.effects.detectionDM?'+'+row.effects.detectionDM+' (conditional; not general/stacking)':'None'},...(row.operation.deployment.dedicatedGravDrones?[{label:'Dedicated grav drones per installation',value:3}]:[])]:[])];
}
export function vehicleOptionRecordPresentation(record){
 const row=rows.find(row=>row.id===record?.optionId);if(!row)return {fields:{}};
 return clone({fields:{extraCharges:{visible:isDischarger(row)||Boolean(record.extraCharges),...(!isDischarger(row)?{label:'Retained additional charges (not applicable)'}:{})},samplerMedium:{visible:isSampler(row)||Boolean(record.samplerMedium),...(!isSampler(row)?{label:'Retained sampler medium (not applicable)'}:{})}},vehicleOption:{label:row.label,family:row.family,source:row.source,conversionSource,unitCost:row.cost,slotsPerInstallation:row.spaces*64,conditionLabels:row.conditionLabels,...(isDischarger(row)?{capacityPerInstallation:row.capacity,loadLabel:'Initial contents unverified',replacementPriceLabel:'Replacement charge price unknown',selectedFacts:[]}:{selectedFacts:utilityFacts(row,record)})}});
}
function powerContext(design,equipment){
 const p=design.selections.physical,state=equipment?.powerState;
 const unavailable=Boolean(state?.shutdown)||(p.powerMode==='conventional'&&equipment?.noInternalPower&&!p.powerPacks);
 const unresolved=!state||(equipment.diagnostics??[]).some(d=>d.path==='physical.powerMode'&&d.severity!=='warning');
 return {mode:p.powerMode,noInternalPower:equipment?.noInternalPower??null,powerPacks:p.powerPacks,external:state?.external??null,limited:state?.limited??null,shutdown:state?.shutdown??null,availability:unavailable?'unavailable':unresolved?'unresolved':state?.external?'external-connection-conditional':'selected-source-conditional',readiness:'conditional',energyBudget:null,source:source('57')};
}
export function evaluateVerifiedVehicleOptions(design,equipment){
 let cost=0,slots=0;const diagnostics=[],ledger=[],installations=[];
 for(const record of design.selections.physical.verifiedVehicleOptions){
  const row=rows.find(row=>row.id===record.optionId),extraCharges=isDischarger(row)?(record.extraCharges??0)*record.quantity:0;
  const issue=(severity,code,message)=>diagnostics.push({severity,code,path:'physical.verifiedVehicleOptions.'+record.id,recordLabel:row.label,contextLabel:'Vehicle options (2026 source)',message,source:row.source});
  if(design.techLevel<row.tl)issue('error','VEHICLE_OPTION_TL','Source minimum technology exceeds the design technology. Prototype conversions are not implemented.');
  const retainedSelections={};
  if(!isDischarger(row)&&record.extraCharges){retainedSelections.extraCharges=record.extraCharges;issue('error','VEHICLE_OPTION_CHARGES_INAPPLICABLE','Retained additional charges do not apply to this utility. Clear the value or restore a discharger; no consumables are counted.');}
  if(!isSampler(row)&&record.samplerMedium){retainedSelections.samplerMedium=record.samplerMedium;issue('error','VEHICLE_OPTION_MEDIUM_INAPPLICABLE','Retained sampler medium does not apply to this option. Clear the medium or restore a sampler.');}
  if(isSampler(row)&&!record.samplerMedium)issue('error','VEHICLE_OPTION_MEDIUM_REQUIRED','Select one medium for each sampler installation; use separate installations for different media.');
  let familyFacts;
  if(isDischarger(row)){
   issue('warning','VEHICLE_OPTION_CONTEXT','Exterior discharge clearance, trigger/interface suitability and contextual deployment require referee review. No automatic skill, armour or defence bonus is granted.');
   issue('warning','VEHICLE_OPTION_LOAD_UNKNOWN','Capacity is not an initial purchase or loaded inventory. Initial contents and replacement charge prices are not established by the source row.');
   if(extraCharges)issue('blocker','VEHICLE_OPTION_CHARGES_UNPRICED','Additional charge price and mass are unspecified; no zero-price or zero-volume consumable purchase is inferred.');
   familyFacts={capacityPerInstallation:row.capacity,capacity:row.capacity*record.quantity,loadedCharges:null,initialChargesIncluded:null,additionalCharges:extraCharges,additionalChargeCost:extraCharges?null:0,additionalChargeMassKg:extraCharges?null:0};
  }else{
   issue('warning','VEHICLE_UTILITY_CONTEXT','Physical reach, deployment, interfaces and operating checks remain contextual. No autonomous operation, skill, manipulator or attack is granted.');
   const power=row.operation.requiresPower?powerContext(design,equipment):null;
   if(power)issue('warning',power.availability==='unavailable'?'VEHICLE_UTILITY_POWER_UNAVAILABLE':'VEHICLE_UTILITY_POWER_CONDITIONAL','Utility operation requires suitable power; selected robot power is contextual and no device energy budget or operating readiness is certified. Hardware accounting is retained.');
   familyFacts={utilityType:row.utilityType,equivalenceAudit:row.equivalenceAudit,operation:row.operation,operatingReadiness:'conditional',powerSource:source('57'),technologySource:source('57'),...(power?{power}:{}),...(row.utilityType==='crane'?{maximumLoadKgPerInstallation:row.maximumLoadKg}:{}),...(isSampler(row)?{samplerMedium:record.samplerMedium||null}:{}),...(row.utilityType==='radar'?{nominalDepthMetresPerInstallation:row.nominalDepthMetres}:{}),selectedFacts:[...utilityFacts(row,record),...(power?[{label:'Power availability',value:power.availability==='unavailable'?'Unavailable':power.availability==='unresolved'?'Unresolved':power.external?'External connection (conditional)':'Selected source (conditional)'}]:[]),{label:'Operating readiness',value:'Conditional'}]};
  }
  const installationCost=row.cost*record.quantity,installationSlots=row.spaces*64*record.quantity;cost+=installationCost;slots+=installationSlots;
  ledger.push({id:'verified-vehicle-'+record.id,label:row.label+' (VH 2026)',cost:installationCost,slots:installationSlots,quantity:record.quantity,source:row.source,conversionSource});
  installations.push({id:record.id,optionId:row.id,label:row.label,family:row.family,quantity:record.quantity,minimumTL:row.tl,hardwareTL:row.tl,spacesPerInstallation:row.spaces,slotsPerInstallation:row.spaces*64,costPerInstallation:row.cost,cost:installationCost,slots:installationSlots,source:row.source,conversionSource,sourceVerified:true,scope:'Hardware construction only; not operating readiness.',handbookEquivalent:null,...familyFacts,...(Object.keys(retainedSelections).length?{retainedSelections}:{}),conditionLabels:row.conditionLabels,effects:{...row.effects,appliedToRobotTotals:false}});
 }
 return clone({cost,slots,diagnostics,ledger,installations});
}
