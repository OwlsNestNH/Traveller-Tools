import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,weaponControl,evaluateWeapons,RIFLE_WEAPON_IDS} from '../engine/weapons.mjs';
import {CSC_ENERGY_WEAPONS} from '../engine/csc-energy-weapons.mjs';
import {createRobotApi} from '../js/api.mjs';

// Independent transcription of visually checked CSC printed pp149 and153.
// Complete prose checked on pp149-153; Fire p131 and referenced cryojet p160.
// Source images remain outside the repository.
const expected=[
 ['gauntlet-laser',10,'small',20,'3D',2,2500,100,1100,['Zero-G'],true],
 ['hand-flamer',10,'small',5,'3D',2,1500,5,25,['Blast 2','Fire'],false],
 ['laser-pistol-11',11,'small',30,'3D+3',1,3000,100,3000,['Zero-G'],true],
 ['personal-defence-laser',13,'small',25,'3D+3',2,6000,25,100,['Auto 2','Zero-G'],false],
 ['cartridge-laser-carbine-10',10,'medium',150,'4D',3,2500,15,70,['Zero-G'],false],
 ['cartridge-laser-carbine-12',12,'medium',200,'4D+3',2.5,4000,20,70,['Zero-G'],false],
 ['cartridge-laser-rifle-10',10,'medium',200,'5D',5,3500,20,150,['Auto 3','Zero-G'],false],
 ['cartridge-laser-rifle-12',12,'medium',400,'5D+3',4,8000,25,150,['Auto 3','Zero-G'],false],
 ['cryo-rifle',13,'medium',10,'4D',9,6000,12,150,['Blast 3'],false],
 ['flame-rifle',9,'medium',10,'4D',8,2500,10,50,['Blast 3','Fire'],false],
 ['heavy-laser-rifle',12,'medium',1200,'6D',12,14000,12,500,['Scope','Zero-G'],true],
 ['stagger-laser-rifle-12',12,'medium',300,'5D',4,10000,50,5000,['Auto 2','Zero-G'],true],
 ['stagger-laser-rifle-14',14,'medium',350,'5D+3',3,15000,100,6000,['Auto 3','Zero-G'],true],
 ['stun-blaster',13,'medium',20,'4D',5,3000,200,500,['Stun','Zero-G'],false],
 ['stun-carbine',12,'medium',20,'3D',4,2000,50,200,['Stun','Zero-G'],false]
];
const record=(id,patch={})=>({id:'energy-test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const design=(id,patch={},tl=16)=>updateDesign(createDesign({techLevel:tl}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const run=(...args)=>evaluateDesign(design(...args));
const profile=(...args)=>run(...args).totals.weapons[0];
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);
const direct=(id,patch={},tl=16,size=6,skills=[])=>evaluateWeapons({kind:'standard',techLevel:tl,selections:{physical:{weapons:[record(id,patch)]}}},[{id:'arm',size,dexterity:8}],skills);
const raw=id=>CSC_ENERGY_WEAPONS.find(w=>w.id==='csc-'+id);

test('CSC energy source rows exactly match the bounded fixed-capacity tranche',()=>{
 assert.equal(CSC_ENERGY_WEAPONS.length,15);
 assert.deepEqual(CSC_ENERGY_WEAPONS.map(w=>w.id),expected.map(r=>'csc-'+r[0]));
 for(const [id,tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded]of expected){
  const w=raw(id);
  assert.deepEqual([w.tl,w.mountClass,w.range,w.damage,w.massKg,w.cost,w.magazine,w.magazineCost,w.traits,w.initialIncluded],[tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded]);
  assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.source.book,'Central Supply Catalogue Update 2023');assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');
  assert.ok(w.source.pages.includes(mountClass==='small'?'149':'153'));assert.ok(w.label.endsWith('(CSC 2023)'));
  assert.equal(w.weaponFamily,mountClass==='small'?'pistol':'rifle');assert.equal(w.skill,'gun-combat');assert.equal(w.speciality,'energy');
  assert.equal(w.compatibility.accessoryRules,'csc-2023');assert.equal(w.compatibility.associatedLauncherRules,null);assert.equal(w.compatibility.attachedLauncher,false);assert.equal(w.compatibility.robotPowerConnection,false);
  assert.equal(w.ammunitionAccounting.initialMagazine,initialIncluded?'included-power-pack':'separate-purchase');
  assert.equal(w.ammunitionAccounting.magazinePriceSource.pages,mountClass==='small'?'149':'153');assert.equal(w.ammunitionAccounting.mountSource.pages,'61');
  assert.equal(w.conditionalEffects.resolvedAttack,false);assert.equal(w.conditionalEffects.skillGranted,false);assert.equal(w.conditionalEffects.recipientVisionGranted,false);assert.equal(w.conditionalEffects.autoloadResolvesConditions,false);
 }
 for(const id of ['maser-pistol','maser-rifle','matter-disintegrator-18','matter-disintegrator-19','pepper-spray','ion-rifle-14','ion-rifle-15','solar-beam-rifle','plasma-rifle-16','laser-pistol-9','laser-carbine-9','laser-carbine-11','laser-rifle-9','laser-rifle-11','laser-sniper-12','stunner-8','stunner-10','stunner-12'])assert.equal(raw(id),undefined);
 assert.equal(raw('gauntlet-laser').massKg,2);assert.equal(raw('gauntlet-laser').mountClass,'small');
 assert.equal(raw('heavy-laser-rifle').massKg,12);assert.equal(raw('heavy-laser-rifle').mountClass,'medium');
});

