import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTemplate} from '../setup.mjs';import {createState,applyCommand,normalizeState} from '../engine.mjs';import {preset} from '../catalogue.mjs';
import {normalizeWeaponFit,mountPower,weaponPools,validateWeaponFits,WEAPON_TYPES,MISSILE_TYPES,fittedRequirement} from '../weapon-fit.mjs';
import {inventoryFromShip,normalizeAmmunition,reloadInventory} from '../ammunition.mjs';import {isEnergyWeapon} from '../weapon-supply.mjs';
const fit=(slots,extra={})=>normalizeWeaponFit({version:1,kind:'turret',rules:'highguard2022',quantity:1,slots:[...slots,...Array(4-slots.length).fill(null)],powerOverride:null,missileType:'Standard',...extra});
const design=w=>({name:'Test design',tons:400,thrust:1,hull:100,armour:0,record:{tl:15,weapons:[w],requirements:[]}});
const weapon=f=>({id:'test-mount',name:'Test turret',type:f.slots.filter(Boolean).join(' + '),count:f.slots.filter(Boolean).length,ammunition:null,fit:f});
test('filled turret slots derive power including baseline, quad and zero-power weapons',()=>{
 for(const [slots,power]of [[['Beam laser'],5],[['Beam laser','Missile rack'],5],[['Beam laser','Missile rack','Sandcaster'],5],[['Beam laser','Pulse laser','Missile rack','Sandcaster'],10]]){const w=weapon(fit(slots));assert.equal(mountPower(w,design(w)),power);}
 assert.equal(WEAPON_TYPES.find(w=>w.name==='Sandcaster').power,0);assert.equal(MISSILE_TYPES.length,14);
 const w=weapon(fit(['Custom source weapon']));assert.equal(mountPower(w,design(w)),null);w.fit.powerOverride=17;assert.equal(mountPower(w,design(w)),17);
 assert.equal(mountPower(weapon(fit(['Particle barbette'],{kind:'barbette'})),{tons:200}),15);
});
test('fixed/barbette classes, TL and Firmpoints are not silently resized',()=>{
 assert.throws(()=>fit(['Beam laser','Pulse laser'],{kind:'barbette'}));const w=weapon(fit(['Beam laser','Beam laser','Beam laser','Beam laser'])),d=design(w);d.record.tl=11;assert.throws(()=>normalizeTemplate(d),/TL12/);d.record.tl=15;d.tons=50;assert.throws(()=>normalizeTemplate(d),/Firmpoint/);
 const fixed=weapon(fit(['Beam laser'],{kind:'fixed'}));assert.equal(mountPower(fixed,{tons:50}),3);assert.equal(mountPower(fixed,{tons:200}),4);fixed.fit.quantity=5;assert.throws(()=>validateWeaponFits(design(fixed)),/Hardpoints/);
});
test('missiles share turret capacity; sand keeps source distinction; reserve not invented',()=>{
 const m=weapon(fit(['Missile rack','Missile rack','Sandcaster']));assert.equal(weaponPools(m,design(m)).find(p=>p.kind==='missile').capacity,12);
 const s=weapon(fit(['Sandcaster','Sandcaster']));assert.equal(weaponPools(s,design(s))[0].capacity,40);s.fit.rules='core2022';assert.equal(weaponPools(s,design(s))[0].capacity,20);s.fit.rules='unknown';assert.equal(weaponPools(s,design(s))[0].capacity,null);
 const b=weapon(fit(['Missile barbette'],{kind:'barbette'}));assert.equal(weaponPools(b,design(b))[0].capacity,25);
 const ship={condition:{weapons:[{id:m.id,ammunition:null}]}};m.ammunition=8;const inventory=inventoryFromShip(ship,design(m));assert.equal(inventory.reserves.length,0);assert.equal(inventory.loaded[0].count,null);
});
test('legacy encounter and source snapshots remain unchanged until an explicit fit edit',()=>{
 const s=createState(),before=JSON.stringify(s);assert.deepEqual(normalizeState(JSON.parse(before)),s);assert.equal(JSON.stringify(s),before);
 const harrier=preset('drinax-harrier-restored'),inv=inventoryFromShip({condition:{}},harrier);assert.equal(inv.reserves.find(x=>x.kind==='missile').capacity,12);assert.equal(inv.reserves[0].count,null);assert.equal(inv.loaded.find(x=>x.kind==='missile').count,null);
 assert.ok(isEnergyWeapon({type:'Particle beam — Accurate, High Yield'}));assert.ok(isEnergyWeapon(weapon(fit(['Beam laser']))));
});
test('reload conserves inventory and rejects unknowns, mismatches, overcapacity and stale commits',()=>{
 const w=weapon(fit(['Missile rack'])),s=createState({ships:[]}),added=applyCommand(s,{type:'add-ship',template:normalizeTemplate(design(w)),name:'Test ship',position:{q:0,r:0},velocity:{q:0,r:0}}),ship=added.ships[0],inv=inventoryFromShip(ship,ship.template);inv.loaded[0].count=2;inv.reserves.push({id:'manual-1',name:'Test reserve',kind:'missile',capacity:20,sourceCapacity:null,count:10,origin:'manual',missileType:'Standard',note:''});const before=structuredClone(inv),next=reloadInventory(inv,'manual-1',inv.loaded[0].id,4);assert.equal(next.loaded[0].count,6);assert.equal(next.reserves[0].count,6);assert.deepEqual(inv,before);assert.throws(()=>reloadInventory(inv,'manual-1',inv.loaded[0].id,11));next.loaded[0].count=13;assert.throws(()=>normalizeAmmunition(next),/exceeds/);inv.reserves[0].missileType='Unknown';assert.throws(()=>reloadInventory(inv,'manual-1',inv.loaded[0].id,1),/types/);
 const committed=applyCommand(added,{type:'set-condition',shipId:ship.id,expectedRevision:added.revision,condition:{...ship.condition,ammunition:before}});assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(committed))),committed);assert.throws(()=>applyCommand(committed,{type:'set-condition',shipId:ship.id,expectedRevision:added.revision,condition:ship.condition}));
});
test('calculated fit does not replace manual design power overrides',()=>{const w=weapon(fit(['Beam laser','Pulse laser'])),d=design(w);assert.equal(fittedRequirement({name:'Weapons',power:1},d).power,9);assert.equal(fittedRequirement({name:'Weapons',power:17,basis:'manual override'},d).power,17);});

