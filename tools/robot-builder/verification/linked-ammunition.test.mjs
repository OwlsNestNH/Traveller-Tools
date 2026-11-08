import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,importDesign,exportDesign,getCatalogue} from '../engine/index.mjs';
import {validateWeapons,evaluateWeapons,weaponRecordPresentation,weaponControl,WEAPONS} from '../engine/weapons.mjs';
import {CSC_HIGH_CAPACITY_MAGAZINE_IDS} from '../engine/csc-ammunition-storage.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';

const ref='option:storage-compartment',cold='option:refrigerated-storage-compartment';
const spec=(patch={})=>({initialMagazines:1,initialMagazineType:'standard',extraMagazines:3,extraHighCapacityMagazines:1,autoloadAllocation:{standard:2,highCapacity:1},spareMagazineStorageId:ref,highCapacityMagazineStorageId:'none',...patch});
const second=()=>spec({initialMagazineType:'high-capacity',extraMagazines:1,extraHighCapacityMagazines:4,autoloadAllocation:{standard:0,highCapacity:2},highCapacityMagazineStorageId:ref});
const record=(patch={})=>({id:'linked-ammo',weaponId:'csc-assault-pistol',placement:'body',manipulatorId:'none',linkedWeapons:2,fireControl:'none',autoload:true,...spec(),ammunitionOverrides:[{copyIndex:2,...second()}],...patch});
const equipment=(quantity=1)=>[{id:'storage-compartment',quantity},{id:'refrigerated-storage-compartment',quantity}];
const direct=(records=[record()],storage=equipment(),techLevel=23)=>{validateWeapons(records);return evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:records}}},[],[],storage);};
const design=(records=[record()],physical={})=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{options:['storage-compartment','refrigerated-storage-compartment'],optionParameters:{'storage-compartment':{quantity:1},'refrigerated-storage-compartment':{quantity:1}},...physical,weapons:records}}});
const has=(result,code)=>result.diagnostics.some(item=>item.code===code);
const shared=patch=>{const w=record(patch);delete w.ammunitionOverrides;return w;};
const stat=d=>formatStatblock(projectReview(d,getCatalogue(d),evaluateDesign(d)));

test('asymmetric two-pistol fixture accounts for initial, loader and reserve ammunition once',()=>{
 const result=direct(),w=result.weapons[0],a=w.ammunitionInventory;
 assert.equal(result.cost,1840);assert.equal(w.cost,1840);assert.equal(result.ledger[0].cost,1840);assert.equal(w.slots,4);
 assert.equal(w.initialAmmunition.purchaseCost,40);assert.equal(a.autoloadCost,220);assert.equal(a.allocation.reservePurchaseCost,80);assert.equal(a.totalCost,340);
 assert.equal(w.initialAmmunition.totalRounds,45);assert.equal(a.totalRounds,255);
 assert.deepEqual([a.allocation.standard.autoloadRounds,a.allocation.highCapacity.autoloadRounds,a.allocation.standard.storedRounds,a.allocation.highCapacity.storedRounds],[30,90,30,60]);
 assert.deepEqual(result.ammunitionStorage.map(s=>[s.reservedKg,s.remainingKg]),[[.45,1.55]]);
 assert.deepEqual(w.ammunitionCopies.map(c=>[c.copyIndex,c.customized,c.ammunitionInventory.totalRounds]),[[1,false,90],[2,true,165]]);
 assert.equal(evaluateDesign(design()).status,'verified');
 for(const field of ['countPerWeapon','capacityPerMagazine','unitCost'])assert.equal(Object.hasOwn(w.initialAmmunition,field),false);
 assert.equal(Object.hasOwn(a.autoload,'countPerWeapon'),false);assert.equal(Object.hasOwn(a.allocation.standard,'storedPerWeapon'),false);
 assert.equal(a.allocation.supplyWeaponId,'csc-assault-pistol');assert.equal(a.allocation.sourceFamily,'csc-2023');
});

test('shared defaults remain numerically identical to explicit identical copy specifications',()=>{
 for(const linkedWeapons of [1,2,3,4])for(const autoload of [true,false]){
  const common=spec(autoload?{}:{autoloadAllocation:{standard:0,highCapacity:0},highCapacityMagazineStorageId:ref}),base=shared({...common,linkedWeapons,autoload});
  const before=direct([base],equipment(10)),custom=direct([{...base,ammunitionOverrides:Array.from({length:linkedWeapons},(_,i)=>({copyIndex:i+1,...common}))}],equipment(10));
  assert.equal(custom.cost,before.cost);assert.equal(custom.slots,before.slots);assert.deepEqual(custom.ledger,before.ledger);assert.deepEqual(custom.ammunitionStorage,before.ammunitionStorage);
  for(const field of ['standardSpareCount','highCapacitySpareCount','standardSpareRounds','highCapacitySpareRounds','totalRounds','ammunitionCost','autoloadCost','totalCost'])assert.equal(custom.weapons[0].ammunitionInventory[field],before.weapons[0].ammunitionInventory[field]);
 }
 const base=shared();assert.deepEqual(direct([base]),direct([structuredClone(base)]));
 assert.equal(Object.hasOwn(direct([base]).weapons[0],'ammunitionCopies'),false);
});

