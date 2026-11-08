import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,applySelection,evaluateDesign,getCatalogue,exportDesign,importDesign,validateDesign} from '../engine/index.mjs';

// Full Robot Handbook 2022 PDF, pp81,83-84,86; Core Update 2022 p9 characteristic definitions. Mixed records never assert application success.
const record=(id,patch={})=>({id,packageType:'pharmaceutical',count:1,hardwareTL:13,role:'purchased-active',target:'unresolved',attributeIncrease:1,continuousTreatmentYears:0,pharmaceuticalPurpose:'',environment:'none',radiationLevels:0,...patch});
const base=(special={},tl=15)=>updateDesign(createDesign({kind:'nanorobot',techLevel:tl}),{special});
const make=(records,patch={},tl=15)=>base({medicalMode:'itemised',medicalPackages:records,...patch},tl);
const evaluate=(records,patch={},tl=15)=>evaluateDesign(make(records,patch,tl));
const mode=(d,value)=>applySelection(d,{stage:'chassis',field:'medicalMode',value});
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);

test('pre-extension imports keep every legacy field and evaluation unchanged',()=>{
 for(const packageType of ['pharmaceutical','physical','mental','regenerative','anti-ageing','nanotech-defence','construction-basic','construction-improved','excavation','soil','cleanup']){
  const d=base({packageType}),raw=JSON.parse(exportDesign(d));delete raw.special.medicalMode;delete raw.special.medicalPackages;
  const imported=importDesign(JSON.stringify(raw));
  assert.deepEqual(imported,d,packageType);assert.deepEqual(evaluateDesign(raw),evaluateDesign(imported),packageType);
  for(const [key,value]of Object.entries(raw.special))assert.deepEqual(imported.special[key],value);
 }
});
test('first explicit switch seeds one purchase and preserves untyped active count',()=>{
 const d=base({packageType:'nanotech-defence',packages:3,otherActivePackages:12,environment:'insidious',radiationLevels:1},14);
 assert.equal(d.special.medicalPackages,null);
 assert.deepEqual(importDesign(exportDesign(d)),d);
 const next=mode(d,'itemised'),r=evaluateDesign(next),n=r.totals.nanorobot;
 assert.equal(next.special.medicalPackages.length,1);
 assert.deepEqual(next.special.medicalPackages[0],record('nano-legacy',{packageType:'nanotech-defence',count:3,hardwareTL:14,environment:'insidious',radiationLevels:1}));
 assert.equal(n.totalActiveMedicalPackages,15);assert.equal(n.nanotechDefence.resistanceDM,3);assert.equal(r.totals.cost,600000);
 assert.equal(next.special.otherActivePackages,12);assert.equal(next.special.packages,3);
 assert.deepEqual(importDesign(exportDesign(next)),next);
 assert.deepEqual(mode(mode(next,'legacy-single'),'itemised'),next);
 assert.deepEqual(evaluateDesign(mode(next,'legacy-single')),evaluateDesign(d));
});
test('an intentionally emptied inventory is not reseeded after switching or import',()=>{
 let d=mode(base(),'itemised');d=updateDesign(d,{special:{medicalPackages:[]}});
 assert.equal(evaluateDesign(d).status,'blocked');assert.ok(has(evaluateDesign(d),'NANO_MEDICAL_EMPTY'));
 d=mode(mode(importDesign(exportDesign(d)),'legacy-single'),'itemised');
 assert.deepEqual(d.special.medicalPackages,[]);assert.ok(has(evaluateDesign(d),'NANO_MEDICAL_EMPTY'));
});
test('conversion never guesses physical target and mental selects only INT',()=>{
 const physical=mode(base({packageType:'physical',packages:3,attributeIncrease:2}),'itemised');
 assert.equal(physical.special.medicalPackages[0].target,'unresolved');assert.ok(has(evaluateDesign(physical),'NANO_ATTRIBUTE_TARGET'));
 const fixed=updateDesign(physical,{special:{medicalPackages:[{...physical.special.medicalPackages[0],target:'DEX'}]}});
 assert.equal(evaluateDesign(fixed).totals.nanorobot.characteristicEnhancements[0].attributeIncrease,2);
 const mental=mode(base({packageType:'mental'}),'itemised');
 assert.equal(mental.special.medicalPackages[0].target,'INT');assert.equal(evaluateDesign(mental).totals.cost,40000);
});
test('explicit records override conversion and stale legacy purchases never count',()=>{
 const d=updateDesign(base({packages:90,packageType:'anti-ageing',attributeIncrease:3,continuousTreatmentYears:800}),{special:{medicalMode:'itemised',medicalPackages:[record('explicit',{count:2})]}});
 const r=evaluateDesign(d);assert.equal(r.totals.cost,40000);assert.equal(r.totals.nanorobot.totalActiveMedicalPackages,2);
 assert.equal(r.totals.nanorobot.medicalPackages.length,1);assert.equal(r.totals.nanorobot.legacySelectionIncluded,false);
});
test('mixed prices include purchased reserve but exclude existing treatment',()=>{
 const r=evaluate([record('drug',{count:2}),record('int',{packageType:'mental',target:'INT',hardwareTL:14}),record('age',{packageType:'anti-ageing',hardwareTL:15,role:'purchased-reserve'}),record('prior',{packageType:'regenerative',count:2,role:'existing-active',environment:'insidious',radiationLevels:2})]);
 const n=r.totals.nanorobot;assert.equal(r.status,'verified');assert.equal(r.totals.cost,160000);assert.equal(r.ledger.length,3);
 assert.equal(n.packages,4);assert.equal(n.existingActivePackages,2);assert.equal(n.reservePackages,1);assert.equal(n.totalActiveMedicalPackages,5);
 assert.equal(n.volumeLitres,.4);assert.equal(n.massKg,.4);assert.equal(n.ageingTreatments[0].ageingReduction,null);
 assert.equal(n.regeneration.permanentCharacteristicPointsPerWeek,2);
 assert.equal(n.medicalPackages.find(r=>r.id==='prior').cost,0);
});
test('15 and 16 are END thresholds, not procurement or active prohibitions',()=>{
 for(const count of [10,11,15,16,100,1000]){
  const r=evaluate([record('dose',{count})]),n=r.totals.nanorobot;
  assert.equal(r.status,'verified');assert.equal(n.totalActiveMedicalPackages,count);assert.equal(n.permanentEnduranceLoss,Math.max(0,count-15));
  assert.equal(r.totals.cost,count*20000);
 }
 const r=evaluate([record('dose',{count:10}),record('old',{count:3,role:'existing-active'}),record('reserve',{count:100,role:'purchased-reserve'})],{otherActivePackages:3});
 assert.equal(r.totals.nanorobot.totalActiveMedicalPackages,16);assert.equal(r.totals.nanorobot.permanentEnduranceLoss,1);
});
test('same-target increments aggregate before triangular requirements',()=>{
 const a=record('a',{packageType:'physical',target:'STR'}),b=record('b',{packageType:'physical',target:'STR'});
 assert.ok(has(evaluate([a,b]),'NANO_ATTRIBUTE_PACKAGES'));
 const r=evaluate([a,{...b,count:2}]);assert.equal(r.status,'verified');
 assert.deepEqual(r.totals.nanorobot.characteristicEnhancements[0],{target:'STR',attributeIncrease:2,activePackages:3,packagesRequired:3,recordIds:['a','b'],includesOnlyTypedPackages:true,combinedWithUntypedPackagesVerified:true,source:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'83-84'},definitionSource:{book:'Traveller Core Rulebook Update 2022',edition:'Mongoose 2022',pages:'9'}});
 assert.ok(has(evaluate([{...a,count:3,attributeIncrease:2},{...b,count:3,attributeIncrease:2}]),'NANO_ATTRIBUTE_MAX'));
 assert.ok(has(evaluate([{...a,count:3,attributeIncrease:2},{...b,role:'existing-active'}]),'NANO_ATTRIBUTE_PACKAGES'));
 assert.equal(evaluate([{...a,count:3,attributeIncrease:2},{...b,count:3,role:'existing-active'}]).status,'verified');
});
test('different physical targets are independent and reserve causes no increase',()=>{
 const r=evaluate([record('str',{packageType:'physical',target:'STR'}),record('dex',{packageType:'physical',target:'DEX'}),record('reserve',{packageType:'physical',target:'STR',count:6,attributeIncrease:3,role:'purchased-reserve'})]);
 assert.equal(r.status,'verified');assert.deepEqual(r.totals.nanorobot.characteristicEnhancements.map(r=>[r.target,r.attributeIncrease]),[['STR',1],['DEX',1]]);
 assert.equal(r.totals.nanorobot.totalActiveMedicalPackages,2);assert.equal(r.totals.cost,160000);
 for(const target of ['EDU','SOC','PSI','INT'])assert.throws(()=>make([record('bad',{packageType:'physical',target})]));
 assert.throws(()=>make([record('bad',{packageType:'mental',target:'STR'})]));
});
test('regeneration caps aggregate purchased and existing but not reserve',()=>{
 const a=record('regen',{packageType:'regenerative',count:2}),b=record('old',{packageType:'regenerative',count:2,role:'existing-active'});
 const r=evaluate([a,b,record('reserve',{packageType:'regenerative',count:50,role:'purchased-reserve'})]);
 assert.equal(r.status,'verified');assert.equal(r.totals.nanorobot.regeneration.activePackages,4);assert.equal(r.totals.nanorobot.regeneration.repairsBrain,false);assert.equal(r.totals.nanorobot.regeneration.requiresNutrition,true);
 assert.ok(has(evaluate([a,{...b,count:3}]),'NANO_REGEN_LIMIT'));
});
test('ageing cap aggregates active records without prohibiting reserve purchases',()=>{
 const a=record('age',{packageType:'anti-ageing'}),b=record('prior',{packageType:'anti-ageing',role:'existing-active'});
 assert.ok(has(evaluate([a,b]),'NANO_AGEING_SINGLE'));
 assert.equal(evaluate([a,{...b,role:'purchased-reserve',count:4}]).status,'verified');
 assert.ok(has(evaluate([{...a,count:2}]),'NANO_AGEING_SINGLE'));
});
test('legacy ageing flag is not fabricated into a package or silently certified',()=>{
 const d=mode(base({packageType:'anti-ageing',existingAgeingPackage:'yes',otherActivePackages:1}),'itemised'),r=evaluateDesign(d);
 assert.equal(d.special.medicalPackages.length,1);assert.equal(r.status,'blocked');assert.ok(has(r,'NANO_AGEING_RECONCILIATION'));
 assert.equal(r.ledger.reduce((n,r)=>n+r.cost,0),80000);
 const defence=evaluate([record('defence',{packageType:'nanotech-defence'})],{existingAgeingPackage:'yes',otherActivePackages:1});
 assert.equal(defence.totals.nanorobot.totalActiveMedicalPackages,2);assert.equal(defence.totals.nanorobot.activeLimits.antiAgeing.allActiveTypesKnown,false);
 assert.ok(has(defence,'NANO_LEGACY_AGEING_UNRESOLVED'));
 assert.equal(defence.totals.nanorobot.activeCountComplete,false);assert.equal(defence.totals.nanorobot.enduranceLossIsMinimum,true);
 assert.ok(defence.summaryMetrics.some(m=>m.label==='Minimum permanent END loss'));
 assert.equal(defence.medicalInventory.effectCertification,'partial');
 const reconciled=updateDesign(d,{special:{existingAgeingPackage:'no',medicalPackages:[record('prior',{packageType:'anti-ageing',role:'existing-active'})],otherActivePackages:0}});
 assert.equal(evaluateDesign(reconciled).status,'verified');assert.equal(evaluateDesign(reconciled).totals.cost,0);
});
test('defence adds only active typed counts and retains all limitations',()=>{
 const r=evaluate([record('new',{packageType:'nanotech-defence',count:3}),record('prior',{packageType:'nanotech-defence',count:4,role:'existing-active'}),record('reserve',{packageType:'nanotech-defence',count:8,role:'purchased-reserve'})],{otherActivePackages:2});
 const n=r.totals.nanorobot,d=n.nanotechDefence;assert.equal(d.resistanceDM,7);assert.equal(n.totalActiveMedicalPackages,9);assert.equal(r.totals.cost,220000);
 assert.equal(d.linearStacking,true);assert.equal(d.automaticImmunity,false);assert.equal(d.applicationVerified,false);assert.equal(d.infectionResolutionPerformed,false);assert.equal(d.includesOnlyTypedPackages,true);
 assert.equal(d.initialProgrammingRequiresSwarmController,true);assert.equal(d.autonomousAfterApplication,true);
 assert.deepEqual(r.totals.skills,[]);assert.equal(r.totals.bandwidth,null);assert.equal(r.totals.slots,null);
});
test('hardware TL and environmental protection stay per-record',()=>{
 const r=evaluate([record('tl13',{hardwareTL:13,environment:'corrosive'}),record('tl14',{hardwareTL:14,environment:'insidious',radiationLevels:2}),record('tl15',{hardwareTL:15})]);
 assert.equal(r.totals.cost,460000);
 assert.deepEqual(r.totals.nanorobot.medicalPackages.map(r=>[r.lifeYears,r.protectionMultiplier,r.cost]),[[1,2,40000],[2,20,400000],[4,1,20000]]);
 assert.equal(r.totals.nanorobot.lifeYears,undefined);assert.equal(r.totals.nanorobot.expirySimulated,false);
 for(const r2 of r.totals.nanorobot.medicalPackages){assert.equal(r2.remainingLifeYears,null);assert.equal(r2.applicationVerified,false);}
});
test('anti-ageing history lowers effective TL but never hardware lifespan',()=>{
 for(const [hardwareTL,years,effectiveTL,reduction,life]of [[13,0,13,.5,1],[14,0,14,.75,2],[15,0,15,.9,4],[15,20,14,.75,4],[15,40,13,.5,4],[15,60,12,0,4],[16,20,15,.9,8]]){
  const r=evaluate([record('age',{packageType:'anti-ageing',hardwareTL,continuousTreatmentYears:years})],{},16);
  assert.equal(r.status,'verified');assert.deepEqual(r.totals.nanorobot.ageingTreatments.map(r=>[r.effectiveTL,r.ageingReduction,r.lifeYears]),[[effectiveTL,reduction,life]]);
 }
 const r=evaluate([record('age',{packageType:'anti-ageing',hardwareTL:16})],{},16);
 assert.ok(has(r,'NANO_AGEING_HIGH_TL_UNRESOLVED'));assert.equal(r.status,'blocked');assert.equal(r.ledger[0].cost,80000);
});
test('purchase TL is checked but existing higher-TL treatment is a declaration',()=>{
 assert.ok(has(evaluate([record('high',{hardwareTL:16})],{},15),'NANO_MEDICAL_PURCHASE_TL'));
 assert.ok(has(evaluate([record('high',{hardwareTL:16,role:'purchased-reserve'})],{},15),'NANO_MEDICAL_PURCHASE_TL'));
 const r=evaluate([record('prior',{hardwareTL:20,role:'existing-active'})],{},13),prior=r.totals.nanorobot.medicalPackages[0];
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,0);assert.equal(prior.lifeYears,128);assert.equal(prior.currentEffectivenessDeclared,true);assert.equal(prior.acquisitionTechnologyChecked,false);
 assert.ok(has(evaluate([record('low')],{},12),'NANO_MEDICAL_PURCHASE_TL'));
});
test('untyped active count qualifies cap and enhancement completeness only',()=>{
 const r=evaluate([record('str',{packageType:'physical',target:'STR'}),record('regen',{packageType:'regenerative'}),record('age',{packageType:'anti-ageing'})],{otherActivePackages:13}),n=r.totals.nanorobot;
 assert.equal(r.status,'verified');assert.equal(n.totalActiveMedicalPackages,16);assert.equal(n.permanentEnduranceLoss,1);
 assert.equal(n.characteristicEnhancements[0].combinedWithUntypedPackagesVerified,false);assert.equal(n.activeLimits.regeneration.allActiveTypesKnown,false);assert.equal(n.activeLimits.antiAgeing.allActiveTypesKnown,false);
 assert.equal(n.regeneration.activePackages,1);assert.equal(n.nanotechDefence.resistanceDM,0);
 assert.ok(has(r,'NANO_UNTYPED_ACTIVE'));assert.ok(r.coverage.gaps.some(g=>g.id==='nano-untyped-medical-inventory'));
});
test('pharmaceutical labels are preserved without invented drug outcomes',()=>{
 const purpose='Recorded panacea purpose',r=evaluate([record('drug',{pharmaceuticalPurpose:purpose})]),n=r.totals.nanorobot;
 assert.equal(n.medicalPackages[0].pharmaceuticalPurpose,purpose);assert.equal(n.medicalPackages[0].drugEffect,undefined);
 assert.equal(n.drugInteractions,undefined);assert.ok(r.coverage.operationalDependencies.some(d=>d.id==='nano-medical-application'));
});
test('closed records reject malformed counts, IDs, types, TL and hidden values',()=>{
 for(const count of [0,-1,.5,10001,Infinity,NaN])assert.throws(()=>make([record('bad',{count})]));
 for(const hardwareTL of [12,24,13.5])assert.throws(()=>make([record('bad',{hardwareTL})]));
 for(const patch of [{role:'invented'},{packageType:'unknown'},{packageType:'construction-basic'},{environment:'vacuum'},{target:'EDU'},{attributeIncrease:0},{radiationLevels:-1},{radiationLevels:11},{continuousTreatmentYears:-1},{pharmaceuticalPurpose:42},{pharmaceuticalPurpose:'x'.repeat(121)},{id:'bad id'},{unexpected:true}])assert.throws(()=>make([record('bad',patch)]));
 for(const records of [null,{},[null],[[]],[record('same'),record('same')],Array.from({length:201},(_,i)=>record('r'+i))])assert.throws(()=>make(records));
 const missing=record('bad');delete missing.role;assert.throws(()=>make([missing]));
 const d=JSON.parse(exportDesign(make([record('good')])));d.special.medicalPackages[0].count=0;
 assert.equal(validateDesign(d).valid,false);assert.throws(()=>importDesign(JSON.stringify(d)));
});
test('import does not seed or repair incomplete explicit inventory data',()=>{
 const d=JSON.parse(exportDesign(base()));d.special.medicalMode='itemised';
 assert.throws(()=>importDesign(JSON.stringify(d)));
 delete d.special.medicalMode;assert.throws(()=>importDesign(JSON.stringify(d)));
});
test('returned records, source data and control metadata are isolated',()=>{
 const records=[record('dose',{count:2})],d=make(records),before=exportDesign(d),r=evaluateDesign(d);
 records[0].count=999;r.totals.nanorobot.medicalPackages[0].count=999;r.totals.nanorobot.medicalPackages[0].source.pages='wrong';
 r.totals.nanorobot.nanotechDefence.source.pages='wrong';
 const controls=getCatalogue(d).stages.flatMap(s=>s.controls),c=controls.find(c=>c.field==='medicalPackages');
 assert.equal(c.type,'custom-packages');assert.equal(c.maxItems,200);assert.equal(c.applicationLimit,true);
 c.itemFields.find(f=>f.field==='packageType').choices[0].id='wrong';c.itemFields.find(f=>f.field==='target').choicesBy.values.physical[0].id='wrong';
 assert.equal(exportDesign(d),before);assert.equal(evaluateDesign(d).totals.cost,40000);
 assert.equal(evaluateDesign(d).totals.nanorobot.medicalPackages[0].source.pages,'81,83-84');
 assert.equal(getCatalogue(d).stages.flatMap(s=>s.controls).find(c=>c.field==='medicalPackages').itemFields[0].choices[0].id,'pharmaceutical');
 assert.deepEqual(evaluateDesign(importDesign(exportDesign(d))),evaluateDesign(d));
});
test('industrial and high-tech paths ignore saved medical records and retain exact results',()=>{
 for(const [packageType,tl]of [['construction-basic',13],['construction-improved',15],['excavation',13],['soil',13],['cleanup',13],['construction-enhanced',18],['construction-advanced',20],['construction-superior',23],['distributed-conscious',22]]){
  const d=base({packageType},tl),saved=updateDesign(d,{special:{medicalPackages:[record('inactive',{packageType:'regenerative',count:5})]}});
  assert.deepEqual(evaluateDesign(saved),evaluateDesign(d),packageType);
  assert.deepEqual(mode(saved,'itemised').special.medicalPackages,saved.special.medicalPackages);
 }
 const industrial=mode(base({packageType:'excavation'}),'itemised');
 assert.deepEqual(industrial.special.medicalPackages,[]);assert.ok(has(evaluateDesign(industrial),'NANO_MEDICAL_EMPTY'));
});


