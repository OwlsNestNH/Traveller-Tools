import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,MOUNTS,weaponControl,validateWeapons,evaluateWeapons} from '../engine/weapons.mjs';
import {CSC_HIGH_CAPACITY_MAGAZINE_IDS,cscMagazineVariants,estimateCscMagazineMass} from '../engine/csc-ammunition-storage.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';

// Independent expected variant fixtures: capacity, Cr, estimated kg. Source
// profile references are audited separately; CSC p175 doubles capacity/mass,
// triples magazine price and requires TL4, subject to referee suitability.
const fixtures=[
 ['assault-pistol',30,30,.15],['assault-shotgun',48,120,1.2],
 ['arl-standard',40,300,.6],['arl-support',80,600,1.6],['arl-pdw',40,300,.4],
 ['light-assault-gun',10,300,2],['personal-defence-laser',50,300,.5],
 ['cartridge-laser-carbine-10',30,210,.45],['cartridge-laser-carbine-12',40,210,.5],
 ['cartridge-laser-rifle-10',40,450,1],['cartridge-laser-rifle-12',50,450,1],
 ['light-gatling-laser',200,900,18],['cppg-11',12,900,.72],['cppg-12',12,1350,.72],['cppg-13',12,1800,.6],
 ['repeating-crossbow',12,18,.24]
];
const ref='option:storage-compartment',cold='option:refrigerated-storage-compartment';
const record=(patch={})=>({id:'weapon',weaponId:'csc-assault-pistol',placement:'body',manipulatorId:'none',linkedWeapons:2,fireControl:'none',autoload:false,extraMagazines:2,initialMagazines:1,initialMagazineType:'high-capacity',extraHighCapacityMagazines:3,spareMagazineStorageId:ref,highCapacityMagazineStorageId:cold,...patch});
const equipment=(id='storage-compartment',quantity=1,instanceId)=>({id,quantity,...(instanceId?{instanceId}:{})});
const installed=()=>[equipment(),equipment('refrigerated-storage-compartment')];
const direct=(records=[record()],storage=installed(),techLevel=23)=>{validateWeapons(records);return evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:records}}},[],[],storage);};
const design=(records=[record()],physical={})=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{options:['storage-compartment','refrigerated-storage-compartment'],optionParameters:{'storage-compartment':{quantity:1},'refrigerated-storage-compartment':{quantity:1}},...physical,weapons:records}}});
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const stat=d=>formatStatblock(projectReview(d,getCatalogue(d),evaluateDesign(d)));

