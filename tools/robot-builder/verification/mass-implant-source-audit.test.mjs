import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';

// Exact printed device rows: Core Update 2022 pp 112,116; implant route RH p 92.
const run=(optionId,parameters={},extra=[],tl=14)=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:tl}),{special:{cyborgMode:'augments',augmentations:[{id:'device',optionId,parameters},...extra]}}));
const has=(r,c)=>r.diagnostics.some(d=>d.code===c);
for(const [tl,processing,mass,cost]of [[8,1,2,250],[9,1,1,100],[10,2,.5,500],[11,2,.5,300],[12,3,.5,1000],[13,4,.5,1500],[14,5,.5,5000]]){
 test('Printed TL '+tl+' portable computer keeps its mass, price and separate Processing',()=>{
  const r=run('misc-mass-portable-computer-'+tl),part=r.totals.augmentations[0];
  assert.equal(r.status,'verified');assert.equal(r.totals.cost,3*cost+10000);
  assert.equal(part.structureCost,3*cost);assert.equal(part.interfaceCost,10000);
  assert.equal(part.miscDevice.massKg,mass);assert.equal(part.miscDevice.slots,null);
  assert.equal(part.miscDevice.standardUnitPrice,cost);assert.equal(part.capabilities[0].processing,processing);
  assert.equal(part.capabilities[0].robotBrain,false);assert.equal(part.capabilities[0].scope,'augment-only');
  assert.deepEqual(r.totals.skills,[]);
 });
}
for(const [id,mass,cost]of [['binoculars-3',1,75],['binoculars-8',1,750],['binoculars-12',1,3500],['em-probe',1,1000],['geiger-5',2,250],['light-intensifier-7',1,500]]){
 test('Printed '+id+' fits the mass-only implant route without invented Slots',()=>{
  const r=run('misc-mass-'+id),part=r.totals.augmentations[0];
  assert.equal(r.status,'verified');assert.equal(r.totals.cost,cost*3+10000);
  assert.equal(part.miscDevice.massKg,mass);assert.equal(part.miscDevice.slots,null);
  assert.equal(part.miscDevice.fitBasis,'mass-at-most-2kg');
 });
}
test('The exact two-kilogram boundary admits a device while five kilograms rejects',()=>{
 assert.equal(run('misc-mass-geiger-5').status,'verified');
 const heavy=run('misc-mass-portable-computer-7');assert.equal(heavy.status,'invalid');assert.ok(has(heavy,'MISC_IMPLANT_MASS'));
});
test('All miscellaneous implant routes share the three-device maximum',()=>{
 const three=run('misc-mass-portable-computer-8',{quantity:2},[{id:'sensor',optionId:'misc-visual-spectrum',parameters:{quantity:1}}]);
 assert.equal(three.status,'verified');
 const four=run('misc-mass-portable-computer-8',{quantity:2},[{id:'sensor',optionId:'misc-visual-spectrum',parameters:{quantity:2}}]);
 assert.equal(four.status,'invalid');assert.ok(has(four,'MISC_IMPLANT_COUNT'));
});
test('Neural-controlled mass devices require the real link and pay no duplicate individual interface',()=>{
 const missing=run('misc-mass-em-probe',{interfaceMode:'neural'});assert.equal(missing.status,'invalid');assert.ok(has(missing,'MISC_IMPLANT_NEURAL_LINK'));
 const r=run('misc-mass-em-probe',{interfaceMode:'neural'},[{id:'link',optionId:'neural-link-basic',parameters:{}}]);
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,33000);assert.equal(r.totals.augmentations[0].interfaceCost,0);
});
test('Mass-only percentage costs apply after device and interface fixed prices',()=>{
 const r=run('misc-mass-portable-computer-8',{naturalLooking:'tl10'});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,(250*3+10000)*1.25);
});
test('Optional computer comms do not invent a numeric radio range or extra device cost',()=>{
 const r=run('misc-mass-portable-computer-8',{computerComms:'yes'});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,10750);
 const comm=r.totals.augmentations[0].capabilities.find(c=>c.category==='communications');
 assert.equal(comm.shortRange,true);assert.equal(comm.rangeKm,null);assert.equal(comm.scope,'augment-only');
});
test('Imported miscellaneous records cannot override catalogue price or source mass',()=>{
 for(const parameters of [{massKg:1},{cost:1},{standardUnitPrice:1}]){
  assert.throws(()=>run('misc-mass-portable-computer-7',parameters));
 }
});

test('Core computers retain included basic software without inventing Expert packages or recipient skills',()=>{
 const r=run('misc-mass-portable-computer-8'),c=r.totals.augmentations[0].capabilities[0];
 assert.deepEqual(c.includedSoftware,['Interface/0','Security/0']);
 assert.equal(c.purchasedExpertAgentIntellectIncluded,false);assert.equal(c.robotBrain,false);
 assert.deepEqual(r.totals.skills,[]);
});

test('A two-kilogram computer terminal retains its remote-network dependency',()=>{
 const r=run('misc-mass-computer-terminal-7'),p=r.totals.augmentations[0],c=p.capabilities[0];
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,10600);assert.equal(p.miscDevice.massKg,2);
 assert.equal(c.networkRequired,true);assert.equal(c.independentProcessing,false);assert.equal(c.processing,0);
});
test('Electronics toolkit retains the selected speciality and contextual technology modifiers',()=>{
 const r=run('misc-mass-electronics-toolkit-7',{electronicsSpeciality:'sensors'}),p=r.totals.augmentations[0],c=p.capabilities[0];
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,16000);assert.equal(p.miscDevice.massKg,2);
 assert.equal(c.electronicsSpeciality,'sensors');assert.equal(c.recipientSkillGranted,false);
 assert.deepEqual(c.taskTechnologyModifiers,{minimumGap:2,lowerTaskTL:2,higherTaskTL:-2});
});
for(const [tl,mass,cost,dm]of [[8,1,1000,0],[10,1,1500,1],[12,1,5000,2],[14,0,10000,3]]){
 test('Printed TL '+tl+' medikit retains its mass and first-aid-only modifier',()=>{
  const r=run('misc-mass-medikit-'+tl),p=r.totals.augmentations[0],c=p.capabilities[0];
  assert.equal(r.status,'verified');assert.equal(r.totals.cost,cost*3+10000);assert.equal(p.miscDevice.massKg,mass);
  assert.equal(c.firstAidDM,dm);assert.match(c.condition,/First aid/);assert.equal(c.scope,'augment-only');assert.equal(c.recipientSkillGranted,false);
 });
}
