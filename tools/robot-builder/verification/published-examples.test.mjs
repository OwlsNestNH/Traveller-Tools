import test from 'node:test';
import assert from 'node:assert/strict';
import {publishedFixtures,evaluatePublished,publishedComparison} from './published-example-fixtures.mjs';
const fixture=id=>publishedFixtures.find(f=>f.id===id);
const expectedCosts={'domestic-servant':860,'ag300':24950,'basic-courier':31900,'advanced-courier':132500,'autodoc-basic':110650,'enhanced-android':2117200,'entourage-biobot':392100,'zombie':144750,'sindalian-enforcement':28750,'deep-diver':2331400,'startek':697300};
// Independent source reconstruction, not an assumption that retail prices equal component sums.
// RH p76 explicitly allows rounded retail prices, discounts and premiums.
for(const f of publishedFixtures){
 test(`Published ${f.name}, p${f.page}: source stats and disclosed exceptions`,()=>{
  const r=publishedComparison(f),actual=r.actual;
  assert.ok(actual,'All required construction data must be supplied.');
  assert.equal(r.status,f.id==='advanced-courier'?'invalid':'verified');
  assert.equal(actual.cost,expectedCosts[f.id]);
  for(const [key,value] of Object.entries(f.published)){
   if(['cost','constructionCost','hardware','weaponDamage'].includes(key))continue;
   if(f.id==='advanced-courier'&&key==='vehicleEndurance')continue;
   if(f.id==='zombie'&&key==='spareSlots')continue;
   assert.deepEqual(actual[key],value,`${f.name}: ${key}`);
  }
  for(const [skill,level] of Object.entries(f.published.hardware??{})){
   assert.ok(actual.hardware.some(h=>h.skill===skill&&h.level===level),`${skill} ${level}`);
  }
  assert.equal(f.patch.selections?.finalisation?.priceMode,undefined,'Do not force a published retail-price match.');
 });
}
test('p178 Advanced Courier preserves the slot and endurance discrepancies instead of forcing a fit',()=>{
 const r=publishedComparison(fixture('advanced-courier'));
 assert.equal(r.published.vehicleEndurance,12);
 assert.equal(r.actual.vehicleEndurance,Math.round(72/4/2**2));
 assert.equal(r.actual.spareSlots,-1);
 assert.ok(r.diagnostics.some(d=>d.code==='SLOTS_EXCEEDED'));
 assert.ok(!r.diagnostics.some(d=>d.code==='REMOVE_USED_SLOTS'),'No removal-specific error when zero Slots were removed.');
});
test('p238 Zombie preserves unexplained spare Slot3 versus computed4',()=>{
 const r=publishedComparison(fixture('zombie'));
 assert.equal(r.published.spareSlots,3);assert.equal(r.actual.spareSlots,4);
});
test('p146 Autodoc INT9 grants Medic3 and Science(biology)2 with32 spareSlots',()=>{
 const r=publishedComparison(fixture('autodoc-basic'));
 assert.equal(r.actual.skills.find(s=>s.id==='medic').effectiveLevel,3);
 assert.equal(r.actual.skills.find(s=>s.id==='science:biology').effectiveLevel,2);
 assert.equal(r.actual.spareSlots,32);
});
test('p141 Sindalian Enforcement uses4D laser, basicFCS1 and HK software0 without double counting',()=>{
 const r=evaluatePublished(fixture('sindalian-enforcement')),w=r.totals.weapons[0];
 assert.equal(w.damage,'4D');assert.equal(w.fireControlDM,1);assert.equal(w.softwareLevel,0);
 assert.equal(r.totals.intelligence,4);
});
test('p155 Deep Diver full output reserve and long-duration RTG mode are not conflated',()=>{
 const r=evaluatePublished(fixture('deep-diver'));
 assert.equal(r.totals.tacticalSpeed,3);assert.equal(r.totals.endurance,108);
 assert.equal(r.totals.skills.find(s=>s.id==='investigate').effectiveLevel,2);
 assert.equal(r.totals.skills.find(s=>s.id==='science:planetology').effectiveLevel,2);
 assert.equal(r.ledger.find(l=>l.id==='group-submersible-environment-protection').slots,4);
});



test('p75-78 StarTek keeps the explicit200credit power-pack difference visible',()=>{
 const f=fixture('startek'),r=evaluatePublished(f);
 assert.equal(r.totals.constructionCost-f.published.constructionCost,200);
 assert.equal(r.totals.skills.find(s=>s.id==='electronics:all').effectiveLevel,3);
 assert.equal(r.totals.skills.find(s=>s.id==='engineer:all').effectiveLevel,3);
 const gun=r.totals.skills.find(s=>s.id==='gun-combat');
 assert.equal(gun.modifierOptions.find(o=>o.manipulatorId==='arm-3').effectiveLevel,2);
 assert.equal(r.totals.weapons[0].manipulatorDM,2);
 assert.equal(r.totals.weapons[0].damage,'3D');
 assert.equal(r.totals.weapons[0].cost,1700);
});
