import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {createAugmentationFields,evaluateAugmentations} from '../engine/augmentations.mjs';
import {highPublishedFixtures,evaluateHighPublished} from './published-high-technology-fixtures.mjs';
const evaluate=(kind,tl,patch)=>evaluateDesign(updateDesign(createDesign({kind,techLevel:tl}),patch));
const has=(r,c)=>r.diagnostics.some(d=>d.code===c);
test('p 257 Ultima matches all stated physical values and 74 free Bandwidth without price forcing',()=>{
 const f=highPublishedFixtures.find(f=>f.id==='ultima'),r=evaluateHighPublished(f.id),t=r.totals;
 assert.equal(r.status,'verified');assert.equal(t.constructionCost,73490500);assert.notEqual(t.constructionCost,f.published.cost);
 for(const [field,value]of Object.entries({hits:20,armour:10,tacticalSpeed:9,endurance:259,intelligence:18}))assert.equal(t[field],value);
 assert.deepEqual(t.manipulators.map(a=>[a.strength,a.dexterity]),[[15,15],[15,15]]);
 assert.equal(t.bandwidth.remaining,74);assert.equal(t.slots.remaining,0);
 assert.ok(t.hardwareSkills.some(s=>s.skill==='stealth'&&s.level===4));
 assert.ok(t.skillEquivalents.some(s=>s.skill==='athletics'&&s.speciality==='strength'&&s.level===3));
 assert.ok(t.skillEquivalents.some(s=>s.skill==='athletics'&&s.speciality==='dexterity'&&s.level===3));
});
test('p 256 Sabmiqys retains an explicit one-Slot source-fit discrepancy',()=>{
 const r=evaluateHighPublished('sabmiqys'),t=r.previewTotals;
 assert.equal(r.status,'invalid');assert.ok(has(r,'SLOTS_EXCEEDED'));
 assert.equal(t.constructionCost,70085100);assert.equal(t.slots.capacity,16);assert.equal(t.slots.used,17);
 assert.equal(t.hits,20);assert.equal(t.armour,4);assert.equal(t.tacticalSpeed,6);assert.equal(t.endurance,288);assert.equal(t.intelligence,15);
 assert.deepEqual(t.manipulators.map(a=>[a.strength,a.dexterity]),Array.from({length:4},()=>[9,10]));
 assert.equal(t.bandwidth.capacity,60);assert.equal(t.skills.length,0,'Unknown published skills stay unknown.');
 const allocated=r.ledger.filter(l=>l.slots).reduce((sum,l)=>sum+l.slots,0);assert.equal(allocated,17);
});
test('p 55 two full RTGs remain sufficient when supplemental solar output is uncertain',()=>{
 const patch={selections:{chassis:{size:'size-7'},physical:{powerMode:'conditioned-alternative',solarLight:'low',optionInstances:[{id:'rtg',optionId:'rtg-long-duration-advanced',parameters:{quantity:2,powerCondition:'full'}},{id:'solar',optionId:'solar-power-unit-advanced',parameters:{quantity:1,panelState:'deployed'}}]}}};
 const r=evaluate('standard',15,patch);assert.equal(r.status,'verified');
 assert.equal(r.totals.powerState.strengthFactor,1);assert.equal(r.totals.powerState.movementFactor,1);
 assert.equal(r.totals.powerProjections.find(p=>p.id==='solar').operatingLevel,'unknown');
 assert.ok(has(r,'SUPPLEMENTAL_POWER_UNCERTAIN'));
 patch.selections.physical.optionInstances[0].parameters.quantity=1;
 assert.ok(has(evaluate('standard',15,patch),'SOLAR_UNIT_LIGHT'));
});
test('p 89 actual catalogue equipment cannot disappear through an omitted parent',()=>{
 const d={kind:'cyborg',techLevel:13};d.special=createAugmentationFields(d);
 d.special.augmentations=[{id:'arm',optionId:'cybernetic-arm',parameters:{}}];
 d.special.augmentOptions=[{id:'mic',optionId:'auditory',parameters:{}}];
 const missing=evaluateAugmentations(d);assert.ok(has(missing,'AUGMENT_SCHEMA'));
 d.special.augmentOptions[0].parameters.parentLimb='arm';
 const present=evaluateAugmentations(d);assert.ok(!has(present,'AUGMENT_SCHEMA'));
 assert.ok(present.augmentations[0].equipment.some(o=>o.optionId==='auditory'));
});
test('p 89 arm capacity includes standard-price internal equipment, not triple equipment price',()=>{
 const d={kind:'cyborg',techLevel:13};d.special=createAugmentationFields(d);
 d.special.augmentations=[{id:'arm',optionId:'cybernetic-arm',parameters:{}}];
 d.special.augmentOptions=[{id:'storage',optionId:'storage-compartment',parameters:{parentLimb:'arm',quantity:3}}];
 let r=evaluateAugmentations(d);assert.equal(r.cost,11650);assert.equal(r.augmentations[0].slots.remaining,0);
 d.special.augmentOptions[0].parameters.quantity=4;r=evaluateAugmentations(d);assert.ok(has(r,'LIMB_SLOT_LIMIT'));
});
test('p 93-94 fixed cybernetic costs precede additive modifiers',()=>{
 const d={kind:'cyborg',techLevel:14};d.special=createAugmentationFields(d);
 d.special.augmentations=[{id:'arm',optionId:'cybernetic-arm',parameters:{detachable:'yes',remote:'yes',naturalLooking:'tl14',ruggedised:'yes'}}];
 const r=evaluateAugmentations(d);assert.equal(r.cost,(1500+10000+5000+10000)*(1+.25+.75+.25));
 assert.equal(r.ledger.reduce((sum,l)=>sum+l.cost,0),r.cost);
});
test('p 92 brain implant cannot be certified without the installed neural link',()=>{
 let r=evaluate('cyborg',13,{special:{cyborgMode:'augments',augmentations:[{id:'brain',optionId:'brain-implant-basic',parameters:{}}]}});
 assert.notEqual(r.status,'verified');assert.ok(has(r,'BRAIN_IMPLANT_NEURAL_LINK'));
 r=evaluate('cyborg',13,{special:{cyborgMode:'augments',augmentations:[{id:'link',optionId:'neural-link-basic',parameters:{}},{id:'brain',optionId:'brain-implant-basic',parameters:{}}]}});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,130000);
});
for(const [tl,packageType,unitPrice]of [[18,'construction-enhanced',100000],[20,'construction-advanced',200000],[23,'construction-superior',500000]]){
 test('p 105 '+packageType+' acquisition price is per litre, not per 0.1-litre bag',()=>{
  const r=evaluate('nanorobot',tl,{special:{packageType,packages:1}});assert.equal(r.status,'verified');
  assert.equal(r.totals.cost,unitPrice*.1);assert.equal(r.totals.nanorobot.volumeLitres,.1);
  assert.equal(r.totals.nanorobot.productionSlotsPerHour,null,'No unprinted throughput is invented.');
 });
}
test('p 105 distributed consciousness price uses packages rather than litres',()=>{
 const r=evaluate('nanorobot',22,{special:{packageType:'distributed-conscious',packages:2}});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,400000);assert.equal(r.totals.nanorobot.costBasis,'per package');
 assert.equal(r.totals.bandwidth,null,'Acquisition reference does not invent a complete distributed brain.');
});
test('p 81 offensive micro self-destruct requires mass strictly greater than one gram',()=>{
 const patch={special:{selfDestruct:'offensive',massMg:1000}};let r=evaluate('microbot',14,patch);
 assert.notEqual(r.status,'verified');assert.ok(has(r,'MICRO_OFFENSIVE_MASS'));
 patch.special.massMg=1001;r=evaluate('microbot',14,patch);assert.equal(r.status,'verified');
 assert.equal(r.ledger.find(l=>l.id==='micro-self-destruct').cost,500);assert.ok(has(r,'MICRO_SELF_DESTRUCT_PRICE'));
});

