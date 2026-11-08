import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDesign,updateDesign,getCatalogue,evaluateDesign} from '../engine/index.mjs';
import {weaponRecordPresentation,weaponControl,evaluateWeapons} from '../engine/weapons.mjs';
import {evaluateAugmentations} from '../engine/augmentations.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {presentationFacts} from '../js/rules-presentation.mjs';
import {magazinePanelModel,magazineProductId,magazineProductLabel,magazineProductFacts,magazineProductSources} from '../js/magazine-presentation.mjs';
import {renderMagazinePanel} from '../js/magazine-editor.mjs';
const weapon=(patch={})=>({id:'selected-weapon',weaponId:'csc-gauss-sniper-rifle',placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,initialMagazines:1,extraMagazines:0,weaponManufactureTL:12,initialAmmunitionModification:'apds',...patch});
const design=w=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{weapons:[w]}}});
const result=w=>evaluateWeapons(design(w),[],[]);
const review=w=>projectReview(design(w),getCatalogue(design(w)),{status:'verified',totals:result(w),diagnostics:[]});
const rows=r=>r.sections.find(section=>section.id==='weapons').rows[0].details;
const panel=w=>magazinePanelModel(w,weaponRecordPresentation(w).magazineSupplySelection,weaponControl(design(w)));
class Node {
 constructor(tag,text,className){this.tag=tag;this.textContent=text??'';this.className=className;this.children=[];this.listeners={};}
 append(...nodes){this.children.push(...nodes);}
 addEventListener(name,listener){this.listeners[name]=listener;}
 fire(name,value){if(value!==undefined)this.value=String(value);this.listeners[name]?.();}
}
const nodes=node=>node?[node,...node.children.flatMap(nodes)]:[];
const field=(tree,id)=>nodes(tree).find(node=>node.id==='gun-'+id);
function editor(record,onChange=()=>{}) {
 return renderMagazinePanel({record,selection:weaponRecordPresentation(record).magazineSupplySelection,control:weaponControl(design(record)),prefix:'gun',shared:false,groupKey:'key',recordGroups:new Map(),onChange,el:(...args)=>new Node(...args),selectChoices:(node,choices,value)=>{node.choices=structuredClone(choices);node.value=String(value??'');node.append(...choices.map(choice=>new Node('option',choice.label)));},numericPicker:(control,value,change)=>{const node=new Node('select');node.control=control;node.value=String(value);node.addEventListener('change',()=>change(Number(node.value)));return node;}});
}
const supply=(patch={})=>({sourceWeaponId:'csc-gauss-sniper-rifle',variant:'standard',modification:'baton',extraMagazines:0,autoloadMagazines:0,storageId:'none',...patch});

test('product identity preserves modification independently of capacity and source',()=>{
 const plain=supply({modification:'standard'}),legacy={...plain};delete legacy.modification;
 assert.equal(magazineProductId(plain),magazineProductId(legacy));
 assert.notEqual(magazineProductId(supply()),magazineProductId(plain));
 assert.notEqual(magazineProductId(supply()),magazineProductId(supply({variant:'high-capacity'})));
 const w=weapon(),before=structuredClone(w),m=panel(w);
 assert.equal(m.initialProduct.modification,'apds');assert.equal(m.initialProduct.productId,w.weaponId+':standard:apds');
 assert.ok(m.addChoices.some(choice=>choice.id===w.weaponId+':standard:baton'));
 assert.ok(!m.addChoices.some(choice=>choice.id===w.weaponId+':standard'));
 assert.match(magazineProductLabel(m.initialProduct),/Standard \/ APDS$/);
 assert.match(magazineProductFacts(m.initialProduct),/Standard-load-based estimate; modified mass unresolved/);
 assert.match(magazineProductSources(m.initialProduct),/179-180/);
 assert.deepEqual(w,before);
});

