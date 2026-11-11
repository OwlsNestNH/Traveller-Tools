// Shared presentation shell for species choices. Only Aezorgh opts in today.
export function speciesSkillPopupView(state,selection,{esc}){
 const options=[...selection.options].sort((a,b)=>a.localeCompare(b));
 return '<p>Choose your Aezorgh skill to continue.</p><dialog id="species-skill-dialog" class="species-skill-dialog" aria-labelledby="species-skill-title" aria-describedby="species-skill-granted"><h2 id="species-skill-title">Choose your Aezorgh skill</h2><p id="species-skill-granted">Granted: Athletics 0 · Mechanic 0 · Recon 0 · Stealth 0</p><p>Choose one more skill at level 0.</p><form id="background-form"><label for="species-skill-search">Search skills</label><input id="species-skill-search" type="search" autocomplete="off" placeholder="Find a skill" autofocus><fieldset class="species-skill-options"><legend class="species-skill-legend">Available skills</legend>'+options.map((name,i)=>'<label class="background-tile'+(selection.skills.includes(name)?' is-selected':'')+'"><input id="background-skill-'+i+'" type="radio" name="skills" value="'+esc(name)+'"'+(selection.skills.includes(name)?' checked':'')+'><span>'+esc(name)+'</span></label>').join('')+'</fieldset><p id="species-skill-empty" hidden>No matching skills.</p><div class="species-skill-footer"><p id="background-selected-summary" aria-live="polite">'+(selection.skills.length?esc(selection.skills[0])+' 0 selected':'No skill selected')+'</p><button type="submit"'+(selection.valid?'':' disabled')+'>Confirm</button></div><span id="background-count" hidden></span><span id="background-status" hidden></span><p id="species-skill-error" role="alert"></p></form></dialog>';
}
export function mountSpeciesSkillPopup(root){
 const dialog=root.querySelector('#species-skill-dialog');if(!dialog)return;
 // This is a required step, not a dismissible information panel. Escape leaves
 // the choice untouched, and native modal semantics keep the base screen inert.
 dialog.addEventListener('cancel',event=>event.preventDefault());
 const search=dialog.querySelector('#species-skill-search');
 search.addEventListener('input',()=>{
  const query=search.value.trim().toLocaleLowerCase();let count=0;
  for(const label of dialog.querySelectorAll('.background-tile')){label.hidden=!label.textContent.toLocaleLowerCase().includes(query);if(!label.hidden)count++;}
  dialog.querySelector('#species-skill-empty').hidden=count!==0;
 });
 dialog.showModal();
}
