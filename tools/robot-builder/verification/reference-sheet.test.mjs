import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRobotApi} from '../js/api.mjs';
import {projectSheet} from '../js/sheet-model.mjs';
import {projectReview} from '../js/review-model.mjs';
import {renderSheet} from '../js/sheet.mjs';
import {createDesign,updateDesign,getCatalogue,evaluateDesign} from '../engine/index.mjs';
import {sheetFixtures} from './reference-sheet-fixtures.mjs';
const fixtures=sheetFixtures();
const apiFor=design=>{const api=createRobotApi();api.importDesign(JSON.stringify(design));return api;};
const text=sheet=>JSON.stringify(sheet);
const main=sheet=>JSON.stringify({summary:sheet.summary,body:sheet.body});
const summary=(sheet,label)=>sheet.summary.find(row=>row.label===label);
const body=(sheet,id)=>sheet.body.find(row=>row.id===id);

test('detailed statblock matches pre-change fixture byte for byte; sheet does not change design',()=>{
 const api=apiFor(fixtures.baseline),before=api.exportDesign(),state=api.getView();
 assert.equal(createHash('sha256').update(api.getStatblock()).digest('hex'),'97b2a6c1131e96b56be58e478efa7144a4c3f577fb3641e075aa0861b43d01bb');
 for(let i=0;i<3;i++)api.getSheet();
 assert.equal(api.exportDesign(),before);
 assert.equal(api.getView().draftRevision,state.draftRevision);
 assert.equal(api.getView().dirty,state.dirty);
 assert.equal(api.getView().currentId,state.currentId);
});
test('reference order and ordinary values match authoritative evaluation',()=>{
 const api=apiFor(fixtures.populated),s=api.getSheet(),v=api.getView(),t=v.evaluation.totals;
 assert.equal(v.evaluation.status,'verified');
 assert.deepEqual(s.summary.map(row=>row.label),['Robot','Hits','Locomotion','Speed','TL','Cost']);
 assert.deepEqual(s.body.map(row=>row.label),['Skills','Attacks','Manipulators','Endurance','Traits','Programming','Options']);
 assert.equal(summary(s,'Hits').value,String(t.hits));
 assert.equal(summary(s,'Cost').value,'Cr 76,543');assert.equal(summary(s,'Cost').detail,'List price');
 assert.match(s.constructionCost,/Construction cost: Cr /);
 assert.equal(summary(s,'Speed').value,t.tacticalSpeed+' m/action');
 assert.equal(summary(s,'Locomotion').value,'Grav, Walker');
 assert.equal(body(s,'endurance').entries[0].value,t.endurance+' hours');
 assert.equal(body(s,'manipulators').entries.length,t.manipulators.length);
 assert.match(text(s),/APDS|Loaded attack/);
 assert.ok(s.sources.some(source=>source.includes('Robot Handbook')));
});
test('skill order, effective levels, finite coverage and limb equivalents are preserved',()=>{
 const s=apiFor(fixtures.populated).getSheet(),skills=body(s,'skills').entries;
 assert.deepEqual(skills.map(row=>row.label),[...skills].sort((a,b)=>a.label.localeCompare(b.label,'en')).map(row=>row.label));
 assert.match(text(skills),/effective/);
 assert.match(text(s.supplements),/Covered Specialities/);
 const a=apiFor(updateDesign(createDesign({techLevel:19}),{selections:{brain:{model:'conscious-tl19'},skills:{packages:['athletics-0','melee-all-referee-four-full-1']}}}));
 assert.match(text(a.getSheet()),/Referee|referee/);
 assert.match(text(a.getSheet()),/characteristic equivalent/);
});
test('invalid preview totals and acquisition-only unknowns never become verified or zero',()=>{
 const s=apiFor(fixtures.invalid).getSheet();
 assert.equal(s.status,'Needs correction');assert.equal(s.provisional,true);assert.match(s.provisionalLabel,/Provisional/);
 assert.ok(s.checks.length);
 const d=createDesign({kind:'nanorobot',techLevel:17}),api=apiFor(d),sheet=api.getSheet(),t=api.getView().evaluation.totals;
 if(t?.endurance==null)assert.equal(body(sheet,'endurance').entries[0].value,'Unresolved');
 if(t?.hits==null)assert.equal(summary(sheet,'Hits').value,'Unresolved');
});
test('fully unavailable totals preserve selections without manufacturing values',()=>{
 const d=fixtures.populated,c=getCatalogue(d),e={status:'blocked',totals:null,ledger:[],diagnostics:[],coverage:c.coverage};
 const s=projectSheet(d,c,e,projectReview(d,c,e));
 assert.equal(s.unavailable,true);assert.equal(summary(s,'Cost').value,'Unresolved');
 assert.equal(summary(s,'Hits').value,'Unresolved');assert.equal(summary(s,'Speed').value,'Unresolved');
 assert.equal(body(s,'endurance').entries[0].value,'Unresolved');
 assert.ok(body(s,'options').entries.length);
 assert.match(text(body(s,'skills')),/not calculated|unresolved/);
});
test('provisional conventions remain visible on the compact sheet',()=>{
 const s=apiFor(fixtures.provisional).getSheet();assert.equal(s.provisional,true);
 assert.match(text(s),/Provisional|provisional/);assert.ok(s.supplements.some(group=>group.id==='metamorphic'));
});
test('whole robot and brain-only ownership never leak source hardware into host rows',()=>{
 for(const [name,scope]of [['wholeComponent','Complete referenced robot construction'],['brainComponent','Brain, upgrades and software only']]){
  const api=apiFor(fixtures[name]),s=api.getSheet(),components=s.supplements.find(group=>group.id==='components');
  assert.ok(components,name);assert.match(text(components),new RegExp(scope));assert.match(components.note,/no host or recipient grant/);
  assert.doesNotMatch(main(s),/Gauss Sniper|Gauss sniper|Electronics \(all\)/);
  assert.equal(summary(s,'Hits').value,'Unresolved');
 }
});
test('mixed and unloaded specialised magazines cannot turn into common loaded attacks',()=>{
 for(const [patch,pattern] of [
   [{initialMagazines:0},/Unloaded; no loaded attack/],
   [{linkedWeapons:2,ammunitionOverrides:[{copyIndex:2,initialMagazines:0,extraMagazines:0,initialMagazineType:'standard',extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'}]},/unresolved/i]
 ]){
  const w={...fixtures.populated.selections.physical.weapons[0],...patch};
  const s=apiFor(updateDesign(fixtures.populated,{selections:{physical:{weapons:[w]}}})).getSheet();
  assert.match(text(body(s,'attacks')),pattern);
 }
});
test('long lists retain every separate installation with no truncation',()=>{
 const s=apiFor(fixtures.long).getSheet(),options=body(s,'options').entries;
 assert.equal(options.filter(row=>row.label==='Storage Compartment').length,101);
 assert.ok(options.every(row=>typeof row.value==='string'));
});
test('sheet data is detached and renderer inserts malicious-looking names as text only',()=>{
 const api=apiFor(fixtures.baseline);api.setIdentity({name:'<img src=x onerror=alert(1)>'});
 const sheet=api.getSheet();sheet.body[0].entries.push({label:'Injected',value:'bad'});
 assert.ok(!text(api.getSheet()).includes('Injected'));
 class Node {constructor(tag){this.tag=tag;this.children=[];this.dataset={};}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this[k]=v;}}
 const tree=renderSheet(api.getSheet(),{createElement:tag=>new Node(tag)});
 const all=[];const visit=node=>{all.push(node);node.children.forEach(visit);};visit(tree);
 assert.ok(all.some(node=>node.textContent==='<img src=x onerror=alert(1)>'));
 assert.ok(all.every(node=>!Object.hasOwn(node,'innerHTML')&&!['img','script','iframe'].includes(node.tag)));
});
test('projection does not mutate engine, catalogue, design or review inputs',()=>{
 const d=fixtures.populated,c=getCatalogue(d),e=evaluateDesign(d),r=projectReview(d,c,e),before=JSON.stringify({d,c,e,r});
 projectSheet(d,c,e,r);assert.equal(JSON.stringify({d,c,e,r}),before);
});
test('all construction kinds project without borrowing ordinary default hardware',()=>{
 const kinds=getCatalogue(createDesign()).kinds;
 for(const {id}of kinds){const api=apiFor(createDesign({kind:id,techLevel:17}));const s=api.getSheet();assert.equal(s.summary.length,6,id);assert.equal(s.body.length,7,id);}
 const s=apiFor(createDesign({kind:'clone',techLevel:12})).getSheet();assert.doesNotMatch(main(s),/Advanced \(TL12\)|Wheels|Visual Spectrum Sensor/);
});

test('ordinary ammunition counts, per-copy initial loads and linked damage stay explicit',()=>{
 const weapon=(patch={})=>({id:'ordinary',weaponId:'gauss-rifle',placement:'body',manipulatorId:'none',linkedWeapons:3,fireControl:'none',autoload:false,initialMagazines:1,extraMagazines:0,...patch});
 const make=w=>apiFor(updateDesign(fixtures.populated,{selections:{physical:{weapons:[w]}}}));
 const a=make(weapon()),e=a.getView().evaluation.totals.weapons[0],s=a.getSheet();
 const rows=s.supplements.find(group=>group.id==='attack-conditions').rows;
 assert.ok(rows.some(row=>row.label.endsWith('/ Linked Weapons')&&row.value===String(e.linkedWeapons)));
 assert.ok(rows.some(row=>row.label.endsWith('/ Linked Damage Bonus')&&row.value===String(e.linkedDamageBonus)));
 assert.match(text(body(s,'attacks')),/Hardware profile/);
 const empty=make(weapon({linkedWeapons:1,initialMagazines:0})).getSheet();
 assert.match(text(body(empty,'attacks')),/No initial load/);assert.match(text(empty.supplements),/0 magazines\/packs; 0 rounds\/charges/);
 const mixed=make(weapon({linkedWeapons:2,ammunitionOverrides:[{copyIndex:2,initialMagazines:0,initialMagazineType:'standard',extraMagazines:0,extraHighCapacityMagazines:0,spareMagazineStorageId:'none',highCapacityMagazineStorageId:'none'}]})).getSheet();
 assert.match(text(mixed.supplements),/Copy 1 initial supplies/);assert.match(text(mixed.supplements),/Copy 2 initial supplies/);assert.match(text(mixed.supplements),/no initial load/);
});
test('sheet status separators contain no mojibake',()=>{
 class Node {constructor(tag){this.tag=tag;this.children=[];this.dataset={};}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this[k]=v;}}
 const tree=renderSheet(apiFor(fixtures.invalid).getSheet(),{createElement:tag=>new Node(tag)});
 const all=[];const visit=node=>{if(node.textContent)all.push(node.textContent);node.children.forEach(visit);};visit(tree);
 assert.ok(all.join('').includes('\u00b7 Provisional'));assert.ok(!all.join('').includes('\u00c2'));
});

test('microbot uses its own selected movement and brain, never host yes/no flags',()=>{
 const d=updateDesign(createDesign({kind:'microbot',techLevel:14}),{special:{brain:'basic',corePackage:'basic-locomotion',locomotion:'grav'}});
 const api=apiFor(d),s=api.getSheet();assert.equal(api.getView().evaluation.status,'verified');
 assert.equal(summary(s,'Locomotion').value,'Grav');assert.match(text(body(s,'programming')),/Basic \(TL11\)/);
 assert.ok(s.sources.some(source=>source.includes('Robot Handbook')));
 for(const kind of ['vehicle-brain','ship-brain']){
  const host=apiFor(createDesign({kind,techLevel:14})).getSheet();
  assert.ok(!['Yes','No','yes','no'].includes(summary(host,'Locomotion').value));
 }
});


test('non-ammunition melee and expendable weapons do not gain magazine claims',()=>{
 for(const weaponId of ['csc-spear','csc-anti-armour-flail']){
  const d=updateDesign(fixtures.populated,{selections:{physical:{weapons:[{id:'melee-test',weaponId,placement:'body',manipulatorId:'none',linkedWeapons:1,fireControl:'none',autoload:false,initialMagazines:0,extraMagazines:0}]}}});
  const s=apiFor(d).getSheet();assert.doesNotMatch(text(body(s,'attacks')),/No initial load/);
  assert.doesNotMatch(text(s.supplements),/initial supplies|rounds.*charges/);
 }
});
