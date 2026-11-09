import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPANSION_PACK as pack,PRECAREER_RULES as pre,SPECIES_RULES as species,SOURCE_DISCREPANCIES,BENEFIT_RULES,EXPANDED_CHARACTERISTIC_DM} from '../engine/expansion-pack.mjs';

test('all 31 approved expansion careers have complete numeric training and benefit tables',()=>{
 assert.equal(Object.keys(pack).length,31);
 assert.equal(Object.keys(pack).filter(x=>x.startsWith('aslan.')).length,11);
 assert.equal(Object.keys(pack).filter(x=>x.startsWith('vargr.')).length,9);
 assert.equal(Object.keys(pack).filter(x=>x.startsWith('zhodani.')).length,9);
 for(const [id,c] of Object.entries(pack)){
  assert.ok(!/k.?kree/i.test(id));
  assert.ok(c.source.title && c.source.pages.every(Number.isInteger));
  assert.equal(c.training.personal.length,6,id);
  assert.equal(c.training.service.length,6,id);
  for(const t of ['advanced','officer','psionic']) if(c.training[t])assert.equal(c.training[t].length,6,id+':'+t);
  for(const [assignment,table] of Object.entries(c.training.assignments)){
   assert.equal(table.length,id==='aslan.military'?9:6,id+':'+assignment);
   assert.ok(c.checks[assignment],id+':'+assignment+' checks');
   table.forEach(row=>assert.ok(Array.isArray(row)));
  }
  assert.equal(c.benefits.cash.length,c.benefits.material.length,id);
  assert.ok(c.benefits.cash.every(n=>Number.isInteger(n)&&n>=0),id);
  assert.equal(Object.keys(c.events).length,11,id);
  assert.equal(Object.keys(c.mishaps).length,6,id);
  const tracks=[...Object.entries(c.ranks).filter(([key])=>key!=='assignments').map(([,value])=>value),...Object.values(c.ranks.assignments??{})];
  for(const t of tracks){assert.equal(t.length,7,id);t.forEach((r,i)=>assert.equal(r.rank,i));}
 }
});
test('detailed career entries override inconsistent summaries',()=>{
 assert.deepEqual(pack['vargr.merchant'].prerequisites.qualification,{stat:'CHA',target:6});
 assert.deepEqual(pack['vargr.scientist'].prerequisites.qualification,{stat:'INT',target:8});
 assert.deepEqual(pack['vargr.citizen'].checks.worker.advancement,{stat:'CHA',target:6});
 assert.deepEqual(pack['aslan.scientist'].checks.healer.survival,{stat:'END',target:5});
 assert.deepEqual(pack['aslan.scientist'].checks.researcher.survival,{stat:'END',target:6});
 assert.deepEqual(pack['aslan.guardian'].prerequisites.qualificationModifiers,[{condition:{stat:'EDU',min:9},dm:2}]);
 assert.ok(SOURCE_DISCREPANCIES.some(d=>d.id==='aslan.space-officer.rank-labels'));
 assert.equal(pack['aslan.space-officer'].ranks.assignments.navigator[1].effects[0].kind,'source-required');
});
test('species exceptions preserve exact dice, background, cash and ageing rules',()=>{
 assert.deepEqual(species.aslan.dice.STR,[2,1]);assert.deepEqual(species.aslan.dice.DEX,[2,-1]);assert.deepEqual(species.aslan.dice.END,[2,1]);
 assert.equal(species.aslan.ageing.startAge,42);assert.equal(species.aslan.ageing.termDMMultiplier,-2);
 assert.equal(species.aslan.cash.female.maximumRolls,null);assert.equal(species.aslan.cash.male.multiplier,0.5);
 assert.equal(species.vargr.additionalBackground[0].name,'Melee');assert.equal(species.vargr.additionalBackground[0].value,0);
 assert.deepEqual(species.vargr.imperial.CHA,[1,2]);assert.equal(species.vargr.priorCareerQualificationPenalty,0);
 assert.deepEqual(species.aezorgh.dice,{STR:[1,0],DEX:[2,3],END:[1,1],INT:[2,2],EDU:[1,0],SOC:[1,0]});
 assert.equal(species.aezorgh.ageing.dm,4);assert.equal(species.aezorgh.ageing.untilAgeExclusive,82);
 assert.equal(species.aezorgh.precareer.graduationDM,-2);assert.equal(species.aezorgh.vargrCharisma.round,'floor');
 assert.equal(species.aezorgh.background.choiceCount,1);assert.equal(species.aezorgh.maxima.DEX,18);
});
test('Zhodani status, psionic training and career entry restrictions are explicit',()=>{
 assert.deepEqual(species.zhodani.optionalPsi.results,[9,9,10,10,11,12]);
 assert.equal(species.zhodani.optionalPsi.minimumSOC,10);assert.equal(species.zhodani.optionalPsi.nobleSOCMin,11);
 assert.equal(species.zhodani.background.SOCMax,9);assert.equal(species.zhodani.background.otherwise,'psionic-training');
 assert.equal(pack['zhodani.agent'].prerequisites.advanced.min,10);
 assert.equal(pack['zhodani.prole'].prerequisites.advanced.min,6);
 assert.equal(pack['zhodani.prole'].basicTraining.table,'assignment');
 assert.equal(pack['zhodani.guard'].prerequisites.assignments.commando.min,9);
 assert.equal(species.zhodani.automaticAdvancementOrCommission.draftedTerm,2);
 assert.equal(species.zhodani.governmentRankCap.maximum,3);
});
test('Companion pathways preserve entry and graduation differences',()=>{
 assert.equal(Object.keys(pre).length,5);
 assert.deepEqual(pre['companion.colonial'].firstCareerAge,{base:22,dice:'2D3'});
 assert.equal(pre['companion.colonial'].graduation.honours,12);
 assert.equal(pre['companion.merchant'].graduation.honours,11);
 assert.equal(pre['companion.merchant'].advancementDM.honours,2);
 assert.equal(pre['companion.psionic'].source.pages[0],33);
 assert.equal(pre['companion.spacer'].entry.otherwise.target,4);
 assert.equal(pre['companion.hard-knocks'].laterCareer.penaltyEndsOnlyAfterVoluntaryExit,true);
 assert.equal(pack['companion.truther'].prerequisites.noRank,true);
 assert.equal(pack['companion.believer'].basicTraining.table,'assignment');
 assert.equal(BENEFIT_RULES.Patronage.annualCredits,10000);
});
test('skill awards distinguish rank floors, ordinary increases and special acquisition',()=>{
 const rank=pack['vargr.agent'].ranks.assignments.enforcer[1].effects[0];
 assert.deepEqual(rank,{kind:'skill',name:'Melee',mode:'set',value:1});
 assert.equal(pack['vargr.agent'].training.personal[0][0].mode,'increase');
 assert.equal(pack['aslan.envoy'].training.personal[2][0].kind,'conditional');
 assert.equal(pack['aslan.envoy'].training.personal[2][0].then[0].kind,'independence');
 assert.equal(pack['vargr.psion'].training.service[0][0].scope,'psionic-talents');
 assert.equal(pack['vargr.spacer'].benefits.material[5][0].kind,'assignment-effect');
 assert.equal(pack['zhodani.prole'].benefits.material[6][0].maximum,9);
});
test('expanded high-characteristic DM is optional and cited',()=>{
 assert.equal(EXPANDED_CHARACTERISTIC_DM.optional,true);
 assert.deepEqual(EXPANDED_CHARACTERISTIC_DM.bands.at(-1),[21,23,5]);
});
test('source data contains no private source locations or source-book prose',async()=>{
 const text=await readFile(new URL('../engine/expansion-pack.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(text,/drive\.google\.com|Order\s*#\d{5,}|Science Fict ion Adventure/);
});



test('every career event and mishap has mechanical data or an explicit bounded exception',()=>{
 let eventRows=0,mishapRows=0;
 for(const [id,c] of Object.entries(pack)){
  for(const [roll,row] of Object.entries(c.events)){
   eventRows++;assert.ok(Array.isArray(row)&&row.length>0,id+':event:'+roll);
   assert.ok(!JSON.stringify(row).includes('no default outcome is applied'),id+':event:'+roll);
  }
  for(const [roll,row] of Object.entries(c.mishaps)){
   mishapRows++;assert.ok(Array.isArray(row)&&row.length>0,id+':mishap:'+roll);
   assert.ok(!JSON.stringify(row).includes('no default outcome is applied'),id+':mishap:'+roll);
  }
  assert.ok(['encoded','partial'].includes(c.coverage.events));
  assert.ok(['encoded','partial'].includes(c.coverage.mishaps));
  assert.ok(c.unsupported.every(u=>u.reason&&u.source?.pages?.length));
 }
 assert.equal(eventRows,341);assert.equal(mishapRows,186);
});
test('psionic skill results never bypass talent acquisition through ordinary skill effects',()=>{
 const talents=['Awareness','Clairvoyance','Telekinesis','Telepathy','Teleportation','Technopathy'];
 function walk(x){
  if(!x||typeof x!=='object')return;
  if(x.kind==='skill')assert.ok(!talents.includes(x.name),x.name);
  Object.values(x).forEach(walk);
 }
 walk(pack);
 assert.equal(pack['zhodani.guard'].training.psionic[5][0].kind,'psionic-talent');
 assert.equal(pack['zhodani.guard'].training.psionic[5][0].name,'Teleportation');
});
test('event and mishap exceptions retain their consequential numeric differences',()=>{
 assert.equal(pack['companion.believer'].events[11][0].value,-2);
 assert.equal(pack['companion.believer'].events[11][0].scope,'all');
 assert.equal(pack['vargr.merchant'].mishaps[6][0].dice,'D3');
 assert.equal(pack['vargr.merchant'].mishaps[6][0].value,-1);
 assert.equal(pack['aslan.military'].events[10][0].ignoreMinimumThreeTerms,true);
 assert.equal(pack['aslan.military'].events[10][0].dmFrom,'current-career-terms');
 assert.equal(pack['zhodani.merchant'].events[3][1].retainRank,true);
 assert.equal(pack['zhodani.agent'].events[2][0].keepCareerThroughReeducation,true);
 const secretResearch=pack['zhodani.scholar'].mishaps[3][0].options[1].effects;
 assert.ok(secretResearch.some(e=>e.kind==='benefit-rolls'&&e.mode==='lose-term'));
 assert.ok(!secretResearch.some(e=>e.kind==='benefit-rolls'&&e.mode==='lose-all'));
});
test('shared tables are distinct from career tables and have cited complete result ranges',async()=>{
 const {EXPANSION_TABLES:tables}=await import('../engine/expansion-pack.mjs');
 assert.equal(Object.keys(tables).length,10);
 for(const [id,t] of Object.entries(tables)){
  assert.ok(t.source.pages.every(Number.isInteger),id);
  if(t.onlyDoubles)assert.deepEqual(Object.keys(t.results).map(Number),[2,4,6,8,10,12]);
  else assert.equal(Object.keys(t.results).length,t.dice==='2D'?11:6,id);
 }
 assert.equal(tables['zhodani.re-education'].results[1][0].careerTerm,false);
 assert.equal(tables['zhodani.re-education'].results[1][0].years,4);
 assert.equal(tables['zhodani.re-education'].anagathicsDMPerTerm,-1);
 assert.equal(tables['aslan.rite-doubles'].results[2][0].dice,'1D');
 assert.equal(species.zhodani.proleSOC.overflowBenefit,'Ship Share');
});
test('exports are immutable and contain no excluded species',()=>{
 assert.ok(Object.isFrozen(pack));assert.ok(Object.isFrozen(pack['vargr.agent'].events));
 assert.throws(()=>{pack['vargr.agent'].benefits.cash[0]=7;},TypeError);
 assert.doesNotMatch(JSON.stringify(Object.keys(pack)),/k.?kree/i);
});
