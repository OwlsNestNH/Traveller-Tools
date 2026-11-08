import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInThisContext} from 'node:vm';
import {WEAPONS,weaponControl,validateWeapons,evaluateWeapons} from '../engine/weapons.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';

// Independent fixtures: RH pp25-28,60-61,115; Core pp74,77-79,98,125;
// revised CSC pp134-135,154-155. Two grips do not settle robot characteristic arithmetic.
const record=(weaponId='csc-broadsword',patch={})=>({id:'held-test',weaponId,placement:'held',manipulatorId:'base-1',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const arms=[{id:'base-1',kind:'base',size:1,strength:7,dexterity:8},{id:'base-2',kind:'base',size:1,strength:12,dexterity:12},{id:'third-arm',kind:'additional',size:1,strength:30,dexterity:15},{id:'fourth-arm',kind:'additional',size:1,strength:5,dexterity:4}];
const direct=(records=[record('csc-broadsword',{supportManipulatorId:'base-2'})],manipulators=arms,skills=[])=>evaluateWeapons({kind:'standard',techLevel:16,selections:{physical:{weapons:records}}},manipulators,skills);
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);
const noConstructionErrors=result=>assert.deepEqual(result.diagnostics.filter(d=>['error','blocker'].includes(d.severity)),[]);
const design=(records=[record('csc-broadsword',{supportManipulatorId:'base-2'})])=>updateDesign(createDesign({techLevel:14}),{selections:{physical:{weapons:records}}});
const total=result=>result.totals??result.previewTotals;
const twoHanded=[['csc-staff',5],['csc-broadsword',500],['csc-great-axe',750],['broadsword',500],['csc-compound-cam-bow',255],['csc-crossbow',201],['csc-long-bow',151],['csc-repeating-crossbow',406],['csc-short-bow',51]];

for(const [id,cost] of twoHanded)test('Second grip: '+id+' is one held purchase with no mount Slots',()=>{
 const selected=record(id,{supportManipulatorId:'base-2'}),result=direct([selected]),weapon=result.weapons[0];noConstructionErrors(result);
 assert.equal(result.cost,cost);assert.equal(weapon.cost,cost);assert.equal(weapon.slots,0);assert.equal(result.ledger.length,1);
 assert.deepEqual(weapon.gripManipulatorIds,['base-1','base-2']);assert.equal(weapon.gripAssignmentStatus,'assigned');assert.equal(weapon.multiArm,true);
 assert.equal(weapon.baseAttackModifier,null);assert.equal(weapon.attackModifier,null);assert.equal(weapon.manipulatorDM,null);assert.equal(weapon.primaryManipulatorDM,0);
 assert.equal(weapon.effectiveStrength,null);assert.equal(weapon.effectiveDexterity,null);assert.equal(weapon.carryingFit,'referee-dependent');assert.equal(weapon.characteristicResolution,'referee-dependent');
 assert.equal(weapon.additionalAttacksGranted,false);assert.equal(weapon.gripBenefitGranted,false);assert.equal(weapon.linkedDamageBonus,0);
 assert.deepEqual(weapon.gripManipulators.map(arm=>[arm.size,arm.strength,arm.dexterity,arm.strengthDM,arm.dexterityDM]),[[1,7,8,0,0],[1,12,12,2,2]]);
 assert.equal(has(result,'WEAPON_ARM_SIZE'),false);assert.equal(has(result,'HELD_TWO_HANDED_WEAPON_UNRESOLVED'),false);assert.ok(has(result,'HELD_MULTI_ARM_CHARACTERISTICS'));assert.ok(has(result,'HELD_CARRYING_FIT'));
 const integrated=evaluateDesign(design([selected]));assert.equal(integrated.status,'verified');assert.equal(integrated.totals.weapons[0].cost,cost);
 const raw=WEAPONS.find(w=>w.id===id);if(raw.magazine){assert.equal(weapon.initialAmmunition.count,1);assert.equal(weapon.initialAmmunition.purchaseCost,raw.magazineCost);assert.equal(weapon.ammunitionInventory.totalRounds,raw.magazine);assert.deepEqual(weapon.conditionalEffects,raw.conditionalEffects);assert.equal(weapon.handednessBasis.explicitPrintedHandCount,false);assert.ok(has(result,'HELD_HANDEDNESS_INTERPRETATION'));}
 if(id==='csc-staff'){assert.equal(weapon.conditionalEffects.parry.automaticBonusApplied,false);assert.equal(weapon.conditionalEffects.parry.requiresMeleeSkill,true);assert.equal(weapon.conditionalEffects.parry.resolved,false);}
});

test('Second grip: Basic FCS is charged once and cannot choose an arm DM',()=>{
 const r=direct([record('csc-broadsword',{supportManipulatorId:'base-2',fireControl:'basic'})],arms,[{id:'melee:blade',level:4}]);noConstructionErrors(r);
 assert.equal(r.cost,10500);assert.equal(r.slots,1);assert.equal(r.weapons[0].fireControlDM,1);assert.equal(r.weapons[0].softwareLevel,4);assert.equal(r.weapons[0].baseAttackModifier,null);
 for(const pair of [arms.slice(0,2),arms.slice(0,2).reverse()]){const w=direct([record('csc-broadsword',{manipulatorId:pair[0].id,supportManipulatorId:pair[1].id})],pair).weapons[0];assert.equal(w.effectiveDexterity,null);assert.equal(w.effectiveStrength,null);assert.equal(w.manipulatorDM,null);assert.equal(w.baseAttackModifier,null);}
});

for(const id of ['csc-battle-axe','csc-long-blade-1','csc-long-blade-3'])test('Second grip: '+id+' retains optional one-hand use without an extra benefit',()=>{
 const one=direct([record(id)]),two=direct([record(id,{supportManipulatorId:'base-2'})]);noConstructionErrors(one);noConstructionErrors(two);
 const a=one.weapons[0],b=two.weapons[0];assert.equal(a.gripAssignmentStatus,'assigned');assert.equal(a.multiArm,false);assert.equal(a.effectiveStrength,7);assert.equal(a.effectiveDexterity,8);assert.equal(a.baseAttackModifier,-3);
 assert.equal(b.cost,a.cost);assert.equal(b.slots,a.slots);assert.equal(b.damage,a.damage);assert.equal(b.mountClass,'small');assert.equal(b.baseAttackModifier,null);assert.equal(b.gripBenefitGranted,false);assert.equal(b.handednessBasis.optionalSecondGrip,true);
});

test('Second grip: missing, unknown, same and removed arms remain repairable errors',()=>{
 const cases=[[{},'HELD_SUPPORT_REQUIRED','missing-support'],[{supportManipulatorId:'none'},'HELD_SUPPORT_REQUIRED','missing-support'],[{supportManipulatorId:'missing-arm'},'HELD_SUPPORT_REQUIRED','missing-support'],[{supportManipulatorId:'base-1'},'HELD_GRIPS_MUST_DIFFER','same-manipulator'],[{manipulatorId:'missing-arm',supportManipulatorId:'base-2'},'WEAPON_ARM_REQUIRED','missing-primary']];
 for(const [patch,code,status]of cases){const d=design([record('csc-broadsword',patch)]),copy=importDesign(exportDesign(d)),r=evaluateDesign(copy);assert.equal(r.status,'invalid');assert.ok(has(r,code));assert.equal(r.diagnostics.find(x=>x.code===code).severity,'error');assert.equal(total(r).weapons[0].gripAssignmentStatus,status);assert.equal(total(r).weapons[0].baseAttackModifier,null);assert.deepEqual(copy,d);}
 let d=design();const original=structuredClone(d.selections.physical.manipulators);d=updateDesign(d,{selections:{physical:{manipulators:original.filter(a=>a.id!=='base-2')}}});
 assert.equal(d.selections.physical.weapons[0].supportManipulatorId,'base-2');assert.ok(has(evaluateDesign(d),'HELD_SUPPORT_REQUIRED'));
 d=updateDesign(d,{selections:{physical:{manipulators:original}}});assert.equal(evaluateDesign(d).status,'verified');assert.equal(d.selections.physical.weapons[0].supportManipulatorId,'base-2');
});

test('Second grip: schema checks structure while old JSON and unresolved references round-trip',()=>{
 const old=design([record('autopistol')]);assert.deepEqual(importDesign(exportDesign(old)),old);assert.equal(Object.hasOwn(old.selections.physical.weapons[0],'supportManipulatorId'),false);
 for(const bad of ['',null,3,{},[],'bad reference','A','a'.repeat(41)]){const r=record('csc-staff',{supportManipulatorId:bad});assert.throws(()=>validateWeapons([r]),TypeError);const d=structuredClone(old);d.selections.physical.weapons=[r];assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);}
 for(const id of ['none','base-2','missing-arm','a'.repeat(40)])assert.doesNotThrow(()=>validateWeapons([record('csc-staff',{supportManipulatorId:id})]));
});

