import {educationSetup} from './education-result-fixtures.mjs';
import {assignmentSetup,run} from './assignment-fixtures.mjs';
export function supportThemeFixtures(){
 let admission=run(educationSetup('support-theme-companion'),'gm-override',{field:'stat.SOC',value:6,reason:'Synthetic source-eligible theme review'});
 admission=run(admission,'precareer',{id:'companion.hard-knocks'});
 const skills=run(admission,'companion-entry');
 let psi=run(assignmentSetup('support-theme-psi'),'skip-precareer');
 psi=run(psi,'gm-psi-testing',{enabled:true});
 psi=run(psi,'test-psionic-potential',{accessConfirmed:true,timingConfirmed:true,funding:'provided',cost:0,providedConfirmed:true,reason:'Synthetic teacher and two-week testing interval'});
 if(psi.state.stage!=='psionic-training'){
  psi=run(psi,'begin-psionic-training');
  psi=run(psi,'resolve-book',{confirmed:true,note:'Synthetic provided institute course approved for this timeline.',psionicApproved:true,psionicTimingConfirmed:true,psionicFunding:'provided',psionicCost:0});
 }
 return [['companion-admission',admission],['companion-skill',skills],['psionic-training',psi]];
}
