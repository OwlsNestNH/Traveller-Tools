import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,MOUNTS,weaponControl,evaluateWeapons,RIFLE_WEAPON_IDS} from '../engine/weapons.mjs';
import {CSC_HEAVY_WEAPONS} from '../engine/csc-heavy-weapons.mjs';
import {createRobotApi} from '../js/api.mjs';

// Independent transcription of visually checked complete CSC pp161,167,171.
// Context: pp160-164,168-175 and Fire p131. Images stay outside the repository.
// Vehicle range and mass expectations below are converted metres and kg.
const expected=[
 ['anti-materiel-rifle',7,'heavy',1000,'5D',15,3000,1,10,['AP 5','Scope','Very Bulky'],'161'],
 ['arl-standard',10,'heavy',80,'4D',3,800,20,100,['Zero-G'],'161'],
 ['arl-support',10,'heavy',80,'4D',4,1300,40,200,['Auto 4','Zero-G'],'161'],
 ['arl-pdw',10,'heavy',50,'4D',2,200,20,100,['Auto 4','Zero-G'],'161'],
 ['cppg-11',11,'heavy',200,'6D',12,8000,6,300,['AP 6','Blast 2','Bulky','Scope'],'161'],
 ['cppg-12',12,'heavy',300,'8D',12,15000,6,450,['AP 8','Blast 3','Bulky','Scope'],'161'],
 ['cppg-13',13,'heavy',500,'1DD',10,25000,6,600,['AP 10','Blast 3','Bulky','Scope'],'161'],
 ['cryojet',11,'heavy',10,'4D',14,4000,16,200,['Blast 5','Bulky'],'161'],
 ['early-machinegun',4,'heavy',400,'3D',14,1200,30,100,['Auto 3','Very Bulky'],'161'],
 ['flamethrower-4',4,'heavy',5,'3D',20,800,30,60,['Blast 5','Bulky','Fire'],'161'],
 ['flamethrower-6',6,'heavy',5,'4D',15,1500,40,80,['Blast 5','Bulky','Fire'],'161'],
 ['flamethrower-8',8,'heavy',10,'4D',10,2000,50,100,['Blast 5','Fire'],'161'],
 ['light-assault-gun',8,'heavy',800,'7D',40,4000,5,100,['AP 5','Very Bulky'],'161'],
 ['light-gatling-laser',9,'heavy',180,'3D',18,4500,100,300,['Auto 4','Zero-G'],'161'],
 ['machinegun',5,'heavy',500,'3D',10,1500,60,100,['Auto 4','Bulky'],'161'],
 ['rapid-fire-machinegun',7,'heavy',500,'3D',12,3000,60,100,['Auto 4','Bulky'],'161'],
 ['rocket-launcher-6',6,'heavy',120,'4D',8,2000,1,300,['Blast 6','Bulky'],'161'],
 ['rocket-launcher-7',7,'heavy',150,'4D+3',8,2000,1,400,['Blast 6','Bulky','Smart'],'161'],
 ['rocket-launcher-8',8,'heavy',200,'5D',8,2000,2,600,['Blast 6','Bulky','Scope','Smart'],'161'],
 ['rocket-launcher-9',9,'heavy',250,'5D+6',8,2000,2,800,['Blast 6','Bulky','Scope','Smart'],'161'],
 ['heavy-machinegun',6,'vehicle',1000,'5D',100,4500,100,400,['Auto 3'],'167'],
 ['vrf-gauss-gun',12,'vehicle',750,'4D',250,20000,400,1000,['AP 5','Auto 8'],'167'],
 ['vrf-machinegun',7,'vehicle',500,'4D',250,12000,1000,1250,['Auto 6'],'167'],
 ['rocket-pod',6,'vehicle',1500,'4D',250,8000,18,8000,['Auto 3','Blast 5'],'171'],
 ['tac-launcher-anti-aircraft',10,'vehicle',10000,'8D',250,16000,4,8000,['Scope','Smart'],'171'],
 ['tac-launcher-anti-personnel',10,'vehicle',6000,'4D',250,12000,4,4000,['Blast 10','Scope','Smart'],'171'],
 ['tac-launcher-armour-piercing',10,'vehicle',6000,'8D',250,15000,4,6000,['AP 10','Scope','Smart'],'171']
];
const raw=id=>CSC_HEAVY_WEAPONS.find(w=>w.id==='csc-'+id);
const record=(id,patch={})=>({id:'heavy-test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const design=(id,patch={},techLevel=16)=>updateDesign(createDesign({techLevel}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const run=(...args)=>evaluateDesign(design(...args));
const direct=(id,patch={},techLevel=16,size=7,skills=[])=>evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:[record(id,patch)]}}},[{id:'arm',size,dexterity:8}],skills);
const profile=(...args)=>direct(...args).weapons[0];
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);

