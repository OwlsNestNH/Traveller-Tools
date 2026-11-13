// Synthetic scenarios only. Never import a player's log or character here.
import {assignmentSetup,buildAssignmentFixture,settleAssignment,run,force} from './assignment-fixtures.mjs';
export {run,force};
export function eventCheckpointFixture(id='core.army',row=8){
 const assignment={'core.army':'infantry','core.navy':'crew','core.scout':'courier'}[id];
 for(let seed=0;seed<100;seed++){
  let r=run(assignmentSetup('native-event-checkpoint-'+id+'-'+seed),'skip-precareer');r=settleAssignment(force(r,'career',{id,assignment},[6,6]));r=force(r,'survival-check',{},[6,6]);r=run(r,'career-event');
  if(r.log.at(-1).rolls[0]?.total===row)return r;
 }throw Error('No synthetic natural event row for '+id);
}
export function laterBasicFixture(){
 let r=run(buildAssignmentFixture(),'leave-career');
 while(r.state.stage==='benefits')r=force(r,'benefit',{cash:true},[1]);
 r=run(r,'gm-override',{field:'stat.SOC',value:10,reason:'Synthetic automatic Noble entry.'});return run(r,'career',{id:'core.noble',assignment:'dilettante'});
}
export function requiredAwardFixture(){
 let r=run(assignmentSetup('required-rank-award'),'skip-precareer');r=force(r,'career',{id:'core.army',assignment:'infantry'},[6,6]);
 r=run(r,'choose-effect',{index:1});return run(r,'skill-award-source');
}
