import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {evaluateComputer} from '../engine/computer-implants.mjs';

const tiers={'clone-creator':[[1,8,2000],[2,10,20000],[3,13,200000]],'fab-creator':[[1,8,2000],[2,10,5000],[3,13,20000],[4,17,50000]],'drone-control':[[1,11,2000],[2,12,5000]],'swarm-control':[[1,11,15000],[2,12,30000],[3,13,60000],[4,14,120000]]};
const program=(program,rating,runningBandwidth=-1,extra={})=>({id:program,parentComputer:'computer',program,rating,runningBandwidth,subject:'',databasePrice:10,expertUse:'assisted',...extra});
const evaluate=(records,tl=17,processing=5)=>evaluateComputer({tl,cost:1000,massKg:1,effects:{processing}}, {},records,tl);
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const make=(computerSoftware,augmentations=[{id:'computer',optionId:'misc-mass-portable-computer-14',parameters:{computerRatedTL:17}}])=>updateDesign(createDesign({kind:'cyborg',techLevel:17}),{special:{cyborgMode:'augments',augmentations,computerSoftware}});

test('all thirteen Handbook tiers retain purchase price, source, TL and stored inactivity',()=>{
 for(const [family,rows] of Object.entries(tiers))for(const [rating,tl,cost] of rows){
  const r=evaluate([program(family,rating)],7,0),p=r.profile.programs[0];
  assert.equal(p.cost,cost);assert.equal(p.minimumTL,tl);assert.equal(r.profile.softwareBaseCost,cost);
  assert.equal(p.active,false);assert.equal(p.effects,undefined);assert.equal(r.profile.activeBandwidth,0);
  assert.equal(p.recipientSkillGranted,false);assert.equal(r.profile.robotBrain,false);
  assert.deepEqual(p.source,{book:'Robot Handbook',edition:'Mongoose 2022',pages:family==='clone-creator'?'122':'123'});
  assert.ok(!has(r,'COMPUTER_PROGRAM_TL'));assert.ok(!has(r,'COMPUTER_CONTROL_INTERFACE'));
  const active=evaluate([program(family,rating,1)],tl-1);
  assert.ok(has(active,'COMPUTER_PROGRAM_TL'));assert.equal(active.diagnostics.find(d=>d.code==='COMPUTER_PROGRAM_TL').source.book,'Robot Handbook');
 }
 assert.equal(evaluate([program('interface',0,0)]).profile.programs[0].source.book,'Core Rulebook Update 2022');
});

test('creator effects follow active rating and never grant production, facilities or surgery',()=>{
 for(const family of ['clone-creator','fab-creator']){
  const p=evaluate([program(family,3,1)]).profile.programs[0];
  assert.equal(p.effects.designDM,1);assert.equal(p.effects.designTier,1);
  assert.equal(p.effects.taskScope,family==='clone-creator'?'novel-genetic-design':'novel-fabricator-design');
  assert.equal(p.effects.manufacturingGranted,false);assert.equal(p.effects.surgeryGranted,false);assert.equal(p.effects.facilityIncluded,false);
  assert.equal(p.effects.canDesignNanorobots,false);
 }
 assert.equal(evaluate([program('fab-creator',4,3)]).profile.programs[0].effects.canDesignNanorobots,true);
 assert.equal(evaluate([program('fab-creator',4,3)]).profile.softwareBaseCost,50000);
});

test('control software requires active Intelligent Interface regardless of Expert mode',()=>{
 for(const family of ['drone-control','swarm-control']){
  for(const extra of [{},{expertUse:'autonomous'}]){
   const p=program(family,2,1,extra);
   assert.ok(has(evaluate([p]),'COMPUTER_CONTROL_INTERFACE'));
   assert.ok(has(evaluate([p,program('intelligent-interface',1)]),'COMPUTER_CONTROL_INTERFACE'));
   assert.ok(has(evaluate([p,program('intellect',1,1)]),'COMPUTER_CONTROL_INTERFACE'));
   assert.ok(!has(evaluate([p,program('intelligent-interface',1,1)]),'COMPUTER_CONTROL_INTERFACE'));
  }
 }
});

