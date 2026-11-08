import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign} from '../engine/index.mjs';
import {WEAPONS} from '../engine/weapons.mjs';

// Fictional game construction only. Core Update 2022 pp 131,134; Robot Handbook p 61.
const record={id:'payload',weaponId:'direct-grenade-frag',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1};
const run=(patch={},tl=12)=>evaluateDesign(updateDesign(createDesign({techLevel:tl}),{selections:{physical:{weapons:[{...record,...patch}]}}}));
const has=(r,c)=>r.diagnostics.some(d=>d.code===c);
for(const [suffix,tl,cost,damage,traits]of [['aerosol',9,15,null,['Blast 9']],['frag',6,30,'5D',['Blast 9']],['smoke',6,15,null,['Blast 9']],['stun',7,30,'3D',['Blast 9','Stun']]]){
 test('Source-defined direct '+suffix+' grenade uses a small mount without an invented launcher',()=>{
  const row=WEAPONS.find(w=>w.id==='direct-grenade-'+suffix);
  assert.equal(row.tl,tl);assert.equal(row.cost,cost);assert.equal(row.massKg,.5);assert.equal(row.mountClass,'small');
  const r=run({weaponId:row.id}),w=r.totals.weapons[0];assert.equal(r.status,'verified');
  assert.equal(w.cost,500+cost);assert.equal(w.slots,1);assert.equal(w.damage,damage);assert.deepEqual(w.traits,traits);
  assert.equal(w.range,null);assert.equal(w.thrownRange,20);assert.equal(w.baseAttackModifier,null);assert.equal(w.attackModifier,null);
  assert.equal(w.magazine,null);assert.match(w.effectContext,/No ranged-launch mechanism/);
 });
}
test('Source-defined fictional four-kilogram payload uses medium mount and no ammunition fee',()=>{
 const row=WEAPONS.find(w=>w.id==='direct-pocket-nuke'),r=run({weaponId:row.id}),w=r.totals.weapons[0];
 assert.equal(row.tl,12);assert.equal(row.cost,250000);assert.equal(row.massKg,4);assert.equal(row.mountClass,'medium');
 assert.equal(r.status,'verified');assert.equal(w.cost,251000);assert.equal(w.slots,2);
 assert.equal(w.damage,'6DD');assert.deepEqual(w.traits,['Blast 1000','Radiation']);
 assert.equal(w.range,null);assert.equal(w.thrownRange,undefined);assert.equal(w.baseAttackModifier,null);
 assert.match(w.effectResolution,/Explosives check/);
});
test('Direct payload admission rejects technology and actual manipulator Size violations',()=>{
 assert.ok(has(run({weaponId:'direct-pocket-nuke'},11),'WEAPON_TL'));
 const r=evaluateDesign(updateDesign(createDesign(),{selections:{chassis:{size:'size-2'},physical:{weapons:[{...record,placement:'arm',manipulatorId:'base-1'}]}}}));
 assert.equal(r.status,'invalid');assert.ok(has(r,'WEAPON_ARM_SIZE'));
});
test('A direct payload cannot gain a magazine, autoloader or unloaded-item discount',()=>{
 for(const patch of [{extraMagazines:1},{initialMagazines:0}]){
  const r=run(patch);assert.notEqual(r.status,'verified');assert.ok(has(r,'WEAPON_AMMO_INAPPLICABLE'));
 }
 const r=run({autoload:true,extraMagazines:1});assert.equal(r.status,'invalid');assert.ok(has(r,'DIRECT_PAYLOAD_AUTOLOADER'));
});
test('Linked direct effects and unsupported accessory compatibility never silently certify',()=>{
 const linked=run({linkedWeapons:2});assert.equal(linked.status,'blocked');assert.ok(has(linked,'DIRECT_PAYLOAD_LINKED_EFFECT'));
 const accessory=run({accessories:['intelligent-0']});assert.equal(accessory.status,'blocked');assert.ok(has(accessory,'DIRECT_PAYLOAD_ACCESSORY'));
});
test('Fire-control hardware does not invent delivery or an applied direct-payload attack modifier',()=>{
 const r=run({fireControl:'basic'}),w=r.totals.weapons[0];
 assert.equal(r.status,'verified');assert.equal(w.cost,10530);assert.equal(w.slots,2);
 assert.equal(w.range,null);assert.equal(w.baseAttackModifier,null);assert.equal(w.attackModifier,null);
});
test('Held payload carries its own price without a mount and does not create missing explosive mass units',()=>{
 const r=run({placement:'held',manipulatorId:'base-1'}),w=r.totals.weapons[0];
 assert.equal(r.status,'verified');assert.equal(w.cost,30);assert.equal(w.slots,0);
 assert.ok(!WEAPONS.some(w=>['direct-plastic','direct-tdx'].includes(w.id)));
});

test('Direct-payload controls neither invent a power pack nor treat fire control as an active launcher',()=>{
 assert.ok(!has(run({initialMagazines:0}),'INCLUDED_POWER_PACK'));
 const r=run({fireControl:'basic'});assert.equal(r.status,'verified');
 assert.equal(r.totals.weapons[0].fireControlStatus,'inactive-delivery-unresolved');
 assert.equal(r.totals.weapons[0].baseAttackModifier,null);
});
test('Aerosol effects distinguish laser interference from normal visibility',()=>{
 const e=run({weaponId:'direct-grenade-aerosol'}).totals.weapons[0].conditionalEffects;
 assert.equal(e.laserDamageReduction,10);assert.equal(e.laserCommunicationsBlocked,true);
 assert.equal(e.normalVisionObscured,false);assert.equal(e.duration,'1D x 3 rounds');
 assert.match(e.condition,/wind or rain/);assert.equal(e.source.pages,'131');
});
test('Smoke effects retain the infrared exception and weather-dependent duration',()=>{
 const e=run({weaponId:'direct-grenade-smoke'}).totals.weapons[0].conditionalEffects;
 assert.equal(e.attackDM,-2);assert.equal(e.infraredVisionBypasses,true);
 assert.equal(e.duration,'1D x 3 rounds');assert.match(e.condition,/wind or rain/);
 assert.equal(e.source.pages,'131');
});

for(const ammo of ['aerosol','smoke']){
 test('The same '+ammo+' conditions survive all supported grenade delivery routes',()=>{
  const expected=run({weaponId:'direct-grenade-'+ammo}).totals.weapons[0].conditionalEffects;
  for(const weaponId of ['grenade-launcher','ram-grenade-launcher']){
   const w=run({weaponId,ammunition:ammo}).totals.weapons[0];assert.deepEqual(w.conditionalEffects,expected);
  }
  const rec={...record,weaponId:'advanced-combat-rifle',placement:'held',manipulatorId:'base-1',auxiliaryLauncher:'both-acr',auxiliaryAmmunition:ammo,auxiliaryLoaded:1,integralAmmunition:ammo,integralLoaded:1};
  const r=evaluateDesign(updateDesign(createDesign(),{selections:{physical:{weapons:[rec]}}}));
  assert.equal(r.status,'verified');assert.equal(r.totals.weapons[0].associatedAttacks.length,2);
  for(const attack of r.totals.weapons[0].associatedAttacks)assert.deepEqual(attack.conditionalEffects,expected);
 });
}