test('overrides are complete specifications and malformed indices or unsupported fields are rejected',()=>{
 const api=createRobotApi();api.importDesign(exportDesign(design()));const before=api.exportDesign();
 const bad=[null,{},'x',[null],[{}],Array.from({length:5},(_,i)=>({copyIndex:i+1,...spec()})),[{copyIndex:2,...spec()},{copyIndex:2,...spec()}]];
 for(const copyIndex of [0,5,-1,.5,'2',null,NaN])bad.push([{copyIndex,...spec()}]);
 for(const field of ['initialMagazines','initialMagazineType','extraMagazines','extraHighCapacityMagazines','spareMagazineStorageId','highCapacityMagazineStorageId']){const o={copyIndex:2,...spec()};delete o[field];bad.push([o]);}
 for(const patch of [{other:1},{weaponId:'auto-pistol'},{initialMagazineType:'unknown'},{initialMagazines:2},{extraMagazines:-1},{extraHighCapacityMagazines:111},{spareMagazineStorageId:'bogus'},{autoloadAllocation:{standard:0}}])bad.push([{copyIndex:2,...spec(),...patch}]);
 for(const ammunitionOverrides of bad){assert.throws(()=>api.select({stage:'physical',field:'weapons',value:[record({ammunitionOverrides})]}),TypeError);assert.equal(api.exportDesign(),before);}
 const o={copyIndex:2,...spec()};delete o.autoloadAllocation;
 assert.doesNotThrow(()=>validateWeapons([record({ammunitionOverrides:[o]})]));
});

test('each copy keeps its own ten-loader and hundred-reserve limits, never pooled averages',()=>{
 const w=record({...spec({extraMagazines:9,extraHighCapacityMagazines:0,autoloadAllocation:{standard:9,highCapacity:0},spareMagazineStorageId:'none'}),ammunitionOverrides:[{copyIndex:2,...spec({extraMagazines:11,extraHighCapacityMagazines:0,autoloadAllocation:{standard:11,highCapacity:0},spareMagazineStorageId:'none'})}]}),r=direct([w]);
 assert.ok(has(r,'AUTOLOAD_ALLOCATION_LIMIT'));assert.equal(r.weapons[0].cost,null);assert.equal(r.weapons[0].ammunitionInventory.autoload.count,20);assert.equal(evaluateDesign(design([w])).totals,null);
 assert.ok(r.diagnostics.find(d=>d.code==='AUTOLOAD_ALLOCATION_LIMIT').path.endsWith('.ammunitionOverrides.2'));
 const reserves=record({ammunitionOverrides:[{copyIndex:2,...spec({extraMagazines:110,extraHighCapacityMagazines:0,autoloadAllocation:{standard:9,highCapacity:0}})}]});
 assert.ok(has(direct([reserves],equipment(20)),'STORED_AMMO_APPLICATION_LIMIT'));assert.equal(direct([reserves],equipment(20)).weapons[0].cost,null);
});

test('shrinking retains inactive overrides without counting them, expanding restores stable copy identity',()=>{
 const w=record(),before=structuredClone(w),r=direct([w]),shrunken={...w,linkedWeapons:1},small=direct([shrunken]);
 assert.ok(has(small,'AMMUNITION_COPY_NOT_INSTALLED'));assert.equal(small.weapons[0].ammunitionCopies.length,1);assert.equal(small.cost,870);assert.equal(small.ammunitionStorage[0].reservedKg,.075);
 assert.deepEqual(importDesign(exportDesign(design([shrunken]))).selections.physical.weapons[0],shrunken);assert.equal(evaluateDesign(design([shrunken])).totals,null);
 assert.deepEqual(weaponRecordPresentation(shrunken).ammunitionCustomization.retainedCopyIndices,[2]);assert.equal(weaponRecordPresentation(shrunken).ammunitionCustomization.forceGroupOpen,true);
 assert.deepEqual(direct([{...shrunken,linkedWeapons:2}]),r);assert.deepEqual(w,before);
 const expanded=direct([{...w,linkedWeapons:3}]);assert.equal(expanded.cost,2710);assert.equal(expanded.weapons[0].ammunitionCopies[2].customized,false);assert.equal(expanded.weapons[0].ammunitionCopies[2].ammunitionInventory.totalRounds,90);
});

