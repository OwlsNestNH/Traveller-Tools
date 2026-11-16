// Separate course access: a score alone (including a GM-entered score) is not permission.
export function separateTrainingPermission(state){
 if(state.config.psiTestingWithoutEvent===true)return {allowed:true,source:'gm-house-option'};
 if(state.character.psionEntryPermission===true)return {allowed:true,source:'event-permission'};
 // Core p.46's next-term restriction concerns Psion career entry, not the p.228 course.
 if(state.character.lifePsionAccess)return {allowed:true,source:'life-event'};
 if(state.character.psionics?.tests?.some(t=>t.context==='source-event'))return {allowed:true,source:'source-event'};
 return {allowed:false,source:null};
}
