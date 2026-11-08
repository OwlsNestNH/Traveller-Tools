import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,applySelection,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';

// Independently checked against the complete Robot Handbook (Mongoose 2022), printed pp83 and86.
// p86 classifies this as medical: use the p83 ordinary medical price, not an invented defence premium.
const make=(special={},techLevel=13)=>updateDesign(createDesign({kind:'nanorobot',techLevel}),{special:{packageType:'nanotech-defence',...special}});
const evaluate=(special={},techLevel=13)=>evaluateDesign(make(special,techLevel));
const fields=d=>getCatalogue(d).stages.flatMap(s=>s.controls).filter(c=>c.target==='special');

test('prophylactic defence is selectable and uses medical rather than enhancement controls',()=>{
 const d=make(),controls=fields(d),type=controls.find(c=>c.field==='packageType');
 assert.equal(type.choices.find(c=>c.id==='nanotech-defence').label,'Prophylactic nanotech defence');
 assert.ok(controls.find(c=>c.field==='otherActivePackages').visibleWhen.oneOf.includes('nanotech-defence'));
 assert.ok(!controls.find(c=>c.field==='attributeIncrease').visibleWhen.oneOf.includes('nanotech-defence'));
 const selected=applySelection(createDesign({kind:'nanorobot',techLevel:13}),{stage:'chassis',field:'packageType',value:'nanotech-defence'});
 assert.equal(evaluateDesign(selected).totals.nanorobot.nanotechDefence.resistanceDM,1);
});

test('p86 defence stacks linearly at the p83 Cr20000 medical-package price',()=>{
 for(const packages of [1,2,3,6,16]){
  const r=evaluate({packages}),n=r.totals.nanorobot;
  assert.equal(r.status,'verified');assert.equal(r.totals.cost,20000*packages);
  assert.equal(n.pricePerPackage,20000);assert.equal(n.nanotechDefence.resistanceDM,packages);
  assert.equal(n.nanotechDefence.dmPerActivePackage,1);assert.equal(n.nanotechDefence.linearStacking,true);
  assert.deepEqual(r.summaryMetrics.find(m=>m.label==='Nanotech infection resistance DM'),{label:'Nanotech infection resistance DM',value:packages});
  assert.equal(n.volumeLitres,.1*packages);assert.equal(n.massKg,.1*packages);
  assert.equal(r.ledger.find(e=>e.id==='nano-packages').cost,20000*packages);
  assert.equal(n.attributeIncrease,undefined);assert.equal(n.packagesRequired,undefined);
 }
});

test('p83 defence packages retain finite medical lifetime at every supported technology',()=>{
 for(let tl=13;tl<=23;tl++){
  const r=evaluate({},tl);assert.equal(r.status,'verified');
  assert.equal(r.totals.nanorobot.lifeYears,2**(tl-13));assert.ok(Number.isFinite(r.totals.nanorobot.lifeYears));
  assert.equal(r.totals.cost,20000);
 }
 assert.equal(evaluate({},12).status,'invalid');
 assert.ok(evaluate({},12).diagnostics.some(d=>d.code==='NANO_TL'));
});

test('p83 fifteen-package threshold includes defence and other active medical packages',()=>{
 for(const [packages,otherActivePackages,loss] of [[1,14,0],[1,15,1],[5,10,0],[6,10,1],[16,0,1],[3,16,4]]){
  const r=evaluate({packages,otherActivePackages}),n=r.totals.nanorobot;
  assert.equal(r.status,'verified');assert.equal(n.totalActiveMedicalPackages,packages+otherActivePackages);
  assert.equal(n.permanentEnduranceLoss,loss);assert.equal(n.nanotechDefence.resistanceDM,packages);
  assert.equal(r.diagnostics.some(d=>d.code==='NANO_PERMANENT_END'),loss>0);
 }
});

test('source environmental multipliers apply to defence cost without multiplying its DM',()=>{
 for(const [environment,radiationLevels,multiplier] of [['none',0,1],['corrosive',0,2],['insidious',0,5],['none',2,4],['insidious',2,20]]){
  const r=evaluate({packages:2,environment,radiationLevels});assert.equal(r.status,'verified');
  assert.equal(r.totals.cost,40000*multiplier);assert.equal(r.totals.nanorobot.nanotechDefence.resistanceDM,2);
  assert.equal(r.totals.nanorobot.lifeYears,1);assert.equal(r.totals.nanorobot.totalActiveMedicalPackages,2);
 }
});