test('CSC heavy source: exactly 27 finite priced profiles retain every printed fact and source category',()=>{
 assert.equal(CSC_HEAVY_WEAPONS.length,27);assert.deepEqual(CSC_HEAVY_WEAPONS.map(w=>w.id),expected.map(r=>'csc-'+r[0]));
 assert.equal(CSC_HEAVY_WEAPONS.filter(w=>w.speciality==='portable').length,20);assert.equal(CSC_HEAVY_WEAPONS.filter(w=>w.speciality==='vehicle').length,7);
 for(const [id,tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits,page] of expected){
  const w=raw(id),vehicle=mountClass==='vehicle';
  assert.deepEqual([w.tl,w.mountClass,w.range,w.damage,w.massKg,w.cost,w.magazine,w.magazineCost,w.traits],[tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits],id);
  assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.source.book,'Central Supply Catalogue Update 2023');assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');assert.ok(w.source.pages.includes(page));assert.ok(w.label.endsWith('(CSC 2023)'));
  assert.equal(w.skill,'heavy-weapons');assert.equal(w.speciality,vehicle?'vehicle':'portable');assert.equal(w.weaponFamily,vehicle?'heavy-vehicle':'heavy-portable');
  assert.equal(w.compatibility.accessoryRules,'csc-2023');assert.equal(w.compatibility.associatedLauncherRules,null);assert.equal(w.compatibility.attachedLauncher,false);assert.equal(w.compatibility.specialisedAmmunitionRules,null);assert.equal(w.compatibility.robotPowerConnection,false);
  for(const value of [w.cost,w.magazine,w.magazineCost,w.massKg,w.range])assert.ok(Number.isFinite(value)&&value>0,id);
  assert.ok(Number.isInteger(w.magazine));assert.equal(w.initialIncluded,false);assert.equal(w.ammunitionAccounting.initialMagazine,'separate-purchase');assert.equal(w.ammunitionAccounting.sourceInclusion,'not-stated');assert.match(w.ammunitionAccounting.inclusionStatement,/accounting convention/);assert.match(w.ammunitionAccounting.inclusionStatement,/not an explicit source exclusion/);assert.equal(w.ammunitionAccounting.magazinePriceSource.pages,page);assert.equal(w.ammunitionAccounting.mountSource.pages,'61');assert.equal(w.ammunitionAccounting.mountExcludesAmmunition,true);
  assert.deepEqual(w.sourceMeasurements.range,{value:range/(vehicle?1000:1),unit:vehicle?'km':'m'});assert.deepEqual(w.sourceMeasurements.mass,{value:massKg/(vehicle?1000:1),unit:vehicle?'tons':'kg'});assert.equal(w.sourceMeasurements.source.pages,page);
  if(vehicle){assert.ok(w.massKg<=250);assert.equal(w.requiresVehicleMount,true);}
  for(const flag of ['resolvedAttack','skillGranted','recipientVisionGranted','autoloadResolvesConditions'])assert.equal(w.conditionalEffects[flag],false);
 }
 assert.equal(raw('anti-materiel-rifle').sourceTableName,'Anti-Material Rifle');assert.match(raw('anti-materiel-rifle').label,/Anti-Materiel/);
 assert.equal(raw('arl-pdw').massKg,2);assert.equal(raw('arl-pdw').mountClass,'heavy');assert.equal(raw('light-assault-gun').massKg,40);assert.equal(raw('light-assault-gun').mountClass,'heavy');
});

