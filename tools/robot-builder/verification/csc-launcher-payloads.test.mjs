import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_STANDARD_LAUNCHERS,CSC_DIRECT_PAYLOADS} from '../engine/csc-launcher-payloads.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,MOUNTS,RIFLE_WEAPON_IDS,evaluateWeapons,weaponControl} from '../engine/weapons.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
// Independently checked full rendered/text source pp157-163, Fire p131 and
// specialised-ammunition pp178-179. No source pages are distributed here.
const launchers=[['csc-grenade-launcher-standard',7,100,2,400,180,['Blast 6']],['csc-ram-grenade-launcher-standard',8,250,6,800,240,['Auto 3','Blast 6','Bulky']]];
const payloads=[['chemical',5,null,50,['Blast 9'],'Special'],['emp',9,null,100,['Blast 6'],'none'],['incendiary',7,'2D',75,['Blast 3','Fire'],'2D'],['neurotoxin',9,null,250,['Blast 9'],'Special'],['plasma',16,'8D',500,['Blast 6'],'8D'],['thermal-smoke',7,null,30,['Blast 9'],'none'],['tranq-gas',8,null,75,['Blast 9'],'Special']];
const all=[...CSC_STANDARD_LAUNCHERS,...CSC_DIRECT_PAYLOADS];
const payload=id=>CSC_DIRECT_PAYLOADS.find(w=>w.id==='csc-direct-grenade-'+id);
const record=(weaponId,patch={})=>({id:'launcher-payload-test',weaponId,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const design=(id,patch={},techLevel=16)=>updateDesign(createDesign({techLevel}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const direct=(id,patch={},techLevel=16,size=7,skills=[])=>evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:[record(id,patch)]}}},[{id:'arm',size,dexterity:8}],skills);
const profile=(...args)=>direct(...args).weapons[0];
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);

