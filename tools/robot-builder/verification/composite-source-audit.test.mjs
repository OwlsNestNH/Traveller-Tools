import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,validateDesign,exportDesign,importDesign} from '../engine/index.mjs';

const robot=()=>createDesign({techLevel:13});
const parent=(kind='ship-brain')=>createDesign({kind,techLevel:13});
const attach=(p,child,role='installed-robot',quantity=1)=>updateDesign(p,{special:{designReferences:[{id:'component',role,quantity,design:child}]}});
const has=(r,c)=>r.diagnostics.some(d=>d.code===c);
test('Combined ship price includes one validated robot while keeping the external hull unvalidated',()=>{
 const r=evaluateDesign(attach(parent(),robot()));assert.equal(r.status,'verified');assert.equal(r.totals.cost,512000);
 assert.equal(r.ledger.reduce((sum,row)=>sum+row.cost,0),512000);
 assert.equal(r.totals.integration.installedRobotValidated,true);assert.equal(r.totals.integration.externalConstructionValidated,false);
 assert.equal(r.composite.externalHostValidated,false);assert.equal(r.coverage.complete,false);
});
test('Brain-only projection includes standard/custom software and hardening once, ignoring retail price',()=>{
 const child=updateDesign(robot(),{selections:{brain:{bandwidthUpgrade:'bw-2',intellectUpgrade:1,hardened:true},skills:{packages:['admin-1'],customPackages:[{id:'dialect',skill:'language',speciality:'Dialect',level:0}]},finalisation:{priceMode:'custom',customPrice:1}}});
 const r=evaluateDesign(attach(parent('vehicle-brain'),child,'installed-brain'));
 assert.equal(r.status,'verified');assert.equal(r.composite.components[0].constructionUnitCost,15000+7500+9000+1000+200);
 assert.equal(r.totals.cost,42700);assert.equal(r.ledger.reduce((sum,row)=>sum+row.cost,0),42700);
 assert.equal(r.composite.components[0].sourceDesignListCost,1);
});
test('Invalid and unresolved child designs propagate status and precise child paths',()=>{
 const invalid=updateDesign(robot(),{selections:{physical:{armourAdded:60}}});
 let r=evaluateDesign(attach(parent(),invalid));assert.equal(r.status,'invalid');assert.equal(r.totals,null);
 assert.ok(r.diagnostics.some(d=>d.code==='ARMOUR_MAX'&&d.path.startsWith('special.designReferences.component.')));
 const blocked=updateDesign(robot(),{selections:{physical:{options:['weapon-mount-autoloader-small']}}});
 r=evaluateDesign(attach(parent(),blocked));assert.equal(r.status,'blocked');assert.equal(r.totals,null);assert.ok(has(r,'OPTION_NOT_IMPLEMENTED'));
});
test('A biological avatar interface estimate cannot masquerade as a robot body or crash evaluation',()=>{
 for(const avatarRole of ['biacs','ribaci']){
  const child=updateDesign(createDesign({kind:'avatar',techLevel:13}),{special:{avatarRole,biologicalNeuralLink:'present'}});
  for(const [kind,role]of [['ship-brain','installed-robot'],['missile','payload']]){
   assert.throws(()=>attach(parent(kind),child,role));
   const raw=parent(kind);raw.special.designReferences=[{id:'fake',role,quantity:1,design:child}];
   const result=evaluateDesign(raw);assert.equal(result.status,'invalid');assert.equal(result.totals,null);
  }
 }
});
test('Missile whole-body occupancy uses twice immutable Base Slots even after removal',()=>{
 const child=updateDesign(robot(),{selections:{chassis:{size:'size-2'},finalisation:{removedSlots:1}}});
 const r=evaluateDesign(attach(parent('missile'),child,'payload'));
 assert.equal(r.status,'verified');assert.equal(r.totals.carrier.payloadSlotsUsed,4);
 assert.equal(r.composite.derivedInputs.warheadSlots,2);assert.equal(r.composite.derivedInputs.payloadSlotsUsed,4);
 const tooBig=updateDesign(robot(),{selections:{chassis:{size:'size-3'},physical:{manipulators:[]}}});
 const bad=evaluateDesign(attach(parent('missile'),tooBig,'payload'));assert.equal(bad.status,'invalid');assert.ok(has(bad,'MISSILE_WARHEAD_SIZE'));
});
test('Missile-case payload quantity is explicit and every purchased robot is charged once',()=>{
 const child=updateDesign(robot(),{selections:{chassis:{size:'size-2'}}});
 const p=updateDesign(parent('missile'),{special:{procurement:'case12'}});
 assert.ok(has(evaluateDesign(attach(p,child,'payload')),'COMPOSITE_PAYLOAD_COUNT'));
 const r=evaluateDesign(attach(p,child,'payload',12));assert.equal(r.status,'verified');
 assert.equal(r.composite.componentConstructionCost,12*10400);assert.equal(r.totals.cost,250000+12*10400);
});
test('Full-body organic conversion uses a brainless body and its actual remaining capacity',()=>{
 const r=evaluateDesign(attach(parent('cyborg'),createDesign({kind:'drone',techLevel:13}),'body'));
 assert.equal(r.status,'verified');assert.equal(r.totals.cost,1002000);
 assert.equal(r.totals.cyborg.externalBodyValidated,true);assert.equal(r.totals.cyborg.externalCharacterValidated,false);
 const wrong=evaluateDesign(attach(parent('cyborg'),robot(),'body'));assert.equal(wrong.status,'invalid');assert.ok(has(wrong,'COMPOSITE_ORGANIC_BRAIN'));
});
test('Ship occupied tonnage doubles only with both manipulators and locomotion',()=>{
 const child=updateDesign(robot(),{selections:{chassis:{size:'size-7'}}});
 assert.equal(evaluateDesign(attach(parent(),child)).totals.integration.occupiedHostCapacity,1);
 const armless=updateDesign(child,{selections:{physical:{manipulators:[]}}});
 assert.equal(evaluateDesign(attach(parent(),armless)).totals.integration.occupiedHostCapacity,.5);
 const still=updateDesign(child,{selections:{locomotion:{primary:'none'}}});
 assert.equal(evaluateDesign(attach(parent(),still)).totals.integration.occupiedHostCapacity,.5);
});
test('Ship haptic DEX follows selected brain technology, not the higher body technology',()=>{
 const r=evaluateDesign(attach(updateDesign(parent(),{special:{fullHaptics:'yes'}}),robot()));
 assert.equal(r.status,'verified');assert.equal(r.composite.derivedInputs.brainTL,12);
 assert.equal(r.totals.integration.effectiveDexterity,12);assert.equal(r.totals.cost,712000);
});
test('Robotic drone pairing requires both transceivers and retains inactive software conditions',()=>{
 const controller=updateDesign(robot(),{selections:{physical:{options:['robotic-drone-controller-basic']}}});
 let drone=createDesign({kind:'drone',techLevel:13});
 let r=evaluateDesign(attach(drone,controller,'controller'));assert.equal(r.status,'invalid');assert.ok(has(r,'COMPOSITE_DRONE_TRANSCEIVER'));
 drone=updateDesign(drone,{selections:{physical:{options:['transceiver-improved']}}});
 r=evaluateDesign(attach(drone,controller,'controller'));assert.equal(r.status,'verified');assert.ok(has(r,'COMPOSITE_CONTROL_INACTIVE'));
 assert.ok(r.composite.components[0].equipmentOperations.some(o=>o.status==='inactive'));
 assert.ok(r.composite.components[0].diagnostics.some(d=>d.code==='EQUIPMENT_INACTIVE_SKILL'));
});
test('Avatar references enforce complementary hardware and combined receiver Bandwidth',()=>{
 const controller=updateDesign(createDesign({kind:'avatar',techLevel:13}),{special:{avatarRole:'controller',controllerTier:'improved'},selections:{skills:{packages:['admin-1','mechanic-1']}}});
 const receiver=updateDesign(createDesign({kind:'avatar',techLevel:13}),{selections:{skills:{packages:['admin-1']}}});
 const r=evaluateDesign(attach(controller,receiver,'receiver'));assert.equal(r.status,'invalid');assert.ok(has(r,'COMPOSITE_AVATAR_BANDWIDTH'));
 const wrong=evaluateDesign(attach(controller,createDesign({kind:'drone',techLevel:13}),'receiver'));assert.equal(wrong.status,'invalid');assert.ok(has(wrong,'COMPOSITE_AVATAR_HARDWARE'));
});
test('Snapshots are detached, reject forged totals and cannot introduce duplicate or cyclic references',()=>{
 const child=robot(),d=attach(parent(),child);child.techLevel=5;assert.equal(d.special.designReferences[0].design.techLevel,13);
 assert.equal(evaluateDesign(importDesign(exportDesign(d))).totals.cost,512000);
 const forged=robot();forged.totals={cost:0};assert.throws(()=>attach(parent(),forged));
 assert.throws(()=>updateDesign(d,{special:{designReferences:[...d.special.designReferences,...d.special.designReferences]}}));
 const cycle=parent();cycle.special.designReferences=[{id:'cycle',role:'installed-robot',quantity:1,design:cycle}];assert.equal(validateDesign(cycle).valid,false);
});