for(const [id,tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded] of expected){
 test('CSC energy '+id+' integrates source facts, initial pack and linked autoloader costs',()=>{
  const w=WEAPONS.find(w=>w.id==='csc-'+id),mountCost=mountClass==='small'?500:1000,mountSlots=mountClass==='small'?1:2,initialCost=initialIncluded?0:magazineCost;
  assert.deepEqual(w,raw(id));
  const result=run(id),p=result.totals.weapons[0];assert.equal(result.status,'verified');
  assert.equal(p.cost,cost+mountCost+initialCost);assert.equal(p.slots,mountSlots);assert.equal(p.massKg,massKg);assert.equal(p.range,range);assert.equal(p.damage,damage);assert.equal(p.magazine,magazine);assert.deepEqual(p.traits,traits);
  assert.equal(p.baseAttackModifier,-3);assert.equal(p.softwareLevel,-3);assert.equal(p.attackModifier,null);assert.deepEqual(result.totals.skills,[]);
  assert.equal(p.sourceFamily,'csc-2023');assert.equal(p.weaponFamily,mountClass==='small'?'pistol':'rifle');assert.deepEqual(p.source,w.source);
  assert.equal(profile(id,{autoload:true,extraMagazines:3}).cost,cost+mountCost+initialCost+6*magazineCost);
  assert.equal(profile(id,{autoload:true,extraMagazines:3}).slots,2*mountSlots);
  const linked=profile(id,{linkedWeapons:3,autoload:true,extraMagazines:2,fireControl:'basic'});
  assert.equal(linked.cost,3*(cost+mountCost+initialCost+4*magazineCost)+10000);assert.equal(linked.slots,6*mountSlots+1);assert.equal(linked.linkedDamageBonus,Number(damage.match(/^\d+/)[0])*2);
  const empty=direct(id,{initialMagazines:0});assert.equal(empty.weapons[0].cost,cost+mountCost);
  assert.equal(has(empty,'INCLUDED_POWER_PACK'),initialIncluded);
  if(initialIncluded){assert.equal(run(id,{initialMagazines:0}).status,'invalid');assert.equal(run(id,{initialMagazines:0}).totals,null);}else assert.equal(profile(id,{initialMagazines:0}).cost,cost+mountCost);
  if(!initialIncluded)assert.ok(has(result,'WEAPON_SOURCE_INTERPRETATION'));
  assert.deepEqual(result.ledger.find(l=>l.id==='weapon-energy-test').weaponSource,w.source);
  const d=design(id);assert.deepEqual(importDesign(exportDesign(d)),d);
 });
 test('CSC energy '+id+' observes category arm fit, TL and software boundaries',()=>{
  const minimum=mountClass==='small'?3:5;
  assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.ok(!has(direct(id,{},tl),'WEAPON_TL'));
  const arm={placement:'arm',manipulatorId:'arm'};
  assert.ok(has(direct(id,arm,16,minimum-1),'WEAPON_ARM_SIZE'));assert.ok(!has(direct(id,arm,16,minimum),'WEAPON_ARM_SIZE'));
  assert.ok(has(direct(id,{...arm,autoload:true,extraMagazines:1},16,minimum),'WEAPON_ARM_SIZE'));assert.ok(!has(direct(id,{...arm,autoload:true,extraMagazines:1},16,minimum+1),'WEAPON_ARM_SIZE'));
  const held=direct(id,{placement:'held',manipulatorId:'arm'},16,1);assert.ok(!has(held,'WEAPON_ARM_SIZE'));assert.equal(held.weapons[0].slots,0);assert.equal(held.weapons[0].cost,cost+(initialIncluded?0:magazineCost));
  assert.ok(has(direct(id,{placement:'held',manipulatorId:'arm',autoload:true,extraMagazines:1}),'HELD_WEAPON_MOUNT'));
  assert.ok(has(direct(id,{autoload:true,extraMagazines:1},5),'AUTOLOADER_TL'));
  assert.ok(has(direct(id,{extraMagazines:1}),'SPARE_AMMO_STORAGE'));assert.ok(has(direct(id,{autoload:true}),'EMPTY_AUTOLOADER'));
  assert.equal(direct(id,{},16,6,[{id:'gun-combat:slug',speciality:'slug',level:3}]).weapons[0].softwareLevel,-3);
  assert.equal(direct(id,{},16,6,[{id:'gun-combat:energy',speciality:'energy',level:2}]).weapons[0].softwareLevel,2);
 });
}

