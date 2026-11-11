import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as build,run,force,rejected,settleOrigin} from './aslan-origin-fixtures.mjs';
import {aslanEstatePopupModel,aslanEstatePopupView} from '../gui/aslan-estate-popup.mjs';
import {aslanBirthPopupModel,aslanBirthPopupView} from '../gui/aslan-birth-popup.mjs';
import {ASLAN_ORIGIN_TAGLINES,originTagline} from '../gui/aslan-origin-taglines.mjs';
const round=r=>{const x=api({operation:'import',raw:exportSession(r.session)});assert.equal(x.ok,true);assert.deepEqual(x.state,r.state);assert.deepEqual(x.log,r.log);return x;};
test('all printed estate minima use initial SOC with no dice, awards or ownership',()=>{
 for(let soc=9;soc<=17;soc++)for(const gender of ['male','female']){
  let r=build({familySOC:soc,gender,stage:'aslan-estate'});const model=aslanEstatePopupModel(r.state);assert.equal(model.minimum,10**(soc-8));assert.equal(model.increment,model.minimum/5);const html=aslanEstatePopupView(model,{esc:String});assert.match(html,/Record family estate/);assert.doesNotMatch(html,/id="aslan-family-roll"/);round(r);
  const skills=structuredClone(r.state.character.skills),rng=r.state.rng;r=run(r,'resolve-aslan-estate',{method:'printed-minimum'},{id:'estate-once'});assert.equal(r.state.stage,'aslan-clan');assert.equal(r.state.rng,rng);assert.deepEqual(r.state.character.skills,skills);assert.deepEqual(r.log.at(-1).rolls,[]);assert.equal(r.state.currentAslanOrigin.estate.ownership,'unestablished');assert.match(r.log.at(-1).summary,new RegExp('Initial family SOC '+soc));assert.deepEqual(run(r,'resolve-aslan-estate',{method:'printed-minimum'},{id:'estate-once'}).state,r.state);rejected(r,'resolve-aslan-estate',{method:'printed-minimum'});round(r);
 }
});
test('below SOC9 has no printed minimum, not invented zero-parcel ownership',()=>{
 for(const soc of [2,3,6,8]){let r=build({familySOC:soc,stage:'aslan-estate'});const model=aslanEstatePopupModel(r.state);assert.equal(model.minimum,null);assert.match(aslanEstatePopupView(model,{esc:String}),/No printed estate minimum/);r=run(r,'resolve-aslan-estate',{method:'printed-minimum'});assert.equal(r.state.currentAslanOrigin.estate.minimumParcels,null);assert.equal(r.state.currentAslanOrigin.estate.ownership,'unestablished');round(r);}
});
test('unprinted SOC retains explicit referee path and legacy popup remains off',()=>{
 const high=build({familySOC:18,stage:'aslan-estate'});assert.equal(aslanEstatePopupModel(high.state),null);rejected(high,'resolve-aslan-estate',{method:'printed-minimum'});round(high);
 const old=build({rulesRevision:'character-preview-2026-11-09.27',stage:'aslan-estate'});assert.equal(aslanEstatePopupModel(old.state),null);round(old);
});
test('Other identity remains distinct from selected source branch in birth display',()=>{
 let r=build({gender:'other',stage:'book-step'});r=run(r,'resolve-aslan-origin-source',{gender:'male',reason:'Explicit source mechanical branch'});r=settleOrigin(r,{until:'aslan-birth-order'});assert.match(aslanBirthPopupView(aslanBirthPopupModel(r.state),{esc:String}),/Other identity · Male source branch/);assert.equal(r.state.character.identityGender,'other');round(r);
});
test('five further origin outcomes have six deterministic flavor lines without game RNG',()=>{
 const old=Math.random;Math.random=()=>{throw Error('No random flavor');};try{for(const[key,lines]of Object.entries(ASLAN_ORIGIN_TAGLINES)){assert.equal(lines.length,6);assert.equal(new Set(lines).size,6);assert.ok(Object.isFrozen(lines));for(let i=0;i<30;i++){assert.ok(lines.includes(originTagline(key,i)));assert.equal(originTagline(key,i),originTagline(key,i));}}assert.equal(originTagline('unknown'),'');}finally{Math.random=old;}
});