test('CSC heavy source: bounded tranche excludes one-use, unresolved supply, duplicate and artillery profiles',()=>{
 const excluded=['grenade-launcher','ram-grenade-launcher','plasma-jet-12','plasma-jet-14','disposable-plasma-launcher','light-anti-air-missile','light-bomb','fghp-14','fghp-15','fghp-16','pghp-12','pghp-13','pghp-14','light-autocannon','infantry-mortar','black-powder-mortar','support-mortar','light-howitzer','heavy-rocket-pod','anti-tank-missile','bombardment-missile'];
 const overVehicleMassLimit=['aerospace-defence-laser','medium-autocannon','heavy-autocannon','black-powder-cannon','light-cannon','medium-cannon','heavy-cannon','field-gun','fusion-gun-x','fusion-gun-y','fusion-gun-z','gatling-laser','light-gauss-cannon','medium-gauss-cannon','heavy-gauss-cannon','hypervelocity-cannon','light-laser-cannon','medium-laser-cannon','heavy-laser-cannon','meson-accelerator','orbital-defence-cannon','plasma-gun-a','plasma-gun-b','plasma-gun-c','rail-gun','rotary-autocannon','water-cannon'];
 assert.equal(overVehicleMassLimit.length,27);excluded.push(...overVehicleMassLimit);
 for(const id of excluded)assert.equal(raw(id),undefined,id);
 assert.ok(CSC_HEAVY_WEAPONS.every(w=>w.speciality!=='artillery'&&!w.traits.includes('One Use')&&!w.traits.includes('One Shot')&&!w.traits.includes('Artillery')));
});

test('CSC heavy source: ARL penalties, included bipods and integrated holographic sights remain conditional',()=>{
 for(const id of ['arl-standard','arl-support','arl-pdw']){
  const effects=raw(id).conditionalEffects;assert.deepEqual(effects.attackModifiers[0],{modifier:-1,condition:'All attacks with this profile',source:{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'160'}});
  if(id!=='arl-pdw'){assert.deepEqual(effects.magazineInterchangeability.profiles,['csc-arl-standard','csc-arl-support']);assert.equal(effects.magazineInterchangeability.alternateMagazineSelectionImplemented,false);}
 }
 const pdw=raw('arl-pdw').conditionalEffects;assert.equal(pdw.attackModifiers.length,2);assert.equal(pdw.attackModifiers[1].modifier,-2);assert.deepEqual(pdw.attackModifiers[1].rangeMetres,{minimum:10,minimumInclusive:false});assert.equal(pdw.modifierInteraction.resolved,false);
 for(const id of ['anti-materiel-rifle','light-assault-gun']){const w=raw(id),b=w.conditionalEffects.bipod;assert.equal(w.slugThrower,true);assert.equal(b.included,true);assert.equal(b.additionalCost,0);assert.deepEqual(b.setup,{action:'Minor',actions:2});assert.equal(b.condition,'Firing from the deployed bipod');assert.deepEqual(b.ignoredTraits,['Bulky','Very Bulky']);assert.equal(b.traitsPermanentlyRemoved,false);assert.ok(w.traits.includes('Very Bulky'));assert.ok(b.source.pages.includes('174'));}
 for(const id of ['cppg-11','cppg-12','cppg-13']){const w=raw(id),h=w.conditionalEffects.holographicSight;assert.equal(h.included,true);assert.equal(h.additionalCost,0);assert.equal(h.occupiesSightSlot,true);assert.equal(h.trait,'Scope');assert.equal(h.modifier,1);assert.deepEqual(h.rangeMetres,{minimum:50,minimumInclusive:true});assert.equal(h.resolvedAttack,false);assert.equal(h.skillGranted,false);assert.equal(h.recipientVisionGranted,false);assert.equal(h.source.pages,'160,175');assert.equal(w.conditionalEffects.powerSupply.kind,'chemical-cartridge-magazine');assert.equal(w.conditionalEffects.powerSupply.externalPowerPack,false);}
});

