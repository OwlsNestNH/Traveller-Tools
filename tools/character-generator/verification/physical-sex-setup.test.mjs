import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalSexSelectView} from '../gui/physical-sex-setup.mjs';
import {OPENING_HELP} from '../gui/opening-help.mjs';
import {createSession,execute,project,exportSession,importSession} from '../engine/session.mjs';

test('setup offers only male and female with no automatic physical-sex assignment',()=>{
 const html=physicalSexSelectView();
 assert.match(html,/<select id="setup-gender" name="gender">/);
 assert.match(html,/<option value="" selected disabled>Choose physical sex<\/option>/);
 const selectable=[...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(selectable,[['female','Female'],['male','Male']]);
 assert.doesNotMatch(html,/Not specified|>Other</);
 assert.equal(OPENING_HELP.gender.title,'Physical sex');
 assert.match(OPENING_HELP.gender.paragraphs.join(' '),/not a pronoun selector/);
});

test('display-only change preserves existing saved values rather than assigning sex',()=>{
 for(const gender of ['','other','male','female']){
  const r=execute(createSession('physical-sex-save-'+gender),{type:'setup',payload:{species:'human',gender,name:'Retained Traveller'}});
  const saved=exportSession(r.session),restored=importSession(saved);
  assert.equal(exportSession(restored),saved);
  assert.equal(project(restored).state.character.gender,gender);
  physicalSexSelectView();
  assert.equal(exportSession(restored),saved);
 }
});