test('CSC laser recharge and pack handling remain operational conditions, not robot power connections',()=>{
 for(const id of ['gauntlet-laser','laser-pistol-11','heavy-laser-rifle','stagger-laser-rifle-12','stagger-laser-rifle-14']){
  const p=profile(id,{autoload:true,extraMagazines:1}),s=p.conditionalEffects.powerSupply;
  assert.equal(s.recharge.hours,8);assert.equal(s.recharge.requiresExternalPowerSource,true);assert.equal(s.recharge.source.pages,'149');assert.equal(s.robotPowerConnectionSupported,false);assert.equal(s.unlimitedFire,false);
  assert.equal(p.conditionalEffects.autoloadResolvesConditions,false);assert.equal(p.attackModifier,null);
 }
 for(const id of ['gauntlet-laser','laser-pistol-11']){
  const s=profile(id).conditionalEffects.powerSupply;assert.equal(s.connectionRequired,true);assert.equal(s.connectorSwitch.action,'Minor');assert.equal(s.connectorSwitch.actions,1);assert.equal(s.packHandling.duration,'1D rounds');
 }
 assert.equal(profile('gauntlet-laser').conditionalEffects.powerSupply.location,'backpack');assert.equal(profile('laser-pistol-11').conditionalEffects.powerSupply.location,'belt-or-wrist');
 const hand=profile('gauntlet-laser').conditionalEffects.handUse;assert.equal(hand.openHandRetained,true);assert.equal(hand.extraManipulatorGranted,false);
 assert.equal(profile('heavy-laser-rifle').conditionalEffects.powerSupply.location,'integrated');
 assert.equal(profile('stagger-laser-rifle-12').conditionalEffects.powerSupply.location,'unspecified');
 // The table's printed price is not evidence of non-laser recharge time/cost.
 for(const id of ['hand-flamer','cryo-rifle','flame-rifle','stun-blaster','stun-carbine']){
  const s=profile(id).conditionalEffects.powerSupply;assert.equal(s.recharge.hours,null);assert.equal(s.recharge.cost,null);assert.equal(s.reload.actions,null);assert.equal(s.robotPowerConnectionSupported,false);
 }
 const stock=profile('stun-carbine').conditionalEffects.powerSupply;assert.equal(stock.location,'stock');assert.equal(stock.detachable,true);assert.deepEqual(stock.incompatibleWith,['hand-stunner-power-packs']);
});

test('CSC chemical magazines are disposable purchases rather than rechargeable or free laser packs',()=>{
 for(const id of ['personal-defence-laser','cartridge-laser-carbine-10','cartridge-laser-carbine-12','cartridge-laser-rifle-10','cartridge-laser-rifle-12']){
  const w=raw(id),p=profile(id),s=p.conditionalEffects.powerSupply;
  assert.equal(w.initialIncluded,false);assert.equal(s.kind,'chemical-cartridge-magazine');assert.equal(s.disposable,true);assert.equal(s.rechargeable,false);assert.equal(s.externalPowerPack,false);assert.equal(s.recharge,undefined);
  assert.equal(p.ammunitionAccounting.initialMagazine,'separate-purchase');assert.ok(has(run(id),'WEAPON_SOURCE_INTERPRETATION'));
  if(id.startsWith('cartridge-')){assert.equal(s.reload.timing,'Same as a slug magazine');assert.equal(s.reload.actions,null);}
 }
 assert.equal(profile('personal-defence-laser').conditionalEffects.powerSupply.location,'handgrip');
});