test('own modified products are added deliberately and standard resets remove optional identity',()=>{
 const w=weapon(),changes=[],tree=editor(w,(...args)=>changes.push(args)),id=w.weaponId+':standard:baton';
 tree.fire('toggle');field(tree,'alternateMagazineSupplies-add-product').fire('change',id);assert.deepEqual(changes,[]);
 field(tree,'alternateMagazineSupplies-add').fire('click');assert.deepEqual(changes[0],['alternateMagazineSupplies',[supply()]]);
 const modified=weapon({spareAmmunitionModification:'apds',alternateMagazineSupplies:[supply()]}),before=structuredClone(modified),edited=[];
 field(editor(modified,(...args)=>edited.push(args)),'alternateMagazineSupplies-0-product').fire('change',w.weaponId+':standard');
 assert.equal(Object.hasOwn(edited[0][1][0],'modification'),false);assert.equal(edited[0][1][0].variant,'standard');
 assert.deepEqual(modified,before);
});

test('unavailable and retained products never fall back to standard and remain removable',()=>{
 const w=weapon({weaponManufactureTL:null,initialAmmunitionModification:'future-unavailable',alternateMagazineSupplies:[supply({modification:'future-unavailable'})]});
 const before=structuredClone(w),m=panel(w),changes=[],tree=editor(w,(...args)=>changes.push(args));
 assert.equal(m.initialProduct,null);assert.equal(m.rows[0].product,null);assert.equal(m.rows[0].productId,w.weaponId+':standard:future-unavailable');assert.equal(m.forceGroupOpen,true);
 assert.ok(m.rows[0].choices.some(choice=>choice.id===m.rows[0].productId&&choice.eligibility?.available===false));
 assert.match(magazineProductFacts(m.rows[0].product),/Compatibility unresolved; price unresolved/);
 field(tree,'alternateMagazineSupplies-0-remove').fire('click');assert.deepEqual(changes,[['alternateMagazineSupplies',undefined]]);assert.deepEqual(w,before);
 const available=panel(weapon({weaponManufactureTL:null}));assert.ok(available.addChoices.some(choice=>choice.id.endsWith(':baton')&&choice.eligibility?.available===false));
});

test('loaded APDS review separates source hardware, configured copies and current loaded figures',()=>{
 const w=weapon(),r=review(w),detail=rows(r),print=formatStatblock(r);
 assert.match(r.sections.find(s=>s.id==='weapons').rows[0].value,/Loaded attack.*5D-5 damage.*1,100 m.*AP 21/);
 assert.match(detail.find(row=>row.label==='Source hardware profile').value,/5D damage.*1,000 m.*AP 6/);
 assert.match(detail.find(row=>row.label==='Manufacture declaration (all linked copies)').value,/TL12.*Catalogue TL12.*Catalogue-tier declaration/);
 assert.match(detail.find(row=>row.label==='Copy 1 configured ammunition').value,/APDS.*5D-5 damage.*Loaded/);
 assert.ok(!detail.some(row=>['Source Weapon Profile','Ammunition Attack Profiles','Loaded Ammunition Attack','Weapon Manufacture','Weapon Manufacture TL'].includes(row.label)));
 assert.doesNotMatch(print,/sourceWeaponProfile|productId|sourceWeaponId|csc-gauss|stunFraction|costMultiplier/);
});

test('zero initial load never presents configured damage as an active attack',()=>{
 const r=review(weapon({initialMagazines:0})),detail=rows(r),headline=r.sections.find(s=>s.id==='weapons').rows[0].value;
 assert.equal(headline,'Unloaded; no loaded attack');assert.doesNotMatch(headline,/5D|AP 21|1,100/);
 assert.match(detail.find(row=>row.label==='Copy 1 configured ammunition').value,/5D-5.*Initial: 0.*Not loaded/);
 assert.equal(detail.find(row=>row.label==='Loaded linked damage bonus').value,'Not applicable; unloaded');
 assert.ok(!detail.some(row=>row.label==='Common loaded attack'));
});