test('high-capacity conversion is explicitly source-scoped to sixteen priced magazine profiles',()=>{
 assert.deepEqual([...CSC_HIGH_CAPACITY_MAGAZINE_IDS].sort(),fixtures.map(([id])=>'csc-'+id).sort());
 assert.equal(Object.isFrozen(CSC_HIGH_CAPACITY_MAGAZINE_IDS),true);
 assert.deepEqual(WEAPONS.filter(w=>cscMagazineVariants(w)).map(w=>w.id).sort(),[...CSC_HIGH_CAPACITY_MAGAZINE_IDS].sort());
 for(const w of WEAPONS.filter(w=>!CSC_HIGH_CAPACITY_MAGAZINE_IDS.includes(w.id))){
  assert.equal(cscMagazineVariants(w),null,w.id);
  const r=direct([record({weaponId:w.id})],[equipment('storage-compartment',100),equipment('refrigerated-storage-compartment',100)]);
  assert.ok(has(r,'CSC_HIGH_CAPACITY_UNSUPPORTED'),w.id);assert.equal(r.weapons[0].cost,null,w.id);
  assert.equal(r.weapons[0].magazineVariants,undefined,w.id);assert.equal(r.weapons[0].highCapacitySpareAmmunition,undefined,w.id);
 }
});
for(const [id,capacity,unitCost,massKg] of fixtures)test('high-capacity '+id+' has independent capacity, cost and doubled estimate',()=>{
 const w=WEAPONS.find(w=>w.id==='csc-'+id),before=structuredClone(w),v=cscMagazineVariants(w);
 assert.deepEqual([v.highCapacity.capacity,v.highCapacity.unitCost,v.highCapacity.estimatedUnitMassKg],[capacity,unitCost,massKg]);
 assert.equal(v.highCapacity.tl,4);assert.equal(v.highCapacity.source.pages,'175');assert.ok(v.highCapacity.classificationSource.pages);
 assert.equal(v.highCapacity.qualification.refereeMayReject,true);assert.equal(v.highCapacity.estimate.standardUnitMassKg,estimateCscMagazineMass(w).unitMassKg);
 assert.equal(v.highCapacity.estimate.massMultiplier,2);assert.equal(v.highCapacity.estimate.unitMassKg,massKg);
 assert.equal(v.highCapacity.estimatedUnitMassKg,v.standard.estimatedUnitMassKg*2);
 assert.equal(w.initialIncluded,false);
 const r=direct([record({weaponId:w.id,linkedWeapons:1,extraMagazines:0,spareMagazineStorageId:'none',extraHighCapacityMagazines:1})],[equipment('refrigerated-storage-compartment',1000)]),actual=r.weapons[0];
 assert.equal(actual.cost,w.cost+MOUNTS[w.mountClass].cost+2*unitCost);assert.equal(actual.magazine,w.magazine);
 assert.equal(actual.initialAmmunition.capacityPerMagazine,capacity);assert.equal(actual.ammunitionInventory.totalRounds,capacity*2);
 assert.equal(actual.highCapacitySpareAmmunition.massKg,massKg);assert.deepEqual(w,before);
});

test('two Assault Pistols account for mixed loads exactly once in separate compartments',()=>{
 const r=direct(),w=r.weapons[0];
 assert.equal(r.cost,1780);assert.equal(r.ledger[0].cost,1780);assert.equal(w.slots,2);
 assert.deepEqual([w.spareAmmunition.count,w.spareAmmunition.cost,w.spareAmmunition.massKg],[4,40,.3]);
 assert.deepEqual([w.highCapacitySpareAmmunition.count,w.highCapacitySpareAmmunition.cost,w.highCapacitySpareAmmunition.massKg],[6,180,.9]);
 assert.deepEqual([w.initialAmmunition.count,w.initialAmmunition.purchaseCost,w.initialAmmunition.totalRounds],[2,60,60]);
 assert.deepEqual([w.ammunitionInventory.totalCost,w.ammunitionInventory.totalRounds,w.magazine],[280,300,15]);
 assert.deepEqual(r.ammunitionStorage.map(s=>[s.storageId,s.reservedKg,s.remainingKg]),[[ref,.3,1.7],[cold,.9,1.1]]);
});

