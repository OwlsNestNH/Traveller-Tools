import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,importDesign,exportDesign} from '../engine/index.mjs';
import {ammunitionPartition,weaponRecordPresentation,weaponControl,validateWeapons,evaluateWeapons} from '../engine/weapons.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';

const ref='option:storage-compartment',cold='option:refrigerated-storage-compartment';
const record=(patch={})=>({id:'weapon',weaponId:'csc-assault-pistol',placement:'body',manipulatorId:'none',linkedWeapons:2,fireControl:'none',autoload:true,extraMagazines:5,extraHighCapacityMagazines:4,initialMagazines:1,initialMagazineType:'high-capacity',autoloadAllocation:{standard:3,highCapacity:2},spareMagazineStorageId:ref,highCapacityMagazineStorageId:ref,...patch});
const equipment=(quantity=1)=>[{id:'storage-compartment',quantity},{id:'refrigerated-storage-compartment',quantity}];
const direct=(records=[record()],storage=equipment(),techLevel=23)=>{validateWeapons(records);return evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:records}}},[],[],storage);};
const design=(records=[record()],physical={})=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{options:['storage-compartment','refrigerated-storage-compartment'],optionParameters:{'storage-compartment':{quantity:1},'refrigerated-storage-compartment':{quantity:1}},...physical,weapons:records}}});
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const stat=d=>formatStatblock(projectReview(d,getCatalogue(d),evaluateDesign(d)));
const legacy=patch=>{const r=record(patch);delete r.autoloadAllocation;return r;};

test('split allocation independent fixture partitions initial, loader and stored supplies once',()=>{
 const r=direct(),w=r.weapons[0],a=w.ammunitionInventory.allocation;
 assert.equal(r.cost,2080);assert.equal(w.cost,2080);assert.equal(r.ledger[0].cost,2080);assert.equal(w.slots,4);
 assert.deepEqual([w.initialAmmunition.purchaseCost,w.initialAmmunition.totalRounds],[60,60]);
 assert.deepEqual([w.ammunitionInventory.autoloadCost,a.reservePurchaseCost,w.ammunitionInventory.ammunitionCost,w.ammunitionInventory.totalCost],[360,160,220,580]);
 assert.deepEqual([a.standard.autoloadRounds,a.highCapacity.autoloadRounds,a.standard.storedRounds,a.highCapacity.storedRounds],[90,120,60,120]);
 assert.equal(w.ammunitionInventory.totalRounds,450);
 assert.deepEqual([w.spareAmmunition.count,w.spareAmmunition.cost,w.spareAmmunition.massKg],[4,40,.3]);
 assert.deepEqual([w.highCapacitySpareAmmunition.count,w.highCapacitySpareAmmunition.cost,w.highCapacitySpareAmmunition.massKg],[4,120,.6]);
 assert.deepEqual(r.ammunitionStorage.map(s=>[s.reservedKg,s.remainingKg]),[[.9,1.1]]);
 assert.equal(a.mode,'split');assert.equal(a.resolved,true);assert.equal(a.valid,true);assert.equal(a.supplyWeaponId,'csc-assault-pistol');assert.equal(a.sourceFamily,'csc-2023');
 assert.equal(evaluateDesign(design()).status,'verified');
});

test('ten allocated plus separately stored reserves extends only explicit split mode',()=>{
 const w=record({extraMagazines:6,extraHighCapacityMagazines:5,autoloadAllocation:{standard:5,highCapacity:5},highCapacityMagazineStorageId:'none'}),r=direct([w]);
 assert.equal(r.cost,2380);assert.equal(r.weapons[0].ammunitionInventory.autoload.countPerWeapon,10);
 assert.equal(r.weapons[0].spareAmmunition.count,2);assert.equal(r.weapons[0].spareAmmunition.massKg,.15);
 assert.equal(has(r,'SPARE_AMMO_STORAGE_AUTOLOADER'),false);
 assert.throws(()=>validateWeapons([legacy(w)]),/combinedExtraMagazines/);
 assert.equal(evaluateDesign(design([w])).status,'verified');
});

