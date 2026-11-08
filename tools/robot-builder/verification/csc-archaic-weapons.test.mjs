import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_ARCHAIC_WEAPONS} from '../engine/csc-archaic-weapons.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,weaponControl,validateWeapons,evaluateWeapons} from '../engine/weapons.mjs';
import {CSC_WEAPON_ACCESSORIES,cscAccessoryEligibility} from '../engine/csc-weapon-accessories.mjs';
import {CSC_AMMUNITION_ESTIMATE_IDS,estimateCscMagazineMass} from '../engine/csc-ammunition-storage.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';

// Independent fixtures from the full CSC revised-printing p154 table and prose,
// p155 illustrations, p131 traits, pp174-178 accessory/ammunition restrictions,
// Core pp75,77,79 and RH pp60-61. No source pages are distributed.
const expected=[
 ['compound-cam-bow','Compound Cam Bow',5,100,'3D-3',1,250,1,5,['AP 2','Silent'],'arrow',.005],
 ['crossbow','Crossbow',1,100,'3D-3',3,200,1,1,['AP 2','Silent'],'bolt',.015],
 ['long-bow','Long Bow',1,100,'3D-3',1.5,150,1,1,['AP 2','Bulky','Silent'],'arrow',.0075],
 ['repeating-crossbow','Repeating Crossbow',2,75,'2D',4,400,6,6,['Silent'],'bolt',.12],
 ['short-bow','Short Bow',0,75,'2D-3',1,50,1,1,['Silent'],'arrow',.005]
];
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const record=(id,patch={})=>({id:'archaic-test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const direct=(id,patch={},techLevel=16,size=6,skills=[],equipment=[])=>{const records=[record(id,patch)];validateWeapons(records);return evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:records}}},[{id:'arm',size,dexterity:8}],skills,equipment);};
const profile=(...args)=>direct(...args).weapons[0];
const design=(id,patch={})=>updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const storageRef='option:storage-compartment';
const storage=[{id:'storage-compartment',quantity:1}];
const raw=id=>WEAPONS.find(w=>w.id==='csc-'+id);
const accessoryChoices=id=>weaponControl(design(id)).itemFields.find(f=>f.field==='accessories').choicesBy.values['csc-'+id];

for(const [id,name,tl,range,damage,mass,cost,capacity,loadCost,traits,projectile,unitMass] of expected){
 test('CSC archaic source: '+id+' preserves every scalar and distinct family',()=>{
  const w=raw(id);assert.deepEqual([w.label,w.tl,w.range,w.damage,w.massKg,w.cost,w.magazine,w.magazineCost,w.traits],[name+' (CSC 2023)',tl,range,damage,mass,cost,capacity,loadCost,traits]);
  assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.weaponFamily,'archaic');assert.equal(w.skill,'gun-combat');assert.equal(w.speciality,'archaic');assert.equal(w.mountClass,'medium');assert.equal(w.initialIncluded,false);assert.equal(w.implemented,true);
  assert.deepEqual(w.source,source('154'));assert.deepEqual(w.sourceMeasurements,{mass:{value:mass,unit:'kg'},source:source('154')});
  assert.equal(w.mountClassification.source.book,'Robot Handbook');assert.equal(w.mountClassification.source.pages,'61');assert.match(w.mountClassification.basis,/Larger weapon usable with Gun Combat/);
  assert.equal(w.requiresTwoHands,true);assert.equal(w.handedness.hands,2);assert.equal(w.handedness.explicitPrintedHandCount,false);assert.equal(w.handedness.basis,'qualified-physical-interpretation');assert.deepEqual(w.handedness.source,source('154-155'));
  assert.equal(w.compatibility.accessoryRules,'csc-2023');assert.equal(w.compatibility.attachedLauncher,false);assert.equal(w.compatibility.associatedLauncherRules,null);assert.equal(w.compatibility.specialisedAmmunitionRules,null);assert.deepEqual(w.compatibility.specialisedAmmunitionExclusion,{category:'Archaic Weapons',source:source('178')});
  const a=w.ammunitionAccounting;assert.equal(a.initialMagazine,'separate-purchase');assert.equal(a.sourceInitialInclusion,'unstated');assert.match(a.inclusionStatement,/convention, not a source exclusion/);assert.equal(a.projectile,projectile);assert.equal(a.priceUnit,'whole load');assert.equal(a.roundsPerLoad,capacity);assert.deepEqual(a.magazinePriceSource,source('154'));assert.equal(a.magazineDefinitionSource.pages,'77');assert.equal(a.mountSource.pages,'61');assert.equal(a.mountExcludesAmmunition,true);assert.equal(a.autoloadSupported,true);assert.equal(a.autoloadResolvesConditions,false);
 });
 test('CSC archaic accounting: '+id+' initial, linked and autoloaded loads',()=>{
  const d=design(id),r=evaluateDesign(d);assert.equal(r.status,'verified');const p=r.totals.weapons[0];
  assert.equal(p.cost,cost+1000+loadCost);assert.equal(p.slots,2);assert.equal(p.massKg,mass);assert.equal(p.magazine,capacity);assert.equal(p.baseAttackModifier,-3);assert.equal(p.attackModifier,null);assert.deepEqual(p.associatedAttacks,[]);assert.deepEqual(r.totals.skills,[]);
  assert.equal(profile(id,{initialMagazines:0}).cost,cost+1000);
  const linked=profile(id,{linkedWeapons:3});assert.equal(linked.cost,3*(cost+1000+loadCost));assert.equal(linked.slots,6);assert.equal(linked.linkedDamageBonus,Number(damage[0])*2);
  for(const initialMagazines of [0,1]){const a=profile(id,{linkedWeapons:2,autoload:true,extraMagazines:3,initialMagazines});assert.equal(a.cost,2*(cost+1000+loadCost*(6+initialMagazines)));assert.equal(a.slots,8);assert.equal(a.spareAmmunition,undefined);assert.equal(a.conditionalEffects.autoloadResolvesConditions,false);assert.equal(a.conditionalEffects.reload.actions,id==='crossbow'?'2D3':1);assert.equal(a.magazine,capacity);}
  assert.ok(has(direct(id,{autoload:true,extraMagazines:1},5),'AUTOLOADER_TL'));assert.equal(has(direct(id,{autoload:true,extraMagazines:1},6),'AUTOLOADER_TL'),false);
  assert.equal(has(direct(id,{autoload:true,extraMagazines:1}),'AUTOLOADER_AMMUNITION'),false);assert.ok(has(direct(id,{autoload:true}),'EMPTY_AUTOLOADER'));
  assert.deepEqual(importDesign(exportDesign(d)),d);assert.deepEqual(r.ledger.find(l=>l.id==='weapon-archaic-test').weaponSource,source('154'));
 });
 test('CSC archaic mounting: '+id+' preserves arm limits and held support assignment',()=>{
  const arm={placement:'arm',manipulatorId:'arm'};
  if(tl>0)assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.equal(has(direct(id,{},tl),'WEAPON_TL'),false);
  assert.ok(has(direct(id,arm,16,4),'WEAPON_ARM_SIZE'));assert.equal(has(direct(id,arm,16,5),'WEAPON_ARM_SIZE'),false);assert.equal(profile(id,arm,16,5).cost,cost+1000+loadCost);
  assert.ok(has(direct(id,{...arm,autoload:true,extraMagazines:1},16,5),'WEAPON_ARM_SIZE'));assert.equal(has(direct(id,{...arm,autoload:true,extraMagazines:1},16,6),'WEAPON_ARM_SIZE'),false);
  for(const fireControl of ['none','basic','advanced']){
   const h=direct(id,{placement:'held',manipulatorId:'arm',fireControl}),p=h.weapons[0],block=h.diagnostics.find(d=>d.code==='HELD_SUPPORT_REQUIRED');assert.equal(block.severity,'error');assert.match(block.message,/physical interpretation/);assert.deepEqual(block.source,source('154-155'));assert.equal(p.baseAttackModifier,null);assert.equal(p.attackModifier,null);assert.equal(p.slots,fireControl==='none'?0:1);
  }
  assert.equal(profile(id,{placement:'held',manipulatorId:'arm'}).cost,cost+loadCost);
  assert.equal(has(direct(id),'HELD_SUPPORT_REQUIRED'),false);assert.equal(has(direct(id,arm),'HELD_SUPPORT_REQUIRED'),false);
 });
 test('CSC archaic skills: '+id+' does not inherit slug, energy or Athletics',()=>{
  for(const s of ['gun-combat:slug','gun-combat:energy','athletics:dexterity','heavy-weapons:portable']){const p=profile(id,{},16,6,[{id:s,level:4}]);assert.equal(p.softwareLevel,-3,s);assert.equal(p.baseAttackModifier,-3);}
  for(const s of [{id:'gun-combat:archaic',level:2},{id:'gun-combat',level:2}]){const p=profile(id,{},16,6,[s]);assert.equal(p.softwareLevel,2);assert.equal(p.baseAttackModifier,2);}
  const p=profile(id,{fireControl:'basic'},16,6,[{id:'gun-combat:slug',level:4}]);assert.equal(p.softwareLevel,-3);assert.equal(p.baseAttackModifier,1);assert.equal(p.fireControlDM,1);assert.ok(p.traits.includes('Scope'));assert.equal(p.conditionalEffects.skillGranted,false);
 });
 test('CSC archaic storage: '+id+' uses a separately classified estimated projectile load',()=>{
  const estimate=estimateCscMagazineMass(raw(id));assert.ok(CSC_AMMUNITION_ESTIMATE_IDS.includes('csc-'+id));assert.equal(estimate.kind,'projectile-load');assert.equal(estimate.estimated,true);assert.equal(estimate.unitMassKg,unitMass);assert.equal(estimate.method,'twenty-round-extrapolation');assert.equal(estimate.referenceRounds,20);assert.equal(estimate.referenceWeaponMassFraction,.1);assert.equal(estimate.roundsPerLoad,capacity);assert.deepEqual(estimate.source,source('142'));assert.deepEqual(estimate.classificationSource,source('154'));assert.match(estimate.scope,/not an independently measured/);
  const r=direct(id,{extraMagazines:4,linkedWeapons:3,spareMagazineStorageId:storageRef},16,6,[],storage),p=r.weapons[0];assert.equal(p.cost,3*(cost+1000+5*loadCost));assert.equal(p.spareAmmunition.count,12);assert.equal(p.spareAmmunition.cost,12*loadCost);assert.equal(p.spareAmmunition.massKg,Math.round(unitMass*12*1e9)/1e9);assert.equal(p.spareAmmunition.estimated,true);assert.equal(r.ammunitionStorage[0].reservedKg,p.spareAmmunition.massKg);assert.equal(has(r,'SPARE_AMMO_STORAGE'),false);
  assert.ok(has(direct(id,{extraMagazines:1}),'SPARE_AMMO_STORAGE'));
  const a=direct(id,{extraMagazines:1,autoload:true,spareMagazineStorageId:storageRef},16,6,[],storage);assert.ok(has(a,'SPARE_AMMO_STORAGE_AUTOLOADER'));assert.deepEqual(a.ammunitionStorage,[]);
 });
 test('CSC archaic operation: '+id+' keeps reload, sound and handedness conditional',()=>{
  const c=profile(id,{autoload:true,extraMagazines:2}).conditionalEffects;assert.equal(c.resolvedAttack,false);assert.equal(c.skillGranted,false);assert.equal(c.autoloadResolvesConditions,false);
  assert.equal(c.silent.soundSourceDetectionDM,-6);assert.equal(c.silent.generalStealthBonusGranted,false);assert.match(c.silent.condition,/source of this weapon sound/);assert.deepEqual(c.silent.source,source('131'));
  assert.equal(c.reload.action,'Minor');assert.equal(c.reload.actions,id==='crossbow'?'2D3':1);assert.equal(c.reload.skillCheckRequired,false);assert.equal(c.reload.source.pages,id==='crossbow'?'154':'75');assert.equal(c.reload.source.book,id==='crossbow'?'Central Supply Catalogue Update 2023':'Core Rulebook Update 2022');assert.equal(c.reload.skill,undefined);
  assert.equal(c.handling.requiresTwoHands,true);assert.equal(c.handling.explicitPrintedHandCount,false);assert.equal(c.handling.mountClassIndependentOfHandedness,true);assert.deepEqual(c.handling.source,source('154-155'));
  if(projectile==='arrow'){const a=c.arrowRecovery;assert.equal(a.projectile,'arrow');assert.equal(a.unrecoverableOn,'non-odd attack Effect');assert.deepEqual(a.examples,[2,0,-2]);assert.equal(a.appliesAtAnyTechLevel,true);assert.equal(a.oddEffectGuaranteesRecovery,false);assert.equal(a.resolved,false);assert.deepEqual(a.source,source('131'));}else assert.equal(c.arrowRecovery,undefined);
 });
}

test('CSC archaic tranche has exactly five source profiles without throwing or specialised families',()=>{
 assert.deepEqual(CSC_ARCHAIC_WEAPONS.map(w=>w.id),expected.map(e=>'csc-'+e[0]));assert.equal(WEAPONS.filter(w=>w.sourceFamily==='csc-2023').length,128);
 for(const id of ['dart','javelin','atlatl','bolas','pistol-crossbow'])assert.equal(raw(id),undefined);
 assert.equal(raw('gauss-rifle').speciality,'slug');assert.equal(WEAPONS.find(w=>w.id==='rifle').sourceFamily,'core-2022');
});

test('CSC archaic reload and feed do not treat a magazine price as actions or invent automatic recocking',()=>{
 assert.equal(raw('compound-cam-bow').magazineCost,5);assert.equal(raw('compound-cam-bow').conditionalEffects.reload.actions,1);
 assert.equal(raw('crossbow').magazineCost,1);assert.equal(raw('crossbow').conditionalEffects.reload.actions,'2D3');
 const c=profile('repeating-crossbow',{autoload:true,extraMagazines:10}).conditionalEffects;assert.deepEqual(c.feed,{projectile:'bolt',magazineCapacity:6,automaticFireGranted:false,source:source('154')});assert.equal(c.cocking.method,'lever');assert.equal(c.cocking.required,true);assert.equal(c.cocking.extraActionsSpecified,false);assert.equal(c.cocking.rateOfFireOverride,null);assert.equal(c.cocking.autoloadBypasses,false);assert.equal(c.reload.actions,1);assert.equal(c.autoloadResolvesConditions,false);
 assert.equal(profile('crossbow').conditionalEffects.cocking.method,'stirrup-or-windlass');
});

test('Long Bow keeps only source Bulky STR 9, with literal gyro eligibility and no invented damage bonus',()=>{
 const c=profile('long-bow').conditionalEffects.bulky;assert.equal(c.requiresTrait,'Bulky');assert.equal(c.minimumStrengthWithoutPenalty,9);assert.equal(c.belowMinimumAttackDM,'STR DM minus 1');assert.equal(c.automaticPenaltyApplied,false);assert.equal(c.additionalDrawThreshold,null);assert.equal(c.strengthDamageBonusGranted,false);assert.equal(c.source.pages,'79');assert.deepEqual(c.gyrostabiliserEligibility.source,source('175'));
 const p=profile('long-bow',{accessories:['csc-gyrostabiliser']});assert.equal(p.traits.includes('Bulky'),false);assert.equal(p.damage,'3D-3');assert.equal(p.cost,1651);assert.equal(p.conditionalEffects.bulky.requiresTrait,'Bulky');assert.equal(p.accessoryEffects[0].removedTrait,'Bulky');
 for(const [id] of expected.filter(r=>r[0]!=='long-bow')){const r=direct(id,{accessories:['csc-gyrostabiliser']});assert.ok(has(r,'GYROSTABILISER_WEAPON'));assert.equal(r.weapons[0].cost,null);assert.equal(profile(id).conditionalEffects.bulky,undefined);}
});

test('Short Bow TL0 breakage depends on unknown manufacturing TL, never robot TL',()=>{
 for(const tl of [0,1,6,16]){const p=profile('short-bow',{},tl),c=p.conditionalEffects.tl0Breakage;assert.equal(c.maximumAttackEffect,-3);assert.equal(c.requiredManufacturingTechLevel,0);assert.equal(c.manufacturingTechLevel,null);assert.equal(c.inferFromRobotTechLevel,false);assert.equal(c.noDefectAtManufacturingTechLevelAtLeast,1);assert.equal(c.breaks,'bow-or-string');assert.equal(c.automaticBreakageApplied,false);assert.deepEqual(c.source,source('131'));assert.equal(p.conditionalEffects.arrowRecovery.appliesAtAnyTechLevel,true);assert.equal(p.damage,'2D-3');}
 assert.equal(evaluateDesign(design('short-bow')).status,'verified');
 for(const [id] of expected.filter(r=>r[0]!=='short-bow'))assert.equal(profile(id).conditionalEffects.tl0Breakage,undefined);
});

test('CSC archaic accessories allow qualified tracker hardware and retain scope/slug/pistol restrictions',()=>{
 const allowed=['csc-intelligent-0','csc-intelligent-1','csc-intelligent-2','csc-intelligent-3','csc-laser-sight-8','csc-laser-sight-10','csc-holographic-sight','csc-smart-tracker','csc-bipod','csc-fof-safety','csc-scan-jammer','csc-secure'];
 for(const [id,,,,,,cost,,loadCost] of expected){
  assert.deepEqual(accessoryChoices(id).map(a=>a.id).sort(),[...allowed,...(id==='long-bow'?['csc-gyrostabiliser']:[])].sort());
  for(const a of CSC_WEAPON_ACCESSORIES){const good=allowed.includes(a.id)||id==='long-bow'&&a.id==='csc-gyrostabiliser';assert.equal(cscAccessoryEligibility(raw(id),a).available,good,a.id);const r=direct(id,{accessories:[a.id,...(a.id==='csc-smart-tracker'?['csc-intelligent-0']:[])]});if(good){assert.equal(r.weapons[0].cost,cost+1000+loadCost+a.cost+(a.id==='csc-smart-tracker'?1000:0));assert.equal(r.weapons[0].accessoryEffects[0].skillGranted,false);}else{assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);}}
  for(const [a,code] of [['csc-scope-5','SCOPE_WEAPON'],['csc-scope-7','SCOPE_WEAPON'],['csc-suppressor','SUPPRESSOR_WEAPON'],['csc-xray-1','CSC_XRAY_SCOPE'],['csc-shoulder-stock','CSC_STOCK_PISTOL']]){
   const patch={accessories:[a,...(a==='csc-smart-tracker'?['csc-intelligent-0']:[])]},r=direct(id,patch);assert.ok(has(r,code));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);
   const imported=importDesign(exportDesign(design(id,patch))),evaluation=evaluateDesign(imported);assert.equal(evaluation.status,'invalid');assert.equal(evaluation.totals,null);assert.ok(has(evaluation,code));
  }
  for(const a of WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022')){const r=direct(id,{accessories:[a.id]});assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);}
  const sight=profile(id,{accessories:['csc-holographic-sight']}).accessoryEffects[0];assert.equal(sight.modifier,1);assert.deepEqual(sight.rangeMetres,{minimum:50,minimumInclusive:true});assert.match(sight.interpretation,/table says beyond 50m/);
  const laser=profile(id,{accessories:['csc-laser-sight-8']}).accessoryEffects[0];assert.deepEqual(laser.rangeMetres,{maximum:50,maximumInclusive:false});assert.equal(laser.modifier,1);
  assert.ok(has(direct(id,{accessories:['csc-laser-sight-8','csc-holographic-sight']}),'CSC_SIGHT_LIMIT'));
  const f=profile(id,{fireControl:'basic'});assert.ok(f.traits.includes('Scope'));assert.equal(f.fireControlDM,1);assert.deepEqual(f.accessories,[]);
 }
});

