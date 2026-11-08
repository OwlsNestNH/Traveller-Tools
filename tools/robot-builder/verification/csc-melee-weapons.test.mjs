import test from 'node:test';
import assert from 'node:assert/strict';
import {CSC_MELEE_WEAPONS} from '../engine/csc-melee-weapons.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,evaluateWeapons,weaponControl} from '../engine/weapons.mjs';
import {CSC_WEAPON_ACCESSORIES,cscAccessoryEligibility} from '../engine/csc-weapon-accessories.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
// Independent transcription from visually inspected full CSC pp132-135,140.
const expected=[
 ['mace',1,'small','2D+2',3,20,'bludgeon',['Bulky','Smasher'],false,'133'],
 ['staff',1,'medium','2D',2,5,'bludgeon',[],true,'133'],
 ['battle-axe',1,'small','3D',4,225,'blade',['AP 2','Bulky'],false,'135'],
 ['broadsword',1,'medium','4D',3,500,'blade',['Bulky'],true,'135'],
 ['great-axe',1,'medium','4D+2',8,750,'blade',['Smasher','Very Bulky'],true,'135'],
 ['long-blade-1',1,'small','3D',2,200,'blade',[],false,'135'],
 ['long-blade-3',3,'small','3D+2',2,300,'blade',[],false,'135'],
 ['monoblade',12,'small','3D',1,2500,'blade',['AP 10'],false,'135'],
 ['buckler',1,'small','1D',1,10,'bludgeon',[],false,'140']
];
const raw=id=>CSC_MELEE_WEAPONS.find(w=>w.id==='csc-'+id);
const record=(id,patch={})=>({id:'melee-test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const direct=(id,patch={},techLevel=16,size=7,skills=[])=>evaluateWeapons({kind:'standard',techLevel,selections:{physical:{weapons:[record(id,patch)]}}},[{id:'arm',size,dexterity:8}],skills);
const profile=(...args)=>direct(...args).weapons[0];
const design=(id,patch={})=>updateDesign(createDesign({techLevel:16}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);

test('CSC melee source: original nine bounded profiles preserve rows, handedness, skills and sources',()=>{
 assert.deepEqual(CSC_MELEE_WEAPONS.slice(0,9).map(w=>w.id),expected.map(e=>'csc-'+e[0]));
 for(const [id,tl,mount,damage,mass,cost,speciality,traits,twoHands,page] of expected){
  const w=raw(id);assert.deepEqual([w.tl,w.mountClass,w.damage,w.massKg,w.cost,w.speciality,w.traits,w.requiresTwoHands],[tl,mount,damage,mass,cost,speciality,traits,twoHands],id);
  assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.weaponFamily,'melee');assert.equal(w.skill,'melee');assert.equal(w.range,'Melee');assert.equal(w.magazine,null);assert.equal(w.magazineCost,0);assert.equal(w.initialIncluded,true);
  assert.equal(w.source.book,'Central Supply Catalogue Update 2023');assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');assert.ok(w.source.pages.includes(page));assert.deepEqual(w.sourceMeasurements.mass,{value:mass,unit:'kg'});assert.equal(w.sourceMeasurements.source.pages,page);assert.equal(w.handedness.hands,twoHands?2:1);assert.equal(w.handedness.mountSource.pages,'61');
  assert.deepEqual(w.compatibility,{accessoryRules:'csc-2023',associatedLauncherRules:null,attachedLauncher:false,specialisedAmmunitionRules:null,robotPowerConnection:false});assert.equal(w.ammunitionAccounting.autoloadSupported,false);assert.equal(w.ammunitionAccounting.separatelyPricedAmmunition,false);
  for(const flag of ['resolvedAttack','skillGranted','defenceGranted','bodyMountedDefenceGranted'])assert.equal(w.conditionalEffects[flag],false);
 }
 for(const id of ['stunstick','club','gravity-hammer','static-maul','arc-field-weapon','chaindrive-axe','psi-blade','boarding-shield','gravitic-shield'])assert.equal(raw(id),undefined);
 assert.equal(WEAPONS.find(w=>w.id==='broadsword').tl,2);assert.equal(raw('broadsword').tl,1);
});

test('CSC melee source: shield parry and Smasher never become unconditional defence, skills or AP',()=>{
 for(const id of ['staff','buckler']){const p=raw(id).conditionalEffects.parry;assert.equal(p.effectiveMeleeBonus,1);assert.equal(p.requiresMeleeSkill,true);assert.equal(p.unskilledEffectiveMelee,null);assert.equal(p.requiresHeld,true);assert.equal(p.requiresTwoHands,id==='staff');assert.equal(p.automaticBonusApplied,false);assert.equal(p.resolved,false);assert.equal(p.attackBonus,0);assert.equal(p.protectionGranted,0);assert.ok(p.source.pages.includes('140'));}
 for(const id of ['mace','great-axe']){const s=raw(id).conditionalEffects.smasher;assert.equal(s.targetMayParry,false);assert.equal(s.armourPenetrationGranted,false);assert.equal(s.source.pages,'131');assert.equal(raw(id).traits.some(t=>t.startsWith('AP ')),false);}
});

for(const [id,tl,mount,damage,mass,cost,speciality,traits,twoHands] of expected)test('CSC melee integration: '+id+' pricing, mounts, TL, skills, no-ammo and held constraints',()=>{
 const mountCost=mount==='small'?500:1000,slots=mount==='small'?1:2,size=mount==='small'?3:5;
 assert.deepEqual(WEAPONS.find(w=>w.id==='csc-'+id),raw(id));const r=evaluateDesign(design(id));assert.equal(r.status,'verified');const p=r.totals.weapons[0];assert.equal(p.cost,cost+mountCost);assert.equal(p.slots,slots);assert.equal(p.massKg,mass);assert.equal(p.damage,damage);assert.deepEqual(p.traits,traits);assert.equal(p.magazine,null);assert.equal(p.attackModifier,null);assert.equal(p.baseAttackModifier,-3);
 const linked=profile(id,{linkedWeapons:2});assert.equal(linked.cost,2*(cost+mountCost));assert.equal(linked.slots,2*slots);
 assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.ok(has(direct(id,{placement:'arm',manipulatorId:'arm'},16,size-1),'WEAPON_ARM_SIZE'));assert.equal(has(direct(id,{placement:'arm',manipulatorId:'arm'},16,size),'WEAPON_ARM_SIZE'),false);
 for(const patch of [{autoload:true},{autoload:true,extraMagazines:1}])assert.ok(has(direct(id,patch),'AUTOLOADER_AMMUNITION'));
 assert.ok(has(direct(id,{extraMagazines:1}),'WEAPON_AMMO_INAPPLICABLE'));assert.ok(has(direct(id,{initialMagazines:0}),'WEAPON_AMMO_INAPPLICABLE'));
 assert.equal(profile(id,{},16,7,[{id:'melee:'+speciality,level:2}]).softwareLevel,2);assert.equal(profile(id,{},16,7,[{id:'gun-combat:slug',level:4}]).softwareLevel,-3);
 const held=direct(id,{placement:'held',manipulatorId:'arm'});assert.equal(held.weapons[0].slots,0);assert.equal(held.weapons[0].cost,cost);assert.equal(has(held,'HELD_SUPPORT_REQUIRED'),twoHands);if(twoHands){assert.equal(held.weapons[0].baseAttackModifier,null);assert.equal(held.diagnostics.find(d=>d.code==='HELD_SUPPORT_REQUIRED').severity,'error');assert.equal(profile(id,{placement:'held',manipulatorId:'arm',fireControl:'advanced'}).baseAttackModifier,null);}
});

test('CSC melee integration: narrow accessories are admitted while ammunition and attached launchers fail closed',()=>{
 for(const w of CSC_MELEE_WEAPONS){const id=w.id.slice(4);
  for(const a of WEAPON_ACCESSORIES){
   const allowed=a.sourceFamily==='csc-2023'&&(['intelligent','scan-jammer','smart-tracker'].includes(a.kind)||a.kind==='gyrostabiliser'&&['mace','battle-axe','broadsword','great-axe','sledgehammer'].includes(id));
   if(a.sourceFamily==='csc-2023')assert.equal(cscAccessoryEligibility(w,a).available,allowed);
   const accessories=[a.id,...(a.id==='csc-smart-tracker'?['csc-intelligent-0']:[])],r=direct(id,{accessories});
   if(allowed){assert.equal(r.weapons[0].cost,w.cost+(w.mountClass==='small'?500:1000)+a.cost+(a.id==='csc-smart-tracker'?1000:0));assert.equal(r.weapons[0].baseAttackModifier,-3);}
   else{assert.ok(r.diagnostics.some(d=>d.severity==='error'),a.id);assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].accessoryEffects,[]);assert.deepEqual(r.weapons[0].traits,w.traits);}
  }
  for(const ammunition of ['frag','smoke','stun','aerosol']){const r=direct(id,{ammunition});assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);}
  for(const patch of [{auxiliaryLauncher:'attached'},{auxiliaryLauncher:'integral-acr'},{auxiliaryLauncher:'both-acr'},{auxiliaryLoaded:1},{integralLoaded:1},{looseGrenades:1}]){const r=direct(id,patch);assert.ok(has(r,'CSC_LAUNCHERS_UNSUPPORTED'));assert.equal(r.weapons[0].cost,null);assert.deepEqual(r.weapons[0].associatedAttacks,[]);}
 }
});

