import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {getAugmentationCatalogue} from '../engine/augmentations.mjs';
import {CSC_MASS_DEVICES} from '../engine/csc-mass-devices.mjs';

// Independently transcribed from visually checked printed pp63-65,74-75,
// Central Supply Catalogue Update 2023, revised printing copyright 2026.
const rows=[
 ['holographic-display-9',9,2,800,'63'],['holographic-display-11',11,1,1000,'63'],['holographic-projector-12',12,1,10000,'63'],
 ['radio-transceiver-7',7,1,100,'64-65'],['laser-transceiver-9',9,1.5,2500,'64-65'],
 ['electronic-binoculars-9',9,1,750,'74'],['electronic-binoculars-10',10,1,750,'74'],['cold-light-lantern-6',6,.25,20,'74'],
 ['flashlight-6',6,.5,10,'75'],['flashlight-7',7,.5,10,'75'],['flashlight-8',8,.5,10,'75'],['infrared-goggles-6',6,1,500,'75']
];
const option=id=>'misc-mass-csc-'+id;
const run=(id,parameters={},extra=[],tl=14)=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'device',optionId:option(id),parameters},...extra]}}));
const cap=id=>run(id).totals.augmentations[0].capabilities[0];
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
for(const [id,tl,mass,cost,pages] of rows){
 test('CSC source row '+id+' retains price, numeric mass, edition and implant accounting',()=>{
  const row=getAugmentationCatalogue().find(r=>r.id===option(id));
  assert.ok(row,'CSC row integrated into augmentation catalogue');
  assert.equal(row.tl,tl);assert.equal(row.device.massKg,mass);assert.equal(row.device.cost,cost);
  assert.deepEqual(row.device.source,{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
  const r=run(id),part=r.totals.augmentations[0];
  assert.equal(r.status,'verified');assert.equal(part.structureCost,cost*3);assert.equal(part.interfaceCost,10000);
  assert.equal(r.totals.cost,cost*3+10000);assert.equal(part.miscDevice.massKg,mass);assert.equal(part.miscDevice.slots,null);
  assert.equal(part.capabilities[0].scope,'augment-only');assert.equal(part.capabilities[0].recipientSkillGranted,false);
  assert.equal(part.capabilities[0].recipientProtectionGranted,false);assert.deepEqual(r.totals.skills,[]);
 });
}
test('CSC subset is explicit, distinct from Core and excludes unresolved variants',()=>{
 assert.deepEqual(CSC_MASS_DEVICES.map(r=>r.id).sort(),rows.map(r=>'csc-'+r[0]).sort());
 assert.equal(new Set(getAugmentationCatalogue().map(r=>r.id)).size,getAugmentationCatalogue().length);
 assert.ok(getAugmentationCatalogue().some(r=>r.id==='misc-mass-binoculars-8'));
 assert.ok(CSC_MASS_DEVICES.every(r=>r.massKg>0&&r.massKg<=2&&r.effects.processing===undefined));
});
test('Holographic radius and realism preserve the missing INT target instead of inventing one',()=>{
 assert.equal(cap('holographic-display-9').rangeMetres,.3);assert.equal(cap('holographic-display-9').realism,'translucent');
 const improved=cap('holographic-display-11');assert.equal(improved.disbeliefCheck,'INT');assert.equal(improved.disbeliefTarget,null);
 const enhanced=cap('holographic-projector-12');assert.equal(enhanced.rangeMetres,3);assert.equal(enhanced.realism,'true-to-life');assert.equal(enhanced.smell,false);assert.equal(enhanced.physicalSubstance,false);
});
test('Standalone communications preserve range, laser limitations and optional accessory boundaries',()=>{
 const radio=cap('radio-transceiver-7');assert.equal(radio.rangeKm,5);assert.equal(radio.networkRequired,false);assert.equal(radio.integralComputer,false);assert.equal(radio.satelliteUplinkIncluded,false);
 const laser=cap('laser-transceiver-9');assert.equal(laser.rangeKm,500);assert.equal(laser.lineOfSightRequired,true);assert.equal(laser.atmosphericAndHorizonLimits,true);assert.equal(laser.openSpaceRangeKm,null);assert.equal(laser.integralComputer,false);assert.equal(laser.hardwareEncryptionIncluded,false);assert.equal(laser.defaultDecryptionCheck.target,10);
});
test('Electronic binoculars retain inherited imaging and obstruction limits',()=>{
 for(const id of ['electronic-binoculars-9','electronic-binoculars-10']){
  const c=cap(id);assert.equal(c.magnification,10);assert.equal(c.laserRangefinder,true);assert.equal(c.infraredVision,true);assert.equal(c.thermalImaging,true);assert.equal(c.lightIntensificationInTotalDarkness,false);assert.equal(c.seesThroughFog,false);assert.equal(c.seesThroughSmoke,false);assert.equal(c.seesThroughThickFoliage,false);
 }
 assert.equal(cap('electronic-binoculars-9').imageProcessing,false);assert.equal(cap('electronic-binoculars-10').partiallyHiddenObjectIdentification,true);
 const ir=cap('infrared-goggles-6');assert.equal(ir.heatClutterInterference,true);assert.equal(ir.uniformTemperatureNavigation,false);
});
test('Lighting preserves power duration and selectable beam geometry',()=>{
 const basic=cap('flashlight-6');assert.equal(basic.continuousHours,6);assert.deepEqual(basic.lightModes,[{mode:'wide',rangeMetres:18,radiusMetres:6}]);
 const improved=cap('flashlight-7');assert.equal(improved.lightModes.length,3);assert.deepEqual(improved.lightModes[1],{mode:'tight',rangeMetres:36,radiusMetres:1});assert.equal(improved.lightModes[2].radiusMetres,10);
 const advanced=cap('flashlight-8');assert.equal(advanced.continuousHours,24);assert.equal(advanced.quickRecharge,true);assert.ok(advanced.lightModes.some(m=>m.mode==='narrow'&&m.rangeMetres===250));assert.ok(advanced.lightModes.some(m=>m.mode==='strobe'));
 const lantern=cap('cold-light-lantern-6');assert.equal(lantern.continuousHours,72);assert.equal(lantern.powerSource,'fuel cell');assert.equal(lantern.lightModes.length,3);
});
test('CSC devices use existing TL, quantity, modifier and neural-link constraints',()=>{
 assert.ok(has(run('holographic-projector-12',{},[],11),'AUGMENT_TL'));
 assert.ok(has(run('flashlight-6',{quantity:4}),'MISC_IMPLANT_COUNT'));
 assert.equal(run('flashlight-6',{quantity:3}).status,'verified');
 assert.equal(run('flashlight-6',{ruggedised:'yes'}).totals.cost,10030*1.25);
 assert.ok(has(run('flashlight-6',{interfaceMode:'neural'}),'MISC_IMPLANT_NEURAL_LINK'));
 const linked=run('flashlight-6',{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);
 assert.equal(linked.status,'verified');assert.equal(linked.totals.augmentations[0].interfaceCost,0);
 for(const parameters of [{massKg:0},{cost:0},{rangeKm:9999}])assert.throws(()=>run('flashlight-6',parameters));
});



test('returned device catalogues and evaluations cannot mutate later construction results',()=>{
 const result=run('flashlight-7'),light=result.totals.augmentations[0];
 light.capabilities[0].lightModes[0].rangeMetres=999;
 light.miscDevice.source.pages='altered';
 assert.equal(cap('flashlight-7').lightModes[0].rangeMetres,18);
 assert.equal(cap('cold-light-lantern-6').lightModes[0].rangeMetres,18);
 assert.equal(run('flashlight-7').totals.augmentations[0].miscDevice.source.pages,'75');
 const catalogue=getAugmentationCatalogue(),row=catalogue.find(r=>r.id===option('flashlight-7'));
 row.device.effects.lightModes[0].rangeMetres=888;row.device.cost=0;row.device.source.pages='altered';
 const next=run('flashlight-7');assert.equal(next.totals.cost,10030);
 assert.equal(next.totals.augmentations[0].capabilities[0].lightModes[0].rangeMetres,18);
 assert.equal(next.totals.augmentations[0].miscDevice.source.pages,'75');
 assert.equal(cap('flashlight-6').lightModes[0].rangeMetres,18);
});
