import {skillKnowledgeLabel} from './skill-knowledge.mjs';
// All finite options come from the engine's already-filtered award projection.
export function awardBases(state){
 const names=state.skillChoiceSuggestions??[];
 if(state.skillChoiceBases)return [...state.skillChoiceBases];
 return [...new Set([...names,...(state.pendingChoice.allowed??[])].map(n=>n.split(' (')[0]))];
}
export function awardNames(state,base){return (state.skillChoiceSuggestions??[]).filter(n=>n.split(' (')[0]===base);}
export function skillAwardView(state,catalog,{esc,button,sourceLabel,skillChoiceProgress}){
 const c=state.pendingChoice,bases=awardBases(state),base=bases.length===1?bases[0]:'';
 return (c.source?'<p class="source">'+esc(sourceLabel(c.source.id,c.source.page))+'</p>':'')+(c.tableSkills?'<p id="training-award-options">Eligible skills: '+c.tableSkills.map(n=>esc(skillKnowledgeLabel(n,state.character?.skills))).join(', ')+'.</p>':'')+skillChoiceProgress(c,esc)+'<p>'+esc(c.label??'Choose the skill awarded by this result.')+'</p>'+(c.deferSpeciality?'<p class="help">Choose a base skill to keep its specialisation for finalization, or choose a specialisation now.</p>':c.allocationId?'<p class="help">Allocate this recorded award to one specialisation. Each award is kept separately so you can split them.</p>':'')+
 '<label>Skill<select id="award-base"><option value="">Choose a skill</option>'+bases.map(n=>'<option value="'+esc(n)+'" '+(n===base?'selected':'')+'>'+esc(skillKnowledgeLabel(n,state.character?.skills))+'</option>').join('')+'</select></label><p id="award-known-status" class="help" hidden></p><div id="award-speciality-controls"></div><datalist id="award-skill-options"></datalist><label id="award-custom-field" hidden>Custom specialisation<input id="award-skill" list="award-skill-options" maxlength="80" autocomplete="off"></label>'+button('Accept skill','choose-skill')+button('Resolve this award from the source','skill-award-source','quiet');
}
export function syncAwardBase(state,catalog,root,esc){
 const base=root.querySelector('#award-base')?.value;if(base===undefined)return;
 const names=awardNames(state,base),specialised=Object.hasOwn(catalog.skillSpecialities??{},base);
 const deferred=specialised&&state.pendingChoice.deferSpeciality&&names.includes(base);
 root.querySelector('#award-speciality-controls').innerHTML=specialised&&base?'<label>'+esc(base)+' specialisation<select id="award-speciality"><option value="">Choose a specialisation'+(deferred?' or defer':'')+'</option>'+names.filter(n=>n!==base||deferred).map(n=>'<option value="'+esc(n)+'">'+esc(n===base?'Choose specialisation at finalization':skillKnowledgeLabel(n,state.character?.skills))+'</option>').join('')+'<option value="__custom__">Custom</option></select></label>':'';
 root.querySelector('#award-skill-options').innerHTML=names.map(n=>'<option value="'+esc(n)+'" label="'+esc(skillKnowledgeLabel(n,state.character?.skills))+'"></option>').join('');
 root.querySelector('#award-skill').value=names.includes(base)?base:'';
 root.querySelector('#award-skill').placeholder=base?'Your '+base+' specialisation':'Choose a skill above';
 if(deferred)root.querySelector('#award-speciality').value=base;
 const custom=root.querySelector('#award-custom-field');if(custom)custom.hidden=true;
 const known=root.querySelector('#award-known-status'),label=skillKnowledgeLabel(base,state.character?.skills);if(known){known.textContent=label!==base?label:'';known.hidden=label===base;}
}
export function syncAwardSpeciality(root){
 const select=root.querySelector('#award-speciality'),input=root.querySelector('#award-skill'),field=root.querySelector('#award-custom-field');if(!input||!field)return;
 const custom=select?.value==='__custom__';field.hidden=!custom;input.value=custom?'':select?.value??root.querySelector('#award-base')?.value??'';
}
export function chosenAwardSkill(root){
 const base=root.querySelector('#award-base')?.value??'',select=root.querySelector('#award-speciality');
 if(!select)return base;
 if(select.value!=='__custom__')return select.value;
 const text=root.querySelector('#award-skill')?.value.trim()??'';if(!text)return '';
 // Complete names remain accepted for older manual workflows. Ordinary Custom
 // entry supplies a subject; the engine still validates the complete name.
 if(text.includes(' ('))return text.startsWith(base+' (')?text:'';
 return base+' ('+text+')';
}
export function deferredAwardsView(state,{esc,button,awardSource=()=>null}){
 const pending=(state.character.deferredSkillAwards??[]).filter(a=>a.status==='pending');
 if(!pending.length)return '';
 return '<section aria-label="Pending specialisations"><h3>Specialisations to allocate</h3><p>Each award is preserved separately until you choose its specialisation.</p><ul>'+pending.map(a=>'<li>'+esc(a.name)+' '+esc(a.mode==='set'?'level '+a.value:'+'+a.value)+(awardSource(a)?'<span class="deferred-award-source">'+esc(awardSource(a))+'</span>':'')+'</li>').join('')+'</ul>'+(state.specializationOptions?.available?button('Allocate specializations now','allocate-specializations','quiet'):'<p class="help">Continue this step to reach an allocation checkpoint.</p>')+'</section>';
}