test('Second grip: stale non-held or unsupported selections are retained and receive no attack claim',()=>{
 for(const placement of ['body','arm']){const r=record('csc-broadsword',{placement,manipulatorId:placement==='body'?'none':'base-1',supportManipulatorId:'base-2'}),out=direct([r]);assert.ok(has(out,'WEAPON_UNUSED_SUPPORT'));assert.equal(out.weapons[0].supportManipulatorId,'base-2');assert.equal(out.weapons[0].gripAssignmentStatus,'non-held-support');assert.equal(out.weapons[0].baseAttackModifier,null);}
 const r=direct([record('autopistol',{supportManipulatorId:'base-2'})]);assert.ok(has(r,'HELD_SUPPORT_UNSUPPORTED'));assert.equal(r.weapons[0].gripAssignmentStatus,'unsupported-support');assert.equal(r.weapons[0].baseAttackModifier,null);assert.equal(r.weapons[0].cost,210);
 const heavy=direct([record('heavy-machinegun',{supportManipulatorId:'base-2'})]);assert.ok(has(heavy,'HELD_VEHICLE_WEAPON_UNRESOLVED'));assert.equal(heavy.weapons[0].baseAttackModifier,null);
 for(const patch of [{linkedWeapons:2},{autoload:true,extraMagazines:1}])assert.ok(has(direct([record('csc-long-bow',{supportManipulatorId:'base-2',...patch})]),'HELD_WEAPON_MOUNT'));
});

