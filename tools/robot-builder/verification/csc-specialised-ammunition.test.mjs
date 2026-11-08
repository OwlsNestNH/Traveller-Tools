import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS,MOUNTS,validateWeapons,evaluateWeapons,weaponRecordPresentation,weaponControl} from '../engine/weapons.mjs';
import {CSC_SPECIALISED_AMMUNITION_IDS,specialisedAmmunitionCategory,specialisedAmmunitionChoices,transformSpecialisedAmmunition,ammunitionProductIdentity} from '../engine/csc-specialised-ammunition.mjs';
import {createDesign,updateDesign,evaluateDesign,exportDesign,importDesign,getCatalogue} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
const weapon=id=>WEAPONS.find(w=>w.id===id),ref='option:storage-compartment';
const record=(patch={})=>({id:'ammo-test',weaponId:'csc-gauss-sniper-rifle',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,weaponManufactureTL:12,initialAmmunitionModification:'apds',...patch});
const direct=(r=record(),tl=23,storage=[{id:'storage-compartment',quantity:1000}])=>{validateWeapons([r]);return evaluateWeapons({kind:'standard',techLevel:tl,selections:{physical:{weapons:[r]}}},[],[],storage);};
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const design=r=>updateDesign(createDesign({techLevel:23}),{name:'Specialised ammunition fixture',selections:{chassis:{size:'size-7'},physical:{weapons:[r],options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:20}}}}});
const baseline=id=>{const r=record({weaponId:id});delete r.weaponManufactureTL;delete r.initialAmmunitionModification;return r;};
const expectedCategories={pistol:['assault-pistol','cartridge-pistol','heavy-revolver','universal-auto-pistol'],rifle:['accelerator-rifle-11','big-game-rifle','gauss-rifle','gauss-sniper-rifle','gauss-submachinegun','sniper-rifle','snub-carbine','heavy-advanced-combat-rifle'],shotgun:['assault-shotgun','sawn-off-shotgun','light-shotgun'],heavy:['grenade-launcher-standard','ram-grenade-launcher-standard']};
test('specialised source capability is exactly the bounded positive registry, without a global weapon count',()=>{
 assert.deepEqual([...CSC_SPECIALISED_AMMUNITION_IDS].sort(),Object.values(expectedCategories).flat().map(id=>'csc-'+id).sort());
 for(const [category,ids] of Object.entries(expectedCategories))for(const id of ids){const w=weapon('csc-'+id);assert.equal(specialisedAmmunitionCategory(w),category);assert.equal(w.compatibility.specialisedAmmunitionRules,'csc-single-modification-v1');}
 for(const w of WEAPONS.filter(w=>!CSC_SPECIALISED_AMMUNITION_IDS.includes(w.id))){assert.equal(specialisedAmmunitionCategory(w),null,w.id);assert.deepEqual(specialisedAmmunitionChoices(w).map(x=>x.id),['standard']);}
 const source=weapon('csc-gauss-rifle');for(const patch of [{sourceFamily:'core-2022'},{magazineCost:null},{magazine:null}])assert.equal(specialisedAmmunitionCategory({...source,...patch}),null);
});
for(const id of CSC_SPECIALISED_AMMUNITION_IDS)for(const modification of ['armour-piercing','solid-shot','apds','baton','extended-range'])test(id+' / '+modification+' source/category/manufacture checks',()=>{
 const w=weapon(id),category=specialisedAmmunitionCategory(w),allowed=(modification!=='apds'||['rifle','heavy'].includes(category))&&(modification!=='extended-range'||category!=='shotgun'),minimum=modification==='armour-piercing'?4:modification==='extended-range'?7:5;
 const r=direct(record({weaponId:id,weaponManufactureTL:w.tl,initialAmmunitionModification:modification})),out=r.weapons[0];
 if(!allowed||w.tl<minimum){assert.equal(out.cost,null);assert.equal(out.damage,null);assert.ok(has(r,!allowed?'CSC_AMMO_CATEGORY':'CSC_AMMO_MANUFACTURE_TL'));}
 else {assert.ok(Number.isFinite(out.cost));assert.equal(out.initialAmmunition.unitCost,w.magazineCost*({ 'armour-piercing':4,'solid-shot':2,apds:5,baton:2,'extended-range':3 }[modification]));assert.equal(out.sourceWeaponProfile.damage,w.damage);assert.equal(out.initialAmmunition.included,w.initialIncluded);assert.equal(out.weaponManufacture.scope,'all-linked-copies');}
});
test('exact transformations preserve AP addition, APDS points, fractional ranges and conditional Baton split',()=>{
 const sniper=weapon('csc-gauss-sniper-rifle');
 for(const [id,damage,range,ap]of [['armour-piercing','5D',1000,11],['solid-shot','5D',750,9],['apds','5D-5',1100,21],['extended-range','4D',1250,6]]){const p=transformSpecialisedAmmunition(sniper,id);assert.equal(p.damage,damage);assert.equal(p.range,range);assert.ok(p.traits.includes('AP '+ap));assert.ok(p.traits.includes('Scope'));}
 assert.equal(transformSpecialisedAmmunition(weapon('csc-big-game-rifle'),'apds').damage,'3D');
 const snub=transformSpecialisedAmmunition(weapon('csc-snub-carbine'),'extended-range');assert.equal(snub.damage,'2D-3');assert.equal(snub.range,93.75);
 const grenade=weapon('csc-grenade-launcher-standard'),baton=transformSpecialisedAmmunition(grenade,'baton');assert.equal(baton.damage,'5D');assert.equal(baton.range,75);assert.ok(!baton.traits.some(t=>t.startsWith('AP')||t.startsWith('Blast')||t==='Stun'));assert.deepEqual(baton.traits,grenade.traits.filter(t=>!t.startsWith('Blast')&&!t.startsWith('AP')));assert.deepEqual([baton.conditionalEffects.batonDamageSplit.stunFraction,baton.conditionalEffects.batonDamageSplit.roundStun,baton.conditionalEffects.batonDamageSplit.ordinaryRemainder,baton.conditionalEffects.batonDamageSplit.armourProcessingOrder],[.5,'up',true,'unresolved']);
 const piercing=transformSpecialisedAmmunition(grenade,'armour-piercing');assert.ok(piercing.traits.includes('Blast 6'));assert.ok(piercing.traits.includes('AP 5'));
});
test('shot spread and pellet rules never leak into modified ammunition; source stays unchanged',()=>{
 for(const id of ['csc-assault-shotgun','csc-sawn-off-shotgun','csc-light-shotgun']){const w=weapon(id),before=structuredClone(w);for(const mod of ['armour-piercing','solid-shot','baton']){const result=transformSpecialisedAmmunition(w,mod);assert.equal(result.conditionalEffects.pelletAmmunition,undefined);assert.equal(result.conditionalEffects.attackModifiers,undefined);assert.equal(result.conditionalEffects.nonPelletAmmunition.spreadBonusApplied,false);}assert.deepEqual(w,before);}
});
test('explicit manufacturing declaration is independent of robot TL and never modernizes hardware',()=>{
 const original=baseline('csc-assault-pistol');assert.equal(direct(original).weapons[0].weaponManufacture,undefined);assert.equal(direct(original).weapons[0].sourceWeaponProfile,undefined);
 for(const tl of [undefined,null,4,5,7,30]){const selected=record({weaponId:'csc-assault-pistol',weaponManufactureTL:tl,initialAmmunitionModification:'armour-piercing'});if(tl===undefined)delete selected.weaponManufactureTL;const r=direct(selected);assert.equal(r.weapons[0].cost,null);assert.equal(r.weapons[0].weaponManufacture.declaredTL,tl??null);assert.ok(has(r,tl==null?'CSC_AMMO_MANUFACTURE_REQUIRED':'CSC_AMMO_MANUFACTURE_TIER_UNRESOLVED'));}
 const highRobot=direct(record({weaponId:'csc-assault-pistol',weaponManufactureTL:6,initialAmmunitionModification:'extended-range'}),23);assert.ok(has(highRobot,'CSC_AMMO_MANUFACTURE_TL'));assert.equal(highRobot.weapons[0].cost,null);
 const lowRobot=direct(record(),4);assert.ok(has(lowRobot,'CSC_AMMO_DESIGN_TL'));assert.ok(has(lowRobot,'WEAPON_TL'));
});
test('unknown and unsupported retained modifiers do not become standard or free purchases',()=>{
 for(const patch of [{initialAmmunitionModification:'unknown-variant'},{weaponId:'csc-arl-standard',weaponManufactureTL:10},{weaponId:'gauss-rifle',weaponManufactureTL:12},{weaponId:'csc-gauss-assault-gun',weaponManufactureTL:10}]){const r=direct(record(patch)),w=r.weapons[0];assert.equal(w.cost,null);assert.equal(w.damage,null);assert.equal(w.initialAmmunition.modification,patch.initialAmmunitionModification??'apds');assert.ok(r.diagnostics.some(d=>d.code.startsWith('CSC_AMMO_')));}
 const r=direct(record({initialMagazines:0,initialAmmunitionModification:'obsolete'}));assert.equal(r.weapons[0].ammunitionInventory.ammunitionCost,null);assert.equal(r.weapons[0].loadedAmmunitionAttack.status,'unloaded');
 for(const id of ['',{},'bad id'])assert.throws(()=>validateWeapons([record({initialAmmunitionModification:id})]));
 assert.throws(()=>validateWeapons([record({weaponManufactureTL:'12'})]));assert.throws(()=>validateWeapons([record({weaponManufactureTL:12.5})]));
 const source=direct(record({initialMagazineSourceId:'unknown-source'}));assert.ok(has(source,'MAGAZINE_SOURCE_INCOMPATIBLE'));assert.equal(source.weapons[0].cost,null);assert.equal(source.weapons[0].damage,null);
});
test('source, capacity and modification identities keep all purchases separate with qualified unchanged mass',()=>{
 const r=record({weaponId:'csc-assault-pistol',weaponManufactureTL:6,initialAmmunitionModification:'baton',initialMagazineType:'high-capacity',extraMagazines:2,spareAmmunitionModification:'armour-piercing',spareMagazineStorageId:ref,extraHighCapacityMagazines:3,highCapacityAmmunitionModification:'solid-shot',highCapacityMagazineStorageId:ref,autoload:true,autoloadAllocation:{standard:1,highCapacity:2},alternateMagazineSupplies:[{sourceWeaponId:'csc-assault-pistol',variant:'standard',modification:'baton',extraMagazines:2,autoloadMagazines:1,storageId:ref}]});
 const out=direct(r).weapons[0],inv=out.ammunitionInventory;
 assert.equal(inv.ammunitionCost,60+40+60+20);assert.equal(inv.autoloadCost,2*(40+120+20));assert.equal(out.cost,250+500+180+360);
 assert.equal(inv.products.length,4);assert.equal(new Set(inv.products.map(p=>p.productId)).size,4);assert.equal(inv.allocation.autoloadCountPerWeapon,4);assert.equal(inv.allocation.storedCountPerWeapon,3);
 for(const product of inv.products){assert.equal(product.estimate.modifiedLoadMassResolved,false);assert.equal(product.estimate.actualModifiedMassKg,null);assert.equal(product.estimate.unitMassKg,product.variant==='high-capacity'?.15:.075);}
 assert.equal(direct(r).ammunitionStorage[0].reservedKg,.3);assert.equal(out.sourceWeaponProfile.damage,'3D-3');assert.equal(out.damage,'3D-3');assert.ok(!out.traits.some(t=>t.startsWith('AP')));
});
test('all physical supply variants share loader, allocation and reserve bounds',()=>{
 const extra={sourceWeaponId:'csc-gauss-sniper-rifle',variant:'standard',modification:'baton',extraMagazines:6,autoloadMagazines:6,storageId:'none'};
 const r=record({autoload:true,extraMagazines:5,autoloadAllocation:{standard:5,highCapacity:0},alternateMagazineSupplies:[extra]});assert.ok(has(direct(r),'AUTOLOAD_ALLOCATION_LIMIT'));assert.equal(direct(r).weapons[0].cost,null);
 extra.autoloadMagazines=7;assert.ok(has(direct(r),'AUTOLOAD_ALLOCATION_EXCEEDS_SUPPLY'));
 extra.autoloadMagazines=0;extra.extraMagazines=100;r.autoload=false;r.autoloadAllocation.standard=0;assert.ok(has(direct(r),'STORED_AMMO_APPLICATION_LIMIT'));
 const overflow=direct(record({extraMagazines:2,spareAmmunitionModification:'apds',spareMagazineStorageId:ref}),23,[{id:'storage-compartment',quantity:0}]);assert.ok(has(overflow,'AMMUNITION_STORAGE_CAPACITY'));
});
test('reserve modification cannot alter an initial standard attack; no initial load means no loaded attack',()=>{
 const r=record({initialAmmunitionModification:'standard',extraMagazines:1,spareAmmunitionModification:'baton',spareMagazineStorageId:ref}),out=direct(r).weapons[0];assert.equal(out.damage,'5D');assert.ok(out.traits.includes('AP 6'));assert.equal(out.loadedAmmunitionAttack.status,'homogeneous');
 r.initialMagazines=0;const empty=direct(r).weapons[0];assert.equal(empty.damage,null);assert.equal(empty.range,null);assert.deepEqual(empty.traits,[]);assert.equal(empty.linkedDamageBonus,null);assert.equal(empty.ammunitionAttackProfiles[0].damage,'5D');assert.equal(empty.ammunitionAttackProfiles[0].loaded,false);assert.equal(empty.loadedAmmunitionAttack.status,'unloaded');
});
test('homogeneous Extended linked bonus uses modified dice; APDS uses full dice; mixed copies never borrow a profile',()=>{
 for(const [mod,damage,bonus]of [['extended-range','4D',12],['apds','5D-5',15]]){const out=direct(record({linkedWeapons:4,initialAmmunitionModification:mod})).weapons[0];assert.equal(out.damage,damage);assert.equal(out.linkedDamageBonus,bonus);assert.ok(!out.damage.includes('DD'));}
 const r=record({linkedWeapons:2}),override={copyIndex:2,...weaponRecordPresentation(r,2).ammunitionCustomization.materializedValue,initialAmmunitionModification:'extended-range'};r.ammunitionOverrides=[override];const out=direct(r).weapons[0];assert.equal(out.loadedAmmunitionAttack.status,'mixed-unresolved');assert.equal(out.damage,null);assert.equal(out.range,null);assert.equal(out.linkedDamageBonus,null);assert.deepEqual(out.traits,[]);assert.deepEqual(out.ammunitionAttackProfiles.map(p=>p.damage),['5D-5','4D']);assert.ok(Number.isFinite(out.cost));assert.equal(out.ammunitionInventory.products.filter(p=>p.initialCount).length,2);
 override.initialAmmunitionModification='apds';override.initialMagazines=0;assert.equal(direct(r).weapons[0].loadedAmmunitionAttack.status,'mixed-unresolved');
});
test('new optional fields are complete per-copy but manufacture belongs to shared hardware',()=>{
 const r=record({linkedWeapons:2,extraMagazines:1,spareAmmunitionModification:'baton',spareMagazineStorageId:ref});const copy=weaponRecordPresentation(r,2).ammunitionCustomization.materializedValue;assert.equal(copy.weaponManufactureTL,undefined);r.ammunitionOverrides=[{copyIndex:2,...copy}];r.spareAmmunitionModification='solid-shot';r.extraMagazines=3;
 const out=direct(r).weapons[0];assert.equal(out.ammunitionCopies[1].ammunitionInventory.standardSpareCount,1);assert.ok(out.ammunitionCopies[1].ammunitionInventory.products.some(p=>p.modification==='baton'&&p.extraCount===1));
 r.linkedWeapons=1;const removed=direct(r);assert.ok(has(removed,'AMMUNITION_COPY_NOT_INSTALLED'));assert.equal(removed.weapons[0].ammunitionAttackProfiles.length,1);assert.equal(removed.weapons[0].ammunitionInventory.standardSpareCount,3);
 const legacy=baseline('csc-assault-pistol');const controls=weaponControl().itemFields;for(const field of ['weaponManufactureTL','initialAmmunitionModification','spareAmmunitionModification','highCapacityAmmunitionModification'])assert.ok(controls.find(x=>x.field===field).omitByDefault);assert.deepEqual(importDesign(exportDesign(design(legacy))).selections.physical.weapons[0],legacy);
});
test('ARL standard/support products and PDW exclusion remain unchanged',()=>{
 for(const receiver of ['csc-arl-standard','csc-arl-support']){
  const r=baseline(receiver),selection=weaponRecordPresentation(r).magazineSupplySelection;assert.equal(selection.maximumAlternateProducts,2);assert.deepEqual(selection.products.map(p=>[p.productId,p.capacity,p.unitCost,p.estimate.unitMassKg]),[['csc-arl-standard:standard',20,100,.3],['csc-arl-standard:high-capacity',40,300,.6],['csc-arl-support:standard',40,200,.8],['csc-arl-support:high-capacity',80,600,1.6]]);
 }
 const pdw=direct({...baseline('csc-arl-pdw'),initialMagazineSourceId:'csc-arl-standard'});assert.ok(has(pdw,'MAGAZINE_SOURCE_INCOMPATIBLE'));assert.equal(pdw.weapons[0].cost,null);
});
test('JSON, explicit API saves and mutation isolation preserve selected modified identities',async()=>{
 const source=design(record({initialAmmunitionModification:'armour-piercing'})),roundTrip=importDesign(exportDesign(source));assert.deepEqual(roundTrip,source);
 const store=new Map(),api=createRobotApi({storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},locks:{request:async(_name,_options,fn)=>fn()},idFactory:()=> 'ammo-save'});
 api.importDesign(exportDesign(source));await api.saveDesign();const saved=api.getView();assert.equal(saved.design.selections.physical.weapons[0].initialAmmunitionModification,'armour-piercing');
 saved.evaluation.totals.weapons[0].ammunitionAttackProfiles[0].traits.push('mutated');saved.design.selections.physical.weapons[0].weaponManufactureTL=30;assert.equal(api.getView().design.selections.physical.weapons[0].weaponManufactureTL,12);assert.ok(!api.getView().evaluation.totals.weapons[0].traits.includes('mutated'));
 const before=structuredClone(WEAPONS);const evaluation=evaluateDesign(source);evaluation.totals.weapons[0].sourceWeaponProfile.traits.push('poisoned');assert.deepEqual(WEAPONS,before);getCatalogue(source).controls;
});

