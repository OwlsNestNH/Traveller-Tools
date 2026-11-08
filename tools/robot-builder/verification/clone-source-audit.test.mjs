import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,exportDesign,importDesign,getCatalogue} from '../engine/index.mjs';

// Robot Handbook pp 97-99. Source conflicts and chosen bookkeeping interpretations
// are preserved; these checks do not resolve ageing rolls or generate natural careers.
const make=(special={},tl=15)=>updateDesign(createDesign({kind:'clone',techLevel:tl}),{special:{growth:'accelerated',eduAccounting:'separate',...special}});
const run=(special={},tl=15)=>evaluateDesign(make(special,tl));
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const event=(year,cumulativeIncrease,id='year-'+year)=>({id,year,cumulativeIncrease});
const early={acceleratedStop:'early6',earlyGrowthPrice:'first-year-included'};
const int14={baseINT:11,rollINT:3};

test('Both training-inclusive ageing reproductions are blocked with precise provisional counts',()=>{
 const accelerated=run({...int14,trainingYears:15});
 assert.equal(accelerated.status,'blocked');assert.equal(accelerated.totals,null);
 assert.equal(accelerated.development.growthCalendar.trainingExitApparentAge,33);
 assert.equal(accelerated.development.ageing.effectiveAdultYears,15);assert.equal(accelerated.development.ageing.checksDue,2);
 const quick=run({...int14,growth:'quick',trainingYears:8,quickEducation:'zero'});
 assert.equal(quick.status,'blocked');assert.equal(quick.totals,null);assert.equal(quick.development.ageing.checksDue,1);
 for(const r of [accelerated,quick]){
  assert.equal(r.development.status,'provisional-development-only');
  const d=r.diagnostics.find(d=>d.code==='CLONE_AGEING_ROLLS');
  assert.equal(d.details.checksDue,r.development.ageing.checksDue);assert.equal(d.source.pages,'97-98');
 }
});
test('Actual ageing boundaries differ for accelerated and quick clones',()=>{
 for(const [growth,years,checks]of [['accelerated',7,0],['accelerated',8,1],['accelerated',11,1],['accelerated',12,2],['accelerated',15,2],['quick',7,0],['quick',8,1],['quick',9,1],['quick',10,2],['quick',12,3]]){
  const r=run({...int14,growth,trainingYears:years,quickEducation:'zero'});
  assert.equal(r.development.ageing.checksDue,checks,growth+' '+years);
  assert.equal(r.status,checks?'blocked':'verified');assert.equal(r.development.ageing.minimumTrainingAdultYears,years);
 }
});
test('Supplied adult years are a total age and cannot erase or double-count elapsed training',()=>{
 for(const [supplied,expected,checks]of [[0,12,2],[5,12,2],[12,12,2],[16,16,3]]){
  const r=run({...int14,trainingYears:12,adultYears:supplied});
  assert.equal(r.development.ageing.effectiveAdultYears,expected);assert.equal(r.development.ageing.checksDue,checks);
 }
});
test('The printed age 34 comparison is retained without inventing another elapsed year',()=>{
 const a=run({...int14,trainingYears:15}),b=run({...int14,trainingYears:15,acceleratedCalendar:'printed-example'});
 assert.equal(a.development.growthCalendar.trainingExitApparentAge,33);assert.equal(b.development.growthCalendar.trainingExitApparentAge,34);
 assert.equal(a.development.ageing.effectiveAdultYears,15);assert.equal(b.development.ageing.effectiveAdultYears,15);
 assert.equal(b.development.ageing.checksDue,2);assert.match(b.development.growthCalendar.sourceConflict,/18 \+ 15 = 33/);
 assert.match(b.development.ageing.elapsedBasis,/does not add/);assert.equal(a.status,'blocked');assert.equal(b.status,'blocked');
 assert.ok(has(run({...int14,trainingYears:14,acceleratedCalendar:'printed-example'}),'CLONE_PRINTED_CALENDAR_RANGE'));
});
test('The earliest printed stop retains six months, apparent age six and age twenty-two after sixteen creche years',()=>{
 const r=run({...early,...int14,trainingYears:16}),c=r.totals.clone;
 assert.equal(r.status,'verified');assert.equal(c.growthCalendar.stopElapsedYears,.5);assert.equal(c.growthCalendar.stopApparentAge,6);
 assert.equal(c.growthCalendar.trainingExitApparentAge,22);assert.equal(c.growthCalendar.totalCrecheMonths,192);
 assert.equal(c.maturityYears,12.5);assert.equal(c.ageing.effectiveAdultYears,4);assert.equal(c.ageing.checksDue,0);assert.equal(c.ageing.extraDM,-2);
 assert.equal(c.initialEducation,0);assert.equal(c.annualTraining[0].education,7);assert.equal(c.trainingPoints,64);
});
test('All twelve early integer stops preserve twelvefold growth and whole-year completion accounting',()=>{
 for(let stop=6;stop<18;stop++){
  const years=18-stop,r=run({...early,acceleratedStop:'early'+stop,partialCrecheEducation:'completed-only',trainingYears:years});
  assert.equal(r.status,'verified','Stop month '+stop);
  const c=r.totals.clone;
  assert.equal(c.growthCalendar.stopElapsedYears,stop/12);assert.equal(c.growthCalendar.stopApparentAge,stop);
  assert.equal(c.growthCalendar.trainingExitApparentAge,18);assert.equal(c.growthCalendar.totalCrecheMonths,years*12+stop-6);
  assert.equal(c.growthCalendar.uncreditedPartialCrecheMonths,stop-6);assert.ok(Math.abs(c.maturityYears-(stop/12+18-stop))<1e-12);
  assert.equal(c.trainingPoints,4*years);assert.equal(c.initialEducation,0);assert.equal(c.ageing.effectiveAdultYears,0);
 }
});
test('Every intermediate stop counts its uncredited pre-release months toward the sixteen-year maximum',()=>{
 for(let stop=7;stop<18;stop++){
  const r=run({...early,...int14,acceleratedStop:'early'+stop,partialCrecheEducation:'completed-only',trainingYears:16});
  assert.equal(r.status,'invalid');assert.ok(has(r,'CLONE_CRECHE_LIMIT'));
  assert.equal(r.development.growthCalendar.totalCrecheMonths,192+stop-6);
 }
 const legal=run({...early,...int14,acceleratedStop:'early7',partialCrecheEducation:'completed-only',trainingYears:15});
 assert.equal(legal.status,'verified');assert.equal(legal.totals.clone.growthCalendar.totalCrecheMonths,181);
});
test('Normal adult maturation includes its initial year in the same sixteen-year limit',()=>{
 const legal=run({...int14,trainingYears:15});assert.equal(legal.development.growthCalendar.totalCrecheMonths,192);assert.ok(!has(legal,'CLONE_CRECHE_LIMIT'));
 const excess=run({...int14,trainingYears:16});assert.equal(excess.status,'invalid');assert.ok(has(excess,'CLONE_CRECHE_LIMIT'));
});
test('Intermediate cessation requires a partial-training interpretation before certifying its grants',()=>{
 const r=run({...early,acceleratedStop:'early12',trainingYears:6});
 assert.equal(r.status,'blocked');assert.ok(has(r,'CLONE_PARTIAL_CRECHE'));
 assert.equal(run({...early,acceleratedStop:'early12',trainingYears:6,partialCrecheEducation:'completed-only'}).status,'verified');
});
test('No initial creche skill grant is awarded at six-month release',()=>{
 const r=run({...early,trainingYears:0,trainingSkills:['admin-0']});
 assert.equal(r.status,'invalid');assert.ok(has(r,'CLONE_TRAINING_BUDGET'));assert.ok(has(r,'CLONE_IMMATURE_CHARACTERISTICS'));assert.equal(r.totals,null);
});
test('The first completed post-release creche year supplies initial education and four points only',()=>{
 const base={...early,acceleratedStop:'early17',partialCrecheEducation:'completed-only',trainingYears:1};
 const r=run({...base,trainingSkills:['admin-1']}),c=r.totals.clone;
 assert.equal(r.status,'verified');assert.equal(c.initialEducation,0);assert.equal(c.education,4);
 assert.equal(c.trainingPoints,4);assert.equal(c.unspentTrainingPoints,2);assert.equal(c.annualTraining[0].education,4);
 assert.ok(has(run({...base,trainingSkills:['admin-2']}),'CLONE_INITIAL_SKILL'));
 assert.ok(has(run({...base,increaseINT:1,trainingIntSchedule:[event(1,1)]}),'CLONE_INITIAL_CHARACTERISTIC'));
});
test('Immature released clones do not borrow adult template characteristics',()=>{
 for(const [stop,years]of [[6,11],[12,5],[17,0]]){
  const r=run({...early,acceleratedStop:'early'+stop,partialCrecheEducation:'completed-only',trainingYears:years});
  assert.ok(has(r,'CLONE_IMMATURE_CHARACTERISTICS'));assert.equal(r.totals,null);
 }
});
test('Early-stop fees require a declared interpretation and never silently prorate growth',()=>{
 const unknown=run({...early,earlyGrowthPrice:'unresolved',trainingYears:12});
 assert.ok(has(unknown,'CLONE_EARLY_PRICE'));
 for(const [basis,charged]of [['first-year-included',11],['all-training-extra',12]]){
  const r=run({...early,earlyGrowthPrice:basis,trainingYears:12}),c=r.totals.clone;
  assert.equal(r.status,'verified');assert.equal(c.growthCost,150000);assert.equal(c.chargedTrainingYears,charged);assert.equal(c.trainingCost,charged*20000);
  assert.equal(r.totals.cost,10000+150000+charged*20000);assert.equal(r.ledger.reduce((n,e)=>n+e.cost,0),r.totals.cost);
 }
});
test('Timed INT events use cumulative differences without resetting characteristic prices',()=>{
 const r=run({trainingYears:3,increaseINT:3,trainingIntSchedule:[event(1,1),event(2,2),event(3,3)]}),c=r.totals.clone;
 assert.equal(r.status,'verified');assert.deepEqual(c.annualTraining.map(y=>y.intPointsThisYear),[2,4,8]);
 assert.deepEqual(c.annualTraining.map(y=>y.intPointsSpent),[2,6,14]);assert.deepEqual(c.annualTraining.map(y=>y.bankAfterIntPurchases),[6,6,2]);
 assert.deepEqual(c.annualTraining.map(y=>y.education),[5,6,7]);assert.deepEqual(c.annualTraining.map(y=>y.intelligence),[8,9,10]);
 assert.equal(c.trainingPoints,16);assert.equal(c.unspentTrainingPoints,2);assert.match(c.trainingTiming,/book does not specify/);
});
test('Saving points across years supports the printed plus-four cumulative cost of thirty',()=>{
 const r=run({...int14,trainingYears:7,increaseINT:4,trainingIntSchedule:[event(2,1),event(3,2),event(4,3),event(7,4)]}),c=r.totals.clone;
 assert.equal(r.status,'verified');assert.equal(c.characteristics.INT,18);assert.equal(c.trainingPoints,32);assert.equal(c.unspentTrainingPoints,2);
 assert.deepEqual(c.annualTraining.map(y=>y.intPointsThisYear),[0,2,4,8,0,0,16]);
 assert.equal(c.annualTraining.at(-1).intPointsSpent,30);assert.equal(c.education,14);
});
test('An eventual final budget cannot excuse an earlier INT prefix overspend',()=>{
 const r=run({trainingYears:4,increaseINT:3,trainingIntSchedule:[event(1,3)]});
 assert.equal(r.status,'invalid');assert.ok(has(r,'CLONE_INT_YEAR_BUDGET'));assert.ok(!has(r,'CLONE_TRAINING_BUDGET'));
});
test('The included-EDU interpretation reduces selectable prefix budgets without charging EDU twice',()=>{
 const r=run({eduAccounting:'included',trainingYears:5,increaseINT:3,trainingIntSchedule:[event(1,1),event(3,2),event(5,3)]}),c=r.totals.clone;
 assert.equal(r.status,'verified');assert.equal(c.trainingPoints,14);assert.equal(c.unspentTrainingPoints,0);
 assert.deepEqual(c.annualTraining.map(y=>y.selectablePointsAccrued),[6,8,10,12,14]);
 assert.deepEqual(c.annualTraining.map(y=>y.intPointsThisYear),[2,0,4,0,8]);assert.equal(c.education,9);assert.equal(c.characteristics.INT,10);
 assert.ok(has(run({eduAccounting:'included',trainingYears:3,increaseINT:3,trainingIntSchedule:[event(1,1),event(2,2),event(3,3)]}),'CLONE_INT_YEAR_BUDGET'));
});
test('INT schedules reconcile final increases and actual training duration',()=>{
 assert.ok(has(run({trainingYears:3,increaseINT:3,trainingIntSchedule:[event(3,2)]}),'CLONE_INT_SCHEDULE_FINAL'));
 assert.ok(has(run({trainingYears:1,increaseINT:1,trainingIntSchedule:[event(2,1)]}),'CLONE_INT_YEAR'));
});
test('EDU above the prior INT retains an unresolved rebase boundary',()=>{
 const r=run({trainingYears:5,increaseINT:1,trainingIntSchedule:[event(5,1)]});
 assert.equal(r.status,'blocked');assert.ok(has(r,'CLONE_INT_EDU_REBASE'));
});
test('Legacy single completion and an equivalent one-event schedule calculate the same result',()=>{
 const a=run({trainingYears:3,increaseINT:2,intTrainingYear:2}),b=run({trainingYears:3,increaseINT:2,trainingIntSchedule:[event(2,2)]});
 assert.equal(a.status,'verified');assert.equal(b.status,'verified');
 assert.deepEqual(a.totals.clone.annualTraining,b.totals.clone.annualTraining);assert.deepEqual(a.totals.clone.characteristics,b.totals.clone.characteristics);
 assert.equal(a.totals.clone.unspentTrainingPoints,b.totals.clone.unspentTrainingPoints);
});
test('Schedule validation rejects forged, unordered, repeated and out-of-range records',()=>{
 for(const schedule of [
  [event(0,1)],[event(17,1)],[event(1,5)],[event(1,2),event(2,1)],
  [event(2,1),event(1,2)],[event(1,1),event(1,2,'other')],
  [event(1,1,'duplicate'),event(2,2,'duplicate')],[{...event(1,1),cost:0}]
 ])assert.throws(()=>make({trainingIntSchedule:schedule}));
});
test('Natural-grown clone education and background never receive accelerated creche grants',()=>{
 const r=run({growth:'natural'}),c=r.totals.clone;
 assert.equal(r.status,'verified');assert.equal(c.maturityYears,18);assert.equal(c.education,null);assert.equal(c.initialEducation,null);
 assert.equal(c.trainingPoints,0);assert.deepEqual(c.annualTraining,[]);assert.deepEqual(r.totals.skills,[]);
 assert.ok(has(run({growth:'natural',trainingYears:1}),'CLONE_NATURAL_TRAINING'));
 assert.ok(has(run({growth:'natural',recordMode:'traveller'}),'CLONE_TRAVELLER_EDU'));
});
test('Clone migration supplies absent new defaults without sanitising malformed explicit inputs',()=>{
 const original=JSON.parse(exportDesign(make({trainingYears:2,increaseINT:1,intTrainingYear:2})));
 for(const field of ['acceleratedStop','acceleratedCalendar','earlyGrowthPrice','partialCrecheEducation','trainingIntSchedule'])delete original.special[field];
 const migrated=importDesign(JSON.stringify(original));
 assert.equal(migrated.special.acceleratedStop,'adult18');assert.equal(migrated.special.acceleratedCalendar,'included-year');
 assert.equal(migrated.special.earlyGrowthPrice,'unresolved');assert.equal(migrated.special.partialCrecheEducation,'unresolved');assert.deepEqual(migrated.special.trainingIntSchedule,[]);
 assert.equal(evaluateDesign(migrated).totals.clone.intTrainingSchedule[0].year,2);
 for(const [field,value]of [['trainingIntSchedule',{}],['acceleratedStop','early5'],['acceleratedCalendar','silently-reconciled']]){
  const bad=structuredClone(original);bad.special[field]=value;assert.throws(()=>importDesign(JSON.stringify(bad)));
 }
});
test('Save round-trip retains timed events and explicit growth interpretations without sharing references',()=>{
 const d=make({...early,acceleratedStop:'early12',partialCrecheEducation:'completed-only',trainingYears:6,increaseINT:2,trainingIntSchedule:[event(2,1),event(3,2)]});
 const saved=exportDesign(d),r=importDesign(saved);assert.deepEqual(r,d);
 r.special.trainingIntSchedule[0].cumulativeIncrease=3;assert.equal(d.special.trainingIntSchedule[0].cumulativeIncrease,1);
 assert.deepEqual(importDesign(saved),d);
});
test('Metadata exposes source-bounded stop choices and year-end schedule controls',()=>{
 const controls=getCatalogue(make()).stages.flatMap(s=>s.controls),stop=controls.find(c=>c.field==='acceleratedStop'),schedule=controls.find(c=>c.field==='trainingIntSchedule');
 assert.deepEqual(stop.choices.map(c=>c.id),['adult18',...Array.from({length:12},(_,i)=>'early'+(i+6)),'custom']);
 assert.equal(schedule.type,'custom-packages');assert.equal(schedule.maxItems,4);assert.match(schedule.description,/EDU is applied before/);
 assert.deepEqual(schedule.itemFields.find(c=>c.field==='year').choices.map(c=>c.id),Array.from({length:16},(_,i)=>i+1));
 assert.deepEqual(schedule.itemFields.find(c=>c.field==='cumulativeIncrease').choices.map(c=>c.id),[1,2,3,4]);
});