test('Grip occupancy: two Autopistols cannot both use one hand, despite Cr420 ownership price',()=>{
 const records=[record('autopistol',{id:'pistol-one'}),record('autopistol',{id:'pistol-two'})],r=evaluateDesign(design(records));assert.equal(r.status,'invalid');assert.equal(total(r).weapons.reduce((sum,w)=>sum+w.cost,0),420);
 assert.equal(r.diagnostics.filter(d=>d.code==='HELD_GRIP_OCCUPIED').length,2);for(const w of total(r).weapons){assert.equal(w.gripAssignmentStatus,'conflicting');assert.equal(w.baseAttackModifier,null);assert.equal(w.manipulatorDM,null);assert.notEqual(w.primaryManipulatorDM,null);}
 assert.match(r.diagnostics.find(d=>d.code==='HELD_GRIP_OCCUPIED').message,/held loadout/);assert.match(r.diagnostics.find(d=>d.code==='HELD_GRIP_OCCUPIED').message,/Owning or stowing/);
});

test('Grip occupancy: primary/primary, primary/support and support/support collisions fail',()=>{
 for(const pair of [['base-1','third-arm'],['base-2','third-arm'],['third-arm','base-2']]){
  const r=direct([record('csc-staff',{id:'first',supportManipulatorId:'base-2'}),record('csc-staff',{id:'second',manipulatorId:pair[0],supportManipulatorId:pair[1]})]);assert.equal(r.diagnostics.filter(d=>d.code==='HELD_GRIP_OCCUPIED').length,2);for(const w of r.weapons)assert.equal(w.gripAssignmentStatus,'conflicting');
 }
 const four=direct([record('csc-staff',{id:'first',supportManipulatorId:'base-2'}),record('csc-staff',{id:'second',manipulatorId:'third-arm',supportManipulatorId:'fourth-arm'})]);noConstructionErrors(four);assert.ok(four.weapons.every(w=>w.gripAssignmentStatus==='assigned'));assert.equal(four.cost,10);
});

test('Grip occupancy: pair plus pistol needs a third hand, while an attached mount reserves no hand',()=>{
 const staff=record('csc-staff',{id:'staff',supportManipulatorId:'base-2'}),pistol=record('autopistol',{id:'pistol'});
 for(const id of ['base-1','base-2'])assert.ok(has(direct([staff,{...pistol,manipulatorId:id}]),'HELD_GRIP_OCCUPIED'));
 noConstructionErrors(direct([staff,{...pistol,manipulatorId:'third-arm'}]));
 const mounted=direct([staff,{...pistol,placement:'arm'}],arms.map(a=>({...a,size:5})));noConstructionErrors(mounted);assert.equal(has(mounted,'HELD_GRIP_OCCUPIED'),false);assert.equal(mounted.weapons[1].gripAssignmentStatus,'not-applicable');assert.deepEqual(mounted.weapons[1].gripManipulatorIds,[]);assert.equal(mounted.weapons[1].cost,710);
});

