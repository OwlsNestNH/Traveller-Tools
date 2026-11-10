// Companion awards at level zero accept base skills only. University study
// subjects use a separate workflow and retain their graduation specialities.
export function companionSkillSuggestions(state,catalog) {
 const choices=state.educationOptions.flatMap(o=>state.pendingChoice.value===0?[o.name.split(' (')[0]]:o.name.includes(' (')?[o.name]:[o.name,...(catalog.skillSpecialities[o.name]??[]).map(s=>o.name+' ('+s+')')]);
 return [...new Set(choices)];
}
export function educationSkillTitle(state) {
 return state.stage==='education-skill'&&state.pendingChoice?.selectionId==='hobby'?'Choose your hobby skill':null;
}
// Presentation only: retain the existing education commands and saved selections.
export function educationSubjects(state) {
 const selected=state.character.educations?.[state.education]?.selections??{};
 const used=new Set(Object.entries(selected).filter(([id])=>id.startsWith('university-')).map(([,name])=>name.split(' (')[0]));
 return state.educationOptions.filter(o=>!state.pendingChoice.selectionId.startsWith('university-')||!used.has(o.name));
}
export function educationSpecialities(state,catalog,base) {
 const option=educationSubjects(state).find(o=>o.name===base);
 if(!option||state.pendingChoice.selectionId==='hobby')return [];
 const choices=Array.isArray(option.specialities)?option.specialities:catalog.skillSpecialities?.[base];
 return (choices??[]).map(s=>base+' ('+s+')');
}
export function educationSkillView(state,catalog,esc,button) {
 const e=state.pendingChoice,hobby=e.selectionId==='hobby',step=e.selectionId==='university-0'?1:e.selectionId==='university-1'?2:null;
 return (step?'<h3>University skill '+step+' of 2: level '+e.value+'</h3><p>Choose two different skills: the first at level 0, the second at level 1.</p>':hobby?'<h3>Pre-career event 9: hobby skill</h3><p>Choose any allowed skill except Jack-of-all-Trades at level 0. This event applies to every pre-career path; it is not a University study award.</p>':'<h3>Study skill: level '+e.value+'</h3>')+
 '<label>'+(hobby?'Hobby skill':'Study subject')+'<select id="education-subject"><option value="">Choose a skill</option>'+educationSubjects(state).map(o=>'<option value="'+esc(o.name)+'">'+esc(o.name)+'</option>').join('')+'</select></label>'+
 '<p class="help" id="education-speciality-help">'+(hobby?'Choose a base skill. No specialisation is needed at level 0.':'Choose a subject to see its allowed specialisations.')+'</p><label>'+(hobby?'Hobby skill':'Study skill or specialisation')+'<input id="education-skill" list="education-skills" maxlength="80" autocomplete="off"></label><datalist id="education-skills"></datalist>'+button(hobby?'Record hobby skill':step===1?'Record level 0 and choose level 1':'Record study skill','education-skill');
}
export function syncEducationSubject(state,catalog,root,esc) {
 const base=root.querySelector('#education-subject').value,input=root.querySelector('#education-skill');
 const specialised=state.pendingChoice.selectionId!=='hobby'&&Object.hasOwn(catalog.skillSpecialities??{},base);
 const names=educationSpecialities(state,catalog,base);
 input.value=specialised?'':base;
 input.placeholder=specialised?base+' (speciality)':'';
 root.querySelector('#education-skills').innerHTML=names.map(name=>'<option value="'+esc(name)+'"></option>').join('');
 root.querySelector('#education-speciality-help').textContent=!base?(state.pendingChoice.selectionId==='hobby'?'Choose a base skill. No specialisation is needed at level 0.':'Choose a subject to see its allowed specialisations.'):specialised?(names.length?'Choose one of these '+base+' specialisations: '+names.join(', ')+'.':'Enter your '+base+' subject in parentheses, for example '+base+' (your subject).')+(state.pendingChoice.value===0?' The award is level 0; this subject is retained for a successful graduation.':''):'This award uses the base skill; no specialisation is needed.';
}
