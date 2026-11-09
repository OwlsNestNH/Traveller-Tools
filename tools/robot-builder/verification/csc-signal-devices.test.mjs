import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_SIGNAL_DEVICES} from '../engine/csc-signal-devices.mjs';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {getAugmentationCatalogue} from '../engine/augmentations.mjs';

// Independently transcribed after rendering and inspecting printed pp77-78,
// Central Supply Catalogue Update 2023, revised printing copyright 2026.
const rows=[
 ['radio-jammer-handheld-6',6,.5,500,'77'],
 ['bug-sweeper-standard-5',5,.5,100,'78'],
 ['bug-sweeper-deluxe-5',5,.5,1000,'78']
];
const option=id=>'misc-mass-csc-'+id;
const run=(id,parameters={},extra=[],tl=14)=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'device',optionId:option(id),parameters},...extra]}}));
const cap=id=>run(id).totals.augmentations[0].capabilities[0];
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);

for(const [id,tl,mass,cost,pages] of rows){
 test('CSC signal source row '+id+' preserves base TL, price and printed mass',()=>{
  const row=CSC_SIGNAL_DEVICES.find(r=>r.id==='csc-'+id);
  assert.ok(row);assert.equal(row.tl,tl);assert.equal(row.massKg,mass);assert.equal(row.cost,cost);
  assert.match(row.label,/\(CSC\)$/);assert.match(row.label,new RegExp('TL'+tl));
  assert.deepEqual(row.source,{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
  assert.equal(row.effects.recipientSkillGranted,false);assert.equal(row.effects.processing,undefined);
 });
 test('CSC signal implant '+id+' uses the existing p92 price and interface accounting',()=>{
  const row=getAugmentationCatalogue().find(r=>r.id===option(id));assert.ok(row,'Signal device is integrated into the mass-device catalogue');
  assert.equal(row.tl,tl);assert.equal(row.source.pages,'92');assert.equal(row.device.massKg,mass);assert.equal(row.device.cost,cost);
  const r=run(id),part=r.totals.augmentations[0];
  assert.equal(r.status,'verified');assert.equal(part.structureCost,cost*3);assert.equal(part.interfaceCost,10000);assert.equal(r.totals.cost,cost*3+10000);
  assert.equal(part.miscDevice.massKg,mass);assert.equal(part.miscDevice.slots,null);assert.equal(part.miscDevice.fitBasis,'mass-at-most-2kg');assert.equal(part.miscDevice.source.pages,pages);
  assert.equal(part.capabilities[0].scope,'augment-only');assert.equal(part.capabilities[0].recipientSkillGranted,false);assert.equal(part.capabilities[0].recipientProtectionGranted,false);assert.deepEqual(r.totals.skills,[]);
 });
}

test('CSC signal subset excludes heavy and unspecified-mass devices and later hardware variants',()=>{
 assert.deepEqual(CSC_SIGNAL_DEVICES.map(r=>r.id).sort(),rows.map(r=>'csc-'+r[0]).sort());
 assert.ok(CSC_SIGNAL_DEVICES.every(r=>Number.isFinite(r.massKg)&&r.massKg>0&&r.massKg<=2));
 assert.equal(new Set(getAugmentationCatalogue().map(r=>r.id)).size,getAugmentationCatalogue().length);
 for(const id of ['radio-jammer-heavy-4','ring-laser-16','wristwatch-4','radio-jammer-handheld-18','bug-sweeper-standard-18'])assert.ok(!CSC_SIGNAL_DEVICES.some(r=>r.id==='csc-'+id));
 assert.ok(getAugmentationCatalogue().some(r=>r.id==='misc-mass-em-probe'));
 assert.ok(getAugmentationCatalogue().some(r=>r.id==='misc-mass-csc-em-probe-10'));
});

test('Handheld jammer keeps its RF limits, battery duration and per-round communication check',()=>{
 const c=cap('radio-jammer-handheld-6');assert.equal(c.category,'communications');
 assert.deepEqual(c.radioJamming,{rangeMetres:30,hardwareTL:6,communicationCheck:{skill:'Electronics (comms)',target:10,everyRound:true,tlDifferenceDM:true,tlDifferenceFormula:null,automaticFailure:false},blocksTightBeamLaser:false,blocksMaser:false});
 assert.deepEqual(c.power,{source:'internal battery',continuousHours:1,externalPowerSupported:true,externalPowerIncluded:false});
 assert.equal(c.lawEnforcementAttentionPossible,true);assert.equal(c.radioJamming.rangeKm,undefined);
});

test('Standard and deluxe sweepers preserve separate active/passive targets and only the deluxe detection DM',()=>{
 for(const [id,dm] of [['bug-sweeper-standard-5',0],['bug-sweeper-deluxe-5',2]]){
  const c=cap(id);assert.equal(c.category,'sensor');assert.equal(c.detectsSurveillanceDevices,true);
  assert.deepEqual(c.bugDetection,{rangeMetres:6,skill:'Electronics (sensors)',activelyTransmittingTarget:8,passiveTarget:12,deluxeDM:dm,hardwareTL:5,positiveTLAdvantageDM:true,automaticDetection:false});
  assert.equal(c.equipmentDiagnostics,undefined);assert.equal(c.electronicsDM,undefined);
 }
});

test('Signal hardware TL remains fixed at later design TL and cannot be overridden by import',()=>{
 for(const [id,tl] of rows){
  const c=run(id,{},[],18).totals.augmentations[0].capabilities[0];
  assert.equal((c.radioJamming??c.bugDetection).hardwareTL,tl);
  const row=getAugmentationCatalogue({techLevel:18}).find(r=>r.id===option(id));
  assert.equal(row.tl,tl);assert.ok(!row.parameterControls.some(c=>c.field==='hardwareTL'));
  for(const p of [{hardwareTL:18},{massKg:0},{cost:0},{rangeMetres:999},{deluxeDM:99}])assert.throws(()=>run(id,p));
 }
});

test('Signal implants enforce source TL and share the existing three-device limit',()=>{
 for(const [id,tl] of rows){
  if(tl>5)assert.ok(has(run(id,{},[],tl-1),'AUGMENT_TL'));
  else assert.throws(()=>run(id,{},[],tl-1),/techLevel/);
 }
 const all=run('radio-jammer-handheld-6',{},[
  {id:'standard',optionId:option('bug-sweeper-standard-5'),parameters:{}},
  {id:'deluxe',optionId:option('bug-sweeper-deluxe-5'),parameters:{}}
 ]);
 assert.equal(all.status,'verified');assert.equal(all.totals.cost,34800);
 assert.equal(run('bug-sweeper-standard-5',{quantity:3}).totals.cost,30900);
 assert.ok(has(run('bug-sweeper-standard-5',{quantity:4}),'MISC_IMPLANT_COUNT'));
 assert.ok(has(run('bug-sweeper-standard-5',{quantity:3},[{id:'core',optionId:'misc-mass-geiger-5',parameters:{}}]),'MISC_IMPLANT_COUNT'));
});

test('Signal implants require the selected control interface and retain optional-modifier pricing',()=>{
 assert.ok(has(run('radio-jammer-handheld-6',{interfaceMode:'neural'}),'MISC_IMPLANT_NEURAL_LINK'));
 const linked=run('radio-jammer-handheld-6',{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);
 assert.equal(linked.status,'verified');assert.equal(linked.totals.augmentations[0].structureCost,1500);assert.equal(linked.totals.augmentations[0].interfaceCost,0);
 assert.equal(run('radio-jammer-handheld-6',{ruggedised:'yes'}).totals.cost,14375);
 assert.equal(run('bug-sweeper-deluxe-5',{ruggedised:'yes'}).totals.cost,16250);
});

test('Returned signal-device effects and metadata cannot mutate later results or sibling rows',()=>{
 const jammer=cap('radio-jammer-handheld-6');jammer.radioJamming.hardwareTL=18;jammer.radioJamming.communicationCheck.target=0;jammer.power.continuousHours=999;
 assert.equal(cap('radio-jammer-handheld-6').radioJamming.hardwareTL,6);assert.equal(cap('radio-jammer-handheld-6').radioJamming.communicationCheck.target,10);assert.equal(cap('radio-jammer-handheld-6').power.continuousHours,1);
 cap('bug-sweeper-standard-5').bugDetection.deluxeDM=999;assert.equal(cap('bug-sweeper-standard-5').bugDetection.deluxeDM,0);assert.equal(cap('bug-sweeper-deluxe-5').bugDetection.deluxeDM,2);
 const cat=getAugmentationCatalogue(),sweeper=cat.find(r=>r.id===option('bug-sweeper-deluxe-5'));
 sweeper.device.effects.bugDetection.hardwareTL=18;sweeper.device.source.pages='altered';sweeper.device.cost=0;
 const next=run('bug-sweeper-deluxe-5');assert.equal(next.totals.cost,13000);assert.equal(next.totals.augmentations[0].miscDevice.source.pages,'78');assert.equal(next.totals.augmentations[0].capabilities[0].bugDetection.hardwareTL,5);
});