const fractional=(months,extra={})=>run({...early,...int14,acceleratedStop:'custom',acceleratedStopMonths:months,partialCrecheEducation:'completed-only',trainingYears:15,...extra});
test('Fractional 6.25 and 6.5 month stops preserve actual time without fractional points or prices',()=>{
 for(const months of [6.25,6.5]){
  const r=fractional(months),c=r.totals.clone;
  assert.equal(r.status,'verified');assert.equal(c.growthCalendar.stopElapsedYears,months/12);
  assert.equal(c.growthCalendar.stopApparentAge,months);assert.equal(c.growthCalendar.uncreditedPartialCrecheMonths,months-6);
  assert.equal(c.growthCalendar.totalCrecheMonths,180+months-6);assert.equal(c.growthCalendar.trainingExitApparentAge,months+15);
  assert.equal(c.ageing.effectiveAdultYears,months-3);assert.equal(c.trainingPoints,60);
  assert.equal(c.initialEducation,0);assert.equal(c.annualTraining[0].education,7);
  assert.equal(c.growthCost,150000);assert.equal(c.trainingCost,280000);assert.equal(c.chargedTrainingYears,14);
 }
});
test('Any positive pre-release fraction counts beyond an otherwise full sixteen-year creche allowance',()=>{
 assert.equal(fractional(6,{trainingYears:16}).status,'verified');
 for(const months of [6.0001,6.25,6.5,17.999]){
  const r=fractional(months,{trainingYears:16});
  assert.equal(r.status,'invalid');assert.ok(has(r,'CLONE_CRECHE_LIMIT'));
  assert.ok(Math.abs(r.development.growthCalendar.totalCrecheMonths-(192+months-6))<1e-12);
 }
});
test('Fractional release retains partial-credit and price choices and never certifies an immature adult template',()=>{
 assert.ok(has(fractional(6.25,{partialCrecheEducation:'unresolved'}),'CLONE_PARTIAL_CRECHE'));
 assert.ok(has(fractional(6.25,{earlyGrowthPrice:'unresolved'}),'CLONE_EARLY_PRICE'));
 const all=fractional(6.25,{earlyGrowthPrice:'all-training-extra'});
 assert.equal(all.status,'verified');assert.equal(all.totals.clone.growthCost,150000);assert.equal(all.totals.clone.trainingCost,300000);
 const immature=fractional(6.25,{trainingYears:11});
 assert.ok(has(immature,'CLONE_IMMATURE_CHARACTERISTICS'));assert.equal(immature.totals,null);
 const noGrant=fractional(6.5,{trainingYears:0,trainingSkills:['admin-0']});
 assert.ok(has(noGrant,'CLONE_TRAINING_BUDGET'));assert.ok(has(noGrant,'CLONE_IMMATURE_CHARACTERISTICS'));
});
test('Custom eighteen months is exactly ordinary adult maturation and custom six equals its earliest preset',()=>{
 for(const years of [0,2,15]){
  const adult=run({...int14,trainingYears:years}),custom=run({...int14,trainingYears:years,acceleratedStop:'custom',acceleratedStopMonths:18});
  assert.equal(custom.status,adult.status);assert.deepEqual(custom.totals,adult.totals);assert.deepEqual(custom.development,adult.development);
  assert.ok(!has(custom,'CLONE_EARLY_PRICE'));assert.ok(!has(custom,'CLONE_PARTIAL_CRECHE'));
 }
 const custom=fractional(6,{trainingYears:16}),preset=run({...early,...int14,partialCrecheEducation:'completed-only',trainingYears:16});
 assert.deepEqual(custom.totals,preset.totals);assert.deepEqual(custom.development,preset.development);
});
test('Finite fractional precision survives save round-trip without a hidden tenth-month grid',()=>{
 for(const months of [6.125,6.25,6.333333333,17.999]){
  const d=make({...early,acceleratedStop:'custom',acceleratedStopMonths:months,partialCrecheEducation:'completed-only',trainingYears:12});
  const restored=importDesign(exportDesign(d));
  assert.equal(restored.special.acceleratedStopMonths,months);
  assert.equal(evaluateDesign(restored).development.growthCalendar.stopApparentAge,months);
 }
 for(const value of [5.9999,18.0001,NaN,Infinity,-Infinity,'6.25',null,true]){
  assert.throws(()=>make({acceleratedStop:'custom',acceleratedStopMonths:value}));
 }
});
test('Old saves receive a missing custom-month default but malformed explicit values are rejected',()=>{
 const original=JSON.parse(exportDesign(make({...early,acceleratedStop:'early7'})));delete original.special.acceleratedStopMonths;
 const restored=importDesign(JSON.stringify(original));
 assert.equal(restored.special.acceleratedStopMonths,6);assert.equal(restored.special.acceleratedStop,'early7');
 for(const value of [null,'6.25',5.9,18.1]){
  const bad=structuredClone(original);bad.special.acceleratedStopMonths=value;assert.throws(()=>importDesign(JSON.stringify(bad)));
 }
});
test('Custom-stop metadata permits finite values within six to eighteen without an integer constraint',()=>{
 const c=getCatalogue(make()).stages.flatMap(s=>s.controls).find(c=>c.field==='acceleratedStopMonths');
 assert.equal(c.type,'number');assert.equal(c.min,6);assert.equal(c.max,18);assert.equal(c.default,6);
 assert.equal(c.integer,false);assert.equal(c.step,'any');
 assert.deepEqual(c.visibleWhen.allOf,[{field:'growth',equals:'accelerated'},{field:'acceleratedStop',equals:'custom'}]);
});
test('A stored custom fraction does not alter an unselected adult or natural-growth path',()=>{
 for(const growth of ['accelerated','natural']){
  const baseline=run({growth}),withHidden=run({growth,acceleratedStop:'adult18',acceleratedStopMonths:6.25});
  assert.equal(withHidden.status,baseline.status);assert.deepEqual(withHidden.totals,baseline.totals);
 }
});
