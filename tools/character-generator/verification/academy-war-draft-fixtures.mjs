import {project}from'../engine/session.mjs';
import {educationSetup,forceEducation,command}from'./education-result-fixtures.mjs';
export function ready(id='core.academy-army',seed='academy-war-audit-4',rulesRevision){
 let r=educationSetup(seed);if(rulesRevision){r.session.rulesRevision=rulesRevision;r={session:r.session,...project(r.session)};}r=forceEducation(r,'precareer',{id},[6,6]);while(r.state.stage==='effect-choice')r=command(r,'choose-effect',{index:0});return r.state.stage==='education-result'?command(r,'acknowledge-education-result'):r;
}
export function war(id='core.academy-army',modern=true){return forceEducation(ready(id),'education-event',modern?{separateAcademyWarRolls:true}:{},[5,6]);}
