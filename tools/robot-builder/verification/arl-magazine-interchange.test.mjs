import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,importDesign,exportDesign} from '../engine/index.mjs';
import {WEAPONS,validateWeapons,evaluateWeapons,weaponControl,weaponRecordPresentation,ammunitionPartition} from '../engine/weapons.mjs';
import {cscInterchangeMagazineProducts,cscMagazineSourceIds} from '../engine/csc-ammunition-storage.mjs';
import {evaluateAugmentations} from '../engine/augmentations.mjs';
import {createRobotApi} from '../js/api.mjs';

const standard='csc-arl-standard',support='csc-arl-support',pdw='csc-arl-pdw',ref='option:storage-compartment',cold='option:refrigerated-storage-compartment';
const alternate=(patch={})=>({sourceWeaponId:support,variant:'standard',extraMagazines:3,autoloadMagazines:2,storageId:ref,...patch});
const spec=(patch={})=>({initialMagazines:1,initialMagazineType:'standard',initialMagazineSourceId:support,extraMagazines:2,extraHighCapacityMagazines:1,autoloadAllocation:{standard:1,highCapacity:1},spareMagazineStorageId:ref,highCapacityMagazineStorageId:'none',alternateMagazineSupplies:[alternate(),alternate({variant:'high-capacity',extraMagazines:1,autoloadMagazines:1,storageId:'none'})],...patch});
const record=(patch={})=>({id:'arl',weaponId:standard,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:true,...spec(),...patch});
const storage=(quantity=1)=>[{id:'storage-compartment',quantity},{id:'refrigerated-storage-compartment',quantity}];
const direct=(records=[record()],equipment=storage(),techLevel=23)=>{validateWeapons(records);return evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:records}}},[],[],equipment);};
const design=(records=[record()])=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{options:['storage-compartment','refrigerated-storage-compartment'],optionParameters:{'storage-compartment':{quantity:10},'refrigerated-storage-compartment':{quantity:10}},weapons:records}}});
const empty=(patch={})=>record({autoload:false,extraMagazines:0,extraHighCapacityMagazines:0,autoloadAllocation:{standard:0,highCapacity:0},spareMagazineStorageId:'none',alternateMagazineSupplies:[],...patch});
const has=(r,code)=>r.diagnostics.some(item=>item.code===code);
const product=(w,id,variant='standard')=>w.ammunitionInventory.products.find(item=>item.productId===id+':'+variant);

// Independent fixtures from CSC pp142,160-161,175 (revised copyright 2026).
test('four source products retain distinct identity, price, estimated mass and qualifications',()=>{
 const expected=[[standard,'standard',20,100,.3],[standard,'high-capacity',40,300,.6],[support,'standard',40,200,.8],[support,'high-capacity',80,600,1.6]];
 for(const weaponId of [standard,support]){
  const receiver=WEAPONS.find(item=>item.id===weaponId),products=cscInterchangeMagazineProducts(receiver,WEAPONS);
  assert.deepEqual(products.map(p=>[p.sourceWeaponId,p.id,p.capacity,p.unitCost,p.estimate.unitMassKg]),expected);
  for(const p of products){assert.equal(p.productId,p.sourceWeaponId+':'+p.id);assert.equal(p.estimate.estimated,true);assert.equal(p.estimate.source.pages,'142');assert.equal(p.estimate.basisSourceWeaponId,p.sourceWeaponId);assert.match(p.estimate.scope,/does not settle donor versus receiver/);assert.equal(p.interchangeSource.pages,'160');}
  for(const p of products.filter(p=>p.id==='high-capacity')){assert.equal(p.tl,4);assert.equal(p.estimate.massMultiplier,2);assert.equal(p.qualification.refereeMayReject,true);assert.match(p.qualification.composition,/not a worked source example/);}
 }
 assert.deepEqual(cscMagazineSourceIds(WEAPONS.find(w=>w.id===pdw)),[]);
});

