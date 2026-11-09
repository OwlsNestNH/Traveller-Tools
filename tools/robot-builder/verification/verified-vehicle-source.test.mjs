import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,importDesign,exportDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {verifiedVehicleOptionCatalogue} from '../engine/verified-vehicle-options.mjs';
const sourceRecord=(patch={})=>({id:'v26-test',optionId:'vh2026-smoke-discharger',quantity:1,extraCharges:0,...patch});
const make=(records=[sourceRecord()],patch={})=>updateDesign(createDesign({techLevel:12}),{selections:{chassis:{size:'size-8'},physical:{verifiedVehicleOptions:records}},...patch});
const result=(records,patch)=>evaluateDesign(make(records,patch));
const choices=()=>getCatalogue().stages.find(stage=>stage.id==='physical').controls.find(control=>control.type==='verified-vehicle-options').itemFields.find(field=>field.field==='optionId').choices.filter(row=>row.family==='discharger');

test('source audit: three 2026 dischargers preserve exact printed hardware facts and RH conversion',()=>{
 assert.deepEqual(choices().map(row=>[row.id,row.tl,row.spaces,row.cost,row.capacity,row.source.pages]),[
  ['vh2026-decoy-dispenser',5,1,2500,60,'74-75'],['vh2026-prismatic-aerosol-discharger',9,1,4000,30,'77'],['vh2026-smoke-discharger',3,1,1000,30,'77']
 ]);
 for(const choice of choices()){assert.equal(choice.slots,64);assert.equal(choice.sourceVerified,true);assert.equal(choice.handbookEquivalent,null);assert.equal(choice.source.book,'Vehicle Handbook Update 2026');assert.equal(choice.source.edition,'Mongoose 2026');assert.deepEqual(choice.conversionSource,{book:'Robot Handbook',edition:'Mongoose 2022',pages:'62'});}
 assert.equal(getCatalogue().coverage.inventory.verifiedVehicleOptionRows,14);
});
test('fixed-source hardware can pass subset checks and is priced exactly once',()=>{
 const base=evaluateDesign(make([]));
 for(const choice of choices()){
  const checked=result([sourceRecord({optionId:choice.id})]);assert.equal(checked.status,'verified');assert.equal(checked.totals.cost-base.totals.cost,choice.cost);
  assert.equal(checked.verifiedVehicleInstallations[0].slots,64);assert.equal(checked.ledger.filter(row=>row.id==='verified-vehicle-v26-test').length,1);
  assert.equal(checked.externalVehicleEstimates.length,0);assert.ok(!checked.diagnostics.some(d=>d.code==='EXTERNAL_OPTION_UNVERIFIED'));
 }
});
test('quantities and fit apply across duplicate records and all installed equipment',()=>{
 const pair=result([sourceRecord({quantity:2})]);assert.equal(pair.verifiedVehicleInstallations[0].slots,128);assert.equal(pair.verifiedVehicleInstallations[0].cost,2000);assert.equal(pair.status,'verified');assert.equal(result([sourceRecord({quantity:3})]).status,'invalid');
 const split=result([sourceRecord(),sourceRecord({id:'v26-second',quantity:2})]);assert.equal(split.verifiedVehicleInstallations.reduce((sum,row)=>sum+row.slots,0),192);assert.ok(split.diagnostics.some(d=>d.code==='SLOTS_EXCEEDED'));
 const small=evaluateDesign(updateDesign(make(),{selections:{chassis:{size:'size-5'}}}));assert.ok(small.diagnostics.some(d=>d.code==='SLOTS_EXCEEDED'));
});
test('technology is an exact lower bound with retained repairable selections',()=>{
 const low=result([sourceRecord({optionId:'vh2026-prismatic-aerosol-discharger'})],{techLevel:8});assert.ok(low.diagnostics.some(d=>d.code==='VEHICLE_OPTION_TL'));
 const d=make([sourceRecord({optionId:'vh2026-prismatic-aerosol-discharger'})]);assert.equal(result(d.selections.physical.verifiedVehicleOptions).status,'verified');
});
test('capacities are not purchased initial contents or automatically granted combat benefits',()=>{
 for(const choice of choices()){
  const checked=result([sourceRecord({optionId:choice.id})]),item=checked.verifiedVehicleInstallations[0];
  assert.equal(item.loadedCharges,null);assert.equal(item.initialChargesIncluded,null);assert.equal(item.effects.appliedToRobotTotals,false);assert.equal(item.capacityPerInstallation,choice.capacity);
  assert.ok(checked.diagnostics.some(d=>d.code==='VEHICLE_OPTION_LOAD_UNKNOWN'));assert.ok(checked.diagnostics.some(d=>d.code==='VEHICLE_OPTION_CONTEXT'));
 }
 const decoy=choices().find(row=>row.id==='vh2026-decoy-dispenser');assert.equal(decoy.effects.manualTriggerThroughTL,7);assert.equal(decoy.effects.sensorDetectionBonus,0);assert.equal(decoy.effects.maximumAttackerTLRelativeToRobot,0);
 const aerosol=choices().find(row=>row.id==='vh2026-prismatic-aerosol-discharger');assert.equal(aerosol.effects.destructiveWeaponsAffected,false);assert.equal(aerosol.effects.nonLaserWeaponsAffected,false);assert.equal(aerosol.effects.stationaryOnly,true);
 const smoke=choices().find(row=>row.id==='vh2026-smoke-discharger');assert.equal(smoke.effects.maximumAffectedFireControlTL,8);assert.equal(smoke.effects.stationaryOnly,true);
});
test('requested extra charges block totals rather than pretending unknown price or volume is zero',()=>{
 const checked=result([sourceRecord({extraCharges:10})]);assert.equal(checked.status,'blocked');assert.equal(checked.totals,null);assert.equal(checked.previewTotals,undefined);
 assert.equal(checked.verifiedVehicleInstallations[0].additionalCharges,10);assert.equal(checked.verifiedVehicleInstallations[0].additionalChargeCost,null);assert.equal(checked.verifiedVehicleInstallations[0].additionalChargeMassKg,null);assert.ok(checked.diagnostics.some(d=>d.code==='VEHICLE_OPTION_CHARGES_UNPRICED'));
 assert.equal(result([sourceRecord({extraCharges:2,quantity:3})]).verifiedVehicleInstallations[0].additionalCharges,6);
});
test('source facts and equivalence cannot be forged or replaced through API/import',()=>{
 for(const patch of [{verified:true},{cost:0},{spaces:0},{source:{book:'fake'}},{tl:0},{handbookEquivalent:'none'},{quantity:0},{quantity:1.5},{quantity:1001},{extraCharges:-1},{extraCharges:Infinity},{optionId:'satellite-uplink'},{optionId:'vh2026-densitometer'},{optionId:'vh2026-recon-sensor'}])assert.throws(()=>make([sourceRecord(patch)]));
 assert.throws(()=>make([sourceRecord(),sourceRecord()]));assert.throws(()=>make(Array.from({length:51},(_,i)=>sourceRecord({id:'v26-'+i}))));
 const forged=make();forged.selections.physical.verifiedVehicleOptions[0].pricePerInstallation=0;assert.throws(()=>importDesign(JSON.stringify(forged)));
});
test('legacy imports add an empty source catalogue collection without promoting external estimates',()=>{
 const old=make([]);delete old.selections.physical.verifiedVehicleOptions;
 const imported=importDesign(JSON.stringify(old));assert.deepEqual(imported.selections.physical.verifiedVehicleOptions,[]);
 const d=make();delete d.selections.physical.verifiedVehicleOptions[0].extraCharges;
 assert.deepEqual(importDesign(exportDesign(d)),d);
});
test('catalogue, presentation and evaluated facts are detached from authoritative values',()=>{
 const first=verifiedVehicleOptionCatalogue();first[0].cost=0;first[0].effects.smartAttackDM=-100;first[0].source.edition='fake';assert.equal(choices()[0].cost,2500);assert.equal(choices()[0].effects.smartAttackDM,-2);
 const checked=result();checked.verifiedVehicleInstallations[0].cost=0;checked.verifiedVehicleInstallations[0].conditionLabels.length=0;assert.equal(result().verifiedVehicleInstallations[0].cost,1000);assert.ok(result().verifiedVehicleInstallations[0].conditionLabels.length);
});
test('API save/import/export/review retain source identity, unknown loads and concise selected facts',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const api=createRobotApi({storage,locks:{request:(_name,_options,callback)=>callback()},idFactory:()=> 'verified-fixture'});
 api.importDesign(exportDesign(make()));await api.saveDesign();const exported=api.exportDesign();assert.equal(importDesign(exported).selections.physical.verifiedVehicleOptions[0].optionId,'vh2026-smoke-discharger');
 const view=api.getView(),section=view.review.sections.find(section=>section.id==='verified-vehicle-options');assert.ok(section);assert.equal(section.rows[0].label,'Smoke Discharger');assert.match(section.rows[0].source,/2026/);assert.ok(section.rows[0].details.some(row=>row.label==='Initial contents'&&row.value==='Unverified'));
 const control=view.catalogue.stages.find(stage=>stage.id==='physical').controls.find(control=>control.type==='verified-vehicle-options');assert.deepEqual(control.itemFields.map(field=>field.field),['optionId','quantity','allocatedSpaces','extraCharges','samplerMedium']);
 const presentation=api.getRecordPresentation(control,sourceRecord());assert.equal(presentation.vehicleOption.unitCost,1000);presentation.vehicleOption.unitCost=0;assert.equal(api.getRecordPresentation(control,sourceRecord()).vehicleOption.unitCost,1000);
 const restored=createRobotApi({storage,locks:{request:(_n,_o,callback)=>callback()}});restored.loadDesign('verified-fixture');assert.deepEqual(restored.getView().design.selections.physical.verifiedVehicleOptions,[sourceRecord()]);
});
