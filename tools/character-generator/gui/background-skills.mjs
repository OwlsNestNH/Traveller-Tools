import {hasAslanBackgroundPopup,aslanBackgroundPopupView} from './aslan-background-popup.mjs';
import {speciesSkillPopupView} from './species-skill-popup.mjs';
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
 if(hasAslanBackgroundPopup(state))return aslanBackgroundPopupView(state,s,{esc,status:backgroundStatus(s),summary:backgroundSummary(s.skills)});
 if(state.character.species==='aezorgh')return speciesSkillPopupView(state,s,{esc});
 return '<p class="background-instruction">Choose '+s.required+' skills. Each begins at level 0.</p><form id="background-form"><div class="background-counter" role="status" aria-live="polite" aria-atomic="true"><strong id="background-count">'+s.skills.length+' / '+s.required+' selected</strong><span id="background-status">'+backgroundStatus(s)+'</span></div><fieldset class="background-options"><legend>Available skills</legend><div class="background-grid">'+s.options.map((name,i)=>'<label class="background-tile'+(s.skills.includes(name)?' is-selected':'')+'"><input id="background-skill-'+i+'" type="checkbox" name="skills" value="'+esc(name)+'" '+(s.skills.includes(name)?'checked':'')+'><span>'+esc(name)+'</span></label>').join('')+'</div></fieldset><p id="background-selected-summary">'+esc(backgroundSummary(s.skills))+'</p><div class="actions"><button type="submit" '+(s.valid?'':'disabled')+'>Accept background skills</button></div></form>';
}
export function backgroundRailView(state,selected,catalog,{esc}){
 const c=state.character,species=catalog.species.find(x=>x.id===c.species)?.name??c.species,context=[species,c.culture?c.culture+' upbringing':'',c.gender].filter(Boolean).join(' · ');
 return '<h2>'+esc(c.name||'Your Traveller')+'</h2><p class="background-context">'+esc(context)+'</p><p class="background-identity">Age '+esc(c.age)+' · EDU '+esc(c.stats.EDU??'—')+'</p><section class="background-allowance"><h3>Background allowance</h3><p>'+state.backgroundRemaining+' choices · each at level 0</p></section><section id="background-preview">'+backgroundPreview(selected,{esc})+'</section>';
}
export function syncBackgroundSkills(root,state,selected,{esc},busy=false){
 const s=backgroundSelection(state,selected),form=root.querySelector('#background-form');if(!form)return s;
 for(const input of form.querySelectorAll('[name="skills"]')){input.checked=s.skills.includes(input.value);input.disabled=busy;input.closest('label').classList.toggle('is-selected',input.checked);}
 form.querySelector('#background-count').textContent=s.skills.length+' / '+s.required+(hasAslanBackgroundPopup(state)?'':' selected');const progress=form.querySelector('#background-progress');if(progress)progress.dataset.ready=String(s.valid);form.querySelector('#background-status').textContent=backgroundStatus(s);form.querySelector('#background-selected-summary').textContent=backgroundSummary(s.skills);const count=root.querySelector('#background-selection-count');if(count)count.textContent=s.skills.length+' / '+s.required;const preview=root.querySelector('#background-preview');if(preview)preview.innerHTML=backgroundPreview(s.skills,{esc});form.querySelector('[type="submit"]').disabled=busy||!s.valid;return s;
}
// Keep the shared toolbar in place; move only the live character record.
export function mountBackgroundLayout(root,state,selected,catalog,{esc}){
 const layout=root.querySelector('.layout'),sheet=root.querySelector('#sheet');
 if(state.stage!=='background'){
  const rail=root.querySelector('#background-rail');if(rail){layout.append(sheet);rail.remove();}
  root.querySelector('#background-orientation')?.remove();return;
 }
 let orientation=root.querySelector('#background-orientation');if(!orientation){orientation=root.createElement('ol');orientation.id='background-orientation';orientation.setAttribute('aria-label','Character creation overview');layout.before(orientation);}
 orientation.innerHTML='<li>✓ Characteristics</li><li aria-current="step">2 Background</li><li>3 Pre-Career</li><li>4 Careers</li><li>5 Finalization</li>';
 let rail=root.querySelector('#background-rail');if(!rail){
  rail=root.createElement('aside');rail.id='background-rail';
  rail.innerHTML='<details id="background-record" name="background-panels"><summary><span>Character sheet</span><span class="background-panel-toggle" aria-hidden="true"></span></summary></details><details id="background-selection" name="background-panels" open><summary><span>Selection preview <span id="background-selection-count"></span></span><span class="background-panel-toggle" aria-hidden="true"></span></summary><div id="background-selection-content"></div></details>';
  layout.append(rail);rail.querySelector('#background-record').append(sheet);
  // Native exclusive details handle keyboard and pointer input. Keep the same
  // behavior in browsers without details[name], without recreating either panel.
  for(const panel of rail.querySelectorAll(':scope > details'))panel.addEventListener('toggle',()=>{
   if(panel.open)for(const other of rail.querySelectorAll(':scope > details'))if(other!==panel)other.open=false;
  });
 }
 root.querySelector('#background-selection-content').innerHTML=backgroundRailView(state,selected,catalog,{esc});
 root.querySelector('#background-selection-count').textContent=selected.length+' / '+state.backgroundRemaining;root.querySelector('#workspace>.step-count').textContent='BACKGROUND';root.querySelector('#step-title').textContent='Choose your background skills';
}