test('exact mixed fixture counts five physical loader magazines, two reserves and one initial once',()=>{
 const r=direct(),w=r.weapons[0],a=w.ammunitionInventory;
 assert.equal(r.cost,9100);assert.equal(w.cost,9100);assert.equal(w.slots,20);
 assert.deepEqual([w.initialAmmunition.count,w.initialAmmunition.totalRounds,w.initialAmmunition.purchaseCost],[1,40,200]);
 assert.deepEqual([a.allocation.autoloadCountPerWeapon,a.allocation.autoloadRounds,a.allocation.storedCountPerWeapon,a.allocation.storedRounds],[5,220,2,60]);
 assert.deepEqual([a.allocation.reservePurchaseCost,a.autoloadCost,a.totalCost,a.totalRounds],[300,2800,3300,320]);
 assert.equal(r.ammunitionStorage[0].reservedKg,1.1);assert.equal(a.products.length,4);
 assert.deepEqual(a.products.map(p=>[p.sourceWeaponId,p.variant,p.autoloadCount,p.storedCount]),[[standard,'standard',1,1],[standard,'high-capacity',1,0],[support,'standard',2,1],[support,'high-capacity',1,0]]);
 assert.equal(product(w,standard,'high-capacity').capacity,product(w,support).capacity);
 assert.notEqual(product(w,standard,'high-capacity').productId,product(w,support).productId);
 assert.ok(has(r,'CSC_ARL_MAGAZINE_MASS_CONVENTION'));assert.ok(has(r,'CSC_ARL_HIGH_CAPACITY_COMPOSITION'));
 assert.match(a.autoload.composition,/not a worked source example/);assert.equal(evaluateDesign(design()).status,'verified');
});

for(const [receiver,donor,base,mass,auto] of [[standard,support,800,3,false],[support,standard,1300,4,true]])test('initial donor in '+receiver+' preserves receiver identity and charges no own initial',()=>{
 for(const variant of ['standard','high-capacity']){
  const r=direct([empty({weaponId:receiver,initialMagazineSourceId:donor,initialMagazineType:variant})]),w=r.weapons[0],source=WEAPONS.find(x=>x.id===receiver),donorSource=WEAPONS.find(x=>x.id===donor),factor=variant==='standard'?1:3;
  assert.equal(w.weaponId,receiver);assert.equal(w.massKg,mass);assert.equal(w.traits.includes('Auto 4'),auto);assert.equal(w.magazine,source.magazine);assert.equal(w.range,80);assert.equal(w.damage,'4D');assert.equal(w.cost,base+5000+donorSource.magazineCost*factor);
  assert.equal(w.initialAmmunition.sourceWeaponId,donor);assert.equal(w.initialAmmunition.totalRounds,donorSource.magazine*(variant==='standard'?1:2));assert.equal(w.ammunitionInventory.products.reduce((sum,p)=>sum+p.initialPurchaseCost,0),donorSource.magazineCost*factor);
  assert.equal(w.conditionalEffects.magazineInterchangeability.alternateMagazineSelectionImplemented,true);assert.equal(w.ammunitionAccounting.sourceInclusion,'not-stated');
 }
});

test('donor spare mass stays fixed in either receiver rather than being recomputed from receiver weight',()=>{
 for(const sourceWeaponId of [standard,support])for(const variant of ['standard','high-capacity']){
  const own=empty({weaponId:sourceWeaponId,initialMagazineSourceId:sourceWeaponId,...(variant==='standard'?{extraMagazines:1,spareMagazineStorageId:ref}:{extraHighCapacityMagazines:1,highCapacityMagazineStorageId:ref})});
  const other=empty({weaponId:sourceWeaponId===standard?support:standard,initialMagazineSourceId:sourceWeaponId,alternateMagazineSupplies:[alternate({sourceWeaponId,variant,extraMagazines:1,autoloadMagazines:0})]});
  assert.equal(direct([own]).ammunitionStorage[0].reservedKg,direct([other]).ammunitionStorage[0].reservedKg);
 }
});

