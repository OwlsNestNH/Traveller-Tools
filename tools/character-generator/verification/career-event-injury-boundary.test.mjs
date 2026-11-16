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
