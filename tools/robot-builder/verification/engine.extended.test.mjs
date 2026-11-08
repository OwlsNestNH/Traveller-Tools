import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,applySelection,evaluateDesign,getCatalogue,getCoverage,getExamples,createExample,importDesign,exportDesign} from '../engine/index.mjs';
const ev=patch=>evaluateDesign(updateDesign(createDesign(),patch));
const good=r=>{assert.equal(r.status,'verified',JSON.stringify(r.diagnostics));return r.totals;};
const has=(r,code)=>assert.ok(r.diagnostics.some(d=>d.code===code),JSON.stringify(r.diagnostics));
const custom=(id,skill,speciality,level)=>({id,skill,speciality,level});
test('all current equipment rows evaluate without NaN or uncaught exceptions',()=>{
 const rows=getCatalogue().stages.find(s=>s.id==='physical').controls.find(c=>c.field==='options').choices;assert.equal(rows.length,227);
 for(const row of rows){const r=ev({techLevel:18,selections:{chassis:{size:'size-8'},physical:{options:[row.id]}}});assert.ok(['verified','blocked','invalid'].includes(r.status));if(r.totals)assert.ok(Number.isFinite(r.totals.cost));}
});
test('allocated storage prices Slots, not installed copies',()=>{
 const t=good(ev({selections:{physical:{options:['refrigerated-storage-compartment'],optionParameters:{'refrigerated-storage-compartment':{quantity:2}}}}}));assert.equal(t.cost,12200);assert.equal(t.slots.used,2);
});
test('same-grade submersible fractions aggregate, unlike repeated power-unit fractions',()=>{
 const sub=good(ev({selections:{physical:{options:['submersible-environment-protection-improved','submersible-environment-protection-enhanced']}}}));assert.equal(sub.slots.used,1);
 const rtg=good(ev({selections:{physical:{options:['rtg-long-duration-improved'],optionParameters:{'rtg-long-duration-improved':{quantity:2}}}}}));assert.equal(rtg.slots.used,6);assert.equal(rtg.cost,1612000);
});
test('zero-slot capacity includes unused default placements',()=>{
 const full=good(ev({selections:{physical:{options:['injector-needle'],optionParameters:{'injector-needle':{quantity:20}}}}}));assert.equal(full.zeroSlot.overflow,3);
 const empty=good(ev({selections:{physical:{defaultSuite:[],options:['injector-needle'],optionParameters:{'injector-needle':{quantity:20}}}}}));assert.equal(empty.zeroSlot.allowance,22);assert.equal(empty.zeroSlot.overflow,0);
});
test('suite quantities are paid and counted, never silently ignored',()=>{
 const t=good(ev({selections:{physical:{defaultSuite:['injector-needle'],optionParameters:{'injector-needle':{suiteQuantity:5}}}}}));assert.equal(t.cost,12100);assert.equal(t.zeroSlot.allowance,17);
 has(ev({selections:{physical:{defaultSuite:['injector-needle'],optionParameters:{'injector-needle':{quantity:20}}}}}),'UNUSED_OPTION_QUANTITY');
 has(ev({selections:{physical:{defaultSuite:['injector-needle','auditory'],optionParameters:{'injector-needle':{suiteQuantity:5}}}}}),'DEFAULT_SUITE_CAPACITY');
});
test('option removal atomically removes only inapplicable context parameters',()=>{
 let d=updateDesign(createDesign(),{selections:{physical:{defaultSuite:['injector-needle'],options:['injector-needle'],optionParameters:{'injector-needle':{quantity:10,suiteQuantity:2}}}}});
 d=applySelection(d,{stage:'physical',field:'options',value:[]});assert.deepEqual(d.selections.physical.optionParameters,{'injector-needle':{suiteQuantity:2}});
 d=applySelection(d,{stage:'physical',field:'defaultSuite',value:[]});assert.deepEqual(d.selections.physical.optionParameters,{});
});
test('default drone interface can use an extra installed transceiver',()=>{
 good(ev({selections:{physical:{defaultSuite:['drone-interface'],options:['transceiver-improved']}}}));
});
test('no internal power permits explicit direct-cable operation and does not invent endurance',()=>{
 has(ev({selections:{physical:{options:['no-internal-power']}}}),'POWER_SOURCE_UNSPECIFIED');
 const t=good(ev({selections:{physical:{options:['no-internal-power'],powerMode:'direct-connection'}}}));assert.equal(t.endurance,null);assert.equal(t.powerState.external,true);assert.equal(t.slots.used,-2);
});
test('no internal power plus added packs keeps only pack endurance',()=>{
 for(const packs of [1,2,3]){const t=good(ev({selections:{physical:{options:['no-internal-power'],powerPacks:packs}}}));assert.equal(t.endurance,108*packs);}
});
test('single alternate source reduces STR and movement and rejects sole-source vehicle speed',()=>{
 const t=good(ev({selections:{physical:{options:['no-internal-power','solar-power-unit-advanced'],powerMode:'alternate-full'}}}));assert.equal(t.tacticalSpeed,2);assert.equal(t.agility,-2);assert.equal(t.manipulators[0].strength,4);assert.equal(t.manipulators[0].nominalStrength,9);assert.equal(t.endurance,null);
 has(ev({selections:{physical:{options:['no-internal-power','solar-power-unit-advanced'],powerMode:'alternate-full',vehicleSpeed:true}}}),'LOW_POWER_VEHICLE');
});
test('two full-capability power units permit original performance',()=>{
 const t=good(ev({selections:{physical:{options:['no-internal-power','solar-power-unit-advanced'],optionParameters:{'solar-power-unit-advanced':{quantity:2}},powerMode:'alternate-full',vehicleSpeed:true}}}));assert.equal(t.tacticalSpeed,5);assert.equal(t.manipulators[0].strength,9);assert.equal(t.powerState.limited,false);
});
test('short RTG conflict requires explicit basis and prices each interpretation',()=>{
 const base={selections:{physical:{options:['rtg-short-duration-basic']}}};has(ev(base),'OPTION_COST_BASIS');
 const prose=good(ev({selections:{physical:{...base.selections.physical,optionParameters:{'rtg-short-duration-basic':{costInterpretation:'baseSlots'}}}}}));assert.equal(prose.cost,812000);
 const table=good(ev({selections:{physical:{...base.selections.physical,optionParameters:{'rtg-short-duration-basic':{costInterpretation:'installedSlots'}}}}}));assert.equal(table.cost,162000);
});
test('core speciality catalogue includes Cybernetics and named combat/vehicle specialities',()=>{
 const choices=getCatalogue().stages.find(s=>s.id==='skills').controls.find(c=>c.field==='packages').choices;
 for(const id of ['science-cybernetics-1','gun-combat-energy-1','drive-track-1','flyer-grav-1','tactics-naval-1'])assert.ok(choices.some(c=>c.id===id&&c.implemented));
});
test('custom skill validation rejects unsupported categories and blank or duplicate identities',()=>{
 for(const pkg of [custom('x','medic','custom',1),custom('x','science',' ',1),custom('x','science','physics',4)])assert.throws(()=>updateDesign(createDesign(),{selections:{skills:{customPackages:[pkg]}}}));
 assert.throws(()=>updateDesign(createDesign(),{selections:{skills:{customPackages:[custom('x','science','a',1),custom('x','science','b',1)]}}}));
});
test('custom profession and language use normal TL, cost and bandwidth',()=>{
 const t=good(ev({selections:{skills:{customPackages:[custom('one','profession','robot curator',1),custom('two','language','An alien language',1)]}}}));assert.equal(t.cost,16000);assert.equal(t.bandwidth.used,2);assert.equal(t.skills.find(s=>s.id.startsWith('profession:')).grantsOtherSpecialitiesAtZero,false);
});
test('custom instrument is permitted; generic Art instrument still needs a name',()=>{
 good(ev({selections:{skills:{customPackages:[custom('harp','art-instrument','harp',1)]}}}));
 has(ev({selections:{skills:{packages:['art-instrument-1']}}}),'SPECIALITY_REQUIRED');
});
test('custom and listed duplicates cannot bypass skill duplication checks',()=>{
 has(ev({selections:{skills:{packages:['science-physics-1'],customPackages:[custom('one','science','Physics',1)]}}}),'DUPLICATE_SKILL');
});
test('broad science rules are explicit referee choices and per-package BW remains inherent',()=>{
 const t=good(ev({techLevel:14,selections:{brain:{model:'very-advanced-tl14',bandwidthUpgrade:'bw-8'},skills:{packages:['science-all-referee-eight-1']}}}));assert.equal(t.bandwidth.used,8);assert.equal(t.skills[0].level,1);
 const r=ev({selections:{brain:{bandwidthUpgrade:'bw-4'},skills:{packages:['science-all-referee-four-1']}}});good(r);has(r,'REFEREE_BROAD_SKILL');
});
test('Hunter/Killer bandwidth ambiguity is visible and weapon skill chosen explicitly',()=>{
 let d=applySelection(createDesign(),{stage:'brain',field:'model',value:'hunter-killer-tl10'});has(evaluateDesign(d),'HUNTER_BANDWIDTH_INTERPRETATION');
 d=updateDesign(d,{selections:{skills:{coreWeapon:'gun-combat-slug'.replace('combat-','combat:'),hunterBandwidth:'zero'}}});const zero=good(evaluateDesign(d));assert.equal(zero.bandwidth.used,0);
 const one=good(evaluateDesign(updateDesign(d,{selections:{skills:{hunterBandwidth:'one'}}})));assert.equal(one.bandwidth.used,1);
});
test('supported technology scope reaches published TL23 without claiming a universal cap',()=>{
 const c=getCatalogue();assert.equal(c.techLevels[0].id,5);assert.equal(c.techLevels.at(-1).id,23);assert.match(c.coverage.supportedTechLevels.note,/not a universal/);
 const t=good(ev({techLevel:19,selections:{brain:{model:'conscious-tl19'}}}));assert.equal(t.intelligence,18);assert.equal(t.bandwidth.inherent,50);assert.equal(t.cost,1002000);
 has(ev({techLevel:5}),'PRE_TL6_ARMOUR');
});
test('published Steward example preserves construction and discretionary sale prices',()=>{
 assert.ok(getExamples().some(e=>e.id==='steward-droid'));
 const d=createExample('steward-droid'),t=good(evaluateDesign(d));assert.equal(t.constructionCost,39800);assert.equal(t.cost,35000);assert.equal(t.slots.used,8);assert.equal(t.bandwidth.used,2);assert.equal(t.endurance,97);assert.equal(t.tacticalSpeed,6);assert.equal(t.hits,10);
 assert.deepEqual(importDesign(exportDesign(d)),d);
});
test('known invalid capacity has provisional totals; unresolved pricing never does',()=>{
 const over=ev({selections:{physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:100}}}}});assert.equal(over.status,'invalid');assert.equal(over.totals,null);assert.equal(over.previewTotals.provisional,true);
 const unknown=ev({selections:{physical:{options:['rtg-short-duration-basic']}}});assert.equal(unknown.status,'blocked');assert.equal(unknown.previewTotals,undefined);
});
test('coverage inventory is current and identifies exact blocked kinds',()=>{
 const c=getCoverage();assert.equal(c.complete,false);assert.equal(c.inventory.ordinaryEquipmentRows,227);assert.ok(c.inventory.implementedKinds.includes('clone'));assert.ok(!c.inventory.blockedKinds.includes('clone'));
});
