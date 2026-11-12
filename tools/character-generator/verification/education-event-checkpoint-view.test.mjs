import {educationReady,educationSetup,forceEducation,command} from './education-result-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {educationCheckpointModel,educationCheckpointView,educationAppliedLines} from '../gui/education-event-checkpoint-view.mjs';
import {checkpointFixtures,eventFixture,eventStep} from './education-event-gui-fixtures.mjs';
import {exportSession,project} from '../engine/session.mjs';
const helpers={esc:v=>String(v??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),sourceLabel:(id,page)=>id+' p. '+page,choiceHtml:'<button data-action="choose-effect">Existing choice</button>'};
test('checkpoint presentation retains exact original/child dice and never mutates saves or RNG',()=>{
 for(const {result:r} of checkpointFixtures()){const before=exportSession(r.session),state=structuredClone(r.state),model=educationCheckpointModel(r);assert.ok(model);const html=educationCheckpointView(model,helpers);assert.match(html,/Recorded education event/);for(const n of model.eventDice)assert.ok(html.includes('data-recorded-face="'+n+'"'));assert.equal(exportSession(r.session),before);assert.deepEqual(r.state,state);assert.deepEqual(project(r.session).educationEventView,r.educationEventView);
 if(model.mode==='roll'){assert.ok(html.includes('data-pending-id="'+model.pendingId+'"'));assert.match(html,/roll-education-event-step/);assert.equal((html.match(/aslan-family-mystery/g)||[]).length,model.roll.dice==='2D'?2:1);assert.doesNotMatch(html,/data-action="acknowledge-education-event"/);}
 if(model.mode==='result'){assert.match(html,/acknowledge-education-event/);assert.doesNotMatch(html,/aslan-family-mystery|data-action="roll-education-event-step"/);}
 }
});
test('D3 shows the actual raw D6 face, separately from its converted total',()=>{
 const r=eventStep(eventFixture(6),[5]),html=educationCheckpointView(educationCheckpointModel(r),helpers);assert.match(html,/data-recorded-face="5"/);assert.match(html,/Dice total: 3 · Kept\/converted: 3/);assert.doesNotMatch(html,/data-recorded-face="3"/);
});
test('mismatched pending IDs, absent evidence and source stages retain native fallbacks',()=>{
 const r=eventFixture(4);for(const mutate of [p=>delete p.educationEventView,p=>p.educationEventView.roll.id='stale',p=>p.state.stage='book-step',p=>p.educationEventView.eventDice=[6,6]]){const p=structuredClone(r);mutate(p);assert.equal(educationCheckpointModel(p),null);}
 const pending=eventFixture(6);assert.deepEqual(educationAppliedLines(pending.educationEventView.appliedChanges),[]);const html=educationCheckpointView(educationCheckpointModel(pending),helpers);assert.doesNotMatch(html,/Applied results/);assert.match(html,/Ally count/);
});

test('required career is reported as destination evidence, not guessed from dice or awarded now',()=>{
 const r=eventStep(eventFixture(4),[1,1]),model=educationCheckpointModel(r),html=educationCheckpointView(model,{...helpers,careerLabel:id=>id==='core.prisoner'?'Prisoner':id});assert.equal(model.forcedCareer,'core.prisoner');assert.match(html,/Required next career: Prisoner/);assert.equal(r.state.active,null);
});

test('Independence preserves strict raw comparison, exact faces and recorded success/failure',()=>{
 for(const f of checkpointFixtures().filter(f=>f.label.startsWith('independence-'))){
  const model=educationCheckpointModel(f.result),html=educationCheckpointView(model,helpers);
  if(model.mode==='roll'){assert.match(html,/Raw 2D must exceed SOC 7/);assert.match(html,/No characteristic DM is added/);assert.equal(model.roll.modifier,0);}
  else{const check=model.childRolls.at(-1).check;assert.match(html,/Raw 2D &gt; SOC 7|Raw 2D > SOC 7/);assert.ok(html.includes('Total '+check.total+' · '+(check.success?'Success':'Failure')));assert.equal(check.success,f.label.endsWith('success'));}
 }
});
test('recorded check summary is authoritative even after current-stat edits',()=>{
 const r=eventStep(eventFixture(4),[4,4]),p=structuredClone(r);p.state.character.stats.SOC=1;
 const html=educationCheckpointView(educationCheckpointModel(p),helpers),check=r.educationEventView.childRolls[0].check;
 assert.ok(html.includes('Target '+check.target+'+'));assert.ok(html.includes('Total '+check.total));assert.equal(p.educationEventView.childRolls[0].check.modifier,check.modifier);
});
test('interruption retains source ageing and is never described as a failed graduation',()=>{
 const r=checkpointFixtures().find(f=>f.label==='interrupted-ageing').result,html=educationCheckpointView(educationCheckpointModel(r),helpers);
 assert.match(html,/without a graduation attempt/);assert.match(html,/source-assisted ageing decision remains/);assert.doesNotMatch(html,/failed graduation|Roll graduation/);assert.equal(r.educationEventView.nextStage,'book-step');
});

