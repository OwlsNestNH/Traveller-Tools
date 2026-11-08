import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,importDesign,exportDesign} from '../engine/index.mjs';
import {METAMORPHIC_TIERS} from '../engine/high-technology.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
const make=(techLevel=17,tier='basic',patch={})=>updateDesign(createDesign({kind:'metamorphic',techLevel}),{special:{metamorphicTier:tier},...patch});
const evaluate=d=>evaluateDesign(d);
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const attach=(kind,role,child)=>updateDesign(createDesign({kind,techLevel:19}),{special:{designReferences:[{id:'morph',role,quantity:1,design:child}]}});
const text=d=>formatStatblock(projectReview(d,getCatalogue(d),evaluate(d)));

test('p104 tier facts are independent exact rows, frozen and API-detached',()=>{
 const expected=[['basic',17,50000,'1D minutes','Enhanced android'],['improved',18,100000,'1D rounds','Advanced android'],['advanced',19,200000,'1D seconds','Superior android']];
 assert.deepEqual(METAMORPHIC_TIERS.map(t=>[t.id,t.tl,t.pricePerSlot,t.morphTime,t.appearance]),expected);
 assert.throws(()=>METAMORPHIC_TIERS[0].pricePerSlot=1);assert.throws(()=>METAMORPHIC_TIERS[0].source.pages='1');
 const c=getCatalogue(make());c.highTechnology.metamorphic[0].pricePerSlot=1;c.highTechnology.metamorphic[0].source.pages='1';
 assert.equal(getCatalogue(make()).highTechnology.metamorphic[0].pricePerSlot,50000);assert.equal(getCatalogue(make()).highTechnology.metamorphic[0].source.pages,'104');
});
test('each tier uses exact Base Slots surcharge plus retained ordinary hardware, no android fee',()=>{
 for(const [tl,tier,fee,total,time,appearance] of [[17,'basic',800000,812000,'1D minutes','Enhanced android'],[18,'improved',1600000,1612000,'1D rounds','Advanced android'],[19,'advanced',3200000,3212000,'1D seconds','Superior android']]){
  const r=evaluate(make(tl,tier));assert.equal(r.status,'verified');assert.equal(r.provisional,true);assert.equal(r.totals.provisional,true);assert.equal(r.totals.cost,total);assert.equal(r.ledger.reduce((n,x)=>n+x.cost,0),total);
  assert.equal(r.metamorphic.bodyCost,fee);assert.equal(r.metamorphic.morphTime,time);assert.equal(r.metamorphic.appearance,appearance);assert.equal(r.metamorphic.reservedSlots,0);
  assert.equal(r.totals.slots.used,0);assert.equal(r.totals.slots.capacity,16);assert.equal(r.ledger.some(x=>x.id==='body-multiplier'||x.id==='body-tier'),false);
 }
});
test('every source tier rejects TL minus one, retains selected tier for correction',()=>{
 for(const [tl,tier]of [[17,'basic'],[18,'improved'],[19,'advanced']]){const d=make(tl-1,tier),r=evaluate(d);assert.equal(r.status,'invalid');assert.ok(has(r,'METAMORPHIC_TL'));assert.equal(r.totals,null);assert.equal(r.previewTotals.metamorphic.tier,tier);assert.equal(importDesign(exportDesign(d)).special.metamorphicTier,tier);assert.equal(evaluate(updateDesign(d,{techLevel:tl})).status,'verified');}
 const choices=getCatalogue(make(17,'advanced')).stages.find(s=>s.id==='chassis').controls.find(c=>c.field==='metamorphicTier').choices;
 assert.equal(choices.find(c=>c.id==='advanced').eligibility.available,false);assert.match(choices.find(c=>c.id==='advanced').eligibility.reason,/TL19/);
});
test('all assumptions are explicit and derived records cannot mutate future evaluations',()=>{
 const d=make(),r=evaluate(d),assumptions=r.metamorphic.assumptions;assert.equal(assumptions.length,6);assert.ok(assumptions.every(a=>a.provenance==='Application convention'));
 assert.equal(assumptions.find(a=>a.id==='body-reservation').value,'0 additional reserved Slots');assert.match(assumptions.find(a=>a.id==='current-form').value,/prices/);assert.match(assumptions.find(a=>a.id==='appearance-cost').value,/No android/);
 r.metamorphic.assumptions[0].value='forged';r.totals.metamorphic.bodyCost=0;r.metamorphic.fixedProperties.size=8;
 assert.equal(evaluate(d).metamorphic.bodyCost,800000);assert.equal(evaluate(d).metamorphic.fixedProperties.size,5);assert.notEqual(evaluate(d).metamorphic.assumptions[0].value,'forged');
});
test('final removed Slots and stationary capacity never change the original price basis',()=>{
 const d=updateDesign(make(),{selections:{finalisation:{removedSlots:16}}}),r=evaluate(d);assert.equal(r.status,'verified');assert.equal(r.totals.cost,810400);assert.equal(r.totals.slots.capacity,0);assert.equal(r.metamorphic.priceBasisSlots,16);assert.equal(r.metamorphic.bodyCost,800000);
 const stationary=evaluate(updateDesign(make(),{selections:{locomotion:{primary:'none'}}}));assert.equal(stationary.totals.slots.capacity,20);assert.equal(stationary.metamorphic.priceBasisSlots,16);assert.equal(stationary.metamorphic.bodyCost,800000);
 const small=evaluate(updateDesign(make(),{selections:{chassis:{size:'size-2'}}}));assert.equal(small.metamorphic.priceBasisSlots,2);assert.equal(small.totals.cost,110400);
});
test('current-form additional arms use ordinary exact Size/STR/DEX cost and capacity',()=>{
 const d=make();d.selections.physical.manipulators.push({id:'extra',kind:'additional',size:5,strengthIncrease:2,dexterityIncrease:1});const r=evaluate(d);
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,815500);assert.equal(r.totals.slots.used,2);assert.equal(r.ledger.find(x=>x.id==='extra').cost,3500);assert.equal(r.totals.manipulators[2].strength,11);assert.equal(r.totals.manipulators[2].dexterity,11);
 assert.equal(r.totals.weapons.length,0);assert.equal(r.totals.attacks,undefined);assert.ok(r.metamorphic.operatingScope.includes('Extra attacks not granted'));
 for(const [field,value,code]of [['size',8,'MANIPULATOR_SIZE'],['strengthIncrease',10,'MANIPULATOR_STR'],['dexterityIncrease',11,'MANIPULATOR_DEX']]){const invalid=structuredClone(d);invalid.selections.physical.manipulators[2][field]=value;assert.ok(has(evaluate(invalid),code),code);}
});
test('ordinary fit, brain, locomotion, armour and power constraints still apply',()=>{
 const crowded=updateDesign(make(),{selections:{physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:17}}}}});assert.ok(has(evaluate(crowded),'SLOTS_EXCEEDED'));assert.equal(importDesign(exportDesign(crowded)).selections.physical.optionParameters['storage-compartment'].quantity,17);
 assert.ok(has(evaluate(updateDesign(crowded,{selections:{finalisation:{removedSlots:1}}})),'REMOVE_USED_SLOTS'));
 assert.ok(has(evaluate(updateDesign(make(),{selections:{brain:{model:'none'}}})),'BRAIN_REQUIRED'));
 assert.ok(has(evaluate(updateDesign(make(),{selections:{locomotion:{primary:'thruster'}}})),'THRUSTER_PRIMARY'));
 assert.ok(has(evaluate(updateDesign(make(),{selections:{physical:{armourAdded:60}}})),'ARMOUR_MAX'));
 const solar=updateDesign(make(),{selections:{physical:{powerMode:'solar-coating-only'}}});assert.notEqual(evaluate(solar).status,'verified');
 assert.equal(evaluate(make()).totals.intelligence,8);assert.equal(evaluate(make()).totals.armour,4);assert.equal(evaluate(make()).totals.endurance,144);
 const primitive=updateDesign(make(),{selections:{brain:{model:'primitive-tl8'},skills:{corePackage:'primitive-alert'}}});assert.equal(evaluate(primitive).status,'verified');
});
test('schema accepts only the versioned fixed convention, never source or body-price overrides',()=>{
 for(const patch of [{metamorphicTier:'superior'},{metamorphicTier:18},{metamorphicConvention:'free-limbs'},{metamorphicConvention:0},{reservedSlots:0},{pricePerSlot:1},{bodyCost:0},{provisional:false}]){const d=make();Object.assign(d.special,patch);assert.throws(()=>importDesign(JSON.stringify(d)));}
 const missing=make();delete missing.special.metamorphicConvention;assert.equal(importDesign(JSON.stringify(missing)).special.metamorphicConvention,'provisional-base-slots-standard-v1');
 const d=make();assert.deepEqual(importDesign(exportDesign(d)),d);assert.match(exportDesign(d),/provisional-base-slots-standard-v1/);assert.equal(JSON.parse(exportDesign(d)).totals,undefined);
});
test('standard and existing body paths are isolated; legacy standard JSON remains unchanged',()=>{
 const d=createDesign({techLevel:17}),r=evaluate(d);assert.equal(r.totals.cost,12000);assert.equal(r.provisional,undefined);assert.equal(r.totals.metamorphic,undefined);assert.equal(d.special.metamorphicTier,undefined);assert.deepEqual(importDesign(exportDesign(d)),d);
 const android=evaluate(createDesign({kind:'android',techLevel:17}));assert.equal(android.provisional,undefined);assert.equal(android.totals?.metamorphic,undefined);assert.equal(android.ledger.some(x=>x.id==='metamorphic-body'),false);
 const restored=updateDesign(make(),{kind:'standard'});assert.equal(evaluate(restored).totals.cost,12000);assert.deepEqual(restored.special,{});
});
test('API JSON and review/statblock preserve provisional facts without source tables or fake errors',()=>{
 const api=createRobotApi({storage:null});api.importDesign(exportDesign(make()));const v=api.getView();assert.equal(v.evaluation.provisional,true);assert.equal(v.review.provisional,true);assert.match(v.review.status,/Provisional assumptions checked/);
 const output=api.getStatblock();for(const label of ['Metamorphic body (provisional)','0 additional reserved Slots','Standard Size / STR / DEX / Slots / prices','No android construction multiplier','1D minutes','Enhanced android','Application convention','Transient morph states not simulated','Size and locomotion fixed'])assert.ok(output.includes(label),label);
 assert.doesNotMatch(output,/unresolved errors|correct outstanding errors|1D rounds|1D seconds/);assert.deepEqual(importDesign(api.exportDesign()),make());
 assert.equal(v.evaluation.coverage.gaps.find(g=>g.id==='metamorphic-body').status,'provisional-supported');assert.ok(v.catalogue.coverage.inventory.implementedKinds.includes('metamorphic'));
});
test('whole-robot composites preserve provisional assumptions and account once, not as a host morph grant',()=>{
 const child=updateDesign(make(),{selections:{finalisation:{priceMode:'custom',customPrice:1}}}),d=attach('ship-brain','installed-robot',child),r=evaluate(d),c=r.composite.components[0];
 assert.equal(r.status,'verified');assert.equal(r.provisional,true);assert.equal(r.totals.provisional,true);assert.equal(r.totals.cost,1312000);assert.equal(r.ledger.reduce((n,x)=>n+x.cost,0),1312000);assert.equal(c.constructionUnitCost,812000);assert.equal(c.listedUnitCost,1);assert.equal(c.provisional,true);assert.equal(c.metamorphic.bodyCost,800000);assert.equal(r.totals.metamorphic,undefined);
 assert.match(text(d),/Body reservation assumption: 0 additional reserved Slots/);assert.match(text(d),/Provisional assumptions checked/);assert.deepEqual(importDesign(exportDesign(d)),d);c.metamorphic.assumptions[0].value='forged';assert.notEqual(evaluate(d).composite.components[0].metamorphic.assumptions[0].value,'forged');
});
test('component invalidity, bare-brain projection and organic-brain boundaries remain enforced',()=>{
 const child=make(17,'advanced');assert.equal(evaluate(attach('ship-brain','installed-robot',child)).status,'invalid');
 assert.ok(has(evaluate(attach('vehicle-brain','installed-brain',make())),'COMPOSITE_BRAIN_PROJECTION'));
 assert.ok(has(evaluate(attach('cyborg','body',make())),'COMPOSITE_ORGANIC_BRAIN'));
 const noBrain=updateDesign(make(),{selections:{brain:{model:'none'}}});assert.equal(evaluate(attach('cyborg','body',noBrain)).status,'invalid');
});

test('metamorphic surcharge cannot absorb ordinary minimum-chassis cost or create a removal discount',()=>{
 const patch={selections:{chassis:{size:'size-8'},locomotion:{primary:'none'},finalisation:{removedSlots:160}}};
 const d=updateDesign(make(),patch),r=evaluate(d),ordinary=evaluate(updateDesign(createDesign({techLevel:17}),patch));
 assert.equal(ordinary.totals.cost,8000);assert.equal(r.totals.cost,6408000);assert.equal(r.totals.cost-ordinary.totals.cost,128*50000);assert.equal(r.ledger.reduce((n,x)=>n+x.cost,0),6408000);assert.equal(r.metamorphic.priceBasisSlots,128);
});
