import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {WEAPONS,WEAPON_ACCESSORIES,weaponControl,evaluateWeapons,RIFLE_WEAPON_IDS} from '../engine/weapons.mjs';
import {CSC_SLUG_WEAPONS} from '../engine/csc-slug-weapons.mjs';
import {createRobotApi} from '../js/api.mjs';

// Independently transcribed from visually inspected CSC printed pp143,145.
// Prose and conditions checked on pp131,142,144,146,148. No source scans shipped.
const expected=[
 ['assault-pistol',6,'small',10,'3D-3',1,250,15,10,['Auto 2']],
 ['cartridge-pistol',7,'small',10,'4D',1.5,300,6,10,['Bulky']],
 ['coach-pistol',3,'small',5,'4D-3',2,200,2,10,['Dangerous']],
 ['flechette-pistol',9,'small',10,'3D-2',1,275,2,10,['Silent']],
 ['heavy-revolver',5,'small',10,'4D-3',1.5,400,6,15,['Bulky']],
 ['magrail-pistol',14,'small',15,'3D+3',1,750,20,60,['Auto 4']],
 ['shot-pistol',5,'small',2,'3D',.5,60,1,5,[]],
 ['universal-auto-pistol',8,'small',10,'3D-3',1,300,10,10,[]],
 ['zip-gun',3,'small',5,'2D-3',null,50,1,5,['Dangerous']],
 ['accelerator-rifle-11',11,'medium',400,'3D',2,1500,20,40,['Zero-G']],
 ['air-rifle-3',3,'medium',50,'2D',3,225,1,1,['Silent']],
 ['air-rifle-4',4,'medium',75,'3D-2',3,350,1,1,['Silent']],
 ['assault-shotgun',6,'medium',50,'4D',5,500,24,40,['Auto 2','Bulky']],
 ['big-game-rifle',5,'medium',200,'3D+3',8,1250,5,50,['Very Bulky']],
 ['flechette-submachine-gun',9,'medium',20,'3D-2',3,500,40,20,['Auto 3','Silent']],
 ['gauss-assault-gun',12,'medium',20,'4D',2,1300,36,35,['AP 5','Auto 2']],
 ['gauss-rifle',12,'medium',600,'4D',4,1500,80,80,['AP 5','Auto 3','Scope']],
 ['gauss-sniper-rifle',12,'medium',1000,'5D',4,2500,12,20,['AP 6','Scope']],
 ['gauss-submachinegun',12,'medium',50,'3D+2',3,1000,60,60,['AP 3','Auto 4']],
 ['magrail-rifle',14,'medium',150,'4D+3',4,2500,30,100,['Auto 6']],
 ['sawn-off-shotgun',4,'medium',10,'4D',2,200,6,10,['Bulky']],
 ['light-shotgun',4,'medium',40,'3D',3,150,6,10,[]],
 ['sniper-rifle',8,'medium',500,'3D',5,700,4,10,['AP 5','Scope','Silent']],
 ['snub-carbine',11,'medium',75,'3D-3',1,500,20,30,['Zero-G']],
 ['spear-gun',6,'medium',25,'3D',2,50,1,10,['Silent']]
];
const record=(id,patch={})=>({id:'test',weaponId:'csc-'+id,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,...patch});
const design=(id,patch={},tl=16)=>updateDesign(createDesign({techLevel:tl}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(id,patch)]}}});
const run=(...args)=>evaluateDesign(design(...args));
const profile=(...args)=>run(...args).totals.weapons[0];
const has=(result,code)=>result.diagnostics.some(d=>d.code===code);
const direct=(id,patch={},tl=16,size=6)=>evaluateWeapons({kind:'standard',techLevel:tl,selections:{physical:{weapons:[record(id,patch)]}}},[{id:'arm',size,dexterity:8}],[]);