test('defence is a conditional infection-resistance modifier, never immunity or a recipient skill',()=>{
 const r=evaluate(),n=r.totals.nanorobot,d=n.nanotechDefence;
 assert.equal(d.source.book,'Robot Handbook');assert.equal(d.source.pages,'83,86');
 assert.match(d.scope,/nanotech infections/);assert.match(d.scope,/remain effective/);
 assert.equal(d.automaticImmunity,false);assert.equal(d.applicationVerified,false);assert.equal(d.infectionResolutionPerformed,false);
 assert.equal(d.initialProgrammingRequiresSwarmController,true);assert.equal(d.autonomousAfterApplication,true);
 assert.deepEqual(r.totals.skills,[]);assert.equal(r.totals.bandwidth,null);assert.equal(r.totals.slots,null);
 assert.ok(r.coverage.operationalDependencies.some(d=>d.id==='nano-medical-application'));
});

test('mixed medical inventory remains unvalidated and is not silently treated as additional defence',()=>{
 const r=evaluate({packages:2,otherActivePackages:9});assert.equal(r.coverage.complete,false);
 const gap=r.coverage.gaps.find(g=>g.id==='nano-mixed-medical-inventory');
 assert.equal(gap.category,'construction');assert.equal(gap.source.pages,'83-84');
 assert.match(gap.message,/not a validated set/);assert.equal(r.totals.nanorobot.nanotechDefence.resistanceDM,2);
 assert.equal(r.totals.cost,40000);
});

test('invalid quantities and malformed imports cannot bypass defence validation',()=>{
 for(const packages of [0,-1,.5,101,NaN,Infinity])assert.throws(()=>make({packages}));
 for(const otherActivePackages of [-1,.5,101])assert.throws(()=>make({otherActivePackages}));
 const raw=JSON.parse(exportDesign(make()));raw.special.packages=0;assert.throws(()=>importDesign(JSON.stringify(raw)));
 raw.special.packages=1;raw.special.packageType='invented-nanotech-defence';assert.throws(()=>importDesign(JSON.stringify(raw)));
});

test('defence designs round-trip and returned source/effect objects remain isolated',()=>{
 const d=make({packages:3,otherActivePackages:2},15);assert.deepEqual(importDesign(exportDesign(d)),d);
 assert.deepEqual(evaluateDesign(importDesign(exportDesign(d))),evaluateDesign(d));
 const r=evaluateDesign(d);r.totals.nanorobot.nanotechDefence.resistanceDM=999;r.totals.nanorobot.nanotechDefence.source.pages='wrong';
 const fresh=evaluateDesign(d);assert.equal(fresh.totals.nanorobot.nanotechDefence.resistanceDM,3);
 assert.equal(fresh.totals.nanorobot.nanotechDefence.source.pages,'83,86');
});

test('existing medical package prices, enhancement budgets and active caps are unchanged',()=>{
 for(const [packageType,price] of [['pharmaceutical',20000],['physical',20000],['mental',40000],['anti-ageing',80000],['regenerative',20000]]){
  const r=evaluate({packageType});assert.equal(r.status,'verified');assert.equal(r.totals.cost,price);
  assert.equal(r.totals.nanorobot.nanotechDefence,undefined);assert.equal(r.totals.nanorobot.lifeYears,1);
 }
 assert.equal(evaluate({packageType:'physical',attributeIncrease:2,packages:2}).status,'invalid');
 assert.equal(evaluate({packageType:'physical',attributeIncrease:2,packages:3}).totals.nanorobot.attributeIncrease,2);
 assert.equal(evaluate({packageType:'mental',attributeIncrease:3,packages:6}).totals.cost,240000);
 assert.equal(evaluate({packageType:'regenerative',packages:4}).totals.cost,80000);
 assert.equal(evaluate({packageType:'regenerative',packages:5}).status,'invalid');
 assert.equal(evaluate({packageType:'anti-ageing',packages:2}).status,'invalid');
 assert.equal(evaluate({packageType:'anti-ageing',existingAgeingPackage:'yes'}).status,'invalid');
 assert.equal(evaluate({packageType:'anti-ageing',continuousTreatmentYears:20},15).totals.nanorobot.ageingReduction,.75);
});

test('industrial and high-tech nano branches do not acquire a medical defence modifier',()=>{
 for(const [packageType,tl,cost] of [['construction-basic',13,10000],['construction-improved',15,50000],['excavation',13,5000],['soil',13,10000],['cleanup',13,10000],['construction-enhanced',18,10000],['distributed-conscious',22,200000]]){
  const r=evaluate({packageType},tl);assert.equal(r.status,'verified',packageType);assert.equal(r.totals.cost,cost,packageType);
  assert.equal(r.totals.nanorobot.nanotechDefence,undefined,packageType);
 }
});