test('ten versus eleven combines all four physical products per copy, never round capacity',()=>{
 for(const count of [10,11]){
  const w=record({extraMagazines:3,extraHighCapacityMagazines:2,autoloadAllocation:{standard:3,highCapacity:2},spareMagazineStorageId:'none',alternateMagazineSupplies:[alternate({extraMagazines:3,autoloadMagazines:3,storageId:'none'}),alternate({variant:'high-capacity',extraMagazines:count-8,autoloadMagazines:count-8,storageId:'none'})]}),r=direct([w]);
  assert.equal(r.weapons[0].ammunitionInventory.autoload.countPerWeapon,count);assert.equal(has(r,'AUTOLOAD_ALLOCATION_LIMIT'),count===11);assert.equal(r.weapons[0].cost===null,count===11);
 }
 const perCopy=record({linkedWeapons:2,ammunitionOverrides:[{copyIndex:2,...spec({extraMagazines:7,autoloadAllocation:{standard:7,highCapacity:1},spareMagazineStorageId:'none'})}]}),r=direct([perCopy]);
 assert.equal(r.weapons[0].ammunitionInventory.autoload.count,16);assert.ok(has(r,'AUTOLOAD_ALLOCATION_LIMIT'));assert.match(r.diagnostics.find(d=>d.code==='AUTOLOAD_ALLOCATION_LIMIT').path,/ammunitionOverrides.2$/);assert.equal(r.weapons[0].cost,null);
});

test('hundred-reserve application bound spans products separately from ten loaders',()=>{
 const w=record({extraMagazines:60,extraHighCapacityMagazines:0,autoloadAllocation:{standard:5,highCapacity:0},alternateMagazineSupplies:[alternate({extraMagazines:50,autoloadMagazines:5})]}),r=direct([w],storage(100));
 assert.equal(r.weapons[0].ammunitionInventory.allocation.storedCountPerWeapon,100);assert.equal(has(r,'STORED_AMMO_APPLICATION_LIMIT'),false);assert.notEqual(r.weapons[0].cost,null);
 w.alternateMagazineSupplies[0].extraMagazines=51;const bad=direct([w],storage(100));assert.ok(has(bad,'STORED_AMMO_APPLICATION_LIMIT'));assert.equal(bad.weapons[0].cost,null);
});

test('asymmetric linked copies aggregate source identities, inventories and shared FCS once',()=>{
 const override=spec({initialMagazineSourceId:standard,initialMagazineType:'high-capacity',extraMagazines:0,extraHighCapacityMagazines:0,autoloadAllocation:{standard:0,highCapacity:0},spareMagazineStorageId:'none',alternateMagazineSupplies:[alternate({extraMagazines:2,autoloadMagazines:1,storageId:cold})]});
 const w=record({linkedWeapons:2,fireControl:'basic',ammunitionOverrides:[{copyIndex:2,...override}]}),r=direct([w],storage(10)),out=r.weapons[0],a=out.ammunitionInventory;
 assert.equal(r.cost,25800);assert.equal(r.slots,41);assert.equal(out.linkedDamageBonus,4);assert.equal(out.ammunitionCopies.length,2);
 assert.deepEqual([out.initialAmmunition.purchaseCost,a.allocation.reservePurchaseCost,a.autoloadCost,a.totalCost,a.totalRounds],[500,500,3200,4200,440]);
 assert.equal(a.autoload.count,6);assert.equal(a.allocation.autoloadRounds,260);assert.equal(a.products.length,4);
 assert.equal(Object.hasOwn(a.products[0],'totalPerWeapon'),false);assert.equal(Object.hasOwn(a.products[0],'capacityPerWeapon'),false);
 assert.deepEqual(product(out,support).storageReservations.map(x=>[x.copyIndex,x.storageId,x.massKg]),[[1,ref,.8],[2,cold,.8]]);
 assert.deepEqual(r.ammunitionStorage.map(x=>[x.storageId,x.reservedKg]),[[ref,1.1],[cold,.8]]);
});

