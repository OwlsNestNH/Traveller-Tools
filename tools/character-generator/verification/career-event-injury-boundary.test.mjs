import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingCareerEventReview} from '../engine/career-event-review.mjs';

for(const loss of [false,true])test(`completed NPC injury retains the mishap review boundary (loss choice: ${loss})`,()=>{
 const types=['survival-check','career-mishap','agent-person-injury-roll',...(loss?['agent-person-injury-loss']:[]),'agent-person-injury-continue'];
 const events=types.map(type=>({command:{type,payload:{}}}));
 const log=types.map((type,i)=>({type,id:`event-${i+1}`,number:i+1}));
 const state={stage:'term-end',active:0};
 const review=pendingCareerEventReview(state,log,events);
 assert.deepEqual(review,{id:log.at(-1).id,number:types.length,startNumber:2,actionNumbers:types.slice(1).map((_,i)=>i+2)});
 assert.equal(pendingCareerEventReview({...state,pending:{effect:{}}},log,events),null);
 assert.equal(pendingCareerEventReview({...state,acknowledgedCareerEventResult:review.id},log,events),null);
 const saved=JSON.stringify({state,log,events});
 pendingCareerEventReview(state,log,events);
 assert.equal(JSON.stringify({state,log,events}),saved);
});

import {readFileSync} from 'node:fs';
import {execute,project,exportSession,importSession,catalog} from '../engine/session.mjs';
import {careerEventReviewModel} from '../gui/career-event-review.mjs';
for(const role of ['contact','ally'])test(`actual ${role} injury preserves complete mishap boundary and normal injury UI`,()=>{
 const session=JSON.parse(readFileSync(new URL(`./fixtures/agent-${role}-injury-pending.json`,import.meta.url),'utf8'));
 const before=project(session),target=before.state.character.relationships.filter(p=>p.role.toLowerCase()===role).at(-1);
 let r=execute(session,{type:'agent-person-injury-roll',payload:{targetId:target.id}});
 assert.equal(r.careerEventReview,undefined,'Unfinished injury must not open a result review');
 if(r.state.character.otherPersonInjuries.at(-1).options.length){r=execute(r.session,{type:'agent-person-injury-loss',payload:{index:0}});assert.equal(r.careerEventReview,undefined);}
 r=execute(r.session,{type:'agent-person-injury-continue',payload:{}},{id:'finish-injury-boundary'});
 assert.ok(r.careerEventReview);
 const review=r.careerEventReview,events=review.actionNumbers.map(n=>r.log[n-1]);
 assert.ok(events.some(e=>e.type==='agent-person-injury-roll'));
 assert.equal(events.at(-1).type,'agent-person-injury-continue');
 assert.ok(review.effectEvent.eventResults.some(e=>e.table==='core.agent.mishaps'&&e.row===5));
 assert.deepEqual(review.effectEvent.rolls,events.flatMap(e=>e.rolls??[]));
 assert.equal(careerEventReviewModel(r,catalog()),null,'Agent injury must retain its approved UI, not borrow the Rogue betrayal popup');
 const raw=exportSession(r.session),reloaded=project(importSession(raw));
 assert.deepEqual(reloaded.careerEventReview,review);
 assert.equal(exportSession(reloaded.session??r.session),raw);
 assert.deepEqual(execute(r.session,{type:'agent-person-injury-continue',payload:{}},{id:'finish-injury-boundary'}).careerEventReview,review);
 assert.deepEqual(r.session.events.slice(0,session.events.length),session.events);
 for(const key of ['stats','injuries','cash','debt','medicalBills','relationships'])assert.deepEqual(r.state.character[key],before.state.character[key]);
});