test('pp 34-35 microbot outputs retain installed vacuum limits and radio range',()=>{
 const r=evaluate('microbot',14,{special:{options:['vacuum-environment-protection','transceiver-500km-advanced']}});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,1150);
 assert.equal(r.totals.capabilities.find(c=>c.optionId==='transceiver-500km-advanced').rangeKm,500);
 const vacuum=r.totals.capabilities.find(c=>c.optionId==='vacuum-environment-protection');
 assert.deepEqual(vacuum.limits.temperatureC,[-250,250]);assert.equal(vacuum.limits.vacuum,true);
 assert.equal(r.totals.capabilities.find(c=>c.id==='environment-summary').radiationProtection,500);
});
test('pp 34,89 limb environment and communications are scoped to the part, not its recipient',()=>{
 const r=evaluate('cyborg',14,{special:{cyborgMode:'augments',augmentations:[{id:'arm',optionId:'cybernetic-arm',parameters:{}}],augmentOptions:[{id:'vac',optionId:'vacuum-environment-protection',parameters:{parentLimb:'arm'}},{id:'radio',optionId:'transceiver-500km-advanced',parameters:{parentLimb:'arm'}}]}});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,14150);
 const a=r.totals.augmentations[0];assert.equal(a.capabilities.find(c=>c.id==='radio').rangeKm,500);
 assert.ok(a.capabilities.every(c=>c.scope==='augment-only'&&c.recipientProtectionGranted===false));
 assert.equal(a.capabilities.find(c=>c.id==='environment-summary').underwater,undefined);
});
test('p 94 remote augment range retains unverified external controller qualification',()=>{
 const r=evaluate('cyborg',14,{special:{cyborgMode:'augments',augmentControllerRadioKm:100,augmentations:[{id:'arm',optionId:'cybernetic-arm',parameters:{detachable:'yes',remote:'yes'}}],augmentOptions:[{id:'radio',optionId:'transceiver-500km-advanced',parameters:{parentLimb:'arm'}}]}});
 assert.equal(r.status,'verified');const a=r.totals.augmentations[0];assert.equal(a.remoteRangeMetres,100000);
 assert.equal(a.remoteLink.externalControllerVerified,false);assert.equal(a.remoteLink.externalControllerTechnologyVerified,false);
 assert.equal(a.controllerRadioCostIncluded,false);assert.equal(a.remoteLink.wirelessFallbackMetres,50);
});

