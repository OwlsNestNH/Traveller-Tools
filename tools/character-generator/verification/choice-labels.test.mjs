import test from 'node:test';
import assert from 'node:assert/strict';
import {choiceLabel,skillChoiceProgress} from '../gui/choice-labels.mjs';
const skill=name=>({kind:'skill',name,mode:'set',value:0});
test('basic-training choices show their actual skill instead of an opaque number',()=>{
 const option={label:'Basic-training option 1',effects:[skill('Admin')]},before=structuredClone(option);assert.equal(choiceLabel(option),'Admin 0');assert.deepEqual(option,before);
});
test('nested alternative skills remain clearly labelled choices',()=>{
 assert.equal(choiceLabel({label:'Basic-training option 2',effects:[{kind:'choice',options:[{label:'Drive',effects:[skill('Drive')]},{label:'Vacc Suit',effects:[skill('Vacc Suit')]}]}]}),'Drive 0 or Vacc Suit 0');
});
test('learned psionic choice is named without inventing a specific acquired talent',()=>{
 assert.equal(choiceLabel({label:'Basic-training option 3',effects:[{kind:'skill-choice',scope:'psionic-talents',mode:'set',value:0}]}),'Psionic talent 0 (choose)');
});
test('ordinary choices and unsupported effects preserve existing labels',()=>{
 assert.equal(choiceLabel({label:'Stay in this career',effects:[skill('Admin')]}),'Stay in this career');assert.equal(choiceLabel({label:'Basic-training option 4',effects:[{kind:'future-special'}]}),'Basic-training option 4');
});


test('partial awards stay visible at native and source-assisted choices',()=>{
 const esc=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
 assert.equal(skillChoiceProgress({selected:[]},esc),'');
 const html=skillChoiceProgress({selected:['Science (<subject>)'],count:1},esc);
 assert.match(html,/Already awarded: Science \(&lt;subject&gt;\)/);assert.match(html,/Remaining skill awards: 1/);assert.match(html,/Do not add/);assert.doesNotMatch(html,/<subject>/);
});