test('CSC melee integration: import rejects source overrides and catalogue/API/evaluation are isolated',()=>{
 const d=design('buckler');assert.deepEqual(importDesign(exportDesign(d)),d);
 for(const patch of [{weaponId:'csc-psi-blade'},{requiresTwoHands:false},{sourceFamily:'core-2022'},{magazine:10},{magazineCost:0},{powerConnection:'robot'},{conditionalEffects:{parry:{effectiveMeleeBonus:99}}}]){const x=design('buckler');Object.assign(x.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(x)),TypeError);}
 const choices=getCatalogue(d).stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices;
 choices.find(w=>w.id==='csc-buckler').conditionalEffects.parry.effectiveMeleeBonus=99;
 const choice=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-buckler');choice.handedness.mountSource.pages='bad';choice.compatibility.robotPowerConnection=true;
 const a=profile('buckler');a.conditionalEffects.parry.effectiveMeleeBonus=99;a.source.pages='bad';a.traits.push('AP 99');assert.equal(profile('buckler').conditionalEffects.parry.effectiveMeleeBonus,1);assert.equal(raw('buckler').handedness.mountSource.pages,'61');assert.equal(raw('buckler').compatibility.robotPowerConnection,false);assert.deepEqual(profile('buckler').traits,[]);
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));api.getView().evaluation.totals.weapons[0].conditionalEffects.parry.automaticBonusApplied=true;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.parry.automaticBonusApplied,false);
 for(const id of ['staff','buckler'])for(const patch of [{},{placement:'arm',manipulatorId:'arm'},{placement:'held',manipulatorId:'arm'}]){const p=profile(id,patch,16,7,[{id:'melee:bludgeon',level:4}]);assert.equal(p.conditionalEffects.parry.automaticBonusApplied,false);assert.equal(p.conditionalEffects.defenceGranted,false);assert.equal(p.attackModifier,null);}
});