test('CSC fire, sealed-suit freezing and blast modes retain every conditional restriction',()=>{
 for(const id of ['hand-flamer','flame-rifle']){
  const fire=profile(id).conditionalEffects.fire;
  assert.equal(fire.damageEachSubsequentRound,true);assert.equal(fire.maximumConcurrentSources,1);assert.equal(fire.useHighestDamageSource,true);assert.equal(fire.resolvedDamage,false);assert.equal(fire.source.pages,'131');
  assert.deepEqual(fire.selfExtinguish,{dice:'2D',target:8,timing:'Start of each round',refereeMayContinueWithFlammableMaterial:true});assert.deepEqual(fire.extinguishAction,{action:'Significant',actions:1,characteristic:'DEX',target:8,firefightingEquipmentDM:2});
 }
 const freeze=profile('cryo-rifle').conditionalEffects.freeze;assert.equal(freeze.condition,'Hit a target wearing a sealed protective suit');assert.deepEqual(freeze.check,{characteristic:'STR',target:8});assert.equal(freeze.onFailure,'Held in place');assert.equal(freeze.duration,'1D rounds');
 const stun=profile('stun-blaster'),blast=stun.conditionalEffects.alternativeDischarge;
 assert.equal(stun.damage,'4D');assert.equal(stun.magazine,200);assert.deepEqual(stun.traits,['Stun','Zero-G']);assert.equal(blast.id,'blast');assert.equal(blast.optional,true);assert.equal(blast.damage,'3D');assert.equal(blast.chargesConsumed,2);assert.deepEqual(blast.traits,['Blast 3','Stun','Zero-G']);
 for(const id of ['hand-flamer','flame-rifle','cryo-rifle','stun-blaster','heavy-laser-rifle']){const p=profile(id);assert.equal(p.baseAttackModifier,-3);assert.equal(p.attackModifier,null);assert.equal(p.conditionalEffects.skillGranted,false);assert.equal(p.conditionalEffects.recipientVisionGranted,false);}
});

test('CSC TL11 pistol replacement cost differs without changing any original Core energy row',()=>{
 const coreRows=[
  ['laser-pistol-9',9,'small',20,'3D',2000,100,1000],['laser-pistol-11',11,'small',30,'3D+3',3000,100,1200],
  ['stunner-8',8,'small',5,'2D',500,100,200],['stunner-10',10,'small',5,'2D+3',750,100,200],['stunner-12',12,'small',10,'3D',1000,100,200],
  ['laser-carbine-9',9,'medium',150,'4D',2500,50,1000],['laser-carbine-11',11,'medium',200,'4D+3',4000,50,3000],['laser-rifle-9',9,'medium',200,'5D',3500,100,1500],['laser-rifle-11',11,'medium',400,'5D+3',8000,100,3500],['laser-sniper-12',12,'medium',600,'5D+3',9000,6,250],['plasma-rifle-16',16,'medium',300,'6D',100000,null,0]
 ];
 for(const row of coreRows){const w=WEAPONS.find(w=>w.id===row[0]);assert.deepEqual([w.id,w.tl,w.mountClass,w.range,w.damage,w.cost,w.magazine,w.magazineCost],row);assert.equal(w.initialIncluded,true);assert.equal(w.sourceFamily,'core-2022');assert.equal(w.source.pages,'129');assert.equal(w.source.book,'Core Rulebook Update 2022');}
 const csc=profile('laser-pistol-11',{autoload:true,extraMagazines:1}),core=profile('laser-pistol-11',{weaponId:'laser-pistol-11',autoload:true,extraMagazines:1});
 assert.equal(csc.cost,9500);assert.equal(core.cost,5900);assert.equal(csc.sourceFamily,'csc-2023');assert.equal(core.sourceFamily,'core-2022');assert.ok(has(run('laser-pistol-11'),'WEAPON_SOURCE_INTERPRETATION'));
 assert.ok(RIFLE_WEAPON_IDS.every(id=>!id.startsWith('csc-')));
});

