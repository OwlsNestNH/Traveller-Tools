import test from 'node:test';
import assert from 'node:assert/strict';
import {educationSubjects,educationSpecialities,educationSkillView,syncEducationSubject} from '../gui/education-skill-view.mjs';
import {catalog} from '../engine/session.mjs';
import {UNIVERSITY_SKILL_CHOICES} from '../engine/education-pack.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const state=(step=0)=>({education:0,character:{educations:[{selections:step?{'university-0':'Science (physics)'}:{}}]},pendingChoice:{selectionId:'university-'+step,value:step},educationOptions:UNIVERSITY_SKILL_CHOICES});
test('University names both sequential awards and excludes the first subject from the second',()=>{
 const a=educationSkillView(state(),catalog(),esc,(label)=>label),b=educationSkillView(state(1),catalog(),esc,(label)=>label);
 assert.match(a,/University skill 1 of 2: level 0/);assert.match(a,/Record level 0 and choose level 1/);
 assert.match(b,/University skill 2 of 2: level 1/);assert.ok(!educationSubjects(state(1)).some(s=>s.name==='Science'));
});
test('University suggestions contain only the selected allowed skill specialisations',()=>{
 assert.deepEqual(educationSpecialities(state(),catalog(),'Animals'),['Animals (training)','Animals (veterinary)']);
 assert.deepEqual(educationSpecialities(state(),catalog(),'Engineer'),['Engineer (m-drive)','Engineer (j-drive)','Engineer (life support)','Engineer (power)']);
 assert.deepEqual(educationSpecialities(state(),catalog(),'Admin'),[]);
 assert.deepEqual(educationSpecialities(state(),catalog(),'Science'),[]);
 assert.deepEqual(educationSpecialities(state(),catalog(),'Gun Combat'),[]);
});
test('changing subjects resets stale input and offers only matching options, including open subjects',()=>{
 const nodes=Object.fromEntries(['education-subject','education-skill','education-skills','education-speciality-help'].map(id=>['#'+id,{}]));
 const root={querySelector:id=>nodes[id]};
 for(const base of ['Animals','Engineer','Science','Admin','']){
  nodes['#education-subject'].value=base;nodes['#education-skill'].value='Animals (riding)';syncEducationSubject(state(),catalog(),root,esc);
  assert.equal(nodes['#education-skill'].value,base==='Admin'?'Admin':'');
  if(base==='Animals'){assert.match(nodes['#education-skills'].innerHTML,/veterinary/);assert.doesNotMatch(nodes['#education-skills'].innerHTML,/riding|handling/);}
  if(base==='Engineer'){assert.match(nodes['#education-skills'].innerHTML,/power/);assert.doesNotMatch(nodes['#education-skills'].innerHTML,/Animals/);}
  if(base==='Science')assert.match(nodes['#education-speciality-help'].textContent,/Enter your Science subject/);
  if(base==='Admin')assert.match(nodes['#education-speciality-help'].textContent,/no specialisation/);
 }
});
test('hobby level zero requests only a base skill',()=>{
 const s=state();s.pendingChoice.selectionId='hobby';assert.deepEqual(educationSpecialities(s,catalog(),'Animals'),[]);
});
