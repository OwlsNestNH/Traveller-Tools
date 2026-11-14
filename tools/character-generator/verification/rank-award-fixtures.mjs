import assert from'node:assert/strict';
import {assignmentSetup,run,force,settleAssignment} from './assignment-fixtures.mjs';
import {graduationFixture} from './education-result-fixtures.mjs';
export {run,force};
export function armyEntryAward(seed='rank-award-entry'){
 return settleEffects(force(run(assignmentSetup(seed),'skip-precareer'),'career',{id:'core.army',assignment:'infantry'},[6,6]));
}
export function settleEffects(r){while(r.state.stage==='effect-choice')r=run(r,'choose-effect',{index:0});return r;}
export function academyCommissionOffer(id='core.academy-army',outcome='honours'){
 return run(run(graduationFixture(id,outcome),'acknowledge-education-result'),'career',{id:id.replace('academy-',''),assignment:id.endsWith('navy')?'crew':'support'});
}
export function armyAcademyAwards(accepted=false){
 let r=settleEffects(run(academyCommissionOffer(),'preterm-commission',{attempt:accepted}));
 r=run(r,'education-service',{name:'Gun Combat'});r=run(r,'choose-skill',{name:'Gun Combat (slug)'});
 r=run(r,'education-service',{name:'Recon'});return run(r,'education-service',{name:'Vacc Suit'});
}
export function armyCommissionEvent(){
 let r=settleAssignment(armyEntryAward('rank-commission-natural-45'));r=force(r,'survival-check',{},[6,6]);
 r=run(r,'career-event');assert.equal(r.log.at(-1).rolls[0].total,12,'Stable natural offer fixture');return r;
}