test('mixed copies retain their configured attacks but no common damage, AP or linked bonus',()=>{
 const w=weapon({linkedWeapons:2,ammunitionOverrides:[{copyIndex:2,initialMagazines:1,initialMagazineType:'standard',initialAmmunitionModification:'extended-range',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'}]}),r=review(w),detail=rows(r);
 assert.equal(r.sections.find(s=>s.id==='weapons').rows[0].value,'Mixed ammunition; common attack unresolved');
 assert.match(detail.find(row=>row.label==='Copy 1 configured ammunition').value,/5D-5/);
 assert.match(detail.find(row=>row.label==='Copy 2 configured ammunition').value,/Extended Range.*4D damage.*1,250 m/);
 assert.equal(detail.find(row=>row.label==='Loaded linked damage bonus').value,'Unresolved');
 assert.ok(!detail.some(row=>row.label==='Common loaded attack'));
});

test('Baton prints its conditional split without a universal Stun or source rule dump',()=>{
 const r=review(weapon({weaponId:'csc-grenade-launcher-standard',weaponManufactureTL:7,initialAmmunitionModification:'baton'})),detail=rows(r),headline=r.sections.find(s=>s.id==='weapons').rows[0].value;
 assert.match(headline,/5D damage.*75 m/);assert.doesNotMatch(headline,/Blast|AP|Stun/);
 assert.match(detail.find(row=>row.label==='Copy 1 configured ammunition / Baton split').value,/Half Stun \(round up\); remainder ordinary; armour order unresolved/);
 assert.match(detail.find(row=>row.label==='Source hardware profile').value,/Blast 6/);
 assert.doesNotMatch(formatStatblock(r),/Stun Fraction|Round Stun|Armour Processing Order/);
});

test('unknown manufacture, unsupported declarations and blocked selections remain explicitly unresolved',()=>{
 for(const declared of [null,13]){
  const r=review(weapon({weaponManufactureTL:declared})),detail=rows(r);
  assert.equal(r.sections.find(s=>s.id==='weapons').rows[0].value,'Loaded attack unresolved');
  assert.match(detail.find(row=>row.label==='Manufacture declaration (all linked copies)').value,declared===null?/Unknown/:/TL13.*Unsupported tier/);
  assert.match(detail.find(row=>row.label==='Copy 1 configured ammunition').value,/Profile unresolved/);
 }
 const w=weapon({initialAmmunitionModification:'baton',spareAmmunitionModification:'solid-shot'}),d=design(w),r=projectReview(d,getCatalogue(d),{status:'blocked',totals:null,diagnostics:[]});
 assert.equal(r.sections.find(s=>s.id==='weapons').rows[0].value,'Loaded attack unresolved');
 assert.match(formatStatblock(r),/Magazine selection: Initial: 1.*Baton/);assert.match(formatStatblock(r),/Standard spares: Solid Shot/);
});

test('component and cyberlimb reviews use the same specialised projection without host attack grants',()=>{
 const child=design(weapon()),host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'child',role:'installed-robot',quantity:1,design:child}]}}),component=formatStatblock(projectReview(host,getCatalogue(host),evaluateDesign(host)));
 assert.match(component,/Component-only weapon/);assert.match(component,/Copy 1 configured ammunition: APDS/);assert.match(component,/Manufacture declaration \(all linked copies\)/);
 const w=weapon({weaponId:'csc-assault-pistol',weaponManufactureTL:6,initialAmmunitionModification:'armour-piercing'});delete w.manipulatorId;
 const d=updateDesign(createDesign({kind:'cyborg',techLevel:14}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:1}}],augmentWeapons:[{...w,parentLimb:'limb'}]}}),augmentation=evaluateAugmentations(d),limb=formatStatblock(projectReview(d,getCatalogue(d),{status:'verified',totals:{augmentations:augmentation.augmentations},diagnostics:[]}));
 assert.match(limb,/Cyberlimb weapons/);assert.match(limb,/Copy 1 configured ammunition: Armour Piercing/);assert.match(limb,/Source hardware profile/);
});