function implantAudit(tl,brainId='brain-implant-basic',parameters={},custom=[]){
 return evaluate('cyborg',tl,{special:{cyborgMode:'augments',augmentations:[{id:'link',optionId:'neural-link-basic',parameters:{}},{id:'brain',optionId:brainId,parameters}],brainCustomPackages:custom}});
}
test('p 92 implant hardware uses all four printed introduction prices',()=>{
 for(const [id,cost,intelligence,bandwidth,tl] of [['basic',100000,8,2,13],['improved',1000000,9,3,14],['enhanced',1500000,10,4,15],['advanced',2000000,11,5,16]]){
  const r=implantAudit(tl,'brain-implant-'+id),b=r.totals.augmentations[1];
  assert.equal(r.status,'verified');assert.equal(b.structureCost,cost);assert.equal(r.totals.cost,cost+30000);
  assert.equal(b.robotBrain.intelligence,intelligence);assert.equal(b.robotBrain.bandwidth.inherent,bandwidth);
  assert.equal(b.robotBrain.recipientSlots,null);
 }
});
test('p 92 implant memory gate is two levels beyond each printed implant row',()=>{
 for(const [id,tl] of [['basic',13],['improved',14],['enhanced',15],['advanced',16]]){
  assert.ok(has(implantAudit(tl+1,'brain-implant-'+id,{bandwidthUpgrade:'bw-2',implantRetrotech:'printed-price'}),'IMPLANT_MEMORY_TL'));
  assert.equal(implantAudit(tl+2,'brain-implant-'+id,{bandwidthUpgrade:'bw-2',implantRetrotech:'printed-price'}).status,'verified');
 }
});
test('pp 67,92 implant hardening, memory, INT and software are each charged once',()=>{
 const r=implantAudit(15,'brain-implant-basic',{bandwidthUpgrade:'bw-2',intellectUpgrade:1,brainHardened:'yes',softwarePackages:['admin-1']});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,30000+150000+7500+9000+1000);
 const b=r.totals.augmentations[1];assert.equal(b.robotBrain.bandwidth.used,2);assert.equal(b.robotBrain.bandwidth.remaining,2);
 assert.equal(b.softwareCost,1000);assert.equal(b.robotBrain.skills[0].effectiveLevel,2);
 assert.equal(b.robotBrain.recipientSkillsGranted,false);assert.equal(r.totals.skills.length,0);
 assert.equal(r.ledger.reduce((sum,l)=>sum+l.cost,0),r.totals.cost);
});
test('p 67 implant extra storage does not enlarge the single-package ceiling',()=>{
 const r=implantAudit(15,'brain-implant-basic',{bandwidthUpgrade:'bw-4',softwarePackages:['admin-3']});
 assert.notEqual(r.status,'verified');assert.ok(has(r,'IMPLANT_INHERENT_BANDWIDTH'));
});
test('pp 66,73 implant zero-Bandwidth allowance remains inherent rather than expanded memory',()=>{
 const r=implantAudit(15,'brain-implant-basic',{bandwidthUpgrade:'bw-4',softwarePackages:['admin-0','advocate-0','broker-0']});
 assert.equal(r.status,'verified');const b=r.totals.augmentations[1];
 assert.deepEqual(b.robotBrain.zeroBandwidth,{allowance:2,used:3,overflow:1});
 assert.equal(b.robotBrain.bandwidth.used,1);assert.equal(b.softwareCost,800);
});
test('p 67 implant INT cost uses cumulative product and final-INT doubling',()=>{
 const r=implantAudit(17,'brain-implant-enhanced',{bandwidthUpgrade:'bw-8',intellectUpgrade:3,implantRetrotech:'printed-price'});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,30000+1500000+100000+11*12*13*1000*2);
 assert.equal(r.totals.augmentations[1].robotBrain.intellectBandwidth,6);
 assert.equal(r.totals.augmentations[1].robotBrain.intelligence,13);
 assert.ok(has(implantAudit(15,'brain-implant-basic',{intellectUpgrade:3}),'IMPLANT_BANDWIDTH_EXCEEDED'));
});
test('pp 73,92 identical custom specialities on separate implants are independently priced and scoped',()=>{
 const r=evaluate('cyborg',16,{special:{cyborgMode:'augments',augmentations:[{id:'link',optionId:'neural-link-basic',parameters:{}},{id:'one',optionId:'brain-implant-basic',parameters:{}},{id:'two',optionId:'brain-implant-improved',parameters:{implantRetrotech:'printed-price'}}],brainCustomPackages:[{id:'lang-one',parentBrain:'one',skill:'language',speciality:'Trade Pidgin',level:1},{id:'lang-two',parentBrain:'two',skill:'language',speciality:'Trade Pidgin',level:1}]}});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,1134000);
 for(const b of r.totals.augmentations.filter(a=>a.robotBrain)){
  assert.equal(b.softwareCost,2000);assert.equal(b.robotBrain.skills.length,1);
  assert.equal(b.robotBrain.skills[0].scope,'implant-only');assert.equal(b.robotBrain.skills[0].recipientSkillGranted,false);
 }
});
test('pp 89,93-94 software plus cybernetic percentage requires an explicit price-basis interpretation',()=>{
 const params={softwarePackages:['admin-1'],naturalLooking:'tl10'};
 const unresolved=implantAudit(15,'brain-implant-basic',params);
 assert.equal(unresolved.status,'blocked');assert.ok(has(unresolved,'IMPLANT_SOFTWARE_MODIFIER_BASIS'));
 for(const [basis,brainCost] of [['include-all-fixed-costs',126250],['physical-only',126000]]){
  const r=implantAudit(15,'brain-implant-basic',{...params,softwareModifierBasis:basis});
  assert.equal(r.status,'verified');assert.equal(r.totals.augmentations[1].totalCost,brainCost);
  assert.equal(r.totals.cost,brainCost+30000);assert.ok(has(r,'IMPLANT_SOFTWARE_MODIFIER_INTERPRETATION'));
  assert.equal(r.totals.augmentations[1].softwareModifierBasis.interpretation,basis);
 }
 assert.equal(implantAudit(15,'brain-implant-basic',{naturalLooking:'tl10'}).status,'verified');
});