test('legacy records and complete old overrides keep absence, meaning and independence from new defaults',()=>{
 const legacy={id:'old',weaponId:standard,placement:'body',manipulatorId:'none',linkedWeapons:2,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1};
 const oldSpec={initialMagazines:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'};
 const inherited=empty({linkedWeapons:2,ammunitionOverrides:[{copyIndex:2,...oldSpec}]});
 assert.deepEqual(importDesign(exportDesign(design([legacy]))).selections.physical.weapons,[legacy]);assert.equal(direct([legacy]).cost,11800);
 const r=direct([inherited]);assert.deepEqual(r.weapons[0].ammunitionCopies.map(c=>[c.initialAmmunition.sourceWeaponId,c.initialAmmunition.purchaseCost]),[[support,200],[standard,100]]);
 const materialized=weaponRecordPresentation(inherited,2).ammunitionCustomization.materializedValue;assert.deepEqual(materialized,oldSpec);assert.equal(Object.hasOwn(materialized,'alternateMagazineSupplies'),false);
 const changed=structuredClone(inherited);changed.alternateMagazineSupplies=[alternate({extraMagazines:1,autoloadMagazines:0})];assert.equal(direct([changed]).weapons[0].ammunitionCopies[1].ammunitionInventory.totalRounds,20);
});

test('incompatible source, stale storage, disabling loader and reduced linked count stay correctable',()=>{
 for(const patch of [{weaponId:pdw},{weaponId:'csc-assault-pistol'},{initialMagazineSourceId:'removed-source'},{autoload:false},{alternateMagazineSupplies:[alternate({storageId:'instance:removed'})]},{alternateMagazineSupplies:[alternate({sourceWeaponId:standard})]}]){
  const w=record(patch),d=design([w]),r=evaluateDesign(d);assert.notEqual(r.status,'verified');assert.deepEqual(importDesign(exportDesign(d)).selections.physical.weapons,[w]);
 }
 const w=record({linkedWeapons:1,ammunitionOverrides:[{copyIndex:2,...spec()}]}),r=direct([w]);assert.ok(has(r,'AMMUNITION_COPY_NOT_INSTALLED'));assert.equal(r.cost,9100);assert.equal(r.ammunitionStorage[0].reservedKg,1.1);assert.deepEqual(weaponRecordPresentation(w).ammunitionCustomization.retainedCopyIndices,[2]);
 const restored=direct([{...w,linkedWeapons:2}],storage(10));assert.equal(restored.cost,18200);
 assert.equal(weaponRecordPresentation(record({weaponId:pdw})).magazineSupplySelection.forceGroupOpen,true);
});

test('PDW and unrelated products never gain interchange from calibre, capacity or source family',()=>{
 for(const [receiver,source] of [[standard,pdw],[support,pdw],[pdw,standard],['csc-assault-pistol',support],[standard,'csc-assault-pistol'],[standard,'removed-source']]){
  for(const variant of ['standard','high-capacity']){
   const w=empty({weaponId:receiver,initialMagazineSourceId:source,initialMagazineType:variant}),r=direct([w]);assert.ok(has(r,'MAGAZINE_SOURCE_INCOMPATIBLE'));assert.equal(r.weapons[0].cost,null);assert.equal(r.weapons[0].initialAmmunition.purchaseCost,null);
   const extra=direct([empty({weaponId:receiver,initialMagazineSourceId:receiver,alternateMagazineSupplies:[alternate({sourceWeaponId:source,variant,extraMagazines:1,autoloadMagazines:0})]})]);assert.ok(has(extra,'MAGAZINE_SOURCE_INCOMPATIBLE'));assert.equal(extra.weapons[0].cost,null);
  }
 }
});

test('schema bounds, duplicate identities and malformed fields fail atomically without losing drafts',()=>{
 const api=createRobotApi();api.importDesign(exportDesign(design()));const before=api.exportDesign();
 const bad=[null,{},[null],[{}],[alternate(),alternate()],[alternate(),alternate({variant:'high-capacity'}),alternate({sourceWeaponId:standard})]];
 for(const field of ['sourceWeaponId','variant','extraMagazines','autoloadMagazines','storageId']){const row=alternate();delete row[field];bad.push([row]);}
 for(const patch of [{sourceWeaponId:''},{variant:'normal'},{extraMagazines:-1},{extraMagazines:111},{autoloadMagazines:111},{autoloadMagazines:1.5},{storageId:'bad'},{other:true}])bad.push([alternate(patch)]);
 for(const alternateMagazineSupplies of bad){assert.throws(()=>api.select({stage:'physical',field:'weapons',value:[record({alternateMagazineSupplies})]}),TypeError);assert.equal(api.exportDesign(),before);}
 for(const initialMagazineSourceId of [null,42,'',{},'bad source'])assert.throws(()=>validateWeapons([record({initialMagazineSourceId})]),TypeError);
});

test('over-allocation leaves every reserve unresolved and never reserves negative or guessed cargo',()=>{
 const w=record({alternateMagazineSupplies:[alternate({autoloadMagazines:4})]}),r=direct([w]);assert.ok(has(r,'AUTOLOAD_ALLOCATION_EXCEEDS_SUPPLY'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.ammunitionStorage,[]);
 assert.equal(r.weapons[0].ammunitionInventory.products.every(p=>p.storedCount===null),true);assert.equal(ammunitionPartition(w).storedCountPerWeapon,null);
});

test('all source products share storage capacity with own reserves and loose Core rounds',()=>{
 const grenade={id:'grenades',weaponId:'grenade-launcher',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,ammunition:'smoke',looseGrenades:2,ammunitionStorageId:ref};
 for(const records of [[record(),grenade],[grenade,record()]]){const r=direct(records);assert.equal(r.ammunitionStorage[0].reservedKg,2.1);assert.ok(has(r,'AMMUNITION_STORAGE_CAPACITY'));assert.ok(has(r,'SPARE_AMMO_STORAGE'));}
});

test('API metadata, evaluation and products detach nested choices and roundtrip optional fields',()=>{
 const d=design(),api=createRobotApi();api.importDesign(exportDesign(d));const before=api.exportDesign(),view=api.getView(),p=weaponRecordPresentation(record());
 assert.deepEqual(importDesign(before),d);assert.equal(p.magazineSupplySelection.products.length,4);assert.equal(p.magazineSupplySelection.initialSourceId,support);
 assert.equal(weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id===standard).magazineProducts.length,4);
 p.magazineSupplySelection.products[0].estimate.unitMassKg=999;p.ammunitionCustomization.materializedValue.alternateMagazineSupplies[0].extraMagazines=999;
 view.evaluation.totals.weapons[0].ammunitionInventory.products[2].storageReservations[0].massKg=999;
 const standalone=cscInterchangeMagazineProducts(WEAPONS.find(w=>w.id===standard),WEAPONS);standalone[0].estimate.unitMassKg=999;
 assert.equal(api.exportDesign(),before);assert.equal(api.getView().evaluation.totals.weapons[0].ammunitionInventory.products[2].storageReservations[0].massKg,.8);assert.equal(weaponRecordPresentation(record()).magazineSupplySelection.products[0].estimate.unitMassKg,.3);
});

test('included supply, empty loader, unknown replacement and unknown donor-price blockers remain intact',()=>{
 const included=direct([empty({weaponId:'stunner-12',initialMagazineSourceId:'stunner-12',initialMagazines:0})]);assert.ok(has(included,'INCLUDED_POWER_PACK'));assert.equal(included.weapons[0].initialAmmunition.purchaseCost,0);
 const blank=direct([empty({autoload:true})]);assert.ok(has(blank,'EMPTY_AUTOLOADER'));assert.equal(blank.weapons[0].cost,null);
 const unknown=direct([empty({weaponId:'csc-maser-pistol',initialMagazineSourceId:'csc-maser-pistol',extraMagazines:1})]);assert.ok(has(unknown,'CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE'));assert.equal(unknown.weapons[0].cost,null);
 const donor=WEAPONS.find(w=>w.id===support),saved=donor.magazineCost;
 try{donor.magazineCost=null;const r=direct([empty()]);assert.equal(r.weapons[0].initialAmmunition.purchaseCost,null);assert.equal(r.weapons[0].cost,null);assert.ok(has(r,'WEAPON_AMMUNITION_PRICE_UNRESOLVED'));}finally{donor.magazineCost=saved;}
});

test('component snapshots independently retain and revalidate ARL inventory and source scope',()=>{
 const d=design(),host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:d}]}});assert.equal(evaluateDesign(host).status,'verified');assert.deepEqual(importDesign(exportDesign(host)),host);
 const bad=structuredClone(host);bad.special.designReferences[0].design.selections.physical.weapons[0].alternateMagazineSupplies[0].sourceWeaponId=pdw;assert.notEqual(evaluateDesign(bad).status,'verified');
});

