import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,weaponControl,evaluateWeapons} from '../engine/weapons.mjs';
import {CSC_SPECIAL_ENERGY_WEAPONS} from '../engine/csc-special-energy-weapons.mjs';
import {createRobotApi} from '../js/api.mjs';

// Independently checked complete printed pp149-153, both text and images.
const expected=[
 ['pepper-spray',5,'small',3,'Special',null,5,5,5,['Stun'],false],
 ['ion-rifle-14',14,'medium',600,'Special',6,16000,100,5000,['Zero-G'],false],
 ['ion-rifle-15',15,'medium',800,'Special',5,24000,100,8000,['Zero-G'],false],
 ['maser-pistol',17,'small',20,'3D+3',2,25000,12,null,['AP 10','Zero-G'],true],
 ['maser-rifle',16,'medium',300,'5D+3',8,30000,20,null,['AP 10','Zero-G'],true],
 ['solar-beam-rifle',17,'medium',500,'1DD',4,200000,20,null,['AP 20','Zero-G'],true],
 ['matter-disintegrator-19',19,'small',10,'2DD',1,4000000,null,null,['Zero-G'],true]
];
const raw=id=>CSC_SPECIAL_ENERGY_WEAPONS.find(w=>w.id==='csc-'+id);
const record=(id,patch={})=>({id:'special-test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const design=(id,patch={})=>updateDesign(createDesign({techLevel:20}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const direct=(id,patch={},tl=20,size=6,skills=[])=>evaluateWeapons({kind:'standard',techLevel:tl,selections:{physical:{weapons:[record(id,patch)]}}},[{id:'arm',size,dexterity:8}],skills);
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);

test('special energy source facts preserve dashes, category mounts and separate identities',()=>{
 assert.equal(CSC_SPECIAL_ENERGY_WEAPONS.length,7);
 for(const [id,tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded]of expected){
  const w=raw(id);assert.deepEqual([w.tl,w.mountClass,w.range,w.damage,w.massKg,w.cost,w.magazine,w.magazineCost,w.traits,w.initialIncluded],[tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits,initialIncluded]);
  assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');assert.equal(w.skill,'gun-combat');assert.equal(w.speciality,'energy');assert.equal(w.weaponFamily,mountClass==='small'?'pistol':'rifle');
  assert.equal(w.ammunitionAccounting.replacementPurchasesSupported,!initialIncluded);assert.equal(w.compatibility.robotPowerConnection,false);assert.equal(w.conditionalEffects.resolvedAttack,false);
 }
 assert.equal(raw('matter-disintegrator-18'),undefined);assert.equal(raw('plasma-rifle-16'),undefined);
 assert.equal(raw('pepper-spray').massKg,null);assert.equal(raw('maser-rifle').mountClass,'medium');
});

for(const [id,tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits,included]of expected){
 test('special energy '+id+' integrates costs, mount fit, TL, linking and software',()=>{
  assert.deepEqual(WEAPONS.find(w=>w.id==='csc-'+id),raw(id));
  const mountCost=mountClass==='small'?500:1000,slots=mountClass==='small'?1:2,initial=included?0:magazineCost;
  const result=evaluateDesign(design(id)),p=result.totals.weapons[0];assert.equal(result.status,'verified');assert.equal(p.cost,cost+mountCost+initial);assert.equal(p.slots,slots);assert.equal(p.magazine,magazine);assert.equal(p.massKg,massKg);assert.equal(p.attackModifier,null);
  const fcs=direct(id,{fireControl:'basic'}).weapons[0];assert.equal(fcs.cost,p.cost+10000);assert.equal(fcs.baseAttackModifier,1);
  const link=direct(id,{linkedWeapons:3,fireControl:'basic'});assert.equal(link.weapons[0].cost,3*p.cost+10000);assert.equal(link.weapons[0].linkedDamageBonus,damage.includes('DD')?0:Number(damage.match(/^\d+/)?.[0]??0)*2);assert.equal(has(link,'DESTRUCTIVE_LINKED_DAMAGE'),damage.includes('DD'));
  assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.ok(!has(direct(id,{},tl),'WEAPON_TL'));
  const min=mountClass==='small'?3:5;assert.ok(has(direct(id,{placement:'arm',manipulatorId:'arm'},20,min-1),'WEAPON_ARM_SIZE'));assert.ok(!has(direct(id,{placement:'arm',manipulatorId:'arm'},20,min),'WEAPON_ARM_SIZE'));
  assert.equal(direct(id,{placement:'held',manipulatorId:'arm'}).weapons[0].cost,cost+initial);
  assert.equal(direct(id,{},20,6,[{id:'gun-combat:slug',speciality:'slug',level:3}]).weapons[0].softwareLevel,-3);assert.equal(direct(id,{},20,6,[{id:'gun-combat:energy',speciality:'energy',level:2}]).weapons[0].softwareLevel,2);
  const empty=direct(id,{initialMagazines:0});assert.equal(empty.weapons[0].cost,cost+mountCost);assert.equal(has(empty,'INCLUDED_POWER_PACK'),included);
  if(included){
   for(const patch of [{extraMagazines:1},{autoload:true},{autoload:true,extraMagazines:2}]){const r=direct(id,patch);assert.ok(has(r,'CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE'));assert.equal(r.diagnostics.find(d=>d.code==='CSC_REPLACEMENT_AMMUNITION_UNAVAILABLE').severity,'blocker');assert.equal(r.weapons[0].cost,null);assert.equal(evaluateDesign(design(id,patch)).totals,null);}
  }else{
   assert.equal(p.ammunitionAccounting.sourceInclusion,'not-stated');assert.equal(direct(id,{autoload:true,extraMagazines:2}).weapons[0].cost,p.cost+4*magazineCost);
  }
  assert.deepEqual(importDesign(exportDesign(design(id))),design(id));
 });
 test('special energy '+id+' retains source gates and no borrowed free ammunition',()=>{
  for(const [patch,code]of [[{accessories:['scope-5']},'CSC_ACCESSORIES_UNSUPPORTED'],[{ammunition:'frag'},'CSC_AMMUNITION_UNSUPPORTED'],[{auxiliaryLauncher:'attached',auxiliaryAmmunition:'frag',auxiliaryLoaded:1},'CSC_LAUNCHERS_UNSUPPORTED']]){const r=direct(id,patch);assert.ok(has(r,code));assert.equal(r.weapons[0].cost,null);}
  const r=direct(id,{accessories:['csc-intelligent-2','csc-smart-tracker']});assert.equal(r.weapons[0].cost,direct(id).weapons[0].cost+1700);assert.equal(r.weapons[0].attackModifier,null);
  assert.ok(has(direct(id,{accessories:['csc-suppressor']}),'SUPPRESSOR_WEAPON'));
 });
}

test('pepper spray and ion effects retain conditions rather than resolving attacks',()=>{
 const p=raw('pepper-spray').conditionalEffects;assert.equal(p.powerSupply.kind,'chemical-irritant-canister');assert.equal(p.powerSupply.recharge.status,'not-applicable');assert.equal(p.irritant.requiresSuccessfulHit,true);assert.equal(p.irritant.livingTargetOnly,true);assert.equal(p.irritant.requiresExposedFace,true);assert.deepEqual(p.irritant.excludedProtection,['helmet','mask','respirator','sealed-suit']);assert.deepEqual(p.irritant.check,{characteristic:'END',target:12});assert.equal(p.irritant.damage,'1D');assert.deepEqual(p.irritant.traits,['Stun']);assert.equal(p.irritant.intervalRounds,1);assert.equal(p.irritant.maximumDuration,'1D rounds');assert.equal(p.irritant.stopsOnSuccessfulCheck,true);assert.equal(p.alternativeAttack.requiresNoGunCombatSkill,true);assert.equal(p.alternativeAttack.optional,true);assert.equal(p.alternativeAttack.automaticHit,false);assert.deepEqual(p.alternativeAttack.check,{characteristic:'DEX',target:8});
 const a=raw('ion-rifle-14').conditionalEffects.disruption,b=raw('ion-rifle-15').conditionalEffects.disruption;assert.equal(a.personalOrRobotArmour.immuneAtProtection,20);assert.equal(a.vehicles.immuneAtArmour,4);assert.equal(a.vehicles.duration,'1D rounds');assert.equal(a.personalOrRobotArmour.duration,'1D rounds');assert.equal(b.personalOrRobotArmour.anyProtection,true);assert.equal(b.personalOrRobotArmour.duration,null);assert.equal(b.vehicles.maximumAffectedArmour,8);assert.equal(b.vehicles.duration,'momentary');assert.equal(b.vehicles.durationRounds,null);
 for(const id of ['ion-rifle-14','ion-rifle-15']){assert.ok(!raw(id).traits.includes('Ion'));assert.equal(raw(id).conditionalEffects.disruption.requiresSuccessfulHit,true);}
});

test('finite self-recharge differs from expressly unlimited integral supply',()=>{
 for(const id of ['maser-pistol','maser-rifle']){const w=raw(id),s=w.conditionalEffects.powerSupply;assert.ok(w.magazine>0);assert.equal(w.magazineCost,null);assert.equal(s.unlimitedFire,false);assert.equal(s.finiteBurstCapacity,true);assert.equal(s.recharge.hours,1);assert.equal(s.recharge.requiresNoFiring,true);assert.equal(s.chargeRetention.requiresUndamagedCell,true);assert.equal(s.chargeRetention.indefinite,true);}
 const solar=raw('solar-beam-rifle').conditionalEffects.powerSupply;assert.equal(solar.recharge.hours,2);assert.equal(solar.recharge.requiresDirectSunlight,true);assert.equal(solar.unlimitedFire,false);
 const dis=raw('matter-disintegrator-19');assert.equal(dis.magazine,null);assert.equal(dis.magazineCost,null);assert.equal(dis.conditionalEffects.powerSupply.explicitUnlimited,true);assert.equal(dis.conditionalEffects.powerSupply.location,'weapon-internal');assert.equal(dis.conditionalEffects.powerSupply.source.pages,'150');
 for(const w of CSC_SPECIAL_ENERGY_WEAPONS)assert.equal(w.conditionalEffects.powerSupply.robotPowerConnectionSupported,false);
});

test('special energy catalogue, API and import preserve metadata without mutable leakage',()=>{
 const d=design('maser-pistol'),choice=cat=>cat.stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-maser-pistol');
 choice(getCatalogue(d)).conditionalEffects.powerSupply.recharge.hours=0;
 const control=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-maser-pistol');assert.equal(control.conditionalEffects.powerSupply.recharge.hours,1);
 direct('maser-pistol').weapons[0].ammunitionAccounting.replacementPurchasesSupported=true;assert.equal(raw('maser-pistol').ammunitionAccounting.replacementPurchasesSupported,false);
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));api.getView().evaluation.totals.weapons[0].conditionalEffects.powerSupply.recharge.hours=0;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.powerSupply.recharge.hours,1);
 for(const patch of [{weaponId:'csc-matter-disintegrator-18'},{magazineCost:0},{initialIncluded:false},{powerConnection:'robot'},{rechargeHours:0},{conditionalEffects:{unlimitedFire:true}}]){const bad=design('maser-pistol');Object.assign(bad.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(bad)),TypeError);}
});