test('Second grip: actual converted walker leg can support, but skipped invalid arms cannot',()=>{
 const d=design();d.selections.locomotion.primary='walker';d.selections.physical.manipulators.push({id:'walker-grip',kind:'leg',size:'chassis',strengthIncrease:0,dexterityIncrease:0});d.selections.physical.weapons[0].supportManipulatorId='walker-grip';assert.equal(evaluateDesign(d).status,'verified');
 d.selections.physical.manipulators[2]={id:'oversized',kind:'additional',size:10,strengthIncrease:0,dexterityIncrease:0};d.selections.physical.weapons[0].supportManipulatorId='oversized';const r=evaluateDesign(d);assert.ok(has(r,'MANIPULATOR_SIZE'));assert.ok(has(r,'HELD_SUPPORT_REQUIRED'));
});

test('Second grip: low STR retains Bulky conditions rather than a purchase ban or sum',()=>{
 for(const [id,threshold]of [['csc-broadsword',9],['csc-great-axe',12],['csc-long-bow',9]]){
  const r=direct([record(id,{supportManipulatorId:'base-2'})],arms.map(a=>({...a,strength:1})));noConstructionErrors(r);const w=r.weapons[0];assert.equal(w.heldStrengthRequirement.minimumStrength,threshold);assert.equal(w.heldStrengthRequirement.constructionBan,false);assert.equal(w.heldStrengthRequirement.penaltyResolved,false);assert.equal(w.heldStrengthRequirement.effectiveStrength,null);assert.ok(has(r,'HELD_STRENGTH_CONDITION'));
 }
});

test('Second grip controls: source-positive options, visible corrections and readable labels',()=>{
 const d=design(),c=weaponControl(d),field=c.itemFields.find(f=>f.field==='supportManipulatorId');assert.equal(field.default,'none');assert.equal(field.omitByDefault,true);assert.equal(field.resetWhenHidden,undefined);assert.equal(field.resetWhenUnavailable,undefined);
 assert.deepEqual(field.visibleWhen.anyOf[1].allOf[1].oneOf,[...WEAPONS.filter(w=>w.requiresTwoHands||w.handedness?.alternateTwoHandedUse).map(w=>w.id)]);
 assert.deepEqual(field.choices.map(c=>c.label),['None','Base arm 1','Base arm 2']);assert.deepEqual(c.itemFields.find(f=>f.field==='manipulatorId').choices.map(c=>c.label),['None','Base arm 1','Base arm 2']);
 const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8'),matches=app.match(/function matchesVisibility\([\s\S]*?\n}/)[0],reset=app.match(/function resetHiddenFields\([\s\S]*?\n}/)[0],helper=runInThisContext('(function(){'+matches+'\n'+reset+';return {matchesVisibility,resetHiddenFields};})')();
 for(const placement of ['body','arm','held']){const r=record('autopistol',{placement,supportManipulatorId:'base-2'});assert.equal(helper.matchesVisibility(field,r),true);assert.equal(helper.resetHiddenFields(c,r).supportManipulatorId,'base-2');}
 assert.equal(helper.matchesVisibility(field,{placement:'held',weaponId:'csc-broadsword',supportManipulatorId:'none'}),true);assert.equal(helper.matchesVisibility(field,{placement:'held',weaponId:'autopistol',supportManipulatorId:'none'}),false);
 d.selections.physical.manipulators.pop();const missing=weaponControl(d).itemFields.find(f=>f.field==='supportManipulatorId').choices.find(c=>c.id==='base-2');assert.equal(missing.label,'Unavailable manipulator');assert.equal(missing.eligibility.available,false);
 field.choices[1].label='Mutated';field.visibleWhen.anyOf[1].allOf[1].oneOf.length=0;assert.equal(weaponControl(design()).itemFields.find(f=>f.field==='supportManipulatorId').choices[1].label,'Base arm 1');
});

