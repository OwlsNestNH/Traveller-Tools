import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentOptions,resolveEquipmentItem} from '../engine/equipment-catalog.mjs';
import {createSession,execute,exportSession,importSession,project,api} from '../engine/session.mjs';
import {equipmentFixture} from './equipment-fixtures.mjs';

const payload={confirmed:true,note:'Selected verified Core item.',benefitItemId:'core.autopistol'};
test('bounded catalogue filters category, budget, TL, source and unknown restrictions',()=>{
 const p={source:'core',category:'weapon',maximumCost:3000,maximumTL:12};assert.equal(equipmentOptions(p).length,5);
 assert.equal(equipmentOptions({...p,category:'armour'}).length,2);
 assert.deepEqual(equipmentOptions({...p,maximumCost:10}).map(x=>x.id),['core.dagger']);
 assert.deepEqual(equipmentOptions({...p,maximumTL:1}).map(x=>x.id),['core.dagger']);
 for(const extra of [{source:'aliens'},{category:'augmentation'},{restrictions:['unverified']}])assert.deepEqual(equipmentOptions({...p,...extra}),[]);
 assert.throws(()=>resolveEquipmentItem({...p,category:'armour'},payload),/available/);
});
test('canonical selection, replay, duplicate command and authoritative metadata',()=>{
 const r=equipmentFixture();assert.equal(r.state.pending.catalogueItems.length,5);
 for(const bad of [{benefitItemId:'unknown'},{benefitItemId:'core.cloth-tl7'},{benefitItemCost:0},{benefitItemTL:0},{benefitItemName:'Fake'},{benefitWeaponSkill:'Melee (blade)'}])assert.throws(()=>execute(r.session,{type:'resolve-book',payload:{...payload,...bad}}),/catalogue|metadata/i);
 const selected=execute(r.session,{type:'resolve-book',payload},{id:'catalogue-once'});const a=selected.state.character.assets[0];
 assert.equal(a.name,'Autopistol');assert.equal(a.cost,200);assert.equal(a.techLevel,5);assert.equal(a.weaponSkill,'Gun Combat (slug)');assert.deepEqual(a.itemSource,{id:'core',page:126});
 assert.deepEqual(execute(selected.session,{type:'resolve-book',payload},{id:'catalogue-once'}),selected);
 assert.deepEqual(project(importSession(exportSession(selected.session))),project(selected.session));
});
test('compatible historical revisions keep manual equipment projection and replay',()=>{
 for(const revision of ['character-preview-2026-11-09.16','character-preview-2026-11-09.17','character-preview-2026-11-09.18','character-preview-2026-11-09.19','character-preview-2026-11-09.20']){
  const r=equipmentFixture(revision);assert.equal(r.state.pending.catalogueItems,undefined);
  assert.throws(()=>execute(r.session,{type:'resolve-book',payload}),/current rules/);
  const selected=execute(r.session,{type:'resolve-book',payload:{confirmed:true,note:'Historical book selection',benefitItemName:'Service pistol',benefitItemCost:1000,benefitItemTL:10,benefitWeaponSkill:'Gun Combat (slug)'}});
  assert.deepEqual(project(importSession(exportSession(selected.session))),project(selected.session));assert.equal(selected.session.rulesRevision,revision);
 }
});
test('public API rejects catalogue spoofing and preserves bounded save payload',()=>{
 const r=equipmentFixture();
 assert.equal(api({operation:'command',session:r.session,command:{type:'resolve-book',payload:{...payload,benefitItemCost:1}}}).ok,false);
 const result=api({operation:'command',session:r.session,command:{type:'resolve-book',payload}});assert.equal(result.ok,true);
 assert.ok(exportSession(result.session).length<2000000);assert.equal(result.state.character.assets[0].catalogueItemId,'core.autopistol');
});
