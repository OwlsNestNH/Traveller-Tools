// Presentation state only; eligibility and allowance always come from the engine.
export function backgroundSelection(state, selected=[]) {
 const options=[...new Set(state.backgroundOptions??[])].filter(name=>!Object.hasOwn(state.character.skills,name));
 const skills=[...new Set(selected)].filter(name=>options.includes(name)),required=state.backgroundRemaining;
 return {options,skills,required,remaining:required-skills.length,valid:skills.length===selected.length&&state.stage==='background'&&Number.isInteger(required)&&required>=0&&skills.length===required};
}
export function backgroundDraftKey(session,state){
 if(state.stage!=='background')return null;
 const checkpoint=(session.events??[]).filter(e=>['restore','gm-replay'].includes(e.command?.type)).at(-1)?.id??'';
 return JSON.stringify([session.seed,session.rulesRevision,checkpoint]);
}
export function reconcileBackgroundDraft(draft,key,state){return {key,skills:key===null?[]:backgroundSelection(state,draft?.key===key?draft.skills:[]).skills};}
export function backgroundPreview(skills,{esc}){
 return '<h3>Selected, not yet recorded</h3>'+(skills.length?'<ul class="background-chips">'+skills.map(name=>'<li>'+esc(name)+' <strong>0</strong></li>').join('')+'</ul>':'<p class="help">Select skills to preview them here.</p>')+'<p class="background-pending-note">Recorded when you accept.</p>';
}
export function backgroundStatus(s){return s.remaining<0?'Remove '+(-s.remaining)+' to continue.':s.remaining>0?'Choose '+s.remaining+' more':'Ready to accept.';}
export function backgroundSummary(skills){return skills.length?'Selected: '+skills.map(name=>name+' 0').join(' · '):'No skills selected yet.';}
export function backgroundSkillsView(state,selected,catalog,{esc}){
 const s=backgroundSelection(state,selected);
 return '<p class="background-instruction">Choose '+s.required+' skills. Each begins at level 0.</p><form id="background-form"><div class="background-counter" role="status" aria-live="polite" aria-atomic="true"><strong id="background-count">'+s.skills.length+' / '+s.required+' selected</strong><span id="background-status">'+backgroundStatus(s)+'</span></div><fieldset class="background-options"><legend>Available skills</legend><div class="background-grid">'+s.options.map((name,i)=>'<label class="background-tile'+(s.skills.includes(name)?' is-selected':'')+'"><input id="background-skill-'+i+'" type="checkbox" name="skills" value="'+esc(name)+'" '+(s.skills.includes(name)?'checked':'')+'><span>'+esc(name)+'</span></label>').join('')+'</div></fieldset><p id="background-selected-summary">'+esc(backgroundSummary(s.skills))+'</p><div class="actions"><button type="submit" '+(s.valid?'':'disabled')+'>Accept background skills</button></div></form>';
}
export function backgroundRailView(state,selected,catalog,{esc}){
 const c=state.character,species=catalog.species.find(x=>x.id===c.species)?.name??c.species,context=[species,c.culture?c.culture+' upbringing':'',c.gender].filter(Boolean).join(' · ');
 return '<p class="background-eyebrow">Selection preview</p><h2>'+esc(c.name||'Your Traveller')+'</h2><p class="background-context">'+esc(context)+'</p><p class="background-identity">Age '+esc(c.age)+' · EDU '+esc(c.stats.EDU??'—')+'</p><section class="background-allowance"><h3>Background allowance</h3><p>'+state.backgroundRemaining+' choices · each at level 0</p></section><section id="background-preview">'+backgroundPreview(selected,{esc})+'</section>';
}
export function syncBackgroundSkills(root,state,selected,{esc},busy=false){
 const s=backgroundSelection(state,selected),form=root.querySelector('#background-form');if(!form)return s;
 for(const input of form.querySelectorAll('[name="skills"]')){input.checked=s.skills.includes(input.value);input.disabled=busy;input.closest('label').classList.toggle('is-selected',input.checked);}
 form.querySelector('#background-count').textContent=s.skills.length+' / '+s.required+' selected';form.querySelector('#background-status').textContent=backgroundStatus(s);form.querySelector('#background-selected-summary').textContent=backgroundSummary(s.skills);const preview=root.querySelector('#background-preview');if(preview)preview.innerHTML=backgroundPreview(s.skills,{esc});form.querySelector('[type="submit"]').disabled=busy||!s.valid;return s;
}
// Move existing controls without cloning their state or discarding the live record.
export function mountBackgroundLayout(root,state,selected,catalog,{esc}){
 const layout=root.querySelector('.layout'),sheet=root.querySelector('#sheet'),toolbar=root.querySelector('.toolbar');
 if(state.stage!=='background'){
  const actions=root.querySelector('#background-utilities');if(actions){actions.before(toolbar);actions.remove();}
  const rail=root.querySelector('#background-rail');if(rail){layout.append(sheet);rail.remove();}
  root.querySelector('#background-orientation')?.remove();return;
 }
 let utilities=root.querySelector('#background-utilities');if(!utilities){utilities=root.createElement('div');utilities.id='background-utilities';toolbar.before(utilities);const details=root.createElement('details');details.id='background-actions';details.innerHTML='<summary>Character actions</summary>';details.append(toolbar);utilities.append(details);const log=root.createElement('button');log.type='button';log.className='quiet';log.textContent='Full Log';log.id='background-full-log';log.addEventListener('click',()=>root.querySelector('#log-view').click());utilities.append(log);}
 let orientation=root.querySelector('#background-orientation');if(!orientation){orientation=root.createElement('ol');orientation.id='background-orientation';orientation.setAttribute('aria-label','Character creation overview');layout.before(orientation);}
 orientation.innerHTML='<li>✓ Characteristics</li><li aria-current="step">2 Background</li><li>3 Before career</li><li>4 Careers</li><li>5 Finalization</li>';
 let rail=root.querySelector('#background-rail');if(!rail){rail=root.createElement('aside');rail.id='background-rail';rail.innerHTML='<section id="background-selection" aria-label="Selection preview"></section><details id="background-record"><summary>Character record, notes &amp; GM controls</summary></details>';layout.append(rail);rail.querySelector('#background-record').append(sheet);}
 root.querySelector('#background-selection').innerHTML=backgroundRailView(state,selected,catalog,{esc});root.querySelector('#workspace>.step-count').textContent='BACKGROUND';root.querySelector('#step-title').textContent='Choose your background skills';
}