test('new fit loads require an explicit draft operating choice and retain provenance',async()=>{
 const {systemProfile,powerReport}=await import('../systems.mjs'),{beginSystemsDraft}=await import('../systems-draft.mjs'),{stationPowerRows}=await import('../station-power.mjs');
 const w=weapon(fit(['Beam laser'])),d=normalizeTemplate(design(w));const state=applyCommand(createState({ships:[]}),{type:'add-ship',name:'Synthetic load',template:d,position:{q:0,r:0},velocity:{q:0,r:0}}),s=state.ships[0];s.systems.loads=[];s.systems.inventoryConfirmed=true;
 assert.equal(systemProfile(d).loads[0].power,5);assert.match(powerReport(s).unknown.join(' '),/explicit operating choice/);assert.equal(stationPowerRows(s).find(r=>r.id==='fit-test-mount').draw,5);
 const draft=beginSystemsDraft(state,s.id);assert.deepEqual(s.systems.loads,[]);assert.equal(draft.systems.loads[0].enabled,false);draft.systems.loads[0].enabled=true;const report=powerReport(s,draft.systems);assert.equal(report.rows.find(r=>r.id==='fit-test-mount').power,5);assert.match(report.rows.find(r=>r.id==='fit-test-mount').note,/Calculated/);
 const row=fittedRequirement({name:'Weapons',power:3,source:{book:'Synthetic source',page:1}},d);assert.equal(row.source,null);assert.equal(row.sourceReference.power,3);
});
test('expanded catalogue groups retain per-mount capacities without multiplying twice',()=>{const w={id:'mount-1-2',name:'Triple turret',type:'Missile rack',count:3,ammunition:null},d=design(w);d.record.published={mounts:[{id:'mount-1',name:w.name,fit:w.type,fittedCount:3,quantity:2}]};assert.equal(weaponPools(w,d)[0].capacity,12);w.type='Custom missile fit';assert.equal(weaponPools(w,d)[0].capacity,null);});
