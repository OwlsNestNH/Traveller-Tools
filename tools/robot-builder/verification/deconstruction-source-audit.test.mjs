import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {evaluateSpecialDesign,createSpecialDesignFields} from '../engine/special-types.mjs';

const id='deconstruction-chamber-standard';
const design=(physical={},extra={})=>updateDesign(createDesign({techLevel:13,...extra}),{selections:{chassis:{size:'size-8'},physical}});
const capability=r=>r.totals.equipmentCapabilities.find(c=>c.optionId===id);
const choices=d=>getCatalogue(d).stages.find(s=>s.id==='physical').controls.flatMap(c=>c.choices??[]);

test('p119 standard chamber exposes fixed accounting and no arbitrary scaling controls',()=>{
 const row=choices(design()).find(o=>o.id===id);
 assert.equal(row.tl,13);assert.equal(row.cost,5000000);assert.equal(row.slots,64);
 assert.equal(row.source.pages,'119');assert.equal(row.costBasis,'each');assert.equal(row.slotsBasis,'fixed');
 assert.equal(row.quantityKind,'copies');assert.equal(row.zeroSlot,false);
 assert.deepEqual(row.parameterControls.map(c=>c.field),['quantity']);
 assert.equal(choices(design({}, {techLevel:12})).find(o=>o.id===id).eligibility.available,false);
});

for(const route of ['ordinary','instance'])test(`p119 ${route} route accounts copies and retains per-chamber capacity`,()=>{
 for(const quantity of [1,2]){
  const physical=route==='ordinary'?{options:[id],optionParameters:{[id]:{quantity}}}:{optionInstances:[{id:'chamber',optionId:id,parameters:{quantity}}]};
  const d=design(physical),r=evaluateDesign(d),base=evaluateDesign(design());
  assert.equal(r.status,'verified');assert.equal(r.totals.cost-base.totals.cost,5000000*quantity);
  assert.equal(r.totals.slots.used-base.totals.slots.used,64*quantity);
  const c=capability(r);assert.equal(c.copies,quantity);assert.equal(c.source.pages,'119');
  assert.deepEqual(c.ratedPerInstallation,{capacitySlots:50,approximateCapacityKg:150,equipmentMassKg:200,outputStorageBandwidth:32});
  assert.equal(c.destructive,true);assert.equal(c.storageVerified,false);assert.equal(c.grantsSkill,false);
  assert.equal(c.manufacturesObjects,false);assert.equal(c.restoresMemories,false);
  assert.deepEqual(r.totals.skills,base.totals.skills);assert.deepEqual(r.totals.bandwidth,base.totals.bandwidth);
  assert.deepEqual(importDesign(exportDesign(d)),d);
 }
});

test('mixed ordinary and separate chambers are accounted exactly once',()=>{
 const r=evaluateDesign(design({options:[id],optionInstances:[{id:'second',optionId:id,parameters:{}}]}));
 assert.equal(r.status,'verified');assert.equal(r.totals.slots.used,128);
 assert.equal(r.ledger.filter(x=>x.id===`option-${id}`||x.id==='instance-second').reduce((n,x)=>n+x.cost,0),10000000);
 assert.equal(r.totals.equipmentCapabilities.filter(c=>c.optionId===id).length,2);
});

test('technology, chassis fit and quantity validation cannot be bypassed by either route',()=>{
 for(const instance of [false,true]){
  const physical=q=>instance?{optionInstances:[{id:'chamber',optionId:id,parameters:{quantity:q}}]}:{options:[id],optionParameters:{[id]:{quantity:q}}};
  assert.equal(evaluateDesign(design(physical(1),{techLevel:12})).status,'invalid');
  assert.ok(evaluateDesign(design(physical(3))).diagnostics.some(d=>d.code==='SLOTS_EXCEEDED'));
  assert.ok(evaluateDesign(updateDesign(design(physical(1)),{selections:{chassis:{size:'size-6'}}})).diagnostics.some(d=>d.code==='SLOTS_EXCEEDED'));
  for(const q of [0,-1,.5,1001])assert.throws(()=>design(physical(q)));
 }
 assert.throws(()=>design({defaultSuite:[id]}));
});

test('body capacity is not waived and microbots do not gain slotted hardware',()=>{
 const r=evaluateDesign(design({options:[id]},{kind:'biological'}));
 assert.ok(r.diagnostics.some(d=>d.code==='SLOTS_EXCEEDED'));
 const micro=createSpecialDesignFields('microbot',13);
 for(const selected of [{options:[id]},{optionInstances:[{id:'chamber',optionId:id,parameters:{}}]}]){
  const result=evaluateSpecialDesign({kind:'microbot',techLevel:13,special:{...micro,...selected}});
  assert.equal(result.status,'invalid');assert.ok(result.diagnostics.some(d=>d.code==='MICRO_OPTION_ELIGIBILITY'));
 }
 assert.ok(!choices(createDesign({kind:'microbot',techLevel:13})).some(o=>o.id===id));
});

test('returned catalogue and capability data are detached from rules and subsequent evaluations',()=>{
 const d=design({options:[id]}),row=choices(d).find(o=>o.id===id),r=evaluateDesign(d);
 row.effects.capacitySlots=999;row.source.pages='wrong';
 const c=capability(r);c.ratedPerInstallation.capacitySlots=999;c.storageDestinations.push('free memory');c.source.pages='wrong';
 const fresh=capability(evaluateDesign(d));assert.equal(fresh.ratedPerInstallation.capacitySlots,50);
 assert.equal(fresh.source.pages,'119');assert.deepEqual(fresh.storageDestinations,['computer memory','data wafers']);
 assert.equal(choices(d).find(o=>o.id===id).effects.capacitySlots,50);
});