test('legacy import/export preserves absence, interpretation, prices and source/application limits',()=>{
 for(const autoload of [true,false]){
  const w=legacy({autoload,...(autoload?{spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'}:{})}),d=design([w]),before=structuredClone(d),imported=importDesign(exportDesign(d));
  assert.deepEqual(imported,before);assert.equal(Object.hasOwn(imported.selections.physical.weapons[0],'autoloadAllocation'),false);
  const r=direct([w]);assert.equal(r.cost,autoload?2240:1900);
  assert.equal(r.ammunitionStorage[0]?.reservedKg??0,autoload?0:1.95);
  const selected=weaponRecordPresentation(w).fields.autoloadAllocation.materializedValue,split={...w,autoloadAllocation:selected};
  assert.equal(direct([split]).cost,r.cost);assert.deepEqual(direct([split]).ammunitionStorage,r.ammunitionStorage);
 }
 assert.throws(()=>validateWeapons([legacy({extraMagazines:11,extraHighCapacityMagazines:0})]),/0 to 10/);
 assert.throws(()=>validateWeapons([legacy({autoload:false,extraMagazines:101,extraHighCapacityMagazines:0})]),/0 to 100/);
 assert.ok(has(direct([legacy()]),'SPARE_AMMO_STORAGE_AUTOLOADER'));
});

test('schema requires both integer allocation members and rejects unknown or out-of-bound values',()=>{
 for(const allocation of [null,[],0,'split',{}, {standard:1},{highCapacity:1},{standard:0,highCapacity:0,other:0}]){
  assert.throws(()=>validateWeapons([record({autoloadAllocation:allocation})]),TypeError);
 }
 for(const value of [-1,111,.5,'1',null,NaN,Infinity,Number.MAX_SAFE_INTEGER])for(const key of ['standard','highCapacity']){
  assert.throws(()=>validateWeapons([record({autoloadAllocation:{standard:0,highCapacity:0,[key]:value}})]),TypeError);
 }
 for(const patch of [{extraMagazines:111},{extraMagazines:106,extraHighCapacityMagazines:5},{extraHighCapacityMagazines:111}])assert.throws(()=>validateWeapons([record(patch)]),TypeError);
 assert.doesNotThrow(()=>validateWeapons([record({extraMagazines:105,extraHighCapacityMagazines:5,autoloadAllocation:{standard:5,highCapacity:5}})]));
 assert.doesNotThrow(()=>validateWeapons([record({extraMagazines:110,extraHighCapacityMagazines:0,autoloadAllocation:{standard:110,highCapacity:0}})]));
});

test('split source limit failures remain correctable evaluator diagnostics at 0, 1, 10 and 11',()=>{
 for(const [standard,high] of [[0,0],[1,0],[0,1],[5,5],[0,10],[10,0],[6,5]]){
  const w=record({extraMagazines:20,extraHighCapacityMagazines:20,autoloadAllocation:{standard,highCapacity:high}}),r=direct([w],equipment(10)),d=design([w],{optionParameters:{'storage-compartment':{quantity:10},'refrigerated-storage-compartment':{quantity:10}}}),result=evaluateDesign(d);
  assert.equal(has(r,'EMPTY_AUTOLOADER'),standard+high===0);assert.equal(has(r,'AUTOLOAD_ALLOCATION_LIMIT'),standard+high>10);
  assert.equal(r.weapons[0].ammunitionInventory.autoload.countPerWeapon,standard+high);
  if(standard+high===0||standard+high>10){assert.equal(result.totals,null);assert.equal(r.weapons[0].cost,null);}
  else {assert.equal(result.status,'verified');assert.equal(r.weapons[0].ammunitionInventory.autoloadCost,(standard*10+high*30)*4);}
  assert.deepEqual(importDesign(exportDesign(d)).selections.physical.weapons,[w]);
 }
 const ten=record({extraMagazines:0,extraHighCapacityMagazines:10,autoloadAllocation:{standard:0,highCapacity:10},spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'}),r=direct([ten],[]);
 assert.equal(r.weapons[0].ammunitionInventory.autoload.countPerWeapon,10);assert.equal(r.cost,2760);assert.deepEqual(r.ammunitionStorage,[]);
});

test('application stored reserve bound is separate from source loader limit and per linked copy',()=>{
 const w=record({extraMagazines:105,extraHighCapacityMagazines:5,autoloadAllocation:{standard:5,highCapacity:5},highCapacityMagazineStorageId:'none'}),r=direct([w],equipment(20));
 assert.equal(r.weapons[0].ammunitionInventory.allocation.storedCountPerWeapon,100);assert.equal(r.cost,4360);
 assert.equal(r.weapons[0].spareAmmunition.count,200);assert.equal(r.ammunitionStorage[0].reservedKg,15);assert.equal(has(r,'STORED_AMMO_APPLICATION_LIMIT'),false);
 const over={...w,autoloadAllocation:{standard:4,highCapacity:5}},bad=direct([over],equipment(20));assert.ok(has(bad,'STORED_AMMO_APPLICATION_LIMIT'));assert.equal(has(bad,'AUTOLOAD_ALLOCATION_LIMIT'),false);assert.equal(bad.weapons[0].cost,null);
 const d=design([over],{optionParameters:{'storage-compartment':{quantity:20},'refrigerated-storage-compartment':{quantity:1}}});assert.equal(evaluateDesign(d).totals,null);assert.deepEqual(importDesign(exportDesign(d)).selections.physical.weapons,[over]);
});

test('over-allocated variants never produce negative reservations, guessed prices or certified totals',()=>{
 for(const autoloadAllocation of [{standard:6,highCapacity:2},{standard:3,highCapacity:5},{standard:6,highCapacity:5}]){
  const w=record({autoloadAllocation}),r=direct([w]),a=r.weapons[0].ammunitionInventory.allocation;
  assert.ok(has(r,'AUTOLOAD_ALLOCATION_EXCEEDS_SUPPLY'));assert.equal(a.resolved,false);assert.equal(a.valid,false);
  assert.equal(a.standard.storedPerWeapon,null);assert.equal(a.highCapacity.storedPerWeapon,null);assert.equal(a.storedCountPerWeapon,null);assert.equal(a.reservePurchaseCost,null);
  assert.deepEqual(r.ammunitionStorage,[]);assert.equal(r.weapons[0].spareAmmunition,undefined);assert.equal(r.weapons[0].highCapacitySpareAmmunition,undefined);assert.equal(r.weapons[0].cost,null);
  const result=evaluateDesign(design([w]));assert.equal(result.status,'invalid');assert.equal(result.totals,null);assert.equal(result.previewTotals,undefined);
  assert.match(weaponRecordPresentation(w).fields.autoloadAllocation.summary,/unresolved/);
 }
});

for(const linkedWeapons of [1,2,3,4])test('split copies '+linkedWeapons+' keep initial type/count separate from allocations',()=>{
 for(const initialMagazineType of ['standard','high-capacity'])for(const initialMagazines of [0,1]){
  const w=record({linkedWeapons,initialMagazineType,initialMagazines}),r=direct([w],equipment(10)),p=initialMagazineType==='standard'?10:30,c=initialMagazineType==='standard'?15:30;
  assert.equal(r.cost,linkedWeapons*(750+p*initialMagazines+180+80));assert.equal(r.slots,linkedWeapons*2);
  assert.equal(r.weapons[0].ammunitionInventory.totalRounds,linkedWeapons*(195+c*initialMagazines));
  assert.equal(r.ammunitionStorage[0].reservedKg,Math.round(.45*linkedWeapons*1e9)/1e9);
 }
});

test('disabling the loader retains allocation instead of moving supplies or treating the loader as free',()=>{
 const w=record({autoload:false}),r=direct([w]);assert.ok(has(r,'AUTOLOAD_ALLOCATION_WITHOUT_LOADER'));assert.equal(r.weapons[0].cost,null);assert.equal(r.weapons[0].ammunitionInventory.autoloadCost,null);
 assert.equal(r.weapons[0].ammunitionInventory.allocation.standard.autoloadPerWeapon,3);
 const d=design([w]),api=createRobotApi();api.importDesign(exportDesign(d));assert.deepEqual(api.getView().design.selections.physical.weapons,[w]);assert.equal(api.getView().evaluation.totals,null);
 const zero={...w,autoloadAllocation:{standard:0,highCapacity:0}};assert.equal(direct([zero]).cost,1900);assert.equal(evaluateDesign(design([zero])).status,'verified');
 const loaded={...zero,autoload:true};assert.ok(has(direct([loaded]),'EMPTY_AUTOLOADER'));assert.equal(direct([loaded]).weapons[0].ammunitionInventory.autoloadCost,null);
});

test('weapon, placement and loader edits preserve allocations, totals and storage for correction',()=>{
 const source=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8'),matches=source.match(/function matchesVisibility\(control, values\) \{[\s\S]*?\n\}/)[0],reset=source.match(/function resetHiddenFields\(control, record\) \{[\s\S]*?\n\}/)[0];
 const helper=runInThisContext('(function(){'+matches+'\n'+reset+';return {matchesVisibility,resetHiddenFields};})')(),control=weaponControl(design());
 for(const patch of [{placement:'held',manipulatorId:'base-1'},{weaponId:'csc-maser-pistol'},{autoload:false}]){
  const w=record(patch),retained=helper.resetHiddenFields(control,w);
  for(const field of ['autoloadAllocation','extraMagazines','extraHighCapacityMagazines','linkedWeapons','autoload','spareMagazineStorageId','highCapacityMagazineStorageId'])assert.deepEqual(retained[field],w[field]);
  const api=createRobotApi();api.importDesign(exportDesign(design()));api.select({stage:'physical',field:'weapons',value:[retained]});assert.deepEqual(api.getView().design.selections.physical.weapons,[retained]);assert.equal(api.getView().evaluation.totals,null);
 }
 const held=record({placement:'held'});assert.equal(helper.matchesVisibility(control.itemFields.find(f=>f.field==='autoload'),held),true);assert.equal(helper.matchesVisibility(control.itemFields.find(f=>f.field==='linkedWeapons'),held),true);
});

test('stale and removed compartments remain invalid; zero remainders reject unused references',()=>{
 for(const patch of [{spareMagazineStorageId:'instance:missing'},{highCapacityMagazineStorageId:'instance:missing'}]){
  const w=record(patch),r=evaluateDesign(design([w]));assert.ok(has(r,'SPARE_AMMO_STORAGE_REQUIRED'));assert.equal(r.totals,null);assert.deepEqual(importDesign(exportDesign(design([w]))).selections.physical.weapons,[w]);
 }
 const d=design(),removed=updateDesign(d,{selections:{physical:{options:[],optionParameters:{}}}});assert.ok(has(evaluateDesign(removed),'SPARE_AMMO_STORAGE_REQUIRED'));assert.equal(removed.selections.physical.weapons[0].spareMagazineStorageId,ref);
 for(const allocation of [{standard:5,highCapacity:2},{standard:3,highCapacity:4},{standard:5,highCapacity:4}]){
  const r=direct([record({autoloadAllocation:allocation})]);assert.ok(has(r,'UNUSED_SPARE_AMMO_STORAGE'));
 }
 const all=record({autoloadAllocation:{standard:5,highCapacity:4},spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'});assert.deepEqual(direct([all],[]).ammunitionStorage,[]);assert.equal(direct([all],[]).cost,2240);
});

test('positive stored reserves require a source estimate even when a loader is also fitted',()=>{
 const w=record({weaponId:'autopistol',initialMagazineType:'standard',extraHighCapacityMagazines:0,highCapacityMagazineStorageId:'none',autoloadAllocation:{standard:3,highCapacity:0}});
 const r=direct([w]);assert.ok(has(r,'SPARE_AMMO_STORAGE_UNSUPPORTED'));assert.ok(has(r,'SPARE_AMMO_STORAGE'));assert.deepEqual(r.ammunitionStorage,[]);assert.equal(evaluateDesign(design([w])).totals,null);
});

const grenades=()=>({id:'grenades',weaponId:'grenade-launcher',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,ammunition:'frag',looseGrenades:1,looseAmmunitionFor:'primary',ammunitionStorageId:ref});
test('mixed split reserves share exact-fit/overflow capacity with Core rounds in either order',()=>{
 const w=record({extraMagazines:7,extraHighCapacityMagazines:5});
 for(const records of [[w,grenades()],[grenades(),w]]){
  const r=evaluateDesign(design(records));assert.equal(r.status,'verified');assert.deepEqual(r.totals.ammunitionStorage.map(s=>[s.reservedKg,s.remainingKg]),[[2,0]]);
  const over=records.map(w=>w.id==='weapon'?{...w,extraHighCapacityMagazines:6}:w),bad=evaluateDesign(design(over));assert.ok(has(bad,'AMMUNITION_STORAGE_CAPACITY'));assert.equal(bad.totals,null);
 }
 const separate=direct([record({spareMagazineStorageId:ref,highCapacityMagazineStorageId:cold})]);assert.deepEqual(separate.ammunitionStorage.map(s=>[s.storageId,s.reservedKg]),[[ref,.3],[cold,.6]]);
});

test('included supplies and unpriced replacements retain their rules without discounts or zero-cost purchases',()=>{
 const w=record({weaponId:'csc-gauntlet-laser',linkedWeapons:1,initialMagazineType:'standard',extraMagazines:3,extraHighCapacityMagazines:0,highCapacityMagazineStorageId:'none',autoloadAllocation:{standard:1,highCapacity:0}}),r=direct([w],equipment(10)).weapons[0];
 assert.equal(r.initialAmmunition.purchaseCost,0);assert.equal(r.initialAmmunition.included,true);assert.equal(r.ammunitionInventory.autoloadCost,2200);assert.equal(r.ammunitionInventory.allocation.reservePurchaseCost,2200);assert.equal(r.cost,7400);
 assert.ok(has(direct([{...w,initialMagazines:0}],equipment(10)),'INCLUDED_POWER_PACK'));
 const unknown={...w,weaponId:'csc-maser-pistol'},bad=direct([unknown]);assert.ok(has(bad,'CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE'));assert.equal(bad.weapons[0].cost,null);assert.equal(bad.weapons[0].ammunitionInventory.autoloadCost,null);
 const unpriced={...w,weaponId:'grenade-launcher'},unknownCost=direct([unpriced]);assert.equal(unknownCost.weapons[0].cost,null);assert.equal(unknownCost.weapons[0].ammunitionInventory.totalCost,null);
});

test('API display metadata is read-only, omits defaults, derives bounds and retains invalid values',()=>{
 const api=createRobotApi(),d=design();api.importDesign(exportDesign(d));const control=weaponControl(d),before=api.exportDesign();
 const presentation=api.getRecordPresentation(control,record());assert.equal(api.exportDesign(),before);
 assert.equal(presentation.fields.extraMagazines.max,110);assert.equal(presentation.fields.extraHighCapacityMagazines.max,110);
 assert.equal(presentation.fields.autoloadAllocation.summary,'Stored remainder per weapon: 2 standard, 2 high-capacity');
 assert.equal(presentation.fields.spareMagazineStorageId.visible,true);
 assert.equal(api.getRecordPresentation(control,legacy()).fields.extraMagazines.max,10);
 assert.equal(api.getRecordPresentation(control,legacy({autoload:false})).fields.extraMagazines.max,100);
 for(const autoload of [true,false]){
  const w=legacy({autoload}),p=api.getRecordPresentation(control,w);assert.deepEqual(p.fields.autoloadAllocation.materializedValue,autoload?{standard:5,highCapacity:4}:{standard:0,highCapacity:0});assert.equal(Object.hasOwn(w,'autoloadAllocation'),false);
 }
 const item=control.itemFields.find(f=>f.field==='autoloadAllocation');assert.equal(item.omitByDefault,true);assert.equal(item.collapsedByDefault,true);assert.equal(Object.hasOwn(item,'default'),false);assert.equal(item.itemFields[0].max,10);
 const source=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(source,/filter\(item=>!item.omitByDefault\)/);assert.match(source,/if\(value===undefined\)delete changed\[key\]/);
 presentation.fields.autoloadAllocation.materializedValue.standard=99;assert.equal(api.getRecordPresentation(control,record()).fields.autoloadAllocation.materializedValue.standard,3);
});

test('schema failure and rejected return to legacy preserve the complete API draft atomically',()=>{
 const api=createRobotApi(),w=record({extraMagazines:6,extraHighCapacityMagazines:5,autoloadAllocation:{standard:5,highCapacity:5},highCapacityMagazineStorageId:'none'});api.importDesign(exportDesign(design([w])));
 const before=api.exportDesign();for(const invalid of [{...w,autoloadAllocation:null},legacy(w),{...w,extraMagazines:106}]){
  assert.throws(()=>api.select({stage:'physical',field:'weapons',value:[invalid]}),TypeError);assert.equal(api.exportDesign(),before);
 }
 const bad={...w,autoloadAllocation:{standard:6,highCapacity:5}};api.select({stage:'physical',field:'weapons',value:[bad]});assert.deepEqual(api.getView().design.selections.physical.weapons,[bad]);assert.ok(has(api.getView().evaluation,'AUTOLOAD_ALLOCATION_LIMIT'));
 api.select({stage:'physical',field:'weapons',value:[w]});assert.equal(api.getView().evaluation.status,'verified');
});

const limbDesign=(copies=1)=>updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:copies}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'limb',quantity:1}}],augmentWeapons:[(({manipulatorId,...w})=>({...w,parentLimb:'limb'}))(record({placement:'arm',linkedWeapons:1,spareMagazineStorageId:'instance:locker',highCapacityMagazineStorageId:'instance:locker'}))]}});
test('identical cyberlimb copies retain per-limb partitions and reserve budgets, scaling cost once',()=>{
 const one=evaluateDesign(limbDesign()),two=evaluateDesign(limbDesign(2));assert.equal(one.status,'verified');assert.equal(two.status,'verified');
 const a=one.totals.augmentations[0],b=two.totals.augmentations[0];assert.equal(a.weaponCost,1040);assert.equal(b.weaponCost,2080);assert.equal(b.totalCost,a.totalCost*2);
 assert.equal(b.weapons[0].ammunitionInventory.totalRounds,225);assert.equal(b.weapons[0].copies,2);assert.equal(b.weapons[0].ammunitionInventory.allocation.standard.storedCount,2);
 assert.deepEqual(a.weaponAccounting.ammunitionStorage,b.weaponAccounting.ammunitionStorage);assert.equal(b.weaponAccounting.ammunitionStorage[0].reservedKg,.45);
 assert.equal(stat(limbDesign(2)).includes('instance:locker'),false);
 const d=limbDesign();d.special.augmentWeapons[0].autoloadAllocation.standard=6;assert.equal(evaluateDesign(d).totals,null);
});

test('review, statblock and component snapshots retain readable split allocation and detached data',()=>{
 const d=design([record({spareMagazineStorageId:'instance:locker',highCapacityMagazineStorageId:'instance:locker'})],{options:[],optionParameters:{},optionInstances:[{id:'locker',optionId:'storage-compartment',parameters:{quantity:1}}]}),api=createRobotApi();api.importDesign(exportDesign(d));
 assert.deepEqual(importDesign(api.exportDesign()),d);
 const r=evaluateDesign(d),before=structuredClone(r),text=formatStatblock(projectReview(d,getCatalogue(d),r));
 assert.match(text,/Split loader and storage/);assert.match(text,/Selected loader allocation per weapon/);assert.match(text,/Stored Per Weapon: 2/);assert.match(text,/Reserve Purchase Cost: 160/);assert.match(text,/Storage Compartment 1/);assert.equal(text.includes('instance:locker'),false);assert.equal(text.includes('Supply Weapon Id'),false);assert.deepEqual(r,before);
 r.totals.weapons[0].ammunitionInventory.allocation.standard.storedPerWeapon=999;assert.equal(evaluateDesign(d).totals.weapons[0].ammunitionInventory.allocation.standard.storedPerWeapon,2);
 const host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:d}]}}),result=evaluateDesign(host);
 assert.equal(result.status,'verified');assert.match(stat(host),/Split loader and storage/);assert.equal(stat(host).includes('instance:locker'),false);
 const invalid=structuredClone(host);invalid.special.designReferences[0].design.selections.physical.weapons[0].autoloadAllocation.standard=6;assert.notEqual(evaluateDesign(invalid).status,'verified');assert.deepEqual(importDesign(exportDesign(host)),host);
});