test('CSC melee integration: Core second-grip requirement and no-magazine guard preserve valid weapon routes',()=>{
 const core=WEAPONS.find(w=>w.id==='broadsword');assert.equal(core.requiresTwoHands,true);assert.equal(core.tl,2);assert.equal(core.cost,500);assert.deepEqual(core.traits,['Bulky']);assert.equal(core.sourceFamily,'core-2022');
 for(const fireControl of ['none','basic','improved','enhanced','advanced']){
  const r=direct('mace',{weaponId:'broadsword',placement:'held',manipulatorId:'arm',fireControl},16,7,[{id:'melee:blade',level:4}]);assert.ok(has(r,'HELD_SUPPORT_REQUIRED'));assert.equal(r.weapons[0].baseAttackModifier,null);assert.equal(r.weapons[0].attackModifier,null);
 }
 const mounted=direct('mace',{weaponId:'broadsword'});assert.equal(has(mounted,'HELD_SUPPORT_REQUIRED'),false);assert.equal(mounted.weapons[0].cost,1500);assert.equal(mounted.weapons[0].slots,2);
 for(const w of WEAPONS.filter(w=>w.magazine===null)){const r=direct('mace',{weaponId:w.id,autoload:true,extraMagazines:1});assert.ok(has(r,w.wearable?'EXTERNAL_WEAR_RETAINED':'AUTOLOADER_AMMUNITION'),w.id);}
 for(const w of WEAPONS.filter(w=>Number.isFinite(w.magazine)&&w.magazine>0)){const r=direct('mace',{weaponId:w.id,autoload:true,extraMagazines:1});assert.equal(has(r,'AUTOLOADER_AMMUNITION'),false,w.id);}
});
