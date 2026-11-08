import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {getAugmentationCatalogue} from '../engine/augmentations.mjs';
import {CSC_MASS_DEVICES} from '../engine/csc-mass-devices.mjs';

// Independently transcribed from visually checked printed pp63-65,73-76,78-79,88,90-91,105,107,125-126,
// Central Supply Catalogue Update 2023, revised printing copyright 2026.
const rows=[
 ['optical-binoculars-3',3,1,75,'73'],['electronic-binoculars-8',8,1,750,'74'],
 ['camera-still-mono-5',5,2,200,'73'],['camera-still-colour-6',6,1,100,'73'],['camera-still-digital-7',7,1,200,'73'],['camera-still-holographic-9',9,2,1000,'73'],['camera-motion-holographic-10',10,2,2000,'73'],
 ['fire-extinguisher-5',5,2,50,'105'],['infinite-rope-16',16,1,1000,'107'],['cutting-torch-10',10,2,5000,'126'],
 ['holographic-display-9',9,2,800,'63'],['holographic-display-11',11,1,1000,'63'],['holographic-projector-12',12,1,10000,'63'],
 ['radio-transceiver-7',7,1,100,'64-65'],['laser-transceiver-9',9,1.5,2500,'64-65'],
 ['electronic-binoculars-9',9,1,750,'74'],['electronic-binoculars-10',10,1,750,'74'],['cold-light-lantern-6',6,.25,20,'74'],
 ['flashlight-6',6,.5,10,'75'],['flashlight-7',7,.5,10,'75'],['flashlight-8',8,.5,10,'75'],['infrared-goggles-6',6,1,500,'75'],
 ['geiger-counter-5',5,2,250,'75'],['light-intensifier-7',7,1,500,'75'],['pris-binoculars-12',12,1,3500,'76'],['psi-finder-binoculars-16',16,1,10000,'76'],['em-probe-10',10,1,1000,'78-79'],
 ['medikit-8',8,1,1000,'88,90'],['medikit-10',10,1,1500,'88,90'],['medikit-12',12,1,5000,'88,90'],['portable-mediscanner-12',12,1,2000,'91'],['electronic-tool-set-7',7,2,2000,'125-126']
];
const option=id=>'misc-mass-csc-'+id;
const run=(id,parameters={},extra=[],tl=14)=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'device',optionId:option(id),parameters},...extra]}}));
const cap=id=>run(id,{},[],16).totals.augmentations[0].capabilities[0];
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
for(const [id,tl,mass,cost,pages] of rows){
 test('CSC source row '+id+' retains price, numeric mass, edition and implant accounting',()=>{
  const row=getAugmentationCatalogue().find(r=>r.id===option(id));
  assert.ok(row,'CSC row integrated into augmentation catalogue');
  assert.equal(row.tl,tl);assert.equal(row.device.massKg,mass);assert.equal(row.device.cost,cost);
  assert.deepEqual(row.device.source,{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
  const r=run(id,{},[],Math.max(14,tl)),part=r.totals.augmentations[0];
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


test('Additional sensors retain thresholds, restrictions and fixed source hardware TL',()=>{
 const geiger=cap('geiger-counter-5');assert.equal(geiger.minimumSourceRadsPerHour,30);assert.equal(geiger.determinesSourceComposition,false);assert.equal(geiger.determinesSourceDirection,false);
 const light=cap('light-intensifier-7');assert.equal(light.rangeMetres,18);assert.equal(light.monochromeVision,true);assert.equal(light.totalDarkness,false);assert.equal(light.daylightSeverelyDegradesClarity,true);assert.equal(light.infraredVision,false);assert.equal(light.automaticDaylightAdjustment,false);
 for(const id of ['pris-binoculars-12','psi-finder-binoculars-16']){const p=cap(id);assert.deepEqual(p.emSpectrum,['microwaves','gamma rays']);assert.equal(p.passiveNaturalEmissions,true);assert.equal(p.falseColourDisplay,true);assert.equal(p.compositeSpectralImages,true);assert.equal(p.compositeImagesMayConfuseNewUsers,true);assert.equal(p.electronicsSensorsSkillRequired,false);assert.equal(p.closeRangeMagnification,false);}
 assert.equal(cap('pris-binoculars-12').psiDetection,undefined);
 assert.deepEqual(cap('psi-finder-binoculars-16').psiDetection,{requiresFilterEnabled:true,detectsPSIPresence:true,relativeStrengthByNimbusBrightness:true,exactPSIScore:false});
 const probe=cap('em-probe-10');assert.equal(probe.equipmentDiagnostics,true);assert.deepEqual(probe.bugDetection,{rangeMetres:6,skill:'Electronics (sensors)',activelyTransmittingTarget:8,passiveTarget:12,deluxeDM:2,hardwareTL:10,positiveTLAdvantageDM:true,automaticDetection:false});
 assert.equal(run('em-probe-10',{},[],18).totals.augmentations[0].capabilities[0].bugDetection.hardwareTL,10);
});

test('CSC medical equipment retains task scope, consumables and calibration without free alien chips',()=>{
 for(const [tl,dm,cost] of [[8,0,1000],[10,1,1500],[12,2,5000]]){const c=cap('medikit-'+tl);assert.equal(c.firstAidDM,dm);assert.equal(c.fieldSurgeryDM,dm-2);assert.match(c.condition,/not a universal Medic/);assert.equal(c.consumables.approximateUses,10);assert.equal(c.consumables.refereeOptional,true);assert.equal(c.consumables.replenishmentCost,cost/4);assert.equal(c.consumables.replenishmentIncluded,false);}
 const c=cap('portable-mediscanner-12');assert.equal(c.medicDM,1);assert.match(c.condition,/after analysis/);assert.deepEqual(c.calibration,{eachNewSubject:true,duration:'1D minutes',analysisRequired:true});assert.deepEqual(c.alienSpeciesChips,{included:false,costEach:500});assert.equal(c.automaticTreatment,false);
 assert.equal(run('portable-mediscanner-12').totals.cost,16000);
 assert.throws(()=>run('portable-mediscanner-12',{alienSpeciesChips:1}));
});

test('CSC electronic tool set does not inherit Core speciality or automatic two-TL modifiers',()=>{
 const row=getAugmentationCatalogue().find(r=>r.id===option('electronic-tool-set-7'));assert.ok(!row.parameterControls.some(c=>c.field==='electronicsSpeciality'));
 const c=cap('electronic-tool-set-7');assert.equal(c.electronicAssemblyAndRepair,true);assert.equal(c.electronicsToolkit,undefined);assert.equal(c.taskTechnologyModifiers,undefined);
 assert.deepEqual(c.taskTechnologyGuidance,{refereeDiscretion:true,gapMustExceed:2,lowerTaskTLPotentialDM:2,higherTaskTLPenalty:'As missing or improvised tools',compatibilityRequired:true,automaticModifier:false});
 assert.equal(c.consumables.fullTimeWorkMonths,1);assert.equal(c.consumables.refereeOptional,true);assert.equal(c.consumables.replenishmentCost,200);assert.equal(c.consumables.replenishmentIncluded,false);
 assert.throws(()=>run('electronic-tool-set-7',{electronicsSpeciality:'computers'}));
});

test('New CSC rows enforce TL, shared count and priced interfaces without replacing Core records',()=>{
 assert.ok(has(run('psi-finder-binoculars-16',{},[],15),'AUGMENT_TL'));
 assert.ok(has(run('medikit-12',{},[],11),'AUGMENT_TL'));
 assert.equal(run('medikit-10',{quantity:3}).totals.cost,43500);
 assert.ok(has(run('medikit-10',{quantity:3},[{id:'extra',optionId:option('geiger-counter-5'),parameters:{}}]),'MISC_IMPLANT_COUNT'));
 assert.ok(has(run('portable-mediscanner-12',{interfaceMode:'neural'}),'MISC_IMPLANT_NEURAL_LINK'));
 const linked=run('portable-mediscanner-12',{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);assert.equal(linked.status,'verified');assert.equal(linked.totals.augmentations[0].interfaceCost,0);assert.equal(linked.totals.augmentations[0].structureCost,6000);
 assert.equal(run('electronic-tool-set-7',{ruggedised:'yes'}).totals.cost,20000);
 for(const id of ['medikit-8','em-probe','electronics-toolkit-7','geiger-5','binoculars-12'])assert.ok(getAugmentationCatalogue().some(r=>r.id==='misc-mass-'+id));
 for(const id of ['medikit-14','geiger-counter-10','light-intensifier-9','radio-jammer-6','bug-sweeper-5'])assert.ok(!CSC_MASS_DEVICES.some(r=>r.id==='csc-'+id));
 for(const p of [{cost:0},{massKg:0},{hardwareTL:18},{firstAidDM:99}])assert.throws(()=>run('medikit-8',p));
});

test('New nested sensor, medical and tool data is detached between returned results and sibling rows',()=>{
 const pris=run('psi-finder-binoculars-16',{},[],16).totals.augmentations[0];pris.capabilities[0].emSpectrum[0]='altered';pris.capabilities[0].psiDetection.exactPSIScore=true;
 assert.equal(cap('pris-binoculars-12').emSpectrum[0],'microwaves');assert.equal(cap('psi-finder-binoculars-16').psiDetection.exactPSIScore,false);
 const probe=cap('em-probe-10');probe.bugDetection.hardwareTL=99;assert.equal(cap('em-probe-10').bugDetection.hardwareTL,10);
 const med=cap('medikit-8');med.consumables.replenishmentCost=0;assert.equal(cap('medikit-8').consumables.replenishmentCost,250);assert.equal(cap('medikit-10').consumables.replenishmentCost,375);
 const cat=getAugmentationCatalogue();cat.find(r=>r.id===option('portable-mediscanner-12')).device.effects.alienSpeciesChips.included=true;assert.equal(cap('portable-mediscanner-12').alienSpeciesChips.included,false);
 cap('electronic-tool-set-7').taskTechnologyGuidance.automaticModifier=true;assert.equal(cap('electronic-tool-set-7').taskTechnologyGuidance.automaticModifier,false);
});

test('Optical and basic electronic binoculars do not acquire later-TL imaging',()=>{
 const optical=cap('optical-binoculars-3');assert.equal(optical.maximumMagnification,10);assert.equal(optical.fieldOfViewReducesWithMagnification,true);
 for(const key of ['laserRangefinder','lightIntensification','infraredVision','thermalImaging'])assert.equal(optical[key],false);
 const basic=cap('electronic-binoculars-8');assert.equal(basic.magnification,10);assert.equal(basic.laserRangefinder,true);assert.equal(basic.lightIntensification,true);
 for(const key of ['infraredVision','thermalImaging','imageProcessing','partiallyHiddenObjectIdentification','lightIntensificationInTotalDarkness','seesThroughFog','seesThroughSmoke','seesThroughThickFoliage'])assert.equal(basic[key],false);
});
test('Cameras retain media requirements without professional bonuses or invented media allowances',()=>{
 const mono=cap('camera-still-mono-5');assert.equal(mono.capture,'still');assert.equal(mono.imageType,'monochrome');assert.equal(mono.developmentRequired,true);
 assert.deepEqual(mono.consumables,{processingRequired:true,costPerBatch:1,imagesPerBatch:1,replenishmentIncluded:false});
 const colour=cap('camera-still-colour-6');assert.equal(colour.instantPhoto,true);assert.equal(colour.imageType,'colour');assert.deepEqual(colour.consumables,{processingRequired:true,costPerBatch:1,imagesPerBatch:10,replenishmentIncluded:false});
 const digital=cap('camera-still-digital-7');assert.equal(digital.media,'digital');assert.equal(digital.capture,'still');assert.equal(digital.imageType,'colour');
 const still=cap('camera-still-holographic-9');assert.equal(still.capture,'still');assert.equal(still.imageQuality,'moderate-grade');
 const motion=cap('camera-motion-holographic-10');assert.equal(motion.capture,'motion');assert.equal(motion.fullMotion,true);
 for(const id of ['camera-still-digital-7','camera-still-holographic-9','camera-motion-holographic-10']){const c=cap(id);assert.equal(c.mediaCapacity,null);assert.equal(c.additionalMediaCost,null);assert.equal(c.consumables,undefined);}
 for(const id of rows.filter(r=>r[0].startsWith('camera-')).map(r=>r[0])){const c=cap(id);assert.equal(c.professionalGrade,false);assert.equal(c.professionalArtDMGranted,false);assert.equal(c.recipientSkillGranted,false);}
 for(const id of ['camera-motion-still-8','camera-professional-8','camera-still-mono-4','camera-motion-5','cutting-torch-5'])assert.ok(!CSC_MASS_DEVICES.some(r=>r.id==='csc-'+id));
});
test('Survival and cutting equipment retain consumable, reserve and material limits',()=>{
 const fire=cap('fire-extinguisher-5');assert.equal(fire.singleUse,true);assert.equal(fire.replacementIncluded,false);assert.equal(fire.recipientProtectionGranted,false);
 assert.deepEqual(fire.flameVictimExtinguishing,{requiresActiveUse:true,condition:'Extinguishing a victim subjected to a flame attack',firstRoundDamageMultiplier:.5,subsequentRoundDamageMultiplier:0,permanentFireProtection:false});
 const rope=cap('infinite-rope-16');assert.deepEqual(rope.rope,{totalCapacityMetres:26,reusableLengthMetres:25,minimumColonyReserveMetres:1,loadKg:750,reclamationRequiresReserve:true,reclamationRequiresReloadingUsedRope:true,colonyReadout:true,unlimitedProduction:false});assert.equal(rope.recipientLiftingCapacityGranted,false);
 const torch=cap('cutting-torch-10');assert.equal(torch.materialTLExclusiveMaximum,14);assert.equal(torch.cutsBondedSuperdenseTL14OrHigher,false);assert.equal(torch.fuel,'gas canister');assert.equal(torch.automaticTaskSuccess,false);assert.deepEqual(torch.supplies,{required:true,continuousDuration:null,replenishmentCost:null,replenishmentIncluded:false});
});
test('Camera and survival implants enforce source TL, count, interface and override boundaries',()=>{
 for(const [id,tl] of rows.slice(0,10).filter(r=>r[1]>5))assert.ok(has(run(id,{},[],tl-1),'AUGMENT_TL'));
 assert.ok(has(run('camera-still-mono-5',{quantity:3},[{id:'other',optionId:option('fire-extinguisher-5'),parameters:{}}]),'MISC_IMPLANT_COUNT'));
 assert.equal(run('camera-still-colour-6',{quantity:3}).totals.cost,30900);
 assert.ok(has(run('cutting-torch-10',{interfaceMode:'neural'}),'MISC_IMPLANT_NEURAL_LINK'));
 const linked=run('cutting-torch-10',{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);assert.equal(linked.status,'verified');assert.equal(linked.totals.augmentations[0].interfaceCost,0);assert.equal(linked.totals.augmentations[0].structureCost,15000);
 assert.equal(run('infinite-rope-16',{ruggedised:'yes'},[],16).totals.cost,16250);
 for(const p of [{professionalGrade:true},{mediaCapacity:999},{cost:0},{massKg:0}])assert.throws(()=>run('camera-still-digital-7',p));
 for(const p of [{totalCapacityMetres:999},{loadKg:9999}])assert.throws(()=>run('infinite-rope-16',p,[],16));
 assert.ok(getAugmentationCatalogue().some(r=>r.id==='misc-mass-binoculars-8'));
});
test('New camera and survival nested effects remain detached',()=>{
 cap('camera-still-mono-5').consumables.costPerBatch=0;assert.equal(cap('camera-still-mono-5').consumables.costPerBatch,1);assert.equal(cap('camera-still-colour-6').consumables.imagesPerBatch,10);
 cap('infinite-rope-16').rope.minimumColonyReserveMetres=0;assert.equal(cap('infinite-rope-16').rope.minimumColonyReserveMetres,1);
 cap('fire-extinguisher-5').flameVictimExtinguishing.permanentFireProtection=true;assert.equal(cap('fire-extinguisher-5').flameVictimExtinguishing.permanentFireProtection,false);
 getAugmentationCatalogue().find(r=>r.id===option('cutting-torch-10')).device.effects.supplies.replenishmentIncluded=true;assert.equal(cap('cutting-torch-10').supplies.replenishmentIncluded,false);
});
