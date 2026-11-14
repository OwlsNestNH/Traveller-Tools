import {educationSetup,forceEducation,command} from './education-result-fixtures.mjs';
export function failedAcademyPrank(){
 let r=forceEducation(educationSetup('prank-prison-27'),'precareer',{id:'core.academy-army'},[6,6]);
 while(r.state.stage==='effect-choice')r=command(r,'choose-effect',{index:0});
 r=command(r,'acknowledge-education-result');r=command(r,'gm-override',{field:'stat.SOC',value:3,reason:'Synthetic prank check boundary'});
 return command(r,'education-event');
}