test('CSC launcher source: exactly two fixed standard profiles, whole magazines and no Core grenade path',()=>{
 assert.equal(CSC_STANDARD_LAUNCHERS.length,2);
 for(const [id,tl,range,mass,cost,magazineCost,traits] of launchers){const w=CSC_STANDARD_LAUNCHERS.find(w=>w.id===id);
  assert.deepEqual([w.tl,w.range,w.massKg,w.cost,w.magazineCost,w.traits],[tl,range,mass,cost,magazineCost,traits]);assert.equal(w.damage,'5D');assert.equal(w.magazine,6);assert.equal(w.mountClass,'heavy');assert.equal(w.weaponFamily,'heavy-portable');assert.equal(w.skill,'heavy-weapons');assert.equal(w.speciality,'portable');assert.match(w.label,/standard ammunition/);assert.doesNotMatch(w.label,/fragmentation/i);assert.equal(w.grenade,undefined);assert.equal(w.slugThrower,undefined);assert.ok(!RIFLE_WEAPON_IDS.includes(id));
  assert.equal(w.initialIncluded,false);assert.equal(w.ammunitionAccounting.sourceInclusion,'not-stated');assert.match(w.ammunitionAccounting.inclusionStatement,/accounting convention, not an explicit source exclusion/);assert.equal(w.ammunitionAccounting.magazinePriceSource.pages,'161');assert.equal(w.ammunitionAccounting.mountSource.pages,'61');assert.equal(w.ammunitionAccounting.mountExcludesAmmunition,true);assert.equal(w.conditionalEffects.standardAmmunition.specialisedAmmunitionImplemented,false);
  assert.equal(w.roundMassKg,undefined);assert.equal(w.roundCost,undefined);assert.equal(w.conditionalEffects.reload,undefined);
 }
 assert.equal(CSC_STANDARD_LAUNCHERS[0].conditionalEffects.calibre.millimetres,40);assert.equal(CSC_STANDARD_LAUNCHERS[1].conditionalEffects.calibre,undefined);assert.equal(CSC_STANDARD_LAUNCHERS[1].conditionalEffects.burst.maximumRoundsPerAttack,3);
});
test('CSC payload source: exactly seven nonduplicate per-item profiles retain printed Special without fixed damage',()=>{
 assert.equal(CSC_DIRECT_PAYLOADS.length,7);
 for(const [id,tl,damage,cost,traits,sourceDamage] of payloads){const w=payload(id);assert.deepEqual([w.tl,w.damage,w.cost,w.traits,w.sourceDamage],[tl,damage,cost,traits,sourceDamage]);assert.equal(w.massKg,.5);assert.equal(w.range,null);assert.equal(w.thrownRange,20);assert.equal(w.directPayload,true);assert.equal(w.grenade,undefined);assert.equal(w.weaponFamily,'payload');assert.equal(w.mountClass,'small');assert.equal(w.skill,'athletics');assert.equal(w.speciality,'dexterity');assert.equal(w.magazine,null);assert.equal(w.magazineCost,0);assert.equal(w.initialIncluded,true);assert.equal(w.mountSource.pages,'61');assert.equal(w.ammunitionAccounting.priceBasis,'one payload');assert.equal(w.ammunitionAccounting.autoloadSupported,false);assert.equal(w.conditionalEffects.delivery.mountedDeliveryGranted,false);assert.equal(w.conditionalEffects.delivery.activationImplemented,false);assert.equal(w.conditionalEffects.delivery.source.pages,'157');}
 for(const id of ['aerosol','frag','smoke','stun'])assert.equal(payload(id),undefined);
 for(const w of all){assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.source.book,'Central Supply Catalogue Update 2023');assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');assert.equal(w.compatibility.accessoryRules,w.directPayload?null:'csc-2023');assert.equal(w.compatibility.associatedLauncherRules,null);assert.equal(w.compatibility.specialisedAmmunitionRules,null);assert.equal(w.compatibility.attachedLauncher,false);assert.equal(w.compatibility.robotPowerConnection,false);assert.equal(w.conditionalEffects.resolvedAttack,false);assert.equal(w.conditionalEffects.resolvedDamage,false);}
});
test('CSC payload source: conditional poison, weather, legal and EMP thresholds remain exact and unresolved',()=>{
 for(const id of ['chemical','neurotoxin','tranq-gas']){const e=payload(id).conditionalEffects;assert.match(e.poison.condition,/Living target.*without a respirator or sealed suit/);assert.deepEqual(e.poison.check,{characteristic:'END',target:id==='tranq-gas'?10:12});assert.equal(e.poison.damage,id==='tranq-gas'?'unconscious':id==='neurotoxin'?'1D INT':'1D');assert.equal(e.poison.interval,'1 round');assert.equal(e.poison.resolved,false);assert.equal(e.poison.requiresInhalation,id!=='chemical');assert.equal(e.cloud.duration,'1D x 3 rounds');assert.equal(e.cloud.weatherMayReduceDuration,true);assert.match(e.cloud.weather,/Heavy winds or rain/);}
 const c=payload('chemical').conditionalEffects.poison;assert.equal(c.compositionDependent,true);assert.equal(c.nonLethalDamageType,'Stun');assert.equal(c.lethalDamageType,'Injury');assert.deepEqual(c.lethalExposure,['lung contact','skin contact']);assert.equal(c.source.pages,'157');
 const n=payload('neurotoxin').conditionalEffects.legality;assert.equal(n.bannedFromLawLevel,1);assert.equal(n.militaryUseOftenBanned,true);assert.equal(n.legalityResolved,false);
 const e=payload('emp').conditionalEffects.electromagneticPulse;assert.equal(e.livingTissueHarmed,false);assert.equal(e.shutdown.condition,'Unshielded electronics');assert.equal(e.shutdown.duration,'1D minutes');assert.equal(e.permanentDamage.relativeTechLevelMaximum,-2);assert.equal(e.permanentDamage.maximumInclusive,false);assert.match(e.permanentDamage.condition,/Unshielded/);assert.equal(e.immunity.relativeTechLevelMinimum,2);assert.equal(e.immunity.minimumInclusive,false);assert.match(e.immunity.condition,/All electronics/);assert.equal(e.universalRobotShutdown,false);assert.equal(e.resolved,false);assert.equal(e.source.pages,'157');
});
test('CSC payload source: thermal smoke and incendiary Fire remain conditional without invented duration or protection',()=>{
 const t=payload('thermal-smoke').conditionalEffects;assert.equal(t.vision.attackDM,-2);assert.equal(t.vision.infraredVisionBlocked,true);assert.equal(t.vision.infraredVisionBypasses,false);assert.equal(t.vision.normalVisionObscured,true);assert.equal(t.vision.automaticModifierApplied,false);assert.match(t.vision.condition,/targets within the cloud/);assert.equal(t.cloud.duration,'1D x 3 rounds');assert.equal(t.cloud.weatherMayReduceDuration,true);
 const i=payload('incendiary').conditionalEffects;assert.equal(i.ignition.onImpact,true);assert.equal(i.ignition.source.pages,'158');assert.equal(i.fire.source.pages,'131');assert.equal(i.fire.damageEachSubsequentRound,true);assert.equal(i.fire.maximumConcurrentSources,1);assert.equal(i.fire.useHighestDamageSource,true);assert.equal(i.fire.resolvedDamage,false);assert.deepEqual(i.fire.selfExtinguish,{dice:'2D',target:8,timing:'Start of each round',refereeMayContinueWithFlammableMaterial:true});assert.deepEqual(i.fire.extinguishAction,{action:'Significant',actions:1,characteristic:'DEX',target:8,firefightingEquipmentDM:2});assert.equal(i.fire.duration,undefined);
 for(const w of CSC_DIRECT_PAYLOADS){assert.equal(w.conditionalEffects.protectionGranted,false);assert.equal(w.conditionalEffects.skillGranted,false);}
});
for(const [id,tl,range,mass,cost,magazineCost,traits] of launchers)test('CSC launcher integration: '+id+' mounts, finite autoload, linked price, TL and skill isolation',()=>{
 const r=evaluateDesign(design(id));assert.equal(r.status,'verified');const p=r.totals.weapons[0];assert.deepEqual([p.cost,p.slots,p.massKg,p.range,p.damage,p.magazine,p.traits],[cost+5000+magazineCost,10,mass,range,'5D',6,traits]);assert.equal(p.baseAttackModifier,-3);assert.equal(p.attackModifier,null);assert.equal(profile(id,{initialMagazines:0}).cost,cost+5000);
 const l=profile(id,{linkedWeapons:2,autoload:true,extraMagazines:3});assert.equal(l.cost,2*(cost+5000+magazineCost+6*magazineCost));assert.equal(l.slots,40);assert.equal(l.linkedDamageBonus,5);assert.equal(l.magazine,6);
 assert.equal(profile(id,{autoload:true,extraMagazines:10}).cost,cost+5000+21*magazineCost);assert.throws(()=>design(id,{autoload:true,extraMagazines:11}),TypeError);assert.throws(()=>design(id,{linkedWeapons:5}),TypeError);
 assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.ok(has(direct(id,{autoload:true,extraMagazines:1},5),'AUTOLOADER_TL'));assert.ok(has(direct(id,{autoload:true}),'EMPTY_AUTOLOADER'));assert.ok(has(direct(id,{extraMagazines:1}),'SPARE_AMMO_STORAGE'));
 for(const [size,autoload,invalid] of [[6,false,true],[7,false,false],[7,true,true],[8,true,false]])assert.equal(has(direct(id,{placement:'arm',manipulatorId:'arm',autoload,extraMagazines:autoload?1:0},16,size),'WEAPON_ARM_SIZE'),invalid);
 assert.equal(profile(id,{},16,7,[{id:'heavy-weapons:portable',level:2}]).softwareLevel,2);assert.equal(profile(id,{},16,7,[{id:'gun-combat:slug',level:4},{id:'athletics:dexterity',level:4}]).softwareLevel,-3);assert.equal(profile(id,{placement:'held',manipulatorId:'arm'}).cost,cost+magazineCost);
});
for(const [id,tl,damage,cost,traits] of payloads)test('CSC payload integration: '+id+' direct mounting, held pricing, unresolved delivery and no ammunition',()=>{
 const key=payload(id).id,r=evaluateDesign(design(key));assert.equal(r.status,'verified');const p=r.totals.weapons[0];assert.deepEqual([p.cost,p.slots,p.massKg,p.range,p.damage,p.traits],[cost+500,1,.5,null,damage,traits]);assert.equal(p.baseAttackModifier,null);assert.equal(p.attackModifier,null);assert.equal(p.thrownRange,20);assert.equal(p.directPayload,true);
 const held=profile(key,{placement:'held',manipulatorId:'arm'});assert.equal(held.cost,cost);assert.equal(held.slots,0);assert.equal(held.baseAttackModifier,null);assert.equal(profile(key,{},16,7,[{id:'athletics:dexterity',level:3}]).softwareLevel,3);
 assert.ok(has(direct(key,{},tl-1),'WEAPON_TL'));assert.ok(has(direct(key,{placement:'arm',manipulatorId:'arm'},16,2),'WEAPON_ARM_SIZE'));assert.equal(has(direct(key,{placement:'arm',manipulatorId:'arm'},16,3),'WEAPON_ARM_SIZE'),false);
 for(const patch of [{autoload:true},{autoload:true,extraMagazines:1}]){assert.ok(has(direct(key,patch),'DIRECT_PAYLOAD_AUTOLOADER'));assert.ok(has(direct(key,patch),'AUTOLOADER_AMMUNITION'));}
 for(const patch of [{initialMagazines:0},{extraMagazines:1}])assert.ok(has(direct(key,patch),'WEAPON_AMMO_INAPPLICABLE'));
 const linked=direct(key,{linkedWeapons:2});assert.ok(has(linked,'DIRECT_PAYLOAD_LINKED_EFFECT'));assert.equal(linked.weapons[0].linkedDamageBonus,0);assert.equal(evaluateDesign(design(key,{linkedWeapons:2})).status,'blocked');
 const f=profile(key,{fireControl:'basic'});assert.equal(f.cost,cost+500+10000);assert.equal(f.baseAttackModifier,null);assert.equal(f.fireControlStatus,'inactive-delivery-unresolved');assert.deepEqual(f.conditionalEffects,p.conditionalEffects);
});
test('CSC launcher/payload integration: forced Core ammunition, all accessories and associated fields fail closed',()=>{
 for(const w of all){const specialisedAmmunitionRules=CSC_STANDARD_LAUNCHERS.some(launcher=>launcher.id===w.id)?'csc-single-modification-v1':null;assert.deepEqual(WEAPONS.find(x=>x.id===w.id),{...w,compatibility:{...w.compatibility,specialisedAmmunitionRules}});
  for(const ammunition of ['frag','aerosol','smoke','stun']){const r=direct(w.id,{ammunition});assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.equal(r.weapons[0].damage,w.damage);assert.deepEqual(r.weapons[0].traits,w.traits);}
  for(const accessory of WEAPON_ACCESSORIES.filter(a=>w.directPayload||a.sourceFamily!=='csc-2023')){const r=direct(w.id,{accessories:[accessory.id]});assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}
  for(const patch of [{auxiliaryLauncher:'attached'},{auxiliaryLauncher:'integral-acr'},{auxiliaryLauncher:'both-acr'},{auxiliaryAmmunition:'smoke'},{auxiliaryLoaded:1},{integralAmmunition:'smoke'},{integralLoaded:1},{looseGrenades:1}]){const r=direct(w.id,patch);assert.ok(has(r,'CSC_LAUNCHERS_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].associatedAttacks,[]);assert.equal(r.weapons[0].looseAmmunition,undefined);}
 }
 assert.deepEqual(MOUNTS.heavy,{slots:10,cost:5000,armSize:7});assert.deepEqual(MOUNTS.small,{slots:1,cost:500,armSize:3});
 for(const id of ['grenade-launcher','ram-grenade-launcher']){const w=WEAPONS.find(x=>x.id===id);assert.equal(w.sourceFamily,'core-2022');assert.equal(w.grenade,true);}
 for(const id of ['aerosol','frag','smoke','stun'])assert.equal(WEAPONS.find(x=>x.id==='direct-grenade-'+id).sourceFamily,'core-2022');
});
test('CSC standard launcher accessories: RAM gyro, conditional sights and computers; no suppressors or Core mixing',()=>{
 const gl=launchers[0][0],ram=launchers[1][0];
 const gyro=profile(ram,{accessories:['csc-gyrostabiliser']});assert.equal(gyro.cost,6540);assert.deepEqual(gyro.traits,['Auto 3','Blast 6']);assert.ok(has(direct(gl,{accessories:['csc-gyrostabiliser']}),'GYROSTABILISER_WEAPON'));assert.equal(profile(gl,{accessories:['csc-gyrostabiliser']}).cost,null);
 for(const id of [gl,ram]){const suppressor=direct(id,{accessories:['csc-suppressor']});assert.ok(has(suppressor,'SUPPRESSOR_WEAPON'));assert.equal(suppressor.weapons[0].cost,null);
  const sight=profile(id,{accessories:['csc-holographic-sight']});assert.ok(sight.traits.includes('Scope'));assert.equal(sight.baseAttackModifier,-3);assert.equal(sight.accessoryEffects[0].resolvedAttack,false);
  const scope=profile(id,{placement:'held',manipulatorId:'arm',accessories:['csc-scope-5']});assert.ok(scope.traits.includes('Scope'));assert.equal(scope.accessoryEffects[0].active,true);
  const tracker=profile(id,{accessories:['csc-intelligent-0','csc-smart-tracker']});assert.equal(tracker.accessoryEffects[0].robotBrainBandwidthGranted,0);assert.equal(tracker.accessoryEffects[1].requiresSuccessfulHit,true);assert.ok(has(direct(id,{accessories:['csc-smart-tracker']}),'CSC_TRACKER_COMPUTER'));assert.ok(has(direct(id,{accessories:['csc-laser-sight-8','csc-scope-5']}),'CSC_SIGHT_LIMIT'));
 }
});
test('CSC launcher/payload integration: roundtrips, metadata rejection and detached catalogue/API/evaluation',()=>{
 for(const w of all){const d=design(w.id);assert.deepEqual(importDesign(exportDesign(d)),d);for(const patch of [{sourceDamage:'9D'},{damage:'9D'},{sourceFamily:'core-2022'},{conditionalEffects:{}},{magazineCost:0},{directPayload:false}]){const x=structuredClone(d);Object.assign(x.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(x)),TypeError);}}
 const id=payload('chemical').id,d=design(id),before=structuredClone(payload('chemical'));
 const choices=getCatalogue(d).stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices;choices.find(w=>w.id===id).conditionalEffects.poison.check.target=99;
 weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id===id).conditionalEffects.cloud.duration='forever';
 const p=profile(id);p.conditionalEffects.poison.check.target=99;p.conditionalEffects.delivery.source.pages='bad';p.traits.push('AP 99');assert.deepEqual(payload('chemical'),before);assert.deepEqual(profile(id).conditionalEffects,before.conditionalEffects);
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));api.getView().evaluation.totals.weapons[0].conditionalEffects.poison.resolved=true;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.poison.resolved,false);
});
