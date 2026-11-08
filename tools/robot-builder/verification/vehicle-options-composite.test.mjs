import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,importDesign,exportDesign} from '../engine/index.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
const smoke=(quantity=1)=>({id:'smoke',optionId:'vh2026-smoke-discharger',quantity});
const child=(quantity=1)=>updateDesign(createDesign({techLevel:15}),{name:'Source robot',selections:{chassis:{size:'size-8'},physical:{verifiedVehicleOptions:[smoke(quantity)]}}});
const attach=(robot,role='installed-robot',quantity=1,parent=createDesign({kind:'vehicle-brain',techLevel:15}))=>updateDesign(parent,{special:{designReferences:[{id:'component',role,quantity,design:robot}]}});
const run=design=>{const evaluation=evaluateDesign(design),review=projectReview(design,getCatalogue(design),evaluation);return{evaluation,review,statblock:formatStatblock(review)};};
const group=review=>review.sections.find(section=>section.id==='component-vehicle-options');

test('complete child source hardware survives composite evaluation, review, print and import',()=>{
 const design=attach(child()),{evaluation,review,statblock}=run(importDesign(exportDesign(design))),component=evaluation.composite.components[0];
 assert.equal(evaluation.status,'verified');assert.equal(component.constructionCost,27000);assert.equal(evaluation.totals.cost,37000);
 assert.deepEqual(component.verifiedVehicleInstallations,evaluateDesign(child()).verifiedVehicleInstallations);
 assert.equal(evaluation.verifiedVehicleInstallations,undefined);assert.equal(evaluation.totals.verifiedVehicleInstallations,undefined);
 const item=group(review).rows[0];assert.equal(item.label,'Source robot / Smoke Discharger');assert.equal(item.value,'Cr 1,000 / 64 Slots per component copy');assert.equal(item.detail,'Component-only hardware; no host grant');
 assert.ok(item.details.some(row=>row.label==='Capacity per installation'&&row.value==='30'));assert.ok(item.details.some(row=>row.label==='Initial contents'&&row.value==='Unverified'));
 assert.match(statblock,/Source robot \/ Smoke Discharger/);assert.match(statblock,/Incoming attack DM -2 \(conditional\)/);assert.match(statblock,/Replacement charge price: Unknown/);assert.match(item.source,/2026/);
 const warnings=review.sections.find(section=>section.id==='warnings').rows.filter(row=>row.detail.includes('Smoke Discharger'));assert.equal(warnings.length,2);for(const warning of warnings){assert.match(warning.detail,/Source robot.*Vehicle options \(2026 source\).*Smoke Discharger 1/);assert.doesNotMatch(warning.detail,/vh2026|Vh2026/);}
});
test('two installations retain per-copy quantity, cost and capacity without duplicating accounting',()=>{
 const {evaluation,review}=run(attach(child(2))),item=evaluation.composite.components[0].verifiedVehicleInstallations[0];assert.equal(evaluation.status,'verified');assert.equal(item.quantity,2);assert.equal(item.cost,2000);assert.equal(item.slots,128);assert.equal(item.capacity,60);assert.equal(item.capacityPerInstallation,30);assert.equal(evaluation.totals.cost,38000);
 assert.equal(group(review).rows[0].value,'Cr 2,000 / 128 Slots per component copy');assert.ok(group(review).rows[0].details.some(row=>row.label==='Installations per component copy'&&row.value==='2'));
 assert.equal(evaluation.ledger.filter(row=>row.componentReference==='component').length,1);
});
test('component-copy quantity remains distinct from installations and does not multiply source facts',()=>{
 const receiver=updateDesign(createDesign({kind:'avatar',techLevel:15}),{name:'Source receiver',selections:{chassis:{size:'size-8'},physical:{verifiedVehicleOptions:[smoke()]}}}),controller=updateDesign(createDesign({kind:'avatar',techLevel:15}),{special:{avatarRole:'controller',controllerTier:'improved'}});
 const {evaluation,review}=run(attach(receiver,'receiver',2,controller)),component=evaluation.composite.components[0];assert.equal(evaluation.status,'verified');assert.equal(component.quantity,2);assert.equal(component.constructionCost,2*component.constructionUnitCost);assert.equal(component.verifiedVehicleInstallations[0].quantity,1);assert.equal(component.verifiedVehicleInstallations[0].cost,1000);
 assert.ok(group(review).rows[0].details.some(row=>row.label==='Component copies'&&row.value==='2'));assert.ok(group(review).rows[0].details.some(row=>row.label==='Installations per component copy'&&row.value==='1'));
});
test('component source records, conditions and review details are detached from source snapshots',()=>{
 const design=attach(child()),before=exportDesign(design),first=run(design);first.evaluation.composite.components[0].verifiedVehicleInstallations[0].conditionLabels.length=0;first.evaluation.composite.components[0].verifiedVehicleInstallations[0].effects.incomingAttackDM=-100;first.evaluation.composite.components[0].verifiedVehicleInstallations[0].source.edition='Forged';group(first.review).rows[0].details.length=0;
 assert.equal(exportDesign(design),before);const second=run(design),record=second.evaluation.composite.components[0].verifiedVehicleInstallations[0];assert.ok(record.conditionLabels.length);assert.equal(record.effects.incomingAttackDM,-2);assert.equal(record.source.edition,'Mongoose 2026');assert.ok(group(second.review).rows[0].details.length);
});
test('invalid and blocked children retain known hardware facts without a complete total',()=>{
 for(const robot of [child(3),updateDesign(child(),{selections:{physical:{verifiedVehicleOptions:[{...smoke(),extraCharges:1}]}}})]){
  const {evaluation,review,statblock}=run(attach(robot)),component=evaluation.composite.components[0];assert.notEqual(evaluation.status,'verified');assert.equal(evaluation.totals,null);assert.equal(component.profile,null);assert.equal(component.constructionCost,null);assert.equal(component.verifiedVehicleInstallations.length,1);assert.ok(group(review).rows[0].details.some(row=>row.label==='Component construction'&&['Needs correction','Rules incomplete'].includes(row.value)));assert.match(statblock,/Source robot \/ Smoke Discharger/);
 }
});
test('brain-only purchase omits discharger hardware, effects and purchase/deployment warnings',()=>{
 const {evaluation,review,statblock}=run(attach(child(),'installed-brain')),component=evaluation.composite.components[0];assert.equal(evaluation.status,'verified');assert.equal(evaluation.totals.cost,20000);assert.deepEqual(component.verifiedVehicleInstallations,[]);assert.equal(group(review),undefined);assert.doesNotMatch(statblock,/Smoke Discharger|Incoming attack DM -2|Capacity per installation/);assert.ok(!evaluation.diagnostics.some(row=>row.path.includes('verifiedVehicleOptions')));
 const invalid=run(attach(child(3),'installed-brain'));assert.equal(invalid.evaluation.status,'invalid');assert.equal(invalid.evaluation.totals,null);assert.equal(group(invalid.review),undefined);
});