test('CSC heavy source: cryojet, flamethrowers and Fire retain target checks, reloads and TL exemption',()=>{
 const freeze=raw('cryojet').conditionalEffects.freeze;assert.equal(freeze.condition,'Hit a target wearing a sealed protective suit');assert.deepEqual(freeze.check,{characteristic:'STR',target:8});assert.equal(freeze.onFailure,'Held in place');assert.equal(freeze.duration,'1D rounds');assert.equal(freeze.universalRobotShutdown,false);assert.equal(freeze.source.pages,'160');
 for(const tl of [4,6,8]){
  const e=raw('flamethrower-'+tl).conditionalEffects;assert.equal(e.reload.duration,'2D rounds');assert.equal(e.reload.source.pages,'160');assert.equal(e.carrierHitExplosion.applies,tl<8);assert.equal(e.carrierHitExplosion.minimumAttackEffect,4);assert.equal(e.carrierHitExplosion.exemptFromTL,8);assert.equal(e.carrierHitExplosion.weaponDestroyed,true);assert.equal(e.carrierHitExplosion.immediate,true);assert.equal(e.carrierHitExplosion.damageToCarrier,'As if hit by this weapon');assert.equal(e.carrierHitExplosion.source.pages,'160');
  const f=e.fire;assert.equal(f.source.pages,'131');assert.equal(f.damageEachSubsequentRound,true);assert.equal(f.maximumConcurrentSources,1);assert.equal(f.useHighestDamageSource,true);assert.equal(f.resolvedDamage,false);assert.deepEqual(f.selfExtinguish,{dice:'2D',target:8,timing:'Start of each round',refereeMayContinueWithFlammableMaterial:true});assert.deepEqual(f.extinguishAction,{action:'Significant',actions:1,characteristic:'DEX',target:8,firefightingEquipmentDM:2});
 }
});

test('CSC heavy source: disposable chemical magazines, rapid fire, backblast and vehicle pointing are distinct',()=>{
 const supply=raw('light-gatling-laser').conditionalEffects.powerSupply;assert.equal(supply.kind,'chemical-cartridge-magazine');assert.equal(supply.disposable,true);assert.equal(supply.rechargeable,false);assert.equal(supply.externalPowerPack,false);assert.equal(supply.robotPowerConnectionSupported,false);assert.equal(supply.unlimitedFire,false);assert.equal(supply.reload.timing,'Same as a slug magazine');assert.equal(supply.source.pages,'163');assert.equal(supply.recharge,undefined);
 const rapid=raw('rapid-fire-machinegun'),mode=rapid.conditionalEffects.alternativeDischarge;assert.equal(rapid.sourcePrintedAuto,'Auto 4 (8)');assert.deepEqual(rapid.traits,['Auto 4','Bulky']);assert.equal(mode.optional,true);assert.equal(mode.normalAuto,4);assert.equal(mode.auto,8);assert.equal(mode.coolingRounds,2);assert.deepEqual(mode.traits,['Auto 8','Bulky']);assert.equal(mode.source.pages,'161,163');
 for(const tl of [6,7,8,9]){const e=raw('rocket-launcher-'+tl).conditionalEffects;assert.equal(e.backblast.damage,'3D');assert.equal(e.backblast.resolvedDamage,false);assert.equal(e.backblast.source.pages,'163');assert.deepEqual(e.reload,{action:'Minor',actions:3,source:{book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages:'163'}});}
 const aim=raw('rocket-pod').conditionalEffects.aiming;assert.equal(aim.usualMethod,'Point the carrying vehicle or aircraft');assert.equal(aim.independentTraverseGranted,false);assert.deepEqual(aim.firingModes,['single','salvo']);assert.equal(aim.source.pages,'173');
 for(const variant of ['anti-aircraft','anti-personnel','armour-piercing']){const f=raw('tac-launcher-'+variant).conditionalEffects.fixedMissileProfile;assert.equal(f.variant,variant);assert.equal(f.interchangeableMissileSelectionImplemented,false);assert.equal(f.source.pages,'171,173');}
});

