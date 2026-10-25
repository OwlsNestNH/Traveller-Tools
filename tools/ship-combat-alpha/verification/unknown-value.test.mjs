import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUnknownNumber} from '../unknown-value.mjs';
import {numericCommand,systemValueCommand,systemOverrideTarget} from '../unknown-fields.mjs';
import {createState,applyCommand,normalizeState} from '../engine.mjs';
import {effectiveDesign} from '../setup.mjs';
const fixture=()=>applyCommand(createState({ships:[]}),{type:'add-ship',presetId:'core-202',name:'Numeric test',position:{q:0,r:0},velocity:{q:0,r:0}});
test('numeric entry keeps blank distinct from zero and rejects invalid bounded values',()=>{
 const whole={label:'Count',min:0,max:10,step:1};for(const raw of ['', ' ', '-1','1.5','11','Infinity','NaN'])assert.throws(()=>parseUnknownNumber(raw,whole));
 assert.equal(parseUnknownNumber('0',whole),0);assert.equal(parseUnknownNumber('1.5',{label:'Tons'}),1.5);
 assert.throws(()=>parseUnknownNumber('0',{label:'Maximum hull',min:1,step:1}));
});
test('numeric edits preserve published template, provenance, unrelated fields and roundtrip',()=>{
 const initial=fixture(),ship=initial.ships[0],original=structuredClone(ship.template);assert.equal(ship.template.armour,null);
 const next=applyCommand(initial,numericCommand(ship,'armour',0,initial.revision));assert.equal(effectiveDesign(next.ships[0]).armour,0);assert.equal(next.ships[0].designOverrides.armour,0);assert.deepEqual(next.ships[0].template,original);assert.deepEqual(next.ships[0].condition,ship.condition);assert.deepEqual(next.ships[0].motion,ship.motion);assert.deepEqual(initial,fixture());assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(next))),next);
 assert.throws(()=>applyCommand(next,numericCommand(ship,'armour',1,initial.revision)),/changed|revision|stale/i);
 assert.throws(()=>numericCommand(ship,'record.weapons',2,initial.revision));
});
test('current numeric record never overwrites design capacity and validation stays transactional',()=>{
 const state=fixture(),ship=state.ships[0];const next=applyCommand(state,numericCommand(ship,'condition.fuel',0,state.revision));assert.equal(next.ships[0].condition.fuel,0);assert.deepEqual(next.ships[0].template,ship.template);assert.deepEqual(next.ships[0].designOverrides,ship.designOverrides);assert.throws(()=>applyCommand(state,numericCommand(ship,'condition.fuel',1000001,state.revision)));assert.equal(ship.condition.fuel,null);
});
test('operating draw overrides retain the installed record and do not invent unknown fit',()=>{
 const state=fixture(),ship=state.ships[0];ship.systems.extra.push({id:'test-extra',kind:'manual',name:'Known manual system',quantity:null,power:null,enabled:true,reference:'Retained manual reference'});
 const command=systemValueCommand(ship,'test-extra',0,state.revision),next=applyCommand(state,command);assert.equal(next.ships[0].systems.extra.at(-1).power,0);assert.equal(next.ships[0].systems.extra.at(-1).quantity,null);assert.equal(next.ships[0].systems.extra.at(-1).reference,'Retained manual reference');assert.deepEqual(next.ships[0].template,ship.template);
 assert.equal(systemOverrideTarget({...ship,systems:{...ship.systems,driveKind:'unknown'}},'drive'),null);assert.throws(()=>systemValueCommand(ship,'unidentified-weapon',4,state.revision));
});

import {readFileSync} from 'node:fs';
import {powerReport} from '../systems.mjs';
test('all audited calculated defaults retain basis and references through manual zero and roundtrip',()=>{
 const audit=JSON.parse(readFileSync(new URL('../catalogue-rated-power-audit.json',import.meta.url)));
 for(const f of audit.fields){
  let state=applyCommand(createState({ships:[]}),{type:'add-ship',presetId:f.id,name:'Provenance',position:{q:0,r:0},velocity:{q:0,r:0}});
  let ship=state.ships[0];ship.systems.loads.forEach(l=>l.enabled=true);ship.systems.jumpEnabled=true;
  state=normalizeState(JSON.parse(JSON.stringify(state)));ship=state.ships[0];
  const row=powerReport(ship).rows.find(r=>r.name===f.name||(f.name==='Sensors'&&r.id==='sensors'));assert.ok(row,f.id+'/'+f.name);assert.equal(row.power,f.power);assert.ok(row.note.includes(f.basis));assert.doesNotMatch(row.note,/Manual (design|operating) override/);assert.deepEqual(row.source,f.rule);assert.match(row.note,/Retained original/);
  state=normalizeState(JSON.parse(JSON.stringify(applyCommand(state,systemValueCommand(ship,row.id,0,state.revision)))));
  const zero=powerReport(state.ships[0]).rows.find(r=>r.id===row.id);assert.equal(zero.power,0);assert.match(zero.note,/Manual operating override/);assert.ok(zero.note.includes(f.basis));assert.deepEqual(state.ships[0].template,ship.template);
 }
});