test('academy and source-assisted entry never acquire the University checkpoint presentation',()=>{
 const academy=forceEducation(educationReady('core.academy-army'),'education-event',{},[2,3]);assert.equal(educationCheckpointModel(academy),null);
 for(const species of ['vargr','aezorgh']){const r=command(educationSetup('fallback-'+species,species),'precareer',{id:'core.university'});assert.equal(educationCheckpointModel(r),null);assert.equal(r.state.stage,'book-step');}
});

test('compact original-roll strip preserves faces without duplicating the event heading',()=>{
 for(const row of [2,10]){const model=educationCheckpointModel(eventFixture(row)),html=educationCheckpointView(model,helpers),strip=html.match(/<section class="education-checkpoint-record">(.*?)<\/section>/s)[1];assert.match(strip,/Recorded education event/);assert.doesNotMatch(strip,new RegExp(model.eventName));assert.equal((strip.match(/data-recorded-face=/g)||[]).length,2);assert.ok(html.includes('Event '+row+' · '+model.eventName));}
});

test('earlier evidence is read-only and internal selections are not presented as earned awards',()=>{
 for(const f of checkpointFixtures().filter(f=>['injury-roll','draft-roll','independence-failure','independence-success'].includes(f.label))){const model=educationCheckpointModel(f.result),html=educationCheckpointView(model,helpers),detail=html.match(/<details class="education-checkpoint-details">(.*?)<\/details>/s)[1];assert.doesNotMatch(detail,/data-action=/);assert.ok(html.indexOf('<details')>html.indexOf('data-action='));const lines=educationAppliedLines(model.appliedChanges).join(' ');assert.doesNotMatch(lines,/life-event-|graduationAllowed|selections/);if(f.label==='draft-roll')assert.match(lines,/Graduation is no longer permitted/);if(f.label==='independence-failure')assert.match(html,/No Independence skill was gained/);if(f.label.startsWith('independence'))assert.match(html,/Selected hobby: Independence/);}
});

test('real Life benefits, asset ownership and medical liabilities stay visible outside audit details',()=>{
 const fixtures=checkpointFixtures();
 for(const [label,expected] of [['life-9-benefit',/Qualification DM \+2.*next applicable check/],['life-10-benefit',/Benefit-roll bonus \+2 \(available; one use\)/],['artefact-result',/Owned asset: Alien Artefact · details pending/],['medical-bill-result',/Cr10000 personal bill \(unpaid/],['future-benefit-loss',/One future Benefit roll must be forfeited/],['conditional-psion-access',/Conditional Psion access at 1 completed term/]]){
  const r=fixtures.find(f=>f.label===label).result,model=educationCheckpointModel(r),html=educationCheckpointView(model,helpers),visible=html.slice(0,html.indexOf('<details'));
  assert.match(visible,expected,label);assert.doesNotMatch(visible,/life-event-\d|life-asset-|medical-\d/);assert.deepEqual(model.appliedChanges,r.educationEventView.appliedChanges);
 }
});
test('a pending equipment-description task is not presented as ownership; cash and debt retain exact amounts',()=>{
 const stateGroups=[{changes:[{path:'character.deferredEquipment.0',before:null,after:{name:'Alien Artefact',status:'pending'}}]}];
 const lines=educationAppliedLines([{changes:[{path:'cash',before:5000,after:0},{path:'debt',before:0,after:10000}]}],stateGroups).join(' ');assert.match(lines,/Cash: Cr5000 → Cr0/);assert.match(lines,/Debt: Cr0 → Cr10000/);assert.match(lines,/not an additional award/);assert.doesNotMatch(lines,/Owned asset/);
});

test('relationship conversion, narrative and removed modifiers are not new awards',()=>{
 const lines=educationAppliedLines([{changes:[{path:'relationships.0',before:{name:'Friend',role:'Ally'},after:{name:'Friend',role:'Enemy'}},{path:'lifeEvents.0',before:{decision:null},after:{decision:{kind:'narrative',outcome:'birth'}}}]}],[{changes:[{path:'modifiers.0',before:{target:'qualification',value:2},after:null}]}]).join(' ');assert.match(lines,/Friend: Ally → Enemy/);assert.match(lines,/A birth was recorded/);assert.match(lines,/modifier removed/);
});

test('empty audit disclosure is absent while nonempty recorded evidence remains available',()=>{
 for(const row of [2,4,6,7,10]){const model=educationCheckpointModel(eventFixture(row));assert.equal(model.childRolls.length,0);assert.equal(model.appliedChanges.length,0);assert.doesNotMatch(educationCheckpointView(model,helpers),/education-checkpoint-details/);}
 const model=educationCheckpointModel(eventStep(eventFixture(6),[5]));assert.match(educationCheckpointView(model,helpers),/education-checkpoint-details/);
});