for(const [id,tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits] of expected){
 test('CSC '+id+' preserves table, source, separate ammunition and linked accounting',()=>{
  const w=WEAPONS.find(w=>w.id==='csc-'+id),mountCost=mountClass==='small'?500:1000,mountSlots=mountClass==='small'?1:2;
  assert.deepEqual([w.tl,w.mountClass,w.range,w.damage,w.massKg,w.cost,w.magazine,w.magazineCost,w.traits],[tl,mountClass,range,damage,massKg,cost,magazine,magazineCost,traits]);
  assert.equal(w.weaponFamily,mountClass==='small'?'pistol':'rifle');assert.equal(w.sourceFamily,'csc-2023');assert.equal(w.skill,'gun-combat');assert.equal(w.speciality,'slug');
  assert.equal(w.source.book,'Central Supply Catalogue Update 2023');assert.equal(w.source.edition,'Mongoose revised printing (copyright 2026)');assert.ok(w.source.pages.includes(mountClass==='small'?'143':'145'));
  assert.equal(w.initialIncluded,false);assert.equal(w.ammunitionAccounting.initialMagazine,'separate-purchase');
  const base=run(id);assert.equal(base.status,'verified');assert.equal(base.totals.weapons[0].cost,cost+mountCost+magazineCost);assert.equal(base.totals.weapons[0].slots,mountSlots);
  assert.equal(base.totals.weapons[0].magazine,magazine);assert.equal(base.totals.weapons[0].baseAttackModifier,-3);assert.equal(base.totals.weapons[0].attackModifier,null);assert.equal(base.totals.weapons[0].softwareLevel,-3);assert.deepEqual(base.totals.skills,[]);
  assert.equal(profile(id,{initialMagazines:0}).cost,cost+mountCost);
  assert.equal(profile(id,{autoload:true,extraMagazines:3}).cost,cost+mountCost+magazineCost+6*magazineCost);
  assert.equal(profile(id,{autoload:true,extraMagazines:3}).slots,2*mountSlots);
  const linked=profile(id,{linkedWeapons:3,autoload:true,extraMagazines:2,fireControl:'basic'});
  assert.equal(linked.cost,3*(cost+mountCost+5*magazineCost)+10000);assert.equal(linked.slots,6*mountSlots+1);
  assert.equal(linked.linkedDamageBonus,Number(damage.match(/^\d+/)[0])*2);
  assert.deepEqual(base.ledger.find(l=>l.id==='weapon-test').weaponSource,w.source);
  const d=design(id);assert.deepEqual(importDesign(exportDesign(d)),d);
 });
 test('CSC '+id+' respects TL, category arm minimum and autoloader arm increment',()=>{
  const minimum=mountClass==='small'?3:5;
  assert.ok(has(direct(id,{},tl-1),'WEAPON_TL'));assert.ok(!has(direct(id,{},tl),'WEAPON_TL'));
  const arm={placement:'arm',manipulatorId:'arm'};
  assert.ok(has(direct(id,arm,16,minimum-1),'WEAPON_ARM_SIZE'));assert.ok(!has(direct(id,arm,16,minimum),'WEAPON_ARM_SIZE'));
  assert.ok(has(direct(id,{...arm,autoload:true,extraMagazines:1},16,minimum),'WEAPON_ARM_SIZE'));
  assert.ok(!has(direct(id,{...arm,autoload:true,extraMagazines:1},16,minimum+1),'WEAPON_ARM_SIZE'));
  const held=direct(id,{placement:'held',manipulatorId:'arm'},16,1);assert.ok(!has(held,'WEAPON_ARM_SIZE'));assert.equal(held.weapons[0].slots,0);assert.equal(held.weapons[0].cost,cost+magazineCost);
  assert.ok(has(direct(id,{autoload:true,extraMagazines:1},5),'AUTOLOADER_TL'));
 });
}

