import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,importDesign,exportDesign,getCatalogue} from '../engine/index.mjs';
import {CSC_WORN_WEAPONS} from '../engine/csc-worn-weapons.mjs';
import {weaponRecordPresentation} from '../engine/weapons.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
const convention='external-wear-no-internal-slots-v1',fields=['initialAmmunitionModification','spareAmmunitionModification','highCapacityAmmunitionModification'];
const record=(w,patch={})=>({id:'wear-ammo',weaponId:w.id,placement:'worn',manipulatorId:'base-1',wearSite:w.wearable.sites[0],linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const design=(w,patch={})=>updateDesign(createDesign({techLevel:23}),{selections:{physical:{externalWearConvention:convention,weapons:[record(w,patch)]}}});
const text=d=>formatStatblock(projectReview(d,getCatalogue(d),evaluateDesign(d)));
const nested=w=>({ammunitionOverrides:[{copyIndex:1,initialMagazines:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none',initialAmmunitionModification:'unknown-load',alternateMagazineSupplies:[{sourceWeaponId:w.id,variant:'standard',modification:'apds',extraMagazines:0,autoloadMagazines:0,storageId:'none'}]}]});
function blocked(d,w,patch){
 const r=evaluateDesign(d),out=r.weaponInstallations[0];
 assert.equal(r.status,'invalid');assert.equal(r.totals,null);assert.ok(r.diagnostics.some(item=>item.code==='EXTERNAL_WEAR_RETAINED'));
 assert.equal(out.cost,null);assert.equal(out.slots,null);assert.equal(out.externalWear.accountingResolved,false);assert.equal(out.acquisition.quantity,1);assert.equal(out.acquisition.cost,w.cost);assert.equal(out.damage,w.damage);assert.deepEqual(out.traits,w.traits);assert.equal(out.linkedDamageBonus,null);
 for(const field of ['loadedAmmunitionAttack','ammunitionAttackProfiles','ammunitionInventory','initialAmmunition','autoloadCost'])assert.equal(out[field],undefined,field);
 for(const field of Object.keys(patch))assert.deepEqual(out.externalWear.retainedSelections[field],patch[field]);
 const ledger=r.ledger.find(item=>item.id==='weapon-wear-ammo');assert.equal(ledger.cost,null);assert.equal(ledger.acquisitionCost,w.cost);assert.equal(ledger.slots,null);
 assert.deepEqual(importDesign(exportDesign(d)),d);const print=text(d);assert.match(print,/Retained .* \(unsupported\)/);assert.match(print,/Installed-wear accounting: Unresolved/);assert.doesNotMatch(print,/Common loaded attack|Loaded linked damage bonus|configured ammunition|Catalogue-tier declaration/);
 return out;
}
for(const w of CSC_WORN_WEAPONS){
 test(w.id+' explicit standard/null defaults preserve legacy external acquisition and hide unused controls',()=>{
  const legacy=design(w),defaults={...Object.fromEntries(fields.map(field=>[field,'standard'])),weaponManufactureTL:null},d=design(w,defaults),before=evaluateDesign(legacy),after=evaluateDesign(d),out=after.weaponInstallations[0];
  assert.equal(after.status,'verified');const comparable=structuredClone(after.totals);for(const field of [...fields,'weaponManufactureTL'])delete comparable.weapons[0][field];assert.deepEqual(comparable,before.totals);assert.deepEqual(after.ledger,before.ledger);assert.equal(out.acquisition.cost,w.cost);assert.deepEqual(out.externalWear.retainedSelections,{});assert.equal(out.loadedAmmunitionAttack,undefined);assert.equal(out.linkedDamageBonus,null);
  const view=weaponRecordPresentation(d.selections.physical.weapons[0]);for(const field of [...fields,'weaponManufactureTL']){assert.equal(view.fields[field].visible,false);assert.ok(!view.wearMetadataRemovals.includes(field));}assert.deepEqual(importDesign(exportDesign(d)),d);
 });
 test(w.id+' known/unknown top-level modifications and manufacture cannot certify worn accounting',()=>{
  for(const field of fields)for(const choice of ['armour-piercing','unavailable-load']){const patch={[field]:choice};blocked(design(w,patch),w,patch);const view=weaponRecordPresentation(record(w,patch));assert.equal(view.fields[field].visible,true);assert.ok(view.wearMetadataRemovals.includes(field));}
  for(const value of [0,w.tl,30]){const patch={weaponManufactureTL:value};blocked(design(w,patch),w,patch);assert.ok(weaponRecordPresentation(record(w,patch)).wearMetadataRemovals.includes('weaponManufactureTL'));}
 });
 test(w.id+' nested zero-quantity ammunition remains invalid, visible and explicitly removable',()=>{
  const patches=[nested(w),{alternateMagazineSupplies:[{sourceWeaponId:w.id,variant:'high-capacity',modification:'unavailable-load',extraMagazines:0,autoloadMagazines:0,storageId:'none'}]}];
  for(const patch of patches){const d=design(w,patch),out=blocked(d,w,patch),field=Object.keys(patch)[0];assert.ok(weaponRecordPresentation(record(w,patch)).wearMetadataRemovals.includes(field));if(field==='ammunitionOverrides')assert.equal(weaponRecordPresentation(record(w,patch),1).wearMetadataRemovals,undefined);assert.ok(text(d).includes(field==='ammunitionOverrides'?'unknown-load':'unavailable-load'));out.externalWear.retainedSelections[field].push({bad:true});assert.deepEqual(evaluateDesign(d).weaponInstallations[0].externalWear.retainedSelections[field],patch[field]);delete d.selections.physical.weapons[0][field];assert.equal(evaluateDesign(d).status,'verified');}
 });
}
test('retained worn ammo survives API save/load and repairs without changing acquisition or limb association',async()=>{
 const w=CSC_WORN_WEAPONS[0],patch={weaponManufactureTL:w.tl,initialAmmunitionModification:'apds',...nested(w)},d=design(w,patch),data=new Map(),api=createRobotApi({storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},locks:{request:(_n,_o,cb)=>cb()},idFactory:()=> 'retained-wear-ammo'});
 api.importDesign(exportDesign(d));await api.saveDesign();api.newDesign();api.loadDesign('retained-wear-ammo');assert.deepEqual(importDesign(api.exportDesign()),d);assert.equal(api.getView().evaluation.status,'invalid');
 const repaired=importDesign(api.exportDesign());for(const field of Object.keys(patch))delete repaired.selections.physical.weapons[0][field];api.importDesign(exportDesign(repaired));const view=api.getView();assert.equal(view.evaluation.status,'verified');assert.equal(view.evaluation.weaponInstallations[0].acquisition.cost,w.cost);assert.equal(view.design.selections.physical.weapons[0].manipulatorId,'base-1');assert.equal(view.design.selections.physical.weapons[0].weaponId,w.id);assert.equal(view.design.selections.physical.externalWearConvention,convention);
});
test('whole-component and brain-only retain invalid source diagnostics without ammo or free physical acquisition',()=>{
 const w=CSC_WORN_WEAPONS[5],child=design(w,{weaponManufactureTL:9,initialAmmunitionModification:'baton'}),attach=(d,role)=>updateDesign(createDesign({kind:role==='installed-brain'?'vehicle-brain':'ship-brain',techLevel:23}),{special:{designReferences:[{id:'wear-component',role,quantity:1,design:d}]}});
 for(const role of ['installed-robot','installed-brain']){const d=attach(child,role),r=evaluateDesign(d);assert.equal(r.totals,null);assert.ok(r.diagnostics.some(item=>item.code==='EXTERNAL_WEAR_RETAINED'));assert.doesNotMatch(text(d),/Common loaded attack|Loaded linked damage bonus|configured ammunition/);}
 const brain=evaluateDesign(attach(design(w),'installed-brain')),ordinary=evaluateDesign(attach(createDesign({techLevel:23}),'installed-brain'));assert.equal(brain.totals.cost,ordinary.totals.cost);assert.equal(brain.composite.components[0].externalWornWeapons,undefined);assert.equal(brain.composite.components[0].profile.weapons.length,0);
});
test('supported firearm with retained worn placement cannot use ammo model or purchase a worn firearm',()=>{
 const w=CSC_WORN_WEAPONS[0],d=design(w,{weaponId:'csc-gauss-sniper-rifle',weaponManufactureTL:12,initialAmmunitionModification:'apds'}),r=evaluateDesign(d);assert.equal(r.status,'invalid');assert.ok(r.diagnostics.some(item=>item.code==='EXTERNAL_WEAR_ROUTE'));assert.ok(r.diagnostics.some(item=>item.code==='EXTERNAL_WEAR_RETAINED'));assert.equal(r.weaponInstallations[0].cost,null);assert.equal(r.weaponInstallations[0].loadedAmmunitionAttack,undefined);assert.equal(r.weaponInstallations[0].linkedDamageBonus,null);
});
