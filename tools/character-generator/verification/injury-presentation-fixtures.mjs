import{assignmentSetup,run,force,settleAssignment}from'./assignment-fixtures.mjs';
// Actual Noble event 3: accepted duel, failed check, injury, then SOC loss.
export function nobleInjuryTreatmentFixture(){
 let r=settleAssignment(run(run(assignmentSetup('noble-duel-treatment',11),'skip-precareer'),'career',{id:'core.noble',assignment:'administrator'}));r=force(r,'survival-check',{},[6,6]);r=force(r,'career-event',{},[1,2]);r=run(r,'choose-effect',{index:1});
 for(const values of[[1,1],[1],[4]])r=force(r,'roll-borrowed-event',{pendingId:r.state.pendingBorrowedRoll.id},values);
 r=run(r,'injury-loss',{index:0});return run(r,'injury-treatment',{restore:r.state.injuryRestorable,inService:false});
}
