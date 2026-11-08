import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS,weaponRecordPresentation} from '../engine/weapons.mjs';
import {createDesign,updateDesign,evaluateDesign,getCatalogue,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
import {projectReview,formatStatblock} from '../js/review-model.mjs';
import {renderReview} from '../js/review.mjs';
const melee=WEAPONS.filter(w=>w.weaponFamily==='melee'&&(w.magazine===null||w.poweredMelee));
const record=(weaponId,patch={})=>({id:'supply-presentation',weaponId,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,extraMagazines:0,initialMagazines:1,ammunition:'standard',auxiliaryLauncher:'none',auxiliaryAmmunition:'standard',auxiliaryLoaded:0,integralAmmunition:'standard',integralLoaded:0,looseGrenades:0,looseAmmunitionFor:'primary',ammunitionStorageId:'none',...patch});
const standard=(weaponId,patch={})=>updateDesign(createDesign({techLevel:23}),{selections:{chassis:{size:'size-7'},physical:{weapons:[record(weaponId,patch)]}}});
const project=(design,evaluation=evaluateDesign(design))=>projectReview(design,getCatalogue(design),evaluation);
const forbiddenLabels=['Ammunition Type','Auxiliary Launcher','Auxiliary Ammunition','Auxiliary Loaded','Integral Ammunition','Integral Loaded','Loose Grenades','Loose Ammunition','Loose Ammunition For','Ammo Cost','Autoload Cost','Magazine Cost','Initial Included','Initial Magazines','Extra Magazines','Initial Ammunition','Ammunition Inventory','Magazine'];
const assertMeleeRow=(row,w)=>{
 assert.ok(row,w.id);
 for(const label of forbiddenLabels)assert.ok(!row.details.some(d=>d.label===label),w.id+': '+label);
 const ammo=row.details.filter(d=>d.label==='Ammunition');
 assert.deepEqual(ammo.map(d=>d.value),w.poweredMelee||w.expendableMelee?[]:['Not applicable'],w.id);
 if(w.poweredMelee){assert.ok(row.details.some(d=>d.label==='Acquisition'&&d.value==='Complete weapon hardware; initial charge unspecified'));assert.ok(row.details.some(d=>d.label==='Power endurance'));assert.ok(row.details.some(d=>d.label==='Recharge'));assert.ok(row.details.some(d=>d.label==='Power supplies'));}
 if(w.expendableMelee){assert.ok(row.details.some(d=>d.label==='Use'&&d.value==='Single use'));assert.ok(row.details.some(d=>d.label==='Acquisition'&&d.value==='One complete weapon'));}
 if(w.attackProfiles){assert.ok(row.value.includes('Conditional damage'));assert.equal(row.details.find(d=>d.label==='Current attack mode').value,'Unresolved');assert.ok(row.details.some(d=>d.value===(w.attackProfiles.kind==='grapple-condition'?'2D + opposed Melee Effect; conditional':'2D damage · No AP')));}
};
const rejectedText=/Ammunition: standard|Ammunition Type:|Auxiliary Loaded:|Integral Loaded:|Loose Grenades:|Ammo Cost:|Autoload Cost:|Magazine Cost:|Initial Included:/;
class Node {constructor(tag){this.tag=tag;this.textContent='';this.children=[];}append(...items){this.children.push(...items);}}
const visible=n=>[n.textContent,...n.children.map(visible)].join(' ');
test('sweep includes every Core, ordinary, conditional, powered and expendable no-magazine melee profile',()=>{
 assert.equal(melee.length,46);assert.equal(melee.filter(w=>w.poweredMelee).length,11);assert.equal(melee.filter(w=>w.expendableMelee).length,1);assert.equal(melee.filter(w=>w.sourceFamily==='csc-2023').length,39);
});
for(const w of melee)test('no fictional supply details in ordinary/component/cyberlimb review and print: '+w.id,()=>{
 const d=standard(w.id),json=exportDesign(d),evaluation=evaluateDesign(d);assert.equal(evaluation.status,'verified');
 // Cover known projection-only aliases/cost fields without admitting them to save files.
 Object.assign(evaluation.totals.weapons[0],{ammunitionType:'standard',ammoCost:0,autoloadCost:0,magazineCost:0,initialIncluded:true});
 const untouched=structuredClone(evaluation),view=project(d,evaluation);
 assertMeleeRow(view.sections.find(s=>s.id==='weapons').rows[0],w);assert.doesNotMatch(formatStatblock(view),rejectedText);
 assert.deepEqual(evaluation,untouched);assert.equal(exportDesign(d),json);assert.deepEqual(importDesign(json),d);
 const parent=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:d}]}}),component=project(parent);
 const componentRow=component.sections.flatMap(s=>s.rows).find(r=>r.label.endsWith(' / '+w.label));assertMeleeRow(componentRow,w);assert.doesNotMatch(formatStatblock(component),rejectedText);
 const {manipulatorId,...limbRecord}=record(w.id,{placement:'arm'});
 const limb=updateDesign(createDesign({kind:'cyborg',techLevel:23}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:1}}],augmentWeapons:[{...limbRecord,parentLimb:'limb'}]}}),limbEvaluation=evaluateDesign(limb);
 assert.equal(limbEvaluation.status,'verified');const limbView=project(limb,limbEvaluation);assertMeleeRow(limbView.sections.find(s=>s.id==='limb-weapons').rows.find(r=>r.label===w.label),w);assert.doesNotMatch(formatStatblock(limbView),rejectedText);
});
test('API/render/print preserve selected conditions and hardware while omitting melee sentinels',()=>{
 for(const id of ['blade','csc-spear','csc-piston-spear','csc-lance','csc-stunstick','csc-arc-field-weapon']){
  const api=createRobotApi();api.importDesign(exportDesign(standard(id)));const view=api.getView(),w=melee.find(w=>w.id===id);
  assertMeleeRow(view.review.sections.find(s=>s.id==='weapons').rows[0],w);
  assert.doesNotMatch(api.getStatblock(),rejectedText);assert.doesNotMatch(visible(renderReview(view.review,{createElement:tag=>new Node(tag)})),/Ammunition standard|Auxiliary Loaded|Integral Loaded|Loose Grenades|Ammo Cost|Autoload Cost/);
  assert.equal(view.design.selections.physical.weapons[0].ammunition,'standard');
  assert.equal(view.design.selections.physical.weapons[0].auxiliaryLoaded,0);
 }
});
test('invalid supplies remain serialized, diagnosed and editable instead of becoming a source purchase',()=>{
 for(const id of ['csc-piston-spear','csc-stunstick','csc-blade']){
  const d=standard(id,{extraMagazines:1,autoload:true,initialMagazines:0,ammunition:'frag',auxiliaryLauncher:'attached',auxiliaryAmmunition:'smoke',auxiliaryLoaded:1,integralAmmunition:'frag',integralLoaded:1,looseGrenades:2});
  const json=exportDesign(d),round=importDesign(json),r=evaluateDesign(round);assert.notEqual(r.status,'verified');assert.ok(r.diagnostics.some(d=>d.code==='CSC_AMMUNITION_UNSUPPORTED'));assert.ok(r.diagnostics.some(d=>d.code==='CSC_LAUNCHERS_UNSUPPORTED'));
  const presentation=weaponRecordPresentation(round.selections.physical.weapons[0]);for(const field of ['initialMagazines','extraMagazines','autoload'])assert.equal(presentation.fields[field].visible,true);
  const view=project(round,r);assertMeleeRow(view.sections.find(s=>s.id==='weapons').rows[0],melee.find(w=>w.id===id));assert.doesNotMatch(formatStatblock(view),rejectedText);
  assert.equal(exportDesign(round),json);assert.ok(view.sections.find(s=>s.id==='warnings').rows.some(r=>r.value.includes('ammunition unsupported')));
 }
});
test('real firearm, launcher and loose-round facts remain in ordinary/component/cyberlimb projections',()=>{
 const rifle=standard('advanced-combat-rifle',{placement:'held',manipulatorId:'base-1',auxiliaryLauncher:'both-acr',auxiliaryAmmunition:'smoke',auxiliaryLoaded:1,integralAmmunition:'frag',integralLoaded:1,looseGrenades:2,looseAmmunitionFor:'integral',ammunitionStorageId:'option:hazardous-material-storage-compartment'});
 const d=updateDesign(rifle,{selections:{physical:{options:['hazardous-material-storage-compartment'],optionParameters:{'hazardous-material-storage-compartment':{quantity:2}}}}}),r=evaluateDesign(d);assert.equal(r.status,'verified');
 const view=project(d,r),rows=view.sections.find(s=>s.id==='weapons').rows;
 for(const label of ['Auxiliary Loaded','Integral Loaded','Loose Grenades','Initial Ammunition','Ammunition Inventory'])assert.ok(rows[0].details.some(d=>d.label===label),label);
 assert.deepEqual(rows.filter(r=>r.label.includes('secondary launcher')).map(row=>row.details.find(d=>d.label==='Loaded Per Weapon').value),['1','1']);
 const text=formatStatblock(view);assert.match(text,/Auxiliary Loaded: 1/);assert.match(text,/Integral Loaded: 1/);assert.match(text,/Loose Grenades: 2/);assert.match(text,/Smoke/);assert.match(text,/Fragmentation/);
 const parent=updateDesign(createDesign({kind:'ship-brain',techLevel:23}),{special:{designReferences:[{id:'component',role:'installed-robot',quantity:1,design:d}]}});assert.match(formatStatblock(project(parent)),/Auxiliary Loaded: 1/);
 const {manipulatorId,...limbRecord}=record('autopistol',{placement:'arm'}),limb=updateDesign(createDesign({kind:'cyborg',techLevel:23}),{special:{cyborgMode:'augments',augmentations:[{id:'limb',optionId:'cybernetic-arm',parameters:{quantity:1}}],augmentWeapons:[{...limbRecord,parentLimb:'limb'}]}});assert.match(formatStatblock(project(limb)),/Initial Ammunition:/);
 const firearm=project(standard('autopistol')).sections.find(s=>s.id==='weapons').rows[0];assert.ok(firearm.details.some(d=>d.label==='Ammunition'&&d.value==='standard'));assert.ok(firearm.details.some(d=>d.label==='Magazine'&&d.value==='15'));
});
