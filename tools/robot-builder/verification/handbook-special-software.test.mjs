import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,importDesign,getCatalogue} from '../engine/index.mjs';
import {createRobotApi,STORE_KEY} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
const micro=(special={},techLevel=14)=>updateDesign(createDesign({kind:'microbot',techLevel}),{special});
const nano=(packageType,techLevel,special={})=>updateDesign(createDesign({kind:'nanorobot',techLevel}),{special:{packageType,...special}});
const evaluate=s=>evaluateDesign(micro(s));
const has=(r,code)=>r.diagnostics.some(d=>d.code===code);
const custom=(patch={})=>({id:'field',skill:'profession',speciality:'Swarm gardener',level:1,...patch});
const review=d=>formatStatblock(projectReview(d,getCatalogue(d),evaluateDesign(d)));

test('Basic none microbot accepts one standard package with ordinary INT effect',()=>{
 const r=evaluate({brain:'basic',corePackage:'basic-none',packages:['admin-1']});
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,5500);assert.equal(r.totals.bandwidth.used,1);
 const skill=r.totals.skills.find(s=>s.id==='admin');assert.equal(skill.level,1);assert.equal(skill.modifier,-1);assert.equal(skill.effectiveLevel,0);
 assert.equal(r.totals.microbot.softwareCost,1000);assert.equal(r.totals.microbot.hardwareCost,4500);
});
test('micro package choices preserve inherent, family, level, technology and no-module constraints',()=>{
 assert.ok(has(evaluate({brain:'basic',corePackage:'basic-none',packages:['admin-0','advocate-0']}),'MICRO_BANDWIDTH'));
 assert.ok(has(evaluate({brain:'basic',corePackage:'basic-none',packages:['admin-2']}),'BASIC_SKILL_LEVEL'));
 assert.ok(has(evaluate({packages:['admin-0']}),'PRIMITIVE_STANDARD_SKILLS'));
 assert.ok(has(evaluate({brain:'basic',corePackage:'basic-recon',packages:['admin-0']}),'BASIC_FIXED_SKILLS'));
 assert.ok(has(evaluate({brain:'advanced',corePackage:'none',advancedBrainInterpretation:'micro-table',packages:['admin-3']}),'INHERENT_BANDWIDTH'));
 const controls=getCatalogue(micro()).stages.flatMap(s=>s.controls);assert.ok(!controls.some(c=>c.field==='bandwidthUpgrade'));
 assert.throws(()=>micro({bandwidthUpgrade:'bw-1'}));
 assert.ok(has(evaluate({brain:'advanced',corePackage:'none'}),'MICRO_BRAIN_CONFLICT'));
});
test('hard-coded locomotion, selected weapon and servant use shared source rules',()=>{
 const loco=evaluate({brain:'basic',corePackage:'basic-locomotion',locomotion:'grav'});
 assert.equal(loco.status,'verified');assert.equal(loco.totals.skills.find(s=>s.id==='vehicle-grav').level,0);assert.equal(loco.totals.skills.find(s=>s.id==='athletics-dexterity').effectiveLevel,0);
 assert.ok(has(evaluate({corePackage:'primitive-homing'}),'CORE_WEAPON_REQUIRED'));
 const homing=evaluate({corePackage:'primitive-homing',coreWeapon:'melee:unarmed'});assert.equal(homing.status,'verified');assert.equal(homing.totals.skills[0].id,'melee:unarmed');assert.equal(homing.totals.skills[0].effectiveLevel,1);assert.ok(!homing.totals.skills.some(s=>s.id==='weapon'));
 const servant=evaluate({brain:'basic',corePackage:'basic-servant',servantProfession:'domestic-cleaner'});assert.equal(servant.status,'verified');assert.equal(servant.totals.skills[0].id,'profession-domestic-cleaner');assert.equal(servant.totals.skills[0].level,2);
 assert.ok(has(evaluate({corePackage:'primitive-clean'}),'CLEANING_EQUIPMENT'));
 assert.ok(has(evaluate({brain:'hunter-killer',corePackage:'hunter-standard',coreWeapon:'gunner:turret',hunterBandwidth:'zero'}),'HUNTER_WEAPON'));
});
test('micro Hunter/Killer preserves explicit bandwidth interpretation and no invented weapon',()=>{
 const s={brain:'hunter-killer',corePackage:'hunter-standard',coreWeapon:'gun-combat:slug',packages:['admin-1']};
 assert.ok(has(evaluate(s),'HUNTER_BANDWIDTH_INTERPRETATION'));
 assert.equal(evaluate({...s,hunterBandwidth:'zero'}).status,'verified');assert.ok(has(evaluate({...s,hunterBandwidth:'one'}),'MICRO_BANDWIDTH'));
 assert.ok(has(evaluate({...s,hunterBandwidth:'zero',coreWeapon:'unspecified'}),'CORE_WEAPON_REQUIRED'));
});
test('custom micro software shares schema, duplicate coverage, costs and per-arm modifiers',()=>{
 const s={brain:'advanced',corePackage:'none',advancedBrainInterpretation:'micro-table'};
 const r=evaluate({...s,customPackages:[custom()],environment:'corrosive'});assert.equal(r.status,'verified');assert.equal(r.totals.cost,23000);assert.equal(r.totals.microbot.softwareCost,2000);assert.equal(r.totals.skills[0].id,'profession:swarm-gardener');assert.equal(r.totals.skills[0].grantsOtherSpecialitiesAtZero,false);
 assert.ok(has(evaluate({...s,packages:['science-robotics-1'],customPackages:[custom({skill:'science',speciality:'Robotics'})]}),'DUPLICATE_SKILL'));
 assert.ok(has(evaluate({...s,packages:['gun-combat-all-listed-1','gun-combat-slug-1']}),'DUPLICATE_SKILL'));
 assert.throws(()=>micro({...s,customPackages:[custom({price:0})]}));assert.throws(()=>micro({...s,customPackages:null}));assert.throws(()=>micro({...s,customPackages:[custom({skill:'pilot'})]}));
 const dex=evaluate({...s,arms:2,packages:['gun-combat-slug-1']});assert.equal(dex.status,'verified');assert.equal(dex.totals.skills[0].modifierOptions.length,2);assert.equal(dex.totals.skills[0].modifierOptions[0].effectiveLevel,1);
});
test('brainless receiver and communications inspect legacy, instance-only and mixed hardware',()=>{
 const s={brain:'none',corePackage:'none'},instance=(id,optionId)=>({id,optionId,parameters:{}});
 for(const hardware of [{options:['drone-interface','wireless']},{optionInstances:[instance('receiver','drone-interface'),instance('comms','wireless')]},{options:['drone-interface'],optionInstances:[instance('comms','wireless')]}]){
  const r=evaluate({...s,...hardware});assert.equal(r.status,'verified');assert.equal(r.totals.cost,610);assert.equal(r.totals.zeroSlot.used,2);
 }
 assert.ok(has(evaluate({...s,optionInstances:[instance('comms','wireless')]}),'MICRO_DRONE_INTERFACE'));
 assert.ok(has(evaluate({...s,optionInstances:[instance('receiver','drone-interface')]}),'MICRO_DRONE_COMMS'));
 assert.ok(has(evaluate({...s,options:['drone-interface','wireless'],customPackages:[custom({level:0})]}),'MICRO_NO_BRAIN_SOFTWARE'));
});
test('legacy micro fields default only when absent and never invent a weapon specialty',()=>{
 const d=micro({corePackage:'primitive-homing'});for(const field of ['customPackages','coreWeapon','servantProfession'])delete d.special[field];
 const migrated=importDesign(JSON.stringify(d));assert.equal(migrated.special.coreWeapon,'unspecified');assert.deepEqual(migrated.special.customPackages,[]);assert.ok(has(evaluateDesign(migrated),'CORE_WEAPON_REQUIRED'));
 assert.equal(evaluateDesign({...d,special:{...d.special,corePackage:'primitive-alert'}}).status,'verified');
 for(const [field,value] of [['coreWeapon','forged'],['servantProfession','any'],['customPackages',null]])assert.throws(()=>importDesign(JSON.stringify({...d,special:{...d.special,[field]:value}})));
});
test('micro API save/load, export/import and review retain choices and effective skills',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},options={storage,locks:{request:async(_n,_o,fn)=>fn()},idFactory:()=> 'micro-saved'};
 const api=createRobotApi(options),d=micro({brain:'basic',corePackage:'basic-none',customPackages:[custom()]});api.importDesign(JSON.stringify(d));await api.saveDesign();
 const saved=map.get(STORE_KEY),next=createRobotApi(options);next.loadDesign('micro-saved');assert.equal(map.get(STORE_KEY),saved);assert.deepEqual(next.getView().design.special.customPackages,d.special.customPackages);
 assert.equal(next.getView().evaluation.status,'verified');assert.match(next.getStatblock(),/Swarm gardener|swarm-gardener/);assert.match(next.getStatblock(),/Installed level 1/);
 assert.deepEqual(importDesign(next.exportDesign()),next.getView().design);
 const blocked=micro({brain:'advanced',corePackage:'none',packages:['admin-1'],customPackages:[custom()]});const text=review(blocked);assert.match(text,/Admin 1/);assert.match(text,/Swarm gardener/);assert.match(text,/Not calculated/);assert.doesNotMatch(text,/Effective 1/);
});
test('high-tech constructor controller input is available and total uses native litres',()=>{
 for(const [type,tl,cost] of [['construction-enhanced',18,20000],['construction-advanced',20,40000]]){
  const d=nano(type,tl,{packages:2,controllerMaxTasks:2});const c=getCatalogue(d).stages.find(s=>s.id==='brain').controls.find(c=>c.field==='controllerMaxTasks');assert.ok(c.visibleWhen.oneOf.includes(type));
  const r=evaluateDesign(d);assert.equal(r.status,'verified');assert.equal(r.totals.cost,cost);assert.equal(r.totals.nanorobot.controllerMaxTasks,2);assert.match(review(d),/Cost Basis: per litre/);
  assert.ok(has(evaluateDesign(nano(type,tl,{packages:2})),'NANO_CONTROLLER_TASKS'));assert.match(review(nano(type,tl,{packages:2})),/Not calculated/);
 }
});
test('high-tech protection compounds per source unit without inventing performance',()=>{
 for(const [type,tl,unitCost,basis] of [['construction-enhanced',18,10000,'per litre'],['construction-advanced',20,20000,'per litre'],['construction-superior',23,50000,'per litre'],['distributed-conscious',22,200000,'per package']]){
  for(const [environment,radiationLevels,multiplier] of [['none',0,1],['corrosive',0,2],['insidious',2,20]]){
   const d=nano(type,tl,{environment,radiationLevels}),r=evaluateDesign(d);assert.equal(r.status,'verified');assert.equal(r.totals.cost,unitCost*multiplier);assert.equal(r.totals.nanorobot.costBasis,basis);assert.equal(r.totals.nanorobot.protectionMultiplier,multiplier);assert.equal(r.totals.nanorobot.lifeHours,null);assert.equal(r.totals.nanorobot.productionSlotsPerHour,null);assert.equal(r.totals.bandwidth,null);assert.equal(r.totals.intelligence,undefined);assert.ok(review(d).includes('Cost Basis: '+basis));
   assert.equal(r.ledger.reduce((n,e)=>n+e.cost,0),r.totals.cost);assert.equal(evaluateDesign(importDesign(JSON.stringify(d))).totals.cost,r.totals.cost);
  }
 }
 assert.equal(evaluateDesign(nano('distributed-conscious',22,{environment:'corrosive'})).totals.cost,400000);
});