test('selected profiles are detached, save/export stays lossless, and reference records are never generically exposed',()=>{
 const w=weapon({alternateMagazineSupplies:[supply()]}),d=design(w),api=createRobotApi();api.importDesign(JSON.stringify(d));const before=api.exportDesign(),r=api.getView().review;
 r.sections.find(s=>s.id==='weapons').rows[0].details[0].value='tampered';assert.equal(api.exportDesign(),before);assert.deepEqual(JSON.parse(before),d);
 assert.equal(presentationFacts({sourceWeaponProfile:{damage:'100D',description:'PRIVATE FULL SOURCE'},ammunitionAttackProfiles:[{damage:'99D'}],loadedAmmunitionAttack:{damage:'88D'},weaponManufacture:{declaredTL:12}}),undefined);
 const app=readFileSync(new URL('../js/app.mjs',import.meta.url),'utf8');assert.match(app,/recordChoices\(item,displayRecord,fieldView\)/);assert.match(app,/fieldView\.choices\?\?/);assert.match(app,/item\.omitByDefault.*value===item\.default\?undefined:value/);
});


test('configured profiles retain source conditions without exposing source prose',()=>{
 const w=weapon(),r=review(w),condition=rows(r).find(row=>row.label==='Copy 1 configured ammunition / Conditions');
 assert.match(condition.value,/Weapon Sight.*Light Amplification: Yes.*Target Painting Available: Yes.*Recipient Vision Granted: No/);
 const e=result(w),evaluated=e.weapons[0];
 evaluated.ammunitionAttackProfiles[0].conditionalEffects={...evaluated.ammunitionAttackProfiles[0].conditionalEffects,lowVelocity:{maximumRangeMeters:10,damageMultiplier:.5,condition:'Target at less than 10m',description:'PRIVATE COMPLETE REFERENCE PROSE'},stock:{condition:'Requires the shoulder stock to be extended',source:{book:'CSC',pages:'146'}}};
 const projected=formatStatblock(projectReview(design(w),getCatalogue(design(w)),{status:'verified',totals:e,diagnostics:[]}));
 assert.match(projected,/Low Velocity.*Maximum Range Meters: 10.*Damage Multiplier: 0.5/);assert.match(projected,/Stock.*Condition:/);
 assert.doesNotMatch(projected,/PRIVATE COMPLETE REFERENCE PROSE/);
 const absent=weapon({weaponManufactureTL:null,initialAmmunitionModification:'standard'}),details=rows(review(absent));
 assert.match(details.find(row=>row.label==='Manufacture declaration (all linked copies)').value,/^Unknown/);
});

test('zero-quantity selected spare modifications remain visible in review for correction',()=>{
 const w=weapon({spareAmmunitionModification:'baton',highCapacityAmmunitionModification:'future-unavailable'}),detail=rows(review(w));
 assert.ok(detail.some(row=>row.label.endsWith('/ Standard / Baton')&&/Extras: 0/.test(row.value)));
 assert.ok(detail.some(row=>/High-capacity \/ Unavailable/.test(row.label)&&/Price unresolved/.test(row.value)));
});


test('specialised review hides only default ammunition and inapplicable zero launcher sentinels',()=>{
 const defaults=weapon({ammunition:'standard',auxiliaryLauncher:'none',auxiliaryLoaded:0,integralLoaded:0}),before=structuredClone(defaults),detail=rows(review(defaults));
 for(const label of ['Ammunition','Auxiliary Loaded','Integral Loaded'])assert.ok(!detail.some(row=>row.label===label),label);
 assert.deepEqual(defaults,before);
 const retained=rows(review(weapon({ammunition:'frag',auxiliaryLoaded:1,integralLoaded:1})));
 assert.equal(retained.find(row=>row.label==='Ammunition').value,'frag');
 assert.equal(retained.find(row=>row.label==='Auxiliary Loaded').value,'1');assert.equal(retained.find(row=>row.label==='Integral Loaded').value,'1');
 const legacy=weapon({ammunition:'standard'});delete legacy.weaponManufactureTL;delete legacy.initialAmmunitionModification;
 assert.equal(rows(review(legacy)).find(row=>row.label==='Ammunition').value,'standard');
});

test('configured weapon Scope usage has its specific concise condition',()=>{
 const condition=rows(review(weapon())).find(row=>row.label==='Copy 1 configured ammunition / Conditions');
 assert.match(condition.value,/Scope Usage.*Printed scope: hand-held use only/);
 assert.doesNotMatch(condition.value,/Operating condition unresolved; check source/);
});