test('cyberlimb source products stay per limb without bypassing heavy mount capacity',()=>{
 const limb=quantity=>{const w=empty({weaponId:standard,initialMagazineSourceId:support,alternateMagazineSupplies:[alternate({extraMagazines:1,autoloadMagazines:0,storageId:'instance:locker'})]});delete w.manipulatorId;
  return updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'limb',quantity:1}}],augmentWeapons:[{...w,parentLimb:'limb',placement:'body'}]}});
 };
 const one=evaluateDesign(limb(1)),two=evaluateDesign(limb(2));assert.equal(one.status,'invalid');assert.equal(two.status,'invalid');assert.ok(has(one,'LIMB_SLOT_LIMIT'));assert.ok(has(two,'LIMB_SLOT_LIMIT'));assert.equal(one.totals,null);assert.equal(two.totals,null);const a=evaluateAugmentations(limb(1)).augmentations[0],b=evaluateAugmentations(limb(2)).augmentations[0];assert.equal(a.weaponCost,6200);assert.equal(b.weaponCost,12400);assert.equal(b.weapons[0].ammunitionInventory.totalRounds,80);assert.equal(b.weaponAccounting.ammunitionStorage[0].reservedKg,.8);assert.deepEqual(a.weaponAccounting.ammunitionStorage,b.weaponAccounting.ammunitionStorage);
});


