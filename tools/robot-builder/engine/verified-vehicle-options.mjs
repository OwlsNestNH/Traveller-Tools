import {assertKeys,integer,clone} from './schema.mjs';
// Audited numerical facts only. Private source pages are not distributed.
const conversionSource={book:'Robot Handbook',edition:'Mongoose 2022',pages:'62'};
const source=pages=>({book:'Vehicle Handbook Update 2026',edition:'Mongoose 2026',pages});
const rows=[
 {id:'vh2026-decoy-dispenser',label:'Decoy Dispenser',tl:5,spaces:1,cost:2500,capacity:60,source:source('74-75'),conditionLabels:['Smart attacks only','Smart weapon TL <= robot TL','Deployment each round','TL7 or less: aware crew + Minor Action'],effects:{smartAttackDM:-2,maximumAttackerTLRelativeToRobot:0,deploymentEachAttackedRound:true,manualTriggerThroughTL:7,sensorDetectionBonus:0}},
 {id:'vh2026-prismatic-aerosol-discharger',label:'Prismatic Aerosol Discharger',tl:9,spaces:1,cost:4000,capacity:30,source:source('77'),conditionLabels:['Stationary','Moderate breeze or less','Non-Destructive lasers only'],effects:{laserDamageReductionDice:2,stationaryOnly:true,windAtMostModerateBreeze:true,destructiveWeaponsAffected:false,nonLaserWeaponsAffected:false}},
 {id:'vh2026-smoke-discharger',label:'Smoke Discharger',tl:3,spaces:1,cost:1000,capacity:30,source:source('77'),conditionLabels:['Stationary','Moderate breeze or less','No effect against TL9+ fire control'],effects:{incomingAttackDM:-2,stationaryOnly:true,windAtMostModerateBreeze:true,maximumAffectedFireControlTL:8}}
];
export function verifiedVehicleOptionCatalogue(){return clone(rows.map(row=>({...row,implemented:true,sourceVerified:true,handbookEquivalent:null,slots:row.spaces*64,conversionSource,scope:'Source hardware and fixed-Space accounting; load and deployment remain contextual.'})));}
export function verifiedVehicleControl(){return{field:'verifiedVehicleOptions',label:'Vehicle options (2026 source)',category:'Slot Cost Options',type:'verified-vehicle-options',recordNameField:'optionId',recordIdPrefix:'v26-',composerLabel:'Vehicle Handbook Update 2026',maxItems:50,addLabel:'Add source vehicle option',collapsedByDefault:true,source:source('74-75,77'),itemFields:[
 {field:'optionId',label:'Vehicle option',type:'select',default:rows[0].id,choices:verifiedVehicleOptionCatalogue()},
 {field:'quantity',label:'Installations',type:'number',min:1,max:1000,default:1},
 {field:'extraCharges',label:'Additional charges per installation (unpriced)',type:'number',min:0,max:1000,default:0,optional:true}
]};}
export function validateVerifiedVehicleOptions(records){
 if(!Array.isArray(records)||records.length>50)throw new TypeError('Expected up to 50 source vehicle option records.');
 const ids=new Set();
 for(const record of records){
  assertKeys(record,['id','optionId','quantity','extraCharges'],'physical.verifiedVehicleOptions');
  if(typeof record.id!=='string'||!/^[-a-z0-9]{1,40}$/.test(record.id)||ids.has(record.id))throw new TypeError('Invalid or duplicate source vehicle option ID.');ids.add(record.id);
  if(!rows.some(row=>row.id===record.optionId))throw new TypeError('Unknown verified vehicle option. Use a source catalogue ID.');
  integer(record.quantity,1,1000,'quantity');if(record.extraCharges!==undefined)integer(record.extraCharges,0,1000,'extraCharges');
 }
}
export function vehicleOptionRecordPresentation(record){
 const row=rows.find(row=>row.id===record?.optionId);
 return row?clone({fields:{},vehicleOption:{label:row.label,source:row.source,conversionSource,unitCost:row.cost,slotsPerInstallation:row.spaces*64,capacityPerInstallation:row.capacity,conditionLabels:row.conditionLabels,loadLabel:'Initial contents unverified',replacementPriceLabel:'Replacement charge price unknown'}}):{fields:{}};
}
export function evaluateVerifiedVehicleOptions(design){
 let cost=0,slots=0;const diagnostics=[],ledger=[],installations=[];
 for(const record of design.selections.physical.verifiedVehicleOptions){
  const row=rows.find(row=>row.id===record.optionId),extraCharges=(record.extraCharges??0)*record.quantity;
  const issue=(severity,code,message)=>diagnostics.push({severity,code,path:'physical.verifiedVehicleOptions.'+record.id,message,source:row.source});
  if(design.techLevel<row.tl)issue('error','VEHICLE_OPTION_TL','Source minimum technology exceeds the design technology. Prototype conversions are not implemented.');
  issue('warning','VEHICLE_OPTION_CONTEXT','Exterior discharge clearance, trigger/interface suitability and contextual deployment require referee review. No automatic skill, armour or defence bonus is granted.');
  issue('warning','VEHICLE_OPTION_LOAD_UNKNOWN','Capacity is not an initial purchase or loaded inventory. Initial contents and replacement charge prices are not established by the source row.');
  if(extraCharges)issue('blocker','VEHICLE_OPTION_CHARGES_UNPRICED','Additional charge price and mass are unspecified; no zero-price or zero-volume consumable purchase is inferred.');
  const installationCost=row.cost*record.quantity,installationSlots=row.spaces*64*record.quantity;cost+=installationCost;slots+=installationSlots;
  ledger.push({id:'verified-vehicle-'+record.id,label:row.label+' (VH 2026)',cost:installationCost,slots:installationSlots,quantity:record.quantity,source:row.source,conversionSource});
  installations.push({id:record.id,optionId:row.id,label:row.label,quantity:record.quantity,minimumTL:row.tl,spacesPerInstallation:row.spaces,slotsPerInstallation:row.spaces*64,costPerInstallation:row.cost,cost:installationCost,slots:installationSlots,source:row.source,conversionSource,sourceVerified:true,scope:'Hardware construction only; not operating readiness.',handbookEquivalent:null,capacityPerInstallation:row.capacity,capacity:row.capacity*record.quantity,loadedCharges:null,initialChargesIncluded:null,additionalCharges:extraCharges,additionalChargeCost:extraCharges?null:0,additionalChargeMassKg:extraCharges?null:0,conditionLabels:row.conditionLabels,effects:{...row.effects,appliedToRobotTotals:false}});
 }
 return clone({cost,slots,diagnostics,ledger,installations});
}
