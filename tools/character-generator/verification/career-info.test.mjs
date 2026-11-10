import assert from 'node:assert/strict';
import test from 'node:test';
import {api} from '../engine/session.mjs';
import {careerInfoButton} from '../gui/career-info.mjs';
import {careerInfoFixture} from './career-info-fixtures.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
test('career information uses every released projected assignment without changing eligibility',()=>{
 const catalog=api({operation:'catalog'}),seen=new Set();let restricted=false,disabled=false;
 for(const [species,gender,culture] of [['human','female','native'],['aslan','male','native'],['aslan','female','native'],['vargr','female','native'],['aezorgh','female','native']]){
  const fixture=careerInfoFixture(species,gender,culture),before=JSON.stringify(fixture);
  for(const career of fixture.state.careerChoices){
   seen.add(career.id);assert.deepEqual(career.assignments.map(a=>a.name),catalog.careers.find(c=>c.id===career.id).assignments.map(a=>a.name));
   restricted ||= career.assignments.some(a=>a.disabled);disabled ||= !!career.disabled;
   const html=careerInfoButton(career,{esc});assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/type="button"/);assert.ok(!html.includes('disabled'),'Disabled careers remain inspectable');assert.ok(!html.includes('data-action'),'Info cannot issue a career command');
  }
  assert.equal(JSON.stringify(fixture),before);
 }
 assert.equal(seen.size,36);assert.ok(restricted);assert.ok(disabled);
});
test('career info button escapes IDs and accessible names',()=>{
 const html=careerInfoButton({id:'"<career>',name:'<Navy> & "Scout"'},{esc});assert.match(html,/data-career-info="&quot;&lt;career&gt;"/);assert.match(html,/Specialties for &lt;Navy&gt; &amp; &quot;Scout&quot;/);assert.ok(!html.includes('<Navy>'));
});
