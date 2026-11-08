import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,importDesign,exportDesign,getCatalogue} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
const body=(techLevel=17,tier='basic')=>updateDesign(createDesign({kind:'metamorphic',techLevel}),{name:'Metamorphic source',special:{metamorphicTier:tier}});
const host=(child,role='installed-brain')=>updateDesign(createDesign({kind:'vehicle-brain',techLevel:19}),{special:{designReferences:[{id:'source',role,quantity:1,design:child}]}});
const run=(child,role)=>evaluateDesign(host(child,role));
const output=d=>formatStatblock(projectReview(d,getCatalogue(d),evaluateDesign(d)));

test('all metamorphic tiers project ordinary brain cost only; complete body costs remain exact',()=>{
 for(const [tl,tier,full]of [[17,'basic',812000],[18,'improved',1612000],[19,'advanced',3212000]]){
  for(const role of ['installed-brain','installed-robot']){const result=run(body(tl,tier),role),component=result.composite.components[0];assert.equal(result.status,'verified');assert.equal(component.constructionUnitCost,role==='installed-brain'?10000:full);assert.equal(result.totals.cost,10000+(role==='installed-brain'?10000:full));assert.equal(result.ledger.reduce((sum,row)=>sum+row.cost,0),result.totals.cost);assert.equal(result.totals.metamorphic,undefined);assert.equal(result.metamorphic,undefined);
   assert.equal(result.composite.derivedInputs.bodyMode,role==='installed-brain'?'bare':'body');assert.equal(result.composite.derivedInputs.locomotion,role==='installed-brain'?'no':'yes');assert.equal(result.composite.derivedInputs.manipulators,role==='installed-brain'?'no':'yes');
   if(role==='installed-brain'){assert.equal(component.metamorphic,undefined);assert.equal(component.sourceProvenance.provisional,true);assert.equal(component.sourceProvenance.scope,'Source body excluded; brain and software only');assert.ok(!result.ledger.some(row=>row.id==='metamorphic-body'));}else{assert.equal(component.metamorphic.bodyCost,full-12000);assert.equal(component.sourceProvenance,undefined);}
  }
 }
});
test('brain-only projection includes hardened brain, bandwidth, intellect and both software categories exactly once',()=>{
 const child=updateDesign(body(),{selections:{brain:{bandwidthUpgrade:'bw-4',intellectUpgrade:1,hardened:true},skills:{packages:['admin-0','mechanic-1'],customPackages:[{id:'robotics',skill:'science',speciality:'Robotics',level:0}]},finalisation:{priceMode:'custom',customPrice:1}}}),result=run(child),component=result.composite.components[0];
 // Cr15000 hardened brain + Cr30000 hardened BW4 + Cr9000 INT + Cr100 Admin0 + Cr1000 Mechanic1 + Cr200 Science0.
 assert.equal(result.status,'verified');assert.equal(component.constructionUnitCost,55300);assert.equal(result.totals.cost,65300);assert.equal(component.listedUnitCost,null);assert.equal(component.sourceDesignListCost,1);assert.equal(run(child,'installed-robot').totals.cost,867300);assert.equal(run(child,'installed-robot').composite.components[0].listedUnitCost,1);
});
test('brain-only API and print omit unpurchased body costs/times while retaining source provenance and snapshots',()=>{
 const d=host(body()),api=createRobotApi({storage:null});api.importDesign(exportDesign(d));const view=api.getView(),printed=api.getStatblock(),component=view.evaluation.composite.components[0];
 assert.equal(component.constructionUnitCost,10000);assert.equal(component.metamorphic,undefined);assert.equal(component.sourceProvenance.convention,'provisional-base-slots-standard-v1');assert.equal(view.evaluation.provisional,true);
 for(const label of ['Cr 20,000','Provisional metamorphic snapshot','Brain and software only; source body excluded','Morph capability: Not purchased','Source body Slots (not purchased)','Source robot context; only brain/software purchased'])assert.ok(printed.includes(label),label);
 assert.doesNotMatch(printed,/Body surcharge|Morph time|1D minutes|Cr 800,000|Enhanced android/);assert.deepEqual(importDesign(api.exportDesign()),d);assert.equal(view.review.sections.find(s=>s.id==='components').rows[0].details.some(d=>d.label==='Body surcharge'),false);
});
test('whole-body nested print rows retain explicit application-convention provenance',()=>{
 const d=host(body(),'installed-robot'),printed=output(d),review=projectReview(d,getCatalogue(d),evaluateDesign(d));
 assert.match(printed,/Body surcharge per component copy: Cr 800,000/);assert.match(printed,/Morph time: 1D minutes/);assert.match(printed,/Base Slots price basis: Original chassis Base Slots \| Application convention/);assert.match(printed,/Body reservation assumption: 0 additional reserved Slots \| Application convention/);
 assert.equal(review.sections.find(s=>s.id==='components').rows[0].details.filter(row=>row.detail==='Application convention').length,6);
});
test('invalid source TL, fit and brain selections remain blocking and preserved in both component modes',()=>{
 const badSources=[body(16),updateDesign(body(),{selections:{physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:17}}}}}),updateDesign(body(),{selections:{brain:{model:'none'}}})];
 for(const child of badSources)for(const role of ['installed-brain','installed-robot']){const d=host(child,role),r=evaluateDesign(d);assert.equal(r.status,'invalid');assert.equal(r.totals,null);assert.equal(r.composite.components[0].constructionUnitCost,null);assert.deepEqual(importDesign(exportDesign(d)).special.designReferences[0].design,child);if(role==='installed-brain'){assert.equal(r.composite.components[0].metamorphic,undefined);assert.doesNotMatch(output(d),/Body surcharge|Morph time|1D minutes/);}}
 const repaired=host(body());assert.equal(evaluateDesign(repaired).totals.cost,20000);
});
test('source and result mutations cannot forge projected prices or remove provenance',()=>{
 const child=body(),d=host(child);child.special.metamorphicTier='advanced';assert.equal(evaluateDesign(d).totals.cost,20000);
 const result=evaluateDesign(d);result.composite.components[0].sourceProvenance.provisional=false;result.composite.components[0].sourceProvenance.convention='free';result.composite.components[0].constructionUnitCost=0;assert.equal(evaluateDesign(d).composite.components[0].sourceProvenance.provisional,true);assert.equal(evaluateDesign(d).totals.cost,20000);
 const api=createRobotApi({storage:null});api.importDesign(exportDesign(d));const view=api.getView();view.evaluation.composite.components[0].sourceProvenance.scope='Host morphs';assert.match(api.getView().evaluation.composite.components[0].sourceProvenance.scope,/excluded/);
 for(const field of ['bodyCost','pricePerSlot','provisional']){const forged=structuredClone(d);forged.special.designReferences[0].design.special[field]=0;assert.throws(()=>importDesign(JSON.stringify(forged)));}const forged=structuredClone(d);forged.special.designReferences[0].sourceProvenance={provisional:false};assert.throws(()=>importDesign(JSON.stringify(forged)));
});
test('brain-only unsupported body multipliers and required reference count guards remain intact',()=>{
 const android=createDesign({kind:'android',techLevel:19});assert.ok(run(android).diagnostics.some(d=>d.code==='COMPOSITE_BRAIN_PROJECTION'));
 const d=host(body());d.special.designReferences[0].quantity=2;assert.ok(evaluateDesign(d).diagnostics.some(d=>d.code==='COMPOSITE_REQUIRED_REFERENCE'));
 const brainless=createDesign({kind:'drone',techLevel:19});assert.ok(run(brainless).diagnostics.some(d=>d.code==='COMPOSITE_BRAIN_REQUIRED'));
});
test('twelve complete metamorphic payload copies retain the body surcharge exactly once per copy',()=>{
 const child=updateDesign(body(),{selections:{chassis:{size:'size-2'}}}),parent=updateDesign(createDesign({kind:'missile',techLevel:19}),{special:{procurement:'case12',designReferences:[{id:'payload',role:'payload',quantity:12,design:child}]}}),r=evaluateDesign(parent),c=r.composite.components[0];
 assert.equal(r.status,'verified');assert.equal(c.metamorphic.bodyCost,100000);assert.equal(c.constructionUnitCost,110400);assert.equal(c.constructionCost,1324800);assert.equal(r.totals.cost,1574800);assert.equal(r.ledger.reduce((n,row)=>n+row.cost,0),1574800);assert.match(output(parent),/Body surcharge per component copy: Cr 100,000/);
});