test('CSC archaic ammunition and associated launchers remain source-excluded despite positive capacity',()=>{
 for(const [id] of expected){
  for(const ammunition of ['aerosol','frag','smoke','stun']){const r=direct(id,{ammunition});assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);}
  for(const patch of [{auxiliaryLauncher:'attached',auxiliaryAmmunition:'frag',auxiliaryLoaded:1},{auxiliaryLauncher:'integral-acr'},{auxiliaryLauncher:'both-acr'},{auxiliaryLoaded:1},{integralLoaded:1},{looseGrenades:1}]){const r=direct(id,patch);assert.ok(has(r,'CSC_LAUNCHERS_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].associatedAttacks,[]);}
 }
});

test('CSC archaic storage combines families, rejects overfill, and omits initial and autoloader loads',()=>{
 const records=expected.map(([id],i)=>record(id,{id:'archaic-'+i,extraMagazines:1,spareMagazineStorageId:storageRef}));validateWeapons(records);
 const r=evaluateWeapons({kind:'standard',techLevel:16,selections:{physical:{weapons:records}}},[],[],storage);assert.equal(r.ammunitionStorage[0].reservedKg,.1525);assert.equal(r.ammunitionStorage[0].remainingKg,1.8475);
 const over=direct('repeating-crossbow',{linkedWeapons:4,extraMagazines:100,spareMagazineStorageId:storageRef},16,6,[],storage);assert.equal(over.ammunitionStorage[0].reservedKg,48);assert.ok(has(over,'AMMUNITION_STORAGE_CAPACITY'));assert.ok(has(over,'SPARE_AMMO_STORAGE'));
 assert.deepEqual(direct('short-bow').ammunitionStorage,[]);assert.deepEqual(direct('short-bow',{autoload:true,extraMagazines:10}).ammunitionStorage,[]);
});

test('CSC archaic imports cannot alter profiles, manufacture TL, conditions or source classification',()=>{
 for(const [id] of expected){
  for(const patch of [{manufacturingTechLevel:1},{requiresTwoHands:false},{handedness:{hands:1}},{sourceFamily:'core-2022'},{weaponFamily:'rifle'},{speciality:'slug'},{magazine:100},{magazineCost:0},{cost:0},{compatibility:{accessoryRules:'core-2022'}},{conditionalEffects:{reload:{actions:0}}},{ammunitionAccounting:{sourceInitialInclusion:'included'}},{ammunition:'armour-piercing'}]){const d=design(id);Object.assign(d.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);}
 }
});

test('CSC archaic catalogue, evaluation and API return detached nested data with round trips intact',()=>{
 for(const [id] of expected){
  const d=design(id),before=structuredClone(raw(id));
  const choices=getCatalogue(d).stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices,w=choices.find(w=>w.id==='csc-'+id);w.handedness.hands=1;w.mountClassification.source.pages='bad';w.conditionalEffects.handling.explicitPrintedHandCount=true;w.ammunitionAccounting.sourceInitialInclusion='included';w.compatibility.specialisedAmmunitionExclusion.source.pages='bad';
  const p=profile(id,{extraMagazines:1,spareMagazineStorageId:storageRef},16,6,[],storage);p.conditionalEffects.reload.actions=0;p.ammunitionAccounting.magazinePriceSource.pages='bad';p.compatibility.attachedLauncher=true;p.spareAmmunition.estimate.classificationSource.pages='bad';p.source.pages='bad';
  const control=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-'+id);control.handedness.source.pages='bad';assert.deepEqual(raw(id),before);assert.equal(estimateCscMagazineMass(raw(id)).classificationSource.pages,'154');
  const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));const view=api.getView();assert.equal(view.evaluation.status,'verified');view.evaluation.totals.weapons[0].conditionalEffects.skillGranted=true;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.skillGranted,false);assert.deepEqual(importDesign(exportDesign(d)),d);
 }
});
