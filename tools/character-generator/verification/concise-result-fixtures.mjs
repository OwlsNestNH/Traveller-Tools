import {optionalBenefitFixture} from './optional-benefit-fixtures.mjs';
import {sourceCheckFixture} from './source-check-fixtures.mjs';
import {run} from './core-life-event-fixtures.mjs';
import {api} from '../engine/session.mjs';
import {aslanSetup,force,settle} from './aslan-officer-fixtures.mjs';
export {run};
export function failedSurvivalFixture(){
 const before=settle(force(aslanSetup('concise-survival-9'),'career',{id:'aslan.military',assignment:'warrior'},[6,6]));
 return {before,after:run(before,'survival')};
}
export function laterCareerFixture(){
 let before=optionalBenefitFixture();while(before.state.stage==='benefits')before=run(before,'benefit',{cash:true});
 return {before,after:run(before,'career',{id:'core.rogue',assignment:'thief'})};
}
export function treatmentFixture(){
 let before=sourceCheckFixture({career:'vargr.intermediary',assignment:'arbitrator'});
 before=run(before,'choose-effect',{index:0});before=run(before,'gm-replay',{revision:before.revision,rollIndex:0,values:[1,1],reason:'Synthetic treatment display'});
 before=run(before,'injury-loss',{index:0});before=run(before,'injury-treatment',{restore:before.state.injuryRestorable,inService:true});
 return {before,after:run(before,'resolve-book',{confirmed:true,note:'Synthetic treatment ruling.',medicalCoveredCost:0,effects:[]})};
}
export function equipmentFixture(){
 let before=api({operation:'create',seed:'benefit-public-4'});
 for(const [type,payload] of [['setup',{species:'human',name:'Synthetic display test'}],['roll-statistics',{}],['accept-statistics',{}],['background',{skills:['Admin','Animals','Art']}],['skip-precareer',{}],['career',{id:'core.scout',assignment:'courier'}],['choose-effect',{index:0}],['survival',{}],['choose-effect',{index:0}],['advancement',{}],['training',{table:'service'}],['leave-career',{}],['gm-mode',{enabled:true}],['benefit',{cash:false}]])before=run(before,type,payload);
 before=run(before,'gm-replay',{revision:before.revision,rollIndex:0,values:[4],reason:'Synthetic equipment display'});
 before=run(before,'review-equipment');before=run(before,'choose-deferred-equipment',{id:'equipment-1'});
 return {before,after:run(before,'resolve-book',{confirmed:true,note:'Synthetic equipment ruling.',benefitItemName:'Synthetic weapon',benefitItemCost:2500,benefitItemTL:10,benefitWeaponSkill:'Gun Combat (slug)'})};
}