test('source accessory thresholds and stock range-band semantics stay separate from ammunition range',()=>{
 const r=record({weaponId:'csc-universal-auto-pistol',weaponManufactureTL:8,initialAmmunitionModification:'extended-range',accessories:['csc-laser-sight-8','csc-shoulder-stock']});const out=direct(r).weapons[0];assert.equal(out.range,weapon(r.weaponId).range*1.25);assert.deepEqual(out.accessoryEffects.find(e=>e.accessory==='csc-laser-sight-8').rangeMetres,{maximum:50,maximumInclusive:false});assert.deepEqual(out.accessoryEffects.find(e=>e.accessory==='csc-shoulder-stock').rangeMultipliers,{effective:1.25,long:1.25,extreme:1});
});
test('invalid high-capacity imported loads stay unresolved without expanding conversion scope',()=>{
 const r=direct(record({initialMagazineType:'high-capacity'}));assert.ok(has(r,'CSC_HIGH_CAPACITY_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.equal(r.weapons[0].loadedAmmunitionAttack.status,'unresolved');assert.equal(r.weapons[0].damage,null);
});
test('whole-component quantities preserve their ammunition while brain-only costs exclude hardware',()=>{
 const child=design(record()),childResult=evaluateDesign(child);assert.equal(childResult.status,'verified');
 const parent=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component-ammo',role:'installed-robot',quantity:1,design:child}]}}),result=evaluateDesign(parent),component=result.composite.components[0];assert.equal(result.status,'verified');assert.equal(component.constructionCost,childResult.totals.constructionCost);assert.equal(component.profile.weapons[0].damage,'5D-5');assert.equal(component.profile.weapons[0].weaponManufacture.declaredTL,12);
 const bare=updateDesign(createDesign({kind:'vehicle-brain',techLevel:23}),{special:{designReferences:[{id:'brain-only',role:'installed-brain',quantity:1,design:child}]}}),brain=evaluateDesign(bare);assert.equal(brain.status,'verified');assert.equal(brain.composite.components[0].costScope,'Brain, upgrades and software only');const ordinary=design(baseline('csc-gauss-sniper-rifle')),bareOrdinary=updateDesign(bare,{special:{designReferences:[{id:'brain-only',role:'installed-brain',quantity:1,design:ordinary}]}});assert.equal(brain.totals.cost,evaluateDesign(bareOrdinary).totals.cost);
 const limbRecord=record({weaponId:'csc-assault-pistol',weaponManufactureTL:6,initialAmmunitionModification:'baton',placement:'arm',parentLimb:'limb'});delete limbRecord.manipulatorId;
 const limb=updateDesign(createDesign({kind:'cyborg',techLevel:23}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:1}}],augmentWeapons:[limbRecord]}}),evaluated=evaluateDesign(limb);assert.equal(evaluated.status,'verified');const part=evaluated.totals.augmentations.find(p=>p.id==='limb');assert.equal(part.weapons[0].initialAmmunition.modification,'baton');assert.equal(part.weapons[0].weaponManufacture.scope,'all-linked-copies');
});


