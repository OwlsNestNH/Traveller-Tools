import assert from 'node:assert/strict';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {aslanTemplateEntry} from './aslan-template-fixtures.mjs';
// Synthetic public command paths. Parent-table dice are explicitly recorded GM
// fixture choices; the final nested roll is an ordinary player command.
export function nestedResultFixture(id='core.drifter'){
 const assignments={'core.drifter':'barbarian','core.army':'cavalry','core.marine':'star','aslan.envoy':'duellist'};
 const assignment=assignments[id];assert.ok(assignment,'Known synthetic nested event route');
 let r=id==='aslan.envoy'?aslanTemplateEntry(id,assignment):settleAssignment(run(run(assignmentSetup(id==='core.drifter'?'nested-result-review':'nested-'+id),'skip-precareer'),'career',{id,assignment}));
 r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},id==='core.drifter'?[3,3]:[3,4]);
 assert.equal(r.state.stage,'borrowed-event-roll');
 const before=r,payload={pendingId:r.state.pendingBorrowedRoll.id};r=run(r,'roll-borrowed-event',payload);
 assert.equal(r.log.at(-1).type,'roll-borrowed-event');assert.ok(r.log.at(-1).eventResults.length>=2);
 return {before,result:r,payload};
}
