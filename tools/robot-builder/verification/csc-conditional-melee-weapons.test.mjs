import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_CONDITIONAL_MELEE_WEAPONS} from '../engine/csc-conditional-melee-weapons.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,MOUNTS,FIRE_CONTROL,evaluateWeapons,weaponControl,weaponRecordPresentation} from '../engine/weapons.mjs';
import {estimateCscMagazineMass,cscMagazineVariants,cscMagazineSourceIds} from '../engine/csc-ammunition-storage.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {renderReview} from '../js/review.mjs';
// Independent pixel audit: revised copyright-2026 CSC table/description p135,
// Lance condition p134, Spear description p137, TL0 rule p131, grips p136.
const expected=[
 ['monofilament-axe','Monofilament Axe',12,'4D',4,3000,['AP 15','Bulky','Smasher'],2,'131,134-136'],
 ['spear','Spear',0,'2D',2,10,[],2,'131,134-137'],
 ['lance','Lance',1,null,4,250,[],1,'134-137'],
 ['piston-spear','Piston Spear',7,null,3,400,[],2,'134-137']
];
const source=pages=>({book:'Central Supply Catalogue Update 2023',edition:'Mongoose revised printing (copyright 2026)',pages});
const raw=id=>CSC_CONDITIONAL_MELEE_WEAPONS.find(w=>w.id==='csc-'+id);
const record=(id,patch={})=>({id:'conditional-melee',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const arms=[{id:'base-1',kind:'base',size:5,strength:9,dexterity:8},{id:'base-2',kind:'base',size:5,strength:15,dexterity:12},{id:'third',kind:'additional',size:5,strength:19,dexterity:15}];
const direct=(id,patch={},options={})=>evaluateWeapons({kind:'standard',techLevel:options.techLevel??16,selections:{physical:{weapons:[record(id,patch)]}}},options.arms??arms,options.skills??[],[],options.host??{});
const design=(id,patch={})=>updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const copy=(patch={})=>({copyIndex:2,initialMagazines:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none',...patch});
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const noErrors=r=>assert.deepEqual(r.diagnostics.filter(d=>['error','blocker'].includes(d.severity)),[]);
const review=d=>projectReview(d,getCatalogue(d),evaluateDesign(d));
const selected=d=>getCatalogue(d).stages.find(s=>s.id==='physical').controls.find(c=>c.field==='weapons');
const model=d=>review(d).sections.find(s=>s.id==='weapons').rows[0];
class Node {constructor(tag){this.tagName=tag;this.children=[];this.textContent='';this.attributes={};this.classList={add:()=>{}};}append(...children){this.children.push(...children);}setAttribute(k,v){this.attributes[k]=v;}}
const visible=n=>typeof n==='string'?n:[n.textContent,...n.children.map(visible)].join(' ');

test('four supplemental melee acquisitions retain distinct source identities and Core facts',()=>{
 assert.deepEqual(CSC_CONDITIONAL_MELEE_WEAPONS.map(w=>w.id),expected.map(row=>'csc-'+row[0]));
 assert.equal(new Set(WEAPONS.map(w=>w.id)).size,WEAPONS.length);
 assert.deepEqual(WEAPONS.filter(w=>w.sourceFamily==='core-2022'&&w.id==='broadsword').map(w=>[w.tl,w.damage,w.cost]),[[2,'4D',500]]);
 assert.equal(WEAPONS.filter(w=>w.poweredMelee).length,11);
});
for(const [id,name,tl,damage,mass,cost,traits,hands,pages]of expected){
 test('source and mount facts: '+name,()=>{
  const w=raw(id);assert.deepEqual([w.label,w.tl,w.damage,w.massKg,w.cost,w.traits],[name+' (CSC 2023)',tl,damage,mass,cost,traits]);
  assert.deepEqual([w.skill,w.speciality,w.range,w.weaponFamily,w.sourceFamily,w.magazine,w.magazineCost,w.initialIncluded],['melee','blade','Melee','melee','csc-2023',null,0,true]);
  assert.deepEqual(w.source,source(pages));assert.deepEqual(w.sourceMeasurements,{mass:{value:mass,unit:'kg'},source:source('135')});
  assert.deepEqual(w.handedness,{hands,explicitPrintedHandCount:false,basis:'qualified-physical-interpretation',alternateTwoHandedUse:false,exclusiveConfiguration:false,source:source('136'),mountSource:{book:'Robot Handbook',edition:'Mongoose 2022',pages:'61'}});
  assert.equal(w.requiresTwoHands,hands===2);assert.equal(w.mountClass,hands===2?'medium':'small');
  assert.equal(w.poweredMelee,undefined);assert.equal(w.powerOperation,undefined);
  assert.deepEqual(w.compatibility,{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false});
  assert.equal(w.ammunitionAccounting.initialMagazine,'not-applicable');assert.equal(w.ammunitionAccounting.autoloadSupported,false);
  assert.equal(estimateCscMagazineMass(w),null);assert.equal(cscMagazineVariants(w),null);assert.deepEqual(cscMagazineSourceIds(w),[]);
  assert.deepEqual([w.conditionalEffects.handling.explicitPrintedHandCount,w.conditionalEffects.handling.exclusiveConfiguration,w.conditionalEffects.handling.mountClassIndependentOfWeaponMass],[false,false,true]);
 });
 test('purchase, TL, arm-size and linked FCS: '+name,()=>{
  const mount=MOUNTS[raw(id).mountClass];
  for(const n of [1,2,4])for(const fcs of FIRE_CONTROL){
   const r=direct(id,{linkedWeapons:n,fireControl:fcs.id}),w=r.weapons[0];noErrors(r);
   assert.equal(w.cost,(cost+mount.cost)*n+fcs.cost);assert.equal(w.slots,mount.slots*n+(fcs.id==='none'?0:1));
   assert.equal(w.damage,damage);assert.equal(w.linkedDamageBonus,damage===null?null:Number(damage[0])*(n-1));
   assert.deepEqual(w.traits,[...traits,...(fcs.id==='none'?[]:['Scope'])]);assert.equal(w.attackModifier,null);
   assert.equal(w.initialAmmunition.status,'not-applicable');assert.equal(w.initialAmmunition.count,0);assert.equal(w.ammunitionInventory.totalCost,0);
   if(damage===null)assert.deepEqual(w.attackProfiles,raw(id).attackProfiles);
  }
  for(const techLevel of [tl-1,tl,23])assert.equal(has(direct(id,{}, {techLevel}),'WEAPON_TL'),techLevel<tl);
  for(const size of [mount.armSize-1,mount.armSize])assert.equal(has(direct(id,{placement:'arm',manipulatorId:'base-1'},{arms:arms.map(a=>({...a,size}))}),'WEAPON_ARM_SIZE'),size<mount.armSize);
  const d=design(id),r=evaluateDesign(d);assert.equal(r.status,'verified');assert.deepEqual(importDesign(exportDesign(d)),d);
 });
 test('qualified grip boundaries: '+name,()=>{
  const patch={placement:'held',manipulatorId:'base-1',...(hands===2?{supportManipulatorId:'base-2'}:{})};
  const r=direct(id,patch,{arms:arms.map(a=>({...a,size:1}))}),w=r.weapons[0];noErrors(r);
  assert.equal(w.cost,cost);assert.equal(w.slots,0);assert.equal(w.gripAssignmentStatus,'assigned');assert.equal(w.multiArm,hands===2);assert.equal(w.baseAttackModifier,hands===2?null:-3);
  assert.deepEqual(w.gripManipulatorIds,hands===2?['base-1','base-2']:['base-1']);assert.equal(w.attackModifier,null);
  assert.ok(has(r,hands===2?'HELD_HANDEDNESS_INTERPRETATION':'HELD_ONE_HANDED_INTERPRETATION'));
  if(hands===2)for(const [support,code]of [['none','HELD_SUPPORT_REQUIRED'],['missing','HELD_SUPPORT_REQUIRED'],['base-1','HELD_GRIPS_MUST_DIFFER']])assert.ok(has(direct(id,{...patch,supportManipulatorId:support}),code));
  else assert.ok(has(direct(id,{...patch,supportManipulatorId:'base-2'}),'HELD_SUPPORT_UNSUPPORTED'));
  assert.ok(has(direct(id,{...patch,linkedWeapons:2}),'HELD_WEAPON_MOUNT'));
  const records=[record(id,patch),record('lance',{id:'conflict',placement:'held',manipulatorId:hands===2?'base-2':'base-1'})];
  assert.ok(has(evaluateWeapons({kind:'standard',techLevel:16,selections:{physical:{weapons:records}}},arms,[]),'HELD_GRIP_OCCUPIED'));
 });
 test('blade software is source scoped: '+name,()=>{
  for(const [skill,level]of [['melee:blade',2],['melee:bludgeon',-3],['gun-combat:slug',-3],['melee:whip',-3]]){
   const w=direct(id,{}, {skills:[{id:skill,level:2}]}).weapons[0];assert.equal(w.softwareLevel,level);assert.equal(w.baseAttackModifier,level);assert.equal(w.attackModifier,null);
  }
  const d=updateDesign(design(id),{selections:{brain:{model:'very-advanced-tl14'},skills:{packages:['melee-all-listed-1']}}}),r=evaluateDesign(d);
  assert.equal(r.status,'verified');assert.equal(r.totals.weapons[0].softwareLevel,1);
  assert.equal(r.ledger.find(l=>l.id==='melee-all-listed-1').cost,4000);
 });
 test('supply and accessory boundaries: '+name,()=>{
  for(const [patch,code]of [
   [{autoload:true},'AUTOLOADER_AMMUNITION'],[{extraMagazines:1},'WEAPON_AMMO_INAPPLICABLE'],[{initialMagazines:0},'WEAPON_AMMO_INAPPLICABLE'],
   [{initialMagazineType:'high-capacity'},'CSC_HIGH_CAPACITY_UNSUPPORTED'],[{extraHighCapacityMagazines:1},'CSC_HIGH_CAPACITY_UNSUPPORTED'],
   [{initialMagazineSourceId:'csc-advanced-combat-rifle'},'MAGAZINE_SOURCE_INCOMPATIBLE'],
   [{ammunition:'frag'},'CSC_AMMUNITION_UNSUPPORTED'],[{auxiliaryLauncher:'attached'},'CSC_LAUNCHERS_UNSUPPORTED'],[{looseGrenades:1},'CSC_LAUNCHERS_UNSUPPORTED'],
   [{spareMagazineStorageId:'instance:missing'},'SPARE_AMMO_STORAGE_UNSUPPORTED'],
   [{alternateMagazineSupplies:[{sourceWeaponId:'csc-advanced-combat-rifle',variant:'standard',extraMagazines:1,autoloadMagazines:0,storageId:'none'}]},'MAGAZINE_SOURCE_INCOMPATIBLE']
  ]){const r=direct(id,patch);assert.ok(has(r,code),code);assert.deepEqual(r.weapons[0].associatedAttacks,[]);assert.deepEqual(r.weapons[0].traits,traits);assert.equal(r.weapons[0].powerOperation,undefined);}
  assert.ok(has(direct(id,{linkedWeapons:2,ammunitionOverrides:[copy({extraMagazines:1})]}),'WEAPON_AMMO_INAPPLICABLE'));
  for(const a of WEAPON_ACCESSORIES.filter(a=>a.sourceFamily==='core-2022'||!['intelligent','smart-tracker','scan-jammer','gyrostabiliser'].includes(a.kind))){
   const r=direct(id,{accessories:[a.id]});assert.ok(r.diagnostics.some(d=>['error','blocker'].includes(d.severity)),a.id);assert.equal(r.weapons[0].cost,null);
  }
  for(const accessory of ['csc-intelligent-0','csc-smart-tracker','csc-scan-jammer']){const r=direct(id,{accessories:accessory==='csc-smart-tracker'?['csc-intelligent-0',accessory]:[accessory]});noErrors(r);assert.equal(r.weapons[0].softwareLevel,-3);assert.equal(r.weapons[0].attackModifier,null);if(damage===null)assert.deepEqual(r.weapons[0].attackProfiles,raw(id).attackProfiles);}
  const p=weaponRecordPresentation(record(id));for(const field of ['initialMagazines','extraMagazines','autoload','autoloadAllocation'])assert.equal(p.fields[field].visible,false);assert.equal(p.ammunitionCustomization,null);
  for(const [field,value]of [['initialMagazines',0],['extraMagazines',1],['autoload',true],['autoloadAllocation',{standard:0,highCapacity:0}]])assert.equal(weaponRecordPresentation(record(id,{[field]:value})).fields[field].visible,true);
 });
}
test('Lance rider condition has exact enhanced and no-AP fallback profiles without a speed inference',()=>{
 const a=raw('lance').attackProfiles;
 assert.deepEqual([a.kind,a.currentMode,a.resolved,a.hardwareIdentityPreserved],['rider-condition',null,false,true]);
 assert.deepEqual(a.condition,{kind:'riding-fast-moving-animal-or-vehicle',requiresRider:true,requiresFastMovingMount:true,allowedMountKinds:['animal','vehicle'],minimumSpeed:null,inferFromRobotMovement:false,inferFromWeaponMount:false,inferFromSpeedUpgrade:false,source:source('134')});
 assert.deepEqual(a.profiles,[{id:'riding',label:'Riding fast-moving animal/vehicle',damage:'5D',traits:['AP 4'],source:source('134-135')},{id:'ordinary-spear',label:'Otherwise: Spear',damage:'2D',traits:[],source:source('134-135,137')}]);
 for(const placement of ['body','arm','held']){
  const w=direct('lance',{placement,manipulatorId:placement==='body'?'none':'base-1'}).weapons[0];assert.equal(w.damage,null);assert.equal(w.linkedDamageBonus,null);assert.deepEqual(w.attackProfiles,a);assert.equal(w.conditionalEffects.tl0Breakage,undefined);
 }
 const d=updateDesign(design('lance'),{selections:{locomotion:{primary:'wheels'},physical:{vehicleSpeed:true,vehicleBands:3}}}),before=structuredClone(d);
 const r=evaluateDesign(d);assert.deepEqual((r.totals??r.previewTotals).weapons[0].attackProfiles,a);assert.deepEqual(d,before);
});
test('Piston reset after EVERY attack preserves 3D+2/AP2 and exact 2D/noAP fallback without guessed supplies',()=>{
 const a=raw('piston-spear').attackProfiles;
 assert.deepEqual([a.kind,a.currentMode,a.resolved],['reset-condition',null,false]);
 assert.deepEqual(a.condition,{kind:'reset-after-every-attack',minorActions:1,afterEveryAttack:true,currentReadiness:null,automaticReset:false,mechanism:'pneumatic',reservoirAttackCount:null,refillPrice:null,replacementPurchasesSupported:false,robotPowerConnection:false,source:source('135')});
 assert.deepEqual(a.profiles,[{id:'ready',label:'Ready / reset',damage:'3D+2',traits:['AP 2'],source:source('135')},{id:'ordinary-spear',label:'Without reset: Spear',damage:'2D',traits:[],source:source('135,137')}]);
 for(const host of [{hours:0},{hours:144},{hours:null}]){const w=direct('piston-spear',{linkedWeapons:4,fireControl:'advanced'},{host}).weapons[0];assert.deepEqual(w.attackProfiles,a);assert.equal(w.damage,null);assert.equal(w.linkedDamageBonus,null);assert.equal(w.conditionalEffects.tl0Breakage,undefined);assert.equal(w.cost,105600);}
});
test('Spear manufacturing TL remains unknown and fallback hardware never inherits its TL0 defect',()=>{
 const e=raw('spear').conditionalEffects.tl0Breakage;
 assert.deepEqual(e,{maximumAttackEffect:-3,requiredManufacturingTechLevel:0,manufacturingTechLevel:null,inferFromRobotTechLevel:false,noDefectAtManufacturingTechLevelAtLeast:1,breaks:'weapon',automaticBreakageApplied:false,condition:'Weapon crafted at TL0 and attack Effect is -3 or worse; manufacturing TL is not recorded by this construction.',source:source('131')});
 for(const techLevel of [0,1,16,23])assert.deepEqual(direct('spear',{}, {techLevel}).weapons[0].conditionalEffects.tl0Breakage,e);
 for(const id of ['lance','piston-spear']){const w=raw(id);assert.equal(w.conditionalEffects.tl0Breakage,undefined);assert.ok(w.tl>=1);assert.equal(w.attackProfiles.profiles[1].conditionalEffects,undefined);}
 const spear=direct('spear').weapons[0];assert.equal(spear.range,'Melee');assert.equal(spear.thrownRange,undefined);assert.deepEqual(spear.associatedAttacks,[]);
 assert.deepEqual(raw('monofilament-axe').conditionalEffects.smasher,{targetMayParry:false,condition:'The target is attacked with this Smasher weapon',armourPenetrationGranted:false,source:source('131')});
 assert.equal(raw('monofilament-axe').powerOperation,undefined);
});
test('source rules, mode and manufacture fields cannot be supplied by imports; API results are detached',()=>{
 for(const [id]of expected)for(const [field,value]of Object.entries({damage:'99D',traits:[],source:{pages:'bad'},cost:0,tl:0,handedness:{hands:1},requiresTwoHands:false,attackProfiles:{currentMode:'riding'},currentMode:'ready',manufacturingTechLevel:1,conditionalEffects:{},powerOperation:{},powerConnection:'robot'})){
  const d=design(id);d.selections.physical.weapons[0][field]=value;assert.throws(()=>importDesign(JSON.stringify(d)),TypeError,id+' '+field);
 }
 for(const id of ['lance','piston-spear']){
  const d=design(id,{linkedWeapons:2}),before=exportDesign(d),a=structuredClone(raw(id)),api=createRobotApi();api.importDesign(before);
  const cat=selected(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-'+id);cat.attackProfiles.currentMode='ready';cat.attackProfiles.profiles[1].traits.push('AP 99');cat.source.pages='bad';
  const r=api.getView();r.evaluation.totals.weapons[0].attackProfiles.profiles[0].damage='99D';r.evaluation.totals.weapons[0].attackProfiles.condition.minimumSpeed=0;
  assert.deepEqual(api.getView().evaluation.totals.weapons[0].attackProfiles,a.attackProfiles);assert.deepEqual(raw(id),a);assert.equal(exportDesign(d),before);
  assert.deepEqual(weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-'+id).attackProfiles,a.attackProfiles);
 }
});
test('review, renderer and print use conditional headlines and selected short mode facts only',()=>{
 for(const id of ['lance','piston-spear']){
  const d=design(id,{linkedWeapons:2,fireControl:'basic'}),r=model(d);assert.equal(r.value,'Conditional damage · Range: Melee · Scope');
  assert.equal(r.details.find(row=>row.label==='Current attack mode').value,'Unresolved');
  assert.equal(r.details.find(row=>row.label==='Linked Damage Bonus').value,'Not calculated');
  assert.equal(r.details.find(row=>row.label==='Ammunition').value,'Not applicable');
  const api=createRobotApi();api.importDesign(exportDesign(d));const v=api.getView();
  for(const text of [formatStatblock(v.review),api.getStatblock(),visible(renderReview(v.review,{createElement:tag=>new Node(tag)}))]){
   assert.match(text,/Conditional damage/);assert.match(text,/2D damage · No AP/);assert.match(text,/Current attack mode: Unresolved|Current attack mode Unresolved/);
   assert.ok(text.includes(id==='lance'?'Riding fast-moving animal/vehicle':'1 Minor Action after every attack'));
   assert.doesNotMatch(text,/Initial Ammunition:|Ammunition Inventory:|Melee m\b|full tables|referenceRows|reservoirAttackCount|qualified physical configuration, not an explicit printed hand count/i);
  }
 }
 const text=formatStatblock(review(design('spear')));assert.match(text,/manufacturing TL unrecorded/);assert.match(text,/Manufacturing Tech Level: Not calculated/);assert.doesNotMatch(text,/Javelin|Range: 20/);
});
test('composite snapshots keep conditional modes and hardware without parent movement or source aliasing',()=>{
 for(const id of ['lance','piston-spear']){
  const child=design(id,{linkedWeapons:2}),parent=updateDesign(createDesign({kind:'ship-brain',techLevel:16}),{special:{designReferences:[{id:'robot',role:'installed-robot',quantity:1,design:child}]}}),r=evaluateDesign(parent);
  assert.equal(r.status,'verified');const w=r.composite.components[0].profile.weapons[0];assert.deepEqual(w.attackProfiles,raw(id).attackProfiles);assert.equal(w.damage,null);assert.equal(w.linkedDamageBonus,null);assert.equal(w.massKg,raw(id).massKg);
  const text=formatStatblock(review(parent));assert.match(text,/Conditional damage/);assert.match(text,/2D damage · No AP/);
  w.attackProfiles.currentMode='ready';w.attackProfiles.profiles[1].traits.push('AP 99');assert.deepEqual(evaluateDesign(parent).composite.components[0].profile.weapons[0].attackProfiles,raw(id).attackProfiles);
 }
});
test('cyberlimb weapons retain hardware mode conditions without granting recipient skills or two-handed grips',()=>{
 for(const id of ['lance','piston-spear']){
  const {manipulatorId,...limbWeapon}=record(id,{placement:'arm'});
  const d=updateDesign(createDesign({kind:'cyborg',techLevel:16}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:2}}],augmentWeapons:[{...limbWeapon,parentLimb:'limb'}]}}),r=evaluateDesign(importDesign(exportDesign(d)));
  assert.equal(r.status,'verified');const w=r.totals.augmentations[0].weapons[0];assert.deepEqual(w.attackProfiles,raw(id).attackProfiles);assert.equal(w.damage,null);assert.equal(w.linkedDamageBonus,null);assert.equal(w.softwareLevel,null);assert.equal(w.baseAttackModifier,null);assert.equal(w.copies,2);
  assert.match(formatStatblock(review(d)),/Conditional damage/);w.attackProfiles.currentMode='riding';assert.equal(evaluateDesign(d).totals.augmentations[0].weapons[0].attackProfiles.currentMode,null);
  const invalid=structuredClone(d);invalid.special.augmentWeapons[0].supportManipulatorId='base-2';assert.throws(()=>importDesign(JSON.stringify(invalid)),TypeError);
 }
});
