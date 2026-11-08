import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';

// Independent construction checks: Robot Handbook pp 60-64,89-94.
// Internal separate servos and manipulator attachments are different source-defined routes.
const gun={id:'gun',parentLimb:'limb',weaponId:'handbook-stunner-12',placement:'arm',linkedWeapons:1,fireControl:'basic',autoload:true,extraMagazines:2,initialMagazines:1};
const evaluate=(parameters={},weapon={},extra={},type='cybernetic-arm')=>evaluateDesign(updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:type,parameters}],augmentWeapons:[{...gun,...weapon}],...extra}}));
const has=(r,c)=>r.diagnostics.some(d=>d.code===c);

test('Cyberarm weapon accounting charges the standard weapon package once, not triple',()=>{
 const r=evaluate(),arm=r.totals.augmentations[0],w=arm.weapons[0];
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,24000);
 assert.equal(arm.weaponCost,1000+500+200+2*200*2+10000);
 assert.deepEqual([arm.slots.capacity,arm.slots.used,arm.slots.remaining],[3,3,0]);
 assert.equal(w.softwareLevel,null);assert.equal(w.baseAttackModifier,null);assert.equal(w.attackModifier,null);
 assert.equal(w.scope,'parent-limb-only');assert.deepEqual(r.totals.skills,[]);
 assert.equal(r.ledger.reduce((sum,row)=>sum+row.cost,0),r.totals.cost);
});

test('Medium autoload fits a Size 6 leg but exceeds both Size and capacity of a default arm',()=>{
 const patch={weaponId:'laser-rifle-11',fireControl:'none'};
 const arm=evaluate({},patch);assert.equal(arm.status,'invalid');
 assert.ok(has(arm,'WEAPON_ARM_SIZE'));assert.ok(has(arm,'LIMB_SLOT_LIMIT'));
 const leg=evaluate({},patch,{},'cybernetic-leg');assert.equal(leg.status,'verified');
 assert.equal(leg.totals.cost,34800);assert.equal(leg.totals.augmentations[0].weaponCost,23000);
 assert.deepEqual(leg.totals.augmentations[0].slots,{base:6,capacity:4,used:4,remaining:0});
});

test('A separate internal servo does not borrow limb DEX or require a manipulator attachment Size',()=>{
 const patch={autoload:false,extraMagazines:0,fireControl:'none'};
 const servo=evaluate({size:1},{...patch,placement:'body'});
 assert.equal(servo.status,'verified');assert.equal(servo.totals.cost,12000);
 assert.equal(servo.totals.augmentations[0].weapons[0].manipulatorDM,null);
 const attached=evaluate({size:1},patch);assert.equal(attached.status,'invalid');assert.ok(has(attached,'WEAPON_ARM_SIZE'));
});

test('Identical limb copies duplicate full cost while keeping independent per-limb capacity',()=>{
 const r=evaluate({quantity:2});assert.equal(r.status,'verified');assert.equal(r.totals.cost,48000);
 const arm=r.totals.augmentations[0];assert.equal(arm.weaponCost,25000);assert.equal(arm.weapons[0].copies,2);
 assert.equal(arm.weaponAccounting.perLimbSlots,3);assert.equal(arm.slots.capacity,3);
 assert.equal(arm.slots.used,3);assert.equal(arm.slots.remaining,0);
});

test('Physical weapon costs participate in cybernetic appearance percentage costs',()=>{
 const r=evaluate({naturalLooking:'tl14'});assert.equal(r.status,'verified');
 const arm=r.totals.augmentations[0];assert.equal(arm.percentageModifier,.75);
 assert.equal(arm.totalCost,(1500+10000+12500)*1.75);
 assert.equal(arm.modifierCost,18000);assert.equal(r.totals.cost,42000);
});

test('Limb weapons, equipment and armour compete for the same actual Slots',()=>{
 assert.ok(has(evaluate({armourAdded:1}),'LIMB_SLOT_LIMIT'));
 const r=evaluate({}, {}, {augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'limb',quantity:1}}]});
 assert.equal(r.status,'invalid');assert.ok(has(r,'LIMB_SLOT_LIMIT'));
});

test('Loose-round capacity is resolved within the selected parent limb, not silently borrowed',()=>{
 const w={weaponId:'advanced-combat-rifle',fireControl:'none',autoload:false,extraMagazines:0,auxiliaryLauncher:'integral-acr',auxiliaryAmmunition:'smoke',auxiliaryLoaded:1,looseGrenades:4,looseAmmunitionFor:'auxiliary',ammunitionStorageId:'instance:locker'};
 const extra={augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'limb',quantity:1}}]};
 const r=evaluate({},w,extra);assert.equal(r.status,'verified');
 const arm=r.totals.augmentations[0];assert.equal(arm.totalCost,13640);assert.equal(arm.slots.used,3);
 assert.equal(arm.weaponAccounting.ammunitionStorage[0].reservedKg,2);
 const crossed=evaluate({},w,{augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{}},{id:'other',optionId:'cybernetic-leg',parameters:{}}],augmentOptions:[{id:'locker',optionId:'storage-compartment',parameters:{parentLimb:'other',quantity:1}}]});
 assert.equal(crossed.status,'invalid');assert.ok(has(crossed,'AMMUNITION_STORAGE_REQUIRED'));
});
