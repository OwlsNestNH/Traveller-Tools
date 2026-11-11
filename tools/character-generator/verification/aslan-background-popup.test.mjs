import test from 'node:test';
import assert from 'node:assert/strict';
import {api,exportSession} from '../engine/session.mjs';
import {buildAslanOriginFixture as build,run,rejected} from './aslan-origin-fixtures.mjs';
import {backgroundSelection,backgroundSkillsView} from '../gui/background-skills.mjs';
import {hasAslanBackgroundPopup} from '../gui/aslan-background-popup.mjs';
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const round=r=>{const x=api({operation:'import',raw:exportSession(r.session)});assert.equal(x.ok,true);assert.deepEqual(x.state,r.state);assert.deepEqual(x.log,r.log);};
test('native male and female ordinary choices preserve family awards and level-zero base skills',()=>{
 for(const gender of ['male','female']){
  let r=build({gender,familySOC:4,familyDie:1,stage:'background'}),s=backgroundSelection(r.state);assert.equal(hasAslanBackgroundPopup(r.state),true);assert.equal(r.state.character.skills.Animals,0);assert.equal(s.options.includes('Animals'),false);assert.equal(s.required,r.state.backgroundRemaining);const html=backgroundSkillsView(r.state,[],{}, {esc});assert.match(html,/Already awarded by your family/);assert.match(html,/Animals <b>0/);assert.match(html,/Next: your Rite of Passage/);assert.doesNotMatch(html,/name="specialty"/);assert.match(html,/id="aslan-background-info-open"/);
  const skills=s.options.slice(0,s.required),before=structuredClone(r.state.character.skills),rng=r.state.rng;rejected(r,'background',{skills:[...skills.slice(1),'Animals']});r=run(r,'background',{skills},{id:'background-accept'});assert.equal(r.state.stage,'aslan-rite');assert.equal(r.state.rng,rng);assert.deepEqual(r.log.at(-1).rolls,[]);for(const [name,value] of Object.entries(before))assert.equal(r.state.character.skills[name],value);for(const name of skills){assert.equal(r.state.character.skills[name],0);assert.equal(name.includes(' ('),false);}assert.deepEqual(run(r,'background',{skills},{id:'background-accept'}).state,r.state);rejected(r,'background',{skills});round(r);
 }
});
test('Other identity uses its recorded branch without relabelling the identity',()=>{
 const r=build({gender:'other',stage:'background',sourceDecisions:{gender:{gender:'female',reason:'Use the female source branch while retaining Other identity.'}}});const html=backgroundSkillsView(r.state,[],{}, {esc});assert.match(html,/other/);assert.match(html,/female source rules/);assert.match(html,/Female background choices/);assert.equal(r.state.character.identityGender,'other');
});
test('legacy and Imperial Aslan do not acquire the native popup or change choices',()=>{
 const old=build({stage:'background',rulesRevision:'character-preview-2026-11-09.27'});assert.equal(hasAslanBackgroundPopup(old.state),false);assert.doesNotMatch(backgroundSkillsView(old.state,[],{}, {esc}),/aslan-family-dialog/);let r=api({operation:'create',seed:'imperial-bg'});r=run(r,'setup',{species:'aslan',culture:'imperial',gender:'female'});r=run(r,'roll-statistics');r=run(r,'accept-statistics');assert.equal(r.state.currentAslanOrigin,null);assert.equal(hasAslanBackgroundPopup(r.state),false);round(r);
});
test('zero choices remain explicit and excess/duplicate selections cannot accept',()=>{
 const r=build({stage:'background'}),state={...r.state,backgroundRemaining:0};let s=backgroundSelection(state);assert.equal(s.valid,true);assert.match(backgroundSkillsView(state,[],{}, {esc}),/Choose 0 new skills/);assert.equal(backgroundSelection(state,[s.options[0]]).valid,false);const one={...state,backgroundRemaining:1};assert.equal(backgroundSelection(one,[s.options[0],s.options[0]]).valid,false);
});
