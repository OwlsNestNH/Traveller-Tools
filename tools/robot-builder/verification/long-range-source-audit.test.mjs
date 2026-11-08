import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,exportDesign,importDesign} from '../engine/index.mjs';

// High Guard Update 2022, revised printing copyright 2026, pp36-37.
// Robot Handbook pp100-101 retains payload geometry and burn timing.
const make=(special={},techLevel=13)=>updateDesign(createDesign({kind:'missile',techLevel}),{special:{carrier:'long-range',procurement:'case12',...special}});
const run=(special={},techLevel=13)=>evaluateDesign(make(special,techLevel));
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);

test('long-range case uses its own source price and retains Handbook payload limits',()=>{
 const r=run({},8);assert.equal(r.status,'verified');assert.equal(r.totals.cost,500000);
 assert.equal(r.totals.carrier.quantity,12);assert.equal(r.totals.carrier.burnRounds,20);
 assert.equal(r.totals.carrier.payloadSlots,2);assert.equal(r.totals.carrier.maxWarheadSize,1);
 assert.equal(r.totals.carrier.maxWarheadSlots,1);assert.equal(r.totals.carrier.externalWarheadValidated,false);
 assert.equal(r.ledger[0].cost,500000);assert.match(r.ledger[0].label,/long-range/);
 assert.equal(r.ledger[0].source.book,'High Guard Update 2022');assert.equal(r.ledger[0].source.pages,'36-37');
 assert.deepEqual(r.totals.carrier.procurementSource,r.ledger[0].source);assert.equal(r.coverage.complete,false);
});
test('long-range individual procurement remains unknown rather than a divided or substituted case price',()=>{
 const r=run({procurement:'individual'});assert.equal(r.status,'blocked');assert.equal(r.totals,null);
 assert.ok(has(r,'LONG_RANGE_PRICE'));assert.equal(r.ledger[0].cost,null);
 assert.equal(r.diagnostics.find(d=>d.code==='LONG_RANGE_PRICE').path,'special.procurement');
 assert.equal(r.diagnostics.find(d=>d.code==='LONG_RANGE_PRICE').source.book,'High Guard Update 2022');
});
test('long-range case enforces TL and payload bounds independently of its resolved price',()=>{
 assert.ok(has(run({},7),'MISSILE_CARRIER_TL'));
 assert.ok(has(run({customWarhead:'robot',warheadSize:2,warheadSlots:2}),'MISSILE_WARHEAD_SIZE'));
 assert.ok(has(run({customWarhead:'robot',warheadSize:1,warheadSlots:1,payloadSlotsUsed:3}),'MISSILE_PAYLOAD_CAPACITY'));
});
test('standard missile and torpedo procurement stay unchanged',()=>{
 for(const [carrier,procurement,cost]of [['missile','individual',24000],['missile','case12',250000],['torpedo','individual',150000]]){
  const r=run({carrier,procurement});assert.equal(r.status,'verified');assert.equal(r.totals.cost,cost);
  assert.equal(r.ledger[0].source.book,'Robot Handbook');
 }
 assert.ok(has(run({carrier:'torpedo',procurement:'case12'}),'TORPEDO_CASE_PRICE'));
});
test('twelve long-range robot payloads charge once and remain detached across export/import',()=>{
 const child=updateDesign(createDesign({techLevel:13}),{selections:{chassis:{size:'size-1'},finalisation:{priceMode:'custom',customPrice:1}}});
 const design=updateDesign(make(),{special:{designReferences:[{id:'payload',role:'payload',quantity:12,design:child}]}});
 const r=evaluateDesign(importDesign(exportDesign(design)));assert.equal(r.status,'verified');
 assert.equal(r.totals.cost,500000+12*10200);assert.equal(r.totals.carrier.payloadSlotsUsed,2);
 assert.equal(r.totals.carrier.externalWarheadValidated,true);assert.equal(r.composite.components[0].listedUnitCost,1);
 assert.equal(r.ledger.reduce((sum,row)=>sum+row.cost,0),r.totals.constructionCost);
 const one=updateDesign(design,{special:{designReferences:[{...design.special.designReferences[0],quantity:1}]}});
 assert.ok(has(evaluateDesign(one),'COMPOSITE_PAYLOAD_COUNT'));
});