test('user-named body records cannot masquerade as brain, upgrade or package ledger entries',()=>{
 for(const kind of ['metamorphic','standard'])for(const id of ['brain','bandwidth','intellect','admin-0','custom-robotics','core-package']){
  let child=kind==='metamorphic'?body():createDesign({techLevel:17});child=updateDesign(child,{selections:{brain:{bandwidthUpgrade:'bw-4',intellectUpgrade:1,hardened:true},skills:{packages:['admin-0','mechanic-1'],customPackages:[{id:'robotics',skill:'science',speciality:'Robotics',level:0}]},physical:{manipulators:[...child.selections.physical.manipulators,{id,kind:'additional',size:5,strengthIncrease:2,dexterityIncrease:0}]}}});
  const result=run(child);assert.equal(result.status,'verified');assert.equal(result.composite.components[0].constructionUnitCost,55300,kind+'/'+id);assert.equal(result.totals.cost,65300);assert.equal(evaluateDesign(child).ledger.find(r=>r.label==='Manipulator '+id).accountingDomain,undefined);
 }
 const primitive=updateDesign(body(),{selections:{brain:{model:'primitive-tl8'},skills:{corePackage:'primitive-alert'}}});const source=evaluateDesign(primitive),core=source.ledger.find(r=>r.id==='core-package');assert.equal(core.accountingDomain,'brain-software');assert.equal(run(primitive).composite.components[0].constructionUnitCost,source.ledger.filter(r=>r.accountingDomain==='brain-software').reduce((n,r)=>n+r.cost,0));
});
import {renderReview} from '../js/review.mjs';
test('nested component HTML renders all six application-convention tags as safe text',()=>{
 class Node{constructor(tag){this.tag=tag;this.children=[];this.textContent='';}append(...items){this.children.push(...items);}}
 const d=host(body(),'installed-robot'),review=projectReview(d,getCatalogue(d),evaluateDesign(d)),tree=renderReview(review,{createElement:tag=>new Node(tag)}),nodes=[];const walk=n=>{nodes.push(n);n.children.forEach(walk);};walk(tree);
 assert.equal(nodes.filter(n=>n.tag==='small'&&n.textContent==='Application convention').length,6);assert.ok(nodes.every(n=>!Object.hasOwn(n,'innerHTML')));
});
test('retrotech and the paid hunter core package retain exact source-ledger prices in projection',()=>{
 const retro=updateDesign(body(),{selections:{brain:{model:'very-advanced-tl12',bandwidthUpgrade:'bw-6',hardened:true,intellectUpgrade:1},skills:{packages:['admin-0']}}});
 // 500000 / 32 * 1.5 + 50000 * 1.5 + 10000 INT + 100 Admin.
 assert.equal(run(retro).composite.components[0].constructionUnitCost,108537.5);assert.equal(run(retro).totals.cost,118537.5);
 const hunter=updateDesign(body(),{selections:{brain:{model:'hunter-killer-tl10'},skills:{corePackage:'hunter-tactical',hunterBandwidth:'one',coreWeapon:'gun-combat:slug'}}});
 const result=run(hunter);assert.equal(result.status,'verified');assert.equal(result.composite.components[0].constructionUnitCost,16000);assert.equal(result.totals.cost,26000);
});
