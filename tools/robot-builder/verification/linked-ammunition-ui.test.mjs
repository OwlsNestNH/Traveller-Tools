import test from 'node:test';
import assert from 'node:assert/strict';
import {createRobotApi} from '../js/api.mjs';
import {createDesign,getCatalogue} from '../engine/index.mjs';
import {weaponControl} from '../engine/weapons.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';

const base={id:'linked-test',weaponId:'csc-assault-pistol',placement:'body',manipulatorId:'none',linkedWeapons:2,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1};
const specification={initialMagazines:0,initialMagazineType:'standard',extraMagazines:2,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'};
test('API copy presentation materializes defaults without changing legacy records',()=>{
  const api=createRobotApi(),control=weaponControl(createDesign()),before=structuredClone(base);
  const shared=api.getRecordPresentation(control,base).ammunitionCustomization;
  assert.equal(shared.mode,'shared');assert.equal(shared.materializedValue.initialMagazines,1);
  assert.equal(Object.hasOwn(shared.materializedValue,'autoloadAllocation'),false);
  const record={...base,ammunitionOverrides:[{copyIndex:2,...specification}]},snapshot=structuredClone(record);
  const customized=api.getRecordPresentation(control,record,2).ammunitionCustomization;
  assert.equal(customized.overridden,true);assert.equal(customized.effectiveRecord.initialMagazines,0);
  assert.equal(api.getRecordPresentation(control,record,1).ammunitionCustomization.materializedValue.initialMagazines,1);
  assert.deepEqual(record,snapshot);assert.deepEqual(base,before);
  customized.materializedValue.extraMagazines=99;
  assert.equal(api.getRecordPresentation(control,record,2).ammunitionCustomization.materializedValue.extraMagazines,2);
});
test('retained and invalid copies expose correction metadata without renumbering',()=>{
  const api=createRobotApi(),control=weaponControl(createDesign());
  const record={...base,linkedWeapons:1,ammunitionOverrides:[{copyIndex:2,...specification,autoloadAllocation:{standard:3,highCapacity:0}}]};
  const p=api.getRecordPresentation(control,record,2).ammunitionCustomization;
  assert.deepEqual(p.retainedCopyIndices,[2]);assert.equal(p.forceGroupOpen,true);
  assert.equal(p.choices.find(choice=>choice.id===2).installed,false);
  assert.equal(p.materializedValue.autoloadAllocation.standard,3);
});
test('review formats per-copy ammunition and omits raw override and storage identifiers',()=>{
  const d=createDesign(),catalogue=getCatalogue(d),weapon={...base,label:'Test linked weapon',source:{book:'Test source',page:1},ammunitionOverrides:[{copyIndex:2,...specification}],ammunitionInventory:{mode:'per-copy',totalRounds:45,allocation:{mode:'per-copy',supplyWeaponId:'private-weapon-key',sourceFamily:'test-source'}},ammunitionCopies:[{copyIndex:2,customized:true,initialAmmunition:{count:0,totalRounds:0},ammunitionInventory:{totalRounds:45,totalCost:30,allocation:{standard:{autoloadCount:1,storedCount:2},highCapacity:{autoloadCount:0,storedCount:0},source:{book:'Test allocation',page:2}}},spareAmmunition:{storageId:'instance:private-storage',count:2,massKg:.15}}]};
  Object.assign(weapon,{initialMagazineType:'standard',extraHighCapacityMagazines:0,autoloadAllocation:{standard:9,highCapacity:1}});
  const evaluation={status:'verified',totals:{weapons:[weapon]},diagnostics:[]},before=structuredClone(evaluation);
  const text=formatStatblock(projectReview(d,catalogue,evaluation));
  assert.match(text,/Copy 2 ammunition/);assert.match(text,/Customized/);assert.match(text,/loader 1, stored 2/);
  assert.match(text,/Per-copy totals/);assert.match(text,/Unresolved storage/);assert.match(text,/Test allocation/);
  assert.doesNotMatch(text,/private-storage|private-weapon-key|Ammunition Overrides|Ammunition Copies/);
  assert.doesNotMatch(text,/Extra Magazines|Initial Magazines|Initial Magazine Type|Selected loader allocation per weapon/);
  assert.deepEqual(evaluation,before);
});

test('blocked reviews retain compact selected overrides and retained copy identity without arithmetic',()=>{
  const d=createDesign();
  d.selections.physical.weapons=[{...base,linkedWeapons:1,initialMagazineType:'high-capacity',autoloadAllocation:{standard:0,highCapacity:0},ammunitionOverrides:[{copyIndex:2,...specification,spareMagazineStorageId:'instance:hidden-storage',autoloadAllocation:{standard:7,highCapacity:3}}]}];
  const catalogue=getCatalogue(d),evaluation={status:'invalid',totals:null,diagnostics:[]},before=structuredClone(d);
  const text=formatStatblock(projectReview(d,catalogue,evaluation));
  assert.match(text,/Shared ammunition selection/);assert.match(text,/Copy 2 ammunition selection · Not installed/);
  assert.match(text,/Initial: 0 Standard/);assert.match(text,/Extras: standard 2, high-capacity 0/);
  assert.match(text,/Selected loader: standard 7, high-capacity 3/);assert.match(text,/Unresolved storage/);
  assert.doesNotMatch(text,/instance:hidden-storage|Ammunition Overrides|Selected loader allocation per weapon|Total: .* rounds/);
  assert.deepEqual(d,before);
  delete d.selections.physical.weapons[0].ammunitionOverrides[0].autoloadAllocation;
  assert.match(formatStatblock(projectReview(d,getCatalogue(d),evaluation)),/All extras follow loader setting/);
});