test('initial load type/count and linked quantities remain independent of spare variants',()=>{
 for(const linkedWeapons of [1,2,3,4])for(const initialMagazineType of ['standard','high-capacity'])for(const initialMagazines of [0,1]){
  const d=record({linkedWeapons,initialMagazineType,initialMagazines}),r=direct([d],[equipment('storage-compartment',10),equipment('refrigerated-storage-compartment',10)]),w=r.weapons[0],initialPrice=initialMagazineType==='standard'?10:30,initialCapacity=initialMagazineType==='standard'?15:30;
  assert.equal(w.cost,(750+110+initialPrice*initialMagazines)*linkedWeapons);
  assert.equal(w.ammunitionInventory.totalRounds,(120+initialCapacity*initialMagazines)*linkedWeapons);
  assert.equal(w.initialAmmunition.purchaseCost,initialPrice*initialMagazines*linkedWeapons);
  assert.equal(w.spareAmmunition.massKg,Math.round(.15*linkedWeapons*1e9)/1e9);assert.equal(w.highCapacitySpareAmmunition.massKg,Math.round(.45*linkedWeapons*1e9)/1e9);
 }
 for(const initialMagazines of [0,1]){
  const r=direct([record({initialMagazines,extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'})]);
  assert.deepEqual(r.ammunitionStorage,[]);assert.equal(r.weapons[0].cost,1500+60*initialMagazines);
 }
});

test('autoload accepts a mixed total of ten or ten high-capacity magazines, without a five-magazine invention',()=>{
 for(const [standard,high] of [[1,0],[0,1],[3,7],[0,10],[10,0]])for(const linkedWeapons of [1,2,4]){
  const r=direct([record({linkedWeapons,autoload:true,extraMagazines:standard,extraHighCapacityMagazines:high,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'})],[]),w=r.weapons[0];
  assert.equal(has(r,'EMPTY_AUTOLOADER'),false);assert.equal(w.cost,(750+30+2*(standard*10+high*30))*linkedWeapons);assert.equal(w.slots,2*linkedWeapons);
  assert.equal(w.ammunitionInventory.ammunitionCost,30*linkedWeapons);assert.equal(w.ammunitionInventory.autoloadCost,2*(standard*10+high*30)*linkedWeapons);
  assert.equal(w.ammunitionInventory.autoload.countPerWeapon,standard+high);assert.equal(w.ammunitionInventory.autoload.maximumPerWeapon,10);
  assert.equal(w.ammunitionInventory.autoload.source.pages,'61');
  if(high)assert.match(w.ammunitionInventory.autoload.composition,/not a worked source example/);
  assert.equal(w.spareAmmunition,undefined);assert.equal(w.highCapacitySpareAmmunition,undefined);assert.deepEqual(r.ammunitionStorage,[]);
 }
 assert.ok(has(direct([record({autoload:true,extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'})]),'EMPTY_AUTOLOADER'));
 for(const [standard,high,autoload] of [[5,6,true],[10,1,true],[1,10,true],[99,2,false],[1,100,false]])assert.throws(()=>validateWeapons([record({extraMagazines:standard,extraHighCapacityMagazines:high,autoload})]),/combinedExtraMagazines/);
 for(const [standard,high] of [[0,100],[50,50],[99,1],[100,0]])assert.doesNotThrow(()=>validateWeapons([record({extraMagazines:standard,extraHighCapacityMagazines:high})]));
});

test('schema rejects malformed new values and combined-limit API/import failures are atomic',()=>{
 for(const value of [-1,101,1.1,'1',null,NaN,Infinity,Number.MAX_SAFE_INTEGER])assert.throws(()=>validateWeapons([record({extraHighCapacityMagazines:value})]),TypeError);
 for(const value of ['',null,0,{},'high','HIGH-CAPACITY'])assert.throws(()=>validateWeapons([record({initialMagazineType:value})]),TypeError);
 for(const value of [null,1,{},'', 'instance:', 'option:bad value','x'.repeat(101)])assert.throws(()=>validateWeapons([record({highCapacityMagazineStorageId:value})]),TypeError);
 const api=createRobotApi();api.importDesign(exportDesign(design()));const before=api.getView().design;
 const invalid={...before.selections.physical.weapons[0],autoload:true,extraMagazines:5,extraHighCapacityMagazines:6,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'};
 assert.throws(()=>api.select({stage:'physical',field:'weapons',value:[invalid]}),/combinedExtraMagazines/);assert.deepEqual(api.getView().design,before);
 const imported=structuredClone(before);imported.selections.physical.weapons=[invalid];assert.throws(()=>api.importDesign(JSON.stringify(imported)),/combinedExtraMagazines/);assert.deepEqual(api.getView().design,before);
});

test('legacy imports retain absent fields, prices and standard load capacity',()=>{
 const old=record({extraMagazines:0,spareMagazineStorageId:'none'});delete old.initialMagazineType;delete old.extraHighCapacityMagazines;delete old.highCapacityMagazineStorageId;
 const d=design([old]),restored=importDesign(exportDesign(d));assert.deepEqual(restored,d);
 const w=evaluateDesign(restored).totals.weapons[0];assert.equal(w.cost,1520);assert.equal(w.initialAmmunition.type,'standard');assert.equal(w.initialAmmunition.capacityPerMagazine,15);
 for(const key of ['initialMagazineType','extraHighCapacityMagazines','highCapacityMagazineStorageId'])assert.equal(Object.hasOwn(restored.selections.physical.weapons[0],key),false);
 for(const id of ['laser-pistol-11','csc-gauntlet-laser','csc-heavy-laser-rifle']){
  const r=direct([record({weaponId:id,extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'})]);
  assert.ok(has(r,'CSC_HIGH_CAPACITY_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.equal(r.weapons[0].magazineVariants,undefined);
 }
});

test('TL4 is independently enforced, shotgun suitability qualified, and equal capacities never merge feeds',()=>{
 const r=direct([record({weaponId:'csc-repeating-crossbow',linkedWeapons:1,extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'})],[],3);
 assert.ok(has(r,'CSC_HIGH_CAPACITY_TL'));assert.equal(has(r,'WEAPON_TL'),false);
 const shotgun=direct([record({weaponId:'csc-assault-shotgun',linkedWeapons:1})],[equipment('storage-compartment',10),equipment('refrigerated-storage-compartment',10)]);
 assert.equal(shotgun.weapons[0].magazineVariants.highCapacity.qualification.shotgunReview,true);assert.match(shotgun.diagnostics.find(d=>d.code==='CSC_HIGH_CAPACITY_REFEREE').message,/shotgun/);
 const arl=cscMagazineVariants(WEAPONS.find(w=>w.id==='csc-arl-standard')),support=cscMagazineVariants(WEAPONS.find(w=>w.id==='csc-arl-support'));
 assert.deepEqual([arl.highCapacity.capacity,arl.highCapacity.unitCost,arl.highCapacity.estimatedUnitMassKg],[40,300,.6]);
 assert.deepEqual([support.standard.capacity,support.standard.unitCost,support.standard.estimatedUnitMassKg],[40,200,.8]);
 const w=direct([record({weaponId:'csc-arl-standard',linkedWeapons:1,extraMagazines:0,extraHighCapacityMagazines:1,spareMagazineStorageId:'none'})]).weapons[0];
 assert.equal(w.conditionalEffects.magazineInterchangeability.alternateMagazineSelectionImplemented,true);
});

const grenades=()=>record({id:'grenades',weaponId:'grenade-launcher',linkedWeapons:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none',ammunition:'frag',looseGrenades:1,looseAmmunitionFor:'primary',ammunitionStorageId:ref});
test('mixed CSC magazines share exact-fit storage with loose Core grenades, independent of record order',()=>{
 const mixed=record({extraMagazines:4,highCapacityMagazineStorageId:ref});
 for(const records of [[mixed,grenades()],[grenades(),mixed]]){
  const r=evaluateDesign(design(records));assert.equal(r.status,'verified');assert.deepEqual(r.totals.ammunitionStorage.map(s=>[s.capacityKg,s.reservedKg,s.remainingKg]),[[2,2,0]]);
  assert.equal(r.totals.weapons.find(w=>w.id==='weapon').cost,1820);
  const over=records.map(w=>w.id==='weapon'?{...w,extraHighCapacityMagazines:4}:w),result=evaluateDesign(design(over));
  assert.equal(result.status,'invalid');assert.ok(has(result,'AMMUNITION_STORAGE_CAPACITY'));assert.ok(has(result,'SPARE_AMMO_STORAGE'));assert.equal(result.totals,null);
 }
 const distributed=direct([record({extraHighCapacityMagazines:7})]);assert.ok(has(distributed,'AMMUNITION_STORAGE_CAPACITY'));
 assert.equal(distributed.ammunitionStorage.find(s=>s.storageId===ref).remainingKg,1.7);assert.equal(distributed.ammunitionStorage.find(s=>s.storageId===cold).remainingKg,-.1);
});

test('invalid retained high-capacity associations cannot evade count, storage, source or autoload checks',()=>{
 for(const [patch,code] of [[{extraHighCapacityMagazines:0},'UNUSED_SPARE_AMMO_STORAGE'],[{autoload:true},'SPARE_AMMO_STORAGE_AUTOLOADER'],[{highCapacityMagazineStorageId:'instance:missing'},'SPARE_AMMO_STORAGE_REQUIRED'],[{weaponId:'csc-crossbow'},'CSC_HIGH_CAPACITY_UNSUPPORTED'],[{weaponId:'csc-laser-pistol-11'},'CSC_HIGH_CAPACITY_UNSUPPORTED'],[{weaponId:'autopistol'},'CSC_HIGH_CAPACITY_UNSUPPORTED']]){
  const d=design([record(patch)]),restored=importDesign(exportDesign(d)),r=evaluateDesign(restored);assert.deepEqual(restored.selections.physical.weapons,d.selections.physical.weapons);assert.ok(has(r,code));assert.equal(r.totals,null);
 }
 const removed=updateDesign(design(),{selections:{physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:10}}}}});
 assert.equal(removed.selections.physical.weapons[0].highCapacityMagazineStorageId,cold);assert.ok(has(evaluateDesign(removed),'SPARE_AMMO_STORAGE_REQUIRED'));
 const d=design();d.selections.physical.weapons[0].magazineVariants={highCapacity:{capacity:999}};assert.throws(()=>importDesign(JSON.stringify(d)),/unknown field/);
});

test('controls retain and expose invalid dependent values and display defaults without mutating old records',()=>{
 const source=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8'),matches=source.match(/function matchesVisibility\(control, values\) \{[\s\S]*?\n\}/)[0],reset=source.match(/function resetHiddenFields\(control, record\) \{[\s\S]*?\n\}/)[0];
 const helper=runInThisContext('(function(){'+matches+'\n'+reset+';return {matchesVisibility,resetHiddenFields};})')(),control=weaponControl(design());
 for(const key of ['initialMagazineType','extraHighCapacityMagazines','highCapacityMagazineStorageId','spareMagazineStorageId'])assert.equal(control.itemFields.find(f=>f.field===key).resetWhenHidden,undefined);
 for(const patch of [{weaponId:'csc-crossbow'},{autoload:true},{extraMagazines:0,extraHighCapacityMagazines:0}]){
  const selected=record(patch),retained=helper.resetHiddenFields(control,selected);
  for(const key of ['initialMagazineType','extraHighCapacityMagazines','highCapacityMagazineStorageId','spareMagazineStorageId'])assert.equal(retained[key],selected[key]);
  for(const key of ['initialMagazineType','highCapacityMagazineStorageId','spareMagazineStorageId'])assert.equal(helper.matchesVisibility(control.itemFields.find(f=>f.field===key),retained),true);
 }
 const old={...record(),weaponId:'autopistol',extraMagazines:0,spareMagazineStorageId:'none'};delete old.initialMagazineType;delete old.extraHighCapacityMagazines;delete old.highCapacityMagazineStorageId;
 const display={...Object.fromEntries(control.itemFields.filter(f=>Object.hasOwn(f,'default')).map(f=>[f.field,f.default])),...old};
 for(const key of ['initialMagazineType','extraHighCapacityMagazines','highCapacityMagazineStorageId'])assert.equal(helper.matchesVisibility(control.itemFields.find(f=>f.field===key),display),false);
 const low=weaponControl({...design(),techLevel:3}).itemFields.find(f=>f.field==='initialMagazineType');assert.equal(low.choices[1].eligibility.available,false);
});

test('API roundtrip, review and statblock retain both variants with readable storage and precise estimates',()=>{
 const api=createRobotApi(),d=design([record({spareMagazineStorageId:'instance:standard-locker',highCapacityMagazineStorageId:'instance:high-locker'})],{options:[],optionParameters:{},optionInstances:[{id:'standard-locker',optionId:'storage-compartment',parameters:{quantity:1}},{id:'high-locker',optionId:'refrigerated-storage-compartment',parameters:{quantity:1}}]});
 api.importDesign(exportDesign(d));assert.deepEqual(api.getView().design,d);assert.deepEqual(importDesign(api.exportDesign()),d);
 const result=evaluateDesign(d),before=structuredClone(result),text=formatStatblock(projectReview(d,getCatalogue(d),result));
 assert.equal(text.includes('instance:standard-locker'),false);assert.equal(text.includes('instance:high-locker'),false);
 assert.match(text,/Storage Compartment 1/);assert.match(text,/Refrigerated Storage Compartment 2/);assert.match(text,/High-capacity spare ammunition \(estimated mass\)/);assert.match(text,/Unit Mass Kg: 0.075/);assert.match(text,/Standard Unit Mass Kg: 0.075/);assert.match(text,/Capacity Per Magazine: 30/);assert.match(text,/Total Rounds: 300/);assert.deepEqual(result,before);
 result.totals.weapons[0].magazineVariants.standard.source.pages='bad';result.totals.weapons[0].highCapacitySpareAmmunition.estimate.source.pages='bad';
 const fresh=evaluateDesign(d);assert.notEqual(fresh.totals.weapons[0].magazineVariants.standard.source.pages,'bad');assert.equal(fresh.totals.weapons[0].highCapacitySpareAmmunition.estimate.source.pages,'142');
 const profile=WEAPONS.find(w=>w.id==='csc-assault-pistol'),variants=cscMagazineVariants(profile);variants.standard.source.pages='bad';assert.notEqual(profile.source.pages,'bad');
 const catalogue=weaponControl(d);catalogue.itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id===profile.id).magazineVariants.highCapacity.capacity=999;assert.equal(cscMagazineVariants(profile).highCapacity.capacity,30);
});

const limbDesign=(copies=1,extra={})=>updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:copies}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'limb',quantity:1}}],augmentWeapons:[(({manipulatorId,...w})=>({...w,parentLimb:'limb'}))(record({placement:'arm',linkedWeapons:1,spareMagazineStorageId:'instance:locker',highCapacityMagazineStorageId:'instance:locker'}))],...extra}});
test('cyberlimb copies scope mixed inventories and storage per limb, scaling construction only once',()=>{
 const one=evaluateDesign(limbDesign()),two=evaluateDesign(limbDesign(2));assert.equal(one.status,'verified');assert.equal(two.status,'verified');
 const a=one.totals.augmentations[0],b=two.totals.augmentations[0];assert.equal(b.totalCost,2*a.totalCost);assert.equal(b.weaponCost,2*a.weaponCost);
 assert.deepEqual(b.weaponAccounting.ammunitionStorage,a.weaponAccounting.ammunitionStorage);assert.equal(b.weaponAccounting.ammunitionStorage[0].reservedKg,.6);
 assert.equal(b.weapons[0].highCapacitySpareAmmunition.count,3);assert.equal(b.weapons[0].ammunitionInventory.totalRounds,150);assert.equal(b.weapons[0].copies,2);
 assert.equal(stat(limbDesign(2)).includes('instance:locker'),false);
 const wrong=limbDesign(1,{augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{}},{id:'other',optionId:'cybernetic-arm',parameters:{}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'other',quantity:10}}]});assert.ok(has(evaluateDesign(wrong),'SPARE_AMMO_STORAGE_REQUIRED'));
});

test('component snapshots revalidate mixed inventories independently and expose readable variant storage',()=>{
 const child=design([record({highCapacityMagazineStorageId:'instance:child-locker'})],{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:1}},optionInstances:[{id:'child-locker',optionId:'refrigerated-storage-compartment',parameters:{quantity:1}}]});
 const host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:child}]}}),r=evaluateDesign(host);
 assert.equal(r.status,'verified');const text=stat(host);assert.equal(text.includes('instance:child-locker'),false);assert.match(text,/Refrigerated Storage Compartment \(separate installation 1\)/);assert.match(text,/High-capacity spare ammunition \(estimated mass\)/);assert.match(text,/Standard Unit Mass Kg: 0.075/);
 const invalid=structuredClone(host);invalid.special.designReferences[0].design.selections.physical.weapons[0].highCapacityMagazineStorageId='instance:missing';assert.notEqual(evaluateDesign(invalid).status,'verified');
 assert.equal(child.selections.physical.weapons[0].highCapacityMagazineStorageId,'instance:child-locker');
});
