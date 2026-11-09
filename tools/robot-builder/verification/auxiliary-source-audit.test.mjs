import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {RIFLE_WEAPON_IDS} from '../engine/weapons.mjs';

// Source checked against positioned Core Update 2022 PDF tables pp 126,129,131,132,
// accessory prose p 135, and Robot Handbook storage p 55. No source prose is embedded.
const weapon={id:'rifle-a',weaponId:'rifle',placement:'held',manipulatorId:'base-1',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,auxiliaryLauncher:'attached',auxiliaryAmmunition:'frag',auxiliaryLoaded:1};
const evaluate=physical=>evaluateDesign(updateDesign(createDesign({techLevel:12}),{selections:{physical}}));
const totals=r=>r.totals??r.previewTotals;
const diagnostic=(r,code)=>r.diagnostics.find(d=>d.code===code);
const stored={...weapon,looseGrenades:4,looseAmmunitionFor:'auxiliary',ammunitionStorageId:'option:storage-compartment'};
const storage={options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:1}}};

test('Core rifle table groups include shotguns, submachine guns and laser carbines',()=>{
 const sourceRifles=['accelerator-rifle','advanced-combat-rifle','antique-rifle','assault-rifle','autorifle','gauss-rifle','rifle','shotgun','submachine-gun','laser-carbine-9','laser-carbine-11','laser-rifle-9','laser-rifle-11','laser-sniper-12','plasma-rifle-16'];
 assert.deepEqual([...RIFLE_WEAPON_IDS].sort(),sourceRifles.sort());
 for(const id of ['autopistol','grenade-launcher','machinegun'])assert.ok(!RIFLE_WEAPON_IDS.includes(id));
});

test('Core pp 132-135 attached launcher has its own one-round profile and price',()=>{
 const r=evaluate({weapons:[weapon]}),w=totals(r).weapons[0];
 assert.equal(r.status,'verified');assert.equal(w.cost,1240);
 assert.deepEqual([w.auxiliary.hardwareCostPerWeapon,w.auxiliary.range,w.auxiliary.magazine,w.auxiliary.reloadMinorActions],[1000,100,1,3]);
 assert.equal(w.auxiliary.skill,'heavy-weapons:portable');assert.equal(w.auxiliary.fireControlAssociationVerified,false);
 const empty=totals(evaluate({weapons:[{...weapon,auxiliaryLoaded:0}]})).weapons[0];
 assert.equal(empty.cost,1210);assert.equal(empty.auxiliary.cost,1000);
});

test('Core p 126 ACR grenade subrow is not a separately purchased underslung launcher',()=>{
 const r=evaluate({weapons:[{...weapon,weaponId:'advanced-combat-rifle',auxiliaryLauncher:'integral-acr'}]}),w=totals(r).weapons[0];
 assert.equal(r.status,'verified');assert.equal(w.cost,1045);
 assert.deepEqual([w.auxiliary.hardwareCostPerWeapon,w.auxiliary.range,w.auxiliary.magazine],[0,250,1]);
 assert.equal(w.auxiliary.reloadMinorActions,null,'Do not invent the integral adapter reload time from the separate accessory.');
});

test('Core p 135 any-rifle eligibility does not forbid an underslung accessory on an ACR',()=>{
 const r=evaluate({weapons:[{...weapon,weaponId:'advanced-combat-rifle'}]});
 assert.ok(!diagnostic(r,'AUXILIARY_DUPLICATE_LAUNCHER'));
 assert.equal(r.status,'verified');assert.equal(totals(r).weapons[0].cost,2045);
 assert.equal(totals(r).weapons[0].auxiliary.mode,'attached');
});

for(const [id,unitPrice]of [['aerosol',15],['frag',30],['smoke',15],['stun',30]]){
 test('Core p 131 individual '+id+' rounds retain their own mass and price',()=>{
  const r=evaluate({...storage,weapons:[{...stored,auxiliaryAmmunition:id}]}),t=totals(r),loose=t.weapons[0].looseAmmunition;
  assert.equal(r.status,'verified');
  assert.equal(loose.massKg,2);assert.equal(loose.count,4);assert.equal(loose.cost,4*unitPrice);
  assert.deepEqual(t.ammunitionStorage.map(s=>[s.capacityKg,s.reservedKg,s.remainingKg]),[[2,2,0]]);
  assert.match(loose.scope,/without magazine\/container mass/);
 });
}

