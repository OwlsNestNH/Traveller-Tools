import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {getAugmentationCatalogue} from '../engine/augmentations.mjs';
import {CSC_COMPACT_TOOLS} from '../engine/csc-compact-tools.mjs';

// Independent values transcribed from visually inspected printed pp121,129-130.
const rows=[['thrust-pistol-7',7,1,1000,'121'],['return-mirror-4',4,.5,500,'129'],['spade-shovel-1',1,1,5,'129'],['tool-laser-12',12,.5,500,'130']];
const option=id=>'misc-mass-csc-'+id;
const design=(id,parameters={},extra=[],tl=14)=>updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'device',optionId:option(id),parameters},...extra]}});
const run=(...args)=>evaluateDesign(design(...args));
const cap=id=>run(id).totals.augmentations[0].capabilities[0];
for(const [id,tl,mass,cost,pages] of rows){
 test('CSC compact tool '+id+' preserves source and implant accounting',()=>{
  const row=getAugmentationCatalogue().find(r=>r.id===option(id)),result=run(id),part=result.totals.augmentations[0];
  assert.equal(row.tl,tl);assert.equal(row.device.massKg,mass);assert.equal(row.device.cost,cost);
  assert.deepEqual(row.device.source,{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
  assert.equal(result.status,'verified');assert.equal(part.structureCost,cost*3);assert.equal(part.interfaceCost,10000);assert.equal(result.totals.cost,10000+cost*3);
  assert.equal(part.capabilities[0].scope,'augment-only');assert.equal(part.capabilities[0].recipientSkillGranted,false);assert.equal(part.capabilities[0].recipientProtectionGranted,false);assert.deepEqual(result.totals.skills,[]);
  const triple=run(id,{quantity:3});assert.equal(triple.status,'verified');assert.equal(triple.totals.cost,3*(10000+3*cost));
  assert.ok(run(id,{quantity:4}).diagnostics.some(d=>d.code==='MISC_IMPLANT_COUNT'));
  const biological=updateDesign(createDesign({kind:'biological',techLevel:14}),{special:{genomeLocomotion:'confirmed'}});
  const before=evaluateDesign(biological),after=evaluateDesign(updateDesign(biological,{special:{augmentations:[{id:'device',optionId:option(id),parameters:{}}]}}));
  assert.equal(after.status,'verified');assert.equal(after.totals.cost-before.totals.cost,10000+cost*3);assert.equal(after.ledger.reduce((n,e)=>n+(e.cost??0),0),after.totals.cost);
 });
}
test('compact tool list excludes dash-mass improved laser, pocket magnet and oversized toolkits',()=>{
 assert.deepEqual(CSC_COMPACT_TOOLS.map(r=>r.id).sort(),rows.map(r=>'csc-'+r[0]).sort());
 assert.ok(CSC_COMPACT_TOOLS.every(r=>r.massKg>0&&r.massKg<=2));
 assert.ok(!getAugmentationCatalogue().some(r=>['misc-mass-csc-tool-laser-13','misc-mass-csc-pocket-magnet-3'].includes(r.id)));
});
test('thrust pistol reserves alternative operating budgets for an equipped person, not arbitrary chassis',()=>{
 const c=cap('thrust-pistol-7');assert.equal(c.operation.zeroGravityRequired,true);assert.equal(c.operation.vacuumRequired,true);
 assert.equal(c.operation.moderateManoeuvringMinutes,60);assert.equal(c.operation.continuousThrustMinutes,3);assert.equal(c.operation.continuousAccelerationG,.1);assert.equal(c.operation.alternativeUsageBudgets,true);
 assert.equal(c.operation.loadScope,'One person with vacc suit and equipment');assert.equal(c.generalRobotAccelerationGranted,false);assert.equal(c.robotChassisMassRatingKg,null);assert.equal(c.refillIncluded,false);
});
test('tool laser shares finite power with conditional improvised weapon use',()=>{
 const c=cap('tool-laser-12');assert.equal(c.power.continuousUseMinutes,20);assert.equal(c.power.shotConsumptionMinutes,1);assert.equal(c.power.sharedToolAndWeaponBudget,true);
 assert.deepEqual(c.improvisedWeapon,{attackDM:-2,effectiveRangeMetres:5,fullOutputDamage:'1D',automaticWeaponMount:false,recipientSkillGranted:false});
 assert.equal(c.largerWorkRequiresSeparateEquipment,true);assert.equal(c.unlimitedPower,false);assert.equal(c.power.rechargeTime,null);
 assert.ok(run('tool-laser-12',{},[],11).diagnostics.some(d=>d.code==='AUGMENT_TL'));
});
test('survey mirror and digging tool do not invent navigation bonuses or work rates',()=>{
 const mirror=cap('return-mirror-4');assert.equal(mirror.returnArcDegrees,15);assert.equal(mirror.foldingTripodIncluded,true);assert.equal(mirror.laserRangefinderIncluded,false);assert.equal(mirror.automaticNavigationDM,false);
 const spade=cap('spade-shovel-1');assert.equal(spade.diggingTool,true);assert.equal(spade.powered,false);assert.equal(spade.diggingRate,null);assert.equal(spade.automaticTaskSuccess,false);
});
test('new compact tools use shared device limit, interfaces and detached results',()=>{
 assert.ok(run('spade-shovel-1',{quantity:2},[{id:'other',optionId:option('return-mirror-4'),parameters:{quantity:2}}]).diagnostics.some(d=>d.code==='MISC_IMPLANT_COUNT'));
 const linked=run('tool-laser-12',{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);assert.equal(linked.status,'verified');assert.equal(linked.totals.augmentations[0].interfaceCost,0);
 const out=run('tool-laser-12');out.totals.augmentations[0].capabilities[0].power.continuousUseMinutes=999;
 const catalogue=getAugmentationCatalogue();catalogue.find(r=>r.id===option('tool-laser-12')).device.effects.improvisedWeapon.attackDM=99;
 assert.equal(cap('tool-laser-12').power.continuousUseMinutes,20);assert.equal(cap('tool-laser-12').improvisedWeapon.attackDM,-2);
 assert.throws(()=>run('tool-laser-12',{massKg:0}));
});
