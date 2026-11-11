import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as build,run,force,rejected} from './aslan-origin-fixtures.mjs';
import {aslanFamilyPopupModel} from '../gui/aslan-family-presentation.mjs';
const round=r=>{const loaded=api({operation:'import',raw:exportSession(r.session)});assert.equal(loaded.ok,true);assert.deepEqual(loaded.state,r.state);assert.deepEqual(loaded.log,r.log);return loaded;};
test('gender is chosen at species setup, never asked or rolled again in family flow',()=>{
 const fresh=api({operation:'create',seed:'family-setup-gender'});rejected(fresh,'setup',{species:'aslan',gender:''},/species selection/);
 for(const gender of ['male','female']){const r=build({gender});assert.equal(r.state.currentAslanOrigin.gender.mode,'selected');assert.equal(r.state.currentAslanOrigin.canRollGender,false);assert.ok(aslanFamilyPopupModel(r.state));rejected(r,'roll-aslan-gender',{},/Choose gender/);round(r);}
});
test('automatic family outcome waits durably for explicit Continue',()=>{
 let r=force(build({familySOC:6}),'roll-aslan-family',{},[2]);assert.equal(r.state.stage,'aslan-family-result');assert.equal(aslanFamilyPopupModel(r.state).die,2);r=round(r);
 const skills=structuredClone(r.state.character.skills),rng=r.state.rng;r=run(r,'acknowledge-aslan-family',{}, {id:'family-ack-once'});
 assert.equal(r.state.stage,'aslan-birth-order');assert.equal(r.log.at(-1).rolls.length,0);assert.deepEqual(r.state.character.skills,skills);assert.equal(r.state.rng,rng);assert.equal(aslanFamilyPopupModel(r.state),null);
 assert.deepEqual(run(r,'acknowledge-aslan-family',{}, {id:'family-ack-once'}).state,r.state);rejected(r,'acknowledge-aslan-family',{},/not awaiting/);round(r);
});
test('choice reload, invalid choice and repeated click never grant two awards',()=>{
 let r=force(build({familySOC:3}),'roll-aslan-family',{},[1]);assert.deepEqual(aslanFamilyPopupModel(r.state).choices.map(x=>x.label),['Animals 0','Profession 0']);r=round(r);
 rejected(r,'acknowledge-aslan-family',{},/not awaiting/);rejected(r,'choose-effect',{index:99});r=run(r,'choose-effect',{index:1},{id:'family-skill-once'});assert.equal(r.state.character.skills.Profession,0);assert.equal(r.state.stage,'aslan-family-result');r=round(r);
 assert.deepEqual(run(r,'choose-effect',{index:1},{id:'family-skill-once'}).state,r.state);rejected(r,'choose-effect',{index:0});r=run(r,'acknowledge-aslan-family');assert.equal(r.state.character.skills.Animals,undefined);round(r);
});
test('all 30 results show a source-grounded narrative and preserve exact family die',()=>{
 for(const soc of [2,3,6,9,12])for(let die=1;die<=6;die++){
  let r=force(build({familySOC:soc,gender:'male'}),'roll-aslan-family',{},[die]);const family=r.state.currentAslanOrigin.family;
  assert.equal(family.die,die);assert.ok(family.narrative);assert.ok(family.resultLabel);assert.match(r.log.at(-1).summary,/Family background/);assert.ok(r.log.at(-1).summary.includes(family.narrative));round(r);
 }
});
test('historical .27 gender and immediate family transitions keep original replay shape',()=>{
 let r=build({gender:'',rulesRevision:'character-preview-2026-11-09.27'});r=force(r,'roll-aslan-gender',{},[1,2]);assert.equal(r.state.character.gender,'male');r=force(r,'roll-aslan-family',{},[2]);
 assert.equal(r.state.stage,'aslan-birth-order');assert.equal(r.state.currentAslanOrigin.familyPresentation,undefined);assert.equal(r.state.currentAslanOrigin.family.narrative,undefined);assert.equal(aslanFamilyPopupModel(r.state),null);round(r);
});
test('daughter Continue records no birth roll or ownership',()=>{
 let r=force(build({familySOC:9,gender:'female'}),'roll-aslan-family',{},[1]);r=run(r,'acknowledge-aslan-family');assert.equal(r.state.stage,'aslan-estate');assert.equal(r.state.currentAslanOrigin.birthOrder.id,'daughter');assert.deepEqual(r.state.currentAslanOrigin.birthOrder.dice,[]);assert.equal(r.state.character.assets?.length??0,0);round(r);
});
