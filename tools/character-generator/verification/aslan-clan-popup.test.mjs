import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as build,run,force,rejected} from './aslan-origin-fixtures.mjs';
import {aslanClanPopupModel,aslanClanPopupView} from '../gui/aslan-clan-popup.mjs';
const round=r=>{const x=api({operation:'import',raw:exportSession(r.session)});assert.equal(x.ok,true);assert.deepEqual(x.state,r.state);assert.deepEqual(x.log,r.log);return x;};
test('all clan dice persist once, with conditional scope provenance and explicit Continue',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  let r=force(build({stage:'aslan-clan'}),'roll-aslan-clan',{},[a,b]);assert.equal(r.state.stage,'aslan-clan-result');const clan=r.state.currentAslanOrigin.clan,random=[3,4,5,10,11].includes(a+b);assert.deepEqual(clan.dice,[a,b]);assert.equal(Boolean(clan.scope.die),random);assert.equal(clan.scope.count,random?Math.ceil(clan.scope.die/clan.scope.divisor):1);assert.equal(r.log.at(-1).rolls.length,random?2:1);round(r);
  const html=aslanClanPopupView(aslanClanPopupModel(r.state),{esc:String});assert.ok(html.includes(a+' + '+b+' = '+(a+b)));assert.ok(html.includes('Continue to pride'));assert.ok(html.includes('aslan-clan-info-open'));assert.equal(html.includes('Additional scope roll:'),random);rejected(r,'roll-aslan-clan');rejected(r,'roll-aslan-pride');
  const rng=r.state.rng,skills=structuredClone(r.state.character.skills);r=run(r,'acknowledge-aslan-clan',{}, {id:'clan-ack'});assert.equal(r.state.stage,'aslan-pride');assert.equal(r.state.rng,rng);assert.deepEqual(r.state.character.skills,skills);assert.deepEqual(r.log.at(-1).rolls,[]);assert.deepEqual(run(r,'acknowledge-aslan-clan',{}, {id:'clan-ack'}).state,r.state);rejected(r,'acknowledge-aslan-clan');round(r);
 }
});
test('referee-selected clan requires GM and records name scope reason without dice',()=>{
 let r=run(build({stage:'aslan-clan'}),'gm-mode',{enabled:false});const payload={name:'Example clan',scope:'A documented border region',reason:'Approved source mapping'};rejected(r,'choose-aslan-clan',payload,/GM/);r=run(r,'gm-mode',{enabled:true});r=run(r,'choose-aslan-clan',payload,{id:'clan-choice'});assert.equal(r.state.stage,'aslan-clan-result');assert.deepEqual(r.log.at(-1).rolls,[]);assert.match(r.log.at(-1).summary,/documented border region/);assert.deepEqual(run(r,'choose-aslan-clan',payload,{id:'clan-choice'}).state,r.state);assert.match(aslanClanPopupView(aslanClanPopupModel(r.state),{esc:String}),/Referee-selected · No dice rolled/);round(r);r=run(r,'acknowledge-aslan-clan');r=run(r,'name-aslan-clan',{name:'Updated descriptive name'});assert.deepEqual(r.log.at(-1).rolls,[]);round(r);
});
test('legacy clan transitions and replay stay unchanged',()=>{
 let r=build({stage:'aslan-clan',rulesRevision:'character-preview-2026-11-09.27'});assert.equal(aslanClanPopupModel(r.state),null);r=force(r,'roll-aslan-clan',{},[1,3]);assert.equal(r.state.stage,'aslan-pride');assert.equal(r.state.currentAslanOrigin.clan.acknowledged,undefined);round(r);
});