test('direct editing of pre-extension objects normalises defaults before mode conversion',()=>{
 const d=JSON.parse(exportDesign(base({packageType:'physical',packages:3,attributeIncrease:2,otherActivePackages:4})));
 delete d.special.medicalMode;delete d.special.medicalPackages;
 const edited=updateDesign(d,{special:{medicalMode:'itemised'}});
 assert.equal(edited.special.medicalPackages.length,1);assert.equal(edited.special.medicalPackages[0].target,'unresolved');
 assert.equal(edited.special.otherActivePackages,4);assert.ok(has(evaluateDesign(edited),'NANO_ATTRIBUTE_TARGET'));
 assert.equal(d.special.medicalMode,undefined);assert.equal(d.special.medicalPackages,undefined);
 assert.equal(updateDesign(d,{name:'Edited old object'}).special.medicalPackages,null);
 assert.deepEqual(applySelection(d,{stage:'chassis',field:'medicalMode',value:'itemised'}),edited);
});
test('above-table legacy ageing values remain explicitly unverified, not source-certified',()=>{
 const legacy=base({packageType:'anti-ageing'},16),r=evaluateDesign(legacy);
 assert.equal(r.totals.cost,80000);assert.equal(r.totals.nanorobot.ageingReduction,.9);assert.equal(r.totals.nanorobot.lifeYears,8);
 assert.ok(has(r,'NANO_LEGACY_AGEING_HIGH_TL'));assert.ok(r.coverage.gaps.some(g=>g.id==='nano-legacy-ageing-high-tl'));
 const raw=JSON.parse(exportDesign(legacy));delete raw.special.medicalMode;delete raw.special.medicalPackages;
 assert.deepEqual(evaluateDesign(importDesign(JSON.stringify(raw))),r);
 const mixed=evaluateDesign(mode(legacy,'itemised'));
 assert.equal(mixed.status,'blocked');assert.equal(mixed.medicalInventory.purchaseCost,80000);
 assert.equal(mixed.medicalInventory.records[0].lifeYears,8);assert.equal(mixed.medicalInventory.effectCertification,'blocked');
 assert.equal(mixed.totals,null);assert.equal(mixed.ledger[0].cost,80000);
});
test('characteristic target provenance distinguishes Core definitions from medical rules',()=>{
 const d=make([record('str',{packageType:'physical',target:'STR'}),record('int',{packageType:'mental',target:'INT'})]);
 const c=getCatalogue(d).stages.flatMap(s=>s.controls).find(c=>c.field==='medicalPackages').itemFields.find(c=>c.field==='target');
 assert.equal(c.definitionSource.book,'Traveller Core Rulebook Update 2022');assert.equal(c.definitionSource.pages,'9');
 for(const e of evaluateDesign(d).totals.nanorobot.characteristicEnhancements){assert.equal(e.source.book,'Robot Handbook');assert.equal(e.definitionSource.pages,'9');}
});


test('generic editor UUID IDs fit the stable 40-character record boundary',()=>{
 const d=make([record('seed')]),c=getCatalogue(d).stages.flatMap(s=>s.controls).find(c=>c.field==='medicalPackages');
 const id=c.recordIdPrefix+'12345678-1234-4123-8123-123456789abc';
 assert.equal(id.length,40);assert.equal(id.startsWith('med-'),true);
 const updated=updateDesign(d,{special:{medicalPackages:[...d.special.medicalPackages,record(id)]}});
 assert.equal(evaluateDesign(updated).totals.nanorobot.medicalPackages.length,2);
 assert.deepEqual(importDesign(exportDesign(updated)),updated);
});
