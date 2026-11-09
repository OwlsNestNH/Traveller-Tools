import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,getCatalogue,evaluateDesign} from '../engine/index.mjs';
import {weaponRecordPresentation,weaponControl} from '../engine/weapons.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {magazinePanelModel,magazineProductFacts} from '../js/magazine-presentation.mjs';
import {renderMagazinePanel} from '../js/magazine-editor.mjs';
const standard='csc-arl-standard',support='csc-arl-support',storage='option:storage-compartment';
const donor=(patch={})=>({sourceWeaponId:support,variant:'standard',extraMagazines:3,autoloadMagazines:2,storageId:storage,...patch});
const spec=(patch={})=>({initialMagazines:1,initialMagazineType:'standard',initialMagazineSourceId:support,extraMagazines:2,extraHighCapacityMagazines:1,autoloadAllocation:{standard:1,highCapacity:1},spareMagazineStorageId:storage,highCapacityMagazineStorageId:'none',alternateMagazineSupplies:[donor(),donor({variant:'high-capacity',extraMagazines:1,autoloadMagazines:1,storageId:'none'})],...patch});
const weapon=(patch={})=>({id:'private-weapon',weaponId:standard,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:true,...spec(),...patch});
const ordinary=(patch={})=>({id:'private-weapon',weaponId:standard,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,initialMagazines:1,extraMagazines:0,...patch});
const design=(w=weapon())=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{options:['storage-compartment'],optionParameters:{'storage-compartment':{quantity:10}},weapons:[w]}}});
const panel=w=>magazinePanelModel(w,weaponRecordPresentation(w).magazineSupplySelection,weaponControl(design(w)));
const review=d=>projectReview(d,getCatalogue(d),evaluateDesign(d));
const details=r=>r.sections.find(section=>section.id==='weapons').rows[0].details;
class Node {
 constructor(tag,text,className){this.tag=tag;this.textContent=text??'';this.className=className;this.children=[];this.listeners={};}
 append(...nodes){this.children.push(...nodes);}
 addEventListener(name,listener){this.listeners[name]=listener;}
 fire(name,value){if(value!==undefined)this.value=String(value);this.listeners[name]?.();}
}
const nodes=node=>node?[node,...node.children.flatMap(nodes)]:[];
const text=node=>nodes(node).map(item=>item.textContent).join('\n');
function editor(record,onChange=()=>{}) {
 const selection=weaponRecordPresentation(record).magazineSupplySelection;
 return renderMagazinePanel({record,selection,control:weaponControl(design(record)),prefix:'gun',shared:false,groupKey:'key',recordGroups:new Map(),onChange,el:(...args)=>new Node(...args),selectChoices:(node,choices,value)=>{node.choices=structuredClone(choices);node.value=String(value??'');node.append(...choices.map(choice=>new Node('option',choice.label)));},numericPicker:(control,value,change)=>{const node=new Node('select');node.control=control;node.value=String(value);node.addEventListener('change',()=>change(Number(node.value)));return node;}});
}
const field=(tree,id)=>nodes(tree).find(node=>node.id==='gun-'+id);

test('ARL editor sources preserve product identity in both receiver directions',()=>{
 for(const [receiver,source] of [[standard,support],[support,standard]]){
  const w=ordinary({weaponId:receiver}),m=panel(w);
  assert.deepEqual(m.addChoices.map(choice=>choice.id),[source+':standard',source+':high-capacity']);
  assert.equal(m.initialSourceId,receiver);assert.equal(m.rows.length,0);assert.equal(m.sourceChoices.length,2);
  assert.equal(m.numericControls.extraMagazines.max,110);assert.equal(m.numericControls.autoloadMagazines.max,110);
  assert.ok(m.addChoices.every(choice=>!/csc-arl/.test(choice.label)));
 }
 const m=panel(weapon());assert.notEqual(m.rows[0].productId,m.rows[1].productId);assert.match(magazineProductFacts(m.rows[0].product),/40 rounds.*Cr 200.*0.8 kg estimated; source-magazine basis/);
});