test('CSC energy rejects Core accessories and unsupported ammunition/launcher combinations without borrowed effects or prices',()=>{
 for(const [id]of expected){
  for(const accessory of WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022')){const r=direct(id,{accessories:[accessory.id]});assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'),id+' '+accessory.id);assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);assert.deepEqual(r.weapons[0].traits,raw(id).traits);}
  for(const patch of [{auxiliaryLauncher:'attached',auxiliaryAmmunition:'frag',auxiliaryLoaded:1},{auxiliaryLauncher:'integral-acr'},{auxiliaryLauncher:'both-acr',integralAmmunition:'smoke',integralLoaded:1},{auxiliaryAmmunition:'aerosol'},{auxiliaryLoaded:1},{integralAmmunition:'stun'},{integralLoaded:1},{looseGrenades:1}]){const r=direct(id,patch);assert.ok(has(r,'CSC_LAUNCHERS_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].associatedAttacks,[]);}
  for(const ammunition of ['aerosol','frag','smoke','stun']){const r=direct(id,{ammunition});assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].traits,raw(id).traits);}
 }
 const r=run('cryo-rifle',{accessories:['scope-5']});assert.equal(r.status,'invalid');assert.equal(r.totals,null);
});

test('CSC energy imports reject unresolved weapons, free power overrides and alternate-effect injection',()=>{
 for(const patch of [{weaponId:'csc-ion-rifle-14'},{weaponId:'csc-maser-pistol'},{weaponId:'csc-solar-beam-rifle'},{powerConnection:'robot'},{rechargeHours:0},{initialIncluded:true},{magazineCost:0},{ammunition:'chemical-cartridge'},{conditionalEffects:{attackDM:99}},{damage:'3D',traits:['Blast 3']},{sourceFamily:'core-2022'}]){
  const d=design('stun-blaster');Object.assign(d.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);
 }
});

test('CSC energy catalogue, evaluation, exported design and API isolate nested source/condition mutations',()=>{
 const d=design('stun-blaster');
 const catalogue=getCatalogue(d),choice=catalogue.stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-stun-blaster');
 choice.conditionalEffects.alternativeDischarge.damage='99D';choice.source.pages='bad';choice.compatibility.robotPowerConnection=true;
 const rawChoice=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-stun-blaster');rawChoice.ammunitionAccounting.magazinePriceSource.pages='bad';
 const evaluated=direct('stun-blaster');evaluated.weapons[0].conditionalEffects.alternativeDischarge.traits.push('AP 99');evaluated.weapons[0].conditionalEffects.powerSupply.recharge.hours=0;evaluated.weapons[0].source.pages='bad';
 const fresh=profile('stun-blaster');assert.equal(fresh.conditionalEffects.alternativeDischarge.damage,'3D');assert.deepEqual(fresh.conditionalEffects.alternativeDischarge.traits,['Blast 3','Stun','Zero-G']);assert.equal(fresh.conditionalEffects.powerSupply.recharge.hours,null);assert.equal(fresh.source.pages,'152-153');assert.equal(fresh.ammunitionAccounting.magazinePriceSource.pages,'153');assert.equal(fresh.compatibility.robotPowerConnection,false);
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));
 const view=api.getView(),p=view.evaluation.totals.weapons[0];assert.equal(p.conditionalEffects.alternativeDischarge.chargesConsumed,2);assert.equal(p.ammunitionAccounting.initialMagazine,'separate-purchase');assert.equal(p.weaponFamily,'rifle');
 p.conditionalEffects.alternativeDischarge.chargesConsumed=1;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.alternativeDischarge.chargesConsumed,2);
 assert.deepEqual(importDesign(exportDesign(d)),d);
});


