import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,applySelection,evaluateDesign,validateDesign,getCatalogue,importDesign,exportDesign,characteristicDM,manipulatorSlots} from '../engine/index.mjs';
const evaluate=patch=>evaluateDesign(updateDesign(createDesign(),patch));
const error=(r,code)=>assert.ok(r.diagnostics.some(x=>x.code===code),JSON.stringify(r.diagnostics));
const verified=r=>{assert.equal(r.status,'verified',JSON.stringify(r.diagnostics));return r.totals;};
const arm=(id,kind,size,strengthIncrease=0,dexterityIncrease=0)=>({id,kind,size,strengthIncrease,dexterityIncrease});
test('six stages, typed values, explicit incomplete scope and catalogue isolation',()=>{
 const a=getCatalogue();assert.equal(a.stages.length,6);assert.equal(a.coverage.complete,false);assert.equal(a.techLevels[0].id,7);
 a.kinds[0].label='changed';assert.notEqual(getCatalogue().kinds[0].label,'changed');
 assert.equal(a.stages.find(x=>x.id==='physical').controls.find(x=>x.field==='vehicleSpeed').choices[0].id,false);
});
test('ordinary baseline uses original chassis base, technology endurance and book brain',()=>{
 const t=verified(evaluateDesign(createDesign()));assert.equal(t.cost,12000);assert.equal(t.slots.base,16);assert.equal(t.hits,20);assert.equal(t.armour,4);assert.equal(t.endurance,108);assert.equal(t.manipulators[0].strength,9);assert.equal(t.manipulators[0].dexterity,7);
});
test('immutable typed API round trip preserves structurally valid but physically invalid work',()=>{
 const d=createDesign(),snapshot=exportDesign(d),changed=applySelection(d,{stage:'physical',field:'armourAdded',value:60});assert.equal(exportDesign(d),snapshot);
 const r=importDesign(exportDesign(changed));assert.deepEqual(r,changed);assert.equal(evaluateDesign(r).status,'invalid');
 assert.throws(()=>applySelection(d,{stage:'physical',field:'armourAdded',value:'1'}));assert.throws(()=>updateDesign(d,{typo:1}));
});
test('schema rejects unknown fields, missing fields, duplicate options, unsafe JSON and wrong versions',()=>{
 for(const input of [null,[],{...createDesign(),schemaVersion:2},{...createDesign(),techLevel:NaN},{...createDesign(),techLevel:Infinity}])assert.equal(validateDesign(input).valid,false);
 const missing=createDesign();delete missing.selections.brain;assert.equal(validateDesign(missing).valid,false);
 assert.throws(()=>importDesign('{"__proto__":{"x":1}}'));assert.throws(()=>updateDesign(createDesign(),{selections:{skills:{packages:['admin-0','admin-0']}}}));
 assert.equal(evaluateDesign({bad:true}).totals,null);assert.throws(()=>updateDesign(createDesign(),{name:' '}));
});
test('armour surface cap and no freed slot for armour removal',()=>{
 const t=verified(evaluate({techLevel:14,selections:{locomotion:{primary:'grav'},physical:{armourAdded:6}}}));
 assert.equal(t.armour,10);assert.equal(t.slots.used,2);assert.equal(t.cost,33000);
 const removed=verified(evaluate({selections:{physical:{armourRemoved:true}}}));assert.equal(removed.slots.used,0);assert.equal(removed.cost,11800);assert.equal(removed.armour,3);
 error(evaluate({selections:{physical:{armourRemoved:true,armourAdded:1}}}),'ARMOUR_CONFLICT');
 error(evaluate({selections:{physical:{armourRemoved:true,options:['hostile-environment']}}}),'EXPOSED_ENVIRONMENT');
});
test('efficiency and multiple packs apply once in sequence and round each pack slots',()=>{
 const t=verified(evaluate({selections:{physical:{efficiency:true,powerPacks:3}}}));assert.equal(t.endurance,864);assert.equal(t.slots.used,6);assert.equal(t.cost,16000);
});
test('resiliency uses base chassis, constrains positive slots and negative hits',()=>{
 const t=verified(evaluate({selections:{physical:{resiliency:-2}}}));assert.equal(t.hits,18);assert.equal(t.cost,11800);
 error(evaluate({selections:{physical:{resiliency:9}}}),'RESILIENCY_LIMIT');error(evaluate({selections:{physical:{resiliency:-11}}}),'RESILIENCY_LIMIT');
});
test('vehicle speed doubles base cost per added band and quarters endurance before halving',()=>{
 const t=verified(evaluate({selections:{physical:{vehicleSpeed:true,vehicleBands:2}}}));assert.equal(t.cost,20000);assert.equal(t.slots.used,8);assert.equal(t.endurance,108);assert.equal(t.vehicleEndurance,7);assert.equal(t.vehicleBand,'High');
 error(evaluate({selections:{physical:{vehicleBands:1}}}),'VEHICLE_SPEED_REQUIRED');error(evaluate({selections:{physical:{vehicleSpeed:true,tacticalSpeed:1}}}),'SPEED_MODE_CONFLICT');
});
test('tactical speed decrease conflicts with agility and cannot exceed twelve',()=>{
 error(evaluate({selections:{physical:{agility:1,tacticalSpeed:-1}}}),'SPEED_AGILITY_CONFLICT');error(evaluate({selections:{physical:{agility:4,tacticalSpeed:7}}}),'TACTICAL_SPEED_LIMIT');
 const t=verified(evaluate({selections:{chassis:{size:'size-4'},locomotion:{primary:'walker'},physical:{resiliency:-2,tacticalSpeed:1}}}));assert.equal(t.hits,10);assert.equal(t.endurance,97);assert.equal(t.cost,17800);
});
test('secondary cost uses rounded base slots and cannot outrank primary',()=>{
 const t=verified(evaluate({selections:{locomotion:{primary:'grav',secondary:'walker'}}}));assert.equal(t.cost,50000);assert.equal(t.slots.used,4);
 error(evaluate({selections:{locomotion:{primary:'wheels',secondary:'grav'}}}),'SECONDARY_MULTIPLIER');
 error(evaluate({selections:{locomotion:{primary:'thruster'}}}),'THRUSTER_PRIMARY');
});
test('manipulator resize subtracts individually rounded slot requirements and prices changed slots',()=>{
 assert.equal(manipulatorSlots(16,5,6),4);assert.equal(manipulatorSlots(16,5,5),2);
 const t=verified(evaluate({selections:{physical:{manipulators:[arm('base-1','base',6),arm('base-2','base','chassis')]}}}));assert.equal(t.slots.used,2);assert.equal(t.cost,12200);assert.equal(t.manipulators[0].strength,11);
 const small=verified(evaluate({selections:{chassis:{size:'size-2'},physical:{manipulators:[arm('base-1','base',1),arm('base-2','base','chassis')]}}}));assert.equal(small.slots.used,-1);assert.equal(small.cost,10320);
});
test('removed arms add slots but aggregate saving is capped at twenty percent',()=>{
 const t=verified(evaluate({selections:{physical:{manipulators:[]}}}));assert.equal(t.slots.used,-4);assert.equal(t.cost,11600);
 assert.equal(evaluate({selections:{physical:{manipulators:[arm('base-1','base',8)]}}}).status,'invalid');
 error(evaluate({selections:{physical:{manipulators:[arm('leg-a','leg','chassis')]}}}),'WALKER_LEG');
});
test('manipulator characteristic pricing is quadratic and software is not invented',()=>{
 const t=verified(evaluate({techLevel:14,selections:{physical:{manipulators:[arm('base-1','base',5,3),arm('base-2','base',5,3),arm('arm-3','additional',3,0,4)]}}}));
 assert.equal(t.cost,30900);assert.equal(t.slots.used,1);assert.equal(t.skills.length,0);assert.equal(t.manipulators[2].dexterity,12);
});
test('brain retrotech, miniaturisation, bandwidth and intellect are separate budgets',()=>{
 const t=verified(evaluate({techLevel:14,selections:{brain:{model:'very-advanced-tl12',bandwidthUpgrade:'bw-6',intellectUpgrade:1}}}));assert.equal(t.cost,187000);assert.equal(t.bandwidth.inherent,3);assert.equal(t.bandwidth.capacity,9);assert.equal(t.bandwidth.used,1);assert.equal(t.intelligence,10);
 const start=verified(evaluate({techLevel:14,selections:{brain:{model:'very-advanced-tl14',bandwidthUpgrade:'bw-6',intellectUpgrade:1}}}));assert.equal(start.cost,576000);assert.equal(start.intelligence,12);assert.equal(start.bandwidth.remaining,10);
});
test('single package still cannot exceed inherent bandwidth after upgrade',()=>{
 const r=evaluate({selections:{brain:{bandwidthUpgrade:'bw-4'},skills:{packages:['admin-3']}}});error(r,'INHERENT_BANDWIDTH');assert.equal(r.totals,null);
});
test('zero bandwidth overflow consumes bandwidth, not physical slots',()=>{
 const t=verified(evaluate({selections:{skills:{packages:['admin-0','advocate-0','broker-0']}}}));assert.equal(t.zeroBandwidth.overflow,1);assert.equal(t.bandwidth.used,1);assert.equal(t.slots.used,0);assert.equal(t.cost,12800);
});
test('skill TL, duplicate levels and speciality gaps are explicit',()=>{
 error(evaluate({selections:{skills:{packages:['leadership-0']}}}),'MIN_TL');error(evaluate({selections:{skills:{packages:['admin-0','admin-1']}}}),'DUPLICATE_SKILL');
 const r=evaluate({selections:{skills:{packages:['engineer-1']}}});assert.equal(r.status,'blocked');assert.equal(r.totals,null);error(r,'SPECIALITY_REQUIRED');
});
test('removed unused slots preserve per-base-slot option costs and enforce basic minimum',()=>{
 const t=verified(evaluate({selections:{physical:{options:['hostile-environment']},finalisation:{removedSlots:16}}}));assert.equal(t.slots.capacity,0);assert.equal(t.cost,15200);assert.equal(t.slots.base,16);
 error(evaluate({selections:{physical:{powerPacks:1},finalisation:{removedSlots:16}}}),'REMOVE_USED_SLOTS');
});
test('special robot modes never fall through ordinary calculations',()=>{
 for(const kind of getCatalogue().kinds.filter(k=>!k.implemented)){const r=evaluateDesign(createDesign({kind:kind.id}));assert.equal(r.status,'blocked');assert.equal(r.totals,null);}
});
test('characteristic fifteen and above use +3, including robot intellect',()=>{assert.equal(characteristicDM(15),3);assert.equal(characteristicDM(18),3);assert.equal(characteristicDM(0),-3);});
test('evaluation is deterministic and ledger cost matches calculated totals',()=>{
 const d=updateDesign(createDesign(),{selections:{physical:{manipulators:[],efficiency:true},finalisation:{removedSlots:10}}});const before=JSON.stringify(d),a=evaluateDesign(d),b=evaluateDesign(d);assert.deepEqual(a,b);assert.equal(JSON.stringify(d),before);assert.equal(a.ledger.reduce((n,x)=>n+x.cost,0),a.totals.cost);
});
test('default suite substitutes up to five zero-slot options without base item refunds',()=>{
 const t=verified(evaluate({selections:{physical:{defaultSuite:['visual-spectrum','voder','auditory','wireless','hostile-environment']}}}));assert.equal(t.cost,16800);assert.equal(t.zeroSlot.used,0);assert.equal(t.defaultSuite.length,5);
 const empty=verified(evaluate({selections:{physical:{defaultSuite:[]}}}));assert.equal(empty.cost,12000);
 assert.throws(()=>updateDesign(createDesign(),{selections:{physical:{defaultSuite:['visual-spectrum','voder','auditory','wireless','transceiver-improved','drone-interface']}}}));
});
test('default drone interface requires a transceiver and duplicate placement rejects',()=>{
 error(evaluate({selections:{physical:{defaultSuite:['drone-interface']}}}),'OPTION_DEPENDENCY');
 error(evaluate({selections:{physical:{defaultSuite:['hostile-environment'],options:['hostile-environment']}}}),'OPTION_EXCLUSIVE');
});
test('basic none supports a single standard package and remains bounded by base brain',()=>{
 const d=createDesign({techLevel:10});const b=applySelection(d,{stage:'brain',field:'model',value:'basic-tl10'});assert.equal(b.selections.skills.corePackage,'basic-none');
 const t=verified(evaluateDesign(updateDesign(b,{selections:{skills:{packages:['admin-1']}}})));assert.equal(t.bandwidth.used,1);assert.equal(t.skills[0].effectiveLevel,0);
 error(evaluateDesign(updateDesign(b,{selections:{skills:{packages:['admin-2']}}})),'BASIC_SKILL_LEVEL');
});
test('fixed basic service and primitive alert packages do not receive negative intelligence DMs',()=>{
 const b=applySelection(createDesign(),{stage:'brain',field:'model',value:'basic-tl10'});
 const r=evaluateDesign(updateDesign(b,{selections:{skills:{corePackage:'basic-service'}}}));const t=verified(r);assert.equal(t.bandwidth.used,1);assert.equal(t.skills.find(s=>s.id==='steward').effectiveLevel,0);
 const p=applySelection(createDesign(),{stage:'brain',field:'model',value:'primitive-tl8'});const pt=verified(evaluateDesign(p));assert.equal(pt.bandwidth.used,0);assert.equal(pt.skills[0].effectiveLevel,0);
});
test('brain package family mismatch and primitive cleaning equipment missing are errors',()=>{
 error(evaluate({selections:{skills:{corePackage:'basic-service'}}}),'CORE_PACKAGE_FAMILY');
 const p=applySelection(createDesign(),{stage:'brain',field:'model',value:'primitive-tl8'});error(evaluateDesign(updateDesign(p,{selections:{skills:{corePackage:'primitive-clean'}}})),'CLEANING_EQUIPMENT');
});
test('documented engineer specialities use separate packages and broad coverage consumes four',()=>{
 const d={techLevel:14,selections:{brain:{model:'very-advanced-tl14',bandwidthUpgrade:'bw-6',intellectUpgrade:1},skills:{packages:['engineer-all-1','electronics-all-1','mechanic-1']}}};
 const t=verified(evaluate(d));assert.equal(t.bandwidth.used,10);assert.equal(t.skills[0].effectiveLevel,3);assert.equal(t.cost,589000);
 error(evaluate({selections:{skills:{packages:['engineer-m-drive-1','engineer-m-drive-2']}}}),'DUPLICATE_SKILL');
 error(evaluate({selections:{skills:{packages:['engineer-all-1','engineer-m-drive-1']}}}),'DUPLICATE_SKILL');
});
test('Athletics equivalence requires software and records per-arm context',()=>{
 const no=verified(evaluate({selections:{physical:{manipulators:[arm('base-1','base',5,3),arm('base-2','base',5)]}}}));assert.equal(no.skillEquivalents.length,0);
 const yes=verified(evaluate({selections:{physical:{manipulators:[arm('base-1','base',5,3),arm('base-2','base',5)]},skills:{packages:['athletics-0']}}}));assert.equal(yes.skillEquivalents.find(s=>s.manipulatorId==='base-1'&&s.speciality==='strength').level,2);
});
test('custom final sale price does not change construction cost',()=>{
 const t=verified(evaluate({selections:{finalisation:{priceMode:'custom',customPrice:9500}}}));assert.equal(t.cost,9500);assert.equal(t.constructionCost,12000);
});
test('clone API switches schema and never calculates a robot body',()=>{
 const d=createDesign({kind:'clone'});assert.equal(d.techLevel,13);assert.equal(getCatalogue(d).stages[0].controls[0].target,'special');
 const changed=applySelection(d,{stage:'chassis',field:'baseSTR',value:7});assert.equal(changed.special.baseSTR,7);assert.equal(changed.selections.chassis.size,'size-5');
 const back=updateDesign(changed,{kind:'standard'});assert.deepEqual(back.special,{});
});
