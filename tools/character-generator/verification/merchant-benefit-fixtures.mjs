import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
export function merchantBenefitFixture(){
 let r=run(assignmentSetup('merchant-benefit-10'),'skip-precareer');
 r=settleAssignment(force(r,'career',{id:'core.merchant',assignment:'broker'},[6,6]));
 const before=force(r,'survival-check',{},[6,6]);
 return {before,after:run(before,'career-event')};
}