test('Robot Handbook p 55 does not universally classify packaged fragmentation rounds as hazardous cargo',()=>{
 const r=evaluate({...storage,weapons:[stored]});
 assert.equal(r.status,'verified');
 assert.ok(!r.diagnostics.some(d=>d.code==='HAZARDOUS_AMMUNITION_STORAGE'&&['error','blocker'].includes(d.severity)));
});

test('Robot Handbook storage reservations aggregate within either route, not across different lockers',()=>{
 const physical={...storage,manipulators:[...createDesign().selections.physical.manipulators,{id:'storage-audit-arm',kind:'additional',size:1,strengthIncrease:0,dexterityIncrease:0}],optionInstances:[{id:'locker',optionId:'storage-compartment',parameters:{quantity:1}}],weapons:[{...stored,auxiliaryAmmunition:'smoke'},{...stored,id:'rifle-b',manipulatorId:'base-2',auxiliaryAmmunition:'smoke',ammunitionStorageId:'instance:locker'}]};
 const r=evaluate(physical),t=totals(r);assert.equal(r.status,'verified');
 assert.deepEqual(t.ammunitionStorage.map(s=>[s.storageId,s.reservedKg,s.remainingKg]),[['option:storage-compartment',2,0],['instance:locker',2,0]]);
 for(const ref of ['option:storage-compartment','instance:locker']){
  const bad=evaluate({...physical,weapons:[...physical.weapons,{...stored,id:'rifle-c',manipulatorId:'storage-audit-arm',auxiliaryAmmunition:'smoke',looseGrenades:1,ammunitionStorageId:ref}]});
  assert.equal(bad.status,'invalid');assert.ok(diagnostic(bad,'AMMUNITION_STORAGE_CAPACITY'));
  assert.equal(totals(bad).ammunitionStorage.find(s=>s.storageId===ref).reservedKg,2.5);
 }
});

test('Loose grenade support neither invents spare magazine mass nor certifies combined mounted geometry',()=>{
 const r=evaluate({...storage,weapons:[{...stored,auxiliaryAmmunition:'smoke',extraMagazines:1}]});
 assert.equal(r.status,'blocked');assert.ok(diagnostic(r,'SPARE_AMMO_STORAGE'));
 const mounted=evaluate({weapons:[{...weapon,placement:'body',manipulatorId:'none'}]});
 assert.equal(mounted.status,'blocked');assert.ok(diagnostic(mounted,'AUXILIARY_MOUNT_FIT'));
});

test('ACR included and attached launchers remain independently loaded and priced',()=>{
 const both={...weapon,weaponId:'advanced-combat-rifle',auxiliaryLauncher:'both-acr',auxiliaryAmmunition:'smoke',auxiliaryLoaded:1,integralAmmunition:'frag',integralLoaded:1};
 const r=evaluate({weapons:[both]}),w=totals(r).weapons[0];assert.equal(r.status,'verified');assert.equal(w.cost,2060);
 assert.deepEqual(w.associatedAttacks.map(a=>[a.mode,a.ammunition,a.range,a.loadedPerWeapon,a.hardwareCostPerWeapon,a.cost]),[['attached','smoke',100,1,1000,1015],['integral-acr','frag',250,1,0,30]]);
 const empty=totals(evaluate({weapons:[{...both,auxiliaryLoaded:0,integralLoaded:0}]})).weapons[0];
 assert.equal(empty.cost,2015);assert.deepEqual(empty.associatedAttacks.map(a=>a.cost),[1000,0]);
 assert.ok(w.associatedAttacks.every(a=>a.attackModifier===null&&!a.fireControlAssociationVerified));
});

test('Both-launcher mode rejects a missing independent grenade type and a non-ACR host',()=>{
 const both={...weapon,weaponId:'advanced-combat-rifle',auxiliaryLauncher:'both-acr',integralAmmunition:'frag',integralLoaded:1};
 const missing=evaluate({weapons:[{...both,integralAmmunition:'standard'}]});
 assert.equal(missing.status,'blocked');assert.ok(diagnostic(missing,'INTEGRAL_AMMUNITION'));
 const wrong=evaluate({weapons:[{...both,weaponId:'rifle'}]});
 assert.equal(wrong.status,'invalid');assert.ok(diagnostic(wrong,'AUXILIARY_INTEGRAL_WEAPON'));
});