test('modified source scopes remain conditional and unsupported retained high-capacity choices are not silently discarded',()=>{
 const mounted=direct(record()).weapons[0];assert.equal(mounted.ammunitionAttackProfiles[0].conditionalEffects.scopeUsage.active,false);assert.equal(mounted.conditionalEffects.scopeUsage.independentFireControlScope,false);
 const invalid=direct(record({highCapacityAmmunitionModification:'baton'}));assert.ok(has(invalid,'CSC_HIGH_CAPACITY_UNSUPPORTED'));assert.equal(invalid.weapons[0].cost,null);assert.equal(invalid.weapons[0].highCapacityAmmunitionModification,'baton');
 const bad=record({ammunitionOverrides:[{copyIndex:1,...weaponRecordPresentation(record(),1).ammunitionCustomization.materializedValue,weaponManufactureTL:12}]});assert.throws(()=>validateWeapons([bad]));
});


test('larger modified product lists survive source changes without expanding ordinary ARL schema limits',()=>{
 const r=record({alternateMagazineSupplies:['armour-piercing','solid-shot','baton'].map(modification=>({sourceWeaponId:'csc-gauss-sniper-rifle',variant:'standard',modification,extraMagazines:0,autoloadMagazines:0,storageId:'none'}))});
 assert.doesNotThrow(()=>validateWeapons([r]));r.weaponId='csc-arl-standard';assert.doesNotThrow(()=>validateWeapons([r]));assert.ok(has(direct(r),'MAGAZINE_SOURCE_INCOMPATIBLE'));assert.equal(direct(r).weapons[0].cost,null);
});