test('CSC catalogue is exactly the fixed-capacity tranche and has no inferred mass/category conversion',()=>{
 assert.equal(CSC_SLUG_WEAPONS.length,25);assert.deepEqual(CSC_SLUG_WEAPONS.map(w=>w.id),expected.map(r=>'csc-'+r[0]));
 for(const id of ['csc-ducks-foot-pistol','csc-heavy-advanced-combat-rifle','csc-antique-pistol','csc-shotgun'])assert.ok(!WEAPONS.some(w=>w.id===id));
 const carbine=WEAPONS.find(w=>w.id==='csc-snub-carbine');assert.equal(carbine.massKg,1);assert.equal(carbine.mountClass,'medium');assert.equal(carbine.weaponFamily,'rifle');
 assert.ok(WEAPONS.every(w=>w.weaponFamily&&w.sourceFamily&&w.compatibility));
 assert.ok(RIFLE_WEAPON_IDS.every(id=>WEAPONS.find(w=>w.id===id).sourceFamily==='core-2022'));assert.ok(!RIFLE_WEAPON_IDS.some(id=>id.startsWith('csc-')));
});

test('CSC conditional damage and accuracy never replace standard profiles or software',()=>{
 const assault=profile('assault-pistol');assert.deepEqual(assault.conditionalEffects.attackModifiers[0].modes,['burst','full-auto']);assert.equal(assault.conditionalEffects.attackModifiers[0].modifier,-2);assert.equal(assault.baseAttackModifier,-3);
 const coach=profile('coach-pistol');assert.equal(coach.damage,'4D-3');assert.equal(coach.conditionalEffects.alternativeDischarge.damage,'4D');assert.equal(coach.conditionalEffects.alternativeDischarge.roundsConsumed,2);assert.equal(coach.conditionalEffects.alternativeDischarge.optional,true);
 assert.equal(coach.conditionalEffects.reload.action,'Significant');assert.equal(coach.conditionalEffects.reload.actions,1);assert.equal(coach.conditionalEffects.reload.skill,'gun-combat:slug');assert.equal(coach.conditionalEffects.reload.skillCheckRequired,true);
 const zip=profile('zip-gun');assert.equal(zip.conditionalEffects.attackModifiers[0].modifier,-1);assert.equal(zip.baseAttackModifier,-3);
 for(const w of [coach,zip]){assert.equal(w.conditionalEffects.dangerous.maximumAttackEffect,-5);assert.equal(w.conditionalEffects.dangerous.damageToUser,true);assert.equal(w.conditionalEffects.dangerous.weaponInoperable,true);}
 for(const w of [assault,coach,zip]){assert.equal(w.conditionalEffects.skillGranted,false);assert.equal(w.conditionalEffects.resolvedAttack,false);assert.equal(w.attackModifier,null);}
});

test('CSC air reservoirs, pellet rules, silent detection and underwater intent stay contextual',()=>{
 const low=profile('air-rifle-3'),high=profile('air-rifle-4');assert.equal(low.magazine,1);assert.equal(high.magazine,1);
 assert.equal(low.conditionalEffects.airReservoir.shots,1);assert.equal(low.conditionalEffects.airReservoir.rechargeMinorActions,10);
 assert.equal(high.conditionalEffects.airReservoir.shots,5);assert.equal(high.conditionalEffects.airReservoir.ammunitionCapacity,1);assert.equal(high.conditionalEffects.airReservoir.reloadAfterEachShot,true);assert.equal(high.conditionalEffects.airReservoir.refillCost,0);assert.equal(high.conditionalEffects.airReservoir.refillContext,'Outside combat');assert.equal(high.conditionalEffects.airReservoir.refillMinutes,null);
 for(const id of ['assault-shotgun','sawn-off-shotgun','light-shotgun']){const pellet=profile(id).conditionalEffects.pelletAmmunition;assert.equal(pellet.condition,'Using pellet ammunition');assert.equal(pellet.ignoreDodgeDM,true);assert.equal(pellet.armourProtectionMultiplier,2);assert.equal(pellet.damageBeyondListedRangeMultiplier,.5);}
 const short=profile('sawn-off-shotgun').conditionalEffects.attackModifiers[0];assert.equal(short.modifier,2);assert.equal(short.condition,'Short range');assert.equal(short.replacesNormalShortRangeBonus,true);
 // A gauss "shotgun effect" is descriptive, not permission to apply pellet rules.
 assert.equal(profile('gauss-assault-gun').conditionalEffects.pelletAmmunition,undefined);
 for(const [id,,,,,,,,,traits] of expected.filter(r=>r[9].includes('Silent'))){const c=profile(id).conditionalEffects.silent;assert.equal(c.soundSourceDetectionDM,-6);assert.equal(c.source.pages,'131');assert.ok(traits.includes('Silent'));}
 const spear=profile('spear-gun');assert.equal(spear.conditionalEffects.intendedEnvironment.id,'underwater');assert.equal(spear.conditionalEffects.reload.action,'Significant');assert.equal(spear.conditionalEffects.reload.actions,1);
});

