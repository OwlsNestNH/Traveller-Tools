import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,weaponControl,evaluateWeapons} from '../engine/weapons.mjs';
import {CSC_ADDITIONAL_SLUG_WEAPONS} from '../engine/csc-additional-slug-weapons.mjs';
import {CSC_SLUG_WEAPONS} from '../engine/csc-slug-weapons.mjs';
import {createRobotApi} from '../js/api.mjs';

// Full printed CSC pp142-148 and174 independently read and visually checked.
// Expected values are independent of the production rows. No source images shipped.
const expected=[
 ['heavy-advanced-combat-rifle',10,'rifle','medium',450,'4D',5,2000,30,20,['Auto 2','Bulky','Scope'],'145-146'],
 ...[4,5,6,7,8].map(n=>['ducks-foot-pistol-'+n,3,'pistol','small',5,'3D-3',2,300,n,25,['Auto 4','Dangerous'],'142-143'])
];
const record=(id,patch={})=>({id:'test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const design=(id,patch={})=>updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const run=(id,patch={})=>evaluateDesign(design(id,patch));
const profile=(id,patch={})=>run(id,patch).totals.weapons[0];
const direct=(id,patch={},tl=16,size=6)=>evaluateWeapons({kind:'standard',techLevel:tl,selections:{physical:{weapons:[record(id,patch)]}}},[{id:'arm',size,dexterity:8}],[]);
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const heavy='heavy-advanced-combat-rifle';

for(const [id,tl,family,mount,range,damage,mass,cost,capacity,loadCost,traits,pages] of expected){
 test(id+' preserves source facts, categories and initial-load convention',()=>{
  const w=WEAPONS.find(w=>w.id==='csc-'+id),mountCost=mount==='small'?500:1000,mountSlots=mount==='small'?1:2;
  assert.deepEqual([w.tl,w.weaponFamily,w.mountClass,w.range,w.damage,w.massKg,w.cost,w.magazine,w.magazineCost,w.traits,w.source.pages],[tl,family,mount,range,damage,mass,cost,capacity,loadCost,traits,pages]);
  assert.equal(w.source.book,'Central Supply Catalogue Update 2023');assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');
  assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.skill,'gun-combat');assert.equal(w.speciality,'slug');assert.equal(w.initialIncluded,false);
  assert.equal(w.ammunitionAccounting.sourceInitialInclusion,'unstated');assert.equal(w.ammunitionAccounting.initialMagazine,'separate-purchase');
  assert.match(w.ammunitionAccounting.inclusionStatement,/convention, not a source exclusion/);
  const r=run(id),p=r.totals.weapons[0];assert.equal(r.status,'verified');assert.equal(p.cost,cost+mountCost+loadCost);assert.equal(p.slots,mountSlots);
  assert.equal(profile(id,{initialMagazines:0}).cost,cost+mountCost);
  assert.equal(p.baseAttackModifier,-3);assert.equal(p.attackModifier,null);assert.deepEqual(r.totals.skills,[]);assert.deepEqual(p.associatedAttacks,[]);
  assert.deepEqual(r.ledger.find(l=>l.id==='weapon-test').weaponSource,w.source);
  assert.deepEqual(importDesign(exportDesign(design(id))),design(id));
 });
 test(id+' preserves linked/autoloader costs and does not resolve operation',()=>{
  const mc=mount==='small'?500:1000,ms=mount==='small'?1:2;
  const p=profile(id,{autoload:true,extraMagazines:3});assert.equal(p.cost,cost+mc+7*loadCost);assert.equal(p.slots,ms*2);
  const linked=profile(id,{linkedWeapons:3,autoload:true,extraMagazines:2,fireControl:'basic'});
  assert.equal(linked.cost,3*(cost+mc+5*loadCost)+10000);assert.equal(linked.slots,6*ms+1);assert.equal(linked.linkedDamageBonus,Number(damage[0])*2);
  assert.equal(linked.conditionalEffects.autoloadResolvesConditions,false);assert.equal(linked.conditionalEffects.resolvedAttack,false);assert.equal(linked.conditionalEffects.skillGranted,false);
 });
 test(id+' enforces TL and category-specific arm fit',()=>{
  const min=mount==='small'?3:5,arm={placement:'arm',manipulatorId:'arm'};
  assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.ok(!has(direct(id,{},tl),'WEAPON_TL'));
  assert.ok(has(direct(id,arm,16,min-1),'WEAPON_ARM_SIZE'));assert.ok(!has(direct(id,arm,16,min),'WEAPON_ARM_SIZE'));
  assert.ok(has(direct(id,{...arm,autoload:true,extraMagazines:1},16,min),'WEAPON_ARM_SIZE'));
  assert.ok(!has(direct(id,{...arm,autoload:true,extraMagazines:1},16,min+1),'WEAPON_ARM_SIZE'));
  assert.ok(has(direct(id,{autoload:true,extraMagazines:1},5),'AUTOLOADER_TL'));
  const held=direct(id,{placement:'held',manipulatorId:'arm'},16,1);assert.equal(held.weapons[0].cost,cost+loadCost);assert.equal(held.weapons[0].slots,0);
 });
}

test('new tranche is six fixed configurations without changes to existing slug/Core values',()=>{
 assert.deepEqual(CSC_ADDITIONAL_SLUG_WEAPONS.map(w=>w.id),expected.map(r=>'csc-'+r[0]));assert.equal(CSC_SLUG_WEAPONS.length,25);
 assert.equal(WEAPONS.find(w=>w.id==='advanced-combat-rifle').cost,1000);assert.equal(WEAPONS.find(w=>w.id==='advanced-combat-rifle').damage,'3D');
 assert.equal(WEAPONS.find(w=>w.id==='gauss-rifle').magazineCost,40);assert.equal(WEAPONS.find(w=>w.id==='csc-gauss-rifle').magazineCost,80);
 for(const bad of ['ducks-foot-pistol','ducks-foot-pistol-3','ducks-foot-pistol-9','ducks-foot-pistol-4.5'])assert.throws(()=>design(bad),TypeError);
 for(const patch of [{barrels:99},{magazine:100},{cost:0},{conditionalEffects:{attackDM:99}},{sourceFamily:'core-2022'}]){const d=design('ducks-foot-pistol-4');Object.assign(d.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);}
});

test('Duck fixed loads retain Auto 4, simultaneous discharge, reload and Dangerous conditions',()=>{
 for(const n of [4,5,6,7,8]){
  const p=profile('ducks-foot-pistol-'+n,{autoload:true,extraMagazines:2}),c=p.conditionalEffects;
  assert.equal(p.magazine,n);assert.equal(p.cost,925);assert.deepEqual(p.traits,['Auto 4','Dangerous']);
  assert.equal(p.ammunitionAccounting.priceUnit,'whole load');assert.equal(p.ammunitionAccounting.roundsPerLoad,n);
  assert.deepEqual(c.firingMode.allowed,['full-auto']);assert.equal(c.firingMode.barrels,n);assert.equal(c.firingMode.allBarrelsDischargeTogether,true);
  assert.equal(c.firingMode.maximumAttacksPerTarget,1);assert.equal(c.firingMode.extraShotsWasted,true);assert.equal(c.firingMode.autoRating,4);assert.equal(c.firingMode.autoExpenditureInteractionResolved,false);
  assert.equal(c.reload.action,'Minor');assert.equal(c.reload.actions,'2D3');assert.equal(c.reload.skill,'gun-combat:slug');assert.equal(c.reload.skillCheckRequired,true);assert.equal(c.reload.successfulCheckRequired,true);
  assert.equal(c.dangerous.maximumAttackEffect,-5);assert.equal(c.dangerous.damageToUser,true);assert.equal(c.dangerous.weaponInoperable,true);assert.equal(c.dangerous.source.pages,'131');
  assert.equal(c.autoloadResolvesConditions,false);assert.ok(has(run('ducks-foot-pistol-'+n),'WEAPON_SOURCE_INTERPRETATION'));
 }
});

test('Heavy ACR includes equipment without duplicate hardware charge or invented grenade attack',()=>{
 const p=profile(heavy),c=p.conditionalEffects;
 assert.equal(p.cost,3020);assert.equal(p.massKg,5);assert.deepEqual(p.traits,['Auto 2','Bulky','Scope']);assert.deepEqual(p.associatedAttacks,[]);
 for(const key of ['sling','integralFlashSuppressor','gyroscopicStabilisation','retainsBulky'])assert.equal(c.includedEquipment[key],true);
 const a=c.includedGrenadeAdaptor;assert.equal(a.includedInWeaponPrice,true);assert.equal(a.additionalHardwareCost,0);assert.equal(a.underbarrelLauncher,false);
 for(const key of ['attackSupported','ammunitionConfigurationSupported','mountConfigurationSupported'])assert.equal(a[key],false);
 assert.equal(a.source.pages,'146,174');assert.ok(has(run(heavy),'WEAPON_SOURCE_INTERPRETATION'));
 for(const key of ['lightAmplification','passiveInfrared','visualMagnification','laserRangefinder','targetPaintingAvailable'])assert.equal(c.weaponSight[key],true);
 assert.equal(c.weaponSight.recipientVisionGranted,false);assert.equal(c.weaponSight.automaticDesignationDM,false);assert.equal(c.weaponSight.scope,'Weapon sight only');
 assert.equal(c.scopeUsage.active,false);assert.equal(direct(heavy,{placement:'held',manipulatorId:'arm'}).weapons[0].conditionalEffects.scopeUsage.active,true);
 assert.equal(p.baseAttackModifier,-3);assert.equal(p.attackModifier,null);
});

test('all six profiles enforce source accessory, ammunition and associated-launcher gates',()=>{
 for(const [id] of expected){
  for(const a of WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022')){const r=direct(id,{accessories:[a.id]});assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}
  for(const patch of [{auxiliaryLauncher:'attached',auxiliaryAmmunition:'frag',auxiliaryLoaded:1},{auxiliaryLauncher:'integral-acr',auxiliaryAmmunition:'frag',auxiliaryLoaded:1},{auxiliaryLauncher:'both-acr',integralAmmunition:'frag',integralLoaded:1},{integralLoaded:1},{looseGrenades:1}]){const r=direct(id,patch);assert.ok(has(r,'CSC_LAUNCHERS_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].associatedAttacks,[]);}
  const r=run(id,{ammunition:'frag'});assert.equal(r.status,'invalid');assert.equal(r.totals,null);assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));
  assert.ok(has(direct(id,{accessories:['csc-suppressor']}),'SUPPRESSOR_WEAPON'));
 }
 for(const accessory of ['csc-scope-5','csc-scope-7','csc-laser-sight-8','csc-holographic-sight'])assert.ok(has(direct(heavy,{accessories:[accessory]}),'CSC_SIGHT_LIMIT'));
 assert.equal(profile(heavy,{accessories:['csc-intelligent-0']}).cost,4020);
 assert.equal(profile(heavy).traits.includes('Bulky'),true);
 const gyro=direct(heavy,{accessories:['csc-gyrostabiliser']});
 assert.equal(gyro.weapons[0].cost,null);assert.deepEqual(gyro.weapons[0].accessoryEffects,[]);assert.ok(gyro.weapons[0].traits.includes('Bulky'));
 assert.ok(has(gyro,'CSC_INCLUDED_STABILISATION'));
});

test('catalogue, direct evaluation, API and imports keep nested source data detached',()=>{
 for(const [id] of expected){
  const d=design(id),original=WEAPONS.find(w=>w.id==='csc-'+id);
  const controls=getCatalogue(d).stages.find(s=>s.id==='physical').controls;
  const choice=controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id===original.id);
  choice.conditionalEffects.skillGranted=true;choice.ammunitionAccounting.sourceInitialInclusion='included';choice.source.pages='bad';
  const raw=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id===original.id);raw.compatibility.accessoryRules='core-2022';
  const p=direct(id).weapons[0];p.conditionalEffects.skillGranted=true;p.ammunitionAccounting.magazinePriceSource.pages='bad';
  assert.equal(original.conditionalEffects.skillGranted,false);assert.equal(original.ammunitionAccounting.sourceInitialInclusion,'unstated');assert.equal(original.compatibility.accessoryRules,'csc-2023');assert.notEqual(original.source.pages,'bad');assert.notEqual(original.ammunitionAccounting.magazinePriceSource.pages,'bad');
  const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));
  const view=api.getView();assert.equal(view.evaluation.status,'verified');view.evaluation.totals.weapons[0].conditionalEffects.skillGranted=true;
  assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.skillGranted,false);
 }
 const h=profile(heavy);h.conditionalEffects.weaponSight.lightAmplification=false;h.conditionalEffects.includedGrenadeAdaptor.attackSupported=true;
 assert.equal(profile(heavy).conditionalEffects.weaponSight.lightAmplification,true);assert.equal(profile(heavy).conditionalEffects.includedGrenadeAdaptor.attackSupported,false);
 const d=profile('ducks-foot-pistol-4');d.conditionalEffects.firingMode.allowed.push('burst');d.conditionalEffects.reload.actions=0;
 assert.deepEqual(profile('ducks-foot-pistol-4').conditionalEffects.firingMode.allowed,['full-auto']);assert.equal(profile('ducks-foot-pistol-4').conditionalEffects.reload.actions,'2D3');
});
