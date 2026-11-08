import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,characteristicDM} from '../engine/index.mjs';
import {OPTIONS_ARRAY} from '../engine/options-data.mjs';
// Independently calculated fixtures from Robot Handbook 2022. Numbers are mechanics, not book prose.
const evaluate=patch=>evaluateDesign(updateDesign(createDesign(),patch));
const arms=(size,strengthIncrease=0,dexterityIncrease=0)=>[{id:'base-1',kind:'base',size,strengthIncrease,dexterityIncrease},{id:'base-2',kind:'base',size:'chassis',strengthIncrease:0,dexterityIncrease:0}];
const line=(r,id)=>{const value=r.ledger.find(x=>x.id===id);assert.ok(value,'Missing ledger '+id);return value};
const cases=[
 ['p25–26 Size5 arm to7: five Slots and500 credits',{selections:{physical:{manipulators:arms(7)}}},r=>{assert.equal(line(r,'base-1').slots,5);assert.equal(line(r,'base-1').cost,500)}],
 ['p25–26 Size7 arm to6: three Slots and300 credits saved',{selections:{chassis:{size:'size-7'},physical:{manipulators:arms(6)}}},r=>{assert.equal(line(r,'base-1').slots,-3);assert.equal(line(r,'base-1').cost,-300)}],
 ['p25 explicit minimum: Size2 arm to1 still frees one Slot',{selections:{chassis:{size:'size-2'},physical:{manipulators:arms(1)}}},r=>assert.equal(line(r,'base-1').slots,-1)],
 ['p26 odd TL13 manipulator DEX rounds up to8',{techLevel:13},r=>assert.equal(r.totals.manipulators[0].dexterity,8)],
 ['p26 Size5 STR+3 and DEX+2 costs8500',{selections:{physical:{manipulators:arms('chassis',3,2)}}},r=>assert.equal(line(r,'base-1').cost,8500)],
 ['p19 seven added armour atTL12 uses three Slots and4500',{selections:{physical:{armourAdded:7}}},r=>{assert.equal(line(r,'armour').slots,3);assert.equal(line(r,'armour').cost,4500)}],
 ['p19 removing armour gives no free Slot',{selections:{physical:{armourRemoved:true}}},r=>assert.equal(line(r,'removed-armour').slots,0)],
 ['p19–20 efficiency then three packs multiplies108hours by8',{selections:{physical:{efficiency:true,powerPacks:3}}},r=>assert.equal(r.totals.endurance,864)],
 ['p73 third zero-bandwidth package consumes oneBW',{selections:{skills:{packages:['admin-0','mechanic-0','medic-0']}}},r=>assert.equal(r.totals.bandwidth.remaining,1)],
 ['p67 memory does not expand inherent per-package capacity',{selections:{brain:{bandwidthUpgrade:'bw-4'},skills:{packages:['medic-3']}}},r=>assert.ok(r.diagnostics.some(x=>x.code==='INHERENT_BANDWIDTH'))],
 ['p67 TL12 Very Advanced atTL14 costs one quarter',{techLevel:14,selections:{brain:{model:'very-advanced-tl12'}}},r=>assert.equal(line(r,'brain').cost,125000)],
 ['p67 hardened VA14 plus6BW costs825000',{techLevel:14,selections:{brain:{model:'very-advanced-tl14',bandwidthUpgrade:'bw-6',hardened:true}}},r=>assert.equal(line(r,'brain').cost+line(r,'bandwidth').cost,825000)],
 ['p67 INT11 to12 costs24000 and oneBW',{techLevel:14,selections:{brain:{model:'very-advanced-tl14',intellectUpgrade:1}}},r=>{assert.equal(line(r,'intellect').cost,24000);assert.equal(r.totals.bandwidth.used,1)}],
 ['p67 INT6 to9 costs504000 and sixBW',{selections:{brain:{model:'advanced-tl10',bandwidthUpgrade:'bw-4',intellectUpgrade:3}}},r=>{assert.equal(line(r,'intellect').cost,504000);assert.equal(r.totals.bandwidth.remaining,0)}]
];
for(const[name,patch,verify]of cases)test(name,()=>verify(evaluate(patch)));
test('112 ordinary size/TL/removal combinations preserve exact ledger totals',()=>{
 let checked=0;
 for(let size=1;size<=8;size++)for(let tl=12;tl<=18;tl++)for(const remove of[false,true]){
  const r=evaluate({techLevel:tl,selections:{chassis:{size:'size-'+size},physical:{manipulators:remove?[]:arms('chassis')}}});
  assert.equal(r.status,'verified',JSON.stringify({size,tl,remove,diagnostics:r.diagnostics}));
  assert.equal(r.totals.constructionCost,r.ledger.reduce((sum,x)=>sum+x.cost,0));checked++;
 }
 assert.equal(checked,112);
});
test('Core Rulebook Update2022 p9 caps characteristic DM at3 for15+',()=>{assert.equal(characteristicDM(15),3);assert.equal(characteristicDM(18),3)});
const option=id=>{const row=OPTIONS_ARRAY.find(x=>x.id===id);assert.ok(row,'Missing option '+id);return row};
const optionCases=[
 ['p47','reanimation','cost',900000],['p32','audible-camouflage-improved','costPerBaseSlot',10],
 ['p32','olfactory-camouflage-basic','costPerBaseSlot',10],['p32','olfactory-camouflage-improved','costPerBaseSlot',20],['p32','olfactory-camouflage-advanced','costPerBaseSlot',100],
 ['p38','auditory-sensor','tl',5],['p39','olfactory-sensor-basic','cost',1000],['p58','cutting-torch-advanced','tl',13],
 ['p34 main table','vacuum-environment-protection','tl',7],['p58','electronics-toolkit-improved','cost',100],
 ['p59','scientific-toolkit-basic','slots',4],['p59','forensic-toolkit-basic','slots',5],['p56','no-internal-power','slotCredit',true],
 ['p46','medical-chamber','quantityKind','allocatedSlots'],['p55','storage-compartment','costPerAllocatedSlot',50],
 ['p32','reflec','effects',{laserProtectionBonus:10,stealthDM:-2}]
];
for(const[page,id,key,value]of optionCases)test(`${page} equipment regression: ${id}.${key}`,()=>assert.deepEqual(option(id)[key],value));
test('Every source-derived equipment row has unique identity, source and explicit accounting basis',()=>{
 assert.equal(new Set(OPTIONS_ARRAY.map(x=>x.id)).size,OPTIONS_ARRAY.length);
 assert.ok(OPTIONS_ARRAY.length>=224);
 for(const r of OPTIONS_ARRAY){
  assert.ok(Number.isInteger(r.tl),r.id);assert.ok(r.source.pages,r.id);
  if(r.implemented){assert.ok(Number.isFinite(r.cost??r.costPerBaseSlot),r.id);assert.ok(r.slotsBasis==='allocated'||Number.isFinite(r.slots??r.slotPercent),r.id)}
  if(r.costBasis==='baseSlots')assert.equal(r.cost,undefined,r.id);
  if(r.slotsBasis==='basePercent')assert.equal(r.slots,undefined,r.id);
  if(r.slotsBasis==='allocated')assert.equal(r.quantityKind,'allocatedSlots',r.id);
 }
});
