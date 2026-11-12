import test from 'node:test';
import assert from 'node:assert/strict';
import {educationEventText} from '../engine/education-event-projection.mjs';
import {eventNarrative} from '../engine/event-narratives.mjs';
import {eventEffectSummary} from '../engine/event-effect-summary.mjs';
import {PRECAREER_EVENTS} from '../engine/education-pack.mjs';
import {educationCheckpointModel,educationCheckpointView,educationEventStoryView} from '../gui/education-event-checkpoint-view.mjs';
import {educationReady,forceEducation,command} from './education-result-fixtures.mjs';
import {eventFixture,eventStep} from './education-event-gui-fixtures.mjs';
import {exportSession,project} from '../engine/session.mjs';
const helpers={esc:String,sourceLabel:(id,page)=>id+' p. '+page};
const render=r=>educationCheckpointView(educationCheckpointModel(r),helpers);
test('all eleven Pre-Career rows retain their complete available narrative and rule description',()=>{
 for(let row=2;row<=12;row++){
  const r=eventFixture(row),before=exportSession(r.session),text=educationEventText(row);
  assert.equal(text.description,eventNarrative('core.pre-career-events',row));assert.equal(text.summary,eventEffectSummary(PRECAREER_EVENTS[row]));
  const model=educationCheckpointModel(r),html=model?render(r):educationEventStoryView(r.educationEventContext,helpers);
  assert.ok(html.includes(text.description),'Narrative '+row);assert.ok(html.includes('<strong>Event rules:</strong> '+text.summary),'Labelled event rules '+row);assert.doesNotMatch(html,/<pre>|\"character\":|\"actionId\":|\"changes\":/);
  assert.equal(exportSession(r.session),before);
 }
 assert.equal(educationEventText(8).name,'Political movement');assert.equal(educationEventText(11).name,'War and the draft');assert.equal(educationEventText(99),null);
});
test('political movement is explained identically before and after the actual check; failure is not a missing result',()=>{
 const pending=eventFixture(8),failed=eventStep(pending,[1,1]),success=eventStep(pending,[6,6]);
 for(const r of [pending,failed,success]){const html=render(r);assert.match(html,/Political movement/);assert.match(html,/You become active in a political movement\./);assert.match(html,/On success: Gain 1 Ally\. Gain 1 Enemy\. On failure: No automatic mechanical effect\./);assert.doesNotMatch(html,/Social connections|<pre>|Full recorded changes/);}
 assert.match(render(failed),/You gain neither an Ally nor an Enemy/);assert.match(render(success),/Ally:/);assert.match(render(success),/Enemy:/);
});
test('Life and Unusual child rolls show their own available stories and consequences',()=>{
 const life=eventStep(eventFixture(7),[6,6]),unusual=eventStep(life,[3]);
 for(const r of [life,unusual]){const child=r.educationEventView.childRolls.at(-1);assert.ok(child.eventDescription);assert.ok(child.eventSummary);const html=render(r);assert.ok(html.includes(child.eventDescription));assert.ok(html.includes('<strong>Event rules:</strong> '+child.eventSummary));assert.doesNotMatch(html,/>core\./);}
});
test('public recognition at capped SOC visibly reports the actual Ship Share replacement award',()=>{
 let r=command(educationReady(),'gm-override',{field:'stat.SOC',value:15,reason:'Synthetic SOC cap review'});r=forceEducation(r,'education-event',{},[6,6]);
 const html=render(r);
 assert.match(html,/<p class="education-event-possible"><strong>Event rules:<\/strong> SOC \+1\.<\/p>/);
 const applied=html.match(/<section class="education-checkpoint-applied">([\s\S]*?)<\/section>/)?.[1];
 assert.ok(applied);assert.match(applied,/<h4>Applied results<\/h4>/);assert.match(applied,/Benefit: Ship Share × 1/);assert.doesNotMatch(applied,/SOC/);
 assert.match(html,/Your inventive approach to study earns public recognition/);
});
test('legacy active education receives readable context without changing saved rules, state or log',()=>{
 for(const row of [2,9,10]){const ready=educationReady(),session={...ready.session,rulesRevision:'character-preview-2026-11-09.30'},r=forceEducation({session,...project(session)},'education-event',{},[Math.max(1,row-6),Math.min(6,row-1)]),before=exportSession(r.session),state=structuredClone(r.state),log=structuredClone(r.log);
  assert.equal(r.educationEventView,undefined);assert.equal(r.educationEventContext.description,eventNarrative('core.pre-career-events',row));educationEventStoryView(r.educationEventContext,helpers);assert.deepEqual(project(r.session).state,state);assert.deepEqual(project(r.session).log,log);assert.equal(exportSession(r.session),before);
 }
});