test('opening the compatible disclosure and choosing an Add product do not mutate legacy drafts',()=>{
 const record=ordinary(),before=structuredClone(record),changes=[];const tree=editor(record,(...args)=>changes.push(args));
 tree.open=true;tree.fire('toggle');field(tree,'alternateMagazineSupplies-add-product').fire('change',support+':standard');
 assert.deepEqual(record,before);assert.deepEqual(changes,[]);assert.equal(Object.hasOwn(record,'initialMagazineSourceId'),false);assert.equal(Object.hasOwn(record,'alternateMagazineSupplies'),false);
 assert.equal(field(tree,'alternateMagazineSupplies-add').disabled,false);
 field(tree,'alternateMagazineSupplies-add').fire('click');
 assert.deepEqual(changes,[['alternateMagazineSupplies',[donor({extraMagazines:0,autoloadMagazines:0,storageId:'none'})]]]);
});

test('selected donor rows expose bounded edits, deliberate removal and initial-source reset',()=>{
 const record=weapon(),changes=[],tree=editor(record,(...args)=>changes.push(args));
 assert.equal(field(tree,'alternateMagazineSupplies-add-product'),undefined);
 const total=field(tree,'alternateMagazineSupplies-0-extraMagazines');assert.deepEqual(total.control,{min:0,max:110,step:1});total.fire('change',5);
 assert.equal(changes[0][1][0].extraMagazines,5);assert.equal(changes[0][1][0].autoloadMagazines,2);
 field(tree,'initialMagazineSourceId').fire('change',standard);assert.deepEqual(changes[1],['initialMagazineSourceId',undefined]);
 const one=weapon({alternateMagazineSupplies:[donor({extraMagazines:0,autoloadMagazines:0,storageId:'none'})]});
 field(editor(one,(...args)=>changes.push(args)),'alternateMagazineSupplies-0-remove').fire('click');assert.deepEqual(changes.at(-1),['alternateMagazineSupplies',undefined]);
 assert.deepEqual(record,weapon());
});

test('ordinary weapons stay compact while incompatible and stale imported selections remain correctable',()=>{
 assert.equal(editor(ordinary({weaponId:'csc-arl-pdw'})),null);assert.equal(editor(ordinary({weaponId:'autopistol'})),null);
 for(const receiver of ['csc-arl-pdw','autopistol']){
  const w=weapon({weaponId:receiver,initialMagazineSourceId:'private-source',alternateMagazineSupplies:[donor({sourceWeaponId:'private-source',extraMagazines:0,autoloadMagazines:11,storageId:'instance:private-locker'})]});
  const tree=editor(w);assert.equal(tree.open,true);assert.ok(field(tree,'alternateMagazineSupplies-0-remove'));assert.equal(field(tree,'alternateMagazineSupplies-0-autoloadMagazines').value,'11');
  assert.match(text(tree),/Unavailable magazine source|Compatibility unresolved/);assert.match(text(tree),/Unavailable storage/);assert.doesNotMatch(text(tree),/private-source|private-locker/);
  assert.ok(field(tree,'initialMagazineSourceId').choices.some(choice=>choice.id===receiver));
 }
 const m=panel(weapon({alternateMagazineSupplies:[donor({variant:'standard'})]}));assert.equal(m.rows[0].choices.length,2);assert.deepEqual(m.addChoices.map(choice=>choice.id),[support+':high-capacity']);
});

test('donor split partition does not materialize the omitted own-supply allocation picker',()=>{
 const w=weapon({spareMagazineStorageId:'none'});delete w.autoloadAllocation;const before=structuredClone(w),api=createRobotApi();api.importDesign(JSON.stringify(design(w)));
 const metadata=api.getRecordPresentation(weaponControl(design(w)),w);assert.equal(metadata.fields.autoloadAllocation.mode,'legacy');assert.match(metadata.fields.autoloadAllocation.summary,/^Receiving-weapon stored remainder/);assert.deepEqual(metadata.fields.autoloadAllocation.materializedValue,{standard:2,highCapacity:1});
 editor(w);api.getView();assert.deepEqual(w,before);assert.equal(Object.hasOwn(JSON.parse(api.exportDesign()).selections.physical.weapons[0],'autoloadAllocation'),false);
 const enabled={...w,autoloadAllocation:metadata.fields.autoloadAllocation.materializedValue};assert.equal(weaponRecordPresentation(enabled).fields.autoloadAllocation.mode,'split');
 delete enabled.autoloadAllocation;assert.equal(weaponRecordPresentation(enabled).fields.autoloadAllocation.mode,'legacy');assert.deepEqual(enabled,w);
});

