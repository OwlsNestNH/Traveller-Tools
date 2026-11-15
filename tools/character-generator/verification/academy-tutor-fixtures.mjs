import {educationSetup,forceEducation,command} from './education-result-fixtures.mjs';
export function academyTutorFixture(id='core.academy-army',seed='tutor-review'){
 let r=forceEducation(educationSetup(seed),'precareer',{id},[6,6]);
 while(r.state.stage==='effect-choice')r=command(r,'choose-effect',{index:1});
 r=command(r,'acknowledge-education-result');return forceEducation(r,'education-event',{},[5,5]);
}

export function academyTutorOutcomeFixture(id,success){for(let n=0;n<30;n++){const r=academyTutorFixture(id,'tutor-'+id+'-'+n),after=command(r,'education-check',{name:'Vacc Suit'});if((after.state.character.skills['Vacc Suit']===1)===success)return r;}throw Error('No natural tutor outcome fixture');}
