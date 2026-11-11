import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as build,run,force,rejected} from './aslan-origin-fixtures.mjs';
import {aslanBirthPopupModel,aslanBirthPopupView} from '../gui/aslan-birth-popup.mjs';
const round=r=>{const loaded=api({operation:'import',raw:exportSession(r.session)});assert.equal(loaded.ok,true);assert.deepEqual(loaded.state,r.state);assert.deepEqual(loaded.log,r.log);return loaded;};
test('all 36 birth dice persist in a result screen until Continue, never award or reroll',()=>{
 for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
  let r=build({stage:'aslan-birth-order'});const skills=structuredClone(r.state.character.skills);r=force(r,'roll-aslan-birth-order',{},[a,b]);assert.equal(r.state.stage,'aslan-birth-result');assert.equal(r.state.currentAslanOrigin.birthOrder.id,a+b>=11?'first-son':'second-son');assert.deepEqual(r.state.currentAslanOrigin.birthOrder.dice,[a,b]);round(r);
  const view=aslanBirthPopupView(aslanBirthPopupModel(r.state),{esc:String});assert.ok(view.includes('You rolled '+(a+b)));assert.ok(view.includes(a+' + '+b+' = '+(a+b)));rejected(r,'roll-aslan-birth-order',{},/not awaiting/);rejected(r,'resolve-aslan-estate',{method:'printed-minimum'});
  const rng=r.state.rng;r=run(r,'acknowledge-aslan-birth-order',{}, {id:'birth-ack'});assert.equal(r.state.stage,'aslan-estate');assert.equal(r.state.rng,rng);assert.deepEqual(r.state.character.skills,skills);assert.deepEqual(r.log.at(-1).rolls,[]);assert.deepEqual(run(r,'acknowledge-aslan-birth-order',{}, {id:'birth-ack'}).state,r.state);rejected(r,'acknowledge-aslan-birth-order');round(r);
 }
});
test('daughter and historical birth paths remain unchanged',()=>{
 const female=build({gender:'female',stage:'aslan-estate'});assert.equal(aslanBirthPopupModel(female.state),null);assert.deepEqual(female.state.currentAslanOrigin.birthOrder.dice,[]);rejected(female,'roll-aslan-birth-order');round(female);
 let old=build({rulesRevision:'character-preview-2026-11-09.27',stage:'aslan-birth-order'});assert.equal(aslanBirthPopupModel(old.state),null);old=force(old,'roll-aslan-birth-order',{},[6,5]);assert.equal(old.state.stage,'aslan-estate');assert.equal(old.state.currentAslanOrigin.birthOrder.acknowledged,undefined);round(old);
});
test('birth roll screen uses chosen identity and explicit 2D',()=>{const r=build({stage:'aslan-birth-order'});const html=aslanBirthPopupView(aslanBirthPopupModel(r.state),{esc:String});assert.match(html,/Roll 2D/);assert.match(html,/11–12: Firstborn son/);assert.doesNotMatch(html,/Choose gender|name="gender"/);});