test('old complete copy overrides retain own defaults and do not inherit shared donor choices',()=>{
 const old={initialMagazines:1,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'};
 const w=weapon({autoload:false,linkedWeapons:2,extraMagazines:0,extraHighCapacityMagazines:0,autoloadAllocation:{standard:0,highCapacity:0},spareMagazineStorageId:'none',alternateMagazineSupplies:[],ammunitionOverrides:[{copyIndex:2,...old}]});
 const meta=weaponRecordPresentation(w,2),m=magazinePanelModel(meta.ammunitionCustomization.effectiveRecord,meta.magazineSupplySelection,weaponControl(design(w)));
 assert.equal(m.initialSourceId,standard);assert.equal(m.rows.length,0);assert.deepEqual(meta.ammunitionCustomization.materializedValue,old);assert.equal(Object.hasOwn(meta.ammunitionCustomization.materializedValue,'initialMagazineSourceId'),false);
});

test('exact mixed fixture has one explicit inventory projection with selected price, mass and receiver traits',()=>{
 const d=design(),e=evaluateDesign(d),before=structuredClone(e),r=projectReview(d,getCatalogue(d),e),rows=details(r),print=formatStatblock(r);
 const totals=rows.find(row=>row.label==='Ammunition totals');assert.match(totals.value,/Total: 320 rounds · Cr 3,300/);assert.match(totals.value,/Initial: 1 magazines \/ 40 rounds · Cr 200/);assert.match(totals.value,/Loader: 5 magazines \/ 220 rounds · Cr 2,800 package/);assert.match(totals.value,/Stored: 2 magazines \/ 60 rounds · Cr 300/);
 assert.equal(rows.filter(row=>/\/ (Standard|High-capacity)$/.test(row.label)).length,4);
 const standardHC=rows.find(row=>row.label==='ARL (standard) (CSC 2023) / High-capacity'),supportNormal=rows.find(row=>row.label==='ARL (support) (CSC 2023) / Standard');
 assert.match(standardHC.value,/40 rounds · Cr 300 each · 0.6 kg estimated/);assert.match(supportNormal.value,/40 rounds · Cr 200 each · 0.8 kg estimated/);
 assert.ok(!rows.some(row=>['Ammunition Inventory','Initial Ammunition','Magazine Variants','Ammo Cost','Autoload Cost','Spare ammunition (estimated mass)'].includes(row.label)));
 assert.doesNotMatch(print,/private-weapon|csc-arl|option:storage|productId|sourceWeaponId|Auto 4/);assert.match(print,/1.1 \/ 20 kg reserved/);assert.match(print,/Cross-fit high-capacity: combined rules; referee approval required/);assert.match(print,/Initial inclusion unstated; separate-purchase convention/);assert.match(print,/Coverage incomplete/i);assert.match(print,/p. 175/);assert.deepEqual(e,before);
});

test('default ARL review shows only its selected initial product and no reference inventory table',()=>{
 const rows=details(review(design(ordinary()))),products=rows.filter(row=>/\/ (Standard|High-capacity)$/.test(row.label));assert.equal(products.length,1);assert.equal(products[0].label,'ARL (standard) (CSC 2023) / Standard');
 assert.doesNotMatch(products[0].value,/Cr 200|Cr 300|Cr 600/);
 const reverse=details(review(design(ordinary({weaponId:support,initialMagazineSourceId:standard}))));assert.equal(reverse.filter(row=>/\/ (Standard|High-capacity)$/.test(row.label)).length,1);assert.match(formatStatblock(review(design(ordinary({weaponId:support,initialMagazineSourceId:standard})))),/Auto 4/);
});

test('linked-copy review keeps source-specific products and counts hardware and ammunition only once',()=>{
 const w=weapon({linkedWeapons:2,fireControl:'basic',ammunitionOverrides:[{copyIndex:2,...spec({initialMagazineSourceId:standard,initialMagazineType:'high-capacity',extraMagazines:0,extraHighCapacityMagazines:0,autoloadAllocation:{standard:0,highCapacity:0},spareMagazineStorageId:'none',alternateMagazineSupplies:[donor({extraMagazines:2,autoloadMagazines:1})]})}]});
 const r=review(design(w)),rows=details(r);assert.equal(rows.filter(row=>row.label==='Ammunition totals').length,1);assert.equal(rows.find(row=>row.label==='Cost').value,'25,800');assert.match(rows.find(row=>row.label==='Ammunition totals').value,/440 rounds · Cr 4,200/);
 assert.match(rows.find(row=>row.label==='Copy 1 / ARL (support) (CSC 2023) / Standard').value,/Initial: 1 \/ 40 rounds/);assert.match(rows.find(row=>row.label==='Copy 2 / ARL (standard) (CSC 2023) / High-capacity').value,/Initial: 1 \/ 40 rounds/);assert.equal(rows.filter(row=>row.label==='Copy 2 / ARL (support) (CSC 2023) / High-capacity').length,0);
});

test('zero-quantity donor references and removed linked-copy selections stay reviewable without IDs',()=>{
 const zero=ordinary({alternateMagazineSupplies:[donor({extraMagazines:0,autoloadMagazines:0,storageId:'none'})]});
 assert.ok(details(review(design(zero))).some(row=>row.label==='ARL (support) (CSC 2023) / Standard'));
 const w=weapon({linkedWeapons:1,ammunitionOverrides:[{copyIndex:2,...spec({alternateMagazineSupplies:[donor({storageId:'instance:private-removed'})]})}]});
 const print=formatStatblock(review(design(w)));assert.match(print,/Copy 2 ammunition selection · Not installed/);assert.match(print,/ARL \(support\).*Standard/);assert.match(print,/Unresolved storage/);assert.doesNotMatch(print,/private-removed|private-weapon|csc-arl/);
});

test('component review uses the same source-product projection and selected reservations',()=>{
 const child=design(),host=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'private-component',role:'installed-robot',quantity:1,design:child}]}}),r=review(host),print=formatStatblock(r);
 assert.match(print,/Component-only weapon/);assert.match(print,/Total: 320 rounds · Cr 3,300/);assert.match(print,/ARL \(standard\) \(CSC 2023\) \/ High-capacity/);assert.match(print,/ARL \(support\) \(CSC 2023\) \/ Standard/);assert.match(print,/Storage Compartment/);assert.doesNotMatch(print,/private-component|private-weapon|csc-arl|option:storage/);
});