test('CSC Gauss Sniper integrated sight preserves p146 functions without granting body sensors or designation bonuses',()=>{
 const w=profile('gauss-sniper-rifle'),sight=w.conditionalEffects.weaponSight;
 for(const field of ['lightAmplification','passiveInfrared','visualMagnification','laserRangefinder','targetPaintingAvailable'])assert.equal(sight[field],true);
 assert.equal(sight.scope,'Weapon sight only');assert.equal(sight.recipientVisionGranted,false);assert.equal(sight.automaticDesignationDM,false);assert.equal(sight.source.pages,'146');
 assert.equal(w.baseAttackModifier,-3);assert.equal(w.attackModifier,null);assert.deepEqual(w.traits,['AP 6','Scope']);
 sight.lightAmplification=false;sight.source.pages='bad';const fresh=profile('gauss-sniper-rifle').conditionalEffects.weaponSight;assert.equal(fresh.lightAmplification,true);assert.equal(fresh.source.pages,'146');
});

test('CSC source conflicts retain the selected table values and leave Core values untouched',()=>{
 const csc=profile('gauss-rifle'),core=profile('gauss-rifle',{weaponId:'gauss-rifle'});
 assert.equal(csc.cost,2580);assert.equal(core.cost,2540);assert.equal(csc.sourceFamily,'csc-2023');assert.equal(core.sourceFamily,'core-2022');
 assert.equal(WEAPONS.find(w=>w.id==='gauss-rifle').magazineCost,40);assert.equal(WEAPONS.find(w=>w.id==='csc-gauss-rifle').magazineCost,80);
 assert.ok(has(run('gauss-rifle'),'WEAPON_SOURCE_INTERPRETATION'));assert.ok(has(run('assault-shotgun'),'WEAPON_SOURCE_INTERPRETATION'));
 const coreEnergy=profile('gauss-rifle',{weaponId:'stunner-12'}),handbook=profile('gauss-rifle',{weaponId:'handbook-stunner-12'});assert.equal(coreEnergy.cost,1500);assert.equal(handbook.cost,1700);
 assert.equal(profile('gauss-rifle',{weaponId:'shotgun',accessories:['gyrostabiliser']}).traits.includes('Bulky'),false);
 assert.ok(profile('gauss-rifle',{weaponId:'rifle',accessories:['scope-5','suppressor']}).traits.includes('Scope'));
});

test('every CSC row rejects every Core accessory without applying its cost or effects',()=>{
 for(const [id] of expected)for(const accessory of WEAPON_ACCESSORIES){
  const result=direct(id,{accessories:[accessory.id]});assert.ok(has(result,'CSC_ACCESSORIES_UNSUPPORTED'),id+' '+accessory.id);assert.equal(result.weapons[0].cost,null);assert.deepEqual(result.weapons[0].accessoryEffects,[]);assert.deepEqual(result.weapons[0].traits,WEAPONS.find(w=>w.id==='csc-'+id).traits);
 }
 const invalid=run('big-game-rifle',{accessories:['gyrostabiliser']});assert.equal(invalid.status,'invalid');assert.equal(invalid.totals,null);
});

