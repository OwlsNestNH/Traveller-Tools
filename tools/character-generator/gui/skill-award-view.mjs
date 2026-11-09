// All finite options come from the engine's already-filtered award projection.
export function awardBases(state){
 const names=state.skillChoiceSuggestions??[];
 return [...new Set([...names,...(state.pendingChoice.allowed??[])].map(n=>n.split(' (')[0]))];
}
export function awardNames(state,base){return (state.skillChoiceSuggestions??[]).filter(n=>n.split(' (')[0]===base);}
export function skillAwardView(state,catalog,{esc,button,sourceLabel,skillChoiceProgress}){
 const c=state.pendingChoice,bases=awardBases(state),base=bases.length===1?bases[0]:'';
 return (c.source?'<p class="source">'+esc(sourceLabel(c.source.id,c.source.page))+'</p>':'')+(c.tableSkills?'<p id="training-award-options">Eligible skills: '+c.tableSkills.map(esc).join(', ')+'.</p>':'')+skillChoiceProgress(c,esc)+'<p>'+esc(c.label??'Choose the skill awarded by this result.')+'</p>'+(c.deferSpeciality?'<p class="help">Choose a base skill to keep its specialisation for finalization, or choose a specialisation now.</p>':c.allocationId?'<p class="help">Allocate this recorded award to one specialisation. Each award is kept separately so you can split them.</p>':'')+
 '<label>Skill<select id="award-base"><option value="">Choose a skill</option>'+bases.map(n=>'<option value="'+esc(n)+'" '+(n===base?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label><div id="award-speciality-controls"></div><datalist id="award-skill-options"></datalist><label>Complete skill name (optional)<input id="award-skill" list="award-skill-options" maxlength="80" autocomplete="off"></label>'+button('Accept skill','choose-skill')+button('Resolve this award from the source','skill-award-source','quiet');
}
export function syncAwardBase(state,catalog,root,esc){
 const base=root.querySelector('#award-base')?.value;if(base===undefined)return;
 const names=awardNames(state,base),specialised=Object.hasOwn(catalog.skillSpecialities??{},base),open=specialised&&catalog.skillSpecialities[base]===null;
 const deferred=state.pendingChoice.deferSpeciality&&names.includes(base);
 root.querySelector('#award-speciality-controls').innerHTML=specialised&&base?'<label>'+esc(base)+' specialisation<select id="award-speciality"><option value="">Choose a specialisation'+(deferred?' or defer':'')+'</option>'+names.filter(n=>n!==base||deferred).map(n=>'<option value="'+esc(n)+'">'+esc(n===base?'Choose specialisation at finalization':n)+'</option>').join('')+'</select></label>'+(open?'<p class="help">Enter your '+esc(base)+' subject in parentheses in the field below.</p>':''):'';
 root.querySelector('#award-skill-options').innerHTML=names.map(n=>'<option value="'+esc(n)+'"></option>').join('');
 root.querySelector('#award-skill').value=names.includes(base)?base:'';
 root.querySelector('#award-skill').placeholder=base?(specialised?base+' (speciality)':base):'Choose a skill above';
 if(deferred)root.querySelector('#award-speciality').value=base;
}
export function deferredAwardsView(state,{esc,button}){
 const pending=(state.character.deferredSkillAwards??[]).filter(a=>a.status==='pending');
 if(!pending.length)return '';
 return '<section aria-label="Pending specialisations"><h3>Specialisations to allocate</h3><p>Each award is preserved separately until you choose its specialisation.</p><ul>'+pending.map(a=>'<li>'+esc(a.name)+' '+esc(a.mode==='set'?'level '+a.value:'+'+a.value)+'</li>').join('')+'</ul>'+(state.specializationOptions?.available?button('Allocate specializations now','allocate-specializations','quiet'):'<p class="help">Continue this step to reach an allocation checkpoint.</p>')+'</section>';
}