test('shared edits change only inherited copies and override omission preserves legacy allocation',()=>{
 const w=record(),changed={...w,extraMagazines:4},r=direct([changed]);assert.equal(r.cost,1850);assert.equal(r.weapons[0].ammunitionCopies[1].ammunitionInventory.totalRounds,165);
 const o={copyIndex:2,...second(),spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'};delete o.autoloadAllocation;
 const legacy=record({ammunitionOverrides:[o]}),result=direct([legacy]);assert.equal(result.weapons[0].ammunitionCopies[1].ammunitionInventory.allocation.mode,'legacy');
 assert.equal(result.weapons[0].ammunitionCopies[1].ammunitionInventory.autoload.countPerWeapon,5);assert.deepEqual(importDesign(exportDesign(design([legacy]))).selections.physical.weapons,[legacy]);
 assert.equal(Object.hasOwn(weaponRecordPresentation(legacy,2).ammunitionCustomization.materializedValue,'autoloadAllocation'),false);
});

test('invalid partitions and missing or stale compartments remain retained and repairable per copy',()=>{
 for(const patch of [{autoloadAllocation:{standard:2,highCapacity:2}},{spareMagazineStorageId:'none'},{spareMagazineStorageId:'instance:removed'},{highCapacityMagazineStorageId:'instance:removed'}]){
  const w=record({ammunitionOverrides:[{copyIndex:2,...second(),...patch}]}),d=design([w]),r=evaluateDesign(d);assert.notEqual(r.status,'verified');assert.deepEqual(importDesign(exportDesign(d)),d);
  assert.deepEqual(weaponRecordPresentation(w,2).ammunitionCustomization.materializedValue,{...second(),...patch});
 }
 const w=record({ammunitionOverrides:[{copyIndex:2,...second(),autoloadAllocation:{standard:2,highCapacity:2}}]}),r=direct([w]);
 assert.ok(has(r,'AUTOLOAD_ALLOCATION_EXCEEDS_SUPPLY'));assert.equal(r.weapons[0].ammunitionInventory.allocation.reservePurchaseCost,null);assert.equal(r.weapons[0].ammunitionInventory.allocation.standard.storedCount,null);
 assert.equal(r.weapons[0].ammunitionCopies[1].spareAmmunition,undefined);assert.equal(r.ammunitionStorage[0].reservedKg,.075);
});

test('copy reservations share storage with each other and loose Core grenades independent of record order',()=>{
 const pistol=record(),grenade={id:'grenades',weaponId:'grenade-launcher',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,ammunition:'smoke',looseGrenades:3,ammunitionStorageId:ref};
 for(const records of [[pistol,grenade],[grenade,pistol]]){
  const r=direct(records);assert.equal(r.ammunitionStorage[0].reservedKg,1.95);assert.equal(has(r,'AMMUNITION_STORAGE_CAPACITY'),false);
  const over=records.map(item=>item.id==='grenades'?{...item,looseGrenades:4}:item),bad=direct(over);assert.equal(bad.ammunitionStorage[0].reservedKg,2.45);assert.ok(has(bad,'AMMUNITION_STORAGE_CAPACITY'));assert.ok(has(bad,'SPARE_AMMO_STORAGE'));
 }
 const separate=record({ammunitionOverrides:[{copyIndex:2,...second(),highCapacityMagazineStorageId:cold}]}),r=direct([separate]);assert.deepEqual(r.ammunitionStorage.map(s=>[s.storageId,s.reservedKg]),[[ref,.15],[cold,.3]]);
});

test('all supported high-capacity source identities survive copy customization without conversion leakage',()=>{
 for(const weaponId of CSC_HIGH_CAPACITY_MAGAZINE_IDS){
  const w=record({weaponId}),source=WEAPONS.find(item=>item.id===weaponId),r=direct([w],equipment(100)),out=r.weapons[0];
  assert.equal(out.sourceFamily,'csc-2023');assert.equal(out.ammunitionInventory.allocation.supplyWeaponId,weaponId);assert.equal(out.source.book,source.source.book);
  assert.equal(out.ammunitionInventory.totalRounds,source.magazine*17);assert.equal(out.initialAmmunition.purchaseCost,source.initialIncluded?0:source.magazineCost*4);
  assert.ok(out.ammunitionCopies[1].highCapacitySpareAmmunition.estimated);assert.equal(out.ammunitionCopies[1].highCapacitySpareAmmunition.estimate.source.pages,'142');
 }
 const core=record({weaponId:'autopistol'});assert.ok(has(direct([core]),'CSC_HIGH_CAPACITY_UNSUPPORTED'));assert.equal(direct([core]).weapons[0].cost,null);
});

test('source unknown replacement prices and included supplies remain qualified in asymmetric copies',()=>{
 const zero=spec({extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',autoloadAllocation:{standard:0,highCapacity:0}});
 const maser=record({weaponId:'csc-maser-pistol',autoload:false,...zero,ammunitionOverrides:[{copyIndex:2,...zero,extraMagazines:1}]});
 assert.ok(has(direct([maser]),'CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE'));assert.equal(direct([maser]).weapons[0].cost,null);
 const included=record({weaponId:'stunner-12',autoload:false,...zero,ammunitionOverrides:[{copyIndex:2,...zero,initialMagazines:0}]});
 assert.ok(has(direct([included]),'INCLUDED_POWER_PACK'));assert.equal(direct([included]).weapons[0].initialAmmunition.purchaseCost,0);
});

test('shared FCS and per-copy hardware are charged once despite unequal ammunition',()=>{
 const w=record({fireControl:'basic',accessories:['csc-laser-sight-8']}),r=direct([w]);assert.equal(r.cost,12240);assert.equal(r.slots,5);assert.equal(r.weapons.length,1);assert.equal(r.weapons[0].linkedDamageBonus,3);
 assert.deepEqual(r.weapons[0].accessoryDetails.map(a=>[a.copies,a.cost]),[[2,400]]);
});

test('read-only API metadata and detached evaluation cannot rewrite override specifications',()=>{
 const api=createRobotApi(),d=design();api.importDesign(exportDesign(d));const before=api.exportDesign(),control=weaponControl(d),p=api.getRecordPresentation(control,record(),2);
 assert.equal(p.ammunitionCustomization.overridden,true);assert.deepEqual(p.ammunitionCustomization.materializedValue,second());assert.equal(p.fields.extraMagazines.max,110);
 p.ammunitionCustomization.materializedValue.autoloadAllocation.standard=99;p.ammunitionCustomization.effectiveRecord.extraMagazines=99;
 const view=api.getView();view.evaluation.totals.weapons[0].ammunitionCopies[1].ammunitionInventory.allocation.standard.storedCount=99;view.design.selections.physical.weapons[0].ammunitionOverrides[0].extraMagazines=99;
 assert.equal(api.exportDesign(),before);assert.equal(api.getView().evaluation.totals.weapons[0].ammunitionCopies[1].ammunitionInventory.allocation.standard.storedCount,1);
 assert.deepEqual(importDesign(before),d);
});

test('cyberlimb copies repeat complete per-limb inventories without multiplying copy indices',()=>{
 const limb=quantity=>{const w=record({autoload:false,...spec({extraMagazines:0,extraHighCapacityMagazines:0,autoloadAllocation:{standard:0,highCapacity:0},spareMagazineStorageId:'none'}),ammunitionOverrides:[{copyIndex:2,...spec({initialMagazineType:'high-capacity',extraMagazines:1,extraHighCapacityMagazines:0,autoloadAllocation:{standard:0,highCapacity:0},spareMagazineStorageId:'instance:locker'})}]});delete w.manipulatorId;
  return updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'limb',quantity:1}}],augmentWeapons:[{...w,parentLimb:'limb',placement:'arm'}]}});
 };
 const one=evaluateDesign(limb(1)),two=evaluateDesign(limb(2));assert.equal(one.status,'verified');assert.equal(two.status,'verified');const a=one.totals.augmentations[0],b=two.totals.augmentations[0];
 assert.equal(a.weaponCost,1550);assert.equal(b.weaponCost,3100);assert.deepEqual(a.weaponAccounting.ammunitionStorage,b.weaponAccounting.ammunitionStorage);assert.equal(b.weaponAccounting.ammunitionStorage[0].reservedKg,.075);
 assert.equal(b.weapons[0].copies,2);assert.deepEqual(b.weapons[0].ammunitionCopies.map(c=>c.copyIndex),[1,2]);assert.equal(b.weapons[0].ammunitionInventory.totalRounds,60);assert.equal(stat(limb(2)).includes('instance:locker'),false);
});

test('component snapshots preserve and revalidate linked inventories within their independent scope',()=>{
 const d=design(),host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:d}]}}),r=evaluateDesign(host);
 assert.equal(r.status,'verified');assert.deepEqual(importDesign(exportDesign(host)),host);assert.match(stat(host),/Copy 2/);assert.equal(stat(host).includes('option:storage-compartment'),false);
 const bad=structuredClone(host);bad.special.designReferences[0].design.selections.physical.weapons[0].ammunitionOverrides[0].autoloadAllocation.standard=2;assert.notEqual(evaluateDesign(bad).status,'verified');
});
