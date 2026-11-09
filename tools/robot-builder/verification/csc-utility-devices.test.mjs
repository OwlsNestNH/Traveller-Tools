import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_UTILITY_DEVICES} from '../engine/csc-utility-devices.mjs';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {getAugmentationCatalogue} from '../engine/augmentations.mjs';

// Source independently inspected in text and rendered pages of the revised
// copyright-2026 CSC Update 2023.
const rows=[
 ['flashtray-8',8,.5,80,'82-83'],
 ['sonic-sweat-and-stain-remover-13',13,1,125,'86'],
 ['sphere-of-solace-10',10,1,500,'86'],
 ['gas-oil-lamp-2',2,1,10,'106']
];
const option=id=>'misc-mass-csc-'+id;
const run=(id,parameters={},extra=[],tl=14)=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'device',optionId:option(id),parameters},...extra]}}));
const cap=id=>run(id).totals.augmentations[0].capabilities[0];
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);

for(const [id,tl,mass,cost,pages] of rows){
 test('CSC utility source '+id+' keeps printed values',()=>{
  const row=CSC_UTILITY_DEVICES.find(r=>r.id==='csc-'+id);
  assert.ok(row);assert.equal(row.tl,tl);assert.equal(row.massKg,mass);assert.equal(row.cost,cost);
  assert.match(row.label,/\(CSC\)$/);
  assert.deepEqual(row.source,{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
  assert.equal(row.effects.recipientSkillGranted,false);assert.equal(row.effects.processing,undefined);
 });
 test('CSC utility implant '+id+' uses existing mass admission and interface accounting',()=>{
  const row=getAugmentationCatalogue().find(r=>r.id===option(id));assert.ok(row,'Utility row integrated');
  assert.equal(row.tl,tl);assert.equal(row.source.pages,'92');assert.equal(row.device.massKg,mass);
  const r=run(id),part=r.totals.augmentations[0];
  assert.equal(r.status,'verified');assert.equal(part.structureCost,3*cost);assert.equal(part.interfaceCost,10000);assert.equal(r.totals.cost,3*cost+10000);
  assert.equal(part.miscDevice.massKg,mass);assert.equal(part.miscDevice.slots,null);assert.equal(part.miscDevice.fitBasis,'mass-at-most-2kg');assert.equal(part.miscDevice.source.pages,pages);
  assert.equal(part.capabilities[0].scope,'augment-only');assert.equal(part.capabilities[0].recipientSkillGranted,false);assert.equal(part.capabilities[0].recipientProtectionGranted,false);assert.deepEqual(r.totals.skills,[]);
 });
}

test('Utility subset is bounded and contains no guessed hardware upgrades',()=>{
 assert.deepEqual(CSC_UTILITY_DEVICES.map(r=>r.id),rows.map(r=>'csc-'+r[0]));
 assert.ok(CSC_UTILITY_DEVICES.every(r=>Number.isFinite(r.massKg)&&r.massKg>0&&r.massKg<=2));
 const cat=getAugmentationCatalogue();assert.equal(new Set(cat.map(r=>r.id)).size,cat.length);
 for(const [id,tl] of rows){
  assert.equal(getAugmentationCatalogue({techLevel:18}).find(r=>r.id===option(id)).tl,tl);
  for(const p of [{cost:0},{massKg:0},{hardwareTL:18},{radiusMetres:99},{powerDuration:999},{decorativeUpgrade:'gold'}])assert.throws(()=>run(id,p));
 }
});

test('Flashtray stays at minimum base price with small flammable-item scope',()=>{
 const c=cap('flashtray-8');assert.equal(c.priceBasis,'printed-minimum');assert.equal(c.decorativeUpgradesIncluded,false);
 assert.deepEqual(c.incineration,{requiresItemPlacedInside:true,smallItemsOnly:true,flammableItemsOnly:true,duration:'seconds',exactDurationSeconds:null,builtInSmokeAndOdourFans:true});
 assert.equal(c.weaponDamage,null);assert.equal(c.powerDuration,null);assert.equal(c.automaticTaskSuccess,false);
 assert.match(getAugmentationCatalogue().find(r=>r.id===option('flashtray-8')).label,/base model/);
});

test('Sonic cleaning preserves action and target limits, not repair or decontamination',()=>{
 const c=cap('sonic-sweat-and-stain-remover-13');
 assert.deepEqual(c.cleaning,{targets:['clothes','armour'],removes:['stains','odours'],requiresSwipingOverTarget:true,action:'Significant Action'});
 assert.equal(c.decontaminationGranted,false);assert.equal(c.armourRepairGranted,false);assert.equal(c.automaticTaskSuccess,false);
});

test('Sphere is adjustable and penetrable, not absolute silence or a stealth bonus',()=>{
 const c=cap('sphere-of-solace-10');
 assert.deepEqual(c.soundCancellation,{requiresActivation:true,adjustableRadius:true,maximumRadiusMetres:5,loudestSoundsCanPenetrate:true,highFidelityMusicContest:{higherHardwareTLWins:true,hardwareTL:10,tieOutcome:null}});
 assert.equal(c.absoluteSilence,false);assert.equal(c.stealthDM,null);assert.equal(c.sonicProtectionGranted,false);
 const later=run('sphere-of-solace-10',{},[],18).totals.augmentations[0].capabilities[0];assert.equal(later.soundCancellation.highFidelityMusicContest.hardwareTL,10);
});

test('Gas/oil lamp preserves finite separate fuel and the spillage hazard',()=>{
 const c=cap('gas-oil-lamp-2');
 assert.deepEqual(c.illumination,{requiresLitAndFuelled:true,radiusMetres:5,brightness:'daylight-equivalent'});
 assert.deepEqual(c.fuel,{types:['gas','oil'],litresPerFill:.5,approximateHoursPerFill:6,refillCost:1,refillsIncluded:false,initialFuelIncluded:null,spillageFireHazard:true});
 assert.equal(c.unlimitedPower,false);assert.equal(run('gas-oil-lamp-2').totals.cost,10030);
});

test('Utility implants enforce source TL, three-device limit and interface prerequisites',()=>{
 for(const [id,tl] of rows)if(tl>5)assert.ok(has(run(id,{},[],tl-1),'AUGMENT_TL'));
 const extras=rows.slice(1).map(([id],i)=>({id:'extra-'+i,optionId:option(id),parameters:{}}));
 assert.ok(has(run('flashtray-8',{},extras),'MISC_IMPLANT_COUNT'));
 assert.equal(run('flashtray-8',{quantity:3}).totals.cost,30720);
 assert.ok(has(run('gas-oil-lamp-2',{quantity:4}),'MISC_IMPLANT_COUNT'));
 assert.ok(has(run('sphere-of-solace-10',{interfaceMode:'neural'}),'MISC_IMPLANT_NEURAL_LINK'));
 const linked=run('sphere-of-solace-10',{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);
 assert.equal(linked.status,'verified');assert.equal(linked.totals.augmentations[0].interfaceCost,0);assert.equal(linked.totals.augmentations[0].structureCost,1500);
 assert.equal(run('flashtray-8',{ruggedised:'yes'}).totals.cost,12800);
});

test('Returned utility capabilities and metadata do not mutate source or future evaluations',()=>{
 cap('sphere-of-solace-10').soundCancellation.highFidelityMusicContest.hardwareTL=99;
 cap('sonic-sweat-and-stain-remover-13').cleaning.targets.push('anything');
 cap('gas-oil-lamp-2').fuel.refillCost=0;
 assert.equal(cap('sphere-of-solace-10').soundCancellation.highFidelityMusicContest.hardwareTL,10);
 assert.deepEqual(cap('sonic-sweat-and-stain-remover-13').cleaning.targets,['clothes','armour']);assert.equal(cap('gas-oil-lamp-2').fuel.refillCost,1);
 const row=getAugmentationCatalogue().find(r=>r.id===option('flashtray-8'));row.device.source.pages='bad';row.device.cost=0;row.device.effects.incineration.smallItemsOnly=false;
 assert.equal(run('flashtray-8').totals.cost,10240);assert.equal(cap('flashtray-8').incineration.smallItemsOnly,true);assert.equal(run('flashtray-8').totals.augmentations[0].miscDevice.source.pages,'82-83');
});