for(const [id,tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits] of expected){
 test('CSC heavy integration: '+id+' preserves values, mount, skill, initial ammunition and linked autoloader costs',()=>{
  const vehicle=mountClass==='vehicle',mountCost=vehicle?10000:5000,mountSlots=vehicle?15:10;
  assert.deepEqual(WEAPONS.find(w=>w.id==='csc-'+id),raw(id));
  const r=run(id),p=r.totals.weapons[0];assert.equal(r.status,'verified');assert.equal(p.cost,cost+mountCost+magazineCost);assert.equal(p.slots,mountSlots);assert.equal(p.range,range);assert.equal(p.massKg,massKg);assert.equal(p.damage,damage);assert.equal(p.magazine,magazine);assert.deepEqual(p.traits,traits);assert.equal(p.baseAttackModifier,-3);assert.equal(p.attackModifier,null);assert.equal(p.softwareLevel,-3);
  assert.equal(profile(id,{initialMagazines:0}).cost,cost+mountCost);assert.ok(has(r,'WEAPON_SOURCE_INTERPRETATION'));
  const linked=direct(id,{linkedWeapons:2,autoload:true,extraMagazines:3}),l=linked.weapons[0];assert.equal(l.cost,2*(cost+mountCost+magazineCost+2*magazineCost*3));assert.equal(l.slots,4*mountSlots);assert.equal(l.magazine,magazine);assert.deepEqual(l.conditionalEffects,p.conditionalEffects);assert.equal(has(linked,'DESTRUCTIVE_LINKED_DAMAGE'),damage.includes('DD'));assert.equal(l.linkedDamageBonus,damage.includes('DD')?0:Number(damage.match(/^\d+/)[0]));
  assert.equal(profile(id,{autoload:true,extraMagazines:3,initialMagazines:0}).cost,cost+mountCost+6*magazineCost);
  assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.ok(has(direct(id,{autoload:true,extraMagazines:1},5),'AUTOLOADER_TL'));assert.ok(has(direct(id,{autoload:true}),'EMPTY_AUTOLOADER'));assert.ok(has(direct(id,{extraMagazines:1}),'SPARE_AMMO_STORAGE'));
  assert.equal(profile(id,{},16,7,[{id:'heavy-weapons:'+(vehicle?'vehicle':'portable'),level:2}]).softwareLevel,2);assert.equal(profile(id,{},16,7,[{id:'gun-combat:slug',level:4},{id:'heavy-weapons:'+(vehicle?'portable':'vehicle'),level:4}]).softwareLevel,-3);
  const armPatch={placement:'arm',manipulatorId:'arm'};
  if(vehicle){assert.ok(has(direct(id,armPatch,16,20),'WEAPON_ARM_SIZE'));assert.equal(raw(id).requiresVehicleMount,true);}
  else{assert.ok(has(direct(id,armPatch,16,6),'WEAPON_ARM_SIZE'));assert.equal(has(direct(id,armPatch,16,7),'WEAPON_ARM_SIZE'),false);assert.ok(has(direct(id,{...armPatch,autoload:true,extraMagazines:1},16,7),'WEAPON_ARM_SIZE'));assert.equal(has(direct(id,{...armPatch,autoload:true,extraMagazines:1},16,8),'WEAPON_ARM_SIZE'),false);}
 });
}

