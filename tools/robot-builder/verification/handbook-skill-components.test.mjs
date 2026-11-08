import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesign,updateDesign,evaluateDesign,exportDesign,importDesign} from '../engine/index.mjs';
import {createRobotApi} from '../js/api.mjs';
const robot=(packages=['athletics-all-referee-four-full-1'])=>updateDesign(createDesign({techLevel:19}),{name:'Athletics component',selections:{brain:{model:'conscious-tl19'},skills:{packages}}});
const attach=(child,kind='ship-brain',role='installed-robot',quantity=1)=>updateDesign(createDesign({kind,techLevel:19}),{special:{...(kind==='missile'?{procurement:'case12'}:{}),designReferences:[{id:'child',role,quantity,design:child}]}});
const good=d=>{const r=evaluateDesign(d);assert.equal(r.status,'verified',JSON.stringify(r.diagnostics));return r;};
const view=d=>{const api=createRobotApi();api.importDesign(exportDesign(d));return api.getView();};
test('RH pp26,73 component profiles preserve individual, listed, legacy and explicit full Athletics equivalents',()=>{
 for(const packages of [['athletics-strength-1','athletics-dexterity-1'],['athletics-all-listed-1'],['athletics-all-referee-four-1'],['athletics-all-referee-four-full-1'],['athletics-all-referee-eight-full-1']]){
  const child=robot(packages),own=good(child),d=attach(child),r=good(importDesign(exportDesign(d))),profile=r.composite.components[0].profile;
  assert.equal(own.totals.skillEquivalents.length,4);assert.ok(own.totals.skillEquivalents.every(e=>e.level===2));assert.deepEqual(profile.skillEquivalents,own.totals.skillEquivalents);
  assert.equal(r.totals.skillEquivalents,undefined);assert.deepEqual(r.totals.skills??[],[]);assert.equal(r.composite.externalHostValidated,false);
  const result=view(d),section=result.review.sections.find(s=>s.id==='component-skill-equivalents');assert.equal(section.rows.length,4);assert.ok(section.rows.every(row=>row.value.startsWith('Level: 2')&&row.detail==='Component-only equivalent; per copy; no host grant'));assert.match(result.statblock,/Characteristic-based equivalents \(components\)/);assert.match(result.statblock,/Athletics component \/ Athletics \(strength\): Level: 2/);assert.match(result.statblock,/Base arm 1/);assert.match(result.statblock,/p\. 26,73/);
 }
});
test('brain-only acquisition omits unpurchased arm equivalents while retaining purchased software',()=>{
 const d=attach(robot(),'vehicle-brain','installed-brain'),r=good(d),profile=r.composite.components[0].profile;
 assert.equal(Object.hasOwn(profile,'skillEquivalents'),false);assert.equal(profile.skills[0].level,1);assert.equal(profile.skills[0].coversAllSpecialities,true);assert.equal(r.totals.skillEquivalents,undefined);assert.deepEqual(r.totals.skills??[],[]);
 const result=view(d);assert.equal(result.review.sections.some(s=>s.id==='component-skill-equivalents'),false);assert.doesNotMatch(result.statblock,/Characteristic-based equivalents|Component-only equivalent|Athletics \(strength\): Level/);assert.match(result.statblock,/Brain and software only/);
 assert.equal(r.composite.components[0].constructionUnitCost,good(robot()).ledger.filter(row=>row.accountingDomain==='brain-software').reduce((sum,row)=>sum+row.cost,0));
});
test('twelve robot payload copies preserve per-robot ratings and do not grant host skills',()=>{
 const child=updateDesign(robot(),{selections:{chassis:{size:'size-2'}}}),d=attach(child,'missile','payload',12),r=good(d),own=good(child);
 assert.equal(r.composite.components[0].quantity,12);assert.deepEqual(r.composite.components[0].profile.skillEquivalents,own.totals.skillEquivalents);assert.equal(r.totals.skillEquivalents,undefined);assert.equal(r.composite.components[0].constructionCost,12*own.totals.constructionCost);
 const result=view(d),rows=result.review.sections.find(s=>s.id==='component-skill-equivalents').rows;assert.equal(rows.length,4);assert.ok(rows.every(row=>row.details.some(d=>d.label==='Component copies'&&d.value==='12')));for(let i=0;i<rows.length;i++)assert.ok(rows[i].value.startsWith('Level: '+own.totals.skillEquivalents[i].level));assert.match(result.statblock,/Component copies: 12/);assert.match(result.statblock,/per copy; no host grant/);
});
test('component equivalent projection is detached through API save/load and absent for invalid or software-free children',async()=>{
 const d=attach(robot()),store=new Map(),options={storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},locks:{request:(_n,_o,fn)=>fn()},idFactory:()=> 'skill-component',clock:()=> '2026-11-08T00:00:00Z'},api=createRobotApi(options);api.importDesign(exportDesign(d));await api.saveDesign();const fresh=createRobotApi(options);fresh.loadDesign('skill-component');assert.deepEqual(fresh.getView().design,d);
 const first=fresh.getView();first.evaluation.composite.components[0].profile.skillEquivalents[0].level=999;first.review.sections.find(s=>s.id==='component-skill-equivalents').rows[0].value='Forged';const second=fresh.getView();assert.equal(second.evaluation.composite.components[0].profile.skillEquivalents[0].level,2);assert.match(second.review.sections.find(s=>s.id==='component-skill-equivalents').rows[0].value,/Level: 2/);assert.equal(d.special.designReferences[0].design.selections.skills.packages[0],'athletics-all-referee-four-full-1');
 const no=attach(robot([]));assert.deepEqual(good(no).composite.components[0].profile.skillEquivalents,[]);assert.equal(view(no).review.sections.some(s=>s.id==='component-skill-equivalents'),false);
 const invalid=attach(robot(['athletics-all-referee-four-full-1','athletics-strength-1'])),result=evaluateDesign(invalid);assert.equal(result.status,'invalid');assert.equal(result.composite.components[0].profile,null);assert.equal(view(invalid).review.sections.some(s=>s.id==='component-skill-equivalents'),false);
});
