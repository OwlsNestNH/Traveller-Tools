// JTAS 11 p. 67 permits both Core and Vargr careers. Culture is an initial
// display grouping requested by the owner, not an eligibility restriction.
export const AEZORGH_CULTURES=Object.freeze(['imperial','vargr']);
export const aezorghCulture=character=>character?.species==='aezorgh'&&AEZORGH_CULTURES.includes(character.aezorghCulture)?character.aezorghCulture:null;
export function aezorghCareerGroup(state,selected){
 if(!aezorghCulture(state.character))return null;
 return AEZORGH_CULTURES.includes(selected)?selected:state.forcedCareer?.startsWith('vargr.')?'vargr':state.forcedCareer?.startsWith('core.')?'imperial':aezorghCulture(state.character);
}
export function aezorghCareerChoices(state,group){
 const chosen=aezorghCareerGroup(state,group);
 return chosen?(state.careerChoices??[]).filter(c=>!c.id.startsWith(chosen==='imperial'?'vargr.':'core.')):state.careerChoices;
}
export const cultureIdentity=character=>aezorghCulture(character)==='vargr'?'Vargr culture':aezorghCulture(character)==='imperial'?'Imperial culture':character?.culture==='imperial'?'Imperial upbringing':null;
