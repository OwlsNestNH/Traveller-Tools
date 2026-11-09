import test from 'node:test';
import assert from 'node:assert/strict';
import {awardBases,awardNames,skillAwardView,syncAwardBase,deferredAwardsView} from '../gui/skill-award-view.mjs';
const esc=String,helpers={esc,button:(label,action)=>label+' '+action,sourceLabel:()=>'',skillChoiceProgress:()=>''};
const catalog={skillSpecialities:{'Gun Combat':['energy','slug'],Electronics:['comms','computers'],Science:null}};
const state={pendingChoice:{deferSpeciality:true},skillChoiceSuggestions:['Gun Combat','Gun Combat (energy)','Gun Combat (slug)','Electronics (comms)'],character:{}};
test('finite primary controls use only engine-projected eligible specialties',()=>{
 assert.deepEqual(awardBases(state),['Gun Combat','Electronics']);
 assert.deepEqual(awardNames(state,'Electronics'),['Electronics (comms)']);
 assert.match(skillAwardView(state,catalog,helpers),/finalization/);assert.match(skillAwardView(state,catalog,helpers),/id="award-base"/);
});
test('changing base removes stale specialty and a fixed grant never offers generic deferral',()=>{
 const nodes=Object.fromEntries(['award-base','award-skill','award-skill-options','award-speciality-controls','award-speciality'].map(id=>['#'+id,{}])),root={querySelector:id=>nodes[id]};
 nodes['#award-base'].value='Gun Combat';syncAwardBase(state,catalog,root,esc);assert.equal(nodes['#award-skill'].value,'Gun Combat');assert.match(nodes['#award-speciality-controls'].innerHTML,/finalization/);
 nodes['#award-base'].value='Electronics';syncAwardBase(state,catalog,root,esc);assert.equal(nodes['#award-skill'].value,'');assert.match(nodes['#award-speciality-controls'].innerHTML,/comms/);assert.doesNotMatch(nodes['#award-speciality-controls'].innerHTML,/Gun Combat|computers|finalization/);
});
test('allocation renders only useful specialties and pending awards remain separate',()=>{
 const s={...state,pendingChoice:{allocationId:'a'},skillChoiceSuggestions:['Gun Combat (energy)'],character:{deferredSkillAwards:[{id:'a',status:'pending',name:'Gun Combat',mode:'set',value:1},{id:'b',status:'pending',name:'Gun Combat',mode:'set',value:1},{status:'allocated',name:'Science',value:1}]},specializationOptions:{available:true,count:2}};
 assert.deepEqual(awardNames(s,'Gun Combat'),['Gun Combat (energy)']);assert.match(skillAwardView(s,catalog,helpers),/Each award is kept separately/);
 const view=deferredAwardsView(s,helpers);assert.equal((view.match(/Gun Combat/g)??[]).length,2);assert.doesNotMatch(view,/Science/);assert.match(view,/allocate-specializations/);
 s.specializationOptions.available=false;assert.doesNotMatch(deferredAwardsView(s,helpers),/allocate-specializations/);
});
