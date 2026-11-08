import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {getAugmentationCatalogue} from '../engine/augmentations.mjs';
import {HANDBOOK_MASS_DEVICES} from '../engine/handbook-mass-devices.mjs';

// Independent audit of full PDF extracted text: RH 2022 pp92,119,122 (p45 task limits).
const rows=[['drone-console-basic',7,2,2500,-2],['drone-console-improved',8,2,1000,0],['drone-console-enhanced',10,.5,1000,0],['drone-console-advanced',11,.5,5000,1],['swarm-console-advanced',14,2,200000,null]];
const option=id=>'misc-mass-handbook-'+id;
const record=(id,parameters={})=>({id:'device',optionId:option(id),parameters});
const run=(id,parameters={},extra=[],tl=14)=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[record(id,parameters),...extra]}}));
const cap=id=>run(id).totals.augmentations[0].capabilities[0];
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
for(const [id,tl,mass,cost,dm] of rows){
 test('Handbook fixed device source and p92 accounting: '+id,()=>{
  const row=getAugmentationCatalogue().find(r=>r.id===option(id)),r=run(id),p=r.totals.augmentations[0];
  assert.equal(row.tl,tl);assert.equal(row.device.massKg,mass);assert.equal(row.device.cost,cost);
  assert.deepEqual(row.device.source,{book:'Robot Handbook',edition:'Mongoose 2022',pages:dm===null?'45,79,122':'119'});
  assert.equal(row.source.pages,'92');assert.equal(r.status,'verified');assert.equal(p.structureCost,3*cost);assert.equal(p.interfaceCost,10000);assert.equal(r.totals.cost,3*cost+10000);
  assert.equal(p.miscDevice.slots,null);assert.equal(p.miscDevice.massKg,mass);assert.equal(p.miscDevice.fitBasis,'mass-at-most-2kg');assert.equal(p.softwareCost,0);assert.equal(p.generalComputer,undefined);
  assert.equal(p.capabilities[0].scope,'augment-only');assert.equal(p.capabilities[0].recipientSkillGranted,false);assert.equal(p.capabilities[0].attachedTargetVerified,false);assert.equal(p.capabilities[0].operationalLinkVerified,false);assert.deepEqual(r.totals.skills,[]);assert.equal(r.coverage.complete,false);
  assert.ok(has(run(id,{},[],tl-1),'AUGMENT_TL'));
  assert.equal(run(id,{quantity:3}).totals.cost,(3*cost+10000)*3);assert.ok(has(run(id,{quantity:4}),'MISC_IMPLANT_COUNT'));
  assert.equal(run(id,{ruggedised:'yes'}).totals.cost,(3*cost+10000)*1.25);
  assert.ok(has(run(id,{interfaceMode:'neural'}),'MISC_IMPLANT_NEURAL_LINK'));
  const linked=run(id,{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);assert.equal(linked.status,'verified');assert.equal(linked.totals.augmentations[0].interfaceCost,0);
  for(const parameters of [{cost:0},{massKg:0},{controlDM:20},{processing:99},{maximumDrones:999}])assert.throws(()=>run(id,parameters));
 });
 test('Biological body adds the device once after body pricing: '+id,()=>{
  const d=updateDesign(createDesign({kind:'biological',techLevel:14}),{special:{genomeLocomotion:'confirmed'}}),before=evaluateDesign(d),after=evaluateDesign(updateDesign(d,{special:{augmentations:[record(id)]}}));
  assert.equal(after.status,'verified');assert.equal(after.totals.cost-before.totals.cost,3*cost+10000);assert.equal(after.ledger.reduce((n,e)=>n+(e.cost??0),0),after.totals.cost);
 });
}
test('Bounded Handbook subset excludes heavy consoles and preserves source identities',()=>{
 assert.deepEqual(HANDBOOK_MASS_DEVICES.map(r=>r.id),rows.map(r=>'handbook-'+r[0]));
 assert.ok(HANDBOOK_MASS_DEVICES.every(r=>r.massKg<=2&&r.effects.processing===undefined));
 const c=getAugmentationCatalogue();assert.equal(new Set(c.map(r=>r.id)).size,c.length);assert.ok(c.some(r=>r.id==='misc-mass-csc-radio-transceiver-7'));assert.ok(c.some(r=>r.id==='misc-mass-computer-terminal-7'));
});
test('Drone controls preserve range, skill, distance and conditional sensory progression',()=>{
 for(const [id,tl,,,dm] of rows.filter(r=>r[4]!==null)){
  const c=cap(id);assert.equal(c.controlDM,dm);assert.equal(c.maximumDrones,1);assert.equal(c.transceiverRangeKm,50);assert.equal(c.externalTransceiverInterface,true);assert.equal(c.externalTransceiverIncluded,false);assert.equal(c.requiredOperatorSkill,'Electronics (remote ops)');assert.deepEqual(c.distanceControlPenalty,{perKm:5000,dm:-1});
  assert.deepEqual(c.sensoryChannels,{video:true,audio:tl>=8,olfactory:tl>=11,requiresCorrespondingDroneSensors:true});assert.deepEqual(c.droneVoder,{usable:tl>=8,requiresTargetVoder:true});
 }
});
test('Swarm console retains bundled expert control and mode-specific limits',()=>{
 const c=cap('swarm-console-advanced');assert.equal(c.fixedPurposeComputer,true);assert.equal(c.bundledExpertSystem,true);assert.equal(c.bundledSwarmControlSoftware,true);assert.equal(c.verbalCommands,true);
 assert.equal(c.maximumTasks,4);assert.equal(c.maximumSkill,3);assert.equal(c.maximumTaskTarget,14);assert.equal(c.taskComplexityLimitedByController,true);assert.equal(c.relatedTasksRequired,true);assert.equal(c.swarmRangeMetres,50);assert.equal(c.targetWirelessDataLinksRequired,true);assert.equal(c.targetControlComponentsRequired,true);
 assert.deepEqual(c.simultaneousTasks,{complexityReductionLevels:1,dmPerAdditionalTask:-1});assert.deepEqual(c.droneMode,{maximumDrones:8,interfaceGrade:'improved',controlDM:0,unskilledEffectiveRemoteOps:0,skilledOperatorUsesFullSkill:true,rangeKm:50,extendedDistanceModifier:null,multipleDroneModifier:null,modifierScope:'Additional extended-distance and simultaneous-drone modifiers are not specified by pp79/122; referee resolution remains separate'});assert.deepEqual(c.externalTransceiver,{multiChannelRequired:true,standardEquivalentRangePriceMultiplier:10});
 const row=getAugmentationCatalogue().find(r=>r.id===option('swarm-console-advanced'));assert.ok(!row.parameterControls.some(c=>['computerComms','softwarePackages','processing'].includes(c.field)));
});
test('Returned nested catalogue and evaluation records are detached',()=>{
 const c=cap('drone-console-basic');c.sensoryChannels.audio=true;c.distanceControlPenalty.dm=99;assert.equal(cap('drone-console-basic').sensoryChannels.audio,false);assert.equal(cap('drone-console-basic').distanceControlPenalty.dm,-1);
 const s=cap('swarm-console-advanced');s.droneMode.maximumDrones=999;s.externalTransceiver.standardEquivalentRangePriceMultiplier=0;assert.equal(cap('swarm-console-advanced').droneMode.maximumDrones,8);assert.equal(cap('swarm-console-advanced').externalTransceiver.standardEquivalentRangePriceMultiplier,10);
 const row=getAugmentationCatalogue().find(r=>r.id===option('swarm-console-advanced'));row.device.effects.simultaneousTasks.dmPerAdditionalTask=0;row.device.cost=0;row.device.source.pages='bad';const r=run('swarm-console-advanced');assert.equal(r.totals.cost,610000);assert.equal(r.totals.augmentations[0].miscDevice.source.pages,'45,79,122');assert.equal(cap('swarm-console-advanced').simultaneousTasks.dmPerAdditionalTask,-1);
});
test('Shared count, low-TL dedicated interfaces and master substitution retain p92 rules',()=>{
 assert.ok(has(run('drone-console-basic',{interfaceTier:'basic'},[],7),'LIMB_INTERFACE_TL'));assert.equal(run('drone-console-basic',{interfaceTier:'basic'},[],8).totals.cost,27500);
 assert.ok(has(run('drone-console-basic',{quantity:3},[{id:'other',optionId:'misc-visual-spectrum',parameters:{}}]),'MISC_IMPLANT_COUNT'));
 const r=run('drone-console-basic',{},[{id:'link',optionId:'neural-link-basic',parameters:{}},{id:'master',optionId:'biacs-master',parameters:{masterDexterity:10}}]);assert.equal(r.status,'verified');assert.equal(r.totals.augmentations[0].interfaceCost,0);
});
