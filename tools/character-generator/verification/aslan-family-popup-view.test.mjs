import test from 'node:test';
import assert from 'node:assert/strict';
import {aslanFamilyPopupView} from '../gui/aslan-family-popup.mjs';
import {familyNarrative,familyBandLabels} from '../gui/aslan-family-presentation.mjs';
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;');
test('family introduction has an explicit roll and no fabricated outcome', () => {
  const html=aslanFamilyPopupView({bandLabel:'Lower class'},{esc});
  assert.match(html,/Roll 1D/);assert.match(html,/id="aslan-family-roll"/);
  assert.doesNotMatch(html,/You rolled|name="aslan-family-choice"|Roll gender/);
});
test('family result shows the exact die and requires an explicit skill choice', () => {
  const html=aslanFamilyPopupView({bandLabel:'Lower class',die:1,...familyNarrative('lower',1),choices:[{label:'Animals 0'},{label:'Profession 0'}]},{esc});
  assert.match(html,/You rolled 1/);assert.match(html,/You grew up in a labouring family/);
  assert.match(html,/id="aslan-family-continue" disabled/);assert.equal((html.match(/type="radio"/g)??[]).length,2);
  assert.doesNotMatch(html,/id="aslan-family-roll"/);
});
test('all five family bands have six distinct source-derived narratives', () => {
  for(const band of Object.keys(familyBandLabels))for(let die=1;die<=6;die++){
    const narrative=familyNarrative(band,die);assert.ok(narrative?.narrative);assert.ok(narrative.resultLabel);
  }
  assert.equal(familyNarrative('lower',7),null);
});
test('automatic outcomes expose Continue without inventing a skill award', () => {
  const html=aslanFamilyPopupView({bandLabel:'Lower class',die:2,...familyNarrative('lower',2),awardSummary:'No additional family skill is awarded.'},{esc});
  assert.match(html,/id="aslan-family-continue">/);assert.doesNotMatch(html,/type="radio"/);
});
test('Independence result distinguishes failed and successful acquisition from no-award rows',()=>{
 for(const success of [false,true]){const html=aslanFamilyPopupView({bandLabel:'Outcast',die:4,...familyNarrative('outcast',4),acquisition:{dice:success?[1,2]:[1,1],total:success?3:2,soc:2,success}},{esc});assert.match(html,/Independence check:/);assert.match(html,/Needs greater than SOC 2/);assert.ok(html.includes(success?'Success: Independence 0 recorded.':'Not acquired: no Independence skill awarded.'));}
});