test('control limits are software-only and controller, link and targets stay unverified',()=>{
 for(const family of ['drone-control','swarm-control'])for(const [rating] of tiers[family]){
  const r=evaluate([program(family,rating,rating),program('intelligent-interface',1,1)]),p=r.profile.programs[0];
  assert.ok(has(r,'COMPUTER_CONTROL_HARDWARE_UNVERIFIED'));
  assert.equal(p.effects.hardwareVerified,false);assert.equal(p.effects.targetVerified,false);assert.equal(p.effects.operationalControlCertified,false);
  assert.equal(p.effects.hardwareAlternatives.length,2);assert.equal(p.recipientSkillGranted,false);
  if(family==='drone-control'){assert.equal(p.effects.controlDM,rating-1);assert.equal(p.effects.maxDrones,1);}
  else{assert.equal(p.effects.maxTasks,rating);assert.equal(p.effects.maxSkill,rating-1);}
  assert.equal(r.softwareCost,tiers[family].find(t=>t[0]===rating)[2]+100);
 }
});

test('active ratings consume Processing, including the prerequisite interface',()=>{
 assert.ok(has(evaluate([program('swarm-control',4,4),program('intelligent-interface',1,1)],17,4),'COMPUTER_PROCESSING'));
 const r=evaluate([program('swarm-control',4,2),program('intelligent-interface',1,1)],17,3);
 assert.ok(!has(r,'COMPUTER_PROCESSING'));assert.equal(r.profile.activeBandwidth,3);
 assert.equal(r.profile.programs[0].effects.maxTasks,2);assert.equal(r.profile.programs[0].effects.maxSkill,1);
});

test('installed computer parents isolate licences, interfaces and capacity',()=>{
 const records=[program('swarm-control',4,4),program('intelligent-interface',1,1,{parentComputer:'other'})];
 const augments=[{id:'computer',optionId:'misc-mass-portable-computer-14',parameters:{}},{id:'other',optionId:'misc-mass-portable-computer-14',parameters:{}}];
 const r=evaluateDesign(make(records,augments));assert.ok(has(r,'COMPUTER_CONTROL_INTERFACE'));
 const valid=evaluateDesign(make(records.map(p=>({...p,parentComputer:'computer'})),augments));
 assert.ok(!has(valid,'COMPUTER_CONTROL_INTERFACE'));
 const computers=valid.totals.augmentations.map(a=>a.generalComputer);
 assert.equal(computers[0].softwareBaseCost,120100);assert.equal(computers[1].softwareBaseCost,0);
 assert.equal(computers[0].activeBandwidth,5);assert.equal(computers[1].activeBandwidth,0);
 assert.equal(valid.totals.cost,valid.ledger.reduce((n,e)=>n+e.cost,0));
});

test('metadata, schema and roundtrip preserve finite family choices without generic brain packages',()=>{
 const d=make([program('fab-creator',4,3)]),c=getCatalogue(d).stages.flatMap(s=>s.controls).find(c=>c.field==='computerSoftware');
 const rating=c.itemFields.find(f=>f.field==='rating'),active=c.itemFields.find(f=>f.field==='runningBandwidth');
 for(const [family,rows] of Object.entries(tiers)){
  assert.deepEqual(rating.choicesBy.values[family].map(t=>t.id),rows.map(t=>t[0]));
  assert.deepEqual(active.choicesBy.values[family].map(t=>t.id),[-1,...rows.map(t=>t[0])]);
  for(const invalid of [program(family,0),program(family,rows.length+1),program(family,1,0),program(family,1,2),program(family,1,-1,{parentComputer:'absent'}),{...program(family,1),cost:1}])assert.throws(()=>make([invalid]));
 }
 assert.deepEqual(importDesign(exportDesign(d)).special.computerSoftware,d.special.computerSoftware);
 assert.throws(()=>make([program('drone-control',1),program('drone-control',2,-1,{id:'duplicate'})]));
});
