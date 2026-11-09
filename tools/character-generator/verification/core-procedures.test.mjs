import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CORE_PROCEDURE_VERSION,CORE_PROCEDURE_EFFECT_SCHEMA,
 ageingOutcome,ageingCrisis,injuryOutcome,medicalBill,settleMedicalCosts,
 pensionForCareer,assetPension,materialBenefit,benefitTableResult
} from '../engine/core-procedures.mjs';

const vectors=effects=>effects.filter(e=>e.kind==='stat').map(e=>e.value).sort((a,b)=>a-b);
const stats=effects=>effects.filter(e=>e.kind==='stat').map(e=>e.name);
function scenarios(effects) {
 let out=[[]];
 for(const effect of effects) {
  const options=effect.kind==='choice'?effect.options.flatMap(o=>scenarios(o.effects)):[[effect]];
  out=out.flatMap(before=>options.map(after=>[...before,...after]));
 }
 return out;
}
const cases=[];
const remember=value=>{cases.push(value);return value;};
test('Core procedure API version is explicit',()=>assert.equal(CORE_PROCEDURE_VERSION,1));
test('ageing outcomes -6 through 1 preserve exact losses and distinct choices',()=>{
 const expected={
  '-6':[-2,-2,-2,-1],'-5':[-2,-2,-2],'-4':[-2,-2,-1],'-3':[-2,-1,-1],
  '-2':[-1,-1,-1],'-1':[-1,-1],'0':[-1],'1':[]
 };
 for(const [score,losses] of Object.entries(expected)) {
  const outcome=remember(ageingOutcome({roll:4,terms:4-Number(score)}));
  assert.equal(outcome.effectiveRoll,Number(score));
  assert.equal(outcome.needsAdjudication,false);
  for(const row of scenarios(outcome.effects)) {
   assert.deepEqual(vectors(row),losses);
   assert.equal(new Set(stats(row)).size,row.length);
   if(Number(score)===-6) {
    assert.deepEqual(stats(row).filter(s=>['STR','DEX','END'].includes(s)).sort(),['DEX','END','STR']);
    assert.equal(stats(row).filter(s=>['INT','EDU','SOC'].includes(s)).length,1);
   }
  }
 }
});
test('anagathic terms offset only the ageing roll, with no hidden RNG',()=>{
 const input={roll:7,terms:8,anagathicTerms:3};
 const copy=structuredClone(input);
 const r=remember(ageingOutcome(input));
 assert.equal(r.effectiveRoll,2);
 assert.deepEqual(r.effects,[]);
 assert.deepEqual(input,copy);
 assert.deepEqual(ageingOutcome(input),r);
});
test('ageing below the printed minimum is explicitly unresolved',()=>{
 const r=remember(ageingOutcome({roll:2,terms:9}));
 assert.equal(r.effectiveRoll,-7);
 assert.equal(r.needsAdjudication,true);
 assert.deepEqual(r.effects,[]);
 assert.match(r.reason,/-6/);
});
test('ageing crisis requires a die and distinguishes care from death',()=>{
 const input={stats:{STR:0,DEX:-1,END:5,INT:8,EDU:7,SOC:6,PSI:0}};
 const pending=remember(ageingCrisis(input));
 assert.equal(pending.crisis,true);
 assert.deepEqual(pending.affected,['STR','DEX']);
 assert.deepEqual(pending.requiredRoll,{purpose:'Ageing crisis medical cost',dice:'1D'});
 const resolved=remember(ageingCrisis({...input,medicalDie:4}));
 assert.equal(resolved.cost,40000);
 const [care,death]=resolved.effects[0].options;
 assert.deepEqual(care.effects,[
  {kind:'medical-cost',value:40000},{kind:'stat',name:'STR',value:1},
  {kind:'stat',name:'DEX',value:2},{kind:'qualification-ban',permanent:true}
 ]);
 assert.deepEqual(death.effects,[{kind:'death',cause:'ageing'}]);
 assert.deepEqual(input.stats,{STR:0,DEX:-1,END:5,INT:8,EDU:7,SOC:6,PSI:0});
});
test('pre-existing zero PSI does not trigger a Core ageing crisis',()=>{
 const r=remember(ageingCrisis({stats:{STR:5,DEX:5,END:5,INT:5,EDU:5,SOC:5,PSI:0}}));
 assert.equal(r.crisis,false);
 assert.deepEqual(r.effects,[]);
});
test('injury results require severity dice only for results 1 and 2',()=>{
 for(const roll of [1,2]) {
  const r=remember(injuryOutcome({roll}));
  assert.equal(r.requiredRoll.dice,'1D');
  assert.deepEqual(r.effects,[]);
 }
 for(const severityDie of [1,3,6]) {
  const one=remember(injuryOutcome({roll:1,severityDie}));
  for(const row of scenarios(one.effects)) {
   assert.deepEqual(vectors(row),[-severityDie,-2,-2].sort((a,b)=>a-b));
   assert.deepEqual(stats(row).sort(),['DEX','END','STR']);
  }
  const two=remember(injuryOutcome({roll:2,severityDie}));
  for(const row of scenarios(two.effects)) assert.deepEqual(vectors(row),[-severityDie]);
 }
});
test('injury 3 excludes END, result 6 has no permanent loss',()=>{
 const three=remember(injuryOutcome({roll:3}));
 assert.deepEqual(three.effects[0].options.map(o=>o.effects[0].name),['STR','DEX']);
 for(const row of scenarios(three.effects)) assert.deepEqual(vectors(row),[-2]);
 for(const roll of [4,5]) {
  const r=remember(injuryOutcome({roll}));
  assert.deepEqual(r.effects[0].options.map(o=>o.effects[0].name),['STR','DEX','END']);
  scenarios(r.effects).forEach(row=>assert.deepEqual(vectors(row),[roll===4?-2:-1]));
 }
 assert.deepEqual(remember(injuryOutcome({roll:6})).effects,[]);
});
test('medical contribution is exact across every Core band, career and rank',()=>{
 const groups=[
  [['army','navy','marine'],[75,100,100]],
  [['agent','noble','scholar','entertainer','merchant','citizen'],[50,75,100]],
  [['scout','rogue','drifter'],[0,50,75]]
 ];
 for(const [names,rates] of groups) for(const name of names) {
  for(let roll=2;roll<=12;roll++) for(let rank=0;rank<=6;rank++) {
   const r=medicalBill({careerId:'core.'+name,roll,rank,restoredPoints:3});
   const score=roll+rank;
   const expected=score>=12?rates[2]:score>=8?rates[1]:score>=4?rates[0]:0;
   assert.equal(r.coveragePercent,expected,name+' '+score);
   assert.equal(r.totalCost,15000);
   assert.equal(r.coveredCost,15000*expected/100);
   assert.equal(r.personalCost,15000*(100-expected)/100);
   assert.equal(r.personalCost+r.coveredCost,r.totalCost);
  }
 }
 remember(medicalBill({careerId:'core.army',roll:4,rank:0,restoredPoints:2}));
});
test('medical quotes remain separate from payment and unlisted careers do not receive fabricated coverage',()=>{
 const pending=remember(medicalBill({careerId:'core.army',restoredPoints:2,rank:3}));
 assert.deepEqual(pending.requiredRoll,{purpose:'Organisation medical contribution',dice:'2D'});
 assert.equal(pending.modifier,3);
 for(const careerId of ['core.prisoner','core.psion','aslan.military','constructor','__proto__']) {
  const r=remember(medicalBill({careerId,roll:12,rank:6,restoredPoints:2}));
  assert.equal(r.needsAdjudication,true);
  assert.deepEqual(r.effects,[]);
 }
 const privateCare=remember(medicalBill({restoredPoints:2,inService:false}));
 assert.equal(privateCare.coveragePercent,0);
 assert.equal(privateCare.personalCost,10000);
 assert.deepEqual(privateCare.effects,[{kind:'medical-cost',value:10000}]);
 const free=remember(medicalBill({restoredPoints:0}));
 assert.equal(free.personalCost,0);
 assert.deepEqual(free.effects,[]);
});
test('settlement spends available cash and records only the unpaid shortfall',()=>{
 const full=remember(settleMedicalCosts({cash:12000,cost:10000}));
 assert.equal(full.paid,10000);assert.equal(full.remainingCash,2000);assert.equal(full.debt,0);
 assert.deepEqual(full.effects,[{kind:'cash',value:-10000}]);
 const partial=remember(settleMedicalCosts({cash:3000,cost:10000}));
 assert.equal(partial.remainingCash,0);assert.equal(partial.debt,7000);
 assert.deepEqual(partial.effects,[{kind:'cash',value:-3000},{kind:'debt',value:7000}]);
 assert.deepEqual(remember(settleMedicalCosts({cash:0,cost:0})).effects,[]);
});
test('career pensions follow the five-term threshold and published exclusions',()=>{
 for(const career of ['agent','army','citizen','entertainer','marine','merchant','navy','noble','scholar','psion']) {
  for(const [terms,amount] of [[0,0],[4,0],[5,10000],[6,12000],[7,14000],[8,16000],[9,18000],[10,20000]]) {
   const r=remember(pensionForCareer({careerId:'core.'+career,terms}));
   assert.equal(r.annualCredits,amount);
   assert.equal(r.eligible,terms>=5);
  }
 }
 for(const career of ['scout','rogue','prisoner','drifter']) {
  assert.equal(remember(pensionForCareer({careerId:'core.'+career,terms:12})).annualCredits,0);
 }
 assert.equal(remember(pensionForCareer({careerId:'aslan.envoy',terms:6})).needsAdjudication,true);
});
test('unused ship shares and foregone ships produce annual dividends, not cash redemption',()=>{
 const r=remember(assetPension({unusedShipShares:3,foregoneShipAwards:2}));
 assert.equal(r.sharePension,3000);
 assert.equal(r.shipPension,50000);
 assert.equal(r.annualCredits,53000);
 assert.equal(r.redeemableForCash,false);
 assert.deepEqual(r.effects,[]);
});
test('TAS repeats become two ship shares; Scout repeats reroll without extra roll consumption',()=>{
 assert.deepEqual(remember(materialBenefit({name:'TAS Membership'})).effects,[{kind:'benefit',name:'TAS Membership',value:1}]);
 assert.deepEqual(remember(materialBenefit({name:'TAS Membership',previousCount:1})).effects,[{kind:'benefit',name:'Ship Share',value:2}]);
 const scout=remember(materialBenefit({name:'Scout Ship'})).effects[0];
 assert.equal(scout.kind,'ship-use');assert.equal(scout.owner,'Scout Service');assert.equal(scout.recallable,true);
 assert.deepEqual(remember(materialBenefit({name:'Scout Ship',previousCount:1})).effects,[{kind:'reroll-benefit',table:'material',consumeExtraRoll:false}]);
});
test('ship mortgage awards add 25 percent to the same ship and fifth awards require a ruling',()=>{
 for(const name of ['Free Trader','Lab Ship','Yacht']) {
  for(let count=0;count<4;count++) {
   const r=remember(materialBenefit({name,previousCount:count})),e=r.effects[0];
   assert.equal(e.kind,'ship-mortgage');
   assert.equal(e.family,name);
   assert.equal(e.percentDelta,25);
   assert.equal(e.percentAfter,(count+1)*25);
   assert.equal(!!e.quirks,count===0);
   if(count===0) assert.equal(e.quirks.countDice,'1D');
  }
  assert.equal(remember(materialBenefit({name,previousCount:4})).needsAdjudication,true);
 }
 assert.deepEqual(materialBenefit({name:'Free Trader'}).effects[0].variants,['Free Trader','Far Trader']);
 assert.deepEqual(materialBenefit({name:'Yacht'}).effects[0].variants,['Yacht','Safari Ship']);
});
test('initial equipment benefits carry exact Credit and TL limits',()=>{
 const expected={
  Armour:[10000,12],Blade:[1000,12],Gun:[3000,12],Weapon:[3000,12],

  'Scientific Equipment':[2000,12],'Personal Vehicle':[300000,10],
  'Cybernetic Implant':[75000,12],"Ship's Boat":[10000000,12]
 };
 for(const [name,[cost,tl]] of Object.entries(expected)) {
  const e=remember(materialBenefit({name})).effects[0];
  assert.equal(e.kind,'equipment-choice');assert.equal(e.maximumCost,cost);assert.equal(e.maximumTL,tl);
 }
 assert.deepEqual(materialBenefit({name:'Gun'}).effects[0].restrictions,['common-or-military-ranged']);
 assert.deepEqual(materialBenefit({name:'Personal Vehicle'}).effects[0].restrictions,['unarmed']);
 assert.equal(materialBenefit({name:'Ship’s Boat'}).name,"Ship's Boat");
});
test('repeated gear exposes exact alternatives and does not silently grant another item',()=>{
 const armour=remember(materialBenefit({name:'Armour',previousCount:1})).effects[0].options;
 assert.equal(armour[0].effects[0].maximumCost,10000);
 assert.equal(armour[1].effects[0].maximumCost,25000);
 assert.equal(armour[1].effects[0].replaceOriginal,true);
 const blade=remember(materialBenefit({name:'Blade',previousCount:1})).effects[0].options;
 assert.deepEqual(blade[1].effects,[{kind:'skill',name:'Melee (blade)',mode:'increase',value:1}]);
 for(const name of ['Gun','Weapon']) {
  const e=remember(materialBenefit({name,previousCount:1})).effects[0].options[1].effects[0];
  assert.equal(e.kind,'weapon-skill-choice');
  assert.equal(e.previousBenefitOnly,true);
  assert.deepEqual(e.allowedBases,name==='Gun'?['Gun Combat']:['Melee','Gun Combat']);
 }
 const science=remember(materialBenefit({name:'Scientific Equipment',previousCount:1})).effects[0].options;
 assert.equal(science.length,3);
 assert.equal(science[1].effects[0].name,'Electronics');assert.equal(science[2].effects[0].name,'Science');
 const vehicle=remember(materialBenefit({name:'Personal Vehicle',previousCount:1})).effects[0].options;
 assert.deepEqual(vehicle.map(o=>o.effects[0].name),['Drive','Flyer']);
 const cyber=remember(materialBenefit({name:'Cybernetic Implant',previousCount:1})).effects[0].options[1].effects[0];
 assert.equal(cyber.levels,1);assert.equal(cyber.ignoreOriginalLimits,true);
 const boat=remember(materialBenefit({name:"Ship's Boat",previousCount:1})).effects[0].options;
 assert.equal(boat[0].effects[0].name,'Pilot (small craft)');
 assert.equal(boat[1].effects[0].name,'Ship Share');
});
test('simple shares and relationships are supported, unknown or bulk named awards are explicit',()=>{
 const shares=remember(materialBenefit({name:'Ship share',quantity:10,previousCount:4}));
 assert.deepEqual(shares.effects,[{kind:'benefit',name:'Ship Share',value:10}]);
 assert.equal(shares.redeemableForCash,false);
 for(const name of ['Contact','Ally']) assert.deepEqual(remember(materialBenefit({name})).effects,[{kind:'relationship',type:name,count:1}]);
 assert.equal(remember(materialBenefit({name:'Combat Implant'})).needsAdjudication,true);
 assert.equal(remember(materialBenefit({name:'Armour',quantity:2})).needsAdjudication,true);
});
test('benefit lookup handles exact rows without silently clamping overflow',()=>{
 const rows=[0,100,200,300,400,500,600];
 for(let roll=1;roll<=6;roll++) {
  const r=remember(benefitTableResult({roll,modifier:1,rows,page:56}));
  assert.equal(r.index,roll);
  assert.equal(r.row,rows[roll]);
  assert.deepEqual(r.effects,[{kind:'cash',value:rows[roll]}]);
 }
 for(const modifier of [-1,2,6]) {
  const roll=modifier<0?1:6;
  const r=remember(benefitTableResult({roll,modifier,rows}));
  assert.equal(r.needsAdjudication,true);
  assert.deepEqual(r.effects,[]);
 }
 const effects=[[{kind:'benefit',name:'Weapon',value:1}]];
 const r=remember(benefitTableResult({roll:1,rows:effects}));
 r.effects[0].value=2;
 assert.equal(effects[0][0].value,1,'The selected row must be copied');
});
test('invalid input is rejected rather than coerced',()=>{
 const bad=[
  ()=>ageingOutcome({roll:1,terms:4}),()=>ageingOutcome({roll:8,terms:4,anagathicTerms:5}),
  ()=>ageingOutcome({roll:'8',terms:4}),()=>ageingCrisis({stats:{}}),
  ()=>ageingCrisis({stats:{STR:0},medicalDie:7}),()=>injuryOutcome({roll:0}),
  ()=>injuryOutcome({roll:1,severityDie:7}),()=>medicalBill({restoredPoints:-1}),
  ()=>medicalBill({restoredPoints:2,careerId:{}}),()=>medicalBill({restoredPoints:2,rank:7}),
  ()=>medicalBill({restoredPoints:2,inService:'yes'}),()=>settleMedicalCosts({cash:-1,cost:2}),
  ()=>pensionForCareer({careerId:'core.army',terms:5.5}),()=>assetPension({unusedShipShares:-1}),
  ()=>materialBenefit({name:'Armour',previousCount:-1}),()=>materialBenefit({name:3}),
  ()=>materialBenefit({name:'Ship Share',quantity:0}),()=>benefitTableResult({roll:1,rows:[]}),
  ()=>benefitTableResult({roll:1,rows:[1,[]]}),()=>benefitTableResult({roll:1,rows:[1],modifier:Infinity})
 ];
 bad.forEach(call=>assert.throws(call));
});
test('procedure outputs use documented effects and plain source-safe JSON data',()=>{
 function visit(value) {
  if(Array.isArray(value)) return value.forEach(visit);
  if(value&&typeof value==='object') {
   if(value.kind) assert.ok(Object.hasOwn(CORE_PROCEDURE_EFFECT_SCHEMA,value.kind),value.kind);
   Object.values(value).forEach(visit);
  }
 }
 for(const value of cases) {
  visit(value);
  assert.deepEqual(JSON.parse(JSON.stringify(value)),value);
  assert.equal(value.source.id,'core');
  assert.ok(!/https?:\/\/|libfile_|Order #/i.test(JSON.stringify(value)));
 }
});
