import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as build,run,force,rejected} from './aslan-origin-fixtures.mjs';
import {aslanPridePopupModel,aslanPridePopupView} from '../gui/aslan-pride-popup.mjs';
import {aslanOriginSheet} from '../gui/aslan-origin-view.mjs';
import {ASLAN_ORIGIN_TAGLINES,originTagline} from '../gui/aslan-origin-taglines.mjs';
const round=r=>{const x=api({operation:'import',raw:exportSession(r.session)});assert.equal(x.ok,true);assert.deepEqual(x.state,r.state);assert.deepEqual(x.log,r.log);};
test('all pride dice persist once with an explicit no-award Continue and replay',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  let r=force(build({stage:'aslan-pride'}),'roll-aslan-pride',{},[a,b]);assert.equal(r.state.stage,'aslan-pride-result');const pride=r.state.currentAslanOrigin.pride;assert.deepEqual(pride.dice,[a,b]);assert.equal(pride.id,a+b<=4?'major':a+b<=9?'average':'minor');assert.equal(r.log.at(-1).rolls.length,1);assert.match(r.log.at(-1).summary,new RegExp(a+' \\+ '+b+' = '+(a+b)));round(r);
  const html=aslanPridePopupView(aslanPridePopupModel(r.state),{esc:String});assert.ok(html.includes(a+' + '+b+' = '+(a+b)));assert.ok(html.includes('Continue to background skills'));assert.ok(html.includes('aslan-pride-info-open'));assert.ok(aslanOriginSheet(r.state,{esc:String}).includes(pride.name));rejected(r,'roll-aslan-pride');rejected(r,'name-aslan-clan',{name:'Too late'});rejected(r,'acknowledge-aslan-pride',{extra:true});
  const rng=r.state.rng,skills=structuredClone(r.state.character.skills),remaining=r.state.backgroundRemaining;r=run(r,'acknowledge-aslan-pride',{}, {id:'pride-ack'});assert.equal(r.state.stage,'background');assert.equal(r.state.rng,rng);assert.deepEqual(r.state.character.skills,skills);assert.equal(r.state.backgroundRemaining,remaining);assert.deepEqual(r.log.at(-1).rolls,[]);assert.deepEqual(run(r,'acknowledge-aslan-pride',{}, {id:'pride-ack'}).state,r.state);rejected(r,'acknowledge-aslan-pride');round(r);
 }
});
test('optional clan naming saves independently without changing clan or dice',()=>{
 let r=build({stage:'aslan-pride'});assert.match(aslanPridePopupView(aslanPridePopupModel(r.state),{esc:String}),/Your clan: <strong>Major clan<\/strong>/);let clan=structuredClone(r.state.currentAslanOrigin.clan),rng=r.state.rng;r=run(r,'name-aslan-clan',{name:'Named clan'});assert.deepEqual(r.state.currentAslanOrigin.clan,{...clan,name:'Named clan'});assert.equal(r.state.rng,rng);assert.deepEqual(r.log.at(-1).rolls,[]);assert.match(aslanPridePopupView(aslanPridePopupModel(r.state),{esc:String}),/Named clan/);assert.match(aslanOriginSheet(r.state,{esc:String}),/Named clan/);round(r);
});
test('legacy pride transitions and replay stay unchanged',()=>{
 let r=build({stage:'aslan-pride',rulesRevision:'character-preview-2026-11-09.27'});assert.equal(aslanPridePopupModel(r.state),null);r=force(r,'roll-aslan-pride',{},[1,3]);assert.equal(r.state.stage,'background');assert.equal(r.state.currentAslanOrigin.pride.acknowledged,undefined);round(r);
});
test('six deterministic nonmechanical flavor lines cover every pride result',()=>{
 for(const id of ['major','average','minor']){const key='pride:'+id;assert.equal(ASLAN_ORIGIN_TAGLINES[key].length,6);assert.equal(new Set(ASLAN_ORIGIN_TAGLINES[key]).size,6);assert.equal(originTagline(key,'event'),originTagline(key,'event'));}
});
test('side sheet accumulates family decisions as each result is recorded',()=>{
 const html=r=>aslanOriginSheet(r.state,{esc:String});let r=build({familySOC:9});assert.match(html(r),/Family SOC at creation: <strong>9/);assert.doesNotMatch(html(r),/Family background:/);r=force(r,'roll-aslan-family',{},[1]);assert.match(html(r),/Family background:/);r=run(r,'acknowledge-aslan-family');r=force(r,'roll-aslan-birth-order',{},[6,6]);assert.match(html(r),/Family position: First son/);r=run(r,'acknowledge-aslan-birth-order');r=run(r,'resolve-aslan-estate',{method:'printed-minimum'});assert.match(html(r),/Family land minimum: 10 parcels/);assert.match(html(r),/Personal ownership: unestablished/);r=force(r,'roll-aslan-clan',{},[3,3]);assert.match(html(r),/Clan: Major/);assert.match(html(r),/Scope:/);r=run(r,'acknowledge-aslan-clan');r=force(r,'roll-aslan-pride',{},[3,4]);assert.match(html(r),/Pride: Average pride/);assert.match(html(r),/Family position: First son/);assert.match(html(r),/Family land minimum: 10 parcels/);
});
