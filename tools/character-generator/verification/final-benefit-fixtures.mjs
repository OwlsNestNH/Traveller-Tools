import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
export function finalBenefitFixture({career='core.army',assignment='infantry',cash=false,die=5}={}){
 let r=settleAssignment(force(run(assignmentSetup('final-benefit-'+career),'skip-precareer'),'career',{id:career,assignment},[6,6]));
 if(r.state.stage==='preterm-commission')r=settleAssignment(run(r,'preterm-commission',{attempt:false}));
 r=force(r,'survival-check',{},[6,6]);r=settleAssignment(force(r,'career-event',{},[4,5]));r=settleAssignment(force(r,'advancement',{},[1,1]));r=run(r,'leave-career');
 while(r.state.character.careers[0].benefitRolls>1)r=settleAssignment(force(r,'benefit',{cash:false},[2]));
 return settleAssignment(force(r,'benefit',{cash},[die]));
}