test('magazine metadata, model and review are detached read-only projections with lossless import/export',()=>{
 const d=design(),api=createRobotApi();api.importDesign(JSON.stringify(d));const before=api.exportDesign(),view=api.getView(),metadata=api.getRecordPresentation(weaponControl(d),d.selections.physical.weapons[0]),m=panel(d.selections.physical.weapons[0]);
 metadata.magazineSupplySelection.numericControls.extraMagazines.max=1;m.rows[0].supply.extraMagazines=99;m.products[0].estimate.unitMassKg=999;view.review.sections[0].rows[0].value='changed';
 assert.equal(api.exportDesign(),before);assert.equal(api.getRecordPresentation(weaponControl(d),d.selections.physical.weapons[0]).magazineSupplySelection.numericControls.extraMagazines.max,110);assert.deepEqual(JSON.parse(before),d);assert.doesNotMatch(api.getStatblock(),/\bchanged\b|999 kg/);
});

test('invalid donor counts and stale donor storage automatically expose correction controls',()=>{
 const stale=weapon({alternateMagazineSupplies:[donor({storageId:'instance:missing-arl-storage'})]});assert.equal(editor(stale).open,true);
 const count=weapon({alternateMagazineSupplies:[donor({extraMagazines:0,autoloadMagazines:11,storageId:'none'})]});assert.equal(editor(count).open,true);
 assert.equal(field(editor(stale),'alternateMagazineSupplies-0-storageId').value,'instance:missing-arl-storage');
 assert.match(formatStatblock(review(design())),/Mixed-loader pricing: combined source rules/);
});

test('identical linked copies label per-weapon supply counts beside total installation rounds',()=>{
 const rows=details(review(design(weapon({linkedWeapons:2})))),totals=rows.find(row=>row.label==='Ammunition totals');
 assert.match(totals.value,/Total: 640 rounds · Cr 6,600/);assert.match(totals.value,/Initial: 2 magazines \/ 80 rounds · Cr 400/);
 assert.match(totals.value,/Loader: 5 magazines per weapon \/ 440 rounds total · Cr 5,600/);assert.match(totals.value,/Stored: 2 magazines per weapon \/ 120 rounds total · Cr 600/);
 assert.match(rows.find(row=>row.label==='ARL (support) (CSC 2023) / Standard').value,/Extras: 6 \/ 240 rounds · Loader: 4 \/ 160 rounds · Stored: 2 \/ 80 rounds/);
});
