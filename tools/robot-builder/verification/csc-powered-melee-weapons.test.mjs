import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_POWERED_MELEE_WEAPONS} from '../engine/csc-powered-melee-weapons.mjs';
import {WEAPONS,MOUNTS,FIRE_CONTROL,evaluateWeapons,weaponControl,weaponRecordPresentation} from '../engine/weapons.mjs';
import {estimateCscMagazineMass,cscMagazineVariants,cscMagazineSourceIds} from '../engine/csc-ammunition-storage.mjs';
import {PACKAGES} from '../engine/catalogue.mjs';
import {SPECIALITIES,SOURCE_SPECIALITIES} from '../engine/skills-data.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {presentationFacts,diagnosticLabel} from '../js/rules-presentation.mjs';
// Independent audit of revised CSC copyright 2026. Table values pp133/135/141.
// Illustrated hand configurations pp133/136/137/141 are qualified, not printed counts.
const expected=[
 ['gravity-hammer','Gravity Hammer',13,'5D',5,10000,['AP 50','Bulky','Smasher'],'bludgeon',2,'132-133','133','133'],
 ['static-maul','Static Maul',11,'3D',3,650,['AP 4','Bulky','Smasher'],'bludgeon',2,'133-134','133','133'],
 ['stunstick','Stunstick',8,'2D',.5,300,['Stun'],'bludgeon',1,'133-134','133','133'],
 ['arc-field-weapon','Arc-Field Weapon',14,'5D+2',4,25000,['AP 30'],'blade',1,'134-135,137','135','137'],
 ['chaindrive-axe','Chaindrive Axe',10,'4D',6,600,['AP 4','Bulky'],'blade',2,'134-136','135','136'],
 ['chaindrive-sword','Chaindrive Sword',10,'4D',4,500,['AP 2'],'blade',1,'134-136','135','136'],
 ['static-axe-11','Static Axe (TL11)',11,'4D',5,750,['AP 6','Bulky','Smasher'],'blade',2,'135-137','135','136'],
 ['static-axe-12','Static Axe (TL12)',12,'4D+2',4,1000,['AP 8','Smasher'],'blade',2,'135-137','135','136'],
 ['static-blade-11','Static Blade (TL11)',11,'3D',3,700,['AP 5'],'blade',1,'135,137','135','137'],
 ['static-blade-12','Static Blade (TL12)',12,'3D+2',2,900,['AP 6'],'blade',1,'135,137','135','137'],
 ['shock-whip','Shock Whip',9,'2D',1,450,['Stun'],'whip',1,'141','141','141']
];
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const raw=id=>CSC_POWERED_MELEE_WEAPONS.find(w=>w.id==='csc-'+id);
const record=(id,patch={})=>({id:'powered-melee',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const arms=[{id:'base-1',kind:'base',size:5,strength:9,dexterity:8},{id:'base-2',kind:'base',size:5,strength:15,dexterity:12},{id:'third',kind:'additional',size:5,strength:19,dexterity:15}];
const direct=(id,patch={},options={})=>evaluateWeapons({kind:'standard',techLevel:options.techLevel??16,selections:{physical:{weapons:[record(id,patch)]}}},options.arms??arms,options.skills??[],options.equipment??[],options.host??{});
const design=(id,patch={})=>updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const copy=(patch={})=>({copyIndex:2,initialMagazines:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none',...patch});
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);
const noErrors=result=>assert.deepEqual(result.diagnostics.filter(d=>['error','blocker'].includes(d.severity)),[]);
const total=r=>r.totals??r.previewTotals;
const review=d=>projectReview(d,getCatalogue(d),evaluateDesign(d));
const selected=d=>getCatalogue(d).stages.find(s=>s.id==='physical').controls.find(c=>c.field==='weapons');
const model=d=>review(d).sections.find(s=>s.id==='weapons').rows[0];

test('eleven powered melee identities remain separate from unpowered and Core profiles',()=>{
 assert.deepEqual(CSC_POWERED_MELEE_WEAPONS.map(w=>w.id),expected.map(row=>'csc-'+row[0]));
 assert.equal(WEAPONS.filter(w=>w.poweredMelee).length,11);assert.equal(new Set(WEAPONS.map(w=>w.id)).size,WEAPONS.length);
 const core=WEAPONS.find(w=>w.id==='stunstick');assert.deepEqual([core.tl,core.damage,core.cost,core.magazine,core.magazineCost,core.initialIncluded,core.sourceFamily],[8,'2D',300,null,0,true,'core-2022']);assert.equal(core.poweredMelee,undefined);assert.equal(core.powerOperation,undefined);
 assert.deepEqual(WEAPONS.find(w=>w.id==='csc-blade').ammunitionAccounting.initialMagazine,'not-applicable');
});
for(const [id,name,tl,damage,mass,cost,traits,speciality,hands,pages,tablePage,handPage] of expected){
 test(`powered source: ${name} exact statistics, source, qualified configuration`,()=>{
  const w=raw(id);assert.deepEqual([w.label,w.tl,w.damage,w.massKg,w.cost,w.traits,w.speciality],[name+' (CSC 2023)',tl,damage,mass,cost,traits,speciality]);
  assert.deepEqual([w.range,w.skill,w.weaponFamily,w.sourceFamily,w.poweredMelee,w.magazine,w.magazineCost,w.initialIncluded],['Melee','melee','melee','csc-2023',true,null,null,null]);
  assert.deepEqual(w.source,source(pages));assert.deepEqual(w.sourceMeasurements,{mass:{value:mass,unit:'kg'},source:source(tablePage)});
  assert.deepEqual(w.handedness,{hands,explicitPrintedHandCount:false,basis:'qualified-physical-interpretation',alternateTwoHandedUse:false,exclusiveConfiguration:false,source:source(handPage),mountSource:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'61'}});
  assert.equal(w.requiresTwoHands,hands===2);assert.equal(w.mountClass,hands===2?'medium':'small');
  assert.deepEqual([w.acquisition.kind,w.acquisition.includedReplaceablePack,w.powerOperation.supply.replacementPrice,w.powerOperation.supply.initialCharge],['complete-weapon-hardware',null,null,null]);
  assert.deepEqual([w.compatibility.robotPowerConnection,w.ammunitionAccounting.replacementPurchasesSupported,w.ammunitionAccounting.autoloadSupported],[false,false,false]);
  assert.equal(estimateCscMagazineMass(w),null);assert.equal(cscMagazineVariants(w),null);assert.deepEqual(cscMagazineSourceIds(w),[]);
  assert.equal(w.conditionalEffects.handling.exclusiveConfiguration,false);assert.equal(w.conditionalEffects.skillGranted,false);
 });
 test(`powered construction: ${name} hardware, four links, one FCS, TL and arm Size`,()=>{
  const mount=MOUNTS[hands===2?'medium':'small'],r=direct(id),w=r.weapons[0];noErrors(r);assert.equal(w.cost,cost+mount.cost);assert.equal(w.slots,mount.slots);
  assert.deepEqual([w.initialAmmunition.status,w.initialAmmunition.count,w.initialAmmunition.totalRounds,w.initialAmmunition.included,w.initialAmmunition.unitCost,w.initialAmmunition.purchaseCost],['hardware-only',null,null,null,null,0]);
  assert.equal(w.ammunitionInventory.totalRounds,null);assert.equal(w.ammunitionInventory.status,'hardware-only');assert.equal(w.ammunitionInventory.totalCost,0);assert.deepEqual(r.ammunitionStorage,[]);
  const fcs=FIRE_CONTROL.find(f=>f.id==='basic'),linked=direct(id,{linkedWeapons:4,fireControl:'basic'});noErrors(linked);assert.equal(linked.weapons[0].cost,4*(cost+mount.cost)+fcs.cost);assert.equal(linked.weapons[0].slots,4*mount.slots+1);assert.equal(linked.ledger.length,1);assert.equal(linked.weapons[0].initialAmmunition.count,null);
  assert.ok(has(direct(id,{}, {techLevel:tl-1}),'WEAPON_TL'));assert.equal(has(direct(id,{}, {techLevel:tl}),'WEAPON_TL'),false);
  for(const size of [mount.armSize-1,mount.armSize])assert.equal(has(direct(id,{placement:'arm',manipulatorId:'base-1'},{arms:arms.map(a=>({...a,size}))}),'WEAPON_ARM_SIZE'),size<mount.armSize);
  const trained=direct(id,{}, {skills:[{id:'melee:'+speciality,level:2}]}).weapons[0];assert.equal(trained.softwareLevel,2);assert.equal(trained.baseAttackModifier,2);assert.equal(trained.attackModifier,null);
  const d=design(id),e=evaluateDesign(d);assert.equal(e.status,'verified');assert.deepEqual(importDesign(exportDesign(d)),d);assert.equal(e.totals.weapons[0].cost,cost+mount.cost);
 });
 test(`powered held: ${name} distinct grips and configuration, no duplicated purchase`,()=>{
  const held={placement:'held',manipulatorId:'base-1',...(hands===2?{supportManipulatorId:'base-2'}:{})},r=direct(id,held),w=r.weapons[0];noErrors(r);assert.equal(w.cost,cost);assert.equal(w.slots,0);assert.equal(w.gripAssignmentStatus,'assigned');assert.equal(w.multiArm,hands===2);assert.equal(w.handednessBasis.explicitPrintedHandCount,false);assert.equal(w.handednessBasis.optionalSecondGrip,false);
  assert.deepEqual(w.gripManipulatorIds,hands===2?['base-1','base-2']:['base-1']);
  if(hands===2){assert.ok(has(direct(id,{...held,supportManipulatorId:'none'}),'HELD_SUPPORT_REQUIRED'));assert.ok(has(direct(id,{...held,supportManipulatorId:'base-1'}),'HELD_GRIPS_MUST_DIFFER'));assert.equal(w.effectiveStrength,null);assert.equal(w.baseAttackModifier,null);}
  else assert.ok(has(direct(id,{...held,supportManipulatorId:'base-2'}),'HELD_SUPPORT_UNSUPPORTED'));
  const text=formatStatblock(review(design(id,held)));assert.match(text,/Complete weapon hardware; initial charge unspecified/);assert.match(text,/(One|Two)-hand physical interpretation; printed hand count unstated/);assert.doesNotMatch(text,/Included: Yes|Ammunition: Not applicable|Initial Magazines|Ammunition totals|Initial magazine per weapon/);
 });
 test(`powered editor: ${name} hides defaults and retains correction fields`,()=>{
  const r=record(id),p=weaponRecordPresentation(r);for(const field of ['initialMagazines','extraMagazines','autoload','autoloadAllocation'])assert.equal(p.fields[field].visible,false);assert.equal(p.ammunitionCustomization,null);
  const retained=weaponRecordPresentation({...r,initialMagazines:0,extraMagazines:1,autoload:true,autoloadAllocation:{standard:1,highCapacity:0}});for(const field of ['initialMagazines','extraMagazines','autoload','autoloadAllocation'])assert.equal(retained.fields[field].visible,true);
  const copyRecord={...r,linkedWeapons:2,ammunitionOverrides:[copy({initialMagazines:0})]},cp=weaponRecordPresentation(copyRecord,2);assert.equal(cp.fields.initialMagazines.visible,true);assert.ok(cp.ammunitionCustomization.forceGroupOpen);assert.equal(cp.ammunitionCustomization.materializedValue.initialMagazines,0);
  const zero=direct(id,{initialMagazines:0});assert.ok(has(zero,'POWERED_MELEE_INITIAL_SELECTION'));assert.equal(has(zero,'INCLUDED_POWER_PACK'),false);assert.equal(zero.weapons[0].initialAmmunition.count,null);assert.equal(zero.weapons[0].cost,cost+MOUNTS[raw(id).mountClass].cost);
 });
}
test('printed endurance and recharge survive robot endurance changes and linked copies',()=>{
 for(const id of ['arc-field-weapon','chaindrive-axe','chaindrive-sword','static-axe-11','static-axe-12','static-blade-11','static-blade-12'])for(const n of [1,4])for(const hours of [null,0,48,144,999]){
  const p=direct(id,{linkedWeapons:n},{host:{hours,reference:'robot-endurance'}}).weapons[0].powerOperation,arc=id==='arc-field-weapon',chain=id.startsWith('chain');
  assert.equal(p.endurance.basis,'printed-source');assert.equal(p.endurance.duration,arc?'2D hours':'30 minutes');assert.equal(p.endurance.minutes,arc?null:30);assert.equal(p.endurance.hours,null);assert.equal(p.endurance.pooledAcrossCopies,false);assert.equal(p.endurance.source.pages,arc||chain?'134':'137');assert.equal(p.recharge.duration,arc?'1D x 10 minutes':null);assert.equal(p.supply.replacementPrice,null);assert.equal(p.directRobotPowerHardwarePurchased,false);
 }
});
test('printed operating qualifiers reach the exact review and printable power-endurance rows',()=>{
 for(const [id,duration,recharge]of [['arc-field-weapon','2D hours · Printed duration · Powered use','1D x 10 minutes'],['chaindrive-axe','30 minutes · Printed duration · Combat/intimidation use only','Recharge duration unstated'],['chaindrive-sword','30 minutes · Printed duration · Combat/intimidation use only','Recharge duration unstated'],['static-axe-11','30 minutes · Printed duration · Combat/cutting use only','Recharge duration unstated'],['static-axe-12','30 minutes · Printed duration · Combat/cutting use only','Recharge duration unstated'],['static-blade-11','30 minutes · Printed duration · Combat/cutting use only','Recharge duration unstated'],['static-blade-12','30 minutes · Printed duration · Combat/cutting use only','Recharge duration unstated']]){
  const d=design(id),r=model(d);assert.equal(r.details.find(row=>row.label==='Power endurance').value,duration);assert.equal(r.details.find(row=>row.label==='Recharge').value,recharge);assert.ok(formatStatblock(review(d)).includes(duration));
 }
});
test('unprinted endurance follows actual robot power state by user ruling, never multiplied or pooled',()=>{
 for(const id of ['gravity-hammer','static-maul','stunstick','shock-whip'])for(const n of [1,4])for(const physical of [{},{efficiency:true},{powerPacks:2},{efficiency:true,powerPacks:2},{powerMode:'direct-connection'}]){
  const d=updateDesign(design(id,{linkedWeapons:n}),{selections:{physical}}),r=evaluateDesign(d);assert.equal(r.status,'verified');const p=r.totals.weapons[0].powerOperation;
  assert.equal(p.endurance.basis,'user-referee-ruling');assert.equal(p.endurance.hours,r.totals.endurance);assert.equal(p.endurance.reference,'robot-endurance');assert.equal(p.endurance.duration,null);assert.equal(p.endurance.printedEnduranceSpecified,false);assert.equal(p.endurance.pooledAcrossCopies,false);assert.equal(p.endurance.source.title,'User/referee ruling');assert.deepEqual(p.endurance.hostPowerState,r.totals.powerState);assert.equal(p.recharge.duration,null);
  const text=formatStatblock(review(d));assert.match(text,/Robot endurance · User\/referee ruling/);assert.equal(text.includes('Host endurance unresolved'),r.totals.endurance===null);assert.doesNotMatch(text,/unlimited/i);
 }
 for(const hours of [null,undefined,NaN,Infinity])assert.equal(direct('gravity-hammer',{}, {host:{hours}}).weapons[0].powerOperation.endurance.hours,null);
 assert.equal(direct('gravity-hammer',{}, {host:{hours:0}}).weapons[0].powerOperation.endurance.hours,0);
});
test('conditional source rules remain separate from unconditional attack, skills, family and traits',()=>{
 const gravity=direct('gravity-hammer',{}, {skills:[{id:'melee:bludgeon',level:2}]}).weapons[0];assert.equal(gravity.baseAttackModifier,2);assert.deepEqual(gravity.conditionalEffects.smallTarget,{attackDM:-6,condition:'Target is smaller than a vehicle',automaticModifierApplied:false,vehicleClassGranted:false,source:source('132')});assert.equal(gravity.mountClass,'medium');
 const arc=direct('arc-field-weapon').weapons[0];assert.deepEqual(arc.traits,['AP 30']);assert.equal(arc.conditionalEffects.smasher,undefined);assert.equal(arc.conditionalEffects.parryRestriction.lowerTechLevelWeaponMayParry,false);assert.equal(arc.conditionalEffects.parryRestriction.universalParryBan,false);assert.equal(arc.conditionalEffects.legalClassification.combatSkill,'Melee (blade)');assert.equal(arc.weaponFamily,'melee');assert.equal(arc.conditionalEffects.legalClassification.gunCombatAccessoriesGranted,false);
 assert.equal(raw('static-axe-12').traits.includes('Bulky'),false);
 for(const id of ['gravity-hammer','static-maul','static-axe-11','static-axe-12'])assert.deepEqual(raw(id).conditionalEffects.smasher.source,source('131'));
 const whip=direct('shock-whip',{}, {skills:[{id:'melee:blade',level:4},{id:'persuade',level:4}]}).weapons[0];assert.equal(whip.baseAttackModifier,-3);assert.equal(whip.softwareLevel,-3);assert.equal(whip.range,'Melee');assert.equal(whip.conditionalEffects.grapple,undefined);assert.deepEqual(whip.conditionalEffects.questioning,{modifier:1,skills:['Intimidate','Persuade'],condition:'Questioning with the Shock Whip',permanentSkillBonusGranted:false,generalSocialBonusGranted:false,automaticModifierApplied:false,source:source('141')});
 for(const [id,label]of [['gravity-hammer','Target smaller than vehicle only'],['arc-field-weapon','Parry restriction: lower-TL weapons only'],['shock-whip','Shock Whip: questioning only']])assert.ok(JSON.stringify(presentationFacts(raw(id).conditionalEffects)).includes(label));
});
test('Melee whip has separate source packages and hard-coded choice without changing Core broad costs',()=>{
 assert.deepEqual(SPECIALITIES.melee,['unarmed','blade','bludgeon','natural']);assert.deepEqual(SOURCE_SPECIALITIES.melee,[{id:'whip',source:source('141')}]);
 for(const level of [1,2,3]){const p=PACKAGES.find(p=>p.id==='melee-whip-'+level);assert.equal(p.speciality,'whip');assert.equal(p.cost,100*10**level);assert.equal(p.bandwidth,level);assert.deepEqual(p.specialtySource,source('141'));const broad=PACKAGES.find(p=>p.id==='melee-all-listed-'+level);assert.equal(broad.packageCount,4);assert.equal(broad.cost,4*100*10**level);assert.deepEqual(broad.coveredSpecialities,SPECIALITIES.melee);}
 const d=updateDesign(design('shock-whip'),{selections:{skills:{packages:['melee-whip-1']}}}),r=evaluateDesign(d);assert.equal(r.status,'verified');assert.equal(r.totals.weapons[0].softwareLevel,1);assert.equal(r.totals.skills.find(s=>s.id==='melee:whip').level,1);assert.equal(r.totals.skills.some(s=>s.id==='persuade'),false);
 const choice=getCatalogue(d).stages.find(s=>s.id==='skills').controls.find(c=>c.field==='coreWeapon').choices.find(c=>c.id==='melee:whip');assert.deepEqual(choice.specialtySource,source('141'));assert.deepEqual(importDesign(exportDesign(d)),d);
});
test('explicit Core broad coverage operates its purchased specialties but does not silently grant whip',()=>{
 const withPackages=packages=>updateDesign(design('shock-whip'),{techLevel:23,selections:{brain:{model:'very-advanced-tl14'},skills:{packages},physical:{weapons:[record('shock-whip'),record('blade',{id:'blade'})]}}});
 const broad=evaluateDesign(withPackages(['melee-all-listed-1']));assert.equal(broad.status,'verified');assert.deepEqual(broad.totals.skills.find(s=>s.id==='melee:all-listed').coveredSpecialities,['unarmed','blade','bludgeon','natural']);assert.equal(broad.totals.weapons.find(w=>w.weaponId==='csc-blade').softwareLevel,1);assert.equal(broad.totals.weapons.find(w=>w.weaponId==='csc-shock-whip').softwareLevel,0);
 for(const packages of [['melee-all-listed-1','melee-whip-1'],['melee-whip-1','melee-all-listed-1']]){
  const d=withPackages(packages),r=evaluateDesign(importDesign(exportDesign(d)));assert.equal(r.status,'verified');assert.equal(has(r,'DUPLICATE_SKILL'),false);assert.equal(r.totals.bandwidth.used,5);assert.equal(r.ledger.find(x=>x.id==='melee-all-listed-1').cost,4000);assert.equal(r.ledger.find(x=>x.id==='melee-whip-1').cost,1000);for(const w of r.totals.weapons)assert.equal(w.softwareLevel,1);
 }
 for(const packages of [['melee-all-listed-1','melee-blade-1'],['melee-blade-1','melee-all-listed-1'],['melee-all-listed-1','melee-all-referee-four-1']])assert.ok(has(evaluateDesign(withPackages(packages)),'DUPLICATE_SKILL'));
 const separate=evaluateDesign(withPackages(['melee-blade-1']));assert.equal(separate.totals.weapons[0].softwareLevel,0);
 broad.totals.skills.find(s=>s.id==='melee:all-listed').coveredSpecialities.push('whip');assert.equal(evaluateDesign(withPackages(['melee-all-listed-1'])).totals.weapons[0].softwareLevel,0);assert.equal(PACKAGES.find(p=>p.id==='melee-all-listed-1').coveredSpecialities.includes('whip'),false);
});
test('biological bodies retain unknown host endurance without borrowing a mechanical hour rating',()=>{
 const d=updateDesign(createDesign({kind:'biological',techLevel:16}),{special:{genomeLocomotion:'confirmed'},selections:{chassis:{size:'size-7'},physical:{weapons:[record('stunstick')]}}}),r=evaluateDesign(d);assert.equal(r.status,'verified');assert.equal(r.totals.endurance,null);assert.equal(r.totals.weapons[0].powerOperation.endurance.hours,null);assert.equal(r.totals.weapons[0].cost,800);assert.match(formatStatblock(review(d)),/Host endurance unresolved · Robot endurance · User\/referee ruling/);
});
const invalidSupplies=[
 [{extraMagazines:1},'POWERED_MELEE_SUPPLY_UNAVAILABLE'],[{autoload:true,extraMagazines:1},'POWERED_MELEE_SUPPLY_UNAVAILABLE'],[{autoload:true},'AUTOLOADER_AMMUNITION'],
 [{extraHighCapacityMagazines:1},'CSC_HIGH_CAPACITY_UNSUPPORTED'],[{initialMagazineType:'high-capacity'},'CSC_HIGH_CAPACITY_UNSUPPORTED'],[{initialMagazineSourceId:'csc-advanced-combat-rifle'},'MAGAZINE_SOURCE_INCOMPATIBLE'],
 [{spareMagazineStorageId:'instance:missing'},'SPARE_AMMO_STORAGE_UNSUPPORTED'],[{highCapacityMagazineStorageId:'instance:missing'},'SPARE_AMMO_STORAGE_UNSUPPORTED'],[{autoloadAllocation:{standard:0,highCapacity:0}},'POWERED_MELEE_ALLOCATION'],
 [{alternateMagazineSupplies:[{sourceWeaponId:'csc-advanced-combat-rifle',variant:'standard',extraMagazines:1,autoloadMagazines:0,storageId:'none'}]},'MAGAZINE_SOURCE_INCOMPATIBLE']
];
for(const [patch,code]of invalidSupplies)test('powered invalid supply stays repairable: '+Object.keys(patch).join('/'),()=>{
 const d=design('arc-field-weapon',patch),round=importDesign(exportDesign(d)),r=evaluateDesign(round);assert.ok(has(r,code));assert.deepEqual(round.selections.physical.weapons[0],d.selections.physical.weapons[0]);
 const directResult=direct('arc-field-weapon',patch);assert.equal(directResult.weapons[0].initialAmmunition.count,null);assert.equal(directResult.weapons[0].ammunitionInventory.totalRounds,null);assert.deepEqual(directResult.ammunitionStorage,[]);
 if(patch.extraMagazines||patch.extraHighCapacityMagazines||patch.autoload||patch.initialMagazineType||patch.initialMagazineSourceId||patch.alternateMagazineSupplies)assert.equal(directResult.weapons[0].cost,null);
 const repaired=updateDesign(round,{selections:{physical:{weapons:[record('arc-field-weapon')]}}});assert.equal(evaluateDesign(repaired).status,'verified');assert.equal(evaluateDesign(repaired).totals.weapons[0].cost,25500);
});
test('per-copy imports keep unknown supply accounting and correction paths separate',()=>{
 for(const [patch,code]of invalidSupplies.filter(([p])=>!Object.hasOwn(p,'autoload'))){
  const d=design('static-blade-12',{linkedWeapons:4,ammunitionOverrides:[copy(patch)]}),round=importDesign(exportDesign(d)),r=direct('static-blade-12',round.selections.physical.weapons[0]);assert.ok(has(r,code));assert.ok(r.diagnostics.find(x=>x.code===code).path.endsWith('ammunitionOverrides.2'));assert.equal(r.weapons[0].ammunitionCopies.length,4);assert.equal(r.weapons[0].initialAmmunition.status,'hardware-only');assert.equal(r.weapons[0].initialAmmunition.count,null);assert.equal(r.weapons[0].ammunitionCopies[0].initialAmmunition.count,null);assert.equal(r.weapons[0].ammunitionCopies[0].ammunitionInventory.totalCost,0);
  const repaired=updateDesign(round,{selections:{physical:{weapons:[record('static-blade-12',{linkedWeapons:4,ammunitionOverrides:[copy()]})]}}});assert.equal(evaluateDesign(repaired).status,'verified');assert.equal(evaluateDesign(repaired).totals.weapons[0].cost,5600);
 }
 const r=direct('stunstick',{linkedWeapons:1,ammunitionOverrides:[copy({extraMagazines:1})]});assert.ok(has(r,'AMMUNITION_COPY_NOT_INSTALLED'));assert.equal(r.weapons[0].cost,800);assert.equal(r.weapons[0].initialAmmunition.count,null);assert.equal(weaponRecordPresentation(record('stunstick',{ammunitionOverrides:[copy()]})).ammunitionCustomization.choices.find(c=>c.id===2).installed,false);
});
test('held powered weapon occupies both grips but arm-mounted hardware does not reserve a hand',()=>{
 const held=record('gravity-hammer',{placement:'held',manipulatorId:'base-1',supportManipulatorId:'base-2'});
 for(const placement of ['held','arm']){const r=evaluateWeapons({kind:'standard',techLevel:16,selections:{physical:{weapons:[held,record('stunstick',{id:'other',placement,manipulatorId:'base-2'})]}}},arms,[]);assert.equal(has(r,'HELD_GRIP_OCCUPIED'),placement==='held');assert.equal(r.weapons[0].cost,10000);assert.equal(r.weapons[1].cost,placement==='held'?300:800);}
});
test('accessories retain melee family despite powered technology or energy legal classification',()=>{
 const controls=weaponControl(design('arc-field-weapon')),accessories=controls.itemFields.find(i=>i.field==='accessories');
 const ids=accessories.choicesBy.values['csc-arc-field-weapon'].map(a=>a.id);assert.equal(ids.some(id=>/scope|laser-sight|holographic|suppressor/.test(id)),false);
 for(const id of ['arc-field-weapon','shock-whip'])assert.ok(direct(id,{accessories:['laser-sight-8']}).diagnostics.some(d=>d.severity==='error'));
});
test('powered projections preserve conditions, printed durations and unknown recipient robot endurance on cyberlimbs',()=>{
 for(const id of ['stunstick','arc-field-weapon','shock-whip']){
  const {manipulatorId,...limbWeapon}=record(id);
  const d=updateDesign(createDesign({kind:'cyborg',techLevel:16}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:2}}],augmentWeapons:[{...limbWeapon,parentLimb:'limb',placement:'arm'}]}});
  const r=evaluateDesign(importDesign(exportDesign(d)));assert.equal(r.status,'verified');const w=r.totals.augmentations[0].weapons[0];assert.equal(w.copies,2);assert.equal(w.softwareLevel,null);assert.equal(w.baseAttackModifier,null);assert.deepEqual(w.conditionalEffects,raw(id).conditionalEffects);assert.equal(w.powerOperation.endurance.hours,null);
  const text=formatStatblock(review(d));if(id==='arc-field-weapon'){assert.match(text,/2D hours/);assert.match(text,/Parry restriction: lower-TL weapons only/);}else{assert.equal(w.powerOperation.endurance.reference,'recipient-robot-endurance');assert.match(text,/Host endurance unresolved · Recipient robot endurance · User\/referee ruling/);}assert.doesNotMatch(text,/Included: Yes|Ammunition: Not applicable/);
 }
});
test('component snapshots use their own actual endurance rather than parent or quantity and remain detached',()=>{
 const child=updateDesign(design('gravity-hammer',{linkedWeapons:4}),{selections:{physical:{efficiency:true,powerPacks:1}}});
 const parent=updateDesign(createDesign({kind:'ship-brain',techLevel:16}),{special:{designReferences:[{id:'robot',role:'installed-robot',quantity:1,design:child}]}}),r=evaluateDesign(parent);assert.equal(r.status,'verified');const w=r.composite.components[0].profile.weapons[0];assert.equal(w.powerOperation.endurance.hours,evaluateDesign(child).totals.endurance);assert.equal(w.powerOperation.endurance.pooledAcrossCopies,false);assert.equal(w.initialAmmunition.count,null);
 const text=formatStatblock(review(parent));assert.match(text,/Target smaller than vehicle only/);assert.match(text,/Robot endurance · User\/referee ruling/);assert.match(text,/Complete weapon hardware; initial charge unspecified/);
 w.powerOperation.endurance.hours=999999;w.conditionalEffects.smallTarget.attackDM=99;assert.notEqual(evaluateDesign(parent).composite.components[0].profile.weapons[0].powerOperation.endurance.hours,999999);assert.equal(evaluateDesign(parent).composite.components[0].profile.weapons[0].conditionalEffects.smallTarget.attackDM,-6);
});
test('catalogue, engine and API return detached powered facts without allowing import overrides',()=>{
 const d=design('shock-whip'),cat=selected(d),choice=cat.itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-shock-whip');choice.powerOperation.supply.replacementPrice=0;choice.conditionalEffects.questioning.modifier=99;assert.equal(raw('shock-whip').powerOperation.supply.replacementPrice,null);assert.equal(selected(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-shock-whip').conditionalEffects.questioning.modifier,1);
 const e=evaluateDesign(d);e.totals.weapons[0].powerOperation.endurance.hours=999;assert.notEqual(evaluateDesign(d).totals.weapons[0].powerOperation.endurance.hours,999);
 for(const field of ['damage','traits','source','cost','powerOperation','poweredMelee','initialCharge']){const bad=structuredClone(d);bad.selections.physical.weapons[0][field]=field==='traits'?[]:0;assert.throws(()=>importDesign(JSON.stringify(bad)));}
 const api=createRobotApi();api.importDesign(exportDesign(d));const v=api.getView();assert.match(v.statblock,/Shock Whip: questioning only/);assert.match(v.statblock,/Robot endurance · User\/referee ruling/);v.evaluation.totals.weapons[0].conditionalEffects.questioning.modifier=99;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.questioning.modifier,1);
 assert.equal(diagnosticLabel(direct('stunstick',{initialMagazines:0}).diagnostics.find(d=>d.code==='POWERED_MELEE_INITIAL_SELECTION')),'Hardware-only acquisition; reset initial magazine selection');
});
