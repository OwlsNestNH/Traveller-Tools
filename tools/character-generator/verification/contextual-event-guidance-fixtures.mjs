import {pendingEventFixture} from './pending-event-clarity-fixtures.mjs';
import {run} from './assignment-fixtures.mjs';
let cached;
export function contextualGuidanceFixtures(){
 if(cached)return structuredClone(cached);
 const specialist=pendingEventFixture('core.agent','law',6),failure=pendingEventFixture('core.agent','corporate',6);
 const check=r=>run(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id});
 cached=[
  {name:'vehicle-choice',fixture:pendingEventFixture('core.agent','law',10)},
  {name:'specialist-check',fixture:specialist},
  {name:'specialist-success',fixture:check(specialist)},
  {name:'specialist-failure',fixture:check(failure)},
  {name:'undercover-result',fixture:run(pendingEventFixture('core.agent','law',8),'cross-career-cover-check',{careerId:'core.citizen'})}
 ];return structuredClone(cached);
}