test('CSC heavy integration: mount constants and distinct CSC editions never replace original Core rows',()=>{
 assert.deepEqual(MOUNTS.heavy,{slots:10,cost:5000,armSize:7});assert.deepEqual(MOUNTS.vehicle,{slots:15,cost:10000,armSize:null});
 const core=id=>WEAPONS.find(w=>w.id===id);
 assert.equal(core('machinegun').tl,6);assert.deepEqual(core('machinegun').traits,['Auto 4']);assert.equal(raw('machinegun').tl,5);assert.deepEqual(raw('machinegun').traits,['Auto 4','Bulky']);assert.equal(core('heavy-machinegun').damage,'4D');assert.equal(raw('heavy-machinegun').damage,'5D');
 for(const tl of [6,7,8,9]){const a=core('rocket-launcher-'+tl),b=raw('rocket-launcher-'+tl);assert.equal(a.traits.includes('Bulky'),false);assert.equal(b.traits.includes('Bulky'),true);assert.deepEqual([a.range,a.damage,a.cost,a.magazine,a.magazineCost],[b.range,b.damage,b.cost,b.magazine,b.magazineCost]);}
 for(const id of ['machinegun','heavy-machinegun','light-autocannon','fghp-14','fghp-15','fghp-16','pghp-12','pghp-13','pghp-14','rocket-launcher-6','rocket-launcher-7','rocket-launcher-8','rocket-launcher-9']){assert.equal(core(id).sourceFamily,'core-2022');assert.equal(core(id).source.book,'Core Rulebook Update 2022');}
 assert.ok(RIFLE_WEAPON_IDS.every(id=>!id.startsWith('csc-')));
});

test('CSC heavy integration: held vehicle weapons are qualified blockers, including legacy Core Light Autocannon',()=>{
 const ids=[...CSC_HEAVY_WEAPONS.filter(w=>w.speciality==='vehicle').map(w=>w.id),'heavy-machinegun','light-autocannon'];
 for(const weaponId of ids){
  const r=direct('heavy-machinegun',{weaponId,placement:'held',manipulatorId:'arm'},16,20,[{id:'heavy-weapons:vehicle',level:4}]);
  const blocker=r.diagnostics.find(d=>d.code==='HELD_VEHICLE_WEAPON_UNRESOLVED');assert.ok(blocker,weaponId);assert.equal(blocker.severity,'blocker');assert.equal(blocker.source.book,'Robot Handbook');assert.equal(blocker.source.pages,'60-61');assert.equal(r.weapons[0].baseAttackModifier,null);assert.equal(r.weapons[0].attackModifier,null);assert.equal(r.weapons[0].slots,0);
  const controlled=direct('heavy-machinegun',{weaponId,placement:'held',manipulatorId:'arm',fireControl:'advanced'},16,20,[{id:'heavy-weapons:vehicle',level:4}]);assert.ok(has(controlled,'HELD_VEHICLE_WEAPON_UNRESOLVED'));assert.equal(controlled.weapons[0].baseAttackModifier,null);
  const d=updateDesign(design('heavy-machinegun',{weaponId,placement:'held',manipulatorId:'base-1'}),{selections:{physical:{manipulators:[{id:'base-1',kind:'base',size:7,strengthIncrease:0,dexterityIncrease:0}]}}});const evaluated=evaluateDesign(d);assert.equal(evaluated.status,'blocked');assert.equal(evaluated.totals,null);
  const mounted=direct('heavy-machinegun',{weaponId});assert.equal(has(mounted,'HELD_VEHICLE_WEAPON_UNRESOLVED'),false);assert.equal(mounted.weapons[0].slots,15);assert.equal(mounted.weapons[0].baseAttackModifier,-3);
 }
 assert.equal(has(direct('anti-materiel-rifle',{placement:'held',manipulatorId:'arm'}),'HELD_VEHICLE_WEAPON_UNRESOLVED'),false);
});