test('pp 67,92 later-TL Very Advanced implant retrotech is explicit and preserves base capabilities',()=>{
 const unresolved=implantAudit(15,'brain-implant-improved');
 assert.equal(unresolved.status,'blocked');assert.ok(has(unresolved,'IMPLANT_RETROTECH_UNRESOLVED'));
 for(const [implantRetrotech,cost] of [['printed-price',1000000],['ordinary-retrotech',500000]]){
  const r=implantAudit(15,'brain-implant-improved',{implantRetrotech});
  assert.equal(r.status,'verified');assert.equal(r.totals.augmentations[1].structureCost,cost);
  assert.equal(r.totals.cost,cost+30000);assert.equal(r.totals.augmentations[1].robotBrain.intelligence,9);
  assert.equal(r.totals.augmentations[1].robotBrain.bandwidth.inherent,3);
  assert.ok(has(r,'IMPLANT_RETROTECH_INTERPRETATION'));
 }
});

test('pp 80-81 repeated microbot instances each consume one zero-slot choice and their own price',()=>{
 const r=evaluate('microbot',14,{special:{optionInstances:[{id:'ears',optionId:'auditory',parameters:{quantity:3}},{id:'eyes',optionId:'visual-spectrum',parameters:{quantity:2}}]}});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,500+100+3*10+2*50);
 assert.equal(r.totals.zeroSlot.used,5);assert.equal(r.totals.slots.used,0);
});
test('p 80 repeated microbot instance count cannot exceed the technology allowance',()=>{
 const r=evaluate('microbot',14,{special:{optionInstances:[{id:'ears',optionId:'auditory',parameters:{quantity:15}}]}});
 assert.notEqual(r.status,'verified');assert.ok(has(r,'MICRO_ZERO_SLOTS'));
});