test('invalid imported split allocations force their corrective group open through read-only API metadata',()=>{
 const api=createRobotApi();
 const cases=[
  [{autoloadAllocation:{standard:6,highCapacity:2}},'AUTOLOAD_ALLOCATION_EXCEEDS_SUPPLY'],
  [{extraMagazines:6,extraHighCapacityMagazines:5,autoloadAllocation:{standard:6,highCapacity:5}},'AUTOLOAD_ALLOCATION_LIMIT'],
  [{autoload:false},'AUTOLOAD_ALLOCATION_WITHOUT_LOADER'],
  [{autoloadAllocation:{standard:0,highCapacity:0}},'EMPTY_AUTOLOADER'],
  [{extraMagazines:105,extraHighCapacityMagazines:5,autoloadAllocation:{standard:4,highCapacity:5}},'STORED_AMMO_APPLICATION_LIMIT']
 ];
 for(const [index,[patch,code]]of cases.entries()){
  const w=record({id:'fresh-invalid-'+index,...patch}),d=design([w]);api.importDesign(exportDesign(d));
  const before=api.exportDesign(),control=weaponControl(d),presentation=api.getRecordPresentation(control,w);
  assert.equal(presentation.fields.autoloadAllocation.forceGroupOpen,true,code);assert.ok(has(api.getView().evaluation,code),code);
  assert.equal(api.exportDesign(),before);assert.deepEqual(importDesign(before).selections.physical.weapons,[w]);
 }
 for(const w of [record({id:'fresh-valid'}),record({autoload:false,autoloadAllocation:{standard:0,highCapacity:0}}),legacy(),legacy({autoload:false}),legacy({extraMagazines:0,extraHighCapacityMagazines:0})]){
  assert.equal(api.getRecordPresentation(weaponControl(design()),w).fields.autoloadAllocation.forceGroupOpen,false);
 }
 const source=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');
 assert.match(source,/presentation\.fields\?\.\[field\.field\]\?\.forceGroupOpen/);
 assert.match(source,/details\.open=forceOpen\|\|/);
});