test('CSC heavy integration: built-in CPPG holographic sight is not misclassified as ordinary held-only scope',()=>{
 for(const id of ['cppg-11','cppg-12','cppg-13'])for(const patch of [{},{placement:'arm',manipulatorId:'arm'},{placement:'held',manipulatorId:'arm'},{fireControl:'basic'}]){
  const p=profile(id,patch);assert.equal(p.conditionalEffects.scopeUsage,undefined);assert.equal(p.conditionalEffects.holographicSight.modifier,1);assert.deepEqual(p.conditionalEffects.holographicSight.rangeMetres,{minimum:50,minimumInclusive:true});assert.equal(p.conditionalEffects.holographicSight.occupiesSightSlot,true);assert.equal(p.conditionalEffects.holographicSight.recipientVisionGranted,false);assert.equal(p.baseAttackModifier,patch.fireControl?1:-3);assert.equal(p.attackModifier,null);assert.equal(p.traits.filter(t=>t==='Scope').length,1);
 }
 const ordinary=profile('anti-materiel-rifle'),held=profile('anti-materiel-rifle',{placement:'held',manipulatorId:'arm'}),controlled=profile('anti-materiel-rifle',{fireControl:'basic'});assert.equal(ordinary.conditionalEffects.scopeUsage.active,false);assert.equal(held.conditionalEffects.scopeUsage.active,true);assert.equal(ordinary.conditionalEffects.scopeUsage.source.pages,'176');assert.equal(controlled.conditionalEffects.scopeUsage.independentFireControlScope,true);
});

