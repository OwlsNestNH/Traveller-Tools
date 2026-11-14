import assert from 'node:assert/strict';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
// Synthetic public commands only; the accepted final mishap is a natural roll.
export function forcedExitFixture(careerId='core.army',assignment='infantry'){
 for(let seed=0;seed<30;seed++){
  let r=run(assignmentSetup('forced-exit-clarity-'+careerId+'-'+seed),'skip-precareer');
  r=settleAssignment(force(r,'career',{id:careerId,assignment},[6,6]));
  if(r.state.stage==='preterm-commission')r=run(r,'preterm-commission',{attempt:false});
  r=settleAssignment(r);if(r.state.stage==='training')r=settleAssignment(force(r,'training',{table:'personal'},[1]));
  assert.equal(r.state.stage,'survival');r=force(r,'survival-check',{},[1,1]);assert.equal(r.state.stage,'career-mishap');
  r=run(r,'career-mishap');if(r.log.at(-1).eventResults?.[0]?.row!==2||r.state.stage!=='term-end'||!r.state.character.careers[r.state.active].forcedExit)continue;
  return r;
 }throw Error('No natural forced-exit mishap fixture for '+careerId);
}
