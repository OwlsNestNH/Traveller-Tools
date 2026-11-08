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
 ['p19–20 efficiency doubles108hours, then three packs multiply216 by4',{selections:{physical:{efficiency:true,powerPacks:3}}},r=>assert.equal(r.totals.endurance,864)],
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
 ['p34 main table','vacuum-environment-protection','tl',7],['p58','electronics-toolkit-improved','cost',4000],
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

// Power and placement boundaries independently recomputed from pp19-20,31,55-57.
test('p19-20 power packs add a base endurance each rather than compounding',()=>{
 for(const n of [0,1,2,3])for(const efficiency of [false,true]){
  const r=evaluate({selections:{physical:{powerPacks:n,efficiency}}});
  assert.equal(r.status,'verified');assert.equal(r.totals.endurance,108*(efficiency?2:1)*(1+n));
  if(n){assert.equal(line(r,'power-packs').slots,2*n);assert.equal(line(r,'power-packs').cost,1000*n);}
 }
});
test('p56 removing internal power retains only installed packs endurance',()=>{
 for(const n of [1,2,3]){
  const r=evaluate({selections:{physical:{powerPacks:n,options:['no-internal-power']}}});
  assert.equal(r.status,'verified');assert.equal(r.totals.endurance,108*n);assert.equal(line(r,'option-no-internal-power').slots,-2);
 }
});
test('p55-56 same-grade repeated RTGs use per-installation rounded Slots',()=>{
 const r=evaluate({selections:{physical:{options:['rtg-long-duration-improved'],optionParameters:{'rtg-long-duration-improved':{quantity:2}}}}});
 assert.equal(r.status,'verified');assert.equal(line(r,'option-rtg-long-duration-improved').slots,6);assert.equal(line(r,'option-rtg-long-duration-improved').cost,1600000);
});
test('p55 two full-capability same-grade RTGs avoid low-power penalties',()=>{
 const r=evaluate({selections:{physical:{powerMode:'alternate-full',options:['no-internal-power','rtg-long-duration-improved'],optionParameters:{'rtg-long-duration-improved':{quantity:2}}}}});
 assert.equal(r.status,'verified');assert.equal(r.totals.manipulators[0].strength,9);assert.equal(r.totals.tacticalSpeed,5);assert.equal(r.totals.agility,0);assert.equal(r.totals.endurance,null);
});
test('p55 one full-capability RTG halves STR and movement down and reduces agility2',()=>{
 const r=evaluate({selections:{physical:{powerMode:'alternate-full',options:['no-internal-power','rtg-long-duration-improved']}}});
 assert.equal(r.status,'verified');assert.equal(r.totals.manipulators[0].strength,4);assert.equal(r.totals.tacticalSpeed,2);assert.equal(r.totals.agility,-2);assert.equal(r.totals.endurance,null);
});
test('p55 single-source only robot cannot use vehicle speed',()=>{
 const r=evaluate({selections:{physical:{powerMode:'alternate-full',vehicleSpeed:true,options:['no-internal-power','rtg-long-duration-improved']}}});
 assert.notEqual(r.status,'verified');assert.equal(r.totals,null);assert.ok(r.diagnostics.some(d=>d.code==='LOW_POWER_VEHICLE'));
});
test('p31 empty default suite leaves all five placements in total zero-slot allowance',()=>{
 const r=evaluate({selections:{physical:{defaultSuite:[],options:['injector-needle'],optionParameters:{'injector-needle':{quantity:23}}}}});
 assert.equal(r.status,'verified');assert.equal(r.totals.zeroSlot.allowance,22);assert.equal(r.totals.zeroSlot.overflow,1);assert.equal(line(r,'zero-slot-overflow').slots,1);assert.equal(line(r,'option-injector-needle').cost,460);
});
test('p29-31 separate suite copies and extra copies have consistent total capacity',()=>{
 const r=evaluate({selections:{physical:{defaultSuite:['injector-needle'],options:['injector-needle'],optionParameters:{'injector-needle':{suiteQuantity:5,quantity:18}}}}});
 assert.equal(r.status,'verified');assert.equal(r.totals.zeroSlot.allowance,17);assert.equal(r.totals.zeroSlot.overflow,1);assert.equal(line(r,'default-injector-needle').cost,100);assert.equal(line(r,'option-injector-needle').cost,360);
});
test('p29 default suite cannot use more than five total placements',()=>{
 const r=evaluate({selections:{physical:{defaultSuite:['injector-needle','visual-spectrum'],optionParameters:{'injector-needle':{suiteQuantity:5}}}}});
 assert.notEqual(r.status,'verified');assert.equal(r.totals,null);assert.ok(r.diagnostics.some(d=>d.code==='DEFAULT_SUITE_CAPACITY'));
});
test('quantity settings never silently disappear on a suite-only installation',()=>{
 const r=evaluate({selections:{physical:{defaultSuite:['injector-needle'],optionParameters:{'injector-needle':{quantity:20}}}}});
 assert.notEqual(r.status,'verified');assert.equal(r.totals,null);assert.ok(r.diagnostics.some(d=>d.code==='UNUSED_OPTION_QUANTITY'));
});