test('CSC heavy integration: source-aware accessories respect included hardware and conditional effects',()=>{
 for(const [id]of expected){
  const base=profile(id,{linkedWeapons:2}),withComputer=profile(id,{linkedWeapons:2,accessories:['csc-intelligent-2','csc-smart-tracker']});assert.equal(withComputer.cost,base.cost+2*1700);assert.equal(withComputer.baseAttackModifier,base.baseAttackModifier);assert.equal(withComputer.attackModifier,null);assert.equal(withComputer.softwareLevel,-3);
  assert.equal(withComputer.accessoryEffects.find(e=>e.accessory==='csc-smart-tracker').requiresSuccessfulHit,true);assert.equal(withComputer.accessoryEffects.find(e=>e.accessory==='csc-intelligent-2').skillGranted,false);
  for(const accessory of WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022')){const r=direct(id,{accessories:[accessory.id]});assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}
  const suppressor=direct(id,{accessories:['csc-suppressor']});if(raw(id).slugThrower){assert.equal(has(suppressor,'SUPPRESSOR_WEAPON'),false);assert.equal(suppressor.weapons[0].cost,base.cost/2+250);assert.ok(suppressor.weapons[0].traits.includes('Silent'));}else{assert.ok(has(suppressor,'SUPPRESSOR_WEAPON'));assert.equal(suppressor.weapons[0].cost,null);}
 }
 for(const id of ['anti-materiel-rifle','light-assault-gun']){const p=profile(id);assert.equal(p.conditionalEffects.bipod.included,true);assert.equal(p.conditionalEffects.bipod.additionalCost,0);assert.ok(p.traits.includes('Very Bulky'));assert.equal(p.baseAttackModifier,-3);}
 for(const id of ['cppg-11','cppg-12','cppg-13']){
  const p=profile(id);assert.equal(p.conditionalEffects.holographicSight.modifier,1);assert.equal(p.conditionalEffects.holographicSight.additionalCost,0);assert.equal(p.baseAttackModifier,-3);
  for(const accessory of ['csc-holographic-sight','csc-laser-sight-8','csc-scope-5','csc-scope-7']){const r=direct(id,{accessories:[accessory]});assert.ok(has(r,'CSC_SIGHT_LIMIT'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}
 }
 const nonDestructive=profile('cppg-12',{accessories:['csc-gyrostabiliser']}),destructive=direct('cppg-13',{accessories:['csc-gyrostabiliser']});assert.equal(nonDestructive.traits.includes('Bulky'),false);assert.ok(has(destructive,'GYROSTABILISER_WEAPON'));assert.equal(destructive.weapons[0].cost,null);
 const body=profile('arl-standard',{accessories:['csc-scope-7']}),held=profile('arl-standard',{placement:'held',manipulatorId:'arm',accessories:['csc-scope-7']});assert.equal(body.accessoryEffects[0].active,false);assert.equal(held.accessoryEffects[0].active,true);assert.equal(body.traits.includes('Scope'),false);assert.equal(held.traits.includes('Scope'),true);
});

test('CSC heavy integration: unsupported ammunition, launchers and imported source overrides fail closed',()=>{
 for(const [id]of expected){
  for(const ammunition of ['aerosol','frag','smoke','stun']){const r=direct(id,{ammunition});assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].traits,raw(id).traits);}
  for(const patch of [{auxiliaryLauncher:'attached'},{auxiliaryLauncher:'integral-acr'},{auxiliaryLauncher:'both-acr'},{auxiliaryAmmunition:'frag'},{auxiliaryLoaded:1},{integralAmmunition:'smoke'},{integralLoaded:1},{looseGrenades:1}]){const r=direct(id,patch);assert.ok(has(r,'CSC_LAUNCHERS_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].associatedAttacks,[]);}
 }
 for(const patch of [{weaponId:'csc-grenade-launcher'},{weaponId:'csc-light-anti-air-missile'},{weaponId:'csc-infantry-mortar'},{initialIncluded:true},{magazineCost:0},{powerConnection:'robot'},{conditionalEffects:{attackDM:99}},{traits:['Auto 8']},{sourceFamily:'core-2022'},{requiresVehicleMount:false},{slugThrower:true}]){const d=design('rapid-fire-machinegun');Object.assign(d.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);}
});

test('CSC heavy integration: catalogue, evaluation, API and export isolate nested profile conditions',()=>{
 const d=design('cppg-12'),catalogue=getCatalogue(d),control=catalogue.stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons'),choice=control.itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-cppg-12');
 choice.conditionalEffects.holographicSight.rangeMetres.minimum=0;choice.source.pages='bad';choice.compatibility.robotPowerConnection=true;
 const directChoice=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-cppg-12');directChoice.ammunitionAccounting.magazinePriceSource.pages='bad';directChoice.sourceMeasurements.mass.value=0;
 const a=direct('cppg-12');a.weapons[0].conditionalEffects.holographicSight.modifier=99;a.weapons[0].traits.push('AP 99');a.weapons[0].source.pages='bad';
 const fresh=profile('cppg-12');assert.equal(fresh.conditionalEffects.holographicSight.modifier,1);assert.equal(fresh.conditionalEffects.holographicSight.rangeMetres.minimum,50);assert.deepEqual(fresh.traits,raw('cppg-12').traits);assert.equal(fresh.source.pages,'160-161,175');assert.equal(fresh.ammunitionAccounting.magazinePriceSource.pages,'161');assert.equal(fresh.compatibility.robotPowerConnection,false);assert.equal(raw('cppg-12').sourceMeasurements.mass.value,12);
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));const view=api.getView();view.evaluation.totals.weapons[0].conditionalEffects.holographicSight.modifier=99;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.holographicSight.modifier,1);assert.deepEqual(importDesign(exportDesign(d)),d);
 const bipod=profile('light-assault-gun');bipod.conditionalEffects.bipod.ignoredTraits.push('AP 5');assert.deepEqual(profile('light-assault-gun').conditionalEffects.bipod.ignoredTraits,['Bulky','Very Bulky']);const rapid=profile('rapid-fire-machinegun');rapid.conditionalEffects.alternativeDischarge.coolingRounds=0;assert.equal(profile('rapid-fire-machinegun').conditionalEffects.alternativeDischarge.coolingRounds,2);
});
