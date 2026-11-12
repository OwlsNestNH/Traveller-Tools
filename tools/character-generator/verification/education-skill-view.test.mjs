import test from 'node:test';
import assert from 'node:assert/strict';
import {educationSkillTitle,educationSubjects,educationSpecialities,educationSkillView,syncEducationSubject,companionSkillSuggestions} from '../gui/education-skill-view.mjs';
import {catalog} from '../engine/session.mjs';
import {UNIVERSITY_SKILL_CHOICES} from '../engine/education-pack.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const state=(step=0)=>({education:0,character:{educations:[{selections:step?{'university-0':'Science (physics)'}:{}}]},pendingChoice:{selectionId:'university-'+step,value:step},educationOptions:UNIVERSITY_SKILL_CHOICES});

test('Companion level-zero autocomplete contains only distinct base skills',()=>{
 const s={pendingChoice:{value:0},educationOptions:['Athletics','Deception','Drive','Gambler','Melee','Persuade','Stealth'].map(name=>({name}))};
 assert.deepEqual(companionSkillSuggestions(s,catalog()),s.educationOptions.map(o=>o.name));
 s.educationOptions=['Science','Profession','Melee (unarmed)','Melee'].map(name=>({name}));
 assert.deepEqual(companionSkillSuggestions(s,catalog()),['Science','Profession','Melee']);
});
test('Companion positive-level autocomplete retains fixed and selectable specialties',()=>{
 const s={pendingChoice:{value:1},educationOptions:['Melee','Science','Gun Combat (slug)'].map(name=>({name}))};
 assert.deepEqual(companionSkillSuggestions(s,catalog()),['Melee','Melee (unarmed)','Melee (blade)','Melee (bludgeon)','Melee (natural)','Science','Gun Combat (slug)']);
});
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

test('all pre-career hobby prompts name the event and avoid University subject controls',()=>{
 for(const id of ['core.university','core.academy-army','core.academy-marine','core.academy-navy','companion.colonial','companion.psionic','companion.merchant','companion.hard-knocks','companion.spacer']){
  const s=state();s.stage='education-skill';s.character.educations[0].id=id;s.pendingChoice.selectionId='hobby';
  assert.equal(educationSkillTitle(s),'Choose your hobby skill');
  const html=educationSkillView(s,catalog(),esc,label=>label);
  assert.match(html,/Pre-career event 9: hobby skill/);assert.match(html,/except Jack-of-all-Trades at level 0/);assert.match(html,/Record hobby skill/);
  assert.doesNotMatch(html,/Study subject|Study skill or specialisation|University skill [12]|retained for/);
 }
 assert.equal(educationSkillTitle({...state(),stage:'education-skill'}),null);
});

test('both exact University skill boxes stay on one page with one active durable award',()=>{
 for(const step of [0,1]){const s=state(step),before=structuredClone(s),html=educationSkillView(s,catalog(),esc,(label,action,cls,attrs)=>'<button data-action="'+action+'" class="'+cls+'" '+attrs+'>'+label+'</button>',{result:true});assert.match(html,/Choose a Level\/0 Skill/);assert.match(html,/Choose a Level\/1 Skill/);assert.equal((html.match(/data-study-box=/g)||[]).length,2);assert.equal((html.match(/data-action="education-skill"/g)||[]).length,1);assert.equal((html.match(/id="education-subject"/g)||[]).length,1);if(step===0){assert.match(html,/select disabled aria-labelledby="university-skill-title-2"/);assert.doesNotMatch(html,/university-skill-retained/);}else{assert.match(html,/Science \(physics\)/);assert.match(html,/Recorded · retained for graduation/);assert.doesNotMatch(html,/<option value="Science"/);}assert.doesNotMatch(html,/university-skill-level|Study subject/);assert.ok(html.lastIndexOf('</div>')<html.indexOf('<button'));assert.equal((html.match(/<select/g)||[]).length,2);assert.deepEqual(s,before);}
});