test('alternate explicit allocations preserve omitted own legacy allocation and zero-quantity stale rows',()=>{
 const w=record({spareMagazineStorageId:'none'});delete w.autoloadAllocation;
 const r=direct([w]),a=r.weapons[0].ammunitionInventory;
 assert.deepEqual([a.autoload.countPerWeapon,a.allocation.autoloadRounds,a.allocation.storedCountPerWeapon,a.allocation.storedRounds,a.totalCost],[6,240,1,40,3400]);
 assert.equal(r.ammunitionStorage[0].reservedKg,.8);assert.equal(Object.hasOwn(importDesign(exportDesign(design([w]))).selections.physical.weapons[0],'autoloadAllocation'),false);
 const old=empty({initialMagazineSourceId:standard});delete old.autoloadAllocation;assert.equal(ammunitionPartition(old).mode,'legacy');
 for(const sourceWeaponId of [pdw,standard,'removed-source']){
  const zero=empty({alternateMagazineSupplies:[alternate({sourceWeaponId,extraMagazines:0,autoloadMagazines:0,storageId:'none'})]}),bad=direct([zero]);
  assert.ok(has(bad,'MAGAZINE_SOURCE_INCOMPATIBLE'));assert.equal(bad.weapons[0].cost,null);assert.equal(weaponRecordPresentation(zero).magazineSupplySelection.forceGroupOpen,true);
 }
});