test('CSC associated, integral and grenade ammunition inputs never inherit Core attacks or prices',()=>{
 const cases=[
  {auxiliaryLauncher:'attached',auxiliaryAmmunition:'frag',auxiliaryLoaded:1},
  {auxiliaryLauncher:'integral-acr',auxiliaryAmmunition:'frag',auxiliaryLoaded:1},
  {auxiliaryLauncher:'both-acr',auxiliaryAmmunition:'frag',integralAmmunition:'smoke',integralLoaded:1},
  {auxiliaryAmmunition:'aerosol'},{auxiliaryLoaded:1},{integralAmmunition:'stun'},{integralLoaded:1},{looseGrenades:1}
 ];
 for(const [id] of expected)for(const patch of cases){const result=direct(id,patch);assert.ok(has(result,'CSC_LAUNCHERS_UNSUPPORTED'));assert.equal(result.weapons[0].cost,null);assert.deepEqual(result.weapons[0].associatedAttacks,[]);}
 for(const ammunition of ['aerosol','frag','smoke','stun']){const r=run('gauss-rifle',{ammunition});assert.equal(r.status,'invalid');assert.equal(r.totals,null);assert.ok(has(r,'CSC_AMMUNITION_UNSUPPORTED'));}
 for(const ammunition of ['armour-piercing','guided','pellet','csc-frag'])assert.throws(()=>design('accelerator-rifle-11',{ammunition}),/Unknown ammunition choice/);
});

test('imports cannot supply CSC traits, launcher definitions, variable-capacity profiles or conditional modifiers',()=>{
 for(const patch of [{weaponId:'csc-ducks-foot-pistol'},{weaponId:'csc-heavy-advanced-combat-rifle'},{ammunition:'armour-piercing'},{conditionalEffects:{attackDM:99}},{cost:0},{sourceFamily:'core-2022'},{magazine:100}]){
  const d=design('gauss-rifle');Object.assign(d.selections.physical.weapons[0],patch);assert.throws(()=>importDesign(JSON.stringify(d)),TypeError);
 }
 const d=design('gauss-rifle',{accessories:['scope-5']});const imported=importDesign(exportDesign(d)),r=evaluateDesign(imported);assert.equal(r.status,'invalid');assert.ok(has(r,'CSC_ACCESSORIES_UNSUPPORTED'));
});

test('CSC catalogues, direct engine output, API and review retain detached conditions and source accounting',()=>{
 const d=design('coach-pistol');
 const catalogue=getCatalogue(d),choice=catalogue.stages.find(s=>s.id==='physical').controls.find(c=>c.type==='weapons').itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-coach-pistol');
 choice.conditionalEffects.reload.actions=999;choice.compatibility.accessoryRules='core-2022';choice.source.pages='bad';
 const raw=weaponControl(d).itemFields.find(f=>f.field==='weaponId').choices.find(w=>w.id==='csc-coach-pistol');raw.conditionalEffects.alternativeDischarge.damage='999D';
 const evaluated=direct('coach-pistol');evaluated.weapons[0].conditionalEffects.reload.actions=999;evaluated.weapons[0].source.pages='bad';evaluated.weapons[0].ammunitionAccounting.magazinePriceSource.pages='bad';
 const original=WEAPONS.find(w=>w.id==='csc-coach-pistol');assert.equal(original.conditionalEffects.reload.actions,1);assert.equal(original.conditionalEffects.alternativeDischarge.damage,'4D');assert.equal(original.source.pages,'142-143');assert.equal(original.ammunitionAccounting.magazinePriceSource.pages,'143');assert.equal(original.compatibility.accessoryRules,null);
 const api=createRobotApi({storage:{getItem:()=>null},locks:{request:async(name,callback)=>callback()}});api.importDesign(exportDesign(d));
 const view=api.getView(),weapon=view.evaluation.totals.weapons[0];assert.equal(weapon.conditionalEffects.alternativeDischarge.damage,'4D');assert.equal(weapon.weaponFamily,'pistol');assert.equal(weapon.ammunitionAccounting.initialMagazine,'separate-purchase');
 const details=view.review.sections.find(s=>s.id==='weapons').rows[0].details;assert.ok(details.some(r=>r.label==='Conditional Effects'&&r.value.includes('Significant')&&r.value.includes('4D')));assert.ok(details.some(r=>r.label==='Ammunition Accounting'&&r.value.includes('separate-purchase')));
 weapon.conditionalEffects.reload.actions=999;assert.equal(api.getView().evaluation.totals.weapons[0].conditionalEffects.reload.actions,1);
});
