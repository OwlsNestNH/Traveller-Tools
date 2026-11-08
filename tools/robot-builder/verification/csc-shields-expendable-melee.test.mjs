import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_SHIELDS_EXPENDABLE_MELEE_WEAPONS as ROWS} from '../engine/csc-shields-expendable-melee-weapons.mjs';
import {WEAPONS,MOUNTS,FIRE_CONTROL,evaluateWeapons,weaponControl,weaponRecordPresentation} from '../engine/weapons.mjs';
import {estimateCscMagazineMass,cscMagazineVariants,cscMagazineSourceIds} from '../engine/csc-ammunition-storage.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
// Independent expected values from actual revised CSC pixels pp131-133,138-141.
const expected=[
 ['shield',0,'1D',2,150,[],'bludgeon',1,'131,140-141','140'],
 ['riot-shield',6,'1D',1.5,175,[],'bludgeon',1,'140-141','140'],
 ['boarding-shield',9,'1D',5,1500,['Bulky'],'bludgeon',1,'140','140'],
 ['anti-armour-flail',8,'4D',3,250,['AP 5','One Use'],'bludgeon',1,'131-133','133'],
 ['garrotte',0,null,null,10,[],'unarmed',2,'131,138-139','139']
];
const raw=id=>ROWS.find(w=>w.id==='csc-'+id);
const record=(id,patch={})=>({id:'bounded',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const arms=[{id:'base-1',kind:'base',size:5,strength:6,dexterity:8},{id:'base-2',kind:'base',size:5,strength:15,dexterity:12}];
const direct=(id,patch={},options={})=>evaluateWeapons({kind:'standard',techLevel:options.tl??16,selections:{physical:{weapons:[record(id,patch)]}}},options.arms??arms,options.skills??[]);
const design=(id,patch={})=>updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const review=(d,e=evaluateDesign(d))=>projectReview(d,getCatalogue(d),e);
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const noErrors=r=>assert.deepEqual(r.diagnostics.filter(d=>['error','blocker'].includes(d.severity)),[]);
const copy=(patch={})=>({copyIndex:2,initialMagazines:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none',...patch});
for(const [id,tl,damage,mass,cost,traits,speciality,hands,pages,tablePage]of expected){
 test('bounded source identity, mass and handedness: '+id,()=>{
  const w=raw(id);assert.deepEqual([w.tl,w.damage,w.massKg,w.cost,w.traits,w.speciality,w.range],[tl,damage,mass,cost,traits,speciality,'Melee']);
  assert.equal(w.source.pages,pages);assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');assert.equal(w.sourceMeasurements.source.pages,tablePage);
  assert.equal(w.sourceMeasurements.mass.value,mass);assert.equal(w.sourceBaseProfile.damage,id==='garrotte'?'2D':damage);assert.deepEqual(w.sourceBaseProfile.traits,traits);
  assert.deepEqual([w.handedness.hands,w.handedness.explicitPrintedHandCount,w.handedness.exclusiveConfiguration,w.mountClass,w.requiresTwoHands],[hands,false,false,hands===2?'medium':'small',hands===2]);assert.equal(w.handedness.mountSource.pages,'61');
  assert.equal(w.poweredMelee,undefined);assert.equal(w.powerOperation,undefined);assert.equal(w.directPayload,undefined);assert.equal(w.skill,'melee');assert.equal(w.weaponFamily,'melee');assert.equal(w.sourceFamily,'csc-2023');
  assert.equal(estimateCscMagazineMass(w),null);assert.equal(cscMagazineVariants(w),null);assert.deepEqual(cscMagazineSourceIds(w),[]);assert.equal(w.compatibility.robotPowerConnection,false);
 });
 test('bounded purchase, TL, linked FCS and mount arithmetic: '+id,()=>{
  const mount=MOUNTS[raw(id).mountClass];
  for(const n of [1,2,4])for(const fcs of FIRE_CONTROL){const r=direct(id,{linkedWeapons:n,fireControl:fcs.id}),w=r.weapons[0];noErrors(r);
   assert.equal(w.cost,(cost+mount.cost)*n+fcs.cost);assert.equal(w.slots,mount.slots*n+(fcs.id==='none'?0:1));assert.equal(w.damage,damage);assert.equal(w.linkedDamageBonus,['garrotte','anti-armour-flail'].includes(id)?null:n-1);assert.equal(w.attackModifier,null);assert.deepEqual(w.sourceBaseProfile,raw(id).sourceBaseProfile);assert.equal(w.ammunitionInventory.totalCost,0);
   assert.equal(w.initialAmmunition.status,id==='anti-armour-flail'?'complete-expendable-weapon':'not-applicable');assert.equal(w.initialAmmunition.count,id==='anti-armour-flail'?null:0);
  }
  for(const level of [tl-1,tl,23])assert.equal(has(direct(id,{}, {tl:level}),'WEAPON_TL'),level<tl);
  for(const size of [mount.armSize-1,mount.armSize])assert.equal(has(direct(id,{placement:'arm',manipulatorId:'base-1'},{arms:arms.map(a=>({...a,size}))}),'WEAPON_ARM_SIZE'),size<mount.armSize);
  assert.equal(evaluateDesign(design(id)).status,'verified');
 });
 test('bounded qualified grips and software: '+id,()=>{
  const patch={placement:'held',manipulatorId:'base-1',...(hands===2?{supportManipulatorId:'base-2'}:{})},r=direct(id,patch,{arms:arms.map(a=>({...a,size:1}))}),w=r.weapons[0];noErrors(r);
  assert.equal(w.cost,cost);assert.equal(w.slots,0);assert.equal(w.gripAssignmentStatus,'assigned');assert.equal(w.multiArm,hands===2);assert.equal(w.baseAttackModifier,hands===2?null:-3);assert.equal(w.additionalAttacksGranted,false);
  if(hands===2)for(const [support,code]of [['none','HELD_SUPPORT_REQUIRED'],['missing','HELD_SUPPORT_REQUIRED'],['base-1','HELD_GRIPS_MUST_DIFFER']])assert.ok(has(direct(id,{...patch,supportManipulatorId:support}),code));
  else assert.ok(has(direct(id,{...patch,supportManipulatorId:'base-2'}),'HELD_SUPPORT_UNSUPPORTED'));
  for(const skill of ['unarmed','blade','bludgeon','whip'])assert.equal(direct(id,{}, {skills:[{id:'melee:'+skill,level:2}]}).weapons[0].softwareLevel,skill===speciality?2:-3);
  assert.equal(direct(id).weapons[0].softwareLevel,-3);
  if(id==='boarding-shield'){assert.equal(w.heldStrengthRequirement.minimumStrength,9);assert.equal(w.heldStrengthRequirement.constructionBan,false);assert.equal(w.heldStrengthRequirement.penaltyResolved,false);}
 });
 test('bounded supply controls retain correction without fictional supply facts: '+id,()=>{
  const defaults=weaponRecordPresentation(record(id));for(const key of ['initialMagazines','extraMagazines','autoload','autoloadAllocation'])assert.equal(defaults.fields[key].visible,false);assert.equal(defaults.ammunitionCustomization,null);
  for(const [patch,code]of [[{extraMagazines:1},id==='anti-armour-flail'?'EXPENDABLE_MELEE_SUPPLY_UNAVAILABLE':'WEAPON_AMMO_INAPPLICABLE'],[{initialMagazines:0},id==='anti-armour-flail'?'EXPENDABLE_MELEE_INITIAL_SELECTION':'WEAPON_AMMO_INAPPLICABLE'],[{autoload:true},'AUTOLOADER_AMMUNITION'],[{initialMagazineType:'high-capacity'},'CSC_HIGH_CAPACITY_UNSUPPORTED'],[{extraHighCapacityMagazines:1},'CSC_HIGH_CAPACITY_UNSUPPORTED'],[{initialMagazineSourceId:'csc-arl-standard'},'MAGAZINE_SOURCE_INCOMPATIBLE'],[{alternateMagazineSupplies:[{sourceWeaponId:'csc-arl-standard',variant:'standard',extraMagazines:1,autoloadMagazines:0,storageId:'none'}]},'MAGAZINE_SOURCE_INCOMPATIBLE'],[{ammunition:'frag'},'CSC_AMMUNITION_UNSUPPORTED'],[{auxiliaryLauncher:'attached'},'CSC_LAUNCHERS_UNSUPPORTED'],[{looseGrenades:1},'CSC_LAUNCHERS_UNSUPPORTED']]){
   const d=design(id,patch),json=exportDesign(d),r=evaluateDesign(importDesign(json));assert.ok(has(r,code),id+': '+code);assert.notEqual(r.status,'verified');assert.equal(exportDesign(importDesign(json)),json);
   const text=formatStatblock(review(d,r));assert.doesNotMatch(text,/Initial Ammunition:|Ammunition Inventory:|Initial Magazines:|Ammunition: standard/);if(id==='anti-armour-flail'){assert.match(text,/Acquisition: One complete weapon/);assert.doesNotMatch(text,/Ammunition: Not applicable/);}
  }
  for(const [field,value]of [['initialMagazines',0],['extraMagazines',1],['autoload',true],['autoloadAllocation',{standard:0,highCapacity:0}]])assert.equal(weaponRecordPresentation(record(id,{[field]:value})).fields[field].visible,true);
 });
 test('bounded API/JSON and detached source facts: '+id,()=>{
  const d=design(id),json=exportDesign(d),api=createRobotApi();api.importDesign(json);const r=api.getView();assert.equal(r.evaluation.status,'verified');assert.deepEqual(importDesign(json),d);
  const before=structuredClone(raw(id));r.evaluation.totals.weapons[0].sourceBaseProfile.damage='99D';r.evaluation.totals.weapons[0].conditionalEffects.skillGranted=true;r.evaluation.totals.weapons[0].sourceMeasurements.mass.value=0;
  const catalogue=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-'+id);catalogue.sourceBaseProfile.traits.push('AP 99');catalogue.source.pages='bad';
  assert.deepEqual(api.getView().evaluation.totals.weapons[0].sourceBaseProfile,before.sourceBaseProfile);assert.deepEqual(raw(id),before);assert.equal(exportDesign(d),json);
  const e={...evaluateDesign(d),totals:null},text=formatStatblock(review(d,e));assert.match(text,/Range: Melee/);assert.doesNotMatch(text,/Initial Ammunition:|Ammunition Inventory:/);
  if(id==='garrotte'){assert.match(text,/Conditional damage/);assert.match(text,/2D \+ opposed Melee Effect; conditional/);assert.match(text,/Source mass: Unspecified \(printed dash\)/);}
  if(id==='anti-armour-flail'){assert.match(text,/Single use/);assert.match(text,/One complete weapon/);assert.doesNotMatch(text,/Ammunition: Not applicable/);}
 });
 test('bounded component and cyberlimb scopes: '+id,()=>{
  const child=design(id,{linkedWeapons:2}),parent=updateDesign(createDesign({kind:'ship-brain',techLevel:16}),{special:{designReferences:[{id:'robot',role:'installed-robot',quantity:1,design:child}]}}),r=evaluateDesign(parent);assert.equal(r.status,'verified');
  const w=r.composite.components[0].profile.weapons[0];assert.deepEqual(w.sourceBaseProfile,raw(id).sourceBaseProfile);assert.deepEqual(w.conditionalEffects,raw(id).conditionalEffects);assert.equal(w.massKg,mass);
  const {manipulatorId,...limbWeapon}=record(id,{placement:'arm'}),d=updateDesign(createDesign({kind:'cyborg',techLevel:16}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:2}}],augmentWeapons:[{...limbWeapon,parentLimb:'limb'}]}}),e=evaluateDesign(d);assert.equal(e.status,'verified');const lw=e.totals.augmentations[0].weapons[0];assert.equal(lw.copies,2);assert.equal(lw.softwareLevel,null);assert.equal(lw.baseAttackModifier,null);assert.equal(lw.massKg,mass);assert.equal(lw.cost,cost+MOUNTS[raw(id).mountClass].cost);assert.deepEqual(lw.sourceBaseProfile,raw(id).sourceBaseProfile);
  assert.equal(lw.conditionalEffects.bodyMountedDefenceGranted,false);assert.doesNotMatch(formatStatblock(review(d)),/Initial Ammunition:|Ammunition Inventory:/);
  lw.sourceBaseProfile.damage='99D';assert.deepEqual(evaluateDesign(d).totals.augmentations[0].weapons[0].sourceBaseProfile,raw(id).sourceBaseProfile);
 });
}
test('distinct Core Shield and CSC Buckler remain unchanged; excluded rows do not appear',()=>{
 const core=WEAPONS.find(w=>w.id==='shield'),buckler=WEAPONS.find(w=>w.id==='csc-buckler');assert.deepEqual([core.tl,core.cost,core.damage],[1,150,'1D']);assert.deepEqual([buckler.tl,buckler.cost,buckler.massKg],[1,10,1]);assert.equal(buckler.conditionalEffects.parry.requiresMeleeSkill,true);assert.equal(buckler.conditionalEffects.parry.unskilledEffectiveMelee,null);
 assert.equal(new Set(WEAPONS.map(w=>w.id)).size,WEAPONS.length);for(const id of ['large-shield','expandable-shield','gravitic-shield','monofilament-garrotte','claw-glove','piston-fist'])assert.equal(WEAPONS.some(w=>w.id==='csc-'+id),false);
});
test('standard shield parry and riot directional protection are conditional and never armour/software',()=>{
 for(const id of ['shield','riot-shield']){const p=raw(id).conditionalEffects.parry;assert.deepEqual([p.effectiveMeleeBonus,p.unskilledEffectiveMelee,p.attackBonus,p.protectionGranted,p.automaticBonusApplied,p.permanentSkillBonusGranted],[1,0,0,0,false,false]);assert.equal(p.requiresHeld,true);}
 const riot=raw('riot-shield').conditionalEffects;assert.equal(riot.rangedProtection.protection,1);assert.equal(riot.rangedProtection.attackType,'ranged');assert.equal(riot.rangedProtection.universalArmour,false);assert.equal(riot.fireTraitImmunity.trait,'Fire');assert.equal(riot.fireTraitImmunity.attackDirection,'front');assert.equal(riot.fireTraitImmunity.environmentalImmunity,false);
 const base=evaluateDesign(updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'}}}));for(const id of ['shield','riot-shield','boarding-shield']){const r=evaluateDesign(design(id));assert.deepEqual(r.totals.armour,base.totals.armour);assert.equal(r.totals.weapons[0].softwareLevel,-3);}
});
test('boarding cover is not parry or a robot-size guarantee',()=>{
 const c=raw('boarding-shield').conditionalEffects;assert.equal(c.parry.permitted,false);assert.equal(c.parry.effectiveMeleeBonus,0);assert.equal(c.cover.protection,8);assert.equal(c.cover.sourceSupportedPeople,2);assert.equal(c.cover.maximumPeople,undefined);assert.equal(c.cover.movementWhileCoveredPermitted,true);assert.equal(c.cover.geometryResolved,false);assert.equal(c.cover.robotSizeFitResolved,false);assert.equal(c.cover.automaticProtectionApplied,false);
 const view=review(design('boarding-shield')),text=formatStatblock(view);assert.match(JSON.stringify(view),/Source Supported People: 2/);assert.match(text,/Source Supported People: 2/);assert.doesNotMatch(JSON.stringify(view),/Maximum People|maximumPeople/);assert.doesNotMatch(text,/Maximum People|maximumPeople/);
});
test('TL0 breakage requires manufacturing TL and attack Effect without parry inference',()=>{
 for(const id of ['shield','garrotte'])for(const tl of [0,8,16,23]){const c=direct(id,{}, {tl}).weapons[0].conditionalEffects.tl0Breakage;assert.equal(c.maximumAttackEffect,-3);assert.equal(c.manufacturingTechLevel,null);assert.equal(c.inferFromRobotTechLevel,false);assert.equal(c.inferFromCatalogueTechLevel,false);assert.equal(c.requiredManufacturingTechLevel,0);assert.equal(c.appliesAutomaticallyToParry,false);assert.equal(c.automaticBreakageApplied,false);}
 for(const id of ['riot-shield','boarding-shield','anti-armour-flail'])assert.equal(raw(id).conditionalEffects.tl0Breakage,undefined);
});
test('Flail is complete expendable acquisition, not reusable supplies or direct payload',()=>{
 const w=raw('anti-armour-flail'),a=w.acquisition,o=w.conditionalEffects.oneUse;assert.deepEqual([a.kind,a.completeWeaponsPerPurchase,a.unitCost,a.reusableHardware,a.separateWarheadPurchase],['complete-expendable-weapon',1,250,false,false]);assert.equal(o.weaponUselessAfterUse,true);assert.equal(o.reusableShaft,false);assert.equal(o.reloadSupported,false);assert.equal(o.restoredWeapon,false);assert.equal(o.currentUseState,undefined);assert.equal(o.presetDelay.triggerState,undefined);assert.equal(o.presetDelay.selectedRounds,undefined);assert.deepEqual(o.presetDelay,{minimumRounds:1,maximumRounds:12,resolved:false,simulated:false,detonationResolved:false});
 for(const n of [1,2,4]){const r=direct('anti-armour-flail',{linkedWeapons:n});assert.equal(r.weapons[0].linkedDamageBonus,null);assert.equal(r.weapons[0].linkedOperation.combinedDetonation,null);assert.equal(r.weapons[0].initialAmmunition.count,null);assert.equal(r.weapons[0].ammunitionInventory.totalRounds,null);assert.equal(r.weapons[0].sourceBaseProfile.damage,'4D');assert.equal(r.weapons[0].associatedAttacks.length,0);}
 assert.ok(has(direct('anti-armour-flail',{autoloadAllocation:{standard:0,highCapacity:0}}),'EXPENDABLE_MELEE_ALLOCATION'));
 for(const c of [copy(),copy({extraMagazines:1}),copy({initialMagazines:0})]){const r=direct('anti-armour-flail',{linkedWeapons:2,ammunitionOverrides:[c]});assert.ok(has(r,'EXPENDABLE_MELEE_COPY_SUPPLY'));assert.equal(r.weapons[0].initialAmmunition.status,'complete-expendable-weapon');assert.equal(r.weapons[0].initialAmmunition.count,null);assert.equal(r.weapons[0].ammunitionInventory.status,'complete-expendable-weapon');assert.equal(r.weapons[0].ammunitionInventory.totalRounds,null);assert.notEqual(weaponRecordPresentation(record('anti-armour-flail',{linkedWeapons:2,ammunitionOverrides:[c]})).ammunitionCustomization,null);}
});
test('Garrotte keeps typed source formula, unknown mass, and unresolved grapple/linked state',()=>{
 const w=raw('garrotte'),a=w.attackProfiles;assert.equal(w.massKg,null);assert.equal(w.sourceMeasurements.mass.status,'unspecified');assert.equal(w.sourceMeasurements.mass.printedValue,'dash');assert.equal(w.damage,null);assert.equal(w.sourceBaseProfile.damage,'2D');assert.equal(a.kind,'grapple-condition');assert.equal(a.condition.requiresSuccessfulGrapple,true);assert.equal(a.condition.requiresDamagingGrapple,true);assert.equal(a.condition.opposedMeleeEffect,null);assert.equal(a.condition.consecutiveSuccessfulRounds,null);assert.equal(a.condition.automaticGrapple,false);assert.deepEqual(a.profiles[0].formula,{baseDamage:'2D',addOpposedMeleeEffect:true,additionalDicePerConsecutiveSuccess:1,consecutiveSuccesses:null});
 const text=formatStatblock(review(design('garrotte')));assert.match(text,/Conditional damage/);assert.match(text,/2D \+ opposed Melee Effect/);assert.match(text,/\+1D each; unresolved/);assert.match(text,/Source mass: Unspecified/);assert.doesNotMatch(text,/Garrotte \(CSC 2023\): 2D damage|1D damage|Range: \d+|Source weapon mass \(kg\): 0/);
 const misc=getCatalogue(createDesign({kind:'cyborg',techLevel:16})).stages.flatMap(s=>s.controls).find(c=>c.field==='augmentations');assert.ok(!JSON.stringify(misc).includes('csc-garrotte'));
});

test('saved construction rejects forged source rules and operational state',()=>{
 for(const id of ['shield','anti-armour-flail','garrotte'])for(const [key,value]of [['acquisition',{unitCost:0}],['sourceBaseProfile',{damage:'99D'}],['manufacturingTechLevel',0],['triggerState','ready'],['grappleSuccess',true],['attackProfiles',{resolved:true}]]){const d=design(id);d.selections.physical.weapons[0][key]=value;assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);}
});
