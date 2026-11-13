// Explicit scenario step for completed .31 event results. This never rolls or
// skips choices, and leaves old revisions and uncompleted events untouched.
import assert from 'node:assert/strict';
import {execute} from '../engine/session.mjs';
export function acknowledgeEducationEvent(r){
 if(r.state.stage!=='education-event-result')return r;
 assert.equal(r.state.educationEventCheckpoints,true);
 const next=execute(r.session,{type:'acknowledge-education-event',payload:{pendingId:r.state.educationEventResult.id}});
 assert.equal(next.state.stage,r.state.educationEventResult.nextStage);assert.equal(next.state.rng,r.state.rng);assert.deepEqual(next.state.character,r.state.character);assert.deepEqual(next.state.pending,r.state.pending);assert.equal(next.log.at(-1).rolls.length,0);
 return next;
}