test('CSC energy accessories use source, weapon category and explicit conditional benefits',()=>{
 for(const [id]of expected){
  const p=profile(id,{accessories:['csc-intelligent-2','csc-smart-tracker'],linkedWeapons:2}),base=profile(id,{linkedWeapons:2});
  assert.equal(p.cost,base.cost+2*(1200+500));assert.equal(p.baseAttackModifier,base.baseAttackModifier);assert.equal(p.softwareLevel,-3);assert.equal(p.attackModifier,null);
  const computer=p.accessoryEffects.find(e=>e.accessory==='csc-intelligent-2'),tracker=p.accessoryEffects.find(e=>e.accessory==='csc-smart-tracker');
  assert.equal(computer.computerRating,2);assert.equal(computer.robotBrainBandwidthGranted,0);assert.deepEqual(computer.programsGranted,[]);assert.equal(computer.skillGranted,false);assert.equal(computer.recipientVisionGranted,false);
  assert.equal(tracker.modifier,2);assert.equal(tracker.requiresSuccessfulHit,true);assert.equal(tracker.tagAction,'Minor');assert.equal(tracker.bonusRound,'following round');assert.equal(tracker.requiresSameWeapon,true);assert.equal(tracker.requiresSameTarget,true);assert.equal(tracker.retagEachRound,true);assert.equal(tracker.resolvedAttack,false);
  const suppressor=direct(id,{accessories:['csc-suppressor']});assert.ok(has(suppressor,'SUPPRESSOR_WEAPON'));assert.equal(suppressor.weapons[0].cost,null);assert.deepEqual(suppressor.weapons[0].accessoryEffects,[]);assert.deepEqual(suppressor.weapons[0].traits,raw(id).traits);
  const gyro=direct(id,{accessories:['csc-gyrostabiliser']});assert.ok(has(gyro,'GYROSTABILISER_WEAPON'));assert.equal(gyro.weapons[0].cost,null);
  assert.ok(has(direct(id,{accessories:['csc-smart-tracker']}),'CSC_TRACKER_COMPUTER'));
 }
 const pistol=direct('gauntlet-laser',{accessories:['csc-scope-7']});assert.ok(has(pistol,'SCOPE_WEAPON'));assert.equal(pistol.weapons[0].cost,null);
 const body=profile('stun-carbine',{accessories:['csc-scope-7']}),held=direct('stun-carbine',{placement:'held',manipulatorId:'arm',accessories:['csc-scope-7']}).weapons[0];
 assert.equal(body.traits.includes('Scope'),false);assert.equal(body.accessoryEffects[0].active,false);assert.equal(held.traits.includes('Scope'),true);assert.equal(held.accessoryEffects[0].active,true);assert.equal(held.accessoryEffects[0].recipientVisionGranted,false);
 for(const accessory of ['csc-scope-5','csc-scope-7','csc-holographic-sight','csc-laser-sight-8']){const r=direct('heavy-laser-rifle',{accessories:[accessory]});assert.ok(has(r,'CSC_SIGHT_LIMIT'));assert.equal(r.weapons[0].cost,null);}
 const laser=profile('personal-defence-laser',{accessories:['csc-laser-sight-10']}),effect=laser.accessoryEffects[0];assert.equal(effect.modifier,1);assert.deepEqual(effect.rangeMetres,{maximum:50,maximumInclusive:false});assert.equal(effect.visibleDot,false);assert.equal(effect.recipientVisionGranted,false);assert.equal(laser.baseAttackModifier,-3);
 const choices=weaponControl(design('gauntlet-laser')).itemFields.find(f=>f.field==='accessories').choicesBy.values;
 assert.ok(choices['csc-gauntlet-laser'].every(a=>a.sourceFamily==='csc-2023'));assert.ok(!choices['csc-gauntlet-laser'].some(a=>a.id==='csc-scope-7'));assert.ok(choices['csc-stun-carbine'].some(a=>a.id==='csc-scope-7'));assert.ok(!choices['csc-stun-carbine'].some(a=>a.id==='csc-suppressor'));
});


test('CSC heavy-laser printed scope distinguishes held use from mounted hardware and fire control',()=>{
 const mounted=profile('heavy-laser-rifle'),held=direct('heavy-laser-rifle',{placement:'held',manipulatorId:'arm'}).weapons[0],controlled=profile('heavy-laser-rifle',{fireControl:'basic'});
 assert.equal(mounted.conditionalEffects.scopeUsage.active,false);assert.equal(mounted.conditionalEffects.scopeUsage.independentFireControlScope,false);assert.equal(mounted.conditionalEffects.scopeUsage.source.pages,'176');
 assert.equal(held.conditionalEffects.scopeUsage.active,true);assert.equal(held.conditionalEffects.scopeUsage.independentFireControlScope,false);assert.equal(controlled.conditionalEffects.scopeUsage.active,false);assert.equal(controlled.conditionalEffects.scopeUsage.independentFireControlScope,true);
 assert.equal(mounted.baseAttackModifier,-3);assert.equal(held.baseAttackModifier,-3);assert.equal(controlled.baseAttackModifier,1);assert.equal(mounted.attackModifier,null);assert.equal(held.attackModifier,null);assert.equal(controlled.attackModifier,null);
 assert.equal(mounted.conditionalEffects.recipientVisionGranted,false);assert.equal(held.conditionalEffects.recipientVisionGranted,false);
});
