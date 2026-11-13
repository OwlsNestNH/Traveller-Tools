// Presentation-only detection of an active, already accepted academy award.
export function academyTrainingModel(state){
 const record=state?.character?.educations?.[state.education];
 if(!['effect-choice','skill-choice'].includes(state?.stage)||state.effectNext!=='education-event'||!['core.academy-army','core.academy-marine','core.academy-navy'].includes(record?.id)||record.completed||record.entry?.success!==true)return null;
 return {name:record.id.slice(13).replace(/^./,c=>c.toUpperCase())+' academy',kind:'academy-training',instruction:'Choose the required academy training skill at level 0. Your admission roll is already recorded.'};
}