test('Second grip: API copies, repeated repairs and component profiles stay isolated and readable',()=>{
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}}),d=design();api.importDesign(exportDesign(d));let view=api.getView();
 assert.equal(view.evaluation.status,'verified');view.design.selections.physical.weapons[0].supportManipulatorId='bad';view.evaluation.totals.weapons[0].gripManipulators[0].dexterity=99;view.evaluation.totals.weapons[0].handednessBasis.source.pages='bad';
 assert.equal(api.getView().design.selections.physical.weapons[0].supportManipulatorId,'base-2');assert.notEqual(api.getView().evaluation.totals.weapons[0].gripManipulators[0].dexterity,99);
 for(let i=0;i<2;i++){for(const supportManipulatorId of ['base-1','missing-arm','none','base-2']){const next=design([record('csc-broadsword',{supportManipulatorId})]);api.importDesign(exportDesign(next));assert.equal(api.getView().evaluation.status,supportManipulatorId==='base-2'?'verified':'invalid');}}
 const text=api.getStatblock();assert.match(text,/Base arm 1/);assert.match(text,/Base arm 2/);assert.match(text,/Effective Dexterity: Not calculated/);assert.doesNotMatch(text,/base-1|base-2|supportManipulatorId|gripManipulatorIds/);
 const parent=updateDesign(createDesign({kind:'ship-brain',techLevel:14}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:d}]}}),result=evaluateDesign(parent);assert.equal(result.status,'verified');assert.deepEqual(result.composite.components[0].profile.weapons[0].gripManipulatorIds,['base-1','base-2']);
 const output=formatStatblock(projectReview(parent,getCatalogue(parent),result));assert.match(output,/Base arm 1/);assert.match(output,/Base arm 2/);assert.doesNotMatch(output,/base-1|base-2|supportManipulatorId|gripManipulatorIds/);
});

test('Second grip: per-limb adapter excludes selector and rejects imported cross-limb support',()=>{
 const base=updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:2}}]}}),fields=getCatalogue(base).stages.flatMap(s=>s.controls).find(c=>c.field==='augmentWeapons').itemFields;assert.equal(fields.some(f=>f.field==='supportManipulatorId'),false);
 const {manipulatorId,...weapon}=record('csc-long-blade-1',{placement:'arm',parentLimb:'limb'});
 for(const supportManipulatorId of ['base-1','limb','other-limb']){const d=structuredClone(base);d.special.augmentWeapons=[{...weapon,supportManipulatorId}];assert.throws(()=>importDesign(JSON.stringify(d)),/Support grips/);}
 const d=updateDesign(base,{special:{augmentWeapons:[{...weapon,supportManipulatorId:'none'}]}}),r=evaluateDesign(d);assert.equal(r.status,'verified');assert.equal(r.totals.augmentations[0].weapons[0].copies,2);assert.equal(r.totals.augmentations[0].weaponCost,1400);assert.equal(r.totals.augmentations[0].weaponAccounting.perLimbSlots,1);
});


test('Second grip: stored archaic loads preserve split allocation and are purchased only once',()=>{
 const selected=record('csc-compound-cam-bow',{supportManipulatorId:'base-2',extraMagazines:2,spareMagazineStorageId:'option:storage-compartment',autoloadAllocation:{standard:0,highCapacity:0}});
 const d=updateDesign(design([selected]),{selections:{physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:1}}}}}),r=evaluateDesign(d);assert.equal(r.status,'verified');
 const w=r.totals.weapons[0];assert.equal(w.cost,265);assert.equal(w.slots,0);assert.equal(w.initialAmmunition.count,1);assert.equal(w.initialAmmunition.purchaseCost,5);assert.equal(w.ammunitionInventory.standardSpareCount,2);assert.equal(w.ammunitionInventory.totalCost,15);assert.equal(w.ammunitionInventory.autoloadCost,0);assert.equal(w.ammunitionInventory.allocation.standard.storedCount,2);assert.equal(w.spareAmmunition.count,2);
 assert.equal(r.ledger.filter(x=>x.id==='weapon-held-test').length,1);assert.equal(r.ledger.reduce((sum,x)=>sum+x.cost,0),r.totals.cost);assert.deepEqual(importDesign(exportDesign(d)),d);
 const legacy=structuredClone(d);delete legacy.selections.physical.weapons[0].autoloadAllocation;const before=evaluateDesign(legacy).totals.weapons[0];assert.equal(before.cost,w.cost);assert.equal(before.ammunitionInventory.totalRounds,w.ammunitionInventory.totalRounds);assert.equal(before.spareAmmunition.massKg,w.spareAmmunition.massKg);
});

test('Second grip: a one-hand weapon uses its own actual arm, not the highest other arm or agility',()=>{
 const w=direct([record('autopistol')],arms,[{id:'gun-combat:slug',level:2}]).weapons[0];assert.equal(w.effectiveDexterity,8);assert.equal(w.effectiveStrength,7);assert.equal(w.manipulatorDM,0);assert.equal(w.baseAttackModifier,2);assert.deepEqual(w.gripManipulatorIds,['base-1']);
 const d=design([record('autopistol')]);d.selections.physical.agility=1;d.selections.physical.manipulators[1].dexterityIncrease=4;const r=evaluateDesign(d);assert.equal(r.status,'verified');assert.equal(r.totals.weapons[0].effectiveDexterity,8);assert.equal(r.totals.weapons[0].manipulatorDM,0);
});