// Full ordinary equipment scalar pass: original PDF tables pp29-64 checked by positioned column blocks.
// Numeric source facts only. Does not claim complete operational mechanics or resolve source conflicts.
const auditedCatalogueRows = [["visual-spectrum-sensor",7,0,0,50,"39"],["voder-speaker",8,0,0,100,"36"],["auditory-sensor",5,0,0,10,"38"],["wireless-data-link",8,0,0,10,"36"],["drone-interface",6,0,0,100,"34-35"],["encryption-module",6,0,0,4000,"35"],["visual-camouflage-primitive",1,0,0,1,"31"],["visual-camouflage-basic",4,0,0,4,"31"],["visual-camouflage-improved",7,0,0,40,"31"],["visual-camouflage-enhanced",11,0,0,100,"31"],["visual-camouflage-advanced",12,0,0,500,"31"],["visual-camouflage-superior",13,0,0,2500,"31"],["audible-camouflage-basic",5,0,0,5,"32"],["audible-camouflage-improved",8,0,0,10,"32"],["audible-camouflage-advanced",10,0,0,50,"32"],["olfactory-camouflage-basic",7,0,0,10,"32"],["olfactory-camouflage-improved",9,0,0,20,"32"],["olfactory-camouflage-advanced",12,0,0,100,"32"],["hostile-environment",6,0,0,300,"32"],["reflec",10,0,0,100,"32"],["solar-coating-basic",6,0,0,500,"33"],["solar-coating-improved",8,0,0,100,"33"],["solar-coating-enhanced",10,0,0,200,"33"],["solar-coating-advanced",12,0,0,500,"33"],["vacuum-environment-protection",7,0,0,600,"34"],["vacuum-environment-protection-biological",10,0,0,50000,"34"],["transceiver-5km-basic",7,0,0,250,"35"],["transceiver-5km-improved",8,0,0,100,"35"],["transceiver-50km-improved",8,0,0,500,"35"],["transceiver-50km-enhanced",10,0,0,250,"35"],["transceiver-50km-advanced",13,0,0,100,"35"],["transceiver-500km-improved",9,0,0,1000,"35"],["transceiver-500km-enhanced",11,0,0,500,"35"],["transceiver-500km-advanced",14,0,0,250,"35"],["transceiver-5000km-improved",9,0,0,5000,"35"],["transceiver-5000km-enhanced",12,0,0,1000,"35"],["transceiver-5000km-advanced",15,0,0,500,"35"],["transceiver-50km-basic",7,1,0,1000,"46"],["transceiver-500km-basic",7,1,0,2000,"46"],["transceiver-5000km-basic",7,2,0,10000,"46"],["transceiver-50000km-basic",8,4,0,20000,"46"],["transceiver-50000km-improved",10,2,0,10000,"46"],["transceiver-50000km-enhanced",12,1,0,5000,"46"],["transceiver-50000km-advanced",15,1,0,2500,"46"],["transceiver-500000km-basic",9,8,0,50000,"46"],["transceiver-500000km-improved",11,4,0,25000,"46"],["transceiver-500000km-enhanced",13,2,0,10000,"46"],["transceiver-500000km-advanced",16,1,0,5000,"46"],["video-screen-basic",7,0,0,200,"35"],["full-surface-video-screen-basic",7,0,0,200,"35"],["video-screen-improved",8,0,0,500,"35"],["full-surface-video-screen-improved",8,0,0,500,"35"],["video-screen-advanced",10,0,0,2000,"35"],["full-surface-video-screen-advanced",10,0,0,2000,"35"],["voder-speaker-broad-spectrum",10,0,0,500,"36"],["gecko-grippers",9,0,0,500,"36"],["injector-needle",7,0,0,20,"36"],["laser-designator",7,0,0,500,"37"],["magnetic-grippers",8,0,0,10,"37"],["parasitic-link",10,0,0,10000,"37"],["self-maintenance-enhancement-basic",7,0,0,20000,"37"],["self-maintenance-enhancement-improved",8,0,0,50000,"37"],["stinger",7,0,0,10,"38"],["auditory-sensor-broad-spectrum",8,0,0,200,"38"],["atmospheric-sensor",8,0,0,100,"38"],["environment-processor",10,0,0,10000,"38"],["geiger-counter",8,0,0,400,"39"],["light-intensifier-sensor-basic",7,0,0,500,"39"],["light-intensifier-sensor-advanced",9,0,0,1250,"39"],["olfactory-sensor-basic",8,0,0,1000,"39"],["olfactory-sensor-improved",10,0,0,3500,"39"],["olfactory-sensor-advanced",12,0,0,10000,"39"],["pris-sensor",12,0,0,2000,"39"],["thermal-sensor",6,0,0,500,"39"],["active-camouflage",15,1,0,10000,"41"],["corrosive-environment-protection",9,1,0,600,"41"],["insidious-environment-protection",11,1,0,3000,"41"],["radiation-environment-protection",7,1,0,600,"42"],["self-repairing-chassis",11,null,0.05,1000,"42"],["submersible-environment-protection-basic",4,null,0.05,200,"42"],["submersible-environment-protection-improved",6,null,0.02,400,"42"],["submersible-environment-protection-enhanced",9,null,0.02,800,"42"],["submersible-environment-protection-advanced",12,null,0.02,1000,"42"],["submersible-environment-protection-superior",15,null,0.02,2000,"42"],["domestic-cleaning-equipment-small",5,1,0,100,"43"],["domestic-cleaning-equipment-medium",5,4,0,1000,"43"],["domestic-cleaning-equipment-large",5,8,0,5000,"43"],["industrial-cleaning-equipment-small",5,2,0,500,"43"],["industrial-cleaning-equipment-medium",5,8,0,5000,"43"],["industrial-cleaning-equipment-large",5,16,0,20000,"43"],["high-fidelity-sound-system-basic",6,4,0,1500,"44"],["high-fidelity-sound-system-improved",8,3,0,2500,"44"],["high-fidelity-sound-system-enhanced",11,3,0,4000,"44"],["high-fidelity-sound-system-advanced",12,2,0,5000,"44"],["robotic-drone-controller-basic",7,2,0,2000,"44"],["robotic-drone-controller-improved",9,1,0,10000,"44"],["robotic-drone-controller-enhanced",10,1,0,20000,"44"],["robotic-drone-controller-advanced",11,1,0,50000,"44"],["satellite-uplink",6,2,0,1000,"45"],["swarm-controller-basic",8,3,0,10000,"45"],["swarm-controller-improved",10,2,0,20000,"45"],["swarm-controller-enhanced",12,1,0,50000,"45"],["swarm-controller-advanced",14,1,0,100000,"45"],["tightbeam-communicator",8,1,0,2000,"46"],["medical-chamber",8,null,0,200,"46"],["cryoberth-basic",10,8,0,20000,"47"],["cryoberth-improved",12,8,0,20000,"47"],["low-berth-basic",10,8,0,20000,"47"],["low-berth-improved",12,8,0,20000,"47"],["nanorobot-applicator",13,4,0,100000,"47"],["nanorobot-generator",13,8,0,200000,"47"],["reanimation",14,8,0,900000,"47"],["species-specific-medical-add-on",10,4,0,10000,"47"],["medikit-basic",8,1,0,1000,"48"],["medikit-improved",10,1,0,1500,"48"],["medikit-enhanced",12,1,0,5000,"48"],["medikit-advanced",14,1,0,10000,"48"],["agricultural-equipment-small",5,1,0,100,"48"],["agricultural-equipment-medium",5,4,0,1000,"48"],["agricultural-equipment-large",5,16,0,10000,"48"],["autobar-basic",8,2,0,500,"49"],["autobar-improved",9,2,0,1000,"49"],["autobar-enhanced",10,2,0,2000,"49"],["autobar-advanced",11,2,0,5000,"49"],["autochef-basic",9,3,0,500,"49"],["autochef-improved",10,3,0,2000,"49"],["autochef-enhanced",11,3,0,5000,"49"],["autochef-advanced",12,3,0,10000,"49"],["autopilot-improved",7,1,0,7500,"49"],["autopilot-enhanced",9,1,0,10000,"49"],["autopilot-advanced",11,1,0,15000,"49"],["bioreaction-chamber-basic",6,null,0,1000,"50"],["bioreaction-chamber-improved",8,null,0,2000,"50"],["bioreaction-chamber-enhanced",10,null,0,5000,"50"],["bioreaction-chamber-advanced",13,null,0,20000,"50"],["construction-equipment-small",5,2,0,500,"50"],["construction-equipment-medium",5,8,0,5000,"50"],["construction-equipment-large",5,32,0,50000,"50"],["fabrication-chamber-basic",8,null,0,2000,"52"],["fabrication-chamber-improved",10,null,0,10000,"52"],["fabrication-chamber-enhanced",13,null,0,50000,"52"],["fabrication-chamber-advanced",17,null,0,200000,"52"],["forklift-small",5,8,0,3000,"52"],["forklift-medium",5,12,0,5000,"52"],["forklift-large",5,60,0,20000,"52"],["mining-equipment-small",5,5,0,2000,"52"],["mining-equipment-medium",5,15,0,5000,"52"],["mining-equipment-large",5,45,0,15000,"52"],["holographic-projector",10,1,0,1000,"52"],["navigation-system-basic",8,2,0,2000,"53"],["navigation-system-improved",10,2,0,10000,"53"],["navigation-system-enhanced",12,1,0,25000,"53"],["navigation-system-advanced",14,1,0,50000,"53"],["self-destruct-system-defensive",8,null,0.05,500,"53"],["self-destruct-system-offensive",6,null,0.1,1000,"53"],["self-destruct-system-tdx",12,null,0.1,5000,"53"],["self-destruct-system-nuclear",12,4,0,500000,"53"],["self-maintenance-enhancement-enhanced",13,null,0.1,200000,"54"],["self-maintenance-enhancement-advanced",15,null,0.1,500000,"54"],["stealth-basic",7,1,0,300,"54"],["stealth-improved",9,2,0,600,"54"],["stealth-enhanced",11,3,0,900,"54"],["stealth-advanced",13,3,0,1200,"54"],["storage-compartment",6,null,0,50,"55"],["refrigerated-storage-compartment",6,null,0,100,"55"],["hazardous-material-storage-compartment",6,null,0,500,"55"],["video-projector",7,1,0,500,"55"],["external-power",9,null,0.05,100,"55"],["no-internal-power",6,null,-0.1,0,"56"],["rtg-long-duration-basic",7,null,0.2,20000,"56"],["rtg-long-duration-improved",9,null,0.15,50000,"56"],["rtg-long-duration-advanced",11,null,0.1,100000,"56"],["rtg-short-duration-basic",8,null,0.15,50000,"56"],["rtg-short-duration-improved",10,null,0.1,100000,"56"],["rtg-short-duration-advanced",12,null,0.05,200000,"56"],["solar-power-unit-basic",6,null,0.2,2000,"57"],["solar-power-unit-improved",8,null,0.15,5000,"57"],["solar-power-unit-enhanced",10,null,0.1,10000,"57"],["solar-power-unit-advanced",12,null,0.05,20000,"57"],["quick-charger",8,1,0,200,"57"],["bioscanner-sensor",15,2,0,350000,"57"],["densitometer-sensor",14,3,0,20000,"57"],["neural-activity-sensor",15,5,0,35000,"58"],["planetology-sensor-suite",12,5,0,25000,"58"],["recon-sensor-basic",7,2,0,1000,"58"],["recon-sensor-improved",8,1,0,100,"58"],["recon-sensor-enhanced",10,1,0,10000,"58"],["recon-sensor-advanced",12,1,0,20000,"58"],["cutting-torch-basic",5,2,0,500,"58"],["cutting-torch-improved",9,2,0,5000,"58"],["cutting-torch-advanced",13,1,0,5000,"58"],["electronics-toolkit-basic",6,1,0,2000,"58"],["electronics-toolkit-improved",8,1,0,4000,"58"],["electronics-toolkit-enhanced",10,1,0,6000,"58"],["electronics-toolkit-advanced",12,1,0,8000,"58"],["fire-extinguisher",5,1,0,100,"59"],["scientific-toolkit-basic",5,4,0,2000,"59"],["scientific-toolkit-improved",8,3,0,4000,"59"],["scientific-toolkit-enhanced",11,3,0,6000,"59"],["scientific-toolkit-advanced",14,3,0,8000,"59"],["forensic-toolkit-basic",8,5,0,2000,"59"],["forensic-toolkit-improved",10,4,0,4000,"59"],["forensic-toolkit-enhanced",12,4,0,8000,"59"],["forensic-toolkit-advanced",14,3,0,10000,"59"],["mechanical-toolkit-basic",4,6,0,1000,"59"],["mechanical-toolkit-improved",8,4,0,2000,"59"],["mechanical-toolkit-advanced",12,2,0,4000,"59"],["starship-engineering-toolkit-basic",8,6,0,1000,"60"],["starship-engineering-toolkit-improved",10,5,0,2000,"60"],["starship-engineering-toolkit-enhanced",12,5,0,4000,"60"],["starship-engineering-toolkit-advanced",14,4,0,10000,"60"],["stylist-toolkit",6,3,0,2000,"60"],["fire-control-system-basic",6,1,0,10000,"60"],["fire-control-system-improved",8,1,0,25000,"60"],["fire-control-system-enhanced",10,1,0,50000,"60"],["fire-control-system-advanced",12,1,0,100000,"60"],["weapon-mount-small",5,1,0,500,"61"],["weapon-mount-autoloader-small",6,1,0,null,"61"],["weapon-mount-medium",5,2,0,1000,"61"],["weapon-mount-autoloader-medium",6,2,0,null,"61"],["weapon-mount-heavy",5,10,0,5000,"61"],["weapon-mount-autoloader-heavy",6,10,0,null,"61"],["weapon-mount-vehicle",5,15,0,10000,"61"],["weapon-mount-autoloader-vehicle",6,15,0,null,"61"]];
test('All 224 equipment TL, slot and rate fields match independently checked PDF tables',()=>{
 assert.equal(auditedCatalogueRows.length,224);
 for(const [id,tl,slots,percent,rate,pages] of auditedCatalogueRows){
  const row=option(id);
  assert.equal(row.tl,tl,id+' TL');
  assert.equal(row.slots??null,slots,id+' fixed Slots');
  assert.equal(row.slotPercent??0,percent,id+' Base Slot fraction');
  if(rate!==null)assert.equal(row.cost??row.costPerBaseSlot,rate,id+' credit rate');
  assert.equal(row.source.pages,pages,id+' source page');
 }
});
test('p58 left Recon and right Electronics tables remain correctly associated',()=>{
 const recon=[[7,2,1,1000],[8,1,1,100],[10,1,2,10000],[12,1,3,20000]];
 const electronic=[[6,1,0,2000],[8,1,1,4000],[10,1,2,6000],[12,1,3,8000]];
 for(const [i,grade]of ['basic','improved','enhanced','advanced'].entries()){
  const r=option('recon-sensor-'+grade),e=option('electronics-toolkit-'+grade);
  assert.deepEqual([r.tl,r.slots,r.effects.reconSkill,r.cost],recon[i]);
  assert.deepEqual([e.tl,e.slots,e.effects.toolSkillCaps.Electronics,e.cost],electronic[i]);
 }
});
