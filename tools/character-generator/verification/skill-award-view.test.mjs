import {SPECIALITIES} from '../engine/skills.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {awardBases,awardNames,skillAwardView,syncAwardBase,syncAwardSpeciality,chosenAwardSkill,deferredAwardsView} from '../gui/skill-award-view.mjs';
const esc=String,helpers={esc,button:(label,action)=>label+' '+action,sourceLabel:()=>'',skillChoiceProgress:()=>''};
const catalog={skillSpecialities:{'Gun Combat':['energy','slug'],Electronics:['comms','computers'],Science:null}};
const state={pendingChoice:{deferSpeciality:true},skillChoiceSuggestions:['Gun Combat','Gun Combat (energy)','Gun Combat (slug)','Electronics (comms)'],character:{}};
test('level-zero cascade awards retain the base skill without a specialisation prompt',()=>{
 const s={pendingChoice:{mode:'set',value:0},skillChoiceBases:['Gun Combat'],skillChoiceSuggestions:['Gun Combat'],character:{skills:{}}};
 const nodes={'#award-base':{value:'Gun Combat'},'#award-skill':{},'#award-skill-options':{},'#award-speciality-controls':{},'#award-custom-field':{}},root={querySelector:id=>nodes[id]??null};
 assert.match(skillAwardView(s,catalog,helpers),/<select id="award-base"/);
 syncAwardBase(s,catalog,root,esc);assert.equal(nodes['#award-speciality-controls'].innerHTML,'');assert.equal(nodes['#award-skill'].value,'Gun Combat');
});
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

test('ordinary skills in defer-enabled mixed choices need no specialty control',()=>{
 const s={...state,skillChoiceBases:['Admin','Science'],skillChoiceSuggestions:['Admin']};assert.deepEqual(awardBases(s),['Admin','Science']);
 const nodes={'#award-base':{value:'Admin'},'#award-skill':{},'#award-skill-options':{},'#award-speciality-controls':{}},root={querySelector:id=>nodes[id]??null};syncAwardBase(s,catalog,root,esc);assert.equal(nodes['#award-skill'].value,'Admin');assert.equal(nodes['#award-speciality-controls'].innerHTML,'');
});

test('eligible award controls identify held levels without changing canonical values or adding specialties',()=>{
 const s={pendingChoice:{allowed:['Medic','Gun Combat'],deferSpeciality:false},skillChoiceBases:['Medic','Gun Combat'],skillChoiceSuggestions:['Medic','Gun Combat (energy)'],character:{skills:{Medic:0,'Gun Combat (energy)':1,'Gun Combat (slug)':2}}},before=JSON.stringify(s);
 const html=skillAwardView(s,catalog,helpers);assert.match(html,/<option value="Medic"[^>]*>Medic — already known: Medic 0/);assert.deepEqual(awardNames(s,'Gun Combat'),['Gun Combat (energy)']);
 const nodes={'#award-base':{value:'Gun Combat'},'#award-skill':{},'#award-skill-options':{},'#award-speciality-controls':{}},root={querySelector:id=>nodes[id]??null};syncAwardBase(s,catalog,root,esc);
 assert.match(nodes['#award-speciality-controls'].innerHTML,/<option value="Gun Combat \(energy\)">Gun Combat \(energy\) — already known: Gun Combat \(energy\) 1/);assert.doesNotMatch(nodes['#award-speciality-controls'].innerHTML,/<option value="Gun Combat \(slug\)"/);assert.match(nodes['#award-skill-options'].innerHTML,/value="Gun Combat \(energy\)" label=/);assert.equal(JSON.stringify(s),before);
});

test('Custom is last and hidden until selected, without adding finite source options',()=>{
 const nodes={'#award-base':{value:'Gun Combat'},'#award-skill':{},'#award-skill-options':{},'#award-speciality-controls':{},'#award-custom-field':{},'#award-speciality':{value:'Gun Combat (energy)'}},root={querySelector:id=>nodes[id]??null};syncAwardBase(state,catalog,root,esc);assert.match(nodes['#award-speciality-controls'].innerHTML,/<option value="__custom__">Custom<\/option><\/select>/);assert.equal(nodes['#award-custom-field'].hidden,true);
 nodes['#award-speciality'].value='Gun Combat (energy)';syncAwardSpeciality(root);assert.equal(nodes['#award-skill'].value,'Gun Combat (energy)');nodes['#award-skill'].value='stale custom';assert.equal(chosenAwardSkill(root),'Gun Combat (energy)');nodes['#award-speciality'].value='__custom__';syncAwardSpeciality(root);assert.equal(nodes['#award-custom-field'].hidden,false);assert.equal(nodes['#award-skill'].value,'');nodes['#award-skill'].value='slug';assert.equal(chosenAwardSkill(root),'Gun Combat (slug)');nodes['#award-skill'].value='Science (physics)';assert.equal(chosenAwardSkill(root),'');nodes['#award-speciality'].value='Gun Combat (energy)';syncAwardSpeciality(root);assert.equal(nodes['#award-custom-field'].hidden,true);assert.equal(nodes['#award-skill'].value,'Gun Combat (energy)');assert.equal(chosenAwardSkill(root),'Gun Combat (energy)');
});

test('every cascade skill uses only its projected options, Custom last, and clears stale alternative text',()=>{
 const completeCatalog={skillSpecialities:SPECIALITIES};assert.equal(Object.keys(SPECIALITIES).length,17);
 for(const [base,specialities]of Object.entries(SPECIALITIES)){
  const names=(specialities??['a permitted open subject']).map(s=>base+' ('+s+')');
  // A source-constrained subset must stay a subset, even for a broad cascade.
  const s={pendingChoice:{},skillChoiceBases:[base],skillChoiceSuggestions:names.slice(0,1),character:{skills:{[base]:0}}};
  const nodes={'#award-base':{value:base},'#award-skill':{},'#award-skill-options':{},'#award-speciality-controls':{},'#award-custom-field':{},'#award-known-status':{},'#award-speciality':{value:''}},root={querySelector:id=>nodes[id]??null};
  const before=JSON.stringify(s);syncAwardBase(s,completeCatalog,root,esc);
  const view=skillAwardView(s,completeCatalog,helpers);assert.match(view,/<input type="hidden" id="award-base"/,base);assert.doesNotMatch(view,/<select id="award-base"/,base);
  assert.match(nodes['#award-speciality-controls'].innerHTML,/<option value="__custom__">Custom<\/option><\/select>/,base);assert.equal(nodes['#award-custom-field'].hidden,true,base);assert.deepEqual(awardNames(s,base),names.slice(0,1));
  nodes['#award-speciality'].value='__custom__';syncAwardSpeciality(root);assert.equal(nodes['#award-custom-field'].hidden,false);nodes['#award-skill'].value='custom subject';assert.equal(chosenAwardSkill(root),base+' (custom subject)');
  nodes['#award-speciality'].value=names[0];syncAwardSpeciality(root);nodes['#award-skill'].value='stale text';assert.equal(chosenAwardSkill(root),names[0]);assert.equal(nodes['#award-custom-field'].hidden,true);assert.equal(JSON.stringify(s),before);
 }
});
