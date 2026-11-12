import test from 'node:test';
import assert from 'node:assert/strict';
import {educationDicePair,educationEventView,educationGraduationView,educationPotentialView,educationNestedChoiceView} from '../gui/precareer-popup.mjs';
import {aslanFamilyDie} from '../gui/aslan-family-popup.mjs';
import {educationResultView} from '../gui/education-result-view.mjs';
const count=(html,token)=>(html.match(new RegExp(token,'g'))??[]).length;
test('two unknown dice reuse released artwork, never generate numeric faces',()=>{
 const pair=educationDicePair();assert.equal(count(pair,'aslan-family-mystery'),2);assert.equal(count(pair,'>\\?</text>'),2);assert.ok(pair.includes(aslanFamilyDie()+aslanFamilyDie()));assert.match(pair,/Two dice, not rolled yet/);assert.doesNotMatch(pair,/aslan-family-die|data-action/);
 const views=[educationEventView(),educationGraduationView({preview:{target:6,honoursTarget:10,modifier:0,stat:'INT',score:8}},{esc:String}),educationPotentialView({recorded:false}),educationNestedChoiceView({kind:'challenge',event:10},{educationCheckSkills:['Medic']},{esc:String})];
 for(const html of views){assert.equal(count(html,'aslan-family-mystery'),2);assert.doesNotMatch(html,/admission-dice|graduation-dice-art/);}
 for(const html of [educationPotentialView({recorded:true}),educationNestedChoiceView({kind:'hobby',event:9},{educationOptions:[{name:'Medic'}]},{esc:String})])assert.equal(count(html,'aslan-family-mystery'),0);
});
test('completed education renders only the exact supplied pair of pip faces',()=>{
 for(const dice of [[1,6],[2,5],[3,4],[6,1]]){
  const model={id:'core.university',name:'University',kind:'admission',outcome:'success',dice,modifier:0,total:7,target:6},before=structuredClone(model),html=educationResultView(model,{esc:String,button:()=>'<button>Continue</button>',sourceLabel:String});
  const faces=[...html.matchAll(/<svg class="education-result-die"[\s\S]*?<\/svg>/g)].map(m=>count(m[0],'<circle'));
  assert.deepEqual(faces,dice);assert.equal(count(html,'education-result-die'),2);assert.doesNotMatch(html,/aslan-family-mystery/);assert.deepEqual(model,before);
 }
});
